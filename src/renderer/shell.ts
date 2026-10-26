import { createCommandPalette } from "./command.ts";
import {
  PROVIDERS,
  PROVIDER_ORDER,
  type Account,
  type AccountId,
  type AccountResult,
  type AppState,
  type DesktopBridge,
  type ProviderId,
  type NotificationChoice,
} from "../shared.ts";
declare global {
  interface Window {
    desktop: DesktopBridge;
  }
}
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const labels = {
  idle: "Chưa mở",
  loading: "Đang kết nối…",
  ready: "Sẵn sàng",
  "needs-login": "Đăng nhập để bắt đầu",
  authenticated: "Đã kết nối · Phiên riêng trên máy",
  error: "Chưa kết nối được · Thử tải lại",
};
const icons = {
  zalo: "zalo.png",
  messenger: "messenger.svg",
  telegram: "telegram.svg",
};
let current: AppState;
let activeTab = "accounts";
let accountFilter = "all";
let signature = "";
let editing: AccountId | null = null;
let lastPanel = "";
const settingsSections: Record<string, { title: string; description: string }> =
  {
    accounts: {
      title: "Tài khoản",
      description: "Tất cả kết nối, gọn trong một nơi.",
    },
    appearance: {
      title: "Giao diện",
      description: "Một không gian vừa mắt, cả ngày lẫn đêm.",
    },
    notifications: {
      title: "Thông báo",
      description: "Giữ kết nối theo cách của anh.",
    },
    macos: {
      title: "macOS",
      description: "Những tùy chọn giúp Gom thân quen trên Mac.",
    },
    updates: {
      title: "Cập nhật",
      description: "Phiên bản mới, khi anh sẵn sàng.",
    },
  };
function setProperty<T, K extends keyof T>(node: T, key: K, value: T[K]) {
  if (node[key] !== value) node[key] = value;
}
function setAttribute(node: Element, name: string, value: string) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
function setClass(node: Element, name: string, enabled: boolean) {
  if (node.classList.contains(name) !== enabled)
    node.classList.toggle(name, enabled);
}
function setStyle(node: HTMLElement, name: string, value = "") {
  if (node.style.getPropertyValue(name) === value) return;
  if (value) node.style.setProperty(name, value);
  else node.style.removeProperty(name);
}
function nameOf(a: Account) {
  return `${PROVIDERS[a.provider].label} · ${a.name}`;
}
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  return e;
}
function action(
  text: string,
  title: string,
  click: () => void,
  className = "secondary",
) {
  const b = element("button", className, text);
  b.type = "button";
  b.title = title;
  b.setAttribute("aria-label", title);
  b.onclick = click;
  return b;
}
function icon(name: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#i-" + name);
  svg.append(use);
  return svg;
}
function avatar(a: Account) {
  const e = element("span", "account-avatar avatar-" + a.provider, a.avatar);
  const logo = element("img", "avatar-provider");
  logo.src = "logos/" + icons[a.provider];
  logo.alt = "";
  e.append(logo);
  return e;
}
function iconAction(name: string, title: string, click: () => void) {
  const b = action("", title, click, "icon-button");
  b.append(icon(name));
  return b;
}
function applyAccountFilter() {
  for (const row of document.querySelectorAll<HTMLElement>(
    "#account-manager [data-provider]",
  ))
    row.hidden =
      accountFilter !== "all" && row.dataset.provider !== accountFilter;
  for (const b of document.querySelectorAll<HTMLElement>("[data-filter]"))
    b.setAttribute("aria-pressed", String(b.dataset.filter === accountFilter));
  $("account-empty").hidden = !!document.querySelector(
    "#account-manager [data-provider]:not([hidden])",
  );
}
function showTab(tab: string) {
  const section = settingsSections[tab];
  if (!section) return;
  const changed = activeTab !== tab;
  activeTab = tab;
  for (const b of document.querySelectorAll<HTMLElement>("[data-tab]")) {
    const selected = b.dataset.tab === tab;
    setAttribute(b, "aria-selected", String(selected));
    setProperty(b, "tabIndex", selected ? 0 : -1);
  }
  for (const pane of document.querySelectorAll<HTMLElement>(".settings-pane"))
    setProperty(pane, "hidden", pane.id !== "tab-" + tab);
  setProperty($("settings-title"), "textContent", section.title);
  setProperty($("settings-description"), "textContent", section.description);
  setProperty($("add-account-settings"), "hidden", tab !== "accounts");
  if (changed) {
    $("settings-panel").scrollTop = 0;
    for (const menu of document.querySelectorAll<HTMLDetailsElement>(
      ".more-menu[open]",
    ))
      menu.open = false;
  }
}

