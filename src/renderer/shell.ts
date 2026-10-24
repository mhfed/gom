import { createCommandPalette } from "./command.ts";
import {
  PROVIDERS,
  type Account,
  type AccountId,
  type AccountResult,
  type AppState,
  type UnreadInfo,
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
let lastActive = "";
let lastCollapsed: boolean | undefined;
function unreadLabel(info: UnreadInfo) {
  if (info.count === null) return "Chưa có số chưa đọc từ nền tảng";
  return `${info.approximate ? "Ít nhất " : ""}${info.count} ${info.kind === "conversations" ? "cuộc trò chuyện" : "tin nhắn"} chưa đọc${info.source === "loaded" ? " trong danh sách đã tải" : ""}`;
}
function unreadText(info: UnreadInfo) {
  return info.count === null
    ? "—"
    : info.count > 99
      ? "99+"
      : String(info.count) + (info.approximate ? "+" : "");
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
function sidebarAccount(a: Account) {
  const b = action(
    "",
    "",
    () => void window.desktop.activate(a.id),
    "account-button",
  );
  b.id = "provider-" + a.id;
  const badge = element("span", "unread", "—");
  badge.setAttribute("aria-hidden", "true");
  const dot = element("i", "dot");
  dot.setAttribute("aria-hidden", "true");
  b.append(avatar(a), element("span", "provider-label", a.name), badge, dot);
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
  activeTab = tab;
  for (const b of document.querySelectorAll<HTMLElement>("[data-tab]"))
    b.setAttribute("aria-pressed", String(b.dataset.tab === tab));
  for (const pane of document.querySelectorAll<HTMLElement>(".settings-pane"))
    pane.hidden = pane.id !== "tab-" + tab;
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
  await window.desktop.settings();
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
  $("providers").replaceChildren();
  $("account-manager").replaceChildren();
  $("notification-providers").replaceChildren();
  $("archived-accounts").replaceChildren();
  const pinned = state.accounts.filter(
    (a) => !a.archived && state.presentation.pinned.includes(a.id),
  );
  if (pinned.length) {
    const group = element("div", "provider-group pinned-group");
    const heading = element("div", "provider-group-heading");
    heading.append(
      icon("pin"),
      element("span", "provider-group-label", "ĐÃ GHIM"),
    );
    group.append(heading, ...pinned.map(sidebarAccount));
    $("providers").append(group);
  }
  for (const provider of Object.keys(PROVIDERS) as ProviderId[]) {
    const group = element("div", "provider-group");
    const heading = element("div", "provider-group-heading");
    const logo = element("img", "provider-group-logo");
    logo.src = "logos/" + icons[provider];
    logo.alt = PROVIDERS[provider].label;
    heading.append(
      logo,
      element("span", "provider-group-label", PROVIDERS[provider].label),
      action(
        "+",
        "Thêm tài khoản " + PROVIDERS[provider].label,
        () => void openEditor(undefined, provider),
        "group-add",
      ),
    );
    group.append(heading);
    const peers = state.accounts.filter(
      (a) => a.provider === provider && !a.archived,
    );
    for (const [index, a] of peers.entries()) {
      if (!state.presentation.pinned.includes(a.id))
        group.append(sidebarAccount(a));
      const row = element("div", "account-manage-row");
      row.dataset.accountId = a.id;
      row.dataset.provider = provider;
      const identity = element("div", "account-identity");
      const label = element("div");
      label.append(
        element("strong", "", a.name),
        element("small", "", PROVIDERS[provider].label),
      );
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
        "↑",
        "Đưa lên " + nameOf(a),
        () => void accountAction(window.desktop.moveAccount(a.id, -1)),
      );
      up.dataset.boundary = String(index === 0);
      const down = action(
        "↓",
        "Đưa xuống " + nameOf(a),
        () => void accountAction(window.desktop.moveAccount(a.id, 1)),
      );
      down.dataset.boundary = String(index === peers.length - 1);
      const hide = action(
        "Gỡ",
        "Gỡ " + nameOf(a) + " khỏi sidebar",
        () => void accountAction(window.desktop.archiveAccount(a.id)),
      );
      hide.dataset.last = String(
        state.accounts.filter((a) => !a.archived).length === 1,
      );
      for (const [i, b] of [up, down, hide].entries())
        b.dataset.focus = "account-" + a.id + "-" + i;
      menu.append(up, down, hide);
      tools.append(more);
      const status = element("span", "account-status");
      status.id = "account-status-" + a.id;
      row.append(identity, status, tools);
      $("account-manager").append(row);
      const nrow = element("div", "notification-row");
      const nlabel = element("label", "", nameOf(a));
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
      nrow.append(nlabel, select, test);
      $("notification-providers").append(nrow);
    }
    if (group.querySelector(".account-button")) $("providers").append(group);
  }
  const archived = state.accounts.filter((a) => a.archived);
  if (archived.length) {
    $("archived-accounts").append(
      element("h4", "", "Đã gỡ khỏi sidebar"),
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
function render(state: AppState) {
  const active = state.accounts.find((a) => a.id === state.active)!;
  current = state;
  const rebuilt = rebuildAccounts(state);
  const root = document.documentElement,
    choice = state.presentation.theme;
  const theme = choice === "platform" ? state.themes[state.active] : null;
  root.dataset.theme =
    theme?.mode ||
    (choice === "light" || choice === "dark"
      ? choice
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
  for (const [key, value] of Object.entries({
    cream: theme?.background,
    paper: theme?.surface,
    line: theme?.line,
    ink: theme?.text,
    muted: theme?.muted,
  }))
    if (value) root.style.setProperty("--" + key, value);
    else root.style.removeProperty("--" + key);
  root.style.setProperty(
    "--sidebar-width",
    state.presentation.sidebarWidth + "px",
  );
  $("sidebar-resizer").setAttribute(
    "aria-valuenow",
    String(state.presentation.sidebarWidth),
  );
  $("sidebar-resizer").tabIndex = state.collapsed ? -1 : 0;
  $<HTMLSelectElement>("theme-mode").value = choice;
  for (const b of document.querySelectorAll<HTMLElement>("[data-theme-choice]"))
    b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice));
  $<HTMLInputElement>("compact-setting").checked = state.collapsed;
  $("theme-toggle").replaceChildren(
    icon(root.dataset.theme === "dark" ? "sun" : "moon"),
  );
  $("theme-toggle").title =
    root.dataset.theme === "dark" ? "Chuyển sang sáng" : "Chuyển sang tối";
  document.body.classList.toggle("collapsed", state.collapsed);
  const toggle = $("sidebar-toggle");
  toggle.setAttribute("aria-expanded", String(!state.collapsed));
  toggle.setAttribute(
    "aria-label",
    state.collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar",
  );
  toggle.title = toggle.getAttribute("aria-label")!;
  for (const a of state.accounts.filter((a) => !a.archived)) {
    const b = $("provider-" + a.id);
    b.classList.toggle(
      "active",
      state.active === a.id && state.panel === "service",
    );
    const info = state.unread[a.id],
      badge = b.querySelector<HTMLElement>(".unread")!;
    badge.textContent = unreadText(info);
    badge.classList.toggle("unknown", info.count === null);
    badge.hidden = info.count === 0;
    b.title = nameOf(a) + " · " + unreadLabel(info);
    b.setAttribute("aria-label", b.title);
    b.querySelector("i")!.className = "dot " + state.statuses[a.id];
    b.setAttribute(
      "aria-current",
      state.active === a.id && state.panel === "service" ? "page" : "false",
    );
    const accountStatus = $("account-status-" + a.id);
    accountStatus.textContent =
      state.statuses[a.id] === "authenticated"
        ? "● Đã kết nối"
        : state.statuses[a.id] === "needs-login"
          ? "Cần đăng nhập"
          : state.connections[a.id].phase === "offline"
            ? "Ngoại tuyến"
            : labels[state.statuses[a.id]].split(" · ")[0];
    accountStatus.classList.toggle(
      "connected",
      state.statuses[a.id] === "authenticated",
    );
    $<HTMLSelectElement>("notification-" + a.id).value =
      state.preferences.notifications[a.id];
    $<HTMLButtonElement>("test-" + a.id).disabled =
      state.preferences.paused ||
      state.preferences.notifications[a.id] !== "allow";
  }
  if (
    rebuilt ||
    lastActive !== state.active ||
    lastCollapsed !== state.collapsed
  ) {
    const selected = $("provider-" + state.active);
    queueMicrotask(() => selected?.scrollIntoView({ block: "nearest" }));
  }
  lastActive = state.active;
  lastCollapsed = state.collapsed;
  const settings = state.panel === "settings";
  $("title").textContent = settings ? "Không gian của anh" : nameOf(active);
  $<HTMLImageElement>("header-logo").src = "logos/" + icons[active.provider];
  $("header-logo").hidden = settings;
  $("settings").classList.toggle("active", settings);
  $("account-count").textContent = String(
    state.accounts.filter((a) => !a.archived).length,
  );
  $("connected-count").textContent =
    state.accounts.filter(
      (a) => !a.archived && state.statuses[a.id] === "authenticated",
    ).length + " tài khoản đã kết nối";
  $("subtitle").textContent = settings
    ? "Mỗi tài khoản một phiên riêng trên máy"
    : labels[state.statuses[state.active]];
  const c = state.connections[state.active];
  if (!settings && c.phase === "offline")
    $("subtitle").textContent =
      "Máy đang ngoại tuyến · Phiên đăng nhập vẫn được giữ";
  else if (!settings && c.phase === "error")
    $("subtitle").textContent =
      "Kết nối gián đoạn · Thử lại riêng tài khoản này";
  $("back").toggleAttribute("disabled", !state.canGoBack || settings);
  const failed = !settings && !state.commandOpen && !!c.reason;
  $("connection-panel").hidden = !failed;
  $("connection-title").textContent =
    c.reason === "crashed"
      ? "Trang vừa dừng hoạt động."
      : c.reason === "blocked"
        ? "Liên kết chuyển hướng chưa được hỗ trợ."
        : "Chưa kết nối được tài khoản.";
  $("connection-detail").textContent =
    c.phase === "offline"
      ? "Anh kết nối lại mạng; app sẽ kiểm tra lại khi có mạng."
      : c.retryAt
        ? "App đang tự thử lại có giới hạn. Các tài khoản khác vẫn hoạt động bình thường."
        : "Anh có thể thử lại hoặc về trang đầu. App không xóa phiên đăng nhập.";
  $<HTMLInputElement>("open-at-login").checked = state.openAtLogin;
  $<HTMLInputElement>("open-at-login").disabled = !state.startupAvailable;
  $("startup-hint").textContent = state.startupAvailable
    ? "Có thể quản lý thêm trong Cài đặt hệ thống → Cài đặt chung → Mục đăng nhập."
    : "Tùy chọn này dùng trong bản app đã đóng gói.";
  $<HTMLInputElement>("global-shortcut").checked = state.preferences.shortcut;
  $<HTMLInputElement>("pause-notifications").checked = state.preferences.paused;
  $("notification-status").textContent = state.notificationStatus;
  $("settings-panel").hidden = !settings;
  $("service-loading").hidden = settings || failed || state.commandOpen;
  $("catalog-warning").textContent = state.catalogWarning;
  $("catalog-warning").hidden = !state.catalogWarning;
  for (const b of document.querySelectorAll<HTMLButtonElement>(
    ".account-actions button,#archived-accounts button,.group-add,#add-account-settings,#add-account-sidebar,#account-editor-save",
  ))
    b.disabled =
      state.accountBusy ||
      state.importing ||
      !!state.catalogWarning ||
      b.dataset.boundary === "true" ||
      b.dataset.last === "true";
  $("notice").textContent = state.notice;
  $("version").textContent = state.version;
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
    $<HTMLSelectElement>("messenger-target").value = active.id;
  lastPanel = state.panel;
  const button = $<HTMLButtonElement>("import");
  button.disabled =
    state.importing ||
    state.accountBusy ||
    !state.profiles.length ||
    !$<HTMLSelectElement>("messenger-target").value;
  button.textContent = state.importing
    ? "Đang kiểm tra phiên…"
    : "Dùng phiên có sẵn";
  command.sync(state);
  showTab(activeTab);
}
$("sidebar-toggle").onclick = () => void window.desktop.toggleSidebar();
$("settings").onclick = () => void window.desktop.settings();
$("reload").onclick = () => void window.desktop.reload();
$("browser").onclick = () => void window.desktop.openBrowser();
$("import").onclick = () =>
  void window.desktop.importMessenger(
    $<HTMLSelectElement>("profiles").value,
    $<HTMLSelectElement>("messenger-target").value,
  );
$("back").onclick = () => void window.desktop.back();
$("home").onclick = () => void window.desktop.home();
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
$("add-account-sidebar").onclick = () => void openEditor();
$("add-account-settings").onclick = () => void openEditor();
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
for (const b of document.querySelectorAll<HTMLElement>("[data-tab]"))
  b.onclick = () => showTab(b.dataset.tab!);
for (const b of document.querySelectorAll<HTMLElement>("[data-filter]"))
  b.onclick = () => {
    accountFilter = b.dataset.filter!;
    applyAccountFilter();
  };
$("compact-setting").onchange = () => void window.desktop.toggleSidebar();
$("reset-width").onclick = () => void window.desktop.setSidebarWidth(224);
const resizer = $("sidebar-resizer");
let resizing: number | null = null;
let resizeFrame: number | null = null;
let pendingWidth = 224;
function scheduleWidth(width: number) {
  pendingWidth = Math.max(200, Math.min(300, Math.round(width)));
  if (resizeFrame === null)
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      void window.desktop.setSidebarWidth(pendingWidth);
    });
}
resizer.onpointerdown = (e) => {
  if (e.button !== 0 || current.collapsed) return;
  resizing = e.pointerId;
  resizer.setPointerCapture(e.pointerId);
  document.body.classList.add("resizing");
  e.preventDefault();
  resizer.focus();
};
resizer.onpointermove = (e) => {
  if (resizing === e.pointerId) scheduleWidth(e.clientX);
};
const stopResize = () => {
  resizing = null;
  document.body.classList.remove("resizing");
};
resizer.onpointerup = stopResize;
resizer.onpointercancel = stopResize;
resizer.onlostpointercapture = stopResize;
resizer.ondblclick = () => void window.desktop.setSidebarWidth(224);
resizer.onkeydown = (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  const next =
    e.key === "Home"
      ? 200
      : e.key === "End"
        ? 300
        : current.presentation.sidebarWidth + (e.key === "ArrowLeft" ? -8 : 8);
  void window.desktop.setSidebarWidth(next);
};
window.desktop.changed(render);
void window.desktop.state().then(render);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (current) render(current);
});
