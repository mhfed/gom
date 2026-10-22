import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, AppState } from "../shared.ts";
const bridge: DesktopBridge = {
  state: () => ipcRenderer.invoke("desktop", "state"),
  activate: (id) => ipcRenderer.invoke("desktop", "activate", id),
  reload: () => ipcRenderer.invoke("desktop", "reload"),
  openBrowser: () => ipcRenderer.invoke("desktop", "browser"),
  toggleSidebar: () => ipcRenderer.invoke("desktop", "toggle-sidebar"),
  settings: () => ipcRenderer.invoke("desktop", "settings"),
  importMessenger: (id) => ipcRenderer.invoke("desktop", "import", id),
  changed(callback) {
    const listener = (_: unknown, state: AppState) => callback(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  },
};
contextBridge.exposeInMainWorld("desktop", bridge);
