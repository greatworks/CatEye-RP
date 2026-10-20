// Independent model review. Synthetic adaptive/container arrangements around an
// unchanged native-imported pill; no native application or DLL execution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
process.on('uncaughtException',error=>{console.error(JSON.stringify({name:error.name,message:error.message},null,2));process.exit(1);});
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const modules=new Map();
function url(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const source=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,ref)=>`from ${JSON.stringify(url(path.resolve(path.dirname(file),ref.endsWith('.ts')?ref:ref+'.ts')))}`);const value='data:text/javascript;base64,'+Buffer.from(source).toString('base64');modules.set(file,value);return value;}
const document=await import(url('src/model/document.ts'));
const adaptive=await import(url('src/model/adaptive.ts'));
const sets=await import(url('src/model/adaptive-view-sets.ts'));
const {resolveVectorEditPath}=await import(url('src/model/vector-authoring.ts'));
const {moveVectorAnchor,vectorAnchors}=await import(url('src/model/vector-editing.ts'));
const pills=JSON.parse(fs.readFileSync('research/native-pills-imported-widgets.json','utf8'));
const native=pills.widgets.find(item=>item.sourceId==='d515a37dfd114af6877e6c6d4d244032');assert.ok(native);
const results=[];
for(const shared of [false,true])for(const nesting of ['page','panel','repeater'])for(const viewId of [undefined,'tablet','phone']){
  let doc=document.createDocument();const page=doc.pages[0],target=structuredClone(native.widget);target.id='target';
  // Hint is form-only in the product schema, so the six legal shape states are
  // preserved here; this is not a request to broaden that unrelated boundary.
  for(const [i,field] of ['selectedStyle','mouseOverStyle','mouseDownStyle','focusedStyle','disabledStyle','errorStyle'].entries())target[field]={radius:i+1,fill:'#123456'};
  const sibling=document.createWidget('box');sibling.id='sibling';
  if(nesting==='page')page.widgets=[target,sibling];
  else{const owner=document.createWidget(nesting);owner.id='container';if(nesting==='panel')owner.states[0].widgets=[target,sibling];else owner.repeater.template=[target,sibling];page.widgets=[owner];}
  const views=[{id:'tablet',name:'Tablet',width:768,height:0,overrides:{target:{width:260,style:{radius:40,fill:'#0000ff'},stateStyles:{selected:{radius:8}}}}},{id:'phone',name:'Phone',width:390,height:0,baseViewId:'tablet',overrides:{target:{height:25,style:{radius:2},stateStyles:{}}}}];
  page.adaptiveViews=views;page.adaptiveOverrides={inactive:{target:{width:111,hidden:false,style:{radius:0,fill:'#ffffff'},stateStyles:{}}}};
  const untouched=document.createPage('Other page');untouched.widgets=[{...document.createWidget('box'),id:'unrelated'}];doc.pages.push(untouched);
  if(shared){doc.adaptiveViewSets=[{id:'shared',name:'Shared',baseSize:{width:1200,height:0},views:views.map(({overrides,...def})=>def)}];page.adaptiveViewSetId='shared';for(const v of views)page.adaptiveOverrides[v.id]=v.overrides;page.adaptiveViews=[];delete page.adaptiveSelection;delete page.adaptiveBaseSize;}
  doc=document.parseDocument(document.serializeDocument(doc));
  const effective=sets.resolveAdaptivePage(doc,doc.pages[0]),shown=document.findWidget({widgets:adaptive.resolveAdaptiveWidgets(effective,viewId)},'target');
  const prepared=resolveVectorEditPath(shown);assert.ok(prepared);
  assert.equal(adaptive.applyAdaptivePointEdit(effective,viewId,'target',structuredClone(prepared)),effective,'prepared contour no-op preserves page identity');
  const first=vectorAnchors(prepared)[0],changed=moveVectorAnchor(prepared,0,{x:first.x+.013,y:first.y+.017});
  const next=sets.commitAdaptivePage(doc,adaptive.applyAdaptivePointEdit(effective,viewId,'target',changed));
  const expected=structuredClone(doc),expectedWidget=document.findWidget(expected.pages[0],'target');expectedWidget.type='path';expectedWidget.vectorPath=changed;
  assert.deepEqual(next,expected,'only shared type/path may change; all base/active/inactive state, style, geometry and unrelated objects remain');
  assert.deepEqual(document.parseDocument(document.serializeDocument(next)),next,'save/readback preserves converted graph');
  const after=document.findWidget({widgets:adaptive.resolveAdaptiveWidgets(sets.resolveAdaptivePage(next,next.pages[0]),viewId)},'target');
  assert.equal(resolveVectorEditPath(after),after.vectorPath,'custom identity never parameter-regenerates even with retained mask and radius');
  results.push({shared,nesting,viewId:viewId??'base',passed:true,noOp:true,onlySharedIdentityAndPathChanged:true,saveReadback:true});
}
const custom=document.parseDocument(fs.readFileSync('research/native-point-editing-format-custom-rectangles.rea.json','utf8'));
for(const page of custom.pages)for(const w of page.widgets){assert.equal(w.type,'path');assert.equal(resolveVectorEditPath(w),w.vectorPath);results.push({nativeCustom:w.id,passed:true,customRectangleNotPromoted:true});}
const report={capturedAt:new Date().toISOString(),scope:'Read-only production model review; 18 synthetic adaptive/container arrangements around one actually imported native pill and 2 actually imported native Shape300 rectangles. No GUI/browser/native execution. App/Canvas/Inspector are still being wired and are not certified here.',results,passed:results.length,blockingFindings:[],limits:['Partial-border parameter shapes may render regenerated geometry while helper returns stored snapshot. Disable direct editing there until preparation/display are consistent.','Original TN46 rebases location/size; this stage intentionally preserves existing product bounds.','Interaction-effect preview preparation is host behavior and outside this model-only probe.'],sources:[...modules.keys()].map(file=>({file:path.relative(process.cwd(),file).replaceAll('\\','/'),sha256:sha(file)})),evidence:['research/native-pills-imported-widgets.json','research/native-point-editing-format-custom-rectangles.rea.json','research/native-point-editing-format-contract-review.mjs'].map(file=>({file,sha256:sha(file)}))};
fs.writeFileSync('research/native-point-editing-format-contract-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,blockingFindings:report.blockingFindings,report:'research/native-point-editing-format-contract-review.json'}));
