import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createOfflineRuntime} from '../src/runtime/export-runtime.ts';
import {evaluateExpression} from '../src/runtime/expressions.ts';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),bound=p=>({path:p,sha256:hash(p)});
const inputs=['src/runtime/export-runtime.ts','src/runtime/expressions.ts','research/native-layers-runtime-init-compress-first-probes.json','research/native-layers-runtime-initial-bounds-probes.json','research/native-layers-runtime-combined-offset-probes.json'].map(bound);
const style={fill:'#fff',stroke:'#000',strokeWidth:0,radius:0,fontFamily:'Arial',fontSize:13,fontWeight:'normal',color:'#000',textAlign:'left',verticalAlign:'top',opacity:1};
const box=(id,x,y,width,height)=>({id,type:'box',name:id,x,y,width,height,rotation:0,style:{...style},interactions:[]});
const layer=(id,children,x=100,y=100,width=100,height=120)=>({...box(id,x,y,width,height),type:'layer',layer:{widgets:children}});
const ix=(id,event,actions)=>({id,name:id,event,enabled:true,conditions:[],conditionMode:'all',actions:actions.map((a,i)=>({id:id+'-'+i,...a}))});
const doc=widgets=>({format:'rea-prototype',version:1,id:'doc',name:'Layer consumers',caseSelection:'never',pages:[{id:'page',name:'Page',width:1200,height:900,background:'#fff',widgets,notes:'',adaptiveViews:[],interactions:[],adaptiveSelection:'native-size',adaptiveBaseSize:{width:1200,height:0}}],components:[],variables:{V:'0'},styles:[]});
const results=[];
for(const portable of [false,true]){
 const factory=portable?runInNewContext('('+createOfflineRuntime.toString()+')',{structuredClone,Date,setTimeout,clearTimeout}):createOfflineRuntime;
 async function test(name,make,check){let runtime,observed,error;try{const f=make();runtime=factory(f.document,undefined,f.evaluator??evaluateExpression,undefined,{});observed=await f.run(runtime);check(observed)}catch(e){error=String(e.stack)}finally{runtime?.dispose()}results.push({name,portable,passed:!error,observed,...(error?{error}:{})});}
 await test('Initial Base data bounds → named runtime bounds → Base data fallback',()=>{
  const a=box('a',100,80,40,20),h={...box('h',300,200,40,20),hidden:true},g=layer('g',[a,h],100,80,240,140),document=doc([g]);
  document.pages[0].adaptiveViews=[{id:'named',name:'Named',width:390,overrides:{}}];
  const rect=r=>{const w=r.widget(g);return{x:w.x,y:w.y,width:w.width,height:w.height}};
  return{document,run:async r=>{const before=rect(r);await r.start();const base=rect(r);await r.setAdaptiveView({kind:'view',viewId:'named'});const named=rect(r);await r.setAdaptiveView({kind:'base'});return{before,base,named,restored:rect(r)}}};
 },r=>assert.deepEqual(r,{before:{x:100,y:80,width:240,height:140},base:{x:100,y:80,width:240,height:140},named:{x:100,y:80,width:40,height:20},restored:{x:100,y:80,width:240,height:140}}));
 for(const mode of ['visible','nested','hidden','siblingLayer'])await test('Compression '+mode,()=>{
  const a=box('u1',100,100,100,50),b=box('u2',100,200,100,20),c=box('u3',100,250,100,20);
  const g=layer('u10',mode==='nested'?[layer('u11',[a,b])]:[a,b]);if(mode==='hidden')g.hidden=true;
  const d=box('u21',100,300,100,20),e=box('u22',100,340,100,20);
  const widgets=[g,c];if(mode==='siblingLayer')widgets.push(layer('u20',[d,e],100,300,100,60));
  a.interactions=[ix('compress','click',[{type:'move',move:{targets:[{target:{kind:'widgetsBelow'},mode:'delta',x:{text:'0'},y:{text:'10'},trajectory:'straight',easing:'none',duration:0}]}}])];
  return{document:doc(widgets),run:async r=>{await r.trigger('u1','click');return{b:r.widget(b).y,c:r.widget(c).y,...(mode==='siblingLayer'?{d:r.widget(d).y,e:r.widget(e).y}:{})}}};
 },r=>{if(mode==='hidden')assert.equal(r.c,250);else assert.deepEqual(r,{b:210,c:260,...(mode==='siblingLayer'?{d:310,e:350}:{})})});
 await test('Combined Resize+Rotate offsets evaluated per leaf, after root events, with original Y target',()=>{
  const a=box('a',100,100,40,20),b=box('b',140,120,40,20),g=layer('g',[a,b],100,100,200,100),button=box('button',500,400,50,20);
  for(const w of [g,a,b])w.interactions=[ix(w.id+'-resize','resize',[{type:'setVariable',targetId:'V',value:'[[V+1]]'}])];
  button.interactions=[ix('combined','click',[
   {type:'resize',resize:{targets:[{target:{kind:'widget',id:'g'},width:{text:'300'},height:{text:'160'},anchor:'top left',easing:'linear',duration:64}]}},
   {type:'rotate',targetId:'g',rotate:{mode:'by',degrees:'[[D]]',clockwise:false,anchor:'bottom right',offsetX:'[[X]]',offsetY:'[[Y]]',easing:'linear',duration:64}},
  ])];
  const evals=[];
  const evaluator=(expression,read,mode)=>{
   if(['D','X','Y'].includes(expression)){evals.push({field:expression,value:Number(read('V')),targetWidth:read('Target.width')??null});return expression==='D'?'90':String(read('V'))}
   return evaluateExpression(expression,read,mode);
  };
  return{document:doc([g,button]),evaluator,run:async r=>{await r.trigger('button','click');return{evals,rotation:r.widget(g).rotation,children:[r.widget(a),r.widget(b)].map(w=>({x:w.x,y:w.y,width:w.width,height:w.height,rotation:w.rotation}))}}};
 },r=>{
  assert.deepEqual(r.evals.map(x=>x.field),['D','X','Y','X','Y']);
  assert.deepEqual(r.evals.map(x=>x.value),[1,1,1,1,1]);
  assert.deepEqual(r.evals.filter(x=>x.field==='X').map(x=>x.targetWidth),[200,200]);
  assert.deepEqual(r.evals.filter(x=>x.field==='Y').map(x=>x.targetWidth),[null,null]);
  assert.equal(r.rotation,90);assert.ok(r.children.every(x=>x.width===60&&x.height===32&&x.rotation===90));
 });
}
const out=process.argv[2]??'research/native-layers-runtime-final-consumers-probes.json';assert.ok(!fs.existsSync(out),'Preserve '+out);
const report={capturedAt:new Date().toISOString(),kind:'Actual product module/serialized runtime compared with bounded source contracts. Uses real Node timers for a 64ms combined action; no browser. Combined evaluator records source-equivalent field reads but is an explicit callback facade, not Axure expression compilation; final orbit pixels are not compared.',inputs,inputStable:inputs.every(x=>hash(x.path)===x.sha256),script:bound(import.meta.filename),summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},results};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,inputStable:report.inputStable,failures:results.filter(x=>!x.passed)},null,2));
