// Execute retained CIL records, not CLR/vendor code. BCL/geometry facades are explicit.
import fs from 'node:fs';
import * as matrixApi from './selection-svg-body-matrix-api.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fields} from './gradient-angle-static-flow.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceFiles=[...fs.readdirSync('research').filter(n=>/^selection-svg-body-paint-.*-cil\.json$/.test(n)).map(n=>'research/'+n),'research/line-style-svg-writer-cil.json','research/line-style-svg-pen-base-cil.json','research/selection-layout-border-chain-cil.json','research/selection-layout-indicator-draw-cil.json','research/line-style-platform-functions-cil.json','research/selection-layout-indicator-html-geometry-cil.json'];
const methods=new Map(), types=new Map();
for(const file of sourceFiles)for(const t of read(file).Types){types.set(t.Name,t);for(const m of t.Methods)methods.set(m.Token,{...m,file,type:t.Name});}
const literals=new Map(read('research/selection-svg-body-paint-literals.json').records.map(x=>[x.offset,x.text]));
const VOID=Symbol('void'), deref=v=>v?.ref?v.get():v, copy=v=>deref(v)?.struct?{...deref(v)}:deref(v);
const ref=(o,k)=>({ref:true,get:()=>o[k],set:v=>o[k]=copy(v)}), assign=(r,v)=>r.ref?r.set(v):Object.assign(r,v);
const point=(x,y)=>({struct:'point',x,y}), rect=(x,y,width,height)=>({struct:'rect',x,y,width,height}), size=(width,height)=>({struct:'size',width,height});
const matrix=(a=1,b=0,c=0,d=1,e=0,f=0)=>({struct:'matrix',a,b,c,d,e,f});
let records=[], calls=[], sinks=[], currentWriter;
const handlers=new Map(), bind=(t,n,fn)=>handlers.set(t,{n,fn}), arity=m=>parseInt(m.Signature.slice(2,4),16)+(m.Signature.startsWith('20')?1:0);
const virtual=new Map([[100720957,'n3bt'],[100719898,'v3JR'],[100723852,'W3bv']]);
function invoke(t,args,op='call'){
 if(handlers.has(t)){const h=handlers.get(t);return h.fn(args,op);}
 let m=methods.get(t);assert(m,'Missing method '+t);
 if(virtual.has(t)){const target=types.get(args[0].__type)?.Methods.find(x=>x.Name===virtual.get(t));assert(target,`Virtual target ${t}/${args[0].__type}`);m=methods.get(target.Token);}
 if(op==='newobj'){const obj={__type:m.type};execute(m.Token,[obj,...args]);return obj;}
 return execute(m.Token,args);
}
function execute(t,args){
 const m=methods.get(t);assert(m,'Missing CIL '+t);const code=m.Instructions, byOffset=new Map(code.map((i,n)=>[i.Offset,n]));
 const stack=[],locals=[],trace=[];let pc=0,steps=0;
 const pop=()=>{assert(stack.length,`Underflow ${t}`);return stack.pop();},jump=v=>{assert(byOffset.has(v));pc=byOffset.get(v);};
 while(steps++<20000){const i=code[pc++];assert(i,`EOF ${t}`);const op=i.Op,v=i.Operand;trace.push(i.Offset);
  if(['nop','box','unbox.any','constrained.','castclass','conv.r8','conv.i4'].includes(op)){}
  else if(op==='ldnull')stack.push(null);
  else if(op==='ldstr')stack.push(i.Resolved);
  else if(op.startsWith('ldc.i4'))stack.push(['ldc.i4','ldc.i4.s'].includes(op)?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
  else if(op==='ldc.r8')stack.push(v==='NaN'?NaN:v);
  else if(op==='ldarg.s'||/^ldarg\.[0-3]$/.test(op))stack.push(args[op==='ldarg.s'?v:Number(op.slice(6))]?.ref ? args[op==='ldarg.s'?v:Number(op.slice(6))] : copy(args[op==='ldarg.s'?v:Number(op.slice(6))]));
  else if(op==='ldarga.s')stack.push(ref(args,v));
  else if(op==='ldloc.s'||/^ldloc\.[0-3]$/.test(op))stack.push(copy(locals[op==='ldloc.s'?v:Number(op.slice(6))]??null));
  else if(op==='ldloca.s'||op==='ldloca')stack.push(ref(locals,v));
  else if(op==='stloc.s'||/^stloc\.[0-3]$/.test(op))locals[op==='stloc.s'?v:Number(op.slice(6))]=copy(pop());
  else if(op==='ldfld')stack.push(copy(deref(pop())[v]??null));
  else if(op==='ldflda')stack.push(ref(deref(pop()),v));
  else if(op==='stfld'){const value=copy(pop());deref(pop())[v]=value;}
  else if(op==='ldsfld'){if(v===67142340)stack.push(Object.fromEntries([...fields].map(([k,x])=>[k,x.value])));else if(v===67134003)stack.push('http://www.w3.org/2000/svg');else if(v===67120072)stack.push('invariant');else if(v===67135090)stack.push(size(0,0));else throw Error('Unknown static '+v);}
  else if(op==='dup')stack.push(stack.at(-1));else if(op==='pop')pop();
  else if((op==='stind.ref'||op==='stobj')){const value=pop();assign(pop(),value);}
  else if(op==='initobj')assign(pop(),null);
  else if(op==='newarr')stack.push(new Array(pop()).fill(null));
  else if(op==='ldlen')stack.push(deref(pop()).length);
  else if(op.startsWith('ldelem')){const n=pop();stack.push(copy(pop()[n]));}
  else if(op.startsWith('stelem')){const x=copy(pop()),n=pop();pop()[n]=x;}
  else if(op==='ldftn')stack.push({fn:v});
  else if(op==='isinst'){const x=deref(pop());const type=types.get(x?.__type);stack.push(type?.Token===v?x:null);}
  else if(op==='not')stack.push(~pop());else if(op==='neg')stack.push(-pop());
  else if(['add','sub','mul','div','rem','xor','and','or','shl','shr','shr.un','ceq','cgt','clt','cgt.un','clt.un'].includes(op)){
   const b=deref(pop()),a=deref(pop());stack.push(({add:()=>a+b,sub:()=>a-b,mul:()=>a*b,div:()=>a/b,rem:()=>a%b,xor:()=>a^b,and:()=>a&b,or:()=>a|b,shl:()=>a<<b,shr:()=>a>>b,'shr.un':()=>a>>>b,ceq:()=>a===b?1:0,cgt:()=>a>b?1:0,clt:()=>a<b?1:0,'cgt.un':()=>a>b||a!=null&&b===null||Number.isNaN(a)||Number.isNaN(b)?1:0,'clt.un':()=>a<b||Number.isNaN(a)||Number.isNaN(b)?1:0})[op]());
  } else if(['br','br.s','leave','leave.s'].includes(op))jump(v);
  else if(op==='switch'){const n=pop();if(n>=0&&n<v.length)jump(v[n]);}
  else if(op.startsWith('brtrue')){if(deref(pop()))jump(v);}else if(op.startsWith('brfalse')){if(!deref(pop()))jump(v);}
  else if(['beq','bne.un','bge','bgt','ble','blt','ble.un','bgt.un','blt.un','bge.un'].includes(op)){const b=deref(pop()),a=deref(pop());const yes=op==='beq'?a===b:op==='bne.un'?a!==b:op.startsWith('bge')?a>=b:op.startsWith('bgt')?a>b:op.startsWith('ble')?a<=b:a<b;if(yes||op.endsWith('.un')&&(Number.isNaN(a)||Number.isNaN(b)))jump(v);}
  else if(['call','callvirt','newobj'].includes(op)){
   let count=handlers.get(v)?.n??(methods.has(v)?arity(methods.get(v)):undefined);
   if(virtual.has(v))count=2+(v===100723852?1:-1);
   if(op==='newobj'&&!handlers.has(v))count--;
   assert(Number.isInteger(count)&&stack.length>=count,`Unknown/underflow call ${t}:${i.Offset} -> ${v} ${i.Resolved}, count=${count}, stack=${stack.length}`);
   const a=stack.splice(stack.length-count,count),r=invoke(v,a,op);calls.push({from:t,il:i.Offset,to:v});if(r!==VOID)stack.push(copy(r));
  } else if(op==='ret'){assert(stack.length<=1,`Return stack ${t} ${stack.length}`);records.push({token:t,trace});return stack.length?copy(pop()):VOID;}
  else throw Error(`Unknown ${op} ${t}:${i.Offset}`);
 }
 throw Error('Budget '+t);
}
// Framework and immutable value operations. Formatting is checked separately.
bind(100732116,0,()=>VOID);bind(167772266,1,()=>VOID);bind(100720958,1,()=>VOID);bind(100723753,2,()=>VOID);
bind(100732102,1,([n])=>{assert(literals.has(n),'Literal '+n);return literals.get(n);});
bind(100688623,2,([fmt,a])=>fmt.replace(/\{(\d+)\}/g,(_,n)=>String(a[+n])));
bind(167772275,3,([provider,fmt,a])=>fmt.replace(/\{(\d+)\}/g,(_,n)=>String(a[+n])));
bind(167772398,3,a=>a.join(''));bind(167772192,2,a=>a.join(''));
bind(167776374,0,()=>({parts:[]}));bind(167776375,2,([b,s])=>{deref(b).parts.push(s);return deref(b);});bind(167772224,1,([b])=>deref(b).parts.join(''));
bind(167772849,3,([r])=>{assign(r,{parts:[]});return VOID;});for(const t of [167772847,167772976])bind(t,2,([r,s])=>{deref(r).parts.push(s);return VOID;});bind(167772848,1,([r])=>deref(r).parts.join(''));
for(const t of [167795678,167795532])bind(t,0,()=>[]);
for(const t of [167795681,167795535,167796713])bind(t,2,([a,x])=>{deref(a).push(x);return VOID;});
for(const t of [167795689,167785935,167795686,167795536,167795675])bind(t,1,([a])=>({items:deref(a),index:-1}));
for(const t of [167795690,167785936,167795684,167795537,167795676])bind(t,1,([e])=>deref(e).items[deref(e).index]);
for(const t of [167772305,167795685,167795538,167795677])bind(t,1,([e])=>++deref(e).index<deref(e).items.length);
bind(167772304,1,()=>VOID);bind(167796714,1,([a])=>a.at(-1));
bind(167773049,0,()=>({}));bind(167773078,3,([o,k,v])=>{o[k]=v;return VOID;});bind(167773077,2,([o,k])=>o[k]);bind(167776632,1,([o])=>Object.keys(o));
bind(721424377,2,([a,b])=>{Object.assign(a,b);return VOID;});bind(721423821,1,([x])=>[x]);
bind(100688813,2,([a,b])=>Math.abs(a)<b);bind(100688814,2,([a,b])=>Math.abs(a)>=b);bind(100688818,1,([n])=>Math.abs(n)<1e-5?0:n);
bind(100721934,1,([p])=>deref(p).x);bind(100721936,1,([p])=>deref(p).y);
bind(100721941,2,([x,y])=>point(x,y));
bind(100722966,2,([w,h])=>size(w,h));
bind(100721988,1,([p])=>execute(100721988,[p]));
for(const [t,key] of [[100719115,'r'],[100719117,'g'],[100719119,'b'],[100719114,'a']])bind(t,1,([c])=>deref(c)[key]);
bind(100723756,1,([o])=>o[67135440]);
for(const [t,key]of [[100688876,'a'],[100688880,'b'],[100688878,'c'],[100688882,'d'],[100688884,'e'],[100688886,'f']])bind(t,1,([m])=>deref(m)[key]);
bind(100688891,1,([m])=>{m=deref(m);return m.a===1&&m.b===0&&m.c===0&&m.d===1&&m.e===0&&m.f===0;});
bind(100723767,2,([o])=>{o[67135440]=matrix();return VOID;});
bind(100723595,1,([g])=>g.commandMatrix); // independently closed in selection-svg-body-matrix-probes.json
bind(167794591,2,([ns,name])=>name);bind(167794592,1,([tag])=>({tag,attrs:{},children:[]}));bind(167796716,1,([x])=>x);
bind(167796717,2,([e,k])=>Object.hasOwn(e.attrs,k)?{value:e.attrs[k]}:null);bind(167796718,1,([a])=>a.value);
bind(167796740,3,([e,k,v])=>{if(v===null)delete e.attrs[k];else e.attrs[k]=v;return VOID;});
bind(100723515,3,([e,k,v])=>{e.attrs[k]=String(v);sinks.push({kind:'attribute',key:k,value:String(v)});return VOID;});
bind(100723512,3,([e,k,v])=>{e.attrs[k]=String(v);sinks.push({kind:'number-attribute',key:k,value:v});return VOID;});
bind(100723474,2,([g,def])=>{assert.equal(def,null);return VOID;});
bind(100723639,1,()=>[]);bind(721424772,1,([x])=>x);bind(721424773,1,([x])=>x.length>0);
bind(100722088,1,([r])=>!deref(r));bind(100720524,3,([a,b])=>!a?b:rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.x+a.width,b.x+b.width)-Math.min(a.x,b.x),Math.max(a.y+a.height,b.y+b.height)-Math.min(a.y,b.y)));
bind(100720716,1,([p])=>{sinks.push({kind:'bounds-query',pathCommands:p[67134033]});return rect(0,0,0,0);}); // bounds-only sink; cannot affect path or group attributes
bind(100722108,2,([r,n])=>rect(r.x-n,r.y-n,r.width+2*n,r.height+2*n));
bind(100723851,1,([brush])=>({__type:'fH9a',67135494:brush}));
bind(100720049,1,([pen])=>pen.width);bind(100720045,1,([pen])=>pen.color);bind(100720067,1,()=>[]);

