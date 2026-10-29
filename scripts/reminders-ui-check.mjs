// Real renderer in headless Chrome; the bridge is synthetic and never touches user data.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath:
    process.env.TIN_NHAN_CHROMIUM ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage({
    bypassCSP: true,
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(await readFile("src/renderer/index.html", "utf8"));
  await page.addStyleTag({
    content: await readFile("src/renderer/shell.css", "utf8"),
  });
  const bundle = await build({
    stdin: {
      contents:
        'import {createReminderUI} from "./src/renderer/reminders.ts"; window.makeReminder = createReminderUI;',
      resolveDir: process.cwd(),
    },
    write: false,
    bundle: true,
    format: "iife",
    platform: "browser",
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => {
    window.calls = [];
    window.addCount = 0;
    window.state = {
      privateSpace: {
        configured: true,
        unlocked: false,
        unavailable: false,
        lockVersion: 7,
        retryAt: 0,
      },
      accounts: [
        { id: "a", provider: "zalo", name: "Công việc", archived: false },
        { id: "old", provider: "zalo", name: "Tài khoản cũ", archived: true },
      ],
      providers: [{ id: "zalo", label: "Zalo" }],
      active: "a",
      commandOpen: false,
      accountBusy: false,
      importing: false,
      preferences: { paused: false },
      reminders: {
        items: [
          {
            id: "pending",
            accountId: "a",
            note: "Dòng đầu\nDòng hai\t<img src=x onerror=alert(1)>",
            dueAt: Date.now() - 60000,
            completedAt: null,
            createdAt: 1,
            notifiedAt: null,
          },
          {
            id: "archived",
            accountId: "old",
            note: "Việc của tài khoản đã gỡ",
            dueAt: Date.now() + 3600000,
            completedAt: null,
            createdAt: 2,
            notifiedAt: null,
          },
          {
            id: "done",
            accountId: "a",
            note: "Đã gửi báo giá",
            dueAt: Date.now() - 3600000,
            completedAt: Date.now(),
            createdAt: 3,
            notifiedAt: null,
          },
        ],
        unavailable: false,
        error: "",
      },
    };
    window.originalItems = structuredClone(window.state.reminders.items);
    window.emit = () => window.ui.sync(structuredClone(window.state));
    window.desktop = {
      command: async (open) => {
        window.state.commandOpen = open;
        window.emit();
      },
      reminder: async (action, data) => {
        window.calls.push({ action, ...structuredClone(data) });
        if (
          window.hold === action ||
          (action === "surface" &&
            data.open === false &&
            window.holdSurfaceClose)
        )
          return new Promise((resolve) => (window.finish = resolve));
        if (data.lockVersion !== window.state.privateSpace.lockVersion)
          return { ok: false, message: "EPOCH_MISMATCH" };
        if (window.fail === action)
          return {
            ok: false,
            message: "Thử lại sau: không lưu được thay đổi.",
          };
        if (action === "surface") window.state.commandOpen = data.open;
        if (action === "snooze")
          window.state.reminders.items.find((i) => i.id === data.id).dueAt =
            data.dueAt;
        if (action === "complete")
          window.state.reminders.items.find(
            (i) => i.id === data.id,
          ).completedAt = Date.now();
        if (action === "remove")
          window.state.reminders.items = window.state.reminders.items.filter(
            (i) => i.id !== data.id,
          );
        if (action === "add")
          window.state.reminders.items.push({
            ...data,
            id: `added-${++window.addCount}`,
            completedAt: null,
            createdAt: Date.now(),
            notifiedAt: null,
          });
        window.emit();
        return { ok: true };
      },
    };
    const initialState = window.state;
    window.state = undefined;
    window.ui = window.makeReminder({ getState: () => window.state });
    window.state = initialState;
    window.emit();
  });
  const idleMutations = () =>
    page.evaluate(() => {
      const observer = new MutationObserver(() => {});
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
      for (let i = 0; i < 5; i++) window.emit();
      const records = observer.takeRecords().map((r) => ({
        id: r.target.id,
        attribute: r.attributeName,
        type: r.type,
      }));
      observer.disconnect();
      return records;
    });
  const closed = await idleMutations();
  await page.evaluate(() => window.ui.open());
  const open = await idleMutations();
  const custom = await page
    .locator('[data-reminder-id="pending"] [data-reminder-action="reschedule"]')
    .count();
  console.log(
    JSON.stringify({
      closedIdleMutations: closed.length,
      openIdleMutations: open.length,
      customRescheduleControls: custom,
    }),
  );
  assert.equal(
    custom,
    1,
    "pending reminders need a chosen-date Đổi giờ control",
  );
  assert.deepEqual(
    { closed, open },
    { closed: [], open: [] },
    "identical closed/open reminder snapshots must cause zero DOM mutations",
  );

  const pending = page.locator('[data-reminder-id="pending"]');
  const edit = () => pending.locator('[data-reminder-action="reschedule"]');
  const customDue = page.locator("#reminder-reschedule-due");
  const saveTime = page.locator('[data-reminder-action="reschedule-save"]');
  const callCount = (action) =>
    page.evaluate(
      (action) => window.calls.filter((c) => c.action === action).length,
      action,
    );
  assert.equal(
    await pending.locator(".reminder-item-note").textContent(),
    "Dòng đầu\nDòng hai\t<img src=x onerror=alert(1)>",
  );
  assert.equal(
    await page.locator("#reminder-list img").count(),
    0,
    "notes are inert text",
  );
  assert.equal(
    await page
      .locator('[data-reminder-id="archived"] [data-reminder-action="open"]')
      .isDisabled(),
    true,
  );
  assert.match(
    await page
      .locator('[data-reminder-id="archived"] .reminder-item-source')
      .textContent(),
    /Đã gỡ/,
  );
  assert.equal(
    await page.locator("#reminder-account option").count(),
    1,
    "archived accounts cannot receive new reminders",
  );
  await edit().click();
  assert.equal(
    await customDue.evaluate((e) => document.activeElement === e),
    true,
  );
  await customDue.fill("2020-01-01T09:00");
  await saveTime.click();
  assert.match(
    await page.locator("#reminder-reschedule-error").textContent(),
    /tương lai/,
  );
  assert.equal(
    await callCount("snooze"),
    0,
    "past dates must not reach the bridge",
  );
  await customDue.fill("2099-01-01T09:00");
  await saveTime.click();
  assert.equal(
    await callCount("snooze"),
    0,
    "dates beyond366days must not reach the bridge",
  );
  const chosen = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(14, 25, 0, 0);
    const p = (n) => String(n).padStart(2, "0");
    return {
      value: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T14:25`,
      timestamp: d.getTime(),
    };
  });
  await customDue.fill(chosen.value);
  // Clear the old validation message with another edit, then exercise idle polls while typing.
  await page.locator('[data-reminder-action="reschedule-cancel"]').click();
  assert.equal(
    await edit().evaluate((e) => document.activeElement === e),
    true,
    "cancel returns keyboard focus",
  );
  assert.equal(await customDue.count(), 0);
  assert.equal(await callCount("snooze"), 0);
  await edit().click();
  await customDue.fill(chosen.value);
  await page.evaluate(
    () =>
      (window.editorNode = document.querySelector("#reminder-reschedule-due")),
  );
  assert.deepEqual(
    await idleMutations(),
    [],
    "polls must preserve a typed editor without DOM writes",
  );
  assert.equal(await customDue.inputValue(), chosen.value);
  assert.equal(
    await customDue.evaluate(
      (e) => e === window.editorNode && document.activeElement === e,
    ),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await customDue.count(), 0, "Escape cancels the editor first");
  assert.equal(await page.locator("#reminders-dialog").isVisible(), true);
  await edit().click();
  await customDue.fill(chosen.value);
  await saveTime.click();
  await page.waitForFunction(() =>
    document
      .querySelector("#reminder-feedback")
      .textContent.includes("Đã đổi giờ"),
  );
  assert.equal(await customDue.count(), 0);
  assert.deepEqual(
    await page.evaluate(() => {
      const i = window.state.reminders.items.find((i) => i.id === "pending");
      return { accountId: i.accountId, note: i.note, dueAt: i.dueAt };
    }),
    {
      accountId: "a",
      note: "Dòng đầu\nDòng hai\t<img src=x onerror=alert(1)>",
      dueAt: chosen.timestamp,
    },
  );
  assert.deepEqual(
    await page.evaluate(() => window.calls.find((c) => c.action === "snooze")),
    {
      action: "snooze",
      id: "pending",
      lockVersion: 7,
      dueAt: chosen.timestamp,
    },
  );
  assert.equal(
    await edit().evaluate((e) => document.activeElement === e),
    true,
    "saving returns focus to Đổi giờ",
  );

  await page.evaluate(() => (window.fail = "snooze"));
  await edit().click();
  await customDue.fill(chosen.value);
  await saveTime.click();
  await page.waitForFunction(() =>
    document
      .querySelector("#reminder-feedback")
      .textContent.includes("không lưu được"),
  );
  assert.equal(
    await customDue.inputValue(),
    chosen.value,
    "failure preserves the custom date for retry",
  );
  assert.equal(await customDue.isDisabled(), false);
  await page.evaluate(() => (window.fail = ""));
  await page.locator('[data-reminder-action="reschedule-cancel"]').click();
  for (const [quick, minutes] of [
    ["15", 15],
    ["60", 60],
  ]) {
    const start = Date.now();
    await page.locator(`[data-reminder-quick="${quick}"]`).click();
    const timestamp = await page
      .locator("#reminder-due")
      .evaluate((e) => new Date(e.value).getTime());
    assert.ok(
      timestamp >= start + minutes * 60000 &&
        timestamp <= Date.now() + (minutes + 1) * 60000,
    );
  }
  await page.locator('[data-reminder-quick="tomorrow"]').click();
  assert.equal(
    await page.locator("#reminder-due").evaluate((e) => {
      const d = new Date(e.value),
        t = new Date();
      t.setDate(t.getDate() + 1);
      return (
        d.getDate() === t.getDate() &&
        d.getHours() === 9 &&
        d.getMinutes() === 0
      );
    }),
    true,
  );
  await page.locator("#reminder-note").fill("😀".repeat(501));
  await page.locator("#reminder-save").click();
  assert.equal(
    await callCount("add"),
    0,
    "501Unicode codepoints cannot be submitted",
  );
  assert.match(await page.locator("#reminder-error").textContent(), /500/);
  await page.locator("#reminder-note").fill("😀".repeat(500));
  await page.locator("#reminder-save").click();
  await page.waitForFunction(() =>
    window.calls.some((c) => c.action === "add"),
  );
  assert.equal(
    await page.evaluate(
      () =>
        Array.from(window.calls.find((c) => c.action === "add").note).length,
    ),
    500,
    "500astral Unicode codepoints remain usable",
  );
  assert.equal(await page.locator("#reminder-note").inputValue(), "");
  const multiline = "Dòng A\nDòng B\t<script>alert(1)</script>";
  await page.locator("#reminder-note").fill(multiline);
  await page.locator("#reminder-save").click();
  await page.waitForFunction(
    () => window.calls.filter((c) => c.action === "add").length === 2,
  );
  assert.equal(
    await page.evaluate(
      () => window.calls.filter((c) => c.action === "add").at(-1).note,
    ),
    multiline,
  );
  assert.equal(
    await page
      .locator('[data-reminder-id="added-2"] .reminder-item-note')
      .textContent(),
    multiline,
  );
  assert.equal(await page.locator("#reminder-list script").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      window.calls
        .filter((c) => c.action === "add")
        .every((c) => c.lockVersion === 7),
    ),
    true,
  );
  await page.evaluate(() => {
    window.state.reminders.items = structuredClone(window.originalItems);
    window.emit();
  });
  await page.locator("#reminder-pending").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.locator("#reminder-done").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await page
      .locator("#reminder-done")
      .evaluate((e) => document.activeElement === e),
    true,
  );
  assert.equal(await page.locator(".reminder-item").count(), 1);
  assert.equal(
    await page.locator('[data-reminder-action="reschedule"]').count(),
    0,
    "completed rows cannot reschedule",
  );
  await page.keyboard.press("Home");
  assert.equal(await page.locator(".reminder-item").count(), 2);
  await page.evaluate(() => {
    window.state.accounts[0].name = "Công việc đã đổi";
    window.state.providers[0].label = "Zalo mới";
    window.state.reminders.items[0].note = "Ghi chú đã đổi\nVẫn nhiều dòng";
    window.emit();
  });
  assert.match(
    await pending.locator(".reminder-item-source").textContent(),
    /Zalo mới · Công việc đã đổi/,
  );
  assert.match(
    await pending.locator(".reminder-item-note").textContent(),
    /Ghi chú đã đổi/,
  );
  await page.evaluate(() => {
    window.state.reminders.items[0].dueAt = Date.now() + 1200000;
    window.emit();
  });
  assert.equal(
    await pending
      .locator("time")
      .evaluate((e) => e.classList.contains("overdue")),
    false,
    "a genuine date change rerenders overdue state",
  );
  assert.deepEqual(await idleMutations(), []);

  const out = "outputs/reminders-ui-check";
  await mkdir(out, { recursive: true });
  await page.evaluate(() => {
    window.state.reminders.items[0].note =
      "Nội dung cần quay lại — " +
      "ghi chú dài nhiều dòng\n".repeat(16) +
      "<img src=x onerror=alert(1)>";
    window.emit();
  });
  await edit().click();
  for (const width of [1280, 940, 400])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const layout = await page.locator("#reminders-dialog").evaluate((e) => {
        const r = e.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: e.clientWidth,
          scrollWidth: e.scrollWidth,
        };
      });
      assert.ok(
        layout.x >= 0 &&
          layout.y >= 0 &&
          layout.right <= width &&
          layout.bottom <= 800,
        JSON.stringify({ width, theme, layout }),
      );
      assert.ok(
        layout.scrollWidth <= layout.width,
        `reminder modal must not overflow horizontally: ${JSON.stringify({ width, theme, layout })}`,
      );
      assert.deepEqual(await idleMutations(), []);
      await page.screenshot({ path: `${out}/${theme}-${width}.png` });
    }
  await page.locator('[data-reminder-action="reschedule-cancel"]').click();
  await page.locator("#reminder-done").click();
  await page.screenshot({ path: `${out}/done-dark-400.png` });
  await page.locator("#reminder-pending").click();
  await page.evaluate(() => {
    window.state.reminders.unavailable = true;
    window.state.reminders.error =
      "Không mở được kho nhắc việc.\nHãy mở lại Gom để thử lại. " +
      "Thông tin lỗi dài. ".repeat(30);
    window.emit();
  });
  assert.equal(await page.locator("#reminder-save").isDisabled(), true);
  assert.equal(await edit().isDisabled(), true);
  assert.equal(
    await pending.locator('[data-reminder-action="remove"]').isDisabled(),
    true,
  );
  assert.match(
    await page.locator("#reminder-storage-error").textContent(),
    /Không mở được/,
  );
  const errorLayout = await page
    .locator("#reminder-storage-error")
    .evaluate((e) => ({
      height: e.clientHeight,
      scrollHeight: e.scrollHeight,
      tabIndex: e.tabIndex,
    }));
  assert.ok(
    errorLayout.height <= 112 &&
      errorLayout.scrollHeight > errorLayout.height &&
      errorLayout.tabIndex === 0,
    "long storage errors must remain bounded and keyboard scrollable",
  );
  await page.screenshot({ path: `${out}/unavailable-dark-400.png` });
  await page.evaluate(() => {
    window.state.reminders.unavailable = false;
    window.state.reminders.error = "";
    window.state.reminders.items = structuredClone(window.originalItems);
    window.emit();
  });
  await pending.locator('[data-reminder-action="snooze"]').click();
  assert.equal(
    await page.evaluate(
      () =>
        window.calls.filter((c) => c.action === "snooze").at(-1).lockVersion,
    ),
    7,
  );
  await pending.locator('[data-reminder-action="complete"]').click();
  assert.equal(await page.locator('[data-reminder-id="pending"]').count(), 0);
  await page
    .locator('[data-reminder-id="archived"] [data-reminder-action="remove"]')
    .click();
  assert.equal(
    await page.locator(".reminder-item").count(),
    0,
    "archived reminders remain removable",
  );
  assert.equal(await page.locator("#reminder-empty").isVisible(), true);
  await page.screenshot({ path: `${out}/empty-dark-400.png` });
  for (const action of ["complete", "remove"])
    assert.equal(
      await page.evaluate(
        (action) =>
          window.calls.filter((c) => c.action === action).at(-1).lockVersion,
        action,
      ),
      7,
    );

  // A renderer operation may resolve after locking or even switching away and back.
  await page.locator("#reminder-note").fill("PRIVATE_DRAFT");
  await page.evaluate(() => (window.hold = "add"));
  await page.locator("#reminder-save").click();
  await page.waitForFunction(() => !!window.finish);
  await page.evaluate(() => {
    window.state.privateSpace = {
      ...window.state.privateSpace,
      unlocked: true,
      lockVersion: 8,
    };
    window.state.commandOpen = false;
    window.state.reminders.items = [];
    window.emit();
    window.finish({ ok: false, message: "OLD_ADD_RESULT" });
    window.hold = "";
  });
  assert.equal(await page.locator("#reminders-dialog").isVisible(), false);
  assert.equal(await page.locator("#reminder-note").inputValue(), "");
  assert.equal(await page.locator("#reminder-due").inputValue(), "");
  assert.equal(await page.locator("#reminder-list").textContent(), "");
  assert.equal(await page.locator("#reminder-error").textContent(), "");
  await page.evaluate(() => {
    window.state.reminders.items = [
      { ...window.originalItems[0], id: "private", note: "Kín mới" },
    ];
    window.ui.open();
  });
  await page.waitForFunction(() => window.state.commandOpen);
  await page
    .locator('[data-reminder-id="private"] [data-reminder-action="reschedule"]')
    .click();
  await customDue.fill(chosen.value);
  await page.evaluate(() => {
    window.hold = "snooze";
    window.finish = null;
  });
  await saveTime.click();
  await page.waitForFunction(() => !!window.finish);
  await page.evaluate(() => {
    window.state.privateSpace = {
      ...window.state.privateSpace,
      unlocked: false,
      lockVersion: 9,
    };
    window.state.commandOpen = false;
    window.state.reminders.items = structuredClone(window.originalItems);
    window.emit();
    window.finish({ ok: false, message: "OLD_SNOOZE_RESULT" });
    window.hold = "";
  });
  assert.equal(await page.locator("#reminders-dialog").isVisible(), false);
  assert.equal(await customDue.count(), 0);
  assert.equal(await page.locator("#reminder-feedback").textContent(), "");
  await page.evaluate(() => window.ui.open());
  await page.locator("#reminder-note").fill("NEVER_KEEP_THIS");
  await page.evaluate(() => {
    window.holdSurfaceClose = true;
    window.finish = null;
    window.openCallsBefore = window.calls.filter(
      (c) => c.action === "open",
    ).length;
  });
  await pending.locator('[data-reminder-action="open"]').click();
  await page.waitForFunction(() => !!window.finish);
  assert.equal(await page.locator("#reminder-note").inputValue(), "");
  await page.evaluate(() => {
    window.state.privateSpace.lockVersion = 11;
    window.state.commandOpen = false;
    window.emit();
    window.finish({ ok: true });
    window.holdSurfaceClose = false;
  });
  assert.equal(
    await page.evaluate(
      () =>
        window.calls.filter((c) => c.action === "open").length ===
        window.openCallsBefore,
    ),
    true,
    "a stale surface release must not dispatch open-account in a later epoch",
  );
  assert.equal(
    await page.evaluate(
      () =>
        window.calls.filter((c) => c.action === "surface").at(-1).lockVersion,
    ),
    9,
    "surface release keeps the captured epoch after reset",
  );
  await page.evaluate(() => window.ui.open());
  await page.evaluate(() => {
    window.hold = "open";
    window.finish = null;
  });
  await pending.locator('[data-reminder-action="open"]').click();
  await page.waitForFunction(() => !!window.finish);
  assert.equal(
    await page.evaluate(
      () => window.calls.filter((c) => c.action === "open").at(-1).lockVersion,
    ),
    11,
  );
  await page.evaluate(() => {
    window.state.privateSpace.lockVersion = 12;
    window.emit();
    window.finish({ ok: false, message: "OLD_OPEN_RESULT" });
    window.hold = "";
  });
  assert.equal(
    await page.locator("#reminders-dialog").isVisible(),
    false,
    "late open-account failure must not reopen the modal",
  );
  assert.equal(await page.locator("#reminder-feedback").textContent(), "");
  await page.evaluate(() => {
    window.fail = "open";
    return window.ui.open();
  });
  await pending.locator('[data-reminder-action="open"]').click();
  await page.waitForFunction(
    () => document.querySelector("#reminders-dialog").open,
  );
  await page.waitForFunction(() =>
    document
      .querySelector("#reminder-feedback")
      .textContent.includes("không lưu được"),
  );
  assert.equal(await page.locator("#reminder-note").inputValue(), "");
  await page.evaluate(() => (window.fail = ""));
  const completeCount = await callCount("complete");
  await pending.locator('[data-reminder-action="open"]').click();
  assert.equal(await page.locator("#reminders-dialog").isVisible(), false);
  assert.equal(
    await callCount("complete"),
    completeCount,
    "opening an account never completes a reminder",
  );
  await page.evaluate(() => {
    window.hold = "surface";
    window.finish = null;
    void window.ui.open();
  });
  await page.waitForFunction(() => !!window.finish);
  await page.evaluate(() => {
    window.state.privateSpace.lockVersion = 13;
    window.state.commandOpen = false;
    window.emit();
    window.finish({ ok: false, message: "OLD_SURFACE_RESULT" });
    window.hold = "";
  });
  assert.equal(await page.locator("#reminders-dialog").isVisible(), false);
  assert.equal(await page.locator("#account-feedback").textContent(), "");
  assert.equal(
    await page.evaluate(() =>
      window.calls.every((c) => Number.isInteger(c.lockVersion)),
    ),
    true,
    "every reminder bridge action includes an epoch",
  );
  assert.deepEqual(
    await idleMutations(),
    [],
    "the scrubbed closed modal remains idle",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS reminders UI: custom save/cancel/validation,500Unicode points,multiline inert text,quick times,filters,archived/unavailable/errors,epoch capture and late-result scrub,closed/open/editor idle0,live content updates,light/dark1280/940/400 screenshots",
  );
} finally {
  await browser.close();
}
