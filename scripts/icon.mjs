import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect x="32" y="32" width="960" height="960" rx="220" fill="#e8eee3"/><rect x="190" y="206" width="650" height="490" rx="154" fill="#315c46"/><path d="M265 620v180l210-158" fill="#315c46"/><path d="M380 445h275M380 545h175" stroke="#f5f6ed" stroke-width="49" stroke-linecap="round"/></svg>`;
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
