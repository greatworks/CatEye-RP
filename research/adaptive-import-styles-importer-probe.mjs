import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadTs} from '../.build/load-ts.mjs';
const {importAdaptiveSets}=await loadTs('src/model/import-rp-adaptive.ts');
const id=n=>n.toString(16).padStart(32,'0'),sha='a'.repeat(64),packageId=id(1),sourceId=id(2),ZERO=id(0);
const source=[{packageId,rootId:sourceId,rootType:'Axure:Page',sourcePartSha256:sha}];
const base={schema:1,status:'decoded-adaptive-sets',baseViewId:'19e82109f102476f933582835c373474',sets:[],pages:[{
 packageId,sourceId,status:'unassigned',setId:ZERO,directSetSourceId:ZERO,provenance:{version:[11,0,0,0],sourcePartSha256:sha}}],diagnostics:[]};
const results=[];
for(const [name,diagnostics]of [['without diagnostic',[]],['actual standalone-value-parts diagnostic',[{scope:'document',code:'standalone-value-parts',reason:'Decoded standalone values contain no object identities; not candidates for adaptive sets',count:3}]]]){
 const issues=[];const result=importAdaptiveSets({...base,diagnostics},source,(...args)=>issues.push(args));
 results.push({name,expectedAssignment:true,actualAssignment:result.assignments.has(packageId),issues});
}
assert.equal(results[0].actualAssignment,true);
const output=process.argv[2]??'research/adaptive-import-styles-importer-probe.json';
const hashes=['src/model/import-rp-adaptive.ts','research/scripts/read-rp-adaptive.mjs','research/adaptive-import-styles-importer-probe.mjs','.build/load-ts.mjs'].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')}));
const report={method:'Independent product protocol reproduction, not original Axure execution',results,sources:hashes,ok:results.every(r=>r.actualAssignment===r.expectedAssignment)};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
