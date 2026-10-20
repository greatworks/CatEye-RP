import type { Widget } from './types';
import { replaceWidgetText } from './rich-text';

export const TABLE_LIMITS = { rows: 1000, columns: 1000, cells: 9999, size: 100000 } as const;
export type TableAxis = 'row' | 'column';
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const starts = (values: number[]) => { let total = 0; return values.map(value => { const at = total; total += value; return at; }); };
export function tableData(table: Widget) {
  if (table.type !== 'table' || !table.table) throw new Error('Select a table');
  const data = table.table;
  if (!data.rowHeights.length || !data.columnWidths.length || data.rowHeights.length > TABLE_LIMITS.rows || data.columnWidths.length > TABLE_LIMITS.columns || data.cells.length !== data.rowHeights.length * data.columnWidths.length || data.cells.length > TABLE_LIMITS.cells) throw new Error('Invalid table dimensions');
  for (const values of [data.rowHeights, data.columnWidths]) if (values.some(n => !Number.isFinite(n) || n < 1 || n > TABLE_LIMITS.size) || sum(values) > TABLE_LIMITS.size) throw new Error('Table dimensions must be finite positive values within 100000 pixels');
  if (data.cells.some(cell => cell.type !== 'tableCell')) throw new Error('Tables contain only table cells');
  const ids = new Set(data.cells.map(cell=>cell.id));
  if (ids.size !== data.cells.length) throw new Error('Table cell identifiers must be unique');
  if (data.cellOrder && (data.cellOrder.length!==ids.size || new Set(data.cellOrder).size!==ids.size || data.cellOrder.some(id=>!ids.has(id)))) throw new Error('Table cell order must contain every cell exactly once');
  return data;
}
export function orderedTableCells(table: Widget): Widget[] {
  const data=tableData(table);if(!data.cellOrder)return data.cells;
  const byId=new Map(data.cells.map(cell=>[cell.id,cell]));return data.cellOrder.map(id=>byId.get(id)!);
}
/** Canonicalize geometry after a structural author edit, without changing cell identities. */
export function layoutTable(table: Widget): Widget {
  const data = tableData(table), xs = starts(data.columnWidths), ys = starts(data.rowHeights), columns = xs.length;
  return { ...table, width: sum(data.columnWidths), height: sum(data.rowHeights), table: { ...data, columnWidths: [...data.columnWidths], rowHeights: [...data.rowHeights], cells: data.cells.map((cell, index) => ({ ...cell, x: xs[index % columns], y: ys[Math.floor(index / columns)], width: data.columnWidths[index % columns], height: data.rowHeights[Math.floor(index / columns)], rotation: 0 })) } };
}
export function tableCellPosition(table: Widget, id: string): { row: number; column: number; index: number } {
  const data = tableData(table), index = data.cells.findIndex(cell => cell.id === id);
  if (index < 0) throw new Error('Cell does not belong to this table');
  return { row: Math.floor(index / data.columnWidths.length), column: index % data.columnWidths.length, index };
}
export function tableRange(table: Widget, first: string, last: string): string[] {
  const data = tableData(table), a = tableCellPosition(table, first), b = tableCellPosition(table, last);
  return data.cells.filter((_, i) => { const row = Math.floor(i / data.columnWidths.length), column = i % data.columnWidths.length; return row >= Math.min(a.row,b.row) && row <= Math.max(a.row,b.row) && column >= Math.min(a.column,b.column) && column <= Math.max(a.column,b.column); }).map(cell => cell.id);
}
export function setTableTrackSize(table: Widget, axis: TableAxis, indices: readonly number[], size: number): Widget {
  const data = tableData(table), key = axis === 'row' ? 'rowHeights' : 'columnWidths', tracks = [...data[key]];
  if (!Number.isFinite(size) || size < 1 || size > TABLE_LIMITS.size) throw new Error('Track size must be between 1 and 100000');
  for (const index of new Set(indices)) { if (!Number.isInteger(index) || index < 0 || index >= tracks.length) throw new Error('Invalid table track'); tracks[index] = size; }
  return layoutTable({ ...table, table: { ...data, [key]: tracks } });
}
export function patchTableCells(table: Widget, ids: readonly string[], patch: Partial<Widget> | ((cell: Widget) => Partial<Widget>)): Widget {
  let result = table; const selected = new Set(ids), data = tableData(table);
  for (const id of selected) tableCellPosition(table, id);
  const widths = new Map<number, number>(), heights = new Map<number, number>();
  const cells = data.cells.map((cell, index) => {
    if (!selected.has(cell.id)) return cell;
    const changes = typeof patch === 'function' ? patch(cell) : patch;
    for (const key of ['id','type','x','y','rotation','table','menu','tree','treeNode','repeater','states','imageSrc','vectorPath','componentId','componentInstance','groupId'] as const) if (Object.hasOwn(changes,key)) throw new Error(`Cannot change a table cell's ${key}`);
    if (changes.width !== undefined) widths.set(index % data.columnWidths.length, changes.width);
    if (changes.height !== undefined) heights.set(Math.floor(index / data.columnWidths.length), changes.height);
    let next = { ...cell, ...changes };
    if (Object.hasOwn(changes,'text') && !Object.hasOwn(changes,'richText')) next = replaceWidgetText(next, changes.text!);
    return next;
  });
  result = { ...table, table: { ...data, cells } };
  for (const [index,width] of widths) result = setTableTrackSize(result,'column',[index],width);
  for (const [index,height] of heights) result = setTableTrackSize(result,'row',[index],height);
  return layoutTable(result);
}
function emptyCell(source: Widget): Widget {
  const next: Widget = { id: crypto.randomUUID(),type:'tableCell',name:'Cell',text:'',x:0,y:0,width:source.width,height:source.height,rotation:0,style:structuredClone(source.style),hidden:false,locked:false,disabled:false,notes:'',interactions:[] };
  return next;
}
export function insertTableTrack(table: Widget, axis: TableAxis, index: number): Widget {
  const data = tableData(table), rows = data.rowHeights.length, columns = data.columnWidths.length, length = axis === 'row' ? rows : columns;
  if (!Number.isInteger(index) || index < 0 || index > length) throw new Error('Invalid table insertion point');
  const reference = Math.max(0,index - 1), rowHeights = [...data.rowHeights], columnWidths = [...data.columnWidths], cells: Widget[] = [];
  if (axis === 'row') rowHeights.splice(index,0,rowHeights[reference]); else columnWidths.splice(index,0,columnWidths[reference]);
  for (let r=0;r<rowHeights.length;r++) for (let c=0;c<columnWidths.length;c++) {
    const isNew = axis === 'row' ? r === index : c === index;
    const oldR = axis === 'row' ? r === index ? reference : r > index ? r-1 : r : r;
    const oldC = axis === 'column' ? c === index ? reference : c > index ? c-1 : c : c;
    const source = data.cells[oldR*columns+oldC]; cells.push(isNew ? emptyCell(source) : source);
  }
  const cellOrder=data.cellOrder?[...data.cellOrder,...cells.filter(cell=>!data.cellOrder!.includes(cell.id)).map(cell=>cell.id)]:undefined;
  return layoutTable({ ...table,table:{rowHeights,columnWidths,cells,...(cellOrder?{cellOrder}:{})} });
}
export function deleteTableTracks(table: Widget, axis: TableAxis, indices: readonly number[]): Widget {
  const data=tableData(table), remove=new Set(indices), length=axis==='row'?data.rowHeights.length:data.columnWidths.length;
  if ([...remove].some(i=>!Number.isInteger(i)||i<0||i>=length)) throw new Error('Invalid table track');
  if (remove.size === length) throw new Error('A table must retain at least one row and column');
  const rowHeights=axis==='row'?data.rowHeights.filter((_,i)=>!remove.has(i)):data.rowHeights,columnWidths=axis==='column'?data.columnWidths.filter((_,i)=>!remove.has(i)):data.columnWidths;
  const cells=data.cells.filter((_,i)=>!remove.has(axis==='row'?Math.floor(i/data.columnWidths.length):i%data.columnWidths.length));
  const retained=new Set(cells.map(cell=>cell.id));
  return layoutTable({...table,table:{rowHeights,columnWidths,cells,...(data.cellOrder?{cellOrder:data.cellOrder.filter(id=>retained.has(id))}:{})}});
}
export function moveTableTrack(table: Widget, axis: TableAxis, from: number, to: number): Widget {
  const data=tableData(table), tracks=axis==='row'?data.rowHeights:data.columnWidths;
  if (![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<tracks.length)) throw new Error('Invalid table track');
  if (from===to) return table;
  const order=tracks.map((_,i)=>i);order.splice(to,0,order.splice(from,1)[0]);
  const rowHeights=axis==='row'?order.map(i=>data.rowHeights[i]):data.rowHeights,columnWidths=axis==='column'?order.map(i=>data.columnWidths[i]):data.columnWidths;
  const cells=data.cells.map((_,i)=>{const r=Math.floor(i/data.columnWidths.length),c=i%data.columnWidths.length;return data.cells[(axis==='row'?order[r]:r)*data.columnWidths.length+(axis==='column'?order[c]:c)];});
  return layoutTable({...table,table:{...data,rowHeights,columnWidths,cells}});
}
export function resizeTable(table: Widget, width: number, height: number): Widget {
  const data=tableData(table);
  const scale=(tracks:number[],size:number)=>{
    if(!Number.isFinite(size)||size<tracks.length||size>TABLE_LIMITS.size)throw new Error('Table size is too small or exceeds 100000');
    const remaining=new Set(tracks.map((_,i)=>i)),out=tracks.map(()=>1);let available=size;
    while(remaining.size){const weight=[...remaining].reduce((n,i)=>n+tracks[i],0),small=[...remaining].filter(i=>tracks[i]/weight*available<1);if(!small.length){for(const i of remaining)out[i]=tracks[i]/weight*available;break;}for(const i of small){remaining.delete(i);available--;}}
    return out;
  };
  return layoutTable({...table,table:{...data,columnWidths:scale(data.columnWidths,width),rowHeights:scale(data.rowHeights,height)}});
}
/** Clipboard grid: quoted cells may contain tabs/newlines; trailing record terminator is ignored. */
export function parseTableText(text: string): string[][] {
  if (text.length>1000000)throw new Error('Table clipboard text exceeds 1000000 characters');
  const source=text.replace(/\r\n?/g,'\n'),rows:string[][]=[[]];let cell='',quoted=false,atStart=true,closed=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
    if(ch==='"'&&atStart){quoted=true;atStart=false;continue;}
    if(ch==='\t'||ch==='\n'){
      if(cell.length>100000)throw new Error('Table cell text exceeds 100000 characters');
      rows.at(-1)!.push(cell);cell='';atStart=true;closed=false;
      if(rows.at(-1)!.length>TABLE_LIMITS.columns)throw new Error('Table clipboard grid is too large');
      if(ch==='\n'){if(rows.length>=TABLE_LIMITS.rows&&i<source.length-1)throw new Error('Table clipboard grid is too large');rows.push([]);}continue;
    }
    if(closed)throw new Error('Unexpected text after a quoted table cell');cell+=ch;atStart=false;
  }
  if(quoted)throw new Error('Unterminated quoted table cell');
  if(cell.length>100000)throw new Error('Table cell text exceeds 100000 characters');
  rows.at(-1)!.push(cell);if(source.endsWith('\n')&&rows.length>1)rows.pop();
  const columns=Math.max(...rows.map(row=>row.length));
  if(rows.length>TABLE_LIMITS.rows||columns>TABLE_LIMITS.columns||rows.length*columns>TABLE_LIMITS.cells)throw new Error('Table clipboard grid is too large');
  return rows.map(row=>[...row,...Array(columns-row.length).fill('')]);
}
export function pasteTableText(table: Widget, startCellId: string, text: string): Widget {
  const data=tableData(table),start=tableCellPosition(table,startCellId),grid=parseTableText(text),cells=[...data.cells];
  for(let r=0;r<grid.length&&start.row+r<data.rowHeights.length;r++)for(let c=0;c<grid[r].length&&start.column+c<data.columnWidths.length;c++){
    const index=(start.row+r)*data.columnWidths.length+start.column+c;cells[index]=replaceWidgetText(cells[index],grid[r][c]);
  }
  return {...table,table:{...data,cells}};
}
export function copyTableText(table: Widget, ids: readonly string[]): string {
  const data=tableData(table),points=ids.map(id=>tableCellPosition(table,id));if(!points.length)return '';
  const top=Math.min(...points.map(p=>p.row)),bottom=Math.max(...points.map(p=>p.row)),left=Math.min(...points.map(p=>p.column)),right=Math.max(...points.map(p=>p.column)),selected=new Set(ids),rows=[];
  for(let r=top;r<=bottom;r++){const cells=[];for(let c=left;c<=right;c++){const cell=data.cells[r*data.columnWidths.length+c],text=selected.has(cell.id)?cell.text:'';cells.push(/[\t\r\n"]/.test(text)?`"${text.replaceAll('"','""')}"`:text);}rows.push(cells.join('\t'));}
  return rows.join('\n');
}
