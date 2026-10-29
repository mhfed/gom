import { BrowserWindow, ipcMain, screen, type WebContentsView } from "electron";
import { join } from "node:path";
import {
  floatingBounds,
  moveBubbleBounds,
  snapBubbleBounds,
  type FloatingRect,
} from "./floating-geometry.ts";

export interface FloatingSnapshot {
  accountId: string | null;
  detached: boolean;
  collapsed: boolean;
  pinned: boolean;
  provider: string;
  account: string;
}
interface FloatingOptions {
  mainWindow: BrowserWindow;
  directory: string;
  icon: string;
  canAccess(id: string): boolean;
  describe(id: string): { provider: string; account: string; private: boolean };
  onChange(): void;
  onReturn(id: string): void;
}

// A provider page has one owner. Detaching reparents the existing native view;
// neither its session nor its document/composer is recreated by this controller.
export class FloatingChat {
  private readonly options: FloatingOptions;
  private panel: BrowserWindow | null = null;
  private bubble: BrowserWindow | null = null;
  private loading: Promise<void> | null = null;
  private selected: { id: string; view: WebContentsView } | null = null;
  private collapsed = false;
  private pinned = true;
  private closing = false;
  private transitioning = 0;
  private generation = 0;
  private savedBounds: FloatingRect | undefined;
  private savedBubble: FloatingRect | undefined;
  private snapTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly escape = (event: Electron.Event, input: Electron.Input) => {
    if (
      input.type === "keyDown" &&
      input.key === "Escape" &&
      !input.isComposing &&
      this.accessible()
    ) {
      event.preventDefault();
      this.collapse();
    }
  };
  private readonly displayChanged = () => {
    if (this.closing) return;
    if (this.panel && !this.panel.isDestroyed()) {
      const bounds = this.panel.getBounds();
      this.panel.setBounds(
        floatingBounds(screen.getDisplayMatching(bounds).workArea, bounds),
      );
    }
    this.snapBubble();
  };

  constructor(options: FloatingOptions) {
    this.options = options;
    ipcMain.handle("gom-floating", (event, action: unknown, data: unknown) => {
      const owner = [this.panel, this.bubble].find(
        (window) =>
          window &&
          !window.isDestroyed() &&
          event.sender === window.webContents &&
          event.senderFrame === window.webContents.mainFrame,
      );
      if (!owner) throw new Error("untrusted-floating-request");
      if (action === "state") return this.snapshot();
      if (!this.accessible()) {
        this.conceal();
        return;
      }
      if (action === "collapse") this.collapse();
      else if (action === "expand") this.expand();
      else if (action === "return") this.returnToMain();
      else if (action === "pin") {
        this.pinned = !this.pinned;
        if (this.panel && !this.panel.isDestroyed())
          this.panel.setAlwaysOnTop(this.pinned, "floating");
        this.notify();
      } else if (action === "drag" && owner === this.bubble) this.drag(data);
    });
    screen.on("display-removed", this.displayChanged);
    screen.on("display-metrics-changed", this.displayChanged);
  }

