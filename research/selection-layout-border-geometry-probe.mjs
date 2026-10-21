// Executes retained CIL records in a bounded JavaScript interpreter, not target CLR.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
const sha256=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const adapter='research/layer-resize-controller-probe.mjs'
let code=fs.readFileSync(adapter,'utf8').split('for(let mask=0;mask<16;mask++)')[0]
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("else if(v===67134719)", "else if(v===67134722) stack.push(point(NaN,NaN));\nelse if(v===67133801)stack.push(circleTemplate());\nelse if(v===67134719)")
 .replace("else if(op==='stelem.ref')", "else if(op==='ldftn')stack.push({fn:v});\nelse if(op==='stelem.ref')")
 .replace("else if(op==='stelem.ref')", "else if(op==='stelem'){const value=stack.pop(),n=stack.pop(),a=stack.pop();a[n]=copy(value);}\nelse if(op.startsWith('ldelem')){const n=stack.pop(),a=stack.pop();stack.push(copy(a[n]));}\nelse if(op==='clt.un'){const b=stack.pop(),a=stack.pop();stack.push(a<b||Number.isNaN(a)||Number.isNaN(b)?1:0);}\nelse if(op==='blt.un'){const b=stack.pop(),a=stack.pop();if(a<b||Number.isNaN(a)||Number.isNaN(b))jump(v);}\nelse if(op==='stelem.ref')")
