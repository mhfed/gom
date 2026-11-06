import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultNotificationSchedule,
  normalizeNotificationSchedule,
  notificationScheduleAllows,
} from "../src/notification-schedule.ts";

function localTime(day: number, hour: number, minute = 0) {
  const date = new Date(2026, 0, 4 + day, hour, minute, 0, 0);
  return date.getTime();
}

test("disabled work schedule allows notifications and keeps weekday defaults", () => {
  const schedule = defaultNotificationSchedule();
  assert.equal(schedule.enabled, false);
  assert.deepEqual(schedule.days, [1, 2, 3, 4, 5]);
  assert.equal(schedule.startMinute, 9 * 60);
  assert.equal(schedule.endMinute, 18 * 60);
  assert.equal(notificationScheduleAllows(schedule, localTime(0, 2)), true);
});

test("weekday schedule includes start and excludes end boundaries", () => {
  const schedule = {
    enabled: true,
    days: [1, 2, 3, 4, 5],
    startMinute: 9 * 60,
    endMinute: 18 * 60,
  };
  assert.equal(
    notificationScheduleAllows(schedule, localTime(1, 8, 59)),
    false,
  );
  assert.equal(notificationScheduleAllows(schedule, localTime(1, 9)), true);
  assert.equal(
    notificationScheduleAllows(schedule, localTime(1, 17, 59)),
    true,
  );
  assert.equal(notificationScheduleAllows(schedule, localTime(1, 18)), false);
  assert.equal(notificationScheduleAllows(schedule, localTime(6, 12)), false);
});

test("overnight schedule follows the selected start day across midnight", () => {
  const schedule = {
    enabled: true,
    days: [1],
    startMinute: 22 * 60,
    endMinute: 6 * 60,
  };
  assert.equal(
    notificationScheduleAllows(schedule, localTime(1, 21, 59)),
    false,
  );
  assert.equal(notificationScheduleAllows(schedule, localTime(1, 22)), true);
  assert.equal(notificationScheduleAllows(schedule, localTime(2, 5, 59)), true);
  assert.equal(notificationScheduleAllows(schedule, localTime(2, 6)), false);
  assert.equal(notificationScheduleAllows(schedule, localTime(0, 23)), false);
});

test("Sunday overnight schedule continues into Monday", () => {
  const schedule = {
    enabled: true,
    days: [0],
    startMinute: 23 * 60,
    endMinute: 5 * 60,
  };
  assert.equal(
    notificationScheduleAllows(schedule, localTime(0, 23, 30)),
    true,
  );
  assert.equal(notificationScheduleAllows(schedule, localTime(1, 4, 59)), true);
  assert.equal(notificationScheduleAllows(schedule, localTime(1, 5)), false);
});

test("invalid schedule data normalizes to the safe disabled default", () => {
  const fallback = defaultNotificationSchedule();
  assert.deepEqual(
    normalizeNotificationSchedule({
      enabled: true,
      days: [],
      startMinute: 9 * 60,
      endMinute: 18 * 60,
    }),
    fallback,
  );
});
