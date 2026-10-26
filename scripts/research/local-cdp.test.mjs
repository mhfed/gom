// Isolated loopback fixtures only. Never connects to an existing browser/app.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { WebSocketServer } from "ws";
import { connectLocalTarget, listLocalTargets } from "./local-cdp.mjs";

async function fixture(
  t,
  { httpHang = false, handshakeHang = false, respond } = {},
) {
  const sockets = new Set();
  const methods = [];
  const ws = new WebSocketServer({ noServer: true });
  const server = createServer((request, response) => {
    if (httpHang) return;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify([target]));
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, socket, head) => {
    if (!handshakeHang)
      ws.handleUpgrade(request, socket, head, (peer) =>
        ws.emit("connection", peer),
      );
  });
  ws.on("connection", (peer) => {
    peer.on("message", (bytes) => {
      const message = JSON.parse(bytes.toString());
      methods.push(message.method);
      if (respond) respond(peer, message);
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = String(server.address().port);
  const target = {
    id: "private-target-id",
    type: "page",
    title: "PRIVATE_TITLE",
    url: "https://chat.zalo.me/#PRIVATE_THREAD_TOKEN",
    webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/private-target-id`,
  };
  t.after(async () => {
    for (const peer of ws.clients) peer.terminate();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    ws.close();
  });
  return { port, target, ws, server, methods };
}

async function eventually(predicate) {
  const end = Date.now() + 1500;
  while (!predicate()) {
    assert.ok(Date.now() < end, "resource was not released promptly");
    await delay(10);
  }
}

test("only an explicit numeric loopback port and matching websocket endpoint are accepted", async (t) => {
  for (const port of [
    undefined,
    "",
    "0",
    "65536",
    "1.5",
    "http://example.com",
    "9222/path",
  ])
    await assert.rejects(listLocalTargets(port), { code: "invalid-cdp-port" });
  const { port, target } = await fixture(t);
  for (const endpoint of [
    "ws://example.com:9222/x",
    `ws://127.0.0.1:1/x`,
    `wss://127.0.0.1:${port}/x`,
    `ws://user:secret@127.0.0.1:${port}/x`,
  ])
    await assert.rejects(
      connectLocalTarget({ ...target, webSocketDebuggerUrl: endpoint }, port),
      { code: "invalid-cdp-endpoint" },
    );
});

test("a hanging target-list response is aborted within its deadline", async (t) => {
  const { port } = await fixture(t, { httpHang: true });
  const start = Date.now();
  await assert.rejects(listLocalTargets(port, { timeoutMs: 75 }), {
    code: "cdp-http-timeout",
  });
  assert.ok(Date.now() - start < 1500);
});

test("a hanging websocket upgrade is terminated within its handshake deadline", async (t) => {
  const { port, target } = await fixture(t, { handshakeHang: true });
  const start = Date.now();
  await assert.rejects(connectLocalTarget(target, port, { timeoutMs: 75 }), {
    code: "cdp-handshake-timeout",
  });
  assert.ok(Date.now() - start < 1500);
});

test("a missing CDP response rejects all pending reads and releases the socket", async (t) => {
  const { port, target, ws } = await fixture(t);
  const connection = await connectLocalTarget(target, port, { timeoutMs: 75 });
  const results = await Promise.allSettled([
    connection.request("Page.getFrameTree"),
    connection.request("Runtime.evaluate", { expression: "1" }),
  ]);
  assert.deepEqual(
    results.map((result) => result.reason.code),
    ["cdp-request-timeout", "cdp-request-timeout"],
  );
  await eventually(() => ws.clients.size === 0);
  await assert.rejects(connection.request("Page.getFrameTree"), {
    code: "cdp-disconnected",
  });
});

test("disconnect and peer closure immediately reject outstanding reads", async (t) => {
  const { port, target, ws } = await fixture(t);
  for (const remote of [false, true]) {
    const connection = await connectLocalTarget(target, port, {
      timeoutMs: 5000,
    });
    const pending = assert.rejects(connection.request("Page.getFrameTree"), {
      code: remote ? "cdp-socket-closed" : "cdp-disconnected",
    });
    if (remote) for (const peer of ws.clients) peer.terminate();
    else connection.close();
    await pending;
    await eventually(() => ws.clients.size === 0);
  }
});

test("malformed websocket data and protocol errors never expose remote details", async (t) => {
  let malformed = true;
  const { port, target } = await fixture(t, {
    respond(peer, message) {
      peer.send(
        malformed
          ? "PRIVATE_INVALID_JSON"
          : JSON.stringify({
              id: message.id,
              error: { message: "PRIVATE_CREDENTIAL" },
            }),
      );
    },
  });
  let connection = await connectLocalTarget(target, port);
  await assert.rejects(connection.request("Page.getFrameTree"), {
    code: "cdp-invalid-response",
    message: "cdp-invalid-response",
  });
  malformed = false;
  connection = await connectLocalTarget(target, port);
  await assert.rejects(connection.request("Page.getFrameTree"), {
    code: "cdp-request-failed",
    message: "cdp-request-failed",
  });
  connection.close();
});

test("the read-only transport rejects mutating CDP commands before sending", async (t) => {
  const { port, target, methods } = await fixture(t);
  const connection = await connectLocalTarget(target, port);
  for (const method of [
    "Browser.close",
    "Page.navigate",
    "Page.bringToFront",
    "Input.insertText",
  ])
    await assert.rejects(connection.request(method), {
      code: "cdp-method-not-allowed",
    });
  assert.deepEqual(methods, []);
  connection.close();
});

test("abort cancels a connection attempt without retaining its socket", async (t) => {
  const { port, target } = await fixture(t, { handshakeHang: true });
  const controller = new AbortController();
  const pending = assert.rejects(
    connectLocalTarget(target, port, { signal: controller.signal }),
    { code: "cdp-aborted" },
  );
  controller.abort();
  await pending;
});

test("inspection CLI attaches, emits aggregates, and exits without closing the target", async (t) => {
  const { port, server, methods, ws } = await fixture(t, {
    respond(peer, { id, method }) {
      const result =
        method === "Page.getFrameTree"
          ? { frameTree: { frame: { id: "private-frame" } } }
          : method === "Page.createIsolatedWorld"
            ? { executionContextId: 1 }
            : { result: { value: { canvas: 2, "[role=row]": 3 } } };
      peer.send(JSON.stringify({ id, result }));
    },
  });
  for (const signal of [false, true]) {
    const child = spawn(
      process.execPath,
      [new URL("./web-inspect.mjs", import.meta.url).pathname, port],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    t.after(() => child.kill("SIGKILL"));
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (bytes) => {
      stdout += bytes;
    });
    child.stderr.on("data", (bytes) => {
      stderr += bytes;
    });
    const ended = once(child, "exit");
    await eventually(() => stdout.includes('"attached":true'));
    child.stdin.write("status\nstructure\n");
    await eventually(() => stdout.includes('"canvas":2'));
    if (signal) child.kill("SIGINT");
    else child.stdin.end();
    const [code] = await ended;
    assert.equal(code, signal ? 130 : 0);
    assert.equal(stderr, "");
    assert.ok(!/PRIVATE_|private-target-id|private-frame/.test(stdout));
    assert.ok(server.listening);
    assert.equal((await listLocalTargets(port)).length, 1);
    await eventually(() => ws.clients.size === 0);
  }
  assert.ok(methods.length > 0);
  assert.ok(
    methods.every((method) =>
      [
        "Page.getFrameTree",
        "Page.createIsolatedWorld",
        "Runtime.evaluate",
      ].includes(method),
    ),
  );
});