let updateCheckedAt: number | null | undefined;
function renderUpdates(state: AppState) {
  const updates = state.updates;
  const available = updates?.phase === "available";
  setClass($("settings"), "has-update", available);
  setProperty(
    $("settings"),
    "title",
    available ? "Cài đặt · Có bản cập nhật mới" : "Cài đặt (⌘,)",
  );
  setAttribute(
    $("settings"),
    "aria-label",
    available ? "Cài đặt · Có bản cập nhật mới" : "Cài đặt",
  );
  setProperty(
    $<HTMLInputElement>("auto-check-updates"),
    "checked",
    state.preferences.updateChecks !== false,
  );
  setProperty(
    $("update-current"),
    "textContent",
    updates?.currentVersion || state.version,
  );
  if (!updates) return;
  setProperty($("update-latest-row"), "hidden", !updates.latestVersion);
  setProperty($("update-latest"), "textContent", updates.latestVersion || "");
  setProperty($("update-message"), "textContent", updates.message);
  setAttribute($("update-message"), "data-phase", updates.phase);
  if (updateCheckedAt !== updates.checkedAt) {
    updateCheckedAt = updates.checkedAt;
    setProperty(
      $("update-checked"),
      "textContent",
      updates.checkedAt === null
        ? "Chưa kiểm tra bản mới."
        : "Lần kiểm tra gần nhất: " +
            new Date(updates.checkedAt).toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
    );
  }
  const checking = updates.phase === "checking";
  setProperty($<HTMLButtonElement>("check-updates"), "disabled", checking);
  setProperty(
    $("check-updates"),
    "textContent",
    checking ? "Đang kiểm tra…" : "Kiểm tra cập nhật",
  );
  setProperty(
    $("download-update"),
    "hidden",
    !available || !updates.releaseUrl,
  );
  const notes = updates.releaseNotes.slice(0, 12000);
  setProperty($("update-notes-container"), "hidden", !notes);
  setProperty($("update-notes"), "textContent", notes);
}

