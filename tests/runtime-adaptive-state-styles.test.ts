import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createWidget, uid } from '../src/model/document';
import type { AdaptiveStateKey, AdaptiveStateStyles, Document, Widget } from '../src/model/types';
import { getEffectiveAdaptiveStateStyles, hasAdaptiveState } from '../src/model/adaptive';
import { resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';

const sessions: OfflineRuntime[] = [];
afterEach(() => sessions.splice(0).forEach(session => session.dispose()));
const fields = { mouseOver: 'mouseOverStyle', mouseDown: 'mouseDownStyle', focused: 'focusedStyle', selected: 'selectedStyle', error: 'errorStyle', hint: 'hintStyle', disabled: 'disabledStyle' } as const;
function fixture() {
  const doc = createDocument(), page = doc.pages[0], shape = createWidget('box'); doc.caseSelection = 'never'; page.widgets = [shape];
  page.adaptiveSelection = 'native-size'; page.adaptiveBaseSize = { width: 0, height: 0 };
  shape.mouseOverStyle = { fill: '#111111', fontSize: 31 }; shape.focusedStyle = { color: '#222222' }; shape.selectedStyle = { stroke: '#333333' };
  page.adaptiveViews = [
    { id: 'leaf', name: 'Leaf', width: 768, baseViewId: 'parent', overrides: {} },
    { id: 'parent', name: 'Parent', width: 390, overrides: {} },
    { id: 'unrelated', name: 'Unrelated', width: 1600, overrides: { [shape.id]: { stateStyles: { disabled: { fill: '#ffffff' } } } } },
  ];
  return { doc, page, shape, leaf: page.adaptiveViews[0], parent: page.adaptiveViews[1] };
}
function make(doc: Document, portable: boolean, width = 800) {
  const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout }) : createOfflineRuntime;
  const runtime = factory(doc, undefined, undefined, undefined, { width }); sessions.push(runtime);
  return runtime as OfflineRuntime & { hasInteractionStyle(id: string, state: AdaptiveStateKey): boolean };
}
const effects = (w: Widget) => Object.fromEntries(Object.entries(fields).flatMap(([state, field]) => w[field] === undefined ? [] : [[state, w[field]]]));
for (const portable of [false, true]) describe(portable ? 'portable adaptive state maps' : 'module adaptive state maps', () => {
  it('matches the model whole-map lookup without deep merging entries or leaking metadata', async () => {
    const { doc, page, shape, parent, leaf } = fixture();
    parent.overrides[shape.id] = { style: { color: '#abcdef' }, stateStyles: { mouseOver: { fill: '#444444' }, selected: {} } };
    leaf.overrides[shape.id] = { style: { fontSize: 24 } };
    const saved = JSON.stringify(doc), runtime = make(doc, portable); await runtime.start();
    const w = runtime.widget(shape); expect(effects(w)).toEqual(getEffectiveAdaptiveStateStyles(page, 'leaf', shape.id));
    expect(w).not.toHaveProperty('stateStyles'); expect(w.focusedStyle).toBeUndefined();
    runtime.setInteractionState(shape.id, { mouseOver: true }); expect(runtime.widget(shape).style).toMatchObject({ fill: '#444444', fontSize: 24, color: '#abcdef' });
    expect(JSON.stringify(doc)).toBe(saved);
  });
  it('empty leaf map blocks all paints while independent ancestor presence still gates focus', async () => {
    const { doc, page, shape, parent, leaf } = fixture(); delete shape.focusedStyle;
    parent.overrides[shape.id] = { stateStyles: { focused: {} } }; leaf.overrides[shape.id] = { stateStyles: { mouseOver: { fill: '#fedcba' } } };
    const runtime = make(doc, portable); await runtime.start();
    expect(runtime.hasInteractionStyle(shape.id, 'focused')).toBe(hasAdaptiveState(page, 'leaf', shape.id, 'focused')); expect(runtime.hasInteractionStyle(shape.id, 'focused')).toBe(true);
    runtime.setInteractionState(shape.id, { mouseOver: true }); expect(runtime.widget(shape).style.fill).toBe('#fedcba');
    runtime.setInteractionState(shape.id, { focused: true }); expect(runtime.widget(shape).style.fill).toBe(shape.style.fill);
    leaf.overrides[shape.id] = { stateStyles: {} }; expect(effects(runtime.widget(shape))).toEqual({});
    expect(runtime.widget(shape).style).toMatchObject(shape.style);
  });
  it('base empty entries and off-chain states do not produce presence; explicit view empty entries do', () => {
    const { doc, page, shape, parent } = fixture(); shape.focusedStyle = {};
    parent.overrides[shape.id] = { stateStyles: { error: {} } }; const runtime = make(doc, portable);
    for (const state of Object.keys(fields) as AdaptiveStateKey[]) expect(runtime.hasInteractionStyle(shape.id, state)).toBe(hasAdaptiveState(page, 'leaf', shape.id, state));
    expect(runtime.hasInteractionStyle(shape.id, 'focused')).toBe(false); expect(runtime.hasInteractionStyle(shape.id, 'disabled')).toBe(false); expect(runtime.hasInteractionStyle(shape.id, 'error')).toBe(true);
  });
  it('overlays effective pointer/focus, selected, error, hint and disabled in the established order', async () => {
    const { doc, page, parent } = fixture(), input = createWidget('input'); page.widgets = [input]; input.text = ''; input.hintText = 'Hint'; input.selected = true; input.error = true;
    const states: AdaptiveStateStyles = { mouseOver: { fill: '#111111' }, mouseDown: { fill: '#222222' }, focused: { fill: '#333333' }, selected: { fill: '#444444' }, error: { fill: '#555555' }, hint: { fill: '#666666' }, disabled: { fill: '#777777' } };
    parent.overrides[input.id] = { stateStyles: states }; const runtime = make(doc, portable); await runtime.start();
    runtime.setInteractionState(input.id, { mouseOver: true, mouseDown: true, focused: true }); expect(runtime.widget(input).style.fill).toBe('#666666');
    runtime.hideHint(input.id); expect(runtime.widget(input).style.fill).toBe('#555555');
    await runtime.setError(input.id, false); expect(runtime.widget(input).style.fill).toBe('#444444');
    await runtime.select(input.id, false); expect(runtime.widget(input).style.fill).toBe('#333333');
    runtime.setInteractionState(input.id, { focused: false }); expect(runtime.widget(input).style.fill).toBe('#222222');
    runtime.state().widgetOverrides[input.id] = { ...runtime.state().widgetOverrides[input.id], disabled: true }; expect(runtime.widget(input).style.fill).toBe('#777777');
  });
  it('keeps rich-run source formatting and atomic style resets through view and effect changes', async () => {
    const { doc, page, shape, parent } = fixture(); shape.text = 'Rich'; shape.richText = { paragraphs: [{ runs: [{ text: 'Rich', style: { color: '#010203', fontSize: 20 } }] }] };
    shape.style.fillGradient = { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] };
    parent.overrides[shape.id] = { style: { fontSize: 18 }, stateStyles: { selected: { fill: shape.style.fill, fontSize: 28 } } };
    const runtime = make(doc, portable); await runtime.start(); await runtime.select(shape.id, true);
    expect(runtime.widget(shape).style.fillGradient).toBeUndefined(); expect(runtime.widget(shape).richText!.paragraphs[0].runs[0].style).toMatchObject({ color: '#010203', fontSize: 28 });
    await runtime.setAdaptiveView({ kind: 'base' }); expect(runtime.widget(shape).richText!.paragraphs[0].runs[0].style).toMatchObject({ color: '#010203', fontSize: 20 });
    expect(page.adaptiveViews[1].overrides[shape.id].stateStyles).toEqual(parent.overrides[shape.id].stateStyles);
  });
  it('isolates row state and applies adaptive effects before rows or their DOM have rendered', async () => {
    const { doc, page, shape, parent } = fixture(), list = createWidget('repeater'); page.widgets = [list]; list.repeater!.template = [shape]; list.repeater!.rows = [{ Name: 'A' }, { Name: 'B' }];
    parent.overrides[shape.id] = { stateStyles: { selected: { fill: '#123456' } } }; const runtime = make(doc, portable); await runtime.start(); const [first, second] = runtime.rows(list);
    await runtime.select(shape.id, true, second.context); expect(runtime.widget(shape, first.context).style.fill).toBe(shape.style.fill); expect(runtime.widget(shape, second.context).style.fill).toBe('#123456');
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'parent' }); const rows = runtime.rows(list); expect(runtime.widget(shape, rows[1].context).style.fill).toBe('#123456'); expect(runtime.widget(shape, rows[0].context).selected).toBeFalsy();
  });
  it('preserves shared composite state restrictions and reads the Base effect rather than view declarations', () => {
    const { doc, page, parent } = fixture(), table = createWidget('table'), cell = table.table!.cells[0]; page.widgets = [table]; cell.selected = true; cell.selectedStyle = { fill: '#123456' };
    parent.overrides[cell.id] = { stateStyles: { selected: { fill: '#ff0000' } } }; parent.overrides[table.id] = { stateStyles: { focused: {} } };
    const runtime = make(doc, portable); expect(runtime.widget(cell).style.fill).toBe('#123456'); expect(runtime.hasInteractionStyle(table.id, 'focused')).toBe(false);
    expect(effects(runtime.widget(cell))).toEqual(getEffectiveAdaptiveStateStyles(page, 'leaf', cell.id));
  });
  it('reads page-specific state maps from one shared view set independently', async () => {
    const { doc, page, shape } = fixture(); const views = page.adaptiveViews.map(({ overrides: _overrides, ...view }) => view);
    doc.adaptiveViewSets = [{ id: uid(), name: 'Shared', baseSize: { width: 0, height: 0 }, views }]; page.adaptiveViewSetId = doc.adaptiveViewSets[0].id;
    page.adaptiveOverrides = { parent: { [shape.id]: { stateStyles: { selected: { fill: '#0000ff' } } } } }; page.adaptiveViews = []; shape.selected = true;
    const runtime = make(doc, portable); expect(runtime.widget(shape).style.fill).toBe('#0000ff');
    expect(effects(runtime.widget(shape))).toEqual(getEffectiveAdaptiveStateStyles(resolveAdaptivePage(doc, page), 'leaf', shape.id));
    const declaration = runtime.adaptiveWidgetOverride(shape.id)!; declaration.stateStyles!.selected!.fill = '#ff0000'; expect(runtime.widget(shape).style.fill).toBe('#0000ff');
  });
  it('uses adaptive Error presence for the existing reentrant flag-versus-paint contract', async () => {
    const { doc, shape, parent } = fixture(); delete shape.errorStyle;
    parent.overrides[shape.id] = { stateStyles: { error: { fill: '#ffdddd' } } };
    shape.interactions = [{ id: uid(), name: 'Remove in handler', event: 'errorSet', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: uid(), type: 'setError', targetId: shape.id, value: 'false' }] }];
    const runtime = make(doc, portable); await runtime.start(); await runtime.setError(shape.id, true);
    expect(runtime.state().widgetOverrides[shape.id].error).toBe(false); expect(runtime.widget(shape).error).toBe(true); expect(runtime.widget(shape).style.fill).toBe('#ffdddd');
    await runtime.setError(shape.id, false); expect(runtime.widget(shape).error).toBe(false);
  });
  it('clears cached hyperlink paint when adaptive-only parent Down is released or Selected repaints', async () => {
    const { doc, shape, parent } = fixture(); delete shape.selectedStyle;
    shape.text = 'Link'; shape.richText = { paragraphs: [{ runs: [{ text: 'Link', linkId: 'link', style: { color: '#010203' } }] }], links: [{ id: 'link', name: 'Link', interactions: [], mouseDownStyle: { color: '#ff0000' } }] };
    parent.overrides[shape.id] = { stateStyles: { mouseDown: { color: '#0000ff' }, selected: { color: '#800080' } } };
    const runtime = make(doc, portable); await runtime.start(); const color = () => runtime.widget(shape).richText!.paragraphs[0].runs[0].style!.color;
    runtime.setLinkState(shape.id, 'link', 'down'); expect(color()).toBe('#ff0000'); runtime.releasePointerStyles(); expect(color()).toBe('#010203');
    runtime.setLinkState(shape.id, 'link', 'down'); await runtime.select(shape.id, true); expect(color()).toBe('#800080');
  });
});
