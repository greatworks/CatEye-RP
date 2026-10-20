/** Numerical resize projection. Object traversal, history and model limits belong to the caller. */
export type AuthorResizePoint = { x: number; y: number };
export type AuthorResizeRect = AuthorResizePoint & { width: number; height: number };
export type AuthorResizePinInfo = {
  horizontal: 0 | 1 | 4 | 5 | 256;
  vertical: 0 | 2 | 8 | 10 | 512;
  fixedWidth: boolean;
  fixedHeight: boolean;
  originalParentRect: AuthorResizeRect;
  newParentRect: AuthorResizeRect;
};
export type AuthorResizeOptions = {
  originalRect: AuthorResizeRect;
  originalBounds: AuthorResizeRect;
  delta: AuthorResizePoint;
  parentRect: AuthorResizeRect;
  /** Position bits: left 1, top 2, right 4, bottom 8. */
  handle: number;
  /** Horizontal 1, vertical 2, both 3. */
  freedom?: number;
  preserveAspect?: boolean;
  /** Horizontal 0, vertical 1, both 2, infer from handle 3. */
  orientation?: 0 | 1 | 2 | 3;
  pin?: AuthorResizePinInfo;
  rotation?: number;
};

const LEFT = 1, TOP = 2, RIGHT = 4, BOTTOM = 8;
const ANGLE_EPSILON = 1e-5;
const HANDLES = [LEFT | TOP, TOP, RIGHT | TOP, RIGHT, RIGHT | BOTTOM, BOTTOM, LEFT | BOTTOM, LEFT];

export function hasAuthorResizePinEdges(pin?: AuthorResizePinInfo): boolean {
  return !!pin && (pin.horizontal !== 0 || pin.vertical !== 0);
}

export function hasAuthorResizePins(pin?: AuthorResizePinInfo): boolean {
  return !!pin && (pin.fixedWidth || pin.fixedHeight || hasAuthorResizePinEdges(pin));
}

type AxisPin = 'none' | 'near' | 'far' | 'both' | 'center';
type AxisProjection = {
  oldPosition: number;
  oldSize: number;
  newPosition: number;
  newSize: number;
  originalPosition: number;
  originalSize: number;
  projectedPosition: number;
  projectedSize: number;
  pin: AxisPin;
  fixed: boolean;
  nearHandle: boolean;
  farHandle: boolean;
};

function pinAxis(input: AxisProjection): { position: number; size: number } {
  const oldEnd = input.oldPosition + input.oldSize;
  const newEnd = input.newPosition + input.newSize;
  let position = input.projectedPosition;
  let size = input.fixed ? input.originalSize : input.projectedSize;
  switch (input.pin) {
    case 'none':
      position += input.farHandle ? input.newPosition - input.oldPosition
        : input.nearHandle ? newEnd - oldEnd
          : (input.newPosition - input.oldPosition + newEnd - oldEnd) / 2;
      break;
    case 'both':
      position = input.newPosition + input.originalPosition - input.oldPosition;
      // Both edges determine the size even when the independent fixed flag is set.
      size = input.originalSize + input.newSize - input.oldSize;
      break;
    case 'center':
      position = input.newPosition + input.newSize / 2
        + (input.originalPosition + input.originalSize / 2 - input.oldPosition - input.oldSize / 2) - size / 2;
      break;
    case 'near': {
      const margin = input.originalPosition - input.oldPosition;
      if (input.fixed) position = input.newPosition + margin;
      else if (input.nearHandle) {
        const farRatio = (input.originalPosition + input.originalSize) / oldEnd;
        position = Math.min(input.newPosition + margin, newEnd);
        size = Math.max(1, Math.min(farRatio * newEnd - position, input.newSize));
      } else {
        size = Math.max(1, Math.min(size, input.newSize));
        position = input.newPosition + margin;
      }
      break;
    }
    case 'far': {
      const margin = oldEnd - input.originalPosition - input.originalSize;
      if (input.fixed || !input.farHandle) position = newEnd - margin - size;
      else {
        const distance = Math.abs(input.projectedSize - input.originalSize)
          + Math.abs(input.projectedPosition - input.originalPosition);
        if (distance !== 0) {
          const correction = newEnd - margin - (position + size);
          size = Math.max(size + Math.abs((input.originalSize - size) / distance) * correction, 0);
          position = Math.max(position + Math.abs((input.originalPosition - position) / distance) * correction, input.newPosition);
        }
      }
      break;
    }
  }
  return { position, size };
}

