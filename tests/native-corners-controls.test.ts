import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CornerEditor, CornerOverrides, supportsCornerEditing } from '../src/components/CornerEditor';
import { cornerStylePatch, editCornerOverride, resolveWidgetStyleCommand, type WidgetStyleEditIntent } from '../src/components/widget-style-command';
import { applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createDocument, createPage, createWidget, mergeWidgetStyle } from '../src/model/document';
import { Inspector } from '../src/components/Inspector';
import type { VectorPath, Widget, WidgetStyle } from '../src/model/types';

const rounded: VectorPath = { fillRule: 'nonzero', commands: [
  { op: 'M', x: 0, y: .2 }, { op: 'C', x1: 0, y1: .088, x2: .088, y2: 0, x: .2, y: 0 },
  { op: 'L', x: .8, y: 0 }, { op: 'C', x1: .912, y1: 0, x2: 1, y2: .088, x: 1, y: .2 },
  { op: 'L', x: 1, y: .8 }, { op: 'C', x1: 1, y1: .912, x2: .912, y2: 1, x: .8, y: 1 },
  { op: 'L', x: .2, y: 1 }, { op: 'C', x1: .088, y1: 1, x2: 0, y2: .912, x: 0, y: .8 }, { op: 'L', x: 0, y: .2 }, { op: 'Z' },
] };
const clickTopLeft: WidgetStyleEditIntent = { kind: 'corners', command: { kind: 'visibility', corner: 0, value: false } };
function edit(widget: Widget, intent = clickTopLeft): Widget {
  return { ...widget, style: mergeWidgetStyle(widget.style, resolveWidgetStyleCommand(widget, {}, intent)) };
}
function mixed() {
  const page = createPage('Mixed corner targets'), a = createWidget('box'), b = createWidget('box'), noop = createWidget('box');
  a.id = 'corners-a'; b.id = 'corners-b'; noop.id = 'corners-noop'; page.widgets = [a, b, noop];
  a.style.radius = 8; b.style.radius = 12; noop.style.radius = 16;
  a.style.cornerVisibility = [true, false, false, false]; b.style.cornerVisibility = [true, false, true, false]; noop.style.cornerVisibility = [true, true, true, true];
  page.adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: {
    [a.id]: { style: { radius: 22, cornerVisibility: [true, true, true, true] } },
    [b.id]: { style: { radius: 24, cornerVisibility: [true, false, true, false] } },
    [noop.id]: { style: { radius: 26, cornerVisibility: [false, true, false, true] } },
  } }];
  page.adaptiveOverrides = { inactive: {
    [a.id]: { style: { radius: 30, cornerVisibility: [true, false, false, false] } },
    [b.id]: { style: { radius: 32, cornerVisibility: [false, true, false, true] } },
    [noop.id]: { style: { radius: 34, cornerVisibility: [true, true, false, false] } },
  } };
  return { page, a, b, noop };
}

