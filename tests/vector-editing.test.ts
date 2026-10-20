import { describe, expect, it } from 'vitest';
import type { VectorPath } from '../src/model/types';
import { parseVectorPath } from '../src/model/vector';
import { canvasToVectorPoint, closestVectorT, constrainVectorHandle, curveVectorAnchor, deleteVectorAnchor, finishPenPath, moveVectorAnchor, moveVectorHandle, splitVectorSegment, vectorAnchors, vectorSegmentPoint, vectorSegments } from '../src/model/vector-editing';

const polygon = (): VectorPath => ({ fillRule: 'evenodd', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 1, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'Z' }] });
describe('canvas vector editing operations', () => {
  it('keeps an exact no-op anchor reference and never mutates the source', () => {
    const path = polygon(), before = structuredClone(path);
    expect(moveVectorAnchor(path, 1, { x: 1, y: 0 })).toBe(path);
    const changed = moveVectorAnchor(path, 1, { x: 2, y: -.5 });
    expect(path).toEqual(before); expect(changed.fillRule).toBe('evenodd');
    expect(changed.commands[1]).toEqual({ op: 'L', x: 2, y: -.5 });
  });
  it('exposes one anchor for a native ellipse closing cubic endpoint and two incident handles', () => {
    const path: VectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: .5 }, { op: 'C', x1: 0, y1: -.1, x2: 1, y2: -.1, x: 1, y: .5 }, { op: 'C', x1: 1, y1: 1.1, x2: 0, y2: 1.1, x: 0, y: .5 }, { op: 'Z' }] };
    expect(vectorAnchors(path)).toHaveLength(2);
    const moved = moveVectorAnchor(path, 0, { x: -.2, y: .7 });
    expect(moved.commands[0]).toEqual({ op: 'M', x: -.2, y: .7 });
    expect(moved.commands[1]).toMatchObject({ x1: -.2 });
    expect((moved.commands[1] as { y1: number }).y1).toBeCloseTo(.1, 12);
    expect(moved.commands[2]).toMatchObject({ x: -.2, y: .7, x2: -.2 });
    expect((moved.commands[2] as { y2: number }).y2).toBeCloseTo(1.3);
    expect(vectorSegments(moved).map(s => [s.start, s.end])).toEqual([[0, 1], [1, 0]]);
  });
  it('independent handle movement preserves the opposite control, coupled movement mirrors it', () => {
    const path = curveVectorAnchor(polygon(), 1, true), initial = vectorAnchors(path)[1];
    const independent = vectorAnchors(moveVectorHandle(path, 1, 'outgoing', { x: 1.2, y: .3 }, true))[1];
    expect(independent.incoming).toEqual(initial.incoming);
    expect(independent.outgoing).toEqual({ x: 1.2, y: .3 });
    const coupled = vectorAnchors(moveVectorHandle(path, 1, 'outgoing', { x: 1.2, y: .3 }))[1];
    expect(coupled.incoming).toEqual({ x: .8, y: -.3 });
  });
  it('sharpening one endpoint preserves a neighboring point’s curved tangent', () => {
    const a = curveVectorAnchor(polygon(), 1, true), b = curveVectorAnchor(a, 2, true);
    const neighbor = vectorAnchors(b)[2];
    const sharp = curveVectorAnchor(b, 1, false);
    expect(vectorAnchors(sharp)[1].outgoing).toEqual({ x: 1, y: 0 }); // Degenerate end of neighboring C.
    expect(vectorAnchors(sharp)[2]).toEqual(neighbor);
    expect(sharp.commands.some(c => c.op === 'C')).toBe(true);
  });
  it('changing one contour leaves an unrelated explicit degenerate cubic unchanged', () => {
    const path = polygon();
    const untouched = [{ op: 'M' as const, x: 2, y: 2 }, { op: 'C' as const, x1: 2, y1: 2, x2: 3, y2: 3, x: 3, y: 3 }];
    path.commands.push(...untouched);
    expect(curveVectorAnchor(path, 1, true).commands.slice(-2)).toEqual(untouched);
  });
  it('splits an implicit closing edge and preserves fill rule/other subpaths', () => {
    const path = polygon(); path.commands.push({ op: 'M', x: 2, y: 2 }, { op: 'L', x: 3, y: 3 });
    const split = splitVectorSegment(path, 3, .25);
    expect(split.anchor).toBe(3);
    expect(split.path.commands).toEqual([...path.commands.slice(0, 3), { op: 'L', x: .75, y: .75 }, ...path.commands.slice(3)]);
    expect(deleteVectorAnchor(split.path, split.anchor)).toEqual(path);
  });
  it('nearest-point picking operates in visible pixel proportions and reconstructs an actual cubic split', () => {
    const path: VectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'C', x1: 0, y1: 1, x2: 1, y2: 1, x: 1, y: 0 }] };
    const segment = vectorSegments(path)[0], point = vectorSegmentPoint(segment, .3);
    const t = closestVectorT(segment, point, 600, 50);
    expect(t).toBeCloseTo(.3, 6);
    const split = splitVectorSegment(path, 1, t), pieces = vectorSegments(split.path);
    for (const u of [.1, .25, .5, .8]) {
      const p = vectorSegmentPoint(segment, u), actual = u < t ? vectorSegmentPoint(pieces[0], u / t) : vectorSegmentPoint(pieces[1], (u - t) / (1 - t));
      expect(actual.x).toBeCloseTo(p.x, 12); expect(actual.y).toBeCloseTo(p.y, 12);
    }
  });
  it('deleting the first closed point keeps a valid closed contour and deletes no unrelated contour', () => {
    const path = polygon(); path.commands.push({ op: 'M', x: 2, y: 2 });
    const next = deleteVectorAnchor(path, 0);
    expect(next.commands).toEqual([{ op: 'M', x: 1, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'Z' }, { op: 'M', x: 2, y: 2 }]);
    expect(parseVectorPath(next)).toEqual(next);
  });
  it('protects the last point and rejects out-of-budget edits without mutation', () => {
    const last: VectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }] };
    expect(() => deleteVectorAnchor(last, 0)).toThrow(/at least one/);
    const original = polygon();
    expect(() => moveVectorAnchor(original, 1, { x: Infinity, y: 0 })).toThrow(/finite/);
    expect(() => moveVectorAnchor(original, 1, { x: 10001, y: 0 })).toThrow(/finite/);
    expect(() => moveVectorAnchor(original, -1, { x: 1, y: 0 })).toThrow(/Invalid/);
    expect(original).toEqual(polygon());
  });
  it('bounds command insertions and split t, including a maximum-size source', () => {
    const path: VectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, ...Array.from({ length: 4095 }, () => ({ op: 'L' as const, x: 1, y: 1 }))] };
    expect(() => splitVectorSegment(path, 1, .5)).toThrow(/4096/);
    for (const t of [0, 1, -1, Infinity, NaN]) expect(() => splitVectorSegment(polygon(), 1, t)).toThrow(/inside/);
  });
  it('inverse rotates around the box center before normalizing with effective dimensions', () => {
    const p = canvasToVectorPoint({ x: 298, y: 246 }, { x: 130, y: 90, width: 240, height: 120, rotation: 90 });
    expect(p.x).toBeCloseTo(.9); expect(p.y).toBeCloseTo(.1);
    expect(constrainVectorHandle({ x: 10, y: 20 }, { x: 50, y: 49 })).toEqual({ x: 50, y: 20 });
  });
  it('normalizes Pen controls at large page positions without clamping actual geometry', () => {
    const result = finishPenPath([{ x: 40000, y: 50000 }, { x: 40100, y: 50100, incoming: { x: 40050, y: 50050 }, outgoing: { x: 40150, y: 50150 } }, { x: 40200, y: 50000 }], false);
    expect(result).toMatchObject({ x: 40000, y: 50000, width: 200, height: 150 });
    expect(result.vectorPath.commands.map(c => c.op)).toEqual(['M', 'C', 'C']);
    expect(parseVectorPath(result.vectorPath)).toEqual(result.vectorPath);
    expect(() => finishPenPath([{ x: 0, y: 0 }, { x: 100001, y: 0 }], false)).toThrow(/limits/);
  });
  it('handles vertical and horizontal Pen strokes with minimum nonzero widget dimensions', () => {
    expect(finishPenPath([{ x: 40, y: 80 }, { x: 40, y: 200 }], false)).toMatchObject({ x: 40, y: 80, width: 1, height: 120 });
    expect(finishPenPath([{ x: 40, y: 80 }, { x: 140, y: 80 }], true)).toMatchObject({ width: 100, height: 1 });
    expect(() => finishPenPath([{ x: 40, y: 80 }], false)).toThrow(/two/);
  });
});
