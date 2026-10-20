import { afterEach, describe, expect, it, vi } from 'vitest';
import { Script } from 'node:vm';
import { browserBoxReader, createBrowserBoxReader, type BorderWidths, type BoxMetrics } from '../src/runtime/browser-box';
import { createWidget } from '../src/model/document';
import { getStaticRepeaterLayout } from '../src/components/WidgetView';

afterEach(() => vi.unstubAllGlobals());
type MockElement = { style: Record<string, string>; remove: ReturnType<typeof vi.fn> };
function browser() {
  const elements: MockElement[] = [], connected = new Set<MockElement>();
  const document = { body: { appendChild: vi.fn((element: MockElement) => { connected.add(element); return element; }) }, createElement: vi.fn(() => {
    const element: MockElement = { style: {}, remove: vi.fn(() => connected.delete(element)) }; elements.push(element); return element;
  }) };
  const metrics: BoxMetrics = { width: 20.3281, height: 10.6562, borders: [2.66667, 4.66667, 6.66667, 2] };
  const computedPosition = { x: 4.33333, y: -6.66667 };
  const getComputedStyle = vi.fn((element: MockElement) => {
    expect(connected.has(element)).toBe(true);
    return { width: `${metrics.width}px`, height: `${metrics.height}px`, borderTopWidth: `${metrics.borders[0]}px`, borderRightWidth: `${metrics.borders[1]}px`, borderBottomWidth: `${metrics.borders[2]}px`, borderLeftWidth: `${metrics.borders[3]}px`, left: `${computedPosition.x}px`, top: `${computedPosition.y}px` };
  });
  return { document, getComputedStyle, metrics, computedPosition, elements, connected, devicePixelRatio: 1.5 };
}
function install(env: ReturnType<typeof browser>) {
  vi.stubGlobal('document', env.document); vi.stubGlobal('getComputedStyle', env.getComputedStyle); vi.stubGlobal('devicePixelRatio', env.devicePixelRatio);
}
function reader(portable: boolean, env?: ReturnType<typeof browser>): ReturnType<typeof createBrowserBoxReader> {
  if (portable) return new Script(`(${createBrowserBoxReader.toString()})()`).runInNewContext(env ? { document: env.document, getComputedStyle: env.getComputedStyle, get devicePixelRatio() { return env.devicePixelRatio; } } : {});
  if (env) install(env); return createBrowserBoxReader();
}

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} browser box reader`, () => {
  it('falls back to nonnegative sizes and border sums without browser globals', () => {
    const read = reader(portable), borders: BorderWidths = [3, 5, 7, 2];
    expect(read(-6, -2, borders)).toEqual({ width: 7, height: 10, borders });
    expect(read(102, 22, borders)).toEqual({ width: 102, height: 22, borders });
    expect(read(0, 0, [0, 0, 0, 0])).toEqual({ width: 0, height: 0, borders: [0, 0, 0, 0] });
  });

  it('includes a cloned requested position only when the optional fallback argument is present', () => {
    const read = reader(portable), position = { x: -2.25, y: 0.333333 };
    const result = read(0, 0, [3, 5, 7, 2], position);
    expect(result).toEqual({ width: 7, height: 10, borders: [3, 5, 7, 2], position });
    result.position!.x = 100; expect(position.x).toBe(-2.25);
    expect(read(0, 0, [3, 5, 7, 2])).not.toHaveProperty('position');
  });

  it('reads computed left/top separately from size rounding without using DOMRect or overwriting assignments', () => {
    const env = browser(), read = reader(portable, env), position = { x: 4.333333333, y: -6.666666667 };
    env.metrics.width = 4.32292;
    expect(read(4.333333333, 10, [0, 0, 0, 0], position)).toEqual({ ...env.metrics, position: env.computedPosition });
    expect(env.elements[0].style).toMatchObject({ left: '4.333333333px', top: '-6.666666667px', width: '4.333333333px' });
    expect(env.elements[0].remove).toHaveBeenCalledOnce(); expect(env.connected.size).toBe(0);
    expect(position).toEqual({ x: 4.333333333, y: -6.666666667 });
  });

  it('separates absent and zero positions in the cache and keys both coordinates', () => {
    const env = browser(), read = reader(portable, env);
    expect(read(20, 10, [0, 0, 0, 0])).not.toHaveProperty('position');
    const input = { x: 0, y: 0 }, measured = read(20, 10, [0, 0, 0, 0], input);
    measured.position!.x = 100; input.y = 999;
    expect(read(20, 10, [0, 0, 0, 0], { x: 0, y: 0 }).position).toEqual(env.computedPosition);
    expect(env.getComputedStyle).toHaveBeenCalledTimes(2);
    read(20, 10, [0, 0, 0, 0], { x: 1, y: 0 }); read(20, 10, [0, 0, 0, 0], { x: 0, y: 1 });
    expect(env.getComputedStyle).toHaveBeenCalledTimes(4);
    expect(read(20, 10, [0, 0, 0, 0])).not.toHaveProperty('position');
  });

  it('does not retain invalid position measurements in the cache', () => {
    const env = browser(), read = reader(portable, env); env.computedPosition.x = NaN;
    expect(read(20, 10, [0, 0, 0, 0], { x: -2, y: 3 })).toEqual({ width: 20, height: 10, borders: [0, 0, 0, 0], position: { x: -2, y: 3 } });
    env.computedPosition.x = 4.33333;
    expect(read(20, 10, [0, 0, 0, 0], { x: -2, y: 3 })).toEqual({ ...env.metrics, position: env.computedPosition });
    expect(env.getComputedStyle).toHaveBeenCalledTimes(2); expect(env.connected.size).toBe(0);
  });

  it('reads browser-computed rounding instead of deriving a DPR formula and removes the hidden probe', () => {
    const env = browser(), read = reader(portable, env), borders: BorderWidths = [3, 5, 7, 2];
    expect(read(20.333333, 10.666666, borders)).toEqual(env.metrics);
    expect(env.document.createElement).toHaveBeenCalledWith('div');
    expect(env.elements[0].style).toMatchObject({ position: 'fixed', visibility: 'hidden', borderStyle: 'solid', borderWidth: '3px 5px 7px 2px', boxSizing: 'border-box', padding: '0px', width: '20.333333px', height: '10.666666px' });
    expect(env.elements[0].remove).toHaveBeenCalledOnce(); expect(env.connected.size).toBe(0);
    read(-6, -2, borders); expect(env.elements[1].style).toMatchObject({ width: '0px', height: '0px' });
  });

  it('keys measurements by DPR, dimensions and every border side, without leaking mutable cached arrays', () => {
    const env = browser(), read = reader(portable, env), borders: BorderWidths = [3, 5, 7, 2];
    const first = read(20, 10, borders); first.width = 999; first.borders[0] = 999; borders[1] = 50;
    expect(read(20, 10, [3, 5, 7, 2])).toEqual(env.metrics); expect(env.getComputedStyle).toHaveBeenCalledTimes(1);
    read(21, 10, [3, 5, 7, 2]); read(20, 11, [3, 5, 7, 2]);
    for (let side = 0; side < 4; side++) { const widths: BorderWidths = [3, 5, 7, 2]; widths[side]++; read(20, 10, widths); }
    expect(env.getComputedStyle).toHaveBeenCalledTimes(7);
    env.devicePixelRatio = 2; if (!portable) vi.stubGlobal('devicePixelRatio', 2);
    env.metrics.borders = [3, 5, 7, 2]; expect(read(20, 10, [3, 5, 7, 2]).borders).toEqual([3, 5, 7, 2]); expect(env.getComputedStyle).toHaveBeenCalledTimes(8);
  });

  it('bounds the cache at 1000 entries and remeasures an evicted value', () => {
    const env = browser(), read = reader(portable, env);
    for (let width = 0; width < 1001; width++) read(width, 0, [0, 0, 0, 0]);
    read(1000, 0, [0, 0, 0, 0]); expect(env.getComputedStyle).toHaveBeenCalledTimes(1001);
    read(0, 0, [0, 0, 0, 0]); expect(env.getComputedStyle).toHaveBeenCalledTimes(1002); expect(env.connected.size).toBe(0);
  });

  it('cleans up if measurement throws and does not cache failed reads', () => {
    const env = browser(), read = reader(portable, env); env.getComputedStyle.mockImplementationOnce(() => { throw new Error('measurement failed'); });
    expect(() => read(1, 2, [3, 5, 7, 2])).toThrow('measurement failed'); expect(env.connected.size).toBe(0); expect(env.elements[0].remove).toHaveBeenCalledOnce();
    expect(read(1, 2, [3, 5, 7, 2])).toEqual(env.metrics); expect(env.getComputedStyle).toHaveBeenCalledTimes(2);
  });
});

describe('browser availability and static layout integration', () => {
  it('falls back when body or getComputedStyle is unavailable, then measures after the DOM becomes ready', () => {
    const env = browser(); install(env); const body = env.document.body;
    vi.stubGlobal('document', { ...env.document, body: null }); const read = createBrowserBoxReader();
    expect(read(0, 0, [3, 5, 7, 2])).toEqual({ width: 7, height: 10, borders: [3, 5, 7, 2] });
    vi.stubGlobal('document', { ...env.document, body }); vi.stubGlobal('getComputedStyle', undefined);
    expect(read(0, 0, [3, 5, 7, 2]).width).toBe(7); expect(env.document.createElement).not.toHaveBeenCalled();
    vi.stubGlobal('getComputedStyle', env.getComputedStyle); expect(read(0, 0, [3, 5, 7, 2])).toEqual(env.metrics);
  });

  it('uses mathematical fallback for DOM implementations that return nonnumeric computed sizes', () => {
    const env = browser(); install(env); env.metrics.width = NaN; const read = createBrowserBoxReader();
    expect(read(0, 0, [3, 5, 7, 2])).toEqual({ width: 7, height: 10, borders: [3, 5, 7, 2] });
    env.metrics.width = 7.3281; expect(read(0, 0, [3, 5, 7, 2])).toEqual(env.metrics); expect(env.connected.size).toBe(0);
  });

  it('uses computed top/left borders for authoring row origins while retaining authored outer dimensions', () => {
    const env = browser(); install(env); const widget = createWidget('repeater'); widget.style.borderWidths = [3, 5, 7, 2];
    widget.repeater!.padding = [5, 7, 11, 3]; const layout = getStaticRepeaterLayout(widget)!;
    expect(layout.rows[0].x).toBe(1); expect(layout.rows[0].y).toBeCloseTo(5 - 2.66667, 8);
    expect([layout.width, layout.height]).toEqual([274, 139]); expect(widget.style.borderWidths).toEqual([3, 5, 7, 2]);
    expect(browserBoxReader(0, 0, [3, 5, 7, 2])).toEqual(env.metrics); expect(env.getComputedStyle).toHaveBeenCalledTimes(1);
  });
});
