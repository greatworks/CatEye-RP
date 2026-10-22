// Bounded interpretation of retained CIL. No vendor assembly is imported/executed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fields as flow} from './gradient-angle-static-flow.mjs';
const files=['core','navigation','activation','history-lambda','close-lambdas','activation-lambda'].map(n=>`research/page-tabs-native-${n}-cil.json`);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const docs=files.map(read), methods=new Map(docs.flatMap(d=>d.Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const owner=docs[0].Types.find(t=>t.Name==='lB02'), F=Object.fromEntries(owner.Fields.map(f=>[f.Name,f.Token]));
const traces=[], sinks=[];let currentCase='';
const returns=new Set([100670576,100670589,100670594,100670596,100670597,100670575,100670661,100670665,100670667,100713986,100720524,100732102,100689226,167772400,167772562,100716799,100664916,100664917,100714063,100670625,721420930,721420935,721420936,167772585,167777708,167772586,167777712,167777697]);
const arities=new Map([[100670576,1],[100670589,1],[100670594,1],[100670596,1],[100670597,1],[100670575,1],[100670661,1],[100670665,1],[100670667,1],[100670603,2],[100670614,2],[100670617,1],[100670619,1],[100670624,1],[100664751,1],[100670681,1],[100670651,3],[100714111,3],[100713986,1],[100714275,1],[100720524,3],[100714112,2],[100732102,1],[100689226,1],[100664923,4],[167772400,2],[167772562,2],[100716799,2],[100664916,1],[100664917,1],[100714063,2],[100670625,3],[100670628,2],[100670620,1],[100670621,1],[167772304,1],[167772585,1],[167777708,1],[167772586,2],[167777712,2],[167777697,2],[167772587,2],[167777735,2],[167775537,1],[167772544,2],[167777721,3],[167777717,3],[721420930,2],[721420935,2],[721420936,1],[100670616,2]]);
function invoke(token,a,resolved){
  const obj=a[0];
  if(token===100670576)return obj[F.zBqN];
  if(token===100670589)return obj;
  if(token===100670594)return obj.gallery;
  if(token===100670596)return Number(obj.showGallery);
  if(token===100670597)return Number(obj[F.OBpy]===obj.gallery);
  if(token===100670575)return obj[F.OBpy]?.id??'empty';
  if(token===100670661)return obj.id;
  if(token===100670665)return obj.packageId;
  if(token===100670667)return obj.context;
  if(token===100664916)return obj.incomingPackage;
  if(token===100664917)return obj.incomingPackage==='empty'?null:{};
  if(token===100670625)return {id:`tab:${a[1]}`,packageId:a[1],context:a[2]};
  if(token===100670628){obj[F.OBpy]=a[1];sinks.push({token,kind:'active-assignment',id:a[1]?.id});return;}
  if(token===100670616)return run(token,a);
  if(token===167772400||token===100716799)return Number(a[0]===a[1]);
  if(token===167772562)return Number(a[0]!==a[1]);
  if(token===167772585||token===167777708)return obj.length;
  if(token===167772586||token===167777712){assert(a[1]>=0&&a[1]<obj.length,`${currentCase}: get_Item ${a[1]} length ${obj.length}, token ${token}`);return obj[a[1]];}
  if(token===167777697)return obj.indexOf(a[1]);
  if(token===167772587||token===167777735){assert(a[1]>=0&&a[1]<obj.length,`${currentCase}: RemoveAt ${a[1]} length ${obj.length}, token ${token}`);obj.splice(a[1],1);return;}
  if(token===167775537){obj.splice(0);return;}
  if(token===167772544){obj.push(a[1]);return;}
  if(token===167777721){obj.splice(a[1],a[2]);return;}
  if(token===167777717){obj.splice(a[1],0,a[2]);return;}
  if(token===100689226)return obj.length-1;
  if(token===721420930)return obj.find(x=>Boolean(run(a[1].method,[a[1].target,x])))??null;
  if(token===721420935)return Number(obj.every(x=>Boolean(run(a[1].method,[a[1].target,x]))));
  if(token===721420936)return obj[0];
  if(token===100670603){sinks.push({token,kind:'open-history',id:a[1]?.id??null});return;}
  if(token===100664923){sinks.push({token,kind:'open-package',packageId:a[1],context:a[2],flag:a[3]});return;}
  if(token===100670614){sinks.push({token,kind:'ensure-visible',id:a[1]?.id});return;}
  // UI/layout/logging/paint sinks, with exact argument counts; not used as navigation predicates.
  if([100670617,100670619,100670624,100664751,100670681,100670651,100714111,100714275,100714112,100670620,100670621,167772304].includes(token))return;
  if([100713986,100720524,100732102,100714063].includes(token))return {sink:resolved};
  throw new Error(`Unsupported call ${token} ${resolved}`);
}
function run(token,args){
  const m=methods.get(token);assert(m,`Missing method ${token}`);
  const list=m.Instructions,offsets=new Map(list.map((i,n)=>[i.Offset,n]));
  const stack=[],locals=[],trace=[];let at=0;
  for(let step=0;step<20000;step++){
    const i=list[at++];assert(i,`${m.Name} overrun`);trace.push(i.Offset);
    const op=i.Op,v=i.Operand,jump=()=>{assert(offsets.has(v));at=offsets.get(v);};
    if(op==='nop')continue;
    if(op==='br'||op==='br.s'||op==='leave'){jump();continue;}
    if(op==='ldarg.s'||/^ldarg\.[0-3]$/.test(op)){stack.push(args[op==='ldarg.s'?v:Number(op.slice(-1))]);continue;}
    if(op==='ldloc.s'){stack.push(locals[v]);continue;}
    if(op==='stloc.s'){locals[v]=stack.pop();continue;}
    if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue;}
    if(op==='ldnull'){stack.push(null);continue;}
    if(op==='ldsfld'){stack.push(i.Resolved==='System.Guid::Empty'?'empty':{flow:true});continue;}
    if(op==='ldfld'){const x=stack.pop();assert(x!==undefined&&x!==null,`null field ${i.Resolved}`);if(x.flow){assert(flow.has(v));stack.push(flow.get(v).value);}else stack.push(x[v]??0);continue;}
    if(op==='stfld'){const value=stack.pop(),target=stack.pop();target[v]=value;continue;}
    if(op==='dup'){stack.push(stack.at(-1));continue;}
    if(op==='pop'){stack.pop();continue;}
    if(op==='ldftn'){stack.push(v);continue;}
    if(op==='newobj'){
      if(i.Resolved.startsWith('.<>c__DisplayClass'))stack.push({});
      else if([167777709,167777040].includes(v)){const method=stack.pop(),target=stack.pop();stack.push({method,target});}
      else throw new Error(`Unsupported ctor ${i.Resolved}`);
      continue;
    }
    if(['add','sub','xor','shl','cgt.un'].includes(op)){const b=stack.pop(),a=stack.pop();stack.push(op==='add'?(a+b)|0:op==='sub'?(a-b)|0:op==='xor'?a^b:op==='shl'?a<<b:Number(a>b));continue;}
    if(/^br(true|false)(\.s)?$/.test(op)){const x=stack.pop();if(op.startsWith('brtrue')?Boolean(x):!x)jump();continue;}
    if(['beq','bne.un','bge','bgt','blt'].includes(op)){const b=stack.pop(),a=stack.pop();if(op==='beq'?a===b:op==='bne.un'?a!==b:op==='bge'?a>=b:op==='bgt'?a>b:a<b)jump();continue;}
    if(op==='call'||op==='callvirt'){
      assert(arities.has(v),`Unknown arity ${v} ${i.Resolved} in ${m.Name}@${i.Offset}`);
      const a=stack.splice(stack.length-arities.get(v)),result=invoke(v,a,i.Resolved);
      if(returns.has(v))stack.push(result);continue;
    }
    if(op==='ret'){traces.push({token,name:m.Name,offsets:trace});return stack.pop();}
    throw new Error(`Unsupported ${op} ${m.Name}@${i.Offset}`);
  }
  throw new Error(`Step limit ${m.Name}`);
}
const tab=id=>({id,packageId:`package:${id}`,context:'empty'});
function state(ids,history,cursor,current){const tabs=ids.map(tab);return {[F.kBpu]:tabs,[F.OBpy]:tabs.find(t=>t.id===current)??null,[F.zBqN]:[...history],[F.VBqS]:cursor,[F.TBqL]:0,[F.jBqD]:0,gallery:null,showGallery:false};}
const results=[];
function test(name,fn){currentCase=name;const start=traces.length,startSink=sinks.length;const detail=fn();results.push({name,...detail,traces:traces.slice(start),sinks:sinks.slice(startSink),passed:true});}
for(const [name,forward,cursor,expected] of [['history-forward',true,1,'C'],['history-back',false,1,'A'],['history-at-end',true,2,null],['history-at-start',false,0,null]])test(name,()=>{const s=state(['A','B','C'],['A','B','C'],cursor,['A','B','C'][cursor]),start=sinks.length;run(100670602,[s,Number(forward)]);assert.equal(sinks.slice(start).find(x=>x.kind==='open-history')?.id??null,expected);assert.equal(s[F.VBqS],expected?cursor+(forward?1:-1):cursor);return{history:s[F.zBqN],cursor:s[F.VBqS],expected};});
for(const [name,method,current,expected] of [['visual-next-wrap',100670605,'C','A'],['visual-prev-wrap',100670604,'A','C'],['visual-next-middle',100670605,'A','B'],['visual-prev-middle',100670604,'C','B']])test(name,()=>{const s=state(['A','B','C'],['A','B','C'],2,current),start=sinks.length;run(method,[s,null,null]);assert.equal(sinks.slice(start).find(x=>x.kind==='open-package')?.packageId,`package:${expected}`);return{expected};});
for(const method of [100670604,100670605])test(`visual-empty-${method}`,()=>{const s=state([],[],0,null),start=sinks.length;run(method,[s,null,null]);assert.equal(sinks.slice(start).filter(x=>x.kind==='open-package').length,0);return{};});
test('append-keeps-repeated-nonconsecutive-visits',()=>{const s=state(['A','B'],['A','B'],1,'B');run(100670616,[s,s[F.kBpu][0]]);assert.deepEqual(s[F.zBqN],['A','B','A']);assert.equal(s[F.VBqS],2);return{history:s[F.zBqN],cursor:s[F.VBqS]};});
test('append-truncates-forward-branch',()=>{const s=state(['A','B','C','D'],['A','B','C'],1,'B');run(100670616,[s,s[F.kBpu][3]]);assert.deepEqual(s[F.zBqN],['A','B','D']);return{history:s[F.zBqN],cursor:s[F.VBqS]};});
test('append-suppressed-during-history-navigation',()=>{const s=state(['A','B'],['A','B'],0,'A');s[F.TBqL]=1;run(100670616,[s,s[F.kBpu][1]]);assert.deepEqual(s[F.zBqN],['A','B']);assert.equal(s[F.VBqS],0);return{history:s[F.zBqN],cursor:s[F.VBqS]};});
for(const [name,history,cursor,current,closing,after,nextCursor,expected] of [
 ['close-active-most-recent',['A','B','C'],2,'C','C',['A','B'],1,'B'],
 ['close-active-at-history-start',['A','B','C'],0,'A','A',['B','C'],0,'B'],
 ['close-active-middle',['A','B','C'],1,'B','B',['A','C'],0,'A'],
 ['close-inactive-removes-all-ids',['A','B','A','C','A'],3,'C','A',['B','C'],1,null],
 ['close-collapses-identical-remaining',['A','B','A','B','A'],4,'A','B',['A'],0,null],
 ['close-last-tab',['A'],0,'A','A',[],0,'empty'],
 ['close-last-history-entry-selects-first-visual',['B'],0,'B','B',['A'],0,'A']
])test(name,()=>{const s=state([...new Set([...history,'A','B','C'].filter(x=>name==='close-last-tab'?x==='A':name==='close-last-history-entry-selects-first-visual'?x!=='C':true))],history,cursor,current),start=sinks.length;run(100670630,[s,s[F.kBpu].find(t=>t.id===closing),1]);assert.deepEqual(s[F.zBqN],after);assert.equal(s[F.VBqS],nextCursor);const action=sinks.slice(start).find(x=>x.kind==='open-history'||x.kind==='open-package');assert.equal(action?.id??action?.packageId??null,expected);return{history:s[F.zBqN],cursor:s[F.VBqS],expected};});
for(const [name,incoming,current,after] of [['activation-same-package','package:A','A',['A']],['activation-different-package','package:B','A',['A','B']]])test(name,()=>{const s=state(['A','B'],['A'],0,current);s.incomingPackage=incoming;run(100670613,[s]);assert.deepEqual(s[F.zBqN],after);return{history:s[F.zBqN],cursor:s[F.VBqS]};});
const dependencies=[...files,'research/gradient-angle-flow-init-cil.json','research/gradient-angle-static-flow.mjs','research/page-tabs-native-collection-helpers-cil.json','research/page-tabs-native-activation-setter-cil.json','research/page-tabs-native-probe.mjs'];
const out={createdAt:new Date().toISOString(),kind:'Bounded static CIL interpretation, no vendor execution',sourceAssemblySha256:docs[0].SHA256,passed:true,caseCount:results.length,sources:dependencies.map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')})),results,boundaries:['List/Guid/delegate operations use explicit JS collection/identity equivalents. Obfuscated branch fields are recovered from retained static initializer.','Open-history and open-package are recorded sinks; native main-window callbacks, document/selection side effects and GUI are not executed.','Activation hooks are replayed for existing ordinary page tabs; same-package identity and append dispatch are native instructions. xBpH is an explicit active-assignment sink matching its retained CIL.','sB0z visible-layout handling and all paint/logging/layout callbacks are sinks; visual-cycle choice is measured before those callbacks.','Activation leave bypasses finally UI-redraw disposal; no state predicate depends on that sink. Gallery and restored-history workflows are not exhaustively replayed.']};
fs.writeFileSync('research/page-tabs-native-probes.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,caseCount:results.length}));
