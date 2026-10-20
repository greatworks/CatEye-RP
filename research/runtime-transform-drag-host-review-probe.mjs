import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {bindRuntimeDrag} from '../src/runtime/drag-input.ts';
import {createOfflineRuntime} from '../src/runtime/export-runtime.ts';
import {evaluateExpression} from '../src/runtime/expressions.ts';
const root=path.resolve(import.meta.dirname,'..'),hash=v=>createHash('sha256').update(v).digest('hex');
const paths=['src/runtime/drag-input.ts','src/components/Preview.tsx','src/runtime/export-runtime.ts'];
const source=Object.fromEntries(paths.map(p=>[p,fs.readFileSync(path.join(root,p),'utf8')]));
const before=paths.map(p=>({path:p,sha256:hash(source[p])}));
const previewLine=source[paths[1]].split('\n').find(s=>s.includes('session.subscribe('));
const offlineLine=source[paths[2]].split('\n').find(s=>s.includes('const schedule ='));
assert.ok(previewLine&&offlineLine);
class Surface{listeners=new Map();addEventListener(n,l){const s=this.listeners.get(n)||new Set();s.add(l);this.listeners.set(n,s)}removeEventListener(n,l){this.listeners.get(n)?.delete(l);if(!this.listeners.get(n)?.size)this.listeners.delete(n)}emit(n,e={}){for(const l of [...this.listeners.get(n)||[]])l(e)}}
const ev=(target,touch=false,x=10,y=20)=>({target,pageX:x,pageY:y,...(touch?{changedTouches:[{pageX:x,pageY:y}]}:{}),prevented:false,preventDefault(){this.prevented=true},stopPropagation(){},stopImmediatePropagation(){}});
const task=(event,actions=[])=>({id:'event-'+event,name:event,event,enabled:true,conditions:[],conditionMode:'all',actions:actions.map((a,i)=>({id:'action'+i,...a}))});
// Minimal independent fixture records, not a parser/import test. Direct TS
// module loads avoid a dev server and leave all browser/build slots untouched.
let serial=0;
const createWidget=type=>({id:'w'+(++serial),type,name:type,text:'',x:100,y:100,width:180,height:90,rotation:0,style:{fill:'#fff',stroke:'#000',strokeWidth:1,radius:0,color:'#000',fontFamily:'Arial',fontSize:14,fontWeight:400,textAlign:'left',opacity:1},hidden:false,locked:false,disabled:false,notes:'',interactions:[]});
const createPage=(name='Page')=>({id:'p'+(++serial),name,width:1200,height:900,background:'#fff',widgets:[],notes:'',interactions:[],adaptiveViews:[]});
const createDocument=()=>({format:'rea-prototype',version:1,id:'doc'+(++serial),name:'Probe',caseSelection:'never',pages:[createPage()],components:[],variables:{},styles:[]});
const results=[],boundaries=[];
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
function fixture(host,portable,row=false){
 const doc=createDocument(),box=createWidget('box'),other=createWidget('box');box.interactions=[task('drag')];other.interactions=[task('drag')];
 const next=createPage('Next');next.widgets=[other];doc.pages.push(next);
 let repeater;if(row){repeater=createWidget('repeater');repeater.repeater={columns:['Name'],rows:[{Name:'a'},{Name:'b'}],itemHeight:30,gap:0,template:[box]};doc.pages[0].widgets=[repeater]}else doc.pages[0].widgets=[box];
 const runtime=createOfflineRuntime(doc,undefined,evaluateExpression),window=new Surface(),document=Object.assign(new Surface(),{defaultView:window,body:{style:{cursor:'auto'}}});
 const element={style:{cursor:'pointer'},isConnected:true},errors=[];
 const bind=portable?runInNewContext('('+bindRuntimeDrag.toString()+')'):bindRuntimeDrag;
 const drag=bind(document,runtime,e=>errors.push(String(e)));
 if(host==='preview'){
  const callback=previewLine.slice(previewLine.indexOf('session.subscribe(')+'session.subscribe('.length,previewLine.lastIndexOf(');'));
  runtime.subscribe(Function('drag','session','setRuntime','structuredClone','return ('+callback+')')(drag,runtime,()=>{},structuredClone));
 }else{
  const callback=offlineLine.trim().replace(/^const schedule = /,'').replace(/;$/,'');
  runtime.subscribe(Function('drag','runtime','queueMicrotask','let renderPending=false;const safeRender=()=>{renderPending=false};return ('+callback+')')(drag,runtime,queueMicrotask));
  // Exact mount hook, manually dispatched PageTransition event facade.
  window.addEventListener('pagehide',()=>drag.dispose(),{once:true});
 }
 const context=row?runtime.rows(repeater)[0].context:[];
 // Actual Preview/offline first renders the instance, registering its scope.
 runtime.widget(box,context);
 const snapshot=()=>({active:drag.hasActiveDrag(),runtimeStarted:runtime.state().motionState?.drag?.started??false,cursor:document.body.style.cursor,listeners:[...document.listeners.keys()].sort(),pageId:runtime.state().pageId,errors});
 return{doc,box,other,next,repeater,context,runtime,window,document,element,drag,snapshot};
}
async function check(name,fn){try{results.push({name,passed:true,observed:await fn()})}catch(e){results.push({name,passed:false,error:e.stack})}}
try{
 for(const host of ['preview','offline'])for(const portable of [false,true]){
  const prefix=host+'/'+(portable?'serialized':'module');
  await check(prefix+' completed drag keeps click suppression through idle notify',async()=>{const f=fixture(host,portable);try{assert.ok(f.drag.start(ev(f.element),f.box.id,[],f.element,{moveCursor:true}));f.document.emit('mousemove',ev(f.element,false,14,25));await flush();f.document.emit('mouseup',ev(f.element,false,14,25));f.runtime.releasePointerStyles();await flush();const beforeClick=f.snapshot(),click=ev(f.element);f.document.emit('click',click);assert.equal(click.prevented,true);assert.equal(f.drag.hasActiveDrag(),false);return{beforeClick,clickPrevented:click.prevented,after:f.snapshot()}}finally{f.drag.dispose();f.runtime.dispose()}});
  await check(prefix+' page navigation cancels active bridge and permits next source',async()=>{const f=fixture(host,portable);try{f.drag.start(ev(f.element),f.box.id,[],f.element,{moveCursor:true});f.document.emit('mousemove',ev(f.element,false,14,25));await flush();await f.runtime.navigate(f.next.id);await flush();const navigated=f.snapshot();assert.equal(navigated.active,false);assert.equal(navigated.cursor,'auto');assert.ok(!navigated.listeners.includes('mousemove'));assert.ok(f.drag.start(ev(f.element),f.other.id,[],f.element));return{navigated,nextStarted:f.snapshot()}}finally{f.drag.dispose();f.runtime.dispose()}});
  await check(prefix+' row removal cancels active bridge without Drop',async()=>{const f=fixture(host,portable,true);try{assert.ok(f.drag.start(ev(f.element),f.box.id,f.context,f.element,{moveCursor:true}));f.document.emit('mousemove',ev(f.element,false,15,25));await flush();await f.runtime.execute(task('click',[{type:'deleteRow',targetId:f.repeater.id,value:'0'}]));await flush();const after=f.snapshot();assert.equal(after.active,false);assert.equal(after.runtimeStarted,false);assert.equal(after.cursor,'auto');assert.ok(!after.listeners.includes('mousemove'));return after}finally{f.drag.dispose();f.runtime.dispose()}});
  await check(prefix+' touch cancel removes touch listeners and restores cursor',async()=>{const f=fixture(host,portable);try{f.drag.start(ev(f.element,true),f.box.id,[],f.element,{moveCursor:true,preventTouch:true});const moved=ev(f.element,true,17,21);f.document.emit('touchmove',moved);await flush();assert.equal(moved.prevented,true);f.document.emit('touchcancel',{});assert.equal(f.drag.hasActiveDrag(),false);assert.ok(!f.document.listeners.has('touchmove'));assert.equal(f.document.body.style.cursor,'auto');return f.snapshot()}finally{f.drag.dispose();f.runtime.dispose()}});
  await check(prefix+' detached source during Drop does not leak cursor',async()=>{const f=fixture(host,portable);try{f.drag.start(ev(f.element),f.box.id,[],f.element,{moveCursor:true});f.document.emit('mousemove',ev(f.element,false,15,25));await flush();f.element.isConnected=false;f.document.emit('mouseup',ev(f.element));await flush();assert.equal(f.document.body.style.cursor,'auto');return f.snapshot()}finally{f.drag.dispose();f.runtime.dispose()}});
 }
 for(const host of ['preview','offline']){const f=fixture(host,false);try{f.drag.start(ev(f.element),f.box.id,[],f.element,{moveCursor:true});f.document.emit('mousemove',ev(f.element,false,14,25));await flush();f.window.emit('pagehide',{persisted:true});const afterHide=f.snapshot();f.window.emit('pageshow',{persisted:true});const canStart=f.drag.start(ev(f.element),f.box.id,[],f.element);boundaries.push({host,name:'controlled persisted pagehide/pageshow',afterHide,canStartAfterShow:canStart,interpretation:host==='preview'?'No pagehide listener: active bridge remains without unmount/blur.':'Mount disposes controller permanently on pagehide; pageshow does not recreate it. Browser BFCache eligibility was not exercised.'})}finally{f.drag.dispose();f.runtime.dispose()}}
}finally{}
const after=paths.map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(root,p)))}));
const report={capturedAt:new Date().toISOString(),kind:'Independent current-product bridge + exact extracted current host subscribe callbacks + current core runtime; Node event surface, not browser',sourcesBefore:before,sourcesAfter:after,sourceDrift:before.filter((x,i)=>x.sha256!==after[i].sha256),hookSources:[{path:paths[1],text:previewLine,sha256:hash(previewLine)},{path:paths[2],text:offlineLine,sha256:hash(offlineLine)}],script:{path:'research/runtime-transform-drag-host-review-probe.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},summary:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},results,boundaries,limitations:['DOM event dispatch and cursor style are controlled surfaces; no browser click/touch ordering/BFCache eligibility proof.','Both current host subscribe callback expressions execute as read, but React mounting/offline rendering are not executed.','Core source is being edited independently; whole-file drift is recorded and only reviewed hook hashes are stable assertions.']};
const output=process.argv[2]||'research/runtime-transform-drag-host-review-probes.json';assert.ok(!fs.existsSync(output));fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,sourceDrift:report.sourceDrift,failures:results.filter(r=>!r.passed)},null,2));if(report.summary.failed)process.exitCode=1;
