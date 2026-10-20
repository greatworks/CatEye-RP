import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, WidgetType } from '../../src/model/types';

/** Shared authoring/player/packaged-smoke fixture. Its text uses Arial; embedded
 * Roboto face identity is independently checked by the dedicated font suite. */
export function fontStyleFixture() {
  const doc = createDocument(); doc.name = 'Independent font style'; doc.caseSelection = 'never';
  const target = createWidget('box', 40, 40); target.name = 'Style target'; target.text = 'Bold and italic text'; target.width = 360; target.height = 70;
  Object.assign(target.style, { fontStyle: 'italic', fontWeight: 700, fontSize: 24, fill: '#f5f5ff' });
  target.mouseOverStyle = { fontStyle: 'normal' }; target.selectedStyle = { fontStyle: 'normal' }; target.errorStyle = { fontStyle: 'italic' }; target.disabledStyle = { fontStyle: 'normal' };
  const panel = createWidget('panel', 40, 150); panel.name = 'Italic parent'; panel.width = 380; panel.height = 300; panel.style.fontStyle = 'italic';
  panel.states![0].widgets = (['text', 'input', 'textarea', 'select', 'checkbox', 'radio', 'path'] as WidgetType[]).map((type, index) => {
    const child = createWidget(type, 10 + index % 2 * 190, 10 + Math.floor(index / 2) * 70); child.name = `Legacy ${type}`; child.width = 160; child.height = 55;
    if (type !== 'select') child.text = 'Upright child'; return child;
  });
  const rowChild = createWidget('text', 15, 8); rowChild.name = 'Legacy row caption'; rowChild.text = 'Upright row'; rowChild.width = 240;
  const repeater = createWidget('repeater', 40, 510); repeater.name = 'Italic repeater'; repeater.width = 380; repeater.height = 140; repeater.style.fontStyle = 'italic';
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'First' }, { Name: 'Second' }], template: [rowChild], itemHeight: 55, gap: 8 };
  const specs: [string, Omit<Action, 'id'>][] = [
    ['Apply italic', { type: 'setStyle', targetId: target.id, style: { fontStyle: 'italic' } }],
    ['Apply normal', { type: 'setStyle', targetId: target.id, style: { fontStyle: 'normal' } }],
    ['Select target', { type: 'setSelected', targetId: target.id, value: 'true' }],
    ['Clear selection', { type: 'setSelected', targetId: target.id, value: 'false' }],
    ['Set error', { type: 'setError', targetId: target.id, value: 'true' }],
    ['Clear error', { type: 'setError', targetId: target.id, value: 'false' }],
    ['Disable target', { type: 'disable', targetId: target.id }],
    ['Enable target', { type: 'enable', targetId: target.id }],
  ];
  const buttons = specs.map(([name, action], index) => {
    const button = createWidget('button', 470, 40 + index * 58); button.name = button.text = name; button.width = 190;
    button.interactions = [{ id: uid(), name, event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ ...action, id: uid() }] }]; return button;
  });
  doc.pages[0].widgets = [target, panel, repeater, ...buttons];
  // Keep this pre-existing style fixture on its saved max-width selection rule.
  delete doc.pages[0].adaptiveSelection; delete doc.pages[0].adaptiveBaseSize;
  doc.pages[0].adaptiveViews = [{ id: uid(), name: 'Upright tablet', width: 768, overrides: { [target.id]: { style: { fontStyle: 'normal' } } } }];
  return doc;
}
