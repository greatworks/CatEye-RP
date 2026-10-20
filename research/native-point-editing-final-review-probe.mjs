// Read-only independent review. Vite loads current model modules without a build.
// Native geometry expectations come from retained CIL replay points, not from
// the product's rendering/preparation helper. No original DLL/GUI executes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pin=file=>({file,sha256:sha(file)});
const files=['src/model/vector-authoring.ts','src/model/vector-editing.ts','src/model/vector.ts','src/model/line-style.ts','src/model/adaptive.ts','src/model/adaptive-view-sets.ts','src/model/document.ts','src/model/types.ts','src/App.tsx','src/components/CanvasVectorTools.tsx','src/components/Inspector.tsx','src/components/WidgetView.tsx'];
const startingHashes=files.map(pin);
const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',server:{middlewareMode:true},appType:'custom'});
const results=[];
try {
  const document=await server.ssrLoadModule('/src/model/document.ts');
  const adaptive=await server.ssrLoadModule('/src/model/adaptive.ts');
  const sets=await server.ssrLoadModule('/src/model/adaptive-view-sets.ts');
  const {resolveVectorEditPath,vectorEditPathUnsupportedReason}=await server.ssrLoadModule('/src/model/vector-authoring.ts');
  const {moveVectorAnchor,vectorAnchors}=await server.ssrLoadModule('/src/model/vector-editing.ts');
  const evidence=JSON.parse(fs.readFileSync('research/native-point-editing-evidence-geometry.json','utf8'));
  const sourceChecks=evidence.sources.map(source=>{assert.equal(sha(source.path),source.sha256,source.path);return{...source,passed:true};});
  assert.equal(evidence.cases.length,384);
  for(const entry of evidence.cases){
    const widget=document.createWidget('box');Object.assign(widget,{width:entry.input.width,height:entry.input.height,vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'L',x:0,y:0},{op:'Z'}]}});
    Object.assign(widget.style,{radius:entry.input.radius,strokeWidth:2*entry.input.offset,cornerVisibility:[1,2,4,8].map(bit=>Boolean(entry.input.cornerMask&bit))});
    const points=entry.points,commands=[{op:'M',x:points[0][0],y:points[0][1]}];
    for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];assert.equal(a[6],true,'replay contour segment');
      if(a[4]==='NaN'&&b[2]==='NaN')commands.push({op:'L',x:b[0],y:b[1]});
      else commands.push({op:'C',x1:a[4]==='NaN'?a[0]:a[4],y1:a[5]==='NaN'?a[1]:a[5],x2:b[2]==='NaN'?b[0]:b[2],y2:b[3]==='NaN'?b[1]:b[3],x:b[0],y:b[1]});
    }commands.push({op:'Z'});
    const before=structuredClone(widget),actual=resolveVectorEditPath(widget);assert.equal(actual.fillRule,'nonzero');assert.equal(actual.commands.length,commands.length,entry.name);
    for(let i=0;i<commands.length;i++)for(const [key,value]of Object.entries(commands[i])){const got=actual.commands[i][key];if(typeof value==='number')assert.ok(Math.abs(got-value)<=1e-12,`${entry.name}/${i}/${key}: ${got} vs ${value}`);else assert.equal(got,value,entry.name);}
    assert.deepEqual(widget,before);results.push({kind:'retained-cil-geometry',name:entry.name,passed:true});
  }
  const pills=JSON.parse(fs.readFileSync('research/native-pills-imported-widgets.json','utf8'));
  const native=pills.widgets.find(item=>item.sourceId==='d515a37dfd114af6877e6c6d4d244032');assert.ok(native);
  for(const shared of [false,true])for(const nesting of ['page','panel','repeater'])for(const viewId of [undefined,'tablet','phone']){
    let doc=document.createDocument();const page=doc.pages[0],target=structuredClone(native.widget);target.id='target';
    // Hint effects are form-only: cover every six legal shape effect fields.
    for(const [i,field]of ['selectedStyle','mouseOverStyle','mouseDownStyle','focusedStyle','disabledStyle','errorStyle'].entries())target[field]={radius:i+1,fill:'#123456'};
    const sibling=document.createWidget('box');sibling.id='sibling';
    if(nesting==='page')page.widgets=[target,sibling];else{const owner=document.createWidget(nesting);owner.id='container';if(nesting==='panel')owner.states[0].widgets=[target,sibling];else owner.repeater.template=[target,sibling];page.widgets=[owner];}
    const views=[{id:'tablet',name:'Tablet',width:768,height:0,overrides:{target:{width:260,style:{radius:40,fill:'#0000ff'},stateStyles:{selected:{radius:8}}}}},{id:'phone',name:'Phone',width:390,height:0,baseViewId:'tablet',overrides:{target:{height:25,style:{radius:2},stateStyles:{}}}}];
    page.adaptiveViews=views;page.adaptiveOverrides={inactive:{target:{width:111,hidden:false,style:{radius:0,fill:'#ffffff'},stateStyles:{}}}};
    const untouched=document.createPage('Other page');untouched.widgets=[{...document.createWidget('box'),id:'unrelated'}];doc.pages.push(untouched);
    if(shared){doc.adaptiveViewSets=[{id:'shared',name:'Shared',baseSize:{width:1200,height:0},views:views.map(({overrides,...def})=>def)}];page.adaptiveViewSetId='shared';for(const v of views)page.adaptiveOverrides[v.id]=v.overrides;page.adaptiveViews=[];delete page.adaptiveSelection;delete page.adaptiveBaseSize;}
    doc=document.parseDocument(document.serializeDocument(doc));
    const effective=sets.resolveAdaptivePage(doc,doc.pages[0]),shown=document.findWidget({widgets:adaptive.resolveAdaptiveWidgets(effective,viewId)},'target'),prepared=resolveVectorEditPath(shown);
    assert.ok(prepared);assert.equal(adaptive.applyAdaptivePointEdit(effective,viewId,'target',structuredClone(prepared)),effective);
    const first=vectorAnchors(prepared)[0],changed=moveVectorAnchor(prepared,0,{x:first.x+.013,y:first.y+.017});
    const next=sets.commitAdaptivePage(doc,adaptive.applyAdaptivePointEdit(effective,viewId,'target',changed)),expected=structuredClone(doc),expectedWidget=document.findWidget(expected.pages[0],'target');expectedWidget.type='path';expectedWidget.vectorPath=changed;
    assert.deepEqual(next,expected);assert.deepEqual(document.parseDocument(document.serializeDocument(next)),next);
    const after=document.findWidget({widgets:adaptive.resolveAdaptiveWidgets(sets.resolveAdaptivePage(next,next.pages[0]),viewId)},'target');assert.equal(resolveVectorEditPath(after),after.vectorPath);
    results.push({kind:'shared-identity-preservation',shared,nesting,viewId:viewId??'base',passed:true,noOp:true,onlySharedIdentityAndPathChanged:true,saveReadback:true});
  }
  const customFile='research/native-point-editing-format-custom-rectangles.rea.json',custom=document.parseDocument(fs.readFileSync(customFile,'utf8'));
  const imported=JSON.parse(fs.readFileSync('research/native-point-editing-format-import.json','utf8'));assert.equal(sha(customFile),imported.fixture.sha256);assert.equal(sha(imported.sample.file),imported.sample.sha256);
  for(const page of custom.pages)for(const widget of page.widgets){const original=imported.widgets.find(item=>item.widget.id===widget.id);assert.ok(original);assert.deepEqual(widget,original.widget);assert.equal(widget.type,'path');assert.equal(resolveVectorEditPath(widget),widget.vectorPath);assert.equal(vectorEditPathUnsupportedReason(widget),undefined);results.push({kind:'real-native-custom-rectangle',id:widget.id,sourceId:original.sourceId,passed:true});}
  const blocked=structuredClone(native.widget);blocked.width=240;blocked.height=60;blocked.style.radius=18;blocked.style.borderVisibility=[true,false,true,true];
  const rejectedCommand=()=>{const p=document.createPage();p.widgets=[blocked];const before=structuredClone(p);assert.throws(()=>adaptive.applyAdaptivePointEdit(p,null,blocked.id,blocked.vectorPath),/unavailable/);assert.deepEqual(p,before);};
  assert.equal(vectorEditPathUnsupportedReason(blocked),'partial-border');assert.equal(resolveVectorEditPath(blocked),blocked.vectorPath);rejectedCommand();results.push({kind:'unsupported-entry',reason:'partial-border',modelCommandRejected:true,passed:true});
  blocked.style.borderVisibility=[true,true,true,true];blocked.style.cornerRadii=[1,2,3,4];assert.equal(vectorEditPathUnsupportedReason(blocked),'independent-corners');rejectedCommand();results.push({kind:'unsupported-entry',reason:'independent-corners',modelCommandRejected:true,passed:true});
  blocked.type='path';assert.equal(vectorEditPathUnsupportedReason(blocked),undefined);assert.equal(resolveVectorEditPath(blocked),blocked.vectorPath);results.push({kind:'custom-path-not-blocked-by-inert-corners',passed:true});
  assert.deepEqual(files.map(pin),startingHashes,'Reviewed source files must not change while the independent probe runs');
  const report={capturedAt:new Date().toISOString(),method:'Independent Vite ssrLoadModule, read-only model and retained-CIL expected-point comparison. No application GUI/native DLL execution or full test suite.',passed:results.length,geometryCases:384,modelPreservationCases:18,realCustomRectangles:2,entryBoundaryCases:3,sourceChecks,results,blockingFindings:[],sourceStableDuringProbe:true,sourceHashes:startingHashes,evidenceHashes:['research/native-point-editing-evidence.json','research/native-point-editing-evidence-geometry.json',customFile,'research/native-point-editing-format-import.json','research/native-pills-imported-widgets.json','research/native-point-editing-final-review-probe.mjs'].map(pin),limits:['No native GUI observation is established by this probe.','Current product preserves bounds on point edit; original TN46 rebases location/size.','Partial-border and legacy independent-corner parameter geometry is not prepared; all reviewed point-edit entrances reject these cases.','Host gesture/undo/keyboard browser coverage is separately owned by the parent.']};
  fs.writeFileSync('research/native-point-editing-final-review-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,geometryCases:384,sourceHashesChecked:sourceChecks.length,report:'research/native-point-editing-final-review-probe.json'}));
}catch(error){console.error(JSON.stringify({name:error.name,message:error.message},null,2));process.exitCode=1;}finally{await server.close();}
