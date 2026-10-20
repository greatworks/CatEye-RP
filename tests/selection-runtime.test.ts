import { describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, uid } from '../src/model/document';
import { createOfflineRuntime } from '../src/runtime/export-runtime';
import { getRuntimeWidget } from '../src/runtime/engine';
import type { Action, EventType, Interaction, Widget } from '../src/model/types';

const interaction = (event: EventType, actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), event, name: event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
function logEvents(widget: Widget, label: string) {
  for (const event of ['selectedChange', 'select', 'unselect'] as const) widget.interactions.push(interaction(event, [{ type: 'setVariable', targetId: 'Log', value: `[[Log]]${label}.${event};` }]));
}
function fixture(type: 'box' | 'radio' | 'checkbox' = 'box') {
  const doc = createDocument(), a = createWidget(type), b = createWidget(type);
  doc.pages[0].widgets = [a, b]; doc.variables.Log = '';
  logEvents(a, 'A'); logEvents(b, 'B');
  const runtime = createOfflineRuntime(doc);
  return { doc, a, b, runtime };
}

describe('native selection state and event paths', () => {
  it('clears the old member and fires both of its events before the new member events', async () => {
    const { a, b, runtime } = fixture(); a.selectionGroup = b.selectionGroup = 'Tabs'; a.selected = true;
    await runtime.select(b.id, true);
    expect(runtime.state().variables.Log).toBe('A.selectedChange;A.unselect;B.selectedChange;B.select;');
    expect(runtime.widget(a).selected).toBe(false); expect(runtime.widget(b).selected).toBe(true);
    await runtime.select(b.id, true); expect(runtime.state().variables.Log).toBe('A.selectedChange;A.unselect;B.selectedChange;B.select;');
    expect(a.selected).toBe(true); expect(b.selected).toBeUndefined();
  });
  it('restores base appearance after unselect and keeps runtime style edits out of the selected layer', async () => {
    const { a, runtime } = fixture(); a.style.fill = '#ffffff'; a.selectedStyle = { fill: '#81d3f8' };
    await runtime.select(a.id, true); expect(runtime.widget(a).style.fill).toBe('#81d3f8');
    await runtime.execute(interaction('click', [{ type: 'setStyle', targetId: a.id, style: { fill: '#eeeeee' } }]));
    expect(runtime.widget(a).style.fill).toBe('#81d3f8');
    await runtime.select(a.id, false); expect(runtime.widget(a).style.fill).toBe('#eeeeee');
    expect(getRuntimeWidget(a, runtime.state()).style.fill).toBe('#eeeeee');
  });
  it('leaves disabled shapes unchanged while native programmatic checkbox updates only checked', async () => {
    const { a, b, runtime } = fixture(); a.disabled = true;
    b.type = 'checkbox'; b.checked = false; b.disabled = true; b.selectedStyle = { fill: '#123456' };
    await runtime.select(a.id, true); await runtime.select(b.id, true);
    expect(runtime.widget(a).selected).toBeUndefined();
    expect(runtime.widget(b).checked).toBe(true); expect(runtime.widget(b).selected).toBe(false);
    expect(runtime.widget(b).style.fill).toBe(b.style.fill); expect(runtime.state().variables.Log).toBe('');
    await runtime.check(b.id, false); expect(runtime.widget(b).checked).toBe(true);
  });
  it('a named radio click clears peer event state before selecting, including repeated clicks', async () => {
    const { a, b, runtime } = fixture('radio'); a.radioGroup = b.radioGroup = 'Duration'; a.checked = true;
    await runtime.check(b.id, true);
    expect(runtime.widget(a).checked).toBe(false); expect(runtime.widget(b).checked).toBe(true);
    expect(runtime.state().variables.Log).toBe('A.selectedChange;A.unselect;B.selectedChange;B.select;');
    runtime.state().variables.Log = ''; await runtime.check(b.id, true);
    expect(runtime.state().variables.Log).toBe('B.selectedChange;B.unselect;B.selectedChange;B.select;');
  });
  it('unnamed radio clicks do not clear a different radio and do not repeat select events', async () => {
    const { a, b, runtime } = fixture('radio'); a.checked = true;
    await runtime.check(b.id, true); await runtime.check(b.id, true);
    expect(runtime.widget(a).checked).toBe(true); expect(runtime.widget(b).checked).toBe(true);
    expect(runtime.state().variables.Log).toBe('B.selectedChange;B.select;');
  });
  it('programmatic radio changes clear peer checked without dispatching peer selection events', async () => {
    const { a, b, runtime } = fixture('radio'); a.radioGroup = b.radioGroup = 'Duration'; a.checked = true;
    await runtime.execute(interaction('click', [{ type: 'setSelected', targetId: b.id, value: 'true' }]));
    expect(runtime.widget(a).checked).toBe(false); expect(runtime.widget(a).selected).toBe(true);
    expect(runtime.state().variables.Log).toBe('B.selectedChange;B.select;');
    runtime.state().variables.Log = ''; await runtime.select(b.id, true); expect(runtime.state().variables.Log).toBe('');
    await runtime.check(b.id, true);
    expect(runtime.state().variables.Log).toBe('A.selectedChange;A.unselect;B.selectedChange;B.unselect;B.selectedChange;B.select;');
  });
  it('checkbox clicks toggle independent state and the action toggle reads checked', async () => {
    const { a, b, runtime } = fixture('checkbox');
    await runtime.check(a.id, true); await runtime.select(a.id, 'toggle');
    expect(runtime.widget(a).checked).toBe(false); expect(runtime.widget(b).checked).toBe(false);
    expect(runtime.state().variables.Log).toBe('A.selectedChange;A.select;A.selectedChange;A.unselect;');
  });
  it('keeps group names case-sensitive, page scoped, and distinct from radio groups', async () => {
    const { doc, a, b, runtime } = fixture(); a.selectionGroup = 'Group'; b.selectionGroup = 'group'; a.selected = true;
    await runtime.select(b.id, true); expect(runtime.widget(a).selected).toBe(true);
    const page = createPage('Other'); doc.pages.push(page);
    // Create a fresh runtime so it indexes the second page and radio.
    const other = createWidget('box'), radio = createWidget('radio'); other.selectionGroup = 'group'; other.selected = true;
    radio.radioGroup = 'group'; radio.checked = true; page.widgets.push(other); doc.pages[0].widgets.push(radio);
    const next = createOfflineRuntime(doc); await next.select(b.id, true);
    expect(next.widget(other).selected).toBe(true); expect(next.widget(radio).checked).toBe(true);
  });
  it('isolates authored repeater groups to a row and resets them on refresh', async () => {
    const doc = createDocument(), repeater = createWidget('repeater'), a = createWidget('radio'), b = createWidget('radio');
    a.radioGroup = b.radioGroup = 'Rows'; a.checked = true; repeater.repeater!.template = [a, b]; doc.pages[0].widgets = [repeater];
    const runtime = createOfflineRuntime(doc); await runtime.start(); const rows = runtime.rows(repeater);
    await runtime.check(b.id, true, rows[0].context);
    expect(runtime.widget(a, rows[0].context).checked).toBe(false); expect(runtime.widget(b, rows[0].context).checked).toBe(true);
    expect(runtime.widget(a, rows[1].context).checked).toBe(true); expect(runtime.widget(b, rows[1].context).checked).toBe(false);
    await runtime.execute(interaction('click', [{ type: 'sortRows', targetId: repeater.id, value: repeater.repeater!.columns[0] }]));
    expect(runtime.widget(a, runtime.rows(repeater)[0].context).checked).toBe(true);
  });
  it('bounds recursive selection event loops without hanging the queue', async () => {
    const { a, runtime } = fixture();
    a.interactions = [interaction('selectedChange', [{ type: 'setSelected', targetId: a.id, value: 'toggle' }])];
    await expect(runtime.select(a.id, true)).rejects.toThrow('Selection event cycle limit');
    a.interactions = []; await runtime.select(a.id, true); expect(runtime.widget(a).selected).toBe(true);
  });
});

