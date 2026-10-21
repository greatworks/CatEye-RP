// Retained CIL-record replay. Never loads or executes the target assembly.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const adapter='research/layer-resize-controller-probe.mjs';
let code=fs.readFileSync(adapter,'utf8').split('for(let mask=0;mask<16;mask++)')[0]
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("else if(v===67134719)","else if(v===67134732)stack.push(rect(0,0,0,0)); else if(v===67134719)")
 .replace("else if(op==='isinst')","else if(op==='ble.un'){const b=deref(stack.pop()),a=deref(stack.pop());if(a<=b||Number.isNaN(a)||Number.isNaN(b))jump(v);} else if(op==='isinst')")
 .replace("else if(op==='newarr')", "else if(op==='ldlen')stack.push(stack.pop().length); else if(op==='conv.i4')stack.push(Number(stack.pop())); else if(op==='ldelem'){const n=stack.pop(),a=stack.pop();stack.push(copy(a[n]));} else if(op==='stelem'){const v=stack.pop(),n=stack.pop(),a=stack.pop();a[n]=copy(v);} else if(op==='newarr')");
code+=String.raw`
const extraFiles=[
 'research/selection-author-services-dependencies-cil.json','research/selection-author-services-values-cil.json',
 'research/selection-author-services-context-cil.json','research/selection-author-services-provider-cil.json',
 'research/selection-author-services-graphics-context-cil.json',
 'research/native-point-contours-topology-rect-static-cil.json',
 'research/selection-layout-border-asset-values-cil.json','research/selection-author-resize-class-cil.json',
 'research/selection-author-resize-size-layout-cil.json',
 'research/selection-layout-render-unit-property-cil.json','research/selection-layout-render-dependencies-cil.json'];
for(const file of extraFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [id,n]of [[100720524,3],[100722085,2],[100722088,1],[100722129,2],[100722133,2],[100688812,3],[100688813,2],
 [100695442,1],[100695443,1],[100695441,1],[100702032,2],[100702343,2],[100702367,2],
 [100720540,4],[100720541,2],[100723592,4],[100727484,4],[100702033,3],[100702383,3],[100695389,1],[100695467,1]])cil(id,n);
bind(167784878,1,([v])=>Number.isNaN(v));
bind(167774838,1,([v])=>Math.abs(v));
bind(167774824,2,([a,b])=>Math.min(a,b));bind(167773368,2,([a,b])=>Math.max(a,b));
bind(100722090,4,([x,y,w,h])=>rect(x,y,w,h));
bind(100722966,2,([w,h],f)=>f.op==='newobj'?size(w,h):(()=>{throw Error('unexpected constructor convention');})());
// Value-type .ctor call has a receiver; the interpreter dispatches call/newobj separately.
bind(100695614,1,([w])=>({167789627:w.transform??null}));
bind(100722957,2,([s,v])=>{deref(s).width=v;return VOID;});
bind(100722955,2,([s,v])=>{deref(s).height=v;return VOID;});
bind(100723734,1,([t])=>t.x);bind(100723736,1,([t])=>t.y);
bind(100702326,2,([w,force])=>{context.events.push({name:'OI8Z',force:!!force,width:w[67126826],height:w[67126834]});return VOID;});
bind(100702377,1,([w])=>{context.events.push({name:'WIyL',alignRight:!!w[67126726]});return VOID;});
bind(100695255,3,([w,notify,arg])=>{context.events.push({name:'VJm0',notify:!!notify,arg});return VOID;});
bind(100722990,1,([s])=>point(deref(s).width,deref(s).height));
bind(100721945,2,([a,b])=>point(a.x-b.x,a.y-b.y));
bind(100721970,1,([p])=>size(deref(p).x,deref(p).y));
bind(100721944,2,([a,b])=>point(a.x+b.x,a.y+b.y));
bind(100721948,2,([p,s])=>point(p.x*s.width,p.y*s.height));
bind(100721949,2,([p,s])=>point(p.x/s.width,p.y/s.height));
bind(100721941,2,([x,y])=>point(x,y));
bind(100723595,1,([g])=>g.matrix);
for(const [id,key]of [[100688876,0],[100688882,3],[100688884,4],[100688886,5]])bind(id,1,([m])=>deref(m)[key]);
const inverse=m=>{
 const [a,b,c,d,e,f]=m,det=a*d-b*c;
 assert(det!==0,'singular matrix outside fixture domain');
 return [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];
};
const project=(m,p)=>point(Math.fround(Math.fround(Math.fround(p.x)*m[0])+Math.fround(Math.fround(p.y)*m[2])+m[4]),Math.fround(Math.fround(Math.fround(p.x)*m[1])+Math.fround(Math.fround(p.y)*m[3])+m[5]));
bind(100727389,1,([g])=>g.renderMatrix);
bind(167797742,1,([m])=>m);bind(167797743,1,([m])=>m);
bind(100727399,1,([g])=>g.pageMatrix);
bind(167797744,1,([m])=>inverse(m));
bind(100727600,2,([m,p])=>project(m,p)); // explicit SharpDX/value conversion facade; exact integer fixtures
bind(100721064,4,(args)=>{
 context.events.push({name:'graphics.TransformPoints',destination:args[1],source:args[2]});
 return execute(args[0].renderer==='svg'?100723592:100727484,args);
});
bind(167789576,2,([a,key])=>a.includes(key));
bind(100702331,1,([w])=>w.empty);
bind(100702026,1,([w])=>w.button);
bind(100695375,1,([w])=>w.width);bind(100695374,1,([w])=>w.height);
bind(100702327,1,([w])=>w.panel);bind(100702301,1,([p])=>p.width);
bind(100695365,4,([w,s,allViews,notify])=>{context.events.push({name:'uJ0j',size:copy(s),allViews:!!allViews,notify:!!notify});return VOID;});
bind(100695494,1,([w])=>w.contained);
bind(167774392,1,([keys])=>keys);bind(100689223,1,([keys])=>keys.length);bind(721423424,1,([keys])=>keys[0]);
bind(100702385,1,()=>{context.events.push({name:'BNZT'});return VOID;});
bind(100695251,3,()=>{context.events.push({name:'MIue.base'});return VOID;});
bind(100695348,1,([w])=>point(w.x,w.y));
bind(100716799,2,([a,b])=>a===b);
export function union(a,b,ignoreEmpty=true){context={};return execute(100720524,[rect(...a),rect(...b),ignoreEmpty]);}
export function empty(a,both=false){context={};return execute(100722085,[rect(...a),both]);}
export function minimum(){context={};return {width:execute(100695442,[{}]),height:execute(100695443,[{}])};}
export function minimumSize(transform){context={};return execute(100695441,[{transform}]);}
export function convert(g){context={events:[]};const output=execute(100720541,[size(2,2),g]);return {output,events:context.events};}
export function styleEntry(input){context={events:[]};const w={width:10,height:20,button:12,panel:{width:40},empty:false,contained:false,...input,67126836:input[67126836]?1:0};execute(100702033,[w,input.keys??[94],input.notify??true]);return context.events;}
export function location(x,y,parent){context={};return execute(100695389,[{kind:'SelectionButton',x,y,67123777:parent}]);}
export function changed(kind,before,after){
 context={events:[]};const field={width:67126826,height:67126834,align:67126726}[kind];
 const w={[field]:before};execute({width:100702343,height:100702367,align:100702032}[kind],[w,after]);
 return {value:w[field],events:context.events};
}
export const sourceFiles=[...inputFiles,...extraFiles];
`;
// Support value-type constructors through the original opcode interpreter, not an alternate algorithm.
code=code.replace("const values=pop(spec.count),value=spec.run(values,{token,offset:i.Offset,op,cleanups});",
 "const count=([100722966,100721941].includes(v)&&op==='call')?3:spec.count; const values=pop(count); let value; if([100722966,100721941].includes(v)&&op==='call'){set(values[0],v===100722966?size(values[1],values[2]):point(values[1],values[2]));value=VOID;} else value=spec.run(values,{token,offset:i.Offset,op,cleanups});");
