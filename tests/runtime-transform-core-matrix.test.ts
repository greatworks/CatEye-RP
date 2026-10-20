import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, EventType, Interaction, WidgetType } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import { layoutTable } from '../src/model/table';

type Config = { actions?: [string, Record<string, string | number | boolean>][]; items?: { angle?: number; type?: string; hidden?: boolean; shadow?: { on: boolean; offsetX: number; offsetY: number; blurRadius: number } }[]; vars?: Record<string, number>; variables?: Record<string, number>; hook?: boolean | { event: string; variable: string; value: number } };
type Sample = { name: string; configuration: Config; final: { x: number; y: number; angle: number; moved?: { left: number | string; top: number | string }; querySize: { width: number; height: number } } };
const samples = (JSON.parse(readFileSync(new URL('../research/runtime-transform-browser-fixtures.json', import.meta.url), 'utf8')).cases as Sample[])
  .filter(s => s.configuration.actions?.every(([kind]) => ['move', 'resize', 'rotate'].includes(kind)) && !s.name.startsWith('numeric-zero') && !s.name.includes('overlap-repeat'));
const sessions: OfflineRuntime[] = [];
afterEach(() => { sessions.splice(0).forEach(r => r.dispose()); vi.useRealTimers(); });
const event = (type: EventType, actions: Action[]): Interaction => ({ id: uid(), name: type, event: type, enabled: true, conditions: [], conditionMode: 'all', actions });
const expression = (value: string | number | boolean) => ({ text: String(value).startsWith('$') ? `[[${String(value).slice(1)}]]` : String(value) });

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} retained DOM transform cache matrix`, () => {
  it.each(samples)('$name', async sample => {
    vi.useFakeTimers(); const config = sample.configuration, item = config.items?.[0], doc = createDocument();
    const mapped: Record<string, WidgetType> = { dynamicPanel: 'panel', textBox: 'input', table: 'table', inlineFrame: 'inlineFrame' };
    const widget = createWidget(mapped[item?.type ?? ''] ?? 'box', 100, 100), button = createWidget('button');
    Object.assign(widget, { width: 200, height: 100, rotation: item?.angle ?? 0, hidden: item?.hidden ?? false });
    if (widget.table) { widget.table.columnWidths = [60, 60, 80]; widget.table.rowHeights = [30, 30, 40]; Object.assign(widget, layoutTable(widget)); }
    if (item?.shadow) widget.style.outerShadow = { ...item.shadow, color: '#000000' };
    doc.pages[0].widgets = [widget, button]; doc.variables = { Read: '', ...Object.fromEntries(Object.entries(config.vars ?? config.variables ?? {}).map(([key, value]) => [key, String(value)])) };
    const hook = config.hook === true ? { event: 'onRotate', variable: 'x', value: 400 } : config.hook;
    widget.interactions = [event('click', [{ id: uid(), type: 'setVariable', targetId: 'Read', value: '[[This.x]],[[This.y]],[[This.width]],[[This.height]]' }])];
    if (hook) widget.interactions.push(event(hook.event === 'onRotate' ? 'rotate' : 'move', [{ id: uid(), type: 'setVariable', targetId: hook.variable, value: String(hook.value) }]));
    button.interactions = [event('click', config.actions!.map(([kind, options]): Action => {
      const common = { easing: String(options.easing ?? 'linear') as 'linear', duration: Number(options.duration ?? 100) };
      if (kind === 'move') return { id: uid(), type: 'move', move: { targets: [{ target: { kind: 'widget', id: widget.id }, mode: options.mode === 'location' ? 'location' : 'delta', x: expression(options.x ?? 40), y: expression(options.y ?? 20), trajectory: 'straight', ...common }] } };
      if (kind === 'resize') return { id: uid(), type: 'resize', resize: { targets: [{ target: { kind: 'widget', id: widget.id }, width: expression(options.width ?? 300), height: expression(options.height ?? 160), anchor: String(options.anchor ?? 'top left') as 'top left', ...common }] } };
      return { id: uid(), type: 'rotate', targetId: widget.id, rotate: { mode: options.mode === 'location' ? 'to' : 'by', degrees: expression(options.degree ?? 90).text, clockwise: options.clockwise !== false, anchor: String(options.anchor ?? 'center') as 'center', offsetX: expression(options.offsetX ?? 0).text, offsetY: expression(options.offsetY ?? 0).text, ...common } };
    }))];
    const saved = parseDocument(serializeDocument(doc));
    const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, Date }) : createOfflineRuntime;
    const runtime = factory(saved, undefined, evaluateExpression, undefined, {}); sessions.push(runtime);
    const pending = runtime.trigger(button.id, 'click');
    if (typeof sample.final.moved?.left === 'string' || typeof sample.final.moved?.top === 'string') {
      await expect(pending).rejects.toThrow(/non-finite native orbit/); expect(runtime.widget(widget)).toMatchObject({ x: 100, y: 100, width: 200, height: 100 }); return;
    }
    await vi.advanceTimersByTimeAsync(1000); await pending; await runtime.trigger(widget.id, 'click');
    const values = runtime.state().variables.Read.split(',').map(Number), expected = sample.final;
    if (sample.name.startsWith('finite-shadow-corner-')) {
      // The two retained real-browser runs themselves have different orbital
      // cache endpoints: a later pivot reads the prior live frame angle.
      // Assert the stable cache/paint relation, not one scheduler's sample.
      const paint = runtime.widget(widget), negative = item!.shadow!.offsetX < 0;
      expect(Number.isFinite(values[0]) && Number.isFinite(values[1])).toBe(true);
      expect(values[0]).toBeCloseTo(paint.x - (negative ? 16 : 0), 7); expect(values[1]).toBeCloseTo(paint.y - (negative ? 26 : 0), 7);
      expect(values[0]).not.toBe(100); expect(values[1]).not.toBe(100);
    } else {
      expect(values[0]).toBeCloseTo(Number(expected.moved?.left ?? expected.x), 6); expect(values[1]).toBeCloseTo(Number(expected.moved?.top ?? expected.y), 6);
    }
    expect(values[2]).toBeCloseTo(expected.querySize.width, 7); expect(values[3]).toBeCloseTo(expected.querySize.height, 7);
    expect(runtime.widget(widget).rotation).toBeCloseTo(expected.angle, 6); expect(vi.getTimerCount()).toBe(0);
  });
});
