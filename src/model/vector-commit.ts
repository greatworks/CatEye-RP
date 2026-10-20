import type { VectorCommand, VectorPath, Widget } from './types';
import { parseVectorPath } from './vector';
import { vectorMeasurementContours } from './vector-contours';
import type { VectorPoint } from './vector-editing';

export interface VectorCommitFrame { x: number; y: number; width: number; height: number }
type CommitWidget = Pick<Widget, 'x' | 'y' | 'width' | 'height' | 'rotation'> & {style:Pick<Widget['style'],'strokeWidth'>};
interface CommitRotation {angle:number;sin:number;cos:number}

function center(rect: VectorCommitFrame): VectorPoint { return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; }
function sizingRotation(degrees:number):CommitRotation {
  // d5sq chooses the unrotated SizingRect BEFORE any world-point mapping.
  if(Math.abs(degrees)<1e-5)return{angle:0,sin:0,cos:1};
  // i5sa uses signed remainder, not positive modulo. Full turns retain rotated
  // dispatch even when their exact sin/cos are the identity transform.
  const remainder=degrees%360,near=(n:number)=>Math.abs(remainder-n)<1e-5;
  const [sin,cos]=near(0)||near(360)?[0,1]:near(90)?[1,0]:near(180)?[0,-1]:near(270)?[-1,0]:[Math.sin(degrees*Math.PI/180),Math.cos(degrees*Math.PI/180)];
  return{angle:degrees,sin,cos};
}
function rotate(point: VectorPoint, origin: VectorPoint, frame:CommitRotation, inverse=false): VectorPoint {
  if (frame.angle === 0) return { ...point };
  const cos=frame.cos,sin=inverse?-frame.sin:frame.sin,x = point.x - origin.x, y = point.y - origin.y;
  return { x: origin.x + x * cos - y * sin, y: origin.y + x * sin + y * cos };
}
function mapPath(path: VectorPath, fn: (point: VectorPoint) => VectorPoint): VectorPath {
  return { fillRule: path.fillRule, commands: path.commands.map((command): VectorCommand => {
    if (command.op === 'Z') return { op: 'Z' };
    if (command.op !== 'C') return { op: command.op, ...fn(command) };
    const first = fn({ x: command.x1, y: command.y1 }), second = fn({ x: command.x2, y: command.y2 });
    return { op: 'C', x1: first.x, y1: first.y, x2: second.x, y2: second.y, ...fn(command) };
  }) };
}

/** Extrema of the cubic itself, never the control-handle hull. */
function axisExtents(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = p3 - 3 * (p2 - p1) - p0, b = 3 * (p2 - 2 * p1 + p0), c = 3 * (p1 - p0);
  const quadratic = 3 * a, linear = 2 * b;
  const roots: number[] = [];
  // These are the retained polynomial solver's thresholds, not a geometric
  // tolerance invented for the editor. Roots outside the segment are ignored.
  if (Math.abs(quadratic) < 1e-5 && Math.abs(linear) >= 1e-5) roots.push(-c / linear);
  else {
    const discriminant = linear * linear - 4 * quadratic * c;
    if (discriminant >= 0) {
      if (Math.abs(discriminant) < 1e-6) roots.push(-linear / (2 * quadratic));
      else { const square = Math.sqrt(discriminant); roots.push((-linear + square) / (2 * quadratic), (-linear - square) / (2 * quadratic)); }
    }
  }
  return [p0, p3, ...roots.filter(t => t >= 0 && t <= 1).map(t => p0 + t * (c + t * (b + t * a)))];
}

// Native rounding has a one-sided near-integer exception: keep the original
// fractional value just BELOW an integer when flooring (and just ABOVE when
// ceiling). Do not replace this with round() or a symmetric integer tolerance.
function outwardFloor(value: number): number { const floor = Math.floor(value); return Math.abs(value - floor - 1) < 1e-5 ? value : floor; }
function outwardCeil(value: number): number { const ceil = Math.ceil(value); return Math.abs(ceil - value - 1) < 1e-5 ? value : ceil; }

