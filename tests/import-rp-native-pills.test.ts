import {it,expect} from 'vitest';
import fs from 'node:fs';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{importRpSemantics}from'../src/model/import-rp';import{parseDocument,serializeDocument}from'../src/model/document';import type{Widget}from'../src/model/types';
const inventory=JSON.parse(fs.readFileSync('research/native-pills-format-inventory.json','utf8'));
const walk=(ws:Widget[]):Widget[]=>ws.flatMap(w=>[w,...walk(w.layer?.widgets??[]),...walk((w.states??[]).flatMap(s=>s.widgets)),...walk(w.table?.cells??[]),...walk(w.menu?[w.menu.table,...w.menu.submenus]:[]),...walk(w.tree?.nodes??[]),...walk(w.treeNode?[w.treeNode.label,...w.treeNode.children]:[]),...walk(w.repeater?.template??[])]);
it('real native Form bytes ->26 semantic pills and18 complete-document boxes, preserving parent and repeater boundaries',()=>{
 const owners=inventory.owners.filter((w:any)=>w.observed.vertexCounts[0]===6),sample=inventory.samples.find((s:any)=>s.file.endsWith('Sample form patterns.rplib'));
 const before=createHash('sha256').update(fs.readFileSync(sample.file)).digest('hex');expect(before).toBe(sample.sha256);
 const script="import {inspectRpSemantics} from './research/scripts/read-rp-semantics.mjs';process.stdout.write(JSON.stringify(inspectRpSemantics(process.argv[1])));";
 const semantic=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script,sample.file],{encoding:'utf8',maxBuffer:64*1024*1024})),result=importRpSemantics(semantic),all=walk(result.document.pages.flatMap(p=>p.widgets));
 const expectedIds=['d515a37dfd114af6877e6c6d4d244032','5daa721c93574f1d839b01bb4b55a1ee','5c5c97a8227146eabd9cd9098079ad51','7f2a0a6fd10b4792af0a11be28ff3025','28b78c258c37474ca5b125f339226042','15b9ab53cd214f55bc79058c981d6b95','f00875b1441848f9adb7c65095cbbb7d','2174b5a9c5a04657bdd8ab6a5d801d27','2e13a71981e946ceb4dfc605f3e5581b','b79d4c74e93d4d17bf40c7a40ceb9f80','a5e34de9148243428e9cd2800d7dc449','fe5999b629db4a93b22734000a2d6cf7','3eb03723a72d44bb96b3442c73e65eca','a5f627ccbb624a4f807e87ab9cdc3fba','cac48a70cfc34ae680fe7d3d6f8e5d68','542f8f76476444928e878a592ac136c3','ed90c63995f141f5996e8e261718c385','fbfea05d6ff548b0a4ab0060602949ca'];
 expect(owners).toHaveLength(28);let imported=0,decoded=0;
 for(const native of owners){
  const source=semantic.diagrams.find((d:any)=>d.packageId===native.packageId)?.widgets.find((w:any)=>w.id===native.sourceId);
  if(['352a543d9a474661860204c8a6dc2846','5289964b3484478faf9e0773fb69366c'].includes(native.sourceId))expect(source).toBeUndefined();
  else{expect(source?.typeCandidate.type).toBe('box');expect(source.styleRecovery.style.radius).toBe(native.effective[71].value);decoded++;}
  const widget=all.find(w=>w.id===`rp-w-${native.packageId}-${native.sourceId}`);
  if(!expectedIds.includes(native.sourceId)){expect(widget).toBeUndefined();continue;}
  imported++;expect(widget).toBeDefined();expect(widget!.type).toBe('box');expect(widget!.style.radius).toBe(native.effective[71].value);expect(widget!.style.cornerVisibility).toEqual([true,true,true,true]);expect(widget!.style.cornerRadii).toBeUndefined();expect(widget!.vectorPath).toEqual(native.vectorPath);expect([widget!.width,widget!.height]).toEqual([native.size.Width,native.size.Height]);
 }
 expect(imported).toBe(18);expect(decoded).toBe(26);
 const oversized=all.find(w=>w.id.endsWith('d515a37dfd114af6877e6c6d4d244032'))!;expect(oversized.style.radius).toBe(5);expect(oversized.height).toBe(6);
 expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);expect(createHash('sha256').update(fs.readFileSync(sample.file)).digest('hex')).toBe(before);
});

