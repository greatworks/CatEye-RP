import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {layerHarness} from './native-layers-runtime-probe.mjs';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=x=>createHash('sha256').update(x).digest('hex'),bound=p=>({path:p,sha256:hash(fs.readFileSync(p))}),ranges=[];
const sources=['events.js','style.js','axQuery.std.js'].map(x=>bound(path.join(root,x)));
assert.equal(sources[0].sha256,'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3');
function lines(file,first,last){const s=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/).slice(first-1,last).join('\n');ranges.push({file,first,last,sha256:hash(s)});return s}
const setup=`
var _disabledWidgets={},_selectedWidgets={},SELECTED='selected',errors={};
${lines('style.js',322,324)}
function _widgetHasState(){return false}
$ax.style.IsWidgetSelected=id=>!!_selectedWidgets[id];
$ax.style.SetWidgetEnabled=(id,value)=>{_disabledWidgets[id]=!value;calls.push({kind:'enabled',id,value})};
$ax.style.SetWidgetError=(id,value)=>{if(!_isWidgetDisabled(id)){errors[id]=value;calls.push({kind:'error',id,value})}};
$ax.event.raiseSelectedEvents=(id,value)=>calls.push({kind:'selectedEvent',id,value});
$ax.getPathFromScriptId=id=>[id];$ax.getElementIdFromPath=p=>p.at(-1);$ax.INPUT=id=>id+'_input';
var priorAxure=$axure;$axure=function(s){return $ax(s)};Object.assign($axure,priorAxure);
${lines('axQuery.std.js',1087,1178)}
${lines('style.js',186,253)}
A.prototype.enabled=$ax.public.fn.enabled;A.prototype.error=$ax.public.fn.error;
A.prototype.selected=function(v){$ax.style.SetWidgetSelected(this.id,v)};
$ax.repeater.refreshType={reset:0,preEval:1,persist:2};
function init(elementId){var dObj=$obj(elementId),itemId='',refreshType=0,isDynamicPanel=false,$element=$jobj(elementId),skipSelectedIds=new Set();
${lines('events.js',805,838)}
}
add('g',{left:100,top:100,width:20,height:20},{type:'layer'},'base');
add('a',{left:100,top:100,width:20,height:20},{type:'vectorShape'},'g');
`;
const results=[];
for(const rootSelected of [false,true])for(const rootDisabled of [false,true])for(const childSelected of [false,true])for(const childDisabled of [false,true]){
 const input={rootSelected,rootDisabled,childSelected,childDisabled};
 const observed=layerHarness(setup+`
objects.g.selected=${rootSelected};objects.g.disabled=${rootDisabled};
objects.a.selected=${childSelected};objects.a.disabled=${childDisabled};
init('g');init('a');
return {root:{selected:!!_selectedWidgets.g,disabled:!!_disabledWidgets.g},child:{selected:!!_selectedWidgets.a,disabled:!!_disabledWidgets.a},events:calls.filter(x=>x.kind==='selectedEvent'),calls};
`);
 // Independent expectation is a compact assertion, not the evidence producer.
 const expected={root:{selected:rootSelected,disabled:rootDisabled},child:{selected:rootSelected||!rootDisabled&&childSelected,disabled:rootDisabled||childDisabled}};
 assert.deepEqual({root:observed.root,child:observed.child},expected);
 assert.equal(observed.events.length,Number(expected.root.selected)+Number(expected.child.selected));
 results.push({input,observed,expected,passed:true});
}
const out=process.argv[2]??'research/native-layers-runtime-initial-state-matrix-probes.json';assert.ok(!fs.existsSync(out),'Preserve '+out);
const report={capturedAt:new Date().toISOString(),kind:'Exact events init branch, query state recursion and Selected consumer with initially empty state dictionaries in NodeVM. Style paint and event dispatch are sinks. Controlled parent-before-child enumeration matches the retained generated object ordering; no browser/GUI.',sources,ranges,dependencies:[bound('research/native-layers-runtime-probe.mjs')],script:bound(import.meta.filename),summary:{total:results.length,passed:results.length,failed:0},results};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,results},null,2));
