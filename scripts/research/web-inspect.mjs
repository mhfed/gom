// Attach only: node scripts/research/web-inspect.mjs <explicit-loopback-CDP-port>
// The user starts/discovers the diagnostic endpoint separately. This script has
// no application process handle and cannot launch, focus, navigate or close it.
import { createInterface } from "node:readline";
import { connectLocalTarget, listLocalTargets } from "./local-cdp.mjs";

const hosts = new Map([
  ["chat.zalo.me", "zalo"],
  ["id.zalo.me", "zalo"],
  ["www.facebook.com", "messenger"],
  ["www.messenger.com", "messenger"],
  ["messenger.com", "messenger"],
  ["web.telegram.org", "telegram"],
]);
const selectors = [
  "input[type=password]",
  "canvas",
  "iframe",
  "[role=navigation]",
  "[role=main]",
  "[role=grid]",
  "[role=row]",
  "[role=listitem]",
  "[role=log]",
  "[role=textbox]",
  "[contenteditable=true]",
  "[data-message-id]",
  "[data-thread-id]",
  "[data-id]",
  "[data-mid]",
  "[data-peer-id]",
  "#contact-search-input",
  ".chat-list",
  ".chatlist-chat",
];
const port = process.argv[2];
const controller = new AbortController();
const connections = new Set();
let input;
function stop(code = 0) {
  process.exitCode = code;
  controller.abort();
  input?.close();
  for (const connection of connections) connection.close();
  connections.clear();
}
process.once("SIGINT", () => stop(130));
process.once("SIGTERM", () => stop(143));
process.once("SIGHUP", () => stop(129));

async function targets() {
  const all = await listLocalTargets(port, { signal: controller.signal });
  return all.flatMap((target) => {
    try {
      const url = new URL(target.url);
      return target.type === "page" &&
        url.protocol === "https:" &&
        hosts.has(url.hostname)
        ? [{ target, host: url.hostname, provider: hosts.get(url.hostname) }]
        : [];
    } catch {
      return [];
    }
  });
}
async function status() {
  const pages = await targets();
  return {
    matchingPages: pages.length,
    providers: [...hosts]
      .map(([host, provider]) => ({
        provider,
        host,
        pages: pages.filter((page) => page.host === host).length,
      }))
      .filter((entry) => entry.pages > 0),
  };
}
async function structure() {
  const pages = await targets();
  const reports = [];
  for (const { target, host } of pages.slice(0, 32)) {
    if (controller.signal.aborted) break;
    let connection;
    try {
      connection = await connectLocalTarget(target, port, {
        signal: controller.signal,
      });
      connections.add(connection);
      const { frameTree } = await connection.request("Page.getFrameTree");
      const { executionContextId } = await connection.request(
        "Page.createIsolatedWorld",
        {
          frameId: frameTree.frame.id,
          worldName: "tin-nhan-aggregate-structure-research",
          grantUniveralAccess: false,
        },
      );
      const response = await connection.request("Runtime.evaluate", {
        contextId: executionContextId,
        returnByValue: true,
        expression: `location.protocol === "https:" && location.hostname === ${JSON.stringify(host)} ? Object.fromEntries(${JSON.stringify(selectors)}.map(selector => [selector, document.querySelectorAll(selector).length])) : null`,
      });
      if (response.exceptionDetails || !response.result?.value) throw Error();
      const value = response.result.value;
      const counts = Object.fromEntries(
        selectors
          .filter(
            (selector) =>
              Number.isSafeInteger(value[selector]) && value[selector] >= 0,
          )
          .map((selector) => [selector, value[selector]]),
      );
      reports.push({ host, counts });
    } catch {
      if (!controller.signal.aborted) reports.push({ host, unavailable: true });
    } finally {
      connection?.close();
      connections.delete(connection);
    }
  }
  return { reports, truncated: pages.length > 32 };
}

try {
  console.log(JSON.stringify({ attached: true, status: await status() }));
  console.log(
    "Commands: status | structure. Ctrl+C disconnects diagnostics only.",
  );
  input = createInterface({ input: process.stdin });
  for await (const line of input) {
    if (controller.signal.aborted) break;
    try {
      if (line.trim() === "status") console.log(JSON.stringify(await status()));
      else if (line.trim() === "structure")
        console.log(JSON.stringify(await structure()));
      else console.log(JSON.stringify({ error: "unknown-command" }));
    } catch {
      if (!controller.signal.aborted)
        console.log(JSON.stringify({ error: "inspection-unavailable" }));
    }
  }
} catch (error) {
  if (!controller.signal.aborted) {
    console.log(
      JSON.stringify({
        error:
          error.code === "invalid-cdp-port"
            ? "explicit-loopback-cdp-port-required"
            : "inspection-unavailable",
      }),
    );
    process.exitCode = 1;
  }
} finally {
  stop(process.exitCode || 0);
}
