import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { assignAdaptiveViewSet, commitAdaptivePage, resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import { createDocument, createPage, createWidget, findWidget, mapWidgets, parseDocument, serializeDocument } from '../src/model/document';
import type { AdaptiveView, Page, Widget, WidgetStyle } from '../src/model/types';

// The established entry point will receive this scope option. Keeping the
// options in a variable also lets the pre-implementation source run these
// behavioral regressions instead of failing at TypeScript's excess-key check.
const allViews: { allViews: boolean; placementAllViews?: boolean } = { allViews: true };
const green = '#008800';

function fixture() {
  const page = createPage('All views'), box = createWidget('box', 100, 80), untouched = createWidget('box', 420, 60);
  box.width = 240; box.height = 90;
  box.style = { ...box.style, fill: '#ffffff', color: '#111111', opacity: 1 };
  box.selectedStyle = { fill: '#ffff00' };
  page.widgets = [box, untouched];
  const ancestor: AdaptiveView = { id: 'all-tablet', name: 'Tablet', width: 768, overrides: {
    [box.id]: { x: 35, style: { fill: '#0000ff', color: '#222222', opacity: 0.9 }, stateStyles: { selected: { fill: '#aa0000' } } },
    [untouched.id]: { width: 150, style: { fill: '#abcdef' } },
  } };
  const child: AdaptiveView = { id: 'all-phone', name: 'Phone', width: 390, baseViewId: ancestor.id, overrides: {
    [box.id]: { y: 15, width: 110, hidden: true, placed: false, style: { fill: '#ff0000', color: '#333333', opacity: 0.8 }, stateStyles: {} },
  } };
  const sibling: AdaptiveView = { id: 'all-wide', name: 'Wide', width: 1000, overrides: {
    [box.id]: { height: 70, style: { fill: '#ff00ff', color: '#444444', opacity: 0.7 } },
  } };
  page.adaptiveViews = [ancestor, child, sibling];
  page.adaptiveOverrides = { 'inactive-view': {
    [box.id]: { x: 8, style: { fill: '#00ffff', color: '#555555', opacity: 0.6 }, stateStyles: { focused: {} } },
    [untouched.id]: { style: { fill: '#fedcba' } },
  } };
  return { page, box, untouched, ancestor, child, sibling };
}

function edit(page: Page, viewId: string | null, id: string, patch: Partial<WidgetStyle>) {
  return mapWidgets(structuredClone(resolveAdaptiveWidgets(page, viewId)), widget => widget.id === id ? { ...widget, style: { ...widget.style, ...patch } } : widget);
}

function clearStyleKeyExpected(page: Page, id: string, key: keyof WidgetStyle, value: string | number) {
  const expected = structuredClone(page);
  const widget = findWidget(expected, id)!;
  Object.assign(widget.style, { [key]: value });
  for (const map of [...expected.adaptiveViews.map(view => view.overrides), ...Object.values(expected.adaptiveOverrides ?? {})]) {
    if (map[id]?.style) delete map[id].style![key];
  }
  return expected;
}

function roundTrip(page: Page) {
  const doc = createDocument(); doc.pages = [page];
  return parseDocument(serializeDocument(doc)).pages[0];
}

describe('Affect all views: actual normal-style edits', () => {
  it('writes only changed fill to Base and clears that declaration in ancestors, siblings and inactive views', () => {
    const { page, box, child } = fixture(), before = structuredClone(page);
    const changed = applyAdaptiveWidgetEdits(page, child.id, edit(page, child.id, box.id, { fill: green }), allViews);
    expect(changed).toEqual(clearStyleKeyExpected(page, box.id, 'fill', green));
    expect(roundTrip(changed)).toEqual(changed);
    expect(page).toEqual(before);
  });

  it('also clears named and inactive fill declarations when the actual edit originates in Base', () => {
    const { page, box } = fixture();
    const changed = applyAdaptiveWidgetEdits(page, null, edit(page, null, box.id, { fill: green }), allViews);
    expect(changed).toEqual(clearStyleKeyExpected(page, box.id, 'fill', green));
    for (const view of changed.adaptiveViews) expect(resolveAdaptiveWidgets(changed, view.id)[0].style.fill).toBe(green);
  });

  it.each([['color', '#123456'], ['opacity', 0.45]] as const)('clears only the changed %s scalar; fill, geometry and entire effect maps survive', (key, value) => {
    const { page, box, child } = fixture();
    const changed = applyAdaptiveWidgetEdits(page, child.id, edit(page, child.id, box.id, { [key]: value }), allViews);
    expect(changed).toEqual(clearStyleKeyExpected(page, box.id, key, value));
    expect(changed.adaptiveViews[1].overrides[box.id].stateStyles).toEqual({});
    expect(changed.widgets[0].selectedStyle).toEqual(box.selectedStyle);
  });

  it('does not promote unrelated effective values or clear an unchanged widget when a full effective tree is submitted', () => {
    const { page, box, untouched, child } = fixture();
    const changed = applyAdaptiveWidgetEdits(page, child.id, edit(page, child.id, box.id, { fill: green }), allViews);
    expect(changed.widgets[0]).toEqual({ ...box, style: { ...box.style, fill: green } });
    expect(changed.widgets[1]).toEqual(untouched);
    for (let i = 0; i < page.adaptiveViews.length; i++) expect(changed.adaptiveViews[i].overrides[untouched.id]).toEqual(page.adaptiveViews[i].overrides[untouched.id]);
    expect(changed.adaptiveOverrides!['inactive-view'][untouched.id]).toEqual(page.adaptiveOverrides!['inactive-view'][untouched.id]);
  });

  it('returns the original page for an unchanged effective tree without erasing explicit declarations', () => {
    const { page, child } = fixture();
    const changed = applyAdaptiveWidgetEdits(page, child.id, structuredClone(resolveAdaptiveWidgets(page, child.id)), allViews);
    expect(changed).toBe(page);
  });

  it('shares a notes edit without treating inherited normal style or the empty state-map barrier as a global style edit', () => {
    const { page, box, child } = fixture(), widgets = structuredClone(resolveAdaptiveWidgets(page, child.id));
    widgets[0].notes = 'Shared content only';
    const changed = applyAdaptiveWidgetEdits(page, child.id, widgets, allViews);
    const expected = structuredClone(page); expected.widgets[0].notes = 'Shared content only';
    expect(changed).toEqual(expected);
    expect(changed.widgets[0].style).toEqual(box.style);
  });

  it.each(['panel', 'repeater'] as const)('edits a %s child without promoting its local position or its parent paint', type => {
    const { page, box, child } = fixture(), parent = createWidget(type);
    if (type === 'panel') parent.states![0].widgets = [box];
    else parent.repeater!.template = [box];
    page.widgets = [parent];
    // This fixture removes the unrelated root together with its declarations.
    for (const map of [...page.adaptiveViews.map(view => view.overrides), ...Object.values(page.adaptiveOverrides ?? {})]) {
      for (const id of Object.keys(map)) if (id !== box.id) delete map[id];
    }
    child.overrides[parent.id] = { style: { fill: '#667788' } };
    const changed = applyAdaptiveWidgetEdits(page, child.id, edit(page, child.id, box.id, { fill: green }), allViews);
    expect(changed).toEqual(clearStyleKeyExpected(page, box.id, 'fill', green));
    expect(findWidget(changed, box.id)).toMatchObject({ x: 100, y: 80, width: 240, height: 90, style: { fill: green } });
    expect(changed.widgets[0].style).toEqual(parent.style);
  });

  it('commits shared-set declarations only to the edited page, including inactive maps, and round-trips', () => {
    const { page, box, child } = fixture(), doc = createDocument(), other = createPage('Same set, another page'), otherBox = createWidget('box');
    other.widgets = [otherBox]; doc.pages = [page, other];
    const definitions = page.adaptiveViews.map(({ overrides: _overrides, ...view }) => view);
    doc.adaptiveViewSets = [{ id: 'shared-set', name: 'Shared set', baseSize: { width: 1200, height: 0 }, views: definitions }];
    const maps = Object.fromEntries(page.adaptiveViews.map(view => [view.id, view.overrides]));
    page.adaptiveViews = []; delete page.adaptiveSelection; delete page.adaptiveBaseSize;
    page.adaptiveViewSetId = 'shared-set'; page.adaptiveOverrides = { ...page.adaptiveOverrides, ...maps };
    const assigned = assignAdaptiveViewSet(doc, other.id, 'shared-set');
    assigned.pages[1].adaptiveOverrides = { [child.id]: { [otherBox.id]: { style: { fill: '#aabbcc' } } } };
    const before = structuredClone(assigned), projected = resolveAdaptivePage(assigned, assigned.pages[0]);
    const changed = applyAdaptiveWidgetEdits(projected, child.id, edit(projected, child.id, box.id, { fill: green }), allViews);
    const committed = commitAdaptivePage(assigned, changed), read = parseDocument(serializeDocument(committed));
    expect(read.pages[0].widgets[0].style.fill).toBe(green);
    for (const map of Object.values(read.pages[0].adaptiveOverrides!)) expect(map[box.id]?.style).not.toHaveProperty('fill');
    expect(read.pages[1]).toEqual(before.pages[1]);
    expect(read.adaptiveViewSets).toEqual(before.adaptiveViewSets);
    expect(read).toEqual(committed); expect(assigned).toEqual(before);
  });

  it('keeps current-view editing as the default when no all-views scope is supplied', () => {
    const { page, box, child } = fixture();
    const changed = applyAdaptiveWidgetEdits(page, child.id, edit(page, child.id, box.id, { fill: green }));
    expect(changed.widgets[0]).toEqual(box);
    expect(changed.adaptiveViews[1].overrides[box.id].style!.fill).toBe(green);
    expect(changed.adaptiveViews[0]).toEqual(page.adaptiveViews[0]);
    expect(changed.adaptiveViews[2]).toEqual(page.adaptiveViews[2]);
    expect(changed.adaptiveOverrides).toEqual(page.adaptiveOverrides);
  });
});

describe('Affect all views: native point and size property groups', () => {
  it.each(['x', 'y', 'width', 'height'] as const)('a changed %s writes the full effective group to Base and clears only that group everywhere', field => {
    const { page, box, child } = fixture(), visible = structuredClone(resolveAdaptiveWidgets(page, child.id));
    visible[0][field] += 21.5;
    const fields = field === 'x' || field === 'y' ? ['x', 'y'] as const : ['width', 'height'] as const;
    const expected = structuredClone(page);
    for (const key of fields) {
      expected.widgets[0][key] = visible[0][key];
      for (const map of [...expected.adaptiveViews.map(view => view.overrides), ...Object.values(expected.adaptiveOverrides ?? {})]) if (map[box.id]) delete map[box.id][key];
    }
    expect(applyAdaptiveWidgetEdits(page, child.id, visible, allViews)).toEqual(expected);
  });

  it('compares to effective geometry: submitting the same point/size does not clear declarations even when Base differs', () => {
    const { page, child } = fixture();
    expect(applyAdaptiveWidgetEdits(page, child.id, structuredClone(resolveAdaptiveWidgets(page, child.id)), allViews)).toBe(page);
  });

  it('recomputing a gesture from its starting page restores all declarations when the pointer returns to origin', () => {
    const { page, child } = fixture(), original = structuredClone(resolveAdaptiveWidgets(page, child.id));
    const moved = structuredClone(original); moved[0].x += 40; moved[0].y += 25;
    const firstFrame = applyAdaptiveWidgetEdits(page, child.id, moved, allViews);
    expect(firstFrame.widgets[0]).toMatchObject({ x: moved[0].x, y: moved[0].y });
    // App must use the gesture's original document for every frame, not firstFrame.
    const returned = applyAdaptiveWidgetEdits(page, child.id, original, allViews);
    expect(returned).toBe(page);
  });
});

describe('Affect all views: complete native state map and explicit rich-text commands', () => {
  it('writes the edited effective state map to Base and clears complete maps everywhere, without touching normal style', () => {
    const { page, box, child } = fixture();
    child.overrides[box.id].stateStyles = { selected: { fill: '#aa0000' }, mouseOver: { color: '#004400' } };
    const visible = structuredClone(resolveAdaptiveWidgets(page, child.id));
    visible[0].selectedStyle = { fill: green };
    const expected = structuredClone(page);
    expected.widgets[0].selectedStyle = { fill: green }; expected.widgets[0].mouseOverStyle = { color: '#004400' };
    for (const map of [...expected.adaptiveViews.map(view => view.overrides), ...Object.values(expected.adaptiveOverrides ?? {})]) if (map[box.id]) delete map[box.id].stateStyles;
    const changed = applyAdaptiveWidgetEdits(page, child.id, visible, allViews);
    expect(changed).toEqual(expected); expect(roundTrip(changed)).toEqual(changed);
  });

  it('preserves other effective states when one is removed, including a surviving empty state object', () => {
    const { page, box, child } = fixture();
    child.overrides[box.id].stateStyles = { selected: { fill: '#ff0000' }, focused: {}, disabled: { color: '#808080' } };
    const visible = structuredClone(resolveAdaptiveWidgets(page, child.id)); delete visible[0].selectedStyle;
    const changed = applyAdaptiveWidgetEdits(page, child.id, visible, allViews);
    expect(changed.widgets[0]).not.toHaveProperty('selectedStyle');
    expect(changed.widgets[0].focusedStyle).toEqual({});
    expect(changed.widgets[0].disabledStyle).toEqual({ color: '#808080' });
    for (const map of [...changed.adaptiveViews.map(view => view.overrides), ...Object.values(changed.adaptiveOverrides ?? {})]) expect(map[box.id]).not.toHaveProperty('stateStyles');
  });

  it('an unchanged effective state map leaves every local whole-map barrier intact', () => {
    const { page, box, child } = fixture();
    child.overrides[box.id].stateStyles = { focused: {}, selected: { fill: '#aa0000' } };
    const visible = structuredClone(resolveAdaptiveWidgets(page, child.id));
    visible[0].selectedStyle = { fill: '#aa0000' };
    expect(applyAdaptiveWidgetEdits(page, child.id, visible, allViews)).toBe(page);
  });

  it('the native first-effect path stays local behind an empty-map barrier, preserving Base and other maps', () => {
    const { page, box, child } = fixture(), visible = structuredClone(resolveAdaptiveWidgets(page, child.id));
    visible[0].focusedStyle = {};
    const changed = applyAdaptiveWidgetEdits(page, child.id, visible, allViews);
    const expected = structuredClone(page); expected.adaptiveViews[1].overrides[box.id].stateStyles = { focused: {} };
    expect(changed).toEqual(expected); expect(changed.widgets[0]).toEqual(box);
  });

  it('an empty individual state counts as an existing graph for the ordinary full-map All Views path', () => {
    const { page, box, child } = fixture(); child.overrides[box.id].stateStyles = { focused: {} };
    const visible = structuredClone(resolveAdaptiveWidgets(page, child.id)); visible[0].selectedStyle = { fill: green };
    const changed = applyAdaptiveWidgetEdits(page, child.id, visible, allViews);
    expect(changed.widgets[0].selectedStyle).toEqual({ fill: green }); expect(changed.widgets[0].focusedStyle).toEqual({});
    for (const map of [...changed.adaptiveViews.map(view => view.overrides), ...Object.values(changed.adaptiveOverrides ?? {})]) expect(map[box.id]).not.toHaveProperty('stateStyles');
  });

  it('first effects remain local while a normal-style edit in the same transaction still affects all views', () => {
    const { page, box, child } = fixture(), visible = edit(page, child.id, box.id, { fill: green });
    visible[0].focusedStyle = {};
    const expected = clearStyleKeyExpected(page, box.id, 'fill', green); expected.adaptiveViews[1].overrides[box.id].stateStyles = { focused: {} };
    expect(applyAdaptiveWidgetEdits(page, child.id, visible, allViews)).toEqual(expected);
  });

  it('first effects added in Base preserve child empty-map barriers', () => {
    const { page, box } = fixture(); delete box.selectedStyle;
    const visible = structuredClone(page.widgets); visible[0].mouseDownStyle = { color: '#123456' };
    const expected = structuredClone(page); expected.widgets[0].mouseDownStyle = { color: '#123456' };
    expect(applyAdaptiveWidgetEdits(page, null, visible, allViews)).toEqual(expected);
  });

  it('applies an explicit normal reset to raw Base runs, preserving mixed colors, link IDs and unrelated view fonts', () => {
    const { page, box, child } = fixture();
    box.text = 'Link and text'; box.richText = { expressionMode: 'literal', links: [{ id: 'all-link', name: 'Link', interactions: [] }], paragraphs: [{ lineHeightPx: 28, runs: [
      { text: 'Link', linkId: 'all-link', style: { fontStyle: 'italic', color: '#123456' } },
      { text: ' and text', style: { fontStyle: 'italic', color: '#654321' } },
    ] }] };
    for (const view of page.adaptiveViews) view.overrides[box.id].style = { ...view.overrides[box.id].style, fontStyle: 'normal', fontSize: 24 };
    page.adaptiveOverrides!['inactive-view'][box.id].style!.fontStyle = 'italic';
    const visible = structuredClone(resolveAdaptiveWidgets(page, child.id));
    const changed = applyAdaptiveWidgetEdits(page, child.id, visible, { ...allViews, explicitTextStyle: { fontStyle: 'normal' }, explicitTextWidgetIds: [box.id] });
    expect(changed.widgets[0].richText).toEqual({ ...box.richText, paragraphs: [{ ...box.richText.paragraphs[0], runs: box.richText.paragraphs[0].runs.map(run => ({ ...run, style: { ...run.style, fontStyle: 'normal' } })) }] });
    expect(changed.widgets[0].style).toEqual({ ...box.style, fontStyle: 'normal' });
    for (const view of changed.adaptiveViews) { expect(view.overrides[box.id].style).not.toHaveProperty('fontStyle'); expect(view.overrides[box.id].style!.fontSize).toBe(24); }
    expect(changed.adaptiveOverrides!['inactive-view'][box.id].style).not.toHaveProperty('fontStyle');
    expect(roundTrip(changed)).toEqual(changed);
  });

  it('a repeated font command with uniform matching raw runs and matching outer style is a true no-op', () => {
    const { page, box, child } = fixture();
    box.text = 'Already twenty'; box.style.fontSize = 20;
    box.richText = { paragraphs: [{ runs: [{ text: 'Already ', style: { fontSize: 20 } }, { text: 'twenty' }] }] };
    child.overrides[box.id].style!.fontSize = 20;
    page.adaptiveViews[0].overrides[box.id].style!.fontSize = 24;
    page.adaptiveOverrides!['inactive-view'][box.id].style!.fontSize = 30;
    const visible = structuredClone(resolveAdaptiveWidgets(page, child.id));
    expect(applyAdaptiveWidgetEdits(page, child.id, visible, { ...allViews, explicitTextStyle: { fontSize: 20 }, explicitTextWidgetIds: [box.id] })).toBe(page);
  });

  it('an equal normal command does not add explicit normal fields to already-upright runs or erase other views', () => {
    const { page, box, child } = fixture();
    box.text = 'Upright'; box.richText = { paragraphs: [{ runs: [{ text: 'Upright' }] }] };
    child.overrides[box.id].style!.fontStyle = 'normal';
    page.adaptiveOverrides!['inactive-view'][box.id].style!.fontStyle = 'italic';
    expect(applyAdaptiveWidgetEdits(page, child.id, structuredClone(resolveAdaptiveWidgets(page, child.id)), { ...allViews, explicitTextStyle: { fontStyle: 'normal' }, explicitTextWidgetIds: [box.id] })).toBe(page);
  });

  it('decides equal rich resets per target, retaining the already-matching widget and its declarations', () => {
    const { page, box, untouched, child } = fixture();
    for (const widget of [box, untouched]) { widget.text = 'Word'; widget.richText = { paragraphs: [{ runs: [{ text: 'Word' }] }] }; }
    box.richText!.paragraphs[0].runs[0].style = { fontStyle: 'italic' };
    child.overrides[box.id].style!.fontStyle = 'normal';
    child.overrides[untouched.id] = { style: { fontStyle: 'normal' } };
    page.adaptiveOverrides!['inactive-view'][untouched.id].style!.fontStyle = 'italic';
    const before = structuredClone(page);
    const changed = applyAdaptiveWidgetEdits(page, child.id, structuredClone(resolveAdaptiveWidgets(page, child.id)), { ...allViews, explicitTextStyle: { fontStyle: 'normal' }, explicitTextWidgetIds: [box.id, untouched.id] });
    expect(changed.widgets[0].richText!.paragraphs[0].runs[0].style!.fontStyle).toBe('normal');
    expect(changed.widgets[1]).toEqual(before.widgets[1]);
    expect(changed.adaptiveViews[1].overrides[untouched.id]).toEqual(before.adaptiveViews[1].overrides[untouched.id]);
    expect(changed.adaptiveOverrides!['inactive-view'][untouched.id]).toEqual(before.adaptiveOverrides!['inactive-view'][untouched.id]);
  });

  it('an explicit line-height reset clears raw paragraph heights even when the outer multiplier is unchanged', () => {
    const { page, box, child } = fixture(); box.text = 'Paragraph'; box.style.lineHeight = 1.5;
    box.richText = { paragraphs: [{ lineHeightPx: 30, runs: [{ text: 'Paragraph', style: { color: '#123456' } }] }] };
    child.overrides[box.id].style!.lineHeight = 1.5;
    const changed = applyAdaptiveWidgetEdits(page, child.id, structuredClone(resolveAdaptiveWidgets(page, child.id)), { ...allViews, explicitTextStyle: { lineHeight: 1.5 }, explicitTextWidgetIds: [box.id] });
    expect(changed.widgets[0].richText!.paragraphs[0]).not.toHaveProperty('lineHeightPx');
    expect(changed.widgets[0].richText!.paragraphs[0].runs[0].style!.color).toBe('#123456');
    expect(changed.adaptiveViews[1].overrides[box.id].style).not.toHaveProperty('lineHeight');
  });

  it('an interaction action style edit changes only the shared graph, never target declarations or run formatting', () => {
    const { page, box, child } = fixture(), visible = structuredClone(resolveAdaptiveWidgets(page, child.id));
    const interaction: Widget['interactions'][number] = { id: 'all-click', event: 'click', name: 'Paint later', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'all-action', type: 'setStyle', targetId: box.id, style: { fill: green } }] };
    visible[0].interactions = [interaction];
    const expected = structuredClone(page); expected.widgets[0].interactions = [interaction];
    expect(applyAdaptiveWidgetEdits(page, child.id, visible, allViews)).toEqual(expected);
  });
});

