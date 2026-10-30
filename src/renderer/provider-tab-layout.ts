/** Compact icons reserve space only for the active provider's name and badge. */
export function compactProviderWidth(
  measuredLabelWidth: number,
  active: boolean,
): number {
  if (!active) return 34;
  const label = Number.isFinite(measuredLabelWidth)
    ? Math.max(0, measuredLabelWidth)
    : 0;
  return Math.ceil(Math.min(150, Math.max(96, label + 66)));
}
/** Fit tabs without scrolling the header; the selected tab always gets a slot. */
export function fitProviderTabs<T extends string>(
  tabs: readonly { id: T; width: number }[],
  active: T,
  available: number,
  overflowWidth = 34,
  gap = 2,
): { visible: T[]; overflow: T[] } {
  const widthOf = (items: typeof tabs) =>
    items.reduce((sum, item) => sum + item.width, 0) +
    Math.max(0, items.length - 1) * gap;
  if (widthOf(tabs) <= available)
    return { visible: tabs.map((item) => item.id), overflow: [] };
  const budget = Math.max(0, available - overflowWidth - gap);
  let visible: (typeof tabs)[number][] = [];
  for (const item of tabs) {
    if (widthOf([...visible, item]) > budget) break;
    visible.push(item);
  }
  const selected = tabs.find((item) => item.id === active);
  if (selected && !visible.includes(selected)) {
    while (visible.length && widthOf([...visible, selected]) > budget)
      visible.pop();
    visible.push(selected);
  }
  const ids = new Set(visible.map((item) => item.id));
  return {
    visible: tabs.filter((item) => ids.has(item.id)).map((item) => item.id),
    overflow: tabs.filter((item) => !ids.has(item.id)).map((item) => item.id),
  };
}
