import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, AppState, ProviderId } from "../shared.ts";
const bridge: DesktopBridge = {
  shelf: (request) => ipcRenderer.invoke("desktop", "shelf", request),
  floatChat: () => ipcRenderer.invoke("desktop", "float-chat"),
  privateSpace: (action, data) =>
    ipcRenderer.invoke("desktop", "private-space", { action, data }),
  state: () => ipcRenderer.invoke("desktop", "state"),
  activate: (id) => ipcRenderer.invoke("desktop", "activate", id),
  activateProvider: (provider, focusPage = true) =>
    ipcRenderer.invoke("desktop", "activate-provider", { provider, focusPage }),
  navigationMenu: () => ipcRenderer.invoke("desktop", "navigation-menu"),
  accountMenu: (anchor) =>
    ipcRenderer.invoke("desktop", "account-menu", anchor),
  providerLibrary: (open) =>
    ipcRenderer.invoke("desktop", "provider-library", open),
  welcome: () => ipcRenderer.invoke("desktop", "welcome"),
  providerMenu: (request) =>
    ipcRenderer.invoke("desktop", "provider-menu", request),
  getProviderLogo: (provider, revision) =>
    ipcRenderer.invoke("desktop", "provider-logo-get", { provider, revision }),
  setProviderLogo: (provider, change) =>
    ipcRenderer.invoke("desktop", "provider-logo-set", { provider, change }),
  onProviderLogoEditor(callback) {
    const listener = (_: unknown, provider: ProviderId) => callback(provider);
    ipcRenderer.on("provider-logo-editor", listener);
    return () => ipcRenderer.removeListener("provider-logo-editor", listener);
  },
  pinProvider: (id) => ipcRenderer.invoke("desktop", "provider-pin", id),
  closeProvider: (id) => ipcRenderer.invoke("desktop", "provider-close", id),
  addProvider: (name, url) =>
    ipcRenderer.invoke("desktop", "provider-add", { name, url }),
  accountEditor: (open) =>
    ipcRenderer.invoke("desktop", "account-editor", open),
  addAccount: (provider, name, avatar) =>
    ipcRenderer.invoke("desktop", "account-add", { provider, name, avatar }),
  editAccount: (id, name, avatar) =>
    ipcRenderer.invoke("desktop", "account-edit", { id, name, avatar }),
  moveAccount: (id, direction) =>
    ipcRenderer.invoke("desktop", "account-move", { id, direction }),
  archiveAccount: (id) =>
    ipcRenderer.invoke("desktop", "account-archive", { id }),
  restoreAccount: (id) =>
    ipcRenderer.invoke("desktop", "account-restore", { id }),
  reload: () => ipcRenderer.invoke("desktop", "reload"),
  openBrowser: () => ipcRenderer.invoke("desktop", "browser"),
  back: () => ipcRenderer.invoke("desktop", "back"),
  home: () => ipcRenderer.invoke("desktop", "home"),
  setPreference: (key, value) =>
    ipcRenderer.invoke("desktop", "preference", { key, value }),
  setNotification: (id, choice) =>
    ipcRenderer.invoke("desktop", "notification", { id, choice }),
  testNotification: (id) =>
    ipcRenderer.invoke("desktop", "test-notification", id),
  notificationSettings: () =>
    ipcRenderer.invoke("desktop", "notification-settings"),
  toggleSidebar: () => ipcRenderer.invoke("desktop", "toggle-sidebar"),
  setSidebarWidth: (width) =>
    ipcRenderer.invoke("desktop", "sidebar-width", width),
  setTheme: (theme) => ipcRenderer.invoke("desktop", "theme", theme),
  pinAccount: (id) => ipcRenderer.invoke("desktop", "pin-account", id),
  command: (open) => ipcRenderer.invoke("desktop", "command", open),
  commandClosed: () => ipcRenderer.invoke("desktop", "command-closed"),
  commandRequested(callback) {
    const listener = () => callback();
    ipcRenderer.on("command-toggle", listener);
    return () => ipcRenderer.removeListener("command-toggle", listener);
  },
  settings: () => ipcRenderer.invoke("desktop", "settings"),
  checkUpdates: () => ipcRenderer.invoke("desktop", "updates-check"),
  openUpdateDownload: () => ipcRenderer.invoke("desktop", "updates-download"),
  updatesRequested(callback) {
    const listener = () => callback();
    ipcRenderer.on("updates-requested", listener);
    return () => ipcRenderer.removeListener("updates-requested", listener);
  },
  importSession: (sourceId, accountId) =>
    ipcRenderer.invoke("desktop", "import", { sourceId, accountId }),
  changed(callback) {
    const listener = (_: unknown, state: AppState) => callback(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  },
};
contextBridge.exposeInMainWorld("desktop", bridge);
