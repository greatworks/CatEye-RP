// Bounded static interpretation of pinned CIL instructions. Never loads the original DLL.
import fs from 'node:fs';
import {fields,readJson} from './gradient-angle-static-flow.mjs';
const files=['research/text-autofit-native-literal-dispatch-cil.json','research/text-autofit-native-literal-data-cil.json','research/text-autofit-native-literal-transform-cil.json'];
const methods=new Map(files.flatMap(f=>readJson(f).Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const resource=fs.readFileSync('research/text-autofit-native-literals.bin');
const statics=new Map([[67142215,Buffer.alloc(0)]]);
const truth=x=>x!==null&&x!==undefined&&x!==false&&x!==0&&x!==0n;
const int=x=>Number(BigInt.asIntN(32,BigInt(x)));
const u32=x=>Number(BigInt.asUintN(32,BigInt(x)));
export const trace=[];
function run(token,args,depth=0){
 if(depth>8)throw Error('Depth limit');
 const m=methods.get(token);if(!m)throw Error('Unknown method '+token);
 const at=new Map(m.Instructions.map((i,n)=>[i.Offset,n]));const stack=[],locals=[];let pc=0,steps=0;
 const pop=()=>{if(!stack.length)throw Error('Stack underflow '+token);return stack.pop();};
 const bin=(op)=>{const b=pop(),a=pop();const big=typeof a==='bigint'||typeof b==='bigint';const A=big?BigInt(a):a,B=big?BigInt(b):b;
   const v=op==='add'?A+B:op==='sub'?A-B:op==='mul'?(big?A*B:Math.imul(A,B)):op==='xor'?(big?A^B:A^B):op==='or'?(big?A|B:A|B):op==='and'?(big?A&B:A&B):op==='shl'?(big?A<<B:A<<(B&31)):op==='shr.un'?(big?BigInt.asUintN(64,A)>>B:A>>>(B&31)):op==='shr'?(big?A>>B:A>>(B&31)):op==='rem.un'?(big?BigInt.asUintN(64,A)%BigInt.asUintN(64,B):u32(A)%u32(B)):op==='rem'?A%B:op==='div'?(big?A/B:Math.trunc(A/B)):undefined;
   if(v===undefined)throw Error('Operation '+op);stack.push(big?BigInt.asIntN(64,v):int(v));};
 while(pc<m.Instructions.length){if(++steps>100000000)throw Error('Step limit');const i=m.Instructions[pc++],op=i.Op,v=i.Operand;
  const jump=()=>{if(!at.has(v))throw Error('Missing branch');pc=at.get(v);};
  const idx=prefix=>op===prefix||op===prefix+'.s'?v:Number(op.slice(prefix.length+1));
  if(op==='nop')continue;
  if(op.startsWith('ldc.i4'))stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
  else if(op.startsWith('ldarg'))stack.push(args[idx('ldarg')]);
  else if(op.startsWith('ldloc'))stack.push(locals[idx('ldloc')]??0);
  else if(op.startsWith('stloc'))locals[idx('stloc')]=pop();
  else if(op==='ldnull')stack.push(null);
  else if(op==='ldstr')stack.push(i.Resolved??v);
  else if(op==='ldtoken')stack.push({token:v});
  else if(op==='dup')stack.push(stack.at(-1));
  else if(op==='pop')pop();
  else if(['add','sub','mul','xor','or','and','shl','shr','shr.un','rem','rem.un','div'].includes(op))bin(op);
  else if(op==='neg')stack.push(-pop());
  else if(op==='not')stack.push(~pop());
  else if(op==='conv.i4')stack.push(int(pop()));
  else if(op==='conv.u4')stack.push(u32(pop()));
  else if(op==='conv.u1')stack.push(u32(pop())&255);
  else if(op==='conv.i8')stack.push(BigInt.asIntN(64,BigInt(pop())));
  else if(op==='conv.u8'){const x=pop();stack.push(typeof x==='bigint'?BigInt.asUintN(64,x):BigInt(u32(x)));}
  else if(op==='ceq'){const b=pop(),a=pop();stack.push(a===b?1:0);}
  else if(op==='newarr'){const size=pop();if(size<0||size>4000000)throw Error('Array bound');stack.push(Buffer.alloc(size));}
  else if(op==='ldlen')stack.push(pop().length);
  else if(op==='stelem.i1'){const value=pop(),n=pop(),a=pop();if(n<0||n>=a.length)throw Error('Index bound');a[n]=value&255;}
  else if(op==='ldelem.u1'){const n=pop(),a=pop();if(n<0||n>=a.length)throw Error('Index bound');stack.push(a[n]);}
  else if(op==='ldsfld')stack.push(statics.get(v)??{module:true});
  else if(op==='stsfld')statics.set(v,pop());
  else if(op==='ldfld'){const object=pop();stack.push(object.module?fields.get(v).value:object[v]);}
  else if(op==='stfld'){const value=pop(),o=pop();o[v]=value;}
  else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s')jump();
  else if(op==='brtrue'||op==='brtrue.s'){if(truth(pop()))jump();}
  else if(op==='brfalse'||op==='brfalse.s'){if(!truth(pop()))jump();}
  else if(['beq','bne.un','bgt','bge','blt','ble'].includes(op)){const b=pop(),a=pop();if(op==='beq'?a===b:op==='bne.un'?a!==b:op==='bgt'?a>b:op==='bge'?a>=b:op==='blt'?a<b:a<=b)jump();}
  else if(op==='ret')return stack.pop();
  else if(op==='newobj'){
    if(v===100732103){const iv=pop(),key=pop();trace.push({kind:'resource-key',key:Buffer.from(key).toString('hex'),iv:Buffer.from(iv).toString('hex')});stack.push({67142217:key,67142216:iv});}
    else if(i.Resolved==='System.IO.BinaryReader::.ctor')stack.push({stream:pop()});
    else throw Error('Unknown ctor '+i.Resolved);
  }else if(op==='call'||op==='callvirt'){
    if(v===100732110)stack.push(1); // retained pure null==null predicate
    else if(v===100732111)stack.push(null); // retained pure null predicate
    else if(v===100732105){const arg=pop(),self=pop();stack.push(run(v,[self,arg],depth+1));}
    else if(v===100732104){const input=pop(),self=pop();stack.push(run(v,[self,input],depth+1));}
    else if(i.Resolved==='System.IO.BinaryReader::get_BaseStream')stack.push(pop().stream);
    else if(i.Resolved==='System.IO.Stream::set_Position'){pop();pop();}
    else if(i.Resolved==='System.IO.Stream::get_Length')stack.push(BigInt(pop().length));
    else if(i.Resolved==='System.IO.BinaryReader::ReadBytes'){const n=pop(),r=pop();stack.push(r.stream.subarray(0,n));}
    else if(i.Resolved==='System.IDisposable::Dispose')pop();
    else if(['System.Type::GetTypeFromHandle','System.Reflection.IntrospectionExtensions::GetTypeInfo','System.Reflection.TypeInfo::get_Assembly'].includes(i.Resolved)){pop();stack.push({metadata:true});}
    else if(i.Resolved==='System.Reflection.Assembly::GetManifestResourceStream'){const name=pop();pop();if(name!=='hULtVIBFeFhT1bNiXx.Bg3ExKVhJ7GsK7IETg')throw Error('Resource name');stack.push(resource);}
    else if(i.Resolved==='System.BitConverter::ToInt32'){const offset=pop(),b=pop();stack.push(b.readInt32LE(offset));}
    else if(i.Resolved==='System.Text.Encoding::get_Unicode')stack.push({encoding:'utf16le'});
    else if(i.Resolved==='System.Text.Encoding::GetString'){const n=pop(),offset=pop(),b=pop();pop();stack.push(b.subarray(offset,offset+n).toString('utf16le'));}
    else if(i.Resolved==='System.Array::Copy'){const n=pop(),destOff=pop(),dest=pop(),sourceOff=pop(),source=pop();source.copy(dest,destOff,sourceOff,sourceOff+n);}
    else throw Error('Unmodelled call '+i.Resolved+' in '+token+' at '+i.Offset);
  }else throw Error('Unmodelled opcode '+op+' in '+token+' at '+i.Offset);
 }
 throw Error('Missing ret');
}
export const decodeLiteral=offset=>run(100732102,[offset]);
export function findLiteralRecords(needles){
 decodeLiteral(351510);const data=statics.get(67142215),matches=[];
 for(let p=0;p<data.length;){if(p+4>data.length)throw Error('Truncated record');const n=data.readInt32LE(p);if(n<0||n%2||p+4+n>data.length)throw Error('Invalid record '+p);const text=data.subarray(p+4,p+4+n).toString('utf16le');if(needles.some(s=>text.includes(s)))matches.push({offset:p,text});p+=4+n;}
 return matches;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/text-autofit-native-literals.mjs')){
 const offsets=process.argv.slice(2).map(Number);for(const offset of offsets)console.log(JSON.stringify({offset,text:decodeLiteral(offset)}));
}
