import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterAll,describe,expect,it} from 'vitest';
import {importRpSemantics} from '../src/model/import-rp';
import {importAdaptiveStyles,importPlacement} from '../src/model/import-rp-adaptive';
import {createWidget,parseDocument,serializeDocument} from '../src/model/document';
// @ts-expect-error Test-only independent raw RP encoder.
import {makeSyntheticPlacementRp} from '../scripts/synthetic-rp-placement-fixture.mjs';
// @ts-expect-error Bounded native object reader.
import {inspectRpObjects} from '../research/scripts/read-rp-objects.mjs';
// @ts-expect-error Bounded native semantic reader.
import {inspectRpSemantics} from '../research/scripts/read-rp-semantics.mjs';
// @ts-expect-error Test-only independent container encoder, not native write-back.
import {encodeSyntheticRpContainer} from '../scripts/synthetic-rp-object-carrier.mjs';

type Data=Record<string,any>;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rea-placement-format-'));
const carrier=makeSyntheticPlacementRp(),file=path.join(directory,'SYNTHETIC.rp');
fs.writeFileSync(file,carrier.bytes);
const original=inspectRpObjects(file),ids=carrier.manifest.ids;
const get=(value:Data,key:string)=>value.$map.find(([k]:[string,unknown])=>k===key)?.[1];
const put=(value:Data,key:string,next:unknown)=>{const p=value.$map.find(([k]:[string,unknown])=>k===key);if(p)p[1]=next;else value.$map.push([key,next]);};
const property=(value:unknown,flags=3)=>({$map:[['DOAName',111|(flags<<30)],['Value',value]]});
const targetId=`rp-w-${ids.pagePackage}-${ids.target}`;
function fixture(mutate?:(base:Data,local:Data,pack:Data,owner:Data,packages:Data[])=>void){
  const packages=structuredClone(original.packages),pack=packages.find((p:Data)=>p.packageId===ids.pagePackage),find=(id:string)=>pack.objects.find((o:Data)=>o.id===id),owner=find(ids.target);
  const base=find(get(owner.properties,'MyStyle').$reference),local=find(get(owner.properties,'AdaptiveStyles')[1].$reference);
  mutate?.(base,local,pack,owner,packages);fs.writeFileSync(file,encodeSyntheticRpContainer(packages));return inspectRpSemantics(file);
}
const set111=(style:Data,value:unknown,flags=3)=>put(style.properties,'PropList',[...get(style.properties,'PropList').filter((p:Data)=>(get(p,'DOAName')&0xfffffff)!==111),property(value,flags)]);
const native=(s:Data)=>s.diagrams.find((d:Data)=>d.packageId===ids.pagePackage).widgets.find((w:Data)=>w.id===ids.target);
const imported=(s:Data)=>importRpSemantics(s,'SYNTHETIC native placement');
const target=(s:Data)=>imported(s).document.pages.flatMap(p=>p.widgets).find(w=>w.id===targetId);
afterAll(()=>{fs.unlinkSync(file);fs.rmdirSync(directory);});

