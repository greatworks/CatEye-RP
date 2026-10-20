// Read-only independent product probe. No browser, build, or vendor execution.
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';

const output = process.argv[2] || 'research/runtime-rotate-motion-integration-review-first.json';
assert(!fs.existsSync(output), `Do not overwrite evidence: ${output}`);
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pin = p => ({ path: p, sha256: sha(p) });
const files = ['src/runtime/export-runtime.ts', 'src/runtime/expressions.ts', 'tests/runtime-rotate.test.ts', 'src/runtime/engine.ts', 'src/model/types.ts'];
const sources = files.map(pin), results = [];
const runtimeCode = stripTypeScriptTypes(fs.readFileSync(files[0], 'utf8'), { mode: 'transform' }).replaceAll('export function ', 'function ');
const exprCode = stripTypeScriptTypes(fs.readFileSync(files[1], 'utf8'), { mode: 'transform' }).replaceAll('export function ', 'function ');
const template = JSON.parse(fs.readFileSync('artifacts/runtime-rotate-source.rea.json', 'utf8'));
let uid = 0;
const event = (...actions) => ({ id: `event-${++uid}`, event: 'click', name: 'review', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ id: `action-${++uid}`, ...a })) });
const rotate = (id, patch = {}) => ({ type: 'rotate', targetId: id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'none', duration: 0, ...patch } });
const variable = (id, value) => ({ type: 'setVariable', targetId: id, value });
const near = (a,b) => Math.abs(a-b)<1e-8;
function fixture() {
  const shape = { ...structuredClone(template.pages[0].widgets[0]), id: 'a', type: 'box', x: 100, y: 100, width: 200, height: 100, rotation: 0, text: '', interactions: [] };
  const doc = { ...structuredClone(template), id: 'review-doc', variables: { N: '0' }, pages: [{ id: 'page', name: 'Review', width: 1200, height: 800, background: '#fff', widgets: [shape], interactions: [], adaptiveViews: [] }] };
  delete doc.adaptiveViewSets;
  return { doc, shape };
}
function clockRuntime(doc) {
  let now = 0, next = 0;
  const timers = new Map();
  class ClockDate extends Date { static now() { return now; } }
  const context = vm.createContext({ structuredClone, Date: ClockDate, setTimeout: (fn,ms=0) => { const id=++next; timers.set(id,{fn,time:now+Number(ms)});return id; }, clearTimeout: id=>timers.delete(id), URL });
  vm.runInContext(`${exprCode}\n${runtimeCode}\nglobalThis.factory=createOfflineRuntime; globalThis.evaluator=evaluateExpression;`, context);
  const runtime = context.factory(doc, undefined, context.evaluator, undefined, {});
  const flush = async () => { for(let n=0;n<40;n++) await Promise.resolve(); };
  const advance = async ms => { await flush(); const end=now+ms; let guard=0; while(true) { const first=[...timers].sort((a,b)=>a[1].time-b[1].time)[0]; if(!first||first[1].time>end)break; assert(++guard<1000,'timer loop'); now=first[1].time;timers.delete(first[0]);first[1].fn();await flush(); } now=end;await flush(); };
  return { runtime, advance, flush, timers };
}
function watch(promise) { const state={status:'pending'}; promise.then(()=>state.status='fulfilled',error=>{state.status='rejected';state.message=error.message;});return state; }
async function check(name, fn) { try { const value=await fn(); results.push({name,passed:value.passed,observed:value}); } catch(error) {results.push({name,passed:false,error:error.stack});} }

