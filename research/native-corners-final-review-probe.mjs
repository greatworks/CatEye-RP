import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!path.extname(s))return next(`${s}.ts`,c);throw e;}}});
const {createLineStyleRenderer}=await import('../src/model/line-style.ts');
const {createGradientRenderer}=await import('../src/model/gradient.ts');
const {createPage,createWidget,mergeWidgetStyle}=await import('../src/model/document.ts');
const {resolveAdaptiveWidgets,applyAdaptiveWidgetEdits}=await import('../src/model/adaptive.ts');
const {resolveWidgetStyleCommand,editCornerOverride}=await import('../src/components/widget-style-command.ts');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bind=p=>({path:p,sha256:hash(p)});
const files=['src/model/line-style.ts','src/model/gradient.ts','src/components/WidgetView.tsx','src/components/CornerEditor.tsx','src/components/CornerEditor.css','src/components/Inspector.tsx','src/components/widget-style-command.ts','src/App.tsx','src/model/types.ts','src/model/document.ts','src/model/adaptive.ts','src/model/adaptive-view-sets.ts','src/model/import-rp.ts','src/model/import-rp-adaptive.ts','src/runtime/export-runtime.ts','research/scripts/read-rp-semantics.mjs','tests/native-corners-renderer.test.ts','tests/native-corners-authoring.test.ts','tests/native-corners-controls.test.ts','tests/native-corners-runtime.test.ts','tests/import-rp-native-corners.test.ts'];
const sources=files.map(bind),results=[];
function check(name,observed,expected){results.push({name,pass:isDeepStrictEqual(observed,expected),observed,expected});}
const mask=n=>[1,2,4,8].map(bit=>Boolean(n&bit));
const base={fill:'#ffffff',stroke:'#000000',color:'#000000',radius:20,strokeWidth:10};
const savedPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:.9},{op:'C',x1:0,y1:.396,x2:.198,y2:0,x:.45,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'L',x:0,y:.9},{op:'Z'}]};
// Repeat the original eight checks unchanged in meaning, with a new output file.
for(const portable of [false,true]){
 const lines=portable?new Script(`(${createLineStyleRenderer.toString()})()`).runInNewContext():createLineStyleRenderer();
 const gradients=createGradientRenderer(lines);
 for(const radius of [90,20]){
  const input={type:'box',width:200,height:100,vectorPath:structuredClone(savedPath),style:{...base,radius,cornerVisibility:mask(1)}};
  check(`prior-NC-REVIEW-01-${portable}-${radius}`,JSON.parse(JSON.stringify({supports:lines.supportsCorners(input),radii:lines.vectorRectangle(input)?.radii})),{supports:true,radii:[radius,0,0,0]});
 }
 let mismatches=0;
 for(let c=0;c<16;c++)for(let b=0;b<16;b++){
  const style={...base,cornerVisibility:mask(c),borderVisibility:mask(b)},expected=mask(c).map((v,i)=>v&&mask(b)[(i+3)%4]===mask(b)[i]?20:0);
  if(JSON.stringify(lines.cssRadii(style))!==JSON.stringify(expected))mismatches++;
 }
 check(`prior-css-256-mask-matrix-${portable}`,mismatches,0);
 const svg=decodeURIComponent(gradients.border({...base,cornerVisibility:mask(0),strokeGradient:{type:'linear',start:{x:0,y:0},end:{x:1,y:0},stops:[{offset:0,color:'#0000ff'},{offset:1,color:'#ff0000'}]}},200,100));
 check(`prior-square-gradient-border-${portable}`,svg.includes('linearGradient')&&!/\bA \d/.test(svg),true);
 const resized={type:'box',width:80,height:240,vectorPath:savedPath,style:{...base,cornerVisibility:mask(1),borderVisibility:[true,false,true,false]}};
 check(`resized-normalized-declared-family-sides-${portable}`,JSON.parse(JSON.stringify({sides:lines.supportsSides(resized),corners:lines.supportsCorners(resized),radii:lines.vectorRectangle(resized)?.radii})),{sides:true,corners:true,radii:[0,0,0,0]});
 const bad=structuredClone(resized);bad.vectorPath.commands[1].x2=.18;
 check(`edited-handle-rejects-native-regeneration-${portable}`,{sides:lines.supportsSides(bad),corners:lines.supportsCorners(bad),rebuild:Boolean(lines.vectorRectangle(bad))},{sides:false,corners:false,rebuild:false});
}

