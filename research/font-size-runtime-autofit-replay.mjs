// Static CIL control-flow replay. No target DLL is loaded or executed.
// Graphics/struct/DOM sinks are explicit stand-ins; this proves call ordering, not native metrics.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fields } from './gradient-angle-static-flow.mjs';
const files=['research/font-size-runtime-richpanel-layout-cil.json','research/font-size-runtime-graphics-layout-cil.json','research/font-size-runtime-size-normalization-cil.json','research/font-size-runtime-round-cil.json'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const methods=new Map(files.flatMap(f=>read(f).Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const results=[];
function run(token,args,calls){
 const m=methods.get(token),il=m.Instructions,index=new Map(il.map((i,n)=>[i.Offset,n])),s=[],l=new Map(),trace=[];let pc=0,steps=0;
 const pop=()=>s.pop(),jump=n=>{pc=index.get(n);assert.notEqual(pc,undefined)},deref=v=>v?.ref==='local'?l.get(v.n):v?.ref==='arg'?args[v.n]:v;
 while(pc<il.length){if(++steps>2000)throw Error('Budget');const i=il[pc++],o=i.Op,n=i.Operand;trace.push(i.Offset);
  if(o==='br'||o==='br.s'){jump(n);continue}
  if(o.startsWith('ldarg.')){s.push(args[o==='ldarg.s'?n:Number(o.slice(6))]);continue}
  if(o==='ldarga.s'){s.push({ref:'arg',n});continue}if(o==='starg.s'){args[n]=pop();continue}
  if(o==='ldloca.s'){s.push({ref:'local',n});continue}if(o==='ldloc.s'){s.push(l.get(n));continue}if(o==='stloc.s'){l.set(n,pop());continue}
  if(o.startsWith('ldc.i4')){s.push(o==='ldc.i4'||o==='ldc.i4.s'?n:Number(o.slice(7)));continue}if(o==='ldc.r8'){s.push(n);continue}
  if(o==='ldsfld'){assert.equal(n,67142340);s.push('module');continue}if(o==='ldfld'){assert.equal(pop(),'module');s.push(fields.get(n).value);continue}
  if(o==='sub'||o==='ceq'){const b=pop(),a=pop();s.push(o==='sub'?a-b:a===b);continue}
  if(o==='brtrue'||o==='brfalse'){const a=pop();if(o==='brtrue'?!!a:!a)jump(n);continue}if(o==='beq'){const b=pop(),a=pop();if(a===b)jump(n);continue}
  if(o==='newobj'&&n===100722966){const h=pop(),w=pop();s.push({w,h});continue}
  if(o==='call'||o==='callvirt'){
   calls.push({method:token,il:i.Offset,callee:n,name:i.Resolved});
   if(n===100702287){s.push(pop().owner);continue}
   if(n===100702342){s.push(pop().autoFitWidth);continue}
   if(n===100702315){s.push(pop().edited);continue}
   if(n===100701885){s.push(pop().empty);continue}
   if(n===100701875){s.push(pop().graphics);continue}
   if(n===100715355){const arg=pop(),owner=pop();s.push(run(n,[owner,arg],calls));continue}
   if(n===100715353){const flag=pop(),width=pop(),owner=pop();s.push(run(n,[owner,width,flag],calls));continue}
   if(n===100715354){const flag=pop(),width=pop(),graphics=pop();calls.at(-1).width=width;calls.at(-1).flag=flag;s.push({size:graphics.measured});continue}
   if(i.Resolved==='.bHzv::zHzo'){s.push(pop().size);continue}
   if(i.Resolved==='hHBO.fHBd::IHVr'){s.push(deref(pop()).w);continue}
   if(i.Resolved==='hHBO.fHBd::zHVB'){s.push(deref(pop()).h);continue}
   if(n===100722983){const mode=pop(),digits=pop(),size=deref(pop());s.push(run(n,[size,digits,mode],calls));continue}
   if(n===100688822){const mode=pop(),digits=pop(),value=pop();s.push(run(n,[value,digits,mode],calls));continue}
   if(n===167786521){const mode=pop(),digits=pop(),value=pop();assert.equal(mode,1);const p=10**digits;s.push(Math.sign(value)*Math.floor(Math.abs(value)*p+.5)/p);continue}
   if(i.Resolved==='h5uH.j5u5::get_Size'){s.push(deref(pop()).size);continue}
   if(i.Resolved==='hHBO.fHBd::op_Inequality'){const b=pop(),a=pop();s.push(a.w!==b.w||a.h!==b.h);continue}
   if(n===100702294){s.push(pop().rect);continue}
   if(i.Resolved==='h5uH.j5u5::k5uI'){const size=pop(),rect=deref(pop());s.push({...rect,size});continue}
   if(n===100702293){const rect=pop(),panel=pop();panel.rect=rect;continue}
   if(n===100701900){pop();pop();continue}
   throw Error('Unproved call '+n+' '+i.Resolved);
  }
  if(o==='ret'){calls.push({method:token,trace});return pop()}
  throw Error('Unproved opcode '+o);
 }
 throw Error('No return');
}
for(const autoFitWidth of [true,false]){
 const panel={owner:{autoFitWidth},edited:false,empty:false,graphics:{measured:{w:132.25,h:38.75}},rect:{size:{w:95,h:27}}},calls=[];
 run(100701896,[panel,{w:95,h:1}],calls);
 const measure=calls.find(c=>c.name==='ftC2.mtC7::KIf5');
 assert.equal(measure.width,autoFitWidth?10000:95);
 assert.ok(calls.some(c=>c.callee===100702293),'text-panel rect write');
 assert.deepEqual(panel.rect.size,autoFitWidth?{w:132,h:39}:{w:95,h:39});
 results.push({name:'Initial text-panel layout chooses measuring width and rounds measured size',autoFitWidth,measureWidth:measure.width,rectWritten:true,injectedGraphicsResult:{w:132.25,h:38.75},observedRect:panel.rect,calls});
}
const output={timestamp:new Date().toISOString(),method:'Bounded static CIL control-flow replay with mocked graphics/struct sinks; no DLL execution or original pixel measurement',sources:files.map(path=>({path,sha256:hash(path)})),boundaries:['Returned graphics size132.25x38.75 is injected only to exercise control flow; not a measured Axure value','Math.Round sink independently models tested AwayFromZero non-midpoints; not exhaustive binary tie parity','Only nonempty, non-editing text-panel branches covered'],results};
fs.writeFileSync('research/font-size-runtime-autofit-replay.json',JSON.stringify(output,null,2)+'\n');
console.log(`${results.length}/${results.length} static auto-fit control-flow cases passed`);
