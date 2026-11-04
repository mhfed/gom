interface ContentViewHost<T> {
  children: readonly T[];
  addChildView(view: T): void;
}

export function attachProviderViewToMain<T>(
  targetId: string,
  floatingAccountId: string | null | undefined,
  returnFloatingToMain: () => void,
  contentView: ContentViewHost<T>,
  view: T,
): void {
  if (floatingAccountId === targetId) returnFloatingToMain();
  if (!contentView.children.includes(view)) contentView.addChildView(view);
}
