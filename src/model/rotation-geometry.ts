/** Canvas geometry for the editor's current center-origin CSS rotation model.
 * This is not a decoder for native RP transform matrices or their pivot rules. */
export interface RotatableBounds { x: number; y: number; width: number; height: number; rotation: number }
export interface RectangleBounds { x: number; y: number; width: number; height: number }
export interface PointDelta { x: number; y: number }

function axes(rotation: number) {
  const radians = (rotation % 360) * Math.PI / 180;
  const exact = (n: number) => Math.abs(n) < 1e-12 ? 0 : Math.abs(Math.abs(n) - 1) < 1e-12 ? Math.sign(n) : n;
  return { cos: exact(Math.cos(radians)), sin: exact(Math.sin(radians)) };
}

/** Reposition after a final, possibly container-normalized size is known.
 * The opposite corner/edge midpoint remains fixed in the current canvas scope. */
export function anchorRotatedResize(box: RotatableBounds, handle: string, width: number, height: number): RectangleBounds {
  const left = handle.includes('w'), top = handle.includes('n');
  if (box.rotation % 360 === 0) return { x: left ? box.x + box.width - width : box.x, y: top ? box.y + box.height - height : box.y, width, height };
  const { cos, sin } = axes(box.rotation);
  const dx = (left ? -1 : handle.includes('e') ? 1 : 0) * (width - box.width) / 2;
  const dy = (top ? -1 : handle.includes('s') ? 1 : 0) * (height - box.height) / 2;
  return { x: box.x + (box.width - width) / 2 + dx * cos - dy * sin,
    y: box.y + (box.height - height) / 2 + dx * sin + dy * cos, width, height };
}

/** Delta is in unzoomed canvas pixels. Snap/Shift policy remains with the UI. */
export function resizeRotatedBounds(box: RotatableBounds, handle: string, delta: PointDelta, minimum = { width: 8, height: 8 }): RectangleBounds {
  const { cos, sin } = axes(box.rotation), dx = delta.x * cos + delta.y * sin, dy = -delta.x * sin + delta.y * cos;
  // A side handle must not quantize or enlarge the untouched dimension: native
  // lines can be thinner than the drag minimum and retain fractional lengths.
  const width = /[we]/.test(handle) ? Math.round(Math.max(minimum.width, box.width + (handle.includes('w') ? -dx : dx))) : box.width;
  const height = /[ns]/.test(handle) ? Math.round(Math.max(minimum.height, box.height + (handle.includes('n') ? -dy : dy))) : box.height;
  return anchorRotatedResize(box, handle, width, height);
}

/** Separating-axis test for the rotated layout rectangle and an axis-aligned
 * marquee. A bounding-box-only test would select empty corners at oblique angles. */
export function rotatedBoundsIntersect(box: RotatableBounds, marquee: RectangleBounds): boolean {
  if (box.width <= 0 || box.height <= 0 || marquee.width <= 0 || marquee.height <= 0) return false;
  const { cos, sin } = axes(box.rotation), dx = marquee.x + marquee.width / 2 - box.x - box.width / 2, dy = marquee.y + marquee.height / 2 - box.y - box.height / 2;
  const bx = box.width / 2, by = box.height / 2, mx = marquee.width / 2, my = marquee.height / 2;
  return Math.abs(dx) < bx * Math.abs(cos) + by * Math.abs(sin) + mx
    && Math.abs(dy) < bx * Math.abs(sin) + by * Math.abs(cos) + my
    && Math.abs(dx * cos + dy * sin) < bx + mx * Math.abs(cos) + my * Math.abs(sin)
    && Math.abs(-dx * sin + dy * cos) < by + mx * Math.abs(sin) + my * Math.abs(cos);
}
