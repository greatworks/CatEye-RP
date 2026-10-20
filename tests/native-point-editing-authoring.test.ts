import { describe, expect, it } from 'vitest';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Inspector } from '../src/components/Inspector';
import { CanvasVectorTools } from '../src/components/CanvasVectorTools';
import { resolveVectorEditPath } from '../src/model/vector-authoring';
import { applyAdaptivePointEdit, applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { commitAdaptivePage, resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import { createDocument, createWidget, findWidget, parseDocument, serializeDocument, updateWidgetTree } from '../src/model/document';
import type { VectorPath, Widget } from '../src/model/types';
import imported from '../research/native-pills-imported-widgets.json';

function fixture() {
  const doc = createDocument(), page = doc.pages[0];
  const source = imported.widgets.find(item => item.sourceId === 'd515a37dfd114af6877e6c6d4d244032')!;
  const box = structuredClone(source.widget) as unknown as Widget;
  box.id = 'point-author-box'; box.name = 'Native point authoring'; box.selected = true;
  box.selectedStyle = { radius: 27, fill: '#ff0000' };
  box.mouseOverStyle = { cornerVisibility: [false, true, false, true] };
  const sibling = createWidget('input', 350, 90); sibling.id = 'point-author-input';
  page.widgets = [box, sibling];
  page.adaptiveViews = [
    { id: 'point-tablet', name: 'Tablet', width: 768, overrides: { [box.id]: { x: 71, width: 240, height: 60, style: { radius: 5, fill: '#112233' } } } },
    { id: 'point-phone', name: 'Phone', width: 390, baseViewId: 'point-tablet', overrides: { [box.id]: { y: 44, rotation: 17, style: { radius: 18 }, stateStyles: { selected: { radius: 29 } } } } },
  ];
  page.adaptiveOverrides = { inactive: { [box.id]: { x: 45, style: { radius: 33 }, stateStyles: {} } } };
  return { doc, page, box, sibling };
}
function changedPath(widget: Widget): VectorPath {
  const path = structuredClone(widget.vectorPath!);
  const command = path.commands.find(command => command.op === 'C');
  if (!command || command.op !== 'C') throw Error('Expected a real capsule cubic');
  command.x1 += .025;
  return path;
}
// TN46 now normalizes through canvas coordinates even when the owner bounds are
// unchanged. Compare numeric path coordinates with a tight round-trip tolerance;
// all non-path fields below remain exact, including untouched adaptive maps.
function expectPathNear(actual: VectorPath | undefined, expected: VectorPath) {
  expect(actual?.fillRule).toBe(expected.fillRule);
  expect(actual?.commands).toHaveLength(expected.commands.length);
  expected.commands.forEach((command, index) => {
    const result = actual!.commands[index]; expect(Object.keys(result).sort()).toEqual(Object.keys(command).sort());
    for (const [key, value] of Object.entries(command)) {
      if (typeof value === 'number') expect((result as unknown as Record<string, number>)[key]).toBeCloseTo(value, 11);
      else expect((result as unknown as Record<string, string>)[key]).toBe(value);
    }
  });
}
function expectWidgetPath(actual: Widget, expected: Widget) {
  expectPathNear(actual.vectorPath, expected.vectorPath!);
  expect({ ...actual, vectorPath: expected.vectorPath }).toEqual(expected);
}

describe('native point editing commits shared geometry explicitly', () => {
  it('converts only the edited Base box and retains every unrelated field and declaration', () => {
    const { doc, page, box } = fixture(), original = structuredClone(doc), path = changedPath(box);
    const result = applyAdaptivePointEdit(page, null, box.id, path);
    expectWidgetPath(result.widgets[0], { ...box, type: 'path', vectorPath: path });
    expect(result.widgets[1]).toEqual(page.widgets[1]);
    expect(result.adaptiveViews).toEqual(page.adaptiveViews);
    expect(result.adaptiveOverrides).toEqual(page.adaptiveOverrides);
    expect(doc).toEqual(original);
    expect(parseDocument(serializeDocument({ ...doc, pages: [result] }))).toEqual({ ...doc, pages: [result] });
  });

  it('changes shared type/path from a child view without baking its size, position, normal or selected style', () => {
    const { page, box } = fixture(), path = changedPath(box);
    const result = applyAdaptivePointEdit(page, 'point-phone', box.id, path);
    expectWidgetPath(result.widgets[0], { ...box, type: 'path', vectorPath: path });
    expect(result.adaptiveViews).toEqual(page.adaptiveViews);
    expect(result.adaptiveOverrides).toEqual(page.adaptiveOverrides);
    expect(resolveAdaptiveWidgets(result, 'point-phone')[0]).toMatchObject({ type: 'path', width: 240, height: 60, x: 71, y: 44, rotation: 17, style: { radius: 18, fill: '#112233' }, selectedStyle: { radius: 29 } });
    expect(result.widgets[1]).toEqual(page.widgets[1]);
  });

  it('converts a legacy stored-path fallback on an actual edit without manufacturing a new contour', () => {
    const { page, box } = fixture(); delete box.style.cornerVisibility;
    const path = changedPath(box), result = applyAdaptivePointEdit(page, null, box.id, path);
    expectWidgetPath(result.widgets[0], { ...box, type: 'path', vectorPath: path });
  });

  for (const kind of ['partial', 'independent'] as const) it(`rejects an unproven ${kind} parameterized configuration without mutation`, () => {
    const { page, box } = fixture();
    if (kind === 'partial') box.style.borderVisibility = [true, false, true, true];
    else box.style.cornerRadii = [8, 14, 20, 26];
    const before = structuredClone(page);
    expect(() => applyAdaptivePointEdit(page, null, box.id, changedPath(box))).toThrow('Point editing is unavailable');
    expect(page).toEqual(before);
  });

  it('never upgrades a custom path back to a box when the edited commands again form a capsule', () => {
    const { page, box } = fixture(), originalPath = structuredClone(box.vectorPath!);
    box.type = 'path'; box.vectorPath = changedPath(box);
    const result = applyAdaptivePointEdit(page, null, box.id, originalPath);
    expectWidgetPath(result.widgets[0], { ...box, type: 'path', vectorPath: originalPath });
  });

  it('does not broaden the box conversion policy to ellipse widgets', () => {
    const { page, box } = fixture(); box.type = 'ellipse';
    const path = changedPath(box), result = applyAdaptivePointEdit(page, null, box.id, path);
    expectWidgetPath(result.widgets[0], { ...box, vectorPath: path });
  });

  it('returns the original page on a stored-path no-op', () => {
    const { page, box } = fixture(); delete box.style.cornerVisibility;
    expect(applyAdaptivePointEdit(page, null, box.id, structuredClone(box.vectorPath!))).toBe(page);
  });

  it('updates one nested repeater template owner without altering sibling templates or parent geometry', () => {
    const { page, box } = fixture(), panel = createWidget('panel'), repeater = createWidget('repeater'), sibling = structuredClone(box);
    sibling.id = 'other-capsule'; repeater.repeater!.template = [box, sibling]; panel.states![0].widgets = [repeater]; page.widgets = [panel];
    const before = structuredClone(page), path = changedPath(box), result = applyAdaptivePointEdit(page, 'point-phone', box.id, path);
    expectPathNear(findWidget(result, box.id)!.vectorPath, path);
    const expected = updateWidgetTree(page.widgets, box.id, { type: 'path', vectorPath: findWidget(result, box.id)!.vectorPath });
    expect(result.widgets).toEqual(expected); expect(result.adaptiveViews).toEqual(before.adaptiveViews);
    expect(findWidget(result, sibling.id)).toEqual(sibling); expect(page).toEqual(before);
  });

  it('round-trips shared-set and inactive declarations without reconstructing their maps', () => {
    const { doc, page, box } = fixture();
    doc.adaptiveViewSets = [{ id: 'point-set', name: 'Point views', baseSize: { width: 1200, height: 0 }, views: page.adaptiveViews.map(({ overrides: _overrides, ...view }) => view) }];
    page.adaptiveOverrides = { ...Object.fromEntries(page.adaptiveViews.map(view => [view.id, view.overrides])), ...page.adaptiveOverrides };
    page.adaptiveViewSetId = 'point-set'; page.adaptiveViews = []; delete page.adaptiveSelection; delete page.adaptiveBaseSize;
    const path = changedPath(box), result = commitAdaptivePage(doc, applyAdaptivePointEdit(resolveAdaptivePage(doc, page), 'point-phone', box.id, path));
    expectWidgetPath(result.pages[0].widgets[0], { ...box, type: 'path', vectorPath: path });
    expect(result.pages[0].adaptiveOverrides).toEqual(page.adaptiveOverrides); expect(result.adaptiveViewSets).toEqual(doc.adaptiveViewSets);
    expect(parseDocument(serializeDocument(result))).toEqual(result);
  });

  it('does not persist a prepared child-view contour merely by inspecting it or returning a gesture to its origin', () => {
    const { page, box } = fixture();
    const effective = resolveAdaptiveWidgets(page, 'point-phone')[0];
    const prepared = resolveVectorEditPath(effective)!;
    expect(prepared).not.toEqual(box.vectorPath);
    expect(prepared.commands[0]).toEqual({ op: 'M', x: 0, y: .3 });
    expect(applyAdaptivePointEdit(page, 'point-phone', box.id, structuredClone(prepared))).toBe(page);
    expect(box.type).toBe('box');
    const path = changedPath({ ...effective, vectorPath: prepared });
    expectWidgetPath(applyAdaptivePointEdit(page, 'point-phone', box.id, path).widgets[0], { ...box, type: 'path', vectorPath: path });
  });

  it('rejects invalid targets and bounded path data before changing any source', () => {
    const { page, box, sibling } = fixture(), before = structuredClone(page);
    expect(() => applyAdaptivePointEdit(page, null, 'missing', box.vectorPath!)).toThrow('does not exist');
    expect(() => applyAdaptivePointEdit(page, null, sibling.id, box.vectorPath!)).toThrow('editable vector path');
    expect(() => applyAdaptivePointEdit(page, 'unknown-view', box.id, box.vectorPath!)).toThrow();
    expect(() => applyAdaptivePointEdit(page, null, box.id, { fillRule: 'nonzero', commands: [{ op: 'M', x: 10001, y: 0 }] })).toThrow();
    expect(page).toEqual(before);
  });

  it('uses the same normal adaptive contour in numeric Inspector and the canvas point overlay', () => {
    const { doc, page } = fixture(), before = structuredClone(doc), widget = resolveAdaptiveWidgets(page, 'point-phone')[0];
    const inspector = renderToStaticMarkup(createElement(Inspector, { document: doc, page, widget, onWidgetChange() {}, onPageChange() {} }));
    expect(inspector).toMatch(/aria-label="Node Y %"[^>]*value="30"/);
    const canvas = renderToStaticMarkup(createElement(CanvasVectorTools, { mode: 'points', widget, zoom: 1.5, surface: createRef<HTMLDivElement>(), onCreate() {}, onPathChange() {}, onPreview() {}, onDone() {}, onNotice() {} }));
    // Radius18 at height60, not the stored half-height pole or selected radius29.
    expect(canvas).toMatch(/aria-label="Vector point 1"[^>]*y="15\.333333333333334"/);
    expect(canvas).toContain('rotate(17 120 30)');
    expect(doc).toEqual(before);
  });

  for (const kind of ['partial', 'independent'] as const) it(`hides numeric mutation controls for unproven ${kind} parameter geometry while retaining its styles`, () => {
    const { doc, page, box } = fixture();
    if (kind === 'partial') box.style.borderVisibility = [true, false, true, true];
    else box.style.cornerRadii = [8, 14, 20, 26];
    const before = structuredClone(doc);
    const html = renderToStaticMarkup(createElement(Inspector, { document: doc, page, widget: box, onWidgetChange() {}, onPageChange() {} }));
    expect(html).toContain('Point editing is unavailable for this border or corner configuration.');
    expect(html).not.toContain('aria-label="Path node"');
    expect(html).not.toContain('aria-label="Path fill rule"');
    expect(doc).toEqual(before);
  });

  it('retains the ordinary adaptive editor prohibition on changing an existing widget type', () => {
    const { page, box } = fixture();
    expect(() => applyAdaptiveWidgetEdits(page, null, updateWidgetTree(page.widgets, box.id, { type: 'path' }))).toThrow('Changing an existing widget type');
  });
});
