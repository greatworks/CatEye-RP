import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createOfflineRuntime} from '../src/runtime/export-runtime.ts';
import {evaluateExpression} from '../src/runtime/expressions.ts';
const sha=v=>createHash('sha256').update(v).digest('hex');
const paths=['src/runtime/export-runtime.ts','src/runtime/expressions.ts','tests/runtime-transform-core-special.test.ts','tests/runtime-transform-core-consumers.test.ts'];
const hashes=()=>paths.map(path=>({path,sha256:sha(fs.readFileSync(path))}));
const before=hashes(),sourcePath='research/runtime-transform-special-final-probes.json',source=JSON.parse(fs.readFileSync(sourcePath));
const original=name=>{const result=source.results.find(r=>r.name===name);assert.ok(result?.passed,name);return result.observed};
let id=0;
const box=(x=100,y=100,width=100,height=50,type='box')=>({id:'w'+(++id),type,name:type,text:'',x,y,width,height,rotation:0,style:{fill:'#fff',stroke:'#000',strokeWidth:0,radius:0,color:'#000',fontFamily:'Arial',fontSize:14,fontWeight:400,textAlign:'left',opacity:1},hidden:false,locked:false,disabled:false,notes:'',interactions:[]});
const document=widgets=>({format:'rea-prototype',version:1,id:'doc'+(++id),name:'Compare',caseSelection:'never',pages:[{id:'p'+(++id),name:'Page',width:1200,height:900,background:'#fff',widgets,notes:'',interactions:[],adaptiveViews:[]}],components:[],variables:{Log:''},styles:[]});
const event=(actions,name='click')=>({id:'event'+(++id),name,event:name,enabled:true,conditions:[],conditionMode:'all',actions:actions.map(a=>({id:'action'+(++id),...a}))});
const special=(patch={})=>({type:'move',move:{targets:[{target:{kind:'widgetsBelow'},mode:'delta',x:{text:'0'},y:{text:'10'},trajectory:'straight',easing:'none',duration:99,...patch}]}});
const itemSize=(width,height)=>({type:'resize',resize:{targets:[{target:{kind:'thisItem'},width:{text:width},height:{text:height},anchor:'bottom right',easing:'easeOutBounce',duration:700}]}});
const results=[];
async function check(name,fn){try{results.push({name,passed:true,observed:await fn()})}catch(e){results.push({name,passed:false,error:e.stack,actual:e.actual,expected:e.expected})}}
for(const portable of [false,true]){
 const factory=portable?runInNewContext('('+createOfflineRuntime.toString()+')',{structuredClone,Date,setTimeout,clearTimeout}):createOfflineRuntime;
 const make=doc=>factory(doc,undefined,evaluateExpression),prefix=portable?'serialized':'module';
 for(const [name,old,current,delta] of [['grow inferred',50,80,null],['shrink inferred',80,50,null],['grow explicit',50,80,12],['shrink explicit',80,50,12],['same explicit',50,50,12],['same inferred',50,50,null],['negative supplied grow',50,80,-12],['negative supplied shrink',80,50,-12]])await check(prefix+'/'+name,async()=>{
  const sourceWidget=box(100,100,100,old),candidate=box(110,200,20,20),doc=document([sourceWidget,candidate]);
  sourceWidget.interactions=[event([special({mode:delta===null?'sizeDeltaY':'delta',y:{text:String(delta??0)}})],'resize')];
  const r=make(doc);try{
   if(old===current)await r.trigger(sourceWidget.id,'resize');else await r.execute(event([{type:'resize',resize:{targets:[{target:{kind:'widget',id:sourceWidget.id},width:{text:'100'},height:{text:String(current)},anchor:'top left',easing:'none',duration:0}]}}]));
   const observed={x:r.widget(candidate).x,y:r.widget(candidate).y},expected=original(name).nodes.u2;assert.equal(observed.x,expected.left);assert.equal(observed.y,expected.top);return{expected:{x:expected.left,y:expected.top},observed};
  }finally{r.dispose()}
 });
 for(const [x,w,y]of [[100,10,150],[199,10,150],[200,10,150],[90,10,150],[90,11,150],[100,10,149.999],[100,10,150.001],[100,0,160]])await check(prefix+`/strict cross overlap ${x}/${w}/${y}`,async()=>{
  const a=box(),b=box(x,y,w,20),doc=document([a,b]);a.interactions=[event([special()])];const r=make(doc);try{await r.trigger(a.id,'click');const expected=original(`strict cross overlap ${x}/${w}/${y}`).nodes.u2;const observed={x:r.widget(b).x,y:r.widget(b).y};assert.equal(observed.x,expected.left);assert.equal(observed.y,expected.top);return{observed,expected}}finally{r.dispose()}
 });
 for(const sample of [
  {name:'thisItem full consumer resizes row and pushes following rows once',vertical:true,index:1,width:'120',height:'35'},
  {name:'thisItem equal dimensions does not emit resize',vertical:true,index:1,width:'100',height:'20'},
  {name:'horizontal row layout shifts only later items primary axis',vertical:false,index:1,width:'130',height:'40'},
  {name:'wrapped vertical primary growth pushes later same-column items',vertical:true,wrap:2,index:0,width:'100',height:'35'},
  {name:'wrapped vertical secondary growth shifts all later columns',vertical:true,wrap:2,index:0,width:'130',height:'20'},
  {name:'wrapped secondary shrink below peer maximum keeps later columns',vertical:true,wrap:2,index:0,width:'80',height:'20'},
  {name:'wrapped shorter primary column does not shrink maximum repeater height',vertical:true,wrap:2,index:2,width:'100',height:'10'},
  {name:'wrapped horizontal secondary growth shifts all later rows',vertical:false,wrap:2,index:0,width:'100',height:'35'},
 ])await check(prefix+'/'+sample.name,async()=>{
  const child=box(0,0,10,10),list=box(0,0,100,60,'repeater'),count=sample.wrap?4:3;child.interactions=[event([itemSize(sample.width,sample.height)])];
  list.interactions=[event([{type:'setVariable',targetId:'Log',value:'[[Log]]R'}],'itemResize')];
  list.repeater={columns:['Name'],rows:Array.from({length:count},(_,i)=>({Name:String(i)})),itemWidth:100,itemHeight:20,gap:0,layout:sample.vertical?'vertical':'horizontal',fitToContent:false,...(sample.wrap?{wrap:sample.wrap}:{}),template:[child]};
  const doc=document([list]),r=make(doc);try{await r.start();const row=r.rows(list)[sample.index];await r.trigger(child.id,'click',row.data,row.context);const expected=original(sample.name),observed=r.rows(list).map((row,i)=>({x:row.x,y:row.y,width:row.width,height:row.height}));
   for(let i=0;i<count;i++){const native=expected.nodes['u100-'+(i+1)];assert.deepEqual(observed[i],{x:native.left,y:native.top,width:native.width,height:native.height})}
   assert.equal(r.state().variables.Log.length,expected.calls.filter(c=>c.kind==='event'&&c.event==='onItemResize').length);
   return{rows:observed,itemResizeCount:r.state().variables.Log.length,nativeFixture:sample.name};
  }finally{r.dispose()}
 });
}
const after=hashes(),report={capturedAt:new Date().toISOString(),kind:'Independent current module/serialized consumers against frozen exact-source special fixtures; no browser',sourcesBefore:before,sourcesAfter:after,sourceDrift:before.filter((s,i)=>s.sha256!==after[i].sha256),originalProbe:{path:sourcePath,sha256:sha(fs.readFileSync(sourcePath))},script:{path:'research/runtime-transform-special-integration-review-probe.mjs',sha256:sha(fs.readFileSync(import.meta.filename))},summary:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},results,limitations:['Minimal independent document records bypass parser and browser box model; all tested borders are zero.','Direct sibling and thisItem scopes only. Native Layer/fixed, independent panel state dimensions and parent fit are not asserted.','Arc8 source samples are independently run by the companion focused existing tests; this new48-case matrix concentrates on unanimated predicates and actual row reflow.','No native-source harness or old frozen evidence modified.']};
const output=process.argv[2]||'research/runtime-transform-special-integration-review-probes.json';assert.ok(!fs.existsSync(output));fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,sourceDrift:report.sourceDrift,failures:results.filter(r=>!r.passed)},null,2));if(report.summary.failed)process.exitCode=1;
