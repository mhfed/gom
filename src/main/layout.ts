import { sidebarWidth } from "./presentation.ts";
export function providerBounds(
  width: number,
  height: number,
  collapsed: boolean,
  expandedWidth = 224,
) {
  const sidebar = collapsed ? 72 : sidebarWidth(expandedWidth);
  return {
    x: sidebar,
    y: 76,
    width: Math.max(0, width - sidebar),
    height: Math.max(0, height - 76),
  };
}

interface HostedView {
  setVisible(value: boolean): void;
  setBounds(bounds: ReturnType<typeof providerBounds>): void;
}
export function layoutViews(
  views: Iterable<readonly [string, HostedView]>,
  width: number,
  height: number,
  collapsed: boolean,
  active: string,
  panel: string,
  expandedWidth = 224,
) {
  const bounds = providerBounds(width, height, collapsed, expandedWidth);
  for (const [id, view] of views) {
    view.setVisible(panel === "service" && active === id);
    view.setBounds(bounds);
  }
}
