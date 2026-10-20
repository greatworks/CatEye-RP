import type { VectorCommand, VectorPath } from './types';
import { parseVectorPath } from './vector';

export interface VectorPoint { x: number; y: number }
export interface EditableAnchor extends VectorPoint { incoming?: VectorPoint; outgoing?: VectorPoint }
interface Contour { anchors: EditableAnchor[]; closed: boolean; explicitClose: boolean }
export interface VectorSegment { commandIndex: number; start: number; end: number; from: VectorPoint; to: VectorPoint; c1?: VectorPoint; c2?: VectorPoint }
const equal = (a: VectorPoint, b: VectorPoint) => a.x === b.x && a.y === b.y;
const mix = (a: VectorPoint, b: VectorPoint, t: number): VectorPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const xy = (p: VectorPoint): VectorPoint => ({ x: p.x, y: p.y });

function decode(path: VectorPath): Contour[] {
  const contours: Contour[] = [];
  for (const command of parseVectorPath(path).commands) {
    if (command.op === 'M') { contours.push({ anchors: [xy(command)], closed: false, explicitClose: false }); continue; }
    const contour = contours[contours.length - 1], previous = contour.anchors.at(-1)!;
    if (command.op === 'Z') {
      contour.closed = true;
      if (contour.anchors.length > 1 && equal(previous, contour.anchors[0])) {
        contour.explicitClose = true;
        contour.anchors[0].incoming = previous.incoming;
        contour.anchors.pop();
      }
    } else {
      const anchor: EditableAnchor = xy(command);
      if (command.op === 'C') {
        previous.outgoing = { x: command.x1, y: command.y1 };
        anchor.incoming = { x: command.x2, y: command.y2 };
      }
      contour.anchors.push(anchor);
    }
  }
  return contours;
}

function encode(contours: Contour[], fillRule: VectorPath['fillRule']): VectorPath {
  const commands: VectorCommand[] = [];
  const segment = (a: EditableAnchor, b: EditableAnchor) => {
    if (a.outgoing || b.incoming) commands.push({ op: 'C', x1: (a.outgoing ?? a).x, y1: (a.outgoing ?? a).y, x2: (b.incoming ?? b).x, y2: (b.incoming ?? b).y, x: b.x, y: b.y });
    else commands.push({ op: 'L', x: b.x, y: b.y });
  };
  for (const { anchors, closed, explicitClose } of contours) {
    if (!anchors.length) continue;
    commands.push({ op: 'M', ...xy(anchors[0]) });
    for (let i = 1; i < anchors.length; i++) segment(anchors[i - 1], anchors[i]);
    if (closed) {
      if (explicitClose || anchors.at(-1)!.outgoing || anchors[0].incoming) segment(anchors.at(-1)!, anchors[0]);
      commands.push({ op: 'Z' });
    }
  }
  return parseVectorPath({ fillRule, commands });
}

function locate(contours: Contour[], index: number) {
  if (!Number.isInteger(index) || index < 0) throw new Error('Invalid vector point');
  for (const contour of contours) {
    if (index < contour.anchors.length) return { contour, index, anchor: contour.anchors[index] };
    index -= contour.anchors.length;
  }
  throw new Error('Invalid vector point');
}

/** Explicit final endpoints equal to M followed by Z are one shared editing anchor. */
export function vectorAnchors(path: VectorPath): EditableAnchor[] { return decode(path).flatMap(contour => contour.anchors); }

export function vectorSegments(path: VectorPath): VectorSegment[] {
  const commands = parseVectorPath(path).commands, segments: VectorSegment[] = [];
  let first = -1, previous = -1, count = 0, start: VectorPoint = { x: 0, y: 0 }, point = start;
  commands.forEach((c, commandIndex) => {
    if (c.op === 'M') { first = previous = count++; start = point = xy(c); return; }
    if (c.op === 'Z') {
      if (!equal(point, start)) segments.push({ commandIndex, start: previous, end: first, from: point, to: start });
      return;
    }
    const duplicate = commands[commandIndex + 1]?.op === 'Z' && equal(c, start);
    const end = duplicate ? first : count++;
    segments.push({ commandIndex, start: previous, end, from: point, to: xy(c), ...(c.op === 'C' ? { c1: { x: c.x1, y: c.y1 }, c2: { x: c.x2, y: c.y2 } } : {}) });
    previous = end; point = xy(c);
  });
  return segments;
}

