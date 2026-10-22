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
  type Session,
  type WebContents,
} from "electron";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
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
  "nmhieu04091999@gmail.com",
);
let win: BrowserWindow;
let closing = false,
  closed = false;
let poll: ReturnType<typeof setInterval>;
const configured = new Set<Session>();
const imports = new OperationGate();
const popups = new Set<BrowserWindow>();
const state: AppState = {
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
const views = new ViewRegistry<WebContentsView>(createView);
const partition = (id: ProviderId) => session.fromPartition("persist:" + id);
const publish = () => {
  if (win && !win.isDestroyed()) win.webContents.send("state", state);
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
  ses.setPermissionRequestHandler((contents, permission, callback) => {
    const valid = navigationPolicy(id, contents.getURL()) === "internal";
    if (!valid || !["notifications", "media"].includes(permission)) {
      callback(false);
      return;
    }
    void dialog
      .showMessageBox(win, {
        type: "question",
        message: `Cho phép ${PROVIDERS[id].label} ${permission === "media" ? "dùng camera / mic" : "gửi thông báo"}?`,
        buttons: ["Không cho phép", "Cho phép"],
        defaultId: 0,
        cancelId: 0,
      })
      .then((r) => callback(r.response === 1));
  });
  ses.setPermissionCheckHandler(() => false);
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
  contents.on("will-redirect", (event, url) => {
    if (navigationPolicy(id, url) !== "internal") {
      event.preventDefault();
      status(id, "error");
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
    guard(popup.webContents, id);
    popup.on("closed", () => popups.delete(popup));
  });
}
function createView(id: ProviderId) {
  const ses = partition(id);
  setupSession(ses, id);
  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  view.setVisible(false);
  guard(view.webContents, id);
  view.webContents.on("did-start-loading", () => status(id, "loading"));
  view.webContents.on("did-finish-load", () => {
    status(id, "ready");
    void detect(id, view.webContents);
  });
  view.webContents.on("did-fail-load", (_e, code, _desc, _url, main) => {
    if (main && code !== -3) status(id, "error");
  });
  view.webContents.on("render-process-gone", () => status(id, "error"));
  void view.webContents
    .loadURL(PROVIDERS[id].entry)
    .catch(() => status(id, "error"));
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
    state.panel,
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
    contents.isDestroyed() ||
    contents.isLoadingMainFrame() ||
    navigationPolicy(id, contents.getURL()) !== "internal"
  )
    return;
  try {
    const theme = normalizeTheme(await contents.executeJavaScript(themeScript));
    if (theme) state.themes[id] = theme;
    const result = await contents.executeJavaScript(authScript);
    if (["ready", "needs-login", "authenticated"].includes(result))
      status(id, result);
    state.unread[id] = normalizeUnread(
      result === "authenticated"
        ? await contents.executeJavaScript(unreadScript)
        : {
            global: null,
            loaded: null,
            kind: id === "zalo" ? "messages" : "conversations",
          },
    );
    // Warm hidden clients only during startup; restore real background visibility
    // once authenticated so inactive conversations keep normal read behavior.
    if (result === "authenticated" && !contents.getBackgroundThrottling())
      contents.setBackgroundThrottling(true);
    publish();
  } catch {}
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
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(
    settingsPath + ".tmp",
    JSON.stringify({
      active: state.active,
      collapsed: state.collapsed,
      bounds: win.getBounds(),
    }),
  );
  await rename(settingsPath + ".tmp", settingsPath);
}
async function quit() {
  if (closing) return;
  closing = true;
  clearInterval(poll);
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
  app.on("activate", () => {
    if (win && !win.isDestroyed() && !closing) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app.on("before-quit", (event) => {
    if (!closed && win) {
      event.preventDefault();
      void quit();
    }
  });
  app.whenReady().then(async () => {
    let bounds = { width: 1280, height: 840 };
    try {
      const stored = JSON.parse(await readFile(settingsPath, "utf8"));
      if (typeof stored.collapsed === "boolean")
        state.collapsed = stored.collapsed;
      if (validProviderId(stored.active)) state.active = stored.active;
      if (
        Number.isFinite(stored.bounds?.width) &&
        Number.isFinite(stored.bounds?.height)
      )
        bounds = {
          width: Math.max(940, Math.min(stored.bounds.width, 1800)),
          height: Math.max(640, Math.min(stored.bounds.height, 1200)),
        };
    } catch {}
    state.profiles = await sources.list();
    win = new BrowserWindow({
      ...bounds,
      minWidth: 940,
      minHeight: 640,
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
          state.panel = "settings";
          layout();
          publish();
          return;
        case "reload":
          views.activate(state.active).webContents.reload();
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
              click: () => {
                state.panel = "settings";
                layout();
                publish();
              },
            },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        { role: "editMenu" },
        {
          label: "Không gian",
          submenu: (Object.keys(PROVIDERS) as ProviderId[]).map((id, i) => ({
            label: PROVIDERS[id].label,
            accelerator: "CmdOrCtrl+" + (i + 1),
            click: () => activate(id),
          })),
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
    win.on("resize", layout);
    win.on("close", (event) => {
      if (!closed) {
        event.preventDefault();
        win.hide();
      }
    });
    await win.loadFile(join(__dirname, "index.html"));
    activate(state.active);
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
      if (!views.ids().includes(id))
        win.contentView.addChildView(views.activate(id));
    }
    layout();
    poll = setInterval(() => {
      for (const [id, view] of views.entries())
        void detect(id, view.webContents);
    }, 4000);
  });
}
