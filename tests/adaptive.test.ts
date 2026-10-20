import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, chooseAdaptiveView, clearAdaptiveOverrides, createAdaptiveView, deleteAdaptiveView, resolveAdaptiveWidgets, updateAdaptiveView } from '../src/model/adaptive';
import { createDocument, createPage, createWidget, findWidget, parseDocument, serializeDocument, uid, updateWidgetTree } from '../src/model/document';
import type { Page, Widget } from '../src/model/types';

function fixture() {
  let page = createPage('Responsive'); page.width = 1200;
  // This suite preserves the pre-hierarchy maximum-width document contract.
  delete page.adaptiveSelection; delete page.adaptiveBaseSize;
  const box = createWidget('box', 100, 80), text = createWidget('text', 140, 100);
  page.widgets = [box, text];
  page = createAdaptiveView(createAdaptiveView(page, 'Mobile', 390), 'Tablet', 768);
  const [mobile, tablet] = page.adaptiveViews;
  return { page, box, text, mobile, tablet };
}
function edited(widgets: Widget[], id: string, patch: Partial<Widget>): Widget[] { return updateWidgetTree(widgets, id, patch); }

describe('adaptive view selection and effective widgets', () => {
  it('selects the smallest containing max-width with exact boundaries and falls back to Base', () => {
    const { page, mobile, tablet } = fixture();
    expect(chooseAdaptiveView(page, 0)).toBe(mobile); expect(chooseAdaptiveView(page, 389)).toBe(mobile); expect(chooseAdaptiveView(page, 390)).toBe(mobile);
    expect(chooseAdaptiveView(page, 391)).toBe(tablet); expect(chooseAdaptiveView(page, 768)).toBe(tablet);
    expect(chooseAdaptiveView(page, 769)).toBeUndefined();
    expect(chooseAdaptiveView({ ...page, adaptiveViews: [tablet, mobile] }, 360)).toBe(mobile);
    expect(() => chooseAdaptiveView(page, Number.NaN)).toThrow('finite'); expect(() => chooseAdaptiveView(page, -1)).toThrow('nonnegative');
  });

  it('merges individual style properties and retains Base content and unoverridden geometry', () => {
    const { page, box, mobile } = fixture();
    mobile.overrides[box.id] = { x: 16, width: 340, hidden: true, style: { fill: '#ff0000', fontSize: 20 } };
    const resolved = resolveAdaptiveWidgets(page, mobile.id)[0];
    expect(resolved).toMatchObject({ id: box.id, type: box.type, x: 16, width: 340, y: box.y, height: box.height, hidden: true });
    expect(resolved.style).toEqual({ ...box.style, fill: '#ff0000', fontSize: 20 });
    expect(resolveAdaptiveWidgets(page, null)).toBe(page.widgets); expect(resolveAdaptiveWidgets(page, '')).toBe(page.widgets);
    expect(box.x).toBe(100); expect(box.hidden).toBe(false);
    expect(() => resolveAdaptiveWidgets(page, 'missing')).toThrow('does not exist');
  });

  it('applies nested panel/repeater overrides while keeping views independent', () => {
    const { page, mobile, tablet } = fixture(), panel = createWidget('panel'), repeater = createWidget('repeater');
    panel.states![0].widgets = [repeater]; page.widgets.push(panel);
    const child = repeater.repeater!.template[0]; mobile.overrides[child.id] = { width: 120, style: { color: '#00ff00' } };
    tablet.overrides[child.id] = { x: 30 };
    const phoneChild = findWidget({ widgets: resolveAdaptiveWidgets(page, mobile.id) }, child.id)!;
    const tabletChild = findWidget({ widgets: resolveAdaptiveWidgets(page, tablet.id) }, child.id)!;
    expect(phoneChild.width).toBe(120); expect(phoneChild.style.color).toBe('#00ff00');
    expect(tabletChild.x).toBe(30); expect(tabletChild.width).toBe(child.width); expect(tabletChild.style.color).toBe(child.style.color);
  });
});