async function accountAction(promise: Promise<AccountResult>) {
  try {
    const result = await promise;
    $("account-feedback").textContent = result.ok
      ? "Đã cập nhật tài khoản."
      : result.message || "Chưa cập nhật được tài khoản.";
  } catch {
    $("account-feedback").textContent =
      "Chưa cập nhật được tài khoản. Anh thử lại nhé.";
  }
}
async function openEditor(a?: Account, provider?: ProviderId) {
  await window.desktop.accountEditor(true);
  render(await window.desktop.state());
  editing = a?.id ?? null;
  $("account-editor-title").textContent = a
    ? "Đổi tên tài khoản"
    : "Thêm tài khoản";
  $("account-editor-save").textContent = a ? "Lưu thay đổi" : "Thêm tài khoản";
  const select = $<HTMLSelectElement>("account-provider");
  select.value =
    a?.provider ||
    provider ||
    current.accounts.find((a) => a.id === current.active)!.provider;
  select.disabled = !!a;
  $<HTMLInputElement>("account-name").value = a?.name || "";
  $<HTMLInputElement>("account-avatar").value = a?.avatar || "";
  $("account-editor-error").textContent = "";
  const dialog = $<HTMLDialogElement>("account-editor");
  if (!dialog.open) dialog.showModal();
  $("account-name").focus();
}
function rebuildAccounts(state: AppState) {
  const key = JSON.stringify([state.accounts, state.presentation.pinned]);
  if (key === signature) return false;
  signature = key;
  const focused = document.activeElement as HTMLElement | null;
  const focusId = focused?.id;
  const focusKey = focused?.dataset.focus;
  const openMenus = [
    ...document.querySelectorAll<HTMLDetailsElement>(".more-menu[open]"),
  ].map((e) => e.dataset.accountId);
  $("account-manager").replaceChildren();
  $("notification-providers").replaceChildren();
  $("archived-accounts").replaceChildren();
  for (const provider of PROVIDER_ORDER) {
    const peers = state.accounts.filter(
      (a) => a.provider === provider && !a.archived,
    );
    for (const [index, a] of peers.entries()) {
      const row = element("div", "account-manage-row");
      row.dataset.accountId = a.id;
      row.dataset.provider = provider;
      const identity = element("div", "account-identity");
      const label = element("div");
      const name = element("strong", "", a.name);
      name.title = a.name;
      const status = element("span", "account-status");
      status.id = "account-status-" + a.id;
      const meta = element("div", "account-meta");
      meta.append(element("small", "", PROVIDERS[provider].label), status);
      label.append(name, meta);
      identity.append(avatar(a), label);
      const tools = element("div", "account-actions");
      const pin = iconAction(
        "pin",
        (state.presentation.pinned.includes(a.id) ? "Bỏ ghim " : "Ghim ") +
          nameOf(a),
        () => void window.desktop.pinAccount(a.id),
      );
      pin.classList.toggle("pinned", state.presentation.pinned.includes(a.id));
      pin.setAttribute(
        "aria-pressed",
        String(state.presentation.pinned.includes(a.id)),
      );
      pin.dataset.focus = "pin-" + a.id;
      const rename = iconAction(
        "compose",
        "Đổi tên " + nameOf(a),
        () => void openEditor(a),
      );
      rename.dataset.focus = "edit-" + a.id;
      tools.append(
        action(
          "Mở",
          "Mở " + nameOf(a),
          () => void window.desktop.activate(a.id),
        ),
        pin,
        rename,
      );
      const more = element("details", "more-menu");
      more.name = "account-actions";
      more.dataset.accountId = a.id;
      const summary = element("summary");
      summary.title = "Thao tác khác · " + nameOf(a);
      summary.setAttribute("aria-label", summary.title);
      summary.dataset.focus = "more-" + a.id;
      summary.append(icon("more"));
      const menu = element("div");
      more.append(summary, menu);
      more.open = openMenus.includes(a.id);
      const up = action(
        "Đưa lên trên",
        "Đưa lên " + nameOf(a),
        () => void accountAction(window.desktop.moveAccount(a.id, -1)),
      );
      up.dataset.boundary = String(index === 0);
      const down = action(
        "Đưa xuống dưới",
        "Đưa xuống " + nameOf(a),
        () => void accountAction(window.desktop.moveAccount(a.id, 1)),
      );
      down.dataset.boundary = String(index === peers.length - 1);
      const hide = action(
        "Gỡ khỏi danh sách",
        "Gỡ " + nameOf(a) + " khỏi danh sách",
        () => void accountAction(window.desktop.archiveAccount(a.id)),
      );
      hide.dataset.last = String(
        state.accounts.filter((a) => !a.archived).length === 1,
      );
      for (const [i, b] of [up, down, hide].entries())
        b.dataset.focus = "account-" + a.id + "-" + i;
      menu.append(up, down, hide);
      menu.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest("button:not(:disabled)")) {
          more.open = false;
          summary.focus();
        }
      });
      tools.append(more);
      row.append(identity, tools);
      $("account-manager").append(row);
      const nrow = element("div", "notification-row");
      const nlabel = element("label");
      nlabel.append(
        element("strong", "", a.name),
        element("small", "", PROVIDERS[provider].label),
      );
      nlabel.htmlFor = "notification-" + a.id;
      const select = element("select");
      select.id = "notification-" + a.id;
      select.setAttribute("aria-label", "Thông báo " + nameOf(a));
      for (const [value, text] of [
        ["ask", "Hỏi lần đầu"],
        ["allow", "Cho phép"],
        ["mute", "Tắt thông báo"],
      ]) {
        const o = element("option", "", text);
        o.value = value;
        select.append(o);
      }
      select.onchange = () =>
        void window.desktop.setNotification(
          a.id,
          select.value as NotificationChoice,
        );
      const test = action(
        "Thử",
        "Thử thông báo " + nameOf(a),
        () => void window.desktop.testNotification(a.id),
      );
      test.id = "test-" + a.id;
      nrow.append(avatar(a), nlabel, select, test);
      $("notification-providers").append(nrow);
    }
  }
  const archived = state.accounts.filter((a) => a.archived);
  if (archived.length) {
    $("archived-accounts").append(
      element("h4", "", "Đã gỡ khỏi danh sách"),
      element(
        "p",
        "hint",
        "Các phiên vẫn được giữ trên máy; khôi phục để dùng lại.",
      ),
    );
    for (const a of archived) {
      const row = element("div", "account-manage-row archived");
      row.append(
        element("span", "", nameOf(a)),
        action(
          "Khôi phục",
          "Khôi phục " + nameOf(a),
          () => void accountAction(window.desktop.restoreAccount(a.id)),
        ),
      );
      $("archived-accounts").append(row);
    }
  }
  const target = $<HTMLSelectElement>("messenger-target");
  const selected = target.value;
  target.replaceChildren(
    ...state.accounts
      .filter((a) => a.provider === "messenger" && !a.archived)
      .map((a) => {
        const option = element("option", "", a.name);
        option.value = a.id;
        return option;
      }),
  );
  if ([...target.options].some((o) => o.value === selected))
    target.value = selected;
  applyAccountFilter();
  const nextFocus = focusId
    ? document.getElementById(focusId)
    : focusKey
      ? [...document.querySelectorAll<HTMLElement>("[data-focus]")].find(
          (e) => e.dataset.focus === focusKey,
        )
      : null;
  nextFocus?.focus({ preventScroll: true });
  return true;
}
let pickerSignature = "";
function renderToolbar(state: AppState, active: Account) {
  for (const [index, provider] of PROVIDER_ORDER.entries()) {
    const tab = $("platform-" + provider);
    const selected = active.provider === provider;
    const peers = state.accounts.filter(
      (a) => a.provider === provider && !a.archived,
    );
    const unread = peers.some((a) => (state.unread[a.id]?.count ?? 0) > 0);
    setAttribute(tab, "aria-selected", String(selected));
    setProperty(tab, "tabIndex", selected ? 0 : -1);
    setProperty(
      tab.querySelector<HTMLElement>(".platform-unread")!,
      "hidden",
      !unread,
    );
    setProperty(
      tab,
      "title",
      `${PROVIDERS[provider].label} (⌘${index + 1})${unread ? " · Có tin chưa đọc" : ""}`,
    );
    setAttribute(
      tab,
      "aria-label",
      `${PROVIDERS[provider].label}${unread ? " · Có tin chưa đọc" : ""}`,
    );
  }
  const peers = state.accounts.filter(
    (a) => a.provider === active.provider && !a.archived,
  );
  const key = JSON.stringify(peers.map((a) => [a.id, a.name]));
  const select = $<HTMLSelectElement>("account-select");
  if (key !== pickerSignature) {
    pickerSignature = key;
    select.replaceChildren(
      ...peers.map((a) => {
        const option = element("option", "", a.name);
        option.value = a.id;
        return option;
      }),
    );
  }
  setProperty(select, "value", active.id);
  setProperty(
    select,
    "title",
    nameOf(active) + " · " + labels[state.statuses[active.id]],
  );
  setProperty(
    $("active-account-status"),
    "className",
    "account-status dot " + state.statuses[active.id],
  );
  setProperty(
    $("add-account-toolbar"),
    "title",
    "Thêm tài khoản " + PROVIDERS[active.provider].label,
  );
}
async function selectProvider(provider: ProviderId, focusPage = true) {
  const hasAccount = current.accounts.some(
    (a) => a.provider === provider && !a.archived,
  );
  if (
    !hasAccount &&
    !current.accountBusy &&
    !current.importing &&
    !current.catalogWarning
  )
    await openEditor(undefined, provider);
  else await window.desktop.activateProvider(provider, focusPage);
}
for (const [index, provider] of PROVIDER_ORDER.entries()) {
  const tab = $("platform-" + provider);
  tab.onclick = () => void selectProvider(provider);
  tab.onkeydown = (event) => {
    if (event.isComposing || event.altKey || event.metaKey || event.ctrlKey)
      return;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % PROVIDER_ORDER.length
        : event.key === "ArrowLeft"
          ? (index + PROVIDER_ORDER.length - 1) % PROVIDER_ORDER.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? PROVIDER_ORDER.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    $("platform-" + PROVIDER_ORDER[next]).focus();
    void selectProvider(PROVIDER_ORDER[next], false);
  };
}
$("account-select").onchange = (event) =>
  void window.desktop.activate((event.target as HTMLSelectElement).value);
