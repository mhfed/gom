import type {
  AppState,
  ProviderDefinition,
  ProviderId,
  UnreadInfo,
} from "../shared.ts";
import { badgeText } from "../main/unread.ts";
import { fitProviderTabs } from "./provider-tab-layout.ts";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
const create = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};
const prop = <T, K extends keyof T>(node: T, key: K, value: T[K]) => {
  if (node[key] !== value) node[key] = value;
};
const attr = (node: Element, key: string, value: string) => {
  if (node.getAttribute(key) !== value) node.setAttribute(key, value);
};
export function createProviderNavigation(options: {
  getState(): AppState;
  select(provider: ProviderId, focusPage?: boolean): Promise<void>;
  logo(provider: ProviderDefinition): HTMLElement;
  icon(name: string): SVGSVGElement;
}) {
  const tabs = $("provider-tabs");
  const list = $("provider-list");
  const search = $<HTMLInputElement>("provider-search");
  const panel = $("providers-panel");
  const overflow = $<HTMLButtonElement>("provider-overflow");
  const add = $<HTMLButtonElement>("provider-add");
  const form = $<HTMLFormElement>("provider-form");
  let headerSignature = "";
  let librarySignature = "";
  let visible: ProviderId[] = [];
  let hidden: ProviderId[] = [];
  let ordered: ProviderId[] = [];
  let adding = false;
  let wasLibrary = false;
  const widths = new Map<ProviderId, number>();
  const canvas = document.createElement("canvas").getContext("2d");
  if (canvas)
    canvas.font = "500 12px -apple-system, BlinkMacSystemFont, sans-serif";
  const activeProvider = (state: AppState) =>
    state.accounts.find((a) => a.id === state.active)?.provider;
  const hasOpenAccount = (state: AppState) =>
    state.accounts.some(
      (account) =>
        !account.archived && state.providerTabs.open.includes(account.provider),
    );
  const report = (message: string) => {
    $("provider-error").textContent = message;
  };
  const close = async (id: ProviderId) => {
    try {
      const result = await window.desktop.closeProvider(id);
      if (!result.ok) {
        await window.desktop.providerLibrary(true);
        report(result.message || "Chưa đóng được tab. Bạn thử lại nhé.");
      }
    } catch {
      await window.desktop.providerLibrary(true);
      report("Chưa đóng được tab. Bạn thử lại nhé.");
    }
  };
  const menu = async (
    button: HTMLElement,
    provider?: ProviderId,
    position?: { x: number; y: number },
  ) => {
    if (button.getAttribute("aria-expanded") === "true") return;
    const rect = button.getBoundingClientRect();
    attr(button, "aria-expanded", "true");
    try {
      await window.desktop.providerMenu({
        ...(position || { x: rect.left, y: rect.bottom + 5 }),
        ...(provider ? { provider } : { overflow: hidden }),
      });
    } finally {
      attr(button, "aria-expanded", "false");
    }
  };
  function fit() {
    const state = options.getState();
    if (!state) return;
    // The plus control is outside this area. Reserve overflow only when needed.
    const available = $("provider-tab-area").clientWidth;
    const result = fitProviderTabs(
      ordered.map((id) => ({ id, width: widths.get(id) || 120 })),
      activeProvider(state) || ordered[0],
      available,
    );
    visible = result.visible;
    hidden = result.overflow;
    const focused = document.activeElement as HTMLElement | null;
    let moveFocus = false;
    for (const wrapper of tabs.querySelectorAll<HTMLElement>(".provider-tab")) {
      const hide = !visible.includes(wrapper.dataset.provider as ProviderId);
      if (hide && wrapper.contains(focused)) moveFocus = true;
      prop(wrapper, "hidden", hide);
    }
    prop(overflow, "hidden", !hidden.length);
    attr(overflow, "data-count", String(hidden.length));
    prop(overflow, "title", `${hidden.length} tab khác`);
    attr(overflow, "aria-label", `Mở ${hidden.length} tab khác`);
    if (moveFocus)
      $("platform-" + (activeProvider(state) || visible[0]))?.focus({
        preventScroll: true,
      });
  }
  function syncHeader(state: AppState) {
    const pinned = state.providerTabs.pinned;
    ordered = [
      ...pinned.filter((id) => state.providerTabs.open.includes(id)),
      ...state.providerTabs.open.filter((id) => !pinned.includes(id)),
    ];
    const signature = JSON.stringify([state.providers, ordered, pinned]);
    const active = activeProvider(state);
    if (signature !== headerSignature) {
      headerSignature = signature;
      const focusId = tabs.contains(document.activeElement)
        ? (document.activeElement as HTMLElement).id
        : "";
      const nodes: HTMLElement[] = [];
      for (const id of ordered) {
        const provider = state.providers.find((p) => p.id === id);
        if (!provider) continue;
        const pin = pinned.includes(id);
        const wrapper = create(
          "div",
          "provider-tab" + (pin ? " is-pinned" : ""),
        );
        wrapper.dataset.provider = id;
        wrapper.setAttribute("role", "presentation");
        const unreadSpace = provider.custom ? 0 : 30;
        const width = pin
          ? 34
          : Math.ceil(
              Math.min(
                156 + unreadSpace,
                Math.max(
                  96 + unreadSpace,
                  (canvas?.measureText(provider.label).width ||
                    provider.label.length * 7) + 62 + unreadSpace,
                ),
              ),
            );
        widths.set(id, width);
        wrapper.style.width = width + "px";
        const button = create("button", "provider-tab-button");
        button.type = "button";
        button.id = "platform-" + id;
        button.setAttribute("role", "tab");
        button.append(
          options.logo(provider),
          create("span", "provider-tab-label", provider.label),
        );
        const unread = create("span", "platform-unread");
        unread.setAttribute("aria-hidden", "true");
        button.append(unread);
        button.onclick = () => void options.select(id);
        button.onkeydown = (event) => {
          if (
            event.isComposing ||
            event.altKey ||
            event.metaKey ||
            event.ctrlKey
          )
            return;
          if (
            (event.shiftKey && event.key === "F10") ||
            event.key === "ContextMenu"
          ) {
            event.preventDefault();
            void menu(button, id);
            return;
          }
          const index = visible.indexOf(id);
          const next =
            event.key === "ArrowRight"
              ? (index + 1) % visible.length
              : event.key === "ArrowLeft"
                ? (index + visible.length - 1) % visible.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? visible.length - 1
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          $("platform-" + visible[next]).focus({ preventScroll: true });
          void options.select(visible[next], false);
        };
        wrapper.oncontextmenu = (event) => {
          event.preventDefault();
          void menu(button, id, { x: event.clientX, y: event.clientY });
        };
        wrapper.append(button);
        if (!pin) {
          const closeButton = create("button", "provider-tab-close");
          closeButton.type = "button";
          closeButton.id = "close-provider-" + id;
          closeButton.title = "Đóng tab " + provider.label;
          closeButton.setAttribute("aria-label", closeButton.title);
          closeButton.append(options.icon("close"));
          closeButton.onclick = () => void close(id);
          wrapper.append(closeButton);
        }
        nodes.push(wrapper);
      }
      tabs.replaceChildren(...nodes);
      if (focusId)
        ($(focusId) || $("platform-" + active))?.focus({ preventScroll: true });
    }
    for (const id of ordered) {
      const button = $("platform-" + id);
      if (!button) continue;
      const provider = state.providers.find((p) => p.id === id)!;
      const unreadInfo = state.accounts
        .filter((a) => a.provider === id && !a.archived && !provider.custom)
        .map((a) => state.unread[a.id] ?? null);
      const knownUnread = unreadInfo.filter(
        (info): info is UnreadInfo & { count: number } =>
          info !== null && info.count !== null,
      );
      const unreadCount = knownUnread.reduce(
        (total, info) => total + info.count,
        0,
      );
      const unreadApproximate = unreadInfo.some(
        (info) => !info || info.count === null || info.approximate,
      );
      const firstKnownUnread = knownUnread[0];
      const unreadText =
        unreadCount > 0 && firstKnownUnread
          ? badgeText({
              ...firstKnownUnread,
              count: unreadCount,
              approximate: unreadApproximate,
            })
          : "";
      const selected = active === id;
      attr(button, "aria-selected", String(selected));
      prop(button, "tabIndex", selected ? 0 : -1);
      const unreadBadge =
        button.querySelector<HTMLElement>(".platform-unread")!;
      prop(unreadBadge, "textContent", unreadText);
      prop(unreadBadge, "hidden", !unreadText);
      const label =
        provider.label +
        (pinned.includes(id) ? " · Đã ghim" : "") +
        (unreadText ? ` · ${unreadText} chưa đọc` : "");
      attr(button, "aria-label", label);
      prop(button, "title", label + " · Nhấp chuột phải để quản lý tab");
      button.parentElement?.classList.toggle("is-active", selected);
      const closeButton = $<HTMLButtonElement>("close-provider-" + id);
      if (closeButton)
        prop(closeButton, "disabled", state.accountBusy || state.importing);
    }
    add.classList.toggle("active", state.panel === "providers");
    attr(add, "aria-expanded", String(state.panel === "providers"));
    fit();
  }
  function filterLibrary() {
    const words = fold(search.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const row of list.querySelectorAll<HTMLElement>(
      ".provider-library-row",
    )) {
      const show = words.every((word) => row.dataset.search!.includes(word));
      prop(row, "hidden", !show);
      if (show) count++;
    }
    prop($("provider-empty"), "hidden", count > 0);
    prop($("provider-result-count"), "textContent", `${count} nền tảng`);
  }
  function syncLibrary(state: AppState) {
    const signature = JSON.stringify(state.providers);
    if (signature !== librarySignature) {
      librarySignature = signature;
      const focused = list.contains(document.activeElement)
        ? (document.activeElement as HTMLElement).id
        : "";
      list.replaceChildren(
        ...state.providers.map((provider) => {
          const row = create("div", "provider-library-row");
          row.dataset.provider = provider.id;
          const host = new URL(provider.entry).host;
          row.dataset.search = fold(provider.label + " " + host);
          const open = create("button", "provider-library-open");
          open.type = "button";
          open.id = "open-provider-" + provider.id;
          open.dataset.providerOpen = provider.id;
          open.setAttribute("aria-label", "Mở " + provider.label);
          open.title = provider.label + " · " + provider.entry;
          open.append(options.logo(provider));
          const copy = create("span", "provider-library-copy");
          copy.append(
            create("strong", "", provider.label),
            create("small", "", provider.custom ? host : "Có sẵn trong Gom"),
          );
          open.append(copy);
          open.onclick = () => void options.select(provider.id);
          const status = create("span", "provider-library-status");
          const pin = create("button", "icon-button provider-library-pin");
          pin.type = "button";
          pin.id = "pin-provider-" + provider.id;
          pin.dataset.providerPin = provider.id;
          pin.append(options.icon("pin"));
          pin.onclick = () => void window.desktop.pinProvider(provider.id);
          row.append(open, status, pin);
          return row;
        }),
      );
      if (focused) $(focused)?.focus({ preventScroll: true });
      filterLibrary();
    }
    for (const row of list.querySelectorAll<HTMLElement>(
      ".provider-library-row",
    )) {
      const id = row.dataset.provider as ProviderId;
      const pinned = state.providerTabs.pinned.includes(id);
      const provider = state.providers.find((p) => p.id === id)!;
      const pin = row.querySelector<HTMLButtonElement>(
        ".provider-library-pin",
      )!;
      attr(pin, "aria-pressed", String(pinned));
      const label = `${pinned ? "Bỏ ghim" : "Ghim"} ${provider.label}`;
      attr(pin, "aria-label", label);
      prop(pin, "title", label);
      prop(pin, "disabled", state.accountBusy || state.importing);
      const status = row.querySelector<HTMLElement>(
        ".provider-library-status",
      )!;
      prop(
        status,
        "textContent",
        state.providerTabs.open.includes(id) ? "Đang mở" : "",
      );
    }
    const busy =
      adding || state.accountBusy || state.importing || !!state.catalogWarning;
    prop($<HTMLButtonElement>("provider-save"), "disabled", busy);
    prop($<HTMLInputElement>("provider-name"), "disabled", adding);
    prop($<HTMLInputElement>("provider-url"), "disabled", adding);
    prop($("provider-catalog-warning"), "textContent", state.catalogWarning);
    prop($("provider-catalog-warning"), "hidden", !state.catalogWarning);
    prop(
      $<HTMLButtonElement>("close-providers"),
      "hidden",
      !hasOpenAccount(state),
    );
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (adding || !form.reportValidity()) return;
    report("");
    adding = true;
    syncLibrary(options.getState());
    prop($("provider-save"), "textContent", "Đang thêm…");
    try {
      const result = await window.desktop.addProvider(
        $<HTMLInputElement>("provider-name").value.trim(),
        $<HTMLInputElement>("provider-url").value.trim(),
      );
      if (!result.ok) {
        report(
          result.message ||
            "Chưa thêm được website. Bạn kiểm tra lại tên và địa chỉ nhé.",
        );
        return;
      }
      form.reset();
      if (result.accountId) await window.desktop.activate(result.accountId);
      else if (result.providerId) await options.select(result.providerId);
    } catch {
      report("Chưa thêm được website. Bạn thử lại nhé.");
    } finally {
      adding = false;
      prop($("provider-save"), "textContent", "Thêm và mở website");
      syncLibrary(options.getState());
    }
  };
  $<HTMLInputElement>("provider-name").oninput = (event) => {
    const input = event.target as HTMLInputElement;
    input.setCustomValidity(
      input.value && !input.value.trim() ? "Nhập tên website." : "",
    );
    report("");
  };
  $<HTMLInputElement>("provider-url").oninput = () => report("");
  search.oninput = filterLibrary;
  add.onclick = () => void window.desktop.providerLibrary(true);
  overflow.onclick = () => void menu(overflow);
  overflow.onkeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      void menu(overflow);
    }
  };
  $("close-providers").onclick = () =>
    void window.desktop.providerLibrary(false);
  panel.onkeydown = (event) => {
    if (
      event.key === "Escape" &&
      !event.isComposing &&
      !document.querySelector("dialog[open]") &&
      hasOpenAccount(options.getState())
    ) {
      event.preventDefault();
      void window.desktop.providerLibrary(false);
    }
  };
  new ResizeObserver(fit).observe($("provider-tab-area"));
  return {
    sync(state: AppState) {
      syncHeader(state);
      const library = state.panel === "providers";
      prop(panel, "hidden", !library);
      if (library || !librarySignature) syncLibrary(state);
      if (library && !wasLibrary) {
        search.value = "";
        filterLibrary();
        search.focus({ preventScroll: true });
      }
      wasLibrary = library;
    },
  };
}
