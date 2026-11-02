import type { AppState, DesktopBridge } from "../shared.ts";
import type { BackupPreview } from "../backup-types.ts";
export function createBackupUI(options: { getState(): AppState | undefined }) {
  const $ = (id: string) => document.getElementById(id)!;
  const text = (id: string, value: string) => {
    const node = $(id);
    if (node.textContent !== value) node.textContent = value;
  };
  let preview: BackupPreview | undefined,
    busy = false,
    generation = 0;
  function reset() {
    generation++;
    preview = undefined;
    busy = false;
    const details = $("backup-preview").querySelector("details")!;
    if (details.open) details.open = false;
    text("backup-feedback", "");
    renderPreview();
  }
  function renderPreview() {
    const node = $("backup-preview");
    if (node.hidden === Boolean(preview)) node.hidden = !preview;
    if (!preview) {
      if ($("backup-accounts").childNodes.length)
        $("backup-accounts").replaceChildren();
      if ($("backup-sites").childNodes.length)
        $("backup-sites").replaceChildren();
      text("backup-file", "");
      for (const id of [
        "backup-created",
        "backup-added",
        "backup-updated",
        "backup-providers",
        "backup-logos",
      ])
        text(id, "");
      return;
    }
    text("backup-file", preview.fileName);
    text("backup-created", new Date(preview.createdAt).toLocaleString("vi-VN"));
    text("backup-added", String(preview.added));
    text("backup-updated", String(preview.updated));
    text("backup-providers", String(preview.providers));
    text("backup-logos", String(preview.logos));
    for (const [id, values] of [
      ["backup-accounts", preview.accounts],
      ["backup-sites", preview.sites],
    ] as const) {
      const list = $(id);
      list.replaceChildren(
        ...values.map((value) => {
          const item = document.createElement("li");
          item.textContent = value;
          return item;
        }),
      );
    }
  }
  function sync(state: AppState) {
    const privateSpace = !!state.privateSpace?.unlocked;
    text(
      "backup-scope-message",
      privateSpace
        ? "Chuyển sang Không gian thường để sao lưu hoặc khôi phục."
        : state.backupMessage ||
            "Tệp chứa tên tài khoản và địa chỉ website. Hãy lưu ở nơi bạn tin tưởng.",
    );
    for (const id of [
      "backup-export",
      "backup-import",
      "backup-restore",
      "backup-cancel",
      "backup-folder",
    ]) {
      const button = $(id) as HTMLButtonElement,
        disabled =
          busy ||
          state.accountBusy ||
          state.importing ||
          privateSpace ||
          !!state.catalogWarning;
      if (button.disabled !== disabled) button.disabled = disabled;
    }
  }
  async function action(action: Parameters<DesktopBridge["backup"]>[0]) {
    const state = options.getState();
    if (!state?.privateSpace || busy) return;
    const version = generation;
    busy = true;
    sync(state);
    text("backup-feedback", "");
    try {
      const result = await window.desktop.backup(action, {
        lockVersion: state.privateSpace.lockVersion!,
        ...(preview ? { token: preview.token } : {}),
      });
      if (version !== generation) return;
      if (result.preview) preview = result.preview;
      if (action === "cancel" || (action === "preview" && !result.preview))
        preview = undefined;
      text("backup-feedback", result.message || "");
      renderPreview();
    } catch {
      if (version === generation)
        text("backup-feedback", "Chưa hoàn tất thao tác. Bạn thử lại nhé.");
    } finally {
      if (version === generation) {
        busy = false;
        const current = options.getState();
        if (current) sync(current);
      }
    }
  }
  for (const [id, command] of [
    ["backup-export", "export"],
    ["backup-import", "preview"],
    ["backup-restore", "restore"],
    ["backup-cancel", "cancel"],
    ["backup-folder", "folder"],
  ] as const)
    $(id).onclick = () => void action(command);
  return { sync, reset };
}
