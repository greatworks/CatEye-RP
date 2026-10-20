import { describe, expect, it } from 'vitest';
import { parseVectorPath } from '../src/model/vector';
import {
  canvasToVectorPoint, curveVectorAnchor, deleteVectorAnchor, finishPenPath,
  moveVectorAnchor, moveVectorHandle, splitVectorSegment, vectorAnchors, vectorSegments,
} from '../src/model/vector-editing';
import type { VectorCommand, VectorPath } from '../src/model/types';

type Point = { x: number; y: number };
type Cubic = Extract<VectorCommand, { op: 'C' }>;
// Independent Bernstein-form oracle; production uses repeated interpolation.
function cubicAt(from: Point, curve: Cubic, t: number): Point {
  const u = 1 - t;
  return {
    x: u ** 3 * from.x + 3 * u ** 2 * t * curve.x1 + 3 * u * t ** 2 * curve.x2 + t ** 3 * curve.x,
    y: u ** 3 * from.y + 3 * u ** 2 * t * curve.y1 + 3 * u * t ** 2 * curve.y2 + t ** 3 * curve.y,
  };
}
const ellipse: VectorPath = { fillRule: 'nonzero', commands: [
  { op: 'M', x: .5, y: 0 },
  { op: 'C', x1: .78, y1: 0, x2: 1, y2: .22, x: 1, y: .5 },
  { op: 'C', x1: 1, y1: .78, x2: .78, y2: 1, x: .5, y: 1 },
  { op: 'C', x1: .22, y1: 1, x2: 0, y2: .78, x: 0, y: .5 },
  { op: 'C', x1: 0, y1: .22, x2: .22, y2: 0, x: .5, y: 0 }, { op: 'Z' },
] };

