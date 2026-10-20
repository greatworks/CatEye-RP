import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';

// Real container decoding of independently encoded SYNTHETIC bytes. This is
// source-protocol integration evidence, not an Axure-produced named-view file.
const data=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {makeSyntheticAdaptiveRp,IDS} from './scripts/synthetic-rp-adaptive-fixture.mjs';
import {inspectRpSemantics} from './research/scripts/read-rp-semantics.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rea-adaptive-import-test-'));
try{const {bytes}=makeSyntheticAdaptiveRp(),file=path.join(directory,'synthetic.rp');fs.writeFileSync(file,bytes);
const census=JSON.parse(fs.readFileSync('research/rich-hyperlink-format-census.json','utf8')),owner=census.owners[0],linked=inspectRpSemantics(owner.file);
linked.diagrams=linked.diagrams.filter(d=>d.packageId===owner.packageId).map(d=>({...d,interactionRecovery:undefined,widgets:d.widgets.filter(w=>w.id===owner.ownerId)}));delete linked.pageTreeRecovery;
const tableSample=JSON.parse(fs.readFileSync('research/table-format-census.json','utf8')).samples.find(s=>s.sha256==='9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50');
const table=inspectRpSemantics(tableSample.file);table.diagrams=table.diagrams.filter(d=>d.packageId==='556a42319a0a476c8e81f2d6da0ada41');delete table.pageTreeRecovery;
process.stdout.write(JSON.stringify({semantics:inspectRpSemantics(file),ids:IDS,linked,table}));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
`],{encoding:'utf8',maxBuffer:8*1024*1024})) as any;
const ids=data.ids,source=()=>structuredClone(data.semantics),page=(s:any)=>s.diagrams.find((d:any)=>d.packageId===ids.pagePackage);
const imported=(s:any)=>importRpSemantics(s),targetId=`rp-w-${ids.pagePackage}-${ids.target}`,view=(id:string)=>`rp-av-${id}`;

describe('encoded synthetic adaptive RP through product import',()=>{
  it('retains shared set, inherited named metadata and the actual Page assignment',()=>{
    const s=source(),r=imported(s);expect(s.packageFailures).toEqual([]);expect(s.semanticFailures).toEqual([]);
    expect(r.document.adaptiveViewSets).toEqual([{id:`rp-avs-${ids.set}`,name:'SYNTHETIC Devices',baseSize:{width:1200,height:0},views:[{id:view(ids.tablet),name:'SYNTHETIC Tablet',width:768,height:0},{id:view(ids.phone),name:'SYNTHETIC Phone',width:390,height:0,baseViewId:view(ids.tablet)}]}]);
    expect(r.document.pages[0].adaptiveViewSetId).toBe(`rp-avs-${ids.set}`);expect(r.document.pages[0].adaptiveViews).toEqual([]);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
  it('keeps local geometry/visual/state sources sparse and the orphan view inactive',()=>{
    const r=imported(source()),maps=r.document.pages[0].adaptiveOverrides!;
    expect(maps[view(ids.tablet)][targetId]).toEqual({x:80,y:220,width:240,height:64,style:{fill:'#0000ff'},stateStyles:{selected:{fill:'#ff0000'},mouseOver:{fill:'#00ffff'}}});
    expect(maps[view(ids.phone)][targetId]).toEqual({x:24,y:240,style:{fill:'#00ff00'},stateStyles:{}});
    expect(maps[view(ids.inactive)]).toEqual({[`rp-w-${ids.pagePackage}-${ids.orphan}`]:{}});expect(r.document.adaptiveViewSets![0].views.some(v=>v.id===view(ids.inactive))).toBe(false);
    const target=r.document.pages[0].widgets.find(w=>w.id===targetId)!;expect(target).toMatchObject({x:220,y:220,width:140,height:40,selected:true});expect(target.selectedStyle!.fill).toBe('#81d3f8');
  });
  it('binds all three raw control actions and the Page-only Adaptive View Changed event',()=>{
    const r=imported(source()),p=r.document.pages[0];
    for(const [nativeId,expected]of [[ids.phoneButton,{kind:'view',viewId:view(ids.phone)}],[ids.baseButton,{kind:'base'}],[ids.autoButton,{kind:'auto'}]] as const){const w=p.widgets.find(w=>w.id===`rp-w-${ids.pagePackage}-${nativeId}`)!;expect(w.interactions[0].actions).toEqual([expect.objectContaining({type:'setAdaptiveView',adaptiveView:expected})]);}
    expect(p.interactions).toEqual([expect.objectContaining({event:'adaptiveViewChange',actions:[]})]);expect(r.report.eventsSkipped).toBe(0);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
  it('rejects an unresolved raw named action without removing its widget or independent events',()=>{
    const s=source(),button=page(s).widgets.find((w:any)=>w.id===ids.phoneButton);button.interactionRecovery.events[0].cases[0].actions[0].adaptiveView.guid='e'.repeat(32);
    const r=imported(s);expect(r.document.pages[0].widgets.find(w=>w.id.endsWith(ids.phoneButton))!.interactions).toEqual([]);expect(r.document.pages[0].interactions[0].event).toBe('adaptiveViewChange');expect(r.report.eventsSkipped).toBe(1);
  });
});

function linked(target:unknown){
  const s=structuredClone(data.linked),d=s.diagrams[0],w=d.widgets[0],raw=source();s.adaptiveRecovery=raw.adaptiveRecovery;s.documentSettingsRecovery=raw.documentSettingsRecovery;
  s.adaptiveRecovery.pages=[{...s.adaptiveRecovery.pages[0],packageId:d.packageId,sourceId:d.rootId,provenance:{version:[11,0,0,0],sourcePartSha256:d.sourcePartSha256}}];
  const rich=w.richTextRecovery,src=rich.source.linkSources[0],c=src.interactionRecovery.events[0].cases[0],action={sourceId:'d'.repeat(32),type:'setAdaptiveView',adaptiveView:target};c.actions=[action];
  rich.richText.links[0].interactions[0].actions=[{id:`native-a-${c.id}-0`,type:'setAdaptiveView',adaptiveView:(target as any).kind==='nativeGuid'?{kind:'view',viewId:(target as any).guid}:target}];
  w.storedGeometry.adaptiveStyleCount=2;w.adaptiveStyleRecovery={schema:1,status:'decoded-adaptive-styles',sourceId:w.id,entries:[{viewId:ids.inactive,styleId:'c'.repeat(32),status:'supported-local-adaptive-style',patch:{},source:{kind:'native-local-adaptive-style',packageVersion:[11,0,0,0],properties:[],stateStyleSources:[]}}]};
  return s;
}
describe('adaptive actions in native hyperlink graph carriers',()=>{
  it.each([{kind:'auto'},{kind:'base'},{kind:'nativeGuid',guid:data.ids.phone}])('binds %j only after the entire source graph has been validated',native=>{
    const s=linked(native),before=JSON.stringify(s),r=imported(s),w=r.document.pages[0].widgets[0];
    expect(w.richText!.links![0].interactions[0].actions[0].adaptiveView).toEqual(native.kind==='nativeGuid'?{kind:'view',viewId:view(native.guid!)}:native);
    expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);expect(JSON.stringify(s)).toBe(before);
  });
  it('removes adaptive maps when an unresolved link action prunes its entire owner',()=>{
    const r=imported(linked({kind:'nativeGuid',guid:'f'.repeat(32)}));expect(r.document.pages[0].widgets).toEqual([]);expect(r.document.pages[0].adaptiveOverrides).toBeUndefined();expect(r.report.widgetsSkipped).toBe(1);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
});

function rejectAdaptive(widget:any){widget.storedGeometry.adaptiveStyleCount=2;widget.adaptiveStyleRecovery={schema:1,status:'unsupported-adaptive-styles',sourceId:widget.id,reason:'Synthetic invalid local declaration'};}
function showInteraction(targetSourceId:string){return{status:'decoded-interaction-tree',events:[{status:'supported-event',id:'1'.repeat(32),nativeEventType:16,event:'click',cases:[{id:'2'.repeat(32),name:'Show descendant',enabled:true,isNewIfGroup:true,conditionMode:'all',conditions:[],actions:[{sourceId:'3'.repeat(32),type:'show',targetSourceId}]}]}]};}
describe('adaptive rejection before container registration',()=>{
  it('does not retain phantom table-cell targets or counts after rejecting their parent',()=>{
    const s=structuredClone(data.table),d=s.diagrams[0],table=d.widgets[0],cell=table.tableRecovery.cells[0],button=structuredClone(page(source()).widgets.find((w:any)=>w.id===ids.autoButton));
    delete button.adaptiveStyleRecovery;button.storedGeometry.adaptiveStyleCount=0;button.interactionRecovery=showInteraction(cell.id);d.widgets.push(button);s.documentSettingsRecovery=source().documentSettingsRecovery;
    const baseline=imported(s);expect(baseline.report.nestedWidgetsImported).toBe(9);expect(baseline.document.pages[0].widgets.find(w=>w.id.endsWith(button.id))!.interactions).toHaveLength(1);
    rejectAdaptive(table);const r=imported(s);expect(r.document.pages[0].widgets.map(w=>w.type)).toEqual(['box']);expect(r.report.nestedWidgetsImported).toBe(0);expect(r.document.pages[0].widgets[0].interactions).toEqual([]);expect(r.report.eventsSkipped).toBe(1);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
  it('does not leave registered children or imported states when a fit panel local declaration fails',()=>{
    const s=source(),panel=page(s).widgets.find((w:any)=>w.type==='Axure:DiagramObject:DynamicPanel'),stateId=panel.panelStatePackages[0].$reference,state=s.diagrams.find((d:any)=>d.packageId===stateId),child=state.widgets[0];
    child.interactionRecovery=showInteraction(child.id);expect(imported(s).report.nestedWidgetsImported).toBe(2);
    rejectAdaptive(panel);const r=imported(s);expect(r.report.nestedWidgetsImported).toBe(0);expect(r.report.panelStatesImported).toBe(0);expect(r.document.pages[0].widgets.some(w=>w.type==='panel')).toBe(false);expect(r.report.eventsImported).toBe(4);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
});
