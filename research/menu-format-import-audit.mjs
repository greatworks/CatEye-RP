import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const modules=new Map();
function moduleUrl(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const source=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,relative)=>`from ${JSON.stringify(moduleUrl(path.resolve(path.dirname(file),relative.endsWith('.ts')?relative:relative+'.ts')))}`);const url=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;modules.set(file,url);return url;}
const {importRpSemantics}=await import(moduleUrl('src/model/import-rp.ts'));
const {parseDocument,serializeDocument}=await import(moduleUrl('src/model/document.ts'));
const previous=JSON.parse(fs.readFileSync('research/table-format-import-audit.json','utf8'));
const links=JSON.parse(fs.readFileSync('research/rich-hyperlink-import-audit.json','utf8'));
const walk=widgets=>widgets.flatMap(w=>[w,...walk((w.states??[]).flatMap(s=>s.widgets)),...walk(w.table?.cells??[]),...walk(w.menu?[w.menu.table,...w.menu.submenus]:[])]);
const report={capturedAt:new Date().toISOString(),method:'SHA-pinned native corpus through self-written static readers and pure importer; strict save/reopen, no native DLL/GUI execution',previousStage:'research/table-format-import-audit.json',samples:[],totals:{addedTop:0,addedNested:0,eventDelta:0,actionDelta:0,menus:0,menuTables:0,menuCells:0,richMenuCells:0,allTables:0,allCells:0,links:0}};
for(const old of previous.samples){
 assert.equal(sha(old.file),old.sha256);const semantic=inspectRpSemantics(old.file),item={file:old.file,sha256:old.sha256,compactSemanticBytes:Buffer.byteLength(JSON.stringify(semantic))};
 try{
  const result=importRpSemantics(semantic),widgets=walk(result.document.pages.flatMap(p=>p.widgets)),{issues,...counts}=result.report;
  assert.deepEqual(parseDocument(serializeDocument(result.document)),result.document);
  item.import=counts;item.delta=Object.fromEntries(Object.keys(counts).filter(k=>typeof counts[k]==='number').map(k=>[k,counts[k]-(old.import?.[k]??0)]));
  const isDefault=old.sha256==='9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50';
  assert.equal(item.delta.widgetsImported,isDefault?2:0);assert.equal(item.delta.nestedWidgetsImported,isDefault?8:0);assert.equal(item.delta.eventsImported,0);assert.equal(item.delta.actionsImported,0);
  for(const table of old.tables??[]){const current=widgets.find(w=>w.id===table.id);assert.deepEqual(current?.table,table.table);assert.deepEqual({x:current.x,y:current.y,width:current.width,height:current.height},table.geometry);}
  for(const owner of links.samples.find(s=>s.sha256===old.sha256)?.linkedOwners??[])assert.deepEqual(widgets.find(w=>w.id===owner.id)?.richText,owner.richText);
  item.previousTablesUnchanged=(old.tables??[]).map(w=>w.id);
  item.previousHyperlinksUnchanged=(links.samples.find(s=>s.sha256===old.sha256)?.linkedOwners??[]).map(w=>w.id);
  item.menus=widgets.filter(w=>w.type==='menu').map(w=>({id:w.id,name:w.name,geometry:{x:w.x,y:w.y,width:w.width,height:w.height},menu:w.menu,source:issues.find(i=>i.code==='menu-container-recovery'&&w.id===`rp-w-${i.packageId}-${i.sourceId}`)?.details}));
  report.totals.addedTop+=item.delta.widgetsImported;report.totals.addedNested+=item.delta.nestedWidgetsImported;report.totals.eventDelta+=item.delta.eventsImported;report.totals.actionDelta+=item.delta.actionsImported;report.totals.menus+=item.menus.length;report.totals.menuTables+=item.menus.length;report.totals.menuCells+=item.menus.reduce((n,m)=>n+m.menu.table.table.cells.length,0);report.totals.richMenuCells+=item.menus.reduce((n,m)=>n+m.menu.table.table.cells.filter(c=>c.richText).length,0);report.totals.allTables+=widgets.filter(w=>w.type==='table').length;report.totals.allCells+=widgets.filter(w=>w.type==='tableCell').length;report.totals.links+=widgets.reduce((n,w)=>n+(w.richText?.links?.length??0),0);
 }catch(error){if(path.basename(old.file)!=='Icons.rplib')throw error;item.importError=error.message;assert.equal(item.importError,old.importError);}
 report.samples.push(item);
}
assert.deepEqual(report.totals,{addedTop:2,addedNested:8,eventDelta:0,actionDelta:0,menus:2,menuTables:2,menuCells:6,richMenuCells:6,allTables:3,allCells:15,links:2});
report.sources=['research/menu-format-import-audit.mjs','research/table-format-import-audit.json','research/rich-hyperlink-import-audit.json','research/menu-format-census.json','research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','src/model/document.ts','src/model/types.ts','src/model/menu.ts'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/menu-format-import-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples.map(s=>({file:path.basename(s.file),top:s.import?.widgetsImported,nested:s.import?.nestedWidgetsImported,events:s.import?.eventsImported,delta:s.delta,bytes:s.compactSemanticBytes,error:s.importError}))},null,2));