await check('independent queued-start failure rejects its owner, not prior completed motion', async()=>{
  const {doc,shape}=fixture(), {runtime,advance,flush,timers}=clockRuntime(doc);
  const first=watch(runtime.execute(event(rotate('a',{easing:'linear',duration:64})))); await advance(16);
  const second=watch(runtime.execute(event(rotate('a',{degrees:'[[1 / 0]]',easing:'linear',duration:64}))));await flush();
  await advance(200); const angle=runtime.widget(shape).rotation, pendingTimers=timers.size;
  const observed={first:{...first},second:{...second},angle,pendingTimers,passed:first.status==='fulfilled'&&second.status==='rejected'&&near(angle,90)};
  runtime.dispose();await flush();return observed;
});
await check('group logical angle is rolled back with a failed transaction', async()=>{
  const {doc,shape}=fixture();shape.width=100;shape.groupId='g';const other={...structuredClone(shape),id:'b',x:300};doc.pages[0].widgets.push(other);
  const {runtime,flush}=clockRuntime(doc); const failed=watch(runtime.execute(event(rotate('g'),variable('N','[[1 / 0]]'))));await flush();
  const afterFailure=runtime.widget(shape);
  const retry=watch(runtime.execute(event(rotate('g',{mode:'to',degrees:'90'}))));await flush();
  const afterRetry=runtime.widget(shape),observed={failed,retry,afterFailure:{x:afterFailure.x,y:afterFailure.y,rotation:afterFailure.rotation},afterRetry:{x:afterRetry.x,y:afterRetry.y,rotation:afterRetry.rotation},passed:failed.status==='rejected'&&retry.status==='fulfilled'&&near(afterRetry.rotation,90)};
  runtime.dispose();return observed;
});
await check('selected shadow is used for initial orbit geometry', async()=>{
  const {doc,shape}=fixture();shape.selected=true;shape.selectedStyle={outerShadow:{on:true,offsetX:-10,offsetY:-20,blurRadius:6,color:'#000'}};
  const {runtime,flush}=clockRuntime(doc);const status=watch(runtime.execute(event(rotate('a',{offsetX:'30',offsetY:'-10'}))));await flush();const w=runtime.widget(shape);
  const observed={status,position:{x:w.x,y:w.y,rotation:w.rotation},passed:status.status==='fulfilled'&&near(w.x,120)&&near(w.y,60)&&w.style.outerShadow?.on};runtime.dispose();return observed;
});
await check('negative shadow orbit preserves the separately cached moved origin across frames', async()=>{
  const {doc,shape}=fixture();shape.style.outerShadow={on:true,offsetX:-10,offsetY:-20,blurRadius:6,color:'#000'};
  const {runtime,advance,flush}=clockRuntime(doc);const status=watch(runtime.execute(event(rotate('a',{offsetX:'30',offsetY:'-10',easing:'linear',duration:64}))));
  const samples=[];for(let i=0;i<4;i++){await advance(16);const w=runtime.widget(shape);samples.push({degree:w.rotation,x:w.x,y:w.y});}
  await flush();const w=runtime.widget(shape), observed={status,samples,expected:{x:120,y:60,rotation:90},passed:status.status==='fulfilled'&&near(w.x,120)&&near(w.y,60)};
  runtime.dispose();return observed;
});
await check('public expression geometry reads moved cache, not painted CSS location', async()=>{
  const {doc,shape}=fixture();shape.style.outerShadow={on:true,offsetX:-10,offsetY:-20,blurRadius:6,color:'#000'};
  shape.interactions=[event(variable('N','[[This.x]],[[This.y]],[[This.width]],[[This.height]],[[This.rotation]]'))];
  const {runtime,advance,flush}=clockRuntime(doc);const status=watch(runtime.execute(event(rotate('a',{offsetX:'30',offsetY:'-10',easing:'linear',duration:64}))));await advance(64);
  const read=watch(runtime.trigger('a','click'));await flush();const values=runtime.state().variables.N.split(',').map(Number);
  const observed={status,read,values,expected:[104,34,200,100,90],passed:values.length===5&&values.every((x,i)=>near(x,[104,34,200,100,90][i]))};runtime.dispose();return observed;
});
const originalEasing=JSON.parse(fs.readFileSync('research/runtime-rotate-motion-probes.json','utf8')).results.find(x=>x.name==='shipped-easing-catalog').observed.samples;
for(const [easing,values] of Object.entries(originalEasing)) await check(`retained easing ${easing} at quarter progress`,async()=>{
  const {doc,shape}=fixture(),{runtime,advance,flush}=clockRuntime(doc);const status=watch(runtime.execute(event(rotate('a',{degrees:'180',easing,duration:64}))));await advance(16);const quarter=runtime.widget(shape).rotation;await advance(48);await flush();const final=runtime.widget(shape).rotation;
  const observed={quarter,expected:180*values[1],final,status,passed:near(quarter,180*values[1])&&near(final,180)&&status.status==='fulfilled'};runtime.dispose();return observed;
});
await check('live fractional-angle getter differs from integer full turns',async()=>{
  const actual=[];for(const angle of [720,720.5,-90.5]){const {doc,shape}=fixture();shape.rotation=angle;const {runtime,flush}=clockRuntime(doc);const status=watch(runtime.execute(event(rotate('a',{degrees:'15'}))));await flush();actual.push({angle,result:runtime.widget(shape).rotation,status});runtime.dispose();}
  return {actual,passed:actual.every((x,i)=>near(x.result,[735,15.5,284.5][i])&&x.status.status==='fulfilled')};
});
await check('flat group angle survives an adaptive CSS reset',async()=>{
  const {doc,shape}=fixture();shape.width=100;shape.groupId='g';doc.pages[0].adaptiveSelection='native-size';doc.pages[0].adaptiveBaseSize={width:1200,height:0};doc.pages[0].adaptiveViews=[{id:'phone',name:'Phone',width:390,height:0,overrides:{a:{rotation:12}}}];
  const {runtime,flush}=clockRuntime(doc);await runtime.setViewport({width:1200});const first=watch(runtime.execute(event(rotate('g'))));await flush();await runtime.setViewport({width:390});const afterReset=runtime.widget(shape).rotation;const second=watch(runtime.execute(event(rotate('g',{mode:'to',degrees:'180'}))));await flush();const angle=runtime.widget(shape).rotation;
  const observed={first,second,afterReset,angle,passed:first.status==='fulfilled'&&second.status==='fulfilled'&&near(afterReset,12)&&near(angle,102)};runtime.dispose();return observed;
});
await check('snapshot restore retains flat group To angle independently from member rotation',async()=>{
  const {doc,shape}=fixture();shape.width=100;shape.groupId='g';const other={...structuredClone(shape),id:'b',x:300};doc.pages[0].widgets.push(other);
  const first=clockRuntime(doc);const firstTask=watch(first.runtime.execute(event(rotate('g'))));await first.flush();const snapshot=structuredClone(first.runtime.state());first.runtime.dispose();
  const next=clockRuntime(doc);Object.assign(next.runtime.state(),snapshot);const secondTask=watch(next.runtime.execute(event(rotate('g',{mode:'to',degrees:'180'}))));await next.flush();const w=next.runtime.widget(shape);
  const observed={firstTask,secondTask,angle:w.rotation,frame:{x:w.x,y:w.y},passed:firstTask.status==='fulfilled'&&secondTask.status==='fulfilled'&&near(w.rotation,180)&&near(w.x,300)&&near(w.y,100)};next.runtime.dispose();return observed;
});
await check('snapshot restore retains negative shadow moved cache for a later offset action',async()=>{
  const {doc,shape}=fixture();shape.style.outerShadow={on:true,offsetX:-10,offsetY:-20,blurRadius:6,color:'#000'};
  const uninterrupted=clockRuntime(doc);await uninterrupted.runtime.execute(event(rotate('a',{offsetX:'30',offsetY:'-10'})));const snapshot=structuredClone(uninterrupted.runtime.state());await uninterrupted.runtime.execute(event(rotate('a',{offsetX:'30',offsetY:'-10'})));const expected=uninterrupted.runtime.widget(shape);uninterrupted.runtime.dispose();
  const next=clockRuntime(doc);Object.assign(next.runtime.state(),snapshot);const status=watch(next.runtime.execute(event(rotate('a',{offsetX:'30',offsetY:'-10'}))));await next.flush();const actual=next.runtime.widget(shape);
  const observed={status,expected:{x:expected.x,y:expected.y,rotation:expected.rotation},actual:{x:actual.x,y:actual.y,rotation:actual.rotation},passed:status.status==='fulfilled'&&['x','y','rotation'].every(key=>near(actual[key],expected[key]))};next.runtime.dispose();return observed;
});
await check('Rotate completion parent-fit respects zero destination cache fallback',async()=>{
  const {doc,shape}=fixture();Object.assign(shape,{x:0,y:0,rotation:30});
  const panel={...structuredClone(shape),id:'panel',type:'panel',rotation:0,fitToContent:true,states:[{id:'s',name:'State',widgets:[shape]}],activeStateId:'s'};doc.pages[0].widgets=[panel];
  const {runtime,flush}=clockRuntime(doc),before=runtime.widget(panel);const status=watch(runtime.execute(event(rotate('a',{mode:'to',degrees:'0'}))));await flush();const after=runtime.widget(panel);
  const expected={width:100+100*Math.cos(Math.PI/6)+25,height:50+50+50*Math.cos(Math.PI/6)};
  const observed={status,before:{width:before.width,height:before.height},after:{width:after.width,height:after.height},expected,passed:near(after.width,expected.width)&&near(after.height,expected.height)};runtime.dispose();return observed;
});
await check('Rotate completion emits Resize when fitting parent dimensions change',async()=>{
  const {doc,shape}=fixture();Object.assign(shape,{x:0,y:0});const resize=event(variable('N','[[N+1]]'));resize.event='resize';
  const panel={...structuredClone(shape),id:'panel',type:'panel',fitToContent:true,states:[{id:'s',name:'State',widgets:[shape]}],activeStateId:'s',interactions:[resize]};doc.pages[0].widgets=[panel];
  const {runtime,flush}=clockRuntime(doc);const status=watch(runtime.execute(event(rotate('a'))));await flush();const after=runtime.widget(panel),events=Number(runtime.state().variables.N);
  const observed={status,after:{width:after.width,height:after.height},resizeEvents:events,expected:{width:150,height:150,resizeEvents:1},passed:near(after.width,150)&&near(after.height,150)&&events===1};runtime.dispose();return observed;
});
const report={schema:1,capturedAt:new Date().toISOString(),kind:'independent current product factory in NodeVM with deterministic timer; no vendor code, GUI, browser, or build executed',sources,sourceStableDuringRun:files.every((p,i)=>sha(p)===sources[i].sha256),probe:pin(import.meta.filename),evidence:[pin('research/runtime-rotate-motion-evidence.json'),pin('research/runtime-rotate-motion-probes.json'),pin('artifacts/runtime-rotate-source.rea.json')],checks:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},results,limits:['Failure rollback is product policy, not an observed vendor transaction contract.','Flat sibling group support is an independent compatibility mapping.','Shadow and parent-fit expected values are supported by the separately retained exact-source composition reports; no complete generated page or vendor GUI was run.']};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,...report.checks,sourceStableDuringRun:report.sourceStableDuringRun,results},null,2));
if(report.checks.failed)process.exitCode=1;
