import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { normalizeTheme, themeScript } from "../src/main/theme.ts";
test("remote colors are validated and shell text stays readable in light and dark themes", () => {
  assert.equal(normalizeTheme("rgb(255, 255, 255)")?.mode, "light");
  assert.equal(normalizeTheme("rgb(23, 33, 43)")?.mode, "dark");
  assert.equal(normalizeTheme("url(https://example.com)"), null);
  assert.equal(normalizeTheme("rgba(0, 0, 0, 0)"), null);
  assert.equal(normalizeTheme("rgb(999, 0, 0)"), null);
  assert.equal(normalizeTheme("rgb(23, 33, 43)")?.background, "#17212b");
});
test("sampler chooses repeated neutral navigation surfaces over colorful icons and transparent layers", () => {
  const base = { parentElement: null, color: "rgb(24, 25, 26)" };
  const icon = { parentElement: base, color: "rgb(0, 104, 255)" };
  let i = 0;
  const value = runInNewContext(themeScript, {
    innerWidth: 1000,
    innerHeight: 700,
    document: {
      elementFromPoint: () => (i++ === 0 ? icon : base),
      body: base,
      documentElement: base,
    },
    getComputedStyle: (el: typeof base) => ({ backgroundColor: el.color }),
  });
  assert.equal(value, "rgb(24, 25, 26)");
});
