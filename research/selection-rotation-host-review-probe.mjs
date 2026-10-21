// Read-only product review; source observations were generated separately.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const paths=['src/App.tsx','src/model/selection-pointer-input.ts','src/model/selection-pointer-rotate.ts',
 'src/model/selection-author-edits.ts','src/runtime/selection-pointer-session.ts','src/model/adaptive-view-sets.ts',
 'src/model/adaptive.ts','src/model/document.ts','src/model/layer-geometry.ts',
 'research/selection-rotation-host-review-source-probes.json','research/selection-rotation-host-review-probe.mjs'];
const sources=paths.map(path=>({path,sha256:sha(path)})),results=[];
const near=(a,b,path='')=>{if(typeof b==='number')assert(Number.isFinite(a)&&Math.abs(a-b)<1e-8,`${path}: ${a} != ${b}`);
 else if(b&&typeof b==='object')for(const key of Object.keys(b))near(a?.[key],b[key],path+'.'+key);else assert.deepEqual(a,b,path);};
const check=async(name,fn)=>{try{const detail=await fn();results.push({name,passed:true,...detail});}catch(error){results.push({name,passed:false,error:error.message});}};
const server=await createServer({configFile:false,logLevel:'error',appType:'custom',cacheDir:'.build/selection-rotation-host-review-cache',
 server:{middlewareMode:true,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
try{
 const model=await server.ssrLoadModule('/src/model/selection-pointer-rotate.ts');
 const inputModel=await server.ssrLoadModule('/src/model/selection-pointer-input.ts');
 const edits=await server.ssrLoadModule('/src/model/selection-author-edits.ts');
 const docs=await server.ssrLoadModule('/src/model/document.ts');
 const sets=await server.ssrLoadModule('/src/model/adaptive-view-sets.ts');
 const {createSelectionPointerSession}=await server.ssrLoadModule('/src/runtime/selection-pointer-session.ts');
 const source=read('research/selection-rotation-host-review-source-probes.json');
 function prepare(item){const {input,observed}=item;
  const captured=inputModel.prepareSelectionPointerInput({targetCount:input.targets.length,handle:input.handle,freedom:input.freedom,
   initialModifiers:{control:true,shift:false,alt:false},initialHotzonePoint:observed.captured.logicalStart,
   grid:{enabled:input.grid,spacing:{width:8,height:8},tolerance:5/(input.zoom??1)}});
  return model.prepareSelectionPointerRotate({targets:input.targets.map((w,n)=>({id:w.id,type:n?'radio':'checkbox',rotation:0,
   ownerRect:w.rect,locked:w.locked})),input:captured,downPoint:input.down});
 }
 for(const item of source.results)await check(item.name,()=>{
  const prepared=prepare(item);let state=prepared.state;const frames=[];
  for(const frame of item.observed.frames){const before=structuredClone({original:prepared.original,state,request:frame.request});
   const result=model.planSelectionPointerRotate(prepared.original,state,frame.request);assert.equal(result.ok,true,result.reason);
   near(result.trace.delta,frame.input.delta,'delta');near(result.trace.input.correction,frame.input.correction,'correction');
   near(result.trace.input.candidate??null,frame.input.candidate,'candidate');
   for(const w of frame.controller.after)near(result.state.targets.find(t=>t.id===w.id).ownerRect,w.rect,w.id);
   const actual=result.results.flatMap(t=>t.effects.map(e=>({id:t.id,...e}))),expected=frame.controller.events.filter(e=>e.name==='Location.write');
   assert.equal(actual.length,expected.length);
   expected.forEach((e,n)=>{near(actual[n],e.point);assert.equal(actual[n].id,e.id);assert.equal(actual[n].allViews,false);assert.equal(actual[n].notify,true);});
   assert.deepEqual({original:prepared.original,state,request:frame.request},before);
   frames.push({delta:result.trace.delta,angle:result.trace.angle,writes:actual});state=result.state;
  }return {frames};
 });
 const example=source.results.find(r=>r.input.handle===12&&r.input.grid===false&&!r.input.targets[0].locked&&r.input.down.x===630);
 function documentFixture(shared=false,nested=false){const page=docs.createPage('Rotation review'),document=docs.createDocument();
  const widgets=example.input.targets.map((w,n)=>({...docs.createWidget(n?'radio':'checkbox',w.rect.x,w.rect.y),id:w.id,...w.rect,
   selectionText:{autoFitWidth:true,autoFitHeight:false,alignRight:false},text:'Immutable literal [[value]]'}));
  page.widgets=nested?[docs.createLayer(widgets,'Container')]:widgets;
  page.adaptiveViews=[{id:'tablet',name:'Tablet',width:768,height:0,overrides:{check:{style:{color:'#ff0000'}}}},
   {id:'phone',name:'Phone',width:390,height:0,baseViewId:'tablet',overrides:{radio:{hidden:true}}}];
  page.adaptiveOverrides={inactive:{check:{x:900,y:800,style:{fontSize:22}}}};document.pages=[page];
  if(shared){document.adaptiveViewSets=[{id:'set',name:'Set',baseSize:{width:0,height:0},views:page.adaptiveViews.map(({overrides,...v})=>v)}];
   page.adaptiveViewSetId='set';page.adaptiveOverrides={...page.adaptiveOverrides,...Object.fromEntries(page.adaptiveViews.map(v=>[v.id,v.overrides]))};
   page.adaptiveViews=[];delete page.adaptiveSelection;delete page.adaptiveBaseSize;}
  return {document,page,widgets};
 }
 for(const shared of [false,true])for(const nested of [false,true])await check(`current paired Location shared=${shared} nested=${nested}`,()=>{
  const {document,page,widgets}=documentFixture(shared,nested),before=structuredClone(document),prepared=prepare(example);
  const frame=model.planSelectionPointerRotate(prepared.original,prepared.state,example.input.requests[0]);assert.equal(frame.ok,true);
  let p=sets.resolveAdaptivePage(document,page);for(const target of frame.results)p=edits.applySelectionAuthorWriteEffects(p,'phone',target.id,target.effects);
  const next=sets.commitAdaptivePage(document,p),effective=sets.resolveAdaptivePage(next,next.pages[0]);
  assert.deepEqual(next.adaptiveViewSets,document.adaptiveViewSets);assert.deepEqual(next.pages[0].adaptiveOverrides.inactive,page.adaptiveOverrides.inactive);
  assert.deepEqual(effective.adaptiveViews[0],sets.resolveAdaptivePage(document,page).adaptiveViews[0]);
  for(const target of frame.results){const patch=effective.adaptiveViews[1].overrides[target.id],expected=frame.state.targets.find(t=>t.id===target.id).ownerRect;
   assert.equal(patch.x,expected.x);assert.equal(patch.y,expected.y);assert(!Object.hasOwn(patch,'width'));assert(!Object.hasOwn(patch,'height'));
   assert.deepEqual(docs.findWidget(next.pages[0],target.id),widgets.find(w=>w.id===target.id));}
  assert.deepEqual(docs.parseDocument(docs.serializeDocument(next)),next);assert.deepEqual(document,before);
  return {pairedWrites:frame.results.length};
 });
 await check('no move and repeated zero-angle frame do not materialize a location patch',()=>{
  const prepared=prepare(example),request={point:prepared.original.input.initialHotzonePoint,modifiers:{control:false,shift:false,alt:false}};
  const zero=model.planSelectionPointerRotate(prepared.original,prepared.state,request);assert.equal(zero.ok,true);assert.deepEqual(zero.results,[]);
  assert.deepEqual(zero.state,prepared.state);const {page}=documentFixture();assert.equal(edits.applySelectionAuthorWriteEffects(page,'phone','check',[]),page);
 });
 await check('invalid later target write cannot mutate earlier accepted candidate or source',()=>{
  const {page}=documentFixture(),before=structuredClone(page);
  let candidate=edits.applySelectionAuthorWriteEffects(page,'phone','check',[{name:'style.Location',x:200,y:300,allViews:false}]);
  assert.throws(()=>edits.applySelectionAuthorWriteEffects(candidate,'phone','radio',[{name:'style.Location',x:Infinity,y:300,allViews:false}]));
  assert.deepEqual(page,before);assert.deepEqual(candidate.adaptiveViews[1].overrides.check,{x:200,y:300});
 });
 await check('queued original requests replay live state; finish adds no frame and one completion',async()=>{
  const prepared=prepare(example);let resolve,visible,completed=0,rolled=0;const pending=new Promise(done=>resolve=done),planned=[];
  const session=createSelectionPointerSession({prepare:()=>pending,isCurrent:()=>true,plan:(original,state,request)=>{
   const result=model.planSelectionPointerRotate(original,state,request);assert.equal(result.ok,true,result.reason);planned.push(result);return result.state;},
   publish:state=>visible=state,complete:()=>completed++,rollback:()=>rolled++,failed:error=>{throw error;}});
  for(const request of example.input.requests)session.update(request);session.finish();resolve({prepared:prepared.original,state:prepared.state});
  assert.equal((await session.done).status,'completed');assert.equal(planned.length,4);assert.equal(completed,1);assert.equal(rolled,0);
  for(const w of example.observed.after)near(visible.targets.find(t=>t.id===w.id).ownerRect,w.rect);return {frames:planned.length,completed};
 });
 await check('published rotation rolls back atomically after a later malformed frame',async()=>{
  const prepared=prepare(example),baseline=structuredClone(prepared.state);let visible=baseline,rolled=0,failed=0;
  const session=createSelectionPointerSession({prepare:async()=>({prepared:prepared.original,state:prepared.state}),isCurrent:()=>true,
   plan:(original,state,request)=>{const result=model.planSelectionPointerRotate(original,state,request);if(!result.ok)throw Error(result.reason);return result.state;},
   publish:state=>visible=state,complete:()=>assert.fail('must not complete'),rollback:()=>{visible=baseline;rolled++;},failed:()=>failed++});
  await new Promise(done=>setTimeout(done,0));session.update(example.input.requests[0]);assert.notDeepEqual(visible,baseline);
  session.update({point:{x:NaN,y:0},modifiers:{control:true,shift:false,alt:false}});
  assert.equal((await session.done).status,'failed');assert.equal(rolled,1);assert.equal(failed,1);assert.equal(visible,baseline);
 });
 await check('ownership cancellation does not overwrite an external replacement',async()=>{
  const prepared=prepare(example),baseline=prepared.state,external={external:true};let visible=baseline,lastPublished=baseline;
  const session=createSelectionPointerSession({prepare:async()=>({prepared:prepared.original,state:prepared.state}),isCurrent:()=>visible===lastPublished,
   plan:(original,state,request)=>{const result=model.planSelectionPointerRotate(original,state,request);assert(result.ok);return result.state;},
   publish:state=>visible=lastPublished=state,complete:()=>assert.fail('must not complete'),rollback:()=>{if(visible===lastPublished)visible=baseline;},failed:()=>assert.fail('must not fail')});
  await new Promise(done=>setTimeout(done,0));session.update(example.input.requests[0]);visible=external;session.finish();
  assert.equal((await session.done).status,'cancelled');assert.equal(visible,external);
 });
 const drift=sources.filter(s=>sha(s.path)!==s.sha256).map(s=>s.path);
 const report={kind:'Independent readonly actual product/source composition, persistence and lifecycle review',
  originalDllExecuted:false,originalGuiCompared:false,browserStarted:false,productEdited:false,
  summary:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},
  sources,sourceStableDuringProbe:drift.length===0,drift,blockingFindings:results.filter(r=>!r.passed),results};
 fs.writeFileSync('research/selection-rotation-host-review-probes.json',JSON.stringify(report,null,2)+'\n');
 console.log(report.summary,drift);for(const r of report.blockingFindings)console.log(r.name,r.error);if(report.summary.failed)process.exitCode=1;
}finally{await server.close();}
