import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';
import type { Widget } from '../src/model/types';

const reader=fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs',import.meta.url));
const read=(name:string)=>JSON.parse(execFileSync(process.execPath,[reader,fileURLToPath(new URL(`../research/samples/${name}`,import.meta.url))],{encoding:'utf8',maxBuffer:24*1024*1024}));
const required=read('complex-interactions-required-fields.rp'),tab=read('the-basics-tab-menu.rp');
function fixture(){const source=structuredClone(required),item=source.diagrams[0].widgets.find((w:{typeCandidate?:{type:string}})=>w.typeCandidate?.type==='input');source.diagrams[0].widgets=[item];item.interactionRecovery.events=[];return{source,item};}
const patch=(sourceState:string,color:string)=>({sourceState,status:'supported-state-style',sourceStyleId:'a'.repeat(32),sourceProperties:[6],style:{color},provenance:{fixture:true}});
const event=(nativeEventType:number,event:string,targetSourceId:string,value='true')=>({status:'supported-event',id:'b'.repeat(32),nativeEventType,event,cases:[{id:'c'.repeat(32),name:'Error action',enabled:true,isNewIfGroup:true,conditionMode:'all',conditions:[],actions:[{sourceId:'d'.repeat(32),type:'setError',targetSourceId,value}]}]});
const widgets=(items:Widget[]):Widget[]=>items.flatMap(w=>[w,...(w.states??[]).flatMap(s=>widgets(s.widgets)),...(w.layer?widgets(w.layer.widgets):[])]);

