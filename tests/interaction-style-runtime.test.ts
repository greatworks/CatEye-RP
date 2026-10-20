import { afterEach, describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createPage, createWidget, mergeWidgetStyle, resolveInteractionStyle, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, Interaction, InteractionStyleState, Widget } from '../src/model/types';
import { createRuntime, getRuntimeWidget } from '../src/runtime/engine';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';

const live: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of live.splice(0)) runtime.dispose(); });
const event = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), event: 'click', name: 'Apply', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) });
function makeRuntime(doc: Document, portable: boolean): OfflineRuntime {
  const runtime: OfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc)
    : createOfflineRuntime(doc);
  live.push(runtime); return runtime;
}
function styledWidget(type: Widget['type'] = 'box'): Widget {
  const widget = createWidget(type); widget.style.fill = '#111111';
  widget.mouseOverStyle = { fill: '#aa0000', stroke: '#ff8800' };
  widget.mouseDownStyle = { fill: '#00aa00', fontSize: 25 };
  widget.focusedStyle = { fill: '#aaaa00', color: '#aabbcc' };
  widget.selectedStyle = { fill: '#0000aa', fontWeight: 700 };
  widget.disabledStyle = { fill: '#999999', opacity: 0.6 };
  return widget;
}
function fixture(portable: boolean) {
  const doc = createDocument(), widget = styledWidget(); doc.caseSelection = 'never'; doc.pages[0].widgets = [widget];
  const runtime = makeRuntime(doc, portable); return { doc, widget, runtime };
}

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} interaction styles`, () => {
  it('agrees with the pure model for all combinations, absent/empty focus styles, and checkable style selection', () => {
    for (const type of ['box', 'checkbox', 'radio'] as const) {
      const doc = createDocument(), widget = styledWidget(type); doc.pages[0].widgets = [widget];
      const runtime = makeRuntime(doc, portable), focusPatch = widget.focusedStyle;
      for (const focusedStyle of [focusPatch, {}, undefined]) {
        widget.focusedStyle = focusedStyle;
        for (let bits = 0; bits < 32; bits++) {
          const selected = !!(bits & 8), disabled = !!(bits & 16), state: InteractionStyleState = { mouseOver: !!(bits & 1), mouseDown: !!(bits & 2), focused: !!(bits & 4) };
          runtime.state().widgetOverrides[widget.id] = { selected, disabled, ...(type !== 'box' ? { checked: !selected } : {}) };
          runtime.setInteractionState(widget.id, state);
          expect(runtime.widget(widget).style, `${type}, state ${bits}, focus ${JSON.stringify(focusedStyle)}`).toEqual(resolveInteractionStyle({ ...widget, ...runtime.state().widgetOverrides[widget.id] }, state));
        }
      }
    }
  });

  it('does not modify authored data, store visual flags as widget overrides, or fire user interactions', () => {
    const { doc, widget, runtime } = fixture(portable); doc.variables.Fired = '';
    widget.interactions = [{ ...event({ type: 'setVariable', targetId: 'Fired', value: 'unexpected' }), event: 'mouseEnter' }];
    const saved = serializeDocument(doc); let notifications = 0; runtime.subscribe(() => notifications++);
    runtime.setInteractionState(widget.id, { mouseOver: true });
    expect(runtime.widget(widget).style.fill).toBe('#aa0000'); expect(notifications).toBe(1);
    runtime.setInteractionState(widget.id, { mouseOver: true }); expect(notifications).toBe(1);
    expect(runtime.state().widgetOverrides).toEqual({}); expect(runtime.state().variables.Fired).toBeUndefined();
    expect(runtime.state()).not.toHaveProperty('interactionStates'); expect(serializeDocument(doc)).toBe(saved);
  });

  it('keeps pointer-down on leave until release and preserves independent hover/focus state', () => {
    const { widget, runtime } = fixture(portable);
    runtime.setInteractionState(widget.id, { mouseOver: true, mouseDown: true });
    runtime.setInteractionState(widget.id, { mouseOver: false }); expect(runtime.widget(widget).style.fill).toBe('#00aa00');
    runtime.releasePointerStyles(); expect(runtime.widget(widget).style.fill).toBe('#111111');
    runtime.setInteractionState(widget.id, { mouseOver: true, mouseDown: true, focused: true });
    expect(runtime.widget(widget).style.fill).toBe('#aaaa00'); runtime.releasePointerStyles();
    expect(runtime.widget(widget).style.fill).toBe('#aaaa00');
    runtime.setInteractionState(widget.id, { focused: false }); expect(runtime.widget(widget).style.fill).toBe('#aa0000');
  });

  it('keeps action edits in the base and reveals each lower state without leaking higher styles', async () => {
    const { widget, runtime } = fixture(portable);
    runtime.setInteractionState(widget.id, { mouseOver: true, mouseDown: true });
    await runtime.select(widget.id, true); expect(runtime.widget(widget).style.fill).toBe('#0000aa');
    await runtime.execute(event({ type: 'setStyle', targetId: widget.id, style: { fill: '#abcdef', color: '#654321', strokeWidth: 3 } }));
    expect(runtime.widget(widget).style.fill).toBe('#0000aa');
    expect(runtime.state().widgetOverrides[widget.id].style).toMatchObject({ fill: '#abcdef', color: '#654321', strokeWidth: 3 });
    expect(runtime.state().widgetOverrides[widget.id].style!.fontSize).toBe(widget.style.fontSize);
    await runtime.execute(event({ type: 'disable', targetId: widget.id })); expect(runtime.widget(widget).style.fill).toBe('#999999');
    await runtime.execute(event({ type: 'enable', targetId: widget.id })); await runtime.select(widget.id, false);
    expect(runtime.widget(widget).style.fill).toBe('#00aa00'); runtime.releasePointerStyles(); expect(runtime.widget(widget).style.fill).toBe('#aa0000');
    runtime.setInteractionState(widget.id, { mouseOver: false });
    expect(runtime.widget(widget).style).toEqual(mergeWidgetStyle(widget.style, { fill: '#abcdef', color: '#654321', strokeWidth: 3 }));
  });

  it('clears tuple overrides at the correct layer and honors inherited disabled state exactly once', () => {
    const { widget, runtime } = fixture(portable);
    widget.style.borderWidths = [1, 2, 3, 4]; widget.style.cornerRadii = [4, 3, 2, 1];
    widget.mouseOverStyle = { strokeWidth: 2, radius: 8 };
    widget.selected = true; widget.selectedStyle = { fill: '#0000aa', borderWidths: [2, 4, 6, 8] };
    widget.disabledStyle = { fill: '#999999', strokeWidth: 0, radius: 0 };
    runtime.setInteractionState(widget.id, { mouseOver: true });
    const enabled = runtime.widget(widget); expect(enabled.style.borderWidths).toEqual([2, 4, 6, 8]); expect(enabled.style).not.toHaveProperty('cornerRadii');
    const disabled = runtime.widget(widget, [], true);
    expect(disabled.disabled).toBe(true); expect(disabled.style.fill).toBe('#999999');
    expect(disabled.style).not.toHaveProperty('cornerRadii'); expect(disabled.style).not.toHaveProperty('borderWidths');
    expect(widget.disabled).toBe(false); expect(widget.style.borderWidths).toEqual([1, 2, 3, 4]);
  });

  it('isolates row instances and clears their visual states on refresh and deletion', async () => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = styledWidget();
    repeater.repeater!.template = [child]; doc.pages[0].widgets = [repeater];
    const runtime = makeRuntime(doc, portable); await runtime.start(); const rows = runtime.rows(repeater);
    runtime.setInteractionState(child.id, { mouseOver: true, mouseDown: true }, rows[0].context);
    runtime.setInteractionState(child.id, { focused: true }, rows[1].context);
    expect(runtime.widget(child, rows[0].context).style.fill).toBe('#00aa00'); expect(runtime.widget(child, rows[1].context).style.fill).toBe('#aaaa00');
    expect(runtime.widget(child, rows[2].context).style.fill).toBe('#111111');
    await runtime.execute(event({ type: 'removeFilter', targetId: repeater.id, value: '{"all":true}' }));
    for (const row of runtime.rows(repeater)) expect(runtime.widget(child, row.context).style.fill).toBe('#111111');
    const removed = runtime.rows(repeater)[0]; runtime.setInteractionState(child.id, { mouseDown: true }, removed.context);
    await runtime.execute(event({ type: 'deleteRow', targetId: repeater.id, value: '0' }));
    runtime.setInteractionState(child.id, { mouseOver: true }, removed.context);
    for (const row of runtime.rows(repeater)) expect(runtime.widget(child, row.context).style.fill).toBe('#111111');
  });

  it('clears an entire hidden or changed panel branch while preserving outside visual states', async () => {
    const doc = createDocument(), panel = createWidget('panel'), child = styledWidget(), outside = styledWidget();
    panel.states![0].widgets = [child]; panel.states!.push({ id: uid(), name: 'Other state', widgets: [] });
    doc.pages[0].widgets = [panel, outside]; const runtime = makeRuntime(doc, portable);
    runtime.setInteractionState(child.id, { mouseOver: true, mouseDown: true }); runtime.setInteractionState(outside.id, { mouseOver: true });
    await runtime.execute(event({ type: 'hide', targetId: panel.id }, { type: 'show', targetId: panel.id }));
    expect(runtime.widget(child).style.fill).toBe('#111111'); expect(runtime.widget(outside).style.fill).toBe('#aa0000');
    runtime.setInteractionState(child.id, { focused: true });
    await runtime.execute(event({ type: 'nextState', targetId: panel.id }, { type: 'previousState', targetId: panel.id }));
    expect(runtime.widget(child).style.fill).toBe('#111111'); expect(runtime.widget(outside).style.fill).toBe('#aa0000');
  });

  it('clears visual state on navigation, ignores inactive-page updates, and cannot reactivate after disposal', async () => {
    const { doc, widget, runtime } = fixture(portable), next = createPage('Other'); doc.pages.push(next);
    runtime.setInteractionState(widget.id, { focused: true, mouseOver: true, mouseDown: true });
    await runtime.navigate(next.id); runtime.setInteractionState(widget.id, { mouseOver: true });
    await runtime.navigate(doc.pages[0].id); expect(runtime.widget(widget).style.fill).toBe('#111111');
    runtime.setInteractionState(widget.id, { mouseOver: true }); runtime.dispose();
    runtime.setInteractionState(widget.id, { mouseDown: true }); expect(runtime.widget(widget).style.fill).toBe('#111111');
  });

  it('ignores unknown controls and controls without pointer effects without notifying', () => {
    const doc = createDocument(), widget = createWidget('box'); doc.pages[0].widgets = [widget]; const runtime = makeRuntime(doc, portable);
    let notifications = 0; runtime.subscribe(() => notifications++);
    runtime.setInteractionState('missing', { mouseOver: true }); runtime.setInteractionState(widget.id, { mouseOver: true, mouseDown: true, focused: true });
    runtime.releasePointerStyles(); expect(notifications).toBe(0); expect(runtime.state().widgetOverrides).toEqual({});
  });

  it('review regression: notifies when an equal authored hover fill overrides a different adaptive base fill', () => {
    const doc = createDocument(), widget = createWidget('box');
    widget.style.fill = '#ff0000'; widget.mouseOverStyle = { fill: '#ff0000' };
    doc.pages[0].widgets = [widget];
    doc.pages[0].adaptiveViews = [{ id: uid(), name: 'Blue adaptive base', width: 600, overrides: { [widget.id]: { style: { fill: '#0000ff' } } } }];
    const saved = serializeDocument(doc), runtime = makeRuntime(doc, portable);
    // Players pass the effective adaptive widget to widget(); authored data remains red.
    const adaptive = { ...widget, style: { ...widget.style, fill: '#0000ff' } };
    expect(runtime.widget(adaptive).style.fill).toBe('#0000ff');
    let notifications = 0; runtime.subscribe(() => notifications++);
    runtime.setInteractionState(widget.id, { mouseOver: true });
    expect(runtime.widget(adaptive).style.fill).toBe('#ff0000');
    expect(serializeDocument(doc)).toBe(saved);
    expect(notifications).toBe(1);
  });

  it('review regression: disabling and enabling a panel in one action chain clears child focus', async () => {
    const doc = createDocument(), panel = createWidget('panel'), child = styledWidget('input');
    panel.states![0].widgets = [child]; doc.pages[0].widgets = [panel];
    const saved = serializeDocument(doc), runtime = makeRuntime(doc, portable);
    runtime.setInteractionState(child.id, { focused: true });
    expect(runtime.widget(child).style.fill).toBe('#aaaa00');
    await runtime.execute(event({ type: 'disable', targetId: panel.id }, { type: 'enable', targetId: panel.id }));
    expect(runtime.widget(panel).disabled).toBe(false);
    expect(runtime.widget(child).disabled).toBe(false);
    expect(serializeDocument(doc)).toBe(saved);
    expect(runtime.widget(child).style.fill).toBe('#111111');
  });
});

describe('static runtime snapshot projection', () => {
  it('composes base patches, selected and disabled once without retaining private pointer state', () => {
    const doc = createDocument(), widget = styledWidget(); widget.selected = true; doc.pages[0].widgets = [widget]; const state = createRuntime(doc);
    state.widgetOverrides[widget.id] = { disabled: true, style: mergeWidgetStyle(widget.style, { fill: '#abcdef' }) };
    const saved = structuredClone(state), projected = getRuntimeWidget(widget, state);
    expect(projected.style.fill).toBe('#999999'); expect(projected.style.fontWeight).toBe(700); expect(projected.style.fontSize).toBe(widget.style.fontSize);
    expect(state).toEqual(saved); expect(widget.style.fill).toBe('#111111');
    state.widgetOverrides[widget.id].disabled = false; state.widgetOverrides[widget.id].selected = false;
    expect(getRuntimeWidget(widget, state).style.fill).toBe('#abcdef');
  });

  it('preserves checkable checked/style separation and tuple clearing in snapshot overrides', () => {
    const doc = createDocument(), widget = styledWidget('checkbox'); widget.checked = true; widget.style.borderWidths = [1, 2, 3, 4]; doc.pages[0].widgets = [widget];
    const state = createRuntime(doc); state.widgetOverrides[widget.id] = { selected: false, style: mergeWidgetStyle(widget.style, { strokeWidth: 0 }) };
    const projected = getRuntimeWidget(widget, state); expect(projected.checked).toBe(true); expect(projected.style.fill).toBe('#111111'); expect(projected.style).not.toHaveProperty('borderWidths');
  });
});
