import { type Account, type AppState } from "../shared.ts";
interface PaletteOptions {
  getState(): AppState;
  avatar(account: Account): HTMLElement;
  icon(name: string): SVGSVGElement;
  settings(tab: string): void;
}
type Entry = {
  id: string;
  title: string;
  subtitle: string;
  account?: Account;
  icon?: string;
  run(): void | Promise<void>;
};
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
export function createCommandPalette(options: PaletteOptions) {
  const dialog = document.getElementById("command-dialog") as HTMLDialogElement;
  const search = document.getElementById("command-search") as HTMLInputElement;
  const results = document.getElementById("command-results")!;
  let selection = 0;
  let entries: Entry[] = [];
  let signature = "";
  const close = () => window.desktop.command(false);
  const afterClose = async (fn: () => unknown) => {
    await close();
    fn();
  };
  function select(index: number, focus = false, rebuilt = false) {
    if (!rebuilt && selection === index) {
      if (focus)
        document
          .getElementById("command-result-" + entries[index]?.id)
          ?.focus({ preventScroll: true });
      return;
    }
    selection = index;
    for (const [i, row] of [
      ...results.querySelectorAll<HTMLElement>("[role=option]"),
    ].entries())
      row.setAttribute("aria-selected", String(i === index));
    const row = document.getElementById("command-result-" + entries[index]?.id);
    if (row) {
      search.setAttribute("aria-activedescendant", row.id);
      row.scrollIntoView({ block: "nearest" });
      if (focus) row.focus({ preventScroll: true });
    } else search.removeAttribute("aria-activedescendant");
  }
  function render() {
    const state = options.getState();
    const previousId = entries[selection]?.id;
    const accounts = state.accounts
      .filter((a) => !a.archived)
      .sort(
        (a, b) =>
          Number(state.presentation.pinned.includes(b.id)) -
          Number(state.presentation.pinned.includes(a.id)),
      );
    const all: Entry[] = [
      ...accounts.map((a) => ({
        id: a.id,
        title: a.name,
        subtitle:
          (state.providers.find((p) => p.id === a.provider)?.label ||
            "Website") +
          (state.presentation.pinned.includes(a.id) ? " · Đã ghim" : ""),
        account: a,
        run: () => window.desktop.activate(a.id),
      })),
      {
        id: "providers",
        title: "Mở tab hoặc thêm website",
        subtitle: "Tìm nền tảng, ghim tab và thêm website riêng",
        icon: "plus",
        run: () => afterClose(() => window.desktop.providerLibrary(true)),
      },
      {
        id: "settings",
        title: "Quản lý tài khoản",
        subtitle: "Thêm, đổi tên và ghim tài khoản",
        icon: "users",
        run: () => options.settings("accounts"),
      },
      {
        id: "appearance",
        title: "Giao diện",
        subtitle: "Sáng, tối và đồng bộ màu",
        icon: "sun",
        run: () => options.settings("appearance"),
      },
      {
        id: "notifications",
        title: "Thông báo",
        subtitle: "Cài đặt cho từng tài khoản",
        icon: "bell",
        run: () => options.settings("notifications"),
      },
      {
        id: "updates",
        title: "Cập nhật Gom",
        subtitle: "Kiểm tra phiên bản và tải bản mới",
        icon: "refresh",
        run: () => options.settings("updates"),
      },
      {
        id: "pause",
        title: state.preferences.paused
          ? "Tiếp tục thông báo"
          : "Tạm dừng thông báo",
        subtitle: "Áp dụng cho tất cả tài khoản",
        icon: "bell-off",
        run: () =>
          afterClose(() =>
            window.desktop.setPreference(
              "paused",
              !options.getState().preferences.paused,
            ),
          ),
      },
    ];
    const words = fold(search.value).trim().split(/\s+/).filter(Boolean);
    entries = all.filter((e) =>
      words.every((w) => fold(e.title + " " + e.subtitle).includes(w)),
    );
    const focusedResult =
      (document.activeElement as HTMLElement)?.getAttribute("role") ===
      "option";
    results.replaceChildren();
    let group = "";
    for (const [index, entry] of entries.entries()) {
      const category = entry.account ? "TÀI KHOẢN" : "THAO TÁC";
      if (category !== group) {
        const h = document.createElement("div");
        h.className = "command-section";
        h.textContent = category;
        h.setAttribute("role", "presentation");
        results.append(h);
        group = category;
      }
      const row = document.createElement("button");
      row.type = "button";
      row.className = "command-result";
      row.id = "command-result-" + entry.id;
      row.tabIndex = -1;
      row.setAttribute("role", "option");
      row.append(
        entry.account
          ? options.avatar(entry.account)
          : options.icon(entry.icon!),
      );
      const copy = document.createElement("span");
      copy.className = "command-copy";
      const title = document.createElement("strong");
      title.textContent = entry.title;
      const sub = document.createElement("small");
      sub.textContent = entry.subtitle;
      copy.append(title, sub);
      const enter = document.createElement("span");
      enter.className = "result-enter";
      enter.textContent = "↵";
      enter.setAttribute("aria-hidden", "true");
      row.append(copy, enter);
      row.onfocus = () => select(index);
      row.onpointermove = () => select(index);
      row.onclick = () => void entry.run();
      results.append(row);
    }
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "command-empty";
      empty.setAttribute("role", "status");
      empty.textContent =
        "Không tìm thấy. Thử tên tài khoản hoặc nền tảng khác.";
      results.append(empty);
    }
    const retained = entries.findIndex((e) => e.id === previousId);
    select(retained >= 0 ? retained : 0, focusedResult, true);
  }
  search.oninput = () => {
    selection = 0;
    entries = [];
    render();
  };
  dialog.onkeydown = (event) => {
    const inResults =
      (document.activeElement as HTMLElement)?.getAttribute("role") ===
      "option";
    if (document.activeElement !== search && !inResults) return;
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (entries.length)
        select(
          (selection + (event.key === "ArrowDown" ? 1 : -1) + entries.length) %
            entries.length,
          inResults,
        );
    } else if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      void entries[selection]?.run();
    }
  };
  dialog.onclose = () => void window.desktop.commandClosed();
  dialog.oncancel = (e) => {
    e.preventDefault();
    void close();
  };
  document.getElementById("close-command")!.onclick = () => void close();
  dialog.onclick = (e) => {
    const r = dialog.getBoundingClientRect();
    if (
      e.target === dialog &&
      (e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom)
    )
      void close();
  };
  return {
    reset() {
      entries = [];
      selection = 0;
      signature = "";
      search.value = "";
      search.removeAttribute("aria-activedescendant");
      results.replaceChildren();
      if (dialog.open) dialog.close();
    },
    sync(state: AppState) {
      const next = JSON.stringify([
        state.accounts,
        state.providers,
        state.presentation.pinned,
        state.preferences.paused,
      ]);
      if (state.commandOpen) {
        if (!dialog.open) {
          search.value = "";
          entries = [];
          selection = 0;
          dialog.showModal();
          search.setAttribute("aria-expanded", "true");
          render();
          search.focus();
        } else if (signature !== next) render();
      } else if (dialog.open) {
        dialog.close();
        search.setAttribute("aria-expanded", "false");
        search.removeAttribute("aria-activedescendant");
      }
      signature = next;
    },
  };
}
