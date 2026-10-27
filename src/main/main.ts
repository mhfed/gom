import {
  defaultAccounts,
  accountPartition,
  AccountCatalogStore,
  createAccount,
  editAccount as editCatalogAccount,
  archiveAccount as archiveCatalogAccount,
  restoreAccount as restoreCatalogAccount,
  moveAccount as moveCatalogAccount,
} from "./accounts.ts";
import { RecoveryPolicy, type FailureReason } from "./recovery.ts";
import {
  defaultPreferences,
  normalizePreferences,
  restoreBounds,
  SettingsWriter,
} from "./preferences.ts";
import {
  notificationAllowed,
  validNotificationFrame,
  hasUnread,
} from "./notification-policy.ts";
import { normalizeTheme } from "./theme.ts";
import { normalizePresentation, sidebarWidth } from "./presentation.ts";
import {
  createCustomProvider,
  defaultProviders,
  isBuiltinProviderId,
} from "./providers.ts";
import {
  normalizeProviderTabs,
  openProviderTab,
  toggleProviderPin,
  closeProviderTab,
} from "./provider-tabs.ts";
import { layoutViews } from "./layout.ts";
import { normalizeUnread } from "./unread.ts";
import { authScript } from "./auth-detection.ts";
import { pageSnapshotScript } from "./page-snapshot.ts";
import { StatePublisher } from "./state-publisher.ts";
import { limitBackgroundWarmup } from "./background-throttling.ts";
import { ProbeQueue } from "./probe-queue.ts";
import { configureMacOSInput } from "./macos-input.ts";
import { ManualUpdateChecker } from "./update-check.ts";
import { UpdateSchedule } from "./update-schedule.ts";
import {
  app,
  BrowserWindow,
  WebContentsView,
  session,
  ipcMain,
  dialog,
  shell,
  Menu,
  Tray,
  nativeImage,
  globalShortcut,
  Notification,
  screen,
  net,
  autoUpdater,
  powerMonitor,
  type Session,
  type WebContents,
} from "electron";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import {
  PROVIDERS,
  PROVIDER_ORDER,
  type BuiltinProviderId,
  type ProviderId,
  type AccountId,
  type Account,
  type AccountResult,
  type AppState,
  type ProviderStatus,
  type ProviderResult,
} from "../shared.ts";
import {
  navigationPolicy,
  validProviderId,
  trustedShellRequest,
} from "./security.ts";
import {
  AUTH_COOKIE_NAMES,
  COOKIE_SCOPES,
  ChromeSources,
  ImportFailure,
} from "./local-accounts.ts";
import {
  replaceLoginCookies,
  replaceProviderCookies,
  type LoginCookie,
} from "./cookie-transaction.ts";
import { OperationGate } from "./operation-gate.ts";
import { ViewRegistry, flushBeforeClose } from "./view-registry.ts";
configureMacOSInput(app.commandLine, process.platform, process.versions);
// Electron 45 derives macOS cookie/safeStorage Keychain names from app.getName().
// Retain the original encryption identity even though the visible app is Gom.
app.setName("Tin Nhan");
app.setPath("userData", join(app.getPath("appData"), "TinNhanDesktop"));
const sources = new ChromeSources(
  join(homedir(), "Library/Application Support/Google/Chrome"),
);
let win: BrowserWindow;
let closing = false,
  closed = false;
let poll: ReturnType<typeof setInterval>;
const configured = new Set<Session>();
const imports = new OperationGate();
const accountOps = new OperationGate();
const lastAccounts = new Map<ProviderId, AccountId>();
const popups = new Set<BrowserWindow>();
const popupProviders = new Map<WebContents, AccountId>();
const recovery = new RecoveryPolicy<AccountId>();
const probes = new ProbeQueue();
const backgroundWarmups = new WeakMap<WebContents, () => void>();
const navigationFailed = new Set<AccountId>();
const epochs = new Map<AccountId, number>();
let tray: Tray | undefined;
let traySignature = "";
let sleeping = false;
let accountEditorOpen = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let wakeTimer: ReturnType<typeof setTimeout> | undefined;
const lastNotificationClicks = new Map<AccountId, number>();
const permissionPrompts = new Set<AccountId>();
const closingProviders = new Set<ProviderId>();
const testAlerts = new Map<AccountId, Notification>();
const SHORTCUT = "CommandOrControl+Shift+Space";
const AUTOMATIC_UPDATES_SUPPORTED =
  process.env.GOM_AUTOMATIC_UPDATES_ENABLED === "true";
const PROVIDER_TAB_DEFAULTS_VERSION = 2;
const BUILTIN_PROVIDER_TABS_BY_VERSION: Record<number, ProviderId[]> = {
  1: ["gmail", "instagram"],
  2: ["discord", "slack"],
};
const appIconPath = join(__dirname, "app.png");
let savedProviderTabDefaultsVersion = PROVIDER_TAB_DEFAULTS_VERSION;
const MESSENGER_CHROME_CSS = `
  [role="banner"] {
    display: none !important;
  }
`;
const updateChecker = new ManualUpdateChecker({
  currentVersion: app.getVersion(),
  arch: process.arch,
  onChange: (updates) => {
    state.updates = {
      ...updates,
      automaticInstallAvailable: AUTOMATIC_UPDATES_SUPPORTED,
    };
    if (!closing) publish();
  },
});
let automaticUpdateActive = false;
const updateSchedule = new UpdateSchedule(() =>
  automaticUpdateActive ? Promise.resolve() : updateChecker.check(),
);
const state: AppState = {
  providers: defaultProviders(),
  providerTabs: normalizeProviderTabs(undefined, [...PROVIDER_ORDER]),
  presentation: normalizePresentation(undefined, []),
  commandOpen: false,
  accounts: defaultAccounts(),
  accountBusy: false,
  catalogWarning: "",
  preferences: defaultPreferences(),
  connections: Object.fromEntries(
    PROVIDER_ORDER.map((id) => [
      id,
      { phase: "connecting", reason: null, retryAt: null },
    ]),
  ),
  canGoBack: false,
  openAtLogin: false,
  startupAvailable: app.isPackaged,
  notificationStatus:
    "Thông báo gốc do từng nền tảng gửi; macOS quyết định hiển thị.",
  themes: Object.fromEntries(PROVIDER_ORDER.map((id) => [id, null])),
  collapsed: false,
  unread: Object.fromEntries(
    PROVIDER_ORDER.map((id) => [
      id,
      normalizeUnread({
        global: null,
        loaded: null,
        kind: id === "zalo" || id === "gmail" ? "messages" : "conversations",
      }),
    ]),
  ),
  active: "zalo",
  panel: "service",
  statuses: Object.fromEntries(PROVIDER_ORDER.map((id) => [id, "idle"])),
  profiles: [],
  importing: false,
  notice: "",
  version: app.getVersion(),
  updates: {
    ...updateChecker.snapshot(),
    automaticInstallAvailable: AUTOMATIC_UPDATES_SUPPORTED,
  },
};
const settingsPath = join(app.getPath("userData"), "window.json");
const settingsWriter = new SettingsWriter(settingsPath);
const catalogStore = new AccountCatalogStore(
  join(app.getPath("userData"), "accounts.json"),
);
const views = new ViewRegistry<WebContentsView, AccountId>(createView);
function findAccount(
  id: unknown,
  includeArchived = false,
): Account | undefined {
  return typeof id === "string"
    ? state.accounts.find(
        (a) => a.id === id && (includeArchived || !a.archived),
      )
    : undefined;
}
function providerFor(id: AccountId): ProviderId {
  const account = findAccount(id, true);
  if (!account) throw new Error("unknown-account");
  return account.provider;
}
function unreadKind(provider: ProviderId): "messages" | "conversations" {
  return provider === "zalo" || provider === "gmail"
    ? "messages"
    : "conversations";
}
function providerDefinition(id: ProviderId) {
  const provider = state.providers.find((p) => p.id === id);
  if (!provider) throw new Error("unknown-provider");
  return provider;
}
function knownProvider(id: unknown): id is ProviderId {
  return validProviderId(id) && state.providers.some((p) => p.id === id);
}
function accountLabel(id: AccountId) {
  const a = findAccount(id, true)!;
  return `${providerDefinition(a.provider).label} · ${a.name}`;
}
function isCurrent(id: AccountId, contents: WebContents) {
  return !!findAccount(id) && views.peek(id)?.webContents === contents;
}
const partition = (id: AccountId) =>
  session.fromPartition(accountPartition(findAccount(id, true)!));