describe('native corner author commands', () => {
  it.each([false, true])('a single-bit heterogeneous multi-selection edit is per target (allViews=%s)', allViews => {
    const { page, a, b, noop } = mixed(), result = applyAdaptiveWidgetEdits(page, 'phone', resolveAdaptiveWidgets(page, 'phone').map(w => edit(w)), { allViews });
    expect(resolveAdaptiveWidgets(result, 'phone').map(w => w.style.cornerVisibility)).toEqual([[false, true, true, true], [false, false, true, false], [false, true, false, true]]);
    expect(result.widgets.map(w => w.style.radius)).toEqual([8, 12, 16]);
    expect(result.adaptiveViews[0].overrides[noop.id]).toEqual(page.adaptiveViews[0].overrides[noop.id]);
    expect(result.adaptiveOverrides!.inactive[noop.id]).toEqual(page.adaptiveOverrides!.inactive[noop.id]);
    expect(result.widgets[2]).toEqual(noop);
    for (const id of [a.id, b.id]) {
      expect(result.adaptiveViews[0].overrides[id].style!.radius).toBe(page.adaptiveViews[0].overrides[id].style!.radius);
      expect(result.adaptiveOverrides!.inactive[id].style!.radius).toBe(page.adaptiveOverrides!.inactive[id].style!.radius);
      if (allViews) expect(result.adaptiveOverrides!.inactive[id].style).not.toHaveProperty('cornerVisibility');
      else expect(result.adaptiveOverrides!.inactive[id]).toEqual(page.adaptiveOverrides!.inactive[id]);
    }
  });

  it('a radius command preserves each target mask and leaves already-matching targets untouched', () => {
    const { page } = mixed(), before = resolveAdaptiveWidgets(page, 'phone');
    before[1].style.cornerRadii = [2, 4, 6, 8];
    const intent: WidgetStyleEditIntent = { kind: 'corners', command: { kind: 'radius', value: 26 } };
    const changed = before.map(w => edit(w, intent));
    expect(changed.map(w => w.style.cornerVisibility)).toEqual(before.map(w => w.style.cornerVisibility));
    expect(changed[1].style).not.toHaveProperty('cornerRadii');
    expect(resolveWidgetStyleCommand(before[2], {}, intent)).toEqual({});
  });

  it('mask changes retain legacy independent radii without mutating their input', () => {
    const w = createWidget('box'); w.style.cornerRadii = [3, 5, 7, 9]; const snapshot = structuredClone(w);
    expect(edit(w).style).toMatchObject({ cornerRadii: [3, 5, 7, 9], cornerVisibility: [false, true, true, true] });
    expect(w).toEqual(snapshot);
  });

  it('an explicit uniform reset can clear a legacy tuple even when the scalar already matches', () => {
    const w = createWidget('box'); w.style.radius = 8; w.style.cornerRadii = [3, 5, 7, 9]; w.style.cornerVisibility = [false, true, false, true];
    expect(cornerStylePatch(w.style, { kind: 'radius', value: 8 })).toEqual({ radius: 8 });
    expect(mergeWidgetStyle(w.style, cornerStylePatch(w.style, { kind: 'radius', value: 8 }))).toMatchObject({ radius: 8, cornerVisibility: [false, true, false, true] });
  });

  it('per-target effect mask edits retain unrelated effect attributes and keep same-value patches by reference', () => {
    const { a, b } = mixed(), left: Partial<WidgetStyle> = { fill: '#111111', fontSize: 18, cornerVisibility: [true, false, true, false] }, right: Partial<WidgetStyle> = { fill: '#222222', fontSize: 28, cornerVisibility: [true, true, false, true] };
    expect(editCornerOverride(a.style, left, clickTopLeft.command)).toEqual({ fill: '#111111', fontSize: 18, cornerVisibility: [false, false, true, false] });
    expect(editCornerOverride(b.style, right, clickTopLeft.command)).toEqual({ fill: '#222222', fontSize: 28, cornerVisibility: [false, true, false, true] });
    const unchanged = { ...right, cornerVisibility: [false, true, false, true] as [boolean, boolean, boolean, boolean] };
    expect(editCornerOverride(b.style, unchanged, clickTopLeft.command)).toBe(unchanged);
  });

  it('state/action overrides initialize from each target, and removing one property leaves the other intact', () => {
    const { a, b } = mixed();
    const pa = editCornerOverride(a.style, { fill: '#111111' }, { kind: 'override', property: 'cornerVisibility' });
    const pb = editCornerOverride(b.style, { radius: 44 }, { kind: 'override', property: 'cornerVisibility' });
    expect(pa).toEqual({ fill: '#111111', cornerVisibility: [true, false, false, false] });
    expect(pb).toEqual({ radius: 44, cornerVisibility: [true, false, true, false] });
    expect(editCornerOverride(b.style, pb, { kind: 'inherit', property: 'cornerVisibility' })).toEqual({ radius: 44 });
    expect(editCornerOverride(b.style, pb, { kind: 'inherit', property: 'radius' })).toEqual({ cornerVisibility: [true, false, true, false] });
  });

  it('existing All Views effect graphs retain each target’s other states while replacing the full P21 map', () => {
    const { page, a, b } = mixed(); page.widgets = [a, b];
    a.selectedStyle = { fill: '#111111', cornerVisibility: [true, false, true, false] };
    b.selectedStyle = { fill: '#222222', cornerVisibility: [true, true, false, true] };
    a.errorStyle = { color: '#333333' }; b.errorStyle = { color: '#444444' };
    const visible = resolveAdaptiveWidgets(page, 'phone').map(w => ({ ...w, selectedStyle: editCornerOverride(w.style, w.selectedStyle!, clickTopLeft.command) }));
    const result = applyAdaptiveWidgetEdits(page, 'phone', visible, { allViews: true });
    expect(result.widgets[0].selectedStyle).toEqual({ fill: '#111111', cornerVisibility: [false, false, true, false] });
    expect(result.widgets[1].selectedStyle).toEqual({ fill: '#222222', cornerVisibility: [false, true, false, true] });
    expect(result.widgets.map(w => w.errorStyle)).toEqual([{ color: '#333333' }, { color: '#444444' }]);
  });
});

