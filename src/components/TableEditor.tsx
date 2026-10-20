import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Widget } from '../model/types';
import './TableEditor.css';

export interface TableSelection { tableId: string; cellIds: string[]; anchorCellId?: string; focusCellId?: string }
export type TableOperation = { kind: 'insert' | 'delete' | 'move'; axis: 'row' | 'column'; indices: number[]; to?: number };
export interface TableInspectorContext {
  table: Widget;
  selection: TableSelection | null;
  onOperation: (operation: TableOperation) => void;
  onSelectOwner: () => void;
  onSelectAllCells?: () => void;
}
export function tableCellCoordinates(table: Widget, id: string) {
  const index = table.table!.cells.findIndex(cell => cell.id === id), columns = table.table!.columnWidths.length;
  return index < 0 ? undefined : { row: Math.floor(index / columns), column: index % columns };
}
export function tableRectangleIds(table: Widget, from: string, to: string) {
  const first = tableCellCoordinates(table, from), last = tableCellCoordinates(table, to);
  if (!first || !last) return [];
  return table.table!.cells.filter((_, index) => {
    const row = Math.floor(index / table.table!.columnWidths.length), column = index % table.table!.columnWidths.length;
    return row >= Math.min(first.row, last.row) && row <= Math.max(first.row, last.row) && column >= Math.min(first.column, last.column) && column <= Math.max(first.column, last.column);
  }).map(cell => cell.id);
}
export function selectedTableAxes(table: Widget, selection: TableSelection | null) {
  const points = selection?.cellIds.map(id => tableCellCoordinates(table, id)).filter(point => point !== undefined) ?? [];
  return { rows: [...new Set(points.map(point => point.row))].sort((a, b) => a - b), columns: [...new Set(points.map(point => point.column))].sort((a, b) => a - b) };
}

export function TableOutlineEntries({ table, selection, onSelect }: { table: Widget; selection: TableSelection | null; onSelect: (cell: Widget, additive: boolean) => void }) {
  const data = table.table!;
  return <div className="table-outline-cells">{data.rowHeights.map((_, row) => <details key={row} open><summary>Row {row + 1}</summary>{data.cells.slice(row * data.columnWidths.length, (row + 1) * data.columnWidths.length).map((cell, column) => <button key={cell.id} className={`tree-row ${selection?.cellIds.includes(cell.id) ? 'selected' : ''}`} aria-label={`Select ${table.name} row ${row + 1} column ${column + 1}`} onClick={event => onSelect(cell, event.shiftKey || event.ctrlKey || event.metaKey)}>{cell.name || `Cell ${column + 1}`}</button>)}</details>)}</div>;
}

export function TableStructureControls({ table, selection, onOperation, onSelectOwner, onSelectAllCells }: TableInspectorContext) {
  const { rows, columns } = selectedTableAxes(table, selection), row = rows[0] ?? 0, column = columns[0] ?? 0;
  const countRows = table.table!.rowHeights.length, countColumns = table.table!.columnWidths.length;
  return <section className="table-structure-controls" aria-label="Table structure">
    <strong>{countRows} rows × {countColumns} columns</strong>
    {selection && <button onClick={onSelectOwner}>Select whole table</button>}
    {onSelectAllCells && <button onClick={onSelectAllCells}>Apply style to all cells</button>}
    <p>{selection ? `${selection.cellIds.length} selected cells. W changes their columns; H changes their rows.` : 'Select cells or the row and column headers on the canvas.'}</p>
    <div className="table-operation-grid">
      <button onClick={() => onOperation({ kind: 'insert', axis: 'row', indices: [row] })}>Insert row above</button>
      <button onClick={() => onOperation({ kind: 'insert', axis: 'row', indices: [(rows.at(-1) ?? row) + 1] })}>Insert row below</button>
      <button onClick={() => onOperation({ kind: 'insert', axis: 'column', indices: [column] })}>Insert column left</button>
      <button onClick={() => onOperation({ kind: 'insert', axis: 'column', indices: [(columns.at(-1) ?? column) + 1] })}>Insert column right</button>
      <button disabled={!rows.length || rows.length >= countRows} onClick={() => onOperation({ kind: 'delete', axis: 'row', indices: rows })}>Delete rows</button>
      <button disabled={!columns.length || columns.length >= countColumns} onClick={() => onOperation({ kind: 'delete', axis: 'column', indices: columns })}>Delete columns</button>
      <button disabled={rows.length !== 1 || row === 0} onClick={() => onOperation({ kind: 'move', axis: 'row', indices: [row], to: row - 1 })}>Move row up</button>
      <button disabled={rows.length !== 1 || row === countRows - 1} onClick={() => onOperation({ kind: 'move', axis: 'row', indices: [row], to: row + 1 })}>Move row down</button>
      <button disabled={columns.length !== 1 || column === 0} onClick={() => onOperation({ kind: 'move', axis: 'column', indices: [column], to: column - 1 })}>Move column left</button>
      <button disabled={columns.length !== 1 || column === countColumns - 1} onClick={() => onOperation({ kind: 'move', axis: 'column', indices: [column], to: column + 1 })}>Move column right</button>
    </div>
    <p>Table structure and cell formatting are shared across adaptive views.</p>
  </section>;
}