$("navigation-menu").onclick = () => void window.desktop.navigationMenu();
function render(state: AppState) {
  const previous = current;
  const active = state.accounts.find((a) => a.id === state.active)!;
  current = state;
  const rebuilt = rebuildAccounts(state);
  const settings = state.panel === "settings";
  const refreshSettings = settings || !previous || rebuilt;
  const root = document.documentElement,
    choice = state.presentation.theme;
  const theme = choice === "platform" ? state.themes[state.active] : null;
  const mode =
    theme?.mode ||
    (choice === "light" || choice === "dark"
      ? choice
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
  const themeChanged = root.dataset.theme !== mode;
  setAttribute(root, "data-theme", mode);
  for (const [key, value] of Object.entries({
    cream: theme?.background,
    paper: theme?.surface,
    line: theme?.line,
    ink: theme?.text,
    muted: theme?.muted,
  }))
    setStyle(root, "--" + key, value);
  if (refreshSettings) {
    setProperty($<HTMLSelectElement>("theme-mode"), "value", choice);
    for (const b of document.querySelectorAll<HTMLElement>(
      "[data-theme-choice]",
    ))
      setAttribute(b, "aria-pressed", String(b.dataset.themeChoice === choice));
  }
  if (themeChanged || !previous)
    $("theme-toggle").replaceChildren(icon(mode === "dark" ? "sun" : "moon"));
  setProperty(
    $("theme-toggle"),
    "title",
    mode === "dark" ? "Chuyển sang sáng" : "Chuyển sang tối",
  );
  renderToolbar(state, active);
  renderUpdates(state);
  for (const a of state.accounts.filter((a) => !a.archived)) {
    if (refreshSettings) {
      const accountStatus = $("account-status-" + a.id);
      setAttribute(accountStatus, "data-status", state.statuses[a.id]);
      setProperty(
        accountStatus,
        "textContent",
        state.statuses[a.id] === "authenticated"
          ? "● Đã kết nối"
          : state.statuses[a.id] === "needs-login"
            ? "Cần đăng nhập"
            : state.connections[a.id].phase === "offline"
              ? "Ngoại tuyến"
              : labels[state.statuses[a.id]].split(" · ")[0],
      );
      setClass(
        accountStatus,
        "connected",
        state.statuses[a.id] === "authenticated",
      );
      setProperty(
        $<HTMLSelectElement>("notification-" + a.id),
        "value",
        state.preferences.notifications[a.id],
      );
      setProperty(
        $<HTMLButtonElement>("test-" + a.id),
        "disabled",
        state.preferences.paused ||
          state.preferences.notifications[a.id] !== "allow",
      );
    }
  }
  setClass($("settings"), "active", settings);
  setProperty(
    $("account-count"),
    "textContent",
    String(state.accounts.filter((a) => !a.archived).length),
  );
  if (refreshSettings)
    setProperty(
      $("connected-count"),
      "textContent",
      state.accounts.filter(
        (a) => !a.archived && state.statuses[a.id] === "authenticated",
      ).length + " tài khoản đã kết nối",
    );
  const c = state.connections[state.active];
  setProperty(
    $("subtitle"),
    "textContent",
    settings
      ? "Mỗi tài khoản một phiên riêng trên máy"
      : c.phase === "offline"
        ? "Máy đang ngoại tuyến · Phiên đăng nhập vẫn được giữ"
        : c.phase === "error"
          ? "Kết nối gián đoạn · Thử lại riêng tài khoản này"
          : labels[state.statuses[state.active]],
  );
  const failed = !settings && !state.commandOpen && !!c.reason;
  setProperty($("connection-panel"), "hidden", !failed);
  if (failed) {
    setProperty(
      $("connection-title"),
      "textContent",
      c.reason === "crashed"
        ? "Trang vừa dừng hoạt động."
        : c.reason === "blocked"
          ? "Liên kết chuyển hướng chưa được hỗ trợ."
          : "Chưa kết nối được tài khoản.",
    );
    setProperty(
      $("connection-detail"),
      "textContent",
      c.phase === "offline"
        ? "Anh kết nối lại mạng; app sẽ kiểm tra lại khi có mạng."
        : c.retryAt
          ? "App đang tự thử lại có giới hạn. Các tài khoản khác vẫn hoạt động bình thường."
          : "Anh có thể thử lại hoặc về trang đầu. App không xóa phiên đăng nhập.",
    );
  }
  if (refreshSettings) {
    setProperty(
      $<HTMLInputElement>("open-at-login"),
      "checked",
      state.openAtLogin,
    );
    setProperty(
      $<HTMLInputElement>("open-at-login"),
      "disabled",
      !state.startupAvailable,
    );
    setProperty(
      $("startup-hint"),
      "textContent",
      state.startupAvailable
        ? "Có thể quản lý thêm trong Cài đặt hệ thống → Cài đặt chung → Mục đăng nhập."
        : "Tùy chọn này dùng trong bản app đã đóng gói.",
    );
    setProperty(
      $<HTMLInputElement>("global-shortcut"),
      "checked",
      state.preferences.shortcut,
    );
    setProperty(
      $<HTMLInputElement>("pause-notifications"),
      "checked",
      state.preferences.paused,
    );
    setProperty(
      $("notification-status"),
      "textContent",
      state.notificationStatus,
    );
    setProperty($("notice"), "textContent", state.notice);
    setProperty($("version"), "textContent", state.version);
    const select = $<HTMLSelectElement>("profiles");
    if (
      JSON.stringify([...select.options].map((o) => o.value)) !==
      JSON.stringify(state.profiles.map((p) => p.id))
    )
      select.replaceChildren(
        ...state.profiles.map((p) => {
          const o = element(
            "option",
            "",
            p.email ? `${p.label} · ${p.email}` : p.label,
          );
          o.value = p.id;
          return o;
        }),
      );
    if (settings && lastPanel !== "settings" && active.provider === "messenger")
      setProperty($<HTMLSelectElement>("messenger-target"), "value", active.id);
    const button = $<HTMLButtonElement>("import");
    setProperty(
      button,
      "disabled",
      state.importing ||
        state.accountBusy ||
        !state.profiles.length ||
        !$<HTMLSelectElement>("messenger-target").value,
    );
    setProperty(
      button,
      "textContent",
      state.importing ? "Đang kiểm tra phiên…" : "Dùng phiên có sẵn",
    );
  }
  setProperty($("settings-panel"), "hidden", !settings);
  setProperty(
    $("service-loading"),
    "hidden",
    settings || failed || state.commandOpen,
  );
  setProperty($("catalog-warning"), "textContent", state.catalogWarning);
  setProperty($("catalog-warning"), "hidden", !state.catalogWarning);
  if (
    rebuilt ||
    previous?.accountBusy !== state.accountBusy ||
    previous?.importing !== state.importing ||
    previous?.catalogWarning !== state.catalogWarning
  )
    for (const b of document.querySelectorAll<HTMLButtonElement>(
      ".account-actions button,#archived-accounts button,#add-account-settings,#add-account-toolbar,#account-editor-save",
    ))
      setProperty(
        b,
        "disabled",
        state.accountBusy ||
          state.importing ||
          !!state.catalogWarning ||
          b.dataset.boundary === "true" ||
          b.dataset.last === "true",
      );
  lastPanel = state.panel;
  command.sync(state);
  if (!previous) showTab(activeTab);
}
$("settings").onclick = () => {
  if (current.updates?.phase === "available") showTab("updates");
  void window.desktop.settings();
};
$("close-settings").onclick = () =>
  void window.desktop.activate(current.active);
$("check-updates").onclick = () =>
  void window.desktop.checkUpdates().catch(() => {
    setProperty(
      $("update-message"),
      "textContent",
      "Chưa kiểm tra được bản mới. Anh thử lại nhé.",
    );
  });
$("download-update").onclick = () =>
  void window.desktop.openUpdateDownload().catch(() => {
    setProperty(
      $("update-message"),
      "textContent",
      "Chưa mở được trang tải. Anh thử lại nhé.",
    );
  });
$("auto-check-updates").onchange = (event) =>
  void window.desktop.setPreference(
    "updateChecks",
    (event.target as HTMLInputElement).checked,
  );
$("import").onclick = () =>
  void window.desktop.importMessenger(
    $<HTMLSelectElement>("profiles").value,
    $<HTMLSelectElement>("messenger-target").value,
  );
$("retry-connection").onclick = () => void window.desktop.reload();
$("open-at-login").onchange = (e) =>
  void window.desktop.setPreference(
    "openAtLogin",
    (e.target as HTMLInputElement).checked,
  );
$("global-shortcut").onchange = (e) =>
  void window.desktop.setPreference(
    "shortcut",
    (e.target as HTMLInputElement).checked,
  );
$("pause-notifications").onchange = (e) =>
  void window.desktop.setPreference(
    "paused",
    (e.target as HTMLInputElement).checked,
  );
$("notification-settings").onclick = () =>
  void window.desktop.notificationSettings();
$("add-account-toolbar").onclick = () => void openEditor();
$("add-account-settings").onclick = () => void openEditor();
$("account-editor").onclose = () => void window.desktop.accountEditor(false);
$("account-editor-cancel").onclick = () =>
  $<HTMLDialogElement>("account-editor").close();
$("account-form").onsubmit = async (event) => {
  event.preventDefault();
  const name = $<HTMLInputElement>("account-name").value,
    avatar = $<HTMLInputElement>("account-avatar").value;
  const button = $<HTMLButtonElement>("account-editor-save");
  button.disabled = true;
  try {
    const result = editing
      ? await window.desktop.editAccount(editing, name, avatar)
      : await window.desktop.addAccount(
          $<HTMLSelectElement>("account-provider").value as ProviderId,
          name,
          avatar,
        );
    if (!result.ok) {
      $("account-editor-error").textContent =
        result.message || "Chưa lưu được tài khoản.";
      return;
    }
    const wasNew = !editing;
    $<HTMLDialogElement>("account-editor").close();
    await window.desktop.accountEditor(false);
    if (wasNew && result.accountId)
      await window.desktop.activate(result.accountId);
  } catch {
    $("account-editor-error").textContent =
      "Chưa lưu được tài khoản. Anh thử lại nhé.";
  } finally {
    button.disabled = false;
  }
};
const command = createCommandPalette({
  getState: () => current,
  avatar,
  icon,
  settings: (tab) => {
    showTab(tab);
    void window.desktop.settings();
  },
});
function requestCommand() {
  if ($<HTMLDialogElement>("account-editor").open) return;
  void window.desktop.command(!current.commandOpen);
}
window.desktop.commandRequested(requestCommand);
window.desktop.updatesRequested?.(() => {
  if (!$<HTMLDialogElement>("account-editor").open) showTab("updates");
});
$("quick-switch").onclick = requestCommand;
$("theme-toggle").onclick = () =>
  void window.desktop.setTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  );
