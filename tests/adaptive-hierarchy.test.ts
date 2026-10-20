import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, clearAdaptiveOverrides, createAdaptiveView, deleteAdaptiveView, resolveAdaptiveOverride, resolveAdaptiveWidgets, updateAdaptiveBaseSize, updateAdaptiveView } from '../src/model/adaptive';
import { createDocument, createPage, createWidget, findWidget, parseDocument, serializeDocument } from '../src/model/document';
import type { AdaptiveView, GradientFill, Page, Widget } from '../src/model/types';

const gradient: GradientFill = { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] };
function fixture() {
  const page = createPage('Hierarchy'), box = createWidget('box', 100, 80);
  page.widgets = [box];
  const ancestor: AdaptiveView = { id: 'ancestor', name: 'Tablet', width: 768, height: 0, overrides: {} };
  const child: AdaptiveView = { id: 'child', name: 'Phone', width: 390, height: 0, baseViewId: ancestor.id, overrides: {} };
  const grandchild: AdaptiveView = { id: 'grandchild', name: 'Portrait', width: 390, height: 700, baseViewId: child.id, overrides: {} };
  page.adaptiveViews = [ancestor, child, grandchild];
  return { page, box, ancestor, child, grandchild };
}
function doc(page: Page) { const document = createDocument(); document.pages = [page]; return document; }
function roundTrip(page: Page) { return parseDocument(serializeDocument(doc(page))).pages[0]; }

describe('adaptive hierarchy persistence', () => {
  it('new pages opt into native sizes with a separate zero Base size', () => {
    const page = createPage();
    expect(page).toMatchObject({ adaptiveSelection: 'native-size', adaptiveBaseSize: { width: 0, height: 0 } });
    expect(roundTrip(page)).toEqual(page);
  });
  it('preserves omission on legacy pages and accepts mixed-page documents without migration', () => {
    const legacy = createPage('Legacy'); delete legacy.adaptiveSelection; delete legacy.adaptiveBaseSize;
    legacy.adaptiveViews = [{ id: 'old', name: 'Small', width: 390, overrides: {} }];
    const native = fixture().page, document = doc(legacy); document.pages.push(native);
    const read = parseDocument(serializeDocument(document));
    expect(read.pages[0]).toEqual(legacy); expect(Object.hasOwn(read.pages[0], 'adaptiveSelection')).toBe(false);
    expect(read.pages[1]).toEqual(native);
  });
  it('round-trips explicit parent identity, width zero, height and Base dimensions', () => {
    const { page, child } = fixture(); child.width = 0; page.adaptiveBaseSize = { width: 1024.5, height: 600 };
    expect(roundTrip(page)).toEqual(page);
  });
  it.each(['missing', 'child', 'grandchild'])('rejects missing/self/cyclic parent %s', parent => {
    const { page, child } = fixture(); child.baseViewId = parent;
    expect(() => roundTrip(page)).toThrow(/parent|cycle|itself|exist/i);
  });
  it('rejects a parent from another page even when it has a globally valid ID', () => {
    const { page, child } = fixture(), other = createPage(); other.adaptiveViews = [{ id: 'other-view', name: 'Other', width: 500, overrides: {} }];
    child.baseViewId = 'other-view'; const document = doc(page); document.pages.push(other);
    expect(() => parseDocument(serializeDocument(document))).toThrow(/parent|exist/i);
  });
  it.each([
    ['mode', (p: Page) => { (p as unknown as { adaptiveSelection: string }).adaptiveSelection = 'min-width'; }],
    ['legacy width zero', (p: Page) => { delete p.adaptiveSelection; p.adaptiveViews[0].width = 0; }],
    ['negative height', (p: Page) => { p.adaptiveViews[0].height = -1; }],
    ['oversize width', (p: Page) => { p.adaptiveViews[0].width = 100_001; }],
    ['Base negative', (p: Page) => { p.adaptiveBaseSize = { width: 0, height: -1 }; }],
    ['Base unknown field', (p: Page) => { p.adaptiveBaseSize = { width: 0, height: 0, condition: 'less' } as unknown as Page['adaptiveBaseSize']; }],
  ])('strictly rejects %s', (_name, change) => { const { page } = fixture(); change(page); expect(() => roundTrip(page)).toThrow(); });
});

