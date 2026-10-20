import {describe,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {importAuthorResizePins,importNativeAuthorPin} from '../src/model/import-rp-resize-pins';
import {importAdaptiveStyles} from '../src/model/import-rp-adaptive';
import {createWidget,parseDocument,serializeDocument} from '../src/model/document';
import {importRpSemantics} from '../src/model/import-rp';

const id=(n:number)=>n.toString(16).padStart(32,'0');
const fixture=()=>({
 schema:1,status:'supported-author-resize-pins',sourceId:id(1),styleId:id(2),packageVersion:[11,0,0,0],cacheChainComplete:true,
 fields:[106,107,108,109].map(key=>({key,value:key<108?0:false,source:{kind:'native-default-table',methodToken:100717199}})) as any[],
 inactive:[] as any[],
});
const local=(key:number,value:unknown)=>({key,value,rawDoaName:key|0xc0000000,source:{kind:'local-object-style',objectId:id(2)}});
const read=(r:unknown)=>importAuthorResizePins(r,id(1),id(2));
describe('native author resize pins editable-project boundary',()=>{
 it.each([
  [106,0,{pinHorizontal:'none'}],[106,1,{pinHorizontal:'left'}],[106,4,{pinHorizontal:'right'}],[106,5,{pinHorizontal:'both'}],[106,256,{pinHorizontal:'center'}],
  [107,0,{pinVertical:'none'}],[107,2,{pinVertical:'top'}],[107,8,{pinVertical:'bottom'}],[107,10,{pinVertical:'both'}],[107,512,{pinVertical:'center'}],
  [108,false,{fixedHeight:false}],[108,true,{fixedHeight:true}],[109,false,{fixedWidth:false}],[109,true,{fixedWidth:true}],
 ] as const)('independently maps P%s=%s',(key,value,expected)=>expect(importNativeAuthorPin(key,value)).toEqual(expected));
 it('does not materialize absent or inherited defaults but retains explicit local None/false',()=>{
  expect(importAuthorResizePins(undefined,id(1),id(2))).toEqual({});
  const r=fixture();expect(read(r)).toEqual({});
  r.fields[0]=local(106,0);r.fields[3]=local(109,false);
  expect(read(r)).toEqual({pinHorizontal:'none',fixedWidth:false});
 });
 it('retains supported inherited nondefaults without promoting an inactive local slot',()=>{
  const r=fixture();r.fields[0]={key:106,value:256,rawDoaName:106|0xc0000000,source:{kind:'cached-matched-base',styleId:id(3),libraryId:id(0)}};
  r.inactive=[{key:106,value:0,rawDoaName:106|0x80000000}];
  expect(read(r)).toEqual({pinHorizontal:'center'});
 });
 it('revalidates unlinked direct style fallback separately from identified cached inheritance',()=>{
  const r:any=fixture();r.cacheChainComplete=false;r.unlinkedStyle={all:false,matchInfoAbsent:true,basePropertyAbsent:true};
  r.fields[0]=local(106,1);expect(read(r)).toEqual({pinHorizontal:'left'});
  r.fields[1]={key:107,value:2,rawDoaName:107|0xc0000000,source:{kind:'cached-document-default',styleId:id(3),libraryId:id(0)}};
  expect(()=>read(r)).toThrow();
 });
 it.each(['extra','wrong-source','wrong-style','wrong-version','incomplete-chain','missing-field','duplicate-field','reorder','invalid-value','bad-flags','inactive-active','inactive-duplicate','default-spoof','local-inactive-conflict','unknown-origin','cache-id'] as const)('rejects altered proof %s atomically',kind=>{
  const r:any=fixture();r.fields[0]=local(106,4);
  if(kind==='extra')r.extra=true;if(kind==='wrong-source')r.sourceId=id(3);if(kind==='wrong-style')r.styleId=id(4);
  if(kind==='wrong-version')r.packageVersion=[12,0,0,0];if(kind==='incomplete-chain')r.cacheChainComplete=false;
  if(kind==='missing-field')r.fields.pop();if(kind==='duplicate-field')r.fields[1]=r.fields[0];if(kind==='reorder')r.fields.reverse();
  if(kind==='invalid-value')r.fields[0].value=257;if(kind==='bad-flags')r.fields[0].rawDoaName=106|0x80000000;
  if(kind==='inactive-active')r.inactive=[{key:107,value:0,rawDoaName:107|0xc0000000}];
  if(kind==='inactive-duplicate')r.inactive=Array(2).fill({key:107,value:0,rawDoaName:107|0x80000000});
  if(kind==='default-spoof')r.fields[2].value=true;
  if(kind==='local-inactive-conflict')r.inactive=[{key:106,value:0,rawDoaName:106|0x80000000}];
  if(kind==='unknown-origin')r.fields[0].source.kind='paint-state';
  if(kind==='cache-id')r.fields[0].source={kind:'cached-matched-base',styleId:'not-guid',libraryId:id(0)};
  expect(()=>read(r)).toThrow();
 });
 it('saves sparse named-view pin fields independently of visual fields and revalidates worker projection',()=>{
  const p=(key:number,value:unknown)=>({rawDoaName:key|0xc0000000,value});
  const r:any={schema:1,status:'decoded-adaptive-styles',sourceId:id(1),entries:[{viewId:id(4),styleId:id(5),status:'supported-local-adaptive-style',
   patch:{style:{pinHorizontal:'center',fixedWidth:false,underline:true}},source:{kind:'native-local-adaptive-style',packageVersion:[11,0,0,0],properties:[p(106,256),p(109,false),p(5,true)],stateStyleSources:[]}}]};
  const importView=()=>[...importAdaptiveStyles(r,2,id(1),createWidget('box'),()=>{}).values()][0];
  expect(importView()).toEqual(r.entries[0].patch);
  r.entries[0].patch.style.fixedWidth=true;expect(importView).toThrow(/投影/);
 });
 it.each([[106,999,0x80000000],[109,1,0x80000000],[106,0,0xd0000000]])('rejects malformed adaptive source P%s even when its projection is empty',(key,value,flags)=>{
  const r={schema:1,status:'decoded-adaptive-styles',sourceId:id(1),entries:[{viewId:id(4),styleId:id(5),status:'supported-local-adaptive-style',patch:{},
   source:{kind:'native-local-adaptive-style',packageVersion:[11,0,0,0],properties:[{rawDoaName:key|flags,value}],stateStyleSources:[]}}]};
  expect(()=>importAdaptiveStyles(r,2,id(1),createWidget('box'),()=>{})).toThrow();
 });
 it('retains actual imported member and Layer pins through save/reopen',()=>{
  const semantics=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`
    import fs from 'node:fs';import{inspectRpSemantics}from'./research/scripts/read-rp-semantics.mjs';
    const sample=JSON.parse(fs.readFileSync('research/native-layers-format-census.json','utf8')).samples.find(s=>s.file.endsWith('Sample form patterns.rplib'));
    const r=inspectRpSemantics(sample.file);r.diagrams=r.diagrams.filter(d=>d.packageId==='d6160e6bca3a49fea2de31d17f1fba94');delete r.pageTreeRecovery;
    process.stdout.write(JSON.stringify(r));
  `],{encoding:'utf8',maxBuffer:4*1024*1024}));
  // The real carrier already proves hierarchy, source IDs and flags. Make an
  // explicitly synthetic pin variant to exercise all four saved declarations.
  const layer=semantics.diagrams[0].widgets[0];
  layer.layerRecovery.localProperties=layer.layerRecovery.localProperties.filter((p:any)=>![106,107,108,109].includes(p.key));
  for(const [key,value]of [[106,256],[107,10],[108,true],[109,false]])layer.layerRecovery.localProperties.push({key,value,rawDoaName:Number(key)|0xc0000000});
  const result=importRpSemantics(semantics),group=result.document.pages[0].widgets[0];
  expect(group.type,JSON.stringify(result.report.issues.filter(i=>i.severity==='skipped'))).toBe('layer');
  expect(group.style).toMatchObject({pinHorizontal:'center',pinVertical:'both',fixedHeight:true,fixedWidth:false});
  expect(result.document.pages[0].widgets).toHaveLength(1);
  expect(group.layer?.widgets).toHaveLength(2);
  expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
 });
});
