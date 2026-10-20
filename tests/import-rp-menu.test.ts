import {execFileSync} from 'node:child_process';import {describe,it,expect} from 'vitest';
import {importRpSemantics} from '../src/model/import-rp';import {parseDocument,serializeDocument} from '../src/model/document';
type Data=Record<string,any>;
const fixtures:Data=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`
import fs from 'node:fs';import {createHash} from 'node:crypto';import {inspectRpSemantics} from './research/scripts/read-rp-semantics.mjs';
const sample=JSON.parse(fs.readFileSync('research/menu-format-census.json','utf8')).samples[0];if(createHash('sha256').update(fs.readFileSync(sample.file)).digest('hex')!==sample.sha256)throw Error('Changed native menu sample');
const s=inspectRpSemantics(sample.file),menus=s.diagrams.filter(d=>d.widgets.some(w=>w.type==='Axure:DiagramObject:MenuObject'));
const l=JSON.parse(fs.readFileSync('research/rich-hyperlink-format-census.json','utf8')).owners[0],linked=inspectRpSemantics(l.file).diagrams.find(d=>d.packageId===l.packageId).widgets.find(w=>w.id===l.ownerId);
process.stdout.write(JSON.stringify({source:{...s,pageTreeRecovery:undefined,diagrams:menus},linked}));
`],{encoding:'utf8',maxBuffer:5*1024*1024}));
const fixture=()=>structuredClone(fixtures.source),menu=(s:Data,i=0)=>s.diagrams[i].widgets[0],recovery=(s:Data,i=0)=>menu(s,i).menuRecovery,table=(s:Data,i=0)=>recovery(s,i).table,cell=(s:Data,i=0)=>table(s,i).tableRecovery.cells[0];
const result=(s=fixture())=>importRpSemantics(s);
function linkTo(s:Data,targetId:string){const c=cell(s),l=structuredClone(fixtures.linked);c.richTextRecovery=l.richTextRecovery;c.text=l.text;const r=c.richTextRecovery,source=r.source.linkSources[0],native=source.interactionRecovery.events[0].cases[0];native.actions=[{sourceId:'d'.repeat(32),type:'show',targetSourceId:targetId}];r.richText.links[0].interactions[0].actions=[{id:`native-a-${native.id}-0`,type:'show',targetId}];}
describe('native menu wrappers and atomic recovery',()=>{
 it('imports both actual menus with all identities and literal rich labels; saves and reopens',()=>{
  const s=fixture(),before=JSON.stringify(s),r=result(s);expect(r.report).toMatchObject({widgetsImported:2,nestedWidgetsImported:8,widgetsSkipped:0,nestedWidgetsSkipped:0,eventsImported:0});
  for(const [i,page]of r.document.pages.entries()){const w=page.widgets[0];expect(w.type).toBe('menu');expect(w.menu!.orientation).toBe(i?'vertical':'horizontal');expect(w.menu!.padding).toEqual([0,0,0,0]);expect(w.menu!.submenus).toEqual([]);expect(w.menu!.table).toMatchObject({type:'table',x:0,y:0,width:i?100:300,height:i?90:30});expect(w.menu!.table.id).toBe(`rp-w-${s.diagrams[i].packageId}-${table(s,i).id}`);expect(w.menu!.table.table!.cells.map(c=>c.text)).toEqual(i?['Item 1','Item 2','Item 3']:['File','Edit','View']);expect(w.menu!.table.table!.cells.every(c=>c.type==='tableCell'&&c.richText?.expressionMode==='literal')).toBe(true);}
  expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);expect(JSON.stringify(s)).toBe(before);
 });
 it.each(['wrong orientation','wrong native orientation','padding','submenus','parent binding','unknown field','source table id','missing layout proof','wrong layout owner','computed coordinate','explicit coordinate conflict','wrong table type','root size','wrong matrix axis','broken cell','cache missing','source collision'])(
  'rejects the complete menu on %s',kind=>{const s=fixture();s.diagrams=s.diagrams.slice(0,1);const m=recovery(s),t=table(s),c=cell(s);
   if(kind==='wrong orientation')m.orientation='diagonal';if(kind==='wrong native orientation')m.source.nativeOrientation=1;if(kind==='padding')m.padding[3]=1;if(kind==='submenus')m.submenus.push({});if(kind==='parent binding')m.parentCellId=c.id;if(kind==='unknown field')m.clickToOpen=true;if(kind==='source table id')m.source.tableId='f'.repeat(32);
   if(kind==='missing layout proof')delete t.menuPositionRecovery;if(kind==='wrong layout owner')t.menuPositionRecovery.menuOwnerId='f'.repeat(32);if(kind==='computed coordinate')t.menuPositionRecovery.x=1;if(kind==='explicit coordinate conflict')t.storedGeometry.location={determined:true,overridden:true,value:{X:1,Y:0}};
   if(kind==='wrong table type')t.typeCandidate.type='panel';if(kind==='root size')menu(s).storedGeometry.size.value.Width=301;if(kind==='wrong matrix axis'){m.orientation='vertical';m.source.nativeOrientation=1;}if(kind==='broken cell')t.tableRecovery.cells.pop();if(kind==='cache missing')c.styleRecovery.cacheChainComplete=false;if(kind==='source collision')s.diagrams[0].widgets.push(structuredClone(c));
   const r=result(s);expect(r.document.pages[0].widgets).toEqual([]);expect(r.report.widgetsImported).toBe(0);expect(r.report.nestedWidgetsImported).toBe(0);
  });
 it('does not use derived menu coordinates on a detached table',()=>{const s=fixture();s.diagrams=s.diagrams.slice(0,1);s.diagrams[0].widgets=[table(s)];expect(result(s).document.pages[0].widgets).toEqual([]);});
 it('keeps menu-owned cell events and targets scoped to their native package',()=>{
  const s=fixture(),target=table(s).tableRecovery.cells[2].id;cell(s).interactionRecovery={status:'decoded-interaction-tree',events:[{status:'supported-event',id:'a'.repeat(32),nativeEventType:16,event:'click',cases:[{id:'b'.repeat(32),name:'Cell action',enabled:true,isNewIfGroup:true,conditionMode:'all',conditions:[],actions:[{sourceId:'c'.repeat(32),type:'hide',targetSourceId:target}]}]}]};
  const r=result(s),cells=r.document.pages[0].widgets[0].menu!.table.table!.cells;expect(cells[0].interactions[0].actions[0].targetId).toBe(cells[2].id);expect(r.report).toMatchObject({eventsImported:1,actionsImported:1});
 });
 it('a broken cell hyperlink removes its complete menu, table and sibling cells',()=>{
  const s=fixture();linkTo(s,'f'.repeat(32));const r=result(s);expect(r.document.pages[0].widgets).toEqual([]);expect(r.document.pages[1].widgets).toHaveLength(1);expect(r.report).toMatchObject({widgetsImported:1,widgetsSkipped:1,nestedWidgetsImported:4,nestedWidgetsSkipped:4,eventsImported:0,actionsImported:0});
 });
 it('does not cross native package boundaries to satisfy a menu cell hyperlink',()=>{const s=fixture();linkTo(s,cell(s,1).id);const r=result(s);expect(r.document.pages[0].widgets).toEqual([]);expect(r.document.pages[1].widgets).toHaveLength(1);expect(r.report.eventsImported).toBe(0);});
});