bind(100720957,1,([o])=>execute(types.get(o.__type).Methods.find(m=>m.Name==='n3bt').Token,[o]));
bind(100719898,1,([o])=>execute(types.get(o.__type).Methods.find(m=>m.Name==='v3JR').Token,[o]));
bind(100723852,3,a=>execute(100723891,a));
// R57t construction and geometry commands: direct source constructors, no product paths.
bind(100719836,2,()=>({__type:'R57t',67133645:[],67133643:0,penWidth:0}));
bind(100719831,1,([p])=>({width:p.penWidth??0}));bind(100719832,2,([p,s])=>{p.penWidth=s.width;return VOID;});
bind(100720344,1,([s])=>deref(s).width);bind(100720350,1,()=>0);bind(100720355,1,([w])=>({width:w}));
bind(100719979,2,([o,p])=>{o.points=p;return VOID;});bind(100719978,1,([o])=>o.points);
bind(100719981,0,()=>({__type:'P1Fk'}));bind(100719965,2,([a,b])=>({__type:'R1Ft',a,b}));bind(100719960,1,([o])=>o.a);bind(100719961,1,([o])=>o.b);
bind(100719947,0,()=>({__type:'V1FB'}));
function command(s){return s.kind==='line'?{__type:'R1Ft',a:s.a,b:s.b}:{__type:'P1Fk',points:[s.a,s.c1,s.c2,s.b],67133681:1};}
function path(segments,close=true){const p=invoke(100719836,[null,0],'newobj');execute(100719886,[p,segments.map(command),close]);return p;}
function writer(origin){return {commandMatrix:matrix(1,0,0,1,...origin),67135332:[[]],67135333:{},67135344:{67135353:null},67135330:null};}
function paintPath(g,kind,segments,color,width=0,mark=false){const p=path(segments,kind==='fill'||!mark);if(kind==='fill')execute(100723564,[g,color,[p],mark]);else execute(100723529,[g,{width,color,67133748:0},[p]]);return g[67135332][0].at(-1);}
// Additions are only a retained-CIL host, never product code or DLL execution.
for(const t of [721424309,721424684,721424687])bind(t,1,([a])=>a.length>0);
bind(167791856,2,([self,f])=>({self,fn:f.fn}));
bind(721424685,2,([a,d])=>a.map(x=>execute(d.fn,[d.self,x])));bind(721424686,1,([a])=>a);
for(const [t,k] of [[100722465,'fill'],[100722455,'rect'],[100722461,'width'],[100722459,'shape']])bind(t,1,([g])=>g[k]);
bind(100722475,1,([g])=>{assert([0,15].includes(g.shape));return false;});
bind(100720811,3,([fill])=>fill);
bind(100721048,3,a=>execute(100723562,a));bind(100721040,3,a=>execute(100723529,a));bind(100721050,4,a=>execute(100723564,a));
bind(100717814,1,()=>null);bind(100717816,1,()=>null);
bind(100721085,4,([g,a,b,r])=>{assert.equal(a,null);assert.equal(b,null);sinks.push({kind:'ordinary-no-effects-style',rect:r});return VOID;});
bind(100722444,2,([a,b])=>a!==b);
// PixelAlignMultiple executes its actual MoveNext and i57e CIL. CLR enum/list only are facades.
bind(167772735,0,()=>1);
bind(100721975,2,([a,b])=>a.x===b.x&&a.y===b.y);
bind(100721950,2,([p,n])=>point(p.x+n,p.y+n));
bind(100721980,2,([a,b])=>deref(a).x===b.x);bind(100721982,2,([a,b])=>deref(a).y===b.y);
bind(721424303,1,([a])=>{const e=execute(100720010,[a]),out=[];while(execute(100720006,[e]))out.push(execute(100720007,[e]));return out;});
bind(167785099,2,([a,i])=>a[i]);bind(721424304,1,([a])=>a.slice(1));bind(721424305,1,([a])=>a.length>0);
bind(167791276,1,([a])=>({items:a,index:-1}));bind(167791275,1,([e])=>deref(e).items[deref(e).index]);
// Bounds are a declared sink; this phase verifies path/attribute/writer output only.
bind(100720527,1,([pts])=>rect(Math.min(...pts.map(p=>p.x)),Math.min(...pts.map(p=>p.y)),Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)),Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y))));
bind(100723621,0,()=>({}));
bind(167775440,2,([self,f])=>({self,fn:f.fn}));
bind(721424379,2,([a,d])=>a.map(p=>{const m=d.self[67135419];assert(m);return point(m.a*p.x+m.c*p.y+m.e,m.b*p.x+m.d*p.y+m.f);}));bind(721424278,1,([a])=>a);
// Radio r57L receives the independent I57m BoxModel0/w0 proof as its boundary.
bind(100719867,5,([p,r,out,pixel,box])=>{assert.equal(p.penWidth,0);assert.equal(box,0);assert.equal(pixel,1);const value={...r,__type:'g5s7',struct:undefined};assign(out,value);sinks.push({kind:'I57m-bounded-identity',input:r,output:value});return value;});
for(const [t,f] of [[100722188,r=>point(r.x,r.y)],[100722190,r=>point(r.x+r.width,r.y)],[100722192,r=>point(r.x,r.y+r.height)],[100722194,r=>point(r.x+r.width,r.y+r.height)],[100722196,r=>point(r.x+r.width/2,r.y)],[100722197,r=>point(r.x+r.width/2,r.y+r.height)],[100722198,r=>point(r.x,r.y+r.height/2)],[100722199,r=>point(r.x+r.width,r.y+r.height/2)]])bind(t,1,([r])=>f(r));
const geometry=read('research/selection-layout-border-geometry-probes.json').results;
const results=[];
const fill={r:255,g:255,b:255,a:1},outline={r:18,g:52,b:86,a:1},mark={r:18,g:52,b:86,a:1};
function runCase(type,b,width,alpha=1){
 records=[];calls=[];sinks=[];const origin=[100,70],mg=matrixApi.graphics(),mo=matrixApi.point(...origin);const scope=matrixApi.run(100720505,[mg,mo,1,NaN]);
 const pm=matrixApi.run(100723595,[mg]);matrixApi.run(100723479,[mg,mo]);const outer=matrixApi.run(100723482,[mg]);
 const pathMatrix=matrixApi.components(pm),outerMatrix=matrixApi.components(outer),netMatrix=matrixApi.components(matrixApi.multiply(outer,pm));
 const g=writer([0,0]);g.commandMatrix=matrix(...pathMatrix);const shape=type==='checkbox'?0:15;
 const geom=geometry.find(r=>r.input.shape===shape&&r.input.b===b&&r.input.width===width&&(type==='checkbox'?Array.isArray(r.actual.segments):r.actual.template))?.actual;
 assert(geom,'geometry input');const fillSegments=type==='checkbox'?geom.fillSegments:geom.fillPath,strokeSegments=type==='checkbox'?geom.segments:geom.strokePath;
 const carrier={shape,width,rect:rect(0,0,b,b),fill:{...fill,a:alpha},67134841:fillSegments.map(command),67134844:[],67134843:[strokeSegments.map(command)],67134858:0,67134862:{67135311:null}};
 execute(100722532,[carrier,{67134834:g},{width,color:{...outline,a:alpha},67133748:0},null,null,false,true,true,{}]);
 if(type==='checkbox'){
  const u=b/14,pts=[point(3*u,b/2),point(6*u,10*u),point(11*u,3*u)];
  execute(100723527,[g,{width:3*u,color:{...mark,a:alpha},67133748:0},pts,true]);
 }else{
  const p=invoke(100719836,[null,false],'newobj');execute(100719853,[p,rect(b/4,b/4,b/2,b/2)]);execute(100723564,[g,{...mark,a:alpha},[p],true]);
 }
 const elements=g[67135332][0];assert.equal(elements.length,3);assert.deepEqual(netMatrix,[1,0,0,1,0,0]);
 assert.equal(elements[0].attrs.class,'fill');assert.equal(elements[0].attrs.stroke,'none');
 assert.equal(elements[1].attrs.class,'stroke');assert.equal(elements[1].attrs['stroke-width'],String(width));assert.equal(elements[1].attrs.fill,'none');
 assert.equal(elements[2].attrs.class,'stroke btn_check');assert.equal(elements[2].attrs[type==='checkbox'?'fill':'stroke'],'none');
 for(const e of elements)assert.equal(e.attrs.transform,'matrix(1 0 0 1 100 70 )');
 matrixApi.callback(scope);
 results.push({input:{type,b,width,origin,alpha},matrix:{path:pathMatrix,outer:outerMatrix,net:netMatrix},elements,trace:records,calls,sinks});
}
process.on('uncaughtException',error=>{let n=1;while(fs.existsSync(`research/selection-svg-body-paint-failure-${n}.json`))n++;const message=String(error.stack);fs.writeFileSync(`research/selection-svg-body-paint-failure-${n}.json`,JSON.stringify({message,sourceSha256:sha(import.meta.filename)},null,2)+'\n',{flag:'wx'});console.error(message);process.exitCode=1;});
for(const type of ['checkbox','radio'])for(const b of [14,18])for(const width of [0,1,3])runCase(type,b,width);
for(const type of ['checkbox','radio'])for(const alpha of [0,.375])runCase(type,14,1,alpha);
fs.writeFileSync('research/selection-svg-body-paint-probes-fourth.json',JSON.stringify({sources:sourceFiles.map(path=>({path,sha256:sha(path)})),results},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:results.length,elements:results.reduce((n,x)=>n+x.elements.length,0)}));

