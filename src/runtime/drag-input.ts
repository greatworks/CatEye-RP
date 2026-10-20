import type { RowContext } from './export-runtime';

export interface RuntimeDragInput {
  beginDrag(id: string, x: number, y: number, context?: RowContext, time?: number): boolean;
  dragMove(x: number, y: number, time?: number): Promise<void>;
  endDrag(time?: number): Promise<void>;
  cancelDrag(): void;
}
export interface DragInputController {
  start(event: MouseEvent | TouchEvent, id: string, context: RowContext, element: HTMLElement, policy?: { moveCursor?: boolean; preventTouch?: boolean }): boolean;
  hasActiveDrag(): boolean;
  cancel(): void;
  dispose(): void;
}
/** Shared by Preview and both portable players; keep runtime dependencies inside
 * the function because the standalone HTML serializes it with toString(). */
export function bindRuntimeDrag(document: Document, runtime: RuntimeDragInput, onError: (error: unknown) => void): DragInputController {
  type Session = { target: EventTarget | null; element: HTMLElement; touch: boolean; x: number; moved: boolean; cursor?: { body: string; widget: string }; policy: { moveCursor?: boolean; preventTouch?: boolean } };
  const window = document.defaultView;
  let session: Session | undefined, disposed = false;
  const report = (work: Promise<void>) => { void work.catch(onError); };
  const touch = (event: MouseEvent | TouchEvent): event is TouchEvent => 'changedTouches' in event;
  const point = (event: MouseEvent | TouchEvent) => touch(event) ? event.changedTouches[0] : event;
  const clearClick = () => { document.removeEventListener('click', suppressClick, true); document.removeEventListener('mousemove', clearClick, true); };
  const suppressClick = (event: Event) => { clearClick(); event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); };
  const unlisten = () => {
    document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', end, true);
    document.removeEventListener('touchmove', move, true); document.removeEventListener('touchend', end, true);
  };
  const restoreCursor = (current: Session) => {
    if (!current.cursor) return;
    document.body.style.cursor = current.cursor.body;
    if (current.element.isConnected) current.element.style.cursor = current.cursor.widget;
  };
  const cancel = () => {
    unlisten(); clearClick(); const current = session; session = undefined;
    if (current) { restoreCursor(current); runtime.cancelDrag(); }
  };
  function move(event: MouseEvent | TouchEvent): void {
    const current = session; if (!current || touch(event) !== current.touch) return;
    const position = point(event); if (!position) return;
    if (current.touch && (current.policy.preventTouch || Math.abs(position.pageX - current.x) > 5)) event.preventDefault();
    current.x = position.pageX;
    const first = !current.moved; current.moved = true;
    report(runtime.dragMove(position.pageX, position.pageY));
    if (first && current.policy.moveCursor && session === current && current.element.isConnected) {
      current.cursor = { body: document.body.style.cursor, widget: current.element.style.cursor };
      document.body.style.cursor = 'move'; current.element.style.cursor = 'move';
    }
  }
  function end(event: MouseEvent | TouchEvent): void {
    const current = session; if (!current || touch(event) !== current.touch) return;
    unlisten(); session = undefined;
    // Original Drop samples time only and retains the last move's coordinates.
    report(runtime.endDrag()); restoreCursor(current);
    if (current.moved && !current.touch && current.target === event.target && !disposed) {
      document.addEventListener('click', suppressClick, true); document.addEventListener('mousemove', clearClick, true);
    }
  }
  window?.addEventListener('blur', cancel); window?.addEventListener('pointercancel', cancel); window?.addEventListener('dragend', cancel);
  document.addEventListener('touchcancel', cancel, true);
  return {
    start(event, id, context, element, policy = {}) {
      if (disposed || session || (event as MouseEvent & { donotdrag?: boolean }).donotdrag) return false;
      const position = point(event); if (!position || !runtime.beginDrag(id, position.pageX, position.pageY, context)) return false;
      clearClick(); const isTouch = touch(event);
      session = { target: event.target, element, touch: isTouch, x: position.pageX, moved: false, policy };
      if (!isTouch) event.preventDefault();
      if (isTouch) { document.addEventListener('touchmove', move, { capture: true, passive: false }); document.addEventListener('touchend', end, true); }
      else { document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', end, true); }
      return true;
    },
    hasActiveDrag: () => Boolean(session),
    cancel,
    dispose() {
      if (disposed) return; disposed = true; cancel();
      window?.removeEventListener('blur', cancel); window?.removeEventListener('pointercancel', cancel); window?.removeEventListener('dragend', cancel);
      document.removeEventListener('touchcancel', cancel, true);
    },
  };
}
