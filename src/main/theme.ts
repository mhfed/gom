import type { ShellTheme } from "../shared.ts";
export function normalizeTheme(value: unknown): ShellTheme | null {
  if (typeof value !== "string") return null;
  const m =
    /^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(
      value,
    );
  if (!m) return null;
  const rgb = m.slice(1, 4).map(Number);
  if (rgb.some((v) => v > 255) || (m[4] !== undefined && Number(m[4]) !== 1))
    return null;
  const luminance = rgb
    .map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const dark = luminance < 0.179;
  const hex = (values: number[]) =>
    "#" +
    values.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const blend = (amount: number) =>
    hex(rgb.map((v) => v + ((dark ? 255 : 0) - v) * amount));
  return {
    mode: dark ? "dark" : "light",
    background: hex(rgb),
    surface: blend(0.07),
    line: blend(0.16),
    text: dark ? "#f5f5f5" : "#181818",
    muted: dark ? "#b7bdc5" : "#565d66",
  };
}
// Read computed colors only; never return DOM text or account/message data.
export const themeScript = `(() => {
  const votes = new Map();
  for (const x of [12, 32, Math.min(140, innerWidth * .18)]) {
    for (const y of [.16, .38, .65, .86]) {
      let el = document.elementFromPoint(x, innerHeight * y);
      while (el) {
        const color = getComputedStyle(el).backgroundColor;
        const m = /^rgba?\\(\\s*(\\d+)[, ]+\\s*(\\d+)[, ]+\\s*(\\d+)(?:\\s*[,/]\\s*([\\d.]+))?\\s*\\)$/.exec(color);
        if (m && (m[4] === undefined || Number(m[4]) === 1)) {
          const rgb = m.slice(1,4).map(Number);
          if (Math.max(...rgb) - Math.min(...rgb) < 65) {
            votes.set(color, (votes.get(color) || 0) + 1);
            break;
          }
        }
        el = el.parentElement;
      }
    }
  }
  return [...votes].sort((a,b) => b[1] - a[1])[0]?.[0] || null;
})()`;