// Execute the actual App command function, with explicit host/selection sinks.
const app=fs.readFileSync('src/App.tsx','utf8'),from=app.indexOf('  function patchSelected('),to=app.indexOf('\n  function undo(',from);
if(from<0||to<0)throw new Error('App command slice missing');
const appRaw=app.slice(from,to),appSlice=stripTypeScriptTypes(appRaw);
const lines=createLineStyleRenderer();
const supportsCornerEditing=w=>w.type!=='treeNode'&&lines.supportsCorners(w);
function fixture(){
 const page=createPage('Independent corners');page.id='review-page';page.widgets=['a','b','equal','arbitrary'].map(id=>({...createWidget('box'),id}));
 page.widgets.forEach((w,i)=>{w.style.radius=[8,18,28,38][i];w.style.cornerVisibility=[[true,false,false,false],[true,true,false,true],[false,false,true,false],[true,true,true,true]][i];w.selectedStyle={fill:['#111111','#222222','#333333','#444444'][i],radius:10+i,cornerVisibility:[true,true,false,Boolean(i%2)]};});
 page.widgets[3].vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:.5,y:1},{op:'Z'}]};
 page.adaptiveViews=[{id:'phone',name:'Phone',width:390,overrides:Object.fromEntries(page.widgets.map((w,i)=>[w.id,{x:10+i,style:{radius:40+i,cornerVisibility:w.style.cornerVisibility}}]))}];
 page.adaptiveOverrides={inactive:Object.fromEntries(page.widgets.map((w,i)=>[w.id,{y:50+i,style:{radius:80+i,cornerVisibility:[true,true,true,true],fill:'#abcdef'}}]))};
 return page;
}
function edit(page,allViews,intent){
 const widgets=resolveAdaptiveWidgets(page,'phone');let result;
 const context={selectedTree:undefined,selectedTreeNode:undefined,treeSelection:undefined,activeMenuRoot:undefined,activeMenu:undefined,selectedTable:undefined,tableSelection:undefined,widgets,current:widgets[0],selected:widgets.map(w=>w.id),supportsCornerEditing,editCornerOverride,mergeWidgetStyle,resolveWidgetStyleCommand,filterLineStylePatch:(_w,p)=>p,changeWidgets:changed=>{result=applyAdaptiveWidgetEdits(page,'phone',changed,{allViews});}};
 Function(...Object.keys(context),`return (${appSlice});`)(...Object.values(context))({},undefined,intent);
 if(!result)throw new Error('App edit did not commit');return result;
}
for(const allViews of [false,true]){
 const page=fixture(),before=structuredClone(page),next=edit(page,allViews,{kind:'corners',command:{kind:'visibility',corner:0,value:false}}),shown=resolveAdaptiveWidgets(next,'phone');
 check(`app-per-target-mask-current-or-all-${allViews}`,shown.map(w=>({radius:w.style.radius,mask:w.style.cornerVisibility})),[{radius:40,mask:[false,false,false,false]},{radius:41,mask:[false,true,false,true]},{radius:42,mask:[false,false,true,false]},{radius:43,mask:[true,true,true,true]}]);
 check(`app-arbitrary-and-equal-inactive-retained-${allViews}`,[next.adaptiveOverrides.inactive.equal,next.adaptiveOverrides.inactive.arbitrary],[before.adaptiveOverrides.inactive.equal,before.adaptiveOverrides.inactive.arbitrary]);
 check(`app-p81-never-clears-inactive-p71-${allViews}`,[next.adaptiveOverrides.inactive.a.style.radius,next.adaptiveOverrides.inactive.b.style.radius],[80,81]);
 check(`app-p81-clears-only-changed-inactive-mask-${allViews}`,[Object.hasOwn(next.adaptiveOverrides.inactive.a.style,'cornerVisibility'),Object.hasOwn(next.adaptiveOverrides.inactive.b.style,'cornerVisibility')],[!allViews,!allViews]);
 const radiusNext=edit(page,allViews,{kind:'corners',command:{kind:'radius',value:40}}),radiusShown=resolveAdaptiveWidgets(radiusNext,'phone');
 check(`app-p71-per-target-mask-retained-${allViews}`,radiusShown.map(w=>({radius:w.style.radius,mask:w.style.cornerVisibility})),[{radius:40,mask:[true,false,false,false]},{radius:40,mask:[true,true,false,true]},{radius:40,mask:[false,false,true,false]},{radius:43,mask:[true,true,true,true]}]);
 check(`app-equal-radius-inactive-retained-${allViews}`,radiusNext.adaptiveOverrides.inactive.a,before.adaptiveOverrides.inactive.a);
 const effectNext=edit(page,allViews,{kind:'corners',effect:'selectedStyle',command:{kind:'visibility',corner:0,value:false}}),effectShown=resolveAdaptiveWidgets(effectNext,'phone');
 check(`app-effects-per-target-retain-radius-and-color-${allViews}`,effectShown.map(w=>w.selectedStyle),page.widgets.map((w,i)=>i===3?w.selectedStyle:{...w.selectedStyle,cornerVisibility:[false,...w.selectedStyle.cornerVisibility.slice(1)]}));
 check(`source-fixture-not-mutated-${allViews}`,page,before);
}