export function applyAuthorResizePins(
  originalBounds: AuthorResizeRect,
  projectedBounds: AuthorResizeRect,
  pin: AuthorResizePinInfo,
  handle: number,
): AuthorResizeRect {
  const horizontal: Record<AuthorResizePinInfo['horizontal'], AxisPin> = { 0: 'none', 1: 'near', 4: 'far', 5: 'both', 256: 'center' };
  const vertical: Record<AuthorResizePinInfo['vertical'], AxisPin> = { 0: 'none', 2: 'near', 8: 'far', 10: 'both', 512: 'center' };
  const x = pinAxis({
    oldPosition: pin.originalParentRect.x, oldSize: pin.originalParentRect.width,
    newPosition: pin.newParentRect.x, newSize: pin.newParentRect.width,
    originalPosition: originalBounds.x, originalSize: originalBounds.width,
    projectedPosition: projectedBounds.x, projectedSize: projectedBounds.width,
    pin: horizontal[pin.horizontal], fixed: pin.fixedWidth,
    nearHandle: !!(handle & LEFT), farHandle: !!(handle & RIGHT),
  });
  const y = pinAxis({
    oldPosition: pin.originalParentRect.y, oldSize: pin.originalParentRect.height,
    newPosition: pin.newParentRect.y, newSize: pin.newParentRect.height,
    originalPosition: originalBounds.y, originalSize: originalBounds.height,
    projectedPosition: projectedBounds.y, projectedSize: projectedBounds.height,
    pin: vertical[pin.vertical], fixed: pin.fixedHeight,
    nearHandle: !!(handle & TOP), farHandle: !!(handle & BOTTOM),
  });
  return { x: x.position, y: y.position, width: x.size, height: y.size };
}

function opposite(handle: number): number {
  return ((handle & LEFT) ? RIGHT : 0) | ((handle & RIGHT) ? LEFT : 0)
    | ((handle & TOP) ? BOTTOM : 0) | ((handle & BOTTOM) ? TOP : 0);
}

function flip(point: AuthorResizePoint, anchor: number): AuthorResizePoint {
  return { x: (anchor & RIGHT) ? -point.x : point.x, y: (anchor & BOTTOM) ? -point.y : point.y };
}

function anchorPoint(rect: AuthorResizeRect, anchor: number): AuthorResizePoint {
  return {
    x: (anchor & LEFT) ? rect.x : (anchor & RIGHT) ? rect.x + rect.width : rect.x + rect.width / 2,
    y: (anchor & TOP) ? rect.y : (anchor & BOTTOM) ? rect.y + rect.height : rect.y + rect.height / 2,
  };
}

function resizeAtAnchor(rect: AuthorResizeRect, delta: AuthorResizePoint, anchor: number): AuthorResizeRect {
  const result = { ...rect, width: rect.width + delta.x, height: rect.height + delta.y };
  const before = anchorPoint(rect, anchor), after = anchorPoint(result, anchor);
  return { ...result, x: result.x + before.x - after.x, y: result.y + before.y - after.y };
}

function preserveRatio(delta: AuthorResizePoint, rect: AuthorResizeRect, orientation: number): AuthorResizePoint {
  let { x, y } = delta;
  if (orientation === 0) {
    const nextY = x * rect.height / rect.width;
    if (nextY === y) return { x, y };
    y = nextY;
    x = y * rect.width / rect.height;
  } else if (orientation === 1) {
    const nextX = y * rect.width / rect.height;
    if (nextX === x) return { x, y };
    x = nextX;
    y = x * rect.height / rect.width;
  } else {
    const nextY = x * rect.height / rect.width;
    if (nextY > y) y = nextY;
    else x = y * rect.width / rect.height;
  }
  return { x, y };
}

function projectBounds(
  original: AuthorResizeRect, parent: AuthorResizeRect, delta: AuthorResizePoint,
  handle: number, freedom: number, preserveAspect: boolean,
): { rect: AuthorResizeRect; scaledDelta: AuthorResizePoint } {
  let scaledDelta = { x: delta.x * original.width / parent.width, y: delta.y * original.height / parent.height };
  if (!preserveAspect) {
    if (!(freedom & 1)) scaledDelta.x = 0;
    if (!(freedom & 2)) scaledDelta.y = 0;
  }
  const anchor = opposite(handle);
  scaledDelta = flip(scaledDelta, anchor);
  const projected = resizeAtAnchor(original, scaledDelta, anchor);
  const parentDelta = {
    x: (freedom & 1) ? ((handle & LEFT) ? -delta.x : delta.x) : 0,
    y: (freedom & 2) ? ((handle & TOP) ? -delta.y : delta.y) : 0,
  };
  const nextParent = resizeAtAnchor(parent, parentDelta, anchor);
  return {
    rect: {
      ...projected,
      x: (original.x - parent.x) / parent.width * nextParent.width + nextParent.x,
      y: (original.y - parent.y) / parent.height * nextParent.height + nextParent.y,
    },
    scaledDelta,
  };
}

