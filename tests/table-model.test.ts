import { describe, expect, it } from 'vitest';
import { cloneWidgets, collectWidgetIdentifiers, createDocument, createWidget, deleteWidgetTree, findWidget, mapWidgets, parseDocument, serializeDocument, uid } from '../src/model/document';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createComponent, createComponentInstance } from '../src/model/components';
import { copyTableText, deleteTableTracks, insertTableTrack, layoutTable, moveTableTrack, parseTableText, pasteTableText, patchTableCells, resizeTable, setTableTrackSize, tableRange } from '../src/model/table';
import { richTextFromPlainText } from '../src/model/rich-text';
import type { Widget } from '../src/model/types';

function fixture() { const doc=createDocument(),table=createWidget('table',20,40);doc.pages[0].widgets=[table];return {doc,table,cells:table.table!.cells}; }
function roundTrip(table:Widget) {const doc=createDocument();doc.pages[0].widgets=[table];return parseDocument(serializeDocument(doc)).pages[0].widgets[0];}
describe('table matrix and structural authoring',()=>{
  it('round-trips independent named cells and nonuniform fractional tracks',()=>{
    const {table,cells}=fixture();cells[4].notes='Independent note';cells[4].selected=true;cells[4].text='Bold\n第二行';cells[4].richText=richTextFromPlainText(cells[4].text);cells[4].richText.paragraphs[0].runs[0].style={fontWeight:700};
    const next=layoutTable({...table,table:{...table.table!,columnWidths:[30.5,87.25,110],rowHeights:[20,40.5,33]}});
    expect(roundTrip(next)).toEqual(next);expect(next.table!.cells[4]).toMatchObject({x:30.5,y:20,width:87.25,height:40.5});expect(next).toMatchObject({width:227.75,height:93.5});
  });
  it('multicell W/H edits resize entire unique columns/rows and retain other tracks',()=>{
    const {table,cells}=fixture();const next=patchTableCells(table,[cells[0].id,cells[1].id,cells[3].id],{width:45,height:22});
    expect(next.table!.columnWidths).toEqual([45,45,100]);expect(next.table!.rowHeights).toEqual([22,22,30]);expect(next.table!.cells[8]).toMatchObject({x:90,y:44,width:100,height:30});expect(roundTrip(next)).toEqual(next);expect(table.table!.columnWidths).toEqual([100,100,100]);
  });
  it.each(['row','column'] as const)('inserts, reorders and deletes %s tracks without losing cell identity or contents',axis=>{
    const {table,cells}=fixture();for(const [i,cell] of cells.entries())cell.text=String(i);
    const added=insertTableTrack(table,axis,1),newIds=added.table!.cells.filter(c=>!cells.some(old=>old.id===c.id));
    expect(newIds).toHaveLength(3);expect(newIds.every(c=>c.text===''&&c.interactions.length===0)).toBe(true);expect(new Set(added.table!.cells.map(c=>c.id)).size).toBe(12);
    const moved=moveTableTrack(added,axis,1,3),removed=deleteTableTracks(moved,axis,[3]);expect(removed).toEqual(table);expect(roundTrip(moved)).toEqual(moved);
  });
  it('moves a populated row or column as a stable ordered track',()=>{
    const {table,cells}=fixture();const rows=moveTableTrack(table,'row',0,2);expect(rows.table!.cells.map(c=>c.id)).toEqual([...cells.slice(3),...cells.slice(0,3)].map(c=>c.id));
    const columns=moveTableTrack(table,'column',2,0);expect(columns.table!.cells.slice(0,3).map(c=>c.id)).toEqual([cells[2].id,cells[0].id,cells[1].id]);
  });
  it('returns a rectangular range in row-major order regardless of drag direction',()=>{
    const {table,cells}=fixture();expect(tableRange(table,cells[8].id,cells[1].id)).toEqual([1,2,4,5,7,8].map(i=>cells[i].id));
  });
  it('scales authoring tracks while enforcing the one pixel minimum',()=>{
    const {table}=fixture();const narrow=layoutTable({...table,table:{...table.table!,columnWidths:[1,10,100]}}),next=resizeTable(narrow,12,6);expect(next.table!.columnWidths[0]).toBe(1);expect(next.table!.columnWidths.reduce((a,b)=>a+b,0)).toBeCloseTo(12);expect(next.table!.rowHeights).toEqual([2,2,2]);expect(roundTrip(next)).toEqual(next);
  });
  it('prevents individual cell deletion, free transforms, empty axes and resource overflows',()=>{
    const {table,cells}=fixture();expect(()=>deleteWidgetTree([table],[cells[1].id])).toThrow('rows or columns');expect(deleteWidgetTree([table],[table.id])).toEqual([]);
    expect(()=>patchTableCells(table,[cells[0].id],{x:12})).toThrow();expect(()=>patchTableCells(table,['missing'],{text:'x'})).toThrow();
    expect(()=>deleteTableTracks(table,'row',[0,1,2])).toThrow();expect(()=>setTableTrackSize(table,'column',[4],30)).toThrow();expect(()=>setTableTrackSize(table,'row',[0],Infinity)).toThrow();expect(()=>resizeTable(table,2,30)).toThrow();
  });
});
describe('table clipboard',()=>{
  it('supports quoted tab/newline cells, escaped quotes, CRLF, Unicode, ragged rows and a trailing terminator',()=>{
    expect(parseTableText('A\t"B\tC"\r\n"line 1\nline 2"\t"quote ""x"""\r\n中文\r\n')).toEqual([['A','B\tC'],['line 1\nline 2','quote "x"'],['中文','']]);
  });
  it('clips paste at existing matrix edges without expanding tracks and round-trips TSV literal text',()=>{
    const {table,cells}=fixture(),next=pasteTableText(table,cells[4].id,'[[Var]]\t"x\ty"\textra\n"one\ntwo"\tlast\nclipped');
    expect(next.table!.columnWidths).toEqual([100,100,100]);expect(next.table!.cells[0].text).toBe('Column 1');expect([4,5,7,8].map(i=>next.table!.cells[i].text)).toEqual(['[[Var]]','x\ty','one\ntwo','last']);
    expect(parseTableText(copyTableText(next,[4,5,7,8].map(i=>cells[i].id)))).toEqual([['[[Var]]','x\ty'],['one\ntwo','last']]);expect(roundTrip(next)).toEqual(next);
  });
  it.each(['"unterminated','"closed"bad','x'.repeat(100001),'\n'.repeat(1001),'\t'.repeat(1001),Array(101).fill(Array(100).fill('x').join('\t')).join('\n')])('rejects invalid or oversized clipboard text %#',text=>expect(()=>parseTableText(text)).toThrow());
});
describe('table document integration',()=>{
  it('preserves native object order through clone, moves, insertion and deletion without changing matrix storage',()=>{
    const {table,cells}=fixture();table.table!.cellOrder=[0,3,6,1,4,7,2,5,8].map(i=>cells[i].id);const original=[...table.table!.cellOrder];
    expect(roundTrip(table)).toEqual(table);const [clone]=cloneWidgets([table]);expect(clone.table!.cellOrder).toEqual([0,3,6,1,4,7,2,5,8].map(i=>clone.table!.cells[i].id));
    expect(moveTableTrack(table,'row',0,2).table!.cellOrder).toEqual(original);const inserted=insertTableTrack(table,'column',1);expect(inserted.table!.cellOrder!.slice(0,9)).toEqual(original);expect(deleteTableTracks(inserted,'column',[1])).toEqual(table);
    table.table!.cellOrder[0]=cells[1].id;expect(()=>roundTrip(table)).toThrow('every cell');
  });
  it('walks, finds and remaps nested cells and their cross-cell action targets',()=>{
    const {table,cells}=fixture();cells[0].interactions=[{id:uid(),event:'click',name:'Set sibling',enabled:true,conditionMode:'all',conditions:[{source:'widgetText',key:cells[1].id,operator:'equals',value:'Column 2'}],actions:[{id:uid(),type:'setText',targetId:cells[1].id,value:'changed'}]}];
    expect(findWidget({widgets:[table]},cells[8].id)).toBe(cells[8]);const visited:string[]=[];mapWidgets([table],w=>{visited.push(w.id);return w;});expect(visited).toHaveLength(10);
    const [clone]=cloneWidgets([table]);expect(clone.x).toBe(40);expect(clone.table!.cells[0].x).toBe(0);expect(collectWidgetIdentifiers([clone]).size).toBe(12);expect(clone.table!.cells[0].interactions[0].actions[0].targetId).toBe(clone.table!.cells[1].id);expect(roundTrip(clone)).toEqual(clone);
  });
  it('materializes tables inside live component definitions with complete source identity',()=>{
    const {doc,table}=fixture(),component=createComponent([table],'Matrix'),instance=createComponentInstance(component);doc.components=[component];doc.pages[0].widgets=[instance];expect(Object.keys(instance.componentInstance!.sourceIds)).toHaveLength(10);expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('shares grid, cell text and style edits across views while keeping whole-table placement local',()=>{
    const {doc,table,cells}=fixture();const page=createAdaptiveView(doc.pages[0]),view=page.adaptiveViews[0];
    const edited=patchTableCells(table,[cells[0].id],{width:70,text:'Shared',style:{...cells[0].style,fill:'#ff0000'}});edited.hidden=true;
    const next=applyAdaptiveWidgetEdits(page,view.id,[edited]);expect(next.widgets[0].width).toBe(270);expect(next.widgets[0].table!.cells[0].text).toBe('Shared');expect(next.widgets[0].hidden).toBe(false);expect(next.adaptiveViews[0].overrides).toEqual({[table.id]:{hidden:true}});expect(resolveAdaptiveWidgets(next,view.id)[0].hidden).toBe(true);doc.pages=[next];expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it.each([
    (w:Widget)=>{w.table!.cells.pop();},(w:Widget)=>{w.table!.cells[0].x=1;},(w:Widget)=>{w.table!.cells[0].rotation=1;},(w:Widget)=>{w.width+=1;},(w:Widget)=>{w.table!.columnWidths[0]=0;},(w:Widget)=>{w.table!.cells[0].type='image';},(w:Widget)=>{w.table!.cells[1].id=w.table!.cells[0].id;},(w:Widget)=>{w.table!.cells[0].imageSrc='https://example.com/p.png';},
  ])('rejects malformed or lossy matrices %#',mutate=>{const {doc,table}=fixture();mutate(table);expect(()=>parseDocument(JSON.stringify(doc))).toThrow();});
  it('rejects standalone cells and forbidden adaptive cell/layout overrides',()=>{
    const {doc,table,cells}=fixture();doc.pages[0].widgets=[cells[0]];expect(()=>serializeDocument(doc)).toThrow('belong');doc.pages[0].widgets=[table];doc.pages[0]=createAdaptiveView(doc.pages[0]);doc.pages[0].adaptiveViews[0].overrides={[cells[0].id]:{style:{fill:'#ffffff'}}};expect(()=>serializeDocument(doc)).toThrow('shared');doc.pages[0].adaptiveViews[0].overrides={[table.id]:{width:90}};expect(()=>serializeDocument(doc)).toThrow('shared');
  });
});