describe('adaptive inherited declarations', () => {
  it('resolves ancestors in order with atomic paint, border and radius resets, retaining explicit false', () => {
    const { page, box, ancestor, child, grandchild } = fixture();
    box.style = { ...box.style, fillGradient: gradient, strokeGradient: gradient, cornerRadii: [2, 3, 4, 5], borderWidths: [2, 3, 4, 5] };
    ancestor.overrides[box.id] = { x: 40, hidden: true, style: { fillGradient: gradient, fontStyle: 'italic', radius: 5 } };
    child.overrides[box.id] = { width: 200, hidden: false, style: { fill: '#ffffff', stroke: '#000000', strokeWidth: 3, fontStyle: 'normal' } };
    grandchild.overrides[box.id] = { y: 10, style: { color: '#ff0000' } };
    const patch = resolveAdaptiveOverride(page, grandchild.id, box.id)!;
    expect(patch).toMatchObject({ x: 40, y: 10, width: 200, hidden: false, style: { fill: '#ffffff', stroke: '#000000', strokeWidth: 3, radius: 5, fontStyle: 'normal', color: '#ff0000' } });
    expect(patch.style).not.toHaveProperty('fillGradient'); expect(patch.style).not.toHaveProperty('strokeGradient');
    const resolved = resolveAdaptiveWidgets(page, grandchild.id)[0];
    expect(resolved.style).not.toHaveProperty('fillGradient'); expect(resolved.style).not.toHaveProperty('strokeGradient');
    expect(resolved.style).not.toHaveProperty('cornerRadii'); expect(resolved.style).not.toHaveProperty('borderWidths');
    expect(resolved).toMatchObject({ x: 40, y: 10, width: 200, hidden: false });
    expect(box.style.fillGradient).toEqual(gradient); expect(resolveAdaptiveOverride(page, undefined, box.id)).toBeUndefined();
  });
  it('preserves a child complete gradient alongside its solid and resolves hidden/inactive descendants', () => {
    const { page, ancestor, child } = fixture(), panel = createWidget('panel'), text = createWidget('text');
    panel.hidden = true; panel.states![0].widgets = [text]; page.widgets = [panel];
    ancestor.overrides[text.id] = { x: 7, style: { fill: '#eeeeee' } };
    child.overrides[text.id] = { style: { fill: '#ffffff', fillGradient: gradient } };
    expect(findWidget({ widgets: resolveAdaptiveWidgets(page, child.id) }, text.id)).toMatchObject({ x: 7, style: { fill: '#ffffff', fillGradient: gradient } });
  });
  it('does not persist inherited values as local diffs during shared-content edits', () => {
    const { page, box, ancestor, child } = fixture(); ancestor.overrides[box.id] = { x: 20, style: { fill: '#eeeeee' } }; child.overrides[box.id] = { y: 30 };
    const widgets = structuredClone(resolveAdaptiveWidgets(page, child.id)); widgets[0].text = 'Shared new text';
    const result = applyAdaptiveWidgetEdits(page, child.id, widgets);
    expect(result.adaptiveViews[1].overrides[box.id]).toEqual({ y: 30 });
    expect(result.widgets[0]).toMatchObject({ x: box.x, y: box.y, text: 'Shared new text' });
    expect(resolveAdaptiveWidgets(result, ancestor.id)[0]).toMatchObject({ x: 20, text: 'Shared new text' });
  });
  it.each(['width', 'color', 'hidden', 'fill reset'] as const)('retains an unchanged explicit child %s when the parent temporarily has the same value', property => {
    const { page, box, ancestor, child } = fixture();
    if (property === 'fill reset') box.style.fillGradient = gradient;
    const local = property === 'width' ? { width: 300 } : property === 'color' ? { style: { color: '#ff0000' } } : property === 'hidden' ? { hidden: true } : { style: { fill: '#ffffff' } };
    ancestor.overrides[box.id] = structuredClone(local); child.overrides[box.id] = structuredClone(local);
    const widgets = structuredClone(resolveAdaptiveWidgets(page, child.id)); widgets[0].notes = 'Only a shared note changed';
    const result = applyAdaptiveWidgetEdits(page, child.id, widgets);
    expect(result.adaptiveViews[1].overrides[box.id]).toEqual(local);
    expect(result.widgets[0].notes).toBe('Only a shared note changed');
    result.adaptiveViews[0].overrides[box.id] = property === 'width' ? { width: 400 } : property === 'color' ? { style: { color: '#0000ff' } } : property === 'hidden' ? { hidden: false } : { style: { fillGradient: gradient } };
    const resolved = resolveAdaptiveWidgets(roundTrip(result), child.id)[0];
    if (property === 'width') expect(resolved.width).toBe(300);
    else if (property === 'color') expect(resolved.style.color).toBe('#ff0000');
    else if (property === 'hidden') expect(resolved.hidden).toBe(true);
    else expect(resolved.style).not.toHaveProperty('fillGradient');
  });
  it.each(['fill', 'stroke', 'radius', 'strokeWidth'] as const)('recomputes the whole %s atomic pair when that paint or geometry is edited', property => {
    const { page, box, ancestor, child } = fixture();
    const local = property === 'fill' ? { fill: '#ffffff', fillGradient: gradient } : property === 'stroke' ? { stroke: '#000000', strokeGradient: gradient } : property === 'radius' ? { radius: 10, cornerRadii: [10, 20, 30, 40] as [number, number, number, number] } : { strokeWidth: 2, borderWidths: [2, 3, 4, 5] as [number, number, number, number] };
    ancestor.overrides[box.id] = { style: structuredClone(local) }; child.overrides[box.id] = { style: structuredClone(local) };
    const widgets = structuredClone(resolveAdaptiveWidgets(page, child.id));
    if (property === 'fill') { widgets[0].style.fill = '#ff0000'; delete widgets[0].style.fillGradient; }
    else if (property === 'stroke') { widgets[0].style.stroke = '#ff0000'; delete widgets[0].style.strokeGradient; }
    else if (property === 'radius') { widgets[0].style.radius = 5; delete widgets[0].style.cornerRadii; }
    else { widgets[0].style.strokeWidth = 6; delete widgets[0].style.borderWidths; }
    const result = roundTrip(applyAdaptiveWidgetEdits(page, child.id, widgets));
    expect(result.adaptiveViews[1].overrides[box.id]).toEqual({ style: { [property]: widgets[0].style[property] } });
    expect(resolveAdaptiveWidgets(result, child.id)[0].style).toEqual(widgets[0].style);
  });
  it('removes a changed local dimension when its new value intentionally returns to the parent', () => {
    const { page, box, ancestor, child } = fixture(); ancestor.overrides[box.id] = { width: 200 }; child.overrides[box.id] = { width: 300 };
    const widgets = structuredClone(resolveAdaptiveWidgets(page, child.id)); widgets[0].width = 200;
    const result = applyAdaptiveWidgetEdits(page, child.id, widgets);
    expect(result.adaptiveViews[1].overrides[box.id]).toBeUndefined();
    result.adaptiveViews[0].overrides[box.id] = { width: 400 };
    expect(resolveAdaptiveWidgets(result, child.id)[0].width).toBe(400);
  });
  it.each(['table', 'menu', 'tree'] as const)('retains unchanged explicit %s visibility without making its shared geometry adaptive', type => {
    const { page, ancestor, child } = fixture(), container = createWidget(type); page.widgets = [container];
    ancestor.overrides[container.id] = { hidden: true }; child.overrides[container.id] = { hidden: true };
    const widgets = structuredClone(resolveAdaptiveWidgets(page, child.id)); widgets[0].notes = 'Shared';
    const result = applyAdaptiveWidgetEdits(page, child.id, widgets);
    expect(result.adaptiveViews[1].overrides[container.id]).toEqual({ hidden: true });
    expect(result.widgets[0]).toMatchObject({ notes: 'Shared', hidden: false, width: container.width, height: container.height });
    result.adaptiveViews[0].overrides[container.id] = { hidden: false };
    expect(resolveAdaptiveWidgets(roundTrip(result), child.id)[0].hidden).toBe(true);
  });
  it('compares edits against effective parent rather than raw Base, including reset to a Base-looking color', () => {
    const { page, box, ancestor, child } = fixture(); ancestor.overrides[box.id] = { x: 20, style: { fill: '#eeeeee', fillGradient: gradient } };
    const widgets = structuredClone(resolveAdaptiveWidgets(page, child.id)); widgets[0].x = box.x; widgets[0].style = { ...widgets[0].style, fill: box.style.fill }; delete widgets[0].style.fillGradient;
    const result = applyAdaptiveWidgetEdits(page, child.id, widgets);
    expect(result.adaptiveViews[1].overrides[box.id]).toEqual({ x: box.x, style: { fill: box.style.fill } });
    const reset = clearAdaptiveOverrides(result, child.id, [box.id]);
    expect(resolveAdaptiveWidgets(reset, child.id)[0]).toMatchObject({ x: 20, style: { fill: '#eeeeee', fillGradient: gradient } });
  });
  it('preserves explicit rich-run style commands equal to inherited outer values during content edits', () => {
    const { page, box, ancestor, child } = fixture(); box.text = 'Italic'; box.richText = { paragraphs: [{ runs: [{ text: 'Italic', style: { fontStyle: 'italic' } }] }] };
    ancestor.overrides[box.id] = { style: { fontStyle: 'normal' } }; child.overrides[box.id] = { style: { fontStyle: 'normal', fontWeight: box.style.fontWeight } };
    const widgets = structuredClone(resolveAdaptiveWidgets(page, child.id)); widgets[0].notes = 'Shared';
    const result = applyAdaptiveWidgetEdits(page, child.id, widgets);
    expect(result.adaptiveViews[1].overrides[box.id]).toEqual(child.overrides[box.id]);
    expect(result.widgets[0].richText).toEqual(box.richText);
  });
  it('compares shared-container visibility to parent while leaving table geometry shared', () => {
    const { page, ancestor, child } = fixture(), table = createWidget('table'); page.widgets = [table];
    ancestor.overrides[table.id] = { hidden: true };
    const widgets = structuredClone(resolveAdaptiveWidgets(page, child.id)); widgets[0].hidden = false;
    const result = applyAdaptiveWidgetEdits(page, child.id, widgets);
    expect(result.adaptiveViews[1].overrides[table.id]).toEqual({ hidden: false }); expect(result.widgets[0].table).toEqual(table.table);
  });
});

