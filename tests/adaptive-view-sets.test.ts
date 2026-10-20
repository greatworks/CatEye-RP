import { describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import { applyAdaptiveWidgetEdits, deleteAdaptiveView, resolveAdaptiveWidgets, updateAdaptiveView } from '../src/model/adaptive';
import { assignAdaptiveViewSet, commitAdaptivePage, convertPageAdaptiveViewsToSet, createAdaptiveViewSet, removeAdaptiveViewSet, resolveAdaptivePage, updateAdaptiveViewSet } from '../src/model/adaptive-view-sets';
import type { AdaptiveViewSet, Document, GradientFill } from '../src/model/types';

const gradient: GradientFill = { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] };
function fixture() {
  const doc = createDocument(), first = createPage('First'), second = createPage('Second'), box = createWidget('box'), other = createWidget('box');
  first.widgets = [box]; second.widgets = [other]; doc.pages = [first, second];
  const from: AdaptiveViewSet = { id: 'set-from', name: 'Original', baseSize: { width: 1280, height: 720 }, views: [
    { id: 'from-tablet', name: 'Tablet', width: 768, height: 0 },
    { id: 'from-phone', name: 'Phone', width: 390, height: 0, baseViewId: 'from-tablet' },
  ] };
  const to: AdaptiveViewSet = { id: 'set-to', name: 'Replacement', baseSize: { width: 1200, height: 0 }, views: [
    { id: 'to-tablet', name: 'Tablet', width: 800, height: 0 },
    { id: 'to-phone', name: 'Phone', width: 400, height: 0, baseViewId: 'to-tablet' },
  ] };
  doc.adaptiveViewSets = [from, to];
  return { doc, first, second, box, other, from, to };
}
function assigned() {
  const f = fixture();
  f.doc = assignAdaptiveViewSet(assignAdaptiveViewSet(f.doc, f.first.id, f.from.id), f.second.id, f.from.id);
  return { ...f, first: f.doc.pages[0], second: f.doc.pages[1] };
}
function roundTrip(doc: Document) { return parseDocument(serializeDocument(doc)); }

describe('shared adaptive view definitions and page projection', () => {
  it('creates a Base-only set without assigning or changing a page', () => {
    const { doc } = fixture(), before = structuredClone(doc), result = createAdaptiveViewSet(doc, '  New set  ');
    expect(result.adaptiveViewSets!.at(-1)).toMatchObject({ name: 'New set', baseSize: { width: 0, height: 0 }, views: [] });
    expect(result.pages).toEqual(doc.pages); expect(doc).toEqual(before); expect(roundTrip(result)).toEqual(result);
  });
  it('projects the same definitions but independent local declarations onto two pages', () => {
    const { doc, first, second, box, other, from } = assigned();
    first.adaptiveOverrides = { 'from-phone': { [box.id]: { x: 10 } } };
    second.adaptiveOverrides = { 'from-phone': { [other.id]: { x: 20 } } };
    const a = resolveAdaptivePage(doc, first), b = resolveAdaptivePage(doc, second);
    expect(a).toMatchObject({ adaptiveSelection: 'native-size', adaptiveBaseSize: from.baseSize });
    expect(a.adaptiveViews.map(v => v.id)).toEqual(b.adaptiveViews.map(v => v.id));
    expect(resolveAdaptiveWidgets(a, 'from-phone')[0].x).toBe(10);
    expect(resolveAdaptiveWidgets(b, 'from-phone')[0].x).toBe(20);
    expect(first.adaptiveViews).toEqual([]); expect(first).not.toHaveProperty('adaptiveSelection'); expect(first).not.toHaveProperty('adaptiveBaseSize');
    expect(roundTrip(doc)).toEqual(doc);
  });
  it('returns an unbound legacy page unchanged and does not silently convert selection', () => {
    const { doc, first } = fixture(); delete first.adaptiveSelection; delete first.adaptiveBaseSize;
    expect(resolveAdaptivePage(doc, first)).toBe(first);
    expect(() => convertPageAdaptiveViewsToSet(doc, first.id, 'Legacy')).toThrow(/native-size|view sizes/i);
    expect(first).not.toHaveProperty('adaptiveSelection');
  });
  it('converts explicitly native local views while preserving identities, parents and overrides', () => {
    const { doc, first, box } = fixture();
    first.adaptiveBaseSize = { width: 1024, height: 600 };
    first.adaptiveViews = [{ id: 'local', name: 'Narrow', width: 0, height: 500, overrides: { [box.id]: { hidden: true } } }];
    first.adaptiveOverrides = { inactive: { [box.id]: { x: 9 } } };
    const result = convertPageAdaptiveViewsToSet(doc, first.id, 'Converted'), set = result.adaptiveViewSets!.at(-1)!;
    expect(set).toMatchObject({ baseSize: first.adaptiveBaseSize, views: [{ id: 'local', name: 'Narrow', width: 0, height: 500 }] });
    expect(set.views[0]).not.toHaveProperty('overrides');
    expect(result.pages[0].adaptiveOverrides).toEqual({ inactive: { [box.id]: { x: 9 } }, local: { [box.id]: { hidden: true } } });
    expect(result.pages[0].adaptiveViewSetId).toBe(set.id); expect(result.pages[0].widgets).toEqual(first.widgets);
    expect(roundTrip(result)).toEqual(result);
  });
  it('requires explicit conversion before replacing a local named-view collection', () => {
    const { doc, first, from } = fixture(); first.adaptiveViews = [{ id: 'local', name: 'Local', width: 300, overrides: {} }];
    expect(() => assignAdaptiveViewSet(doc, first.id, from.id)).toThrow(/convert/i);
  });
  it('detaches into Base-only native mode retaining the prior Base size and inactive maps', () => {
    const { doc, first, box, from } = assigned(); first.adaptiveOverrides = { 'from-phone': { [box.id]: { width: 12 } } };
    const result = assignAdaptiveViewSet(doc, first.id, null).pages[0];
    expect(result).not.toHaveProperty('adaptiveViewSetId');
    expect(result).toMatchObject({ adaptiveSelection: 'native-size', adaptiveBaseSize: from.baseSize, adaptiveViews: [], adaptiveOverrides: first.adaptiveOverrides });
    expect(result.widgets).toEqual(first.widgets);
  });
});

