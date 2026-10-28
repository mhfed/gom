import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import {
  installNotificationClickBridge,
  closePageNotifications,
} from "../src/main/notification-click.ts";
test("native Notification wrapper creates exactly one real notification, preserves static permission and forwards only clicks", () => {
  let created = 0,
    clicked = 0;
  class NativeNotification extends EventTarget {
    static permission = "granted";
    static requestPermission() {
      return Promise.resolve("granted");
    }
    constructor(_title: string) {
      super();
      created++;
    }
    close() {}
  }
  const win = {
    Notification: NativeNotification,
    __tinNhanNotificationClicked: () => {
      clicked++;
    },
  };
  runInNewContext(`(${installNotificationClickBridge.toString()})()`, {
    window: win,
  });
  const n = new win.Notification("private text stays in remote page");
  assert.equal(created, 1);
  assert.equal(win.Notification.permission, "granted");
  assert.equal(n instanceof NativeNotification, true);
  n.dispatchEvent(new Event("show"));
  assert.equal(clicked, 0);
  n.dispatchEvent(new Event("click"));
  assert.equal(clicked, 1);
  n.close();
});
test("private transition closes tracked page notifications without forwarding their content", () => {
  let closed = 0;
  class Native extends EventTarget {
    close() {
      closed++;
      this.dispatchEvent(new Event("close"));
    }
  }
  const window = { Notification: Native };
  runInNewContext(`(${installNotificationClickBridge.toString()})()`, {
    window,
    Set,
  });
  new window.Notification();
  new window.Notification();
  runInNewContext(`(${closePageNotifications.toString()})()`, { window });
  assert.equal(closed, 2);
  runInNewContext(`(${closePageNotifications.toString()})()`, { window });
  assert.equal(closed, 2);
});
