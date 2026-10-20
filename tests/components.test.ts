import { describe, expect, it } from 'vitest';
import { applyComponentInstanceChanges, createComponent, createComponentInstance, detachComponentInstance, syncComponentInstances, updateComponent } from '../src/model/components';
import { cloneWidgets, collectWidgetIdentifiers, createDocument, createPage, createWidget, findWidget, parseDocument, serializeDocument, uid, updateWidgetTree } from '../src/model/document';
import type { Document, Widget } from '../src/model/types';

function fixture() {
  const doc = createDocument(), label = createWidget('text', 100, 80), button = createWidget('button', 100, 140);
  label.text = 'Initial heading';
  button.interactions = [{ id: uid(), event: 'click', name: 'Update label', enabled: true, conditions: [{ source: 'widgetText', key: label.id, operator: 'equals', value: 'Initial heading' }], conditionMode: 'all', actions: [{ id: uid(), type: 'setText', targetId: label.id, value: `Changed [[Widget.${label.id}.text]]` }] }];
  doc.pages[0].widgets = [label, button];
  const component = createComponent([label, button], 'Card');
  doc.components = [component];
  const a = createComponentInstance(component, 300, 60), b = createComponentInstance(component, 700, 350);
  doc.pages[0].widgets.push(a); doc.pages.push(createPage('Other page')); doc.pages[1].widgets = [b];
  const unrelated = createPage('Unrelated'); unrelated.widgets = [createWidget('box')]; doc.pages.push(unrelated);
  return { doc, component, a, b, label, button, unrelated };
}

function widget(doc: Document, id: string): Widget {
  for (const page of doc.pages) { const found = findWidget(page, id); if (found) return found; }
  throw new Error(`Missing test widget ${id}`);
}

