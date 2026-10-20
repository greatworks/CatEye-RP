import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { createOfflineRuntime } from '../src/runtime/export-runtime.ts';
import { layerHarness } from './native-layers-runtime-probe.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bound = file => ({ path: file, sha256: hash(fs.readFileSync(file)) });
const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sources = ['events.js','style.js','axQuery.std.js'].map(file => bound(path.join(root,file)));
assert.equal(sources[0].sha256,'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3');
assert.equal(sources[1].sha256,'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c');
const ranges = [];
function slice(file, first, last) {
  const value = fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/).slice(first-1,last).join('\n');
  ranges.push({ file, first, last, sha256: hash(value) }); return value;
}
const setup = `
var _disabledWidgets={},_selectedWidgets={},SELECTED='selected',errors={};
${slice('style.js',322,324)}
function _widgetHasState(){return false}
$ax.style.IsWidgetSelected=id=>!!_selectedWidgets[id];
$ax.style.SetWidgetEnabled=(id,value)=>{_disabledWidgets[id]=!value;calls.push({kind:'enabled',id,value})};
$ax.style.SetWidgetError=(id,value)=>{if(!_isWidgetDisabled(id)){errors[id]=value;calls.push({kind:'error',id,value})}};
$ax.event.raiseSelectedEvents=(id,value)=>calls.push({kind:'selectedEvent',id,value});
$ax.getPathFromScriptId=id=>[id];$ax.getElementIdFromPath=p=>p.at(-1);$ax.INPUT=id=>id+'_input';
var priorAxure=$axure;$axure=function(s){return $ax(s)};Object.assign($axure,priorAxure);
${slice('axQuery.std.js',1087,1178)}
${slice('style.js',186,253)}
A.prototype.enabled=$ax.public.fn.enabled;A.prototype.error=$ax.public.fn.error;
A.prototype.selected=function(v){$ax.style.SetWidgetSelected(this.id,v)};
$ax.repeater.refreshType={reset:0,preEval:1,persist:2};
function initializeLayer(elementId){var dObj=$obj(elementId),itemId='',refreshType=0,isDynamicPanel=false,$element=$jobj(elementId),skipSelectedIds=new Set();
${slice('events.js',805,838)}
}
add('g',{left:100,top:100,width:20,height:20},{type:'layer'},'base');
add('a',{left:100,top:100,width:20,height:20},{type:'vectorShape'},'g');
objects.g.disabled=true;
`;
const implementation = bound('src/runtime/export-runtime.ts');
const style = { fill:'#fff',stroke:'#000',strokeWidth:0,radius:0,fontFamily:'Arial',fontSize:13,fontWeight:'normal',color:'#000',textAlign:'left',verticalAlign:'top',opacity:1 };
const box = id => ({ id,type:'box',name:id,x:100,y:100,width:20,height:20,rotation:0,style:{...style},interactions:[] });
const results = [];
for (const field of ['selected','error']) {
  const native = layerHarness(setup+`objects.g.${field}=true;initializeLayer('g');return {selected:_selectedWidgets,error:errors,disabled:_disabledWidgets,calls};`);
  assert.equal(native[field].a,true);
  assert.equal(native.disabled.a,true);
  for (const portable of [false,true]) {
    const child = box('a'), layer = { ...box('g'),type:'layer',disabled:true,[field]:true,layer:{widgets:[child]} };
    const doc = { format:'rea-prototype',version:1,id:'doc',name:'Initial Layer state',caseSelection:'never',pages:[{id:'page',name:'Page',width:1200,height:900,background:'#fff',widgets:[layer],notes:'',adaptiveViews:[]}],components:[],variables:{},styles:[] };
    const factory = portable ? runInNewContext('('+createOfflineRuntime.toString()+')',{structuredClone,Date,setTimeout,clearTimeout}) : createOfflineRuntime;
    const runtime = factory(doc);
    let observed,error;
    try {
      await runtime.start();
      const value = runtime.widget(child);
      observed = { selected:!!value.selected,error:!!value.error,disabled:!!value.disabled };
    } catch(e) { error=String(e.stack); }
    finally { runtime.dispose(); }
    results.push({field,portable,native,observed,expected:{[field]:true,disabled:true},passed:!error&&observed[field]===true&&observed.disabled===true,...(error?{error}:{})});
  }
}
const out = process.argv[2] ?? 'research/native-layers-runtime-initial-state-review-first.json';
assert.ok(!fs.existsSync(out),'Preserve '+out);
const report = {
  capturedAt:new Date().toISOString(),finding:'NLR-REVIEW-02',
  kind:'Original init branch and Selected/query recursion in NodeVM; style painting, event delivery and geometry are declared facades. Product module/serialized runtime start is executed directly. No browser or original GUI.',
  sources,ranges,implementation,sourceStable:bound(implementation.path).sha256===implementation.sha256,
  dependencies:[bound('research/native-layers-runtime-probe.mjs')],script:bound('research/native-layers-runtime-initial-state-review-probe.mjs'),
  summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},results,
};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({implementation,sourceStable:report.sourceStable,summary:report.summary,results:results.map(({native,...rest})=>rest)},null,2));
