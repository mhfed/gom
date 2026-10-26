import { test } from "node:test";
import assert from "node:assert/strict";
import { navigationPolicy, validProviderId } from "../src/main/security.ts";
import { validNotificationFrame } from "../src/main/notification-policy.ts";
import type { ProviderDefinition } from "../src/shared.ts";
import {
  createCustomProvider,
  defaultProviders,
  restoreProviders,
} from "../src/main/providers.ts";

const id = "web_12345678-1234-4234-8234-123456789abc";
const providers: ProviderDefinition[] = [
  {
    id,
    label: "Local work",
    entry: "http://localhost:4321/dashboard",
    hosts: ["localhost"],
    color: "#087f7a",
    custom: true,
  },
];

test("custom provider IDs are UUID identities, never path-like or built-in lookalikes", () => {
  assert.equal(validProviderId(id), true);
  for (const candidate of [
    "web_foo",
    "web_../zalo",
    "web_zalo",
    "constructor",
    "toString",
    "web_12345678-1234-1234-8234-123456789abc",
  ])
    assert.equal(validProviderId(candidate), false);
});

test("custom navigation trusts only the configured origin including protocol and port", () => {
  assert.equal(
    navigationPolicy(id, "http://localhost:4321/account", providers),
    "internal",
  );
  for (const url of [
    "https://localhost:4321/account",
    "http://localhost:4322/",
    "http://localhost.evil.test:4321/",
    "http://localhost/",
  ])
    assert.equal(navigationPolicy(id, url, providers), "external");
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://a:b@localhost/",
    "not a URL",
  ])
    assert.equal(navigationPolicy(id, url, providers), "blocked");
  assert.equal(navigationPolicy(id, "http://localhost:4321/", []), "blocked");
});

test("custom notification permission stays bound to an owned main frame at its exact origin", () => {
  assert.equal(
    validNotificationFrame(id, "http://localhost:4321/", true, true, providers),
    true,
  );
  assert.equal(
    validNotificationFrame(id, "http://localhost:4322/", true, true, providers),
    false,
  );
  assert.equal(
    validNotificationFrame(
      id,
      "http://localhost:4321/",
      false,
      true,
      providers,
    ),
    false,
  );
  assert.equal(
    validNotificationFrame(
      id,
      "http://localhost:4321/",
      true,
      false,
      providers,
    ),
    false,
  );
});

test("website creation normalizes an explicit URL and keeps only its own hostname", () => {
  const created = createCustomProvider(
    "  Team\u202e website  ",
    " HTTPS://EXAMPLE.TEST:8443/team?view=mine#today ",
    "12345678-1234-4234-8234-123456789abc",
  );
  assert.equal(created.id, id);
  assert.equal(created.label, "Team website");
  assert.equal(created.entry, "https://example.test:8443/team?view=mine#today");
  assert.deepEqual(created.hosts, ["example.test"]);
  assert.equal(created.custom, true);
  assert.equal(
    createCustomProvider("LAN", "http://127.0.0.1:8080/notes").entry,
    "http://127.0.0.1:8080/notes",
  );
  assert.equal(
    createCustomProvider("IPv6", "http://[::1]:8080/").entry,
    "http://[::1]:8080/",
  );
  assert.equal(
    createCustomProvider("Unicode", "https://bücher.test/").entry,
    "https://xn--bcher-kva.test/",
  );
});

test("website creation rejects implicit URLs, credentials, privileged schemes and malformed hosts", () => {
  for (const url of [
    "example.test",
    "https:example.test",
    "https:/example.test",
    "https:///example.test",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,test",
    "ftp://example.test/",
    "https://user@example.test/",
    "https://user:secret@example.test/",
    "https://bad_host.test/",
    "https://-bad.test/",
    "https://bad..test/",
    "https://example.test:99999/",
    "https://exam\nple.test/",
    "https://example.test\\@other.test/",
    "",
  ])
    assert.throws(() => createCustomProvider("Site", url), url);
  assert.throws(() =>
    createCustomProvider(" \u202e ", "https://example.test/"),
  );
  assert.throws(() =>
    createCustomProvider("Site", "https://example.test/", "../zalo"),
  );
});

test("adding a custom definition does not broaden built-in origins or trust unregistered websites", () => {
  const all = [...defaultProviders(), ...providers];
  assert.equal(
    navigationPolicy("zalo", "http://localhost:4321/", all),
    "blocked",
  );
  assert.equal(navigationPolicy("zalo", "https://localhost/", all), "external");
  assert.equal(navigationPolicy(id, "https://chat.zalo.me/", all), "external");
  assert.equal(
    navigationPolicy(
      "web_87654321-1234-4234-8234-123456789abc",
      "http://localhost:4321/",
      all,
    ),
    "blocked",
  );
});

test("restored custom websites derive trusted hosts from entry URLs, never saved allowlists", () => {
  const restored = restoreProviders([
    { ...providers[0], hosts: ["evil.test"], custom: false },
  ]);
  assert.deepEqual(restored[3].hosts, ["localhost"]);
  assert.equal(restored[3].custom, true);
  assert.equal(
    navigationPolicy(id, "http://evil.test:4321/", restored),
    "external",
  );
  assert.equal(
    navigationPolicy(id, "http://localhost:4321/", restored),
    "internal",
  );
});
