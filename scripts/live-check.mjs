import { _electron } from "playwright-core";
import { createInterface } from "node:readline";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const executablePath =
  process.env.TIN_NHAN_APP ||
  process.cwd() +
    "/out-release/Tin Nhan-darwin-arm64/Tin Nhan.app/Contents/MacOS/Tin Nhan";
let client, page;
async function launch() {
  client = await _electron.launch({ executablePath, timeout: 30000 });
  page = await client.firstWindow();
  await page.waitForFunction(() => !!window.desktop);
  return "launched";
}
async function state() {
  return page.evaluate(() => window.desktop.state());
}
async function run(command) {
  const [action, arg] = command.trim().split(" ");
  if (action === "launch") return launch();
  if (action === "status") {
    const s = await state();
    return {
      active: s.active,
      panel: s.panel,
      statuses: s.statuses,
      importing: s.importing,
      notice: s.notice,
      profiles: s.profiles.map((p) => ({ id: p.id, preferred: p.preferred })),
    };
  }
  if (action === "check" || action === "check-legacy") {
    for (const id of ["messenger", "telegram", "zalo"])
      await page.evaluate((id) => window.desktop.activate(id), id);
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const s = await state();
      if (
        (action === "check-legacy"
          ? ["zalo", "messenger", "telegram"].map((id) => s.statuses[id])
          : Object.values(s.statuses)
        ).every((value) => value === "authenticated")
      )
        return { passed: true, statuses: s.statuses };
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return { passed: false, statuses: (await state()).statuses };
  }
  if (action === "probe-file") {
    const script = await readFile("../unread-probe.js", "utf8");
    return client.evaluate(
      ({ webContents }, script) =>
        Promise.all(
          webContents
            .getAllWebContents()
            .filter((w) => /^https:/.test(w.getURL()))
            .map(async (w) => ({
              origin: new URL(w.getURL()).origin,
              result: await w.executeJavaScript(script),
            })),
        ),
      script,
    );
  }
  if (action === "unread-probe")
    return client.evaluate(({ webContents }) =>
      Promise.all(
        webContents
          .getAllWebContents()
          .filter((w) => /^https:/.test(w.getURL()))
          .map(async (w) => ({
            origin: new URL(w.getURL()).origin,
            info: await w.executeJavaScript(
              `(()=>({title:document.title.replace(/ - .+$/, ' - [account]'),badges:[...document.querySelectorAll('[class*="badge"],[class*="unread"],[aria-label*="unread"],[aria-label*="chưa đọc"],[role="tab"]')].slice(0,160).map(e=>({tag:e.tagName,cl:typeof e.className==='string'?e.className:'',id:e.id,text:/^(?:[\\d.,+Kk]+|Unread[ \\d.,+Kk]*|Chưa đọc[ \\d.,+Kk]*)$/.test(e.textContent.trim())?e.textContent.trim():null,aria:(e.getAttribute('aria-label')||'').match(/(?:unread|chưa đọc)[^0-9]*([0-9.,+]+)|([0-9.,+]+)[^0-9]*(?:unread|chưa đọc)/i)?.[0]??null,visible:!!e.getClientRects().length})).filter(e=>e.text||e.aria||/badge|unread/.test(e.cl))}))()`,
            ),
          })),
      ),
    );
  if (action === "sidebar-check") {
    const before = await client.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .filter((w) => w.getURL().startsWith("https:"))
        .map((w) => w.id)
        .sort(),
    );
    await page.evaluate(() => window.desktop.activate("zalo"));
    const initial = (await state()).collapsed;
    await page.locator("#sidebar-toggle").click();
    const changed = await state();
    const geometry = await page.evaluate(() => ({
      width: Math.round(
        document.querySelector("aside").getBoundingClientRect().width,
      ),
      expanded: document
        .querySelector("#sidebar-toggle")
        .getAttribute("aria-expanded"),
      badges: [...document.querySelectorAll("nav .unread")].map((e) => ({
        text: e.textContent,
        hidden: e.hidden,
      })),
    }));
    const native = await client.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]
        .contentView.children.filter((v) =>
          v.webContents?.getURL().startsWith("https://chat.zalo.me"),
        )
        .map((v) => v.getBounds()),
    );
    const after = await client.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .filter((w) => w.getURL().startsWith("https:"))
        .map((w) => w.id)
        .sort(),
    );
    return {
      passed:
        changed.collapsed !== initial &&
        geometry.width === (changed.collapsed ? 72 : 224) &&
        native[0]?.x === geometry.width &&
        JSON.stringify(before) === JSON.stringify(after),
      collapsed: changed.collapsed,
      geometry,
      native,
      viewIdentityPreserved: JSON.stringify(before) === JSON.stringify(after),
    };
  }
  if (action === "unread-state") {
    const s = await state();
    return { collapsed: s.collapsed, unread: s.unread };
  }
  if (action === "monitor-state")
    return client.evaluate(({ webContents }) =>
      Promise.all(
        webContents
          .getAllWebContents()
          .filter((w) => /^https:/.test(w.getURL()))
          .map(async (w) => ({
            origin: new URL(w.getURL()).origin,
            backgroundThrottling: w.getBackgroundThrottling(),
            visibility: await w.executeJavaScript("document.visibilityState"),
          })),
      ),
    );
  if (action === "inspect") {
    return client.evaluate(({ webContents }) =>
      Promise.all(
        webContents
          .getAllWebContents()
          .filter((w) => /^https:/.test(w.getURL()))
          .map(async (w) => ({
            url: new URL(w.getURL()).origin,
            flags: await w
              .executeJavaScript(
                "(()=>({heading:[...document.querySelectorAll('h1,h2,[role=heading]')].map(e=>e.textContent.trim()).filter(t=>/^(Chats|Đoạn chat|Chat|Tin nhắn|Telegram|Zalo)$/i.test(t)),qr:!!document.querySelector('canvas.qr-canvas,.qr-code,.auth-qr-form'),telegramChat:document.querySelectorAll('.chatlist-chat,[data-peer-id],.chatlist,.chat-list').length,telegramAuth:!!document.querySelector('.auth-pages,.auth-qr-form,.page-auth'),zaloSearch:!!document.querySelector('#contact-search-input,input[placeholder*=\"Tìm kiếm\"],.chat-list'),password:!!document.querySelector('input[type=password]'),loginPrompt:/Quét mã QR|Quét mã thành công|Log in to Telegram|Scan.*QR/i.test(document.body.innerText)}))()",
              )
              .catch(() => ({ error: true })),
          })),
      ),
    );
  }
  if (action === "cookies")
    return client.evaluate(async ({ session }) =>
      Object.fromEntries(
        await Promise.all(
          ["zalo", "messenger", "telegram"].map(async (id) => [
            id,
            (await session.fromPartition("persist:" + id).cookies.get({})).map(
              (c) => ({
                name: c.name,
                domain: c.domain,
                session: c.session,
                secure: c.secure,
              }),
            ),
          ]),
        ),
      ),
    );
  if (action === "watch")
    return client.evaluate(async ({ webContents }) => {
      globalThis.zaloDiagnostics = [];
      const remote = webContents
        .getAllWebContents()
        .find((w) => w.getURL().includes("zalo.me"));
      if (!remote) return { watched: 0 };
      const record = (data) => {
        globalThis.zaloDiagnostics.push(data);
        globalThis.zaloDiagnostics = globalThis.zaloDiagnostics.slice(-50);
      };
      remote.on("will-navigate", (_e, url) =>
        record({ event: "navigate", origin: new URL(url).origin }),
      );
      remote.on("will-redirect", (_e, url) =>
        record({ event: "redirect", origin: new URL(url).origin }),
      );
      remote.on("did-fail-load", (_e, code) =>
        record({ event: "load-failed", code }),
      );
      remote.debugger.attach("1.3");
      await remote.debugger.sendCommand("Network.enable");
      remote.debugger.on("message", async (_e, method, params) => {
        if (method !== "Network.responseReceived") return;
        try {
          const url = new URL(params.response.url);
          if (
            !["id.zalo.me", "chat.zalo.me"].includes(url.hostname) ||
            !/json|html/.test(params.response.mimeType)
          )
            return;
          const data = {
            host: url.hostname,
            path: url.pathname,
            status: params.response.status,
          };
          if (params.response.mimeType.includes("json")) {
            const response = await remote.debugger.sendCommand(
              "Network.getResponseBody",
              { requestId: params.requestId },
            );
            const body = JSON.parse(response.body);
            for (const key of ["error_code", "errorCode", "error", "code"])
              if (typeof body[key] === "number") data[key] = body[key];
          }
          record(data);
        } catch {}
      });
      return { watched: 1 };
    });
  if (action === "diag")
    return client.evaluate(() => globalThis.zaloDiagnostics ?? []);
  if (action === "dom")
    return client.evaluate(async ({ webContents }) =>
      Promise.all(
        webContents
          .getAllWebContents()
          .filter((w) => w.getURL().startsWith("https://"))
          .map(async (w) => ({
            origin: new URL(w.getURL()).origin,
            dom: await w.executeJavaScript(
              "(()=>({bodyClasses:document.body.className,forms:[...document.querySelectorAll('form')].map(e=>e.id),iframes:document.querySelectorAll('iframe').length,canvases:document.querySelectorAll('canvas').length,chatClass:[...document.querySelectorAll('.chatlist-chat')].slice(0,1).map(e=>e.className)}))()",
            ),
          })),
      ),
    );
  if (action === "settings") {
    await page.evaluate(() => window.desktop.settings());
    return "settings";
  }
  if (action === "activate") {
    await page.evaluate((id) => window.desktop.activate(id), arg);
    return arg;
  }
  if (action === "import") {
    return page.evaluate((id) => window.desktop.importMessenger(id), arg);
  }
  if (action === "screenshot") {
    await mkdir("../../outputs", { recursive: true });
    await page.screenshot({ path: "../../outputs/desktop-settings.png" });
    return "saved";
  }
  if (action === "resize") {
    const [w, h] = arg.split("x").map(Number);
    await client.evaluate(
      ({ BrowserWindow }, [w, h]) =>
        BrowserWindow.getAllWindows()[0].setContentSize(w, h),
      [w, h],
    );
    return "resized";
  }
  if (action === "quit") {
    const exited = new Promise((resolve) =>
      client.process().once("exit", resolve),
    );
    await client.evaluate(({ app }) => app.quit()).catch(() => {});
    await exited;
    return "quit";
  }
  return "unknown";
}
console.log(JSON.stringify({ ready: await launch() }));
const rl = createInterface({ input: process.stdin, terminal: false });
for await (const line of rl) {
  try {
    console.log(JSON.stringify({ command: line, result: await run(line) }));
  } catch {
    console.log(JSON.stringify({ command: line, error: "check-failed" }));
  }
}
