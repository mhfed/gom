const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PNG_BYTES = 32 * 1024;
export function validPng64(png: Buffer): boolean {
  if (
    png.length < 45 ||
    png.length > MAX_PNG_BYTES ||
    !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  )
    return false;
  let offset = 8;
  let first = true;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const end = dataStart + length;
    if (end + 4 > png.length) return false;
    const type = png.toString("ascii", typeStart, typeStart + 4);
    if (first) {
      if (
        type !== "IHDR" ||
        length !== 13 ||
        png.readUInt32BE(dataStart) !== 64 ||
        png.readUInt32BE(dataStart + 4) !== 64
      )
        return false;
      first = false;
    }
    offset = end + 4;
    if (type === "IEND") return length === 0 && offset === png.length;
  }
  return false;
}
