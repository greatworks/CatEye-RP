import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createWidget, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';

const active: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of active.splice(0)) runtime.dispose(); });
const event = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Typography', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) });
function make(doc: Document, portable: boolean): OfflineRuntime {
  const runtime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc);
  active.push(runtime); return runtime;
}
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} font style composition`, () => {
  it('applies independent font-style actions below transient/selected/error/disabled effects and restores normal', async () => {
    const doc = createDocument(), widget = createWidget('box'); doc.caseSelection = 'never'; doc.pages[0].widgets = [widget]; widget.style.fontWeight = 700;
    widget.mouseOverStyle = { fontStyle: 'normal' }; widget.selectedStyle = { fontStyle: 'normal' }; widget.errorStyle = { fontStyle: 'italic' }; widget.disabledStyle = { fontStyle: 'normal' };
    const before = serializeDocument(doc), runtime = make(doc, portable);
    await runtime.execute(event({ type: 'setStyle', targetId: widget.id, style: { fontStyle: 'italic' } })); expect(runtime.widget(widget).style).toMatchObject({ fontStyle: 'italic', fontWeight: 700 });
    runtime.setInteractionState(widget.id, { mouseOver: true }); expect(runtime.widget(widget).style.fontStyle).toBe('normal');
    runtime.setInteractionState(widget.id, { mouseOver: false }); expect(runtime.widget(widget).style.fontStyle).toBe('italic');
    await runtime.select(widget.id, true); expect(runtime.widget(widget).style.fontStyle).toBe('normal');
    await runtime.setError(widget.id, true); expect(runtime.widget(widget).style.fontStyle).toBe('italic');
    await runtime.execute(event({ type: 'disable', targetId: widget.id })); expect(runtime.widget(widget).style.fontStyle).toBe('normal');
    await runtime.execute(event({ type: 'enable', targetId: widget.id })); await runtime.setError(widget.id, false); await runtime.select(widget.id, false); expect(runtime.widget(widget).style.fontStyle).toBe('italic');
    await runtime.execute(event({ type: 'setStyle', targetId: widget.id, style: { fontStyle: 'normal' } })); expect(runtime.widget(widget).style).toMatchObject({ fontStyle: 'normal', fontWeight: 700 }); expect(serializeDocument(doc)).toBe(before);
  });

  it('keeps a row-specific italic action and normal hover reset separate from sibling rows', async () => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = createWidget('text'); child.text = 'Item'; child.mouseOverStyle = { fontStyle: 'normal' };
    repeater.style.fontStyle = 'italic'; repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [child], itemHeight: 50, gap: 0 }; doc.pages[0].widgets = [repeater];
    const before = serializeDocument(doc), runtime = make(doc, portable); await runtime.start(); const rows = runtime.rows(repeater);
    await runtime.execute(event({ type: 'setStyle', targetId: child.id, style: { fontStyle: 'italic' } }), rows[1].data, rows[1].context);
    expect(runtime.widget(child, rows[0].context).style).not.toHaveProperty('fontStyle'); expect(runtime.widget(child, rows[1].context).style.fontStyle).toBe('italic');
    runtime.setInteractionState(child.id, { mouseOver: true }, rows[1].context); expect(runtime.widget(child, rows[1].context).style.fontStyle).toBe('normal');
    runtime.setInteractionState(child.id, { mouseOver: false }, rows[1].context); expect(runtime.widget(child, rows[1].context).style.fontStyle).toBe('italic'); expect(serializeDocument(doc)).toBe(before);
  });
});
