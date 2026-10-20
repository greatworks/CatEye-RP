// Bounded replay of retained CIL, never loading or executing Axure binaries.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields, readJson, sha256} from './gradient-angle-static-flow.mjs';
const files=['research/adaptive-hierarchy-format-set-cil.json','research/adaptive-behavior-format-widget-remap-cil.json'];
const methods=new Map(files.flatMap(f=>readJson(f).Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const traces=[];
function run(token,args){
 const m=methods.get(token),il=m.Instructions,index=new Map(il.map((x,n)=>[x.Offset,n])),stack=[],locals=new Map(),trace=[];let pc=0,steps=0;
 const pop=()=>stack.pop(),jump=n=>{assert(index.has(n));pc=index.get(n)},deref=x=>x?.local!==undefined?locals.get(x.local):x;
 while(pc<il.length){assert(++steps<5000);const i=il[pc++],o=i.Op,n=i.Operand,r=i.Resolved;trace.push(i.Offset);
  if(['br','br.s','leave','leave.s'].includes(o)){jump(n);continue}
  if(o==='nop'||o==='constrained.'){continue}
  if(o.startsWith('ldarg.')){stack.push(args[o==='ldarg.s'?n:Number(o.slice(6))]);continue}
  if(o.startsWith('ldc.i4')){stack.push(o==='ldc.i4'||o==='ldc.i4.s'?n:o==='ldc.i4.m1'?-1:Number(o.slice(7)));continue}
  if(o.startsWith('ldloca')){stack.push({local:n});continue}
  if(o.startsWith('ldloc.')){stack.push(locals.get(o==='ldloc.s'?n:Number(o.slice(6))));continue}
  if(o.startsWith('stloc.')){locals.set(o==='stloc.s'?n:Number(o.slice(6)),pop());continue}
  if(o==='ldsfld'){assert.equal(n,67142340);stack.push({module:true});continue}
  if(o==='ldfld'){const a=pop();if(a.module)stack.push(fields.get(n).value);else if(r==='kJm2.KJm7::fJZ4')stack.push(a.maps);else throw Error('Unproved field '+r);continue}
  if(o==='ldnull'){stack.push(null);continue}if(o==='dup'){stack.push(stack.at(-1));continue}if(o==='pop'){pop();continue}
  if(['add','sub','xor'].includes(o)){const b=pop(),a=pop();stack.push(o==='add'?a+b:o==='sub'?a-b:a^b);continue}
  if(o==='brtrue'||o==='brfalse'){const a=pop();if(o==='brtrue'?!!a:!a)jump(n);continue}
  if(['beq','bne.un','bge','blt'].includes(o)){const b=pop(),a=pop();if(o==='beq'?a===b:o==='bne.un'?a!==b:o==='bge'?a>=b:a<b)jump(n);continue}
  if(o==='call'||o==='callvirt'){
   if(r==='PtPZ.itPU::ltPQ'){stack.push(pop().base);continue}
   if(r==='PtPZ.itPU::mt7r'){stack.push(pop().views);continue}
   if(r==='Ot71.bt7H::Ot7i'){stack.push(pop().id);continue}
   if(r==='TtiU.ltiO::Wtin'){const excludeBase=pop(),id=pop(),views=pop();assert.equal(excludeBase,0);stack.push(views.find(v=>v.id===id)??null);continue}
   if(r==='TtiU.ltiO::Lti8'){const excludeEmpty=pop(),name=pop(),views=pop();assert.equal(excludeEmpty,1);stack.push(name?views.find(v=>v.name===name)??null:null);continue}
   if(r==='System.Guid::op_Equality'||r==='System.Guid::op_Inequality'){const b=pop(),a=pop();stack.push(r.endsWith('op_Equality')?a===b:a!==b);continue}
   if(r.endsWith('::ContainsKey')){const key=pop(),map=pop();stack.push(Object.hasOwn(map,key));continue}
   if(r.endsWith('::get_Item')){const key=pop(),map=pop();stack.push(map[key]);continue}
   if(r.endsWith('::set_Item')){const val=pop(),key=pop(),map=pop();map[key]=val;continue}
   if(r.endsWith('::Remove')){const key=pop(),map=pop();const exists=Object.hasOwn(map,key);delete map[key];stack.push(exists);continue}
   if(r==='kJm2.KJm7::AdaptiveStyle'){const key=pop(),w=pop();stack.push(w.maps[key]);continue}
   if(r==='JtTZ.WtTU::IsEmpty'){stack.push(Object.keys(pop()).length===0);continue}
   if(r==='JtTZ.WtTU::WtwM'){stack.push(Object.entries(pop()).filter(([,p])=>p.overridden).map(([name,p])=>({name,...p})));continue}
   if(r==='CbiJ.Bbib::Sb73<generic>'){stack.push([...pop()]);continue}
   if(r==='J5jB.e5jG::T5jH'){stack.push(pop().name);continue}
   if(r==='JtTZ.WtTU::ftwP'){const prop=pop(),key=pop(),style=pop();style[key]=Object.fromEntries(Object.entries(prop).filter(([k])=>k!=='name'));continue}
   if(r.endsWith('::GetEnumerator')){stack.push({values:pop(),position:-1});continue}
   if(r.endsWith('::MoveNext')){const it=deref(pop());stack.push(++it.position<it.values.length);continue}
   if(r.endsWith('::get_Current')){const it=deref(pop());stack.push(it.values[it.position]);continue}
   if(r==='System.IDisposable::Dispose'){pop();continue}
   throw Error('Unproved call '+r);
  }
  if(o==='ret'){traces.push({token,offsets:trace});return pop()}
  throw Error('Unproved opcode '+o+' at '+i.Offset);
 }
 throw Error('No return');
}
const base={id:'base',name:''},views=[{id:'A',name:'Phone'},{id:'B',name:'Tablet'},{id:'C',name:'Phone'}],set={base,views};
const cases=[];
for(const [id,name,expected]of [['base','Phone','base'],['B','Phone','B'],['absent','Phone','A'],['absent','phone',null],['absent','',null],['absent','Unknown',null]]){
 const output=run(100715549,[set,id,name]);assert.equal(output?.id??null,expected);cases.push({kind:'match',id,name,expected,actual:output?.id??null});
}
const p=(value,overridden=true)=>({value,overridden});
for(const c of [
 {name:'missing source does nothing',maps:{new:{x:p(2)}},from:'old',to:'new',expected:{new:{x:p(2)}}},
 {name:'same identity does nothing',maps:{old:{x:p(1)}},from:'old',to:'old',expected:{old:{x:p(1)}}},
 {name:'move to missing target',maps:{old:{x:p(1)}},from:'old',to:'new',expected:{new:{x:p(1)}}},
 {name:'empty target replaced',maps:{old:{x:p(1)},new:{}},from:'old',to:'new',expected:{new:{x:p(1)}}},
 {name:'target overridden properties win',maps:{old:{x:p(1),color:p('red')},new:{color:p('blue'),height:p(7)}},from:'old',to:'new',expected:{new:{x:p(1),color:p('blue'),height:p(7)}}},
 {name:'target inactive property not overlaid',maps:{old:{x:p(1)},new:{x:p(2,false)}},from:'old',to:'new',expected:{new:{x:p(1)}}},
 {name:'state map is one property, not deep merged',maps:{old:{states:p({hover:{color:'red'},selected:{color:'green'}})},new:{states:p({hover:{}})}},from:'old',to:'new',expected:{new:{states:p({hover:{}})}}},
]){const obj={maps:structuredClone(c.maps)};run(100695534,[obj,c.from,c.to]);assert.deepEqual(obj.maps,c.expected);cases.push({...c,actual:obj.maps});}
const out={method:'Bounded interpretation of decoded htPf/hIs2 CIL control flow with explicit collection/property accessor stubs; no original DLL, GUI or generated app execution.',boundaries:['FromId/FromName/FirstOrDefault helpers are independently inspected static dependencies and represented by exact-match array lookup stubs here.','Style.IsEmpty is modelled as zero properties in these cases, not claimed for all native style inheritance cases.','OverriddenProps uses explicit supplied flags; no parent-style resolution is simulated.','Exception/finally disposal has no mutation in these fixtures and is skipped by leave.'],sources:files.map(file=>({file,sha256:sha256(file)})),dependencies:['research/adaptive-behavior-format-match-helper-cil.json','research/adaptive-behavior-format-name-predicate-cil.json','research/adaptive-behavior-format-id-predicate-cil.json','research/adaptive-behavior-format-first-cil.json','research/adaptive-behavior-format-local-props-cil.json','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'].map(file=>({file,sha256:sha256(file)})),cases,traces};
fs.writeFileSync('research/adaptive-behavior-format-remap-replay.json',JSON.stringify(out,null,2)+'\n');
console.log(`${cases.length}/${cases.length} bounded static replay cases passed`);
