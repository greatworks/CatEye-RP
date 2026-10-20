// Executes ONLY our bounded interpreter over retained CIL JSON. No target assembly is loaded.
// Rectangle/point primitive bindings below are independently pinned to getter/constructor CIL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readJson, fields, sha256 } from './gradient-angle-static-flow.mjs';
const sourceFiles = ['research/gradient-angle-geometry-cil.json','research/gradient-angle-lines-cil.json','research/gradient-angle-rect-cil.json','research/gradient-angle-rect-fields-cil.json','research/gradient-angle-matrix-cil.json','research/gradient-angle-point-cil.json','research/gradient-angle-zero-cil.json','research/gradient-angle-number-cil.json','research/gradient-format-linear-paint-cil.json','research/gradient-format-serialization-cil.json','research/gradient-angle-version-cil.json','research/gradient-angle-version-compare-cil.json','research/gradient-angle-version-order-cil.json','research/gradient-angle-version-fields-cil.json','research/gradient-angle-flow-init-cil.json','research/gradient-angle-static-fields.json'];
const methods = new Map(sourceFiles.filter(f => f.endsWith('-cil.json')).flatMap(file => readJson(file).Types.flatMap(t => t.Methods)).map(m => [m.Token,m]));
const ref = (values, key) => ({ get: () => values[key], set: value => {values[key] = value;} });
const deref = value => value && typeof value.get === 'function' ? value.get() : value;
const primitive = new Map();
const bind = (token,count,fn,returns=true) => primitive.set(token,{count,fn,returns});
bind(100721934,1,p=>deref(p).x); bind(100721936,1,p=>deref(p).y);
for(const [token,key] of [[100722047,'x'],[100722049,'y'],[100722051,'width'],[100722053,'height']])bind(token,1,r=>deref(r)[key]);
bind(100722029,1,r=>({...deref(r)})); // K5u9.G3bi dispatched to j5u5.G3bi, returns this rectangle
bind(100722035,1,()=>0); // j5u5.uIuQ literal zero; oriented-rectangle implementations excluded
bind(100722041,1,r=>{const v=deref(r);return {a:v.width,b:0,c:0,d:v.height,e:v.x,f:v.y};}); // j5u5.y3bp
bind(100688898,1,m=>{const v=deref(m);assert.equal(v.b,0);assert.equal(v.c,0);return {a:1/v.a,b:0,c:0,d:1/v.d,e:-v.e/v.a,f:-v.f/v.d};}); // inverse of the axis-aligned rectangle matrix only
bind(100721995,2,(m,p)=>{m=deref(m);p=deref(p);return{x:p.x*m.a+p.y*m.c+m.e,y:p.x*m.b+p.y*m.d+m.f};});
bind(167792185,1,Math.tan); bind(167774838,1,Math.abs); bind(167784878,1,Number.isNaN);
bind(100721113,1,g=>g.angle); bind(100721114,2,(g,v)=>{g.angle=v;},false);
bind(100720861,2,(g,p)=>{g.start=p;},false);bind(100720863,2,(g,p)=>{g.end=p;},false);
for(const [token,index]of [[100688456,0],[100688457,1],[100688458,2],[100688459,3]])bind(token,1,v=>v[index]);
bind(100732102,1,n=>({opaqueLiteralIndex:n})); // Literal identity irrelevant to the angle branch probe.
bind(100716030,2,(map)=>map.angle); // Selected single lookup at IL856, stop before unrelated fields.
bind(100718349,1,x=>x);

