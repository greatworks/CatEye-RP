// Bounded interpretation of retained CIL records, never target DLL execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['research/native-corners-path-builder-cil.json','research/line-style-platform-functions-cil.json','research/native-corners-geometry-metadata.json'];
const methods=new Map(files.slice(0,2).flatMap(p=>read(p).Types.flatMap(t=>t.Methods.map(m=>[m.Token,m]))));
assert.equal(read(files[0]).SHA256,'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
function replay(token,args,stop=null){
 const m=methods.get(token);assert(m);const code=m.Instructions,at=new Map(code.map((x,i)=>[x.Offset,i])),stack=[],locals=[];
 let pc=0,steps=0;const val=x=>x?.ref?x.ref[x.index]:x;
 while(pc<code.length){assert(++steps<5000);const i=code[pc++],op=i.Op;
  if(i.Offset===stop)return{radius:args[1],corners:[locals[5],locals[6],locals[8],locals[7]].map(Boolean),heightCeiling:locals[10],widthCeiling:locals[11],radiusCeiling:locals[12],steps};
  const branch=()=>{assert(at.has(i.Operand));pc=at.get(i.Operand)};
  if(op==='br'||op==='br.s'){branch();continue}
  if(op==='ldarg.s'){stack.push(args[i.Operand]);continue}
  if(/^ldarg\.[0-9]+$/.test(op)){stack.push(args[Number(op.slice(6))]);continue}
  if(op==='ldarga.s'){stack.push({ref:args,index:i.Operand});continue}
  if(op==='starg.s'){args[i.Operand]=stack.pop();continue}
  if(op==='ldloc.s'){stack.push(locals[i.Operand]);continue}
  if(/^ldloc\.[0-9]+$/.test(op)){stack.push(locals[Number(op.slice(6))]);continue}
  if(op==='stloc.s'||/^stloc\.[0-9]+$/.test(op)){locals[op==='stloc.s'?i.Operand:Number(op.slice(6))]=stack.pop();continue}
  if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?i.Operand:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op==='ldc.r8'){stack.push(i.Operand);continue}
  if(op==='newarr'){stack.push(new Array(stack.pop()));continue}
  if(op==='ldsfld'){assert.equal(i.Resolved,'m5wr.f5wV::m5wA');stack.push({missingPoint:true});continue}
  if(op==='stelem'){const v=stack.pop(),index=stack.pop(),arr=stack.pop();arr[index]=v;continue}
  if(op==='box')continue;
  if(['and','add','div','ceq'].includes(op)){const b=stack.pop(),a=stack.pop();stack.push(op==='and'?a&b:op==='add'?a+b:op==='div'?a/b:a===b);continue}
  if(op==='brtrue'||op==='brfalse'){if(Boolean(stack.pop())===(op==='brtrue'))branch();continue}
  if(op==='blt'){const b=stack.pop(),a=stack.pop();if(a<b)branch();continue}
  if(op==='call'||op==='callvirt'){
   const r=i.Resolved,take=n=>stack.splice(stack.length-n,n).map(val),add=(n,fn)=>stack.push(fn(...take(n)));
   if(r.startsWith('GSqK.cSqL::')){add(1,x=>replay(i.Operand,[x]));continue}
   if(r==='System.Enum::HasFlag'){add(2,(a,b)=>(a&b)===b);continue}
   if(r==='TypeSpecification:1B00140B::get_HasValue'){add(1,x=>x!==null);continue}
   if(r==='TypeSpecification:1B00140B::get_Value'){add(1,x=>{assert.notEqual(x,null);return x});continue}
   if(r==='O5ut.K5u9::P3j2'){add(1,x=>x.width);continue}
   if(r==='O5ut.K5u9::j3jh'){add(1,x=>x.height);continue}
   if(r==='System.Math::Min'){add(2,Math.min);continue}
   throw Error(`Unmodelled call ${r}`);
  }
  if(op==='ret')return stack.pop();
  throw Error(`Unsupported ${op} at ${i.Offset.toString(16)}`);
 }
 throw Error('No stop/return');
}
const results=[];
const cornerBits=[1,2,4,8],borderBits=[2,4,8,1],sides=[[3,0],[0,1],[1,2],[2,3]];
for(const mode of ['stroke','fill'])for(let cornerMask=0;cornerMask<16;cornerMask++)for(let borderMask=0;borderMask<16;borderMask++){
 const nativeBorderMask=borderBits.reduce((n,bit,i)=>n+((borderMask&(1<<i))?bit:0),0);
 // Exact b5QE call roles: first stroke with nullable absent, then fill with sides15 plus original mask in nullable argument5.
 const args=[{width:200,height:100},90,5,mode==='fill'?15:nativeBorderMask,cornerMask,mode==='fill'?nativeBorderMask:null];
 const observed=replay(100722498,args,0x1c6);
 const b=borderBits.map((_,i)=>Boolean(borderMask&(1<<i))),c=cornerBits.map(bit=>Boolean(cornerMask&bit));
 const expected=sides.map(([a,z],i)=>c[i]&&(mode==='fill'?b[a]===b[z]:b[a]&&b[z]));
 const h=(expected[0]&&expected[3])||(expected[1]&&expected[2])?50:100;
 const w=(expected[0]&&expected[1])||(expected[2]&&expected[3])?100:200;
 assert.deepEqual(observed.corners,expected);assert.equal(observed.radius,Math.min(90,w,h));
 results.push({name:`${mode}-corner-${cornerMask}-border-${borderMask}`,input:{mode,cornerMask,borderMask,nativeBorderMask,width:200,height:100,radius:90},observed,pass:true});
}
const report={timestamp:new Date().toISOString(),kind:'Bounded CIL instruction replay of L5vW.i5vf from entry through IL01C4 radius assignment plus exact small Position predicates; not execution of Axure DLL or GUI.',assemblySha256:read(files[0]).SHA256,sources:files.map(path=>({path,sha256:hash(path)})),method:{token:100722498,firstIL:0,lastIL:0x1c4},sinks:['Rect Width/Height reads bound to metadata getter IDs','Nullable<Position> HasValue/Value','System.Enum.HasFlag bit operation','System.Math.Min','Unreferenced Point sentinel for preallocated array; no point geometry replay'],limitations:['Does not execute remainder of path building, render dispatch, SVG writing, or GUI.','b5QE call argument wiring is statically inspected, not replayed here.','Dynamic style.js fill intentionally differs: it reuses stroke-clamped radius.'],results};
fs.writeFileSync('research/native-corners-static-probes.json',JSON.stringify(report,null,2)+'\n');console.log(`${results.length}/${results.length} bounded static CIL prefix replays passed`);
