import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { defaultAccounts, createAccount } from "../src/main/accounts.ts";
import {
  defaultProviders,
  createCustomProvider,
} from "../src/main/providers.ts";
import { normalizeWorkspaceNavigation } from "../src/main/workspace-state.ts";
import { defaultPreferences } from "../src/main/preferences.ts";
import {
  createConfigurationBackup,
  parseConfigurationBackup,
  mergeConfigurationBackup,
  MAX_BACKUP_BYTES,
  type ConfigurationSource,
} from "../src/main/config-backup.ts";
const now = 1793334000000;
function source(): ConfigurationSource {
  const accounts = defaultAccounts();
  return {
    accounts,
    providers: defaultProviders(),
    navigation: normalizeWorkspaceNavigation(undefined, accounts, false),
    preferences: defaultPreferences(),
    logos: {},
  };
}
test("portable backup omits private accounts, private-only sites and transient session fields", () => {
  const current = source(),
    site = createCustomProvider("PRIVATE_SITE", "https://secret.example/");
  const hidden = { ...createAccount(site.id, "SECRET_NAME"), private: true };
  current.providers.push(site);
  current.accounts.push(hidden);
  current.preferences.notifications[hidden.id] = "allow";
  current.preferences.focus = { endsAt: now + 1000, muteAudio: true };
  current.navigation.presentation.pinned.push(hidden.id);
  current.logos[site.id] = { kind: "builtin", providerId: "zalo" };
  const backup = createConfigurationBackup(current, now);
  const encoded = JSON.stringify(backup);
  for (const secret of [
    "SECRET_NAME",
    "secret.example",
    hidden.id,
    site.id,
    "endsAt",
    "muteAudio",
    "private",
  ])
    assert.equal(encoded.includes(secret), false, secret);
  assert.equal(backup.accounts.length, 8);
  assert.equal(backup.format, "gom-config");
  assert.deepEqual(parseConfigurationBackup(encoded), backup);
});
test("portable backup preserves a custom site, account order, choices, and bounded PNG logo", async () => {
  const current = source(),
    site = createCustomProvider("Work", "https://work.example/inbox?view=all");
  const account = createAccount(site.id, "Work account");
  current.providers.push(site);
  current.accounts.unshift(account);
  current.preferences.notifications[account.id] = "mute";
  current.logos[site.id] = {
    kind: "image",
    dataUrl:
      "data:image/png;base64," +
      (
        await sharp({
          create: { width: 64, height: 64, channels: 4, background: "#087f7a" },
        })
          .png()
          .toBuffer()
      ).toString("base64"),
  };
  const backup = parseConfigurationBackup(
    JSON.stringify(createConfigurationBackup(current, now)),
  );
  assert.equal(backup.accounts[0].id, account.id);
  assert.equal(
    backup.providers[0].entry,
    "https://work.example/inbox?view=all",
  );
  assert.equal(backup.preferences.notifications[account.id], "mute");
  assert.equal(backup.logos[site.id].kind, "image");
});
test("rejects malformed, oversized, future-version, private, bad references and unsafe site/logo input", () => {
  const backup = createConfigurationBackup(source(), now);
  assert.throws(() => parseConfigurationBackup("no json"));
  assert.throws(() =>
    parseConfigurationBackup(" ".repeat(MAX_BACKUP_BYTES + 1)),
  );
  for (const mutate of [
    (b: any) => {
      b.version = 2;
    },
    (b: any) => {
      b.cookies = [];
    },
    (b: any) => {
      b.accounts[0].private = true;
    },
    (b: any) => {
      b.accounts.push(b.accounts[0]);
    },
    (b: any) => {
      b.preferences.notifications.unknown = "allow";
    },
    (b: any) => {
      b.providers = [
        {
          id: "web_00000000-0000-4000-8000-000000000001",
          label: "x",
          entry: "file:///etc/passwd",
        },
      ];
    },
    (b: any) => {
      b.logos.zalo = { kind: "image", dataUrl: "data:image/svg+xml,<svg/>" };
    },
    (b: any) => {
      b.logos["../escape"] = { kind: "builtin", providerId: "zalo" };
    },
  ]) {
    const item = structuredClone(backup);
    mutate(item);
    assert.throws(() => parseConfigurationBackup(JSON.stringify(item)));
  }
});
test("merge keeps extra accounts, private records, focus and notification settings outside the backup", () => {
  const current = source(),
    extra = createAccount("zalo", "Keep extra"),
    hidden = { ...createAccount("telegram", "Keep private"), private: true };
  current.accounts.push(extra, hidden);
  current.preferences.notifications[hidden.id] = "mute";
  current.preferences.focus = { endsAt: now + 1000, muteAudio: true };
  const incoming = source();
  incoming.accounts[0].name = "Restored name";
  incoming.navigation.presentation.theme = "dark";
  const result = mergeConfigurationBackup(
    current,
    createConfigurationBackup(incoming, now),
  );
  assert.equal(
    result.accounts.find((a) => a.id === "zalo")?.name,
    "Restored name",
  );
  assert.deepEqual(
    result.accounts.find((a) => a.id === hidden.id),
    hidden,
  );
  assert.deepEqual(
    result.accounts.find((a) => a.id === extra.id),
    extra,
  );
  assert.deepEqual(result.preferences.focus, {
    endsAt: now + 1000,
    muteAudio: true,
  });
  assert.equal(result.preferences.notifications[hidden.id], "mute");
  assert.equal(result.navigation.presentation.theme, "dark");
  assert.equal(current.accounts[0].name, "Cá nhân");
});
test("merge rejects private identity and provider URL/identity conflicts without mutating current source", () => {
  const current = source(),
    incoming = source();
  current.accounts[0].private = true;
  const before = JSON.stringify(current);
  assert.throws(() =>
    mergeConfigurationBackup(current, createConfigurationBackup(incoming, now)),
  );
  assert.equal(JSON.stringify(current), before);
  const ordinary = source(),
    site = createCustomProvider("Old", "https://old.example/");
  ordinary.providers.push(site);
  ordinary.accounts.push(createAccount(site.id, "Work"));
  const backup = createConfigurationBackup(ordinary, now);
  backup.providers[0].entry = "https://different.example/";
  assert.throws(() =>
    mergeConfigurationBackup(
      ordinary,
      parseConfigurationBackup(JSON.stringify(backup)),
    ),
  );
  const mismatch = createConfigurationBackup(source(), now);
  mismatch.accounts[0].provider = "telegram";
  assert.throws(() => parseConfigurationBackup(JSON.stringify(mismatch)));
});
