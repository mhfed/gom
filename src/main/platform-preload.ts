import { contextBridge, ipcRenderer } from "electron";
import {
  installNotificationClickBridge,
  closePageNotifications,
} from "./notification-click.ts";
// Remote pages get no shell IPC, filesystem or credential capability.
if (process.isMainFrame) {
  contextBridge.exposeInMainWorld("__tinNhanNotificationClicked", () =>
    ipcRenderer.send("provider-notification-click"),
  );
  contextBridge.executeInMainWorld({ func: installNotificationClickBridge });
  let macroRecording: number | null = null;
  ipcRenderer.on("gom-macro-recording", (_event, token: unknown) => {
    macroRecording =
      typeof token === "number" && Number.isSafeInteger(token) && token >= 0
        ? token
        : null;
  });
  window.addEventListener(
    "wheel",
    (event) => {
      if (macroRecording === null || !event.isTrusted) return;
      ipcRenderer.send("provider-macro-wheel", {
        token: macroRecording,
        x: event.clientX,
        y: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
      });
    },
    { capture: true, passive: true },
  );
  ipcRenderer.on("gom-private-notifications", () => {
    contextBridge.executeInMainWorld({ func: closePageNotifications });
  });
}
