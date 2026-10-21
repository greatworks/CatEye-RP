import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, uid } from '../src/model/document';
import type { Action, AdaptiveView, Document, EventType, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime, type RuntimeViewport } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

// These are source-selection/lifecycle tests, not native font or DOM measurements.
// The author-panel proxy deliberately measures the declaration's literal text;
// live row/global interpolation and SetText have a separate rendering path.
const sessions: OfflineRuntime[] = [];
afterEach(() => sessions.splice(0).forEach(session => session.dispose()));
const event = (name: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({
  id: uid(), event: name, name, enabled: true, conditions: [], conditionMode: 'all',
  actions: actions.map(action => ({ ...action, id: uid() })),
});
const view = (id: string, width: number, baseViewId?: string): AdaptiveView => ({
  id, name: id, width, height: 0, ...(baseViewId ? { baseViewId } : {}), overrides: {},
});
function selection(type: 'checkbox' | 'radio' = 'checkbox') {
  const widget = createWidget(type, 12, 34);
  Object.assign(widget, { width: 160, height: 30, text: 'Authored',
    selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false } });
  Object.assign(widget.style, { fontSize: 20, textPadding: [1, 2, 3, 4], verticalAlign: 'middle', selectionButtonSize: 14 });
  return widget;
}
function fixture() {
  const doc = createDocument(), page = doc.pages[0], widget = selection();
  page.widgets = [widget]; page.width = 1200;
  page.adaptiveSelection = 'native-size'; page.adaptiveBaseSize = { width: 0, height: 0 };
  doc.caseSelection = 'never';
  return { doc, page, widget };
}
function make(doc: Document, portable: boolean, viewport: RuntimeViewport = { width: 100, height: 0 }) {
  const factory: typeof createOfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })
    : createOfflineRuntime;
  const runtime = factory(doc, undefined, evaluateExpression, undefined, viewport);
  sessions.push(runtime); return runtime;
}

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} selection display declaration`, () => {
  it('survives first lookup after hidden Loaded has already replaced the text', async () => {
    const { doc, page, widget } = fixture();
    widget.hidden = true;
    widget.text = '[[Global]] <literal>';
    widget.richText = { paragraphs: [{ runs: [{ text: widget.text, style: { fontSize: 17 } }] }] };
    doc.variables.Global = 'Runtime global';
    page.interactions = [event('load', { type: 'setText', targetId: widget.id, value: 'Loaded [[Global]]' })];
    const before = structuredClone(doc), runtime = make(doc, portable);
    await runtime.start();
    expect(runtime.widget(widget).text).toBe('Loaded Runtime global');
    expect(runtime.nativeTextSet(widget.id)).toBe(true);
    const source = runtime.selectionDisplaySource(widget.id)!;
    expect(source).toMatchObject({ hidden: true, text: '[[Global]] <literal>', width: 160, height: 30 });
    expect(source.richText).toEqual(before.pages[0].widgets[0].richText);
    await runtime.execute(event('click',
      { type: 'setText', targetId: widget.id, value: '' },
      { type: 'show', targetId: widget.id },
      { type: 'setStyle', targetId: widget.id, style: { fontSize: 52 } },
      { type: 'move', targetId: widget.id, x: 300, y: 400 }));
    expect(runtime.widget(widget)).toMatchObject({ hidden: false, text: '', x: 300, y: 400, style: { fontSize: 52 } });
    expect(runtime.selectionDisplaySource(widget.id)).toEqual(source);
    expect(doc).toEqual(before);
  });

  it.each(['checkbox', 'radio'] as const)('keeps %s initial selected typography separate from the plain declaration', async type => {
    const { doc, page } = fixture(), widget = selection(type); page.widgets = [widget];
    widget.checked = true; widget.selected = true;
    widget.selectedStyle = { fontSize: 54, color: '#ff0000', selectionButtonSize: 31 };
    widget.mouseOverStyle = { fontSize: 72 };
    widget.richText = { expressionMode: 'literal', paragraphs: [{ runs: [{ text: 'Authored', style: { fontSize: 17 } }] }] };
    const runtime = make(doc, portable), source = runtime.selectionDisplaySource(widget.id)!;
    expect(source.style.fontSize).toBe(20);
    expect(source.style.selectionButtonSize).toBe(14);
    expect(source.richText!.paragraphs[0].runs[0].style!.fontSize).toBe(17);
    expect(source.selectedStyle).toEqual(widget.selectedStyle);
    expect(runtime.widget(widget).style.fontSize).toBe(54);
    await runtime.select(widget.id, false);
    await runtime.check(widget.id, true);
    expect(runtime.selectionDisplaySource(widget.id)).toEqual(source);
  });

  it('does not confuse disabled checked changes with visual selected state or authored state', async () => {
    const { doc, widget } = fixture(); widget.disabled = true; widget.checked = false;
    widget.selectedStyle = { color: '#ff0000' };
    const runtime = make(doc, portable), source = runtime.selectionDisplaySource(widget.id)!;
    await runtime.select(widget.id, true);
    const live = runtime.widget(widget);
    expect(live.checked).toBe(true); expect(live.selected).toBe(false);
    expect(Boolean(live.selected ?? live.checked)).toBe(false);
    expect(live.style.color).toBe(widget.style.color);
    expect(runtime.selectionDisplaySource(widget.id)).toEqual(source);
    expect(source.checked).toBe(false);
  });

  it('shares one literal template source while ItemLoaded and later SetText remain row scoped', async () => {
    const { doc, page, widget } = fixture(), list = createWidget('repeater');
    widget.text = '[[Item.Label]] / [[Global]]';
    widget.richText = { paragraphs: [{ runs: [{ text: widget.text, style: { fontWeight: 700 } }] }] };
    list.repeater!.columns = ['Label']; list.repeater!.rows = [{ Label: 'A' }, { Label: 'B' }];
    list.repeater!.template = [widget]; page.widgets = [list]; doc.variables.Global = 'G';
    list.interactions = [event('itemLoad', { type: 'setText', targetId: widget.id, value: '[[Item.Label]] [[Global]]' })];
    const parent = view('parent', 390);
    parent.overrides[widget.id] = { width: 222, style: { fontSize: 24 } };
    page.adaptiveViews = [parent];
    const before = structuredClone(doc), runtime = make(doc, portable, { width: 500 });
    await runtime.start(); const [a, b] = runtime.rows(list);
    expect(runtime.widget(widget, a.context).text).toBe('A G');
    expect(runtime.widget(widget, b.context).text).toBe('B G');
    const source = runtime.selectionDisplaySource(widget.id)!;
    expect(source.text).toBe('[[Item.Label]] / [[Global]]');
    expect(source.richText!.paragraphs[0].runs[0]).toMatchObject({ text: widget.text, style: { fontSize: 24, fontWeight: 700 } });
    expect(source.width).toBe(222);
    await runtime.execute(event('click', { type: 'setText', targetId: widget.id, value: 'Only A' }), a.data, a.context);
    expect(runtime.widget(widget, a.context).text).toBe('Only A');
    expect(runtime.widget(widget, b.context).text).toBe('B G');
    expect(runtime.selectionDisplaySource(widget.id)).toEqual(source);
    expect(doc).toEqual(before);
  });

  it('resolves view ancestry and sparse padding without flattening original run typography', async () => {
    const { doc, page, widget } = fixture(), parent = view('parent', 390), child = view('child', 768, 'parent');
    const gradient = { type: 'linear' as const, start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] };
    widget.style.fillGradient = gradient;
    widget.richText = { expressionMode: 'literal', paragraphs: [{ textAlign: 'left', lineHeightPx: 31,
      runs: [{ text: 'First', style: { fontSize: 17, fontWeight: 700 } }, { text: 'Second', style: { fontSize: 11, color: '#123456' } }] }] };
    parent.overrides[widget.id] = { x: 80, style: { fontStyle: 'italic', fill: '#112233', textAlign: 'right' }, textPaddingSides: { left: 9 } };
    child.overrides[widget.id] = { width: 321, style: { lineHeight: 1.5 }, textPaddingSides: { top: 0 }, stateStyles: {} };
    page.adaptiveViews = [child, parent];
    const runtime = make(doc, portable, { width: 900 }), source = runtime.selectionDisplaySource(widget.id)!;
    expect(source).toMatchObject({ x: 80, width: 321, style: { fill: '#112233', textPadding: [0, 2, 3, 9], lineHeight: 1.5 } });
    expect(source.style).not.toHaveProperty('fillGradient');
    expect(source.richText!.paragraphs[0]).toMatchObject({ textAlign: 'right', runs: [
      { text: 'First', style: { fontSize: 17, fontWeight: 700, fontStyle: 'italic' } },
      { text: 'Second', style: { fontSize: 11, color: '#123456', fontStyle: 'italic' } },
    ] });
    expect(source.richText!.paragraphs[0]).not.toHaveProperty('lineHeightPx');
    await runtime.execute(event('click', { type: 'setStyle', targetId: widget.id, style: { fontSize: 99 } }));
    await runtime.setViewport({ width: 850 });
    expect(runtime.selectionDisplaySource(widget.id)).toEqual(source);
    await runtime.setViewport({ width: 100 });
    expect(runtime.selectionDisplaySource(widget.id)!.richText).toEqual(widget.richText);
    expect(runtime.selectionDisplaySource(widget.id)!.style.fillGradient).toEqual(gradient);
  });

  it('uses page-local declarations in a shared set before destination Loaded', async () => {
    const { doc, page, widget } = fixture(), destination = createPage('Destination'), other = selection('radio');
    const views = [{ id: 'phone', name: 'Phone', width: 390, height: 0 }];
    doc.adaptiveViewSets = [{ id: 'shared', name: 'Shared', baseSize: { width: 0, height: 0 }, views }];
    page.adaptiveViewSetId = destination.adaptiveViewSetId = 'shared';
    for (const p of [page, destination]) { p.adaptiveViews = []; delete p.adaptiveSelection; delete p.adaptiveBaseSize; }
    page.adaptiveOverrides = { phone: { [widget.id]: { width: 211, style: { fontSize: 21 } } } };
    destination.adaptiveOverrides = { phone: { [other.id]: { width: 322, style: { fontSize: 32 } } } };
    destination.widgets = [other]; doc.pages.push(destination);
    destination.interactions = [event('load', { type: 'setText', targetId: other.id, value: 'Destination Loaded' })];
    const before = structuredClone(doc), runtime = make(doc, portable, { width: 500 });
    expect(runtime.selectionDisplaySource(widget.id)).toMatchObject({ width: 211, style: { fontSize: 21 } });
    await runtime.navigate(destination.id);
    expect(runtime.widget(other).text).toBe('Destination Loaded');
    expect(runtime.selectionDisplaySource(other.id)).toMatchObject({ text: 'Authored', width: 322, style: { fontSize: 32 } });
    expect(runtime.selectionDisplaySource(widget.id)).toMatchObject({ width: 211, style: { fontSize: 21 } });
    expect(doc).toEqual(before);
  });

  it('supports hidden inactive state descendants without depending on rendered widget caches', async () => {
    const { doc, page, widget } = fixture(), panel = createWidget('panel');
    panel.states!.push({ id: 'inactive', name: 'Inactive', widgets: [widget] });
    widget.hidden = true; page.widgets = [panel];
    const phone = view('phone', 390); phone.overrides[widget.id] = { width: 246, style: { selectionButtonSize: 19 } };
    page.adaptiveViews = [phone];
    const runtime = make(doc, portable, { width: 500 });
    await runtime.start();
    expect(runtime.selectionDisplaySource(widget.id)).toMatchObject({ hidden: true, width: 246, style: { selectionButtonSize: 19 } });
    await runtime.execute(event('click',
      { type: 'setText', targetId: widget.id, value: 'Before showing inactive state' },
      { type: 'setState', targetId: panel.id, value: 'inactive' }));
    expect(runtime.widget(widget).text).toBe('Before showing inactive state');
    expect(runtime.selectionDisplaySource(widget.id)!.text).toBe('Authored');
  });

  it('returns deeply detached data and excludes unsupported or missing owners', () => {
    const { doc, page, widget } = fixture(), legacy = createWidget('checkbox'), box = createWidget('box');
    delete legacy.selectionText; box.selectionText = { ...widget.selectionText! };
    page.widgets.push(legacy, box);
    widget.richText = { expressionMode: 'literal', paragraphs: [{ runs: [{ text: 'Authored', linkId: 'link', style: { fontSize: 17 } }] }],
      links: [{ id: 'link', name: 'Link', interactions: [] }] };
    widget.interactions = [event('click', { type: 'setVariable', targetId: 'Result', value: 'Original' })];
    const before = structuredClone(doc), runtime = make(doc, portable), source = runtime.selectionDisplaySource(widget.id)!;
    source.text = 'Mutated'; source.style.textPadding![0] = 777; source.selectionText!.autoFitWidth = false;
    source.richText!.paragraphs[0].runs[0].style!.fontSize = 99;
    source.richText!.links![0].name = 'Mutated';
    source.interactions[0].actions[0].value = 'Mutated';
    expect(runtime.selectionDisplaySource(widget.id)).toEqual(before.pages[0].widgets[0]);
    expect(runtime.widget(widget).text).toBe('Authored');
    expect(doc).toEqual(before);
    for (const id of ['missing', legacy.id, box.id]) expect(runtime.selectionDisplaySource(id)).toBeUndefined();
  });
});
