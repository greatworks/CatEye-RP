import { expect, it } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import { createComponent, createComponentInstance, updateComponent } from '../src/model/components';

it('component removals prune active and inactive page declarations without dropping surviving local effects', () => {
  const doc = createDocument(), component = createComponent([createWidget('box'), createWidget('button')], 'Card');
  doc.components = [component]; doc.pages.push(createPage('Other'));
  doc.adaptiveViewSets = [{ id: 'set', name: 'Devices', baseSize: { width: 0, height: 0 }, views: [{ id: 'phone', name: 'Phone', width: 390 }] }];
  for (const page of doc.pages) {
    const instance = createComponentInstance(component); page.widgets = [instance];
    page.adaptiveViewSetId = 'set'; delete page.adaptiveSelection; delete page.adaptiveBaseSize;
    const [removed, retained] = instance.states![0].widgets;
    page.adaptiveOverrides = { phone: { [removed.id]: { x: 2 }, [retained.id]: { stateStyles: {} } }, inactive: { [removed.id]: { y: 3 }, [retained.id]: { hidden: true } } };
  }
  const before = serializeDocument(doc);
  const result = updateComponent(doc, { ...component, widgets: [component.widgets[1]] });
  for (const page of result.pages) {
    const retained = page.widgets[0].states![0].widgets[0];
    expect(page.adaptiveOverrides).toEqual({ phone: { [retained.id]: { stateStyles: {} } }, inactive: { [retained.id]: { hidden: true } } });
  }
  expect(parseDocument(serializeDocument(result))).toEqual(result); expect(serializeDocument(doc)).toBe(before);
});
