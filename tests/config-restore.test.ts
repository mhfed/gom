import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  rm,
  mkdir,
} from "node:fs/promises";
import { renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ConfigurationRestore,
  ConfigurationTransaction,
} from "../src/main/config-restore.ts";
import { createConfigurationBackup } from "../src/main/config-backup.ts";
import { defaultAccounts } from "../src/main/accounts.ts";
import { defaultProviders } from "../src/main/providers.ts";
import { defaultPreferences } from "../src/main/preferences.ts";
import { normalizeWorkspaceNavigation } from "../src/main/workspace-state.ts";
function backup(name = "Restored") {
  const accounts = defaultAccounts();
  accounts[0].name = name;
  return createConfigurationBackup({
    accounts,
    providers: defaultProviders(),
    navigation: normalizeWorkspaceNavigation(undefined, accounts, false),
    preferences: defaultPreferences(),
    logos: {},
  });
}
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "gom-config-unit-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("queues a valid restore only after a readable protection backup exists, then applies at startup", () =>
  fixture(async (root) => {
    const service = new ConfigurationRestore(root),
      before = backup("Before");
    const file = await service.queue(backup(), before, () => true);
    assert.ok(file);
    assert.equal(
      JSON.parse(
        await readFile(join(root, "configuration-backups", file!), "utf8"),
      ).accounts[0].name,
      "Before",
    );
    await assert.rejects(readFile(join(root, "accounts.json")));
    const result = await service.startup();
    assert.match(result, /khôi phục/i);
    const catalog = JSON.parse(
      await readFile(join(root, "accounts.json"), "utf8"),
    );
    assert.equal(catalog.accounts[0].name, "Restored");
    assert.equal(
      JSON.parse(await readFile(join(root, "window.json"), "utf8"))
        .providerTabDefaultsVersion,
      2,
    );
    await assert.rejects(
      readFile(join(root, "configuration-restore.pending.json")),
    );
  }));
test("cancellation or protection write failure leaves no pending restore and current files intact", () =>
  fixture(async (root) => {
    const service = new ConfigurationRestore(root);
    await writeFile(join(root, "window.json"), "KEEP");
    assert.equal(
      await service.queue(backup(), backup("Before"), () => false),
      null,
    );
    await assert.rejects(
      readFile(join(root, "configuration-restore.pending.json")),
    );
    await writeFile(join(root, "configuration-backups"), "not a directory");
    await assert.rejects(service.queue(backup(), backup("Before"), () => true));
    assert.equal(await readFile(join(root, "window.json"), "utf8"), "KEEP");
    await assert.rejects(
      readFile(join(root, "configuration-restore.pending.json")),
    );
  }));
test("canceling during pending preparation never publishes a restart marker", () =>
  fixture(async (root) => {
    let valid = true;
    const service = new ConfigurationRestore(root, async (path, data) => {
      await writeFile(path, data);
      if (path.endsWith(".pending.json.tmp")) valid = false;
    });
    assert.equal(
      await service.queue(backup(), backup("Before"), () => valid),
      null,
    );
    await assert.rejects(
      readFile(join(root, "configuration-restore.pending.json")),
    );
  }));
test("transaction rolls back every published file if a later publish fails", () =>
  fixture(async (root) => {
    await writeFile(join(root, "window.json"), "OLD WINDOW");
    await writeFile(join(root, "accounts.json"), "OLD ACCOUNTS");
    let count = 0;
    const transaction = new ConfigurationTransaction(root, (from, to) => {
      if (++count === 2) throw Error("disk failure");
      renameSync(from, to);
    });
    await assert.rejects(
      transaction.commit({ "window.json": "NEW", "accounts.json": "NEW" }),
    );
    assert.equal(
      await readFile(join(root, "window.json"), "utf8"),
      "OLD WINDOW",
    );
    assert.equal(
      await readFile(join(root, "accounts.json"), "utf8"),
      "OLD ACCOUNTS",
    );
  }));
test("startup recovery restores a crash snapshot before pending can be interpreted; hostile paths are rejected", () =>
  fixture(async (root) => {
    await writeFile(join(root, "window.json"), "HALF APPLIED");
    await writeFile(
      join(root, "configuration-restore.journal.json"),
      JSON.stringify({
        version: 1,
        before: {
          "window.json": Buffer.from("OLD").toString("base64"),
          "accounts.json": null,
        },
      }),
    );
    const transaction = new ConfigurationTransaction(root);
    assert.equal(await transaction.recover(), true);
    assert.equal(await readFile(join(root, "window.json"), "utf8"), "OLD");
    await writeFile(
      join(root, "configuration-restore.journal.json"),
      JSON.stringify({ version: 1, before: { "../outside": null } }),
    );
    await assert.rejects(transaction.recover());
    assert.equal(await readFile(join(root, "window.json"), "utf8"), "OLD");
  }));
