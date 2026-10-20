import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, resolveAdaptiveOverride, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { assignAdaptiveViewSet, resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import type { AdaptiveWidgetOverride, Page } from '../src/model/types';

function fixture() {
  const doc = createDocument(), page = createPage('Padding'), box = createWidget('box');
  box.style.textPadding = [1, 2, 3, 4]; page.widgets = [box]; doc.pages = [page];
  page.adaptiveViews = [
    { id: 'pad-parent', name: 'Tablet', width: 768, overrides: { [box.id]: { style: { textPadding: [10, 20, 30, 40], fill: '#0000ff' } } } },
    { id: 'pad-child', name: 'Phone', width: 390, baseViewId: 'pad-parent', overrides: { [box.id]: { style: { textPadding: [11, 21, 31, 41], color: '#123456' } } } },
    { id: 'pad-sibling', name: 'Wide', width: 1024, overrides: { [box.id]: { style: { textPadding: [12, 22, 32, 42] } } } },
  ];
  page.adaptiveOverrides = { 'pad-inactive': { [box.id]: { x: 77, style: { textPadding: [13, 23, 33, 43] }, stateStyles: {} } } };
  return { doc, page, box };
}
const allViews: { allViews: boolean; placementAllViews?: boolean } = { allViews: true };
function sidePatch(patch: AdaptiveWidgetOverride, value: unknown) { return Object.assign(patch, { textPaddingSides: value }); }
function editTop(page: Page, top: number) {
  const widgets = structuredClone(resolveAdaptiveWidgets(page, 'pad-child'));
  widgets[0].style.textPadding = [top, ...widgets[0].style.textPadding!.slice(1)] as [number, number, number, number];
  return widgets;
}

describe('independent adaptive padding declarations', () => {
  it('strictly round-trips sparse sides, including inactive and empty maps, without adding widget metadata', () => {
    const { doc, page, box } = fixture();
    sidePatch(page.adaptiveViews[1].overrides[box.id], { top: 0, right: 1000 });
    sidePatch(page.adaptiveOverrides!['pad-inactive'][box.id], {});
    const read = parseDocument(serializeDocument(doc));
    expect(read).toEqual(doc); expect(read.pages[0].widgets[0]).not.toHaveProperty('textPaddingSides');
  });

  it.each([null, [], { diagonal: 2 }, { top: '2' }, { left: -1 }, { right: 1001 }, { bottom: Number.POSITIVE_INFINITY }])('rejects invalid sparse padding %j', value => {
    const { doc, page, box } = fixture(); sidePatch(page.adaptiveViews[0].overrides[box.id], value);
    expect(() => parseDocument(serializeDocument(doc))).toThrow(/textPaddingSides/);
  });

  it('layers each local legacy tuple first and its sparse sides second, returning only a renderable full tuple', () => {
    const { page, box } = fixture();
    sidePatch(page.adaptiveViews[0].overrides[box.id], { left: 45 });
    sidePatch(page.adaptiveViews[1].overrides[box.id], { top: 19 });
    expect(resolveAdaptiveOverride(page, 'pad-child', box.id)).toEqual({ style: { fill: '#0000ff', color: '#123456', textPadding: [19, 21, 31, 41] } });
    const visible = resolveAdaptiveWidgets(page, 'pad-child')[0];
    expect(visible.style.textPadding).toEqual([19, 21, 31, 41]); expect(visible).not.toHaveProperty('textPaddingSides');
    delete page.adaptiveViews[1].overrides[box.id].style!.textPadding;
    expect(resolveAdaptiveWidgets(page, 'pad-child')[0].style.textPadding).toEqual([19, 20, 30, 45]);
  });

  it('uses the existing type-specific padding fallback only when a sparse declaration needs it', () => {
    const { page, box } = fixture(); delete box.style.textPadding;
    page.adaptiveViews[0].overrides = {};
    page.adaptiveViews[1].overrides[box.id] = sidePatch({}, { left: 0 });
    expect(resolveAdaptiveWidgets(page, 'pad-child')[0].style.textPadding).toEqual([5, 5, 5, 0]);
    const input = createWidget('input'); delete input.style.textPadding; page.widgets = [input];
    page.adaptiveViews[1].overrides = { [input.id]: sidePatch({}, { top: 0 }) };
    expect(resolveAdaptiveWidgets(page, 'pad-child')[0].style.textPadding).toEqual([0, 7, 7, 7]);
  });

  it('a one-side All Views edit clears just that side in all maps, converting old tuples without fixing its future inherited value', () => {
    const { doc, page, box } = fixture();
    const result = applyAdaptiveWidgetEdits(page, 'pad-child', editTop(page, 50), allViews);
    expect(result.widgets[0].style.textPadding).toEqual([50, 2, 3, 4]);
    expect(result.adaptiveViews[0].overrides[box.id]).toEqual({ style: { fill: '#0000ff' }, textPaddingSides: { right: 20, bottom: 30, left: 40 } });
    expect(result.adaptiveViews[1].overrides[box.id]).toEqual({ style: { color: '#123456' }, textPaddingSides: { right: 21, bottom: 31, left: 41 } });
    expect(result.adaptiveViews[2].overrides[box.id]).toEqual({ textPaddingSides: { right: 22, bottom: 32, left: 42 } });
    expect(result.adaptiveOverrides!['pad-inactive'][box.id]).toEqual({ x: 77, textPaddingSides: { right: 23, bottom: 33, left: 43 }, stateStyles: {} });
    doc.pages = [result]; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    result.widgets[0].style.textPadding = [75, 99, 3, 4];
    expect(resolveAdaptiveWidgets(result, 'pad-child')[0].style.textPadding).toEqual([75, 21, 31, 41]);
  });

  it('new current-view edits save only changed sides and preserve other explicit sides when returning one to its parent', () => {
    const { page, box } = fixture();
    page.adaptiveViews[1].overrides[box.id] = sidePatch({ style: { color: '#123456' } }, { right: 21 });
    const changed = applyAdaptiveWidgetEdits(page, 'pad-child', editTop(page, 50));
    expect(changed.adaptiveViews[1].overrides[box.id]).toEqual({ style: { color: '#123456' }, textPaddingSides: { right: 21, top: 50 } });
    const reset = applyAdaptiveWidgetEdits(changed, 'pad-child', editTop(changed, 10));
    expect(reset.adaptiveViews[1].overrides[box.id]).toEqual({ style: { color: '#123456' }, textPaddingSides: { right: 21 } });
    expect(reset.widgets[0].style.textPadding).toEqual([1, 2, 3, 4]);
  });

  it('keeps an untouched legacy tuple byte-for-byte during shared-content edits', () => {
    const { page, box } = fixture(), before = JSON.stringify(page.adaptiveViews);
    const visible = structuredClone(resolveAdaptiveWidgets(page, 'pad-child')); visible[0].notes = 'Note only';
    const changed = applyAdaptiveWidgetEdits(page, 'pad-child', visible, allViews);
    expect(JSON.stringify(changed.adaptiveViews)).toBe(before);
    expect(changed.widgets[0].style).toEqual(box.style);
  });

  it.each([false, true])('shared-set reassignment preserves side precedence when target has a full tuple: %s', targetTuple => {
    const { doc, page, box } = fixture();
    page.adaptiveViews = []; delete page.adaptiveSelection; delete page.adaptiveBaseSize; page.adaptiveViewSetId = 'old-set';
    doc.adaptiveViewSets = [
      { id: 'old-set', name: 'Old', baseSize: { width: 1200, height: 0 }, views: [{ id: 'old-view', name: 'Phone', width: 390 }] },
      { id: 'new-set', name: 'New', baseSize: { width: 1200, height: 0 }, views: [{ id: 'new-view', name: 'Phone', width: 390 }] },
    ];
    page.adaptiveOverrides = {
      'old-view': { [box.id]: sidePatch({ style: { textPadding: [10, 20, 30, 40] } }, { right: 99, bottom: 77 }) },
      'new-view': { [box.id]: sidePatch(targetTuple ? { style: { textPadding: [2, 3, 4, 5] } } : {}, { left: 50 }) },
    };
    const next = assignAdaptiveViewSet(doc, page.id, 'new-set'), projected = resolveAdaptivePage(next, next.pages[0]);
    expect(resolveAdaptiveWidgets(projected, 'new-view')[0].style.textPadding).toEqual(targetTuple ? [2, 3, 4, 50] : [10, 99, 77, 50]);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});
