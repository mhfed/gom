// Executed only by ime-check.mjs, with a temporary appData/home and local pages.
const e = require("electron");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
e.app.setPath("appData", fixtureConfig.root);
require("node:os").homedir = () => fixtureConfig.root;
const hosts = {
  zalo: "chat.zalo.me",
  messenger: "www.facebook.com",
  telegram: "web.telegram.org",
};
const draft = "Bản nháp tiếng Việt — được giữ nguyên";
const body = `<html><head><meta charset="UTF-8"></head><body><h1>Fixture login</h1><input id="plain"><input id="password" type="password" value="fixture-password"><textarea id="draft">${draft}</textarea><div id="shadow"></div><script>localStorage.setItem('fixture-session','kept');document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<input id="shadow-password" type="password" value="fixture-shadow">';</script></body></html>`;
e.app.whenReady().then(async () => {
  for (const [id, host] of Object.entries(hosts)) {
    const ses = e.session.fromPartition("persist:" + id);
    ses.protocol.handle("https", (request) => {
      const url = new URL(request.url);
      const frame = url.pathname === "/ime-frame";
      const markup = frame
        ? body
        : body.replace(
            "</body>",
            `<iframe src="https://${id === "zalo" ? "id.zalo.me" : host}/ime-frame"></iframe></body>`,
          );
      return new Response(markup, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    });
    await ses.cookies.set({
      url: "https://" + host,
      name: "fixture-session",
      value: "kept",
    });
  }
});
require(fixtureConfig.entry);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const remote = (id) =>
  e.webContents
    .getAllWebContents()
    .find(
      (c) =>
        c.getURL().startsWith("https://" + hosts[id] + "/") &&
        !c.getURL().includes("ime-popup"),
    );
let main, initialIds;
const shell = (code) => main.webContents.executeJavaScript(code);
const systemState = () =>
  JSON.parse(
    execFileSync("/usr/bin/python3", ["-c", fixtureConfig.python], {
      encoding: "utf8",
    }),
  );
async function until(predicate, label) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await delay(100);
  }
  throw Error("Timed out: " + label);
}
async function show(window = main) {
  window.restore();
  window.show();
  e.app.focus({ steal: true });
  window.focus();
  await until(() => window.isFocused(), "native window focus");
  await delay(150);
}
async function focus(id, selector = "#password") {
  const c = remote(id);
  c.focus();
  await c.executeJavaScript(
    `document.querySelector(${JSON.stringify(selector)}).focus()`,
  );
  await delay(150);
}
async function snap(label, expected, window = main) {
  await delay(350);
  const views = await Promise.all(
    Object.keys(hosts).map(async (id) => {
      const c = remote(id);
      const page = await c.executeJavaScript(
        `({draftPreserved:document.querySelector('#draft').value===${JSON.stringify(draft)},passwordPreserved:document.querySelector('#password').value==='fixture-password',storagePreserved:localStorage.getItem('fixture-session')==='kept',activeType:document.activeElement?.type,visibility:document.visibilityState,documentFocus:document.hasFocus()})`,
      );
      const cookies = await c.session.cookies.get({
        url: "https://" + hosts[id],
        name: "fixture-session",
      });
      return {
        id,
        webContentsId: c.id,
        identityPreserved: initialIds[id] === c.id,
        nativeFocused: c.isFocused(),
        ...page,
        cookiePreserved: cookies.some((cookie) => cookie.value === "kept"),
      };
    }),
  );
  const system = systemState();
  const preserved = views.every(
    (v) =>
      v.identityPreserved &&
      v.draftPreserved &&
      v.passwordPreserved &&
      v.storagePreserved &&
      v.cookiePreserved,
  );
  const pass =
    system.enabled === expected &&
    preserved &&
    (!expected || window.isFocused());
  console.log(
    "IME_METRIC " +
      JSON.stringify({
        label,
        expected,
        pass,
        system,
        pid: process.pid,
        versions: process.versions,
        windowFocused: window.isFocused(),
        apiSecureInput: e.app.isSecureKeyboardEntryEnabled(),
        views,
      }),
  );
}
async function blurCycle(
  label,
  operation,
  window = main,
  contents = remote("zalo"),
) {
  await snap(label + "-password-protected", true, window);
  operation();
  await snap(label + "-released", false, window);
  await contents.executeJavaScript(
    'document.querySelector("#plain").focus();document.querySelector("#password").focus()',
  );
  await snap(label + "-late-password-focus", false, window);
  await show(window);
  contents.focus();
  await snap(label + "-password-protected-again", true, window);
}
(async () => {
  await e.app.whenReady();
  await until(
    () =>
      Object.keys(hosts).every(
        (id) => remote(id) && !remote(id).isLoadingMainFrame(),
      ),
    "provider fixtures",
  );
  main = e.BrowserWindow.getAllWindows().find((w) =>
    w.webContents.getURL().endsWith("index.html"),
  );
  assert.ok(main);
  assert.ok(e.app.getPath("userData").startsWith(fixtureConfig.root + "/"));
  initialIds = Object.fromEntries(
    Object.keys(hosts).map((id) => [id, remote(id).id]),
  );
  await show();
  await shell('window.desktop.activate("zalo")');
  await focus("zalo", "#draft");
  await snap("startup-normal-input", false);
  await remote("messenger").executeJavaScript(
    'document.querySelector("#password").focus()',
  );
  await snap("hidden-page-late-password-focus", false);
  await focus("zalo");
  await blurCycle("window-blur", () => main.blur());
  await blurCycle("window-hide", () => main.hide());
  await blurCycle("window-minimize", () => main.minimize());
  await blurCycle("close-to-tray", () => main.close());
  await shell('window.desktop.activate("telegram")');
  await focus("telegram", "#draft");
  await snap("switch-provider", false);
  await focus("messenger");
  await snap("hidden-native-password-focus", false);
  await focus("telegram", "#draft");
  await shell("window.desktop.settings()");
  await snap("settings", false);
  await shell('window.desktop.activate("zalo")');
  remote("zalo").focus();
  await remote("zalo").executeJavaScript(
    'document.querySelector("#shadow").shadowRoot.querySelector("input").focus()',
  );
  await snap("shadow-password-protected", true);
  main.hide();
  await snap("shadow-password-hide-released", false);
  await show();
  remote("zalo").focus();
  await snap("shadow-password-protected-again", true);
  await focus("zalo", "#plain");
  const frame = remote("zalo").mainFrame.frames.find((f) =>
    f.url.includes("/ime-frame"),
  );
  assert.ok(frame, "Cross-origin password iframe must load");
  await frame.executeJavaScript('document.querySelector("#password").focus()');
  await snap("cross-origin-iframe-password-protected", true);
  main.blur();
  await snap("cross-origin-iframe-blur-released", false);
  await frame.executeJavaScript(
    'document.querySelector("#plain").focus();document.querySelector("#password").focus()',
  );
  await snap("cross-origin-iframe-blurred-autofocus", false);
  await show();
  remote("zalo").focus();
  await snap("cross-origin-iframe-password-protected-again", true);
  await focus("zalo", "#draft");
  await remote("messenger").executeJavaScript(
    'void window.open("https://www.facebook.com/ime-popup", "ime-fixture")',
    true,
  );
  await until(
    () =>
      e.BrowserWindow.getAllWindows().some(
        (w) =>
          w !== main &&
          w.webContents.getURL().includes("ime-popup") &&
          !w.webContents.isLoadingMainFrame(),
      ),
    "auth popup",
  );
  const popup = e.BrowserWindow.getAllWindows().find((w) => w !== main);
  await show(popup);
  popup.webContents.focus();
  await popup.webContents.executeJavaScript(
    'document.querySelector("#password").focus()',
  );
  await blurCycle("popup-blur", () => popup.blur(), popup, popup.webContents);
  await blurCycle("popup-hide", () => popup.hide(), popup, popup.webContents);
  popup.close();
  await show();
  await focus("zalo", "#draft");
  await snap("popup-close-normal-input", false);
  e.app.quit();
})().catch((error) => {
  console.error(error);
  e.app.exit(1);
});
