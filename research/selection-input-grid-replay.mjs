// Static CIL-record replay only. Does not load/invoke the target assembly or product code.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const original=fs.readFileSync('research/layer-resize-controller-probe.mjs','utf8');
let source=original.slice(0,original.indexOf('for(let mask=0;mask<16;mask++)'))
 .replace('Layer:33557506','ResizeController:33556135,Layer:33557506')
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("else if(v===67134719)","else if(v===67124372)stack.push(rect(-100000,-100000,200000,200000)); else if(v===67134719)")
 .replace("const i=instructions[pc++];", "const i=instructions[pc++]; context?.trace?.push({token,offset:i?.Offset});")
 .replace("const values=pop(spec.count)","const values=pop(i.Op==='newobj'&&[100721941,100722966].includes(v)?2:i.Op==='newobj'&&v===100722090?4:spec.count)")
 .replace("else if(op==='nop'", "else if(op==='ldind.ref'){stack.push(deref(stack.pop()));} else if(op==='stind.ref'){const v=stack.pop();set(stack.pop(),v);} else if(op==='nop'")
 .replace("else if(['beq','bne.un','blt','bgt','ble','bge'].includes(op))", "else if(['beq','bne.un','blt','bgt','ble','bge','blt.un','bgt.un','ble.un','bge.un'].includes(op))")
 .replace("blt:a<b,bgt:a>b,ble:a<=b,bge:a>=b", "blt:a<b,bgt:a>b,ble:a<=b,bge:a>=b,'blt.un':a<b||Number.isNaN(a)||Number.isNaN(b),'bgt.un':a>b||Number.isNaN(a)||Number.isNaN(b),'ble.un':a<=b||Number.isNaN(a)||Number.isNaN(b),'bge.un':a>=b||Number.isNaN(a)||Number.isNaN(b)");
