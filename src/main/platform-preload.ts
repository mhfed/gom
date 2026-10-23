import { contextBridge, ipcRenderer } from "electron";
import { installNotificationClickBridge } from "./notification-click.ts";
// Remote pages get no shell IPC, filesystem or credential capability.
if (process.isMainFrame) {
  contextBridge.exposeInMainWorld("__tinNhanNotificationClicked", () =>
    ipcRenderer.send("provider-notification-click"),
  );
  contextBridge.executeInMainWorld({ func: installNotificationClickBridge });
}