/** The actual point-edit entry TN46(points,false): curve bounds in the old
 * rotated frame, outward rounding, minimum owner size, THEN normalization.
 * It deliberately does not implement RN4I's different AutoFit/view-write scope
 * or its pre-minimum normalization. Inputs/outputs use the existing document
 * bounds. Empty command arrays and general transform matrices remain outside
 * the document contract; isolated anchors have source-derived bounds behavior. */
export function commitVectorGeometry(widget: CommitWidget, value: VectorPath): { bounds: VectorCommitFrame; vectorPath: VectorPath } {
  const path = parseVectorPath(value), oldCenter = center(widget);
  if (![widget.x, widget.y, widget.width, widget.height, widget.rotation, widget.style.strokeWidth].every(Number.isFinite) || widget.width <= 0 || widget.height <= 0 || widget.style.strokeWidth < 0) throw new Error('Invalid point-edit frame');
  const rotation=sizingRotation(widget.rotation);
  const worldPoint = (point: VectorPoint) => rotate({ x: widget.x + point.x * widget.width, y: widget.y + point.y * widget.height }, oldCenter, rotation);
  const xs: number[] = [], ys: number[] = [];
  // Native ReIndex is temporary and runs after inverse rotation. Do not filter
  // the authoring segments or discard saved anchors/handles during measurement.
  const measured=vectorMeasurementContours(path,point=>rotate(worldPoint(point),oldCenter,rotation,true));
  const firstAnchorFallback=rotation.angle===0&&!measured.contours.length;
  for (const segment of measured.contours.flat()) {
    if(rotation.angle===0&&!segment.active)continue;
    const from = segment.from, to = segment.to;
    if (segment.c1 && segment.c2) {
      const c1 = segment.c1, c2 = segment.c2;
      xs.push(...axisExtents(from.x, c1.x, c2.x, to.x)); ys.push(...axisExtents(from.y, c1.y, c2.y, to.y));
    } else { xs.push(from.x, to.x); ys.push(from.y, to.y); }
  }
  if(!xs.length){
    // Unrotated all-pruned data falls back to the first raw anchor. Surviving
    // but inactive curves, and rotated all-pruned data, use the zero union.
    const fallback=firstAnchorFallback?measured.first:{x:0,y:0};
    xs.push(fallback.x);ys.push(fallback.y);
  }
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  let origin = { x: minX, y: minY };
  if (rotation.angle !== 0) {
    const topLeft = rotate(origin, oldCenter, rotation), bottomRight = rotate({ x: maxX, y: maxY }, oldCenter, rotation);
    origin = rotate(topLeft, { x: (topLeft.x + bottomRight.x) / 2, y: (topLeft.y + bottomRight.y) / 2 }, rotation,true);
  }
  // iN4x's raw first-anchor fallback jumps over Y5uk. It enters minimum-size
  // expansion with its fractional position and zero size intact.
  const left = firstAnchorFallback?origin.x:outwardFloor(origin.x), top = firstAnchorFallback?origin.y:outwardFloor(origin.y);
  const bounds = { x: left, y: top, width: firstAnchorFallback?0:outwardCeil(origin.x + (maxX - minX)) - left, height: firstAnchorFallback?0:outwardCeil(origin.y + (maxY - minY)) - top };
  const minimum = Math.max(widget.style.strokeWidth, 1);
  if (bounds.width < minimum) { bounds.x = Math.floor(bounds.x + (bounds.width - minimum) / 2); bounds.width = minimum; }
  if (bounds.height < minimum) { bounds.y = Math.floor(bounds.y + (bounds.height - minimum) / 2); bounds.height = minimum; }
  for (const [key, number] of Object.entries(bounds)) {
    if (!Number.isFinite(number) || number > 100000 || number < (key === 'width' || key === 'height' ? 1 : -100000)) throw new Error(`Point-edit ${key} exceeds document bounds`);
  }
  const newCenter = center(bounds);
  const normalized = mapPath(path, point => {
    const unrotated = rotate(worldPoint(point), newCenter, rotation,true);
    return { x: (unrotated.x - bounds.x) / bounds.width, y: (unrotated.y - bounds.y) / bounds.height };
  });
  return { bounds, vectorPath: parseVectorPath(normalized) };
}
