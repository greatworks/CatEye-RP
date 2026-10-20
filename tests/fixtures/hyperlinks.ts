import { createDocument, createWidget } from '../../src/model/document';
import { richTextPlainText } from '../../src/model/rich-text';
import type { Action, Interaction, RichTextLink, Widget } from '../../src/model/types';

export function hyperlinkFixture() {
  const doc = createDocument(); doc.name = 'Hyperlinks · text, events and destinations'; doc.caseSelection = 'auto';
  const page = doc.pages[0]; page.width = 1080; page.height = 820;
  const text = (id: string, value: string, x: number, y: number, width = 600, height = 46) => {
    const w = createWidget('text', x, y); Object.assign(w, { id, name: id, text: value, width, height });
    Object.assign(w.style, { fontFamily: 'Roboto', fontSize: 20, textAlign: 'left', color: '#172554' }); return w;
  };
  const interaction = (id: string, name: string, actions: Omit<Action, 'id'>[]): Interaction => ({ id, name, event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map((a, i) => ({ ...a, id: `${id}-action-${i}` })) });
  const report = (value: string): Omit<Action, 'id'> => ({ type: 'setText', targetId: 'link-status', value });
  const linked = (id: string, value: string, x: number, y: number, actions: Omit<Action, 'id'>[]): Widget => {
    const w = text(id, value, x, y), link: RichTextLink = { id: `${id}-link`, name: value, interactions: [interaction(`${id}-click`, 'Follow link', actions)], mouseOverStyle: { strikethrough: true }, mouseDownStyle: { fontWeight: 700 } };
    w.richText = { expressionMode: 'literal', links: [link], paragraphs: [{ runs: [{ text: value, linkId: link.id, style: { color: '#2563eb', underline: true, strikethrough: false } }] }] }; return w;
  };
  const heading = text('link-heading', 'Text links with their own interactions', 30, 22, 1000, 60); Object.assign(heading.style, { fontSize: 31, fontWeight: 700 });
  const caption = text('link-caption', 'Hover, press and click. Link cases run before the parent widget.', 30, 83, 990); caption.style.fontSize = 17;
  const status = text('link-status', 'Ready', 30, 677, 980, 55); Object.assign(status.style, { fill: '#eef2ff', textPadding: [12, 14, 12, 14], fontWeight: 700 });
  const mixed = linked('link-mixed', 'Rich link', 30, 153, [report('Link begins'), { type: 'wait', duration: 0 }, report('Link finished')]);
  mixed.richText!.paragraphs[0].runs = [{ text: 'Read ' }, { ...mixed.richText!.paragraphs[0].runs[0], text: 'Rich ' }, { text: 'link', linkId: 'link-mixed-link', style: { color: '#0e7490', underline: true, fontStyle: 'italic' } }, { text: ' or click the surrounding text.' }];
  mixed.text = richTextPlainText(mixed.richText!); mixed.mouseOverStyle = { color: '#7c3aed' }; mixed.mouseDownStyle = { color: '#be123c' }; mixed.interactions = [interaction('link-mixed-parent', 'Parent click', [report('Parent clicked')])];
  const fallback = linked('link-fallback', 'Unmatched link → parent', 30, 220, [report('Should not run')]);
  fallback.richText!.links![0].interactions[0].conditions = [{ source: 'widgetText', key: status.id, operator: 'equals', value: 'Never matches' }]; fallback.interactions = [interaction('link-fallback-parent', 'Parent fallback', [report('Fallback reached parent')])];
  const menu = linked('link-menu', 'Choose a link case', 30, 285, []);
  menu.richText!.links![0].interactions = [interaction('link-menu-one', 'First link case', [report('First chosen')]), interaction('link-menu-two', 'Second link case', [{ type: 'wait', duration: 0 }, report('Second chosen')])]; menu.interactions = [interaction('link-menu-parent', 'Must stay suppressed', [report('Incorrect parent')])];
  const solo = linked('link-solo', 'Replaceable link', 30, 351, [report('Retained link clicked')]);
  const replace = createWidget('button', 680, 351); Object.assign(replace, { id: 'link-replace', name: 'Replace linked text', text: 'Replace linked text', width: 290, height: 42 }); replace.interactions = [interaction('link-replace-case', 'Change text', [{ type: 'setText', targetId: solo.id, value: 'Link survives Set Text' }])];
  const row = linked('link-row', '[[Item.Name]]', 10, 8, [report('Row [[Item.Name]] clicked')]); row.width = 270; delete row.richText!.expressionMode;
  const repeater = createWidget('repeater', 30, 418); Object.assign(repeater, { id: 'link-repeater', name: 'Linked rows', width: 600, height: 118 }); repeater.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [row], itemHeight: 50, gap: 5 };
  const disabled = linked('link-disabled', 'Disabled owner', 680, 418, [report('Incorrect disabled click')]); disabled.width = 290; disabled.disabled = true;
  const current = linked('link-current', 'Open destination · current', 30, 562, [{ type: 'openUrl', value: 'https://example.test/current', windowTarget: 'current' }, report('Current destination requested')]); current.width = 540;
  const fresh = linked('link-new', 'Open destination · new', 590, 562, [{ type: 'openUrl', value: 'https://example.test/new', windowTarget: 'new' }, report('New destination requested')]); fresh.width = 450;
  const note = text('link-note', 'Destination links use a reserved test domain. Replace their URLs for your prototype.', 30, 620, 1000, 38); note.style.fontSize = 16; note.style.color = '#64748b';
  page.widgets = [heading, caption, mixed, fallback, menu, solo, replace, repeater, disabled, current, fresh, note, status]; return doc;
}
