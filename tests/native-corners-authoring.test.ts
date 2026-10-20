import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { assignAdaptiveViewSet, resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import { createDocument, createPage, createWidget, cloneWidgets, mergeWidgetStyle, parseDocument, parseWidgetStylePatch, resolveInteractionStyle, serializeDocument } from '../src/model/document';
import { createComponent, createComponentInstance, updateComponent } from '../src/model/components';
import type { WidgetStyle } from '../src/model/types';

const mask = [true, false, true, false] as [boolean, boolean, boolean, boolean];
function fixture() {
  const doc = createDocument(), page = createPage('Native corners'), box = createWidget('box');
  box.id = 'native-corner-box'; box.style.radius = 8; box.style.cornerVisibility = [...mask];
  page.widgets = [box]; doc.pages = [page];
  page.adaptiveViews = [
    { id: 'corner-tablet', name: 'Tablet', width: 768, overrides: { [box.id]: { style: { radius: 16, cornerVisibility: [false, true, false, true], fill: '#123456' } } } },
    { id: 'corner-phone', name: 'Phone', width: 390, baseViewId: 'corner-tablet', overrides: { [box.id]: { style: { radius: 24, cornerVisibility: [true, true, false, false] } } } },
  ];
  page.adaptiveOverrides = { inactive: { [box.id]: { style: { radius: 32, cornerVisibility: [false, false, true, true], color: '#345678' } } } };
  return { doc, page, box };
}

describe('independent native radius and corner mask authoring', () => {
  it('preserves old omitted fields and legacy independent radii without migration', () => {
    const doc = createDocument(), box = createWidget('box'); box.style.cornerRadii = [1, 2, 3, 4]; doc.pages[0].widgets = [box];
    expect(serializeDocument(doc)).not.toContain('cornerVisibility');
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('round-trips masks across normal, states, actions, views, shared styles and component definitions', () => {
    const { doc, page, box } = fixture();
    box.selectedStyle = { cornerVisibility: [false, true, false, true] };
    box.mouseOverStyle = { radius: 0, cornerVisibility: [false, false, false, false] };
    box.interactions = [{ id: 'corner-event', event: 'click', name: 'Corners', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'corner-action', type: 'setStyle', targetId: box.id, style: { cornerVisibility: [true, true, true, true] } }] }];
    page.adaptiveViews[1].overrides[box.id].stateStyles = { error: { cornerVisibility: [...mask] } };
    doc.styles = [{ id: 'corner-preset', name: 'Corner preset', style: structuredClone(box.style) }];
    const component = createComponent([box]); doc.components = [component];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it.each([null, {}, [], [true], [true, false, true], [true, false, true, false, true], [true, false, 1, false], [true, 'false', true, false]])('rejects invalid mask %j at the shared style parser', value => {
    expect(() => parseWidgetStylePatch({ cornerVisibility: value })).toThrow(/cornerVisibility/);
  });

  it('uniform radius resets legacy radii while preserving the independent native mask', () => {
    const { box } = fixture(); box.style.cornerRadii = [3, 4, 5, 6];
    const next = mergeWidgetStyle(box.style, { radius: 10 });
    expect(next.radius).toBe(10); expect(next).not.toHaveProperty('cornerRadii');
    expect(next.cornerVisibility).toEqual(mask);
    expect(mergeWidgetStyle(box.style, { cornerVisibility: [true, true, true, true] })).toMatchObject({ radius: 8, cornerRadii: [3, 4, 5, 6] });
  });

  it('composes mask and uniform-radius state layers independently and keeps legacy tuple reset semantics', () => {
    const { box } = fixture(); box.style.cornerRadii = [3, 4, 5, 6];
    box.mouseOverStyle = { cornerVisibility: [false, true, true, false] };
    box.selected = true; box.selectedStyle = { radius: 12 };
    const current = resolveInteractionStyle(box, { mouseOver: true });
    expect(current).toMatchObject({ radius: 12, cornerVisibility: [false, true, true, false] });
    expect(current).not.toHaveProperty('cornerRadii');
    expect(box.style.cornerRadii).toEqual([3, 4, 5, 6]);
  });

  it('current-view mask edits keep inherited radius and save an explicit all-corners reset', () => {
    const { page, box } = fixture(), widgets = resolveAdaptiveWidgets(page, 'corner-phone');
    widgets[0].style.cornerVisibility = undefined;
    const result = applyAdaptiveWidgetEdits(page, 'corner-phone', widgets);
    expect(result.adaptiveViews[1].overrides[box.id].style).toEqual({ radius: 24, cornerVisibility: [true, true, true, true] });
    expect(resolveAdaptiveWidgets(result, 'corner-phone')[0].style.cornerVisibility).toEqual([true, true, true, true]);
    expect(result.widgets).toEqual(page.widgets);
  });

  it('All Views radius edits clear P71 only, keeping every P81 declaration', () => {
    const { page, box } = fixture(), widgets = resolveAdaptiveWidgets(page, 'corner-phone');
    widgets[0].style = mergeWidgetStyle(widgets[0].style, { radius: 48 });
    const result = applyAdaptiveWidgetEdits(page, 'corner-phone', widgets, { allViews: true });
    expect(result.widgets[0].style).toMatchObject({ radius: 48, cornerVisibility: mask });
    for (let i = 0; i < page.adaptiveViews.length; i++) {
      expect(result.adaptiveViews[i].overrides[box.id].style).not.toHaveProperty('radius');
      expect(result.adaptiveViews[i].overrides[box.id].style?.cornerVisibility).toEqual(page.adaptiveViews[i].overrides[box.id].style?.cornerVisibility);
    }
    expect(result.adaptiveOverrides!.inactive[box.id].style).toEqual({ cornerVisibility: [false, false, true, true], color: '#345678' });
  });

  it('All Views mask edits clear P81 only, preserving all unrelated radii and paints', () => {
    const { page, box } = fixture(), widgets = resolveAdaptiveWidgets(page, 'corner-phone');
    widgets[0].style.cornerVisibility = [false, true, false, false];
    const result = applyAdaptiveWidgetEdits(page, 'corner-phone', widgets, { allViews: true });
    expect(result.widgets[0].style).toMatchObject({ radius: 8, cornerVisibility: [false, true, false, false] });
    expect(result.adaptiveViews.map(v => v.overrides[box.id].style)).toEqual([{ radius: 16, fill: '#123456' }, { radius: 24 }]);
    expect(result.adaptiveOverrides!.inactive[box.id].style).toEqual({ radius: 32, color: '#345678' });
  });

  it('retains a local all-true declaration when its ancestor later matches it', () => {
    const { page, box } = fixture(); page.adaptiveViews[1].overrides[box.id].style!.cornerVisibility = [true, true, true, true];
    page.adaptiveViews[0].overrides[box.id].style!.cornerVisibility = [true, true, true, true];
    const widgets = resolveAdaptiveWidgets(page, 'corner-phone'); widgets[0].notes = 'Only notes';
    const result = applyAdaptiveWidgetEdits(page, 'corner-phone', widgets);
    expect(result.adaptiveViews[1].overrides[box.id].style?.cornerVisibility).toEqual([true, true, true, true]);
  });

  it('same-effective radius and mask commands leave the entire All Views document unchanged', () => {
    const { page } = fixture();
    expect(applyAdaptiveWidgetEdits(page, 'corner-phone', resolveAdaptiveWidgets(page, 'corner-phone'), { allViews: true })).toBe(page);
  });

  it('shared-set reassignment preserves a source mask when the target only changes radius', () => {
    const { doc, page, box } = fixture(); page.adaptiveViewSetId = 'from'; page.adaptiveViews = [];
    doc.adaptiveViewSets = [{ id: 'from', name: 'From', baseSize: { width: 0, height: 0 }, views: [{ id: 'from-phone', name: 'Phone', width: 390 }] }, { id: 'to', name: 'To', baseSize: { width: 0, height: 0 }, views: [{ id: 'to-phone', name: 'Phone', width: 390 }] }];
    page.adaptiveOverrides = { 'from-phone': { [box.id]: { style: { cornerVisibility: [...mask], cornerRadii: [2, 3, 4, 5] } } }, 'to-phone': { [box.id]: { style: { radius: 25 } } } };
    const result = assignAdaptiveViewSet(doc, page.id, 'to'), visible = resolveAdaptiveWidgets(resolveAdaptivePage(result, result.pages[0]), 'to-phone')[0];
    expect(visible.style).toMatchObject({ radius: 25, cornerVisibility: mask }); expect(visible.style).not.toHaveProperty('cornerRadii');
  });

  it('cloning and component updates preserve mask identities and independent instance styles', () => {
    const { doc, box } = fixture(), clone = cloneWidgets([box])[0]; expect(clone.id).not.toBe(box.id); expect(clone.style.cornerVisibility).toEqual(mask);
    const component = createComponent([box]), instance = createComponentInstance(component); instance.style.cornerVisibility = [true, false, false, true];
    doc.components = [component]; doc.pages[0].widgets = [instance]; doc.pages[0].adaptiveViews = []; delete doc.pages[0].adaptiveOverrides;
    const changed = updateComponent(doc, { ...component, widgets: component.widgets.map(w => ({ ...w, style: { ...w.style, radius: 31, cornerVisibility: [false, true, true, false] as WidgetStyle['cornerVisibility'] } })) });
    expect(changed.pages[0].widgets[0].style.cornerVisibility).toEqual([true, false, false, true]);
    expect(changed.pages[0].widgets[0].states![0].widgets[0].style.cornerVisibility).toEqual([false, true, true, false]);
    expect(parseDocument(serializeDocument(changed))).toEqual(changed);
  });
});
