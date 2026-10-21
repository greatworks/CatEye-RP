// New, bounded review supplement. Frozen keys/modifiers evidence is read only.
// Replays retained M1Ei/g3GS/key predicates; GetKeyState/high-bit and Space-field
// values are explicit facades. No original DLL or product code executes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const original='research/selection-input-keys-probe.mjs';
let factory=fs.readFileSync(original,'utf8').split('const cases=[];')[0];
factory+=`
code+=\`
for(const t of JSON.parse(fs.readFileSync('research/selection-pointer-modifiers-snap-entry-cil.json','utf8')).Types)
 for(const m of t.Methods)methods.set(m.Token,{...m,file:'research/selection-pointer-modifiers-snap-entry-cil.json'});
cil(100727662,0);cil(100726678,1);
bind(100731465,1,([vk])=>{context.reads.push(vk);return context.down.includes(vk)?32768:0;});
bind(100731360,1,([r])=>(deref(r)&32768)!==0);
export function platformKeys(down,spaceField){
 context={down,reads:[]};
 const mask=execute(100726677,[{[67136999]:spaceField}]);
 return {mask,reads:context.reads,exactControl:!!execute(100691312,[mask]),shift:!!execute(100691309,[mask])};
}
\`;
export const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
`;
const {api}=await import('data:text/javascript;base64,'+Buffer.from(factory).toString('base64'));
const cases=[];
for(let bits=0;bits<8;bits++)for(const spaceField of [false,true]){
 const down=[16,17,18].filter((_,n)=>bits&(1<<n));
 const observed=api.platformKeys(down,spaceField);
 const expectedMask=(bits&1?65536:0)|(bits&2?131072:0)|(bits&4?262144:0)|(spaceField?1048576:0);
 assert.equal(observed.mask,expectedMask);
 assert.deepEqual(observed.reads,[16,17,18]);
 assert.equal(observed.exactControl,expectedMask===131072);
 cases.push({down,spaceField,observed,passed:true});
}
const sources=[...new Set([...api.inputs,original,'research/selection-pointer-modifiers-snap-entry-cil.json',
 'research/selection-input-host-review-keys-probe.mjs'])].map(path=>({path,sha256:sha(path)}));
const report={kind:'retained original CIL-record review replay; not original process execution',
 summary:{total:cases.length,passed:cases.length,failed:0},sources,cases,
 bindings:[{token:100727662,claim:'M1Ei reads only virtual keys 16,17,18'},
 {token:100726677,claim:'g3GS ORs SpaceModifier1048576 when S3G9 returns true'},
 {token:100726678,claim:'S3G9 returns n1Nh field67136999'},
 {token:100691312,claim:'masked modifiers must equal Control131072 exactly'}],
 facades:['GetKeyState short return values','MIkG high-bit predicate is an explicit arithmetic facade','n1Nh supplied Boolean field'],
 limits:['Physical Space key to n1Nh writer is not proven here','MacControl is not produced by the replayed Windows M1Ei','No grid, geometry, history, browser or original DLL executes']};
fs.writeFileSync('research/selection-input-host-review-keys-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
