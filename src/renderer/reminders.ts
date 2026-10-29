import type { AppState, ReplyReminder } from "../shared.ts";

const minute = 60_000;
const year = 366 * 24 * 60 * minute;
function localInput(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function futureTime(value: string): number | null {
  const timestamp = new Date(value).getTime();
  const now = Date.now();
  return Number.isFinite(timestamp) &&
    localInput(timestamp) === value &&
    timestamp > now &&
    timestamp <= now + year
    ? timestamp
    : null;
}

export function createReminderUI(options: { getState(): AppState }) {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const dialog = $<HTMLDialogElement>("reminders-dialog");
  const form = $<HTMLFormElement>("reminder-form");
  const account = $<HTMLSelectElement>("reminder-account");
  const note = $<HTMLTextAreaElement>("reminder-note");
  const due = $<HTMLInputElement>("reminder-due");
  const list = $("reminder-list");
  let generation = 0;
  let busy = false;
  let holdsSurface = false;
  let surfaceSeenOpen = false;
  let surfaceLockVersion: number | undefined;
  let filter: "pending" | "done" = "pending";
  let accountSignature = "";
  let listSignature = "";
  let editor: { id: string; value: string; error: string } | undefined;
  const epoch = () => options.getState()?.privateSpace?.lockVersion ?? 0;
  const space = (state: AppState | undefined) =>
    `${state?.privateSpace?.lockVersion ?? 0}:${!!state?.privateSpace?.unlocked}`;
  let lastSpace = space(options.getState());
  const current = (token: number, lockVersion: number) =>
    token === generation && lockVersion === epoch();
  const text = (node: HTMLElement, value: string) => {
    if (node.textContent !== value) node.textContent = value;
  };
  const attr = (node: HTMLElement, name: string, value: string) => {
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  };
  const disable = (
    node:
      | HTMLButtonElement
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement,
    value: boolean,
  ) => {
    if (node.disabled !== value) node.disabled = value;
  };
  const feedback = (message: string) => text($("reminder-feedback"), message);
  const futureDefault = () =>
    Math.ceil((Date.now() + 30 * minute) / minute) * minute;
  const noteCount = () =>
    text(
      $("reminder-note-count"),
      `${Array.from(note.value).length}/500 ký tự`,
    );
  function reset() {
    generation++;
    busy = false;
    holdsSurface = false;
    surfaceSeenOpen = false;
    surfaceLockVersion = undefined;
    filter = "pending";
    editor = undefined;
    accountSignature = listSignature = "";
    form.reset();
    noteCount();
    attr(note, "aria-invalid", "false");
    account.replaceChildren();
    list.replaceChildren();
    feedback("");
    for (const id of [
      "reminder-error",
      "reminder-storage-error",
      "reminder-empty",
      "reminder-private-hint",
    ])
      text($(id), "");
    if (dialog.open) dialog.close();
  }
  function close() {
    const release = holdsSurface;
    const lockVersion = surfaceLockVersion;
    reset();
    if (release)
      void window.desktop
        .reminder("surface", { open: false, lockVersion })
        .catch(() => {});
  }
  function accountLabel(state: AppState, id: string): string {
    const value = state.accounts.find((entry) => entry.id === id);
    if (!value) return "Tài khoản không còn trong danh sách";
    const provider = state.providers.find(
      (entry) => entry.id === value.provider,
    );
    return `${provider?.label || "Website"} · ${value.name}${value.archived ? " · Đã gỡ" : ""}`;
  }
  function renderAccounts(state: AppState) {
    const accounts = state.accounts.filter((entry) => !entry.archived);
    const signature = JSON.stringify(
      accounts.map((entry) => [entry.id, accountLabel(state, entry.id)]),
    );
    if (signature !== accountSignature) {
      accountSignature = signature;
      const selected = account.value || state.active;
      account.replaceChildren();
      for (const entry of accounts) {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = accountLabel(state, entry.id);
        account.append(option);
      }
      if (accounts.some((entry) => entry.id === selected))
        account.value = selected;
      if (!accounts.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Thêm tài khoản để tạo nhắc việc";
        account.append(option);
      }
    }
    const disabled =
      busy || state.reminders?.unavailable === true || !accounts.length;
    for (const control of [
      account,
      note,
      due,
      $<HTMLButtonElement>("reminder-save"),
      ...form.querySelectorAll<HTMLButtonElement>("[data-reminder-quick]"),
    ])
      disable(control, disabled);
  }
  function dateLabel(timestamp: number): string {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year:
        new Date(timestamp).getFullYear() !== new Date().getFullYear()
          ? "numeric"
          : undefined,
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);
  }
  function focusAction(id: string, action: string) {
    const row = Array.from(list.children).find(
      (node) => (node as HTMLElement).dataset.reminderId === id,
    );
    row
      ?.querySelector<HTMLButtonElement>(`[data-reminder-action="${action}"]`)
      ?.focus();
  }
  function button(
    label: string,
    action: "open" | "snooze" | "complete" | "remove" | "reschedule",
    item: ReplyReminder,
    disabled = false,
  ) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "reminder-action";
    node.textContent = label;
    node.dataset.reminderAction = action;
    node.disabled = busy || disabled;
    node.onclick = () => {
      if (action === "reschedule") {
        editor = {
          id: item.id,
          value: localInput(
            item.dueAt > Date.now() ? item.dueAt : futureDefault(),
          ),
          error: "",
        };
        sync(options.getState());
        $("reminder-reschedule-due").focus();
      } else void act(action, item.id);
    };
    return node;
  }
  function renderEditor(
    row: HTMLElement,
    item: ReplyReminder,
    readonly: boolean,
  ) {
    if (editor?.id !== item.id) return;
    const editing = editor;
    const form = document.createElement("form");
    form.className = "reminder-reschedule";
    form.setAttribute("aria-label", "Đổi giờ nhắc việc");
    const label = document.createElement("label");
    label.htmlFor = "reminder-reschedule-due";
    label.textContent = "Nhắc lại lúc";
    const input = document.createElement("input");
    input.id = "reminder-reschedule-due";
    input.type = "datetime-local";
    input.required = true;
    input.value = editing.value;
    input.disabled = busy || readonly;
    input.setAttribute("aria-describedby", "reminder-reschedule-error");
    input.setAttribute("aria-invalid", String(!!editing.error));
    input.oninput = () => {
      editing.value = input.value;
    };
    const error = document.createElement("p");
    error.id = "reminder-reschedule-error";
    error.className = "form-error";
    error.setAttribute("role", "alert");
    error.textContent = editing.error;
    const actions = document.createElement("div");
    actions.className = "reminder-item-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "reminder-action";
    save.dataset.reminderAction = "reschedule-save";
    save.textContent = busy ? "Đang lưu…" : "Lưu giờ";
    save.disabled = busy || readonly;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "reminder-action";
    cancel.dataset.reminderAction = "reschedule-cancel";
    cancel.textContent = "Hủy";
    cancel.disabled = busy;
    const cancelEdit = () => {
      editor = undefined;
      sync(options.getState());
      focusAction(item.id, "reschedule");
    };
    cancel.onclick = cancelEdit;
    form.onkeydown = (event) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        event.stopPropagation();
        cancelEdit();
      }
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      if (busy || readonly) return;
      const dueAt = futureTime(input.value);
      if (dueAt === null) {
        editing.error = "Chọn giờ hợp lệ trong tương lai, tối đa một năm tới.";
        sync(options.getState());
        $("reminder-reschedule-due").focus();
        return;
      }
      void act("snooze", item.id, dueAt);
    };
    actions.append(save, cancel);
    form.append(label, input, error, actions);
    row.append(form);
  }
  function renderList(state: AppState) {
    const items = state.reminders?.items || [];
    const pending = items.filter((item) => item.completedAt === null);
    const done = items.filter((item) => item.completedAt !== null);
    text($("reminder-pending"), `Đang chờ (${pending.length})`);
    text($("reminder-done"), `Đã xong (${done.length})`);
    for (const name of ["pending", "done"] as const) {
      const tab = $("reminder-" + name);
      attr(tab, "aria-selected", String(filter === name));
      const tabIndex = filter === name ? 0 : -1;
      if (tab.tabIndex !== tabIndex) tab.tabIndex = tabIndex;
    }
    attr($("reminder-results"), "aria-labelledby", "reminder-" + filter);
    const rows = (filter === "pending" ? pending : done)
      .slice()
      .sort((a, b) =>
        filter === "pending"
          ? a.dueAt - b.dueAt
          : (b.completedAt || 0) - (a.completedAt || 0),
      );
    if (
      editor &&
      !rows.some((item) => item.id === editor?.id && item.completedAt === null)
    )
      editor = undefined;
    const now = Date.now();
    // Draft input values stay in the live control; a poll never rebuilds an editor as the user types.
    const signature = JSON.stringify([
      rows,
      rows.map((item) => [
        accountLabel(state, item.accountId),
        state.accounts.some((a) => a.id === item.accountId && !a.archived),
        item.dueAt <= now,
      ]),
      filter,
      busy,
      state.reminders?.unavailable,
      editor?.id,
      editor?.error,
    ]);
    if (signature !== listSignature) {
      listSignature = signature;
      list.replaceChildren();
      for (const item of rows) {
        const row = document.createElement("article");
        row.className = "reminder-item";
        row.dataset.reminderId = item.id;
        const heading = document.createElement("p");
        heading.className = "reminder-item-note";
        heading.textContent = item.note;
        const source = document.createElement("p");
        source.className = "reminder-item-source";
        source.textContent = accountLabel(state, item.accountId);
        const time = document.createElement("time");
        time.dateTime = new Date(item.dueAt).toISOString();
        const overdue = item.completedAt === null && item.dueAt <= now;
        time.className = "reminder-item-time" + (overdue ? " overdue" : "");
        time.textContent =
          (overdue ? "Đã đến giờ · " : "") + dateLabel(item.dueAt);
        const actions = document.createElement("div");
        actions.className = "reminder-item-actions";
        const available = state.accounts.some(
          (entry) => entry.id === item.accountId && !entry.archived,
        );
        const readonly = state.reminders?.unavailable === true;
        actions.append(button("Mở tài khoản", "open", item, !available));
        if (item.completedAt === null)
          actions.append(
            button("Để sau 15 phút", "snooze", item, readonly),
            button("Đổi giờ", "reschedule", item, readonly),
            button("Hoàn tất", "complete", item, readonly),
          );
        actions.append(button("Xóa", "remove", item, readonly));
        row.append(heading, source, time, actions);
        renderEditor(row, item, readonly);
        list.append(row);
      }
    }
    const empty = $("reminder-empty");
    if (empty.hidden !== rows.length > 0) empty.hidden = rows.length > 0;
    text(
      empty,
      filter === "pending"
        ? "Chưa có việc đang chờ. Thêm một nhắc việc để quay lại sau."
        : "Việc đã hoàn tất sẽ nằm ở đây.",
    );
  }
  function sync(state: AppState) {
    const nextSpace = space(state);
    if (lastSpace !== nextSpace) {
      lastSpace = nextSpace;
      reset();
    }
    const dueCount = (state.reminders?.items || []).filter(
      (item) => item.completedAt === null && item.dueAt <= Date.now(),
    ).length;
    const badge = $("reminder-due-count");
    if (badge.hidden !== (dueCount === 0)) badge.hidden = dueCount === 0;
    text(badge, dueCount > 99 ? "99+" : String(dueCount));
    const label =
      "Nhắc trả lời" + (dueCount ? ` · ${dueCount} việc đến hạn` : "");
    const opener = $<HTMLButtonElement>("reminders-open");
    disable(opener, state.accountBusy || state.importing);
    if (opener.title !== label) opener.title = label;
    attr(opener, "aria-label", label);
    if (!dialog.open) return;
    if (state.commandOpen) surfaceSeenOpen = true;
    else if (holdsSurface && surfaceSeenOpen) {
      reset();
      return;
    }
    renderAccounts(state);
    renderList(state);
    text(
      $("reminder-storage-error"),
      state.reminders?.unavailable === true
        ? state.reminders?.error ||
            "Chưa mở được kho nhắc việc. Hãy mở lại Gom để thử lại."
        : "",
    );
    const storageError = $("reminder-storage-error");
    const errorTabIndex = storageError.textContent ? 0 : -1;
    if (storageError.tabIndex !== errorTabIndex)
      storageError.tabIndex = errorTabIndex;
    text(
      $("reminder-private-hint"),
      state.privateSpace?.unlocked
        ? "Nhắc việc kín chỉ hiện tại đây, không gửi thông báo hệ điều hành."
        : state.preferences.paused
          ? "Thông báo đang tạm dừng. Việc đến hạn vẫn hiện ở đây; bật lại thông báo để nhận nhắc."
          : "Gom nhắc khi còn chạy, kể cả lúc ẩn cửa sổ. Việc quá hạn hiện lại khi mở ứng dụng.",
    );
  }
  async function open() {
    if (!options.getState()) return;
    if (dialog.open || document.querySelector("dialog[open]")) return;
    const token = ++generation;
    const lockVersion = epoch();
    lastSpace = space(options.getState());
    filter = "pending";
    editor = undefined;
    form.reset();
    noteCount();
    attr(note, "aria-invalid", "false");
    accountSignature = listSignature = "";
    due.value = localInput(futureDefault());
    feedback("");
    text($("reminder-error"), "");
    holdsSurface = true;
    surfaceSeenOpen = false;
    surfaceLockVersion = lockVersion;
    dialog.showModal();
    sync(options.getState());
    try {
      const result = await window.desktop.reminder("surface", {
        open: true,
        lockVersion,
      });
      if (!current(token, lockVersion)) return;
      if (!result.ok) {
        reset();
        void window.desktop
          .reminder("surface", { open: false, lockVersion })
          .catch(() => {});
        text(
          $("account-feedback"),
          result.message || "Chưa mở được nhắc việc.",
        );
        return;
      }
      if (options.getState().commandOpen) surfaceSeenOpen = true;
      if (!note.disabled) note.focus();
    } catch {
      if (current(token, lockVersion)) {
        reset();
        void window.desktop
          .reminder("surface", { open: false, lockVersion })
          .catch(() => {});
        text($("account-feedback"), "Chưa mở được nhắc việc. Bạn thử lại nhé.");
      }
    }
  }
  async function act(
    action: "open" | "snooze" | "complete" | "remove",
    id: string,
    customDueAt?: number,
  ) {
    if (busy) return;
    const token = generation;
    const lockVersion = epoch();
    if (action === "open") {
      const release = holdsSurface;
      reset();
      const closedToken = generation;
      try {
        if (release)
          await window.desktop.reminder("surface", {
            open: false,
            lockVersion,
          });
        if (!current(closedToken, lockVersion)) return;
        const result = await window.desktop.reminder("open", {
          id,
          lockVersion,
        });
        if (!current(closedToken, lockVersion) || result.ok) return;
        const reopenToken = generation + 1;
        await open();
        if (current(reopenToken, lockVersion) && dialog.open)
          feedback(result.message || "Chưa mở được tài khoản của nhắc việc.");
      } catch {
        if (!current(closedToken, lockVersion)) return;
        const reopenToken = generation + 1;
        await open();
        if (current(reopenToken, lockVersion) && dialog.open)
          feedback("Chưa mở được tài khoản. Bạn thử lại nhé.");
      }
      return;
    }
    busy = true;
    feedback("");
    sync(options.getState());
    try {
      const result = await window.desktop.reminder(action, {
        id,
        lockVersion,
        ...(action === "snooze"
          ? { dueAt: customDueAt ?? Date.now() + 15 * minute }
          : {}),
      });
      if (!current(token, lockVersion)) return;
      if (result.ok && customDueAt !== undefined) editor = undefined;
      feedback(
        result.ok
          ? action === "complete"
            ? "Đã hoàn tất nhắc việc."
            : action === "remove"
              ? "Đã xóa nhắc việc."
              : customDueAt !== undefined
                ? "Đã đổi giờ nhắc việc."
                : "Đã dời nhắc việc thêm 15 phút."
          : result.message || "Chưa cập nhật được nhắc việc.",
      );
    } catch {
      if (current(token, lockVersion))
        feedback("Chưa cập nhật được nhắc việc. Bạn thử lại nhé.");
    } finally {
      if (current(token, lockVersion)) {
        busy = false;
        sync(options.getState());
        if (editor && customDueAt !== undefined)
          $("reminder-reschedule-due").focus();
        else focusAction(id, customDueAt !== undefined ? "reschedule" : action);
      }
    }
  }
  $("reminders-open").onclick = () => void open();
  $("reminders-close").onclick = close;
  dialog.oncancel = (event) => {
    event.preventDefault();
    close();
  };
  dialog.onclose = () => {
    if (!dialog.open && holdsSurface) close();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) close();
  });
  for (const [index, value] of (["pending", "done"] as const).entries()) {
    const control = $("reminder-" + value);
    control.onclick = () => {
      filter = value;
      editor = undefined;
      sync(options.getState());
    };
    control.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      filter =
        event.key === "Home"
          ? "pending"
          : event.key === "End"
            ? "done"
            : index === 0
              ? "done"
              : "pending";
      editor = undefined;
      sync(options.getState());
      $("reminder-" + filter).focus();
    };
  }
  for (const control of form.querySelectorAll<HTMLButtonElement>(
    "[data-reminder-quick]",
  ))
    control.onclick = () => {
      const value = control.dataset.reminderQuick;
      if (value === "tomorrow") {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
        due.value = localInput(date.getTime());
      } else
        due.value = localInput(
          Math.ceil((Date.now() + Number(value) * minute) / minute) * minute,
        );
      text($("reminder-error"), "");
    };
  note.oninput = () => {
    noteCount();
    const tooLong = Array.from(note.value.trim()).length > 500;
    attr(note, "aria-invalid", String(tooLong));
    text($("reminder-error"), tooLong ? "Ghi chú tối đa 500 ký tự." : "");
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const dueAt = futureTime(due.value);
    const value = note.value.trim();
    if (!value || Array.from(value).length > 500) {
      text(
        $("reminder-error"),
        value
          ? "Ghi chú tối đa 500 ký tự."
          : "Thêm ghi chú để nhớ việc cần xử lý.",
      );
      attr(note, "aria-invalid", "true");
      note.focus();
      return;
    }
    if (dueAt === null) {
      text(
        $("reminder-error"),
        "Chọn giờ hợp lệ trong tương lai, tối đa một năm tới.",
      );
      due.focus();
      return;
    }
    const token = generation;
    const lockVersion = epoch();
    const accountId = account.value;
    busy = true;
    text($("reminder-error"), "");
    feedback("");
    sync(options.getState());
    try {
      const result = await window.desktop.reminder("add", {
        accountId,
        note: value,
        dueAt,
        lockVersion,
      });
      if (!current(token, lockVersion)) return;
      if (!result.ok) {
        text($("reminder-error"), result.message || "Chưa lưu được nhắc việc.");
        return;
      }
      note.value = "";
      noteCount();
      due.value = localInput(futureDefault());
      filter = "pending";
      feedback("Đã lưu nhắc việc.");
    } catch {
      if (current(token, lockVersion))
        text($("reminder-error"), "Chưa lưu được nhắc việc. Bạn thử lại nhé.");
    } finally {
      if (current(token, lockVersion)) {
        busy = false;
        sync(options.getState());
      }
    }
  };
  setInterval(() => {
    const state = options.getState();
    if (state) sync(state);
  }, 15_000);
  return { open, reset, isOpen: () => dialog.open, sync };
}
