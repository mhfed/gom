export function providerBounds(
  width: number,
  height: number,
  reservedRight = 0,
) {
  return {
    x: 0,
    y: 52,
    width: Math.max(0, width - Math.max(0, reservedRight)),
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
// A detached native view was laid out by another window. Its cached main
// geometry is no longer the native view's current geometry.
export function resetViewLayout(view: HostedView): void {
  applied.delete(view);
}
export function layoutViews(
  views: Iterable<readonly [string, HostedView]>,
  width: number,
  height: number,
  active: string,
  panel: string,
  reservedRight = 0,
) {
  const bounds = providerBounds(width, height, reservedRight);
  for (const [id, view] of views) {
    const visible =
      panel === "service" &&
      active === id &&
      !(reservedRight > 0 && width < 940);
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
