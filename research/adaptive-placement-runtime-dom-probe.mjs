import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const specs=[['visibility.js',15,32],['visibility.js',40,124],['visibility.js',148,607],['visibility.js',1267,1345],['visibility.js',1433,1444],['style.js',349,592],['style.js',1763,1915],['adaptive.js',245,317],['repeater.js',1483,1526]];
const files=Object.fromEntries([...new Set([...specs.map(s=>s[0]),'../jquery-3.7.1.min.js'])].map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')]));
const previous=JSON.parse(fs.readFileSync('research/adaptive-placement-runtime-probe.json','utf8'));
for(const file of previous.sources){const name=path.basename(file.path);if(files[name])assert.equal(sha(files[name]),file.sha256);}
assert.equal(sha(files['../jquery-3.7.1.min.js']),'8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85');
const slices=specs.map(([file,first,last])=>{const text=files[file].split(/\r?\n/).slice(first-1,last).join('\n');return{file,first,last,sha256:sha(text),text};});
const setup=`
var objects={},ids=[],events=[],paint=[],_visibility={},_style={},_repeaterManager={},_shapesWithSetRichText={},_defaultHidden={},_defaultLimbo={};
var HIDDEN_CLASS='ax_default_hidden',UNPLACED_CLASS='ax_default_unplaced',SELECTED_ClASS='selected',MOBILE_DEVICE=false;
var $jobj=id=>$('#'+id),$obj=id=>objects[id&&id.split('-')[0]],_generateFullState=()=> 'normal';
var _getAdaptiveIdChain=id=>id==='leaf'?['ancestor','leaf']:id?[id]:[];
var $ax=()=>({each:fn=>ids.forEach(id=>fn($obj(id),id))});
Object.assign($ax,{visibility:_visibility,style:_style,repeater:_repeaterManager,deepCopy:x=>structuredClone(x),
 getObjectFromElementId:$obj,getParentRepeaterFromElementIdExcludeSelf:id=>$obj(id)?.repeater,getParentRepeaterFromScriptId:id=>$obj(id)?.repeater,getItemIdsForRepeater:()=>['1','2'],
 adaptive:{getAdaptiveIdChain:_getAdaptiveIdChain,isDeviceMode:()=>false},document:{stylesheet:{defaultStyle:{},stylesById:{}}},
 public:{fn:{IsReferenceDiagramObject:t=>t==='referenceDiagramObject',IsDynamicPanel:t=>t==='dynamicPanel',IsLayer:t=>t==='layer',IsTableCell:t=>t==='tableCell',convertToSingleImage:()=>{}}},constants:{CONNECTOR_TYPE:'connector'},
 dynamicPanelManager:{isIdFitToContent:()=>false,isPercentWidthPanel:()=>false,updatePercentPanelCache:()=>{}},model:{idsInRdoToHideOrLimbo:()=>[]},
 event:{raiseSyntheticEvent:(id,name)=>events.push([id,name])},action:{queueTypes:{fade:'fade'},fireAnimationFromQueue:()=>{}},flyoutManager:{unregisterPanel:()=>{}}});
${slices.map(s=>s.text).join('\n')}
_style.setAdaptiveStyle=(id,s)=>paint.push([id,structuredClone(s)]);
function reset(records){document.body.replaceChildren();objects={};ids=[];events=[];paint=[];_defaultHidden={};_defaultLimbo={};_clearLimboAndHidden();
 for(const raw of records){const o=objects[raw.id]={type:'buttonShape',isContained:false,style:{},adaptiveStyles:{},owner:{type:'Axure:Page'},...raw};for(const id of raw.elementIds||[raw.id]){const n=document.createElement('div');n.id=id;n.style.cssText='position:relative;width:100px;height:40px;background:#aaddff;';n.className=(raw.classes||[]).join(' ');n.textContent=id;const input=document.createElement('input');input.value='unsaved local value';input.dataset.probe='input';n.append(input);document.body.append(n);ids.push(id);}}
 for(const o of Object.values(objects)){if(typeof o.parent==='string')o.parent=objects[o.parent];if(o.domParent)for(const id of o.elementIds||[o.id])document.getElementById(o.domParent).append(document.getElementById(id));}}
function apply(view){_clearLimboAndHidden();$ax.adaptive.applyView(view);}
function snap(id){const n=document.getElementById(id),css=getComputedStyle(n);return{id,exists:!!n,ownVisible:$ax.visibility.IsIdVisible(id),display:css.display,visibility:css.visibility,rectCount:n.getClientRects().length,offsetWidth:n.offsetWidth,connected:n.isConnected,field:n.querySelector('input').value,ancestorLimbo:$ax.visibility.isElementIdLimboOrInLimboContainer(id),limbo:structuredClone(_limboIds),events:structuredClone(events)};}
window.probe={reset,apply,snap,initialize:()=>_visibility.initialize(),base:()=>_visibility.resetLimboAndHiddenToDefaults(),show:id=>_setWidgetVisibility(id,{value:true,noContainer:true,fire:true})};
`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:800,height:600}}),page=await context.newPage(),network=[],errors=[],results=[];
await context.route('**/*',route=>{network.push(route.request().url());return route.abort();});page.on('pageerror',e=>errors.push(e.message));
async function run(name,records,ops,verify){const observed=await page.evaluate(({records,ops})=>{probe.reset(records);const snapshots=[];for(const op of ops){if(op[0]==='apply')probe.apply(op[1]);else if(op[0]==='show')probe.show(op[1]);else probe[op[0]]();snapshots.push(probe.snap(op[2]||'w'));}return snapshots;},{records,ops});verify(observed);results.push({name,observed});}
try{
 await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:files['../jquery-3.7.1.min.js']});await page.addScriptTag({content:setup});
 await run('placed visible block has layout',[{id:'w'}],[['apply','leaf']],o=>{assert.equal(o[0].offsetWidth,100);assert.equal(o[0].rectCount,1);assert.equal(o[0].display,'block');});
 await run('unplaced block remains in DOM with local input value',[{id:'w',style:{limbo:true}}],[['apply','leaf']],o=>{assert.equal(o[0].display,'none');assert.equal(o[0].visibility,'hidden');assert.equal(o[0].rectCount,0);assert.equal(o[0].connected,true);assert.equal(o[0].field,'unsaved local value');});
 await run('hidden placed block can be shown',[{id:'w',style:{visible:false}}],[['apply','leaf'],['show','w']],o=>{assert.deepEqual(o[0].limbo,{});assert.equal(o[1].offsetWidth,100);assert.deepEqual(o[1].events,[['w','onShow']]);});
 await run('unplaced direct show cannot restore layout',[{id:'w',style:{limbo:true}}],[['apply','leaf'],['show','w']],o=>{assert.equal(o[1].rectCount,0);assert.deepEqual(o[1].events,[]);});
 await run('parent unplaced has physically hidden but internally visible child',[{id:'p',type:'dynamicPanel',style:{limbo:true}},{id:'w',domParent:'p'}],[['apply','leaf']],o=>{assert.equal(o[0].ownVisible,true);assert.equal(o[0].display,'block');assert.equal(o[0].rectCount,0);assert.equal(o[0].ancestorLimbo,true);assert.deepEqual(o[0].limbo,{p:true});});
 await run('Base class snapshot returns after placed view without recreating DOM',[{id:'w',classes:['ax_default_unplaced'],adaptiveStyles:{placed:{limbo:false}}}],[['initialize'],['apply','placed'],['base']],o=>{assert.equal(o[0].rectCount,0);assert.equal(o[1].offsetWidth,100);assert.equal(o[2].rectCount,0);assert.equal(o[2].field,'unsaved local value');assert.deepEqual(o[2].events,[]);});
 await run('view transition restores placed geometry and preserves field value',[{id:'w',adaptiveStyles:{away:{limbo:true},back:{limbo:false}}}],[['apply','away'],['apply','back']],o=>{assert.equal(o[0].rectCount,0);assert.equal(o[1].offsetWidth,100);assert.equal(o[1].field,'unsaved local value');assert.deepEqual(o[1].events,[]);});
 await run('contained own limbo declaration is not applied directly',[{id:'p'},{id:'w',isContained:true,parent:'p',domParent:'p',style:{limbo:true}}],[['apply','leaf']],o=>{assert.equal(o[0].offsetWidth,100);assert.deepEqual(o[0].limbo,{});});
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 const report={kind:'Isolated real Edge DOM with exact retained visibility/adaptive/style/repeater ID slices and retained jQuery; synthetic object records. Not original GUI or full generated prototype.',browser:browser.version(),sources:Object.entries(files).map(([file,text])=>({path:path.join(root,file),sha256:sha(text)})),slices:slices.map(({text,...s})=>s),boundaries:['CSS image/text paint and animation queue are explicit sinks; no animation path exercised.','Original ordinary nonanimated visibility/limbo functions execute against actual DOM.','DOM retention and client rectangles are observed; no native editor Place/Unplace interaction or master/repeater full lifecycle claimed.'],results,summary:{total:results.length,passed:results.length,failed:0},network,errors};
 fs.writeFileSync('research/adaptive-placement-runtime-dom-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,browser:report.browser,network,errors}));
}finally{await context.close();await browser.close();}
