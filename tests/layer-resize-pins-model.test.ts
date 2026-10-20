import { describe, expect, it } from 'vitest';
import * as documents from '../src/model/document';
import { applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { commitAdaptivePage, resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import { resolveResizePins } from '../src/model/resize-pins';
import type { Document, Page, Widget, WidgetStyle } from '../src/model/types';

const fields = ['pinHorizontal', 'pinVertical', 'fixedWidth', 'fixedHeight'] as const;
const pins = { pinHorizontal: 'right', pinVertical: 'bottom', fixedWidth: true, fixedHeight: true } as const;
const defaults = { pinHorizontal: 'none', pinVertical: 'none', fixedWidth: false, fixedHeight: false } as const;
const patchAuthor = documents.parseAuthorStylePatch;
function fixture() {
  const doc = documents.createDocument(), leaf = documents.createWidget('box', 80, 60);
  leaf.id = 'pin-leaf';
  Object.assign(leaf.style, pins);
  const inner = documents.createLayer([leaf], 'Inner');
  const outer = documents.createLayer([inner], 'Outer');
  doc.pages[0].widgets = [outer];
  const page = doc.pages[0];
  page.adaptiveViews = [
    { id: 'parent-view', name: 'Parent', width: 800, overrides: { [leaf.id]: { style: { ...pins, fill: '#123456' } } } },
    { id: 'child-view', name: 'Child', width: 400, baseViewId: 'parent-view', overrides: { [leaf.id]: { style: { pinHorizontal: 'left', pinVertical: 'top', fixedWidth: true, fixedHeight: true, stroke: '#654321' } } } },
    { id: 'sibling-view', name: 'Sibling', width: 600, overrides: { [leaf.id]: { style: { ...pins, opacity: .5 } } } },
  ];
  page.adaptiveOverrides = { inactive: { [leaf.id]: { style: { ...pins, radius: 7 } } } };
  return { doc, page, leaf, outer, inner };
}
function normal(page: Page, view = 'child-view'): Widget {
  return documents.findWidget({ ...page, widgets: resolveAdaptiveWidgets(page, view) }, 'pin-leaf')!;
}
function edit(page: Page, value: Record<string, unknown>, view: string | null = 'child-view', allViews = false) {
  const shown = structuredClone(resolveAdaptiveWidgets(page, view));
  return applyAdaptiveWidgetEdits(page, view, documents.mapWidgets(shown, w =>
    w.id === 'pin-leaf' ? { ...w, style: { ...w.style, ...value } } : w), { allViews });
}
const roundTrip = (doc: Document) => documents.parseDocument(documents.serializeDocument(doc));

describe('native author pin schema boundaries', () => {
  it('resolves defaults without materializing declarations or applying widget capability policy', () => {
    const empty = {}, partial = { fixedWidth: true, pinVertical: 'center' as const };
    expect(resolveResizePins(empty)).toEqual(defaults);
    expect(resolveResizePins(partial)).toEqual({ ...defaults, fixedWidth: true, pinVertical: 'center' });
    expect(empty).toEqual({});
    expect(partial).toEqual({ fixedWidth: true, pinVertical: 'center' });
  });
  it('retains all four independent normal/named/adaptive fields and clone content without changing source geometry', () => {
    const { doc, page, leaf, outer } = fixture();
    doc.styles = [{ id: 'pins-style', name: 'Pins', style: { ...leaf.style } }];
    const read = roundTrip(doc);
    expect(read).toEqual(doc);
    expect(normal(read.pages[0]).style).toMatchObject({ pinHorizontal: 'left', pinVertical: 'top', fixedWidth: true, fixedHeight: true });
    const [copy] = documents.cloneWidgets([outer], 0);
    expect(copy.layer!.widgets[0].layer!.widgets[0].style).toEqual(leaf.style);
    expect(copy.layer!.widgets[0].layer!.widgets[0].id).not.toBe(leaf.id);
    expect(page.widgets[0]).toEqual(outer);
  });

  it('keeps legacy omission and explicit defaults distinct on save/reopen', () => {
    const doc = documents.createDocument();
    doc.pages[0].widgets = [documents.createWidget('box')];
    const before = documents.serializeDocument(doc), read = documents.parseDocument(before);
    for (const field of fields) expect(read.pages[0].widgets[0].style).not.toHaveProperty(field);
    expect(documents.serializeDocument(read)).toBe(before);
    Object.assign(doc.pages[0].widgets[0].style, defaults);
    expect(roundTrip(doc).pages[0].widgets[0].style).toMatchObject(defaults);
    expect(patchAuthor({})).toEqual({});
  });

  it.each([
    ['pinHorizontal', ['none', 'left', 'right', 'both', 'center']],
    ['pinVertical', ['none', 'top', 'bottom', 'both', 'center']],
    ['fixedWidth', [false, true]], ['fixedHeight', [false, true]],
  ] as const)('accepts the exact %s domain through the explicit author boundary', (key, values) => {
    for (const value of values) expect(patchAuthor({ [key]: value })).toEqual({ [key]: value });
  });

  it.each([
    ['pinHorizontal', 'top'], ['pinHorizontal', 5], ['pinHorizontal', 'Left'], ['pinHorizontal', null],
    ['pinVertical', 'left'], ['pinVertical', 10], ['pinVertical', {}],
    ['fixedWidth', 0], ['fixedWidth', 'false'], ['fixedHeight', 1], ['fixedHeight', null],
  ])('rejects invalid %s=%j atomically', (key, value) => {
    const { doc, leaf } = fixture();
    const target = documents.findWidget(doc.pages[0], leaf.id)!;
    Object.assign(target.style, { [key as string]: value });
    expect(() => roundTrip(doc)).toThrow();
    expect(() => patchAuthor({ [key as string]: value })).toThrow();
  });

  it.each(fields)('does not let %s into a visual patch, effect, hint, rich run, or action', key => {
    expect(() => documents.parseWidgetStylePatch({ [key]: pins[key] })).toThrow('unknown field');
    const carriers: ((widget: Widget, page: Page) => void)[] = [
      w => { w.selectedStyle = { [key]: pins[key] }; },
      w => { w.mouseOverStyle = { [key]: pins[key] }; },
      w => { w.focusedStyle = { [key]: pins[key] }; },
      w => { w.errorStyle = { [key]: pins[key] }; },
      w => { w.disabledStyle = { [key]: pins[key] }; },
      w => { w.type = 'input'; w.hintStyle = { [key]: pins[key] }; },
      w => { w.richText = { paragraphs: [{ runs: [{ text: w.text, style: { [key]: pins[key] } }] }] }; },
      w => { w.interactions = [{ id: documents.uid(), event: 'click', name: 'Unsupported author property', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: documents.uid(), type: 'setStyle', targetId: w.id, style: { [key]: pins[key] } }] }]; },
      (w, p) => { p.adaptiveViews[1].overrides[w.id].stateStyles = { selected: { [key]: pins[key] } }; },
    ];
    for (const carrier of carriers) {
      const { doc, leaf, page } = fixture();
      carrier(documents.findWidget(page, leaf.id)!, page);
      expect(() => roundTrip(doc)).toThrow('unknown field');
    }
  });

  it('keeps unknown author keys and independent Layer geometry declarations rejected', () => {
    expect(() => patchAuthor({ pinHorizontal: 'left', pinHorizonal: 'right' })).toThrow('unknown field');
    const { doc, page, outer } = fixture();
    page.adaptiveViews[1].overrides[outer.id] = { x: 42, style: { fixedWidth: false } };
    expect(() => roundTrip(doc)).toThrow('derived from member');
  });
});

