import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {layerHarness} from './native-layers-runtime-probe.mjs';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=x=>createHash('sha256').update(x).digest('hex'),bound=p=>({path:p,sha256:hash(fs.readFileSync(p))}),ranges=[];
const sources=['action.js','axQuery.std.js','move.js'].map(x=>bound(path.join(root,x)));
assert.equal(sources[0].sha256,'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3');
function lines(file,first,last){const s=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/).slice(first-1,last).join('\n');ranges.push({file,first,last,sha256:hash(s)});return s}
const setup=`
$ax.splice=(a,i,n)=>a.splice(i,n);
Q.prototype.each=function(fn){this.xs.forEach((n,i)=>fn.call(n,i,n));return this};
var oldChildren=Q.prototype.children;Q.prototype.children=function(selector){var q=oldChildren.call(this);return selector==='svg.img'?new Q([]):q};
function $jobjAll(id){return $jobj(id)}
$ax.annotation={adjustIconLocation:()=>{}};$ax.flyoutManager={updateFlyout:()=>{}};
$ax.dynamicPanelManager.updatePanelPercentWidth=()=>{};
$ax.dynamicPanelManager.updatePanelContentPercentWidth=()=>{};
$ax.dynamicPanelManager.setFitToContentCss=()=>{};
$ax.public.fn.GetFieldFromStyle=(q,p)=>num(q.css(p));
${lines('action.js',2,349)}
${lines('action.js',818,864)}
${lines('action.js',1061,1065)}
${lines('action.js',1192,1197)}
${lines('action.js',1225,1237)}
${lines('action.js',1240,1256)}
${lines('action.js',1286,1506)}
${lines('axQuery.std.js',570,826)}
A.prototype.resize=$ax.public.fn.resize;
var oldResize=A.prototype.resize;
A.prototype.resize=function(css,info,fire,moves,cb){calls.push({kind:'resize-entry',id:this.id});return oldResize.call(this,css,info,fire,moves,cb)};
var seen=0, priorEval=$ax.expr.evaluateExpr;
$ax.expr.evaluateExpr=function(expr,info){
 if(['X','Y','D'].includes(expr?.value)){
  calls.push({kind:'evaluate',field:expr.value,seen,target:info.targetElement,source:info.srcElement});
  return expr.value==='D'?'90':String(seen);
 }
 return priorEval(expr,info);
};
var priorEvent=$ax.event.raiseSyntheticEvent;
$ax.event.raiseSyntheticEvent=function(id,name){calls.push({kind:'observable-event',id,name,seen});if(name==='onResize')seen++;return priorEvent(id,name)};
A.prototype.circularMoveAndRotate=function(degree,options,x,y,rotates,move,resizeOffset,resizeDeltaMove,complete){
 calls.push({kind:'orbit-sink',id:this.id,degree,x,y,rotates,move,resizeOffset,resizeDeltaMove,seen});
 _fireAnimationFromQueue(this.id,queueTypes.rotate);_fireAnimationFromQueue(this.id,queueTypes.move);if(complete)complete();
};
add('g',{left:100,top:100,width:200,height:100},{type:'layer'},'base');
add('a',{left:100,top:100,width:40,height:20},{type:'vectorShape'},'g');
add('b',{left:140,top:120,width:40,height:20},{type:'vectorShape'},'g');
`;
const results=[];
for(const duration of [0,100]){
 const observed=layerHarness(setup+`
 _addResize('g',{srcElement:'button',targetElement:'prior-target',idToResizeMoveState:{g:{}}},
 {width:{value:'300'},height:{value:'160'},anchor:'top left'},
 {easing:${duration?'\'linear\'':'\'none\''},duration:${duration},stop:{instant:true},rotateStop:{instant:true}},
 undefined,{degree:{value:'D'},offsetX:{value:'X'},offsetY:{value:'Y'},anchor:'bottom right',rotateType:'delta',options:{clockwise:false}});
 var before=currentState();flush();return {before,after:currentState()};
 `);
 const calls=observed.after.calls,evals=calls.filter(x=>x.kind==='evaluate'&&x.field),orbits=calls.filter(x=>x.kind==='orbit-sink');
 assert.deepEqual(evals.map(x=>x.field),['D','X','Y','X','Y']);
 assert.deepEqual(evals.filter(x=>x.field==='X').map(x=>x.target),['g','g']);
 assert.deepEqual(evals.filter(x=>x.field==='Y').map(x=>x.target),['prior-target','prior-target']);
 assert.deepEqual(orbits.map(x=>x.id),['a','b']);
 // Controlled CSS animation completion differs by duration. Record the actual
 // consumer order; no assertion treats this facade as real jQuery timing.
 results.push({duration,passed:true,observed,evals,orbits,order:calls.filter(x=>['evaluate','observable-event','resize-entry','orbit-sink'].includes(x.kind))});
}
const out=process.argv[2]??'research/native-layers-runtime-combined-offset-probes.json';assert.ok(!fs.existsSync(out),'Preserve '+out);
const report={capturedAt:new Date().toISOString(),kind:'Exact Layer Resize producer, queue, public Resize and Move in NodeVM. Expression evaluator is an explicit observation/counter sink; orbit is argument/completion sink. In-memory CSS animation completion is controlled and is not real browser timing. No GUI.',sources,ranges,dependencies:[bound('research/native-layers-runtime-probe.mjs')],script:bound(import.meta.filename),summary:{total:results.length,passed:results.length,failed:0},results};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,results:results.map(({observed,...r})=>r)},null,2));
