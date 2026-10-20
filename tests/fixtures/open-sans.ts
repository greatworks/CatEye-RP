import { createDocument, createPage, createWidget } from '../../src/model/document';
import { layoutTable } from '../../src/model/table';
import { layoutMenu } from '../../src/model/menu';
import { layoutTree } from '../../src/model/tree-widget';
import type { Widget } from '../../src/model/types';

export const openSansFaces = (['normal', 'italic'] as const).flatMap(style =>
  ([[300, 'Light'], [400, 'Regular'], [600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold']] as const).map(([weight, name]) => ({
    weight, style, name, id: `open-sans-${weight}-${style}`,
    postScriptName: `OpenSans-${style === 'normal' ? name : name === 'Regular' ? 'Italic' : `${name}Italic`}`,
  })),
);
function format(widget: Widget, weight = 400, style: 'normal' | 'italic' = 'normal') {
  Object.assign(widget.style, { fontFamily: 'Open Sans', fontSize: 24, fontWeight: weight, fontStyle: style, textPadding: [0, 0, 0, 0], verticalAlign: 'top', lineHeight: 'normal' });
  return widget;
}
/** Authored font examples, not claims about native default geometry or AutoFit. */
export function openSansFixture() {
  const doc = createDocument(); doc.name = 'Open Sans — portable typography'; doc.caseSelection = 'never';
  const page = doc.pages[0]; Object.assign(page, { id: 'open-sans-page', name: 'Ten font faces', width: 1120, height: 700 });
  page.widgets = openSansFaces.map((face, index) => {
    const widget = format(createWidget('text', 35 + Math.floor(index / 5) * 550, 35 + index % 5 * 76), face.weight, face.style);
    Object.assign(widget, { id: face.id, name: `Open Sans ${face.name} ${face.style}`, text: `${face.name} ${face.style} 0123456789`, width: 500, height: 50 });
    return widget;
  });
  const target = format(createWidget('text', 35, 480)); Object.assign(target, { id: 'open-sans-action-target', text: 'Change weight and style', width: 600, height: 55 });
  const button = createWidget('button', 35, 420); Object.assign(button, { id: 'open-sans-change', text: 'Use ExtraBold Italic', width: 240 });
  button.interactions = [{ id: 'open-sans-change-event', name: 'Change typography', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: 'open-sans-change-style', type: 'setStyle', targetId: target.id, style: { fontFamily: 'Open Sans', fontWeight: 800, fontStyle: 'italic' } }] }];
  page.widgets.push(button, target);
  const nested = createPage('Nested typography'); Object.assign(nested, { id: 'open-sans-nested', width: 1120, height: 760 });
  const table = createWidget('table', 35, 35), cell = format(createWidget('tableCell', 0, 0), 600);
  Object.assign(cell, { id: 'open-sans-table-cell', text: 'Table / SemiBold' });
  table.table = { columnWidths: [470], rowHeights: [50], cells: [cell] }; table.id = 'open-sans-table'; nested.widgets.push(layoutTable(table));
  const menu = createWidget('menu', 35, 125), item = format(createWidget('tableCell', 0, 0), 800);
  Object.assign(item, { id: 'open-sans-menu-item', text: 'Menu / ExtraBold' });
  menu.id = 'open-sans-menu'; menu.menu!.table.table = { columnWidths: [470], rowHeights: [50], cells: [item] }; nested.widgets.push(layoutMenu(menu));
  const tree = createWidget('tree', 35, 215), node = tree.tree!.nodes[0];
  node.treeNode!.children = []; const label = format(node.treeNode!.label, 300);
  Object.assign(label, { id: 'open-sans-tree-label', text: 'Tree / Light', width: 450, height: 48 }); nested.widgets.push(layoutTree(tree));
  const rich = createWidget('text', 35, 320); Object.assign(rich, { id: 'open-sans-rich', text: 'Rich / Bold Italic', width: 500, height: 52 });
  rich.richText = { paragraphs: [{ runs: [{ text: rich.text, style: { fontFamily: 'Open Sans', fontSize: 24, fontWeight: 700, fontStyle: 'italic' } }], lineHeightPx: 'normal' }] };
  Object.assign(rich.style, { textPadding: [0, 0, 0, 0], verticalAlign: 'top', lineHeight: 'normal' }); nested.widgets.push(rich);
  doc.pages.push(nested);
  const framed = createPage('Embedded typography'); Object.assign(framed, { id: 'open-sans-framed', width: 1140, height: 800 });
  const frame = createWidget('inlineFrame', 0, 0); Object.assign(frame, { id: 'open-sans-frame', width: 1120, height: 760 }); frame.inlineFrame!.target = { kind: 'page', pageId: nested.id }; framed.widgets = [frame]; doc.pages.push(framed);
  return doc;
}
export const openSansNestedTargets = [
  { id: 'open-sans-table-cell', postScriptName: 'OpenSans-SemiBold' },
  { id: 'open-sans-menu-item', postScriptName: 'OpenSans-ExtraBold' },
  { id: 'open-sans-tree-label', postScriptName: 'OpenSans-Light' },
  { id: 'open-sans-rich', postScriptName: 'OpenSans-BoldItalic' },
];
