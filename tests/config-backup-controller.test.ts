import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  rm,
} from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { ConfigurationBackupController } from "../src/main/config-backup-controller.ts";
import { defaultAccounts } from "../src/main/accounts.ts";
import { defaultProviders } from "../src/main/providers.ts";
import { defaultPreferences } from "../src/main/preferences.ts";
import { normalizeWorkspaceNavigation } from "../src/main/workspace-state.ts";
async function setup(
  run: (root: string, state: ReturnType<typeof source>) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "gom-config-controller-"));
  await mkdir(join(root, "data"));
  try {
    await run(root, source());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
function source() {
  const accounts = defaultAccounts();
  return {
    accounts,
    providers: defaultProviders(),
    preferences: defaultPreferences(),
    navigation: normalizeWorkspaceNavigation(undefined, accounts, false),
    logos: {},
  };
}
function controller(
  root: string,
  state: ReturnType<typeof source>,
  pickExport: () => Promise<string | undefined>,
) {
  return new ConfigurationBackupController({
    root: join(root, "data"),
    epoch: () => 0,
    available: () => true,
    revision: () => JSON.stringify(state),
    source: async () => structuredClone(state),
    pickExport,
    pickImport: async () => undefined,
    confirm: async () => true,
    restart: () => {},
    openFolder: async () => "",
  });
}
test("export cannot overwrite userData through a symlinked parent", () =>
  setup(async (root, state) => {
    await writeFile(join(root, "data", "accounts.json"), "KEEP CATALOG");
    await symlink(join(root, "data"), join(root, "alias"), "dir");
    const result = await controller(root, state, async () =>
      join(root, "alias", "accounts.json"),
    ).run("export", { lockVersion: 0 });
    assert.equal(result.ok, false);
    assert.equal(
      await readFile(join(root, "data", "accounts.json"), "utf8"),
      "KEEP CATALOG",
    );
  }));
test("export uses canonical containment for a case alias on case-insensitive filesystems", () =>
  setup(async (root, state) => {
    await writeFile(join(root, "data", "accounts.json"), "KEEP CATALOG");
    const alias = join(root, "DATA");
    let same = false;
    try {
      same =
        (await readFile(join(alias, "accounts.json"), "utf8")) ===
        "KEEP CATALOG";
    } catch {}
    if (!same) return; // This boundary only exists on case-insensitive volumes.
    const result = await controller(root, state, async () =>
      join(alias, "accounts.json"),
    ).run("export", { lockVersion: 0 });
    assert.equal(result.ok, false);
    assert.equal(
      await readFile(join(root, "data", "accounts.json"), "utf8"),
      "KEEP CATALOG",
    );
  }));
test("a settings change while choosing an export destination publishes no stale snapshot", () =>
  setup(async (root, state) => {
    const target = join(root, "export.json");
    const result = await controller(root, state, async () => {
      state.preferences.paused = true;
      return target;
    }).run("export", { lockVersion: 0 });
    assert.equal(result.ok, false);
    assert.match(result.message!, /đã đổi/);
    await assert.rejects(readFile(target));
  }));

test("a settings change during export preparation cannot reach final publication", () =>
  setup(async (root, state) => {
    const fs = (await import("node:fs/promises")).default;
    const { syncBuiltinESMExports } = await import("node:module");
    const original = fs.writeFile,
      target = join(root, "export.json");
    fs.writeFile = async (...args: Parameters<typeof fs.writeFile>) => {
      const result = await original(...args);
      if (basename(String(args[0])).startsWith("export.json."))
        state.preferences.paused = true;
      return result;
    };
    syncBuiltinESMExports();
    try {
      const result = await controller(root, state, async () => target).run(
        "export",
        { lockVersion: 0 },
      );
      assert.equal(state.preferences.paused, true);
      assert.equal(result.ok, false);
      assert.match(result.message!, /đã đổi/);
      await assert.rejects(readFile(target));
    } finally {
      fs.writeFile = original;
      syncBuiltinESMExports();
    }
  }));

test("a normal export outside userData, including its parent directory, writes a readable backup", () =>
  setup(async (root, state) => {
    const target = join(root, "export.json");
    const result = await controller(root, state, async () => target).run(
      "export",
      { lockVersion: 0 },
    );
    assert.equal(result.ok, true, result.message);
    assert.equal(
      JSON.parse(await readFile(target, "utf8")).format,
      "gom-config",
    );
  }));
