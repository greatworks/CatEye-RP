// Bounded replay of retained CIL records. No target assembly or GUI execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readJson, fields, sha256 } from './gradient-angle-static-flow.mjs';
const cil='research/adaptive-all-views-effects-map-edit-cil.json';
const method=readJson(cil).Types.flatMap(t=>t.Methods).find(m=>m.Token===100718050);
const sentinel=Object.freeze({sentinel:true});
const style=(name,props)=>({name,props});
const absent=null;
function replay(request,current,capable=true){
 const args=[{Selected:request},8,{Selected:current},{},capable],locals=[],stack=[],trace=[],calls=[];
 const index=new Map(method.Instructions.map((i,n)=>[i.Offset,n]));let pc=0,steps=0;
 const pop=()=>{assert.ok(stack.length,'stack underflow');return stack.pop()};
 const getState=map=>map.Selected??null;
 while(pc<method.Instructions.length){
  assert.ok(++steps<1000,'step bound');const ins=method.Instructions[pc++],op=ins.Op,v=ins.Operand;trace.push(ins.Offset);
  const jump=()=>{assert.ok(index.has(v));pc=index.get(v)};
  if(op==='br'||op==='br.s'){jump();continue}
  if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op.startsWith('ldarg.')){stack.push(args[op==='ldarg.s'?v:Number(op.slice(6))]);continue}
  if(op.startsWith('ldloc.')){stack.push(locals[op==='ldloc.s'?v:Number(op.slice(6))]);continue}
  if(op.startsWith('stloc.')){locals[op==='stloc.s'?v:Number(op.slice(6))]=pop();continue}
  if(op==='sub'){const b=pop();stack.push(pop()-b);continue}
  if(op==='beq'){const b=pop(),a=pop();if(a===b)jump();continue}
  if(op==='brtrue'||op==='brfalse'){const a=pop();if(op==='brtrue'?!!a:!a)jump();continue}
  if(op==='ldsfld'){assert.match(ins.Resolved,/<Module>/);stack.push({module:true});continue}
  if(op==='ldfld'){assert.equal(pop().module,true);assert.ok(fields.has(v));stack.push(fields.get(v).value);continue}
  if(op==='ret'){return {changed:Boolean(pop()),output:args[3],trace,calls}}
  if(op==='call'||op==='callvirt'){
   const c=ins.Resolved;calls.push({il:ins.Offset,callee:c});
   if(c==='nHeb.tHej::SHeJ'){pop();stack.push(pop());continue}
   if(c==='TypeSpecification:1B00048E::n5jA')continue; // fixture Prop.Value wrapper is identity
   if(c==='wtXX.FtXa::AtX4'){assert.equal(pop(),8);stack.push(getState(pop()));continue}
   if(c==='wtXX.FtXa::LtXn'){const value=pop();assert.equal(pop(),8);pop().Selected=value;continue}
   if(c==='vtf2.ttf7::ttfX'){stack.push(pop()===sentinel);continue}
   if(c==='vtf2.ttf7::stfl'){stack.push(pop()===null);continue}
   if(c==='JtTZ.WtTU::IsEmpty'){const s=pop();assert.ok(s&&s!==sentinel);stack.push(s.props.length===0);continue}
   if(c==='vtf2.ttf7::Ctfs'){const s=pop();stack.push(s===null||s.props.length===0);continue}
   if(c==='JtTZ.WtTU::WtwM'){const s=pop();assert.ok(s&&s!==sentinel);stack.push(s.props);continue}
   if(c==='CbiJ.Bbib::ab71<generic>'){assert.equal(pop(),0);const b=pop(),a=pop();stack.push(JSON.stringify(a)===JSON.stringify(b));continue}
   throw Error('Unmodelled dependency '+c);
  }
  throw Error('Unsupported opcode '+op);
 }
 throw Error('Missing return');
}
const red=style('current-red',[[6,'red']]),blue=style('requested-blue',[[6,'blue']]),red2=style('equal-red',[[6,'red']]),empty=style('empty',[]);
const cases=[
 ['sentinel retains existing whole state',sentinel,red,false,red],
 ['sentinel retains absent state',sentinel,absent,false,null],
 ['sentinel retains explicit empty state',sentinel,empty,false,empty],
 ['replacement state changes color',blue,red,true,blue],
 ['replacement state drops unrequested fields',blue,style('current-two-fields',[[6,'red'],[7,'white']]),true,blue],
 ['equal properties preserve current state object',red2,red,false,red],
 ['add nonempty state',blue,absent,true,blue],
 ['delete nonempty state',absent,red,true,null],
 ['delete empty state',absent,empty,true,null],
 ['both absent no edit',absent,absent,false,undefined],
 ['explicit empty replaces nonempty',empty,red,true,empty],
 ['empty replaces absent',empty,absent,true,empty],
 ['empty versus empty no edit',style('other-empty',[]),empty,false,undefined],
 ['unsupported state capability omitted',blue,red,false,undefined,false],
];
const results=cases.map(([name,request,current,changed,value,capable=true])=>{
 const result=replay(request,current,capable);assert.equal(result.changed,changed,name);assert.equal(result.output.Selected,value,name);
 return {name,request:request===sentinel?'Htfh sentinel':request,current,capable,changed,hasOutput:Object.hasOwn(result.output,'Selected'),output:result.output.Selected??null,trace:result.trace,calls:result.calls};
});
// Independent composition oracle follows UVcB's seven-state sentinel preparation
// and GetEdit's fixed seven-state enumeration; each state still runs actual M5bg CIL.
const states=[1,2,8,64,32,4,16];
const currentMap={1:style('hover',[[6,'cyan']]),8:red,4:style('disabled',[[6,'gray']])};
const composed={};let changed=false;
for(const state of states){const r=replay(state===8?blue:sentinel,currentMap[state]??null);changed ||= r.changed;if(Object.hasOwn(r.output,'Selected'))composed[state]=r.output.Selected;}
assert.equal(changed,true);assert.equal(composed[1],currentMap[1]);assert.equal(composed[4],currentMap[4]);assert.equal(composed[8],blue);
results.push({name:'single selected replacement materializes preserved other states',states,current:currentMap,output:composed,changed});
const output={method:'Bounded evaluation of retained M5bg CIL and independently asserted expected records; not original DLL/GUI execution',source:{file:cil,sha256:sha256(cil),token:method.Token},dependencies:{capability:'tHej.SHeJ supplied as controlled boolean',styleEquality:'Bbib.ab71 stub exact sequence equality for these simple equal/unequal property-list fixtures; not arbitrary Prop equality',null:'ttf7.stfl==null; Ctfs==null-or-empty per retained CIL',sentinel:'ttf7.ttfX special style Guid; controlled sentinel object stands for Htfh'},count:results.length,passed:results.length,cases:results};
fs.writeFileSync('research/adaptive-all-views-effects-replay.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:results.length,output:'research/adaptive-all-views-effects-replay.json'}));
