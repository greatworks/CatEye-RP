import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {makeSyntheticAdaptiveRp,IDS} from './synthetic-rp-adaptive-fixture.mjs';
import {inspectRpObjects} from '../research/scripts/read-rp-objects.mjs';
import {inspectRpSemantics} from '../research/scripts/read-rp-semantics.mjs';
import {encodeSyntheticRpContainer} from './synthetic-rp-object-carrier.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const map=value=>({$map:Object.entries(value)}),ref=value=>({$reference:value,referenceTag:3}),guid=value=>({$guid:value});
const get=(object,key)=>object.$map.find(([name])=>name===key)?.[1];
const put=(object,key,value)=>{const pair=object.$map.find(([name])=>name===key);if(pair)pair[1]=value;else object.$map.push([key,value]);};
const prop=(key,value)=>map({DOAName:key|0xc0000000,Value:value});

/** Independently encoded raw test carrier, never saved or accepted by Axure.
 * Native P111 is BoolOverride (1=TRUE,2=FALSE), not a Boolean payload.
 */
export function makeSyntheticPlacementRp(){
  const base=makeSyntheticAdaptiveRp(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'rea-placement-carrier-'));
  const file=path.join(directory,'base.rp');let packages;
  try{fs.writeFileSync(file,base.bytes);packages=inspectRpObjects(file).packages;}
  finally{if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(directory);}
  const pack=packages.find(p=>p.packageId===IDS.pagePackage),find=id=>{const object=pack.objects.find(o=>o.id===id);if(!object)throw Error(`Missing fixture object ${id}`);return object;};
  const setProp=(style,key,value)=>{const list=get(style.properties,'PropList'),prior=list.find(p=>(get(p,'DOAName')&0xfffffff)===key);if(prior)put(prior,'Value',value);else list.push(prop(key,value));};
  const target=find(IDS.target),orphan=find(IDS.orphan);
  setProp(find(get(target.properties,'MyStyle').$reference),111,1);
  const adaptive=get(target.properties,'AdaptiveStyles');
  setProp(find(adaptive[1].$reference),111,2);
  setProp(find(adaptive[3].$reference),111,1);
  setProp(find(get(orphan.properties,'MyStyle').$reference),111,2);
  const orphanPhoneStyle='fb000000000000000000000000000001';
  if(pack.objects.some(o=>o.id===orphanPhoneStyle))throw Error('Synthetic placement ID collision');
  pack.objects.push({id:orphanPhoneStyle,type:'Axure:Style',properties:map({All:false,PropList:[prop(111,1)]})});
  get(orphan.properties,'AdaptiveStyles').push(guid(IDS.phone),ref(orphanPhoneStyle));
  const bytes=encodeSyntheticRpContainer(packages);
  return {bytes,manifest:{synthetic:true,description:'SYNTHETIC raw placement carrier; independently encoded, not saved/validated by Axure, not native write-back support.',source:base.manifest.source,parentSyntheticSha256:hash(base.bytes),ids:IDS,expected:{target:{base:{placed:true},tablet:{placed:false},phone:{placed:true}},orphan:{base:{placed:false},tablet:{placed:false},phone:{placed:true}}},rawSha256:hash(bytes)}};
}

export function writeSyntheticPlacementRp(directory='.build/adaptive-placement-fixture'){
  fs.mkdirSync(directory,{recursive:true});const {bytes,manifest}=makeSyntheticPlacementRp();
  const file=path.resolve(directory,'SYNTHETIC-placement.raw.rp');fs.writeFileSync(file,bytes);
  const semantics=inspectRpSemantics(file),semanticsFile=path.join(directory,'semantics.json');fs.writeFileSync(semanticsFile,JSON.stringify(semantics,null,2)+'\n');
  manifest.output=file;manifest.semanticsSha256=hash(fs.readFileSync(semanticsFile));
  fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return {file,manifest,semantics};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=writeSyntheticPlacementRp(process.argv[2]);console.log(JSON.stringify({file:result.file,sha256:result.manifest.rawSha256,semanticFailures:result.semantics.semanticFailures},null,2));}
