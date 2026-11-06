export interface NotificationSchedule {
  enabled: boolean;
  /** JavaScript local weekdays: 0 Sunday through 6 Saturday. */
  days: number[];
  startMinute: number;
  endMinute: number;
}

export function defaultNotificationSchedule(): NotificationSchedule {
  return {
    enabled: false,
    days: [1, 2, 3, 4, 5],
    startMinute: 9 * 60,
    endMinute: 18 * 60,
  };
}

export function isNotificationSchedule(
  value: unknown,
): value is NotificationSchedule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const schedule = value as Record<string, unknown>;
  if (
    Object.keys(schedule).length !== 4 ||
    Object.keys(schedule).some(
      (key) => !["enabled", "days", "startMinute", "endMinute"].includes(key),
    ) ||
    typeof schedule.enabled !== "boolean" ||
    !Array.isArray(schedule.days) ||
    schedule.days.length > 7 ||
    schedule.days.some(
      (day) =>
        !Number.isInteger(day) || (day as number) < 0 || (day as number) > 6,
    ) ||
    new Set(schedule.days).size !== schedule.days.length ||
    !Number.isInteger(schedule.startMinute) ||
    (schedule.startMinute as number) < 0 ||
    (schedule.startMinute as number) >= 24 * 60 ||
    !Number.isInteger(schedule.endMinute) ||
    (schedule.endMinute as number) < 0 ||
    (schedule.endMinute as number) >= 24 * 60 ||
    schedule.startMinute === schedule.endMinute ||
    (schedule.enabled && schedule.days.length === 0)
  )
    return false;
  return true;
}

export function normalizeNotificationSchedule(
  value: unknown,
): NotificationSchedule {
  if (!isNotificationSchedule(value)) return defaultNotificationSchedule();
  return {
    enabled: value.enabled,
    days: [...value.days].sort((left, right) => left - right),
    startMinute: value.startMinute,
    endMinute: value.endMinute,
  };
}

/** Whether the configured work interval currently permits notifications. */
export function notificationScheduleAllows(
  schedule: NotificationSchedule | undefined,
  now = Date.now(),
): boolean {
  if (!schedule || !schedule.enabled) return true;
  const date = new Date(now);
  if (!Number.isFinite(date.getTime()) || schedule.days.length === 0)
    return false;
  const day = date.getDay();
  const minute = date.getHours() * 60 + date.getMinutes();
  if (schedule.startMinute < schedule.endMinute)
    return (
      schedule.days.includes(day) &&
      minute >= schedule.startMinute &&
      minute < schedule.endMinute
    );
  if (minute >= schedule.startMinute) return schedule.days.includes(day);
  if (minute < schedule.endMinute) return schedule.days.includes((day + 6) % 7);
  return false;
}