describe('native evidenced ID/name reassignment', () => {
  it('matches case-sensitive names, migrates matching maps, and retains unmatched inactive maps', () => {
    const { doc, first, box, to } = assigned();
    first.adaptiveOverrides = { 'from-phone': { [box.id]: { x: 12 } }, unmatched: { [box.id]: { y: 8 } } };
    const result = assignAdaptiveViewSet(doc, first.id, to.id);
    expect(result.pages[0].adaptiveOverrides).toEqual({ 'to-phone': { [box.id]: { x: 12 } }, unmatched: { [box.id]: { y: 8 } } });
    expect(result.pages[0].widgets).toEqual(first.widgets); expect(roundTrip(result)).toEqual(result);
  });
  it('uses first exact name and never dimensions or case-insensitive matching', () => {
    const { doc, first, box, to } = assigned();
    to.views = [{ id: 'case', name: 'phone', width: 390 }, { id: 'first', name: 'Phone', width: 999 }, { id: 'second', name: 'Phone', width: 390 }];
    first.adaptiveOverrides = { 'from-phone': { [box.id]: { x: 7 } }, 'from-tablet': { [box.id]: { y: 8 } } };
    expect(assignAdaptiveViewSet(doc, first.id, to.id).pages[0].adaptiveOverrides).toEqual({ first: { [box.id]: { x: 7 } }, 'from-tablet': { [box.id]: { y: 8 } } });
  });
  it('same-set assignment is a no-op, preserving explicit equal-value local declarations', () => {
    const { doc, first, box, from } = assigned(); first.adaptiveOverrides = { 'from-phone': { [box.id]: { x: box.x, hidden: false } } };
    expect(assignAdaptiveViewSet(doc, first.id, from.id)).toBe(doc);
  });
  it('retains target local properties, while recovering nonconflicting source properties', () => {
    const { doc, first, box, to } = assigned();
    first.adaptiveOverrides = { 'from-phone': { [box.id]: { x: 2, y: 3, hidden: true, style: { color: '#ff0000', fontSize: 28 } } }, 'to-phone': { [box.id]: { x: 8, hidden: false, style: { color: '#0000ff' } } } };
    expect(assignAdaptiveViewSet(doc, first.id, to.id).pages[0].adaptiveOverrides!['to-phone'][box.id]).toEqual({ x: 8, y: 3, hidden: false, style: { color: '#0000ff', fontSize: 28 } });
  });
  it('keeps state maps and line ends atomic and applies solid/radius/border resets', () => {
    const { doc, first, box, to } = assigned();
    first.adaptiveOverrides = {
      'from-phone': { [box.id]: { style: { fillGradient: gradient, strokeGradient: gradient, cornerRadii: [2, 3, 4, 5], borderWidths: [2, 3, 4, 5], lineEnds: { start: 'filled-triangle', end: 'none' } }, stateStyles: { mouseOver: { fill: '#ff0000' } } } },
      'to-phone': { [box.id]: { style: { fill: '#ffffff', stroke: '#000000', radius: 0, strokeWidth: 1, lineEnds: { start: 'none', end: 'none' } }, stateStyles: {} } },
    };
    const patch = assignAdaptiveViewSet(doc, first.id, to.id).pages[0].adaptiveOverrides!['to-phone'][box.id];
    expect(patch).toEqual({ style: { fill: '#ffffff', stroke: '#000000', radius: 0, strokeWidth: 1, lineEnds: { start: 'none', end: 'none' } }, stateStyles: {} });
  });
  it('does not share mutable nested patches or modify the source document during migration', () => {
    const { doc, first, box, to } = assigned(); first.adaptiveOverrides = { 'from-phone': { [box.id]: { style: { fillGradient: gradient } } } };
    const before = structuredClone(doc), result = assignAdaptiveViewSet(doc, first.id, to.id);
    result.pages[0].adaptiveOverrides!['to-phone'][box.id].style!.fillGradient!.stops[0].color = '#ffffff';
    expect(doc).toEqual(before);
  });
});

