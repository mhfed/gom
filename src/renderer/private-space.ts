import type { Account, AppState } from "../shared.ts";

export function createPrivateSpaceUI(options: {
  getState(): AppState;
  showAccounts(): void;
}) {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const dialog = $<HTMLDialogElement>("private-space-dialog");
  const form = $<HTMLFormElement>("private-space-form");
  const password = $<HTMLInputElement>("private-password");
  const nextPassword = $<HTMLInputElement>("private-new-password");
  const confirmation = $<HTMLInputElement>("private-password-confirm");
  const submit = $<HTMLButtonElement>("private-space-submit");
  let mode: "setup" | "unlock" | "change-password" = "unlock";
  let pendingAccount: { id: string; private: boolean } | null = null;
  let generation = 0;
  let busy = false;
  let stateSignature = "";
  const clear = () => {
    password.value = "";
    nextPassword.value = "";
    confirmation.value = "";
    confirmation.setCustomValidity("");
  };
  const feedback = (message: string) => {
    $("private-space-feedback").textContent = message;
  };

  function reset() {
    generation++;
    busy = false;
    pendingAccount = null;
    clear();
    submit.disabled = false;
    $("private-space-error").textContent = "";
    if (dialog.open) dialog.close();
  }
  function cancel() {
    const wasBusy = busy;
    reset();
    if (wasBusy) void window.desktop.privateSpace("lock");
  }
  async function open(
    request: typeof mode,
    account?: { id: string; private: boolean },
  ) {
    if (busy || dialog.open) return;
    const token = ++generation;
    options.showAccounts();
    await window.desktop.settings();
    if (token !== generation) return;
    mode = request;
    pendingAccount = account ?? null;
    clear();
    $("private-space-error").textContent = "";
    const creates = mode !== "unlock";
    $("private-space-title").textContent =
      mode === "setup"
        ? "Đặt mật khẩu không gian kín"
        : mode === "change-password"
          ? "Đổi mật khẩu"
          : "Mở không gian kín";
    $("private-password-label").textContent =
      mode === "change-password" ? "Mật khẩu hiện tại" : "Mật khẩu";
    password.autocomplete =
      mode === "setup" ? "new-password" : "current-password";
    password.minLength = mode === "setup" ? 8 : 1;
    $("private-new-password-field").hidden = mode !== "change-password";
    nextPassword.required = mode === "change-password";
    $("private-confirm-field").hidden = !creates;
    confirmation.required = creates;
    submit.textContent =
      mode === "setup"
        ? "Tạo mật khẩu"
        : mode === "change-password"
          ? "Lưu mật khẩu"
          : "Mở không gian kín";
    submit.disabled = options.getState().privateSpace?.unavailable === true;
    if (submit.disabled)
      $("private-space-error").textContent =
        "Không đọc được cấu hình khóa. Các tài khoản kín vẫn được giữ khóa.";
    dialog.showModal();
    password.focus();
  }
  async function membership(account: { id: string; private: boolean }) {
    const token = generation;
    try {
      const result = await window.desktop.privateSpace("membership", {
        accountId: account.id,
        private: account.private,
      });
      if (token !== generation) return;
      feedback(
        result.ok
          ? account.private
            ? "Đã đưa tài khoản vào không gian kín. Thông báo của tài khoản này được tắt."
            : "Đã đưa tài khoản ra ngoài."
          : result.message || "Chưa thay đổi được tài khoản.",
      );
    } catch {
      if (token === generation)
        feedback("Chưa thay đổi được tài khoản. Bạn thử lại nhé.");
    }
  }
  function move(account: Account) {
    const request = { id: account.id, private: !account.private };
    const state = options.getState().privateSpace;
    if (!state?.unlocked)
      void open(state?.configured ? "unlock" : "setup", request);
    else void membership(request);
  }
  async function lock() {
    reset();
    feedback("");
    await window.desktop.privateSpace("lock");
  }
  function enter() {
    const state = options.getState().privateSpace;
    if (state?.unlocked) void lock();
    else void open(state?.configured ? "unlock" : "setup");
  }
  $("private-space-toggle").onclick = enter;
  $("private-space-open").onclick = enter;
  $("private-space-change").onclick = () => void open("change-password");
  $("private-space-cancel").onclick = cancel;
  dialog.oncancel = (event) => {
    event.preventDefault();
    cancel();
  };
  dialog.onclose = clear;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancel();
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const desired =
      mode === "change-password" ? nextPassword.value : password.value;
    if (mode !== "unlock" && desired !== confirmation.value) {
      $("private-space-error").textContent = "Hai lần nhập mật khẩu chưa khớp.";
      confirmation.focus();
      return;
    }
    busy = true;
    submit.disabled = true;
    $("private-space-error").textContent = "";
    const token = generation;
    const data = {
      password: password.value,
      ...(mode === "change-password"
        ? { newPassword: nextPassword.value }
        : {}),
    };
    clear();
    try {
      const result = await window.desktop.privateSpace(mode, data);
      if (token !== generation) return;
      if (!result.ok) {
        $("private-space-error").textContent =
          result.message || "Chưa mở được không gian kín.";
        password.focus();
        return;
      }
      const account = pendingAccount;
      pendingAccount = null;
      dialog.close();
      feedback(
        mode === "change-password"
          ? "Đã đổi mật khẩu."
          : "Không gian kín đã mở. Bạn có thể quản lý các tài khoản kín tại đây.",
      );
      if (account) await membership(account);
    } catch {
      if (token === generation)
        $("private-space-error").textContent =
          "Chưa hoàn tất thao tác. Bạn thử lại nhé.";
    } finally {
      data.password = "";
      if ("newPassword" in data) data.newPassword = "";
      if (token === generation) {
        busy = false;
        submit.disabled = false;
      }
    }
  };
  return {
    move,
    reset,
    sync(state: AppState) {
      const next = JSON.stringify(state.privateSpace);
      if (next === stateSignature) return;
      stateSignature = next;
      const unlocked = state.privateSpace?.unlocked === true;
      const configured = state.privateSpace?.configured === true;
      const label = unlocked
        ? "Khóa không gian kín"
        : configured
          ? "Mở không gian kín"
          : "Thiết lập không gian kín";
      $("private-space-toggle").title = label;
      $("private-space-toggle").setAttribute("aria-label", label);
      $("private-space-toggle").classList.toggle("active", unlocked);
      $("private-space-open").textContent = label;
      $("private-space-change").hidden = !unlocked;
      $("private-space-status").textContent = state.privateSpace?.unavailable
        ? "Cấu hình khóa chưa đọc được. Tài khoản kín vẫn được giữ khóa."
        : unlocked
          ? "Đang mở · khóa nhanh bằng nút ổ khóa hoặc ⌘/Ctrl Shift L."
          : configured
            ? "Đã khóa · nhập mật khẩu để mở các tài khoản kín."
            : "Đặt mật khẩu, rồi chọn tài khoản cần đưa vào không gian kín.";
    },
  };
}
