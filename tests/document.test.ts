import { describe, expect, it } from 'vitest';
import { alignWidgets, cloneWidgets, createDemoDocument, createDocument, createPage, createWidget, deleteWidgetTree, distributeWidgets, findWidget, groupWidgets, isSafeImageSource, parseDocument, serializeDocument, uid, ungroupWidgets, updateWidgetTree } from '../src/model/document';
import type { Document, Interaction, WidgetType } from '../src/model/types';

function invalid(doc: Document, mutate: (value: any) => void) { const value = structuredClone(doc); mutate(value); return () => parseDocument(JSON.stringify(value)); }

describe('document creation and import', () => {
  it('creates a genuinely blank, independent document with one page', () => {
    const doc = createDocument(), other = createDocument();
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].widgets).toEqual([]);
    expect(doc.id).not.toBe(other.id);
    expect(doc.pages[0].id).not.toBe(other.pages[0].id);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('round-trips all supported widget types and the working demo', () => {
    const types: WidgetType[] = ['box', 'ellipse', 'text', 'button', 'image', 'placeholder', 'line', 'input', 'textarea', 'checkbox', 'radio', 'select', 'hotspot', 'panel', 'repeater'];
    const doc = createDocument(); doc.pages[0].widgets = types.map(type => createWidget(type));
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const demo = createDemoDocument();
    expect(demo.pages).toHaveLength(2);
    expect(parseDocument(serializeDocument(demo))).toEqual(demo);
    expect(demo.pages[0].widgets.find(w => w.type === 'panel')?.states).toHaveLength(2);
  });

  it('rejects malformed JSON, unknown formats, missing pages and unknown schema fields', () => {
    const doc = createDocument();
    expect(() => parseDocument('{')).toThrow('valid JSON');
    expect(invalid(doc, value => { value.version = 2; })).toThrow('unsupported');
    expect(invalid(doc, value => { value.pages = []; })).toThrow('at least one page');
    expect(invalid(doc, value => { value.pages[0].scripts = 'alert(1)'; })).toThrow('unknown field');
    expect(() => parseDocument(JSON.stringify(doc).replace('"variables":{}', '"variables":{"__proto__":"unsafe"}'))).toThrow('unsafe key');
  });

  it('rejects duplicate identifiers, missing nested fields, negative dimensions and invalid types', () => {
    const doc = createDocument(); doc.pages[0].widgets = [createWidget('box')];
    expect(invalid(doc, value => { value.pages[0].widgets.push(value.pages[0].widgets[0]); })).toThrow('duplicate identifier');
    expect(invalid(doc, value => { delete value.pages[0].widgets[0].style.opacity; })).toThrow('finite number');
    expect(invalid(doc, value => { value.pages[0].widgets[0].width = -2; })).toThrow('finite number');
    expect(invalid(doc, value => { value.pages[0].widgets[0].hidden = 'false'; })).toThrow('boolean');
    expect(invalid(doc, value => { value.pages[0].widgets[0].type = 'webview'; })).toThrow('expected one of');
  });

  it('rejects unsafe image and CSS sources while allowing raster data and HTTP images', () => {
    const doc = createDocument(); doc.pages[0].widgets = [createWidget('image')];
    for (const source of ['javascript:alert(1)', 'file:///C:/secret.txt', 'data:text/html,<script>alert(1)</script>', 'data:image/svg+xml,<svg onload="alert(1)"/>', 'https://user:password@example.com/image.png']) {
      expect(isSafeImageSource(source)).toBe(false);
      expect(invalid(doc, value => { value.pages[0].widgets[0].imageSrc = source; })).toThrow('only HTTP');
    }
    expect(isSafeImageSource('data:image/png;base64,aGVsbG8=')).toBe(true);
    expect(isSafeImageSource('https://example.com/picture.png')).toBe(true);
    expect(invalid(doc, value => { value.pages[0].widgets[0].style.fill = 'url(https://example.com/a.svg)'; })).toThrow('expected a color');
    expect(invalid(doc, value => { value.pages[0].widgets[0].style.fontFamily = 'Arial; background:url(x)'; })).toThrow('invalid font');
  });

  it('limits file size, total widgets and recursive nesting before the app renders', () => {
    expect(() => parseDocument(' '.repeat(20 * 1024 * 1024 + 1))).toThrow('20 MiB');
    const doc = createDocument();
    doc.pages[0].widgets = Array.from({ length: 10_001 }, () => createWidget('box'));
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('at most 10000');
    const root = createWidget('panel'); let panel = root;
    for (let i = 0; i < 14; i++) { const child = createWidget('panel'); panel.states![0].widgets.push(child); panel = child; }
    doc.pages[0].widgets = [root];
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('nesting');
  });

  it('rejects invalid panel states, duplicate columns and cyclic page trees', () => {
    const doc = createDocument(); doc.pages.push(createPage('Nested'));
    doc.pages[0].widgets = [createWidget('panel'), createWidget('repeater')];
    expect(invalid(doc, value => { value.pages[0].widgets[0].activeStateId = 'missing'; })).toThrow('activeStateId');
    expect(invalid(doc, value => { value.pages[0].widgets[1].repeater.columns = ['Name', 'Name']; })).toThrow('unique');
    expect(invalid(doc, value => { value.pages[0].widgets[1].repeater.rows = [{ Unknown: 'bad' }]; })).toThrow('unknown field');
    expect(invalid(doc, value => { value.pages[0].parentId = value.pages[1].id; value.pages[1].parentId = value.pages[0].id; })).toThrow('cyclic');
  });

  it('validates partial adaptive overrides without requiring an entire widget', () => {
    const doc = createDocument(), widget = createWidget('text'); doc.pages[0].widgets = [widget];
    doc.pages[0].adaptiveViews = [{ id: uid(), name: 'Mobile', width: 390, overrides: { [widget.id]: { x: 20, width: 320, hidden: true } } }];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(invalid(doc, value => { value.pages[0].adaptiveViews[0].overrides[widget.id].width = 0; })).toThrow('finite number');
  });
});

