import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// One vector source for the Dock icon, settings mark and menu-bar template.
const mark = await readFile("assets/gom-mark.svg", "utf8");
const markBody = mark.replace(/<svg[^>]*>|<\/svg>/g, "").trim();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><linearGradient id="tile" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#108C86"/><stop offset="0.5" stop-color="#0B7A75"/><stop offset="1" stop-color="#086762"/></linearGradient></defs>
<rect x="96" y="104" width="832" height="832" rx="186" fill="#172E2C" opacity="0.14"/>
<rect x="96" y="96" width="832" height="832" rx="186" fill="url(#tile)"/>
<rect x="98" y="98" width="828" height="828" rx="184" fill="none" stroke="#9DE4CF" stroke-opacity="0.24" stroke-width="2"/>
<g transform="translate(179.2 161) scale(2.6)" color="#F7F7F2">${markBody}</g>
</svg>`;
await mkdir("assets/app.iconset", { recursive: true });
await writeFile("assets/app.svg", svg);
for (const n of [16, 32, 128, 256, 512])
  for (const scale of [1, 2])
    await sharp(Buffer.from(svg))
      .resize(n * scale)
      .png()
      .toFile(
        `assets/app.iconset/icon_${n}x${n}${scale === 2 ? "@2x" : ""}.png`,
      );
const chunks = [];
for (const [type, size] of [
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024],
]) {
  const data = await sharp(Buffer.from(svg)).resize(size).png().toBuffer();
  const header = Buffer.alloc(8);
  header.write(type);
  header.writeUInt32BE(data.length + 8, 4);
  chunks.push(header, data);
}
const header = Buffer.alloc(8);
header.write("icns");
header.writeUInt32BE(8 + chunks.reduce((n, b) => n + b.length, 0), 4);
await writeFile("assets/app.icns", Buffer.concat([header, ...chunks]));