describe('component creation and instance identity', () => {
  it('creates unique definition IDs and normalized layout without changing the original selection', () => {
    const { doc, component, label, button } = fixture();
    expect(component.widgets.map(w => [w.x, w.y])).toEqual([[0, 0], [0, 60]]);
    expect(component.width).toBe(label.width); expect(component.height).toBe(100);
    expect(component.widgets[0].id).not.toBe(label.id); expect(component.widgets[1].id).not.toBe(button.id);
    expect(component.widgets[1].interactions[0].actions[0].targetId).toBe(component.widgets[0].id);
    expect([label.x, label.y, button.x, button.y]).toEqual([100, 80, 100, 140]);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('creates independent positioned panel instances and remaps actions, conditions and text reads internally', () => {
    const { component, a, b } = fixture(), [label, button] = component.widgets;
    const aLabel = a.componentInstance!.sourceIds[label.id], bLabel = b.componentInstance!.sourceIds[label.id];
    const aButton = a.states![0].widgets.find(w => w.id === a.componentInstance!.sourceIds[button.id])!;
    expect(aLabel).not.toBe(bLabel); expect(aLabel).not.toBe(label.id);
    expect(aButton.interactions[0].conditions[0].key).toBe(aLabel);
    expect(aButton.interactions[0].actions[0].targetId).toBe(aLabel);
    expect(aButton.interactions[0].actions[0].value).toBe(`Changed [[Widget.${aLabel}.text]]`);
    expect([a.x, a.y, b.x, b.y]).toEqual([300, 60, 700, 350]);
    expect(a.states![0].widgets[0].x).toBe(0);
    expect(new Set([...collectWidgetIdentifiers([a]).keys(), ...collectWidgetIdentifiers([b]).keys()]).size).toBe(collectWidgetIdentifiers([a]).size + collectWidgetIdentifiers([b]).size);
  });

  it('remaps complete panel states, groups and repeater templates when materializing a definition', () => {
    const panel = createWidget('panel'), repeater = createWidget('repeater');
    panel.states!.push({ id: uid(), name: 'Second', widgets: [] });
    panel.states![0].widgets = [repeater];
    const groupId = uid(), button = createWidget('button'); panel.groupId = groupId; button.groupId = groupId;
    button.interactions = [{ id: uid(), event: 'click', name: 'Switch panel', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setState', targetId: panel.id, value: panel.states![1].id }] }];
    const component = createComponent([panel, button]), instance = createComponentInstance(component), [child, trigger] = instance.states![0].widgets;
    expect(child.groupId).toBe(trigger.groupId); expect(child.groupId).not.toBe(component.widgets[0].groupId);
    expect(child.activeStateId).toBe(child.states![0].id);
    expect(trigger.interactions[0].actions[0].targetId).toBe(child.id);
    expect(trigger.interactions[0].actions[0].value).toBe(child.states![1].id);
    const source = component.widgets[0].states![0].widgets[0].repeater!.template[0];
    expect(child.states![0].widgets[0].repeater!.template[0].id).toBe(instance.componentInstance!.sourceIds[source.id]);
  });
});

describe('definition propagation', () => {
  it('updates all linked contents while preserving stable IDs, placement, local wrapper properties and unrelated objects', () => {
    const { doc, component, a, b, unrelated, label } = fixture();
    a.rotation = 12; a.hidden = true; a.locked = true; a.style.opacity = 0.7;
    const otherComponent = createComponent([createWidget('button')], 'Unrelated component'); doc.components.push(otherComponent);
    const otherInstance = createComponentInstance(otherComponent); doc.pages[0].widgets.push(otherInstance);
    const edited = { ...component, width: 280, widgets: updateWidgetTree(component.widgets, component.widgets[0].id, { text: 'Updated shared heading' }) };
    const next = updateComponent(doc, edited);
    for (const current of [a, b]) {
      const result = widget(next, current.id);
      expect(result.x).toBe(current.x); expect(result.y).toBe(current.y); expect(result.width).toBe(280);
      expect(result.componentInstance).toEqual(current.componentInstance);
      expect(result.states![0].id).toBe(current.states![0].id);
      expect(result.states![0].widgets[0].text).toBe('Updated shared heading');
    }
    expect(widget(next, a.id)).toMatchObject({ rotation: 12, hidden: true, locked: true, style: { opacity: 0.7 } });
    expect(widget(next, otherInstance.id)).toBe(otherInstance);
    expect(next.components[1]).toBe(otherComponent); expect(next.pages[2]).toBe(unrelated); expect(widget(next, label.id)).toBe(label);
    expect(component.widgets[0].text).toBe('Initial heading'); expect(a.states![0].widgets[0].text).toBe('Initial heading');
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('propagates definition additions/removals with fresh IDs and retains references to the surviving controls', () => {
    const { doc, component, a, b } = fixture(), added = createWidget('input', 10, 110), oldLabelId = component.widgets[0].id;
    const edited = { ...component, height: 180, widgets: [component.widgets[1], added] };
    const next = updateComponent(doc, edited), aNext = widget(next, a.id), bNext = widget(next, b.id);
    expect(aNext.states![0].widgets).toHaveLength(2); expect(bNext.states![0].widgets).toHaveLength(2);
    expect(aNext.componentInstance!.sourceIds[oldLabelId]).toBeUndefined();
    expect(aNext.componentInstance!.sourceIds[added.id]).not.toBe(bNext.componentInstance!.sourceIds[added.id]);
    expect(aNext.componentInstance!.sourceIds[component.widgets[1].id]).toBe(a.componentInstance!.sourceIds[component.widgets[1].id]);
    expect(findWidget({ widgets: aNext.states![0].widgets }, a.componentInstance!.sourceIds[oldLabelId])).toBeUndefined();
  });

  it('updates instances nested inside ordinary panels without modifying the containing panel geometry', () => {
    const { doc, component, a } = fixture(), container = createWidget('panel', 45, 60);
    doc.pages[0].widgets = [container]; container.states![0].widgets = [a];
    const next = updateComponent(doc, { ...component, widgets: updateWidgetTree(component.widgets, component.widgets[0].id, { text: 'Nested update' }) });
    expect(widget(next, a.id).states![0].widgets[0].text).toBe('Nested update');
    expect(widget(next, container.id)).toMatchObject({ x: 45, y: 60, width: container.width, height: container.height });
  });

  it('copied live instances keep independent mappings, including controls deleted before copying', () => {
    const { doc, component, a } = fixture();
    a.states![0].widgets = []; // Deleted locally, not published yet.
    const [copy] = cloneWidgets([a], 25); doc.pages[0].widgets.push(copy);
    const sourceId = component.widgets[0].id;
    expect(copy.componentInstance!.sourceIds[sourceId]).not.toBe(a.componentInstance!.sourceIds[sourceId]);
    const next = syncComponentInstances(doc, component.id);
    expect(widget(next, a.id).states![0].widgets).toHaveLength(2);
    expect(widget(next, copy.id).states![0].widgets).toHaveLength(2);
    expect(widget(next, copy.id).x).toBe(a.x + 25);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});

describe('publishing edited instances and detaching', () => {
  it('publishes content edits with stable source/instance IDs and updates the sibling instance', () => {
    const { doc, component, a, b } = fixture();
    const sourceId = component.widgets[0].id, localId = a.componentInstance!.sourceIds[sourceId];
    doc.pages[0].widgets = updateWidgetTree(doc.pages[0].widgets, localId, { text: 'Published from instance', x: 24 });
    const next = applyComponentInstanceChanges(doc, a.id), updated = next.components[0];
    expect(updated.widgets[0]).toMatchObject({ id: sourceId, text: 'Published from instance', x: 24 });
    expect(widget(next, a.id).states![0].widgets[0].id).toBe(localId);
    expect(widget(next, b.id).states![0].widgets[0]).toMatchObject({ id: b.componentInstance!.sourceIds[sourceId], text: 'Published from instance', x: 24 });
    expect([widget(next, a.id).x, widget(next, b.id).x]).toEqual([300, 700]);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('publishes new/deleted controls and remaps newly added interactions in both directions', () => {
    const { doc, component, a, b } = fixture();
    const existingLabel = a.states![0].widgets[0], added = createWidget('button', 0, 90);
    added.interactions = [{ id: uid(), event: 'click', name: 'New action', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setText', targetId: existingLabel.id, value: `[[Widget.${existingLabel.id}.text]]` }] }];
    a.states![0].widgets = [existingLabel, added]; a.width = 330;
    // Pending additions/deletions are a supported, saveable authoring state.
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const next = applyComponentInstanceChanges(doc, a.id), definition = next.components[0];
    const newSource = definition.widgets[1];
    expect(definition.widgets).toHaveLength(2); expect(newSource.id).not.toBe(added.id);
    expect(newSource.interactions[0].actions[0].targetId).toBe(definition.widgets[0].id);
    const currentA = widget(next, a.id), currentB = widget(next, b.id), otherNew = currentB.states![0].widgets[1];
    expect(currentA.states![0].widgets[1].id).toBe(added.id);
    expect(currentA.states![0].widgets[1].interactions[0].id).toBe(added.interactions[0].id);
    expect(otherNew.id).not.toBe(added.id); expect(otherNew.interactions[0].actions[0].targetId).toBe(currentB.states![0].widgets[0].id);
    expect(otherNew.interactions[0].actions[0].value).toBe(`[[Widget.${currentB.states![0].widgets[0].id}.text]]`);
    expect(currentA.componentInstance!.sourceIds[component.widgets[1].id]).toBeUndefined();
    expect(currentB.width).toBe(330); expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('detaches an instance with contents intact and leaves it unaffected by definition changes', () => {
    const { doc, component, a } = fixture(), detached = detachComponentInstance(a);
    expect(detached.componentInstance).toBeUndefined(); expect(detached.componentId).toBeUndefined();
    expect(detached.states).toEqual(a.states); expect(detached.id).toBe(a.id);
    doc.pages[0].widgets = doc.pages[0].widgets.map(item => item.id === a.id ? detached : item);
    const next = updateComponent(doc, { ...component, widgets: [] });
    expect(widget(next, detached.id)).toBe(detached); expect(widget(next, detached.id).states![0].widgets).toHaveLength(2);
    expect(() => applyComponentInstanceChanges(next, detached.id)).toThrow('Select a linked component');
  });
});

describe('component import validation and compatibility', () => {
  it('accepts legacy componentId-only templates without inventing a live relationship', () => {
    const doc = createDocument(), legacy = createWidget('box'); legacy.componentId = 'old-component'; doc.pages[0].widgets = [legacy];
    const parsed = parseDocument(serializeDocument(doc));
    expect(parsed.pages[0].widgets[0].componentId).toBe('old-component'); expect(parsed.pages[0].widgets[0].componentInstance).toBeUndefined();
    expect(syncComponentInstances(parsed)).toBe(parsed);
  });

  it('rejects missing definitions, malformed metadata, incomplete maps and cross-instance identity aliases', () => {
    const { doc, a, b, component } = fixture(), source = component.widgets[0].id;
    const bad = (edit: (copy: Document) => void) => { const copy = structuredClone(doc); edit(copy); return () => parseDocument(JSON.stringify(copy)); };
    expect(bad(copy => { widget(copy, a.id).componentId = 'missing'; })).toThrow('missing definition');
    expect(bad(copy => { widget(copy, a.id).type = 'box'; })).toThrow('single-state panel');
    expect(bad(copy => { delete widget(copy, a.id).componentInstance!.sourceIds[source]; })).toThrow('every definition identifier');
    expect(bad(copy => { widget(copy, a.id).componentInstance!.sourceIds[source] = b.componentInstance!.sourceIds[source]; })).toThrow('outside its instance');
    expect(bad(copy => { widget(copy, a.id).componentInstance!.sourceIds[source] = a.componentInstance!.sourceIds[component.widgets[1].id]; })).toThrow('one-to-one');
    expect(bad(copy => { widget(copy, a.id).componentInstance!.sourceIds[source] = a.states![0].id; })).toThrow('outside its instance');
    expect(() => parseDocument(JSON.stringify(doc).replace('"sourceIds":{', '"sourceIds":{"__proto__":"x",'))).toThrow('unsafe key');
  });

  it('rejects nested linked definitions, invalid dimensions and missing update targets without mutating data', () => {
    const { doc, component, a } = fixture();
    expect(() => createComponent([])).toThrow('at least one widget');
    expect(() => createComponent([a])).toThrow('Detach a linked component');
    expect(() => createComponentInstance({ ...component, width: 0 })).toThrow('dimensions');
    expect(() => updateComponent(doc, { ...component, id: 'missing' })).toThrow('missing component');
    expect(() => updateComponent(doc, { ...component, widgets: [a] })).toThrow('Detach a linked component');
    expect(() => applyComponentInstanceChanges(doc, 'missing')).toThrow('Select a linked component');
    expect(doc.components[0]).toBe(component);
  });
});
