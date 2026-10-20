import { describe, expect, it } from 'vitest';
import { resolveWidgetStyleCommand, type WidgetStyleEditIntent } from '../src/components/widget-style-command';
import { applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createDocument, createPage, createWidget, mergeWidgetStyle, parseDocument, serializeDocument } from '../src/model/document';
import { patchTableCells } from '../src/model/table';
import { patchWidgetTextStyle } from '../src/model/rich-text';
import type { Page, Widget, WidgetStyle } from '../src/model/types';

const intent: WidgetStyleEditIntent = { kind: 'textPaddingSide', side: 'right', value: 40 };
const firstWidgetPatch: Partial<WidgetStyle> = { textPadding: [11, 40, 13, 14] };
function fixture() {
  const page = createPage('Mixed padding');
  const widgets = [createWidget('box'), createWidget('box'), createWidget('box')];
  widgets.forEach((widget, index) => { widget.id = ['a', 'b', 'noop'][index]; });
  widgets[0].style.textPadding = [1, 2, 3, 4];
  widgets[1].style.textPadding = [51, 52, 53, 54];
  widgets[2].style.textPadding = [81, 82, 83, 84];
  page.widgets = widgets;
  page.adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: {
    a: { style: { textPadding: [11, 12, 13, 14] } },
    b: { x: 123, style: { textPadding: [61, 62, 63, 64], fill: '#123456' } },
    noop: { style: { textPadding: [91, 40, 93, 94] }, stateStyles: {} },
  } }];
  page.adaptiveOverrides = { inactive: {
    a: { style: { textPadding: [21, 22, 23, 24] } },
    b: { style: { textPadding: [71, 72, 73, 74], color: '#345678' } },
    noop: { style: { textPadding: [101, 102, 103, 104] }, hidden: true },
  } };
  return page;
}
function edited(widget: Widget, patch = firstWidgetPatch, commandIntent: WidgetStyleEditIntent | undefined = intent): Widget {
  return { ...widget, style: mergeWidgetStyle(widget.style, resolveWidgetStyleCommand(widget, patch, commandIntent)) };
}
function editPage(page: Page, viewId: string | null, allViews: boolean) {
  return applyAdaptiveWidgetEdits(page, viewId, resolveAdaptiveWidgets(page, viewId).map(w => edited(w)), { allViews });
}