describe('editing effective widgets', () => {
  it('saves layout/rotation/visibility/style diffs locally and writes text/notes/interactions into shared Base', () => {
    const { page, box, mobile, tablet } = fixture();
    const interaction = { id: uid(), event: 'click' as const, enabled: true, name: 'Shared interaction', conditions: [], conditionMode: 'all' as const, actions: [] };
    const visible = edited(resolveAdaptiveWidgets(page, mobile.id), box.id, { x: 16, y: 20, width: 340, height: 80, rotation: 5, hidden: true, style: { ...box.style, fill: '#abcdef' }, text: 'Shared copy', notes: 'Shared note', interactions: [interaction] });
    const next = applyAdaptiveWidgetEdits(page, mobile.id, visible), base = next.widgets[0];
    expect(base).toMatchObject({ x: 100, y: 80, width: box.width, height: box.height, rotation: 0, hidden: false, text: 'Shared copy', notes: 'Shared note', interactions: [interaction] });
    expect(base.style).toEqual(box.style);
    expect(next.adaptiveViews[0].overrides[box.id]).toEqual({ x: 16, y: 20, width: 340, height: 80, rotation: 5, hidden: true, style: { fill: '#abcdef' } });
    expect(resolveAdaptiveWidgets(next, tablet.id)[0]).toMatchObject({ x: 100, text: 'Shared copy' });
    expect(page.widgets[0].text).toBe(''); expect(mobile.overrides).toEqual({});
  });

  it('preserves prior overrides while changing shared content and removes diffs reset to Base values', () => {
    const { page, box, mobile } = fixture(); mobile.overrides[box.id] = { x: 16, width: 320, style: { fill: '#eeeeee' } };
    const next = applyAdaptiveWidgetEdits(page, mobile.id, edited(resolveAdaptiveWidgets(page, mobile.id), box.id, { text: 'Only content changed' }));
    expect(next.adaptiveViews[0].overrides[box.id]).toEqual(mobile.overrides[box.id]);
    const reset = applyAdaptiveWidgetEdits(next, mobile.id, edited(resolveAdaptiveWidgets(next, mobile.id), box.id, { x: box.x, width: box.width, style: box.style }));
    expect(reset.adaptiveViews[0].overrides).toEqual({}); expect(reset.widgets[0].text).toBe('Only content changed');
  });

  it('keeps new widgets shared, deletes from Base and prunes removed widget overrides in every view', () => {
    const { page, box, text, mobile, tablet } = fixture();
    mobile.overrides[box.id] = { x: 4 }; tablet.overrides[box.id] = { x: 8 }; tablet.overrides[text.id] = { x: 20 };
    const added = createWidget('button', 30, 200);
    const next = applyAdaptiveWidgetEdits(page, mobile.id, [...resolveAdaptiveWidgets(page, mobile.id).filter(w => w.id !== box.id), added]);
    expect(next.widgets.map(w => w.id)).toEqual([text.id, added.id]);
    expect(next.adaptiveViews[0].overrides[added.id]).toBeUndefined();
    expect(next.adaptiveViews.every(view => view.overrides[box.id] === undefined)).toBe(true);
    expect(next.adaptiveViews[1].overrides[text.id]).toEqual({ x: 20 });
    expect(resolveAdaptiveWidgets(next, tablet.id).find(w => w.id === added.id)).toMatchObject({ x: 30, y: 200 });
  });

  it('recursively records child layout diffs while sharing panel state/template structural changes', () => {
    const { page, mobile } = fixture(), panel = createWidget('panel'), child = createWidget('text', 30, 40);
    panel.states![0].widgets = [child]; page.widgets = [panel];
    const effective = resolveAdaptiveWidgets(page, mobile.id);
    effective[0].states![0].name = 'Shared state name';
    effective[0].states![0].widgets = [ { ...child, x: 8, text: 'Shared child text' }, createWidget('input', 8, 90) ];
    const next = applyAdaptiveWidgetEdits(page, mobile.id, effective);
    expect(next.widgets[0].states![0].name).toBe('Shared state name');
    expect(next.widgets[0].states![0].widgets).toHaveLength(2);
    expect(next.widgets[0].states![0].widgets[0]).toMatchObject({ x: 30, text: 'Shared child text' });
    expect(next.adaptiveViews[0].overrides[child.id]).toEqual({ x: 8 });
    expect(next.adaptiveViews[0].overrides[panel.id]).toBeUndefined();
  });

  it('lets Base changes flow through unoverridden properties and preserves other view deltas', () => {
    const { page, box, mobile } = fixture(); mobile.overrides[box.id] = { x: 12, style: { fill: '#eeeeee' } };
    const next = applyAdaptiveWidgetEdits(page, null, edited(page.widgets, box.id, { x: 220, y: 150, style: { ...box.style, color: '#cc0000', fontSize: 24 } }));
    const result = resolveAdaptiveWidgets(next, mobile.id)[0];
    expect(result.x).toBe(12); expect(result.y).toBe(150);
    expect(result.style).toMatchObject({ fill: '#eeeeee', color: '#cc0000', fontSize: 24 });
    expect(next.adaptiveViews[0].overrides[box.id]).toEqual(mobile.overrides[box.id]);
  });

  it('rejects duplicate IDs, invalid geometry, type mutation and a missing selected view', () => {
    const { page, box, mobile } = fixture();
    expect(() => applyAdaptiveWidgetEdits(page, mobile.id, [box, box])).toThrow('Duplicate');
    expect(() => applyAdaptiveWidgetEdits(page, mobile.id, edited(page.widgets, box.id, { width: 0 }))).toThrow('width');
    expect(() => applyAdaptiveWidgetEdits(page, mobile.id, edited(page.widgets, box.id, { x: Number.NaN }))).toThrow('x');
    expect(() => applyAdaptiveWidgetEdits(page, mobile.id, edited(page.widgets, box.id, { type: 'text' }))).toThrow('widget type');
    expect(() => applyAdaptiveWidgetEdits(page, 'missing', page.widgets)).toThrow('does not exist');
  });
});

