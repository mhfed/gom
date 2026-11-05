import type { AppState } from "../shared.ts";
import {
  SHELF_LIMITS,
  type ShelfItem,
  type ShelfRequest,
  type ShelfResult,
  type ShelfSnapshot,
  type ShelfTemplate,
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
  const templatePanel = $("shelf-template-panel");
  const templateForm = $<HTMLFormElement>("shelf-template-editor");
  const templateTitle = $<HTMLInputElement>("shelf-template-title");
  const templateBody = $<HTMLTextAreaElement>("shelf-template-body");
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
  let view: "items" | "templates" = "items";
  let templateEditor: { id?: string } | undefined;
  let focusTemplateAfterSave: string | undefined;
  let pendingFocus:
    | { kind: "item" | "template"; id: string; action: string }
    | undefined;
  let confirmOpen = false;
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
    view = "items";
    templateEditor = undefined;
    focusTemplateAfterSave = undefined;
    pendingFocus = undefined;
    confirmOpen = false;
    listSignature = "";
    previews.clear();
    expanded.clear();
    list.replaceChildren();
    search.value = "";
    text.value = "";
    confirmation.hidden = true;
    templatePanel.hidden = true;
    templateForm.hidden = true;
    templateForm.reset();
    $("shelf-template-error").textContent = "";
    message("");
    for (const button of panel.querySelectorAll<HTMLButtonElement>(
      "[data-shelf-filter]",
    ))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.shelfFilter === "all"),
      );
    setAttribute($("shelf-tab-items"), "aria-selected", "true");
    setAttribute($("shelf-tab-templates"), "aria-selected", "false");
    setProperty($<HTMLButtonElement>("shelf-tab-items"), "tabIndex", 0);
    setProperty($<HTMLButtonElement>("shelf-tab-templates"), "tabIndex", -1);
    for (const element of panel.querySelectorAll<HTMLElement>(
      "[data-shelf-items-only]",
    ))
      element.hidden = false;
    setAttribute(list, "aria-labelledby", "shelf-tab-items");
    setAttribute(list, "aria-label", "Nội dung trong khay");
    search.placeholder = "Tìm trong khay";
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
        confirmOpen = false;
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
    for (const element of panel.querySelectorAll<HTMLElement>(
      "[data-shelf-items-only]",
    ))
      if (element.id !== "shelf-quota" && element.id !== "shelf-clear-confirm")
        setProperty(element, "hidden", view !== "items");
    setProperty($("shelf-quota"), "hidden", view !== "items" || !full);
    setProperty(
      confirmation,
      "hidden",
      view !== "items" || !confirmOpen,
    );
    setProperty(templatePanel, "hidden", view !== "templates");
    setProperty(
      templateForm,
      "hidden",
      view !== "templates" || templateEditor === undefined,
    );
    for (const id of [
      "shelf-from-clipboard",
      "shelf-pick-files",
      "shelf-add-text",
    ])
      setProperty(
        $<HTMLButtonElement>(id),
        "disabled",
        view !== "items" ||
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
    setProperty($("shelf-quota"), "hidden", view !== "items" || !full);
    setProperty(
      $<HTMLButtonElement>("shelf-template-add"),
      "disabled",
      busy ||
        loading ||
        !!unavailable ||
        (snapshot?.templates.length ?? 0) >= SHELF_LIMITS.templates,
    );
    setProperty(
      $<HTMLButtonElement>("shelf-template-save"),
      "disabled",
      busy || loading || !!unavailable,
    );
    setProperty(
      $<HTMLButtonElement>("shelf-template-cancel"),
      "disabled",
      busy,
    );
    const itemsTab = $<HTMLButtonElement>("shelf-tab-items");
    const templatesTab = $<HTMLButtonElement>("shelf-tab-templates");
    setAttribute(itemsTab, "aria-selected", String(view === "items"));
    setAttribute(templatesTab, "aria-selected", String(view === "templates"));
    setProperty(itemsTab, "tabIndex", view === "items" ? 0 : -1);
    setProperty(templatesTab, "tabIndex", view === "templates" ? 0 : -1);
    setAttribute(
      list,
      "aria-labelledby",
      view === "items" ? "shelf-tab-items" : "shelf-tab-templates",
    );
    setAttribute(
      list,
      "aria-label",
      view === "items" ? "Nội dung trong khay" : "Mẫu trả lời",
    );
    setProperty(
      search,
      "placeholder",
      view === "items" ? "Tìm trong khay" : "Tìm trong mẫu",
    );
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
    const focused = document.activeElement as HTMLElement | null;
    const item = focused?.closest<HTMLElement>("[data-shelf-id]");
    const template = focused?.closest<HTMLElement>("[data-template-id]");
    if (
      item?.dataset.shelfId &&
      focused?.dataset.shelfAction &&
      ["pin", "remove"].includes(request.action)
    )
      pendingFocus = {
        kind: "item",
        id: item.dataset.shelfId,
        action: focused.dataset.shelfAction,
      };
    else if (
      template?.dataset.templateId &&
      focused?.dataset.templateAction &&
      request.action === "remove-template"
    )
      pendingFocus = {
        kind: "template",
        id: template.dataset.templateId,
        action: focused.dataset.templateAction,
      };
    const operationFocus = pendingFocus;
    const token = generation;
    busy = true;
    message("Đang thực hiện…");
    controls();
    const result = await send(request);
    if (token !== generation) return;
    busy = false;
    if (result) {
      if (
        result.ok &&
        (request.action === "add-template" ||
          request.action === "update-template")
      ) {
        focusTemplateAfterSave =
          request.action === "update-template"
            ? request.templateId
            : result.snapshot?.templates[0]?.id;
        templateEditor = undefined;
        templateForm.reset();
        $("shelf-template-error").textContent = "";
      } else if (
        result.ok &&
        request.action === "remove-template" &&
        templateEditor?.id === request.templateId
      ) {
        templateEditor = undefined;
        templateForm.reset();
      }
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
        !["copy", "export", "copy-template"].includes(request.action)
      ) {
        attemptedRevision = -1;
        void load();
      }
    }
    controls();
    if (operationFocus && result?.snapshot) {
      const target = [...list.children]
        .map((child) => child as HTMLElement)
        .find((child) =>
          operationFocus.kind === "item"
            ? child.dataset.shelfId === operationFocus.id
            : child.dataset.templateId === operationFocus.id,
        );
      const selector =
        operationFocus.kind === "item"
          ? `[data-shelf-action="${operationFocus.action}"]`
          : `[data-template-action="${operationFocus.action}"]`;
      target
        ?.querySelector<HTMLButtonElement>(selector)
        ?.focus({ preventScroll: true });
      pendingFocus = undefined;
    }
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
  function templateCard(template: ShelfTemplate) {
    const article = node("article", "shelf-template-card");
    article.dataset.templateId = template.id;
    article.append(
      node("h4", "shelf-template-title", template.title),
      node("p", "shelf-template-preview", template.body),
    );
    const actions = node("div", "shelf-template-actions");
    const action = (name: string, label: string, click: () => void) => {
      const button = node("button", "", label);
      button.type = "button";
      button.dataset.templateAction = name;
      actions.append(button);
      button.onclick = click;
      return button;
    };
    action("copy", "Sao chép", () =>
      void perform(
        { action: "copy-template", templateId: template.id },
        "Đã sao chép mẫu.",
      ),
    );
    action("edit", "Sửa", () => {
      templateEditor = { id: template.id };
      templateTitle.value = template.title;
      templateBody.value = template.body;
      $("shelf-template-error").textContent = "";
      templateForm.hidden = false;
      controls();
      templateTitle.focus();
    });
    action("remove", "Xóa", () =>
      void perform(
        { action: "remove-template", templateId: template.id },
        "Đã xóa mẫu.",
      ),
    );
    article.append(actions);
    return article;
  }
  function drawTemplates() {
    const query = search.value.toLocaleLowerCase("vi");
    const templates = (snapshot?.templates ?? [])
      .filter((template) =>
        `${template.title}\n${template.body}`
          .toLocaleLowerCase("vi")
          .includes(query),
      )
      .sort(
        (a, b) =>
          b.updatedAt - a.updatedAt || b.id.localeCompare(a.id),
      );
    const signature = JSON.stringify([
      "templates",
      templates,
      query,
      snapshot?.unavailable,
      snapshot?.error,
    ]);
    if (signature === listSignature) return;
    const focused = document.activeElement as HTMLElement | null;
    const focusedId = focused?.closest<HTMLElement>("[data-template-id]")
      ?.dataset.templateId;
    const focusedAction = focused?.dataset.templateAction;
    const previousIndex = [...list.children].findIndex(
      (child) => (child as HTMLElement).dataset.templateId === focusedId,
    );
    listSignature = signature;
    list.replaceChildren(...templates.map(templateCard));
    if (
      !templates.length &&
      snapshot &&
      !snapshot.unavailable &&
      !snapshot.error &&
      !options.getState()?.shelf?.unavailable
    )
      list.append(
        node(
          "p",
          "shelf-empty",
          query
            ? "Chưa tìm thấy mẫu phù hợp. Bạn thử từ khóa khác."
            : "Chưa có mẫu. Tạo câu trả lời thường dùng để bắt đầu.",
        ),
      );
    if (focusTemplateAfterSave) {
      [...list.children]
        .map((child) => child as HTMLElement)
        .find((child) => child.dataset.templateId === focusTemplateAfterSave)
        ?.querySelector<HTMLButtonElement>(
          '[data-template-action="copy"]',
        )
        ?.focus({ preventScroll: true });
      focusTemplateAfterSave = undefined;
      pendingFocus = undefined;
    } else if (pendingFocus?.kind === "template") {
      const target = [...list.children]
        .map((child) => child as HTMLElement)
        .find((child) => child.dataset.templateId === pendingFocus?.id);
      target
        ?.querySelector<HTMLButtonElement>(
          `[data-template-action="${pendingFocus.action}"]`,
        )
        ?.focus({ preventScroll: true });
      if (!target) search.focus({ preventScroll: true });
      pendingFocus = undefined;
    } else if (focusedId && focusedAction) {
      const index = templates.findIndex((item) => item.id === focusedId);
      const target = list.children[
        index < 0
          ? Math.max(0, Math.min(previousIndex, templates.length - 1))
          : index
      ];
      target
        ?.querySelector<HTMLButtonElement>(
          `[data-template-action="${focusedAction}"]`,
        )
        ?.focus({ preventScroll: true });
      if (!target) search.focus({ preventScroll: true });
    }
  }
  function draw() {
    if (!visible) return;
    if (view === "templates") {
      drawTemplates();
      setProperty(
        $("shelf-retry"),
        "hidden",
        !snapshot?.unavailable &&
          !snapshot?.error &&
          !status.classList.contains("is-error"),
      );
      controls();
      return;
    }
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
      view,
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
      if (pendingFocus?.kind === "item") {
        const target = [...list.children]
          .map((child) => child as HTMLElement)
          .find((child) => child.dataset.shelfId === pendingFocus?.id);
        target
          ?.querySelector<HTMLButtonElement>(
            `[data-shelf-action="${pendingFocus.action}"]`,
          )
          ?.focus({ preventScroll: true });
        if (!target) search.focus({ preventScroll: true });
        pendingFocus = undefined;
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
  const shelfTabs = [
    $<HTMLButtonElement>("shelf-tab-items"),
    $<HTMLButtonElement>("shelf-tab-templates"),
  ];
  const selectView = (next: "items" | "templates") => {
    if (view === next) return;
    view = next;
    confirmOpen = false;
    listSignature = "";
    controls();
    draw();
  };
  for (const [index, tab] of shelfTabs.entries()) {
    tab.onclick = () => selectView(index === 0 ? "items" : "templates");
    tab.onkeydown = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
        return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? shelfTabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : shelfTabs.length - 1)) %
              shelfTabs.length;
      shelfTabs[next].focus();
      selectView(next === 0 ? "items" : "templates");
    };
  }
  $("shelf-template-add").onclick = () => {
    templateEditor = {};
    templateForm.reset();
    $("shelf-template-error").textContent = "";
    templateForm.hidden = false;
    controls();
    templateTitle.focus();
  };
  $("shelf-template-cancel").onclick = () => {
    const id = templateEditor?.id;
    templateEditor = undefined;
    templateForm.reset();
    $("shelf-template-error").textContent = "";
    controls();
    if (id) {
      [...list.children]
        .map((child) => child as HTMLElement)
        .find((child) => child.dataset.templateId === id)
        ?.querySelector<HTMLButtonElement>('[data-template-action="edit"]')
        ?.focus();
    } else $("shelf-template-add").focus();
  };
  const templateError = (value: string) =>
    setProperty($("shelf-template-error"), "textContent", value);
  templateTitle.oninput = () => {
    templateError("");
    controls();
  };
  templateBody.oninput = () => {
    templateError("");
    controls();
  };
  templateForm.onsubmit = (event) => {
    event.preventDefault();
    if (busy || !templateEditor || !templateForm.reportValidity()) return;
    const title = templateTitle.value.trim();
    const body = templateBody.value.replace(/\r\n?/g, "\n");
    if (!title || !body.trim()) {
      templateError("Thêm tên và nội dung cho mẫu.");
      return;
    }
    if (Array.from(title).length > SHELF_LIMITS.templateTitleChars) {
      templateError("Tên mẫu tối đa 120 ký tự Unicode.");
      templateTitle.focus();
      return;
    }
    if (new TextEncoder().encode(body).byteLength > SHELF_LIMITS.textBytes) {
      templateError(`Nội dung mẫu tối đa ${bytes(SHELF_LIMITS.textBytes)}.`);
      templateBody.focus();
      return;
    }
    const request = templateEditor.id
      ? {
          action: "update-template" as const,
          templateId: templateEditor.id,
          title,
          body,
        }
      : { action: "add-template" as const, title, body };
    void perform(request, "Đã lưu mẫu.");
  };
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
    confirmOpen = true;
    controls();
    $("shelf-clear-cancel").focus();
  };
  $("shelf-clear-cancel").onclick = () => {
    confirmOpen = false;
    controls();
    $("shelf-clear").focus();
  };
  $("shelf-clear-accept").onclick = () => {
    confirmOpen = false;
    controls();
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
      confirmOpen = false;
      controls();
      $("shelf-clear").focus();
    } else void send({ action: "surface", open: false });
  });
  return { render, conceal };
}
