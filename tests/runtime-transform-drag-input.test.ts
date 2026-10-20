import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { bindRuntimeDrag, type RuntimeDragInput } from '../src/runtime/drag-input';

class Surface {
  listeners = new Map<string, Set<(event: unknown) => void>>();
  addEventListener(name: string, listener: (event: unknown) => void) { const set = this.listeners.get(name) ?? new Set(); set.add(listener); this.listeners.set(name, set); }
  removeEventListener(name: string, listener: (event: unknown) => void) { this.listeners.get(name)?.delete(listener); if (!this.listeners.get(name)?.size) this.listeners.delete(name); }
  emit(name: string, event: unknown = {}) { for (const listener of [...this.listeners.get(name) ?? []]) listener(event); }
}
function event(target: unknown, x: number, y: number, touch = false) {
  return { target, pageX: x, pageY: y, ...(touch ? { changedTouches: [{ pageX: x, pageY: y }] } : {}), preventDefault: vi.fn(), stopPropagation: vi.fn(), stopImmediatePropagation: vi.fn() } as unknown as MouseEvent & { preventDefault: ReturnType<typeof vi.fn> };
}
function fixture(portable: boolean) {
  const window = new Surface(), document = Object.assign(new Surface(), { defaultView: window, body: { style: { cursor: 'auto' } } });
  const element = { style: { cursor: 'crosshair' }, isConnected: true } as HTMLElement;
  const runtime: RuntimeDragInput = { beginDrag: vi.fn(() => true), dragMove: vi.fn(async () => {}), endDrag: vi.fn(async () => {}), cancelDrag: vi.fn() };
  const error = vi.fn(), bind: typeof bindRuntimeDrag = portable ? runInNewContext(`(${bindRuntimeDrag.toString()})`) : bindRuntimeDrag;
  const controller = bind(document as unknown as Document, runtime, error);
  return { window, document, element, runtime, error, controller };
}
for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} drag input bridge`, () => {
  it('sends page coordinates and full row identity, including the first zero displacement; Drop supplies no mouseup coordinates', () => {
    const f = fixture(portable), context = [{ repeaterId: 'outer', rowId: 'r1' }, { repeaterId: 'inner', rowId: 'r2' }], down = event(f.element, 10, 20);
    expect(f.controller.start(down, 'box', context, f.element, { moveCursor: true })).toBe(true); expect(down.preventDefault).toHaveBeenCalledOnce();
    expect(f.runtime.beginDrag).toHaveBeenCalledWith('box', 10, 20, context);
    f.document.emit('mousemove', event(f.element, 10, 20)); expect(f.runtime.dragMove).toHaveBeenLastCalledWith(10, 20); expect(f.document.body.style.cursor).toBe('move');
    f.document.emit('mousemove', event(f.element, 17, 24)); expect(f.runtime.dragMove).toHaveBeenLastCalledWith(17, 24);
    expect(f.controller.hasActiveDrag()).toBe(true);
    f.document.emit('mouseup', event(f.element, 999, 888)); expect(f.runtime.endDrag).toHaveBeenCalledExactlyOnceWith(); expect(f.document.body.style.cursor).toBe('auto'); expect(f.element.style.cursor).toBe('crosshair');
    expect(f.controller.hasActiveDrag()).toBe(false);
    const click = event(f.element, 999, 888); f.document.emit('click', click); expect(click.preventDefault).toHaveBeenCalledOnce(); expect(f.document.listeners.has('click')).toBe(false);
    f.controller.dispose(); expect(f.document.listeners.size).toBe(0); expect(f.window.listeners.size).toBe(0);
  });
  it('does not register movement or prevent default for an ineligible source', () => {
    const f = fixture(portable), down = event(f.element, 0, 0); vi.mocked(f.runtime.beginDrag).mockReturnValue(false);
    expect(f.controller.start(down, 'box', [], f.element)).toBe(false); expect(down.preventDefault).not.toHaveBeenCalled(); expect(f.document.listeners.has('mousemove')).toBe(false); f.controller.dispose();
  });
  it('ignores a second start and explicit donotdrag input', () => {
    const f = fixture(portable), down = event(f.element, 0, 0); Object.assign(down, { donotdrag: true }); expect(f.controller.start(down, 'box', [], f.element)).toBe(false);
    expect(f.controller.start(event(f.element, 1, 2), 'box', [], f.element)).toBe(true); expect(f.controller.start(event(f.element, 3, 4), 'second', [], f.element)).toBe(false); expect(f.runtime.beginDrag).toHaveBeenCalledOnce(); f.controller.dispose();
  });
  it('does not suppress a click without movement or after mouseup on another target', () => {
    for (const moved of [false, true]) { const f = fixture(portable); f.controller.start(event(f.element, 0, 0), 'box', [], f.element); if (moved) f.document.emit('mousemove', event(f.element, 1, 2)); f.document.emit('mouseup', event(moved ? {} : f.element, 2, 3)); expect(f.document.listeners.has('click')).toBe(false); f.controller.dispose(); }
  });
  it('clears click suppression on subsequent document movement', () => {
    const f = fixture(portable); f.controller.start(event(f.element, 0, 0), 'box', [], f.element); f.document.emit('mousemove', event(f.element, 1, 2)); f.document.emit('mouseup', event(f.element, 1, 2)); f.document.emit('mousemove', event(f.element, 2, 2)); expect(f.document.listeners.has('click')).toBe(false); f.controller.dispose();
  });
  it('keeps touch scrolling at exactly five pixels and prevents it above five, without suppressing touch clicks', () => {
    const f = fixture(portable), down = event(f.element, 0, 0, true); f.controller.start(down, 'box', [], f.element); expect(down.preventDefault).not.toHaveBeenCalled();
    const a = event(f.element, 5, 50, true), b = event(f.element, 11, 50, true); f.document.emit('touchmove', a); f.document.emit('touchmove', b); expect(a.preventDefault).not.toHaveBeenCalled(); expect(b.preventDefault).toHaveBeenCalledOnce();
    f.document.emit('touchend', event(f.element, 11, 50, true)); expect(f.document.listeners.has('click')).toBe(false); f.controller.dispose();
  });
  it('honors configured touch prevention and ignores a mouse move during touch', () => {
    const f = fixture(portable); f.controller.start(event(f.element, 0, 0, true), 'box', [], f.element, { preventTouch: true });
    f.document.emit('mousemove', event(f.element, 1, 1)); expect(f.runtime.dragMove).not.toHaveBeenCalled(); const next = event(f.element, 0, 1, true); f.document.emit('touchmove', next); expect(next.preventDefault).toHaveBeenCalledOnce(); f.controller.dispose();
  });
  it.each(['blur', 'pointercancel', 'dragend', 'touchcancel'])('cancels %s without Drop and restores cursors once', name => {
    const f = fixture(portable); f.controller.start(event(f.element, 0, 0), 'box', [], f.element, { moveCursor: true }); f.document.emit('mousemove', event(f.element, 1, 2)); (name === 'touchcancel' ? f.document : f.window).emit(name);
    expect(f.runtime.cancelDrag).toHaveBeenCalledOnce(); expect(f.runtime.endDrag).not.toHaveBeenCalled(); expect(f.document.body.style.cursor).toBe('auto'); expect(f.document.listeners.has('mousemove')).toBe(false); f.controller.dispose(); expect(f.runtime.cancelDrag).toHaveBeenCalledOnce();
  });
  it('does not erase a completed drag snapshot on later blur or disposal', () => {
    const f = fixture(portable); f.controller.start(event(f.element, 0, 0), 'box', [], f.element); f.document.emit('mousemove', event(f.element, 1, 2)); f.document.emit('mouseup', event(f.element, 1, 2)); f.window.emit('blur'); f.controller.dispose(); expect(f.runtime.cancelDrag).not.toHaveBeenCalled();
  });
  it('reports asynchronous failures and tolerates a source removed during Drop', async () => {
    const f = fixture(portable); vi.mocked(f.runtime.dragMove).mockRejectedValueOnce(Error('motion failed')); f.controller.start(event(f.element, 0, 0), 'box', [], f.element, { moveCursor: true }); f.document.emit('mousemove', event(f.element, 1, 2)); await Promise.resolve(); expect(f.error).toHaveBeenCalledOnce();
    Object.assign(f.element, { isConnected: false }); expect(() => f.document.emit('mouseup', event(f.element, 1, 2))).not.toThrow(); expect(f.document.body.style.cursor).toBe('auto'); f.controller.dispose();
  });
});
