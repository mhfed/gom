import type { AppState } from "../shared.ts";
import {
  SHELF_LIMITS,
  type ShelfItem,
  type ShelfRequest,
  type ShelfResult,
  type ShelfSnapshot,
} from "../shelf-types.ts";

/** A workspace-scoped drawer; main owns both the data and its visible surface. */
export function createShelfUI(options: {
  getState(): AppState | undefined;
  request(request: ShelfRequest): Promise<ShelfResult>;
}): { render(state: AppState): void; conceal(): void } {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const setProperty = <T, K extends keyof T>(
    target: T,
    property: K,
    value: T[K],
  ) => {
    if (target[property] !== value) target[property] = value;
  };
  const setAttribute = (target: Element, name: string, value: string) => {
    if (target.getAttribute(name) !== value) target.setAttribute(name, value);
  };
  const setClass = (target: Element, name: string, enabled: boolean) => {
    if (target.classList.contains(name) !== enabled)
      target.classList.toggle(name, enabled);
  };
  const panel = $("shelf-panel");
  const toggle = $<HTMLButtonElement>("shelf-toggle");
  const list = $("shelf-list");
  const search = $<HTMLInputElement>("shelf-search");
  const text = $<HTMLTextAreaElement>("shelf-text");
  const status = $("shelf-status");
  const confirmation = $("shelf-clear-confirm");
  let epoch = "";
  let generation = 0;
  let snapshot: ShelfSnapshot | undefined;
  let attemptedRevision = -1;
  let loading = false;
  let busy = false;
  let visible = false;
  let filter = "all";
  let listSignature = "";
  const previews = new Map<string, string>();
  const expanded = new Set<string>();
  const key = (state: AppState | undefined) =>
    `${state?.privateSpace?.lockVersion ?? 0}:${!!state?.privateSpace?.unlocked}`;
  const node = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    value = "",
  ) => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  };
  function symbol(name: string) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", `#i-${name}`);
    svg.append(use);
    return svg;
  }
  const bytes = (value: number) =>
    value < 1024
      ? `${value} B`
      : value < 1024 * 1024
        ? `${(value / 1024).toLocaleString("vi", { maximumFractionDigits: 1 })} KB`
        : `${(value / (1024 * 1024)).toLocaleString("vi", { maximumFractionDigits: 1 })} MB`;
  function message(value: string, error = false) {
    setProperty(status, "textContent", value);
    setProperty(status, "tabIndex", value ? 0 : -1);
    setClass(status, "is-error", error);
  }
  function reset() {
    generation++;
    snapshot = undefined;
    attemptedRevision = -1;
    loading = false;
    busy = false;
    filter = "all";
    listSignature = "";
    previews.clear();
    expanded.clear();
    list.replaceChildren();
    search.value = "";
    text.value = "";
    confirmation.hidden = true;
    message("");
    for (const button of panel.querySelectorAll<HTMLButtonElement>(
      "[data-shelf-filter]",
    ))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.shelfFilter === "all"),
      );
  }
  function show(open: boolean) {
    setProperty(panel, "hidden", !open);
    setClass(document.body, "shelf-open", open);
    setAttribute(toggle, "aria-expanded", String(open));
    visible = open;
  }
  async function send(
    request: Omit<ShelfRequest, "lockVersion">,
  ): Promise<ShelfResult | undefined> {
    const state = options.getState();
    if (!state) return;
    const token = generation;
    const captured = key(state);
    try {
      const result = await options.request({
        ...request,
        lockVersion: state.privateSpace?.lockVersion ?? 0,
      });
      if (token !== generation || captured !== key(options.getState())) return;
      return result;
    } catch {
      if (token === generation && captured === key(options.getState()))
        return { ok: false, message: "Chưa thực hiện được. Bạn thử lại nhé." };
    }
  }
  function accept(result: ShelfResult) {
    if (
      result.snapshot &&
      (!snapshot || result.snapshot.revision >= snapshot.revision)
    ) {
      if (snapshot?.revision !== result.snapshot.revision)
        confirmation.hidden = true;
      snapshot = result.snapshot;
      draw();
    }
  }
  function controls() {
    const summary = options.getState()?.shelf;
    const unavailable = summary?.unavailable || snapshot?.unavailable;
    const full =
      (snapshot?.items.length ?? summary?.count ?? 0) >= SHELF_LIMITS.items ||
      (snapshot?.totalBytes ?? summary?.totalBytes ?? 0) >=
        SHELF_LIMITS.totalBytes;
    for (const id of [
      "shelf-from-clipboard",
      "shelf-pick-files",
      "shelf-add-text",
    ])
      setProperty(
        $<HTMLButtonElement>(id),
        "disabled",
        busy ||
          loading ||
          !!unavailable ||
          full ||
          (id === "shelf-add-text" && !text.value.trim()),
      );
    setProperty(
      $<HTMLButtonElement>("shelf-clear"),
      "disabled",
      busy ||
        loading ||
        !!unavailable ||
        !snapshot?.items.some((item) => !item.pinned),
    );
    for (const button of list.querySelectorAll<HTMLButtonElement>("button"))
      setProperty(button, "disabled", busy || !!unavailable);
    setProperty($<HTMLButtonElement>("shelf-clear-accept"), "disabled", busy);
    setAttribute(panel, "aria-busy", String(loading || busy));
    setProperty(
      $("shelf-capacity"),
      "textContent",
      `${snapshot?.items.length ?? summary?.count ?? 0}/${SHELF_LIMITS.items} món · ${bytes(snapshot?.totalBytes ?? summary?.totalBytes ?? 0)} / ${bytes(SHELF_LIMITS.totalBytes)}`,
    );
    setProperty($("shelf-quota"), "hidden", !full);
  }
  async function load() {
    const summary = options.getState()?.shelf;
    if (
      !visible ||
      loading ||
      !summary ||
      attemptedRevision === summary.revision
    )
      return;
    attemptedRevision = summary.revision;
    const token = generation;
    loading = true;
    if (!snapshot) message("Đang mở khay…");
    controls();
    const result = await send({ action: "list" });
    if (token !== generation) return;
    loading = false;
    if (result) {
      accept(result);
      message(
        result.ok
          ? snapshot?.error || ""
          : result.message || "Chưa đọc được khay. Bạn thử lại nhé.",
        !result.ok || !!snapshot?.error,
      );
    }
    draw();
    controls();
    // An update arriving during a list request must be fetched after it finishes.
    if (options.getState()?.shelf?.revision !== attemptedRevision) void load();
  }
  async function perform(
    request: Omit<ShelfRequest, "lockVersion">,
    success = "",
  ) {
    if (busy || !visible) return;
    const token = generation;
    busy = true;
    message("Đang thực hiện…");
    controls();
    const result = await send(request);
    if (token !== generation) return;
    busy = false;
    if (result) {
      accept(result);
      message(
        result.message ||
          (result.ok ? success : "Chưa thực hiện được. Bạn thử lại nhé."),
        !result.ok,
      );
      if (result.ok && request.action === "add-text") text.value = "";
      if (
        result.ok &&
        !result.snapshot &&
        !["copy", "export"].includes(request.action)
      ) {
        attemptedRevision = -1;
        void load();
      }
    }
    controls();
  }
  function card(item: ShelfItem) {
    const article = node("article", `shelf-card shelf-card-${item.kind}`);
    article.dataset.shelfId = item.id;
    const heading = node("div", "shelf-card-heading");
    const kind = node(
      "span",
      "shelf-card-kind",
      item.kind === "text"
        ? "Văn bản"
        : item.kind === "link"
          ? "Liên kết"
          : item.kind === "image"
            ? "Ảnh"
            : "Tệp",
    );
    heading.append(kind);
    if (item.pinned) {
      const pinned = node("span", "shelf-pinned", "Đã ghim");
      pinned.prepend(symbol("pin"));
      heading.append(pinned);
    }
    article.append(heading);
    if (item.kind === "image") {
      const preview = node("div", "shelf-image");
      preview.textContent = "Đang mở ảnh…";
      article.append(preview);
      const apply = (url: string) => {
        const image = node("img");
        image.src = url;
        image.alt = item.name;
        image.draggable = false;
        preview.replaceChildren(image);
      };
      const cached = previews.get(item.id);
      if (cached) apply(cached);
      else
        void send({ action: "preview", id: item.id }).then((result) => {
          if (!result || !preview.isConnected || !visible) return;
          if (
            result.ok &&
            result.dataUrl &&
            /^data:image\/(png|jpeg|webp);base64,/.test(result.dataUrl)
          ) {
            previews.set(item.id, result.dataUrl);
            apply(result.dataUrl);
          } else preview.textContent = result.message || "Chưa mở được ảnh.";
        });
    }
    if (item.kind === "file" || item.kind === "image") {
      article.append(
        node("p", "shelf-file-name", item.name),
        node("p", "shelf-file-size", bytes(item.bytes)),
      );
    } else {
      const content = node("p", "shelf-card-text", item.text || "");
      content.classList.toggle("is-expanded", expanded.has(item.id));
      article.append(content);
      if (item.kind === "link") {
        try {
          article.append(
            node("span", "shelf-host", new URL(item.text || "").hostname),
          );
        } catch {
          /* Keep unusual links as inert text. */
        }
      }
      if (
        (item.text?.length ?? 0) > 160 ||
        (item.text?.split("\n").length ?? 0) > 5
      ) {
        const expand = node(
          "button",
          "shelf-expand",
          expanded.has(item.id) ? "Thu gọn" : "Xem thêm",
        );
        expand.type = "button";
        expand.setAttribute("aria-expanded", String(expanded.has(item.id)));
        expand.onclick = () => {
          const open = !expanded.has(item.id);
          if (open) expanded.add(item.id);
          else expanded.delete(item.id);
          content.classList.toggle("is-expanded", open);
          expand.textContent = open ? "Thu gọn" : "Xem thêm";
          expand.setAttribute("aria-expanded", String(open));
        };
        article.append(expand);
      }
    }
    const actions = node("div", "shelf-card-actions");
    const action = (
      name: string,
      label: string,
      title: string,
      click: () => void,
    ) => {
      const button = node("button", "shelf-item-action", label);
      button.type = "button";
      button.dataset.shelfAction = name;
      button.setAttribute("aria-label", title);
      button.title = title;
      button.onclick = click;
      actions.append(button);
      return button;
    };
    action(
      item.kind === "file" ? "export" : "copy",
      item.kind === "file" ? "Lưu bản sao…" : "Sao chép",
      item.kind === "file" ? "Lưu bản sao tệp" : "Sao chép nội dung",
      () =>
        void perform(
          { action: item.kind === "file" ? "export" : "copy", id: item.id },
          item.kind === "file" ? "Đã lưu bản sao." : "Đã sao chép",
        ),
    );
    const pin = action(
      "pin",
      "",
      item.pinned ? "Bỏ ghim" : "Ghim",
      () =>
        void perform(
          { action: "pin", id: item.id, pinned: !item.pinned },
          item.pinned ? "Đã bỏ ghim." : "Đã ghim.",
        ),
    );
    pin.append(symbol("pin"));
    pin.classList.add("shelf-icon-action");
    pin.setAttribute("aria-pressed", String(item.pinned));
    const remove = action(
      "remove",
      "",
      "Xóa mục",
      () => void perform({ action: "remove", id: item.id }, "Đã xóa mục."),
    );
    remove.append(symbol("close"));
    remove.classList.add("shelf-icon-action");
    article.append(actions);
    return article;
  }
  function draw() {
    if (!visible) return;
    const items = (snapshot?.items ?? [])
      .filter(
        (item) =>
          (filter === "all" ||
            (filter === "text"
              ? ["text", "link"].includes(item.kind)
              : item.kind === filter)) &&
          `${item.name}\n${item.text || ""}`
            .toLocaleLowerCase("vi")
            .includes(search.value.toLocaleLowerCase("vi")),
      )
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt,
      );
    const signature = JSON.stringify([
      items,
      filter,
      search.value,
      snapshot?.unavailable,
      snapshot?.error,
    ]);
    if (signature !== listSignature) {
      const focused = document.activeElement as HTMLElement | null;
      const focusedId =
        focused?.closest<HTMLElement>("[data-shelf-id]")?.dataset.shelfId;
      const focusedAction = focused?.dataset.shelfAction;
      const previousIndex = [...list.children].findIndex(
        (child) => (child as HTMLElement).dataset.shelfId === focusedId,
      );
      listSignature = signature;
      list.replaceChildren(...items.map(card));
      if (
        !items.length &&
        snapshot &&
        !snapshot.unavailable &&
        !snapshot.error &&
        !options.getState()?.shelf?.unavailable
      )
        list.append(
          node(
            "p",
            "shelf-empty",
            search.value || filter !== "all"
              ? "Chưa tìm thấy món phù hợp. Bạn thử từ khóa hoặc bộ lọc khác."
              : "Chưa có món nào. Chọn tệp hoặc lấy nội dung vừa sao chép để gom vào đây.",
          ),
        );
      if (focusedId && focusedAction) {
        const index = items.findIndex((item) => item.id === focusedId);
        const target =
          list.children[
            index < 0
              ? Math.max(0, Math.min(previousIndex, items.length - 1))
              : index
          ];
        target
          ?.querySelector<HTMLButtonElement>(
            `[data-shelf-action="${focusedAction}"]`,
          )
          ?.focus({ preventScroll: true });
        if (!target) search.focus({ preventScroll: true });
      }
    }
    setProperty(
      $("shelf-retry"),
      "hidden",
      !snapshot?.unavailable &&
        !snapshot?.error &&
        !status.classList.contains("is-error"),
    );
    controls();
  }
  function render(state: AppState) {
    if (epoch !== key(state)) {
      epoch = key(state);
      reset();
      show(false);
    }
    const summary = state.shelf;
    const open = !!summary?.open;
    setProperty(toggle, "hidden", !summary);
    setProperty($("shelf-count"), "textContent", String(summary?.count ?? 0));
    setProperty($("shelf-count"), "hidden", !summary?.count);
    setProperty(toggle, "title", `Khay · ${summary?.count ?? 0} món`);
    setAttribute(toggle, "aria-label", toggle.title);
    setProperty(
      $("shelf-workspace"),
      "textContent",
      state.privateSpace?.unlocked ? "Không gian kín" : "Không gian thường",
    );
    setProperty(
      $("shelf-private-note"),
      "hidden",
      !state.privateSpace?.unlocked,
    );
    const opening = open && !visible;
    if (!open && visible) reset();
    show(open);
    if (open) {
      if (opening) search.focus({ preventScroll: true });
      void load();
      controls();
    }
  }
  function conceal() {
    const state = options.getState();
    reset();
    show(false);
    if (state?.shelf?.open && key(state) === epoch)
      void send({ action: "surface", open: false });
  }
  toggle.onclick = () =>
    void send({
      action: "surface",
      open: !options.getState()?.shelf?.open,
    }).then((result) => {
      if (result && !result.ok)
        message(result.message || "Chưa mở được khay.", true);
    });
  $("shelf-close").onclick = () =>
    void send({ action: "surface", open: false });
  text.oninput = controls;
  $("shelf-add-text").onclick = () => {
    if (
      new TextEncoder().encode(text.value).byteLength > SHELF_LIMITS.textBytes
    ) {
      message(
        `Văn bản tối đa ${bytes(SHELF_LIMITS.textBytes)}. Bạn chia thành đoạn ngắn hơn nhé.`,
        true,
      );
      return;
    }
    if (text.value.trim())
      void perform(
        { action: "add-text", text: text.value },
        "Đã thêm vào khay.",
      );
  };
  $("shelf-from-clipboard").onclick = () =>
    void perform({ action: "clipboard" }, "Đã thêm vào khay.");
  $("shelf-pick-files").onclick = () =>
    void perform({ action: "pick-files" }, "Đã thêm vào khay.");
  search.oninput = draw;
  for (const button of panel.querySelectorAll<HTMLButtonElement>(
    "[data-shelf-filter]",
  ))
    button.onclick = () => {
      filter = button.dataset.shelfFilter!;
      for (const other of panel.querySelectorAll<HTMLButtonElement>(
        "[data-shelf-filter]",
      ))
        other.setAttribute("aria-pressed", String(other === button));
      draw();
    };
  $("shelf-clear").onclick = () => {
    $("shelf-clear-question").textContent =
      `Xóa ${snapshot?.items.filter((item) => !item.pinned).length ?? 0} mục chưa ghim? Các mục đã ghim vẫn được giữ lại.`;
    confirmation.hidden = false;
    $("shelf-clear-cancel").focus();
  };
  $("shelf-clear-cancel").onclick = () => {
    confirmation.hidden = true;
    $("shelf-clear").focus();
  };
  $("shelf-clear-accept").onclick = () => {
    confirmation.hidden = true;
    void perform({ action: "clear" }, "Đã dọn mục chưa ghim.");
    search.focus();
  };
  $("shelf-retry").onclick = () => {
    attemptedRevision = -1;
    void load();
  };
  document.addEventListener("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      event.isComposing ||
      event.defaultPrevented ||
      !visible ||
      document.querySelector("dialog[open]")
    )
      return;
    event.preventDefault();
    if (!confirmation.hidden) {
      confirmation.hidden = true;
      $("shelf-clear").focus();
    } else void send({ action: "surface", open: false });
  });
  return { render, conceal };
}
