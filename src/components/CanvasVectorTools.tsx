import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { VectorPath, Widget } from '../model/types';
import { vectorPathData } from '../model/vector';
import { resolveVectorEditPath, vectorEditPathUnsupportedReason } from '../model/vector-authoring';
import { canvasToVectorPoint, closestVectorT, constrainVectorHandle, curveVectorAnchor, deleteVectorAnchor, finishPenPath, moveVectorAnchor, moveVectorHandle, penVectorPath, splitVectorSegment, vectorAnchors, vectorSegments } from '../model/vector-editing';
import type { EditableAnchor, VectorPoint } from '../model/vector-editing';

export interface CanvasVectorToolsHandle { keyDown(event: KeyboardEvent): boolean }
interface Props {
  mode: 'pen' | 'points'; widget?: Widget; zoom: number; surface: RefObject<HTMLDivElement | null>;
  onCreate(value: ReturnType<typeof finishPenPath>): void;
  onPathChange(path: VectorPath): void; onPreview(path: VectorPath | null): void;
  onDone(): void; onNotice(message: string): void;
}
type Gesture = { pointer: number; start: VectorPoint; index: number; side?: 'incoming' | 'outgoing'; path?: VectorPath; frame?: string; pen?: EditableAnchor[]; moved: boolean };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** No document changes while a pointer is held. A completed gesture commits exactly once. */
export const CanvasVectorTools = forwardRef<CanvasVectorToolsHandle, Props>(function CanvasVectorTools({ mode, widget, zoom, surface, onCreate, onPathChange, onPreview, onDone, onNotice }, ref) {
  const [pen, setPen] = useState<EditableAnchor[]>([]), penRef = useRef(pen); penRef.current = pen;
  const [draft, setDraft] = useState<VectorPath | null>(null), draftRef = useRef(draft); draftRef.current = draft;
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const gesture = useRef<Gesture | null>(null), svg = useRef<SVGSVGElement>(null);
  const sourceKey = JSON.stringify(widget && { type: widget.type, vectorPath: widget.vectorPath, style: widget.style, width: widget.width, height: widget.height });
  const frameKey = JSON.stringify(widget && { x: widget.x, y: widget.y, width: widget.width, height: widget.height, rotation: widget.rotation });
  const sourcePath = useMemo(() => widget && !vectorEditPathUnsupportedReason(widget) ? resolveVectorEditPath(widget) : undefined, [sourceKey]);
  const path = draft ?? sourcePath;
  const anchors = path && mode === 'points' ? vectorAnchors(path) : pen;
  const segments = path && mode === 'points' ? vectorSegments(path) : [];
  const scaleX = mode === 'points' ? widget!.width : 1, scaleY = mode === 'points' ? widget!.height : 1;
  const transform = mode === 'points' ? `translate(${widget!.x} ${widget!.y}) rotate(${widget!.rotation} ${widget!.width / 2} ${widget!.height / 2})` : undefined;
  function point(event: { clientX: number; clientY: number }): VectorPoint {
    const box = surface.current!.getBoundingClientRect();
    const p = { x: (event.clientX - box.left) / zoom, y: (event.clientY - box.top) / zoom };
    return mode === 'points' ? canvasToVectorPoint(p, widget!) : p;
  }
  function report(error: unknown) { onNotice(error instanceof Error ? error.message : String(error)); }
  function show(next: VectorPath | null) { draftRef.current = next; setDraft(next); onPreview(next); }
  function setPoints(next: EditableAnchor[]) { penRef.current = next; setPen(next); }
  function commit(next: VectorPath) {
    if (sourcePath && !same(next, sourcePath)) onPathChange(next);
    show(null);
  }
  function finish(closed: boolean) {
    gesture.current = null;
    if (penRef.current.length < 2) { setPoints([]); onDone(); return; }
    try { onCreate(finishPenPath(penRef.current, closed)); setPoints([]); onDone(); } catch (error) { report(error); }
  }
  function capture(event: ReactPointerEvent<SVGElement>) { event.preventDefault(); event.stopPropagation(); svg.current!.setPointerCapture(event.pointerId); }
  function beginPoint(event: ReactPointerEvent<SVGElement>, index: number, side?: 'incoming' | 'outgoing') {
    if (event.button !== 0 || !path) return;
    capture(event); setSelectedPoint(index);
    gesture.current = { pointer: event.pointerId, start: point(event), index, side, path, frame: frameKey, moved: false };
  }
  function beginPen(event: ReactPointerEvent<SVGElement>) {
    if (event.button !== 0) return;
    capture(event);
    const p = point(event), previous = penRef.current;
    if (previous.length > 1 && Math.hypot(p.x - previous[0].x, p.y - previous[0].y) * zoom <= 8) { finish(true); return; }
    // The second pointerdown of a double click must not create an extra coincident node.
    if (previous.length && Math.hypot(p.x - previous.at(-1)!.x, p.y - previous.at(-1)!.y) * zoom < 1) return;
    if (previous.length >= 4095) { onNotice('Path exceeds 4096 commands'); return; }
    gesture.current = { pointer: event.pointerId, start: p, index: previous.length, pen: previous, moved: false };
    setPoints([...previous, p]); setSelectedPoint(previous.length);
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    event.stopPropagation();
    let p = point(event);
    const pixelDistance = Math.hypot((p.x - active.start.x) * scaleX, (p.y - active.start.y) * scaleY) * zoom;
    if (active.path && pixelDistance < .000001) { show(active.path); return; }
    if (pixelDistance < 2 && !active.moved) return;
    active.moved = true;
    try {
      if (active.pen) {
        if (event.shiftKey) p = constrainVectorHandle(active.start, p);
        const anchor: EditableAnchor = { ...active.start, outgoing: p };
        if (!event.altKey) anchor.incoming = { x: 2 * active.start.x - p.x, y: 2 * active.start.y - p.y };
        setPoints([...active.pen, anchor]);
      } else if (active.path) {
        const anchor = vectorAnchors(active.path)[active.index];
        if (active.side) {
          const originalHandle = anchor[active.side] ?? anchor;
          p = { x: originalHandle.x + p.x - active.start.x, y: originalHandle.y + p.y - active.start.y };
          // Shift uses displayed local X/Y, not normalized-axis magnitudes.
          if (event.shiftKey) { const pixel = constrainVectorHandle({ x: anchor.x * scaleX, y: anchor.y * scaleY }, { x: p.x * scaleX, y: p.y * scaleY }); p = { x: pixel.x / scaleX, y: pixel.y / scaleY }; }
          show(moveVectorHandle(active.path, active.index, active.side, p, event.altKey));
        } else show(moveVectorAnchor(active.path, active.index, { x: anchor.x + p.x - active.start.x, y: anchor.y + p.y - active.start.y }));
      }
    } catch (error) { report(error); }
  }
  function end(event: ReactPointerEvent<SVGSVGElement>) {
    const active = gesture.current; if (!active || active.pointer !== event.pointerId) return;
    event.stopPropagation(); gesture.current = null;
    if (svg.current?.hasPointerCapture(event.pointerId)) svg.current.releasePointerCapture(event.pointerId);
    if (active.path && active.moved && draftRef.current) commit(draftRef.current);
    else if (active.path) show(null);
  }
  function cancel() {
    const active = gesture.current; gesture.current = null;
    if (active && svg.current?.hasPointerCapture(active.pointer)) svg.current.releasePointerCapture(active.pointer);
    if (active?.pen) setPoints(active.pen);
    show(null);
  }
  useEffect(() => {
    if (gesture.current?.path && (!same(gesture.current.path, sourcePath) || gesture.current.frame !== frameKey)) cancel();
  }, [sourcePath, frameKey]);
  function curve(curved?: boolean, index = selectedPoint, source = path) {
    if (!source || index === null) return;
    const anchor = vectorAnchors(source)[index]; if (!anchor) return;
    const isCurved = !!((anchor.incoming && !same(anchor.incoming, { x: anchor.x, y: anchor.y })) || (anchor.outgoing && !same(anchor.outgoing, { x: anchor.x, y: anchor.y })));
    try { commit(curveVectorAnchor(source, index, curved ?? !isCurved)); } catch (error) { report(error); }
  }
  useImperativeHandle(ref, () => ({ keyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'Escape') { event.preventDefault(); if (mode === 'pen') finish(false); else { cancel(); onDone(); } return true; }
    if (mode === 'pen') {
      // These keys belong to the drawing tool, not to the previously selected widget.
      if (['Delete', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); return true; }
      return false;
    }
    const source = gesture.current ? sourcePath : path;
    if (gesture.current && ['Delete', 'Backspace', '1', '2'].includes(event.key)) cancel();
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (selectedPoint !== null && source) try { const next = deleteVectorAnchor(source, selectedPoint); commit(next); setSelectedPoint(Math.min(selectedPoint, vectorAnchors(next).length - 1)); } catch (error) { report(error); }
      return true;
    }
    if (event.key === '1' || event.key === '2') { event.preventDefault(); curve(event.key === '2', selectedPoint, source); return true; }
    return false;
  } }));
  let penData = '';
  if (mode === 'pen' && pen.length) {
    // Keep the bounded normalized schema even for large canvas coordinates in a draft.
    const shrink = (p: VectorPoint) => ({ x: p.x / 100000, y: p.y / 100000 });
    penData = vectorPathData(penVectorPath(pen.map(p => ({ ...shrink(p), ...(p.incoming ? { incoming: shrink(p.incoming) } : {}), ...(p.outgoing ? { outgoing: shrink(p.outgoing) } : {}) })), false), 100000, 100000);
  }
  return <svg ref={svg} className="vector-canvas-overlay" data-vector-mode={mode} data-vector-widget-id={widget?.id ?? 'draft'} aria-label={mode === 'pen' ? 'Pen drawing canvas' : 'Vector point editor'} width="100%" height="100%" onPointerMove={move} onPointerUp={end} onPointerCancel={event => { event.stopPropagation(); cancel(); }} onLostPointerCapture={() => { if (gesture.current) cancel(); }} onDoubleClick={event => {
      if (mode === 'pen') { event.preventDefault(); event.stopPropagation(); finish(false); return; }
      // Pointer capture can retarget dblclick from a node to this SVG. Resolve its visible hit.
      const p = point(event);
      const index = anchors.findIndex(anchor => Math.hypot((p.x - anchor.x) * scaleX, (p.y - anchor.y) * scaleY) * zoom <= 8);
      if (index >= 0) { event.preventDefault(); event.stopPropagation(); setSelectedPoint(index); curve(undefined, index); }
    }}>
    {mode === 'pen' && <rect className="vector-pen-surface" width="100%" height="100%" fill="transparent" onPointerDown={beginPen}/>}
    <g transform={transform}>
      {mode === 'pen' && <path className="vector-draft-line" d={penData} fill="none" stroke="#4268e8" strokeWidth={1.5 / zoom}/>}
      {segments.map(segment => <path key={segment.commandIndex} data-vector-segment={segment.commandIndex} className="vector-segment-hit" d={vectorPathData({ fillRule: path!.fillRule, commands: [{ op: 'M', ...segment.from }, ...(segment.c1 && segment.c2 ? [{ op: 'C' as const, x1: segment.c1.x, y1: segment.c1.y, x2: segment.c2.x, y2: segment.c2.y, ...segment.to }] : [{ op: 'L' as const, ...segment.to }])] }, scaleX, scaleY)} fill="none" stroke="transparent" strokeWidth={12 / zoom} onPointerDown={event => {
        if (event.button !== 0) return; event.preventDefault(); event.stopPropagation();
        try { const result = splitVectorSegment(path!, segment.commandIndex, closestVectorT(segment, point(event), scaleX, scaleY)); commit(result.path); setSelectedPoint(result.anchor); } catch (error) { report(error); }
      }}/>) }
      {anchors.map((anchor, index) => <g key={index}>
        {(mode === 'points' ? selectedPoint === index : index === pen.length - 1) && (['incoming', 'outgoing'] as const).map(side => {
          const handle = anchor[side]; if (!handle) return null;
          return <g key={side}><line className="vector-handle-line" x1={anchor.x * scaleX} y1={anchor.y * scaleY} x2={handle.x * scaleX} y2={handle.y * scaleY} strokeWidth={1 / zoom}/><circle className="vector-handle" role="button" tabIndex={0} aria-label={`Vector handle ${index + 1} ${side}`} data-vector-anchor={index} data-vector-handle={side} cx={handle.x * scaleX} cy={handle.y * scaleY} r={4 / zoom} strokeWidth={1 / zoom} onPointerDown={event => mode === 'points' ? beginPoint(event, index, side) : event.stopPropagation()}/></g>;
        })}
        <rect className={`vector-anchor ${selectedPoint === index ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Vector point ${index + 1}`} data-vector-anchor={index} x={anchor.x * scaleX - 4 / zoom} y={anchor.y * scaleY - 4 / zoom} width={8 / zoom} height={8 / zoom} strokeWidth={1 / zoom} onPointerDown={event => mode === 'pen' ? beginPen(event) : beginPoint(event, index)} onFocus={() => setSelectedPoint(index)} onDoubleClick={event => { if (mode === 'points') { event.preventDefault(); event.stopPropagation(); curve(undefined, index); } }}/>
      </g>)}
    </g>
  </svg>;
});