describe('Affect all views: existing product reset pairs', () => {
  it.each(['fill', 'stroke', 'radius', 'strokeWidth'] as const)('a %s reset clears its richer carrier in Base and every view without disturbing other groups', property => {
    const { page, box, child } = fixture();
    const gradient = { type: 'linear' as const, start: { x: 0.1, y: -0.2 }, end: { x: 1.4, y: 0.6 }, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] };
    const richer = property === 'fill' ? 'fillGradient' : property === 'stroke' ? 'strokeGradient' : property === 'radius' ? 'cornerRadii' : 'borderWidths';
    const value = property === 'fill' || property === 'stroke' ? gradient : [2, 3, 4, 5];
    Object.assign(box.style, { [richer]: value });
    for (const map of [...page.adaptiveViews.map(view => view.overrides), ...Object.values(page.adaptiveOverrides ?? {})]) map[box.id].style = { ...map[box.id].style, [richer]: structuredClone(value) };
    const visible = structuredClone(resolveAdaptiveWidgets(page, child.id)); delete visible[0].style[richer];
    const changed = applyAdaptiveWidgetEdits(page, child.id, visible, allViews);
    expect(changed.widgets[0].style).not.toHaveProperty(richer);
    expect(changed.widgets[0].style[property]).toBe(visible[0].style[property]);
    for (const map of [...changed.adaptiveViews.map(view => view.overrides), ...Object.values(changed.adaptiveOverrides ?? {})]) {
      expect(map[box.id].style).not.toHaveProperty(richer); expect(map[box.id].style).not.toHaveProperty(property);
    }
    expect(changed.adaptiveViews[1].overrides[box.id].stateStyles).toEqual({});
    expect(roundTrip(changed)).toEqual(changed);
  });
});