source+=String.raw`
const gridFiles=['research/selection-pointer-modifiers-snap-entry-cil.json','research/selection-pointer-modifiers-upstream-cil.json','research/selection-input-grid-dependencies-cil.json','research/selection-input-grid-settings-cil.json','research/selection-input-grid-coordinate-cil.json','research/selection-input-grid-host-cil.json','research/selection-input-grid-live-bounds-cil.json','research/selection-input-grid-anchor-cil.json','research/selection-input-grid-anchor-values-cil.json','research/selection-input-grid-boxmodel-cil.json','research/layer-resize-controller-planner-host-cil.json'];
for(const file of gridFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [id,n]of [[100682729,2],[100682731,6],[100682537,1],[100682529,1],[100682566,1],[100682574,1],[100682578,1],[100682511,1],[100682891,1],[100688822,3],[100708315,1],[100708318,1],[100708321,1],[100708324,1],[100708333,1]])cil(id,n);
bind(100722090,5,(args,{op})=>{if(op==='newobj')return rect(...args);const [r,x,y,width,height]=args;set(r,rect(x,y,width,height));return VOID;});
bind(100721941,3,(args,{op})=>{if(op==='newobj')return point(...args);const [p,x,y]=args;set(p,point(x,y));return VOID;});
// The value-type newobj and constructor-call have different stack arities.
const ctor=callSpecs.get(100721941);callSpecs.set(100721941,{count:3,run:ctor.run});
bind(100722966,2,([w,h])=>size(w,h));
bind(167775900,2,([v,mask])=>(v&mask)===mask?1:0);
bind(100664403,0,()=>size(context.input.grid?.width??8,context.input.grid?.height??8));
bind(100664415,0,()=>context.input.gridEnabled!==false);
bind(100664437,0,()=>false);bind(100664449,0,()=>false); // explicit provider settings
bind(100696205,1,([s])=>{context.liveReads++;return rect(s.bounds.x,s.bounds.y,s.bounds.width,s.bounds.height);}); // current selection union service
bind(100682791,1,([e])=>e.controller);
bind(100686229,1,([c])=>c.handle);
bind(100685898,1,()=>0);bind(100708343,2,([h,angle])=>{assert.equal(angle,0,'rotation excluded');return h;});
bind(100686099,1,([c])=>c.freedom);
bind(100708646,0,()=>({keyboard:true}));bind(100710378,1,()=>context.input.shift?65536:0);
bind(100691309,1,([keys])=>(keys&65536)!==0);
bind(100682387,2,([e,g])=>{assert(deref(g),'graphics facade required');return null;});
bind(100720541,2,([s,g])=>{context.units.push({size:copy(s),source:2,target:0,zoom:g.zoom});return size(s.width/g.zoom,s.height/g.zoom);}); // explicit uniform graphics sink
bind(167773383,3,([v,d,mode])=>{assert.equal(d,0);assert.equal(mode,1);return Math.sign(v)*Math.floor(Math.abs(v)+.5);});
for(const id of [167783581,167783580,167783930,167783931])bind(id,0,()=>[]);
bind(100682730,5,([e,a,b,c,d])=>{assert.equal(c,null);assert.equal(d,null);context.visualClears.push([!!a,!!b]);return VOID;});
bind(100682458,1,()=>({}));bind(100716811,1,()=>({}));bind(100716663,1,()=>0);bind(100708189,1,()=>false); // boxmodel visual guide branch only
bind(721421787,1,([a])=>a.length>0);bind(721421789,1,([a])=>a.length>0);
// Separate resize override: logical origin versus zoom-adjusted displayed hot-zone.
for(const [id,n]of [[100686265,3],[100686266,1],[100708190,1]])cil(id,n);
bind(100686082,1,()=>({editor:true}));bind(100682587,1,()=>context.input.zoom??1);
bind(100722029,1,([r])=>r);bind(100722014,1,([r])=>point(r.x,r.y));bind(100722017,1,([r])=>point(r.x+r.width,r.y+r.height));
bind(100722035,1,()=>0);bind(100722105,2,([r,s])=>rect(r.x,r.y,r.width-s.width,r.height-s.height));
bind(100721951,2,([p,n])=>point(p.x-n,p.y-n));
bind(100720547,3,([a,b,t])=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t));
bind(100722222,3,([r,center,angle])=>{assert.equal(angle,0);return {...r};});
function edge(r,h){return point(h&1?r.x:h&4?r.x+r.width:r.x+r.width/2,h&2?r.y:h&8?r.y+r.height:r.y+r.height/2);}
bind(100722186,2,([r,h])=>edge(r,h));bind(100722013,2,([r,h])=>edge(r,h));
bind(167774998,1,([n])=>Math.ceil(n));
bind(100721972,3,([p,side,h])=>{assert.equal(h,768);p=deref(p);return rect(p.x-side/2,p.y-side/2,side,side);});
bind(100686112,2,([c,r])=>{c.visual=copy(r);return VOID;});
bind(100686219,2,([c,flag])=>{assert.equal(flag,0);return [{angle:0}];});
bind(721420498,1,([a])=>a);bind(167776549,1,([a])=>a.length);bind(167783920,2,([a,n])=>a[n]);bind(100695380,1,([w])=>w.angle);
bind(100682390,1,()=>1);bind(100682787,1,()=>0);bind(100686096,1,()=>1);
bind(100708657,0,()=>({platform:true}));bind(100710122,1,()=>262144);bind(100710377,2,([keyboard,key])=>{assert.equal(key,262144);return context.input.alt?1:0;});
bind(100696225,1,()=>context.input.count??1);bind(721420493,1,()=>({angle:0}));
bind(100686116,5,([c,dx,dy,p,g])=>{context.dispatched={x:dx,y:dy};return VOID;});
function setup(input){
 assert.equal(input.guides??false,false,'guide provider unsupported');assert.equal(input.objects??false,false,'object provider unsupported');
 context={input,trace:[],units:[],liveReads:0,visualClears:[]};
 const e={controller:{kind:'ResizeController',handle:input.handle??4,freedom:input.freedom??3},[67117476]:{bounds:input.currentBounds??input.rect},[67117495]:input.toleranceDevice??5};
 return e;
}
export function candidate(input){const e=setup(input),p=input.point;const r=execute(100682729,[e,point(p.x,p.y)]);return {rect:r,liveReads:context.liveReads,trace:context.trace};}
export function correction(input){const e=setup(input),r=input.rect,h=input.anchor??execute(100708333,[input.handle??4]);const c=execute(100682731,[e,rect(r.x,r.y,r.width,r.height),h,input.yEnabled!==false,input.xEnabled!==false,{zoom:input.zoom??1}]);return {correction:{x:c.x,y:c.y},anchor:h,units:context.units,visualClears:context.visualClears,trace:context.trace};}
export function gridInput(input){
 const e=setup(input),p=point(input.point.x,input.point.y);let r=null,c=point(0,0);
 const oldCandidate=callSpecs.get(100682729),oldCorrection=callSpecs.get(100682731);
 bind(100682729,2,args=>{r=execute(100682729,args);return r;});bind(100682731,6,args=>{c=execute(100682731,args);return c;});
 e[67117539]=true;e[67117567]=p;e[67117547]=point(input.start.x,input.start.y);
 try{execute(100682868,[e,{}, {zoom:input.zoom??1}]);}finally{callSpecs.set(100682729,oldCandidate);callSpecs.set(100682731,oldCorrection);}
 return {candidate:r,correction:{x:c.x,y:c.y},delta:context.dispatched,liveReads:context.liveReads,units:context.units,trace:context.trace};
}
export function hotzone(input){const e=setup(input),c=e.controller,r=input.currentBounds;execute(100686265,[c,rect(r.x,r.y,r.width,r.height),input.hotzoneSize??7]);const p=execute(100686266,[c]);return {start:{x:p.x,y:p.y},stored:c[67119120],visual:c.visual,trace:context.trace};}
export const files=[...inputFiles,...gridFiles];
`;
// Bind exact Round MemberRef and absent-candidate static field from retained operands.
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const dep=read('research/selection-input-grid-dependencies-cil.json').Types.flatMap(t=>t.Methods);
source=source.replace('bind(167773383,3,',`bind(${dep.find(m=>m.Token===100688822).Instructions.find(i=>i.Resolved==='System.Math::Round').Operand},3,`);
const candidateMethod=read('research/selection-pointer-modifiers-snap-entry-cil.json').Types.flatMap(t=>t.Methods).find(m=>m.Token===100682729);
source=source.replace('v===67124372',`v===${candidateMethod.Instructions.find(i=>i.Resolved==='dJyj.qJyF::KJyA').Operand}`);
const hot=read('research/layer-resize-controller-planner-host-cil.json').Types.flatMap(t=>t.Methods).find(m=>m.Token===100686265);
source=source.replace("else if(v===67134719)",`else if(v===${hot.Instructions.find(i=>i.Resolved==='hHBO.fHBd::rHVR').Operand})stack.push(size(1,1)); else if(v===67134719)`);
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
export const {candidate,correction,gridInput,hotzone,files}=api;