test("startup merge preserves private workspace, extra account notifications, bounds and ongoing Focus", () =>
  fixture(async (root) => {
    const accounts = defaultAccounts(),
      hidden = {
        id: "acc_00000000-0000-4000-8000-000000000001",
        provider: "telegram" as const,
        name: "PRIVATE_KEEP",
        avatar: "PK",
        archived: false,
        private: true,
      };
    accounts.push(hidden);
    await writeFile(
      join(root, "accounts.json"),
      JSON.stringify({ version: 2, accounts, providers: [] }),
    );
    const privateNavigation = { active: hidden.id, privateMarker: "UNCHANGED" };
    const window = {
      bounds: { x: 100, y: 200 },
      preferences: {
        ...defaultPreferences(),
        focus: { endsAt: Date.now() + 60000, muteAudio: true },
        notifications: { [hidden.id]: "mute" },
      },
      workspaces: { private: privateNavigation },
    };
    await writeFile(join(root, "window.json"), JSON.stringify(window));
    const service = new ConfigurationRestore(root);
    await service.queue(backup(), backup("Before"), () => true);
    await service.startup();
    const saved = JSON.parse(await readFile(join(root, "window.json"), "utf8"));
    assert.deepEqual(saved.workspaces.private, privateNavigation);
    assert.deepEqual(saved.bounds, { x: 100, y: 200 });
    assert.deepEqual(saved.preferences.focus, window.preferences.focus);
    assert.equal(saved.preferences.notifications[hidden.id], "mute");
    const catalog = JSON.parse(
      await readFile(join(root, "accounts.json"), "utf8"),
    );
    assert.deepEqual(
      catalog.accounts.find((a: any) => a.id === hidden.id),
      hidden,
    );
  }));
test("invalid pending does not alter metadata and is preserved for inspection", () =>
  fixture(async (root) => {
    await writeFile(join(root, "accounts.json"), "KEEP BAD CATALOG");
    await writeFile(
      join(root, "configuration-restore.pending.json"),
      "not a backup",
    );
    const service = new ConfigurationRestore(root);
    assert.match(await service.startup(), /chưa/i);
    assert.equal(
      await readFile(join(root, "accounts.json"), "utf8"),
      "KEEP BAD CATALOG",
    );
    assert.ok(
      (await readdir(root)).some((name) =>
        name.startsWith("configuration-restore.failed-"),
      ),
    );
  }));

test("oversized pending is rejected without preventing normal startup", () =>
  fixture(async (root) => {
    await writeFile(
      join(root, "configuration-restore.pending.json"),
      " ".repeat(8 * 1024 * 1024 + 1),
    );
    assert.match(await new ConfigurationRestore(root).startup(), /chưa/i);
    await assert.rejects(readFile(join(root, "accounts.json")));
  }));

test("startup imports a validated PNG into a new revision and restores defaults only inside imported scope", () =>
  fixture(async (root) => {
    const sharp = (await import("sharp")).default;
    const png = await sharp({
      create: { width: 64, height: 64, channels: 4, background: "#087f7a" },
    })
      .png()
      .toBuffer();
    const document = backup();
    document.logos.zalo = {
      kind: "image",
      dataUrl: "data:image/png;base64," + png.toString("base64"),
    };
    const privateProvider = "web_00000000-0000-4000-8000-000000000001";
    await writeFile(
      join(root, "provider-logos.json"),
      JSON.stringify({
        version: 1,
        logos: {
          messenger: { kind: "builtin", providerId: "gmail" },
          [privateProvider]: { kind: "builtin", providerId: "telegram" },
        },
      }),
    );
    const service = new ConfigurationRestore(root);
    await service.queue(document, backup("Before"), () => true);
    await service.startup();
    const metadata = JSON.parse(
      await readFile(join(root, "provider-logos.json"), "utf8"),
    );
    assert.equal(metadata.logos.messenger, undefined);
    assert.deepEqual(metadata.logos[privateProvider], {
      kind: "builtin",
      providerId: "telegram",
    });
    assert.equal(metadata.logos.zalo.kind, "image");
    assert.deepEqual(
      await readFile(
        join(
          root,
          "provider-logos",
          `zalo-${metadata.logos.zalo.revision}.png`,
        ),
      ),
      png,
    );
  }));
