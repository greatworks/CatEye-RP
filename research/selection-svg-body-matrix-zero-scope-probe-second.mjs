// Extend the frozen matrix interpreter with the actual ordinary angle-zero scope.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const base='research/selection-svg-body-matrix-probe.mjs';
assert.equal(sha(base),'2d10d7af4e4404f2d6cd34005a924c8d0c6cbc7ccdb9acf5d051ecd470ad6b51');
const extra=['research/adaptive-placement-authoring-owner-cil.json','research/selection-svg-body-matrix-upstream-check-cil.json','research/selection-svg-body-matrix-zero-rotation-cil.json','research/selection-svg-body-matrix-rotation-math-cil.json','research/selection-svg-body-matrix-zero-scope-bridge-cil.json'];
let code=fs.readFileSync(base,'utf8').split('const results=[];')[0];
code=code.replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href));
code=code.replace('const methods=new Map();',`files.push(...${JSON.stringify(extra)}); const methods=new Map();`);
code=code.replace('const genericAliases=', 'memberAliases.set(100721065,100723594);memberAliases.set(100721067,100723580);const genericAliases=');
code=code.replace("if(op==='ldsfld'){", "if(op==='ldsfld'&&n===67134719){s.push(point(0,0));continue;} if(op==='ldsfld'){");
code=code.replace('if(n===100721934||n===100721936)', "if(n===167784567||n===167784568){s.push(n===167784567?Math.sin(pop()):Math.cos(pop()));continue;} if(n===100721941&&construct){const y=pop(),x=pop();s.push(point(x,y));continue;} if(n===100721934||n===100721936)");
code=code.replace('assert.ok(r?.__ref);r.object[r.key]=copy(v);', 'if(r?.__ref)r.object[r.key]=copy(v);else Object.assign(r,copy(v));');
code+='\nexport {run,graphics,point,components,multiply,callback,files}; export const getTrace=()=>trace.slice(); export const resetTrace=()=>{trace=[];};';
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const results=[];
try {
 for(const [cx,cy,ox,oy] of [[120,82,100,72],[.5,1.25,0,0],[-40.5,-80.25,-25,-7],[200,100,186,72]]) {
  api.resetTrace();const g=api.graphics(),center=api.point(cx,cy),origin=api.point(ox,oy);
  const rotationScope=api.run(100695624,[g,center,0]);
  assert.equal(g.bHJ5.XHJn.length,3);
  const zeroScope=api.components(api.run(100723595,[g]));assert.deepEqual(zeroScope,[1,0,0,1,0,0]);
  const indicatorScope=api.run(100720505,[g,origin,1,NaN]);
  const inner=api.run(100723595,[g]);api.run(100723479,[g,origin]);const outer=api.run(100723482,[g]);
  const net=api.components(api.multiply(outer,inner));assert.deepEqual(net,[1,0,0,1,0,0]);
  api.callback(indicatorScope);assert.equal(g.bHJ5.XHJn.length,3);assert.deepEqual(api.components(api.run(100723595,[g])),[1,0,0,1,0,0]);
  api.callback(rotationScope);assert.equal(g.bHJ5.XHJn.length,0);assert.deepEqual(api.components(api.run(100723595,[g])),[1,0,0,1,0,0]);
  results.push({center:[cx,cy],origin:[ox,oy],angle:0,zeroScope,inner:api.components(inner),outer:api.components(outer),net,restoredCommandCount:g.bHJ5.XHJn.length,trace:api.getTrace(),passed:true});
 }
 const output=process.argv[2]??'research/selection-svg-body-matrix-zero-scope-probes-second.json';
 assert(/^research\/selection-svg-body-matrix-[a-z0-9-]+\.json$/.test(output));
 fs.writeFileSync(output,JSON.stringify({mode:'Retained CIL ordinary zero-angle scope plus indicator and restore replay; no target assembly execution',passed:results.length,results,sources:[base,...api.files,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json','research/selection-svg-body-matrix-zero-scope-probe-second.mjs'].map(path=>({path,sha256:sha(path)})),addedFacades:['System.Math.Sin/Cos; only angle zero is asserted','Point zero static and constructor value shape; geometry x/y getters retain existing primitive facades'],limits:['Retained original matrix arithmetic and source control are executed in JS interpreter','Ordinary angle0 only; arbitrary rotations and exception disposal remain outside scope']},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output,passed:results.length,sha256:sha(output)}));
} catch(error) {
 const output='research/selection-svg-body-matrix-zero-scope-failure-second.json';
 fs.writeFileSync(output,JSON.stringify({error:String(error.stack),trace:api.getTrace(),probeSha256:sha('research/selection-svg-body-matrix-zero-scope-probe-second.mjs')},null,2)+'\n',{flag:'wx'});console.error(error.message);process.exitCode=1;
}
