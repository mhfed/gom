import { createCommandPalette } from "./command.ts";
import { createProviderNavigation } from "./provider-navigation.ts";
import {
  type Account,
  type AccountId,
  type AccountResult,
  type AppState,
  type DesktopBridge,
  type ProviderId,
  type ProviderDefinition,
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
const icons: Record<string, string> = {
  zalo: "zalo.png",
  messenger: "messenger.svg",
  telegram: "telegram.svg",
  gmail: "gmail.svg",
  instagram: "instagram.svg",
  discord: "discord.svg",
  slack: "slack.svg",
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
function providerOf(id: ProviderId) {
  return current.providers.find((provider) => provider.id === id)!;
}
function nameOf(a: Account) {
  return `${providerOf(a.provider).label} · ${a.name}`;
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
function providerLogo(provider: ProviderDefinition) {
  if (icons[provider.id]) {
    const logo = element("img", "provider-logo");
    logo.src = "logos/" + icons[provider.id];
    logo.alt = "";
    logo.draggable = false;
    return logo;
  }
  const initials = provider.label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0])
    .join("")
    .toLocaleUpperCase();
  const logo = element("span", "provider-logo provider-initials", initials);
  logo.setAttribute("aria-hidden", "true");
  return logo;
}
function avatar(a: Account) {
  const e = element("span", "account-avatar avatar-" + a.provider, a.avatar);
  const logo = providerLogo(providerOf(a.provider));
  logo.classList.add("avatar-provider");
  e.append(logo);
  return e;
}
function iconAction(name: string, title: string, click: () => void) {
  const b = action("", title, click, "icon-button");
  b.append(icon(name));
  return b;
}
function syncSelectOptions(
  select: HTMLSelectElement,
  choices: { value: string; label: string }[],
  emptyLabel: string,
) {
  const options = choices.length
    ? choices.map(({ value, label }) => [value, label, false] as const)
    : [["", emptyLabel, true] as const];
  if (
    JSON.stringify(
      [...select.options].map((o) => [o.value, o.textContent, o.disabled]),
    ) === JSON.stringify(options)
  )
    return;
  const selected = select.value;
  const trigger = select.querySelector<HTMLButtonElement>(":scope > button");
  select.replaceChildren(
    ...(trigger ? [trigger] : []),
    ...options.map(([value, label, disabled]) => {
      const option = element("option", "", label);
      option.value = value;
      option.disabled = disabled;
      return option;
    }),
  );
  select.value = options.some(([value]) => value === selected)
    ? selected
    : options[0][0];
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
  const hasUpdate = [
    "available",
    "downloading",
    "downloaded",
    "error",
  ].includes(updates?.phase ?? "");
  setClass($("settings"), "has-update", hasUpdate);
  setProperty(
    $("settings"),
    "title",
    hasUpdate ? "Cài đặt · Có bản cập nhật mới" : "Cài đặt (⌘,)",
  );
  setAttribute(
    $("settings"),
    "aria-label",
    hasUpdate ? "Cài đặt · Có bản cập nhật mới" : "Cài đặt",
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
  const updaterBusy = ["downloading", "installing"].includes(updates.phase);
  setProperty(
    $<HTMLButtonElement>("check-updates"),
    "disabled",
    checking || updaterBusy || updates.phase === "downloaded",
  );
  setProperty(
    $("check-updates"),
    "textContent",
    checking ? "Đang kiểm tra…" : "Kiểm tra cập nhật",
  );
  setProperty(
    $("download-update"),
    "hidden",
    !updates.releaseUrl ||
      ![
        "available",
        "downloading",
        "downloaded",
        "installing",
        "error",
      ].includes(updates.phase),
  );
  setProperty($<HTMLButtonElement>("download-update"), "disabled", updaterBusy);
  setProperty(
    $("download-update"),
    "textContent",
    updates.phase === "downloading"
      ? "Đang tải…"
      : updates.phase === "downloaded"
        ? "Khởi động lại để cài"
        : updates.phase === "installing"
          ? "Đang cài đặt…"
          : updates.phase === "error"
            ? "Tải thủ công"
            : updates.automaticInstallAvailable
              ? "Tải và cài đặt"
              : "Tải bản mới",
  );
  const progress = updates.downloadProgress;
  setProperty(
    $("update-progress"),
    "hidden",
    progress === null || updates.phase !== "downloading",
  );
  if (progress !== null) {
    const percent = Math.max(0, Math.min(100, progress));
    setProperty(
      $<HTMLElement>("update-progress-bar").style,
      "width",
      `${percent}%`,
    );
    setAttribute(
      $("update-progress"),
      "aria-valuenow",
      String(Math.floor(percent)),
    );
  }
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
  const name = $<HTMLInputElement>("account-name");
  name.value = a?.name || "";
  name.setCustomValidity("");
  $<HTMLInputElement>("account-avatar").value = a?.avatar || "";
  $("account-editor-error").textContent = "";
  const dialog = $<HTMLDialogElement>("account-editor");
  if (!dialog.open) dialog.showModal();
  $("account-name").focus();
}
function rebuildAccounts(state: AppState) {
  const key = JSON.stringify([
    state.accounts,
    state.presentation.pinned,
    state.providers,
  ]);
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
  syncSelectOptions(
    $<HTMLSelectElement>("account-provider"),
    state.providers.map((provider) => ({
      value: provider.id,
      label: provider.label,
    })),
    "Chưa có nền tảng",
  );
  const filters = [{ id: "all", label: "Tất cả" }, ...state.providers];
  if (state.providers.length > 5) {
    const filter = element("select");
    filter.id = "account-provider-filter";
    filter.setAttribute("aria-label", "Lọc tài khoản theo nền tảng");
    syncSelectOptions(
      filter,
      filters.map(({ id, label }) => ({ value: id, label })),
      "Tất cả",
    );
    filter.value = accountFilter;
    filter.onchange = () => {
      accountFilter = filter.value;
      applyAccountFilter();
    };
    $("platform-filters").replaceChildren(filter);
  } else {
    $("platform-filters").replaceChildren(
      ...filters.map(({ id, label }) => {
        const button = action(
          label,
          "Lọc " + label,
          () => {
            accountFilter = id;
            applyAccountFilter();
          },
          "",
        );
        button.dataset.filter = id;
        return button;
      }),
    );
  }
  for (const { id: provider, label: providerLabel } of state.providers) {
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
      meta.append(element("small", "", providerLabel), status);
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
        element("small", "", providerLabel),
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
        "Gửi thử",
        "Gửi thử thông báo " + nameOf(a),
        () => void window.desktop.testNotification(a.id),
      );
      test.id = "test-" + a.id;
      const hint = element("small", "notification-hint");
      hint.id = "notification-hint-" + a.id;
      test.setAttribute("aria-describedby", hint.id);
      const controls = element("div", "notification-controls");
      controls.append(select, test, hint);
      nrow.append(avatar(a), nlabel, controls);
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
  syncSelectOptions(
    target,
    state.accounts
      .filter((a) => a.provider === "messenger" && !a.archived)
      .map((a) => ({ value: a.id, label: a.name })),
    "Chưa có tài khoản Messenger",
  );
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
const providerNavigation = createProviderNavigation({
  getState: () => current,
  select: selectProvider,
  logo: providerLogo,
  icon,
});
function renderToolbar(state: AppState, active: Account) {
  providerNavigation.sync(state);
  const select = $<HTMLButtonElement>("account-select");
  setProperty(select, "value", active.id);
  setProperty($("account-select-label"), "textContent", active.name);
  setAttribute(select, "aria-label", "Tài khoản đang dùng: " + active.name);
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
    "Thêm tài khoản " + providerOf(active.provider).label,
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
async function openAccountMenu() {
  const picker = $("account-select");
  if (picker.getAttribute("aria-expanded") === "true") return;
  const rect = picker.getBoundingClientRect();
  setAttribute(picker, "aria-expanded", "true");
  try {
    await window.desktop.accountMenu({ x: rect.left, y: rect.bottom + 5 });
  } finally {
    setAttribute(picker, "aria-expanded", "false");
  }
}
$("account-select").onclick = () => void openAccountMenu();
$("account-select").onkeydown = (event) => {
  if (event.isComposing || event.metaKey || event.ctrlKey) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    void openAccountMenu();
  }
};
$("navigation-menu").onclick = () => void window.desktop.navigationMenu();
function render(state: AppState) {
  const previous = current;
  const active = state.accounts.find((a) => a.id === state.active)!;
  current = state;
  const rebuilt = rebuildAccounts(state);
  const settings = state.panel === "settings";
  const library = state.panel === "providers";
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
  const themeToggleLabel =
    mode === "dark" ? "Chuyển sang sáng" : "Chuyển sang tối";
  setProperty($("theme-toggle"), "title", themeToggleLabel);
  setAttribute($("theme-toggle"), "aria-label", themeToggleLabel);
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
      const hint = $("notification-hint-" + a.id);
      const testHint = state.preferences.paused
        ? "Bật lại thông báo để gửi thử."
        : state.preferences.notifications[a.id] !== "allow"
          ? "Chọn “Cho phép” để gửi thử."
          : "";
      setProperty(hint, "textContent", testHint);
      setProperty(hint, "hidden", !testHint);
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
  const failed = state.panel === "service" && !state.commandOpen && !!c.reason;
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
    syncSelectOptions(
      select,
      state.profiles.map((p) => ({
        value: p.id,
        label: p.email ? `${p.label} · ${p.email}` : p.label,
      })),
      "Chưa tìm thấy profile Chrome",
    );
    const target = $<HTMLSelectElement>("messenger-target");
    if (settings && lastPanel !== "settings" && active.provider === "messenger")
      setProperty(target, "value", active.id);
    const importBusy = state.importing || state.accountBusy;
    setProperty(select, "disabled", importBusy || !state.profiles.length);
    setProperty(target, "disabled", importBusy || !target.value);
    setProperty(
      $("import-hint"),
      "textContent",
      state.importing
        ? "Đang kiểm tra phiên đã chọn. Anh đợi một chút nhé."
        : state.accountBusy
          ? "Đợi thao tác tài khoản hoàn tất để dùng phiên Chrome."
          : !target.value
            ? "Thêm một tài khoản Messenger trước khi chọn phiên Chrome."
            : !state.profiles.length
              ? "Chưa tìm thấy profile Chrome trên máy. Anh có thể mở Messenger và đăng nhập trực tiếp."
              : "Chọn đúng tài khoản Messenger và profile Chrome muốn sử dụng.",
    );
    const button = $<HTMLButtonElement>("import");
    setProperty(
      button,
      "disabled",
      importBusy || !state.profiles.length || !target.value,
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
    settings || library || failed || state.commandOpen,
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
$("close-settings").onclick = () => void window.desktop.providerLibrary(false);
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
$("account-name").oninput = () => {
  const name = $<HTMLInputElement>("account-name");
  name.setCustomValidity(
    name.value && !name.value.trim() ? "Nhập tên để phân biệt tài khoản." : "",
  );
};
$("account-form").onsubmit = async (event) => {
  event.preventDefault();
  $("account-editor-error").textContent = "";
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
const horizontalSettingsTabs = matchMedia("(max-width: 800px)");
function syncSettingsOrientation() {
  setAttribute(
    document.querySelector(".settings-tabs")!,
    "aria-orientation",
    horizontalSettingsTabs.matches ? "horizontal" : "vertical",
  );
}
syncSettingsOrientation();
horizontalSettingsTabs.addEventListener("change", syncSettingsOrientation);
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
window.desktop.changed(render);
void window.desktop.state().then(render);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (current) render(current);
});
