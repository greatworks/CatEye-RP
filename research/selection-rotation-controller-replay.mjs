// Bounded interpretation of retained CIL records. No vendor assembly is loaded.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const baseFile='research/layer-resize-controller-probe.mjs';
let prefix=fs.readFileSync(baseFile,'utf8').split('for(let mask=0;mask<16;mask++)')[0];
prefix=prefix.replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("const op=i.Op,v=i.Operand;", "const op=i.Op,v=i.Operand;const visited=executed.get(token)??new Set();visited.add(i.Offset);executed.set(token,visited);")
 .replace("const copy = v => deref(v)?.__struct ? {...deref(v)} : deref(v);", "const copy = v => v?.__ref ? v : v?.__struct ? {...v} : v;")
 .replace("else if(op==='ldc.r8')", "else if(op==='ldc.i8') stack.push(BigInt(i.Int64Operand??v)); else if(op==='ldc.r8')")
 .replace("'div','and'", "'div','rem','and'").replace('div:()=>a/b,','div:()=>a/b,rem:()=>a%b,')
 .replace("else if(op==='initobj') stack.pop().set(null);", "else if(op==='initobj') stack.pop().set(struct('matrix',Object.fromEntries([67120176,67120177,67120178,67120179,67120180,67120181].map(k=>[k,0]))));")
 .replace("else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s')", "else if(op==='endfinally'&&token===100686248)jump(1036); else if(op==='leave'&&token===100686248&&v===1036)jump(1021); else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s')");
