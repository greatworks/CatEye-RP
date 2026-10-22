import { describe, expect, it } from 'vitest';
import { applySelectionAuthorEffects, applySelectionAuthorWriteEffects } from '../src/model/selection-author-edits';
import { planSelectionLayout, type SelectionLayoutEffect, type SelectionLayoutInput, type SelectionLayoutResult, type SelectionLayoutServices } from '../src/model/selection-layout';
import { createDocument, createLayer, createPage, createWidget, findWidget, parseDocument, serializeDocument } from '../src/model/document';
import { resolveAdaptiveWidgets } from '../src/model/adaptive';
import { commitAdaptivePage, resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import type { Page, Widget } from '../src/model/types';

function fixture(type: 'checkbox' | 'radio' = 'checkbox') {
  const page = createPage('Selection author effects'), widget = createWidget(type, 20, 30);
  widget.width = 100; widget.height = 20;
  widget.selectionText = { autoFitWidth: false, autoFitHeight: false, alignRight: false };
  page.widgets = [widget];
  page.adaptiveViews = [
    { id: 'tablet', name: 'Tablet', width: 768, overrides: {} },
    { id: 'phone', name: 'Phone', width: 390, baseViewId: 'tablet', overrides: {} },
    { id: 'other', name: 'Other', width: 500, overrides: {} },
  ];
  return { page, widget };
}
function input(patch: Partial<SelectionLayoutInput> = {}): SelectionLayoutInput {
  return {
    ownerRect: { x: 20, y: 30, width: 100, height: 20 },
    textPanelRect: { x: 0, y: 0, width: 50, height: 15 },
    coordinateContext: { kind: 'translation', locationInDiagram: { x: 20, y: 30 }, ownerRotation: 0, textRotation: 0 },
    rawFit: { width: false, height: false }, effectiveFit: { width: false, height: false },
    alignRight: false, empty: false, guard: false, padding: [0, 0, 0, 0],
    indicatorSize: 13, horizontalAlignment: 'left', verticalAlignment: 'top', ...patch,
  };
}
const services: SelectionLayoutServices = {
  measureText: () => ({ width: 60, height: 15 }),
  readMinimumSize: () => ({ width: 1, height: 1 }),
  convertIndicatorInset: () => ({ width: 2, height: 2 }),
  unionRectangles(a, b) {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
      height: Math.max(a.y + a.height, b.y + b.height) - y };
  },
};
function successful(effects: SelectionLayoutEffect[]): SelectionLayoutResult {
  const result = planSelectionLayout(input({ guard: true }), { kind: 'layout', recalculateFit: false }, services);
  if (!result.ok) throw Error(result.reason);
  return { ...result, effects };
}
function actualSize() {
  const result = planSelectionLayout(input(), { kind: 'size', size: { width: 150, height: 20 }, allViews: true, notify: false }, services);
  expect(result.ok).toBe(true);
  // Retained uJ0j -> OI8Z -> WIyL order, independently recorded in the geometry
  // suite. The persistence expectations below are explicit, not derived from
  // the final state rectangle.
  expect(result.effects.filter(e => e.name === 'style.Size')).toEqual([
    { name: 'style.Size', width: 150, height: 20, allViews: true, notify: true },
    { name: 'style.Size', width: 150, height: 15, allViews: false, notify: true },
  ]);
  return result;
}
function roundTrip(page: Page) {
  const doc = createDocument(); doc.pages = [page];
  return parseDocument(serializeDocument(doc)).pages[0];
}
function effective(page: Page, id: string, viewId?: string) {
  return findWidget({ widgets: resolveAdaptiveWidgets(page, viewId) }, id)!;
}

