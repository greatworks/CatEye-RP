import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Inspector, SelectOptionsEditor } from '../src/components/Inspector';
import { WidgetContent } from '../src/components/WidgetView';
import { applyAdaptiveWidgetEdits, createAdaptiveView } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, getSelectedOptionIndices, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Interaction, Widget, WidgetType } from '../src/model/types';

function fixture(patch: Partial<Widget> = {}) {
  const doc = createDocument(), select = { ...createWidget('select'), ...patch };
  doc.pages[0].widgets = [select]; return { doc, select };
}
function cases(target: string): Interaction[] {
  return [{ id: uid(), name: 'Option choice', event: 'change', enabled: true, conditions: [{ source: 'selectedOption', key: target, operator: 'equals', value: ' A ' }], conditionMode: 'all', actions: [{ id: uid(), type: 'setSelectedOption', targetId: target, value: ' A ' }] }];
}

describe('select option authoring model', () => {
  it('only new selects receive an explicit first option; old files preserve omitted fields', () => {
    const { doc, select } = fixture(); expect(select.selectedIndices).toEqual([0]);
    delete select.selectedIndices; select.text = 'Option 2';
    const restored = parseDocument(serializeDocument(doc)); expect(restored).toEqual(doc);
    for (const field of ['selectMode', 'multiple', 'selectedIndices']) expect(restored.pages[0].widgets[0]).not.toHaveProperty(field);
    expect(getSelectedOptionIndices(select)).toEqual([1]);
  });

  it('derives legacy selection from the first exact resolved value, with no implicit empty or first fallback', () => {
    const { select } = fixture({ selectedIndices: undefined, options: ['', ' A ', 'A', 'A', '[[Name]]'], text: 'A' });
    expect(getSelectedOptionIndices(select)).toEqual([2]);
    expect(getSelectedOptionIndices(select, ' A ')).toEqual([1]);
    expect(getSelectedOptionIndices(select, '')).toEqual([0]);
    expect(getSelectedOptionIndices(select, 'missing')).toEqual([]);
    expect(getSelectedOptionIndices({ ...select, options: [] }, '')).toEqual([]);
    expect(getSelectedOptionIndices(createWidget('input'))).toEqual([]);
  });

  it('honors explicit empty/duplicate-index choice independently of legacy text and widget selected style', () => {
    const { select } = fixture({ options: ['A', 'A'], text: 'A', selected: true, selectedIndices: [1] });
    const selection = getSelectedOptionIndices(select); selection.push(0);
    expect(select.selectedIndices).toEqual([1]); expect(getSelectedOptionIndices(select, 'missing')).toEqual([1]);
    expect(getSelectedOptionIndices({ ...select, selectedIndices: [] })).toEqual([]);
  });

  it.each(['dropdown', 'listbox'] as const)('round-trips %s options literally, including empty/duplicate/newline/markup values', selectMode => {
    for (const multiple of [false, true]) {
      const { doc } = fixture({ selectMode, multiple, options: ['', ' \t ', 'A\nB', 'A', 'A', '<script>alert(1)</script>', '[[Variable]]'], selectedIndices: multiple ? [0, 2, 4] : [4] });
      expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    }
  });

  it('accepts explicitly empty lists and boundary-sized lists without adding a placeholder', () => {
    for (const options of [[], Array.from({ length: 500 }, (_, i) => `Option ${i}`)]) {
      const { doc } = fixture({ options, selectedIndices: options.length ? [499] : [] }); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    }
    const { doc } = fixture({ options: Array(501).fill('A') }); expect(() => parseDocument(JSON.stringify(doc))).toThrow('options');
  });

  it('rejects non-array, noninteger, nonfinite, duplicate, descending and out-of-range option indices', () => {
    for (const selectedIndices of [null, {}, 0, '0', [false], ['0'], [0.5], [-1], [3], [0, 0], [2, 1], [null], Array(501).fill(0)]) {
      const { doc, select } = fixture({ multiple: true }); Object.assign(select, { selectedIndices });
      expect(() => parseDocument(JSON.stringify(doc)), JSON.stringify(selectedIndices)).toThrow('selectedIndices');
    }
    for (const multiple of [undefined, false]) {
      const { doc } = fixture({ multiple, selectedIndices: [0, 1] }); expect(() => parseDocument(JSON.stringify(doc))).toThrow('at most one');
    }
  });

  it('validates presentation and multiple strictly, without coercing or accepting unknown fields', () => {
    for (const selectMode of ['', 'Listbox', 'list', true, null, {}, 2]) {
      const { doc, select } = fixture(); Object.assign(select, { selectMode }); expect(() => parseDocument(JSON.stringify(doc))).toThrow('selectMode');
    }
    for (const multiple of ['', 'false', 1, null, []]) {
      const { doc, select } = fixture(); Object.assign(select, { multiple }); expect(() => parseDocument(JSON.stringify(doc))).toThrow('multiple');
    }
    const { doc, select } = fixture(); Object.assign(select, { selectedIndex: 1 }); expect(() => parseDocument(JSON.stringify(doc))).toThrow('selectedIndex');
  });

  it('rejects new select fields on every other widget type while retaining old options compatibility', () => {
    const types: WidgetType[] = ['box', 'ellipse', 'path', 'text', 'button', 'image', 'placeholder', 'line', 'input', 'textarea', 'checkbox', 'radio', 'hotspot', 'panel', 'repeater'];
    for (const type of types) for (const patch of [{ selectMode: 'dropdown' }, { multiple: false }, { selectedIndices: [] }]) {
      const doc = createDocument(); doc.pages[0].widgets = [{ ...createWidget(type), ...patch } as Widget]; expect(() => parseDocument(JSON.stringify(doc)), `${type}/${Object.keys(patch)[0]}`).toThrow('only supported on select');
    }
    const doc = createDocument(); doc.pages[0].widgets = [{ ...createWidget('input'), options: ['legacy'] }]; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('round-trips selected-option conditions and string actions, permitting missing targets like other actions', () => {
    const { doc, select } = fixture(); select.interactions = cases(select.id);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    select.interactions[0].conditions[0].key = 'deleted-select'; select.interactions[0].actions[0].targetId = 'deleted-select';
    for (const value of ['', ' A ', '[[Choice]]', 'A\nB']) { select.interactions[0].actions[0].value = value; expect(parseDocument(serializeDocument(doc))).toEqual(doc); }
    for (const value of [false, 2, null, []]) { Object.assign(select.interactions[0].actions[0], { value }); expect(() => parseDocument(JSON.stringify(doc))).toThrow('value'); }
  });

  it('rejects selected-option actions and conditions against known non-select targets, including component definitions', () => {
    for (const source of ['action', 'condition']) for (const component of [false, true]) {
      const { doc, select } = fixture(), other = createWidget('input'); select.interactions = cases(select.id);
      if (source === 'action') select.interactions[0].actions[0].targetId = other.id; else select.interactions[0].conditions[0].key = other.id;
      if (component) { doc.components = [{ id: uid(), name: 'Definition', width: 400, height: 200, widgets: [select, other] }]; doc.pages[0].widgets = []; } else doc.pages[0].widgets.push(other);
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('requires a select target');
    }
  });

  it('remaps selection references while leaving literal option strings and indices intact on recursive clone', () => {
    const panel = createWidget('panel'), { select } = fixture({ options: ['duplicate', 'duplicate'], selectedIndices: [1] });
    select.options!.push(`[[Widget.${select.id}.text]]`); select.interactions = cases(select.id); panel.states![0].widgets = [select];
    const [copy] = cloneWidgets([panel], 0), copied = copy.states![0].widgets[0];
    expect(copied.interactions[0].conditions[0].key).toBe(copied.id); expect(copied.interactions[0].actions[0].targetId).toBe(copied.id);
    expect(copied.options).toEqual(select.options); expect(copied.selectedIndices).toEqual([1]); expect(copied.id).not.toBe(select.id);
    copied.selectedIndices!.push(2); copied.options![0] = 'Changed'; expect(select.selectedIndices).toEqual([1]); expect(select.options![0]).toBe('duplicate');
  });

  it('propagates component option edits and exact selection with correct local condition/action targets', () => {
    const { select } = fixture(); select.interactions = cases(select.id);
    const component = createComponent([select]), a = createComponentInstance(component), b = createComponentInstance(component), doc = createDocument();
    doc.components = [component]; doc.pages[0].widgets = [a, b];
    Object.assign(a.states![0].widgets[0], { options: ['X', 'X', ''], selectedIndices: [1, 2], multiple: true, selectMode: 'listbox' });
    const next = applyComponentInstanceChanges(doc, a.id);
    for (const instance of next.pages[0].widgets) {
      const field = instance.states![0].widgets[0]; expect(field).toMatchObject({ options: ['X', 'X', ''], selectedIndices: [1, 2], multiple: true, selectMode: 'listbox' });
      expect(field.interactions[0].conditions[0].key).toBe(field.id); expect(field.interactions[0].actions[0].targetId).toBe(field.id);
    }
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('shares adaptive option content and selection without changing base layout', () => {
    const { doc, select } = fixture(); let page = createAdaptiveView(doc.pages[0]); const visible = structuredClone(page.widgets);
    Object.assign(visible[0], { options: ['', 'B'], selectedIndices: [], selectMode: 'listbox', width: 300 });
    page = applyAdaptiveWidgetEdits(page, page.adaptiveViews[0].id, visible);
    expect(page.widgets[0]).toMatchObject({ options: ['', 'B'], selectedIndices: [], selectMode: 'listbox', width: select.width });
    expect(page.adaptiveViews[0].overrides[select.id]).toEqual({ width: 300 });
  });

  it('renders literal option values, real empty lists, multiple and the evidenced listbox size without unsafe markup', () => {
    const { select } = fixture({ selectMode: 'listbox', multiple: true, options: [' A\nB ', '<script>x</script>', ''], selectedIndices: [0, 2] });
    const html = renderToStaticMarkup(createElement(WidgetContent, { widget: select }));
    expect(html).toContain('multiple=""'); expect(html).toContain('size="2"'); expect(html).toContain('value=" A\nB "'); expect(html).toContain('&lt;script&gt;x&lt;/script&gt;'); expect(html).not.toContain('<script>');
    const empty = renderToStaticMarkup(createElement(WidgetContent, { widget: { ...select, options: [], selectedIndices: [] } })); expect(empty).not.toContain('<option'); expect(empty).not.toContain('Select an option');
  });

  it('exposes literal option rows and initial index controls while hiding ambiguous widget text editing', () => {
    const { doc, select } = fixture({ options: ['A\nB', 'A\nB', ''], selectedIndices: [1] });
    const html = renderToStaticMarkup(createElement(Inspector, { document: doc, page: doc.pages[0], widget: select, onWidgetChange() {}, onPageChange() {} }));
    expect(html).toContain('aria-label="Option 1 text"'); expect(html).toContain('aria-label="Option 3 selected"'); expect(html).toContain('Move option 2 up'); expect(html).not.toContain('aria-label="Widget text"'); expect(html).not.toContain('one per line');
    const empty = renderToStaticMarkup(createElement(SelectOptionsEditor, { widget: { ...select, options: [], selectedIndices: [] }, onChange() {} })); expect(empty).toContain('No options.'); expect(empty).toContain('Add option');
  });
});
