import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {layerHarness} from './native-layers-runtime-probe.mjs';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=x=>createHash('sha256').update(x).digest('hex');
const pins=JSON.parse(fs.readFileSync('research/native-layers-runtime-second-probes.json','utf8')).sources;
for(const p of pins)assert.equal(hash(fs.readFileSync(p.path)),p.sha256);
const ranges=[];
function lines(file,first,last){const v=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/).slice(first-1,last).join('\n');ranges.push({file,first,last,sha256:hash(v)});return v}
const state=`
var disabled={},_selectedWidgets={},SELECTED='selected';
function _isWidgetDisabled(id){return !!disabled[id]}function _widgetHasState(){return false}
$ax.style.IsWidgetSelected=id=>!!_selectedWidgets[id];
$ax.style.SetWidgetEnabled=(id,value)=>{disabled[id]=!value;calls.push({kind:'enabled',id,value})};
$ax.style.SetWidgetError=(id,value)=>calls.push({kind:'error',id,value});
$ax.event.raiseSelectedEvents=(id,value)=>calls.push({kind:'selectedEvent',id,value});
$ax.getPathFromScriptId=id=>[id];$ax.getElementIdFromPath=p=>p.at(-1);$ax.INPUT=id=>id+'_input';
var priorAxure=$axure;$axure=function(s){return $ax(s)};Object.assign($axure,priorAxure);
${lines('axQuery.std.js',1087,1178)}
${lines('style.js',186,253)}
A.prototype.enabled=$ax.public.fn.enabled;A.prototype.error=$ax.public.fn.error;
A.prototype.selected=function(v){$ax.style.SetWidgetSelected(this.id,v)};
$ax.repeater.refreshType={reset:0,preEval:1,persist:2};
function initializeLayer(elementId,itemId,refreshType){var dObj=$obj(elementId),isDynamicPanel=false,$element=$jobj(elementId),skipSelectedIds=new Set();
${lines('events.js',805,838)}
}
`;
const compression=`
${lines('axQuery.std.js',1662,1668)}
A.prototype.left=$ax.public.fn.left;A.prototype.top=$ax.public.fn.top;
A.prototype.width=$ax.public.fn.width;A.prototype.height=$ax.public.fn.height;
`;
const fixture=`add('u10',{left:100,top:100,width:100,height:120},{type:'layer'},'base');add('u1',{left:100,top:100,width:100,height:50},{type:'vectorShape'},'u10');add('u2',{left:100,top:200,width:100,height:20},{type:'vectorShape'},'u10');add('u3',{left:100,top:250,width:100,height:20},{type:'vectorShape'},'base');`;
const results=[];
function test(name,code,check){let observed;try{observed=layerHarness(code);check(observed);results.push({name,passed:true,observed})}catch(e){results.push({name,passed:false,observed,error:String(e.stack)})}}
for(const [item,refresh,label] of [['',2,'page'],['1',0,'row reset'],['1',2,'row persist']]){
 test(`Layer authored state initialization ${label}`,state+fixture+`objects.u10.error=true;objects.u10.selected=true;objects.u10.disabled=true;initializeLayer('u10',${JSON.stringify(item)},${refresh});return currentState();`,r=>{
  const events=r.calls.filter(x=>['error','selectedEvent','enabled'].includes(x.kind));
  assert.deepEqual(events.map(x=>[x.kind,x.id]),label==='row persist'?[]:[['error','u10'],['error','u1'],['error','u2'],['selectedEvent','u1'],['selectedEvent','u2'],['selectedEvent','u10'],['enabled','u10'],['enabled','u1'],['enabled','u2']]);
 });
}
test('Visible Layer source compression crosses to enclosing scope',compression+fixture+`_dynamicPanelManager.compressMove('u1',true,false,{left:100,top:100,width:100,height:50,right:200,bottom:150},'none',0,10);flush();return currentState();`,r=>{assert.equal(r.nodes.u2.top,210);assert.equal(r.nodes.u3.top,260);assert.deepEqual(r.calls.filter(x=>x.kind==='moveBy').map(x=>x.id),['u2','u3'])});
test('Sibling Layer below threshold is moved as one Layer, not independently twice',compression+fixture+`add('u20',{left:100,top:300,width:100,height:60},{type:'layer'},'base');add('u21',{left:100,top:300,width:100,height:20},{type:'vectorShape'},'u20');add('u22',{left:100,top:340,width:100,height:20},{type:'vectorShape'},'u20');_dynamicPanelManager.compressMove('u1',true,false,{left:100,top:100,width:100,height:50,right:200,bottom:150},'none',0,10);flush();return currentState();`,r=>{assert.deepEqual(r.calls.filter(x=>x.kind==='moveBy').map(x=>x.id),['u2','u3','u20']);assert.equal(r.nodes.u21.top,310);assert.equal(r.nodes.u22.top,350)});
test('Nested visible Layers do not isolate compression from outer sibling',compression+fixture+`add('u11',{left:100,top:100,width:100,height:120},{type:'layer'},'u10');nodes.u10.children=nodes.u10.children.filter(n=>n.id!=='u1'&&n.id!=='u2');for(var id of ['u1','u2']){nodes[id].parent='u11';nodes[id].declaredParent='u11';nodes.u11.children.push(nodes[id])};_dynamicPanelManager.compressMove('u1',true,false,{left:100,top:100,width:100,height:50,right:200,bottom:150},'none',0,10);flush();return currentState();`,r=>{assert.equal(r.nodes.u2.top,210);assert.equal(r.nodes.u3.top,260)});
test('Hidden Layer is a compression scope barrier to outer siblings',compression+fixture+`nodes.u10.style.visibility='hidden';nodes.u10.style.display='none';_dynamicPanelManager.compressMove('u1',true,false,{left:100,top:100,width:100,height:50,right:200,bottom:150},'none',0,10);flush();return currentState();`,r=>{assert.equal(r.nodes.u3.top,250);assert.ok(!r.calls.some(x=>x.kind==='moveBy'&&x.id==='u3'))});
const out=process.argv[2]??'research/native-layers-runtime-init-compress-probes.json';
assert.ok(!fs.existsSync(out),'Preserve '+out);
const report={capturedAt:new Date().toISOString(),kind:'Exact init branch + state query consumers, and original compression/Move consumer chain in the existing declared in-memory DOM facade. No browser/GUI. Hidden-container inner geometry remains facade-dependent.',sources:pins,ranges,script:{path:'research/native-layers-runtime-init-compress-probe.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},dependency:{path:'research/native-layers-runtime-probe.mjs',sha256:hash(fs.readFileSync('research/native-layers-runtime-probe.mjs'))},summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},results};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,failures:results.filter(x=>!x.passed)},null,2));
if(report.summary.failed)process.exitCode=1;
