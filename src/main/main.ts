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
import { normalizeTheme, themeScript } from "./theme.ts";
import { layoutViews } from "./layout.ts";
import { normalizeUnread } from "./unread.ts";
import { unreadScript } from "./unread-snapshot.ts";
import { authScript } from "./auth-detection.ts";
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
  powerMonitor,
  type Session,
  type WebContents,
} from "electron";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";
import {
  PROVIDERS,
  type ProviderId,
  type AppState,
  type ProviderStatus,
} from "../shared.ts";
import {
  navigationPolicy,
  validProviderId,
  trustedShellRequest,
} from "./security.ts";
import { ChromeSources, ImportFailure } from "./local-accounts.ts";
import { replaceLoginCookies } from "./cookie-transaction.ts";
import { OperationGate } from "./operation-gate.ts";
import { ViewRegistry, flushBeforeClose } from "./view-registry.ts";
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
const popups = new Set<BrowserWindow>();
const popupProviders = new Map<WebContents, ProviderId>();
const recovery = new RecoveryPolicy();
const detecting = new Set<ProviderId>();
const navigationFailed = new Set<ProviderId>();
const epochs = new Map<ProviderId, number>();
let tray: Tray | undefined;
let traySignature = "";
let sleeping = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let wakeTimer: ReturnType<typeof setTimeout> | undefined;
let lastNotificationClick = 0;
const permissionPrompts = new Set<ProviderId>();
const testAlerts = new Map<ProviderId, Notification>();
const SHORTCUT = "CommandOrControl+Shift+Space";
const state: AppState = {
  preferences: defaultPreferences(),
  connections: {
    zalo: { phase: "connecting", reason: null, retryAt: null },
    messenger: { phase: "connecting", reason: null, retryAt: null },
    telegram: { phase: "connecting", reason: null, retryAt: null },
  },
  canGoBack: false,
  openAtLogin: false,
  startupAvailable: app.isPackaged,
  notificationStatus:
    "Thông báo gốc do từng nền tảng gửi; macOS quyết định hiển thị.",
  themes: { zalo: null, messenger: null, telegram: null },
  collapsed: false,
  unread: {
    zalo: normalizeUnread({ global: null, loaded: null, kind: "messages" }),
    messenger: normalizeUnread({
      global: null,
      loaded: null,
      kind: "conversations",
    }),
    telegram: normalizeUnread({
      global: null,
      loaded: null,
      kind: "conversations",
    }),
  },
  active: "zalo",
  panel: "service",
  statuses: { zalo: "idle", messenger: "idle", telegram: "idle" },
  profiles: [],
  importing: false,
  notice: "",
  version: app.getVersion(),
};
const settingsPath = join(app.getPath("userData"), "window.json");
const settingsWriter = new SettingsWriter(settingsPath);
const views = new ViewRegistry<WebContentsView>(createView);
const partition = (id: ProviderId) => session.fromPartition("persist:" + id);
const publish = () => {
  if (win && !win.isDestroyed()) {
    const active = [...views.entries()].find(
      ([id]) => id === state.active,
    )?.[1];
    state.canGoBack =
      !!active &&
      !active.webContents.isDestroyed() &&
      active.webContents.navigationHistory.canGoBack();
    win.webContents.send("state", state);
    app.dock?.setBadge(hasUnread(Object.values(state.unread)) ? "•" : "");
    updateTray();
  }
};
function status(id: ProviderId, value: ProviderStatus) {
  state.statuses[id] = value;
  if (value !== "authenticated")
    state.unread[id] = normalizeUnread({
      global: null,
      loaded: null,
      kind: id === "zalo" ? "messages" : "conversations",
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
function setupSession(ses: Session, id: ProviderId) {
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
          navigationPolicy(id, contents.getURL()) === "internal",
      ));
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const valid = validNotificationFrame(
      id,
      details.requestingUrl,
      details.isMainFrame,
      owned(contents),
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
        message: `Cho phép ${PROVIDERS[id].label} ${permission === "media" ? "dùng camera / mic" : "gửi thông báo"}?`,
        buttons: ["Không cho phép", "Cho phép"],
        defaultId: 0,
        cancelId: 0,
      })
      .then(async (r) => {
        if (permission === "notifications" && !closing) {
          state.preferences.notifications[id] =
            r.response === 1 ? "allow" : "mute";
          await persist();
        }
        callback(
          !closing &&
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
      validNotificationFrame(
        id,
        details.requestingUrl || origin,
        details.isMainFrame,
        owned(contents),
      ) &&
      notificationAllowed(state.preferences, id),
  );
  ses.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({ title: "Lưu tệp từ " + PROVIDERS[id].label });
  });
}
function guard(contents: WebContents, id: ProviderId) {
  contents.on("will-navigate", (event, url) => {
    if (navigationPolicy(id, url) !== "internal") {
      event.preventDefault();
      void external(url);
    }
  });
  contents.on("will-redirect", (event, url, _inPlace, isMainFrame) => {
    if (navigationPolicy(id, event.url ?? url) !== "internal") {
      event.preventDefault();
      const principal = [...views.entries()].some(
        ([provider, view]) => provider === id && view.webContents === contents,
      );
      if ((event.isMainFrame ?? isMainFrame) && principal) fail(id, "blocked");
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (navigationPolicy(id, url) === "internal")
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
    void external(url);
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
function createView(id: ProviderId) {
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
  view.setVisible(false);
  guard(view.webContents, id);
  view.webContents.on(
    "did-start-navigation",
    (_e, _url, inPlace, isMainFrame) => {
      if (isMainFrame && !inPlace) {
        navigationFailed.delete(id);
        epochs.set(id, (epochs.get(id) ?? 0) + 1);
      }
    },
  );
  view.webContents.on("did-start-loading", () => {
    state.connections[id] = {
      phase: isOnline() ? "connecting" : "offline",
      reason: null,
      retryAt: null,
    };
    status(id, "loading");
  });
  view.webContents.on("did-navigate-in-page", () => publish());
  view.webContents.on("did-finish-load", () => {
    if (navigationFailed.has(id)) return;
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
    if (main && code !== -3)
      fail(
        id,
        [-106, -105, -102, -101, -100, -118].includes(code)
          ? "network"
          : "load-failed",
      );
  });
  view.webContents.on("render-process-gone", () => {
    epochs.set(id, (epochs.get(id) ?? 0) + 1);
    fail(id, "crashed");
  });
  void view.webContents.loadURL(PROVIDERS[id].entry).catch(() => {});
  return view;
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  layoutViews(
    views.entries(),
    width,
    height,
    state.collapsed,
    state.active,
    state.panel === "service" && state.connections[state.active].reason
      ? "settings"
      : state.panel,
  );
}
function activate(id: ProviderId) {
  state.active = id;
  state.panel = "service";
  const known = views.ids().includes(id);
  const view = views.activate(id);
  if (!known) win.contentView.addChildView(view);
  layout();
  void detect(id, view.webContents);
  publish();
}

async function detect(id: ProviderId, contents: WebContents) {
  if (
    closing ||
    sleeping ||
    detecting.has(id) ||
    recovery.reason(id) ||
    contents.isDestroyed() ||
    contents.isLoadingMainFrame() ||
    navigationPolicy(id, contents.getURL()) !== "internal"
  )
    return;
  detecting.add(id);
  const epoch = epochs.get(id) ?? 0;
  const valid = () =>
    !closing &&
    !contents.isDestroyed() &&
    !contents.isLoadingMainFrame() &&
    epoch === (epochs.get(id) ?? 0) &&
    !recovery.reason(id);
  try {
    const theme = normalizeTheme(await contents.executeJavaScript(themeScript));
    const result = await contents.executeJavaScript(authScript);
    const unread = normalizeUnread(
      result === "authenticated"
        ? await contents.executeJavaScript(unreadScript)
        : {
            global: null,
            loaded: null,
            kind: id === "zalo" ? "messages" : "conversations",
          },
    );
    if (!valid()) return;
    if (theme) state.themes[id] = theme;
    state.unread[id] = unread;
    if (["ready", "needs-login", "authenticated"].includes(result))
      state.statuses[id] = result;
    if (result === "authenticated" && !contents.getBackgroundThrottling())
      contents.setBackgroundThrottling(true);
    publish();
  } catch {
  } finally {
    detecting.delete(id);
  }
}
function isOnline() {
  return !sleeping && net.isOnline();
}
function fail(id: ProviderId, reason: FailureReason) {
  if (closing) return;
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
function reloadProvider(id: ProviderId, manual = false, home = false) {
  if (closing || state.importing) return;
  const view = views.activate(id);
  if (view.webContents.isDestroyed()) return;
  if (manual) recovery.reset(id);
  epochs.set(id, (epochs.get(id) ?? 0) + 1);
  if (home || navigationPolicy(id, view.webContents.getURL()) !== "internal")
    void view.webContents.loadURL(PROVIDERS[id].entry).catch(() => {});
  else view.webContents.reload();
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
  if (state.panel === "service" && !state.connections[state.active].reason)
    views.activate(state.active).webContents.focus();
  else win.webContents.focus();
}
function showSettings() {
  state.panel = "settings";
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
  const signature = `${state.preferences.paused}:${hasUnread(Object.values(state.unread))}`;
  if (signature === traySignature) return;
  traySignature = signature;
  tray.setToolTip(
    "Tin Nhan" +
      (hasUnread(Object.values(state.unread)) ? " · Có mục chưa đọc" : ""),
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Mở Tin Nhan", click: showWindow },
      ...(["zalo", "messenger", "telegram"] as ProviderId[]).map((id) => ({
        label: PROVIDERS[id].label,
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
      { label: "Thoát Tin Nhan", click: () => app.quit() },
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
      "Phím tắt Cmd+Shift+Space đang được app khác dùng. Anh có thể bật lại sau.";
  } else state.preferences.shortcut = true;
}
async function persist() {
  publish();
  try {
    await save();
  } catch {
    state.notice =
      "Chưa lưu được cài đặt. Anh kiểm tra dung lượng/quyền ghi rồi thử lại.";
    publish();
  }
}
function scheduleSave() {
  if (closing) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persist(), 500);
}
function testNotification(id: ProviderId) {
  if (!notificationAllowed(state.preferences, id)) {
    state.notificationStatus =
      "Anh chọn Cho phép và bỏ tạm dừng trước khi thử thông báo.";
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
    title: PROVIDERS[id].label + " · Tin Nhan",
    body: "Thông báo thử. Bấm để mở nền tảng này.",
    silent: true,
  });
  testAlerts.set(id, notification);
  notification.on("click", () => {
    if (!closing) {
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
      "macOS chưa hiển thị được thông báo. Kiểm tra quyền thông báo cho Tin Nhan trong Cài đặt hệ thống.";
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
async function importMessenger(sourceId: string) {
  if (state.importing) return { status: "busy" };
  state.importing = true;
  state.notice = "Đang kiểm tra phiên Messenger từ hồ sơ đã chọn…";
  publish();
  let stage: BrowserWindow | undefined;
  let stageSession: Session | undefined;
  try {
    if (state.statuses.messenger === "authenticated") {
      state.notice = "Messenger đã kết nối. Phiên hiện tại được giữ nguyên.";
      return { status: "already-connected" };
    }
    const cookies = await sources.loginCookies(sourceId);
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
    const verified = (
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
    const target = views.activate("messenger");
    if (!win.contentView.children.includes(target))
      win.contentView.addChildView(target);
    layout();
    target.webContents.stop();
    await replaceLoginCookies(partition("messenger").cookies, verified, () =>
      verifyMessenger(target.webContents),
    );
    cookies.forEach((c) => (c.value = ""));
    verified.forEach((c) => (c.value = ""));
    activate("messenger");
    status("messenger", "authenticated");
    state.notice =
      "Đã dùng phiên Messenger có sẵn. Anh có thể đọc và trả lời ngay.";
    return { status: "imported" };
  } catch (error) {
    const code =
      error instanceof ImportFailure
        ? error.code
        : error instanceof Error && error.message === "rollback-failed"
          ? "rollback-failed"
          : "import-failed";
    const messages: Record<string, string> = {
      "needs-login":
        "Hồ sơ này chưa có phiên Facebook còn hiệu lực. Anh đăng nhập Facebook trên Chrome rồi thử lại.",
      "needs-os-authorization":
        "Chưa được macOS cho phép đọc Chrome Safe Storage. Anh có thể đăng nhập trực tiếp trong app.",
      "source-busy": "Chrome đang bận. Anh đợi một chút rồi thử lại.",
      "verification-failed":
        "Phiên có sẵn cần xác thực thêm. Anh đăng nhập Messenger trực tiếp trong app.",
      "source-unavailable": "Không đọc được hồ sơ Chrome đã chọn.",
      "rollback-failed":
        "Chưa khôi phục được phiên cũ. Anh đăng nhập Messenger trực tiếp trong app.",
      unsupported: "Định dạng phiên Chrome này chưa được hỗ trợ.",
    };
    state.notice =
      messages[code] ??
      "Chưa nhập được phiên Messenger. Phiên hiện tại vẫn được giữ.";
    return { status: code };
  } finally {
    if (stage && !stage.isDestroyed()) stage.destroy();
    await stageSession?.clearStorageData().catch(() => {});
    state.importing = false;
    publish();
  }
}
async function save() {
  if (!win || win.isDestroyed()) return;
  await settingsWriter.write({
    active: state.active,
    collapsed: state.collapsed,
    bounds: win.getNormalBounds(),
    preferences: state.preferences,
  });
}
async function quit() {
  if (closing) return;
  closing = true;
  clearInterval(poll);
  clearTimeout(saveTimer);
  clearTimeout(wakeTimer);
  globalShortcut.unregisterAll();
  tray?.destroy();
  for (const alert of testAlerts.values()) alert.close();
  await imports.close();
  await save().catch(() => {});
  const ok = await flushBeforeClose([...configured]);
  if (!ok) {
    await dialog.showMessageBox(win, {
      type: "warning",
      message: "Chưa ghi xong dữ liệu phiên.",
      detail:
        "Anh có thể mở lại app để kiểm tra. Phiên đăng nhập không bị xóa.",
      buttons: ["Đóng app"],
    });
  }
  for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
  for (const [, view] of views.entries())
    if (!view.webContents.isDestroyed()) view.webContents.close();
  closed = true;
  win.destroy();
  app.quit();
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
    let stored: Record<string, unknown> = {};
    try {
      const value = JSON.parse(await readFile(settingsPath, "utf8"));
      if (value && typeof value === "object" && !Array.isArray(value))
        stored = value;
    } catch {}
    if (typeof stored.collapsed === "boolean")
      state.collapsed = stored.collapsed;
    if (validProviderId(stored.active)) state.active = stored.active;
    state.preferences = normalizePreferences(stored.preferences);
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
      title: "Tin nhắn",
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 20, y: 21 },
      backgroundColor: "#f9faf8",
      webPreferences: {
        preload: join(__dirname, "preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event) => event.preventDefault());
    ipcMain.on("provider-notification-click", (event) => {
      if (
        closing ||
        Date.now() - lastNotificationClick < 1000 ||
        event.senderFrame !== event.sender.mainFrame
      )
        return;
      const provider =
        [...views.entries()].find(
          ([, v]) => v.webContents === event.sender,
        )?.[0] ?? popupProviders.get(event.sender);
      if (
        !provider ||
        navigationPolicy(provider, event.sender.getURL()) !== "internal" ||
        !notificationAllowed(state.preferences, provider)
      )
        return;
      lastNotificationClick = Date.now();
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
          if (validProviderId(arg)) activate(arg);
          return;
        case "toggle-sidebar":
          state.collapsed = !state.collapsed;
          layout();
          publish();
          return;
        case "settings":
          showSettings();
          return;
        case "reload":
          reloadProvider(state.active, true);
          return;
        case "back": {
          const c = views.activate(state.active).webContents;
          if (!c.isDestroyed() && c.navigationHistory.canGoBack())
            c.navigationHistory.goBack();
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
          else if (arg.key === "openAtLogin" && app.isPackaged) {
            try {
              app.setLoginItemSettings({ openAtLogin: arg.value });
              state.openAtLogin = app.getLoginItemSettings().openAtLogin;
            } catch {
              state.notice =
                "Chưa đổi được chạy cùng macOS. Anh kiểm tra mục Đăng nhập trong Cài đặt hệ thống.";
            }
          } else return;
          await persist();
          return;
        }
        case "notification":
          if (
            arg &&
            validProviderId(arg.id) &&
            ["ask", "allow", "mute"].includes(arg.choice)
          ) {
            state.preferences.notifications[arg.id as ProviderId] = arg.choice;
            await persist();
          }
          return;
        case "test-notification":
          if (validProviderId(arg)) testNotification(arg);
          return;
        case "notification-settings":
          await shell.openExternal(
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension",
          );
          return;
        case "browser":
          return external(PROVIDERS[state.active].entry);
        case "import":
          if (typeof arg === "string" && arg.length < 100)
            return (
              imports.run(() => importMessenger(arg)) ?? { status: "busy" }
            );
          return;
        default:
          throw new Error("invalid-command");
      }
    });
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            {
              label: "Tài khoản & cài đặt",
              accelerator: "CmdOrCtrl+,",
              click: showSettings,
            },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        { role: "editMenu" },
        {
          label: "Không gian",
          submenu: [
            ...(Object.keys(PROVIDERS) as ProviderId[]).map((id, i) => ({
              label: PROVIDERS[id].label,
              accelerator: "CmdOrCtrl+" + (i + 1),
              click: () => {
                activate(id);
                showWindow();
              },
            })),
            { type: "separator" },
            {
              label: "Quay lại",
              accelerator: "CmdOrCtrl+[",
              click: () => {
                const c = views.activate(state.active).webContents;
                if (c.navigationHistory.canGoBack())
                  c.navigationHistory.goBack();
              },
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
    activate(state.active);
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
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
    });
    powerMonitor.on("resume", () => {
      sleeping = false;
      clearTimeout(wakeTimer);
      wakeTimer = setTimeout(tick, 1200);
    });
    poll = setInterval(tick, 4000);
    tick();
  });
}
