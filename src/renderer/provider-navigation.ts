import type { HeaderAction } from "../shared.ts";
import type {
  AppState,
  ProviderDefinition,
  ProviderId,
  UnreadInfo,
} from "../shared.ts";
import { badgeText } from "../main/unread.ts";
import {
  fitProviderTabs,
  compactProviderWidth,
} from "./provider-tab-layout.ts";

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
  onAction(action: HeaderAction): void | Promise<void>;
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
  let generation = 0;
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
  const workspaceGuard = () => {
    const token = generation;
    const space = options.getState().privateSpace;
    const unlocked = !!space?.unlocked;
    const lockVersion = space?.lockVersion;
    return () => {
      const current = options.getState().privateSpace;
      return (
        token === generation &&
        unlocked === !!current?.unlocked &&
        lockVersion === current?.lockVersion
      );
    };
  };
  const menu = async (
    button: HTMLElement,
    provider?: ProviderId,
    position?: { x: number; y: number },
    addMenu = false,
  ) => {
    if (button.getAttribute("aria-expanded") === "true") return;
    const rect = button.getBoundingClientRect(),
      valid = workspaceGuard(),
      context = options.getState();
    attr(button, "aria-expanded", "true");
    try {
      const before = await window.desktop.state();
      if (
        !valid() ||
        before.active !== context.active ||
        before.panel !== context.panel ||
        before.privateSpace?.lockVersion !== context.privateSpace?.lockVersion
      )
        return;
      const action = await window.desktop.providerMenu({
        ...(position || { x: rect.left, y: rect.bottom + 5 }),
        ...(addMenu
          ? { add: true }
          : provider
            ? { provider }
            : { overflow: hidden }),
      });
      if (!action) return;
      const latest = await window.desktop.state();
      const current = options.getState();
      if (
        latest.headerRevision === before.headerRevision &&
        valid() &&
        current.active === context.active &&
        current.panel === context.panel
      )
        await options.onAction(action);
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
      const width = compactProviderWidth(
        canvas?.measureText(provider.label).width ?? provider.label.length * 7,
        selected,
      );
      widths.set(id, width);
      const wrapper = button.parentElement!;
      if (wrapper.style.width !== width + "px")
        wrapper.style.width = width + "px";
      attr(
        button,
        "aria-description",
        "Shift F10 hoặc nhấp chuột phải để quản lý tab.",
      );
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
    }
    add.classList.toggle("active", state.panel === "providers");
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
    for (const group of list.querySelectorAll<HTMLElement>(
      ".provider-library-group",
    )) {
      const hasVisibleProviders = Array.from(
        group.querySelectorAll<HTMLElement>(".provider-library-row"),
      ).some((row) => !row.hidden);
      prop(group, "hidden", !hasVisibleProviders);
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
      const groups = [
        { id: "communication", label: "Giao tiếp", rows: [] as HTMLElement[] },
        { id: "dating", label: "Hẹn hò", rows: [] as HTMLElement[] },
        { id: "custom", label: "Website riêng", rows: [] as HTMLElement[] },
      ];
      for (const provider of state.providers) {
        const groupId = provider.custom
          ? "custom"
          : provider.id === "tinder"
            ? "dating"
            : "communication";
        const group = groups.find((candidate) => candidate.id === groupId)!;
        const row = create("div", "provider-library-row");
        row.dataset.provider = provider.id;
        const host = new URL(provider.entry).host;
        row.dataset.search = fold(
          provider.label + " " + host + " " + group.label,
        );
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
        group.rows.push(row);
      }
      const sections = groups
        .filter((group) => group.rows.length > 0)
        .map((group) => {
          const section = create("section", "provider-library-group");
          section.dataset.group = group.id;
          const heading = create(
            "h3",
            "provider-library-group-title",
            group.label,
          );
          heading.id = "provider-group-" + group.id;
          section.setAttribute("aria-labelledby", heading.id);
          const grid = create("div", "provider-library-grid");
          grid.append(...group.rows);
          section.append(heading, grid);
          return section;
        });
      list.replaceChildren(...sections);
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
      const isOpen = state.providerTabs.open.includes(id);
      prop(status, "textContent", isOpen ? "Đang mở" : "");
      prop(status, "hidden", !isOpen);
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
    const isCurrent = workspaceGuard();
    report("");
    adding = true;
    syncLibrary(options.getState());
    prop($("provider-save"), "textContent", "Đang thêm…");
    try {
      const result = await window.desktop.addProvider(
        $<HTMLInputElement>("provider-name").value.trim(),
        $<HTMLInputElement>("provider-url").value.trim(),
      );
      if (!isCurrent()) return;
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
      if (isCurrent()) report("Chưa thêm được website. Bạn thử lại nhé.");
    } finally {
      if (isCurrent()) {
        adding = false;
        prop($("provider-save"), "textContent", "Thêm và mở website");
        syncLibrary(options.getState());
      }
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
  add.onclick = () => void menu(add, undefined, undefined, true);
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
    reset() {
      generation++;
      adding = false;
      wasLibrary = false;
      prop($("provider-save"), "textContent", "Thêm và mở website");
      headerSignature = "";
      librarySignature = "";
      visible = [];
      hidden = [];
      ordered = [];
      widths.clear();
      search.value = "";
      form.reset();
      list.replaceChildren();
      tabs.replaceChildren();
    },
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