describe('native P111 raw container and independent import validation',()=>{
  it.each([[0,false],[1,undefined],[2,false]] as const)('Base enum %s is exactly %s, with true omitted', (value,expected)=>{
    const s=fixture(base=>set111(base,value)),before=JSON.stringify(s),r=imported(s),w=target(s)!;
    expect(w).toBeDefined();expect(w.placed).toBe(expected);expect(w.hidden).toBe(false);
    expect(native(s).placementRecovery.source.value).toBe(value);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);expect(JSON.stringify(s)).toBe(before);
  });
  it.each([[0,false],[1,true],[2,false]] as const)('local enum %s preserves explicit %s', (value,expected)=>{
    const s=fixture((_base,local)=>set111(local,value)),r=imported(s),p=r.document.pages[0].adaptiveOverrides![`rp-av-${ids.tablet}`][targetId];
    expect(p.placed).toBe(expected);expect(p.hidden).toBeUndefined();expect(target(s)).toBeDefined();
  });
  it.each([true,false,1.5,3,-1,'1',null])('raw Base rejects invalid enum %s atomically',value=>{
    const s=fixture(base=>set111(base,value));expect(target(s)).toBeUndefined();expect(imported(s).report.issues.some(i=>i.sourceId===ids.target&&/BoolOverride/.test(i.message))).toBe(true);
  });
  it.each([true,false,1.5,3,-1,'1',null])('raw local rejects invalid enum %s atomically',value=>{
    const s=fixture((_base,local)=>set111(local,value));expect(target(s)).toBeUndefined();expect(imported(s).report.issues.some(i=>i.sourceId===ids.target&&/BoolOverride/.test(i.message))).toBe(true);
  });
  it.each([0,1,2])('inactive Base flag %s does not override known true cache',flags=>{
    const s=fixture(base=>set111(base,2,flags));expect(native(s).placementRecovery.status).toBe('inactive-direct-placement');expect(target(s)?.placed).toBeUndefined();expect(target(s)).toBeDefined();
  });
  it.each([0,1,2])('inactive local flag %s does not become placed false',flags=>{
    const s=fixture((_base,local)=>set111(local,2,flags)),r=imported(s);expect(target(s)).toBeDefined();expect(r.document.pages[0].adaptiveOverrides![`rp-av-${ids.tablet}`][targetId].placed).toBeUndefined();
  });
  it.each([0,1,2])('inactive local flag %s still rejects a Boolean carrier',flags=>{
    const s=fixture((_base,local)=>set111(local,false,flags));expect(target(s)).toBeUndefined();expect(native(s).adaptiveStyleRecovery.reason).toMatch(/BoolOverride/);
  });
  it.each(['base','local'] as const)('old-version %s declaration is not admitted by an unchanged carrier',scope=>{
    const s=fixture((base,local,pack)=>{pack.version=[10,0,4,0];if(scope==='local')put(base.properties,'PropList',get(base.properties,'PropList').filter((p:Data)=>(get(p,'DOAName')&0xfffffff)!==111));else put(local.properties,'PropList',get(local.properties,'PropList').filter((p:Data)=>(get(p,'DOAName')&0xfffffff)!==111));});
    expect(target(s)).toBeUndefined();expect(native(s)[scope==='base'?'placementRecovery':'adaptiveStyleRecovery'].reason).toMatch(/RP11 package version/);
  });
  it('hidden remains a separate stored declaration when placement is false',()=>{
    const s=fixture((base,_local,_pack,owner)=>{set111(base,2);put(owner.properties,'VisibleFromSettings',false);});expect(target(s)).toMatchObject({placed:false,hidden:true});
  });
  it.each([[1,300,170],[2,1,1]] as const)('fit initial bounds honor child P111=%s without turning it hidden',(value,width,height)=>{
    const s=fixture((_base,_local,_pack,_owner,packages)=>{
      for(const pack of packages)if(pack.objects.find((o:Data)=>o.id===pack.rootId)?.type==='Axure:PanelState'){
        const child=pack.objects.find((o:Data)=>o.type==='Axure:DiagramObject:VectorShape'),style=pack.objects.find((o:Data)=>o.id===get(child.properties,'MyStyle').$reference);set111(style,value);
      }
    }),r=imported(s),panel=r.document.pages[0].widgets.find(w=>w.type==='panel')!;
    expect(panel).toBeDefined();expect(panel.fitToContent).toBe(true);expect([panel.width,panel.height]).toEqual([width,height]);
    for(const state of panel.states!)expect(state.widgets[0]).toMatchObject({hidden:false,...(value===2?{placed:false}:{})});
  });
  it('eligible IX placement is not accepted as a visual state style',()=>{
    const s=fixture((_base,local,pack)=>{
      const p=get(local.properties,'PropList').find((p:Data)=>(get(p,'DOAName')&0xfffffff)===21),ref=get(p,'Value').$map[0][1];set111(pack.objects.find((o:Data)=>o.id===ref.$reference),2);
    });expect(target(s)).toBeUndefined();expect(native(s).adaptiveStyleRecovery.reason).toMatch(/visual property 111/);
  });
  it.each(['placed','source value','source ID','style ID','DOA','raw record','missing recovery','unknown field'])('second boundary rejects %s forgery',kind=>{
    const s=fixture(),w=native(s),r=w.placementRecovery;
    if(kind==='placed')r.placed=false;if(kind==='source value')r.source.value=2;if(kind==='source ID')r.sourceId='f'.repeat(32);if(kind==='style ID')r.source.styleId='f'.repeat(32);
    if(kind==='DOA')r.source.rawDoaName=110|0xc0000000;if(kind==='raw record')w.storedGeometry.placement.value=2;if(kind==='missing recovery')delete w.placementRecovery;if(kind==='unknown field')r.hidden=false;
    expect(target(s)).toBeUndefined();
  });
  it('second boundary rejects a forged local projection and Boolean raw payload',()=>{
    const s=fixture(),entry=native(s).adaptiveStyleRecovery.entries[0];entry.patch.placed=true;expect(target(s)).toBeUndefined();
    entry.patch.placed=false;entry.source.properties.find((p:Data)=>(p.rawDoaName&0xfffffff)===111).value=false;expect(target(s)).toBeUndefined();
  });
  it.each(['base','local'] as const)('second boundary rejects absent or old %s version proof',scope=>{
    for(const version of [undefined,[10,0,4,0],[11,0,0]]){
      const s=fixture(),proof=scope==='base'?native(s).placementRecovery.source:native(s).adaptiveStyleRecovery.entries[0].source;proof.packageVersion=version;expect(target(s)).toBeUndefined();
    }
  });
  it.each(['table','menu','tree'] as const)('root %s accepts a local placement-only patch',type=>{
    const s=fixture(),entry=native(s).adaptiveStyleRecovery.entries[0],widget=createWidget(type,0,0);
    entry.source.properties=entry.source.properties.filter((p:Data)=>(p.rawDoaName&0xfffffff)===111);entry.source.stateStyleSources=[];entry.patch={placed:false};
    const recovery={...native(s).adaptiveStyleRecovery,entries:[entry]};expect(importAdaptiveStyles(recovery,2,ids.target,widget,()=>{}).get(`rp-av-${ids.tablet}`)).toEqual({placed:false});
  });
  it.each(['tableCell','treeNode','menu-owned-table','contained-label'])('independent placement of %s is rejected at the import boundary',kind=>{
    const s=fixture(),w=native(s),type=kind==='menu-owned-table'?'table':kind==='contained-label'?'text':kind as 'tableCell'|'treeNode';
    expect(()=>importPlacement(w.placementRecovery,w.storedGeometry.placement,ids.target,w.storedGeometry.styleId,type,true)).toThrow(/复合子元件/);
  });
});
