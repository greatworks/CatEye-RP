import {execFileSync} from 'node:child_process';
import {describe,it,expect} from 'vitest';
import {importRpSemantics} from '../src/model/import-rp';
import {parseDocument,serializeDocument} from '../src/model/document';
type Data=Record<string,any>;
const fixtures:Data=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {inspectRpSemantics} from './research/scripts/read-rp-semantics.mjs';
const sample=JSON.parse(fs.readFileSync('research/table-format-census.json','utf8')).samples.find(s=>s.sha256==='9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50');
if(createHash('sha256').update(fs.readFileSync(sample.file)).digest('hex')!==sample.sha256)throw Error('Changed official table source');
const full=inspectRpSemantics(sample.file),table={...full,pageTreeRecovery:undefined,diagrams:full.diagrams.filter(d=>d.packageId==='556a42319a0a476c8e81f2d6da0ada41')};
const linkSource=JSON.parse(fs.readFileSync('research/rich-hyperlink-format-census.json','utf8')).owners[0];
if(createHash('sha256').update(fs.readFileSync(linkSource.file)).digest('hex')!==linkSource.sha256)throw Error('Changed link fixture');
const link=inspectRpSemantics(linkSource.file).diagrams.find(d=>d.packageId===linkSource.packageId).widgets.find(w=>w.id===linkSource.ownerId);
process.stdout.write(JSON.stringify({table,link}));
`],{encoding:'utf8',maxBuffer:5*1024*1024}));
const fixture=()=>structuredClone(fixtures.table),table=(s:Data)=>s.diagrams[0].widgets[0],matrix=(s:Data)=>table(s).tableRecovery,cell=(s:Data,i=0)=>matrix(s).cells[i];
const result=(s=fixture())=>importRpSemantics(s);
function linkedCell(s:Data,index:number,targetId:string){
 const c=cell(s,index),l=structuredClone(fixtures.link);c.richTextRecovery=l.richTextRecovery;c.text=l.text;
 const recovery=c.richTextRecovery,source=recovery.source.linkSources[0],event=source.interactionRecovery.events[0],native=event.cases[0],link=recovery.richText.links[0];
 native.actions=[{sourceId:'d'.repeat(32),type:'show',targetSourceId:targetId}];
 link.interactions[0].actions=[{id:`native-a-${native.id}-0`,type:'show',targetId}];
}
describe('strict native table conversion',()=>{
 it('recovers the actual complete matrix, distinct cells, event order and exact save/reopen',()=>{
  const s=fixture(),before=JSON.stringify(s),r=result(s),w=r.document.pages[0].widgets[0];
  expect(r.report).toMatchObject({widgetsImported:1,widgetsSkipped:0,nestedWidgetsImported:9,nestedWidgetsSkipped:0,eventsImported:0});
  expect(w.type).toBe('table');expect(w).toMatchObject({x:100,y:100,width:300,height:90});
  expect(w.table!.columnWidths).toEqual([100,100,100]);expect(w.table!.rowHeights).toEqual([30,30,30]);
  expect(w.table!.cells.map(c=>[c.x,c.y,c.width,c.height])).toEqual(Array.from({length:9},(_,i)=>[i%3*100,Math.floor(i/3)*30,100,30]));
  expect(w.table!.cells.map(c=>c.text)).toEqual(['Column 1','Column 2','Column 3','','','','','','']);
  expect(w.table!.cells.every(c=>c.type==='tableCell'&&c.style.stroke==='#797979'&&JSON.stringify(c.style.borderWidths)==='[1,1,1,1]')).toBe(true);
  expect(w.table!.cellOrder).toEqual(matrix(s).source.diagramObjectIds.map((id:string)=>`rp-w-${s.diagrams[0].packageId}-${id}`));
  expect(w.table!.cells.filter(c=>c.richText)).toHaveLength(3);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);expect(JSON.stringify(s)).toBe(before);
 });
 it.each(['incomplete matrix','duplicate matrix','different order set','duplicate order','rows','tracks','root bounds','cell bounds','foreign owner','type spoof','cache incomplete','border color','border range','rotation','unknown rich','missing cell flags','source collision','unknown protocol'])(
  'rejects the entire table on %s',kind=>{
   const s=fixture(),m=matrix(s),c=cell(s);
   if(kind==='incomplete matrix')m.cells.pop();if(kind==='duplicate matrix')m.source.cellIds[1]=m.source.cellIds[0];if(kind==='different order set')m.source.diagramObjectIds[0]='f'.repeat(32);if(kind==='duplicate order')m.source.diagramObjectIds[1]=m.source.diagramObjectIds[0];
   if(kind==='rows')m.rows=1001;if(kind==='tracks')m.columnWidths[0]=0;if(kind==='root bounds')table(s).storedGeometry.size.value.Width=301;
   if(kind==='cell bounds')c.styleRecovery.resolvedGeometry.location.value.X=1;if(kind==='foreign owner')c.typeCandidate.tableOwnerId='f'.repeat(32);if(kind==='type spoof')c.typeCandidate.type='box';if(kind==='cache incomplete')c.styleRecovery.cacheChainComplete=false;
   if(kind==='border color')c.borderRecovery.color='#000000';if(kind==='border range')c.borderRecovery.widths[0]=101;if(kind==='rotation')c.borderRecovery.layout.rotation=1;
   if(kind==='unknown rich')c.richTextRecovery={status:'unsupported-rich-text',reason:'unknown run'};if(kind==='missing cell flags')delete c.storedFlags.AutoFitWidth;
   if(kind==='source collision')s.diagrams[0].widgets.push(structuredClone(c));if(kind==='unknown protocol')m.merged=true;
   const r=result(s);expect(r.document.pages[0].widgets).toEqual([]);expect(r.report.widgetsImported).toBe(0);expect(r.report.nestedWidgetsImported).toBe(0);expect(r.report.eventsImported).toBe(0);
  });
 it('does not create a cell outside its matrix',()=>{const s=fixture();s.diagrams[0].widgets=[cell(s)];expect(result(s).document.pages[0].widgets).toEqual([]);});
 it('omits redundant cellOrder when native order equals the matrix',()=>{const s=fixture();matrix(s).source.diagramObjectIds=[...matrix(s).source.cellIds];expect(result(s).document.pages[0].widgets[0].table!.cellOrder).toBeUndefined();});
 it('resolves understood cell events and same-package targets after the complete matrix exists',()=>{
  const s=fixture(),targetId=cell(s,8).id;cell(s).interactionRecovery={status:'decoded-interaction-tree',events:[{status:'supported-event',id:'a'.repeat(32),nativeEventType:16,event:'click',cases:[{id:'b'.repeat(32),name:'Cell click',enabled:true,isNewIfGroup:true,conditionMode:'all',conditions:[],actions:[{sourceId:'c'.repeat(32),type:'show',targetSourceId:targetId}]}]}]};
  const r=result(s),cells=r.document.pages[0].widgets[0].table!.cells;expect(cells[0].interactions[0].actions[0].targetId).toBe(cells[8].id);expect(r.report).toMatchObject({eventsImported:1,casesImported:1,actionsImported:1});
 });
 it('rejects the complete table when a cell link has an unresolved target',()=>{
  const s=fixture();linkedCell(s,0,'f'.repeat(32));const r=result(s);expect(r.document.pages[0].widgets).toEqual([]);expect(r.report).toMatchObject({widgetsImported:0,widgetsSkipped:1,nestedWidgetsImported:0,nestedWidgetsSkipped:9,eventsImported:0});
 });
 it('dependency fixed point also removes another table when its link targets a removed cell',()=>{
  const s=fixture(),first=table(s),second=structuredClone(first),oldIds=second.tableRecovery.source.cellIds;second.id='a'.repeat(32);if(second.adaptiveStyleRecovery)second.adaptiveStyleRecovery.sourceId=second.id;
  const remap=new Map(oldIds.map((id:string,i:number)=>[id,`b${i.toString(16).padStart(31,'0')}`]));
  second.tableRecovery.cells.forEach((c:Data)=>{c.id=remap.get(c.id);if(c.adaptiveStyleRecovery)c.adaptiveStyleRecovery.sourceId=c.id;c.typeCandidate.tableOwnerId=second.id;});second.tableRecovery.source.cellIds=oldIds.map((id:string)=>remap.get(id));second.tableRecovery.source.diagramObjectIds=second.tableRecovery.source.diagramObjectIds.map((id:string)=>remap.get(id));
  s.diagrams[0].widgets.push(second);linkedCell(s,0,'f'.repeat(32));
  const other={...s,diagrams:[{...s.diagrams[0],widgets:[second]}]};linkedCell(other,0,cell(s,8).id);
  const r=result(s);expect(r.document.pages[0].widgets).toEqual([]);expect(r.report).toMatchObject({widgetsImported:0,widgetsSkipped:2,nestedWidgetsImported:0,nestedWidgetsSkipped:18,eventsImported:0,casesImported:0,actionsImported:0});
 });
});
