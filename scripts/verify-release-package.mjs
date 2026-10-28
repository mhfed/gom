// Inspect a packaged ASAR without executing it or accessing user profiles.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const project = fileURLToPath(new URL("..", import.meta.url));
const config = require(join(project, "forge.config.cjs"));
const sourcePackage = JSON.parse(
  await readFile(join(project, "package.json"), "utf8"),
);
const archive = resolve(
  process.argv[2] || "out-release/Gom-win32-x64/resources/app.asar",
);
const releaseDirectory = process.argv[3] ? resolve(process.argv[3]) : undefined;
const entries = asar
  .listPackage(archive)
  .map((path) => path.replaceAll("\\", "/"));
let files = 0;
for (const entry of entries) {
  assert.equal(
    config.packagerConfig.ignore(entry),
    false,
    `Unexpected packaged path: ${entry}`,
  );
  const relative = entry.replace(/^\//, "");
  const metadata = asar.statFile(archive, relative, false);
  assert.ok(
    !metadata.link && !metadata.unpacked,
    `Unexpected link/unpacked content: ${entry}`,
  );
  if (metadata.files) continue;
  files++;
  const contents = asar.extractFile(archive, relative);
  if (relative.startsWith("dist/")) {
    assert.deepEqual(
      contents,
      await readFile(join(project, relative)),
      `Packaged source differs: ${relative}`,
    );
  }
}
for (const required of [
  "package.json",
  "dist/main.cjs",
  "dist/preload.cjs",
  "dist/platform-preload.cjs",
  "dist/shell.js",
  "dist/index.html",
  "dist/shell.css",
  "dist/app.png",
]) {
  assert.ok(
    entries.includes("/" + required),
    `Missing runtime file: ${required}`,
  );
}
const packedPackage = JSON.parse(
  asar.extractFile(archive, "package.json").toString(),
);
assert.equal(packedPackage.version, sourcePackage.version);
assert.equal(packedPackage.main, "dist/main.cjs");
assert.ok(
  asar
    .extractFile(archive, "dist/main.cjs")
    .includes(Buffer.from("private-space.json")),
);
assert.ok(
  asar
    .extractFile(archive, "dist/index.html")
    .includes(Buffer.from('id="private-space-toggle"')),
);
console.log(
  `PASS ASAR ${sourcePackage.version}: ${files} allowed runtime files match the build`,
);

if (releaseDirectory) {
  const version = sourcePackage.version;
  const packageName = `Gom_win32_x64-${version}-full.nupkg`;
  const setup = join(releaseDirectory, `Gom-win32-x64-${version}-Setup.exe`);
  assert.ok((await stat(setup)).size > 0, "Empty Setup.exe");
  const nupkg = await readFile(join(releaseDirectory, packageName));
  const releases = (await readFile(join(releaseDirectory, "RELEASES"), "utf8"))
    .trim()
    .split(/\r?\n/);
  const row = releases
    .map((line) => line.trim().split(/\s+/))
    .find((fields) => fields[1] === packageName);
  assert.ok(row, `RELEASES does not contain ${packageName}`);
  assert.equal(row.length, 3);
  assert.equal(
    row[0].toLowerCase(),
    createHash("sha1").update(nupkg).digest("hex"),
  );
  assert.equal(Number(row[2]), nupkg.byteLength);
  console.log(
    `PASS Squirrel RELEASES: ${packageName} hash and byte length match`,
  );
}