function initializeAccount(a: Account) {
  state.themes[a.id] ??= null;
  state.statuses[a.id] ??= "idle";
  state.connections[a.id] ??= {
    phase: "connecting",
    reason: null,
    retryAt: null,
  };
  state.unread[a.id] ??= normalizeUnread({
    global: null,
    loaded: null,
    kind: unreadKind(a.provider),
  });
  state.preferences.notifications[a.id] ??= "ask";
}
let dockBadge: string | undefined;
const statePublisher = new StatePublisher(
  () => {
    const active = views.peek(state.active);
    state.canGoBack =
      !!active &&
      !active.webContents.isDestroyed() &&
      active.webContents.navigationHistory.canGoBack();
    return state;
  },
  (snapshot) => {
    win.webContents.send("state", snapshot);
    const badge = hasUnread(
      state.accounts.filter((a) => !a.archived).map((a) => state.unread[a.id]),
    )
      ? "•"
      : "";
    if (badge !== dockBadge) {
      app.dock?.setBadge(badge);
      dockBadge = badge;
    }
    updateTray();
  },
);
const publish = (force = false) => {
  if (win && !win.isDestroyed()) statePublisher.publish(force);
};
function status(id: AccountId, value: ProviderStatus) {
  if (!findAccount(id)) return;
  state.statuses[id] = value;
  if (value !== "authenticated")
    state.unread[id] = normalizeUnread({
      global: null,
      loaded: null,
      kind: unreadKind(providerFor(id)),
    });
  publish();
}
async function external(url: string) {
  if (!/^https?:\/\//.test(url)) return;
  const answer = await dialog.showMessageBox(win, {
    type: "question",
    message: "Mở liên kết trong trình duyệt?",
    detail: new URL(url).origin,
    buttons: ["Hủy", "Mở trình duyệt"],
    defaultId: 0,
    cancelId: 0,
  });
  if (answer.response === 1) await shell.openExternal(url);
}
function setupSession(ses: Session, id: AccountId) {
  if (configured.has(ses)) return;
  configured.add(ses);
  const owned = (contents: WebContents | null) =>
    !!contents &&
    ([...views.entries()].some(
      ([provider, view]) => provider === id && view.webContents === contents,
    ) ||
      [...popups].some(
        (popup) =>
          !popup.isDestroyed() &&
          popup.webContents === contents &&
          popupProviders.get(contents) === id &&
          navigationPolicy(
            providerFor(id),
            contents.getURL(),
            state.providers,
          ) === "internal",
      ));
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const valid =
      !!findAccount(id) &&
      validNotificationFrame(
        providerFor(id),
        details.requestingUrl,
        details.isMainFrame,
        owned(contents),
        state.providers,
      );
    if (!valid || closing || !["notifications", "media"].includes(permission)) {
      callback(false);
      return;
    }
    if (permission === "notifications") {
      if (
        state.preferences.paused ||
        state.preferences.notifications[id] === "mute"
      ) {
        callback(false);
        return;
      }
      if (state.preferences.notifications[id] === "allow") {
        callback(true);
        return;
      }
      if (permissionPrompts.has(id)) {
        callback(false);
        return;
      }
      permissionPrompts.add(id);
    }
    void dialog
      .showMessageBox(win, {
        type: "question",
        message: `Cho phép ${accountLabel(id)} ${permission === "media" ? "dùng camera / mic" : "gửi thông báo"}?`,
        buttons: ["Không cho phép", "Cho phép"],
        defaultId: 0,
        cancelId: 0,
      })
      .then(async (r) => {
        if (
          permission === "notifications" &&
          !closing &&
          findAccount(id) &&
          owned(contents)
        ) {
          state.preferences.notifications[id] =
            r.response === 1 ? "allow" : "mute";
          await persist();
        }
        callback(
          !closing &&
            !!findAccount(id) &&
            owned(contents) &&
            r.response === 1 &&
            (permission !== "notifications" ||
              notificationAllowed(state.preferences, id)),
        );
      })
      .catch(() => callback(false))
      .finally(() => permissionPrompts.delete(id));
  });
  ses.setPermissionCheckHandler(
    (contents, permission, origin, details) =>
      permission === "notifications" &&
      !closing &&
      !!findAccount(id) &&
      validNotificationFrame(
        providerFor(id),
        details.requestingUrl || origin,
        details.isMainFrame,
        owned(contents),
        state.providers,
      ) &&
      notificationAllowed(state.preferences, id),
  );
  ses.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({
      title: "Lưu tệp từ " + providerDefinition(providerFor(id)).label,
    });
  });
}
function guard(contents: WebContents, id: AccountId) {
  contents.on("dom-ready", () => {
    if (providerFor(id) !== "messenger") return;
    let url: URL;
    try {
      url = new URL(contents.getURL());
    } catch {
      return;
    }
    if (url.hostname !== "facebook.com" && url.hostname !== "www.facebook.com")
      return;
    void contents.insertCSS(MESSENGER_CHROME_CSS).catch(() => {});
  });
  contents.on("will-navigate", (event, url) => {
    const policy = navigationPolicy(providerFor(id), url, state.providers);
    if (policy !== "internal") {
      event.preventDefault();
      if (policy === "external") void external(url);
    }
  });
  contents.on("will-redirect", (event, url, _inPlace, isMainFrame) => {
    if (
      navigationPolicy(providerFor(id), event.url ?? url, state.providers) !==
      "internal"
    ) {
      event.preventDefault();
      const principal = [...views.entries()].some(
        ([provider, view]) => provider === id && view.webContents === contents,
      );
      if ((event.isMainFrame ?? isMainFrame) && principal) fail(id, "blocked");
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    const policy = navigationPolicy(providerFor(id), url, state.providers);
    if (policy === "internal")
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 760,
          height: 800,
          webPreferences: {
            session: contents.session,
            preload: join(__dirname, "platform-preload.cjs"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    if (policy === "external") void external(url);
    return { action: "deny" };
  });
  contents.on("did-create-window", (popup) => {
    popups.add(popup);
    const popupContents = popup.webContents;
    popupProviders.set(popupContents, id);
    guard(popup.webContents, id);
    popup.on("closed", () => {
      popupProviders.delete(popupContents);
      popups.delete(popup);
    });
  });
}
function createView(id: AccountId) {
  if (!findAccount(id)) throw Error("unknown-account");
  state.statuses[id] = "loading";
  const ses = partition(id);
  setupSession(ses, id);
  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      preload: join(__dirname, "platform-preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  backgroundWarmups.set(
    view.webContents,
    limitBackgroundWarmup(view.webContents),
  );
  view.setVisible(false);
  guard(view.webContents, id);
  view.webContents.on(
    "did-start-navigation",
    (_e, _url, inPlace, isMainFrame) => {
      if (isCurrent(id, view.webContents) && isMainFrame && !inPlace) {
        navigationFailed.delete(id);
        epochs.set(id, (epochs.get(id) ?? 0) + 1);
      }
    },
  );
  view.webContents.on("did-start-loading", () => {
    if (!isCurrent(id, view.webContents)) return;
    state.connections[id] = {
      phase: isOnline() ? "connecting" : "offline",
      reason: null,
      retryAt: null,
    };
    status(id, "loading");
  });
  view.webContents.on("did-navigate-in-page", () => publish());
  view.webContents.on("did-finish-load", () => {
    if (!isCurrent(id, view.webContents) || navigationFailed.has(id)) return;
    recovery.loaded(id, Date.now());
    state.connections[id] = {
      phase: isOnline() ? "connected" : "offline",
      reason: null,
      retryAt: null,
    };
    layout();
    status(id, "ready");
    void detect(id, view.webContents);
  });
  view.webContents.on("did-fail-load", (_e, code, _desc, _url, main) => {
    if (isCurrent(id, view.webContents) && main && code !== -3)
      fail(
        id,
        [-106, -105, -102, -101, -100, -118].includes(code)
          ? "network"
          : "load-failed",
      );
  });
  view.webContents.on("render-process-gone", () => {
    if (!isCurrent(id, view.webContents)) return;
    epochs.set(id, (epochs.get(id) ?? 0) + 1);
    fail(id, "crashed");
  });
  void view.webContents
    .loadURL(providerDefinition(providerFor(id)).entry)
    .catch(() => {});
  return view;
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  layoutViews(
    views.entries(),
    width,
    height,
    state.active,
    state.commandOpen ||
      (state.panel === "service" && state.connections[state.active].reason)
      ? "settings"
      : state.panel,
  );
}
function activate(id: AccountId, focusPage = true) {
  if (accountEditorOpen) return;
  const account = findAccount(id);
  if (!account || closing || closingProviders.has(account.provider)) return;
  const opened = !state.providerTabs.open.includes(account.provider);
  state.providerTabs = openProviderTab(state.providerTabs, account.provider);
  const selectionChanged =
    state.active !== id || lastAccounts.get(account.provider) !== id;
  lastAccounts.set(account.provider, id);
  state.active = id;
  state.commandOpen = false;
  state.panel = "service";
  const view = views.activate(id);
  if (!win.contentView.children.includes(view))
    win.contentView.addChildView(view);
  layout();
  if (
    focusPage &&
    win.isVisible() &&
    !win.isMinimized() &&
    win.isFocused() &&
    !state.connections[id].reason
  )
    view.webContents.focus();
  void detect(id, view.webContents, true);
  publish();
  if (selectionChanged || opened) scheduleSave();
}

function detect(id: AccountId, contents: WebContents, refresh = false) {
  return probes.run(contents, () => detectOnce(id, contents), refresh);
}
async function detectOnce(id: AccountId, contents: WebContents) {
  if (
    closing ||
    sleeping ||
    !isCurrent(id, contents) ||
    recovery.reason(id) ||
    contents.isDestroyed() ||
    contents.isLoadingMainFrame() ||
    navigationPolicy(providerFor(id), contents.getURL(), state.providers) !==
      "internal"
  )
    return;
  // Arbitrary websites do not expose Gom's messaging DOM contract.
  // Their native loading/connection status remains authoritative.
  if (providerDefinition(providerFor(id)).custom) return;
  const epoch = epochs.get(id) ?? 0;
  const valid = () =>
    !closing &&
    isCurrent(id, contents) &&
    !contents.isDestroyed() &&
    !contents.isLoadingMainFrame() &&
    epoch === (epochs.get(id) ?? 0) &&
    !recovery.reason(id);
  try {
    const snapshot = await contents.executeJavaScript(
      pageSnapshotScript(
        state.presentation.theme === "platform" &&
          id === state.active &&
          win.isVisible(),
      ),
    );
    const result = snapshot.status;
    const theme = normalizeTheme(snapshot.theme);
    const unread = normalizeUnread(
      result === "authenticated"
        ? snapshot.unread
        : {
            global: null,
            loaded: null,
            kind: unreadKind(providerFor(id)),
          },
    );
    if (!valid()) return;
    let changed = false;
    if (theme && JSON.stringify(theme) !== JSON.stringify(state.themes[id])) {
      state.themes[id] = theme;
      changed = true;
    }
    const previous = state.unread[id];
    if (
      previous.count !== unread.count ||
      previous.kind !== unread.kind ||
      previous.source !== unread.source ||
      previous.approximate !== unread.approximate
    ) {
      state.unread[id] = unread;
      changed = true;
    }
    if (
      ["ready", "needs-login", "authenticated"].includes(result) &&
      state.statuses[id] !== result
    ) {
      state.statuses[id] = result;
      changed = true;
    }
    if (result === "authenticated") {
      backgroundWarmups.get(contents)?.();
      backgroundWarmups.delete(contents);
    }
    if (changed) statePublisher.schedule();
  } catch {}
}
function isOnline() {
  return !sleeping && net.isOnline();
}
function fail(id: AccountId, reason: FailureReason) {
  if (closing || !findAccount(id)) return;
  navigationFailed.add(id);
  epochs.set(id, (epochs.get(id) ?? 0) + 1);
  recovery.fail(id, reason, Date.now());
  state.connections[id] = {
    phase: isOnline() ? "error" : "offline",
    reason,
    retryAt: recovery.retryAt(id),
  };
  status(id, "error");
  layout();
}
function reloadProvider(id: AccountId, manual = false, home = false) {
  if (closing || state.importing || !findAccount(id)) return;
  if (
    manual &&
    (state.panel !== "service" ||
      state.commandOpen ||
      accountEditorOpen ||
      !state.providerTabs.open.includes(providerFor(id)))
  )
    return;
  const view = views.peek(id);
  if (!view || view.webContents.isDestroyed()) return;
  if (manual) recovery.reset(id);
  epochs.set(id, (epochs.get(id) ?? 0) + 1);
  if (
    home ||
    navigationPolicy(
      providerFor(id),
      view.webContents.getURL(),
      state.providers,
    ) !== "internal"
  )
    void view.webContents
      .loadURL(providerDefinition(providerFor(id)).entry)
      .catch(() => {});
  else view.webContents.reload();
}
function goBack() {
  if (
    closing ||
    state.panel !== "service" ||
    state.commandOpen ||
    accountEditorOpen ||
    !state.providerTabs.open.includes(providerFor(state.active))
  )
    return;
  const contents = views.peek(state.active)?.webContents;
  if (
    contents &&
    !contents.isDestroyed() &&
    contents.navigationHistory.canGoBack()
  )
    contents.navigationHistory.goBack();
}
function tick() {
  if (closing || sleeping) return;
  const online = isOnline();
  for (const [id] of views.entries()) {
    const c = state.connections[id];
    if (!online) c.phase = "offline";
    else if (c.phase === "offline")
      c.phase = recovery.reason(id)
        ? "error"
        : state.statuses[id] === "loading"
          ? "connecting"
          : "connected";
  }
  if (!state.importing)
    for (const id of recovery.due(Date.now(), online)) reloadProvider(id);
  for (const [id, view] of views.entries()) void detect(id, view.webContents);
  publish();
}
function showWindow() {
  if (!win || win.isDestroyed() || closing) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  const active = views.peek(state.active);
  if (active) void detect(state.active, active.webContents, true);
  if (
    !state.commandOpen &&
    state.panel === "service" &&
    !state.connections[state.active].reason
  )
    views.activate(state.active).webContents.focus();
  else win.webContents.focus();
}
function showSettings() {
  state.commandOpen = false;
  state.panel = "settings";
  layout();
  publish();
  showWindow();
}
function showProviderLibrary() {
  if (closing || accountEditorOpen) return;
  state.commandOpen = false;
  state.panel = "providers";
  layout();
  publish();
  showWindow();
}
function showUpdates() {
  if (closing) return;
  // Keep an unfinished account form visible; the result can wait in Settings.
  if (!accountEditorOpen) {
    showSettings();
    win.webContents.send("updates-requested");
  }
  void updateChecker.check();
}
function showCommand(open: boolean) {
  if (accountEditorOpen) return;
  state.commandOpen = open;
  layout();
  publish();
  showWindow();
}
function toggleWindow() {
  if (win.isVisible() && win.isFocused()) win.hide();
  else showWindow();
}
function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  const signature = `${state.preferences.paused}:${hasUnread(state.accounts.filter((a) => !a.archived).map((a) => state.unread[a.id]))}:${JSON.stringify(state.accounts)}`;
  if (signature === traySignature) return;
  traySignature = signature;
  tray.setToolTip(
    "Gom" +
      (hasUnread(
        state.accounts
          .filter((a) => !a.archived)
          .map((a) => state.unread[a.id]),
      )
        ? " · Có mục chưa đọc"
        : ""),
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Mở Gom", click: showWindow },
      ...state.accounts
        .filter((a) => !a.archived)
        .map(({ id }) => ({
          label: accountLabel(id),
          click: () => {
            activate(id);
            showWindow();
          },
        })),
      { type: "separator" },
      {
        label: "Tạm dừng thông báo",
        type: "checkbox",
        checked: state.preferences.paused,
        click: () => {
          state.preferences.paused = !state.preferences.paused;
          void persist();
        },
      },
      { label: "Cài đặt…", click: showSettings },
      { type: "separator" },
      { label: "Thoát Gom", click: () => app.quit() },
    ]),
  );
}
function configureShortcut(enabled: boolean) {
  if (!enabled) {
    globalShortcut.unregister(SHORTCUT);
    state.preferences.shortcut = false;
    return;
  }
  if (
    !globalShortcut.isRegistered(SHORTCUT) &&
    !globalShortcut.register(SHORTCUT, toggleWindow)
  ) {
    state.preferences.shortcut = false;
    state.notice =
      "Phím tắt Cmd+Shift+Space đang được app khác dùng. Bạn có thể bật lại sau.";
  } else state.preferences.shortcut = true;
}
async function persist(forcePublish = false) {
  publish(forcePublish);
  try {
    await save();
  } catch {
    state.notice =
      "Chưa lưu được cài đặt. Bạn kiểm tra dung lượng/quyền ghi rồi thử lại.";
    publish();
  }
}
function scheduleSave() {
  if (closing) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persist(), 500);
}
function testNotification(id: AccountId) {
  if (!findAccount(id) || !notificationAllowed(state.preferences, id)) {
    state.notificationStatus =
      "Bạn chọn Cho phép và bỏ tạm dừng trước khi thử thông báo.";
    publish();
    return;
  }
  if (!Notification.isSupported()) {
    state.notificationStatus = "macOS hiện không hỗ trợ thông báo cho app.";
    publish();
    return;
  }
  testAlerts.get(id)?.close();
  const notification = new Notification({
    title: accountLabel(id) + " · Gom",
    body: "Thông báo thử. Bấm để mở nền tảng này.",
    silent: true,
  });
  testAlerts.set(id, notification);
  notification.on("click", () => {
    if (!closing && findAccount(id)) {
      activate(id);
      showWindow();
    }
  });
  notification.on("show", () => {
    state.notificationStatus =
      "Đã gửi thông báo thử tới macOS. Nếu chưa thấy, kiểm tra quyền thông báo và chế độ Tập trung.";
    publish();
  });
  notification.on("failed", () => {
    state.notificationStatus =
      "macOS chưa hiển thị được thông báo. Kiểm tra quyền thông báo cho Gom trong Cài đặt hệ thống.";
    publish();
  });
  notification.on("close", () => {
    if (testAlerts.get(id) === notification) testAlerts.delete(id);
  });
  state.notificationStatus = "Đang gửi thông báo thử tới macOS…";
  publish();
  notification.show();
}
async function verifyMessenger(contents: WebContents) {
  await contents.loadURL(PROVIDERS.messenger.entry);
  const until = Date.now() + 35000;
  while (Date.now() < until && !contents.isDestroyed()) {
    const value = await contents
      .executeJavaScript(authScript)
      .catch(() => "ready");
    if (value === "authenticated") return true;
    if (value === "needs-login") return false;
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}
async function verifyProvider(contents: WebContents, provider: ProviderId) {
  await contents.loadURL(providerDefinition(provider).entry);
  const until = Date.now() + 35000;
  while (Date.now() < until && !contents.isDestroyed()) {
    const value = await contents
      .executeJavaScript(authScript)
      .catch(() => "ready");
    if (value === "authenticated") return true;
    if (value === "needs-login") return false;
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}
async function messengerDestination(targetId: AccountId) {
  const contents = views.peek(targetId)?.webContents;
  const epoch = epochs.get(targetId) ?? 0;
  const valid = () =>
    contents &&
    !contents.isDestroyed() &&
    isCurrent(targetId, contents) &&
    !contents.isLoadingMainFrame() &&
    epoch === (epochs.get(targetId) ?? 0) &&
    navigationPolicy("messenger", contents.getURL()) === "internal";
  if (!valid() || !contents) return "target-not-ready";
  const auth = await contents
    .executeJavaScript(authScript)
    .catch(() => "ready");
  if (!valid()) return "target-not-ready";
  if (auth === "authenticated") return "already-connected";
  const cookies = await Promise.all(
    ["c_user", "xs"].map((name) =>
      partition(targetId).cookies.get({ domain: "facebook.com", name }),
    ),
  );
  if (cookies.flat().some((c) => ["c_user", "xs"].includes(c.name)))
    return "already-connected";
  return valid() && auth === "needs-login" ? undefined : "target-not-ready";
}
async function importMessenger(sourceId: string, targetId: AccountId) {
  if (!findAccount(targetId) || providerFor(targetId) !== "messenger")
    return { status: "invalid-account" };
  if (state.importing) return { status: "busy" };
  state.importing = true;
  state.notice = "Đang kiểm tra phiên Messenger từ hồ sơ đã chọn…";
  publish();
  let stage: BrowserWindow | undefined;
  let stageSession: Session | undefined;
  let cookies: LoginCookie[] = [];
  let verified: LoginCookie[] = [];
  try {
    const destination = await messengerDestination(targetId);
    if (destination) {
      state.notice =
        destination === "already-connected"
          ? "Messenger đã có phiên. Phiên hiện tại được giữ nguyên."
          : "Tài khoản Messenger chưa tải xong. Đợi trang đăng nhập hiện ra rồi thử lại.";
      return { status: destination };
    }
    cookies = await sources.loginCookies(sourceId);
    stageSession = session.fromPartition("import-" + crypto.randomUUID());
    stage = new BrowserWindow({
      show: false,
      webPreferences: {
        session: stageSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    stage.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    stage.webContents.on("will-redirect", (event, url) => {
      if (navigationPolicy("messenger", url) !== "internal")
        event.preventDefault();
    });
    for (const cookie of cookies) await stageSession.cookies.set(cookie);
    if (!(await verifyMessenger(stage.webContents)))
      throw new ImportFailure("verification-failed");
    verified = (
      await stageSession.cookies.get({ domain: "facebook.com" })
    )
      .filter(
        (c) =>
          ["c_user", "xs"].includes(c.name) &&
          ["facebook.com", ".facebook.com"].includes(c.domain ?? "") &&
          c.path === "/",
      )
      .map((c) => ({
        url: "https://www.facebook.com/",
        name: c.name,
        value: c.value,
        domain: c.domain!,
        path: "/",
        secure: !!c.secure,
        httpOnly: !!c.httpOnly,
        sameSite: c.sameSite,
        ...(c.expirationDate !== undefined
          ? { expirationDate: c.expirationDate }
          : {}),
      }));
    const finalDestination = await messengerDestination(targetId);
    if (finalDestination) {
      state.notice =
        "Phiên Messenger hiện tại được giữ nguyên. Đợi tài khoản tải xong hoặc dùng tài khoản mới để nhập phiên.";
      return { status: finalDestination };
    }
    const target = views.activate(targetId);
    if (!win.contentView.children.includes(target))
      win.contentView.addChildView(target);
    layout();
    target.webContents.stop();
    await replaceLoginCookies(
      partition(targetId).cookies,
      verified,
      () => verifyMessenger(target.webContents),
      true,
    );
    activate(targetId);
    status(targetId, "authenticated");
    state.notice =
      "Đã dùng phiên Messenger có sẵn. Bạn có thể đọc và trả lời ngay.";
    return { status: "imported" };
  } catch (error) {
    const code =
      error instanceof ImportFailure
        ? error.code
        : error instanceof Error && error.message === "destination-has-session"
          ? "already-connected"
          : error instanceof Error && error.message === "rollback-failed"
            ? "rollback-failed"
            : "import-failed";
    const messages: Record<string, string> = {
      "needs-login":
        "Hồ sơ này chưa có phiên Facebook còn hiệu lực. Bạn đăng nhập Facebook trên Chrome rồi thử lại.",
      "needs-os-authorization":
        "Chưa được macOS cho phép đọc Chrome Safe Storage. Bạn có thể đăng nhập trực tiếp trong app.",
      "source-busy": "Chrome đang bận. Bạn đợi một chút rồi thử lại.",
      "verification-failed":
        "Phiên có sẵn cần xác thực thêm. Bạn đăng nhập Messenger trực tiếp trong app.",
      "source-unavailable": "Không đọc được hồ sơ Chrome đã chọn.",
      "rollback-failed":
        "Chưa khôi phục được phiên cũ. Bạn đăng nhập Messenger trực tiếp trong app.",
      unsupported: "Định dạng phiên Chrome này chưa được hỗ trợ.",
    };
    state.notice =
      messages[code] ??
      "Chưa nhập được phiên Messenger. Phiên hiện tại vẫn được giữ.";
    return { status: code };
  } finally {
    cookies.forEach((cookie) => (cookie.value = ""));
    verified.forEach((cookie) => (cookie.value = ""));
    if (stage && !stage.isDestroyed()) stage.destroy();
    await stageSession?.clearStorageData().catch(() => {});
    state.importing = false;
    publish();
  }
}
async function providerDestination(targetId: AccountId, provider: ProviderId) {
  const contents = views.peek(targetId)?.webContents;
  const epoch = epochs.get(targetId) ?? 0;
  const valid = () =>
    contents &&
    !contents.isDestroyed() &&
    isCurrent(targetId, contents) &&
    !contents.isLoadingMainFrame() &&
    epoch === (epochs.get(targetId) ?? 0) &&
    navigationPolicy(provider, contents.getURL()) === "internal";
  if (!valid() || !contents) return "target-not-ready";
  const auth = await contents
    .executeJavaScript(authScript)
    .catch(() => "ready");
  if (!valid()) return "target-not-ready";
  if (auth === "authenticated") return "already-connected";
  return auth === "needs-login" ? undefined : "target-not-ready";
}
async function importProviderSession(
  sourceId: string,
  targetId: AccountId,
  provider: BuiltinProviderId,
) {
  if (provider === "messenger") return importMessenger(sourceId, targetId);
  if (!findAccount(targetId) || providerFor(targetId) !== provider)
    return { status: "invalid-account" };
  if (state.importing) return { status: "busy" };
  state.importing = true;
  const label = providerDefinition(provider).label;
  state.notice = `Đang kiểm tra phiên ${label} từ hồ sơ Chrome đã chọn…`;
  publish();
  let stage: BrowserWindow | undefined;
  let stageSession: Session | undefined;
  let cookies: LoginCookie[] = [];
  let verified: LoginCookie[] = [];
  try {
    const destination = await providerDestination(targetId, provider);
    if (destination) {
      state.notice =
        destination === "already-connected"
          ? `${label} đã có phiên. Phiên hiện tại được giữ nguyên.`
          : `Tài khoản ${label} chưa tải xong. Đợi trang đăng nhập hiện ra rồi thử lại.`;
      return { status: destination };
    }
    cookies = await sources.loginCookies(sourceId, provider);
    stageSession = session.fromPartition("import-" + crypto.randomUUID());
    stage = new BrowserWindow({
      show: false,
      webPreferences: {
        session: stageSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    stage.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    stage.webContents.on("will-navigate", (event, url) => {
      if (navigationPolicy(provider, url) !== "internal")
        event.preventDefault();
    });
    stage.webContents.on("will-redirect", (event, url) => {
      if (navigationPolicy(provider, url) !== "internal")
        event.preventDefault();
    });
    for (const cookie of cookies) await stageSession.cookies.set(cookie);
    if (!(await verifyProvider(stage.webContents, provider)))
      throw new ImportFailure("verification-failed");
    for (const domain of COOKIE_SCOPES[provider]) {
      for (const name of AUTH_COOKIE_NAMES[provider]) {
        const staged = await stageSession.cookies.get({ domain, name });
        for (const cookie of staged) {
          if (!cookie.domain) continue;
          const host = cookie.domain.replace(/^\./, "").toLowerCase();
          if (
            !COOKIE_SCOPES[provider].some(
              (scope) => host === scope || host.endsWith("." + scope),
            )
          )
            continue;
          verified.push({
            url: `https://${cookie.domain.replace(/^\./, "")}/`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path ?? "/",
            secure: !!cookie.secure,
            httpOnly: !!cookie.httpOnly,
            sameSite: cookie.sameSite,
            ...(cookie.expirationDate !== undefined
              ? { expirationDate: cookie.expirationDate }
              : {}),
          });
        }
      }
    }
    const finalDestination = await providerDestination(targetId, provider);
    if (finalDestination) {
      state.notice =
        `${label} hiện có phiên. Phiên đang dùng được giữ nguyên.`;
      return { status: finalDestination };
    }
    const target = views.activate(targetId);
    if (!win.contentView.children.includes(target))
      win.contentView.addChildView(target);
    layout();
    target.webContents.stop();
    await replaceProviderCookies(
      partition(targetId).cookies,
      verified,
      COOKIE_SCOPES[provider],
      AUTH_COOKIE_NAMES[provider],
      () => verifyProvider(target.webContents, provider),
      true,
    );
    activate(targetId);
    status(targetId, "authenticated");
    state.notice = `Đã dùng phiên ${label} có sẵn.`;
    return { status: "imported" };
  } catch (error) {
    const code =
      error instanceof ImportFailure
        ? error.code
        : error instanceof Error && error.message === "destination-has-session"
          ? "already-connected"
          : error instanceof Error && error.message === "rollback-failed"
            ? "rollback-failed"
            : "import-failed";
    const messages: Record<string, string> = {
      "needs-login": `Profile Chrome chưa có phiên ${label} còn hiệu lực. Đăng nhập trên Chrome rồi thử lại.`,
      "needs-os-authorization":
        "macOS chưa cho phép Gom đọc Chrome Safe Storage. Bạn có thể đăng nhập trực tiếp trong app.",
      "source-busy": "Chrome đang bận. Bạn đợi một chút rồi thử lại.",
      "verification-failed":
        `Không xác minh được phiên ${label}. Phiên đích vẫn được giữ; hãy đăng nhập trực tiếp trong Gom.`,
      "source-unavailable": "Không đọc được profile Chrome đã chọn.",
      "unsupported-session":
        `${label} lưu phiên trong vùng dữ liệu không thể nhập an toàn bằng cookie. Hãy đăng nhập trực tiếp trong Gom${provider === "telegram" || provider === "zalo" ? " hoặc quét QR" : ""}.`,
      "rollback-failed":
        `Chưa khôi phục được cookie ${label}. Hãy mở lại tài khoản để kiểm tra phiên.`,
      unsupported: "Định dạng cookie Chrome này chưa được hỗ trợ.",
    };
    state.notice =
      messages[code] ??
      `Chưa nhập được phiên ${label}. Phiên tài khoản đích vẫn được giữ.`;
    return { status: code };
  } finally {
    cookies.forEach((cookie) => (cookie.value = ""));
    verified.forEach((cookie) => (cookie.value = ""));
    if (stage && !stage.isDestroyed()) stage.destroy();
    await stageSession?.clearStorageData().catch(() => {});
    state.importing = false;
    publish();
  }
}
function accountForProvider(provider: ProviderId) {
  const last = lastAccounts.get(provider);
  const recent = last ? findAccount(last) : undefined;
  return (
    (recent?.provider === provider ? recent : undefined) ||
    state.accounts.find((a) => a.provider === provider && !a.archived)
  );
}
function activateProvider(provider: ProviderId, focusPage = true) {
  const target = accountForProvider(provider);
  if (target) activate(target.id, focusPage);
  else showSettings();
}
async function addProvider(arg: unknown): Promise<ProviderResult> {
  if (state.importing || state.accountBusy || closing)
    return {
      ok: false,
      message: "App đang xử lý tài khoản. Bạn thử lại sau một chút.",
    };
  if (state.catalogWarning) return { ok: false, message: state.catalogWarning };
  if (
    !arg ||
    typeof arg !== "object" ||
    !("name" in arg) ||
    !("url" in arg) ||
    typeof arg.name !== "string" ||
    typeof arg.url !== "string"
  )
    return { ok: false, message: "Nhập tên và địa chỉ website hợp lệ." };
  const { name, url } = arg;
  return (
    accountOps.run(async () => {
      state.accountBusy = true;
      publish();
      try {
        const provider = createCustomProvider(name, url);
        const account = createAccount(provider.id, "Cá nhân");
        const providers = [...state.providers, provider];
        const accounts = [...state.accounts, account];
        if (closing) return { ok: false, message: "App đang thoát." };
        await catalogStore.commit(accounts, providers);
        state.providers = providers;
        state.accounts = accounts;
        initializeAccount(account);
        activate(account.id);
        await persist();
        return { ok: true, accountId: account.id, providerId: provider.id };
      } catch (error) {
        const invalid =
          error instanceof Error &&
          /invalid|url|name|limit|provider/i.test(error.message);
        const message = invalid
          ? "Nhập tên website và URL http:// hoặc https:// hợp lệ, không kèm mật khẩu."
          : "Chưa lưu được website. Bạn kiểm tra quyền ghi hoặc dung lượng rồi thử lại.";
        return { ok: false, message };
      } finally {
        state.accountBusy = false;
        publish();
      }
    }) ?? { ok: false, message: "App đang xử lý tài khoản." }
  );
}
async function closeProvider(provider: ProviderId): Promise<AccountResult> {
  if (
    closing ||
    accountEditorOpen ||
    state.commandOpen ||
    state.accountBusy ||
    state.importing
  )
    return {
      ok: false,
      message: "Đợi thao tác hiện tại hoàn tất để đóng tab.",
    };
  if (!state.providerTabs.open.includes(provider)) return { ok: true };
  state.accountBusy = true;
  closingProviders.add(provider);
  publish();
  try {
    const custom = providerDefinition(provider).custom;
    const owned = [...views.entries()].filter(
      ([id]) => providerFor(id) === provider,
    );
    if (
      custom &&
      !(await flushBeforeClose(owned.map(([, v]) => v.webContents.session)))
    )
      return {
        ok: false,
        message: "Chưa lưu xong phiên website. Bạn thử đóng tab lại sau.",
      };
    if (closing) return { ok: false, message: "App đang thoát." };
    const active = providerFor(state.active);
    const result = closeProviderTab(state.providerTabs, provider, active);
    state.providerTabs = result.tabs;
    if (custom) {
      for (const popup of [...popups])
        if (!popup.isDestroyed()) {
          const id = popupProviders.get(popup.webContents);
          if (id && providerFor(id) === provider) popup.destroy();
        }
      for (const [id, view] of owned) {
        epochs.set(id, (epochs.get(id) ?? 0) + 1);
        views.remove(id);
        win.contentView.removeChildView(view);
        if (!view.webContents.isDestroyed()) view.webContents.close();
        recovery.reset(id);
        navigationFailed.delete(id);
        state.statuses[id] = "idle";
        state.connections[id] = {
          phase: "connecting",
          reason: null,
          retryAt: null,
        };
      }
    }
    if (!result.next) showProviderLibrary();
    else if (active === provider) {
      const target =
        accountForProvider(result.next) ||
        result.tabs.open.map(accountForProvider).find(Boolean);
      if (!target) showProviderLibrary();
      else if (state.panel === "service") activate(target.id);
      else {
        // Returning from Settings/Library must not reopen a tab just closed.
        state.active = target.id;
        lastAccounts.set(target.provider, target.id);
      }
    }
    layout();
    await persist();
    return { ok: true };
  } finally {
    closingProviders.delete(provider);
    state.accountBusy = false;
    publish();
  }
}
async function showProviderMenu(request: unknown) {
  if (
    closing ||
    accountEditorOpen ||
    state.commandOpen ||
    state.accountBusy ||
    state.importing
  )
    return;
  if (
    !request ||
    typeof request !== "object" ||
    !("x" in request) ||
    !("y" in request) ||
    typeof request.x !== "number" ||
    typeof request.y !== "number" ||
    !Number.isFinite(request.x) ||
    !Number.isFinite(request.y)
  )
    return;
  const selectedAccount = state.active,
    panel = state.panel;
  let selected: (() => void | Promise<unknown>) | undefined;
  const items: Electron.MenuItemConstructorOptions[] = [];
  if ("provider" in request && knownProvider(request.provider)) {
    const id = request.provider;
    if (!state.providerTabs.open.includes(id)) return;
    items.push(
      { label: providerDefinition(id).label, enabled: false },
      { type: "separator" },
      {
        id: "provider-pin",
        label: state.providerTabs.pinned.includes(id)
          ? "Bỏ ghim tab"
          : "Ghim tab",
        click: () => {
          selected = async () => {
            if (!state.providerTabs.open.includes(id)) return;
            state.providerTabs = toggleProviderPin(state.providerTabs, id);
            await persist();
          };
        },
      },
      {
        id: "provider-close",
        label: "Đóng tab",
        click: () => {
          selected = async () => {
            const result = await closeProvider(id);
            if (!result.ok) {
              state.notice = result.message ?? "Chưa đóng được tab.";
              publish();
            }
          };
        },
      },
    );
  } else if ("overflow" in request && Array.isArray(request.overflow)) {
    const ids = [
      ...new Set(
        request.overflow.filter(
          (id): id is ProviderId =>
            knownProvider(id) && state.providerTabs.open.includes(id),
        ),
      ),
    ];
    for (const id of ids)
      items.push({
        id: "provider-" + id,
        label: providerDefinition(id).label,
        type: "radio",
        checked: providerFor(state.active) === id,
        click: () => {
          selected = () => {
            if (state.providerTabs.open.includes(id)) activateProvider(id);
          };
        },
      });
    if (items.length) items.push({ type: "separator" });
    items.push({
      id: "provider-library",
      label: "Tất cả nền tảng…",
      click: () => {
        selected = showProviderLibrary;
      },
    });
  } else return;
  const nativeMenu = Menu.buildFromTemplate(items);
  const [width, height] = win.getContentSize();
  await new Promise<void>((resolve) =>
    nativeMenu.popup({
      window: win,
      x: Math.max(0, Math.min(width - 1, Math.round(request.x as number))),
      y: Math.max(0, Math.min(height - 1, Math.round(request.y as number))),
      callback: () => {
        if (
          closing ||
          accountEditorOpen ||
          state.commandOpen ||
          state.accountBusy ||
          state.importing ||
          state.active !== selectedAccount ||
          state.panel !== panel
        ) {
          resolve();
          return;
        }
        Promise.resolve(selected?.())
          .catch(() => {})
          .finally(resolve);
      },
    }),
  );
}
function showNavigationMenu() {
  if (closing || state.panel !== "service" || state.commandOpen) return;
  const id = state.active;
  const account = findAccount(id);
  const contents = views.peek(id)?.webContents;
  if (!account || !contents || contents.isDestroyed()) return;
  // A notification or account change while the native menu is open must not
  // redirect an action to a different account or a replaced view.
  const current = () =>
    !closing &&
    state.active === id &&
    state.panel === "service" &&
    !state.commandOpen &&
    !contents.isDestroyed() &&
    isCurrent(id, contents);
  Menu.buildFromTemplate([
    {
      label: "Quay lại",
      accelerator: "CmdOrCtrl+[",
      enabled: contents.navigationHistory.canGoBack(),
      click: () => {
        if (current() && contents.navigationHistory.canGoBack())
          contents.navigationHistory.goBack();
      },
    },
    {
      label: "Trang đầu nền tảng",
      click: () => {
        if (current()) reloadProvider(id, true, true);
      },
    },
    {
      label: "Tải lại nền tảng",
      accelerator: "CmdOrCtrl+R",
      click: () => {
        if (current()) reloadProvider(id, true);
      },
    },
    { type: "separator" },
    {
      label: "Mở trong trình duyệt",
      click: () => {
        if (current())
          void external(providerDefinition(account.provider).entry);
      },
    },
  ]).popup({ window: win });
}
async function showAccountMenu(anchor: unknown) {
  if (closing || accountEditorOpen || state.commandOpen) return;
  if (
    !anchor ||
    typeof anchor !== "object" ||
    !("x" in anchor) ||
    !("y" in anchor) ||
    typeof anchor.x !== "number" ||
    typeof anchor.y !== "number" ||
    !Number.isFinite(anchor.x) ||
    !Number.isFinite(anchor.y)
  )
    return;
  const active = findAccount(state.active);
  if (!active) return;
  const panel = state.panel;
  const peers = state.accounts.filter(
    (account) => account.provider === active.provider && !account.archived,
  );
  const [width, height] = win.getContentSize();
  const x = Math.max(0, Math.min(width - 1, Math.round(anchor.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(anchor.y)));
  let selected: AccountId | null = null;
  const menu = Menu.buildFromTemplate(
    peers.map((account) => ({
      id: "account-" + account.id,
      label: account.name,
      type: "radio" as const,
      checked: account.id === active.id,
      click: () => {
        selected = account.id;
      },
    })),
  );
  await new Promise<void>((resolve) => {
    menu.popup({
      window: win,
      x,
      y,
      callback: () => {
        const target = selected ? findAccount(selected) : undefined;
        // Focus the page after the native menu closes so it cannot take focus
        // back from the newly selected conversation.
        if (
          !closing &&
          !accountEditorOpen &&
          !state.commandOpen &&
          state.active === active.id &&
          state.panel === panel &&
          target?.provider === active.provider
        )
          activate(target.id);
        resolve();
      },
    });
  });
}
async function changeAccount(
  command: string,
  arg: unknown,
): Promise<AccountResult> {
  if (state.importing || state.accountBusy || closing)
    return {
      ok: false,
      message: "App đang xử lý tài khoản. Bạn thử lại sau một chút.",
    };
  if (state.catalogWarning) return { ok: false, message: state.catalogWarning };
  const data = arg as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object")
    return { ok: false, message: "Thông tin tài khoản chưa hợp lệ." };
  return (
    accountOps.run(async () => {
      state.accountBusy = true;
      publish();
      try {
        let next = state.accounts.slice();
        let added: Account | undefined;
        const id = typeof data.id === "string" ? data.id : "";
        if (command === "account-add") {
          if (
            !knownProvider(data.provider) ||
            typeof data.name !== "string" ||
            typeof data.avatar !== "string"
          )
            throw Error("invalid-account-name");
          added = createAccount(data.provider, data.name, data.avatar);
          next.push(added);
        } else if (command === "account-edit") {
          if (typeof data.name !== "string" || typeof data.avatar !== "string")
            throw Error("invalid-account-name");
          next = editCatalogAccount(next, id, data.name, data.avatar);
        } else if (command === "account-move") {
          if (data.direction !== -1 && data.direction !== 1)
            throw Error("invalid-direction");
          next = moveCatalogAccount(next, id, data.direction);
        } else if (command === "account-archive") {
          next = archiveCatalogAccount(next, id);
          const answer = await dialog.showMessageBox(win, {
            type: "question",
            message: `Gỡ ${accountLabel(id)} khỏi danh sách?`,
            detail:
              "Dữ liệu đăng nhập vẫn được giữ trên máy. Bạn có thể khôi phục tài khoản trong Cài đặt; thao tác này không đăng xuất hoặc xóa tin nhắn.",
            buttons: ["Hủy", "Gỡ khỏi danh sách"],
            defaultId: 0,
            cancelId: 0,
          });
          if (answer.response !== 1 || closing)
            return { ok: false, message: "Đã hủy." };
          const view = views.peek(id);
          if (view && !(await flushBeforeClose([view.webContents.session])))
            throw Error("flush-failed");
        } else if (command === "account-restore")
          next = restoreCatalogAccount(next, id);
        else throw Error("invalid-command");
        if (closing) return { ok: false, message: "App đang thoát." };
        await catalogStore.commit(next);
        state.accounts = next;
        for (const a of next) initializeAccount(a);
        if (command === "account-archive") {
          epochs.set(id, (epochs.get(id) ?? 0) + 1);
          for (const popup of [...popups])
            if (
              !popup.isDestroyed() &&
              popupProviders.get(popup.webContents) === id
            )
              popup.destroy();
          testAlerts.get(id)?.close();
          testAlerts.delete(id);
          const view = views.remove(id);
          if (view) {
            win.contentView.removeChildView(view);
            if (!view.webContents.isDestroyed()) view.webContents.close();
          }
          recovery.reset(id);
          lastNotificationClicks.delete(id);
          navigationFailed.delete(id);
          state.statuses[id] = "idle";
          state.unread[id] = normalizeUnread({
            global: null,
            loaded: null,
            kind: unreadKind(providerFor(id)),
          });
          if (state.active === id) {
            state.active = (next.find(
              (a) => !a.archived && a.provider === providerFor(id),
            ) ||
              next.find(
                (a) =>
                  !a.archived && state.providerTabs.open.includes(a.provider),
              ) ||
              next.find((a) => !a.archived))!.id;
            if (state.panel === "service") {
              state.providerTabs = openProviderTab(
                state.providerTabs,
                providerFor(state.active),
              );
            }
            if (
              !views.peek(state.active) &&
              (state.panel === "service" ||
                !providerDefinition(providerFor(state.active)).custom)
            )
              win.contentView.addChildView(views.activate(state.active));
          }
        }
        if (
          command === "account-restore" &&
          !providerDefinition(providerFor(id)).custom
        ) {
          const view = views.activate(id);
          win.contentView.addChildView(view);
        }
        layout();
        await persist();
        return { ok: true, accountId: added?.id ?? id };
      } catch {
        const message =
          "Chưa cập nhật được tài khoản. Bạn kiểm tra tên, bảo đảm còn ít nhất một tài khoản đang dùng và thử lại. Các phiên đăng nhập vẫn được giữ.";
        state.notice = message;
        publish();
        return { ok: false, message };
      } finally {
        state.accountBusy = false;
        publish();
      }
    }) ?? { ok: false, message: "App đang xử lý tài khoản." }
  );
}
async function save() {
  if (!win || win.isDestroyed()) return;
  await settingsWriter.write({
    active: providerFor(state.active),
    activeAccount: state.active,
    lastAccounts: Object.fromEntries(lastAccounts),
    collapsed: state.collapsed,
    bounds: win.getNormalBounds(),
    preferences: state.preferences,
    presentation: state.presentation,
    providerTabs: state.providerTabs,
    providerTabDefaultsVersion: savedProviderTabDefaultsVersion,
  });
}
function showAutomaticUpdateError() {
  automaticUpdateActive = false;
  state.updates = {
    ...state.updates,
    phase: "error",
    downloadProgress: null,
    message:
      "Chưa thể tự cập nhật bản cài này. Bạn vẫn có thể tải bản mới thủ công.",
  };
  if (!closing) publish();
}
function beginAutomaticUpdate() {
  if (
    automaticUpdateActive ||
    !AUTOMATIC_UPDATES_SUPPORTED ||
    !app.isPackaged ||
    process.platform !== "darwin" ||
    !state.updates.latestVersion
  )
    return;
  automaticUpdateActive = true;
  state.updates = {
    ...state.updates,
    phase: "downloading",
    downloadProgress: null,
    message: `Đang kết nối để tải Gom ${state.updates.latestVersion}…`,
  };
  publish();
  try {
    const feed = `https://update.electronjs.org/mhfed/gom/darwin-${process.arch}/${app.getVersion()}`;
    autoUpdater.setFeedURL({ url: feed, serverType: "json" });
    autoUpdater.checkForUpdates();
  } catch {
    showAutomaticUpdateError();
  }
}
async function quit(installUpdate = false) {
  if (closing) return;
  closing = true;
  clearInterval(poll);
  clearTimeout(saveTimer);
  clearTimeout(wakeTimer);
  updateSchedule.stop();
  updateChecker.cancel();
  statePublisher.cancel();
  globalShortcut.unregisterAll();
  tray?.destroy();
  for (const alert of testAlerts.values()) alert.close();
  await imports.close();
  await accountOps.close();
  await save().catch(() => {});
  const ok = await flushBeforeClose([...configured]);
  if (!ok) {
    await dialog.showMessageBox(win, {
      type: "warning",
      message: "Chưa ghi xong dữ liệu phiên.",
      detail:
        "Bạn có thể mở lại app để kiểm tra. Phiên đăng nhập không bị xóa.",
      buttons: ["Đóng app"],
    });
  }
  for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
  for (const [, view] of views.entries())
    if (!view.webContents.isDestroyed()) view.webContents.close();
  closed = true;
  win.destroy();
  if (installUpdate) autoUpdater.quitAndInstall();
  else app.quit();
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("activate", showWindow);
  app.on("second-instance", showWindow);
  app.on("before-quit", (event) => {
    if (!closed && win) {
      event.preventDefault();
      void quit();
    }
  });
  app.whenReady().then(async () => {
    if (
      app.isPackaged &&
      process.platform === "darwin" &&
      AUTOMATIC_UPDATES_SUPPORTED
    ) {
      autoUpdater.on("checking-for-update", () => {
        if (!automaticUpdateActive) return;
        state.updates = {
          ...state.updates,
          phase: "downloading",
          message: "Đang kiểm tra gói cập nhật…",
        };
        publish();
      });
      autoUpdater.on("update-available", () => {
        if (!automaticUpdateActive) return;
        state.updates = {
          ...state.updates,
          phase: "downloading",
          downloadProgress: null,
          message: "Đã tìm thấy bản mới. Đang tải về…",
        };
        publish();
      });
      autoUpdater.on("update-downloaded", () => {
        if (!automaticUpdateActive) return;
        state.updates = {
          ...state.updates,
          phase: "downloaded",
          downloadProgress: 100,
          message: `Đã tải Gom ${state.updates.latestVersion ?? "mới"}. Khởi động lại để cài đặt.`,
        };
        publish();
      });
      autoUpdater.on("update-not-available", () => {
        if (!automaticUpdateActive) return;
        automaticUpdateActive = false;
        state.updates = {
          ...state.updates,
          phase: "current",
          downloadProgress: null,
          message: "Bạn đang dùng phiên bản mới nhất.",
        };
        publish();
      });
      autoUpdater.on("error", showAutomaticUpdateError);
    }
    // Also supplies the native macOS About icon when running in development.
    app.dock?.setIcon(appIconPath);
    let stored: Record<string, unknown> = {};
    try {
      const value = JSON.parse(await readFile(settingsPath, "utf8"));
      if (value && typeof value === "object" && !Array.isArray(value))
        stored = value;
    } catch {}
    const storedProviderTabDefaultsVersion =
      typeof stored.providerTabDefaultsVersion === "number" &&
      Number.isInteger(stored.providerTabDefaultsVersion)
        ? stored.providerTabDefaultsVersion
        : 0;
    const migrateProviderTabs =
      storedProviderTabDefaultsVersion < PROVIDER_TAB_DEFAULTS_VERSION;
    savedProviderTabDefaultsVersion = Math.max(
      storedProviderTabDefaultsVersion,
      PROVIDER_TAB_DEFAULTS_VERSION,
    );
    if (typeof stored.collapsed === "boolean")
      state.collapsed = stored.collapsed;
    const catalog = await catalogStore.load();
    state.accounts = catalog.accounts;
    state.providers = catalog.providers;
    state.providerTabs = normalizeProviderTabs(
      stored.providerTabs,
      state.providers.map((p) => p.id),
    );
    if (migrateProviderTabs) {
      const open = [...state.providerTabs.open];
      for (
        let version = Math.max(1, storedProviderTabDefaultsVersion + 1);
        version <= PROVIDER_TAB_DEFAULTS_VERSION;
        version++
      ) {
        for (const id of BUILTIN_PROVIDER_TABS_BY_VERSION[version] ?? [])
          if (!open.includes(id)) open.push(id);
      }
      state.providerTabs = {
        ...state.providerTabs,
        open,
      };
    }
    state.presentation = normalizePresentation(
      stored.presentation,
      state.accounts.map((a) => a.id),
    );
    state.catalogWarning = catalog.warning;
    state.preferences = normalizePreferences(
      stored.preferences,
      state.accounts.map((a) => a.id),
    );
    for (const a of state.accounts) initializeAccount(a);
    const selected =
      findAccount(stored.activeAccount) ||
      findAccount(stored.active) ||
      state.accounts.find((a) => !a.archived)!;
    state.active = selected.id;
    if (stored.lastAccounts && typeof stored.lastAccounts === "object")
      for (const { id: provider } of state.providers) {
        const id = (stored.lastAccounts as Record<string, unknown>)[provider];
        if (findAccount(id)?.provider === provider)
          lastAccounts.set(provider, id as AccountId);
      }
    if (!stored.activeAccount)
      await copyFile(
        settingsPath,
        settingsPath + ".pre-0.4",
        constants.COPYFILE_EXCL,
      ).catch(() => {});
    const bounds = restoreBounds(
      stored.bounds,
      screen.getAllDisplays().map((d) => d.workArea),
    );
    if (app.isPackaged) {
      try {
        state.openAtLogin = app.getLoginItemSettings().openAtLogin;
      } catch {}
    }
    state.profiles = await sources.list();
    win = new BrowserWindow({
      ...bounds,
      minWidth: Math.min(940, bounds.width),
      minHeight: Math.min(640, bounds.height),
      title: "Gom",
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 20, y: 15 },
      backgroundColor: "#F7F7F2",
      webPreferences: {
        preload: join(__dirname, "preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event) => event.preventDefault());
    win.webContents.on("did-start-loading", () => {
      accountEditorOpen = false;
    });
    ipcMain.on("provider-notification-click", (event) => {
      if (closing || event.senderFrame !== event.sender.mainFrame) return;
      const provider =
        [...views.entries()].find(
          ([, v]) => v.webContents === event.sender,
        )?.[0] ?? popupProviders.get(event.sender);
      if (
        !provider ||
        !validNotificationFrame(
          providerFor(provider),
          event.sender.getURL(),
          true,
          true,
          state.providers,
        ) ||
        !notificationAllowed(state.preferences, provider) ||
        Date.now() - (lastNotificationClicks.get(provider) ?? 0) < 1000
      )
        return;
      lastNotificationClicks.set(provider, Date.now());
      activate(provider);
      showWindow();
    });
    ipcMain.handle("desktop", async (event, command, arg) => {
      if (
        !trustedShellRequest(
          event.sender,
          event.senderFrame,
          win.webContents,
          win.webContents.mainFrame,
        )
      )
        throw new Error("untrusted");
      if (closing && command !== "state") return;
      switch (command) {
        case "state":
          return structuredClone(state);
        case "activate":
          if (findAccount(arg)) activate(arg);
          return;
        case "activate-provider":
          if (
            arg &&
            typeof arg === "object" &&
            !Array.isArray(arg) &&
            knownProvider(arg.provider) &&
            (arg.focusPage === undefined || typeof arg.focusPage === "boolean")
          )
            activateProvider(arg.provider, arg.focusPage);
          return;
        case "navigation-menu":
          showNavigationMenu();
          return;
        case "account-menu":
          return showAccountMenu(arg);
        case "provider-library":
          if (typeof arg !== "boolean" || accountEditorOpen) return;
          if (arg) showProviderLibrary();
          else {
            const provider = providerFor(state.active);
            const target =
              (state.providerTabs.open.includes(provider) &&
                accountForProvider(provider)) ||
              state.providerTabs.open.map(accountForProvider).find(Boolean);
            if (target) activate(target.id);
            else showProviderLibrary();
          }
          return;
        case "provider-menu":
          return showProviderMenu(arg);
        case "provider-pin":
          if (
            !knownProvider(arg) ||
            state.accountBusy ||
            state.importing ||
            accountEditorOpen
          )
            return;
          state.providerTabs = toggleProviderPin(state.providerTabs, arg);
          await persist();
          return;
        case "provider-close":
          return knownProvider(arg)
            ? closeProvider(arg)
            : { ok: false, message: "Nền tảng không tồn tại." };
        case "provider-add":
          return addProvider(arg);
        case "account-editor":
          if (typeof arg !== "boolean") return;
          accountEditorOpen = arg;
          if (arg) showSettings();
          return;
        case "toggle-sidebar":
          state.collapsed = !state.collapsed;
          layout();
          publish();
          scheduleSave();
          return;
        case "sidebar-width":
          if (typeof arg !== "number" || !Number.isFinite(arg)) return;
          if (state.presentation.sidebarWidth === sidebarWidth(arg)) return;
          state.presentation.sidebarWidth = sidebarWidth(arg);
          layout();
          publish();
          scheduleSave();
          return;
        case "theme":
          if (!["platform", "system", "light", "dark"].includes(arg)) return;
          state.presentation.theme = arg;
          if (arg === "platform") {
            const active = views.peek(state.active);
            if (active) void detect(state.active, active.webContents, true);
          }
          await persist();
          return;
        case "pin-account":
          if (!findAccount(arg)) return;
          state.presentation.pinned = state.presentation.pinned.includes(arg)
            ? state.presentation.pinned.filter((id) => id !== arg)
            : [...state.presentation.pinned, arg];
          await persist();
          return;
        case "command":
          if (typeof arg === "boolean") showCommand(arg);
          return;
        case "command-closed":
          // Renderer acknowledges that the dialog has closed before native focus moves.
          if (
            !state.commandOpen &&
            state.panel === "service" &&
            !state.connections[state.active].reason
          )
            views.peek(state.active)?.webContents.focus();
          return;
        case "settings":
          showSettings();
          return;
        case "updates-check":
          if (!automaticUpdateActive) await updateChecker.check();
          return;
        case "updates-download": {
          const update = state.updates;
          if (update.phase === "downloaded" && automaticUpdateActive) {
            state.updates = {
              ...update,
              phase: "installing",
              message: "Đang khởi động lại để cài bản mới…",
            };
            publish();
            void quit(true);
            return;
          }
          if (!update.releaseUrl) return;
          if (
            update.phase === "available" &&
            AUTOMATIC_UPDATES_SUPPORTED &&
            app.isPackaged &&
            process.platform === "darwin"
          ) {
            beginAutomaticUpdate();
            return;
          }
          if (update.phase !== "available" && update.phase !== "error") return;
          // Only the checker can supply this fixed-repository HTTPS release URL.
          await shell.openExternal(update.releaseUrl).catch(() => {
            state.notice =
              "Chưa mở được trình duyệt. Bạn thử lại nút tải cập nhật.";
            publish();
          });
          return;
        }
        case "reload":
          reloadProvider(state.active, true);
          return;
        case "back": {
          goBack();
          return;
        }
        case "home":
          reloadProvider(state.active, true, true);
          return;
        case "preference": {
          if (!arg || typeof arg !== "object" || typeof arg.value !== "boolean")
            return;
          if (arg.key === "paused") state.preferences.paused = arg.value;
          else if (arg.key === "shortcut") configureShortcut(arg.value);
          else if (arg.key === "updateChecks") {
            state.preferences.updateChecks = arg.value;
            updateSchedule.configure(app.isPackaged && arg.value);
          } else if (arg.key === "openAtLogin" && app.isPackaged) {
            try {
              app.setLoginItemSettings({ openAtLogin: arg.value });
              state.openAtLogin = app.getLoginItemSettings().openAtLogin;
            } catch {
              state.notice =
                "Chưa đổi được chạy cùng macOS. Bạn kiểm tra mục Đăng nhập trong Cài đặt hệ thống.";
            }
          } else return;
          // A rejected OS preference can leave state unchanged while the native
          // checkbox has already toggled. Acknowledge with authoritative state.
          await persist(true);
          return;
        }
        case "notification":
          if (
            arg &&
            findAccount(arg.id) &&
            ["ask", "allow", "mute"].includes(arg.choice)
          ) {
            state.preferences.notifications[arg.id as AccountId] = arg.choice;
            await persist();
          }
          return;
        case "test-notification":
          if (findAccount(arg)) testNotification(arg);
          return;
        case "notification-settings":
          await shell.openExternal(
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension",
          );
          return;
        case "browser":
          return external(providerDefinition(providerFor(state.active)).entry);
        case "account-add":
        case "account-edit":
        case "account-move":
        case "account-archive":
        case "account-restore":
          return changeAccount(command, arg);
        case "import": {
          const sourceId = typeof arg === "string" ? arg : arg?.sourceId;
          const targetId =
            typeof arg === "object" && arg?.accountId
              ? arg.accountId
              : "messenger";
          const target = findAccount(targetId);
          const targetProvider = target?.provider;
          if (
            typeof sourceId === "string" &&
            sourceId.length < 100 &&
            target &&
            isBuiltinProviderId(targetProvider) &&
            !state.accountBusy
          )
            return (
              imports.run(() =>
                importProviderSession(sourceId, targetId, targetProvider),
              ) ?? {
                status: "busy",
              }
            );
          return { status: "invalid-account" };
        }
        default:
          throw new Error("invalid-command");
      }
    });
    app.setAboutPanelOptions({
      applicationName: "Gom",
      applicationVersion: app.getVersion(),
      copyright: "Trò chuyện, gọn một nơi.",
      iconPath: appIconPath,
    });
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "Gom",
          submenu: [
            { role: "about", label: "Giới thiệu Gom" },
            { label: "Kiểm tra cập nhật…", click: showUpdates },
            { type: "separator" },
            {
              label: "Tài khoản & cài đặt",
              accelerator: "CmdOrCtrl+,",
              click: showSettings,
            },
            { type: "separator" },
            { role: "quit", label: "Thoát Gom" },
          ],
        },
        { role: "editMenu" },
        {
          label: "Không gian",
          submenu: [
            {
              label: "Chuyển nhanh…",
              accelerator: "CmdOrCtrl+K",
              click: () => win.webContents.send("command-toggle"),
            },
            ...PROVIDER_ORDER.map((id, i) => ({
              label: PROVIDERS[id].label,
              accelerator: "CmdOrCtrl+" + (i + 1),
              click: () => {
                activateProvider(id);
                showWindow();
              },
            })),
            { type: "separator" },
            {
              label: "Quay lại",
              accelerator: "CmdOrCtrl+[",
              click: goBack,
            },
            {
              label: "Trang đầu nền tảng",
              click: () => reloadProvider(state.active, true, true),
            },
            {
              label: "Tải lại nền tảng",
              accelerator: "CmdOrCtrl+R",
              click: () => reloadProvider(state.active, true),
            },
          ],
        },
        {
          label: "Cửa sổ",
          submenu: [
            { role: "close" },
            { role: "minimize" },
            { role: "zoom" },
            { type: "separator" },
            { role: "front" },
          ],
        },
      ]),
    );
    win.on("resize", () => {
      layout();
      scheduleSave();
    });
    win.on("move", scheduleSave);
    win.on("close", (event) => {
      if (!closed) {
        event.preventDefault();
        win.hide();
        scheduleSave();
      }
    });
    await win.loadFile(join(__dirname, "index.html"));
    if (state.providerTabs.open.includes(providerFor(state.active)))
      activate(state.active);
    else if (state.providerTabs.open.length)
      activateProvider(state.providerTabs.open[0]);
    else showProviderLibrary();
    if (migrateProviderTabs) scheduleSave();
    // Keep built-in messaging sessions warm for notifications. Custom websites
    // are created only when selected, regardless of library/catalog size.
    for (const { id } of state.accounts.filter(
      (a) => !a.archived && !providerDefinition(a.provider).custom,
    )) {
      if (!views.ids().includes(id))
        win.contentView.addChildView(views.activate(id));
    }
    layout();
    const image = nativeImage
      .createFromPath(join(__dirname, "trayTemplate.png"))
      .resize({ width: 18, height: 18 });
    image.setTemplateImage(true);
    tray = new Tray(image);
    updateTray();
    configureShortcut(state.preferences.shortcut);
    powerMonitor.on("suspend", () => {
      sleeping = true;
      updateSchedule.suspend();
    });
    powerMonitor.on("resume", () => {
      sleeping = false;
      updateSchedule.resume();
      clearTimeout(wakeTimer);
      wakeTimer = setTimeout(tick, 1200);
    });
    poll = setInterval(tick, 4000);
    updateSchedule.configure(app.isPackaged && state.preferences.updateChecks);
    tick();
  });
}
