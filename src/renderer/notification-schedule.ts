import type { AppState } from "../shared.ts";
import {
  isNotificationSchedule,
  normalizeNotificationSchedule,
  notificationScheduleAllows,
  type NotificationSchedule,
} from "../notification-schedule.ts";

const weekdays = [
  { day: 1, label: "Thứ Hai" },
  { day: 2, label: "Thứ Ba" },
  { day: 3, label: "Thứ Tư" },
  { day: 4, label: "Thứ Năm" },
  { day: 5, label: "Thứ Sáu" },
  { day: 6, label: "Thứ Bảy" },
  { day: 0, label: "Chủ nhật" },
];

function nextTransition(schedule: NotificationSchedule, now: number) {
  if (!schedule.enabled) return undefined;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const candidates: number[] = [];
  for (let offset = -1; offset <= 8; offset++) {
    const startDay = new Date(midnight);
    startDay.setDate(startDay.getDate() + offset);
    if (!schedule.days.includes(startDay.getDay())) continue;
    const start = new Date(startDay);
    start.setMinutes(schedule.startMinute);
    const end = new Date(startDay);
    end.setMinutes(schedule.endMinute);
    if (schedule.startMinute > schedule.endMinute)
      end.setDate(end.getDate() + 1);
    candidates.push(start.getTime(), end.getTime());
  }
  const current = notificationScheduleAllows(schedule, now);
  return candidates
    .filter(
      (time) =>
        time > now &&
        notificationScheduleAllows(schedule, time - 1) !==
          notificationScheduleAllows(schedule, time + 1),
    )
    .sort((left, right) => left - right)
    .find((time) => notificationScheduleAllows(schedule, time + 1) !== current);
}

function transitionLabel(time: number) {
  return new Date(time).toLocaleString("vi-VN", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createNotificationScheduleUI() {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const form = $<HTMLFormElement>("notification-schedule-form");
  const enabled = $<HTMLInputElement>("notification-schedule-enabled");
  const start = $<HTMLInputElement>("notification-schedule-start");
  const end = $<HTMLInputElement>("notification-schedule-end");
  const status = $("notification-schedule-status");
  const feedback = $("notification-schedule-feedback");
  let current: AppState | undefined;
  let authoritative: NotificationSchedule | undefined;
  let busy = false;
  let dirty = false;

  const dayInputs = weekdays.map(({ day }) => {
    const input = $<HTMLInputElement>("notification-schedule-day-" + day);
    return { day, input };
  });

  function setControls(schedule: NotificationSchedule) {
    enabled.checked = schedule.enabled;
    start.value = `${String(Math.floor(schedule.startMinute / 60)).padStart(2, "0")}:${String(schedule.startMinute % 60).padStart(2, "0")}`;
    end.value = `${String(Math.floor(schedule.endMinute / 60)).padStart(2, "0")}:${String(schedule.endMinute % 60).padStart(2, "0")}`;
    for (const { day, input } of dayInputs)
      input.checked = schedule.days.includes(day);
  }

  function readControls(): NotificationSchedule {
    const minute = (value: string) => {
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    };
    return {
      enabled: enabled.checked,
      days: dayInputs
        .filter(({ input }) => input.checked)
        .map(({ day }) => day)
        .sort((left, right) => left - right),
      startMinute: minute(start.value),
      endMinute: minute(end.value),
    };
  }

  function renderStatus(schedule: NotificationSchedule) {
    if (!schedule.enabled) {
      status.textContent =
        "Lịch đang tắt; thông báo theo các cài đặt hiện tại.";
      return;
    }
    const now = Date.now();
    const allowed = notificationScheduleAllows(schedule, now);
    const next = nextTransition(schedule, now);
    if (!next) {
      status.textContent = "Chưa có giờ chuyển lịch.";
      return;
    }
    status.textContent = allowed
      ? `Đang trong giờ cho phép; ngoài giờ từ ${transitionLabel(next)}.`
      : `Đang ngoài giờ; thông báo được bật lại ${transitionLabel(next)}.`;
  }

  function setBusy(value: boolean) {
    busy = value;
    for (const input of form.querySelectorAll<HTMLInputElement>("input"))
      input.disabled = value;
  }

  async function save() {
    if (busy) return;
    const rawSchedule: unknown = readControls();
    if (!isNotificationSchedule(rawSchedule)) {
      const invalid = rawSchedule as NotificationSchedule;
      feedback.textContent = invalid.enabled
        ? invalid.days.length === 0
          ? "Chọn ít nhất một ngày để bật lịch."
          : "Giờ bắt đầu và kết thúc phải khác nhau."
        : "Giờ bắt đầu và kết thúc phải khác nhau.";
      return;
    }
    const schedule = rawSchedule;
    dirty = false;
    setBusy(true);
    feedback.textContent = "";
    let saved = false;
    try {
      const result = await window.desktop.setNotificationSchedule(schedule);
      if (!result.ok)
        feedback.textContent =
          result.message || "Chưa lưu được lịch thông báo.";
      else {
        authoritative = schedule;
        saved = true;
        feedback.textContent = "Đã lưu lịch thông báo.";
      }
    } catch {
      feedback.textContent = "Chưa lưu được lịch thông báo. Bạn thử lại nhé.";
    } finally {
      setBusy(false);
      if (!saved && authoritative) setControls(authoritative);
      if (current)
        renderStatus(authoritative || current.preferences.notificationSchedule);
    }
  }

  form.oninput = () => {
    dirty = true;
    feedback.textContent = "";
  };
  form.onchange = () => void save();
  form.onsubmit = (event) => event.preventDefault();

  return {
    sync(state: AppState) {
      current = state;
      const schedule = normalizeNotificationSchedule(
        state.preferences.notificationSchedule,
      );
      if (!busy && !dirty) {
        authoritative = schedule;
        setControls(schedule);
      }
      renderStatus(authoritative || schedule);
    },
  };
}
