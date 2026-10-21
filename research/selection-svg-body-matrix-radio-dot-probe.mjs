// Retained I57m CIL replay. No vendor assembly is loaded or executed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const engineFile='research/layer-resize-controller-probe.mjs';
assert.equal(sha(engineFile),'ca81115b3d6a92aabbe751b21c5427ebc7e0fe2093fe0265e988ba26c2416800');
const sourceFiles=[
 'research/selection-svg-body-paint-R57t-extra-cil.json',
 'research/native-point-contours-rotation-angle-cil.json',
 'research/line-style-platform-functions-cil.json',
 'research/selection-svg-body-matrix-upstream-check-cil.json',
 'research/gradient-angle-zero-cil.json',
 'research/layer-resize-controller-coordinate-cil.json',
];
// Reuse only the inert bounded interpreter, before all historical test execution.
let engine=fs.readFileSync(engineFile,'utf8').split('for(const [id,count] of ')[0];
engine=engine.replace(/^import .*;\r?\n/gm,'');
engine=engine.replace(/const inputFiles = \[[\s\S]*?\];/,'const inputFiles = sourceFiles;');
engine=engine.replace('const fields = foldFlowFields();','const fields = new Map();');
engine=engine.replace('const loadArg=i=>copy(args[i])','const loadArg=i=>args[i]?.__ref?args[i]:copy(args[i])');
engine=engine.replace('const op=i.Op,v=i.Operand;','const op=i.Op,v=i.Operand; context.trace.push({method:token,il:i.Offset,op});');
engine=engine.replace('else if(v===67134719) stack.push(point(0,0));','else if(v===67134719) stack.push(point(0,0)); else if(v===67135090) stack.push(size(0,0));');
engine=engine.replace("else if(['add','sub'", "else if(op==='rem') {const b=deref(stack.pop());stack.push(deref(stack.pop())%b);} else if(op==='clt.un') {const b=deref(stack.pop()),a=deref(stack.pop());stack.push(Number.isNaN(a)||Number.isNaN(b)||a<b?1:0);} else if(['add','sub'");
engine=engine.replace("else if(['beq','bne.un','blt','bgt','ble','bge'].includes(op))", "else if(['ble.un','bgt.un'].includes(op)) {const b=deref(stack.pop()),a=deref(stack.pop());if(Number.isNaN(a)||Number.isNaN(b)||(op==='ble.un'?a<=b:a>b))jump(v);} else if(['beq','bne.un','blt','bgt','ble','bge'].includes(op))");
engine=engine.replace("else if(op==='isinst')", "else if(op==='stind.ref') {const v=stack.pop();set(stack.pop(),v);} else if(op==='isinst')");
engine=engine.replace('const values=pop(spec.count),value=spec.run(values,','const values=pop(spec.count+(op===\'call\'&&[100721941,100722966].includes(v)?1:0)),value=spec.run(values,');
const api=new Function('fs','assert','createHash','sourceFiles',engine+`\nreturn {execute,bind,cil,point,size,rect,copy,deref,addr,set,VOID,methods,setContext:v=>context=v};`)(fs,assert,createHash,sourceFiles);
const {execute,bind,cil,point,size,rect,copy,deref,addr,set,VOID,methods,setContext}=api;
for(const [id,n] of [[100719867,5],[100688807,1],[100688810,1],[100688812,3],[100688813,2],[100688827,1],[100708190,1]])cil(id,n);
bind(167774838,1,([n])=>Math.abs(n));bind(167774998,1,([n])=>Math.ceil(n));
const facades=[];
const facade=(id,n,fn,meaning)=>{facades.push({id,meaning});bind(id,n,fn);};
facade(100719831,1,([p])=>({width:p.penWidth}),'Injected ordinary R57t zero-width pen getter');
facade(100720344,1,([p])=>deref(p).width,'Pen width value getter');
facade(100719833,1,([p])=>p.boxModel,'Injected ordinary R57t BoxModel0 getter');
for(const [id,key] of [[100722214,'angle'],[100722205,'height'],[100722204,'width'],[100721934,'x'],[100721936,'y'],[100722956,'width'],[100722200,'rotationOrigin']])facade(id,1,([r])=>deref(r)[key],`Geometry value getter ${key}`);
facade(100722202,1,([r])=>point(deref(r).x,deref(r).y),'Location getter');
for(const id of [100722203,100722025])facade(id,1,([r])=>size(deref(r).width,deref(r).height),'Size getter');
for(const [id,fn] of [[100721950,(a,b)=>point(a.x+b,a.y+b)],[100721951,(a,b)=>point(a.x-b,a.y-b)],[100721944,(a,b)=>point(a.x+b.x,a.y+b.y)],[100721945,(a,b)=>point(a.x-b.x,a.y-b.y)],[100722969,(a,b)=>size(a.width+b.width,a.height+b.height)],[100722970,(a,b)=>size(a.width-b.width,a.height-b.height)]])facade(id,2,([a,b])=>fn(deref(a),deref(b)),'Point/size arithmetic value operation');
for(const [id,fn] of [[100721941,point],[100722966,size]])facade(id,2,(a,frame)=>{if(frame.op==='newobj')return fn(...a);set(a[0],fn(a[1],a[2]));return VOID;},'Point/size constructor (value copy and ref forms)');
facade(100722093,2,([p,s])=>rect(p.x,p.y,s.width,s.height),'Rectangle constructor');
facade(100722221,2,([r,angle])=>({...r,angle,rotationOrigin:point(0,0)}),'Rotated-rectangle container constructor; ordinary angle0 only');
facade(100722222,3,([r,rotationOrigin,angle])=>({...r,angle,rotationOrigin}),'Rotated-rectangle container constructor preserving rotation origin and angle');
const cases=[];
for(const b of [14,18]) {
 const input=rect(b/4,b/4,b/2,b/2), out={value:null}, ctx={trace:[]}; setContext(ctx);
 const result=execute(100719867,[{penWidth:0,boxModel:0},input,addr(out,'value'),false,0]);
 const strip=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
 assert.deepEqual(strip(result),strip(input));assert.deepEqual(strip(out.value),strip(input));
 assert.equal(result.angle,0);assert.equal(out.value.angle,0);
 const own=ctx.trace.filter(t=>t.method===100719867), reached=own.map(t=>t.il);
 for(const offset of [1355,1455,1557,2077,2118])assert(reached.includes(offset),'Critical branch not reached '+offset);
 const executed=[...new Set(ctx.trace.map(t=>t.method))];
 cases.push({b,input:strip(input),penWidth:0,boxModel:0,angle:0,arg3:false,arg4:0,result:strip(result),outRect:strip(out.value),passed:true,executedMethods:executed,trace:ctx.trace});
}
const output=process.argv[2]??'research/selection-svg-body-matrix-radio-dot-probes.json';
assert(/^research\/selection-svg-body-matrix-[a-z0-9-]+\.json$/.test(output));
const document={mode:'Retained CIL control replay with explicit geometry value facades; no target execution',sourceDllSha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',count:cases.length,passed:cases.filter(c=>c.passed).length,sourceFiles:sourceFiles.map(path=>({path,sha256:sha(path)})),engine:{path:engineFile,sha256:sha(engineFile),changes:['Remove imports and historical harness after binding helpers','Replace source file list','Preserve out refs','Trace each reached IL','Implement rem, clt.un, floating unordered branches, stind.ref and zero size','Point/size ctor call includes receiver']},probe:{path:'research/selection-svg-body-matrix-radio-dot-probe.mjs',sha256:sha('research/selection-svg-body-matrix-radio-dot-probe.mjs')},facades,cases,conclusion:'Both b14 and b18 ordinary dot return and outRect retain b/4,b/4,b/2,b/2. BoxModel0 computes Ceil(-0.5)=0 then local10 (1,1)-(1,1)=(0,0); no +1 enlargement.',unknowns:['Only w0, BoxModel0, angle0 and b14/b18 tested','Container/value facades do not execute original geometry type constructors','Not original GUI or generated-page observation']};
fs.writeFileSync(output,JSON.stringify(document,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,count:document.count,passed:document.passed,sha256:sha(output)}));
