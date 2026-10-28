// Standalone: serialized by contextBridge into the remote main world.
// Native Notification owns its content, permission and delivery; only clicks cross.
export function installNotificationClickBridge() {
  const w = window as unknown as {
    Notification: typeof Notification;
    __tinNhanNotificationClicked?: () => void;
    __gomCloseNotifications?: () => void;
  };
  const Native = w.Notification;
  if (typeof Native !== "function") return;
  const notifications = new Set<Notification>();
  w.__gomCloseNotifications = () => {
    for (const notification of notifications) notification.close();
    notifications.clear();
  };
  w.Notification = new Proxy(Native, {
    construct(target, args) {
      const notification = Reflect.construct(target, args) as Notification;
      notifications.add(notification);
      notification.addEventListener("close", () =>
        notifications.delete(notification),
      );
      notification.addEventListener("click", () =>
        w.__tinNhanNotificationClicked?.(),
      );
      return notification;
    },
  });
}
// Main asks the preload to close page-created alerts without reading their text.
export function closePageNotifications() {
  (
    window as unknown as { __gomCloseNotifications?: () => void }
  ).__gomCloseNotifications?.();
}