describe('native error and hint protocol',()=>{
  it('maps independent hint/error fields and roundtrips literal text without changing the input value',()=>{
    const {source,item}=fixture();Object.assign(item.errorHintRecovery.inputHint,{hintText:'<b>Search</b>',hintHideOn:'focus'});
    item.errorHintRecovery.styles.states.error=patch('Error','#ff0000');item.errorHintRecovery.styles.states.hint=patch('Hint','#999999');
    const before=JSON.stringify(source),result=importRpSemantics(source),w=result.document.pages[0].widgets[0];
    expect(w).toMatchObject({error:false,text:'',hintText:'<b>Search</b>',hintHideOn:'focus',errorStyle:{color:'#ff0000'},hintStyle:{color:'#999999'}});
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);expect(JSON.stringify(source)).toBe(before);
  });
  it('uses explicit normal appearance for a standalone initial error so clearing can restore the base',()=>{
    const {source,item}=fixture();item.storedFlags.Error=true;item.errorHintRecovery.error=true;item.errorHintRecovery.normalStyleRecovery={style:{fill:'#ffffff',color:'#000000'}};
    item.errorHintRecovery.styles.states.error=patch('Error','#ff0000');
    expect(importRpSemantics(source).document.pages[0].widgets[0]).toMatchObject({error:true,style:{color:'#000000'},errorStyle:{color:'#ff0000'}});
    delete item.errorHintRecovery.normalStyleRecovery;
    expect(importRpSemantics(source).document.pages[0].widgets[0].error).toBeUndefined();
  });
  it.each(['bad-flag','bad-policy','expression','oversize','unknown-key','wrong-fields'])('rejects %s in behavior metadata without turning it into executable or guessed data',mutation=>{
    const {source,item}=fixture(),r=item.errorHintRecovery;
    if(mutation==='bad-flag')r.error='true';if(mutation==='bad-policy')r.inputHint.hintHideOn='always';
    if(mutation==='expression')r.inputHint.hintText='[[Widget.x.text]]';if(mutation==='oversize')r.inputHint.hintText='x'.repeat(100001);
    if(mutation==='unknown-key')r.inputHint.url='https://example.invalid';if(mutation==='wrong-fields')r.inputHint.sourceFields=['TextBlock','HideHintOnFocus'];
    const result=importRpSemantics(source);expect(result.document.pages[0].widgets[0].hintText).toBeUndefined();expect(result.document.pages[0].widgets).toHaveLength(1);expect(result.report.widgetsSkipped).toBe(0);expect(result.report.issues.some(i=>i.code==='error-hint-omitted')).toBe(true);
  });
  it('revalidates each style independently and does not reject the safe sibling or behavior fields',()=>{
    const {source,item}=fixture();item.errorHintRecovery.styles.states.error=patch('Hint','#ff0000');item.errorHintRecovery.styles.states.hint=patch('Hint','#999999');
    const w=importRpSemantics(source).document.pages[0].widgets[0];expect(w.errorStyle).toBeUndefined();expect(w.hintStyle).toEqual({color:'#999999'});expect(w.error).toBe(false);
  });
  it('validates named-cache provenance and refuses broadened non-color or false identity claims',()=>{
    const {source,item}=fixture();const hint=patch('Hint','#999999');item.errorHintRecovery.styles.states.hint={...hint,namedStyleMatch:{styleId:'a'.repeat(32),libraryId:'e'.repeat(32),localProperties:[0]}};
    expect(importRpSemantics(source).document.pages[0].widgets[0].hintStyle).toEqual({color:'#999999'});
    for(const match of [{styleId:'0'.repeat(32),libraryId:'e'.repeat(32),localProperties:[0]},{styleId:'a'.repeat(32),libraryId:'e'.repeat(32),localProperties:[0,15]},{styleId:'a'.repeat(32),libraryId:'e'.repeat(32),localProperties:[0],fallback:true}]){
      item.errorHintRecovery.styles.states.hint.namedStyleMatch=match;expect(importRpSemantics(source).document.pages[0].widgets[0].hintStyle).toBeUndefined();
    }
  });
  it.each([[55,'errorSet'],[56,'errorRemoved']] as const)('recovers native event %s with strict literal setError', (code,name)=>{
    const {source,item}=fixture();item.interactionRecovery.events=[event(code,name,item.id,'toggle')];
    const result=importRpSemantics(source);expect(result.report.eventsImported).toBe(1);expect(result.document.pages[0].widgets[0].interactions[0]).toMatchObject({event:name,actions:[{type:'setError',value:'toggle'}]});
  });
  it('rejects an entire error event for invalid expression values or an unknown target flag',()=>{
    const {source,item}=fixture();item.interactionRecovery.events=[event(16,'click',item.id,'[[true]]')];expect(importRpSemantics(source).report.eventsImported).toBe(0);
    item.interactionRecovery.events=[event(16,'click',item.id)];delete item.errorHintRecovery;expect(importRpSemantics(source).report.eventsImported).toBe(0);
  });
  it('allows complete recovered panel error propagation, but rejects a partial descendant tree atomically',()=>{
    const source=structuredClone(tab),page=source.diagrams.find((d:{rootType:string})=>d.rootType==='Axure:Page');
    const panel=page.widgets.find((w:{typeCandidate?:{type:string}})=>w.typeCandidate?.type==='panel'),owner=page.widgets[0];
    owner.interactionRecovery.events=[event(16,'click',panel.id)];page.widgets[1].interactionRecovery.events=[];
    expect(importRpSemantics(source).report.eventsImported).toBe(1);
    panel.storedFlags['fit-to-content']=false;const state=source.diagrams.find((d:{rootType:string})=>d.rootType==='Axure:PanelState');
    state.widgets.push({...structuredClone(state.widgets[0]),id:'f'.repeat(32),typeCandidate:null});
    const result=importRpSemantics(source);expect(result.document.pages[0].widgets.some(w=>w.type==='panel')).toBe(true);expect(result.report.eventsImported).toBe(0);
    expect(result.report.issues.some(i=>i.code==='interaction-event-skipped'&&i.message.includes('传播'))).toBe(true);
  });
  it('keeps old recovery inputs valid and does not inject new model defaults without a protocol',()=>{
    const {source,item}=fixture();delete item.errorHintRecovery;
    const w=importRpSemantics(source).document.pages[0].widgets[0];expect(w.error).toBeUndefined();expect(w.hintText).toBeUndefined();expect(w.hintHideOn).toBeUndefined();
  });
  it('real Starter preserves its reachable Search hint/#bdbdbd and legacy press styles through save/readback',()=>{
    const source=read('Prototype Starter.rp'),result=importRpSemantics(source),all=result.document.pages.flatMap(p=>widgets(p.widgets));
    const hints=all.filter(w=>w.hintText);expect(hints).toHaveLength(1);for(const w of hints)expect(w).toMatchObject({hintText:'Search...',text:'',hintHideOn:'typing',hintStyle:{color:'#bdbdbd'}});
    // Twelve complete Layer identities now own their original members.
    expect(all.filter(w=>w.mouseDownStyle)).toHaveLength(3);expect(all.filter(w=>w.type==='layer')).toHaveLength(12);expect(result.report).toMatchObject({widgetsImported:46,widgetsSkipped:18,nestedWidgetsImported:52});
    expect(all.filter(w=>w.rotation!==0).map(w=>[w.id,w.rotation])).toEqual([['rp-w-cf0292b673ec4c9385d51b57a5ed8a79-24cfeb80b4144494bc2e63f502222314',89.13596303062127]]);
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
  });
});
