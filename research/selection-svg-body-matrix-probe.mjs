import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fields} from './gradient-angle-static-flow.mjs';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['research/selection-svg-body-matrix-command-cil.json','research/selection-svg-body-matrix-dependencies-cil.json','research/selection-svg-body-matrix-arithmetic-cil.json','research/selection-svg-body-matrix-restore-cil.json','research/selection-svg-body-matrix-restore-iterator-cil.json','research/line-style-svg-writer-cil.json','research/selection-layout-border-asset-cil.json'];
const methods=new Map();for(const file of files)for(const type of JSON.parse(fs.readFileSync(file)).Types)for(const m of type.Methods)methods.set(m.Token,{...m,type:type.Name,file});
const memberAliases=new Map([[167786559,100689488],[167787075,100689488],[167787070,100689491],[167787074,100689489],[167787077,100689495],[167786567,100689455],[167787037,100689455],[167787032,100689458],[167787036,100689456],[167787040,100689462],[100721058,100723581],[100721066,100723593],[100721068,100723588],[100721057,100723579]]);
const genericAliases=new Map([[721424779,{id:100689072,filter:'CHJ7'}],[721424776,{id:100689072,filter:'nHJa'}],[721424780,{id:100689169}],[721424775,{id:100689076}],[721424777,{id:100689134}]]);
const statics=new Map();
const VOID=Symbol('void');let trace=[];
const matrix=()=>({__value:true,__type:'Wbe7',qbMB:0,ibMV:0,jbMr:0,SbMF:0,TbMj:0,NbMb:0});
const point=(x,y)=>({__value:true,__type:'f5wV',x,y});
const copy=x=>x?.__value?{...x}:x;
const ref=(object,key)=>({__ref:true,object,key});
const get=x=>x?.__ref?x.object[x.key]:x;
const set=(r,v)=>{assert.ok(r?.__ref);r.object[r.key]=copy(v);};
function sig(m){const b=Buffer.from(m.Signature,'hex');let p=1;if(b[0]&16)p++;return{count:b[p++],instance:!!(b[0]&32),void:b[p]===1};}
function en(source){source=get(source);if(Array.isArray(source))return{__enumerator:true,items:source,index:-1};if(source?.__type==='<OfType>d__4`1')return run(100689495,[source],{filter:source.__filter});if(source?.__type==='<NotIn>d__8`1')return run(100689462,[source]);throw Error('Unknown enumerable '+source?.__type);}
function move(e){e=get(e);if(e.__enumerator)return ++e.index<e.items.length;if(e.__type==='<OfType>d__4`1')return !!run(100689490,[e],{filter:e.__filter});if(e.__type==='<NotIn>d__8`1')return !!run(100689457,[e]);throw Error('Unknown enumerator');}
function cur(e){e=get(e);return e.__enumerator?e.items[e.index]:run(e.__type==='<OfType>d__4`1'?100689492:100689459,[e]);}
function array(source){const e=en(source),out=[];let count=0;while(move(e)){assert.ok(++count<1000);out.push(cur(e));}return out;}
function run(id,args,env={}){
 const m=methods.get(id);assert.ok(m,'Missing method '+id);const s=[],l=[],index=new Map(m.Instructions.map((i,n)=>[i.Offset,n]));let pc=0,steps=0;
 const pop=()=>{assert.ok(s.length,`Stack underflow ${id}`);return s.pop();};
 const take=n=>{assert.ok(s.length>=n,`Stack take ${id}`);return s.splice(s.length-n,n);};
 while(pc<m.Instructions.length){assert.ok(++steps<20000,'Steps '+id);const i=m.Instructions[pc++],op=i.Op,n=i.Operand;
 trace.push({method:id,il:i.Offset});const jump=()=>{assert.ok(index.has(n),'Jump '+n);pc=index.get(n);};
 if(['nop','box','unbox.any','castclass','constrained.'].includes(op))continue;
 if(['br','br.s','leave','leave.s'].includes(op)){jump();continue;}
 if(op==='ldarga.s'){s.push(ref(args,n));continue;}if(op==='ldloca.s'){s.push(ref(l,n));continue;}
 if(op.startsWith('ldarg.')){s.push(copy(args[op==='ldarg.s'?n:Number(op.slice(6))]));continue;}
 if(op.startsWith('ldloc.')){s.push(copy(l[op==='ldloc.s'?n:Number(op.slice(6))]));continue;}
 if(op.startsWith('stloc.')){l[op==='stloc.s'?n:Number(op.slice(6))]=copy(pop());continue;}
 if(op==='starg.s'){args[n]=copy(pop());continue;}
 if(op.startsWith('ldc.i4')){s.push(op==='ldc.i4'||op==='ldc.i4.s'?n:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue;}
 if(op==='ldc.r8'){s.push(n==='NaN'?NaN:n);continue;}
 if(op==='ldnull'){s.push(null);continue;}if(op==='dup'){s.push(copy(s.at(-1)));continue;}if(op==='pop'){pop();continue;}
 if(op==='neg'){s.push(-pop());continue;}
 if(['add','sub','mul','xor','shl','shr','and','or'].includes(op)){const b=pop(),a=pop();s.push(op==='add'?a+b:op==='sub'?a-b:op==='mul'?a*b:op==='xor'?a^b:op==='shl'?a<<b:op==='shr'?a>>b:op==='and'?a&b:a|b);continue;}
 if(['beq','bne.un','bge','bgt','ble','blt'].includes(op)){const b=pop(),a=pop();if(op==='beq'?a===b:op==='bne.un'?a!==b:op==='bge'?a>=b:op==='bgt'?a>b:op==='ble'?a<=b:a<b)jump();continue;}
 if(op==='brtrue'||op==='brfalse'){const v=pop();if(op==='brtrue'?!!v:!v)jump();continue;}
 if(op==='ldsfld'){if(i.Resolved?.startsWith('.<Module>'))s.push({__module:true});else if(n===67120182)s.push(matrix());else if(n===67135364)s.push({});else s.push(statics.get(n)??null);continue;}
 if(op==='stsfld'){statics.set(n,pop());continue;}
 if(op==='ldfld'){const o=get(pop()),key=i.Resolved.split('::').at(-1);s.push(copy(o.__module?fields.get(n).value:o[key]));continue;}
 if(op==='stfld'){const v=pop(),o=get(pop());o[i.Resolved.split('::').at(-1)]=copy(v);continue;}
 if(op==='ldflda'){s.push(ref(get(pop()),i.Resolved.split('::').at(-1)));continue;}
 if(op==='initobj'){set(pop(),i.Resolved==='jbe2.Wbe7'?matrix():i.Resolved==='m5wr.f5wV'?point(0,0):{});continue;}
 if(op==='ldftn'){s.push({method:n});continue;}
 if(op==='isinst'){const o=pop();s.push(n===452984837?(o?.__type===env.filter?o:null):i.Resolved==='System.IDisposable'?o:null);continue;}
 if(op==='call'||op==='callvirt'||op==='newobj'){
   const construct=op==='newobj',name=i.Resolved;
   if(n===100732116)continue; // Static bootstrap omitted; original field constants are retained separately.
   if(n===167772266){pop();continue;}
   if(n===167772735){s.push(1);continue;}
   if(n===100688824){s.push(Number.isNaN(pop()));continue;}
   if(n===100688814){const eps=pop(),v=pop();s.push(Math.abs(v-1)<eps);continue;}
   if(n===100721934||n===100721936){const p=get(pop());s.push(n===100721934?p.x:p.y);continue;}
   if(n===100721976){const b=pop(),a=pop();s.push(a.x!==b.x||a.y!==b.y);continue;}
   if(n===167796755||n===167786661){s.push(array(pop()));continue;}
   if(n===167786662){s.push([]);continue;}
   if(n===100689051||n===167796747){const method=pop(),target=pop();s.push({__delegate:true,method:method.method,target});continue;}
   if(n===167786711){const v=pop(),acc=pop(),fn=pop();s.push(run(fn.method,[fn.target,acc,v]));continue;}
   if(n===167796734||n===167786685){const v=pop();get(pop()).push(v);continue;}
   if(n===721422298){const item=pop(),items=pop();s.push(array(items).includes(item));continue;} // Reference equality for gHJi objects only.
   if(n===167772304){const e=get(pop());if(e?.__enumerator)e.disposed=true;else if(e?.__type==='<OfType>d__4`1')run(100689489,[e],{filter:e.__filter});else if(e?.__type==='<NotIn>d__8`1')run(100689456,[e]);else throw Error('Unsupported Dispose');continue;}
   if(name?.endsWith('::GetEnumerator')){s.push(en(pop()));continue;}
   if(name?.endsWith('::MoveNext')){s.push(move(pop()));continue;}
   if(name?.endsWith('::get_Current')){s.push(cur(pop()));continue;}
   if(n===167796745){s.push(get(pop()).length);continue;}
   if(n===167796744){const k=pop();s.push(get(pop())[k]);continue;}
   const gen=genericAliases.get(n),target=gen?.id??memberAliases.get(n)??n,callee=methods.get(target);
   if(callee){const meta=sig(callee),v=take(meta.count+(meta.instance&&!construct?1:0));let result;
     const childEnv=gen?.filter?{filter:gen.filter}:env;
     if(construct){const obj={__type:callee.type,__filter:childEnv.filter};run(target,[obj,...v],childEnv);result=obj;}
     else result=run(target,v,childEnv);
     if(construct||!meta.void)s.push(copy(result));continue;
   }
   throw Error(`Unsupported ${op} ${n} ${name} in ${id} @${i.Offset}`);
 }
 if(op==='ret')return sig(m).void?VOID:copy(pop());
 throw Error(`Unsupported opcode ${op} in ${id} @${i.Offset}`);
 }
 throw Error('No ret '+id);
}
const components=m=>[m.qbMB,m.jbMr,m.ibMV,m.SbMF,m.TbMj,m.NbMb].map(v=>Object.is(v,-0)?0:v);
const identity=()=>run(100688888,[]);
const multiply=(a,b)=>run(100688897,[a,b]);
const graphics=()=>({__type:'dHbV',bHJ5:{__type:'bHJZ',XHJn:[]},QHJ6:{u1b9:null},AHJC:true,CHJR:identity(),BHJg:point(0,0)});
const callback=scope=>run(scope.mbxS.method,[scope.mbxS.target]);
const results=[];
for(const b of [14,18])for(const w of [0,1,3])for(const alignRight of [false,true]){
 trace=[];const origin=point(alignRight?200-b:100,72),gfx=graphics();
 const initial=run(100723595,[gfx]),scope=run(100720505,[gfx,origin,1,NaN]);
 const positive=run(100723595,[gfx]);
 run(100723479,[gfx,origin]);const negative=run(100723482,[gfx]);
 const net=multiply(negative,positive);
 assert.deepEqual(components(initial),[1,0,0,1,0,0]);assert.deepEqual(components(positive),[1,0,0,1,origin.x,origin.y]);
 assert.deepEqual(components(negative),[1,0,0,1,-origin.x,-origin.y]);assert.deepEqual(components(net),[1,0,0,1,0,0]);
 assert.equal(gfx.bHJ5.XHJn.length,1);assert.equal(scope.mbxS.target.state.XHJn.length,0);
 callback(scope);const restored=run(100723595,[gfx]);assert.deepEqual(components(restored),[1,0,0,1,0,0]);
 assert.equal(gfx.bHJ5,scope.mbxS.target.state);
 results.push({input:{b,strokeWidth:w,alignRight,origin:{x:origin.x,y:origin.y},paddingFromClosedBounds:w>1?[-w/2,-w/2,w+1,w+1]:[0,0,1,1]},initial:components(initial),positive:components(positive),negative:components(negative),net:components(net),restored:components(restored),trace,passed:true});
}
for(const [x,y]of [[0,0],[-25,-7],[0,72],[.5,1.25]]){
 trace=[];const gfx=graphics(),scope=run(100720505,[gfx,point(x,y),1,NaN]);const positive=run(100723595,[gfx]);
 run(100723479,[gfx,point(x,y)]);const negative=run(100723482,[gfx]);assert.deepEqual(components(multiply(negative,positive)),[1,0,0,1,0,0]);
 callback(scope);assert.deepEqual(components(run(100723595,[gfx])),[1,0,0,1,0,0]);
 results.push({input:{x,y},positive:components(positive),negative:components(negative),trace,passed:true});
}
trace=[];{
 const gfx=graphics(),outer=run(100720505,[gfx,point(100,72),1,NaN]);
 const inner=run(100720505,[gfx,point(5,-7),1,NaN]);assert.deepEqual(components(run(100723595,[gfx])),[1,0,0,1,105,65]);
 callback(inner);assert.deepEqual(components(run(100723595,[gfx])),[1,0,0,1,100,72]);
 callback(outer);assert.deepEqual(components(run(100723595,[gfx])),[1,0,0,1,0,0]);
 results.push({name:'nested-save-copy-restore',trace,passed:true});
}
trace=[];{
 const gfx=graphics(),scale=matrix();scale.qbMB=2;scale.SbMF=3;
 gfx.bHJ5.XHJn.push({__type:'CHJ7',rHJh:{GHSm:scale}},{__type:'gHJi',ignored:'non-transform control'});
 run(100723593,[gfx,point(5,7)]);
 const actual=components(run(100723595,[gfx]));assert.deepEqual(actual,[2,0,0,3,10,21]);
 results.push({name:'ordered-fold-noncommuting-and-filter-control',actual,trace,passed:true});
}
const output={method:'Retained CIL command construction, OfType iterator, aggregate, matrix arithmetic, save-copy-restore and qHbu projection; no target DLL/GUI execution.',passed:results.length,failed:0,boundaries:['Graphics initial field shape is supplied from the retained dHbV ctor; full XML document ctor is not executed.','Module bootstrap is omitted; frozen module constants are supplied from gradient-angle-flow-init-cil.json.','List/CLR iterator/thread/delegate/reference-identity services are explicit host facades.','Dispose invokes the retained TrapSave callback directly; the general zbKz IDisposable wrapper and exception unwinding are not replayed.','No opacity commands are emitted: AHJC=true matches tJ0X b3Fw(true), and opacity is 1. JHbU executes its no-opacity-group branch.','No full paint path writer or XML serialization is executed. Net matrix is proven for the isolated retained command chain; path application is independently audited by the paint agent.','Crop padding is an input annotation only and is never injected into these matrices. Body placement/crop conclusions require composition with the path writer.'],sources:[...files,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',import.meta.filename].map(path=>({path,sha256:sha(path)})),results};
fs.writeFileSync('research/selection-svg-body-matrix-probes.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:results.length,failed:0,methodCounts:[...new Set(results.flatMap(r=>r.trace.map(t=>t.method)))].length,sha256:sha('research/selection-svg-body-matrix-probes.json')}));