describe('native condition comparison metadata', () => {
  function fixture() {
    const doc = createDocument(), input = createWidget('input'), button = createWidget('button');
    button.interactions = [{ id: uid(), event: 'click', name: 'Compare', enabled: true, conditionMode: 'all', conditions: [{ source: 'widgetText', key: input.id, operator: 'equals', value: '' }], actions: [] }];
    doc.pages[0].widgets = [input, button]; return doc;
  }
  it('preserves legacy absence and native equality metadata through round-trip and reference remapping', () => {
    const doc = fixture(); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(parseDocument(serializeDocument(doc)).pages[0].widgets[1].interactions[0].conditions[0]).not.toHaveProperty('comparisonMode');
    const condition = doc.pages[0].widgets[1].interactions[0].conditions[0]; condition.comparisonMode = 'axure';
    for (const operator of ['equals', 'notEquals'] as const) {
      condition.operator = operator; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
      const [input, button] = cloneWidgets(doc.pages[0].widgets);
      expect(button.interactions[0].conditions[0]).toEqual({ ...condition, key: input.id });
    }
  });
  it('rejects unknown native comparison modes and unsupported operators', () => {
    const doc = fixture();
    for (const mode of ['strict', '', null, false, 1, {}, ['axure']]) {
      expect(invalid(doc, value => { value.pages[0].widgets[1].interactions[0].conditions[0].comparisonMode = mode; })).toThrow('comparisonMode');
    }
    for (const operator of ['contains', 'greater', 'less', 'isEmpty']) {
      expect(invalid(doc, value => { Object.assign(value.pages[0].widgets[1].interactions[0].conditions[0], { comparisonMode: 'axure', operator }); })).toThrow('only supports equals and notEquals');
    }
  });
});

