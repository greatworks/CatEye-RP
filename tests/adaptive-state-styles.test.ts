import { describe, expect, it } from 'vitest';
import * as adaptive from '../src/model/adaptive';
import { createPage, createWidget, findWidget } from '../src/model/document';
import type { AdaptiveStateKey, AdaptiveStateStyles, AdaptiveView, GradientFill, Page, Widget } from '../src/model/types';

const gradient: GradientFill = { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] };
function fixture() {
  const page = createPage('State hierarchy'), widget = createWidget('box');
  widget.selectedStyle = { color: '#ff0000', fontSize: 24 };
  widget.mouseOverStyle = { fill: '#dddddd' };
  widget.focusedStyle = { stroke: '#123456' };
  const ancestor: AdaptiveView = { id: 'ancestor', name: 'Parent', width: 768, overrides: {} };
  const child: AdaptiveView = { id: 'child', name: 'Child', width: 390, baseViewId: ancestor.id, overrides: {} };
  const sibling: AdaptiveView = { id: 'sibling', name: 'Other', width: 500, overrides: {} };
  page.widgets = [widget]; page.adaptiveViews = [ancestor, child, sibling];
  return { page, widget, ancestor, child, sibling };
}
function shown(page: Page, view = 'child'): Widget { return adaptive.resolveAdaptiveWidgets(page, view)[0]; }
function edit(page: Page, change: (widget: Widget) => void, view = 'child'): Page {
  const widgets = structuredClone(adaptive.resolveAdaptiveWidgets(page, view)); change(widgets[0]);
  return adaptive.applyAdaptiveWidgetEdits(page, view, widgets);
}
function local(page: Page): AdaptiveStateStyles | undefined { return page.adaptiveViews.find(v => v.id === 'child')?.overrides[page.widgets[0].id]?.stateStyles; }

