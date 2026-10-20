// Independent, read-only product comparison against frozen source-derived data.
// No build, browser, original DLL invocation or product file mutation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from 'vite';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const sha=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const pin=path=>({path,sha256:sha(path)});
const output=process.argv[2]??'research/native-point-contours-integration-review-probe.json';
assert(/^research\/native-point-contours-integration-review-[a-z0-9-]+\.json$/.test(output));
assert(!fs.existsSync(output),`Preserve prior evidence: ${output} already exists`);
const productFiles=['src/model/vector-commit.ts','src/model/vector-contours.ts','src/model/vector-editing.ts','src/model/vector.ts','src/model/vector-authoring.ts','src/model/adaptive.ts','src/components/CanvasVectorTools.tsx','src/components/Inspector.tsx','src/App.tsx'];
const sourceHashes=productFiles.map(pin),results=[];
const evidencePaths=['research/native-point-contours-rotation-evidence.json','research/native-point-contours-rotation-fixtures.json','research/native-point-contours-topology-probes.json'];
const evidenceHashes=evidencePaths.map(pin);
const near=(a,b,label)=>{assert(Number.isFinite(a),`${label} not finite`);assert(Math.abs(a-b)<=1e-9,`${label}: ${a} != ${b}`)};
const nearObject=(a,b,label)=>{for(const [k,v] of Object.entries(b)) typeof v==='number'?near(a[k],v,`${label}/${k}`):assert.equal(a[k],v,`${label}/${k}`)};
const nearPath=(a,b)=>{assert.equal(a.fillRule,b.fillRule);assert.equal(a.commands.length,b.commands.length);b.commands.forEach((c,i)=>nearObject(a.commands[i],c,`command ${i}`))};
const check=(name,fn)=>{try{results.push({name,passed:true,...fn()})}catch(e){results.push({name,passed:false,message:e.message,stack:e.stack})}};
const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',server:{middlewareMode:true},appType:'custom'});
try{
 const {commitVectorGeometry}=await server.ssrLoadModule('/src/model/vector-commit.ts');
 const {createWidget}=await server.ssrLoadModule('/src/model/document.ts');
 const fixtures=read(evidencePaths[1]);
 assert.equal(fixtures.fixtureCount,64);
 for(const f of fixtures.fixtures)check(`rotation oracle ${f.name}`,()=>{
  const polygon=f.input.closed;
  const path={fillRule:'evenodd',commands:polygon?[{op:'M',x:-.25,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]:[{op:'M',x:0,y:0},{op:'C',x1:0,y1:-1,x2:1,y2:0,x:1,y:1}]};
  const widget={...createWidget('path'),...f.input.owner,rotation:f.input.effectiveRotation};widget.style.strokeWidth=f.input.strokeWidth;
  const before=JSON.stringify({widget,path}),actual=commitVectorGeometry(widget,path),ps=f.expected.normalizedPoints;
  const expected={fillRule:'evenodd',commands:polygon?[...ps.map((p,i)=>({op:i?'L':'M',...p})),{op:'Z'}]:[{op:'M',...ps[0]},{op:'C',x1:ps[1].x,y1:ps[1].y,x2:ps[2].x,y2:ps[2].y,...ps[3]}]};
  nearObject(actual.bounds,f.expected.owner,'bounds');nearPath(actual.vectorPath,expected);
  assert.equal(JSON.stringify({widget,path}),before,'input mutation');
  return {angle:f.input.effectiveRotation,expectedRoute:f.expected.route,bounds:actual.bounds};
 });
 const topology=read(evidencePaths[2]);
 for(const f of topology.authoredFixtures)check(`topology oracle ${f.name}`,()=>{
  const widget={...createWidget('path'),...f.frame,rotation:f.frame.angle};widget.style.strokeWidth=f.stroke;
  const path={fillRule:'nonzero',commands:f.commands},before=JSON.stringify({widget,path}),actual=commitVectorGeometry(widget,path);
  let contour=-1,index=0;
  const commands=path.commands.map(command=>{
   if(command.op==='Z')return {op:'Z'};
   if(command.op==='M'){contour++;index=0}else index++;
   const cp=f.expectedPoints[contour][index];
   if(command.op!=='C')return {op:command.op,...cp.g5Eq};
   const prior=f.expectedPoints[contour][index-1];return {op:'C',x1:prior.a5EO.x,y1:prior.a5EO.y,x2:cp.E5Ed.x,y2:cp.E5Ed.y,...cp.g5Eq};
  });
  nearObject(actual.bounds,f.expectedOwner,'bounds');nearPath(actual.vectorPath,{fillRule:path.fillRule,commands});assert.equal(JSON.stringify({widget,path}),before);
  return {bounds:actual.bounds,contours:f.expectedPoints.length};
 });
 const stable=productFiles.every((p,i)=>sha(p)===sourceHashes[i].sha256)&&evidencePaths.every((p,i)=>sha(p)===evidenceHashes[i].sha256);
 const report={schema:1,capturedAt:new Date().toISOString(),kind:'read-only Vite SSR product comparison; no original GUI/DLL execution',sourceHashes,evidenceHashes,probe:pin('research/native-point-contours-integration-review-probe.mjs'),sourceStableDuringRun:stable,checks:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},results,limits:['Rotation fixture numbers are source-derived independent composition, not complete vendor transaction execution.','Topology fixtures use the declared product M/L/C/Z adapter; unavailable native inactive handles are not reconstructed.','This probe does not exercise browser pointer/history UI, runtime rendering, or general transform providers.']};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,...report.checks,sourceStableDuringRun:stable}));
 if(!stable||report.checks.failed)process.exitCode=1;
}finally{await server.close()}