describe('immutable widget editing', () => {
  it('finds, updates and deletes children in panel states and repeater templates', () => {
    const panel = createWidget('panel'), repeater = createWidget('repeater'), label = repeater.repeater!.template[0];
    panel.states![0].widgets = [repeater];
    const page = createPage(); page.widgets = [panel];
    expect(findWidget(page, label.id)).toBe(label);
    const widgets = updateWidgetTree(page.widgets, label.id, { text: 'Changed' });
    expect(findWidget({ widgets }, label.id)?.text).toBe('Changed');
    expect(label.text).toBe('[[Item.Name]]');
    const removed = deleteWidgetTree(widgets, [label.id]);
    expect(findWidget({ widgets: removed }, label.id)).toBeUndefined();
    expect(findWidget(page, label.id)).toBe(label);
  });

  it('deep clones IDs and internal action/condition/state references but retains external targets', () => {
    const panel = createWidget('panel', 30, 40), input = createWidget('input', 4, 8), button = createWidget('button', 8, 50);
    const stateId = panel.states![0].id;
    const action: Interaction = { id: uid(), event: 'click', name: 'Interact', enabled: true, conditionMode: 'all', conditions: [{ source: 'widgetText', key: input.id, operator: 'notEquals', value: '' }], actions: [
      { id: uid(), type: 'setText', targetId: input.id, value: `[[Widget.${input.id}.text]]` },
      { id: uid(), type: 'setState', targetId: panel.id, value: stateId },
      { id: uid(), type: 'openPage', targetId: 'external-page' },
    ] };
    button.interactions = [action]; panel.states![0].widgets = [input, button];
    const [clone] = cloneWidgets([panel], 20), [newInput, newButton] = clone.states![0].widgets;
    expect(clone.id).not.toBe(panel.id); expect(clone.x).toBe(50); expect(clone.y).toBe(60);
    expect(newInput.x).toBe(4); expect(newInput.y).toBe(8);
    expect(clone.activeStateId).toBe(clone.states![0].id);
    expect(newButton.interactions[0].conditions[0].key).toBe(newInput.id);
    expect(newButton.interactions[0].actions[0].targetId).toBe(newInput.id);
    expect(newButton.interactions[0].actions[0].value).toBe(`[[Widget.${newInput.id}.text]]`);
    expect(newButton.interactions[0].actions[1].targetId).toBe(clone.id);
    expect(newButton.interactions[0].actions[1].value).toBe(clone.activeStateId);
    expect(newButton.interactions[0].actions[2].targetId).toBe('external-page');
    expect(panel.states![0].id).toBe(stateId);
  });

  it('remaps groups consistently and ungroup acts on the complete selected group', () => {
    const a = createWidget('box'), b = createWidget('box'), c = createWidget('box');
    const grouped = groupWidgets([a, b, c], [a.id, b.id]);
    expect(grouped[0].groupId).toBe(grouped[1].groupId);
    expect(grouped[2].groupId).toBeUndefined();
    const copied = cloneWidgets(grouped.slice(0, 2));
    expect(copied[0].groupId).toBe(copied[1].groupId); expect(copied[0].groupId).not.toBe(grouped[0].groupId);
    expect(ungroupWidgets(grouped, [a.id]).every(w => w.groupId === undefined)).toBe(true);
    expect(a.groupId).toBeUndefined();
  });

  it('aligns bounding boxes and distributes equal gaps without moving locked objects', () => {
    const a = { ...createWidget('box', 10, 20), width: 40 }, b = { ...createWidget('box', 90, 30), width: 20 }, c = { ...createWidget('box', 210, 60), width: 60 };
    const ids = [a.id, b.id, c.id];
    expect(alignWidgets([a, b, c], ids, 'right').map(w => w.x + w.width)).toEqual([270, 270, 270]);
    const distributed = distributeWidgets([a, b, c], ids, 'horizontal');
    expect(distributed[1].x).toBe(120);
    expect(distributed[2].x - (distributed[1].x + b.width)).toBe(distributed[1].x - (a.x + a.width));
    const locked = { ...a, locked: true };
    expect(alignWidgets([locked, b, c], ids, 'right')[0]).toBe(locked);
    expect(a.x).toBe(10);
  });
});