function trigonometry(degrees: number): { sine: number; cosine: number } {
  const remainder = degrees % 360;
  if (Math.abs(remainder) < ANGLE_EPSILON) return { sine: 0, cosine: 1 };
  if (Math.abs(remainder - 90) < ANGLE_EPSILON) return { sine: 1, cosine: 0 };
  if (Math.abs(remainder - 180) < ANGLE_EPSILON) return { sine: 0, cosine: -1 };
  if (Math.abs(remainder - 270) < ANGLE_EPSILON) return { sine: -1, cosine: 0 };
  const radians = degrees * Math.PI / 180;
  return { sine: Math.sin(radians), cosine: Math.cos(radians) };
}

/** Author sizing bounds, including the retained near-one-degree shortcut. */
export function getAuthorResizeBounds(rect: AuthorResizeRect, rotation: number): AuthorResizeRect {
  if (Math.abs(rotation - 1) < ANGLE_EPSILON) return { ...rect };
  // Preserve independent axes here: multiplying a zero by NaN would contaminate the other axis.
  if (Math.abs(rotation % 360) < ANGLE_EPSILON) {
    return {
      x: Math.min(rect.x, rect.x + rect.width), y: Math.min(rect.y, rect.y + rect.height),
      width: Math.abs(rect.width), height: Math.abs(rect.height),
    };
  }
  const { sine, cosine } = trigonometry(rotation);
  const centerX = rect.x + rect.width / 2, centerY = rect.y + rect.height / 2;
  const corners = [
    [rect.x, rect.y], [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height],
  ].map(([x, y]) => ({
    x: centerX + (x - centerX) * cosine - (y - centerY) * sine,
    y: centerY + (x - centerX) * sine + (y - centerY) * cosine,
  }));
  const xs = corners.map(point => point.x), ys = corners.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function rotateHandle(handle: number, rotation: number): number {
  const degrees = ((rotation % 360) + 360) % 360;
  return HANDLES[(HANDLES.indexOf(handle) + Math.trunc(Math.trunc(degrees + 22.5) / 45)) % HANDLES.length];
}

function solve(options: AuthorResizeOptions): AuthorResizeRect {
  const {
    originalRect, originalBounds, parentRect, handle, pin,
    preserveAspect = false, orientation = 3, rotation = 0,
  } = options;
  let { delta, freedom = 3 } = options;
  if (preserveAspect) {
    freedom = 3;
    const anchor = opposite(handle);
    const axis = orientation === 3
      ? ((handle === LEFT || handle === RIGHT) ? 0 : (handle === TOP || handle === BOTTOM) ? 1 : 2)
      : orientation;
    delta = flip(preserveRatio(flip(delta, anchor), parentRect, axis), anchor);
  }
  const projection = projectBounds(originalBounds, parentRect, delta, handle, freedom, preserveAspect);
  const desired = pin ? applyAuthorResizePins(originalBounds, projection.rect, pin, handle) : projection.rect;
  if (rotation % 90 === 0) return getAuthorResizeBounds(desired, -rotation);

  const { sine, cosine } = trigonometry(rotation);
  const localHandle = opposite(rotateHandle(handle, -rotation));
  const localDelta = flip({
    x: projection.scaledDelta.x * cosine + projection.scaledDelta.y * sine,
    y: -projection.scaledDelta.x * sine + projection.scaledDelta.y * cosine,
  }, localHandle);
  const parentBounds = getAuthorResizeBounds(parentRect, rotation);
  const ratio = (originalRect.width + localDelta.x / parentBounds.width)
    / (originalRect.height + localDelta.y / parentBounds.height);
  let height = desired.height / (Math.abs(ratio * sine) + Math.abs(cosine));
  let width = ratio * height;
  let candidate = getAuthorResizeBounds({ x: 0, y: 0, width, height }, rotation);
  if (candidate.width > desired.width) {
    width = desired.width / (Math.abs(sine / ratio) + Math.abs(cosine));
    height = width / ratio;
    candidate = getAuthorResizeBounds({ x: 0, y: 0, width, height }, rotation);
  }
  let x = desired.x - candidate.x, y = desired.y - candidate.y;
  if (handle & LEFT) x += desired.width - candidate.width;
  if (handle & TOP) y += desired.height - candidate.height;
  return { x, y, width, height };
}

export function solveAuthorResize(options: AuthorResizeOptions): { rect: AuthorResizeRect; finite: boolean } {
  const rect = solve(options);
  return { rect, finite: Object.values(rect).every(Number.isFinite) };
}