code+=String.raw`
const extraFiles=['research/selection-layout-border-asset-path-cil.json','research/selection-layout-border-rectangle-cil.json','research/selection-layout-border-render-entry-cil.json','research/selection-layout-border-path-cil.json','research/line-style-platform-functions-cil.json','research/selection-layout-border-circle-static-cil.json','research/selection-layout-border-svg-path-cil.json','research/selection-layout-border-path-conversion-cil.json'];
for(const file of extraFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [id,n] of [[100722473,5],[100722474,3],[100722633,4],[100708190,1],[100708189,1]])cil(id,n);
bind(100722455,1,([o])=>o.rect);
bind(100722456,2,([o,r])=>{o.rect=r;return VOID});
bind(100722458,2,([o,r])=>{o.strokeRect=r;return VOID});
bind(100722461,1,([o])=>o.width);
bind(100722475,1,([o])=>{assert([0,15].includes(o.shape));return false}); // Original M3b8 rejects 0/15; source array excludes both.
bind(100722465,1,([o])=>o.fill);
bind(100720807,1,([fill])=>fill.alpha<255); // uHV0.r3jz→E5eI→alpha<255, separately retained.
bind(100720808,1,([fill])=>fill.alpha===0);
bind(100722899,1,()=>false);bind(100722419,1,()=>false);
bind(167796442,0,()=>[]);bind(167796443,0,()=>[]);
bind(100722109,2,([r,n])=>rect(r.x+n,r.y+n,r.width-2*n,r.height-2*n));
bind(100722055,1,([r])=>deref(r).x);bind(100722056,1,([r])=>deref(r).y);
bind(100722057,1,([r])=>deref(r).x+deref(r).width);bind(100722058,1,([r])=>deref(r).y+deref(r).height);
bind(100722051,1,([r])=>deref(r).width);bind(100722053,1,([r])=>deref(r).height);
bind(167796489,2,([a,n])=>a[n]);
bind(167791102,0,()=>[]);bind(167791100,2,([a,v])=>{a.push(v);return VOID});
bind(100721941,2,([x,y])=>point(x,y));
bind(100722351,2,([a,b])=>({kind:'line',a,b}));
function circleTemplate(){
 const a=methods.get(100720186).Instructions.filter(i=>i.Offset>=33&&i.Offset<=386),stack=[];
 for(const i of a){
  if(i.Op==='ldc.r8')stack.push(i.Operand);
  else if(i.Op==='dup')stack.push(stack.at(-1));
  else if(i.Op==='newobj'&&i.Operand===167783454)stack.push([]);
  else if(i.Op==='newobj'&&i.Operand===100721941){const y=stack.pop(),x=stack.pop();stack.push(point(x,y));}
  else if(i.Op==='callvirt'&&i.Operand===167783455){const p=stack.pop(),list=stack.pop();list.push(p);}
  else if(i.Op==='stsfld'&&i.Operand===67133801){assert.equal(stack.length,1);return stack.pop();}
  else throw Error('Unmapped circle template instruction '+i.Offset);
 }
 throw Error('No circle template result');
}
for(const [id,n]of [[100722484,2],[100722487,2],[100722485,4],[100722488,4],[100722608,2],[100722612,2]])cil(id,n);
for(const id of [100722607,100722611])bind(id,0,()=>({}));
bind(167775440,2,([o,f])=>({o,...f}));
bind(721424379,2,([items,delegate])=>items.map(v=>execute(delegate.fn,[delegate.o,v])));
bind(721424303,1,([v])=>v);
bind(167791146,1,([v])=>v.length);
for(const id of [167795532,167795981])bind(id,0,()=>[]);
bind(167785099,2,([v,n])=>v[n]);
bind(100721940,1,([p])=>Number.isNaN(deref(p).x)||Number.isNaN(deref(p).y));
bind(100721976,2,([a,b])=>Math.abs(a.x-b.x)>1e-5||Math.abs(a.y-b.y)>1e-5);
bind(100721995,2,([r,p])=>point(r.x+r.width*p.x,r.y+r.height*p.y)); // Source rect-matrix interpolation is an explicit arithmetic facade.
bind(100722486,5,([a,c1,c2,b,list])=>{list.push({kind:'cubic',a,c1,c2,b});return VOID});
bind(100720125,5,([a,c1,c2,b,flag])=>({kind:'cubic',a,c1,c2,b,flag}));
bind(167795982,2,([list,item])=>{list.push(item);return VOID});
bind(100722096,1,([r])=>deref(r));
bind(100722459,1,([o])=>o.shape);
bind(100722494,2,([o,p])=>{o.fillPath=p;return VOID});
bind(167796444,2,([a,p])=>{a.push(p);return VOID});
const radioMethod=methods.get(100722477);
methods.set(-1,{...radioMethod,Instructions:[...radioMethod.Instructions.filter(i=>i.Offset<270),{Offset:270,Op:'ret',Operand:null,Resolved:null}]});
export function radio({b=14,width=1}={}){
 const r=geometry({shape:15,b,width}),o={shape:15,rect:rect(0,0,b,b),[67134850]:r.fillInset,[67134854]:true,[67134843]:[],[67134853]:r.strokeRect};
 execute(-1,[o]);
 return {template:circleTemplate(),fillPath:o.fillPath,strokePath:o[67134843][0]};
}
export function geometry({shape=0,b=14,width=1,alpha=255,boxModel=0}={}){
 context={calls:[]};const o={shape,width,fill:{alpha},[67134859]:1,[67134862]:{},[67134932]:[true,true,true,true]};
 execute(100722473,[o,rect(0,0,b,b),boxModel,false,{alpha:255}]);
 const stroke=o.strokeRect;
 const inputInset=o[67134849],fillInset=o[67134850];
 const segments=shape===0?execute(100722633,[o,inputInset,[false,false,false,false],false]):null;
 const fillSegments=shape===0?execute(100722633,[o,fillInset,[false,false,false,false],true]):null;
 return {strokeRect:stroke,strokeInset:inputInset,fillInset,innerInset:o[67134851],fillEnabled:!!o[67134854],segments,fillSegments};
}
export const sourceFiles=[...inputFiles,...extraFiles];
`
process.on('uncaughtException',error=>{
 const message=String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<bounded-CIL>')
 let n=1;while(fs.existsSync(`research/selection-layout-border-geometry-failure-${n}.json`))n++
 fs.writeFileSync(`research/selection-layout-border-geometry-failure-${n}.json`,JSON.stringify({message,sha256:sha256(import.meta.filename)},null,2)+'\n');console.error(message);process.exitCode=1
})
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const results=[]
for(const shape of [0,15])for(const b of [12,14,18])for(const width of [0,1,2,3,5]){
 const input={shape,b,width},actual=api.geometry(input)
 assert.equal(actual.strokeInset,width/2)
 assert.equal(actual.fillInset,0)
 assert.deepEqual(actual.strokeRect,{__struct:'rect',x:width/2,y:width/2,width:b-width,height:b-width})
 if(shape===0){
  const p=actual.segments.map(s=>[s.a.x,s.a.y,s.b.x,s.b.y])
  assert.deepEqual(p,[[width/2,width/2,b-width/2,width/2],[b-width/2,width/2,b-width/2,b-width/2],[b-width/2,b-width/2,width/2,b-width/2],[width/2,b-width/2,width/2,width/2]])
 }
 results.push({input,actual,passed:true})
}
for(const b of [12,14,18])for(const width of [0,1,2,3,5]){
 const input={shape:15,b,width},actual=api.radio(input),r=width/2,d=b-width;
 assert.equal(actual.strokePath.length,4)
 assert.deepEqual(actual.strokePath[0],{kind:'cubic',a:{__struct:'point',x:b/2,y:r},c1:{__struct:'point',x:r+d*.78,y:r},c2:{__struct:'point',x:r+d,y:r+d*.21999999999999997},b:{__struct:'point',x:r+d,y:b/2}})
 assert.equal(actual.fillPath.length,4)
 assert.equal(actual.fillPath[0].a.y,0)
 assert.equal(actual.fillPath[0].c2.x,b)
 results.push({input,actual,passed:true})
}
const sources=[...new Set([...api.sourceFiles,adapter,'research/gradient-angle-flow-init-cil.json','research/selection-layout-border-array.json','research/selection-layout-border-padding-color-cil.json',import.meta.filename])].map(path=>({path,sha256:sha256(path)}))
fs.writeFileSync('research/selection-layout-border-geometry-probes.json',JSON.stringify({kind:'bounded-retained-CIL-record-replay',boundaries:['BoxModel0, solid line, full visible border, corner radius0, no image/inner shadow, opaque border and fill.','M3b8 is a source-proven shape0/15 false predicate facade; rectangle records execute r5Am. Radio executes o3bT up to IL270 (fill/stroke path production), n5va/k5v0 and their recorded loops; unrelated later outline-cache conversion is not run.','Circle template executes exact initializer block IL33..386. Matrix/list/final segment constructors are explicit facades, not final SVG serialization.','Collection/property/point/rect arithmetic are explicit sinks; no original DLL execution or browser pixel validation.'],sources,passed:results.length,failed:0,results},null,2)+'\n')
console.log(`${results.length}/${results.length} retained inset and rectangle segment cases passed`)
