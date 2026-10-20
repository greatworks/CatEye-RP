import { createDocument, createLayer, createPage, createWidget, parseDocument, serializeDocument } from '../../src/model/document';
import type { Action, EventType, Interaction, Widget } from '../../src/model/types';

export const layerEvent = (id: string, event: EventType, actions: Omit<Action, 'id'>[]): Interaction => ({
  id: `${id}-${event}`, event, name: event, enabled: true, conditions: [], conditionMode: 'all',
  actions: actions.map((action, index) => ({ id: `${id}-${event}-${index}`, ...action })),
});
const box = (id: string, x: number, y: number, width: number, height: number, type: Widget['type'] = 'box') =>
  Object.assign(createWidget(type, x, y), { id, name: id, text: type === 'inlineFrame' || type === 'repeater' ? '' : id, width, height });
const group = (id: string, children: Widget[], propagate = false) => {
  const value = createLayer(children, id); value.id = id; value.layer!.propagate = propagate; return value;
};
const button = (id: string, x: number, y: number, actions: Omit<Action, 'id'>[]) => {
  const value = box(id, x, y, 160, 36, 'button'); value.interactions = [layerEvent(id, 'click', actions)]; return value;
};
const move = (id: string, x: number, y: number, duration = 0): Omit<Action, 'id'> => ({
  type: 'move', move: { targets: [{ target: { kind: 'widget', id }, mode: 'delta', x: { text: String(x) }, y: { text: String(y) }, trajectory: 'straight', easing: duration ? 'linear' : 'none', duration }] },
});
const rotate = (id: string): Omit<Action, 'id'> => ({
  type: 'rotate', targetId: id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 160 },
});

/** Independently authored geometry and labels; no extracted native artwork. */
export function nativeLayersRuntimeFixture() {
  const doc = createDocument(); Object.assign(doc, { id: 'layer-runtime-document', name: 'Native Layer runtime laboratory', caseSelection: 'never' });
  const page = doc.pages[0]; Object.assign(page, { id: 'layer-runtime-page', width: 1100, height: 900, adaptiveBaseSize: { width: 1100, height: 0 } });
  const first = box('layer-first', 100, 100, 40, 20), second = box('layer-second', 160, 100, 40, 20);
  first.text = 'A'; second.text = 'B';
  const main = group('layer-motion', [first, group('layer-nested', [second])]);
  const direct = box('layer-style-direct', 40, 350, 100, 40), blocked = box('layer-style-blocked', 180, 350, 100, 40);
  for (const child of [direct, blocked]) {
    child.style.fill = '#ffffff'; child.mouseOverStyle = { fill: '#ff0000' }; child.selectedStyle = { fill: '#00aa44' };
  }
  const styled = group('layer-style', [direct, group('layer-style-barrier', [blocked])], true);
  const leaf = box('layer-row-leaf', 12, 8, 80, 30); leaf.text = 'Row';
  const rowLayer = group('layer-row-group', [leaf]); rowLayer.interactions = [layerEvent(rowLayer.id, 'click', [move(rowLayer.id, 20, 0)])];
  const inner = box('layer-inner-repeater', 10, 8, 250, 90, 'repeater');
  inner.repeater = { columns: ['Name'], rows: [{ Name: 'Inner one' }, { Name: 'Inner two' }], itemHeight: 42, gap: 2, template: [rowLayer] };
  const outer = box('layer-outer-repeater', 380, 330, 300, 230, 'repeater');
  outer.repeater = { columns: ['Name'], rows: [{ Name: 'Outer one' }, { Name: 'Outer two' }], itemHeight: 104, gap: 2, template: [inner] };

  const childPage = createPage('Layer frame'); Object.assign(childPage, { id: 'layer-frame-page', width: 300, height: 250 });
  const frameLeaf = box('layer-frame-leaf', 30, 70, 70, 30), frameRoot = group('layer-frame-group', [frameLeaf]);
  frameLeaf.text = 'Frame member';
  childPage.widgets = [frameRoot, button('layer-frame-move', 20, 150, [move(frameRoot.id, 35, 15)])];
  const frame = box('layer-frame', 740, 330, 302, 252, 'inlineFrame'); frame.inlineFrame!.target = { kind: 'page', pageId: childPage.id };
  page.widgets = [
    main,
    button('layer-combine', 40, 220, [move(main.id, 20, 10, 160), { type: 'resize', resize: { targets: [{ target: { kind: 'widget', id: main.id }, width: { text: '200' }, height: { text: '40' }, anchor: 'top left', easing: 'linear', duration: 160 }] } }]),
    button('layer-rotate', 220, 220, [rotate(main.id)]),
    styled, button('layer-select', 40, 420, [{ type: 'setSelected', targetId: styled.id, value: 'true' }]),
    outer, frame,
  ];
  doc.pages.push(childPage);
  return parseDocument(serializeDocument(doc));
}
