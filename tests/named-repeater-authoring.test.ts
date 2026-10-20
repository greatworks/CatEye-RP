import { describe, expect, it } from 'vitest';
import { cloneWidgets, createDocument, createWidget, parseDocument, parseRepeaterFilterSpec, parseRepeaterRuleRemoval, parseRepeaterSortSpec, serializeDocument, uid } from '../src/model/document';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import type { Action, RepeaterFilterSpec, RepeaterSortSpec, Widget } from '../src/model/types';

const filter = (patch: Partial<RepeaterFilterSpec> = {}): RepeaterFilterSpec => ({ name: 'Filter', expression: '[[TargetItem.Name == "A"]]', mode: 'smart', removeOthers: false, ...patch });
const sort = (patch: Partial<RepeaterSortSpec> = {}): RepeaterSortSpec => ({ name: 'Sort', column: 'Name', direction: 'asc', dataType: 'text', toggle: false, removeOthers: false, ...patch });
function fixture() {
  const doc = createDocument(), repeater = createWidget('repeater'), input = createWidget('input'), button = createWidget('button');
  repeater.repeater!.columns = ['Name', 'Age']; repeater.repeater!.rows = [];
  doc.pages[0].widgets = [repeater, input, button];
  return { doc, repeater, input, button };
}
function attach(widget: Widget, actions: Omit<Action, 'id'>[]) {
  widget.interactions = [{ id: uid(), event: 'load', name: 'Starting rules', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) }];
}
function named(type: Action['type'], value: unknown, targetId?: string) { return { type, value: JSON.stringify(value), ...(targetId ? { targetId } : {}) }; }