type Resize = { axis: 'row' | 'column'; index: number; value: number; x: number; y: number; pointerId: number };
export function TableCanvasControls({ table, selection, zoom, onSelect, onSelectOwner, onOwnerPointerDown, onOperation, onResizeStart, onResize, onResizeEnd, onResizeCancel }: TableInspectorContext & {
  zoom: number;
  onOwnerPointerDown?: (event: ReactPointerEvent) => void;
  onSelect: (ids: string[], anchor: string | undefined, additive: boolean) => void;
  onResizeStart: () => void;
  onResize: (axis: 'row' | 'column', index: number, value: number) => void;
  onResizeEnd: () => void;
  onResizeCancel: () => void;
}) {
  const resize = useRef<Resize | null>(null), data = table.table!;
  const cancel = useRef(onResizeCancel); cancel.current = onResizeCancel;
  useEffect(() => () => { if (resize.current) { resize.current = null; cancel.current(); } }, []);
  const lefts = data.columnWidths.map((_, index) => data.columnWidths.slice(0, index).reduce((a, b) => a + b, 0));
  const tops = data.rowHeights.map((_, index) => data.rowHeights.slice(0, index).reduce((a, b) => a + b, 0));
  function selectAxis(axis: 'row' | 'column', index: number, additive: boolean) {
    const cells = data.cells.filter((_, position) => axis === 'row' ? Math.floor(position / data.columnWidths.length) === index : position % data.columnWidths.length === index);
    onSelect(cells.map(cell => cell.id), cells[0]?.id, additive);
  }
  function begin(event: ReactPointerEvent, axis: 'row' | 'column', index: number) {
    if (event.button !== 0 || table.locked) return;
    event.preventDefault(); event.stopPropagation(); onResizeStart();
    resize.current = { axis, index, value: axis === 'row' ? data.rowHeights[index] : data.columnWidths[index], x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: ReactPointerEvent) {
    const active = resize.current; if (!active) return;
    event.stopPropagation();
    const dx = (event.clientX - active.x) / zoom, dy = (event.clientY - active.y) / zoom, angle = table.rotation * Math.PI / 180;
    const delta = active.axis === 'column' ? dx * Math.cos(angle) + dy * Math.sin(angle) : -dx * Math.sin(angle) + dy * Math.cos(angle);
    onResize(active.axis, active.index, Math.abs(delta) < 0.000001 ? active.value : Math.max(1, Math.round((active.value + delta) * 100) / 100));
  }
  function finish(event: ReactPointerEvent, cancel = false) {
    const active = resize.current; if (!active) return;
    event.stopPropagation(); resize.current = null;
    if (event.currentTarget.hasPointerCapture(active.pointerId)) event.currentTarget.releasePointerCapture(active.pointerId);
    if (cancel) onResizeCancel(); else onResizeEnd();
  }
  const header = (axis: 'row' | 'column', index: number) => ({
    draggable: !table.locked,
    onPointerDown: (event: ReactPointerEvent) => event.stopPropagation(),
    onClick: (event: React.MouseEvent) => { event.stopPropagation(); selectAxis(axis, index, event.ctrlKey || event.metaKey || event.shiftKey); },
    onDragStart: (event: React.DragEvent) => event.dataTransfer.setData('application/x-rea-table-axis', JSON.stringify({ tableId: table.id, axis, index })),
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault(); event.stopPropagation();
      try { const source = JSON.parse(event.dataTransfer.getData('application/x-rea-table-axis')); if (source.tableId === table.id && source.axis === axis && Number.isInteger(source.index)) onOperation({ kind: 'move', axis, indices: [source.index], to: index }); } catch { /* Unrelated drag data does not belong to a table axis. */ }
    },
  });
  return <div className="table-canvas-controls" role="group" aria-label="Table editing controls" style={{ left: table.x, top: table.y, width: table.width, height: table.height, transform: `rotate(${table.rotation}deg)` }}>
    <button className="table-owner-control" aria-label="Select whole table" title="Select or drag whole table" onPointerDown={event => { event.stopPropagation(); onOwnerPointerDown?.(event); }} onClick={event => { event.stopPropagation(); onSelectOwner(); }}>▦</button>
    {data.columnWidths.map((width, index) => <button key={`column-${index}`} className="table-column-control" aria-label={`Select column ${index + 1}`} style={{ left: lefts[index], width }} {...header('column', index)}>{index + 1}</button>)}
    {data.rowHeights.map((height, index) => <button key={`row-${index}`} className="table-row-control" aria-label={`Select row ${index + 1}`} style={{ top: tops[index], height }} {...header('row', index)}>{index + 1}</button>)}
    {data.cells.filter(cell => selection?.cellIds.includes(cell.id)).map(cell => <span key={cell.id} className={`table-cell-selection ${(selection?.focusCellId ?? selection?.cellIds[0]) === cell.id ? 'current' : ''}`} style={{ left: cell.x, top: cell.y, width: cell.width, height: cell.height }}/>) }
    {!table.locked && <>
      {data.columnWidths.map((width, index) => <span key={`width-${index}`} role="separator" aria-label={`Resize column ${index + 1}`} aria-orientation="vertical" className="table-column-resize" style={{ left: lefts[index] + width, height: table.height }} onPointerDown={event => begin(event, 'column', index)} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}/>)}
      {data.rowHeights.map((height, index) => <span key={`height-${index}`} role="separator" aria-label={`Resize row ${index + 1}`} aria-orientation="horizontal" className="table-row-resize" style={{ top: tops[index] + height, width: table.width }} onPointerDown={event => begin(event, 'row', index)} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}/>)}
    </>}
  </div>;
}

export function PasteTableDialog({ existing, onApply, onClose }: { existing: boolean; onApply: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(''), [error, setError] = useState(''), form = useRef<HTMLFormElement>(null);
  return <div className="table-paste-backdrop"><form ref={form} className="table-paste-dialog" role="dialog" aria-modal="true" aria-label={existing ? 'Paste into table' : 'Paste as table'} onSubmit={event => { event.preventDefault(); try { onApply(text); } catch (cause) { setError(String(cause)); } }} onKeyDown={event => {
    event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') { const controls = [...form.current!.querySelectorAll<HTMLElement>('textarea, button')], first = controls[0], last = controls.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  }}>
    <h2>{existing ? 'Paste into table' : 'Paste as table'}</h2><p>Paste tab-separated text copied from a spreadsheet.{existing ? ' Only existing cells are filled, starting at the current cell.' : ''}</p>
    <textarea autoFocus aria-label="Table data" rows={8} value={text} onChange={event => { setText(event.target.value); setError(''); }}/>
    {error && <p role="alert">{error}</p>}<div><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{existing ? 'Paste cells' : 'Insert table'}</button></div>
  </form></div>;
}