describe('effective-page commit and shared lifecycle', () => {
  it('commits shared metadata globally but edits declarations only on the current page', () => {
    const { doc, first, second, box, other } = assigned(); second.adaptiveOverrides = { 'from-phone': { [other.id]: { x: 22 } } };
    let effective = updateAdaptiveView(resolveAdaptivePage(doc, first), 'from-phone', { width: 420, name: 'Handset' });
    const visible = structuredClone(resolveAdaptiveWidgets(effective, 'from-phone')); visible[0].x = 18; visible[0].notes = 'Shared content edit';
    effective = applyAdaptiveWidgetEdits(effective, 'from-phone', visible);
    const result = commitAdaptivePage(doc, effective);
    expect(resolveAdaptivePage(result, result.pages[1]).adaptiveViews[1]).toMatchObject({ width: 420, name: 'Handset', overrides: { [other.id]: { x: 22 } } });
    expect(result.pages[0].adaptiveOverrides!['from-phone'][box.id]).toEqual({ x: 18 });
    expect(result.pages[0].widgets[0]).toMatchObject({ x: box.x, notes: 'Shared content edit' });
    expect(roundTrip(result)).toEqual(result);
  });
  it('deleting a shared view cleans maps on every bound page and preserves unrelated inactive data', () => {
    const { doc, first, second, box, other, from } = assigned();
    first.adaptiveOverrides = { 'from-tablet': { [box.id]: { x: 7 } }, inactive: { [box.id]: { x: 8 } } };
    second.adaptiveOverrides = { 'from-tablet': { [other.id]: { hidden: true } }, 'from-phone': { [other.id]: { y: 9 } }, inactive: { [other.id]: { y: 10 } } };
    const result = commitAdaptivePage(doc, deleteAdaptiveView(resolveAdaptivePage(doc, first), 'from-tablet'));
    expect(result.adaptiveViewSets!.find(v => v.id === from.id)!.views[0]).not.toHaveProperty('baseViewId');
    for (const p of result.pages) { expect(p.adaptiveOverrides).not.toHaveProperty('from-tablet'); expect(p.adaptiveOverrides).toHaveProperty('inactive'); }
    expect(result.pages[1].adaptiveOverrides!['from-phone']).toEqual({ [other.id]: { y: 9 } });
    expect(roundTrip(result)).toEqual(result);
  });
  it('prunes deleted nested widgets from all active and inactive maps on commit', () => {
    const { doc, first, box } = assigned(), panel = createWidget('panel'), child = createWidget('text'); panel.states![0].widgets = [child]; first.widgets.push(panel);
    first.adaptiveOverrides = Object.fromEntries(['from-phone', 'inactive'].map(id => [id, { [box.id]: { x: 7 }, [child.id]: { x: 8 } }]));
    const effective = resolveAdaptivePage(doc, first); effective.widgets = [box];
    const result = commitAdaptivePage(doc, effective);
    expect(Object.values(result.pages[0].adaptiveOverrides!).every(map => !Object.hasOwn(map, child.id))).toBe(true);
    expect(result.pages[0].adaptiveOverrides!['from-phone']).toEqual({ [box.id]: { x: 7 } });
    expect(result.pages[0].adaptiveOverrides!.inactive).toEqual({ [box.id]: { x: 7 } });
    expect(roundTrip(result)).toEqual(result);
  });
  it('also prunes inactive maps when an unbound local page is edited', () => {
    const { doc, first, box } = fixture(); first.adaptiveOverrides = { inactive: { [box.id]: { x: 7 } } };
    const result = commitAdaptivePage(doc, { ...first, widgets: [] });
    expect(result.pages[0].adaptiveOverrides).toEqual({ inactive: {} }); expect(roundTrip(result)).toEqual(result);
  });
  it('rejects silent set reassignment via a stale effective page', () => {
    const { doc, first, to } = assigned(), effective = resolveAdaptivePage(doc, first), reassigned = assignAdaptiveViewSet(doc, first.id, to.id);
    expect(() => commitAdaptivePage(reassigned, effective)).toThrow(/set|stale/i);
  });
  it('updates Base dimensions and title without touching page widgets or local styles', () => {
    const { doc, first, box, from } = assigned(); first.adaptiveOverrides = { inactive: { [box.id]: { x: 3 } } };
    const result = updateAdaptiveViewSet(doc, from.id, { name: 'Renamed', baseSize: { width: 0, height: 700 } });
    expect(result.pages).toEqual(doc.pages);
    expect(resolveAdaptivePage(result, result.pages[1]).adaptiveBaseSize).toEqual({ width: 0, height: 700 });
  });
  it('metadata-only commit preserves absent maps, explicit empty maps, empty state barriers and exact saved names', () => {
    const { doc, first, second, box, from } = assigned();
    from.views[0].name = '  Exact saved name  ';
    first.adaptiveOverrides = { 'from-phone': { [box.id]: { stateStyles: {} } } };
    second.adaptiveOverrides = { 'from-phone': {} };
    const before = structuredClone(doc);
    const effective = resolveAdaptivePage(doc, first); effective.adaptiveViews[0].width = 880;
    const result = commitAdaptivePage(doc, effective);
    expect(result.pages[0].adaptiveOverrides).toEqual(before.pages[0].adaptiveOverrides);
    expect(result.pages[1].adaptiveOverrides).toEqual(before.pages[1].adaptiveOverrides);
    expect(result.adaptiveViewSets![0].views[0].name).toBe('  Exact saved name  ');
  });
  it('does not create an empty maps object on a metadata-only commit to a page with no declarations', () => {
    const { doc, first } = assigned(); delete first.adaptiveOverrides;
    const effective = resolveAdaptivePage(doc, first); effective.adaptiveViews[0].width = 880;
    expect(commitAdaptivePage(doc, effective).pages[0]).not.toHaveProperty('adaptiveOverrides');
  });
  it.each([' ', '__proto__', 'has\nnewline', 'x'.repeat(257)])('rejects invalid view identifier %j', id => {
    const { doc, from } = assigned();
    expect(() => updateAdaptiveViewSet(doc, from.id, { views: [{ id, name: 'Valid', width: 0 }] })).toThrow(/identity/);
  });
  it('reparents surviving children when removing a definition through set update', () => {
    const { doc, from } = assigned();
    const result = updateAdaptiveViewSet(doc, from.id, { views: from.views.filter(v => v.id !== 'from-tablet') });
    expect(result.adaptiveViewSets![0].views[0]).not.toHaveProperty('baseViewId'); expect(roundTrip(result)).toEqual(result);
  });
  it('refuses deletion of a referenced set and removes only an unreferenced set', () => {
    const { doc, from, to } = assigned(); expect(() => removeAdaptiveViewSet(doc, from.id)).toThrow(/assign|reference|switch/i);
    const result = removeAdaptiveViewSet(doc, to.id); expect(result.adaptiveViewSets!.map(v => v.id)).toEqual([from.id]); expect(result.pages).toEqual(doc.pages);
  });
  it.each([-1, Infinity, NaN, 100_001])('rejects invalid dimensions %s without mutation', width => {
    const { doc, from } = assigned(), before = structuredClone(doc);
    expect(() => updateAdaptiveViewSet(doc, from.id, { baseSize: { width, height: 0 } })).toThrow(/between 0 and 100000/);
    expect(doc).toEqual(before);
  });
  it.each(['cycle', 'missing', 'duplicate'])('rejects invalid %s definitions', kind => {
    const { doc, from } = assigned(), views = structuredClone(from.views);
    if (kind === 'cycle') views[0].baseViewId = views[1].id;
    else if (kind === 'missing') views[0].baseViewId = 'missing';
    else views.push({ ...views[0] });
    expect(() => updateAdaptiveViewSet(doc, from.id, { views })).toThrow(/cycle|exist|duplicate/i);
  });
});
