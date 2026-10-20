import type { MenuData, Widget } from './types';
import { deleteTableTracks, insertTableTrack, layoutTable, moveTableTrack, patchTableCells, resizeTable, tableData } from './table';

export type MenuOrientation = MenuData['orientation'];
/** Interior menu objects share all properties across adaptive views, including placement. */
export function menuSharedDescendantIds(widgets: Widget[]): Set<string> {
  const ids = new Set<string>();
  const visit = (items: Widget[], inside = false) => { for (const widget of items) {
    if (inside) ids.add(widget.id);
    if (widget.layer) visit(widget.layer.widgets, inside);
    for (const state of widget.states ?? []) visit(state.widgets, inside);
    if (widget.repeater) visit(widget.repeater.template, inside);
    if (widget.table) visit(widget.table.cells, inside);
    if (widget.menu) visit([widget.menu.table, ...widget.menu.submenus], true);
    if (widget.tree) visit(widget.tree.nodes, inside);
    if (widget.treeNode) visit([widget.treeNode.label, ...widget.treeNode.children], inside);
  } };
  visit(widgets); return ids;
}
export function menuData(menu: Widget): MenuData {
  if (menu.type !== 'menu' || !menu.menu) throw new Error('Select a menu');
  const data = menu.menu, grid = tableData(data.table);
  if (!['horizontal', 'vertical'].includes(data.orientation)) throw new Error('Invalid menu orientation');
  if (data.orientation === 'horizontal' ? grid.rowHeights.length !== 1 : grid.columnWidths.length !== 1) throw new Error('Menus require a single row or column');
  if (data.padding.length !== 4 || data.padding.some(value => !Number.isFinite(value) || value < 0 || value > 100000)) throw new Error('Menu padding must contain four finite nonnegative values');
  const ids = new Set(grid.cells.map(cell => cell.id)), owners = new Set<string>();
  for (const child of data.submenus) {
    const owner = child.menu?.parentCellId;
    if (child.type !== 'menu' || !owner || !ids.has(owner) || owners.has(owner)) throw new Error('Each submenu must belong to a unique item in its immediate parent menu');
    owners.add(owner);
  }
  return data;
}

/** Authoring geometry policy. Runtime hover never changes saved positions or tracks. */
export function layoutMenu(menu: Widget): Widget {
  const data = menuData(menu), [top, right, bottom, left] = data.padding;
  const table = { ...layoutTable(data.table), x: left, y: top, rotation: 0 };
  const width = table.width + left + right, height = table.height + top + bottom;
  if (width > 100000 || height > 100000) throw new Error('Menu bounds exceed 100000 pixels');
  const submenus = data.submenus.map(child => {
    const cell = table.table!.cells.find(item => item.id === child.menu!.parentCellId)!;
    return { ...layoutMenu(child), rotation: 0,
      x: table.x + cell.x + (data.orientation === 'vertical' ? cell.width : 0),
      y: table.y + cell.y + (data.orientation === 'horizontal' ? cell.height : 0) };
  });
  return { ...menu, width, height, menu: { ...data, padding: [...data.padding], table, submenus } };
}

export function createMenu(orientation: MenuOrientation = 'horizontal', x = 100, y = 100): Widget {
  const base: Widget = {
    id: crypto.randomUUID(), type: 'menu', name: orientation === 'horizontal' ? 'Horizontal menu' : 'Vertical menu', text: '',
    x, y, width: 100, height: 30, rotation: 0, hidden: false, locked: false, disabled: false, notes: '', interactions: [],
    style: { fill: '#ffffff00', stroke: '#b8bdc7', strokeWidth: 0, radius: 0, color: '#263348', fontSize: 14, fontFamily: 'Arial', fontWeight: 400, textAlign: 'center', opacity: 1 },
  };
  // Matches the witnessed Default.rplib menu item base style; no invented hover effect.
  const cells: Widget[] = Array.from({ length: 3 }, (_, index) => ({ ...base, id: crypto.randomUUID(), type: 'tableCell', x: 0, y: 0, name: `Menu item ${index + 1}`, text: orientation === 'horizontal' ? ['File', 'Edit', 'View'][index] : `Item ${index + 1}`, interactions: [], style: { ...base.style, stroke: '#797979', strokeWidth: 1, borderWidths: [1, 1, 1, 1], color: '#333333', fontSize: 13, fontStyle: 'normal', textAlign: 'left', verticalAlign: 'middle', lineHeight: 'normal', textPadding: [2, 2, 2, 2], underline: false, strikethrough: false } }));
  const table = layoutTable({ ...base, id: crypto.randomUUID(), type: 'table', name: 'Menu table', x: 0, y: 0, interactions: [], style: { ...base.style, fill: 'transparent' }, table: { cells, columnWidths: orientation === 'horizontal' ? [100, 100, 100] : [100], rowHeights: orientation === 'horizontal' ? [30] : [30, 30, 30] } });
  return layoutMenu({ ...base, menu: { orientation, table, submenus: [], padding: [0, 0, 0, 0] } });
}

