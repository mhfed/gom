import {
  PROVIDERS,
  type AppState,
  type UnreadInfo,
  type DesktopBridge,
  type ProviderId,
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
let current: AppState;
const icons = {
  zalo: "zalo.png",
  messenger: "messenger.svg",
  telegram: "telegram.svg",
};
function unreadLabel(info: UnreadInfo) {
  if (info.count === null) return "Chưa có số chưa đọc từ nền tảng";
  const unit = info.kind === "conversations" ? "cuộc trò chuyện" : "tin nhắn";
  return `${info.approximate ? "Ít nhất " : ""}${info.count} ${unit} chưa đọc${info.source === "loaded" ? " trong danh sách đã tải" : ""}`;
}
function unreadText(info: UnreadInfo) {
  return info.count === null
    ? "—"
    : info.count > 99
      ? "99+"
      : String(info.count) + (info.approximate ? "+" : "");
}
for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
  const b = document.createElement("button");
  b.id = "provider-" + id;
  b.innerHTML = `<img class="logo" src="logos/${icons[id]}" alt=""/><span class="provider-label">${PROVIDERS[id].label}</span><span class="unread" aria-hidden="true">—</span><i class="dot" aria-hidden="true"></i>`;
  b.onclick = () => void window.desktop.activate(id);
  $("providers").append(b);
}
function render(state: AppState) {
  current = state;
  const theme = state.themes[state.active];
  const root = document.documentElement;
  root.dataset.theme =
    theme?.mode ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  for (const [key, value] of Object.entries({
    cream: theme?.background,
    paper: theme?.surface,
    line: theme?.line,
    ink: theme?.text,
    muted: theme?.muted,
  })) {
    if (value) root.style.setProperty("--" + key, value);
    else root.style.removeProperty("--" + key);
  }
  document.body.classList.toggle("collapsed", state.collapsed);
  const toggle = $("sidebar-toggle");
  toggle.setAttribute("aria-expanded", String(!state.collapsed));
  toggle.setAttribute(
    "aria-label",
    state.collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar",
  );
  toggle.title = state.collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar";
  for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
    const b = $("provider-" + id);
    b.classList.toggle(
      "active",
      state.active === id && state.panel === "service",
    );
    const info = state.unread[id];
    const badge = b.querySelector<HTMLElement>(".unread")!;
    badge.textContent = unreadText(info);
    badge.classList.toggle("unknown", info.count === null);
    badge.hidden = info.count === 0;
    b.title = `${PROVIDERS[id].label} · ${unreadLabel(info)}`;
    b.setAttribute("aria-label", b.title);
    b.querySelector("i")!.className = "dot " + state.statuses[id];
  }
  const settings = state.panel === "settings";
  $("title").textContent = settings
    ? "Tài khoản & cài đặt"
    : PROVIDERS[state.active].label;
  $("subtitle").textContent = settings
    ? "Không gian nhắn tin cá nhân của anh"
    : labels[state.statuses[state.active]];
  $("settings-panel").hidden = !settings;
  $("service-loading").hidden = settings;
  $("notice").textContent = state.notice;
  $("version").textContent = state.version;
  const select = $<HTMLSelectElement>("profiles");
  if (select.options.length !== state.profiles.length) {
    select.replaceChildren(
      ...state.profiles.map((p) => {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = p.email ? `${p.label} · ${p.email}` : p.label;
        return o;
      }),
    );
  }
  const button = $<HTMLButtonElement>("import");
  button.disabled = state.importing || !state.profiles.length;
  button.textContent = state.importing
    ? "Đang kiểm tra phiên…"
    : "Dùng phiên có sẵn";
}
$("sidebar-toggle").onclick = () => void window.desktop.toggleSidebar();
$("settings").onclick = () => void window.desktop.settings();
$("reload").onclick = () => void window.desktop.reload();
$("browser").onclick = () => void window.desktop.openBrowser();
$("import").onclick = () =>
  void window.desktop.importMessenger($<HTMLSelectElement>("profiles").value);
window.desktop.changed(render);
void window.desktop.state().then(render);

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (current) render(current);
});