describe('view controls and project persistence', () => {
  it('creates, renames and resizes a view and can reset selected or all overrides', () => {
    const { page, box, text, mobile, tablet } = fixture(); mobile.overrides = { [box.id]: { x: 10 }, [text.id]: { hidden: true } }; tablet.overrides[box.id] = { y: 20 };
    const changed = updateAdaptiveView(page, mobile.id, { name: ' Small phone ', width: 360 });
    expect(changed.adaptiveViews[0]).toMatchObject({ name: 'Small phone', width: 360 });
    const selectedReset = clearAdaptiveOverrides(changed, mobile.id, [box.id]);
    expect(selectedReset.adaptiveViews[0].overrides).toEqual({ [text.id]: { hidden: true } });
    const allReset = clearAdaptiveOverrides(selectedReset, mobile.id);
    expect(allReset.adaptiveViews[0].overrides).toEqual({}); expect(allReset.adaptiveViews[1]).toBe(tablet);
    const removed = deleteAdaptiveView(allReset, mobile.id); expect(removed.adaptiveViews).toEqual([tablet]); expect(removed.widgets).toBe(page.widgets);
  });

  it('validates view names/widths/count and never treats Base as an editable override', () => {
    const { page, mobile } = fixture();
    expect(() => createAdaptiveView(page, ' ', 390)).toThrow('requires a name');
    expect(() => createAdaptiveView(page, 'Invalid', 0)).toThrow('between');
    expect(() => updateAdaptiveView(page, mobile.id, { width: Number.POSITIVE_INFINITY })).toThrow('between');
    const crowded: Page = { ...page, adaptiveViews: Array.from({ length: 50 }, (_, n) => ({ id: String(n), name: String(n), width: n + 1, overrides: {} })) };
    expect(() => createAdaptiveView(crowded)).toThrow('at most 50');
    expect(() => clearAdaptiveOverrides(page, '')).toThrow('Base'); expect(() => deleteAdaptiveView(page, '')).toThrow('Base');
  });

  it('round-trips sparse style/layout overrides and rejects structural/content fields and unsafe CSS', () => {
    const { page, box, mobile } = fixture(), doc = createDocument(); doc.pages = [page];
    mobile.overrides[box.id] = { x: 12, hidden: false, style: { fontSize: 16, fill: '#eeeeee' } };
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    for (const forbidden of ['id', 'type', 'text', 'notes', 'interactions', 'states', 'componentInstance']) {
      const raw = JSON.parse(JSON.stringify(doc)); raw.pages[0].adaptiveViews[0].overrides[box.id][forbidden] = forbidden === 'states' ? [] : 'invalid';
      expect(() => parseDocument(JSON.stringify(raw))).toThrow('unknown field');
    }
    const raw = JSON.parse(JSON.stringify(doc)); raw.pages[0].adaptiveViews[0].overrides[box.id].style.fill = 'url(https://example.com/image.svg)';
    expect(() => parseDocument(JSON.stringify(raw))).toThrow('expected a color');
  });
});