describe('named repeater authoring schema', () => {
  it('round-trips every new carrier without creating initial fields or changing empty data', () => {
    const { doc, repeater } = fixture();
    const dataBeforeRules = structuredClone(repeater.repeater);
    attach(repeater, [
      ...(['smart', 'all', 'any'] as const).map(mode => named('addFilter', filter({ name: ' duplicate ', mode, column: 'Name' }), repeater.id)),
      named('addFilter', filter({ name: '', removeOthers: true }), repeater.id),
      ...(['number', 'text', 'textCase', 'natural', 'dateYMD', 'dateMDY', 'dateDMY'] as const).map(dataType => named('addSort', sort({ dataType, toggle: true, removeOthers: true }), repeater.id)),
      ...(['removeFilter', 'removeSort'] as const).flatMap(type => [{ name: '' }, { name: ' duplicate ' }, { all: true }].map(value => named(type, value, repeater.id))),
    ]);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(repeater.repeater!.rows).toEqual([]); expect(repeater.repeater).toEqual(dataBeforeRules);
  });

  it('preserves legacy filter/sort strings exactly, including older incomplete payloads', () => {
    const { doc, repeater } = fixture();
    attach(repeater, [
      ...['Name:asc', 'Name:desc', 'Name', '', 'Name:sideways'].map(value => ({ type: 'sortRows' as const, value, targetId: repeater.id })),
      ...['', '{ "column": "Name", "operator": "contains", "value": "A" }', '{"unknown":true}'].map(value => ({ type: 'filterRows' as const, value, targetId: repeater.id })),
    ]);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('requires complete single expressions within the bounded carrier', () => {
    expect(parseRepeaterFilterSpec(filter({ expression: `[[${'x'.repeat(4096)}]]` }))).toHaveProperty('expression');
    for (const expression of ['', 'true', ' [[true]]', '[[true]] ', '[[]]', '[[   ]]', '[[true]][[false]]', '[[[true]]]', `[[${'x'.repeat(4097)}]]`]) {
      expect(() => parseRepeaterFilterSpec(filter({ expression })), expression).toThrow('expression');
    }
  });

  it('preserves empty, whitespace, case-sensitive and prototype-looking names as plain data', () => {
    for (const name of ['', ' ', 'a', 'A', ' a ', '__proto__', 'constructor', 'n'.repeat(256)]) {
      expect(parseRepeaterFilterSpec(filter({ name })).name).toBe(name);
      expect(parseRepeaterSortSpec(sort({ name })).name).toBe(name);
      expect(parseRepeaterRuleRemoval({ name })).toEqual({ name });
    }
    expect(() => parseRepeaterRuleRemoval({ name: 'n'.repeat(257) })).toThrow('name');
  });

  it('rejects filter extra keys, missing flags, invalid enums and types', () => {
    const invalid: unknown[] = [null, [], {}, { ...filter(), name: 1 }, { ...filter(), name: 'n'.repeat(257) }, { ...filter(), expression: true }, { ...filter(), mode: 'SMART' }, { ...filter(), mode: undefined }, { ...filter(), removeOthers: 'false' }, { ...filter(), removeOthers: undefined }, { ...filter(), extra: true }, { ...filter(), column: '' }, { ...filter(), column: null }, { ...filter(), column: '__proto__' }, JSON.parse('{"name":"F","expression":"[[true]]","mode":"smart","removeOthers":false,"__proto__":{}}')];
    for (const value of invalid) expect(() => parseRepeaterFilterSpec(value), JSON.stringify(value)).toThrow();
  });

  it('rejects sort extra keys, missing flags, invalid enums and types', () => {
    for (const patch of [{ name: null }, { column: '' }, { column: 'constructor' }, { direction: 'ASC' }, { direction: undefined }, { dataType: 'date' }, { dataType: undefined }, { toggle: 0 }, { toggle: undefined }, { removeOthers: undefined }, { removeOthers: 'false' }, { extra: 1 }]) expect(() => parseRepeaterSortSpec({ ...sort(), ...patch })).toThrow();
    expect(() => parseRepeaterSortSpec(JSON.parse('{"name":"S","column":"Name","direction":"asc","dataType":"text","toggle":false,"removeOthers":false,"prototype":{}}'))).toThrow('unsafe key');
  });

  it('requires exactly all:true or a string name when removing rules', () => {
    for (const value of [null, [], {}, { all: false }, { all: 'true' }, { all: 1 }, { all: true, name: '' }, { name: undefined }, { name: 0 }, { name: '', extra: false }, JSON.parse('{"all":true,"constructor":0}')]) expect(() => parseRepeaterRuleRemoval(value)).toThrow();
    expect(parseRepeaterRuleRemoval({ all: true })).toEqual({ all: true });
  });

  it('enforces JSON payloads and structural validation on project import', () => {
    for (const type of ['addFilter', 'removeFilter', 'addSort', 'removeSort'] as const) for (const value of [undefined, '', 'oops', '[]', '{}', '{"__proto__":1}']) {
      const { doc, button } = fixture(); attach(button, [{ type, value }]);
      expect(() => parseDocument(JSON.stringify(doc)), `${type}: ${value}`).toThrow();
    }
  });

  it('checks actual target types and columns, including page events and nested templates', () => {
    const { doc, repeater, input, button } = fixture();
    for (const type of ['addFilter', 'addSort', 'removeFilter', 'removeSort'] as const) {
      attach(button, [named(type, type === 'addFilter' ? filter() : type === 'addSort' ? sort() : { all: true }, input.id)]);
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('repeater target');
    }
    attach(button, []);
    attach(repeater.repeater!.template[0], [named('addSort', sort({ column: 'Missing' }), repeater.id)]);
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('column'); repeater.repeater!.template[0].interactions = [];
    attach(button, [named('addFilter', filter({ column: 'Missing' }), repeater.id)]);
    doc.pages[0].interactions = button.interactions; button.interactions = [];
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('column');
    doc.pages[0].interactions[0].actions[0].value = JSON.stringify(filter()); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('keeps missing targets saveable and validates columns only once a target exists', () => {
    const { doc, button } = fixture(); attach(button, [named('addSort', sort({ column: 'Pending' }), 'deleted-widget'), named('addFilter', filter())]);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
});

describe('named filter reference remapping', () => {
  it('remaps complex variable tokens but not escaped literals, partial paths, external IDs or metadata', () => {
    const { doc, repeater, input, button } = fixture(), external = createWidget('input');
    const reference = `Widget.${input.id}.text`, literal = `[[${reference}]]`;
    const expression = `[[contains(${reference}, 'x') && ${reference} != "${reference}" && ${reference} != 'escaped\\\'${reference}' && Widget.${external.id}.text != '']]`;
    attach(button, [named('addFilter', filter({ name: literal, expression }), repeater.id), named('removeFilter', { name: literal }, repeater.id), named('addSort', sort({ name: literal }), repeater.id)]);
    const [copyRepeater, copyInput, copyButton] = cloneWidgets([repeater, input, button]);
    const actions = copyButton.interactions[0].actions, copied = JSON.parse(actions[0].value!);
    expect(copied.expression).toBe(`[[contains(Widget.${copyInput.id}.text, 'x') && Widget.${copyInput.id}.text != "${reference}" && Widget.${copyInput.id}.text != 'escaped\\\'${reference}' && Widget.${external.id}.text != '']]`);
    expect(copied.name).toBe(literal); expect(actions.every(action => action.targetId === copyRepeater.id)).toBe(true);
    expect(actions[1].value).toBe(button.interactions[0].actions[1].value); expect(actions[2].value).toBe(button.interactions[0].actions[2].value);
    expect(JSON.parse(button.interactions[0].actions[0].value!).expression).toBe(expression); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    for (const value of [`[[Other.${reference}]]`, `[[X${reference}]]`, `[[${reference}More]]`, `[[${reference}.extra]]`, `[["${reference}"]]`]) {
      attach(button, [named('addFilter', filter({ expression: value }), repeater.id)]); expect(cloneWidgets([input, button])[1].interactions[0].actions[0].value).toBe(button.interactions[0].actions[0].value);
    }
  });

  it('propagates instance edits through source IDs to linked siblings without touching unrelated definitions', () => {
    const { doc, repeater, input, button } = fixture();
    attach(button, [named('addFilter', filter({ expression: `[[TargetItem.Name == Widget.${input.id}.text]]` }), repeater.id)]);
    const component = createComponent([repeater, input, button], 'Rules'), a = createComponentInstance(component, 20, 40), b = createComponentInstance(component, 500, 100);
    const unrelated = createComponent([createWidget('button')], 'Other'), other = createComponentInstance(unrelated);
    doc.components = [component, unrelated]; doc.pages[0].widgets = [a, b, other];
    const children = a.states![0].widgets, aInput = children[1];
    children[2].interactions[0].actions[0].value = JSON.stringify(filter({ name: 'Updated', expression: `[[lower(TargetItem.Name) == lower(Widget.${aInput.id}.text)]]` }));
    const next = applyComponentInstanceChanges(doc, a.id), aNext = next.pages[0].widgets[0], bNext = next.pages[0].widgets[1];
    const expression = (widget: Widget) => JSON.parse(widget.interactions[0].actions[0].value!).expression;
    expect(expression(next.components[0].widgets[2])).toBe(`[[lower(TargetItem.Name) == lower(Widget.${component.widgets[1].id}.text)]]`);
    for (const instance of [aNext, bNext]) {
      const [rows, text, trigger] = instance.states![0].widgets;
      expect(expression(trigger)).toBe(`[[lower(TargetItem.Name) == lower(Widget.${text.id}.text)]]`);
      expect(trigger.interactions[0].actions[0].targetId).toBe(rows.id);
    }
    expect(aNext.componentInstance).toEqual(a.componentInstance); expect(bNext.componentInstance).toEqual(b.componentInstance);
    expect([aNext.x, aNext.y, bNext.x, bNext.y]).toEqual([20, 40, 500, 100]); expect(next.pages[0].widgets[2]).toBe(other); expect(next.components[1]).toBe(unrelated);
    expect(expression(b.states![0].widgets[2])).not.toContain('lower('); expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});
