// Bounded original CIL-record replay. No vendor assembly or product module executes.
// Start/move/release scopes deliberately stop at geometry and history sinks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const base='research/layer-resize-controller-probe.mjs';
let code=fs.readFileSync(base,'utf8').split('for(let mask=0;mask<16;mask++)')[0]
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace('const typeIds = {Layer:', 'const typeIds = {obNM:33556135,Layer:')
 .replace("else if(op==='ldc.r8')", "else if(op==='ldc.i8') stack.push(BigInt(v)); else if(op==='ldc.r8')");
const extra=[
 'research/layer-resize-controller-planner-host-cil.json',
 'research/selection-pointer-modifiers-key-tests-cil.json',
 'research/selection-pointer-modifiers-upstream-cil.json',
 'research/selection-pointer-modifiers-platform-dispatch-cil.json',
 'research/selection-author-resize-class-cil.json',
 'research/selection-input-keys-platform-cil.json',
 'research/selection-input-keys-platform-owner-cil.json',
 'research/selection-input-keys-dispatch-entry-cil.json',
 'research/selection-input-keys-rotation-cil.json',
 'research/selection-input-keys-release-cil.json'
];
code+=`
const extra=${JSON.stringify(extra)};
for(const file of extra){
 const raw=fs.readFileSync(file,'utf8').replace(/^\\uFEFF/,'').replace(/("Operand"\\s*:\\s*)(-?\\d{16,})/g,'$1"$2"');
 for(const t of JSON.parse(raw).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
}
for(const [t,n]of [[100691307,2],[100691309,1],[100691312,1],[100691324,1],[100691331,1],
 [100726560,1],[100726654,1],[100708657,0],[100686235,1],[100686233,1],[100686234,2],
 [100686246,4],[100686227,1],[100702019,1],[100725016,1],[100686261,3]])cil(t,n);
bind(100710365,1,args=>execute(100726654,args));
bind(100710122,1,args=>execute(100726560,args));
bind(100708646,0,()=>context.platform);
bind(100710378,1,()=>{context.events.push({name:'read-current-keys',mask:context.keys});return context.keys;});
bind(100726677,1,()=>{context.events.push({name:'read-current-keys',mask:context.keys});return context.keys;});
bind(100710377,2,args=>execute(100726676,args));
bind(100686219,2,([c,flag])=>{context.events.push({name:'AbNC-selection-facade',flag});return c.selection;});
bind(721420498,1,([a])=>a);bind(167776549,1,([a])=>a.length);bind(167783920,2,([a,n])=>a[n]);
bind(100695291,1,([w])=>w.rotationCap===true?1099511627776n:execute(100702019,[w]));
bind(167775900,2,([a,b])=>(BigInt(a)&BigInt(b))===BigInt(b));
// Exact CbNh mode assignment block; entry preconditions and object capture are outside this slice.
const down=methods.get(100686243).Instructions.filter(i=>i.Offset>=1112&&i.Offset<1142);
methods.set(-1,{Instructions:[...down,{Offset:1142,Op:'ret'}]});
// Exact CbNX stored-mode branch; return values at the two exits are harness labels.
methods.set(-2,{Instructions:[...methods.get(100686248).Instructions.filter(i=>i.Offset>=106&&i.Offset<118),
 {Offset:118,Op:'ldc.i4.2'},{Offset:119,Op:'ret'},{Offset:419,Op:'ldc.i4.1'},{Offset:420,Op:'ret'}]});
bind(100686248,8,([c,dx,dy,pointArg,override,aspect,orientation,extra])=>{context.events.push({name:'CbNX-geometry-sink',mode:execute(-2,[c]),dx,dy,aspect:!!aspect,orientation,extra});return VOID;});
// Exact active-controller move block. Snap inputs/results are explicit geometry facades.
methods.set(-3,{Instructions:methods.get(100682868).Instructions.filter(i=>i.Offset>=265&&i.Offset<=586)});
bind(100682529,1,()=>context.settings.grid);bind(100682566,1,()=>context.settings.guides);bind(100682574,1,()=>context.settings.objects);
bind(100682791,1,([host])=>host.active);
bind(100686096,1,args=>execute(100686227,args));
bind(100682511,1,([host])=>host.active.selection);
bind(100696225,1,([a])=>a.length);bind(721420493,1,([a])=>a[0]);bind(100695380,1,([w])=>w.angle??0);
bind(100682891,1,([host])=>host.point);
bind(100682860,1,([host])=>host.point);
bind(100682729,2,([host,p])=>{context.events.push({name:'xFY0-rect-sink',point:copy(p)});return rect(0,0,200,100);});
bind(100708333,1,([h])=>h);bind(100708343,2,([h,a])=>{context.events.push({name:'opposite-rotated-handle-sink',handle:h,angle:a});return h;});
bind(100682731,6,([host,r,handle,x,y,g])=>{context.events.push({name:'iFYq-snap-sink',handle,enabledX:!!x,enabledY:!!y,correction:context.correction});return point(context.correction.x,context.correction.y);});
bind(100682724,3,()=>{throw Error('Non-obNM snap branch outside contract');});
bind(100721944,2,([a,b])=>point(a.x+b.x,a.y+b.y));bind(100721945,2,([a,b])=>point(a.x-b.x,a.y-b.y));
bind(100721934,1,([p])=>deref(p).x);bind(100721936,1,([p])=>deref(p).y);
bind(100686116,5,([c,dx,dy,p,g])=>execute(100686246,[c,dx,dy,p]));
// Original release handler calls Moved, not hInw; EbNf/history is an explicit terminal sink.
bind(100682387,2,()=>({scope:true}));bind(100682889,1,()=>VOID);
bind(100686117,3,([c,x,y])=>{context.events.push({name:'Moved-call',dx:x,dy:y});return execute(100686261,[c,x,y]);});
bind(100686262,4,([c,a,b,d])=>{context.events.push({name:'EbNf-history-sink',commit:!!a,history:!!b,special:!!d});return VOID;});
// Moved calls its base implementation after the terminal scope, so avoid virtual recursion.
const moved=methods.get(100686261);
const movedInstructions=moved.Instructions.map(i=>i.Offset===72?{...i,Operand:-117}:i);
methods.set(100686261,{...moved,Instructions:movedInstructions});
bind(-117,3,()=>VOID);
export const inputs=[...inputFiles,...extra,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'];
export function run(input){
 context={calls:[],effects:[],commits:[],geometryWrites:[],events:[],keys:input.startMask??0,
  platform:{[67136992]:{}},settings:input.settings??{grid:true,guides:false,objects:false},correction:input.correction??{x:3,y:-4}};
 const c={kind:'obNM',selection:Array.from({length:input.count??1},()=>({rotationCap:input.rotationCap??false})),[67119114]:input.handle??4};
 const host={active:c,point:point(40,70),[67117547]:point(10,20),[67117539]:true};
 execute(-1,[c,host.point,input.allowRotation!==false,false]);
 const down={mode:c[67119116],events:context.events.splice(0)};
 const frames=[];
 for(const mask of input.moveMasks??[]){context.keys=mask;execute(-3,[host,{},{}]);frames.push({mask,mode:c[67119116],events:context.events.splice(0)});}
 let release;
 if(input.releaseMask!==undefined){context.keys=input.releaseMask;const result=execute(100682822,[host,{}]);release={mask:input.releaseMask,result,mode:c[67119116],events:context.events.splice(0)};}
 return {down,frames,release};
}
export function predicates(mask){context={keys:mask,events:[],platform:{[67136992]:{}}};return {
 bypass:!!execute(100726676,[context.platform,execute(100708657,[])?execute(100726560,[{}]):0]),
 shift:!!execute(100691309,[mask]),exactControl:!!execute(100691312,[mask]),
 rotationCapability:!!execute(100725016,[execute(100702019,[{}])])};}
`;
const cases=[];
try {
 const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const masks=[0,65536,131072,262144,196608,327680,393216,458752];
 for(const mask of masks){const actual=api.predicates(mask);assert.deepEqual(actual,{bypass:!!(mask&262144),shift:!!(mask&65536),exactControl:(mask&-65536)===131072,rotationCapability:false});cases.push({name:'native-platform-and-capability',mask,actual,passed:true});}
 for(const count of [1,2])for(const handle of [1,2,3,4,6,8,9,12])for(const startMask of masks){
  const input={count,handle,startMask,moveMasks:[0,131072,196608,393216,458752],releaseMask:262144};
  const actual=api.run(input),expectedMode=count>1&&startMask===131072?2:1;
  assert.equal(actual.down.mode,expectedMode);
  for(const f of actual.frames){assert.equal(f.mode,expectedMode);const out=f.events.find(e=>e.name==='CbNX-geometry-sink');assert(out);assert.equal(out.mode,expectedMode);assert.equal(out.aspect,!!(f.mask&65536));
   assert.deepEqual([out.dx,out.dy],f.mask&262144?[30,50]:[33,46]);assert.equal(f.events.filter(e=>e.name==='iFYq-snap-sink').length,f.mask&262144?0:1);}
  assert.equal(actual.release.events.filter(e=>e.name==='CbNX-geometry-sink').length,0);
  assert.equal(actual.release.events.filter(e=>e.name==='Moved-call').length,1);
  assert.deepEqual(actual.release.events.find(e=>e.name==='Moved-call'),{name:'Moved-call',dx:30,dy:50});
  cases.push({name:'press-mode-and-continuous-modifiers',input,actual,passed:true});
 }
 for(const settings of [{grid:false,guides:false,objects:false},{grid:false,guides:true,objects:false},{grid:false,guides:false,objects:true}]){
  const input={count:2,handle:4,startMask:0,moveMasks:[0,262144],releaseMask:0,settings};const actual=api.run(input);
  const enabled=Object.values(settings).some(Boolean);
  assert.equal(actual.frames[0].events.filter(e=>e.name==='iFYq-snap-sink').length,enabled?1:0);
  assert.equal(actual.frames[1].events.filter(e=>e.name==='iFYq-snap-sink').length,0);
  cases.push({name:'settings-gate',input,actual,passed:true});
 }
 const out={kind:'bounded original CIL mode block + original key predicates/platform override + active move block + release handler; snap/geometry/history and platform are declared facades',
  summary:{total:cases.length,passed:cases.filter(c=>c.passed).length,failed:0},
  facadeBoundaries:['Selected roots already passed native selection/hit testing; AbNC list facade is ordinary independent SelectionButton roots','Full snap algorithm xFY0/iFYq and opposite/rotated-handle math are sinks, not reconstructed here','CbNX geometry is a terminal sink after replaying its stored-mode branch','Moved base call token is rebound only to distinguish nonvirtual base invocation from virtual dispatch; its base behavior is a no-op sink','EbNf history/cleanup is terminal; actual editor history/GUI not executed','Platform keys are explicit masks; no GetKeyState or original DLL invocation'],
  sources:[...new Set([base,...api.inputs,import.meta.filename])].map(path=>({path,sha256:sha(path)})),cases};
 fs.writeFileSync('research/selection-input-keys-probes.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out.summary));
}catch(e){const failure={kind:'probe harness failure',error:String(e.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-cil>'),completed:cases.length,scriptSha256:sha(import.meta.filename)};let n=1;while(fs.existsSync('research/selection-input-keys-failure-'+n+'.json'))n++;fs.writeFileSync('research/selection-input-keys-failure-'+n+'.json',JSON.stringify(failure,null,2)+'\n');console.error(failure.error);process.exitCode=1;}