export function findMenu(root: Widget, id: string): Widget | undefined {
  if (root.type !== 'menu') return undefined;
  if (root.id === id) return root;
  for (const child of menuData(root).submenus) { const found = findMenu(child, id); if (found) return found; }
  return undefined;
}
export function updateMenu(root: Widget, id: string, update: (menu: Widget) => Widget): Widget {
  if (!findMenu(root, id)) throw new Error('Menu is not part of the selected root');
  const visit = (menu: Widget): Widget => menu.id === id ? update(menu) : { ...menu, menu: { ...menuData(menu), submenus: menu.menu!.submenus.map(visit) } };
  return layoutMenu(visit(root));
}
function axis(menu: Widget) { return menuData(menu).orientation === 'horizontal' ? 'column' as const : 'row' as const; }
export function insertMenuItem(menu: Widget, index: number): Widget {
  const data = menuData(menu), table = insertTableTrack(data.table, axis(menu), index);
  return layoutMenu({ ...menu, menu: { ...data, table } });
}
export function deleteMenuItem(menu: Widget, cellId: string): Widget {
  const data = menuData(menu), index = data.table.table!.cells.findIndex(cell => cell.id === cellId);
  if (index < 0) throw new Error('Item does not belong to this menu');
  const table = deleteTableTracks(data.table, axis(menu), [index]);
  return layoutMenu({ ...menu, menu: { ...data, table, submenus: data.submenus.filter(child => child.menu!.parentCellId !== cellId) } });
}
export function moveMenuItem(menu: Widget, from: number, to: number): Widget {
  const data = menuData(menu);
  return layoutMenu({ ...menu, menu: { ...data, table: moveTableTrack(data.table, axis(menu), from, to) } });
}
export function patchMenuItems(menu: Widget, ids: readonly string[], patch: Partial<Widget> | ((cell: Widget) => Partial<Widget>)): Widget {
  const data = menuData(menu);
  return layoutMenu({ ...menu, menu: { ...data, table: patchTableCells(data.table, ids, patch) } });
}
export function setMenuPadding(menu: Widget, padding: MenuData['padding']): Widget {
  return layoutMenu({ ...menu, menu: { ...menuData(menu), padding } });
}
export function addSubmenu(menu: Widget, cellId: string): Widget {
  const data = menuData(menu);
  if (!data.table.table!.cells.some(cell => cell.id === cellId)) throw new Error('Item does not belong to this menu');
  if (data.submenus.some(child => child.menu!.parentCellId === cellId)) throw new Error('This item already has a submenu');
  const child = createMenu('vertical', 0, 0);
  child.menu!.parentCellId = cellId;
  return layoutMenu({ ...menu, menu: { ...data, submenus: [...data.submenus, child] } });
}
export function deleteSubmenu(menu: Widget, cellId: string): Widget {
  const data = menuData(menu);
  if (!data.table.table!.cells.some(cell => cell.id === cellId)) throw new Error('Item does not belong to this menu');
  return layoutMenu({ ...menu, menu: { ...data, submenus: data.submenus.filter(child => child.menu!.parentCellId !== cellId) } });
}
export function resizeMenu(menu: Widget, width: number, height: number): Widget {
  const data = menuData(menu), [top, right, bottom, left] = data.padding;
  return layoutMenu({ ...menu, menu: { ...data, table: resizeTable(data.table, width - left - right, height - top - bottom) } });
}
export function setMenuOrientation(menu: Widget, orientation: MenuOrientation): Widget {
  const data = menuData(menu), grid = tableData(data.table);
  if (orientation === data.orientation) return menu;
  const columnWidths = orientation === 'horizontal' ? grid.cells.map(cell => cell.width) : [Math.max(...grid.cells.map(cell => cell.width))];
  const rowHeights = orientation === 'vertical' ? grid.cells.map(cell => cell.height) : [Math.max(...grid.cells.map(cell => cell.height))];
  const table = layoutTable({ ...data.table, table: { ...grid, columnWidths, rowHeights } });
  return layoutMenu({ ...menu, menu: { ...data, orientation, table } });
}
