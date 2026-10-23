// Standalone: serialized by contextBridge into the remote main world.
// Native Notification owns its content, permission and delivery; only clicks cross.
export function installNotificationClickBridge() {
  const w = window as unknown as {
    Notification: typeof Notification;
    __tinNhanNotificationClicked?: () => void;
  };
  const Native = w.Notification;
  if (typeof Native !== "function") return;
  w.Notification = new Proxy(Native, {
    construct(target, args) {
      const notification = Reflect.construct(target, args) as Notification;
      notification.addEventListener("click", () =>
        w.__tinNhanNotificationClicked?.(),
      );
      return notification;
    },
  });
}