describe('independent adaptive pin declarations', () => {
  it.each(fields)('resets only %s in a nested member current view and preserves parent/sibling/inactive declarations', field => {
    const { doc, page, leaf } = fixture(), before = structuredClone(page);
    const changed = edit(page, { [field]: defaults[field] });
    expect(changed.widgets).toEqual(before.widgets);
    expect(changed.adaptiveViews[0]).toEqual(before.adaptiveViews[0]);
    expect(changed.adaptiveViews[2]).toEqual(before.adaptiveViews[2]);
    expect(changed.adaptiveOverrides).toEqual(before.adaptiveOverrides);
    expect(changed.adaptiveViews[1].overrides[leaf.id].style).toEqual({ ...before.adaptiveViews[1].overrides[leaf.id].style, [field]: defaults[field] });
    expect(normal(changed).style[field]).toBe(defaults[field]);
    doc.pages[0] = changed;
    expect(roundTrip(doc)).toEqual(doc);
    expect(page).toEqual(before);
  });

  it('retains explicit local false/none declarations when an ancestor later matches and unrelated properties change', () => {
    const { page, leaf } = fixture();
    page.adaptiveViews[0].overrides[leaf.id].style = { ...defaults, fill: '#123456' };
    page.adaptiveViews[1].overrides[leaf.id].style = { ...defaults, stroke: '#654321' };
    const changed = edit(page, { color: '#abcdef' });
    expect(changed.adaptiveViews[1].overrides[leaf.id].style).toMatchObject({ ...defaults, color: '#abcdef' });
    expect(changed.widgets).toEqual(page.widgets);
  });

  it.each(fields)('resetting %s by omission persists a real default override over a nondefault ancestor', field => {
    const { page, leaf } = fixture();
    const changed = edit(page, { [field]: undefined });
    expect(changed.adaptiveViews[1].overrides[leaf.id].style?.[field]).toBe(defaults[field]);
    expect(normal(changed).style[field]).toBe(defaults[field]);
    expect(changed.adaptiveViews[0]).toEqual(page.adaptiveViews[0]);
    expect(changed.adaptiveOverrides).toEqual(page.adaptiveOverrides);
  });

  it.each(fields)('omitting an already-effective default %s is a no-op rather than removing an existing declaration', field => {
    const { page, leaf } = fixture();
    page.adaptiveViews[0].overrides[leaf.id].style = { ...defaults, fill: '#123456' };
    page.adaptiveViews[1].overrides[leaf.id].style = { ...defaults, stroke: '#654321' };
    expect(edit(page, { [field]: undefined }).adaptiveViews[1]).toEqual(page.adaptiveViews[1]);
    expect(edit(page, { [field]: undefined }, 'child-view', true)).toBe(page);
  });

  it.each(fields)('Affect all views promotes only changed %s and clears that key from active and inactive maps', field => {
    const { doc, page, leaf } = fixture(), before = structuredClone(page);
    const changed = edit(page, { [field]: defaults[field] }, 'child-view', true);
    expect(documents.findWidget(changed, leaf.id)!.style).toEqual({ ...leaf.style, [field]: defaults[field] });
    const maps = [...changed.adaptiveViews.map(v => v.overrides), changed.adaptiveOverrides!.inactive];
    const oldMaps = [...before.adaptiveViews.map(v => v.overrides), before.adaptiveOverrides!.inactive];
    maps.forEach((map, index) => {
      const expected = { ...oldMaps[index][leaf.id].style };
      delete expected[field];
      expect(map[leaf.id].style).toEqual(expected);
    });
    for (const view of ['parent-view', 'child-view', 'sibling-view']) expect(normal(changed, view).style[field]).toBe(defaults[field]);
    expect(changed.widgets[0]).toMatchObject({ x: before.widgets[0].x, y: before.widgets[0].y, width: before.widgets[0].width, height: before.widgets[0].height });
    doc.pages[0] = changed;
    expect(roundTrip(doc)).toEqual(doc);
    expect(page).toEqual(before);
  });

  it.each(fields)('same effective %s is a true all-views no-op and does not clear declarations', field => {
    const { page } = fixture();
    const changed = edit(page, { [field]: normal(page).style[field] }, 'child-view', true);
    expect(changed).toBe(page);
  });

  it('Base edits leave local declarations and absent fields untouched', () => {
    const { page, leaf } = fixture();
    const changed = edit(page, { fixedWidth: false }, null);
    expect(documents.findWidget(changed, leaf.id)!.style).toEqual({ ...leaf.style, fixedWidth: false });
    expect(changed.adaptiveViews).toEqual(page.adaptiveViews);
    expect(changed.adaptiveOverrides).toEqual(page.adaptiveOverrides);
  });

  it('commits shared-set projected declarations back to this page without altering set definitions or another page', () => {
    const { doc, page, leaf } = fixture();
    const definitions = page.adaptiveViews.map(({ overrides: _overrides, ...definition }) => definition);
    doc.adaptiveViewSets = [{ id: 'pin-set', name: 'Pins set', baseSize: { width: 1200, height: 0 }, views: definitions }];
    page.adaptiveViewSetId = 'pin-set';
    page.adaptiveOverrides = { ...page.adaptiveOverrides, ...Object.fromEntries(page.adaptiveViews.map(view => [view.id, view.overrides])) };
    page.adaptiveViews = [];
    delete page.adaptiveSelection; delete page.adaptiveBaseSize;
    const other = documents.createPage('Untouched');
    other.adaptiveViewSetId = 'pin-set'; other.adaptiveViews = [];
    delete other.adaptiveSelection; delete other.adaptiveBaseSize;
    doc.pages.push(other);
    const before = structuredClone(doc), projected = resolveAdaptivePage(doc, page);
    const committed = commitAdaptivePage(doc, edit(projected, { fixedHeight: false }, 'child-view', true));
    expect(committed.pages[1]).toEqual(before.pages[1]);
    expect(committed.adaptiveViewSets).toEqual(before.adaptiveViewSets);
    for (const map of Object.values(committed.pages[0].adaptiveOverrides!)) expect(map[leaf.id]?.style).not.toHaveProperty('fixedHeight');
    expect(documents.findWidget(committed.pages[0], leaf.id)!.style.fixedHeight).toBe(false);
    expect(roundTrip(committed)).toEqual(committed);
    expect(doc).toEqual(before);
  });
});
