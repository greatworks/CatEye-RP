import { describe, expect, it } from 'vitest';
import { anchorRotatedResize, resizeRotatedBounds, rotatedBoundsIntersect, type RotatableBounds } from '../src/model/rotation-geometry';

const box: RotatableBounds = { x: 160, y: 160, width: 200, height: 60, rotation: 90 };
function world(box: RotatableBounds, u: number, v: number) {
  const a = box.rotation * Math.PI / 180, x = (u - .5) * box.width, y = (v - .5) * box.height;
  return { x: box.x + box.width / 2 + x * Math.cos(a) - y * Math.sin(a), y: box.y + box.height / 2 + x * Math.sin(a) + y * Math.cos(a) };
}

describe('rotated authoring resize geometry', () => {
  it('uses local axes at 90 degrees while the opposite world edge stays fixed', () => {
    expect(resizeRotatedBounds(box, 'e', { x: 0, y: 40 })).toEqual({ x: 140, y: 180, width: 240, height: 60 });
    expect(resizeRotatedBounds(box, 's', { x: -20, y: 0 })).toEqual({ x: 150, y: 150, width: 200, height: 80 });
    expect(box).toEqual({ x: 160, y: 160, width: 200, height: 60, rotation: 90 });
  });

  for (const rotation of [-65, 0, 37, 90, 180, 450]) it.each(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'])(`keeps the opposite anchor fixed at ${rotation} degrees with handle %s`, handle => {
    const original = { ...box, rotation }, result = resizeRotatedBounds(original, handle, { x: 23, y: -17 });
    const u = handle.includes('w') ? 1 : handle.includes('e') ? 0 : .5, v = handle.includes('n') ? 1 : handle.includes('s') ? 0 : .5;
    const fixed = world(original, u, v), after = world({ ...original, ...result }, u, v);
    expect(after.x).toBeCloseTo(fixed.x, 10); expect(after.y).toBeCloseTo(fixed.y, 10);
  });

  it('clamps both dimensions at the minimum without moving the opposite corner', () => {
    const result = resizeRotatedBounds(box, 'se', { x: 1000, y: -1000 });
    expect(result).toEqual({ x: 282, y: 90, width: 8, height: 8 });
    expect(world({ ...box, ...result }, 0, 0)).toEqual(world(box, 0, 0));
  });

  it('anchors the actual normalized container size rather than the proposed size', () => {
    const result = anchorRotatedResize(box, 'se', 220, 80);
    expect(result).toEqual({ x: 140, y: 160, width: 220, height: 80 });
    expect(world({ ...box, ...result }, 0, 0)).toEqual(world(box, 0, 0));
  });

  it('preserves unrotated rounding and edge positioning', () => {
    const original = { ...box, x: 160.5, y: 160.25, rotation: 0 };
    expect(resizeRotatedBounds(original, 'nw', { x: 20.6, y: 10.2 })).toEqual({ x: 181.5, y: 170.25, width: 179, height: 50 });
    expect(resizeRotatedBounds(original, 'e', { x: 20.6, y: 500 })).toEqual({ x: 160.5, y: 160.25, width: 221, height: 60 });
  });

  for (const rotation of [0, 37]) {
    it.each([{ handle: 'e', height: 6 }, { handle: 'e', height: 7 }, { handle: 'w', height: 6 }, { handle: 'w', height: 7 }])(`preserves untouched native height at ${rotation} degrees: $handle / $height`, ({ handle, height }) => {
      const original = { ...box, rotation, height };
      const result = resizeRotatedBounds(original, handle, { x: 20, y: 10 });
      expect(result.height).toBe(height);
      expect(result.width).not.toBe(original.width);
    });
    it.each(['n', 's'])(`preserves untouched fractional native width at ${rotation} degrees: %s`, handle => {
      const original = { ...box, rotation, width: 73.99934480684509 };
      const result = resizeRotatedBounds(original, handle, { x: 10, y: 20 });
      expect(result.width).toBe(original.width);
      expect(result.height).not.toBe(original.height);
    });
  }
});

describe('rotated marquee intersection', () => {
  it('rejects the old layout-only region and includes the rotated-only region', () => {
    expect(rotatedBoundsIntersect(box, { x: 150, y: 170, width: 50, height: 30 })).toBe(false);
    expect(rotatedBoundsIntersect(box, { x: 220, y: 100, width: 55, height: 35 })).toBe(true);
  });
  it('does not select an empty corner inside the rotated bounding box', () => {
    const diamond = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
    expect(rotatedBoundsIntersect(diamond, { x: -15, y: -15, width: 10, height: 10 })).toBe(false);
    expect(rotatedBoundsIntersect(diamond, { x: 45, y: -15, width: 10, height: 10 })).toBe(true);
    expect(rotatedBoundsIntersect(diamond, { x: 20, y: 20, width: 60, height: 60 })).toBe(true);
  });
  it('preserves strict contact and containment semantics without rotation', () => {
    const unrotated = { x: 10, y: 20, width: 30, height: 40, rotation: 0 };
    expect(rotatedBoundsIntersect(unrotated, { x: 40, y: 20, width: 10, height: 10 })).toBe(false);
    expect(rotatedBoundsIntersect(unrotated, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    expect(rotatedBoundsIntersect(unrotated, { x: 20, y: 30, width: 1, height: 1 })).toBe(true);
    expect(rotatedBoundsIntersect(unrotated, { x: 20, y: 30, width: 0, height: 1 })).toBe(false);
  });
});
