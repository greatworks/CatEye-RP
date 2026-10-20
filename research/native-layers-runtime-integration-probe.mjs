import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { createOfflineRuntime } from '../src/runtime/export-runtime.ts';
import { layerHarness } from './native-layers-runtime-probe.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const bound=p=>({path:p,sha256:hash(fs.readFileSync(p))});
const sources=[bound('src/runtime/export-runtime.ts'),bound('research/native-layers-runtime-probe.mjs'),bound('research/native-layers-runtime-manifest.json')];
const native=layerHarness(`var r=_populateBoundingRect({left:100,top:100,width:200,height:100});add('a',{left:140,top:120,width:40,height:20},{type:'vectorShape',rotation:90},'base');var delta={x:0,y:0};var css=_getCssForResizingLayerChild('a','top left',r,.5,.6,delta);return {css,delta};`);
assert.deepEqual(native,{css:{height:32,width:60},delta:{x:20,y:12}});
const style={fill:'#fff',stroke:'#000',strokeWidth:0,radius:0,fontFamily:'Arial',fontSize:13,fontWeight:'normal',color:'#000',textAlign:'left',verticalAlign:'top',opacity:1};
const box=(id,x,y,width,height,rotation=0)=>({id,type:'box',name:id,x,y,width,height,rotation,style:{...style},interactions:[]});
const guide=box('guide',100,100,200,100),a=box('a',140,120,40,20,90);
const root={...box('g',100,100,200,100),type:'layer',layer:{widgets:[guide,a]}};
const button=box('button',500,500,50,20);
button.interactions=[{id:'click',name:'click',event:'click',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'size',type:'resize',resize:{targets:[{target:{kind:'widget',id:'g'},width:{text:'300'},height:{text:'160'},anchor:'top left',easing:'none',duration:0}]}}]}];
const doc={format:'rea-prototype',version:1,id:'doc',name:'Layer rotated resize',caseSelection:'never',pages:[{id:'page',name:'Page',width:1200,height:900,background:'#fff',widgets:[root,button],notes:'',adaptiveViews:[]}],components:[],variables:{},styles:[]};
const results=[];
for(const portable of [false,true]){
 const factory=portable?runInNewContext('('+createOfflineRuntime.toString()+')',{structuredClone,Date,setTimeout,clearTimeout}):createOfflineRuntime;
 const runtime=factory(structuredClone(doc));
 try{
  await runtime.trigger('button','click');
  const w=runtime.widget(a),observed={x:w.x,y:w.y,width:w.width,height:w.height},expected={x:160,y:132,width:60,height:32};
  results.push({portable,observed,expected,passed:Object.keys(expected).every(k=>Math.abs(observed[k]-expected[k])<1e-9)});
 }catch(e){results.push({portable,passed:false,error:String(e.stack)})}finally{runtime.dispose()}
}
const report={capturedAt:new Date().toISOString(),finding:'NLR-REVIEW-01',description:'Layer top/left Resize uses rotated AABB origin instead of original offsetLocation() ignoring rotation.',kind:'Actual module/serialized implementation compared with exact-source Resize helper in a declared NodeVM geometry facade; no original GUI/browser.',sources,sourceStable:sources.every(x=>bound(x.path).sha256===x.sha256),native,results,summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},script:bound('research/native-layers-runtime-integration-probe.mjs')};
const out=process.argv[2]??'research/native-layers-runtime-integration-first-probes.json';
assert.ok(!fs.existsSync(out),'Preserve '+out);fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