describe('corner editor capability and accessible controls', () => {
  it('keeps old vector snapshots without a mask untouched and exposes proven rectangles after aspect resize', () => {
    const w = createWidget('box'); w.vectorPath = rounded; w.width = 220; w.height = 70; const original = structuredClone(w);
    expect(supportsCornerEditing(w)).toBe(false); expect(renderToStaticMarkup(createElement(CornerEditor, { widget: w, onCommand: () => {} }))).toBe('');
    expect(w).toEqual(original);
    w.style.cornerVisibility = [true, true, true, true]; expect(supportsCornerEditing(w)).toBe(true);
    const arbitrary = createWidget('path'); arbitrary.style.cornerVisibility = [true, true, true, true]; expect(supportsCornerEditing(arbitrary)).toBe(false);
  });

  it('resetting a native vector mask keeps its explicit all-corners declaration and editing capability', () => {
    const w = createWidget('box'); w.vectorPath = rounded; w.style.cornerVisibility = [false, true, false, true];
    const intent: WidgetStyleEditIntent = { kind: 'corners', command: { kind: 'inherit', property: 'cornerVisibility' } };
    const result = edit(w, intent);
    expect(result.style.cornerVisibility).toEqual([true, true, true, true]); expect(supportsCornerEditing(result)).toBe(true);
    expect(resolveWidgetStyleCommand(result, {}, intent)).toEqual({});
    expect(editCornerOverride(result.style, { cornerVisibility: [false, true, false, true] }, { kind: 'inherit', property: 'cornerVisibility' })).toEqual({});
  });

  it('renders stable Base, effect and action labels with default all-corners enabled', () => {
    const w = createWidget('box'), base = renderToStaticMarkup(createElement(CornerEditor, { widget: w, onCommand: () => {} }));
    expect(base).toContain('aria-label="Radius"'); expect(base).toContain('aria-label="Corner visibility"'); expect(base.match(/checked=""/g)).toHaveLength(4);
    for (const prefix of ['MouseOver', 'Action 1']) {
      const markup = renderToStaticMarkup(createElement(CornerOverrides, { widget: w, patch: { radius: 2, cornerVisibility: [false, true, false, true] }, prefix, onChange: () => {} }));
      expect(markup).toContain(`aria-label="Override ${prefix} radius"`); expect(markup).toContain(`aria-label="Override ${prefix} corner visibility"`);
      expect(markup).toContain(`aria-label="${prefix} corner top left rounded"`); expect(markup).toContain(`aria-label="${prefix} radius"`);
    }
  });

  it('retains prior non-vector radius controls on types outside the new mask capability', () => {
    const doc = createDocument(), w = createWidget('ellipse');
    const markup = renderToStaticMarkup(createElement(Inspector, { document: doc, page: doc.pages[0], widget: w, onWidgetChange: () => {}, onPageChange: () => {} }));
    expect(markup).toContain('aria-label="Radius"'); expect(markup).not.toContain('aria-label="Corner visibility"');
  });
});