export function moveVectorAnchor(path: VectorPath, index: number, point: VectorPoint): VectorPath {
  const contours = decode(path), { anchor } = locate(contours, index);
  const dx = point.x - anchor.x, dy = point.y - anchor.y;
  if (!dx && !dy) return path;
  for (const handle of [anchor.incoming, anchor.outgoing]) if (handle) { handle.x += dx; handle.y += dy; }
  anchor.x = point.x; anchor.y = point.y;
  return encode(contours, path.fillRule);
}

export function constrainVectorHandle(anchor: VectorPoint, point: VectorPoint): VectorPoint {
  return Math.abs(point.x - anchor.x) >= Math.abs(point.y - anchor.y) ? { x: point.x, y: anchor.y } : { x: anchor.x, y: point.y };
}

export function moveVectorHandle(path: VectorPath, index: number, side: 'incoming' | 'outgoing', point: VectorPoint, independent = false): VectorPath {
  const contours = decode(path), { contour, anchor, index: local } = locate(contours, index);
  const opposite = side === 'incoming' ? 'outgoing' : 'incoming';
  const hasSide = side === 'incoming' ? local > 0 || contour.closed : local < contour.anchors.length - 1 || contour.closed;
  if (!hasSide) return path;
  anchor[side] = xy(point);
  const hasOpposite = side === 'incoming' ? local < contour.anchors.length - 1 || contour.closed : local > 0 || contour.closed;
  if (!independent && hasOpposite) anchor[opposite] = { x: 2 * anchor.x - point.x, y: 2 * anchor.y - point.y };
  return encode(contours, path.fillRule);
}

export function curveVectorAnchor(path: VectorPath, index: number, curved: boolean): VectorPath {
  const contours = decode(path), { contour, anchor, index: i } = locate(contours, index), nodes = contour.anchors;
  if (!curved) { delete anchor.incoming; delete anchor.outgoing; }
  else {
    const previous = nodes[i - 1] ?? (contour.closed ? nodes.at(-1) : undefined);
    const next = nodes[i + 1] ?? (contour.closed ? nodes[0] : undefined);
    if (!previous && !next) return path;
    const a = previous ?? anchor, b = next ?? anchor;
    let dx = b.x - a.x, dy = b.y - a.y;
    if (!dx && !dy) { dx = (next ?? previous!).x - anchor.x; dy = (next ?? previous!).y - anchor.y; }
    const length = Math.hypot(dx, dy) || 1;
    if (previous) { const distance = Math.hypot(previous.x - anchor.x, previous.y - anchor.y) / 3; anchor.incoming = { x: anchor.x - dx / length * distance, y: anchor.y - dy / length * distance }; }
    if (next) { const distance = Math.hypot(next.x - anchor.x, next.y - anchor.y) / 3; anchor.outgoing = { x: anchor.x + dx / length * distance, y: anchor.y + dy / length * distance }; }
  }
  // Only the two incident edges may lose a degenerate control. Keep unrelated commands intact.
  const previous = nodes[i - 1] ?? (contour.closed ? nodes.at(-1) : undefined);
  const next = nodes[i + 1] ?? (contour.closed ? nodes[0] : undefined);
  if (anchor.incoming && equal(anchor.incoming, anchor)) delete anchor.incoming;
  if (anchor.outgoing && equal(anchor.outgoing, anchor)) delete anchor.outgoing;
  if (previous?.outgoing && equal(previous.outgoing, previous)) delete previous.outgoing;
  if (next?.incoming && equal(next.incoming, next)) delete next.incoming;
  const result = encode(contours, path.fillRule);
  return JSON.stringify(result) === JSON.stringify(path) ? path : result;
}

export function deleteVectorAnchor(path: VectorPath, index: number): VectorPath {
  const contours = decode(path), { contour, index: i } = locate(contours, index);
  if (contours.reduce((n, c) => n + c.anchors.length, 0) === 1) throw new Error('A path needs at least one point');
  contour.anchors.splice(i, 1);
  if (!contour.closed && contour.anchors.length) { delete contour.anchors[0].incoming; delete contour.anchors.at(-1)!.outgoing; }
  return encode(contours, path.fillRule);
}

export function vectorSegmentPoint(segment: VectorSegment, t: number): VectorPoint {
  if (!segment.c1 || !segment.c2) return mix(segment.from, segment.to, t);
  const a = mix(segment.from, segment.c1, t), b = mix(segment.c1, segment.c2, t), c = mix(segment.c2, segment.to, t);
  return mix(mix(a, b, t), mix(b, c, t), t);
}