export function runCil(token,args,{start=0,stopAfter,trace=[],initialLocals=[]}={}) {
  const method=methods.get(token);if(!method)throw Error('No method '+token);
  const code=method.Instructions,positions=new Map(code.map((i,k)=>[i.Offset,k])),locals=[...initialLocals],stack=[];
  let ip=positions.get(start),steps=0;
  const branch=offset=>{if(!positions.has(offset))throw Error('Bad CIL target');ip=positions.get(offset);};
  const index=(op,prefix,value)=>op===prefix||op===prefix+'.s'?value:Number(op.slice(prefix.length+1));
  while(ip<code.length){
    if(++steps>10000)throw Error('CIL step limit');
    const ins=code[ip++],op=ins.Op,v=ins.Operand;trace.push(ins.Offset);
    if(op.startsWith('ldc.i4'))stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
    else if(op==='ldc.r8')stack.push(v==='NaN'?NaN:v);
    else if(op.startsWith('ldarga'))stack.push(ref(args,v));
    else if(op.startsWith('ldarg'))stack.push(args[index(op,'ldarg',v)]);
    else if(op.startsWith('ldloca'))stack.push(ref(locals,v));
    else if(op.startsWith('ldloc'))stack.push(locals[index(op,'ldloc',v)]);
    else if(op.startsWith('stloc'))locals[index(op,'stloc',v)]=stack.pop();
    else if(op==='ldsfld') {if(v===67142340)stack.push({flowFields:true});else if(v===67121468)stack.push([9,0,0,0]);else throw Error('Unknown static '+v);}
    else if(op==='ldfld'){const object=deref(stack.pop());if(!object?.flowFields||!fields.has(v))throw Error('Unknown field '+v);stack.push(fields.get(v).value);}
    else if(op==='dup')stack.push(stack.at(-1));else if(op==='pop')stack.pop();
    else if(op==='stobj'){const x=stack.pop(),p=stack.pop();p.set(x);}
    else if(op==='ldobj')stack.push(deref(stack.pop()));
    else if(op==='neg')stack.push(-stack.pop());else if(op==='not')stack.push(~stack.pop());
    else if(['add','sub','mul','div','rem','xor','and','or','shl','shr','clt','ceq'].includes(op)){
      const b=stack.pop(),a=stack.pop();stack.push(({add:()=>a+b,sub:()=>a-b,mul:()=>a*b,div:()=>a/b,rem:()=>a%b,xor:()=>a^b,and:()=>a&b,or:()=>a|b,shl:()=>a<<b,shr:()=>a>>b,clt:()=>a<b,ceq:()=>a===b})[op]());
    }else if(op==='br'||op==='br.s')branch(v);
    else if(op==='brtrue'||op==='brfalse'||op==='brtrue.s'||op==='brfalse.s'){const yes=Boolean(stack.pop());if(yes===op.startsWith('brtrue'))branch(v);}
    else if(/^(beq|bne|ble|bge|blt|bgt)/.test(op)){
      const b=stack.pop(),a=stack.pop(),unordered=Number.isNaN(a)||Number.isNaN(b);
      let yes=op.startsWith('beq')?a===b:op.startsWith('bne')?a!==b:op.startsWith('ble')?a<=b:op.startsWith('bge')?a>=b:op.startsWith('blt')?a<b:a>b;
      if(op.includes('.un')&&unordered)yes=true;if(yes)branch(v);
    }else if(op==='newobj'&&v===100721941){const y=stack.pop(),x=stack.pop();stack.push({x,y});}
    else if(op==='newobj'&&v===100721109)stack.push({angle:NaN});
    else if((op==='call'||op==='callvirt')&&v===100721941){const y=stack.pop(),x=stack.pop();stack.pop().set({x,y});}
    else if(op==='call'||op==='callvirt'){
      if(primitive.has(v)){const binding=primitive.get(v),a=stack.splice(stack.length-binding.count);const result=binding.fn(...a);if(binding.returns)stack.push(result);}
      else if([100720513,100720514].includes(v)){stack.push(runCil(v,stack.splice(stack.length-4)));}
      else if([100722055,100722056,100722057,100722058,100722061,100722062,100722064,100722065,100722075].includes(v)){stack.push(runCil(v,[stack.pop()]));}
      else if([100688813,100688470,100688475].includes(v))stack.push(runCil(v,stack.splice(stack.length-2)));
      else if([100688824].includes(v))stack.push(runCil(v,[stack.pop()]));
      else if(v===100720512){runCil(v,stack.splice(stack.length-4));}
      else throw Error(`Unbound call ${v} at ${token}:${ins.Offset}`);
    }else if(op==='ret')return stack.pop();
    else throw Error(`Unsupported opcode ${op} at ${token}:${ins.Offset}`);
    if(stopAfter===ins.Offset)return {locals,trace,stack};
  }
  throw Error('No return');
}
export function nativeRectGradient(rect,angle){
  const out=[];runCil(100720512,[rect,angle,ref(out,0),ref(out,1)]);return {start:out[0],end:out[1]};
}
// Independent geometric oracle: project the four corners onto a center line.
// Unlike the native CIL, it uses unit vectors/dot products, not tangent/intersection helpers.
export function projectedRectGradient(rect,angle){
  const normalized=((angle%360)+360)%360,radians=normalized*Math.PI/180;
  const d=normalized===0?{x:1,y:0}:normalized===90?{x:0,y:1}:normalized===180?{x:-1,y:0}:normalized===270?{x:0,y:-1}:{x:Math.cos(radians),y:Math.sin(radians)};
  const center={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  const distances=[0,1].flatMap(x=>[0,1].map(y=>(rect.x+x*rect.width-center.x)*d.x+(rect.y+y*rect.height-center.y)*d.y));
  return Object.fromEntries([['start',Math.min(...distances)],['end',Math.max(...distances)]].map(([name,t])=>[name,{x:center.x+t*d.x,y:center.y+t*d.y}]));
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const rects=[{x:0,y:0,width:200,height:100},{x:10,y:-30,width:70,height:300},{x:-5,y:8,width:100,height:100},{x:0,y:0,width:.25,height:800},{x:0,y:0,width:0,height:100},{x:0,y:0,width:100,height:0}];
const angles=[-1080,-721,-360,-315,-270,-225,-180,-135,-90,-45,-1,-.001,0,.001,1,15,30,45,60,89.999,90,90.001,120,135,179.999,180,180.001,225,269.999,270,270.001,315,359.999,360,405,721,1080];
const cases=[];for(const rect of rects)for(const angle of angles){const actual=nativeRectGradient(rect,angle),oracle=projectedRectGradient(rect,angle);for(const name of ['start','end'])for(const axis of ['x','y'])close(actual[name][axis],oracle[name][axis]);cases.push({rect,angle,actual,oracle});}
const versionBranches=[];
for(const version of [[8,9,9,9],[9,0,0,0],[10,0,0,0],[11,0,0,0]]){
  const trace=[],result=runCil(100718382,[{},version],{start:58,stopAfter:version[0]<9?866:1106,trace,initialLocals:[{angle:73}]});
  const internal=result.locals[3].angle;
  assert.equal(Number.isNaN(internal),version[0]>=9);if(version[0]<9)assert.equal(internal,73);
  versionBranches.push({version,storedAngle:73,internalAngle:Number.isNaN(internal)?'NaN':internal,trace,readsLegacyAngle:trace.includes(856)});
  assert.ok(trace.includes(963));
}
const normalizations=[];for(const rect of rects.slice(0,4))for(const angle of [NaN,0,45,90,-45,360]){
  const gradient={angle,start:{x:.1,y:.2},end:{x:.7,y:.8}},before=structuredClone(gradient),trace=[];
  runCil(100721123,[gradient,rect],{trace});assert.ok(Number.isNaN(gradient.angle));
  if(Number.isNaN(angle))assert.deepEqual(gradient,before);else{const expected=projectedRectGradient(rect,angle);for(const name of ['start','end']){close(gradient[name].x,(expected[name].x-rect.x)/rect.width);close(gradient[name].y,(expected[name].y-rect.y)/rect.height);}}
  normalizations.push({rect,angle:Number.isNaN(angle)?'NaN':angle,gradient:{...gradient,angle:'NaN'},trace});
}
const report={method:'Bounded self-written CIL instruction interpreter over pinned static JSON; independent vector-projection oracle; NOT original DLL or GUI execution',scope:'Unrotated j5u5 rectangles; oriented K5u9 implementation and full legacy object admission remain outside production scope',geometryCases:cases.length,normalizationCases:normalizations.length,versionBranches,cases,normalizations,sources:[...sourceFiles,'research/gradient-angle-probe.mjs','research/gradient-angle-static-flow.mjs'].map(file=>({file,sha256:sha256(file)}))};
fs.writeFileSync('research/gradient-angle-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({geometryCases:cases.length,normalizationCases:normalizations.length,versionBranches}));
