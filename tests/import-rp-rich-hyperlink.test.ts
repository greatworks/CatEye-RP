import {execFileSync} from 'node:child_process';
import {describe,it,expect} from 'vitest';
import {importRpSemantics} from '../src/model/import-rp';
import {parseDocument,serializeDocument} from '../src/model/document';

type Data=Record<string,any>;
const actual:Data[]=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectRpSemantics} from './research/scripts/read-rp-semantics.mjs';
const census=JSON.parse(fs.readFileSync('research/rich-hyperlink-format-census.json','utf8'));
const fixtures=census.owners.map(o=>{
 if(createHash('sha256').update(fs.readFileSync(o.file)).digest('hex')!==o.sha256)throw Error('Changed official sample');
 const source=inspectRpSemantics(o.file),diagram=source.diagrams.find(d=>d.packageId===o.packageId);
 return {...source,pageTreeRecovery:undefined,diagrams:[{...diagram,interactionRecovery:undefined,widgets:diagram.widgets.filter(w=>w.id===o.ownerId)}]};
});fixtures.push(inspectRpSemantics('research/samples/the-basics-tab-menu.rp'));process.stdout.write(JSON.stringify(fixtures));
`],{encoding:'utf8',maxBuffer:4*1024*1024}));
const fixture=(i=0)=>structuredClone(actual[i]),item=(s:Data)=>s.diagrams[0].widgets[0];
const rich=(s:Data)=>item(s).richTextRecovery,link=(s:Data)=>rich(s).richText.links[0],sourceLink=(s:Data)=>rich(s).source.linkSources[0];
function sync(s:Data,owner=item(s)){
 const r=owner.richTextRecovery;
 for(const [i,l]of r.richText.links.entries())l.interactions=r.source.linkSources[i].interactionRecovery.events.flatMap((e:Data)=>e.cases.map((c:Data)=>({id:c.id,name:c.name,event:e.event,enabled:c.enabled,isNewIfGroup:c.isNewIfGroup,conditionMode:c.conditionMode,
  conditions:c.conditions.map((p:Data)=>({source:p.source,key:p.source==='variable'?p.key:p.targetSourceId,operator:p.operator,value:p.value,comparisonMode:p.comparisonMode})),
  actions:c.actions.map((a:Data,i:number)=>({id:`native-a-${c.id}-${i}`,type:a.type,...(a.targetSourceId?{targetId:a.targetSourceId}:a.type==='openPage'?{targetId:a.targetPackageId}:{}),...(a.type==='setState'?{value:a.targetPackageId}:a.value!==undefined?{value:a.value}:{}),...(a.selectText!==undefined?{selectText:a.selectText}:{}),...(a.windowTarget!==undefined?{windowTarget:a.windowTarget}:{})}))})));
}
function replaceActions(s:Data,actions:Data[],owner=item(s)){owner.richTextRecovery.source.linkSources[0].interactionRecovery.events[0].cases[0].actions=actions;sync(s,owner);}
const target=(s:Data,id='a'.repeat(32))=>{const t=structuredClone(item(s));t.id=id;if(t.adaptiveStyleRecovery)t.adaptiveStyleRecovery.sourceId=id;delete t.richTextRecovery;t.text={status:'stored-rich-text-as-plain',text:'Target'};delete t.interactionRecovery;s.diagrams[0].widgets.push(t);return t;};
const show=(id:string)=>({sourceId:'d'.repeat(32),type:'show',targetSourceId:id});

describe('atomic native structured hyperlink conversion',()=>{
 it.each([0,1])('imports actual source %i as scoped literal links and survives save/reopen',i=>{
  const s=fixture(i),before=JSON.stringify(s),r=importRpSemantics(s),w=r.document.pages[0].widgets[0],native=link(s);
  expect(r.report).toMatchObject({widgetsImported:1,widgetsSkipped:0,eventsImported:1,casesImported:1,actionsImported:1});
  expect(w.richText!.links).toHaveLength(1);const l=w.richText!.links![0];
  expect(l.id).toBe(`rp-l-${s.diagrams[0].packageId}-${item(s).id}-${native.id}`);
  expect(w.richText!.paragraphs.flatMap(p=>p.runs).filter(r=>r.linkId).map(r=>r.linkId)).toEqual([l.id]);
  expect(l.interactions[0].actions[0]).toMatchObject({type:'openUrl',value:native.interactions[0].actions[0].value,windowTarget:'new'});
  expect(l.mouseOverStyle).toEqual(native.mouseOverStyle);expect(l.mouseDownStyle).toEqual(native.mouseDownStyle);
  expect(w.richText!.expressionMode).toBe('literal');expect(w.text).toBe(rich(s).text);
  expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);expect(JSON.stringify(s)).toBe(before);
 });
 it.each(['version','count','missing source','source identity','raw graph mismatch','state identity','state property','unknown source field','normal conflict','orphan','unsafe URL','window mode','duplicate link','nonclick event','case behavior'])(
  'rejects an incomplete rich owner atomically: %s',kind=>{
   const s=fixture(),r=rich(s),l=link(s),src=sourceLink(s);
   if(kind==='version')r.source.linkSchemaVersion=2;
   if(kind==='count')r.source.linkCount=0;
   if(kind==='missing source')r.source.linkSources=[];
   if(kind==='source identity')src.id='f'.repeat(32);
   if(kind==='raw graph mismatch')l.interactions[0].actions[0].value='https://other.example/';
   if(kind==='state identity')src.styleSources[1].state='Selected';
   if(kind==='state property')src.styleSources[1].sourceProperties.push(1003);
   if(kind==='unknown source field')src.extra=true;
   if(kind==='normal conflict')src.styleSources[0].style.underline=false;
   if(kind==='orphan')r.richText.paragraphs.flatMap((p:Data)=>p.runs).find((r:Data)=>r.linkId).linkId='f'.repeat(32);
   if(kind==='unsafe URL')replaceActions(s,[{sourceId:'d'.repeat(32),type:'openUrl',value:'javascript:alert(1)',windowTarget:'new'}]);
   if(kind==='window mode')replaceActions(s,[{sourceId:'d'.repeat(32),type:'openUrl',value:'https://example.test',windowTarget:'popup'}]);
   if(kind==='duplicate link')r.richText.links.push(structuredClone(l));
   if(kind==='nonclick event'){src.interactionRecovery.events[0].nativeEventType=48;src.interactionRecovery.events[0].event='focus';sync(s);}
   if(kind==='case behavior')delete s.documentSettingsRecovery;
   const result=importRpSemantics(s);expect(result.document.pages[0].widgets).toEqual([]);expect(result.report).toMatchObject({widgetsImported:0,widgetsSkipped:1,eventsImported:0,casesImported:0,actionsImported:0});
 });
 it('preserves explicit empty state patch and accepts source state records in any order',()=>{
  const s=fixture();sourceLink(s).styleSources.reverse();const r=importRpSemantics(s);
  expect(r.document.pages[0].widgets[0].richText!.links![0].mouseDownStyle).toEqual({});
 });
 it('maps an entire supported IF/ELSE click chain using admitted same-package targets',()=>{
  const s=fixture(),t=target(s),event=sourceLink(s).interactionRecovery.events[0];
  event.cases.push({...structuredClone(event.cases[0]),id:'e'.repeat(32),name:'Fallback',actions:[show(t.id)]});
  event.cases[0].conditions=[{source:'variable',key:'OnLoadVariable',operator:'equals',value:'literal',comparisonMode:'axure'}];sync(s);
  const r=importRpSemantics(s),l=r.document.pages[0].widgets[0].richText!.links![0];
  expect(l.interactions).toHaveLength(2);expect(l.interactions[0].conditions).toEqual([{source:'variable',key:'OnLoadVariable',operator:'equals',value:'literal',comparisonMode:'axure'}]);
  expect(l.interactions[1].actions[0].targetId).toBe(r.document.pages[0].widgets[1].id);
  expect(r.report).toMatchObject({eventsImported:1,casesImported:2,actionsImported:2});
 });
 it('a bad target in a later case removes its entire owner and makes ordinary incoming events reject',()=>{
  const s=fixture(),owner=item(s),t=target(s),event=sourceLink(s).interactionRecovery.events[0];
  event.cases.push({...structuredClone(event.cases[0]),id:'e'.repeat(32),actions:[show('f'.repeat(32))]});sync(s);
  t.interactionRecovery={status:'decoded-interaction-tree',events:[{...structuredClone(event),cases:[{...structuredClone(event.cases[0]),actions:[show(owner.id)]}]}]};
  const r=importRpSemantics(s);expect(r.document.pages[0].widgets.map(w=>w.id)).toEqual([`rp-w-${s.diagrams[0].packageId}-${t.id}`]);
  expect(r.document.pages[0].widgets[0].interactions).toEqual([]);expect(r.report).toMatchObject({widgetsImported:1,widgetsSkipped:1,eventsImported:0,eventsSkipped:1});
 });
 it('repeats dependency validation after removing another rich link owner',()=>{
  const s=fixture(),a=item(s),b=structuredClone(a);b.id='b'.repeat(32);if(b.adaptiveStyleRecovery)b.adaptiveStyleRecovery.sourceId=b.id;s.diagrams[0].widgets.push(b);
  replaceActions(s,[show(b.id)],a);replaceActions(s,[show('f'.repeat(32))],b);
  const r=importRpSemantics(s);expect(r.document.pages[0].widgets).toEqual([]);expect(r.report).toMatchObject({widgetsImported:0,widgetsSkipped:2,eventsImported:0});
 });
 it('removing an unsupported linked child also removes its complete fit panel and remaining sibling states',()=>{
  const s=fixture(2),baseline=importRpSemantics(s),panel=baseline.document.pages[0].widgets.find(w=>w.fitToContent)!;
  expect(panel.states!.flatMap(s=>s.widgets)).toHaveLength(2);
  const state=s.diagrams.find((d:Data)=>d.rootType==='Axure:PanelState'),child=state.widgets[0],linked=item(fixture());
  child.richTextRecovery=linked.richTextRecovery;child.text=linked.text;
  replaceActions(s,[show('f'.repeat(32))],child);
  const r=importRpSemantics(s);
  expect(r.document.pages.flatMap(p=>p.widgets).some(w=>w.id===panel.id)).toBe(false);
  expect(r.report).toMatchObject({widgetsImported:2,widgetsSkipped:1,nestedWidgetsImported:0,nestedWidgetsSkipped:2,panelStatesImported:0});
  expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
 });
 it('same native link/case/action IDs in two packages remain independent and targets never cross packages',()=>{
  const s=fixture(),second=structuredClone(s.diagrams[0]);second.packageId='f'.repeat(32);s.diagrams.push(second);
  const r=importRpSemantics(s);expect(r.report.widgetsImported).toBe(2);
  const links=r.document.pages.map(p=>p.widgets[0].richText!.links![0]);expect(links[0].id).not.toBe(links[1].id);expect(links[0].interactions[0].id).not.toBe(links[1].interactions[0].id);
  expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  replaceActions(s,[show('a'.repeat(32))]);const t=target(s);s.diagrams[0].widgets.pop();second.widgets.push(t);
  const rejected=importRpSemantics(s);expect(rejected.document.pages[0].widgets).toEqual([]);expect(rejected.document.pages[1].widgets).toHaveLength(2);
 });
 it('ordinary widget external URL actions reuse strict URL validation and event atomicity',()=>{
  const s=fixture(),owner=item(s),event=sourceLink(s).interactionRecovery.events[0];owner.interactionRecovery={status:'decoded-interaction-tree',events:[structuredClone(event)]};
  let r=importRpSemantics(s);expect(r.report.eventsImported).toBe(2);expect(r.document.pages[0].widgets[0].interactions[0].actions[0].type).toBe('openUrl');
  owner.interactionRecovery.events[0].cases[0].actions.push({sourceId:'e'.repeat(32),type:'openUrl',value:'https://user@example.test/',windowTarget:'current'});
  r=importRpSemantics(s);expect(r.report).toMatchObject({eventsImported:1,eventsSkipped:1});expect(r.document.pages[0].widgets[0].interactions).toEqual([]);
 });
});
