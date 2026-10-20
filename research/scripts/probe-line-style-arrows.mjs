// Bounded static CIL evaluator. Does not load or execute the proprietary assembly.
// Curve-stroke expansion is intentionally captured at its input, not mocked as an oracle.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,fields,sha256} from '../gradient-angle-static-flow.mjs';
const files=['research/line-style-arrow-base-cil.json','research/line-style-arrow-point-cil.json','research/line-style-arrow-circle-cil.json','research/line-style-arrow-parity-cil.json','research/line-style-platform-functions-cil.json'];
const methods=new Map(files.flatMap(f=>readJson(f).Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const ref=(v,k)=>({get:()=>v[k],set:x=>{v[k]=x;}}), deref=v=>v&&typeof v.get==='function'?v.get():v;
const primitive=new Map(),bind=(token,n,fn,returns=true)=>primitive.set(token,{n,fn,returns});
const point=(x,y)=>({x,y});
for(const m of readJson('research/line-style-arrow-point-cil.json').Types.flatMap(t=>t.Methods)){
  if(m.Name==='op_Addition')bind(m.Token,2,(a,b)=>point(a.x+b.x,a.y+b.y));
  if(m.Name==='op_Subtraction')bind(m.Token,2,(a,b)=>point(a.x-b.x,a.y-b.y));
  if(m.Name==='op_Multiply'&&m.Signature==='000211C00049C011C00049C00D')bind(m.Token,2,(a,b)=>point(a.x*b,a.y*b));
  if(m.Name==='op_Division')bind(m.Token,2,(a,b)=>point(a.x/b,a.y/b));
  if(m.Name==='op_UnaryNegation')bind(m.Token,1,a=>point(-a.x,-a.y));
}
bind(100721934,1,p=>deref(p).x);bind(100721936,1,p=>deref(p).y);
const allInstructions=[...methods.values()].flatMap(m=>m.Instructions);
for(const i of allInstructions){
  if(i.Resolved==='System.Math::Floor')bind(i.Operand,1,Math.floor);
  if(i.Resolved==='System.Math::Ceiling')bind(i.Operand,1,Math.ceil);
  if(i.Resolved==='System.Math::Max')bind(i.Operand,2,Math.max);
  if(i.Resolved==='Ebxh.rbx2::TbxU')bind(i.Operand,2,(x,t)=>Math.abs(x)<t);
  if(i.Resolved==='Ebxh.rbx2::qbxO')bind(i.Operand,3,(a,b,t)=>Math.abs(a-b)<t);
}
const signature=m=>{const b=Buffer.from(m.Signature,'hex');assert.ok(b[1]<128);return{count:b[1]+((b[0]&32)?1:0),returns:b[2]!==1};};
export function runCil(token,args,{trace=[]}={}){
  const m=methods.get(token);if(!m)throw Error('Missing CIL '+token);
  const code=m.Instructions,positions=new Map(code.map((i,k)=>[i.Offset,k])),locals=new Array(60).fill(0),stack=[];
  const ix=(op,p,v)=>op===p||op===p+'.s'?v:Number(op.slice(p.length+1));let ip=0,steps=0;
  const branch=x=>{if(!positions.has(x))throw Error('Bad target '+x);ip=positions.get(x);};
  while(ip<code.length){
    if(++steps>20000)throw Error('Bounded CIL step limit');
    const i=code[ip++],op=i.Op,v=i.Operand;trace.push(i.Offset);
    if(op.startsWith('ldc.i4'))stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
    else if(op==='ldc.r8')stack.push(v==='NaN'?NaN:v);
    else if(op.startsWith('ldarga'))stack.push(ref(args,v));
    else if(op.startsWith('ldarg'))stack.push(args[ix(op,'ldarg',v)]);
    else if(op.startsWith('ldloca'))stack.push(ref(locals,v));
    else if(op.startsWith('ldloc'))stack.push(locals[ix(op,'ldloc',v)]);
    else if(op.startsWith('stloc'))locals[ix(op,'stloc',v)]=stack.pop();
    else if(op==='ldsfld'){if(v===67142340)stack.push({flowFields:true});else if(i.Resolved==='m5wr.f5wV::m5wA')stack.push(point(NaN,NaN));else throw Error('Unknown static '+i.Resolved);}
    else if(op==='ldfld'){const o=deref(stack.pop());stack.push(o?.flowFields?fields.get(v).value:o[v]);}
    else if(op==='ldflda'){const o=deref(stack.pop());stack.push(ref(o,v));}
    else if(op==='dup')stack.push(stack.at(-1));else if(op==='pop')stack.pop();
    else if(op==='ldobj')stack.push(deref(stack.pop()));
    else if(op==='neg')stack.push(-stack.pop());
    else if(['add','sub','mul','div','rem','clt','ceq'].includes(op)){const b=stack.pop(),a=stack.pop();stack.push(({add:()=>a+b,sub:()=>a-b,mul:()=>a*b,div:()=>a/b,rem:()=>a%b,clt:()=>a<b,ceq:()=>a===b})[op]());}
    else if(op==='br'||op==='br.s')branch(v);
    else if(op.startsWith('brtrue')||op.startsWith('brfalse')){const yes=Boolean(stack.pop());if(yes===op.startsWith('brtrue'))branch(v);}
    else if(op==='switch'){const n=stack.pop();if(n>=0&&n<v.length)branch(v[n]);}
    else if(/^(beq|bne|ble|bge|blt|bgt)/.test(op)){let b=stack.pop(),a=stack.pop();const unordered=Number.isNaN(a)||Number.isNaN(b);if(op.includes('.un')&&Number.isInteger(a)&&Number.isInteger(b)&&!op.startsWith('bne')){a=a>>>0;b=b>>>0;}let yes=op.startsWith('beq')?a===b:op.startsWith('bne')?a!==b:op.startsWith('ble')?a<=b:op.startsWith('bge')?a>=b:op.startsWith('blt')?a<b:a>b;if(op.includes('.un')&&unordered)yes=true;if(yes)branch(v);}
    else if(op==='newobj'){
      if(i.Resolved?.startsWith('TypeSpecification:'))stack.push([]);
      else if(v===100721941){const y=stack.pop(),x=stack.pop();stack.push(point(x,y));}
      else if(i.Resolved==='m5y9.J5yS::.ctor'){const b=stack.pop(),a=stack.pop();stack.push({kind:'line',a,b});}
      else if(i.Resolved==='K5yc.r5yk::.ctor'){const ccw=stack.pop(),r=stack.pop(),center=stack.pop(),b=stack.pop(),a=stack.pop();stack.push({kind:'arc',a,b,center,r,ccw});}
      else if(i.Resolved==='Q5hy.I5hl::.ctor'){const count=v===100720129?3:v===100720125?5:0;if(!count)throw Error('Unknown curve ctor');const a=stack.splice(stack.length-count);stack.push(count===3?{kind:'line',a:a[0],b:a[1]}:{kind:'cubic',a:a[0],c:a[1],d:a[2],b:a[3]});}
      else throw Error('Unbound constructor '+v+' '+i.Resolved);
    }else if(op==='call'||op==='callvirt'){
      if(v===100721941){const y=stack.pop(),x=stack.pop();stack.pop().set(point(x,y));}
      else if(primitive.has(v)){const p=primitive.get(v),a=stack.splice(stack.length-p.n),r=p.fn(...a);if(p.returns)stack.push(r);}
      else if(i.Resolved?.startsWith('TypeSpecification:')&&i.Resolved.endsWith('::Add')){const x=stack.pop();stack.pop().push(x);}
      else if(i.Resolved?.startsWith('TypeSpecification:')&&i.Resolved.endsWith('::get_Item')){const n=stack.pop();stack.push(stack.pop()[n]);}
      else if(v===100719005){const curves=stack.pop(),owner=stack.pop();throw Object.assign(Error('Captured native stroke expansion'),{unresolved:{token:v,position:i.Offset,curves,width:owner[widthField],cap:'flat'}});}
      else if(methods.has(v)){const sig=signature(methods.get(v)),a=stack.splice(stack.length-sig.count),r=runCil(v,a);if(sig.returns)stack.push(r);}
      else throw Error('Unbound call '+v+' '+i.Resolved);
    }else if(op==='ret')return stack.pop();else throw Error('Unsupported '+op+' '+token+':'+i.Offset);
  }throw Error('No return');
}
const widthField=readJson(files[0]).Types[0].Fields.find(f=>f.Name==='Y5EI').Token;
export const nativeDimensions=(style,width)=>({first:runCil(100708186,[style]),second:runCil(100708187,[style]),offset:runCil(100718990,[style,width]),secondOffset:runCil(100718991,[style,width]),cut:runCil(100718989,[{[widthField]:width},style]),tipExtension:runCil(100718988,[style,width])});
export const nativePrimitive=(style,width,position=point(0,0),direction=point(1,0))=>runCil(100718992,[{[widthField]:width},direction,position,style]);
if(process.argv[1]?.replaceAll('\\','/').endsWith('/probe-line-style-arrows.mjs')){
  const results=[];for(const width of [.5,1,2,3,4,4.5,5,10])for(let style=1;style<=29;style++){
    const dimensions=nativeDimensions(style,width);let geometry,unresolved;
    try{geometry=nativePrimitive(style,width);}catch(e){if(!e.unresolved)throw e;unresolved=e.unresolved;}
    results.push({style,width,dimensions,geometry,unresolved});
  }
  const report={kind:'Bounded self-written static CIL interpreter; no proprietary DLL or GUI execution',scope:'Exact arithmetic and list/point/arc primitive bindings. Open-curve stroke conversion captured as unresolved, not substituted.',sources:files.map(path=>({path,sha256:sha256(path)})),results};
  fs.writeFileSync('research/line-style-arrow-probes.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:results.length,geometry:results.filter(x=>x.geometry).length,unresolved:results.filter(x=>x.unresolved).length}));
}
