import { createDocument, createWidget, remapWidgetIds } from '../../src/model/document';
import { createMenu, layoutMenu, patchMenuItems, setMenuPadding } from '../../src/model/menu';
import type { Action, Interaction, Widget } from '../../src/model/types';
let sequence = 0;
const branch = (actions: Omit<Action, 'id'>[], patch: Partial<Interaction> = {}): Interaction => ({ id: `menu-case-${++sequence}`, name: 'Menu action', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: `menu-action-${++sequence}` })), ...patch });
const feedback = (value: string): Omit<Action, 'id'> => ({ type: 'setText', targetId: 'menu-status', value });
function menu(prefix: string, orientation: 'horizontal' | 'vertical', labels: string[], x = 0, y = 0): Widget {
  const source = createMenu(orientation, x, y), ids = new Map([[source.id, prefix], [source.menu!.table.id, `${prefix}-table`], ...source.menu!.table.table!.cells.map((cell, index) => [cell.id, `${prefix}-item-${index}`] as [string, string])]);
  let result = remapWidgetIds([source], ids)[0]; result.name = labels.join(' / ');
  result = patchMenuItems(result, result.menu!.table.table!.cells.map(cell => cell.id), cell => ({ text: labels[result.menu!.table.table!.cells.indexOf(cell)], width: 152, height: 38, style: { ...cell.style, fill: '#ffffff', stroke: '#c7ccda', color: '#263348', fontSize: 14, textPadding: [6, 12, 6, 12], textAlign: 'left' }, mouseOverStyle: { fill: '#eeedff', color: '#4f46e5' } }));
  return result;
}
export function menuFixture() {
  sequence = 0;
  const doc = createDocument(); doc.id = 'menu-document'; doc.name = 'Classic menus · nested navigation'; doc.caseSelection = 'never';
  doc.variables.Shown = '0'; doc.variables.Hidden = '0';
  const page = doc.pages[0]; page.id = 'menu-page'; page.name = 'Menus'; page.width = 1120; page.height = 1140; page.background = '#f7f8fc';
  const text = (id: string, value: string, x: number, y: number, width: number, size = 14, height = 36) => { const widget = createWidget('text', x, y); Object.assign(widget, { id, name: id, text: value, width, height }); Object.assign(widget.style, { fontSize: size, color: '#263348', fontWeight: size > 20 ? 700 : 400 }); return widget; };
  const main = menu('menu-main', 'horizontal', ['File', 'Edit', 'View'], 44, 154);
  const file = menu('menu-file', 'vertical', ['New project', 'Open project', 'Recent projects']); file.menu!.parentCellId = 'menu-main-item-0';
  const recent = menu('menu-recent', 'vertical', ['Alpha project', 'Beta project', 'Gamma project']); recent.menu!.parentCellId = 'menu-file-item-2';
  recent.menu!.table.table!.cells.forEach((cell, index) => { cell.interactions = [branch([feedback(`Opened ${['Alpha', 'Beta', 'Gamma'][index]} project`), { type: 'setSelected', targetId: cell.id, value: 'true' }])]; cell.selectedStyle = { fill: '#d1fae5', color: '#047857' }; });
  file.menu!.submenus = [recent];
  file.menu!.table.table!.cells[0].interactions = [branch([feedback('Created a new project')])];
  file.interactions = [branch([{ type: 'setVariable', targetId: 'Shown', value: '[[Shown + 1]]' }], { event: 'show' }), branch([{ type: 'setVariable', targetId: 'Hidden', value: '[[Hidden + 1]]' }], { event: 'hide' })];
  const edit = menu('menu-edit', 'vertical', ['Undo', 'Redo', 'Delete']); edit.menu!.parentCellId = 'menu-main-item-1';
  edit.menu!.table.table!.cells[0].interactions = [branch([feedback('Undo chosen')])];
  main.menu!.submenus = [file, edit]; main.interactions = [branch([feedback('Root menu handled this click')])];
  const padded = setMenuPadding(main, [8, 8, 8, 8]); padded.style.fill = '#e2e5ee'; padded.style.strokeWidth = 1;
  const vertical = menu('menu-side', 'vertical', ['Home', 'Reports', 'Settings'], 704, 154), reports = menu('menu-reports', 'vertical', ['Daily', 'Weekly', 'Monthly']); reports.menu!.parentCellId = 'menu-side-item-1';
  reports.menu!.table.table!.cells.forEach(cell => { cell.interactions = [branch([feedback(`${cell.text} report chosen`)])]; }); vertical.menu!.submenus = [reports];
  const status = text('menu-status', 'Ready — hover a menu item to open its submenu.', 44, 390, 1032, 16, 54); status.style.fill = '#eeedff'; status.style.textPadding = [14, 14, 14, 14];
  const button = (id: string, label: string, x: number, actions: Omit<Action, 'id'>[]) => { const widget = createWidget('button', x, 464); Object.assign(widget, { id, name: label, text: label, width: 240, height: 40, interactions: [branch(actions)] }); return widget; };
  const toggle = button('menu-toggle', 'Toggle horizontal menu', 44, [{ type: 'toggle', targetId: 'menu-main' }]);
  const read = button('menu-read', 'Read all menu text', 304, [feedback('[[Widget.menu-main.text]]')]);
  const unsupported = button('menu-noops', 'Menu action boundaries', 564, [{ type: 'resize', targetId: 'menu-main', x: 800, y: 400 }, { type: 'disable', targetId: 'menu-main' }, { type: 'setSelected', targetId: 'menu-main', value: 'true' }, { type: 'setError', targetId: 'menu-main', value: 'true' }, feedback('Menu bounds and state unchanged')]);
  const repeater = createWidget('repeater', 44, 624), repeated = menu('menu-row', 'horizontal', ['[[Item.Name]]', 'Details', 'Help']);
  const rowSub = menu('menu-row-sub', 'vertical', ['Open [[Item.Name]]', 'Save [[Item.Name]]', 'Close [[Item.Name]]']); rowSub.menu!.parentCellId = 'menu-row-item-0';
  rowSub.menu!.table.table!.cells[0].interactions = [branch([{ type: 'setText', targetId: 'menu-row-result', value: 'Opened [[Item.Name]]' }])]; repeated.menu!.submenus = [rowSub];
  const rowResult = text('menu-row-result', 'No row action yet', 490, 0, 400);
  Object.assign(repeater, { id: 'menu-repeater', name: 'Independent repeated menus', width: 940, height: 346 });
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [layoutMenu(repeated), rowResult], itemWidth: 940, itemHeight: 164, gap: 18, fitToContent: false, layout: 'vertical' };
  page.widgets = [text('menu-heading', 'Nested menus. Independent menu items.', 44, 28, 1000, 28, 46), text('menu-caption', 'Horizontal and vertical menus open on hover; item actions stay separate from menu containers.', 44, 85, 1000), padded, layoutMenu(vertical), status, toggle, read, unsupported, text('menu-row-heading', 'The same menu template in two independent data rows', 44, 562, 1000, 20), repeater];
  return doc;
}