// Verify audit relationships only; do not regenerate the native import or overwrite its report.
const auditFile='research/native-corners-format-import-audit.json',audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
const censusFile='research/native-corners-format-census.json',census=JSON.parse(fs.readFileSync(censusFile,'utf8'));
const stateChanges=audit.samples.flatMap(sample=>(sample.stateChanges??[]).map(record=>({sample,record})));
check('import-audit-six-state-owners',stateChanges.length,6);
check('import-audit-initial-selected-count',stateChanges.filter(({record})=>record.initialSelectedNonCornerPaintPreserved).length,2);
for(const {sample,record}of stateChanges){
 const interaction=record.changes.find(c=>c.path==='interactions.0')?.after;
 const nativeCase=record.sourceInteraction?.events?.[0]?.cases?.[0],sourceId=record.id.slice(38);
 const selected=record.changes.find(c=>c.path==='selectedStyle')?.after,mouseover=record.changes.find(c=>c.path==='mouseOverStyle')?.after;
 check(`import-state-and-action-projection-${sourceId}`,{sourceRetained:hash(sample.file)===sample.sha256,event:interaction?.event,conditions:interaction?.conditions,actions:interaction?.actions?.map(a=>({type:a.type,targetId:a.targetId,value:a.value})),nativeActions:nativeCase?.actions?.map(a=>({type:a.type,targetSourceId:a.targetSourceId,value:a.value})),selectedPatch:selected,hoverPatch:mouseover},{sourceRetained:true,event:'click',conditions:[],actions:[{type:'setSelected',targetId:record.id,value:'true'}],nativeActions:[{type:'setSelected',targetSourceId:sourceId,value:'true'}],selectedPatch:record.sourceSelection.selectedStyle,hoverPatch:record.sourceMouseOver.style});
 const packageId=record.id.slice(5,37),owner=census.widgets.find(w=>w.packageId===packageId&&w.id===sourceId);
 const properties=census.occurrences.filter(o=>o.packageId===packageId&&o.overridden&&o.determined&&o.states?.some(s=>s.styleId===owner?.styleId));
 const rawState=state=>Object.fromEntries(properties.filter(o=>o.states.some(s=>s.state===state&&s.styleId===owner?.styleId)).map(o=>[o.key===71?'radius':'cornerVisibility',o.key===71?o.value:mask(o.value)]));
 check(`raw-od-state-corner-projection-${sourceId}`,{Selected:rawState('Selected'),MouseOver:rawState('MouseOver')},{Selected:{radius:selected.radius,cornerVisibility:selected.cornerVisibility},MouseOver:{radius:mouseover.radius}});
}
check('review-does-not-change-product-source',files.map(bind),sources);
const baseline=sources.map(({path:p})=>({path:`.build/before-native-corners/${p}`})).filter(p=>fs.existsSync(p.path)).map(({path:p})=>bind(p));
const report={capturedAt:new Date().toISOString(),kind:'Read-only independent product review. Module/serialized helpers and actual App command slice with explicit selection/commit sinks. Audit joins are retained metadata checks, not rerun native import or original GUI.',sources,baseline,probe:bind('research/native-corners-final-review-probe.mjs'),evidence:['research/native-corners-evidence.json','research/native-corners-runtime-probes.json','research/native-corners-static-probes.json','research/native-corners-render-review.json','research/native-corners-render-review-observed-failure.json',auditFile,censusFile].map(bind),slices:[{path:'src/App.tsx',startLine:app.slice(0,from).split('\n').length,endLine:app.slice(0,to).split('\n').length-1,sha256:createHash('sha256').update(appRaw).digest('hex')}],results,summary:{passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length},limitations:['No browser/package/original GUI execution.','The unchanged native importer requires the older restricted saved-rectangle recognizer; arbitrary or oversized unproven native snapshots remain rejected rather than inferred.','Native width-zero/pattern-none dynamic SVG skips and managed initial oversized fill differ from declarative product regeneration, as recorded in prior frozen evidence.','Six newly recovered Click actions set selected=true; they are not toggle actions. Two initial selected objects preserve non-corner paint but intentionally correct corner geometry.']};
fs.writeFileSync('research/native-corners-final-review.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
for(const r of results.filter(r=>!r.pass))console.log(JSON.stringify(r));
if(report.summary.failed)process.exitCode=1;