/** Split the actual polynomial; no straight-line approximation is stored. */
export function splitVectorSegment(path: VectorPath, commandIndex: number, t: number): { path: VectorPath; anchor: number } {
  if (!Number.isFinite(t) || t <= 0 || t >= 1) throw new Error('Split position must be inside the segment');
  const segment = vectorSegments(path).find(s => s.commandIndex === commandIndex);
  if (!segment) throw new Error('Invalid vector segment');
  const commands = parseVectorPath(path).commands, point = vectorSegmentPoint(segment, t), old = commands[commandIndex];
  if (segment.c1 && segment.c2) {
    const a = mix(segment.from, segment.c1, t), b = mix(segment.c1, segment.c2, t), c = mix(segment.c2, segment.to, t), d = mix(a, b, t), e = mix(b, c, t);
    commands.splice(commandIndex, 1, { op: 'C', x1: a.x, y1: a.y, x2: d.x, y2: d.y, ...point }, { op: 'C', x1: e.x, y1: e.y, x2: c.x, y2: c.y, ...segment.to });
  } else commands.splice(commandIndex, old.op === 'Z' ? 0 : 1, { op: 'L', ...point }, ...(old.op === 'Z' ? [] : [old]));
  const result = parseVectorPath({ fillRule: path.fillRule, commands });
  // The newly inserted command endpoint follows the start in global anchor order.
  return { path: result, anchor: segment.start + 1 };
}

/** Bounded nearest-point search in displayed pixels, used only to pick t for exact splitting. */
export function closestVectorT(segment: VectorSegment, point: VectorPoint, width: number, height: number): number {
  const distance = (t: number) => { const p = vectorSegmentPoint(segment, t); return ((p.x - point.x) * width) ** 2 + ((p.y - point.y) * height) ** 2; };
  let best = 0;
  for (let i = 1; i <= 64; i++) if (distance(i / 64) < distance(best)) best = i / 64;
  let lo = Math.max(0, best - 1 / 64), hi = Math.min(1, best + 1 / 64);
  for (let i = 0; i < 28; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (distance(a) < distance(b)) hi = b; else lo = a; }
  return Math.max(.000001, Math.min(.999999, (lo + hi) / 2));
}

export function canvasToVectorPoint(point: VectorPoint, box: { x: number; y: number; width: number; height: number; rotation: number }): VectorPoint {
  const radians = -box.rotation * Math.PI / 180, x = point.x - box.x - box.width / 2, y = point.y - box.y - box.height / 2;
  return { x: (x * Math.cos(radians) - y * Math.sin(radians) + box.width / 2) / box.width, y: (x * Math.sin(radians) + y * Math.cos(radians) + box.height / 2) / box.height };
}

/** Pen anchors are transient canvas pixels; save normalized geometry only on completion. */
export function penVectorPath(anchors: EditableAnchor[], closed: boolean): VectorPath {
  return encode([{ anchors: structuredClone(anchors), closed, explicitClose: false }], 'nonzero');
}
export function finishPenPath(anchors: EditableAnchor[], closed: boolean): { x: number; y: number; width: number; height: number; vectorPath: VectorPath } {
  if (anchors.length < 2) throw new Error('Draw at least two points');
  const coordinates = anchors.flatMap(p => [p, ...(p.incoming ? [p.incoming] : []), ...(p.outgoing ? [p.outgoing] : [])]);
  if (coordinates.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid pen coordinate');
  const x = Math.min(...coordinates.map(p => p.x)), y = Math.min(...coordinates.map(p => p.y));
  const width = Math.max(1, Math.max(...coordinates.map(p => p.x)) - x), height = Math.max(1, Math.max(...coordinates.map(p => p.y)) - y);
  if (Math.abs(x) > 100000 || Math.abs(y) > 100000 || width > 100000 || height > 100000) throw new Error('Path exceeds canvas coordinate limits');
  const normalize = (p: VectorPoint) => ({ x: (p.x - x) / width, y: (p.y - y) / height });
  const normalized = anchors.map(p => ({ ...normalize(p), ...(p.incoming ? { incoming: normalize(p.incoming) } : {}), ...(p.outgoing ? { outgoing: normalize(p.outgoing) } : {}) }));
  return { x, y, width, height, vectorPath: penVectorPath(normalized, closed) };
}
