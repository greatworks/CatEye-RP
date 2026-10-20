import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p,recoverRpSemantics,recoverStyle,recoverRichText,recoverInteractionStyles,recoverSelection,argbColor} from './scripts/read-rp-semantics.mjs';
import {recoverInteractionMap} from './scripts/read-rp-interactions.mjs';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const census=JSON.parse(fs.readFileSync('research/table-format-census.json','utf8')),file=census.samples[0].file;
assert.equal(hash(file),census.samples[0].sha256);
const decoded=inspectRpObjects(file),semantics=recoverRpSemantics(decoded),identity=semantics.defaultStyleIdentityRecovery;
const defaultStyle={id:identity.defaultStyleId,libraryId:identity.defaultStyleLibraryId};
const contains=(value,id)=>value&&typeof value==='object'&&(value.$reference===id||Object.values(value).some(v=>contains(v,id)));
const report={capturedAt:new Date().toISOString(),method:'Independent source-structure assertions and reuse of existing style helpers, no new admission to production parser',file,sha256:hash(file),defaultStyleIdentity:identity,tables:[]};
for(const raw of census.objects.filter(o=>o.type==='Axure:DiagramObject:Table')){
 const pack=decoded.packages.find(p=>p.packageId===raw.packageId),objects=new Map(pack.objects.map(o=>[o.id,o])),root=objects.get(pack.rootId),table=objects.get(raw.id),tp=table.properties;
 const parents=pack.objects.filter(o=>contains(o.properties,table.id)).map(o=>({id:o.id,type:o.type}));
 const rows=p(tp,'rows'),columns=p(tp,'columns'),widths=p(tp,'column-widths'),heights=p(tp,'row-heights'),cellIds=p(tp,'cells').map(r=>r.$reference),containerIds=p(tp,'diagram-objects').map(r=>r.$reference);
 assert.equal(rows,heights.length);assert.equal(columns,widths.length);assert.equal(cellIds.length,rows*columns);assert.equal(new Set(cellIds).size,cellIds.length);assert.deepEqual(cellIds.toSorted(),containerIds.toSorted());
 const cells=cellIds.map((id,index)=>{
  const cell=objects.get(id),style=objects.get(p(cell.properties,'MyStyle').$reference),resolve=r=>objects.get(r?.$reference);
  const appearance=recoverStyle(cell,style,root,defaultStyle,resolve,{type:'tableCell'}),rich=recoverRichText(cell,{objects,root,packageId:pack.packageId});
  const row=Math.floor(index/columns),column=index%columns;
  const expected={x:widths.slice(0,column).reduce((a,b)=>a+b,0),y:heights.slice(0,row).reduce((a,b)=>a+b,0),width:widths[column],height:heights[row]};
  assert.equal(appearance.cacheChainComplete,true);assert.deepEqual(appearance.resolvedGeometry.location.value,{X:expected.x,Y:expected.y});assert.deepEqual(appearance.resolvedGeometry.size.value,{Width:expected.width,Height:expected.height});
  const borders=['top','right','bottom','left'].map(side=>({width:p(cell.properties,`${side}-border-width`),argb:p(cell.properties,`${side}-border-color`),color:argbColor(p(cell.properties,`${side}-border-color`))}));
  const interaction=recoverInteractionMap({owner:cell,objects,packageId:pack.packageId});assert.deepEqual(interaction.events,[]);
  return {id,row,column,expected,explicitLocalLocation:p(style.properties,'PropList').some(e=>(p(e,'DOAName')&0xfffffff)===101),appearance,richText:rich,borders,interaction,selection:recoverSelection(cell,style,root,defaultStyle,resolve,{type:'tableCell'}),states:recoverInteractionStyles(cell,style,root,defaultStyle,resolve,{type:'tableCell'}),autoFit:[p(cell.properties,'AutoFitWidth'),p(cell.properties,'AutoFitHeight')],emptyPaste:p(cell.properties,'_IsEmpty')};
 });
 report.tables.push({id:table.id,packageId:pack.packageId,page:semantics.diagrams.find(d=>d.packageId===pack.packageId)?.name,parents,rows,columns,columnWidths:widths,rowHeights:heights,matrixCellIds:cellIds,containerCellIds:containerIds,sumSize:{width:widths.reduce((a,b)=>a+b,0),height:heights.reduce((a,b)=>a+b,0)},cells});
}
report.totals={tables:report.tables.length,cells:report.tables.reduce((n,t)=>n+t.cells.length,0),standaloneTables:report.tables.filter(t=>t.parents.some(p=>p.type==='Axure:Diagram')).length,menuOwnedTables:report.tables.filter(t=>t.parents.some(p=>p.type==='Axure:DiagramObject:MenuObject')).length,completeCellCacheChains:report.tables.flatMap(t=>t.cells).filter(c=>c.appearance.cacheChainComplete).length,richCells:report.tables.flatMap(t=>t.cells).filter(c=>c.richText.status==='supported-rich-text').length,absentRichCells:report.tables.flatMap(t=>t.cells).filter(c=>c.richText.status==='no-rich-text').length,cellEvents:0};
report.sources=['research/table-format-analysis.mjs','research/table-format-census.json','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs'].map(file=>({file,sha256:hash(file)}));
fs.writeFileSync('research/table-format-analysis.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,tables:report.tables.map(t=>({id:t.id,page:t.page,parents:t.parents,size:t.sumSize,cells:t.cells.map(c=>({id:c.id,row:c.row,column:c.column,style:c.appearance.style,geometry:c.appearance.resolvedGeometry,rich:c.richText.status,states:c.states.states}))}))},null,2));
