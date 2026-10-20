import { createDocument, createWidget } from '../../src/model/document';
import { richTextPlainText } from '../../src/model/rich-text';
import type { Action } from '../../src/model/types';

export function richTextFixture() {
  const doc = createDocument(); doc.name = 'Mixed rich text'; doc.caseSelection = 'never'; const page = doc.pages[0]; page.width = 1060; page.height = 900;
  const title = createWidget('text', 30, 20); Object.assign(title, { id: 'rich-heading', name: 'Rich heading', text: 'Mixed typography, preserved', width: 940, height: 50 }); Object.assign(title.style, { fontFamily: 'Roboto', fontSize: 30, fontWeight: 700, textAlign: 'left' });
  const target = createWidget('box', 30, 100); Object.assign(target, { id: 'rich-target', name: 'Rich target', width: 570, height: 245 });
  Object.assign(target.style, { fontFamily: 'Arial', fontSize: 14, fontStyle: 'normal', fontWeight: 400, fill: '#f3f6fc', stroke: '#d5deed', verticalAlign: 'top', textPadding: [15, 18, 15, 18], textAlign: 'left' });
  target.richText = { expressionMode: 'literal', paragraphs: [
    { textAlign: 'left', lineHeightPx: 36, runs: [{ text: 'Normal ', style: { fontFamily: 'Roboto', fontSize: 26, fontStyle: 'normal' } }, { text: 'italic ', style: { fontFamily: 'Roboto', fontSize: 26, fontStyle: 'italic', color: '#6d28d9' } }, { text: 'bold', style: { fontFamily: 'Roboto', fontSize: 26, fontWeight: 700 } }] },
    { textAlign: 'left', lineHeightPx: 28, runs: [{ text: '', style: { fontSize: 14 } }] },
    { textAlign: 'right', lineHeightPx: 28, runs: [{ text: 'Right aligned, fixed 28px line spacing', style: { fontFamily: 'Roboto', fontSize: 18 } }] },
    { textAlign: 'left', lineHeightPx: 28, runs: [{ text: 'Literal: [[...]] and <b>text</b>', style: { fontFamily: 'Roboto', fontSize: 16, color: '#475569' } }] },
  ] }; target.text = richTextPlainText(target.richText); target.mouseOverStyle = { fontStyle: 'normal' }; target.selectedStyle = { color: '#1e98d7' }; target.errorStyle = { fontStyle: 'italic' }; target.disabledStyle = { fontStyle: 'normal' };
  const caption = createWidget('text', 30, 365); Object.assign(caption, { id: 'rich-caption', name: 'Rich caption', width: 650, height: 50, text: 'Hover resets italic temporarily; leaving restores each run.' }); Object.assign(caption.style, { fontFamily: 'Roboto', fontSize: 17, textAlign: 'left' });
  const row = createWidget('text', 10, 10); Object.assign(row, { id: 'rich-row', name: 'Rich row', width: 500, height: 35 });
  row.richText = { paragraphs: [{ runs: [{ text: 'Item [[It', style: { fontFamily: 'Roboto', fontStyle: 'italic', fontSize: 21 } }, { text: 'em.Name]]', style: { fontFamily: 'Roboto', fontWeight: 700 } }] }] }; row.text = richTextPlainText(row.richText);
  const repeater = createWidget('repeater', 30, 440); Object.assign(repeater, { id: 'rich-repeater', name: 'Rich repeater', width: 570, height: 130 }); repeater.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [row], itemHeight: 50, gap: 10 };
  const specs: [string, Omit<Action, 'id'>][] = [
    ['Select text', { type: 'setSelected', targetId: target.id, value: 'true' }], ['Clear selection', { type: 'setSelected', targetId: target.id, value: 'false' }],
    ['Set error', { type: 'setError', targetId: target.id, value: 'true' }], ['Clear error', { type: 'setError', targetId: target.id, value: 'false' }],
    ['Use plain text', { type: 'setText', targetId: target.id, value: 'Replacement\n\nkeeps first-run formatting' }],
    ['Set all italic', { type: 'setStyle', targetId: target.id, style: { fontStyle: 'italic' } }], ['Set all normal', { type: 'setStyle', targetId: target.id, style: { fontStyle: 'normal' } }],
  ];
  const buttons = specs.map(([text, action], index) => { const w = createWidget('button', 675, 100 + 61 * index); Object.assign(w, { id: `rich-button-${index}`, name: text, text, width: 245, height: 44 }); w.interactions = [{ id: `rich-event-${index}`, name: text, event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ ...action, id: `rich-action-${index}` }] }]; return w; });
  buttons[2].richText = { expressionMode: 'literal', paragraphs: [{ runs: [{ text: 'Set ', style: { fontStyle: 'italic' } }, { text: 'error' }] }] };
  const field = createWidget('input', 30, 605); Object.assign(field, { id: 'rich-field', name: 'Text before rich click', text: '', width: 350, height: 35 });
  field.interactions = [{ id: 'rich-field-blur', name: 'Clear error on blur', event: 'blur', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'rich-blur-action', type: 'setError', targetId: target.id, value: 'false' }] }];
  page.widgets = [title, target, caption, repeater, field, ...buttons];
  // Keep this pre-existing text fixture on its saved max-width selection rule.
  delete page.adaptiveSelection; delete page.adaptiveBaseSize;
  page.adaptiveViews = [{ id: 'rich-phone', name: 'Phone', width: 768, overrides: { [target.id]: { style: { fontStyle: 'normal' } } } }];
  return doc;
}