$<HTMLSelectElement>("theme-mode").onchange = (e) =>
  void window.desktop.setTheme(
    (e.target as HTMLSelectElement).value as AppState["presentation"]["theme"],
  );
for (const b of document.querySelectorAll<HTMLElement>("[data-theme-choice]"))
  b.onclick = () =>
    void window.desktop.setTheme(b.dataset.themeChoice as "light" | "dark");
const settingsTabs = [...document.querySelectorAll<HTMLElement>("[data-tab]")];
for (const [index, b] of settingsTabs.entries()) {
  b.onclick = () => showTab(b.dataset.tab!);
  b.onkeydown = (event) => {
    if (event.isComposing || event.altKey || event.metaKey || event.ctrlKey)
      return;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? (index + 1) % settingsTabs.length
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? (index + settingsTabs.length - 1) % settingsTabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? settingsTabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    showTab(settingsTabs[next].dataset.tab!);
    settingsTabs[next].focus({ preventScroll: true });
  };
}
document.addEventListener("pointerdown", (event) => {
  for (const menu of document.querySelectorAll<HTMLDetailsElement>(
    ".more-menu[open]",
  ))
    if (!menu.contains(event.target as Node)) menu.open = false;
});
document.addEventListener("keydown", (event) => {
  if (
    event.key !== "Escape" ||
    event.isComposing ||
    document.querySelector("dialog[open]")
  )
    return;
  for (const menu of document.querySelectorAll<HTMLDetailsElement>(
    ".more-menu[open]",
  )) {
    const restoreFocus = menu.contains(document.activeElement);
    menu.open = false;
    if (restoreFocus) menu.querySelector("summary")?.focus();
    event.preventDefault();
  }
});
for (const b of document.querySelectorAll<HTMLElement>("[data-filter]"))
  b.onclick = () => {
    accountFilter = b.dataset.filter!;
    applyAccountFilter();
  };
window.desktop.changed(render);
void window.desktop.state().then(render);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (current) render(current);
});
