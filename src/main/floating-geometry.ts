export interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
function inset(work: FloatingRect) {
  const margin = Math.max(
    0,
    Math.min(12, (Math.min(work.width, work.height) - 1) / 2),
  );
  return {
    x: work.x + margin,
    y: work.y + margin,
    width: Math.max(1, work.width - margin * 2),
    height: Math.max(1, work.height - margin * 2),
  };
}
export function floatingBounds(
  work: FloatingRect,
  saved?: FloatingRect,
): FloatingRect {
  const safe = inset(work);
  const width = clamp(
    Math.round(finite(saved?.width ?? 400, 400)),
    Math.min(340, safe.width),
    safe.width,
  );
  const height = clamp(
    Math.round(finite(saved?.height ?? 560, 560)),
    Math.min(360, safe.height),
    safe.height,
  );
  return {
    x: Math.round(
      clamp(
        finite(saved?.x ?? safe.x + safe.width - width, safe.x),
        safe.x,
        safe.x + safe.width - width,
      ),
    ),
    y: Math.round(
      clamp(
        finite(saved?.y ?? safe.y + safe.height - height, safe.y),
        safe.y,
        safe.y + safe.height - height,
      ),
    ),
    width,
    height,
  };
}
export function snapBubbleBounds(
  bounds: FloatingRect,
  work: FloatingRect,
): FloatingRect {
  const safe = inset(work);
  const size = Math.min(72, safe.width, safe.height);
  const left =
    finite(bounds.x + bounds.width / 2, work.x + work.width) <
    work.x + work.width / 2;
  return {
    x: Math.round(left ? safe.x : safe.x + safe.width - size),
    y: Math.round(safe.y + safe.height - size),
    width: size,
    height: size,
  };
}
export function moveBubbleBounds(
  bounds: FloatingRect,
  delta: { dx: number; dy: number },
  work: FloatingRect,
): FloatingRect {
  if (!Number.isFinite(delta.dx) || !Number.isFinite(delta.dy))
    return { ...bounds };
  const safe = inset(work);
  const width = Math.min(bounds.width, safe.width),
    height = Math.min(bounds.height, safe.height);
  return {
    x: Math.round(
      clamp(bounds.x + delta.dx, safe.x, safe.x + safe.width - width),
    ),
    y: Math.round(
      clamp(bounds.y + delta.dy, safe.y, safe.y + safe.height - height),
    ),
    width,
    height,
  };
}
