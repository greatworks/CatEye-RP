import { describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import type { Action, AdaptiveViewSet, Document, Interaction } from '../src/model/types';

function fixture() {
  const doc = createDocument(), p = doc.pages[0], q = createPage('Other'), w = createWidget('box');
  p.widgets = [w]; doc.pages.push(q);
  const set: AdaptiveViewSet = { id: 'shared-set', name: 'Devices', baseSize: { width: 0, height: 0 }, views: [
    { id: 'phone', name: 'Phone', width: 390, height: 0 }, { id: 'tall', name: 'Tall', width: 390, height: 800, baseViewId: 'phone' },
  ] };
  doc.adaptiveViewSets = [set];
  for (const page of doc.pages) { page.adaptiveViewSetId = set.id; page.adaptiveViews = []; delete page.adaptiveSelection; delete page.adaptiveBaseSize; }
  p.adaptiveOverrides = { phone: { [w.id]: { x: 10, stateStyles: { selected: { fill: '#ff0000' }, focused: {} } } }, tall: { [w.id]: { stateStyles: {} } } };
  return { doc, p, q, w, set };
}
function read(doc: Document) { return parseDocument(serializeDocument(doc)); }
function interaction(action: Partial<Action> = {}): Interaction { return { id: 'event', name: 'View changed', event: 'adaptiveViewChange', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'switch', type: 'setAdaptiveView', adaptiveView: { kind: 'view', viewId: 'phone' }, ...action }] }; }

describe('adaptive behavior persistence', () => {
  it('round trips one shared definition and independent page declarations without materializing view copies', () => {
    const { doc, q } = fixture(); q.widgets = [createWidget('box')];
    q.adaptiveOverrides = { phone: { [q.widgets[0].id]: { y: 45 } } };
    expect(read(doc)).toEqual(doc); expect(read(doc).pages.every(p => p.adaptiveViews.length === 0)).toBe(true);
  });
  it('retains inactive declarations so switching back to an unmatched view can recover them', () => {
    const { doc, p, w } = fixture(); p.adaptiveOverrides!['old-view'] = { [w.id]: { hidden: true } };
    expect(read(doc)).toEqual(doc);
  });
  it('keeps old page-owned documents and state maps readable', () => {
    const doc = createDocument(), w = createWidget('box'); doc.pages[0].widgets = [w];
    doc.pages[0].adaptiveViews = [{ id: 'local', name: 'Local', width: 0, overrides: { [w.id]: { stateStyles: {} } } }];
    expect(read(doc)).toEqual(doc); expect(read(doc)).not.toHaveProperty('adaptiveViewSets');
  });
  it.each(['auto', 'base', 'view'] as const)('round trips structured %s targets and page event', kind => {
    const { doc, p } = fixture(); p.interactions = [interaction({ adaptiveView: kind === 'view' ? { kind, viewId: 'unavailable-id' } : { kind } })];
    expect(read(doc)).toEqual(doc);
  });
  it.each([
    ['missing set', ({p}: ReturnType<typeof fixture>) => { p.adaptiveViewSetId = 'absent'; }],
    ['dual view storage', ({p}: ReturnType<typeof fixture>) => { p.adaptiveViews = [{ id: 'local', name: 'Local', width: 1, overrides: {} }]; }],
    ['conflicting Base metadata', ({p}: ReturnType<typeof fixture>) => { p.adaptiveBaseSize = { width: 500, height: 0 }; }],
    ['conflicting selection mode', ({p}: ReturnType<typeof fixture>) => { p.adaptiveSelection = 'native-size'; }],
    ['set cycle', ({set}: ReturnType<typeof fixture>) => { set.views[0].baseViewId = 'tall'; }],
    ['missing parent', ({set}: ReturnType<typeof fixture>) => { set.views[0].baseViewId = 'missing'; }],
    ['negative size', ({set}: ReturnType<typeof fixture>) => { set.views[0].width = -1; }],
    ['duplicate definition id', ({set}: ReturnType<typeof fixture>) => { set.views[1].id = 'phone'; }],
    ['unknown widget', ({p}: ReturnType<typeof fixture>) => { p.adaptiveOverrides!.phone.unknown = { x: 1 }; }],
    ['another page widget', ({p,q}: ReturnType<typeof fixture>) => { q.widgets = [createWidget('box')]; p.adaptiveOverrides!.phone[q.widgets[0].id] = { x: 1 }; }],
    ['null state map', ({p,w}: ReturnType<typeof fixture>) => { p.adaptiveOverrides!.phone[w.id].stateStyles = null as never; }],
    ['null state patch', ({p,w}: ReturnType<typeof fixture>) => { p.adaptiveOverrides!.phone[w.id].stateStyles = { selected: null } as never; }],
    ['normal synthetic key', ({p,w}: ReturnType<typeof fixture>) => { p.adaptiveOverrides!.phone[w.id].stateStyles = { normal: {} } as never; }],
    ['unsafe state style property', ({p,w}: ReturnType<typeof fixture>) => { p.adaptiveOverrides!.phone[w.id].stateStyles = { selected: { css: 'bad' } } as never; }],
  ])('rejects %s', (_name, change) => { const f = fixture(); change(f); expect(() => read(f.doc)).toThrow(); });
  it.each([
    { adaptiveView: undefined }, { adaptiveView: { kind: 'view' } }, { adaptiveView: { kind: 'base', viewId: 'phone' } },
    { adaptiveView: { kind: 'bad' } }, { value: 'phone' }, { targetId: 'phone' }, { type: 'show', adaptiveView: { kind: 'auto' } },
  ])('rejects malformed or cross-action adaptive payload %j', patch => {
    const { doc, p } = fixture(); p.interactions = [interaction(patch as Partial<Action>)]; expect(() => read(doc)).toThrow();
  });
  it('restricts adaptive changed events to pages', () => {
    const { doc, w } = fixture(); w.interactions = [interaction()]; expect(() => read(doc)).toThrow(/page/i);
  });
  it('rejects non-shared composite overrides in inactive view maps too', () => {
    const { doc, p } = fixture(); const table = createWidget('table'); p.widgets.push(table);
    p.adaptiveOverrides!['inactive'] = { [table.id]: { stateStyles: {} } };
    expect(() => read(doc)).toThrow(/shared/i);
  });
});