const addedFiles=[
 'research/layer-resize-controller-planner-host-cil.json',
 'research/selection-rotation-controller-geometry-cil.json',
 'research/selection-rotation-controller-equality-cil.json',
 'research/adaptive-placement-authoring-owner-cil.json',
 'research/adaptive-all-views-position-cil.json',
 'research/layer-resize-numeric-dependencies-cil.json',
 'research/layer-resize-numeric-extra-cil.json',
 'research/gradient-angle-point-cil.json',
 'research/native-point-contours-rotation-angle-cil.json',
 'research/font-size-runtime-round-cil.json',
 'research/selection-pointer-modifiers-key-tests-cil.json',
 'research/rotation-runtime-capability-bits-cil.json',
 'research/layer-resize-capability-getters-cil.json',
];
const extension=`
const addedFiles=${JSON.stringify(addedFiles)};
const executed=new Map();
for(const f of addedFiles)for(const t of read(f).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file:f});
const events=[];
const ev=(name,data={})=>events.push({name,...data});
for(const [t,n] of [[100686248,8],[100686255,4],[100686257,1],[100721956,2],[100722000,3],[100721995,2],
 [100688896,2],[100688843,1],[100688844,2],[100688805,1],[100688822,3],[100688830,1],
 [100691309,1],[100691307,2],[100695382,3],[100695349,5],[100695350,4],[100695363,1],
 [100721975,2],[100721976,2],[100721978,2],[100721980,2],[100721982,2],
 ...Array.from({length:12},(_,i)=>[100688876+i,i%2?2:1])]) cil(t,n);
// Explicit BCL numeric services. AwayFromZero mode is asserted; no vendor methods run.
bind(167786521,3,([v,digits,mode])=>{assert.equal(digits,0);assert.equal(mode,1);return Math.sign(v)*Math.floor(Math.abs(v)+.5);});
bind(167786547,2,([y,x])=>Math.atan2(y,x));bind(167784567,1,([x])=>Math.sin(x));bind(167784568,1,([x])=>Math.cos(x));
bind(100722075,1,([r])=>{r=deref(r);return point(r.x+r.width/2,r.y+r.height/2);});
// Original capability predicate, with exact integer carrier (not lossy JSON Number).
cil(100725016,1);
bind(100695291,1,([w])=>w.rotationCapable?1099511627776n:execute(w.nativeType==='checkbox'?100699783:100702019,[w]));
bind(100695510,1,([w])=>w);
bind(100717823,2,([w,angle])=>{ev('Rotation.write',{id:w.id,angle});w.angle=angle;return VOID;});
bind(100695399,1,([w])=>{ev('geometry.invalidate',{id:w.id});return VOID;});
bind(100695347,1,([w])=>point(w.rect.x,w.rect.y));
bind(100695508,1,([w])=>w);bind(167789631,1,()=>false);
bind(100695494,1,()=>false);
bind(100717738,2,([w,p])=>{ev('Location.write',{id:w.id,point:{x:p.x,y:p.y},provider:'current'});w.rect={...w.rect,x:p.x,y:p.y};return VOID;});
bind(100695409,3,([w])=>{ev('geometry.changed',{id:w.id});return VOID;});
bind(167789632,1,([value])=>({value}));bind(100695346,2,([w])=>{ev('Location.notify',{id:w.id});return VOID;});
bind(100695505,6,()=>{throw Error('Unexpected all-views provider');});
bind(100695382,3,args=>{ev('Rotation.request',{id:args[0].id,angle:args[1],flags:args[2]});return execute(100695382,args);});
bind(100695349,5,args=>{ev('Location.request',{id:args[0].id,point:{x:args[1].x,y:args[1].y},allViews:!!args[2],notify:!!args[3]});return execute(100695349,args);});
bind(100686257,1,args=>{const answer=execute(100686257,args);ev('angle.snap',{raw:args[0],answer,keys:context.keys});return answer;});
bind(100682313,3,([host,w])=>{ev('editor.member.notify',{id:w.id});return VOID;});
bind(100685849,1,([c])=>point(c.offset.x,c.offset.y));
// Controller collections, lazy snapshots, diagram/history and repaint are isolated facades.
bind(100686240,1,([c])=>c.selection);bind(721422055,2,()=>0);
bind(100685874,1,([c])=>c);bind(100664959,3,()=>{ev('operation.begin');return {dispose(){ev('operation.end');}};});
bind(100685894,1,([c])=>c);bind(100685881,1,([c])=>c[67119005]);
bind(100707157,1,([ws])=>{ev('snapshot.capture');return {unrounded:new Map(ws.map(w=>[w,copy(w.rect)])),angles:new Map(ws.map(w=>[w,w.angle]))};});
bind(100686247,1,([c])=>c[67119005]);bind(100686233,1,()=>2);
bind(167776549,1,([a])=>a.length);bind(167783920,2,([a,i])=>a[i]);
bind(167776614,1,([a])=>enumStart(a));bind(167776601,1,([e])=>deref(e).items[deref(e).index]);
bind(167776602,1,([e])=>{e=deref(e);return ++e.index<e.items.length;});
bind(167772304,1,([scope])=>{scope?.dispose?.();return VOID;});
bind(100707213,3,()=>({scope:'connections-history-facade'}));bind(100707220,1,()=>{ev('snapshot.complete');return VOID;});
bind(100686203,1,()=>({}));bind(100686095,2,()=>VOID);
bind(100695934,1,()=>rect(0,0,0,0)); // post-write overlay only; never supplies the captured pivot
for(const [t,n]of [[100685904,2],[100686287,2],[100682865,3],[100682311,3],[100682316,2],[100682310,3],[100682298,1],[100686115,4]])bind(t,n,()=>VOID);
bind(100686186,1,()=>true);
for(const [t,n]of [[100686253,6],[100695365,4],[100695366,4],[100702343,2],[100702367,2]])bind(t,n,()=>{throw Error('Unexpected resize/fit path '+t);});
const clean=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
export function replay(input){
 context={keys:0,effects:[],calls:[],geometryWrites:[],commits:[]};events.length=0;
 const ws=input.widgets.map((x,i)=>widget(x.id??'selection'+i,'SelectionButton',rect(x.rect.x,x.rect.y,x.rect.width,x.rect.height),{
  angle:x.angle??0,rotationCapable:!!x.rotationCapable,nativeType:x.type??'radio',[67123780]:!!x.locked,
  autoFitWidth:!!x.autoFitWidth,autoFitHeight:!!x.autoFitHeight,panel:x.panel??{x:14,y:0,width:x.rect.width-14,height:20}
 }));
 const b=input.bounds,c={selection:ws,offset:input.scopeOffset??{x:0,y:0},[67119117]:rect(b.x,b.y,b.width,b.height),[67119115]:point(input.down.x,input.down.y)};
 const state=()=>ws.map(w=>({id:w.id,rect:clean(w.rect),angle:w.angle,autoFitWidth:w.autoFitWidth,autoFitHeight:w.autoFitHeight,panel:{...w.panel}}));
 const frames=[];
 for(const f of input.frames){
  events.length=0;context.keys=f.keys??0;const before=state();let error=null;
  try{execute(100686248,[c,f.delta.x,f.delta.y,f.point??point(99999,-99999),false,!!(context.keys&65536),3,false]);}
  catch(e){error=String(e.stack).replace(/data:text\\/javascript;base64,[A-Za-z0-9+/=]+/g,'<cil-record>');}
  frames.push({frame:f,before,after:state(),events:events.map(x=>({...x})),error});
 }
 return frames;
}
export function snap(angle,keys=0){context={keys};events.length=0;return execute(100686257,[angle]);}
export function inequality(a,b){return execute(100721976,[point(a.x,a.y),point(b.x,b.y)]);}
export function capability(type){const value=execute(type==='checkbox'?100699783:100702019,[{}]);return {value:value.toString(),rotation:!!execute(100725016,[value])};}
export function coverage(){return [...executed].map(([token,offsets])=>({token,file:methods.get(token).file,visitedOffsets:[...offsets].sort((a,b)=>a-b)}));}
export const sources=[...inputFiles,...addedFiles];
`;
const api=await import('data:text/javascript;base64,'+Buffer.from(prefix+extension).toString('base64'));
export const replay=api.replay,snap=api.snap,inequality=api.inequality,capability=api.capability,coverage=api.coverage;
export const sourceFiles=[baseFile,...api.sources,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'];