describe('adaptive author hierarchy operations', () => {
  it('creates child views with native zero defaults and validates geometry and parent before changes', () => {
    const { page, child } = fixture(), next = createAdaptiveView(page, ' Child ', 0, { baseViewId: child.id });
    expect(next.adaptiveViews.at(-1)).toMatchObject({ name: 'Child', width: 0, height: 0, baseViewId: child.id, overrides: {} });
    expect(page.adaptiveViews).toHaveLength(3);
    expect(() => createAdaptiveView(page, 'Invalid', 1, { baseViewId: 'missing' })).toThrow(/exist|parent/);
    expect(() => createAdaptiveView(page, 'Invalid', 1, { height: -1 })).toThrow(/height/);
    expect(() => createAdaptiveView(page, 'Invalid', Number.NaN)).toThrow(/width/);
  });
  it('reparents without materializing inherited overrides and prevents a cycle', () => {
    const { page, child, grandchild } = fixture(); child.overrides.x = { x: 4 };
    const next = updateAdaptiveView(page, child.id, { baseViewId: null, height: 0, width: 0 });
    expect(next.adaptiveViews[1]).not.toHaveProperty('baseViewId'); expect(next.adaptiveViews[1].overrides).toEqual(child.overrides);
    expect(() => updateAdaptiveView(page, child.id, { baseViewId: grandchild.id })).toThrow(/cycle|parent/);
    expect(() => updateAdaptiveView(page, child.id, { baseViewId: child.id })).toThrow(/itself|cycle|parent/);
    expect(() => updateAdaptiveView(page, child.id, { baseViewId: 'missing' })).toThrow(/exist|parent/);
  });
  it('deleting a view reparents only direct children to its parent, retaining their local data', () => {
    const { page, box, ancestor, child, grandchild } = fixture(); child.overrides[box.id] = { x: 50 }; grandchild.overrides[box.id] = { y: 60 };
    const leaf: AdaptiveView = { id: 'leaf', name: 'Leaf', width: 250, baseViewId: grandchild.id, overrides: { [box.id]: { width: 70 } } }; page.adaptiveViews.push(leaf);
    const next = deleteAdaptiveView(page, child.id);
    expect(next.adaptiveViews.map(v => v.id)).toEqual([ancestor.id, grandchild.id, leaf.id]);
    expect(next.adaptiveViews[1]).toEqual({ ...grandchild, baseViewId: ancestor.id }); expect(next.adaptiveViews[2]).toBe(leaf);
    expect(resolveAdaptiveWidgets(next, grandchild.id)[0]).toMatchObject({ x: box.x, y: 60 });
    expect(deleteAdaptiveView(next, ancestor.id).adaptiveViews[0]).not.toHaveProperty('baseViewId');
    expect(page.adaptiveViews).toHaveLength(4); expect(grandchild.baseViewId).toBe(child.id);
  });
  it('updates Base size only in native mode and never changes canvas dimensions or named views', () => {
    const { page } = fixture(); const next = updateAdaptiveBaseSize(page, { width: 0, height: 800.5 });
    expect(next.adaptiveBaseSize).toEqual({ width: 0, height: 800.5 }); expect(next.width).toBe(page.width); expect(next.adaptiveViews).toBe(page.adaptiveViews);
    expect(updateAdaptiveBaseSize({ ...page, adaptiveBaseSize: undefined }, { width: 300 }).adaptiveBaseSize).toEqual({ width: 300, height: 0 });
    expect(() => updateAdaptiveBaseSize(page, { height: 100_001 })).toThrow(/height/);
    expect(() => updateAdaptiveBaseSize({ ...page, adaptiveSelection: undefined }, { width: 300 })).toThrow(/native/i);
  });
});