describe('fit-to-content panel runtime geometry', () => {
  it('uses active visible child right/bottom bounds, including unequal states and nested panels', async () => {
    const doc = createDocument(), outer = createWidget('panel'), panel = createWidget('panel'), a = createWidget('box'), b = createWidget('box');
    outer.fitToContent = panel.fitToContent = true; panel.x = 10; panel.y = 20;
    Object.assign(a, { x: 0, y: 63, width: 600, height: 231 }); Object.assign(b, { x: 0, y: 0, width: 600, height: 231 });
    panel.states = [{ id: 'first', name: 'First', widgets: [a] }, { id: 'second', name: 'Second', widgets: [b] }]; panel.activeStateId = 'first';
    outer.states![0].widgets = [panel]; doc.pages[0].widgets = [outer];
    const runtime = createOfflineRuntime(doc);
    expect(runtime.widget(panel)).toMatchObject({ width: 600, height: 294 }); expect(runtime.widget(outer)).toMatchObject({ width: 610, height: 314 });
    await runtime.execute(interaction('click', [{ type: 'setState', targetId: panel.id, value: 'second' }]));
    expect(runtime.widget(panel)).toMatchObject({ width: 600, height: 231 }); expect(getRuntimeWidget(outer, runtime.state())).toMatchObject({ width: 610, height: 251 });
    await runtime.execute(interaction('click', [{ type: 'hide', targetId: b.id }])); expect(runtime.widget(panel)).toMatchObject({ width: 0, height: 0 });
    await runtime.execute(interaction('click', [{ type: 'show', targetId: b.id }, { type: 'move', targetId: b.id, x: -10, y: -20 }]));
    expect(runtime.widget(panel)).toMatchObject({ width: 590, height: 211 });
    await runtime.execute(interaction('click', [{ type: 'resize', targetId: panel.id, x: 100, y: 80 }]));
    expect(runtime.widget(panel)).toMatchObject({ fitToContent: false, width: 100, height: 80 });
  });
});
