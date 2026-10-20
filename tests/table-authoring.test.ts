import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument, createWidget } from '../src/model/document';
import { TableStructureControls, TableCanvasControls, tableCellCoordinates, tableRectangleIds, selectedTableAxes } from '../src/components/TableEditor';
import { WidgetContent } from '../src/components/WidgetView';
import { Inspector } from '../src/components/Inspector';

describe('table authoring surfaces', () => {
  it('selects an exact row-major rectangle in either direction and deduplicates edited axes', () => {
    const table = createWidget('table'), cells = table.table!.cells;
    expect(tableRectangleIds(table, cells[8].id, cells[1].id)).toEqual([cells[1].id,cells[2].id,cells[4].id,cells[5].id,cells[7].id,cells[8].id]);
    expect(tableRectangleIds(table, cells[1].id, cells[8].id)).toEqual(tableRectangleIds(table,cells[8].id,cells[1].id));
    expect(selectedTableAxes(table,{tableId:table.id,cellIds:[cells[1].id,cells[4].id,cells[8].id]})).toEqual({rows:[0,1,2],columns:[1,2]});
    expect(tableCellCoordinates(table,'missing')).toBeUndefined(); expect(tableRectangleIds(table,'missing',cells[0].id)).toEqual([]);
  });

  it('renders all stored cells safely with exact bounds and no authoring controls in passive output', () => {
    const table = createWidget('table'); table.table!.cells[4].text='<img onerror="x">';
    const html=renderToStaticMarkup(createElement(WidgetContent,{widget:table}));
    expect((html.match(/role="gridcell"/g)??[])).toHaveLength(9);expect(html).toContain('data-table-cell-id="'+table.table!.cells[4].id+'"');
    expect(html).toContain('left:100px;top:30px;width:100px;height:30px');expect(html).toContain('&lt;img onerror=');
    expect(html).not.toContain('Table editing controls');expect(html).not.toContain('<img');
  });

  it('provides distinct table/cell Inspector layout and explicit all-cell formatting, without misleading owner text or selection fields', () => {
    const document=createDocument(),table=createWidget('table');document.pages[0].widgets=[table];
    const context={table,selection:null,onOperation:()=>{},onSelectOwner:()=>{},onSelectAllCells:()=>{}};
    const html=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget:table,onWidgetChange:()=>{},onPageChange:()=>{},tableContext:context}));
    expect(html).toContain('Apply style to all cells');expect(html).toContain('Insert row above');expect(html).not.toContain('aria-label="Widget text"');expect(html).not.toContain('Selected by default');
    const cell=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget:table.table!.cells[0],onWidgetChange:()=>{},onPageChange:()=>{},tableContext:{...context,selection:{tableId:table.id,cellIds:[table.table!.cells[0].id]}}}));
    expect(cell).toContain('aria-label="W"');expect(cell).toContain('aria-label="H"');expect(cell).not.toContain('aria-label="X"');expect(cell).not.toContain('aria-label="Y"');expect(cell).not.toContain('aria-label="Rotate"');
  });

  it('disables deleting every track and separates selected-cell overlays from free widget handles', () => {
    const table=createWidget('table'),selection={tableId:table.id,cellIds:table.table!.cells.map(cell=>cell.id)};
    const structure=renderToStaticMarkup(createElement(TableStructureControls,{table,selection,onOperation:()=>{},onSelectOwner:()=>{}}));
    expect(structure).toMatch(/<button disabled="">Delete rows<\/button>/);expect(structure).toMatch(/<button disabled="">Delete columns<\/button>/);
    const canvas=renderToStaticMarkup(createElement(TableCanvasControls,{table,selection,zoom:1.5,onOperation:()=>{},onSelectOwner:()=>{},onSelect:()=>{},onResizeStart:()=>{},onResize:()=>{},onResizeEnd:()=>{},onResizeCancel:()=>{}}));
    expect((canvas.match(/class="table-cell-selection/g)??[])).toHaveLength(9);expect(canvas).toContain('Resize column 2');expect(canvas).toContain('Resize row 3');expect(canvas).not.toContain('resize-handle');
  });
});
