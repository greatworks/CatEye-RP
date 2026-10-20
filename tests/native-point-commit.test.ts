import { describe, expect, it } from 'vitest';
import { applyAdaptivePointEdit, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createDocument, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import type { VectorPath, Widget } from '../src/model/types';
import { commitVectorGeometry } from '../src/model/vector-commit';
import { curveVectorAnchor, moveVectorAnchor, vectorAnchors } from '../src/model/vector-editing';
import evidence from '../research/native-point-commit-evidence-probes.json';

const rectangle: VectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 1, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' }] };
function fixture() {
  const document = createDocument(), page = document.pages[0];
  const widget = { ...createWidget('path', 100, 100), id: 'commit-subject', width: 200, height: 100, rotation: 0, vectorPath: structuredClone(rectangle), shapeText: { autoFitWidth: true, autoFitHeight: true } };
  page.widgets = [widget];
  return { document, page, widget };
}
function moved(): VectorPath { const path = structuredClone(rectangle); path.commands[0] = { op: 'M', x: -.25, y: -.2 }; return path; }
function frame(widget: Widget) { return { x: widget.x, y: widget.y, width: widget.width, height: widget.height }; }
function close(actual: unknown, expected: unknown) {
  if (typeof expected === 'number') { expect(actual).toBeCloseTo(expected, 9); return; }
  if (Array.isArray(expected)) { expect(Array.isArray(actual)).toBe(true); expect((actual as unknown[]).length).toBe(expected.length); expected.forEach((value, i) => close((actual as unknown[])[i], value)); return; }
  if (expected && typeof expected === 'object') { for (const [key, value] of Object.entries(expected)) close((actual as Record<string, unknown>)[key], value); return; }
  expect(actual).toEqual(expected);
}

describe('native point commit: frame and shared path are one immutable command', () => {
  it('rebounds a changed polygon, renormalizes every point and preserves existing AutoFit flags', () => {
    const { document, page, widget } = fixture(), before = structuredClone(page);
    const result = applyAdaptivePointEdit(page, null, widget.id, moved()), changed = result.widgets[0];
    expect(frame(changed)).toEqual({ x: 50, y: 80, width: 250, height: 120 });
    close(changed.vectorPath, { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 1, y: 1 / 6 }, { op: 'L', x: 1, y: 1 }, { op: 'L', x: .2, y: 1 }, { op: 'Z' }] });
    expect(changed.shapeText).toEqual({ autoFitWidth: true, autoFitHeight: true });
    expect(changed.style).toEqual(widget.style); expect(page).toEqual(before);
    expect(parseDocument(serializeDocument({ ...document, pages: [result] })).pages[0]).toEqual(result);
  });

  it('uses actual cubic extrema instead of handle hull bounds', () => {
    const { page, widget } = fixture();
    const result = applyAdaptivePointEdit(page, null, widget.id, { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'C', x1: 0, y1: -1, x2: 1, y2: 0, x: 1, y: 1 }] }).widgets[0];
    expect(frame(result)).toEqual({ x: 100, y: 58, width: 200, height: 142 });
    close(result.vectorPath, { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 42 / 142 }, { op: 'C', x1: 0, y1: -58 / 142, x2: 1, y2: 42 / 142, x: 1, y: 1 }] });
  });

  for (const [rotation, expected] of [[90, [75, 75, 250, 100]], [37, [55, 84, 251, 101]]] as const) it(`retains angle ${rotation} and displayed coordinates while rebounding`, () => {
    const { page, widget } = fixture(); widget.rotation = rotation;
    const path = structuredClone(rectangle); path.commands[0] = { op: 'M', x: -.25, y: 0 };
    const result = applyAdaptivePointEdit(page, null, widget.id, path).widgets[0];
    close(frame(result), { x: expected[0], y: expected[1], width: expected[2], height: expected[3] });
    expect(result.rotation).toBe(rotation);
    function world(w: Widget, p: { x: number; y: number }) { const a = rotation * Math.PI / 180, x = (p.x - .5) * w.width, y = (p.y - .5) * w.height; return { x: w.x + w.width / 2 + x * Math.cos(a) - y * Math.sin(a), y: w.y + w.height / 2 + x * Math.sin(a) + y * Math.cos(a) }; }
    path.commands.forEach((command, index) => { if (command.op !== 'Z') close(world(result, result.vectorPath!.commands[index] as { x: number; y: number }), world(widget, command)); });
  });

  it('expands a zero-axis owner before normalizing the actual point-edit entry', () => {
    const { page, widget } = fixture(); widget.style.strokeWidth = 4;
    const result = applyAdaptivePointEdit(page, null, widget.id, { fillRule: 'nonzero', commands: [{ op: 'M', x: .125, y: -.04 }, { op: 'L', x: .125, y: -.04 }] }).widgets[0];
    expect(frame(result)).toEqual({ x: 123, y: 94, width: 4, height: 4 });
    expect(result.vectorPath!.commands).toEqual([{ op: 'M', x: .5, y: .5 }, { op: 'L', x: .5, y: .5 }]);
  });

  it('keeps no-op and fill-rule-only changes separate from a native geometry commit', () => {
    const { page, widget } = fixture();
    expect(applyAdaptivePointEdit(page, null, widget.id, structuredClone(rectangle))).toBe(page);
    widget.type = 'box'; delete widget.style.cornerVisibility;
    const changed = applyAdaptivePointEdit(page, null, widget.id, { ...rectangle, fillRule: 'evenodd' });
    expect(changed.widgets[0]).toEqual({ ...widget, type: 'path', vectorPath: { ...rectangle, fillRule: 'evenodd' } });
    expect(changed.adaptiveViews).toBe(page.adaptiveViews);
  });

  it('does not add shapeText to legacy files', () => {
    const { page, widget } = fixture(); delete (widget as Widget).shapeText;
    expect(applyAdaptivePointEdit(page, null, widget.id, moved()).widgets[0]).not.toHaveProperty('shapeText');
  });

  it('writes Base geometry without materializing named views, keeping inactive declarations intact', () => {
    const { page, widget } = fixture();
    page.adaptiveViews = [
      { id: 'child', name: 'Child first', width: 390, baseViewId: 'parent', overrides: { [widget.id]: { rotation: 180, placed: false, style: { fill: '#123456' } } } },
      { id: 'parent', name: 'Parent second', width: 768, overrides: { [widget.id]: { x: 200, y: 300, width: 400, height: 200, rotation: 90 } } },
      { id: 'inherited', name: 'No local geometry', width: 900, overrides: { [widget.id]: { hidden: true, stateStyles: {} } } },
    ];
    page.adaptiveOverrides = { orphan: { [widget.id]: { x: 42, width: 999, style: { radius: 9 } } } };
    const before = structuredClone(page), result = applyAdaptivePointEdit(page, null, widget.id, moved());
    expect(result.adaptiveViews).toEqual(before.adaptiveViews);
    expect(frame(resolveAdaptiveWidgets(result, 'inherited')[0])).toEqual(frame(result.widgets[0]));
    expect(result.adaptiveOverrides).toEqual(before.adaptiveOverrides); expect(page).toEqual(before);
  });

  it('writes only the current named view, preserving Base, ancestors, siblings and AutoFit', () => {
    const { page, widget } = fixture();
    page.adaptiveViews = [
      { id: 'phone', name: 'Phone', width: 390, baseViewId: 'tablet', overrides: { [widget.id]: { style: { fill: '#123456' }, stateStyles: {}, placed: false } } },
      { id: 'tablet', name: 'Tablet', width: 768, overrides: { [widget.id]: { x: 200, y: 300, width: 400, height: 200 } } },
    ];
    page.adaptiveOverrides = { orphan: { [widget.id]: { x: 42, width: 999 } } };
    const before = structuredClone(page), result = applyAdaptivePointEdit(page, 'phone', widget.id, moved());
    expect(frame(result.widgets[0])).toEqual(frame(widget));
    expect(result.widgets[0].shapeText).toEqual(widget.shapeText);
    expect(result.adaptiveViews[0].overrides[widget.id]).toEqual({ ...before.adaptiveViews[0].overrides[widget.id], x: 100, y: 260, width: 500, height: 240 });
    expect(result.adaptiveViews[1]).toEqual(before.adaptiveViews[1]);
    expect(result.adaptiveOverrides).toEqual(before.adaptiveOverrides); expect(page).toEqual(before);
  });

  it('normalizes a degenerate axis against the expanded frame, not RN4I half-coordinate behavior', () => {
    const { page, widget } = fixture(); widget.style.strokeWidth = 4;
    const result = applyAdaptivePointEdit(page, null, widget.id, { fillRule: 'nonzero', commands: [{ op: 'M', x: .12625, y: -.0375 }, { op: 'L', x: .12625, y: -.0375 }] }).widgets[0];
    expect(frame(result)).toEqual({ x: 123, y: 94, width: 4, height: 4 });
    // 125.25,96.25 rounded to a1px box, expanded to4px with floored origin.
    expect(result.vectorPath!.commands).toEqual([{ op: 'M', x: .5625, y: .5625 }, { op: 'L', x: .5625, y: .5625 }]);
  });

  it('keeps existing true, false and omitted AutoFit configuration byte-for-byte', () => {
    for (const shapeText of [undefined, { autoFitWidth: true, autoFitHeight: false }, { autoFitWidth: false, autoFitHeight: true }, { autoFitWidth: false, autoFitHeight: false }]) {
      const { page, widget } = fixture();
      if (shapeText) widget.shapeText = shapeText; else delete (widget as Widget).shapeText;
      const result = applyAdaptivePointEdit(page, null, widget.id, moved()).widgets[0];
      expect(result.shapeText).toEqual(shapeText); expect(Object.hasOwn(result, 'shapeText')).toBe(shapeText !== undefined);
    }
  });

  it('does not create local geometry when only an interior handle changes', () => {
    const { page, widget } = fixture();
    const path: VectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'C', x1: .2, y1: .2, x2: .8, y2: .8, x: 1, y: 1 }] };
    widget.vectorPath = structuredClone(path); page.adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: { [widget.id]: { stateStyles: {}, placed: true } } }];
    (path.commands[1] as { x1: number }).x1 = .3;
    const result = applyAdaptivePointEdit(page, 'phone', widget.id, path);
    expect(result.adaptiveViews).toEqual(page.adaptiveViews); expect(frame(result.widgets[0])).toEqual(frame(widget));
    expect(result.widgets[0].vectorPath).toEqual(path);
  });

  it('materializes only a changed whole Point or whole Size group, preserving the other local declaration', () => {
    for (const kind of ['point', 'size'] as const) {
      const { page, widget } = fixture();
      page.adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: { [widget.id]: { x: 100, height: 100, style: { fill: '#123456' } } } }];
      const path = structuredClone(rectangle);
      for (const point of path.commands) if (point.op !== 'Z') { if (kind === 'point') point.x += .1; else point.x *= .9; }
      const result = applyAdaptivePointEdit(page, 'phone', widget.id, path);
      expect(result.adaptiveViews[0].overrides[widget.id]).toEqual(kind === 'point'
        ? { x: 120, y: 100, height: 100, style: { fill: '#123456' } }
        : { x: 100, width: 180, height: 100, style: { fill: '#123456' } });
    }
  });

  it('retains logical anchor order through consecutive rebound and round/sharp commits', () => {
    const { page, widget } = fixture();
    const first = applyAdaptivePointEdit(page, null, widget.id, moved()), firstWidget = first.widgets[0];
    const secondPath = moveVectorAnchor(firstWidget.vectorPath!, 0, { x: -.04, y: -.05 });
    const second = applyAdaptivePointEdit(first, null, widget.id, secondPath);
    const anchor = vectorAnchors(second.widgets[0].vectorPath!)[0];
    const curved = applyAdaptivePointEdit(second, null, widget.id, curveVectorAnchor(second.widgets[0].vectorPath!, 0, true));
    expect(vectorAnchors(curved.widgets[0].vectorPath!)).toHaveLength(4);
    expect(vectorAnchors(curved.widgets[0].vectorPath!)[0].outgoing).toBeDefined();
    const sharp = applyAdaptivePointEdit(curved, null, widget.id, curveVectorAnchor(curved.widgets[0].vectorPath!, 0, false));
    expect(vectorAnchors(sharp.widgets[0].vectorPath!)).toHaveLength(4);
    expect(vectorAnchors(second.widgets[0].vectorPath!)[0]).toEqual(anchor);
    // Immutable snapshots are exact history entries, including declarations.
    expect(first.widgets[0].vectorPath).not.toEqual(second.widgets[0].vectorPath);
    expect(page.widgets[0]).toEqual(widget);
  });

  it('rejects an empty command array or out-of-document bounds atomically', () => {
    const { page, widget } = fixture(), before = structuredClone(page);
    // Native contour evidence now closes M-only fallback. An actually empty
    // command array remains outside the saved schema and must fail atomically.
    expect(() => applyAdaptivePointEdit(page, null, widget.id, { fillRule: 'nonzero', commands: [] })).toThrow('1..4096');
    expect(() => applyAdaptivePointEdit(page, null, widget.id, { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 1000, y: 1 }] })).toThrow('document bounds');
    expect(page).toEqual(before);
  });

  it('does not import RN4I/tN4P 20000px cap into the TN46 point entry', () => {
    const { page, widget } = fixture();
    const result = applyAdaptivePointEdit(page, null, widget.id, { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 150, y: 1 }] });
    expect(result.widgets[0].width).toBe(30000);
  });
});

