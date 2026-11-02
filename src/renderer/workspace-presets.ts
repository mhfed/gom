import type { AppState } from "../shared.ts";

export function createWorkspacePresetUI(options: {
  getState(): AppState;
}) {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const picker = $<HTMLSelectElement>("workspace-profile");
  const saveDialog = $<HTMLDialogElement>("workspace-save-dialog");
  const saveForm = $<HTMLFormElement>("workspace-save-form");
  const nameInput = $<HTMLInputElement>("workspace-profile-name");
  const deleteDialog = $<HTMLDialogElement>("workspace-delete-dialog");
  let signature = "";
  let generation = 0;
  let busy = false;
  let holdsSurface = false;

  function feedback(message: string, error = false) {
    const node = $("workspace-feedback");
    node.textContent = message;
    node.classList.toggle("form-error", error);
  }
  function reset() {
    generation++;
    busy = false;
    holdsSurface = false;
    signature = "";
    nameInput.value = "";
    $("workspace-delete-name").textContent = "";
    $("workspace-profile-name-error").textContent = "";
    $("workspace-delete-error").textContent = "";
    feedback("");
    if (saveDialog.open) saveDialog.close();
    if (deleteDialog.open) deleteDialog.close();
  }
  async function open(dialog: HTMLDialogElement, focus: HTMLElement) {
    if (busy || dialog.open) return;
    const token = ++generation;
    feedback("");
    holdsSurface = true;
    dialog.showModal();
    try {
      await window.desktop.command(true);
      if (token === generation) focus.focus();
    } catch {
      if (token === generation) reset();
    }
  }
  async function releaseSurface() {
    if (!holdsSurface) return;
    holdsSurface = false;
    await window.desktop.command(false).catch(() => {});
  }
  async function submit(
    action: "save" | "delete",
    data: { id?: string; name?: string },
  ) {
    if (busy) return;
    busy = true;
    const token = generation;
    const lockVersion = options.getState().privateSpace?.lockVersion ?? -1;
    try {
      const result = await window.desktop.workspaceProfile(action, {
        ...data,
        lockVersion,
      });
      if (
        token !== generation ||
        lockVersion !== options.getState().privateSpace?.lockVersion
      )
        return;
      if (!result.ok) {
        const errorId =
          action === "save"
            ? "workspace-profile-name-error"
            : "workspace-delete-error";
        $(errorId).textContent =
          result.message || "Chưa cập nhật được không gian.";
        return;
      }
      feedback(result.message || "Đã cập nhật không gian.");
      saveDialog.close();
      deleteDialog.close();
      await releaseSurface();
    } catch {
      if (token === generation) {
        const errorId =
          action === "save"
            ? "workspace-profile-name-error"
            : "workspace-delete-error";
        $(errorId).textContent =
          "Chưa cập nhật được không gian. Bạn thử lại nhé.";
      }
    } finally {
      if (token === generation) busy = false;
    }
  }

  picker.onchange = () => {
    const id = picker.value || null;
    const lockVersion = options.getState().privateSpace?.lockVersion ?? -1;
    void window.desktop
      .workspaceProfile("switch", { id, lockVersion })
      .then((result) => {
        if (!result.ok) {
          feedback(result.message || "Chưa chuyển được không gian.", true);
          sync(options.getState());
        }
      })
      .catch(() => {
        feedback("Chưa chuyển được không gian. Bạn thử lại nhé.", true);
        sync(options.getState());
      });
  };
  $("workspace-profile-save").onclick = () =>
    void open(saveDialog, nameInput);
  $("workspace-profile-delete").onclick = () => {
    const active = options.getState().workspaceProfiles?.items.find(
      (item) => item.id === options.getState().workspaceProfiles?.activeId,
    );
    $("workspace-delete-name").textContent = active?.name || "";
    void open(deleteDialog, $("workspace-delete-confirm"));
  };
  saveForm.onsubmit = (event) => {
    event.preventDefault();
    void submit("save", { name: nameInput.value });
  };
  $("workspace-save-cancel").onclick = () => saveDialog.close();
  $("workspace-delete-cancel").onclick = () => deleteDialog.close();
  $("workspace-delete-confirm").onclick = () => {
    const id = options.getState().workspaceProfiles?.activeId;
    if (id) void submit("delete", { id });
  };
  for (const dialog of [saveDialog, deleteDialog])
    dialog.oncancel = (event) => {
      event.preventDefault();
      dialog.close();
    };
  for (const dialog of [saveDialog, deleteDialog])
    dialog.onclose = () => {
      if (!saveDialog.open && !deleteDialog.open) void releaseSurface();
    };

  function sync(state: AppState) {
    const profileState = state.workspaceProfiles || {
      activeId: null,
      items: [],
    };
    const next = JSON.stringify(profileState);
    if (next !== signature) {
      signature = next;
      const choices = [new Option("Mặc định", "")];
      for (const item of profileState.items)
        choices.push(new Option(item.name, item.id));
      picker.replaceChildren(...choices);
    }
    picker.value = profileState.activeId || "";
    picker.disabled = state.accountBusy || state.importing;
    $("workspace-profile-save").toggleAttribute(
      "disabled",
      state.accountBusy || state.importing || profileState.items.length >= 12,
    );
    const remove = $<HTMLButtonElement>("workspace-profile-delete");
    remove.hidden = !profileState.activeId;
    remove.disabled = state.accountBusy || state.importing;
  }

  return {
    reset,
    isOpen: () => saveDialog.open || deleteDialog.open,
    sync,
  };
}
