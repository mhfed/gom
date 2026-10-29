import { contextBridge, ipcRenderer } from "electron";

interface FloatingSnapshot {
  detached: boolean;
  collapsed: boolean;
  pinned: boolean;
  provider: string;
  account: string;
}
type FloatingAction = "collapse" | "expand" | "return" | "pin" | "drag";

// This small capability is available only to Gom's floating shell. It never
// exposes desktop account APIs, Node, or the hosted provider's WebContents.
contextBridge.exposeInMainWorld("gomFloating", {
  state: (): Promise<FloatingSnapshot> =>
    ipcRenderer.invoke("gom-floating", "state"),
  command: (
    action: FloatingAction,
    data?: { dx: number; dy: number; end?: boolean },
  ): Promise<void> => ipcRenderer.invoke("gom-floating", action, data),
  changed(callback: (state: FloatingSnapshot) => void) {
    const listener = (_event: unknown, state: FloatingSnapshot) =>
      callback(state);
    ipcRenderer.on("gom-floating-state", listener);
    return () => ipcRenderer.removeListener("gom-floating-state", listener);
  },
});