describe('source-derived geometry oracle (retained CIL replay, not original GUI)', () => {
  it('uses the quadratic fallback when both derivative leading coefficients are tiny', () => {
    const { widget } = fixture(); Object.assign(widget, { x: 0, y: 0, width: 1, height: 1 }); widget.style.strokeWidth = 2;
    const c = (.4 - 1 / 3) * 1e-6, first = c / 3, second = -.4e-6 / 3 + 2 * first;
    const result = commitVectorGeometry(widget, { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'C', x1: 0, y1: first, x2: 1, y2: second, x: 1, y: 0 }] });
    // A=1e-6,B=-.8e-6: the native near-zero discriminant branch keeps root .4.
    // Its tiny negative extremum survives the one-sided rounding exception and
    // the later minimum-size floor moves Y to-2 (not-1 from endpoint-only bounds).
    expect(result.bounds).toEqual({ x: -1, y: -2, width: 2, height: 2 });
    expect(result.vectorPath.commands[0]).toEqual({ op: 'M', x: .5, y: 1 });
  });
  // These RN4I probe cases have no minimum-size expansion, so their geometric
  // result is also the TN46 result. Their scope/AutoFit side effects are NOT used.
  const cases = evidence.results.filter(item => item.name.startsWith('commit cubic rotation='));
  for (const record of cases) it(record.name, () => {
    const sample = record.observed as unknown as { old: { x: number; y: number; width: number; height: number; a: number }; owner: { x: number; y: number; width: number; height: number }; normalized: { x: number; y: number }[] };
    const { page, widget } = fixture(); Object.assign(widget, sample.old, { rotation: sample.old.a }); delete (widget as unknown as Record<string, unknown>).a;
    const path: VectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'C', x1: 0, y1: -1, x2: 1, y2: -1, x: 1, y: 1 }] };
    const result = applyAdaptivePointEdit(page, null, widget.id, path).widgets[0], points = sample.normalized;
    close(frame(result), sample.owner);
    close(result.vectorPath!.commands, [{ op: 'M', ...points[0] }, { op: 'C', x1: points[1].x, y1: points[1].y, x2: points[2].x, y2: points[2].y, ...points[3] }]);
  });
  for (const record of evidence.results.filter(item => item.name.startsWith('outward rounding '))) it(record.name, () => {
    const sample = record.observed as unknown as { input: { x: number; y: number; width: number; height: number }; output: { x: number; y: number; width: number; height: number } };
    const { widget } = fixture(); Object.assign(widget, { x: 0, y: 0, width: 1, height: 1 }); widget.style.strokeWidth = 0;
    const r = sample.input, result = commitVectorGeometry(widget, { fillRule: 'nonzero', commands: [{ op: 'M', x: r.x, y: r.y }, { op: 'L', x: r.x + r.width, y: r.y + r.height }] });
    close(result.bounds, sample.output);
  });
});