describe('ordered SelectionButton author effect persistence', () => {
  it('persists Location-only controller writes without inventing a text-layout state', () => {
    const { page, widget } = fixture('radio');
    widget.selectionText!.autoFitWidth = true;
    page.adaptiveViews[0].overrides[widget.id] = { y: 70, width: 80 };
    page.adaptiveViews[1].overrides[widget.id] = { hidden: true, style: { color: '#123456' } };
    page.adaptiveOverrides = { inactive: { [widget.id]: { x: 600, y: 900 } } };
    const before = structuredClone(page);
    const effects: SelectionLayoutEffect[] = [{ name: 'style.Location', x: 245.25, y: 155.5, allViews: false, notify: true }];
    const next = applySelectionAuthorWriteEffects(page, 'phone', widget.id, effects);
    expect(next.adaptiveViews[1].overrides[widget.id]).toEqual({ hidden: true, style: { color: '#123456' }, x: 245.25, y: 155.5 });
    expect(next.widgets).toEqual(before.widgets);expect(next.adaptiveViews[0]).toEqual(before.adaptiveViews[0]);
    expect(next.adaptiveOverrides).toEqual(before.adaptiveOverrides);expect(roundTrip(next)).toEqual(next);
    expect(() => applySelectionAuthorWriteEffects(page, 'phone', widget.id,
      [...effects, { name: 'style.Location', x: Infinity, y: 5, allViews: false }])).toThrow(/Location.x/);
    expect(page).toEqual(before);
  });
  it('applies external all-view Size before the current internal correction, clearing inactive pairs only', () => {
    const { page, widget } = fixture();
    page.adaptiveViews[0].overrides[widget.id] = { width: 91, height: 21, x: 7, style: { color: '#123456' } };
    page.adaptiveViews[1].overrides[widget.id] = { height: 26, hidden: true };
    page.adaptiveViews[2].overrides[widget.id] = { width: 93, stateStyles: {} };
    page.adaptiveOverrides = { inactive: { [widget.id]: { width: 92, height: 22, y: 8, placed: false } } };
    const before = structuredClone(page), result = actualSize(), trace = structuredClone(result);
    const next = applySelectionAuthorEffects(page, 'phone', widget.id, result);
    expect(findWidget(next, widget.id)).toMatchObject({ width: 150, height: 20 });
    expect(next.adaptiveViews.map(v => v.overrides[widget.id])).toEqual([
      { x: 7, style: { color: '#123456' } },
      { hidden: true, width: 150, height: 15 },
      { stateStyles: {} },
    ]);
    expect(next.adaptiveOverrides).toEqual({ inactive: { [widget.id]: { y: 8, placed: false } } });
    expect(effective(next, widget.id, 'phone')).toMatchObject({ width: 150, height: 15 });
    expect(effective(next, widget.id, 'other')).toMatchObject({ width: 150, height: 20 });
    expect(roundTrip(next)).toEqual(next);
    expect(page).toEqual(before); expect(result).toEqual(trace);
  });

  it('keeps Base internal correction in Base while preserving unrelated declarations', () => {
    const { page, widget } = fixture('radio');
    page.adaptiveViews[0].overrides[widget.id] = { width: 90, height: 25, x: 9 };
    const next = applySelectionAuthorEffects(page, undefined, widget.id, actualSize());
    expect(findWidget(next, widget.id)).toMatchObject({ width: 150, height: 15, selectionText: widget.selectionText });
    expect(next.adaptiveViews[0].overrides[widget.id]).toEqual({ x: 9 });
    expect(next).not.toHaveProperty('textPanelRect');
    expect(findWidget(next, widget.id)).not.toHaveProperty('guard');
  });

  it('preserves provider pairs and source order even when a component equals its inherited value', () => {
    const { page, widget } = fixture();
    const position = { name: 'style.Location', x: 44, y: 30, allViews: false };
    const size = { name: 'style.Size', width: 120, height: 20, allViews: false };
    const next = applySelectionAuthorEffects(page, 'phone', widget.id, successful([position, size]));
    expect(next.adaptiveViews[1].overrides[widget.id]).toEqual({ x: 44, y: 30, width: 120, height: 20 });
    const parentChanged = structuredClone(next);
    parentChanged.adaptiveViews[0].overrides[widget.id] = { y: 77, height: 88 };
    expect(effective(parentChanged, widget.id, 'phone')).toMatchObject({ x: 44, y: 30, width: 120, height: 20 });
    const lastAllViews = applySelectionAuthorEffects(page, 'phone', widget.id, successful([
      size, { ...size, width: 140, height: 22, allViews: true },
    ]));
    expect(lastAllViews.adaptiveViews[1].overrides[widget.id]).toEqual({});
    expect(findWidget(lastAllViews, widget.id)).toMatchObject({ width: 140, height: 22 });
  });

  it('stores actual fit and AlignRight flag effects as shared content, without inventing layout effects', () => {
    const { page, widget } = fixture();
    page.adaptiveViews[1].overrides[widget.id] = { width: 77, style: { selectionButtonSize: 17 } };
    const fit = planSelectionLayout(input({ guard: true }), { kind: 'fit', axis: 'width', value: true }, services);
    const fitted = applySelectionAuthorEffects(page, 'phone', widget.id, fit);
    expect(findWidget(fitted, widget.id)?.selectionText).toEqual({ autoFitWidth: true, autoFitHeight: false, alignRight: false });
    expect(fitted.adaptiveViews).toEqual(page.adaptiveViews);
    const align = planSelectionLayout(input({ ownerRect: { x: 20, y: 30, width: 100, height: 15 } }),
      { kind: 'alignRight', value: true }, services);
    expect(align.ok).toBe(true);
    expect(align.effects.filter(e => e.name === 'alignRight.flag')).toEqual([{ name: 'alignRight.flag', value: true }]);
    const aligned = applySelectionAuthorEffects(fitted, 'phone', widget.id, align);
    expect(findWidget(aligned, widget.id)?.selectionText).toEqual({ autoFitWidth: true, autoFitHeight: false, alignRight: true });
    expect(aligned.adaptiveViews).toEqual(page.adaptiveViews);
  });

  it('replays the actual center/middle fit Location once rather than deriving a final-rectangle diff', () => {
    const { page, widget } = fixture();
    widget.selectionText = { autoFitWidth: true, autoFitHeight: true, alignRight: false };
    const result = planSelectionLayout(input({ rawFit: { width: true, height: true }, effectiveFit: { width: true, height: true },
      horizontalAlignment: 'center', verticalAlignment: 'middle' }), { kind: 'layout', recalculateFit: true },
    { ...services, measureText: request => request.pass === 0 ? { width: 70, height: 28 } : { width: 90, height: 40 } });
    expect(result.ok).toBe(true);
    expect(result.effects.filter(e => e.name === 'style.Location')).toEqual([
      { name: 'style.Location', x: 29, y: 26, allViews: false, notify: true },
    ]);
    const next = applySelectionAuthorEffects(page, 'phone', widget.id, result);
    expect(next.adaptiveViews[1].overrides[widget.id]).toEqual({ x: 29, y: 26, width: 103, height: 40 });
    expect(next.widgets).toEqual(page.widgets);
  });

  it.each(['layer', 'inactive panel state', 'repeater template'])('locates a nested selection in %s without rebasing coordinates', kind => {
    const { page, widget } = fixture();
    let owner: Widget;
    if (kind === 'layer') owner = createLayer([widget], 'Selection group');
    else if (kind === 'inactive panel state') {
      owner = createWidget('panel', 500, 600);
      owner.states!.push({ id: 'inactive-state', name: 'Inactive', widgets: [widget] });
    } else {
      owner = createWidget('repeater', 500, 600);
      owner.repeater!.template = [widget];
    }
    page.widgets = [owner]; const before = structuredClone(page);
    const next = applySelectionAuthorEffects(page, null, widget.id, successful([
      { name: 'style.Location', x: 35, y: 30, allViews: false },
      { name: 'style.Size', width: 120, height: 20, allViews: false },
    ]));
    expect(findWidget(next, widget.id)).toMatchObject({ x: 35, y: 30, width: 120, height: 20 });
    expect(next.widgets[0].id).toBe(owner.id);
    if (kind === 'layer') expect(next.widgets[0]).toMatchObject({ x: 35, y: 30, width: 120, height: 20 });
    else expect(next.widgets[0]).toMatchObject({ x: 500, y: 600, width: owner.width, height: owner.height });
    expect(roundTrip(next)).toEqual(next); expect(page).toEqual(before);
  });

  it('commits an effective shared-set page while retaining inactive maps and the set definitions', () => {
    const { page, widget } = fixture(), doc = createDocument();
    const views = page.adaptiveViews.map(({ overrides: _overrides, ...view }) => view);
    doc.adaptiveViewSets = [{ id: 'shared', name: 'Devices', baseSize: { width: 0, height: 0 }, views }];
    doc.pages = [{ ...page, adaptiveViewSetId: 'shared', adaptiveViews: [], adaptiveSelection: undefined, adaptiveBaseSize: undefined,
      adaptiveOverrides: { phone: { [widget.id]: { width: 80 } }, inactive: { [widget.id]: { height: 44, hidden: true } } } }];
    const before = structuredClone(doc);
    const next = commitAdaptivePage(doc, applySelectionAuthorEffects(resolveAdaptivePage(doc, doc.pages[0]), 'phone', widget.id, actualSize()));
    expect(next.adaptiveViewSets).toEqual(doc.adaptiveViewSets);
    expect(next.pages[0].adaptiveViews).toEqual([]);
    expect(next.pages[0].adaptiveOverrides).toEqual({
      phone: { [widget.id]: { width: 150, height: 15 } }, inactive: { [widget.id]: { hidden: true } },
    });
    expect(parseDocument(serializeDocument(next))).toEqual(next); expect(doc).toEqual(before);
  });

  it('ignores transient notifications and preserves identity when there is no persistent change', () => {
    const { page, widget } = fixture();
    const result = successful([{ name: 'panel.rect', rect: { x: 999, y: 999, width: 3, height: 3 } },
      { name: 'guard', value: true }, { name: 'measure', pass: 0 }, { name: 'NJ01' },
      { name: 'fit.flag', axis: 'width', value: false }, { name: 'alignRight.flag', value: false }]);
    expect(applySelectionAuthorEffects(page, 'phone', widget.id, result)).toBe(page);
    expect(page.adaptiveViews[1].overrides).toEqual({});
  });

  it('rejects a source failure with attempted writes, without committing its partial state', () => {
    const { page, widget } = fixture(), before = structuredClone(page);
    const result = planSelectionLayout(input(), { kind: 'size', size: { width: 150, height: 20 }, allViews: true, notify: true },
      { ...services, measureText() { throw Error('Font service failed'); } });
    expect(result.ok).toBe(false); expect(result.effects.some(e => e.name === 'style.Size')).toBe(true);
    expect(() => applySelectionAuthorEffects(page, 'phone', widget.id, result)).toThrow(/Font service failed/);
    expect(page).toEqual(before);
  });

  it.each([
    { name: 'style.Size', width: 0, height: 20, allViews: false },
    { name: 'style.Size', width: 100_001, height: 20, allViews: false },
    { name: 'style.Size', width: 10, height: 20, allViews: 'false' },
    { name: 'style.Location', x: Infinity, y: 30, allViews: false },
    { name: 'style.Location', x: 0, y: -100_001, allViews: false },
    { name: 'fit.flag', axis: 'depth', value: true },
    { name: 'alignRight.flag', value: 1 },
  ])('rejects an invalid persistent effect atomically: %j', effect => {
    const { page, widget } = fixture(), before = structuredClone(page);
    expect(() => applySelectionAuthorEffects(page, 'phone', widget.id, successful([
      { name: 'fit.flag', axis: 'width', value: true },
      { name: 'style.Size', width: 150, height: 20, allViews: true }, effect,
    ]))).toThrow();
    expect(page).toEqual(before);
  });

  it('rejects an absent view/target and a selection without an explicit author-layout declaration', () => {
    const { page, widget } = fixture(), noop = successful([]);
    expect(() => applySelectionAuthorEffects(page, 'absent', widget.id, noop)).toThrow(/view/i);
    expect(() => applySelectionAuthorEffects(page, 'phone', 'absent', noop)).toThrow(/widget|target/i);
    delete widget.selectionText;
    expect(() => applySelectionAuthorEffects(page, null, widget.id, noop)).toThrow(/selectionText/i);
    widget.selectionText = { autoFitWidth: false, autoFitHeight: false, alignRight: false };
    widget.type = 'box';
    expect(() => applySelectionAuthorEffects(page, null, widget.id, noop)).toThrow(/checkbox|radio|Selection/i);
  });

  it('requires shared-page projection even for a Base edit', () => {
    const { page, widget } = fixture();
    page.adaptiveViewSetId = 'shared'; page.adaptiveViews = [];
    delete page.adaptiveSelection; delete page.adaptiveBaseSize;
    const before = structuredClone(page);
    expect(() => applySelectionAuthorEffects(page, null, widget.id, actualSize())).toThrow(/Resolve.*shared adaptive page/);
    expect(page).toEqual(before);
  });

  it('rejects an otherwise valid member write when its derived Layer frame cannot be saved', () => {
    const { page, widget } = fixture(), other = createWidget('box', 10_000, 30);
    page.widgets = [createLayer([widget, other])];
    const before = structuredClone(page);
    expect(() => applySelectionAuthorEffects(page, null, widget.id, successful([
      { name: 'fit.flag', axis: 'width', value: true },
      { name: 'style.Location', x: -100_000, y: 30, allViews: false },
    ]))).toThrow(/Layer.width/);
    expect(page).toEqual(before);
  });
});
