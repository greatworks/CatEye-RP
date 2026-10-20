import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Widget } from '../model/types';
import './MenuEditor.css';

export interface MenuSelection { rootMenuId: string; menuId: string; cellId?: string }
export type MenuOperation = { kind: 'insert'; index: number } | { kind: 'delete' | 'addSubmenu' | 'deleteSubmenu'; cellId: string } | { kind: 'move'; from: number; to: number };
export interface MenuInspectorContext {
  menu: Widget;
  cellId?: string;
  onOperation: (operation: MenuOperation) => void;
  onSelectMenu: () => void;
  onEditSubmenu: (submenu: Widget) => void;
  onOrientation: (orientation: 'horizontal' | 'vertical') => void;
  onPadding: (padding: [number, number, number, number]) => void;
}

/** Session-only navigation; no visibility or selected flags are written to the prototype. */
export function menuAncestors(root: Widget, targetId: string): string[] | undefined {
  if (root.id === targetId) return [root.id];
  for (const child of root.menu?.submenus ?? []) {
    const path = menuAncestors(child, targetId);
    if (path) return [root.id, ...path];
  }
  return undefined;
}

function PaddingField({ side, value, onChange }: { side: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() { const number = Number(draft); if (draft.trim() && Number.isFinite(number) && number >= 0 && number <= 100000) onChange(number); else setDraft(String(value)); }
  return <label>Padding {side}<input aria-label={`Menu padding ${side}`} type="number" min={0} max={100000} step={1} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/></label>;
}

export function MenuStructureControls({ menu, cellId, onOperation, onSelectMenu, onEditSubmenu, onOrientation, onPadding }: MenuInspectorContext) {
  const data = menu.menu!, cells = data.table.table!.cells, index = cells.findIndex(cell => cell.id === cellId), child = data.submenus.find(item => item.menu!.parentCellId === cellId);
  return <section className="menu-structure-controls" aria-label="Menu structure">
    <strong>{data.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'} menu · {cells.length} items</strong>
    {cellId && <button onClick={onSelectMenu}>Select containing menu</button>}
    <label>Orientation<select aria-label="Menu orientation" value={data.orientation} disabled={menu.locked} onChange={event => onOrientation(event.target.value as 'horizontal' | 'vertical')}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>
    <div className="menu-padding-fields">{(['top', 'right', 'bottom', 'left'] as const).map((side, i) => <PaddingField key={`${menu.id}-${side}`} side={side} value={data.padding[i]} onChange={value => { if (!menu.locked) { const padding = [...data.padding] as [number, number, number, number]; padding[i] = value; onPadding(padding); } }}/>)}</div>
    <div className="menu-operation-grid">
      <button disabled={menu.locked} onClick={() => onOperation({ kind: 'insert', index: Math.max(0, index) })}>Add menu item before</button>
      <button disabled={menu.locked} onClick={() => onOperation({ kind: 'insert', index: index < 0 ? cells.length : index + 1 })}>Add menu item after</button>
      <button disabled={menu.locked || index < 0 || cells.length <= 1} onClick={() => onOperation({ kind: 'delete', cellId: cellId! })}>Delete menu item</button>
      <button disabled={menu.locked || index < 1} onClick={() => onOperation({ kind: 'move', from: index, to: index - 1 })}>Move menu item earlier</button>
      <button disabled={menu.locked || index < 0 || index === cells.length - 1} onClick={() => onOperation({ kind: 'move', from: index, to: index + 1 })}>Move menu item later</button>
      <button disabled={menu.locked || index < 0 || Boolean(child)} onClick={() => onOperation({ kind: 'addSubmenu', cellId: cellId! })}>Add submenu</button>
      <button disabled={menu.locked || !child} onClick={() => onOperation({ kind: 'deleteSubmenu', cellId: cellId! })}>Delete submenu</button>
      <button disabled={!child} onClick={() => child && onEditSubmenu(child)}>Edit submenu</button>
    </div>
    <p>Item content, structure, padding and styles are shared across adaptive views. Select an item to edit its text and interactions.</p>
  </section>;
}

export function MenuOutlineEntries({ menu, selection, onSelect }: { menu: Widget; selection: MenuSelection | null; onSelect: (menu: Widget, cellId?: string) => void }) {
  return <div className="menu-outline-items">{menu.menu!.table.table!.cells.map(cell => {
    const submenu = menu.menu!.submenus.find(child => child.menu!.parentCellId === cell.id);
    return <div key={cell.id}><button className={`tree-row ${selection?.menuId === menu.id && selection.cellId === cell.id ? 'selected' : ''}`} aria-label={`Select menu item ${cell.name}`} onClick={() => onSelect(menu, cell.id)}>{cell.name}</button>{submenu && <details open><summary><button aria-label={`Select submenu ${submenu.name}`} onClick={() => onSelect(submenu)}>{submenu.name}</button></summary><MenuOutlineEntries menu={submenu} selection={selection} onSelect={onSelect}/></details>}</div>;
  })}</div>;
}

export function MenuCanvasControls({ menu, selected, cellId, onSelectOwner, onOwnerPointerDown }: { menu: Widget; selected: boolean; cellId?: string; onSelectOwner: () => void; onOwnerPointerDown?: (event: ReactPointerEvent) => void }) {
  const table = menu.menu!.table, cell = table.table!.cells.find(item => item.id === cellId);
  return <div className="menu-canvas-controls" role="group" aria-label={`Menu editing controls ${menu.name}`}>
    <button className="menu-owner-control" aria-label={`Select menu ${menu.name}`} title="Select menu container" onPointerDown={event => { event.stopPropagation(); onOwnerPointerDown?.(event); }} onClick={event => { event.stopPropagation(); onSelectOwner(); }}>☰</button>
    {selected && <span className={cell ? 'menu-item-selection' : 'menu-container-selection'} style={cell ? { left: table.x + cell.x, top: table.y + cell.y, width: cell.width, height: cell.height } : { inset: 0 }}/>} 
  </div>;
}