  get accountId(): string | null {
    return this.selected?.id ?? null;
  }
  isFocused(): boolean {
    return (
      !!this.selected &&
      !this.collapsed &&
      !!this.panel &&
      !this.panel.isDestroyed() &&
      this.panel.isFocused()
    );
  }
  snapshot(): FloatingSnapshot {
    const accessible = this.accessible();
    const description =
      accessible && this.selected
        ? this.options.describe(this.selected.id)
        : null;
    return {
      accountId: accessible ? this.accountId : null,
      detached: accessible,
      collapsed: accessible && this.collapsed,
      pinned: this.pinned,
      provider: description?.provider ?? "",
      account: description?.account ?? "",
    };
  }
  private accessible(): boolean {
    return (
      !this.closing &&
      !!this.selected &&
      !this.selected.view.webContents.isDestroyed() &&
      this.options.canAccess(this.selected.id)
    );
  }
  private notify() {
    const snapshot = this.snapshot();
    for (const window of [this.panel, this.bubble])
      if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
        window.webContents.send("gom-floating-state", snapshot);
    this.options.onChange();
  }
  private layout() {
    if (!this.panel || this.panel.isDestroyed() || !this.selected) return;
    const [width, height] = this.panel.getContentSize();
    this.selected.view.setBounds({
      x: 0,
      y: 45,
      width,
      height: Math.max(0, height - 45),
    });
    this.selected.view.setVisible(!this.collapsed && this.accessible());
  }
  private workArea() {
    const bounds =
      this.panel && !this.panel.isDestroyed()
        ? this.panel.getBounds()
        : this.options.mainWindow.getBounds();
    return screen.getDisplayMatching(bounds).workArea;
  }
  private async windows() {
    if (this.loading) return this.loading;
    if (
      this.panel &&
      !this.panel.isDestroyed() &&
      this.bubble &&
      !this.bubble.isDestroyed()
    )
      return;
    this.loading = (async () => {
      const bounds = floatingBounds(this.workArea(), this.savedBounds);
      const preferences = {
        preload: join(this.options.directory, "floating-preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      };
      const panel = new BrowserWindow({
        ...bounds,
        show: false,
        title: "Gom · Chat nổi",
        frame: false,
        minWidth: Math.min(340, bounds.width),
        minHeight: Math.min(360, bounds.height),
        icon: this.options.icon,
        backgroundColor: "#f7f7f2",
        alwaysOnTop: this.pinned,
        autoHideMenuBar: true,
        maximizable: false,
        fullscreenable: false,
        webPreferences: preferences,
      });
      this.panel = panel;
      const bubbleBounds = snapBubbleBounds(
        this.savedBubble ?? bounds,
        this.workArea(),
      );
      const bubble = new BrowserWindow({
        ...bubbleBounds,
        show: false,
        title: "Gom",
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        hasShadow: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        icon: this.options.icon,
        webPreferences: preferences,
      });
      this.bubble = bubble;
      for (const window of [panel, bubble]) {
        window.setMenu(null);
        window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        window.webContents.on("will-navigate", (event) =>
          event.preventDefault(),
        );
        window.on("show", () => {
          if (!this.accessible()) this.conceal();
          else if (
            (window === panel && this.collapsed) ||
            (window === bubble && !this.collapsed)
          ) {
            this.transitioning++;
            try {
              window.hide();
            } finally {
              this.transitioning--;
            }
          }
        });
      }
      panel.webContents.on("before-input-event", this.escape);
      panel.on("resize", () => {
        this.savedBounds = panel.getBounds();
        this.layout();
      });
      panel.on("move", () => {
        this.savedBounds = panel.getBounds();
      });
      panel.on("close", (event) => {
        if (!this.closing) {
          event.preventDefault();
          this.collapse();
        }
      });
      panel.on("hide", () => {
        if (!this.closing && !this.transitioning && this.selected)
          this.collapse();
      });
      panel.on("minimize", () => {
        if (!this.closing && !this.transitioning && this.selected)
          this.collapse();
      });
      bubble.on("close", (event) => {
        if (!this.closing) {
          event.preventDefault();
          this.returnToMain();
        }
      });
      await Promise.all([
        panel.loadFile(join(this.options.directory, "floating.html"), {
          query: { mode: "panel" },
        }),
        bubble.loadFile(join(this.options.directory, "floating.html"), {
          query: { mode: "bubble" },
        }),
      ]);
    })()
      .catch((error: unknown) => {
        for (const window of [this.panel, this.bubble])
          if (window && !window.isDestroyed()) window.destroy();
        this.panel = this.bubble = null;
        throw error;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  async detach(id: string, view: WebContentsView): Promise<boolean> {
    if (
      this.closing ||
      view.webContents.isDestroyed() ||
      !this.options.canAccess(id)
    )
      return false;
    if (this.selected?.id === id) {
      this.expand();
      return true;
    }
    this.returnToMain(false);
    const generation = ++this.generation;
    this.selected = { id, view };
    this.collapsed = false;
    view.setVisible(false);
    view.webContents.on("before-input-event", this.escape);
    this.notify();
    try {
      await this.windows();
      if (
        generation !== this.generation ||
        !this.accessible() ||
        !this.panel ||
        this.panel.isDestroyed()
      )
        return false;
      if (this.options.mainWindow.contentView.children.includes(view))
        this.options.mainWindow.contentView.removeChildView(view);
      this.panel.contentView.addChildView(view);
      this.expand();
      return true;
    } catch {
      if (generation === this.generation) this.returnToMain(false);
      return false;
    }
  }
  private collapse() {
    if (!this.accessible()) {
      this.conceal();
      return;
    }
    if (
      !this.panel ||
      this.panel.isDestroyed() ||
      !this.bubble ||
      this.bubble.isDestroyed()
    )
      return;
    this.collapsed = true;
    this.selected!.view.setVisible(false);
    this.transitioning++;
    try {
      if (this.panel.isMinimized()) this.panel.restore();
      this.panel.hide();
      this.snapBubble();
      this.bubble.showInactive();
    } finally {
      this.transitioning--;
    }
    this.notify();
  }
  private expand() {
    if (!this.accessible()) {
      this.conceal();
      return;
    }
    if (
      !this.panel ||
      this.panel.isDestroyed() ||
      !this.bubble ||
      this.bubble.isDestroyed()
    )
      return;
    clearTimeout(this.snapTimer);
    this.collapsed = false;
    this.transitioning++;
    try {
      this.bubble.hide();
      if (this.panel.isMinimized()) this.panel.restore();
      this.panel.setBounds(
        floatingBounds(
          this.workArea(),
          this.savedBounds ?? this.panel.getBounds(),
        ),
      );
      this.panel.setAlwaysOnTop(this.pinned, "floating");
      this.layout();
      this.panel.show();
      this.panel.focus();
      this.selected!.view.webContents.focus();
    } finally {
      this.transitioning--;
    }
    this.notify();
  }
  private drag(raw: unknown) {
    if (
      !this.collapsed ||
      !this.bubble ||
      this.bubble.isDestroyed() ||
      !raw ||
      typeof raw !== "object"
    )
      return;
    const { dx, dy, end } = raw as {
      dx?: unknown;
      dy?: unknown;
      end?: unknown;
    };
    if (
      typeof dx !== "number" ||
      typeof dy !== "number" ||
      !Number.isFinite(dx) ||
      !Number.isFinite(dy) ||
      Math.abs(dx) > 4096 ||
      Math.abs(dy) > 4096
    )
      return;
    const bounds = this.bubble.getBounds();
    const point = {
      x: bounds.x + dx + bounds.width / 2,
      y: bounds.y + dy + bounds.height / 2,
    };
    const work = screen.getDisplayNearestPoint(point).workArea;
    this.bubble.setBounds(moveBubbleBounds(bounds, { dx, dy }, work));
    clearTimeout(this.snapTimer);
    if (end === true) this.snapBubble();
    else this.snapTimer = setTimeout(() => this.snapBubble(), 180);
  }
  private snapBubble() {
    clearTimeout(this.snapTimer);
    if (!this.bubble || this.bubble.isDestroyed()) return;
    const current = this.bubble.getBounds();
    const work = screen.getDisplayMatching(current).workArea;
    this.savedBubble = snapBubbleBounds(current, work);
    this.bubble.setBounds(this.savedBubble);
  }
  private release(mute: boolean) {
    ++this.generation;
    clearTimeout(this.snapTimer);
    const selected = this.selected;
    this.selected = null;
    this.collapsed = false;
    this.transitioning++;
    try {
      for (const window of [this.panel, this.bubble])
        if (window && !window.isDestroyed()) window.hide();
      if (selected && !selected.view.webContents.isDestroyed()) {
        selected.view.webContents.removeListener(
          "before-input-event",
          this.escape,
        );
        selected.view.setVisible(false);
        if (mute) selected.view.webContents.setAudioMuted(true);
        if (
          this.panel &&
          !this.panel.isDestroyed() &&
          this.panel.contentView.children.includes(selected.view)
        )
          this.panel.contentView.removeChildView(selected.view);
        if (
          !this.options.mainWindow.isDestroyed() &&
          !this.options.mainWindow.contentView.children.includes(selected.view)
        )
          this.options.mainWindow.contentView.addChildView(selected.view);
      }
    } finally {
      this.transitioning--;
    }
    this.notify();
    return selected?.id;
  }
  returnToMain(activate = true): void {
    const id = this.release(false);
    if (id && activate && this.options.canAccess(id) && !this.closing)
      this.options.onReturn(id);
  }
  conceal(): void {
    this.release(true);
  }
  close(): void {
    if (this.closing) return;
    this.conceal();
    this.closing = true;
    screen.removeListener("display-removed", this.displayChanged);
    screen.removeListener("display-metrics-changed", this.displayChanged);
    ipcMain.removeHandler("gom-floating");
    for (const window of [this.panel, this.bubble])
      if (window && !window.isDestroyed()) window.destroy();
    this.panel = this.bubble = null;
  }
}
