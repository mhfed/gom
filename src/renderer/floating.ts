interface FloatingSnapshot {
  detached: boolean;
  collapsed: boolean;
  pinned: boolean;
  provider: string;
  account: string;
}
type FloatingAction = "collapse" | "expand" | "return" | "pin" | "drag";
interface FloatingBridge {
  state(): Promise<FloatingSnapshot>;
  command(
    action: FloatingAction,
    data?: { dx: number; dy: number; end?: boolean },
  ): Promise<void>;
  changed(callback: (state: FloatingSnapshot) => void): () => void;
}
declare global {
  interface Window {
    gomFloating: FloatingBridge;
  }
}
export {};

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const isBubble = new URLSearchParams(location.search).get("mode") === "bubble";
const bubble = $<HTMLButtonElement>("floating-bubble");
$("floating-header").hidden = isBubble;
bubble.hidden = !isBubble;

function render(state: FloatingSnapshot) {
  const active = state.detached;
  const source =
    active && !isBubble
      ? [state.provider, state.account].filter(Boolean).join(" · ")
      : "";
  $("floating-source").textContent = source;
  $("floating-source").title = source;
  // A collapsed window deliberately identifies Gom rather than its account.
  document.title = isBubble || !active ? "Gom · Chat nổi" : source + " · Gom";
  for (const id of [
    "floating-pin",
    "floating-return",
    "floating-collapse",
    "floating-bubble",
  ])
    $<HTMLButtonElement>(id).disabled = !active;
  $("floating-pin").setAttribute("aria-pressed", String(state.pinned));
  $("floating-pin").title = state.pinned
    ? "Bỏ luôn nổi"
    : "Luôn nổi trên các cửa sổ khác";
}
function command(
  action: FloatingAction,
  data?: { dx: number; dy: number; end?: boolean },
) {
  void window.gomFloating.command(action, data).catch(() => {});
}
$("floating-pin").onclick = () => command("pin");
$("floating-return").onclick = () => command("return");
$("floating-collapse").onclick = () => command("collapse");
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !isBubble && !event.isComposing) {
    event.preventDefault();
    command("collapse");
  }
});

let pointer: {
  id: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  dragging: boolean;
} | null = null;
let suppressClick = false;
bubble.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || bubble.disabled) return;
  pointer = {
    id: event.pointerId,
    originX: event.screenX,
    originY: event.screenY,
    x: event.screenX,
    y: event.screenY,
    dragging: false,
  };
  bubble.setPointerCapture(event.pointerId);
});
bubble.addEventListener("pointermove", (event) => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (
    !pointer.dragging &&
    Math.hypot(
      event.screenX - pointer.originX,
      event.screenY - pointer.originY,
    ) < 6
  )
    return;
  pointer.dragging = true;
  const dx = event.screenX - pointer.x,
    dy = event.screenY - pointer.y;
  pointer.x = event.screenX;
  pointer.y = event.screenY;
  if (dx || dy) command("drag", { dx, dy });
});
function finishDrag() {
  const dragging = pointer?.dragging;
  pointer = null;
  if (!dragging) return;
  suppressClick = true;
  command("drag", { dx: 0, dy: 0, end: true });
  // Most platforms dispatch click immediately after pointerup. If capture is
  // cancelled instead, do not consume the next deliberate click.
  setTimeout(() => {
    suppressClick = false;
  }, 0);
}
bubble.addEventListener("pointerup", finishDrag);
bubble.addEventListener("pointercancel", finishDrag);
bubble.onclick = () => {
  if (suppressClick) return;
  command("expand");
};
let updates = 0;
window.gomFloating.changed((state) => {
  updates++;
  render(state);
});
const initialUpdate = updates;
void window.gomFloating
  .state()
  .then((state) => {
    if (updates === initialUpdate) render(state);
  })
  .catch(() => {
    if (updates === initialUpdate)
      render({
        detached: false,
        collapsed: false,
        pinned: true,
        provider: "",
        account: "",
      });
  });
