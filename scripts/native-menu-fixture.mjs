// Drive production Electron Menu choices while replacing only the OS popup.
export async function nativeHeaderChoice(
  client,
  page,
  id,
  selector = "#navigation-menu",
  button = "left",
) {
  await client.evaluate(({ Menu }, id) => {
    if (globalThis.headerChoiceFixture)
      throw Error("Header fixture already open");
    const previous = Menu.prototype.popup;
    globalThis.headerChoiceFixture = { previous, captured: null };
    Menu.prototype.popup = function (options) {
      if (this.getMenuItemById(id)) {
        headerChoiceFixture.captured = { menu: this, options };
        return;
      }
      return previous.call(this, options);
    };
  }, id);
  try {
    await page.locator(selector).click({ button });
    const deadline = Date.now() + 15000;
    while (!(await client.evaluate(() => !!headerChoiceFixture.captured))) {
      if (Date.now() > deadline) throw Error(`Missing native menu: ${id}`);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    await client.evaluate(({ Menu, BrowserWindow }, id) => {
      const fixture = headerChoiceFixture;
      const { menu, options } = fixture.captured;
      const item = menu.getMenuItemById(id);
      if (!item || !item.enabled) throw Error(`Disabled native menu: ${id}`);
      Menu.prototype.popup = fixture.previous;
      delete globalThis.headerChoiceFixture;
      item.click(item, options.window || BrowserWindow.getAllWindows()[0], {});
      options.callback?.();
    }, id);
    await page.waitForFunction((selector) => {
      const trigger = document.querySelector(selector);
      return !trigger || trigger.getAttribute("aria-expanded") !== "true";
    }, selector);
  } finally {
    await client
      .evaluate(({ Menu }) => {
        if (!globalThis.headerChoiceFixture) return;
        const fixture = headerChoiceFixture;
        Menu.prototype.popup = fixture.previous;
        delete globalThis.headerChoiceFixture;
        fixture.captured?.options.callback?.();
      })
      .catch(() => {});
  }
}