process.on('uncaughtException',error=>{
 const message=String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<services-cil-adapter>');
 let n=1;while(fs.existsSync(`research/selection-author-services-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-author-services-failure-${n}.json`,JSON.stringify({message,probeSha256:hash(import.meta.filename)},null,2)+'\n');
 console.error(message);process.exitCode=1;
});
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const results=[];
function test(name,input,actual,expected){assert.deepEqual(actual,expected,name);results.push({name,input,actual,expected});}
const clean=r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=='__struct'));
test('minimum getters',{},api.minimum(),{width:1,height:1});
for(const transform of [null,{x:1,y:1},{x:2,y:3},{x:0,y:0},{x:0,y:4},{x:-1,y:1}]){
 test('effective minimum '+JSON.stringify(transform),{transform},clean(api.minimumSize(transform)),transform?{width:transform.x===0?1:transform.x,height:transform.y===0?1:transform.y}:{width:1,height:1});
}
for(const w of [0,0.000009999,0.00001,0.000010001,1]){
 const input=[40,60,w,16],actual=clean(api.union(input,[10,20,12,12],true));
 const expected=w<1e-5?{x:10,y:20,width:12,height:12}:{x:10,y:20,width:40+w-10,height:56};
 test('ignore-empty width '+w,input,actual,expected);
}
for(const h of [0,0.000009999,0.00001,16]){
 const input=[40,60,12,h],actual=clean(api.union(input,[10,20,12,12],true));
 test('ignore-empty height '+h,input,actual,h<1e-5?{x:10,y:20,width:12,height:12}:{x:10,y:20,width:42,height:60+h-20});
}
for(const [a,b] of [[[40,60,0,16],[10,20,12,12]],[[40,60,12,0],[10,20,12,12]],[[0,0,0,0],[10,20,12,12]],[[5,6,0,0],[10,20,0,0]]]){
 const actual=clean(api.union(a,b,false));
 const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]);
 const expected=a.every(v=>v===0)?{x:b[0],y:b[1],width:b[2],height:b[3]}:{x,y,width:Math.max(a[0]+a[2],b[0]+b[2])-x,height:Math.max(a[1]+a[3],b[1]+b[3])-y};
 test('union keep empty '+JSON.stringify(a),{a,b},actual,expected);
}
for(const axis of [0,1,2,3]){
 const a=[10,20,12,12];a[axis]=NaN;const b=[40,50,10,20];
 test('NaN rectangle '+axis,{a,b},clean(api.union(a,b,true)),{x:40,y:50,width:10,height:20});
}
for(const [a,b,ignoreEmpty,expected]of [
 [[40,60,0,16],[10,20,0,0],true,[10,20,0,0]],
 [[10,20,0,0],[40,60,0,16],true,[40,60,0,16]],
 [[40,60,12,16],[10,20,0,0],true,[40,60,12,16]],
 [[0.000009,0.000009,0.000009,0.000009],[40,60,12,16],false,[40,60,12,16]],
 [[0.00001,0.00001,0.00001,0.00001],[40,60,12,16],false,[0.00001,0.00001,52-0.00001,76-0.00001]],
 [[40,60,12,16],[0,0,0,0],false,[40,60,12,16]]
]){
 test('sentinel/empty order '+JSON.stringify([a,b,ignoreEmpty]),{a,b,ignoreEmpty},clean(api.union(a,b,ignoreEmpty)),{x:expected[0],y:expected[1],width:expected[2],height:expected[3]});
}
for(const both of [false,true])for(const dims of [[0,16],[16,0],[0,0],[1e-5,16],[0.999e-5,16]]){
 test('IsEmpty '+both+' '+dims,{dims,both},!!api.empty([10,20,...dims],both),both?dims.every(v=>Math.abs(v)<1e-5):dims.some(v=>Math.abs(v)<1e-5));
}
for(const kind of ['width','height','align'])for(const before of [false,true])for(const after of [false,true]){
 const actual=api.changed(kind,before,after);
 const events=before===after?[]:kind==='align'?[{name:'WIyL',alignRight:after},{name:'VJm0',notify:false,arg:null}]:[{name:'OI8Z',force:true,width:kind==='width'?after:undefined,height:kind==='height'?after:undefined}];
 test(kind+' setter '+before+'→'+after,{before,after},actual,{value:after,events});
}
for(const input of [
 {keys:[94]}, {keys:[94],empty:true},{keys:[94],button:10},{keys:[94],button:9},{keys:[94],button:NaN},
 {keys:[94],notify:false},{keys:[94],contained:true},{keys:[94],67126836:true},{keys:[101]},{keys:[101,94]}
]){
 const actual=api.styleEntry(input), expected=[];
 if((input.keys??[94]).includes(94)&&!input.empty&&(input.button??12)>10)expected.push({name:'uJ0j',size:{__struct:'size',width:(input.button??12)+40,height:20},allViews:false,notify:true});
 if(input.notify!==false&&!input.contained&&!input[67126836]&&!(input.keys.length===1&&input.keys[0]===101))expected.push({name:'BNZT'},{name:'OI8Z',force:false,width:undefined,height:undefined});
 expected.push({name:'MIue.base'});
 test('P94 entry '+JSON.stringify(input),input,actual,expected);
}
for(const [renderMatrix,pageMatrix,expected]of [
 [[1,0,0,1,0,0],[1,0,0,1,0,0],[2,2]],
 [[1,0,0,1,100,200],[1,0,0,1,0,0],[2,2]],
 [[2,0,0,2,0,0],[1,0,0,1,0,0],[1,1]],
 [[.5,0,0,.5,0,0],[1,0,0,1,0,0],[4,4]],
 [[1,0,0,1,0,0],[2,0,0,2,0,0],[4,4]],
 [[2,0,0,4,0,0],[1,0,0,1,0,0],[1,.5]]
]){
 const input={renderer:'d2d',renderMatrix,pageMatrix},actual=api.convert(input);
 test('D2D 2→0 '+JSON.stringify(input),input,clean(actual.output),{width:expected[0],height:expected[1]});
 assert.deepEqual(actual.events,[{name:'graphics.TransformPoints',destination:0,source:2}]);
}
for(const scale of [1,2,.5]){
 const input={renderer:'svg',matrix:[scale,0,0,scale,100,200]},actual=api.convert(input);
 test('SVG 2→0 scale '+scale,input,clean(actual.output),{width:2/scale,height:2/scale});
}
test('diagram-local nonwidget parent',{},clean(api.location(10,20,{diagram:true})),{x:10,y:20});
test('contained widget parent',{},clean(api.location(10,20,{kind:'SelectionButton',x:100,y:200})),{x:110,y:220});
const output={kind:'Retained CIL-record interpretation; no vendor CLR/GUI execution',passed:results.length,failed:0,
 sources:[...new Set([...api.sourceFiles,adapter,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',import.meta.filename])].map(path=>({path,sha256:hash(path)})),
 boundaries:['Geometry getters/constructors and Math are explicit value facades.','Layout and invalidation methods are event sinks for setter-order cases.','Source finite rectangle predicate/union instructions execute; nonfinite output policy is outside the product contract.','Graphics virtual dispatch chooses explicit SVG or Direct2D carrier; matrix inversion and SharpDX float-point conversion are explicit facades. Integer/power-of-two fixtures are exact in these sinks, not original Windows pixel validation.','Nonfinite numbers serialize as explicit strings, not JSON null.'],results};
fs.writeFileSync('research/selection-author-services-probes.json',JSON.stringify(output,(_,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2)+'\n');
console.log(JSON.stringify({passed:results.length,failed:0}));
