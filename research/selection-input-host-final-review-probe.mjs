// Read-only integration check of actual product modules, against frozen source
// observations. Text measurement remains the same explicit constant facade.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const inputs=['src/App.tsx','src/runtime/selection-pointer-session.ts','src/model/selection-pointer-input.ts',
 'src/model/selection-pointer-resize.ts','src/model/selection-layout.ts','src/model/author-resize-solver.ts'];
const sources=inputs.map(path=>({path,sha256:sha(path)}));
const oracle=read('research/selection-input-grid-live-session-probes.json');
const results=[];
const numeric=(actual,expected,path='')=>{
 if(typeof expected==='number')assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-8,`${path}: ${actual} != ${expected}`);
 else if(expected&&typeof expected==='object')for(const key of Object.keys(expected))numeric(actual[key],expected[key],path+'.'+key);
 else assert.deepEqual(actual,expected,path);
};
const server=await createServer({configFile:false,logLevel:'error',appType:'custom',
 cacheDir:'.build/selection-input-host-final-review-cache',server:{middlewareMode:true,watch:null},
 optimizeDeps:{noDiscovery:true,include:[]}});
try{
 const {createSelectionPointerSession}=await server.ssrLoadModule('/src/runtime/selection-pointer-session.ts');
 const input=await server.ssrLoadModule('/src/model/selection-pointer-input.ts');
 const resize=await server.ssrLoadModule('/src/model/selection-pointer-resize.ts');
 const service=oracle.service;
 const union=(a,b)=>{const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};};
 const targets=service.rects.map((r,n)=>({id:'control-'+n,type:n?'radio':'checkbox',input:{
   ownerRect:{...r},textPanelRect:{...service.panel},coordinateContext:{kind:'translation',ownerRotation:0,textRotation:0,locationInDiagram:{x:r.x,y:r.y}},
   rawFit:{width:service.widthFit,height:service.heightFit},effectiveFit:{width:service.widthFit,height:service.heightFit},
   alignRight:false,empty:false,guard:false,padding:[0,0,0,0],indicatorSize:service.buttonSize,horizontalAlignment:'left',verticalAlignment:'top'},
   services:{measureText:()=>({...service.measurements[0]}),readMinimumSize:()=>({width:1,height:1}),
     convertIndicatorInset:()=>({width:2,height:2}),unionRectangles:union}}));
 const create=()=>{
   const preparedResize=resize.prepareSelectionPointerResize(targets,service.handle);
   const preparedInput=input.prepareSelectionPointerInput({targetCount:targets.length,handle:service.handle,
     freedom:preparedResize.original.freedom,initialModifiers:{control:false,alt:false,shift:true},
     initialHotzonePoint:input.selectionPointerHotzonePoint(preparedResize.original.selectionRect,service.handle),
     grid:{enabled:true,spacing:{width:8,height:8},tolerance:5}});
   return {prepared:{resize:preparedResize.original,input:preparedInput},state:preparedResize.state};
 };
 // Real session delays preparation, copies the raw request, replays both in
 // order, consumes live corrected owner bounds, and release adds no frame.
 let resolve,visible,completion,rollback=0;
 const wait=new Promise(done=>{resolve=done;});
 const planned=[],published=[];
 const session=createSelectionPointerSession({prepare:()=>wait,isCurrent:()=>true,
   plan:(prepared,state,request)=>{
     const bounds=input.selectionPointerBounds(state.targets.map(t=>t.layout.ownerRect));
     const projected=input.planSelectionPointerInput(prepared.input,{absolutePoint:request.point,currentBounds:bounds,modifiers:request.modifiers});
     assert.equal(projected.ok,true,projected.reason);
     const next=resize.planSelectionPointerResize(prepared.resize,state,{delta:projected.delta,modifiers:projected.layoutModifiers});
     assert.equal(next.ok,true,next.reason);
     planned.push({request:structuredClone(request),bounds,projected,owners:next.state.targets.map(t=>t.layout.ownerRect)});
     return next.state;
   },publish:state=>{visible=state;published.push(state);},complete:state=>{completion=state;},
   rollback:()=>rollback++,failed:error=>{throw error;}});
 const first={point:{x:736,y:124},modifiers:{control:false,alt:false,shift:true}};
 session.update(first);first.point.x=999;first.modifiers.alt=true;
 session.update({point:{x:752,y:125},modifiers:{control:false,alt:false,shift:true}});
 session.finish();assert.equal(session.phase,'finishing');assert.equal(planned.length,0);
 resolve(create());assert.equal((await session.done).status,'completed');
 assert.equal(planned.length,2);assert.equal(published.length,1);assert.equal(rollback,0);assert.equal(visible,completion);
 numeric(planned[0].projected.delta,oracle.first.delta);numeric(planned[0].owners,oracle.firstOwners.map(w=>w.rect));
 numeric(planned[1].bounds,oracle.liveBounds);numeric(planned[1].projected.delta,oracle.secondLive.delta);
 numeric(planned[1].owners,oracle.liveOwners.map(w=>w.rect));
 assert.notDeepEqual(planned[1].projected.delta,oracle.secondStale.delta);
 assert.deepEqual(planned[0].request.modifiers,{control:false,alt:false,shift:true});
 results.push({name:'queued raw points with live owner bounds match source two-frame composition',passed:true,planned,
   publications:published.length,completeCalls:1,releaseAddedFrames:0,sourceStaleCounterfactual:oracle.secondStale.delta});

 // A second-frame error must discard the entire unpublished preparation batch.
 let ready,failed=0,publishes=0,rollbacks=0,plans=0;
 const pending=new Promise(done=>{ready=done;});
 const bad=createSelectionPointerSession({prepare:()=>pending,isCurrent:()=>true,plan:(_p,s)=>{if(++plans===2)throw Error('controlled second-frame failure');return s;},
   publish:()=>publishes++,complete:()=>{throw Error('must not complete');},rollback:()=>rollbacks++,failed:()=>failed++});
 bad.update({point:{x:1,y:1},modifiers:{control:false,alt:false,shift:false}});
 bad.update({point:{x:2,y:2},modifiers:{control:false,alt:false,shift:false}});bad.finish();ready(create());
 assert.equal((await bad.done).status,'failed');assert.equal(plans,2);assert.equal(publishes,0);assert.equal(rollbacks,1);assert.equal(failed,1);
 results.push({name:'failure in queued preparation batch rolls back without partial publication',passed:true,plans,publishes,rollbacks,failed});

 // A captured native rotation mode remains rejected after Ctrl is released.
 const captured=input.prepareSelectionPointerInput({targetCount:2,handle:4,freedom:1,
   initialModifiers:{control:true,alt:false,shift:false},initialHotzonePoint:{x:630,y:109.5},
   grid:{enabled:false,spacing:{width:8,height:8},tolerance:5}});
 assert.equal(captured.mode,'rotate');
 const rejected=input.planSelectionPointerInput(captured,{absolutePoint:{x:736,y:110},currentBounds:service.selectionRect,
   modifiers:{control:false,alt:false,shift:false}});
 assert.equal(rejected.ok,false);assert.match(rejected.reason,/rotation/);
 results.push({name:'initial exact-Control rotation mode is not reselected from later modifiers',passed:true,rejected});
 for(const source of sources)assert.equal(sha(source.path),source.sha256,'source changed during review: '+source.path);
 const evidence=['research/selection-input-grid-live-session-probes.json','research/selection-input-keys-evidence.json',
   'research/selection-input-grid-evidence.json','research/selection-input-host-final-review-probe.mjs'].map(path=>({path,sha256:sha(path)}));
 const report={kind:'read-only actual product module/session integration; controlled services and frozen original-CIL numerical observations',
   originalDllExecuted:false,originalGuiCompared:false,browserStarted:false,productEdited:false,
   summary:{total:results.length,passed:results.length,failed:0},sources,evidence,sourceStable:true,results,
   limits:['App event handlers are separately read-only reviewed, not executed by this Node probe',
     'Constant text metrics, minimum1x1 and CSS inset2 are explicit service inputs',
     'No real browser pointer capture, fonts, OS keyboard state or original native graphics executes']};
 fs.writeFileSync('research/selection-input-host-final-review-probes.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({summary:report.summary,sources,sourceStable:true}));
}finally{await server.close();}
