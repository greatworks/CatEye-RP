import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=x=>createHash('sha256').update(x).digest('hex');
const names=['adaptive.js','repeater.js','init.temp.js','axQuery.std.js'];
const sources=names.map(n=>{const p=path.join(root,n);return{path:p,sha256:hash(fs.readFileSync(p))}});
assert.equal(sources[0].sha256,'e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928');
const ranges=[];
function lines(file,first,last){const s=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/).slice(first-1,last).join('\n');ranges.push({file,first,last,sha256:hash(s)});return s}
const code=lines('adaptive.js',6,43)+'\n'+lines('adaptive.js',48,159)+'\n'+lines('adaptive.js',715,751);
const results=[];
for(const [name,previous,views,initial,target,expected] of [
 ['initial no named views',undefined,[],undefined,undefined,0],
 ['initial Base with named views',undefined,[{id:'phone'}],'default',undefined,0],
 ['initial named view',undefined,[{id:'phone'}],'phone',undefined,1],
 ['named to Base','phone',[],undefined,'',0],
 ['Base to named','',[],undefined,'phone',1],
 ['same named no-op','phone',[],undefined,'phone',0],
]){
 const calls=[],q={each(){},removeClass(){},width:()=>1200,height:()=>900};
 function ax(){return q}
 ax.adaptive={currentViewId:previous,triggerEvent:()=>calls.push('viewChanged')};
 ax.pageData={adaptiveViews:views};ax.document={configuration:{useViews:true}};
 ax.style={clearAdaptiveStyles:()=>calls.push('clearAdaptiveStyles'),reselectElements:()=>{},clearAppliedStyles:()=>calls.push('clearAppliedStyles')};
 ax.visibility={resetLimboAndHiddenToDefaults:()=>{},clearMovedAndResized:()=>calls.push('clearMovedAndResized'),clearLimboAndHidden:()=>{}};
 ax.repeater={refreshAllRepeaters:()=>calls.push('refreshRepeaters')};
 ax.dynamicPanelManager=Object.fromEntries(['updateAllLayerSizeCaches','updateParentsOfNonDefaultFitPanels','updatePercentPanelCache'].map(n=>[n,()=>calls.push(n)]));
 ax.expr={updateAutoFitted:()=>calls.push('updateAutoFitted')};ax.annotation={updateAllFootnotes:()=>{}};
 ax.postAdaptiveViewChanged=()=>calls.push('postChanged');ax.postResize=()=>{};ax.viewChangePageAndMasters=()=>{};
 const axure=()=>q;axure.resize=()=>calls.push('registerResize');
 const c=vm.createContext({$ax:ax,$axure:axure,$:()=>q,window:{},_applyView:id=>calls.push('applyView:'+id),_getAdaptiveView:()=>undefined});
 let error;
 try{vm.runInContext(code,c);vm.runInContext(`_initialViewToLoad=${JSON.stringify(initial)??'undefined'};${target===undefined?'$ax.adaptive.initialize();':`_switchView(${JSON.stringify(target)});`}`,c)}catch(e){error=String(e.stack)}
 const count=calls.filter(x=>x==='updateAllLayerSizeCaches').length;
 results.push({name,previous,views,initial,target,calls,layerUpdates:count,expected,passed:!error&&count===expected,...(error?{error}:{})});
}
const initSequence=lines('init.temp.js',238,251),managerInit=lines('repeater.js',1683,1686);
const report={capturedAt:new Date().toISOString(),kind:'Exact adaptive initialize/switchView source in NodeVM; empty element enumeration and DOM/style/fit/repeater sinks. This proves control-flow calls, not complete page load geometry.',sources,ranges,staticSlices:{initSequence,managerInit},contract:'Initial Base/no named views does not invoke all-Layer cache refresh. Named-view entry does. Returning to Base clears moved/resized caches but does not invoke all-Layer refresh. Other fit/layout/action callbacks may separately update particular Layers.',script:{path:'research/native-layers-runtime-initial-bounds-probe.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},results};
const out=process.argv[2]??'research/native-layers-runtime-initial-bounds-probes.json';assert.ok(!fs.existsSync(out),'Preserve '+out);fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,failures:results.filter(x=>!x.passed)},null,2));if(report.summary.failed)process.exitCode=1;
