import { app, BrowserWindow, WebContentsView, session } from "electron";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ViewRegistry, flushBeforeClose } from "../src/main/view-registry.ts";
import type { ProviderId } from "../src/shared.ts";
const root = process.env.FIXTURE_ROOT!;
const phase = process.env.FIXTURE_PHASE!;
app.setPath("userData", join(root, "profile"));
app
  .whenReady()
  .then(async () => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true },
    });
    const registry = new ViewRegistry(
      (id) =>
        new WebContentsView({
          webPreferences: {
            session: session.fromPartition("persist:" + id),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        }),
    );
    const ids: ProviderId[] = ["zalo", "messenger", "telegram"];
    const results = [];
    for (const id of ids) {
      const view = registry.activate(id);
      win.contentView.addChildView(view);
      assert.equal(registry.activate(id), view);
      const ses = view.webContents.session;
      ses.protocol.handle(
        "https",
        () =>
          new Response(
            '<!doctype html><title>Fixture</title><textarea id="draft"></textarea>',
            { headers: { "content-type": "text/html" } },
          ),
      );
      await view.webContents.loadURL("https://fixture.local/");
      if (phase === "write") {
        await ses.cookies.set({
          url: "https://fixture.local",
          name: "fixture",
          value: id,
          expirationDate: Date.now() / 1000 + 3600,
          secure: true,
        });
        await view.webContents.executeJavaScript(
          `localStorage.setItem('fixture',${JSON.stringify(id)});document.querySelector('#draft').value='unsent';new Promise((resolve,reject)=>{const r=indexedDB.open('fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>{const db=r.result;const tx=db.transaction('state','readwrite');tx.objectStore('state').put(${JSON.stringify(id)},'service');tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=reject};r.onerror=reject})`,
        );
        assert.equal(
          await registry
            .activate(id)
            .webContents.executeJavaScript(
              "document.querySelector('#draft').value",
            ),
          "unsent",
        );
      } else {
        const cookies = await ses.cookies.get({ url: "https://fixture.local" });
        assert.equal(cookies.find((x) => x.name === "fixture")?.value, id);
        assert.equal(
          await view.webContents.executeJavaScript(
            "localStorage.getItem('fixture')",
          ),
          id,
        );
        const value = await view.webContents.executeJavaScript(
          `new Promise((resolve,reject)=>{const r=indexedDB.open('fixture',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('state');const q=tx.objectStore('state').get('service');q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=reject};r.onerror=reject})`,
        );
        assert.equal(value, id);
      }
      results.push({
        provider: id,
        persistentCookie: true,
        localStorage: true,
        indexedDB: true,
        reusedView: true,
      });
    }
    assert.equal(
      new Set(ids.map((id) => registry.activate(id).webContents.session)).size,
      3,
    );
    assert.ok(
      await flushBeforeClose(
        ids.map((id) => registry.activate(id).webContents.session),
      ),
    );
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, phase + ".json"),
      JSON.stringify({ phase, passed: true, results }, null, 2),
    );
    for (const id of ids) registry.activate(id).webContents.close();
    win.destroy();
    app.quit();
  })
  .catch(async () => {
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, phase + ".json"),
      JSON.stringify({ phase, passed: false }),
    );
    app.exit(1);
  });
