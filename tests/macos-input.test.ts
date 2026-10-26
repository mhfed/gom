import { test } from "node:test";
import assert from "node:assert/strict";
import { configureMacOSInput } from "../src/main/macos-input.ts";

const affected = { electron: "45.0.0", chrome: "156.0.8078.48" };
const feature = "RWHVMacHasFocusReturnsFalseForNonKeyWindow";
function commandLine(value = "") {
  const calls: [string, string][] = [];
  return {
    calls,
    getSwitchValue(name: string) {
      assert.equal(name, "disable-features");
      return value;
    },
    appendSwitch(name: string, next: string) {
      calls.push([name, next]);
      value = next;
    },
  };
}
test("affected macOS runtime restores native secure-input focus lifecycle", () => {
  const cli = commandLine();
  assert.equal(configureMacOSInput(cli, "darwin", affected), true);
  assert.deepEqual(cli.calls, [["disable-features", feature]]);
});
test("keeps existing disabled features and is idempotent", () => {
  const cli = commandLine("ExistingFeature,AnotherFeature");
  configureMacOSInput(cli, "darwin", affected);
  assert.equal(configureMacOSInput(cli, "darwin", affected), false);
  assert.deepEqual(cli.calls, [
    ["disable-features", "ExistingFeature,AnotherFeature," + feature],
  ]);
});
test("does not change other platforms or unverified runtime versions", () => {
  for (const [platform, versions] of [
    ["linux", affected],
    ["win32", affected],
    ["darwin", { electron: "45.0.1", chrome: affected.chrome }],
    ["darwin", { electron: affected.electron, chrome: "156.0.8078.49" }],
    ["darwin", {}],
  ] as const) {
    const cli = commandLine("ExistingFeature");
    assert.equal(configureMacOSInput(cli, platform, versions), false);
    assert.deepEqual(cli.calls, []);
  }
});
