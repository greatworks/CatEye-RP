import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cloneWidgets, createDocument, createWidget, parseDocument, parseRepeaterRowSelector, serializeDocument, uid } from '../src/model/document';
import { applyAdaptiveWidgetEdits, createAdaptiveView } from '../src/model/adaptive';
import { createComponent, createComponentInstance } from '../src/model/components';
import { validateRowSelectorSpec, validateUpdateRowSpec } from '../src/components/Inspector';
import { WidgetContent } from '../src/components/WidgetView';
import type { Action, Widget } from '../src/model/types';

function fixture() {
  const doc = createDocument(), repeater = createWidget('repeater'); doc.pages[0].widgets = [repeater];
  repeater.repeater!.rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(Name => ({ Name }));
  return { doc, repeater };
}
function actions(widget: Widget, values: Omit<Action, 'id'>[]) {
  widget.interactions = [{ id: uid(), event: 'click', name: 'Rows', enabled: true, conditions: [], conditionMode: 'all', actions: values.map(action => ({ id: uid(), ...action })) }];
}
describe('repeater pagination and row selectors', () => {
  it('leaves legacy datasets and delete action values unchanged', () => {
    const { doc, repeater } = fixture(); actions(repeater, [{ type: 'deleteRow', targetId: repeater.id, value: 'all' }, { type: 'deleteRow', targetId: repeater.id, value: '0' }]);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc); expect(serializeDocument(doc)).not.toContain('pagination');
  });

  it('round-trips bounded initial pagination without rounding decimals', () => {
    const { doc, repeater } = fixture();
    for (const pagination of [{ itemsPerPage: 20, startPage: 1 }, { itemsPerPage: 1, startPage: 10000 }, { itemsPerPage: 10000, startPage: 1 }, { itemsPerPage: 2.5, startPage: 1.5 }]) {
      repeater.repeater!.pagination = pagination; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    }
    delete repeater.repeater!.pagination; expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0].repeater).not.toHaveProperty('pagination');
  });

  it('rejects missing, unknown, nonfinite, wrongly typed and out-of-range pagination fields', () => {
    for (const pagination of [null, [], {}, { itemsPerPage: 20 }, { itemsPerPage: 20, startPage: 1, enabled: true }, { itemsPerPage: 0, startPage: 1 }, { itemsPerPage: 10001, startPage: 1 }, { itemsPerPage: 20, startPage: 0.99 }, { itemsPerPage: 20, startPage: 10001 }, { itemsPerPage: '20', startPage: 1 }, { itemsPerPage: NaN, startPage: 1 }, { itemsPerPage: 20, startPage: Infinity }]) {
      const { doc, repeater } = fixture(); Object.assign(repeater.repeater!, { pagination }); expect(() => parseDocument(JSON.stringify(doc))).toThrow('pagination');
    }
  });

  it('preserves the new action carriers, expressions and cloned repeater references', () => {
    const { doc, repeater } = fixture(); actions(repeater, [
      { type: 'markRows', targetId: repeater.id, value: '{"row":"this"}' }, { type: 'unmarkRows', targetId: repeater.id, value: '{"row":"all"}' },
      { type: 'markRows', targetId: repeater.id, value: '{"where":{"column":"Name","operator":"equals","value":"[[TargetItem.Name]]"}}' },
      ...['next', 'previous', 'first', 'last', '1.5', '[[Item.Repeater.pageIndex + 1]]'].map(value => ({ type: 'setRepeaterPage' as const, targetId: repeater.id, value })),
      ...['all', '2.5', '[[PageSize]]'].map(value => ({ type: 'setItemsPerPage' as const, targetId: repeater.id, value })),
      { type: 'updateRow', targetId: repeater.id, value: '{"row":"marked","values":{"Name":"[[Item.isMarked]]"}}' },
      { type: 'deleteRow', targetId: repeater.id, value: '{"row":"marked"}' }, { type: 'deleteRow', targetId: repeater.id, value: '{"where":{"column":"Name","operator":"contains","value":"a"}}' },
    ]);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const [copy] = cloneWidgets([repeater]); expect(copy.interactions[0].actions.every(action => action.targetId === copy.id)).toBe(true);
    expect(copy.interactions[0].actions.map(action => action.value)).toEqual(repeater.interactions[0].actions.map(action => action.value));
  });

  it('rejects malformed mark/unmark JSON, marked shortcut and ambiguous selectors on import', () => {
    for (const type of ['markRows', 'unmarkRows'] as const) for (const value of [undefined, '', 'all', '[]', '{}', '{"row":"marked"}', '{"row":-1}', '{"row":0.5}', '{"row":9007199254740992}', '{"row":"0"}', '{"row":"this","extra":1}', '{"row":"this","where":{}}', '{"where":{"column":"Name","operator":"matches","value":"x"}}', '{"where":{"column":"Name","operator":"equals","value":1}}', '{"where":{"column":"Name","operator":"equals","value":"x","extra":1}}', '{"__proto__":{}}']) {
      const { doc, repeater } = fixture(); actions(repeater, [{ type, targetId: repeater.id, value }]); expect(() => parseDocument(JSON.stringify(doc)), `${type}: ${value}`).toThrow();
    }
  });

  it('shares selector validation while allowing marked only on update/delete', () => {
    for (const row of ['this', 'all', 0, 4]) expect(validateRowSelectorSpec({ row }, ['Name'])).toBeNull();
    expect(validateRowSelectorSpec({ row: 'marked' }, ['Name'])).not.toBeNull(); expect(validateRowSelectorSpec({ row: 'marked' }, ['Name'], true)).toBeNull();
    expect(validateUpdateRowSpec({ row: 'marked', values: { Name: '[[Item.isMarked]]' } }, ['Name'])).toBeNull();
    expect(validateUpdateRowSpec({ row: 'marked', values: { Unknown: 'bad' } }, ['Name'])).toContain('Unknown');
    expect(validateRowSelectorSpec({ where: { column: 'Missing', operator: 'equals', value: 'x' } }, ['Name'], true)).toContain('column');
    expect(parseRepeaterRowSelector({ where: { column: 'Name', operator: 'isEmpty', value: '' } }, false, ['Name'])).toEqual({ where: { column: 'Name', operator: 'isEmpty', value: '' } });
  });

  it('clones and materializes pagination independently and keeps adaptive pagination shared', () => {
    const { doc, repeater } = fixture(); repeater.repeater!.pagination = { itemsPerPage: 2.5, startPage: 1 };
    const [copy] = cloneWidgets([repeater]); copy.repeater!.pagination!.itemsPerPage = 5; expect(repeater.repeater!.pagination!.itemsPerPage).toBe(2.5);
    const component = createComponent([repeater]), instance = createComponentInstance(component); doc.components = [component]; doc.pages[0].widgets = [instance];
    expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0].states![0].widgets[0].repeater!.pagination).toEqual({ itemsPerPage: 2.5, startPage: 1 });
    let page = createAdaptiveView({ ...doc.pages[0], widgets: [repeater] }); const edited = structuredClone(page.widgets); edited[0].repeater!.pagination!.startPage = 3;
    page = applyAdaptiveWidgetEdits(page, page.adaptiveViews[0].id, edited); expect(page.widgets[0].repeater!.pagination!.startPage).toBe(3); expect(page.adaptiveViews[0].overrides).toEqual({});
  });

  it.each([
    { size: 2, page: 2, shown: ['C', 'D'] },
    { size: 2.5, page: 1, shown: ['A', 'B', 'C'] },
    { size: 2, page: 1.5, shown: ['B', 'C'] },
    { size: 3, page: 100, shown: ['G', 'H'] },
  ])('uses native row-index bounds in the static editor: size $size page $page', ({ size, page, shown }) => {
    const { repeater } = fixture(); repeater.repeater!.pagination = { itemsPerPage: size, startPage: page };
    const markup = renderToStaticMarkup(createElement(WidgetContent, { widget: repeater }));
    for (const name of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) expect(markup.includes(`>${name}</span>`), name).toBe(shown.includes(name));
    expect(repeater.repeater!.rows).toHaveLength(8); expect(repeater.repeater!.pagination.startPage).toBe(page);
  });

  it('reports fractional row indices without inventing rounded data, and handles empty data', () => {
    const { repeater } = fixture(); repeater.repeater!.pagination = { itemsPerPage: 3, startPage: 1.5 };
    const markup = renderToStaticMarkup(createElement(WidgetContent, { widget: repeater })); expect(markup).toContain('role="alert"'); expect(markup).toContain('whole row index (1.5)'); expect(markup).not.toContain('repeater-row');
    repeater.repeater!.rows = []; expect(renderToStaticMarkup(createElement(WidgetContent, { widget: repeater }))).toBe('<div></div>');
  });
});
