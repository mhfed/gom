import type { AppState } from "../shared.ts";

const localDateTime = (time: number) => {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};
const endLabel = (time: number) =>
  new Date(time).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

export function createFocusUI(openSettings: () => Promise<void>) {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const form = $<HTMLFormElement>("focus-form");
  const duration = $<HTMLSelectElement>("focus-duration");
  const until = $<HTMLInputElement>("focus-until");
  const audio = $<HTMLInputElement>("focus-mute-audio");
  const start = $<HTMLButtonElement>("focus-start");
  const stop = $<HTMLButtonElement>("focus-stop");
  const toolbar = $<HTMLButtonElement>("focus-open");
  let busy = false,
    dirty = false,
    signature: string | undefined,
    rendered: string | undefined;
  function updateCustom() {
    const custom = duration.value === "custom";
    $("focus-custom").hidden = !custom;
    until.required = custom;
    until.disabled = !custom;
    // Validate against the current clock on submit; native min/max would go
    // stale while this form stays open overnight and prevent submission.
    if (custom && !until.value)
      until.value = localDateTime(Date.now() + 30 * 60_000);
  }
  duration.onchange = () => {
    dirty = true;
    updateCustom();
  };
  form.oninput = () => {
    dirty = true;
    $("focus-feedback").textContent = "";
  };
  async function submit(action: "start" | "stop") {
    if (busy) return;
    const endsAt =
      duration.value === "custom"
        ? new Date(until.value).getTime()
        : Date.now() + Number(duration.value) * 60_000;
    if (
      action === "start" &&
      (!Number.isFinite(endsAt) ||
        endsAt <= Date.now() ||
        endsAt - Date.now() > 86_400_000)
    ) {
      $("focus-feedback").textContent =
        "Chọn giờ kết thúc trong tương lai, tối đa 24 giờ.";
      until.focus();
      return;
    }
    busy = true;
    start.disabled = true;
    stop.disabled = true;
    $("focus-feedback").textContent = "";
    try {
      const result = await window.desktop.focus(
        action,
        action === "start" ? { endsAt, muteAudio: audio.checked } : undefined,
      );
      if (!result.ok)
        $("focus-feedback").textContent =
          result.message || "Chưa đổi được phiên Tập trung. Bạn thử lại nhé.";
      else dirty = false;
    } catch {
      $("focus-feedback").textContent =
        "Chưa đổi được phiên Tập trung. Bạn thử lại nhé.";
    } finally {
      busy = false;
      start.disabled = false;
      stop.disabled = false;
    }
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    void submit("start");
  };
  stop.onclick = () => {
    void submit("stop");
  };
  const open = async () => {
    await openSettings();
    duration.focus();
  };
  toolbar.onclick = open;
  updateCustom();
  return {
    open,
    sync(state: AppState) {
      const focus = state.preferences.focus;
      const active = !!focus && focus.endsAt > Date.now();
      const relevant = JSON.stringify([
        focus,
        active,
        state.preferences.paused,
      ]);
      if (rendered === relevant) return;
      rendered = relevant;
      const next = JSON.stringify(focus);
      if (signature !== next && !dirty)
        audio.checked = focus?.muteAudio ?? false;
      signature = next;
      toolbar.hidden = !active;
      toolbar.title = toolbar.ariaLabel = active
        ? "Đang tập trung đến " + endLabel(focus.endsAt)
        : "Tập trung có hẹn giờ";
      $("focus-toolbar-time").textContent = active
        ? new Date(focus.endsAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      $("focus-status").textContent = active
        ? "Đang tập trung đến " +
          endLabel(focus.endsAt) +
          (focus.muteAudio ? " · Đã tắt âm thanh trang." : ".")
        : "Chọn khoảng thời gian để tạm ngưng thông báo.";
      $("focus-manual-note").hidden = !state.preferences.paused;
      start.textContent = active ? "Cập nhật phiên" : "Bắt đầu tập trung";
      stop.hidden = !active;
      form.dataset.active = String(active);
    },
  };
}
