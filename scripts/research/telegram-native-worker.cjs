// This allowlist is the complete request surface of the feasibility probe.
// Never sends setTdlibParameters, auth credentials, chat reads, or messages.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { join } = require("node:path");
const dependencies = createRequire(join(process.argv[2], "package.json"));
const tdl = dependencies("tdl");
const { getTdjson } = dependencies("prebuilt-tdlib");
const allowed = new Set(["getAuthorizationState", "getOption", "close"]);
const requests = [];
const clients = [];
const authStates = [[], []];
const clientErrors = [];
const start = performance.now();
const deadline = setTimeout(() => {
  process.parentPort.postMessage({ pass: false, error: "tdlib-timeout" });
  process.exit(1);
}, 12000);
function invoke(client, request) {
  assert.ok(allowed.has(request._), "Request outside research allowlist");
  requests.push(request._);
  return client.invoke(request);
}
(async () => {
  tdl.configure({ tdjson: getTdjson(), verbosityLevel: 0, receiveTimeout: 1 });
  tdl.init();
  const nativeLoadMs = performance.now() - start;
  for (let index = 0; index < 2; index++) {
    const client = tdl.createBareClient();
    client.on("error", (error) => clientErrors.push(error.message));
    client.on("update", (update) => {
      if (update._ === "updateAuthorizationState")
        authStates[index].push(update.authorization_state._);
    });
    clients.push(client);
  }
  const states = await Promise.all(
    clients.map((client) => invoke(client, { _: "getAuthorizationState" })),
  );
  states.forEach((state) =>
    assert.equal(state._, "authorizationStateWaitTdlibParameters"),
  );
  const version = await invoke(clients[0], { _: "getOption", name: "version" });
  assert.equal(version._, "optionValueString");
  await Promise.all(
    clients.map(async (client) => {
      requests.push("close");
      await client.close();
    }),
  );
  assert.equal(clientErrors.length, 0);
  authStates.forEach((states) => {
    assert.ok(states.includes("authorizationStateWaitTdlibParameters"));
    assert.ok(states.includes("authorizationStateClosed"));
  });
  clearTimeout(deadline);
  process.parentPort.once("message", (event) => {
    assert.equal(event.data, "exit-after-tdlib-closed");
    process.exit(0);
  });
  process.parentPort.postMessage({
    pass: true,
    versions: process.versions,
    arch: process.arch,
    platform: process.platform,
    tdlibVersion: version.value,
    nativeLoadMs,
    totalMs: performance.now() - start,
    clientCount: clients.length,
    authStates,
    requests,
    clientErrors,
    initializedWithParameters: false,
    credentialsProvided: false,
    authenticated: false,
    accountOrMessageRequests: false,
    exitMode: "parent-acknowledged-exit-after-all-clients-closed",
  });
  // Electron's utility lifecycle stays alive after TDLib closes; exit only once
  // the parent has received the report proving both Closed updates arrived.
})().catch((error) => {
  clearTimeout(deadline);
  process.parentPort.postMessage({
    pass: false,
    error: error.message,
    requests,
  });
  process.exit(1);
});
