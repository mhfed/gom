export function providerBounds(width: number, height: number) {
  return {
    x: 0,
    y: 52,
    width: Math.max(0, width),
    height: Math.max(0, height - 52),
  };
}

interface HostedView {
  setVisible(value: boolean): void;
  setBounds(bounds: ReturnType<typeof providerBounds>): void;
}
// Weak ownership: archived/replaced views must not be kept alive by layout.
const applied = new WeakMap<
  HostedView,
  {
    visible: boolean;
    bounds: ReturnType<typeof providerBounds>;
  }
>();
export function layoutViews(
  views: Iterable<readonly [string, HostedView]>,
  width: number,
  height: number,
  active: string,
  panel: string,
) {
  const bounds = providerBounds(width, height);
  for (const [id, view] of views) {
    const visible = panel === "service" && active === id;
    const previous = applied.get(view);
    const visibilityChanged = !previous || previous.visible !== visible;
    const boundsChanged =
      !previous ||
      previous.bounds.x !== bounds.x ||
      previous.bounds.y !== bounds.y ||
      previous.bounds.width !== bounds.width ||
      previous.bounds.height !== bounds.height;
    if (visibilityChanged) view.setVisible(visible);
    if (boundsChanged) view.setBounds(bounds);
    if (visibilityChanged || boundsChanged)
      applied.set(view, { visible, bounds });
  }
}