describe('per-target padding-side authoring commands', () => {
  it('All Views changes only the requested edge and preserves every target’s other declarations', () => {
    const original = fixture(), snapshot = structuredClone(original), result = editPage(original, 'phone', true);
    expect(result.widgets[0].style.textPadding).toEqual([1, 40, 3, 4]);
    expect(result.widgets[1].style.textPadding).toEqual([51, 40, 53, 54]);
    expect(result.adaptiveViews[0].overrides.b).toEqual({ x: 123, style: { fill: '#123456' }, textPaddingSides: { top: 61, bottom: 63, left: 64 } });
    expect(result.adaptiveOverrides!.inactive.b).toEqual({ style: { color: '#345678' }, textPaddingSides: { top: 71, bottom: 73, left: 74 } });
    expect(result.widgets[2]).toEqual(original.widgets[2]);
    expect(result.adaptiveViews[0].overrides.noop).toEqual(original.adaptiveViews[0].overrides.noop);
    expect(result.adaptiveOverrides!.inactive.noop).toEqual(original.adaptiveOverrides!.inactive.noop);
    const doc = createDocument(); doc.pages = [result];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(original).toEqual(snapshot);
  });

  it('current-view edits keep other targets’ edges and all inactive/Base declarations', () => {
    const original = fixture(), result = editPage(original, 'phone', false);
    expect(result.widgets).toEqual(original.widgets);
    expect(result.adaptiveOverrides).toEqual(original.adaptiveOverrides);
    expect(result.adaptiveViews[0].overrides.b).toEqual({ x: 123, style: { fill: '#123456' }, textPaddingSides: { top: 61, right: 40, bottom: 63, left: 64 } });
    expect(resolveAdaptiveWidgets(result, 'phone').map(w => w.style.textPadding)).toEqual([[11, 40, 13, 14], [61, 40, 63, 64], [91, 40, 93, 94]]);
    expect(result.adaptiveViews[0].overrides.noop).toEqual(original.adaptiveViews[0].overrides.noop);
  });

  it('Base side edits preserve each target’s own padding and leave all overrides alone', () => {
    const original = fixture(), result = editPage(original, null, false);
    expect(result.widgets.map(w => w.style.textPadding)).toEqual([[1, 40, 3, 4], [51, 40, 53, 54], [81, 40, 83, 84]]);
    expect(result.adaptiveViews).toEqual(original.adaptiveViews);
    expect(result.adaptiveOverrides).toEqual(original.adaptiveOverrides);
  });

  it.each([false, true])('a same-value target is a true no-op when allViews=%s', allViews => {
    const page = fixture(); page.widgets = [page.widgets[2]];
    page.adaptiveViews[0].overrides = { noop: page.adaptiveViews[0].overrides.noop };
    page.adaptiveOverrides!.inactive = { noop: page.adaptiveOverrides!.inactive.noop };
    const result = editPage(page, 'phone', allViews);
    // The existing current-view path can return an equal copy. App's history guard
    // compares serialized documents; no override or saved byte may change here.
    expect(JSON.stringify(result)).toBe(JSON.stringify(page));
    if (allViews) expect(result).toBe(page);
  });

  it.each(['box', 'input', 'textarea', 'select'] as const)('uses the %s target’s fallback and does not materialize a same-value default', type => {
    const widget = createWidget(type); delete widget.style.textPadding;
    const fallback = type === 'box' ? 5 : 7;
    expect(edited(widget).style.textPadding).toEqual([fallback, 40, fallback, fallback]);
    expect(resolveWidgetStyleCommand(widget, firstWidgetPatch, { ...intent, value: fallback })).toEqual({});
    expect(widget.style).not.toHaveProperty('textPadding');
  });

  it('retains explicit full-tuple commands without a single-side intent', () => {
    const widget = fixture().widgets[1];
    expect(resolveWidgetStyleCommand(widget, firstWidgetPatch)).toBe(firstWidgetPatch);
    expect(resolveWidgetStyleCommand(widget, { textPadding: undefined })).toEqual({ textPadding: undefined });
  });

  it.each(['top', 'bottom', 'left'] as const)('resolves a %s control against the target rather than the Inspector tuple', side => {
    const widget = fixture().widgets[1], index = ['top', 'right', 'bottom', 'left'].indexOf(side);
    const expected = [51, 52, 53, 54]; expected[index] = 0;
    expect(edited(widget, firstWidgetPatch, { kind: 'textPaddingSide', side, value: 0 }).style.textPadding).toEqual(expected);
  });

  it('the Base typography command path keeps per-target padding without altering mixed runs', () => {
    const widget = fixture().widgets[1];
    widget.richText = { paragraphs: [{ runs: [{ text: 'A', style: { fontSize: 18 } }, { text: 'B', style: { fontSize: 24 } }] }] };
    widget.text = 'AB';
    const patch = resolveWidgetStyleCommand(widget, firstWidgetPatch, intent);
    const result = patchWidgetTextStyle({ ...widget, style: mergeWidgetStyle(widget.style, patch) }, patch);
    expect(result.style.textPadding).toEqual([51, 40, 53, 54]);
    expect(result.richText).toEqual(widget.richText);
  });

  it('applies the same per-target command to mixed selected table cells', () => {
    const table = createWidget('table'), [a, b, noop] = table.table!.cells;
    a.style.textPadding = [11, 12, 13, 14]; b.style.textPadding = [61, 62, 63, 64]; noop.style.textPadding = [91, 40, 93, 94];
    const result = patchTableCells(table, [a.id, b.id, noop.id], cell => ({ style: edited(cell).style }));
    expect(result.table!.cells.slice(0, 3).map(w => w.style.textPadding)).toEqual([[11, 40, 13, 14], [61, 40, 63, 64], [91, 40, 93, 94]]);
    expect(result.table!.cells.slice(3)).toEqual(table.table!.cells.slice(3));
  });
});
