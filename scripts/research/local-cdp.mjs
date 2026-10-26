// Research-only attach transport. ws is already present in the locked dev tree.
// A disconnect terminates only our socket, never the remote browser/application.
import WebSocket from "ws";

export class LocalCdpError extends Error {
  constructor(code) {
    super(code);
    this.name = "LocalCdpError";
    this.code = code;
  }
}
const failure = (code) => new LocalCdpError(code);
const readMethods = new Set([
  "Page.getFrameTree",
  "Page.createIsolatedWorld",
  "Runtime.evaluate",
]);

function localPort(value) {
  if (
    typeof value !== "string" ||
    !/^\d{1,5}$/.test(value) ||
    Number(value) < 1 ||
    Number(value) > 65535
  )
    throw failure("invalid-cdp-port");
  return String(Number(value));
}
function deadline(value = 10000) {
  if (!Number.isInteger(value) || value < 1 || value > 60000)
    throw failure("invalid-cdp-timeout");
  return value;
}

export async function listLocalTargets(port, { timeoutMs, signal } = {}) {
  const address = `http://127.0.0.1:${localPort(port)}/json/list`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadline(timeoutMs));
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(address, {
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw failure("cdp-http-failed");
    const targets = await response.json();
    if (!Array.isArray(targets)) throw failure("cdp-invalid-targets");
    return targets;
  } catch (error) {
    if (signal?.aborted) throw failure("cdp-aborted");
    if (controller.signal.aborted) throw failure("cdp-http-timeout");
    if (error instanceof LocalCdpError) throw error;
    throw failure("cdp-http-failed");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export async function connectLocalTarget(
  target,
  port,
  { timeoutMs, signal } = {},
) {
  const expectedPort = localPort(port);
  const timeout = deadline(timeoutMs);
  let address;
  try {
    address = new URL(target?.webSocketDebuggerUrl);
  } catch {
    throw failure("invalid-cdp-endpoint");
  }
  if (
    address.protocol !== "ws:" ||
    address.hostname !== "127.0.0.1" ||
    address.port !== expectedPort ||
    address.username ||
    address.password ||
    address.hash
  )
    throw failure("invalid-cdp-endpoint");
  if (signal?.aborted) throw failure("cdp-aborted");

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(address, {
      followRedirects: false,
      maxPayload: 2 * 1024 * 1024,
    });
    const pending = new Map();
    let stopped = false,
      opened = false,
      sequence = 0;
    const timer = setTimeout(() => shutdown("cdp-handshake-timeout"), timeout);
    const abort = () => shutdown("cdp-aborted");
    signal?.addEventListener("abort", abort, { once: true });

    function shutdown(code) {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (!opened) reject(failure(code));
      for (const task of pending.values()) {
        clearTimeout(task.timer);
        task.reject(failure(code));
      }
      pending.clear();
      // terminate also aborts CONNECTING handshakes; close() alone can hang.
      if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
    }
    socket.on("error", () => shutdown("cdp-socket-error"));
    socket.on("close", () => shutdown("cdp-socket-closed"));
    socket.on("message", (bytes, binary) => {
      if (stopped) return;
      let message;
      try {
        if (binary) throw Error();
        message = JSON.parse(bytes.toString());
        if (!message || typeof message !== "object") throw Error();
      } catch {
        shutdown("cdp-invalid-response");
        return;
      }
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(failure("cdp-request-failed"));
      else task.resolve(message.result);
    });
    socket.once("open", () => {
      if (stopped) return;
      opened = true;
      clearTimeout(timer);
      resolve({
        request(method, params = {}) {
          if (stopped) return Promise.reject(failure("cdp-disconnected"));
          if (!readMethods.has(method))
            return Promise.reject(failure("cdp-method-not-allowed"));
          const id = ++sequence;
          return new Promise((resolveRequest, rejectRequest) => {
            const requestTimer = setTimeout(
              () => shutdown("cdp-request-timeout"),
              timeout,
            );
            pending.set(id, {
              resolve: resolveRequest,
              reject: rejectRequest,
              timer: requestTimer,
            });
            try {
              socket.send(JSON.stringify({ id, method, params }), (error) => {
                if (error) shutdown("cdp-socket-error");
              });
            } catch {
              shutdown("cdp-socket-error");
            }
          });
        },
        close() {
          shutdown("cdp-disconnected");
        },
      });
    });
    if (signal?.aborted) abort();
  });
}