describe('independent vector-editing geometry review', () => {
  it('moves one logical closed first anchor and both attached handles without changing neighbors', () => {
    const before = structuredClone(ellipse), moved = moveVectorAnchor(ellipse, 0, { x: .7, y: -.1 });
    expect(vectorAnchors(moved)).toHaveLength(4);
    expect(moved.commands[0]).toEqual({ op: 'M', x: .7, y: -.1 });
    expect(moved.commands[1]).toMatchObject({ x1: .98, y1: -.1, x2: 1, y2: .22, x: 1, y: .5 });
    expect(moved.commands[4]).toMatchObject({ x1: 0, y1: .22, x: .7, y: -.1 });
    expect((moved.commands[4] as Cubic).x2).toBeCloseTo(.42, 14);
    expect((moved.commands[4] as Cubic).y2).toBe(-.1);
    expect(moved.commands.slice(2, 4)).toEqual(before.commands.slice(2, 4));
    expect(moved.commands.at(-1)).toEqual({ op: 'Z' });
    expect(ellipse).toEqual(before);
  });

  it('sharpens only the selected closed anchor; neighboring controls still produce cubic segments', () => {
    const sharp = curveVectorAnchor(ellipse, 0, false);
    expect(sharp.commands[1]).toEqual({ op: 'C', x1: .5, y1: 0, x2: 1, y2: .22, x: 1, y: .5 });
    expect(sharp.commands[4]).toEqual({ op: 'C', x1: 0, y1: .22, x2: .5, y2: 0, x: .5, y: 0 });
    expect(sharp.commands.slice(2, 4)).toEqual(ellipse.commands.slice(2, 4));
    expect(vectorAnchors(sharp)[0]).toMatchObject({ x: .5, y: 0 });
    expect(vectorSegments(sharp)).toHaveLength(4);
  });

  it('independent handle movement preserves the opposite handle and adjacent endpoints exactly', () => {
    const path = moveVectorHandle(ellipse, 0, 'incoming', { x: .1, y: -.3 }, true);
    expect(path.commands[1]).toEqual(ellipse.commands[1]);
    expect(path.commands[4]).toEqual({ op: 'C', x1: 0, y1: .22, x2: .1, y2: -.3, x: .5, y: 0 });
    expect(path.commands.slice(0, 4)).toEqual(ellipse.commands.slice(0, 4));
  });

  it('the declared coupled-handle policy mirrors across the anchor without moving it', () => {
    const path = moveVectorHandle(ellipse, 0, 'incoming', { x: .1, y: -.3 });
    expect(path.commands[0]).toEqual(ellipse.commands[0]);
    expect(path.commands[1]).toMatchObject({ x1: .9, y1: .3, x2: 1, y2: .22 });
    expect(path.commands[4]).toMatchObject({ x2: .1, y2: -.3, x: .5, y: 0 });
  });

  it.each([.000001, .07, .37, .5, .91, .999999])('splits cubic polynomials without changing geometry at t=%s', split => {
    const from = { x: -.4, y: 1.3 };
    const curve: Cubic = { op: 'C', x1: 3.2, y1: -2.7, x2: -.9, y2: 3.1, x: 1.4, y: -.5 };
    const original: VectorPath = { fillRule: 'evenodd', commands: [{ op: 'M', ...from }, curve] };
    const result = splitVectorSegment(original, 1, split);
    expect(result.anchor).toBe(1); expect(result.path.fillRule).toBe('evenodd');
    const left = result.path.commands[1] as Cubic, right = result.path.commands[2] as Cubic;
    for (let i = 0; i <= 100; i++) {
      const t = i / 100, expected = cubicAt(from, curve, t);
      const actual = t <= split ? cubicAt(from, left, t / split) : cubicAt(left, right, (t - split) / (1 - split));
      expect(actual.x).toBeCloseTo(expected.x, 11); expect(actual.y).toBeCloseTo(expected.y, 11);
    }
    expect(original.commands).toEqual([{ op: 'M', ...from }, curve]);
  });

  it('splits an explicit closing cubic into two curves and returns the new logical point', () => {
    const result = splitVectorSegment(ellipse, 4, .25);
    expect(result.anchor).toBe(4); expect(vectorAnchors(result.path)).toHaveLength(5);
    expect(result.path.commands.at(-1)).toEqual({ op: 'Z' });
    expect(result.path.commands[5]).toMatchObject({ op: 'C', x: .5, y: 0 });
    const expected = cubicAt({ x: 0, y: .5 }, ellipse.commands[4] as Cubic, .25);
    const inserted = vectorAnchors(result.path)[result.anchor];
    expect(inserted.x).toBeCloseTo(expected.x, 13); expect(inserted.y).toBeCloseTo(expected.y, 13);
    expect(result.path.commands.slice(0, 4)).toEqual(ellipse.commands.slice(0, 4));
  });

  it('splits implicit closure of the second contour without touching the first contour', () => {
    const first: VectorCommand[] = [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 1, y: 0 }];
    const path: VectorPath = { fillRule: 'evenodd', commands: [...first,
      { op: 'M', x: 2, y: 2 }, { op: 'L', x: 4, y: 2 }, { op: 'L', x: 4, y: 4 }, { op: 'Z' },
    ] };
    const result = splitVectorSegment(path, 5, .5);
    expect(result.anchor).toBe(5); expect(result.path.commands.slice(0, 2)).toEqual(first);
    expect(result.path.commands.slice(-2)).toEqual([{ op: 'L', x: 3, y: 3 }, { op: 'Z' }]);
    expect(vectorAnchors(result.path)[result.anchor]).toMatchObject({ x: 3, y: 3 });
  });

  it('deleting one contour singleton preserves remaining contours and first-point indexing', () => {
    const path: VectorPath = { fillRule: 'nonzero', commands: [
      { op: 'M', x: -.4, y: 0 }, { op: 'Z' }, ...ellipse.commands,
    ] };
    expect(deleteVectorAnchor(path, 0)).toEqual(ellipse);
    expect(vectorAnchors(path)).toHaveLength(5);
  });

  it.each([0, 1, 3])('deleting closed ellipse point %s keeps a valid single contour without duplicating the first anchor', index => {
    const path = deleteVectorAnchor(ellipse, index);
    expect(parseVectorPath(path)).toEqual(path); expect(vectorAnchors(path)).toHaveLength(3);
    const commands = path.commands;
    expect(commands[0].op).toBe('M'); expect(commands.at(-1)).toEqual({ op: 'Z' });
    expect(commands.at(-2)).toMatchObject({ x: (commands[0] as Point).x, y: (commands[0] as Point).y });
  });

  it('handles M-only, MZ, empty contours and open endpoints with explicit bounded policies', () => {
    const singleton: VectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }] };
    expect(curveVectorAnchor(singleton, 0, true)).toBe(singleton);
    expect(moveVectorHandle(singleton, 0, 'incoming', { x: 1, y: 1 })).toBe(singleton);
    expect(() => deleteVectorAnchor(singleton, 0)).toThrow(/at least one point/);
    expect(() => finishPenPath([], false)).toThrow(/at least two/);
    expect(() => finishPenPath([{ x: 1, y: 2 }], true)).toThrow(/at least two/);
    const multiple: VectorPath = { fillRule: 'evenodd', commands: [...singleton.commands, { op: 'Z' }, { op: 'M', x: 1, y: 1 }] };
    expect(deleteVectorAnchor(multiple, 0)).toEqual({ fillRule: 'evenodd', commands: [{ op: 'M', x: 1, y: 1 }] });
    const open: VectorPath = { fillRule: 'nonzero', commands: [...singleton.commands, { op: 'L', x: 1, y: 1 }] };
    expect(moveVectorHandle(open, 0, 'incoming', { x: -1, y: 0 })).toBe(open);
    expect(moveVectorHandle(open, 1, 'outgoing', { x: 2, y: 1 })).toBe(open);
  });

  it('normalizes pen control points without changing their canvas-space positions', () => {
    const anchors = [{ x: 120, y: 70, outgoing: { x: 70, y: -30 } }, { x: 300, y: 210, incoming: { x: 350, y: 280 } }];
    const result = finishPenPath(anchors, false), command = result.vectorPath.commands[1] as Cubic;
    expect(result.vectorPath.commands.at(-1)?.op).toBe('C');
    expect(result.x + command.x1 * result.width).toBeCloseTo(70, 12);
    expect(result.y + command.y1 * result.height).toBeCloseTo(-30, 12);
    expect(result.x + command.x2 * result.width).toBeCloseTo(350, 12);
    expect(result.y + command.y2 * result.height).toBeCloseTo(280, 12);
    expect(result.x + command.x * result.width).toBeCloseTo(300, 12);
    expect(result.y + command.y * result.height).toBeCloseTo(210, 12);
  });

  it.each([0, 37, 90, 180, -65])('inverts rotated non-square widget coordinates at %s degrees', rotation => {
    const box = { x: 140, y: -40, width: 320, height: 75, rotation }, p = { x: -.2, y: 1.4 }, r = rotation * Math.PI / 180;
    const local = { x: (p.x - .5) * box.width, y: (p.y - .5) * box.height };
    const canvas = { x: box.x + box.width / 2 + local.x * Math.cos(r) - local.y * Math.sin(r), y: box.y + box.height / 2 + local.x * Math.sin(r) + local.y * Math.cos(r) };
    const actual = canvasToVectorPoint(canvas, box);
    expect(actual.x).toBeCloseTo(p.x, 13); expect(actual.y).toBeCloseTo(p.y, 13);
  });
});
