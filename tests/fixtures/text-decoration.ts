import { createDocument, createWidget } from '../../src/model/document';
import { richTextPlainText } from '../../src/model/rich-text';
import type { Action } from '../../src/model/types';

export function textDecorationFixture() {
  const doc = createDocument(); doc.name = 'Text decorations and inline editing'; doc.caseSelection = 'never';
  const page = doc.pages[0]; page.width = 1080; page.height = 920;
  const heading = createWidget('text', 30, 25); Object.assign(heading, { id: 'deco-heading', name: 'Decoration heading', text: 'Text decoration, preserved', width: 1000, height: 50 }); Object.assign(heading.style, { fontFamily: 'Roboto', fontSize: 30, fontWeight: 700, textAlign: 'left' });
  const rich = createWidget('box', 30, 115); Object.assign(rich, { id: 'deco-rich', name: 'Decoration mixture', width: 570, height: 100 });
  Object.assign(rich.style, { fontFamily: 'Roboto', fontSize: 24, underline: true, textPadding: [16, 18, 16, 18], textAlign: 'left', fill: '#f3f6fc', stroke: '#d5deed' });
  rich.richText = { expressionMode: 'literal', paragraphs: [{ lineHeightPx: 34, runs: [
    { text: 'None  ', style: { underline: false, strikethrough: false } },
    { text: 'Underline  ', style: { underline: true, strikethrough: false, color: '#6d28d9' } },
    { text: 'Strike  ', style: { underline: false, strikethrough: true } },
    { text: 'Both', style: { underline: true, strikethrough: true, fontWeight: 700 } },
  ] }] }; rich.text = richTextPlainText(rich.richText);
  rich.mouseOverStyle = { strikethrough: true }; rich.selectedStyle = { underline: false }; rich.disabledStyle = { underline: true, strikethrough: true };
  const hint = createWidget('text', 30, 228); Object.assign(hint, { id: 'deco-hint', name: 'Decoration explanation', text: 'Hover changes the line. Leaving restores each text segment.', width: 570, height: 55 }); Object.assign(hint.style, { fontFamily: 'Roboto', fontSize: 17, textAlign: 'left' });
  const adaptive = createWidget('text', 30, 315); Object.assign(adaptive, { id: 'deco-adaptive', name: 'Adaptive decoration', text: 'Adaptive state composition', width: 570, height: 55, selected: true });
  Object.assign(adaptive.style, { fontFamily: 'Roboto', fontSize: 23, underline: true, textAlign: 'left' }); adaptive.selectedStyle = { strikethrough: true };
  adaptive.richText = { paragraphs: [{ runs: [{ text: adaptive.text, style: { underline: true } }] }] };
  const input = createWidget('input', 30, 425); Object.assign(input, { id: 'deco-input', name: 'Decorated input', text: 'Editable text', width: 350, height: 40 }); Object.assign(input.style, { underline: true, strikethrough: true, fontSize: 19 });
  const panel = createWidget('panel', 30, 535); Object.assign(panel, { id: 'deco-panel', name: 'Container isolation', width: 570, height: 85 }); panel.style.underline = true;
  const child = createWidget('text', 10, 10); Object.assign(child, { id: 'deco-child', name: 'Undecorated child', text: 'Container formatting does not mark this child.', width: 530, height: 55 }); child.style.textAlign = 'left'; child.style.fontSize = 18;
  panel.states = [{ id: 'deco-panel-state', name: 'State 1', widgets: [child] }]; panel.activeStateId = 'deco-panel-state';
  const actions: [string, Omit<Action, 'id'>][] = [
    ['Select mixture', { type: 'setSelected', targetId: rich.id, value: 'true' }],
    ['Clear selection', { type: 'setSelected', targetId: rich.id, value: 'false' }],
    ['Disable mixture', { type: 'disable', targetId: rich.id }],
    ['Enable mixture', { type: 'enable', targetId: rich.id }],
    ['Replace text', { type: 'setText', targetId: rich.id, value: 'Replacement keeps the first text format.' }],
  ];
  const buttons = actions.map(([name, action], index) => {
    const button = createWidget('button', 655, 115 + index * 64); Object.assign(button, { id: `deco-button-${index}`, name, text: name, width: 250, height: 44 });
    button.interactions = [{ id: `deco-event-${index}`, name, event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ ...action, id: `deco-action-${index}` }] }]; return button;
  });
  page.widgets = [heading, rich, hint, adaptive, input, panel, ...buttons];
  // Keep this pre-existing decoration fixture on its saved max-width selection rule.
  delete page.adaptiveSelection; delete page.adaptiveBaseSize;
  page.adaptiveViews = [{ id: 'deco-phone', name: 'Phone', width: 768, overrides: { [adaptive.id]: { style: { underline: false }, width: 340 }, [rich.id]: { width: 340 }, [panel.id]: { width: 340 } } }];
  return doc;
}
