import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeSyntheticObjectPackage, encodeSyntheticRpContainer } from '../../scripts/synthetic-rp-object-carrier.mjs';
import { readObjectPackage, inspectRpObjects } from './read-rp-objects.mjs';

const guid='1234567890abcdef1234567890abcdef',zero='0'.repeat(32);
const fixture=()=>({path:'sample/package',version:[11,0,0,0],rootId:guid,packageId:'abcdef0123456789abcdef0123456789',objects:[{id:guid,type:'Fixture',properties:{$map:[
  ['Unicode 文本','hello 世界'],['numbers',[0,-2147483648,2147483647,1.25]],['flags',[false,true]],
  ['nonfinite',[{$number:'NaN',numberTag:6},{$number:'Infinity',numberTag:7}]],['wide',{$int64:'9223372036854775807'}],
  ['guids',[{$guid:guid},{$guid:zero}]],['refs',[3,16,19,20,21,22].map(referenceTag=>({$reference:guid,referenceTag,...([16,19].includes(referenceTag)?{name:'ref'}:{})}))],
  ['named',{$namedValue:'n',properties:{$map:[]}}],['plugin',{$pluginValue:'p',prefix:'pre',properties:{$map:[['a',true]]}}],
  ['null-string',null],['null-ref-name',{$reference:zero,referenceTag:16,name:null}],
]}}]});

test('independently encoded object carriers round-trip mixed byte-order GUIDs and admitted value tags',()=>{
  const f=fixture(),decoded=readObjectPackage(encodeSyntheticObjectPackage(f));
  assert.equal(decoded.rootId,f.rootId);assert.equal(decoded.packageId,f.packageId);
  assert.deepEqual(decoded.objects.map(({offset,...o})=>o),f.objects);
});
test('independent gzip/index carrier follows the actual container and object readers',()=>{
  const folder=mkdtempSync(join(tmpdir(),'rea-synthetic-carrier-'));
  try{const f=fixture(),file=join(folder,'synthetic.rp');writeFileSync(file,encodeSyntheticRpContainer([f]));
    const decoded=inspectRpObjects(file);assert.equal(decoded.packages.length,1);assert.equal(decoded.packages[0].path,f.path);
    assert.deepEqual(decoded.packages[0].objects.map(({offset,...o})=>o),f.objects);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
test('fixture encoder rejects unknown/opaque values and unsafe or duplicate part names',()=>{
  for(const value of [undefined,{$bytes:{offset:0,length:1}},{$reference:guid,referenceTag:4},{$reference:guid,referenceTag:16}]){
    const f=fixture();f.objects[0].properties.$map.push(['bad',value]);assert.throws(()=>encodeSyntheticObjectPackage(f));
  }
  for(const path of ['../package','a/__proto__/package','a//package'])assert.throws(()=>encodeSyntheticRpContainer([{...fixture(),path}]));
  assert.throws(()=>encodeSyntheticRpContainer([fixture(),fixture()]));
});
