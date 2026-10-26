import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const source = dirname(fileURLToPath(import.meta.url));
const target = resolve(source, "../../outputs/TinNhan-0.5-prototype");
await mkdir(target, { recursive: true });
let html = await readFile(join(source, "index.html"), "utf8");
let js = await readFile(join(source, "app.js"), "utf8");
const css = await readFile(join(source, "style.css"), "utf8");
for (const [name, type] of [
  ["zalo.png", "image/png"],
  ["messenger.svg", "image/svg+xml"],
  ["telegram.svg", "image/svg+xml"],
]) {
  const data =
    "data:" +
    type +
    ";base64," +
    (await readFile(join(source, "assets", name))).toString("base64");
  html = html.replaceAll("assets/" + name, data);
  js = js.replaceAll("assets/" + name, data);
}
html = html
  .replace(
    '<link rel="stylesheet" href="style.css" />',
    "<style>" + css + "</style>",
  )
  .replace('<script src="app.js"></script>', "<script>" + js + "</script>");
await writeFile(join(target, "index.html"), html);
console.log("Built " + join(target, "index.html"));