describe('adaptive whole state-map lookup', () => {
  it.each([
    ['mouseOver', 'mouseOverStyle'], ['mouseDown', 'mouseDownStyle'], ['focused', 'focusedStyle'], ['selected', 'selectedStyle'],
    ['error', 'errorStyle'], ['hint', 'hintStyle'], ['disabled', 'disabledStyle'],
  ] as const)('projects %s as %s without normalizing partial properties', (state, field) => {
    const { page, widget, child } = fixture(); child.overrides[widget.id] = { stateStyles: { [state]: { fontStyle: 'normal', underline: false, opacity: 0 } } };
    expect(shown(page)[field]).toEqual({ fontStyle: 'normal', underline: false, opacity: 0 });
    expect(adaptive.hasAdaptiveState(page, child.id, widget.id, state as AdaptiveStateKey)).toBe(true);
    const next = edit(page, value => { value[field] = { color: '#123456' }; });
    expect(local(next)).toEqual({ [state]: { color: '#123456' } });
    expect(next.widgets[0][field]).toEqual(widget[field]);
  });
  it('empty child map blocks every Base and ancestor effect while normal declarations still inherit', () => {
    const { page, widget, ancestor, child } = fixture();
    ancestor.overrides[widget.id] = { style: { fontSize: 18 }, stateStyles: { selected: { color: '#0000ff' }, error: { fill: '#ffff00' } } };
    child.overrides[widget.id] = { stateStyles: {} };
    const value = shown(page);
    expect(value.style.fontSize).toBe(18);
    for (const key of ['selectedStyle', 'mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'errorStyle', 'hintStyle', 'disabledStyle']) expect(value).not.toHaveProperty(key);
    expect(value).not.toHaveProperty('stateStyles');
    expect(widget.selectedStyle).toEqual({ color: '#ff0000', fontSize: 24 });
  });
  it('replaces a whole map and each state entry without filling from Base or ancestor effects', () => {
    const { page, widget, ancestor, child } = fixture();
    ancestor.overrides[widget.id] = { stateStyles: { selected: { color: '#0000ff', fontSize: 30 }, mouseOver: { fill: '#eeeeee' } } };
    child.overrides[widget.id] = { stateStyles: { selected: { color: '#008800' }, focused: {} } };
    const value = shown(page);
    expect(value.selectedStyle).toEqual({ color: '#008800' }); expect(value.focusedStyle).toEqual({});
    expect(value).not.toHaveProperty('mouseOverStyle'); expect(value).not.toHaveProperty('stateStyles');
    expect(adaptive.resolveAdaptiveOverride(page, child.id, widget.id)?.stateStyles).toEqual(child.overrides[widget.id].stateStyles);
  });
  it('inherits the nearest complete map through absent child maps, retaining atomic paint and reset values', () => {
    const { page, widget, ancestor } = fixture();
    ancestor.overrides[widget.id] = { stateStyles: { selected: { fillGradient: gradient, underline: false, opacity: 0 }, disabled: { fill: '#000000' } } };
    expect(shown(page).selectedStyle).toEqual(ancestor.overrides[widget.id].stateStyles!.selected);
    expect(shown(page)).not.toHaveProperty('focusedStyle');
    expect(adaptive.getEffectiveAdaptiveStateStyles(page, 'child', widget.id)).toEqual(ancestor.overrides[widget.id].stateStyles);
  });
  it('returns Base flat effects in Base/legacy views without writing map metadata into widgets', () => {
    const { page, widget } = fixture(); delete page.adaptiveSelection; delete page.adaptiveBaseSize;
    expect(adaptive.resolveAdaptiveWidgets(page, undefined)).toBe(page.widgets);
    expect(adaptive.getEffectiveAdaptiveStateStyles(page, undefined, widget.id)).toEqual({ selected: widget.selectedStyle, mouseOver: widget.mouseOverStyle, focused: widget.focusedStyle });
    expect(shown(page).selectedStyle).toEqual(widget.selectedStyle); expect(shown(page)).not.toHaveProperty('stateStyles');
  });
  it('keeps effective empty state distinct from the current-chain presence gate', () => {
    const { page, widget, ancestor, child, sibling } = fixture();
    delete widget.focusedStyle;
    ancestor.overrides[widget.id] = { stateStyles: { focused: {} } };
    child.overrides[widget.id] = { stateStyles: {} };
    sibling.overrides[widget.id] = { stateStyles: { mouseDown: { opacity: .5 } } };
    expect(adaptive.getEffectiveAdaptiveStateStyles(page, child.id, widget.id)).toEqual({});
    expect(adaptive.hasAdaptiveState(page, child.id, widget.id, 'focused')).toBe(true);
    expect(adaptive.hasAdaptiveState(page, child.id, widget.id, 'mouseDown')).toBe(false);
    expect(adaptive.hasAdaptiveState(page, sibling.id, widget.id, 'mouseDown')).toBe(true);
    widget.errorStyle = {};
    expect(adaptive.hasAdaptiveState(page, child.id, widget.id, 'error')).toBe(false);
    widget.errorStyle = { color: '#ff0000' };
    expect(adaptive.hasAdaptiveState(page, child.id, widget.id, 'error')).toBe(true);
  });
  it('helpers return independent snapshots and do not mutate declarations', () => {
    const { page, widget, child } = fixture(); child.overrides[widget.id] = { stateStyles: { selected: { fillGradient: gradient } } };
    const result = adaptive.getEffectiveAdaptiveStateStyles(page, child.id, widget.id);
    result.selected!.fillGradient!.stops[0].color = '#ffffff';
    expect(child.overrides[widget.id].stateStyles!.selected!.fillGradient!.stops[0].color).toBe('#ff0000');
    expect(adaptive.getEffectiveAdaptiveStateStyles(page, child.id, 'missing')).toEqual({});
    expect(adaptive.hasAdaptiveState(page, child.id, 'missing', 'focused')).toBe(false);
  });
});

describe('independent adaptive effect authoring snapshot design', () => {
  it('editing one inherited effect stores the complete effective map while keeping all Base effects unchanged', () => {
    const { page, widget, ancestor } = fixture();
    ancestor.overrides[widget.id] = { stateStyles: { selected: { color: '#112233' }, error: { fill: '#ffff00' }, focused: {} } };
    const next = edit(page, value => { value.selectedStyle = { color: '#008800' }; value.text = 'Shared text'; });
    expect(local(next)).toEqual({ selected: { color: '#008800' }, error: { fill: '#ffff00' }, focused: {} });
    expect(next.widgets[0].selectedStyle).toEqual(widget.selectedStyle); expect(next.widgets[0].mouseOverStyle).toEqual(widget.mouseOverStyle);
    expect(next.widgets[0].text).toBe('Shared text'); expect(shown(next).selectedStyle).toEqual({ color: '#008800' });
    expect(next.widgets[0]).not.toHaveProperty('stateStyles');
  });
  it('layout/shared content edits do not materialize inherited effects or alter Base effects', () => {
    const { page, widget, ancestor } = fixture();
    ancestor.overrides[widget.id] = { stateStyles: { selected: { color: '#112233' } } };
    const next = edit(page, value => { value.x += 10; value.notes = 'shared'; });
    expect(local(next)).toBeUndefined(); expect(next.adaptiveViews[1].overrides[widget.id]).toEqual({ x: widget.x + 10 });
    expect(next.widgets[0].selectedStyle).toEqual(widget.selectedStyle); expect(next.widgets[0].focusedStyle).toEqual(widget.focusedStyle);
  });
  it.each([{}, { focused: {}, selected: { color: '#112233' } }])('preserves an existing local map exactly during unrelated editing: %j', map => {
    const { page, widget, ancestor, child } = fixture();
    ancestor.overrides[widget.id] = { stateStyles: structuredClone(map) }; child.overrides[widget.id] = { stateStyles: structuredClone(map) };
    const next = edit(page, value => { value.notes = 'shared'; }); expect(local(next)).toEqual(map);
    next.adaptiveViews[0].overrides[widget.id] = { stateStyles: { disabled: { fill: '#000000' } } };
    expect(adaptive.getEffectiveAdaptiveStateStyles(next, child.id, widget.id)).toEqual(map);
    expect(next.widgets[0].selectedStyle).toEqual(widget.selectedStyle);
  });
  it('removing the last effect stores an explicit empty map, not an inheritance request', () => {
    const { page, widget, ancestor } = fixture(); ancestor.overrides[widget.id] = { stateStyles: { selected: { color: '#112233' } } };
    const next = edit(page, value => { delete value.selectedStyle; });
    expect(local(next)).toEqual({}); expect(shown(next)).not.toHaveProperty('selectedStyle'); expect(next.widgets[0].selectedStyle).toEqual(widget.selectedStyle);
  });
  it('a solid state edit replaces its gradient without changing other effect paints or normal style', () => {
    const { page, widget, ancestor } = fixture();
    ancestor.overrides[widget.id] = { style: { fillGradient: gradient }, stateStyles: { selected: { fill: '#eeeeee', fillGradient: gradient }, mouseOver: { strokeGradient: gradient } } };
    const next = edit(page, value => { value.selectedStyle = { fill: '#123456' }; });
    expect(local(next)).toEqual({ selected: { fill: '#123456' }, mouseOver: { strokeGradient: gradient } });
    expect(next.adaptiveViews[1].overrides[widget.id]).not.toHaveProperty('style');
    expect(shown(next).style.fillGradient).toEqual(gradient); expect(next.widgets[0].style).toEqual(widget.style);
  });
  it('Base edits remain shared while existing child maps still block newly edited Base effects', () => {
    const { page, widget, child } = fixture(); child.overrides[widget.id] = { stateStyles: {} };
    const next = edit(page, value => { value.selectedStyle = { color: '#009900' }; }, '');
    expect(next.widgets[0].selectedStyle).toEqual({ color: '#009900' }); expect(shown(next)).not.toHaveProperty('selectedStyle');
  });
  it('clear-state operation removes only selected local maps, pruning empty widget entries', () => {
    const { page, widget, ancestor, child } = fixture(), other = createWidget('box'); page.widgets.push(other);
    ancestor.overrides[widget.id] = { stateStyles: { selected: { color: '#112233' } } };
    child.overrides[widget.id] = { x: 60, hidden: true, style: { opacity: .4 }, stateStyles: {} };
    child.overrides[other.id] = { stateStyles: { error: { fill: '#000000' } } };
    const first = adaptive.clearAdaptiveStateStyles(page, child.id, [widget.id]);
    expect(first.adaptiveViews[1].overrides[widget.id]).toEqual({ x: 60, hidden: true, style: { opacity: .4 } });
    expect(first.adaptiveViews[1].overrides[other.id]).toEqual(child.overrides[other.id]);
    expect(shown(first).selectedStyle).toEqual({ color: '#112233' });
    const all = adaptive.clearAdaptiveStateStyles(first, child.id);
    expect(all.adaptiveViews[1].overrides[other.id]).toBeUndefined(); expect(page.adaptiveViews[1].overrides[widget.id].stateStyles).toEqual({});
  });
  it('preserves effects on a newly added widget as shared Base data and removes deleted widget overrides', () => {
    const { page, widget, child } = fixture(); child.overrides[widget.id] = { stateStyles: {} };
    const added = createWidget('box'); added.selectedStyle = { color: '#123456' };
    const next = adaptive.applyAdaptiveWidgetEdits(page, child.id, [added]);
    expect(next.widgets).toEqual([added]); expect(next.adaptiveViews[1].overrides).toEqual({});
  });
  it.each(['panel', 'repeater'] as const)('keeps %s descendants independent and restores Base effect provenance after editing', type => {
    const { page, widget, ancestor, child } = fixture(), container = createWidget(type);
    if (type === 'panel') container.states![0].widgets = [widget]; else container.repeater!.template = [widget];
    page.widgets = [container];
    ancestor.overrides[widget.id] = { stateStyles: { selected: { color: '#112233' }, mouseOver: {} } };
    const widgets = structuredClone(adaptive.resolveAdaptiveWidgets(page, child.id));
    const leaf = findWidget({ widgets }, widget.id)!;
    leaf.errorStyle = { opacity: .6 };
    leaf.richText = { paragraphs: [{ runs: [{ text: 'Shared rich', style: { fontStyle: 'italic' } }] }] };
    leaf.text = 'Shared rich';
    const next = adaptive.applyAdaptiveWidgetEdits(page, child.id, widgets);
    expect(next.adaptiveViews[1].overrides[widget.id]).toEqual({ stateStyles: { selected: { color: '#112233' }, mouseOver: {}, error: { opacity: .6 } } });
    const baseLeaf = findWidget(next, widget.id)!;
    expect(baseLeaf.selectedStyle).toEqual(widget.selectedStyle); expect(baseLeaf).not.toHaveProperty('errorStyle');
    expect(baseLeaf.richText).toEqual(leaf.richText); expect(baseLeaf.text).toBe('Shared rich');
  });
});

describe('existing composite scope remains shared', () => {
  it.each(['table', 'menu', 'tree'] as const)('%s retains shared effects and only adapts declared visibility', type => {
    const { page, child } = fixture(), widget = createWidget(type); widget.selectedStyle = { color: '#123456' }; page.widgets = [widget];
    // Even an unvalidated in-memory override must not invent contained-state rules.
    child.overrides[widget.id] = { hidden: true, stateStyles: {} };
    expect(shown(page)).toMatchObject({ hidden: true, selectedStyle: widget.selectedStyle });
    expect(adaptive.getEffectiveAdaptiveStateStyles(page, child.id, widget.id)).toEqual({ selected: widget.selectedStyle });
    const next = edit(page, value => { value.selectedStyle = { color: '#008800' }; });
    expect(next.widgets[0].selectedStyle).toEqual({ color: '#008800' }); expect(next.adaptiveViews[1].overrides[widget.id]).toEqual({ hidden: true });
  });
  it('table cells remain shared without pretending the native contained owner algorithm is implemented', () => {
    const { page, child } = fixture(), table = createWidget('table'); page.widgets = [table];
    const cell = table.table!.cells[0]; cell.selectedStyle = { color: '#123456' }; child.overrides[cell.id] = { stateStyles: {} };
    expect(findWidget({ widgets: adaptive.resolveAdaptiveWidgets(page, child.id) }, cell.id)?.selectedStyle).toEqual(cell.selectedStyle);
    expect(adaptive.getEffectiveAdaptiveStateStyles(page, child.id, cell.id)).toEqual({ selected: cell.selectedStyle });
  });
});
