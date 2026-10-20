// Bounded CIL-record interpretation for the author resize controller.
// Numeric INw2/mNwa/ubNp geometry is an explicit injected sink; no target DLL runs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { foldFlowFields } from './gradient-angle-static-flow.mjs';

const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const sha = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const inputFiles = [
  '.build/next-layer-authoring/member-tree-cil.json',
  '.build/next-layer-authoring/resize-propagation-cil.json',
  '.build/next-layer-authoring/pin-propagation-cil.json',
  '.build/next-layer-authoring/pin-info-cil.json',
  '.build/next-layer-authoring/constraint-bridge-cil.json',
  '.build/next-layer-authoring/snapshot-inputs-cil.json',
  '.build/next-layer-authoring/geometry-entry-cil.json',
  'research/layer-resize-controller-bridges-cil.json',
  'research/layer-resize-controller-coordinate-cil.json',
  'research/layer-resize-controller-parent-cil.json',
  'research/layer-resize-controller-membership-cil.json',
  'research/layer-resize-controller-side-effects-cil.json',
  'research/layer-resize-controller-gates-cil.json',
  'research/layer-resize-controller-value-helpers-cil.json',
  'research/layer-resize-controller-handle-cil.json',
  'research/layer-resize-controller-difference-predicate-cil.json',
  'research/layer-resize-controller-contains-cil.json',
];
const methods = new Map(inputFiles.flatMap(file => read(file).Types.flatMap(t => t.Methods.map(m => [m.Token, { ...m, file }]))));
const fields = foldFlowFields();
const VOID = Symbol('void'), struct = (type, data) => ({ __struct: type, ...data });
const rect = (x,y,width,height) => struct('rect', {x,y,width,height});
const point = (x,y) => struct('point', {x,y});
const size = (width,height) => struct('size', {width,height});
const deref = v => v?.__ref ? v.get() : v;
const copy = v => deref(v)?.__struct ? {...deref(v)} : deref(v);
const addr = (object,key) => ({__ref:true,get:()=>object[key],set:value=>{object[key]=copy(value);}});
const set = (target,value) => { if(target?.__ref) target.set(value); else Object.assign(target,value); };
const truth = v => !!deref(v);
const typeIds = {Layer:33557506,DynamicPanel:33557465,VectorShape:33557622,SelectionButton:33557577,ImageBox:33557484,Connector:33557400};
const isType = (v,t) => v && (t===33557056 ? !!v.kind : t===16777348||t===452987322 ? Array.isArray(v) : typeIds[v.kind]===t);
let context;
const resultCases=[];
function test(name, fn) { context={calls:[], effects:[],commits:[],geometryWrites:[],keys:0,results:{},union:rect(0,0,100,100),pinCorrection:rect(0,0,100,100)}; fn(); resultCases.push({name,passed:true,calls:context.calls,effects:context.effects,commits:context.commits,geometryWrites:context.geometryWrites}); }
function fieldGet(o,k) { o=deref(o); assert(o,'null field '+k); return copy(o[k] ?? (k===67119107?0:null)); }
function fieldSet(o,k,v) { deref(o)[k]=copy(v); }
function enumStart(a) { return {items:deref(a),index:-1}; }
function execute(token, args, budget=15000) {
  const m=methods.get(token); assert(m,'Missing CIL '+token);
  const instructions=m.Instructions, offsets=new Map(instructions.map((i,n)=>[i.Offset,n]));
  const stack=[], locals=[], cleanups=[];
  let pc=0, steps=0;
  const jump=offset=>{assert(offsets.has(offset),`${token}: no IL ${offset}`);pc=offsets.get(offset);};
  const pop=n=>stack.splice(stack.length-n,n);
  const loadArg=i=>copy(args[i]), getLocal=i=>copy(locals[i]??null);
  try {
    while(steps++<budget) {
      const i=instructions[pc++]; assert(i,`Instruction EOF ${token}`);
      const op=i.Op,v=i.Operand;
      if(op==='nop'||op==='constrained.'||op==='box'||op==='conv.i8'||op==='conv.r8'||op==='unbox.any') {}
      else if(op==='ldnull') stack.push(null);
      else if(op.startsWith('ldc.i4')) stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
      else if(op==='ldc.r8') stack.push(v);
      else if(op==='ldarg.s'||/^ldarg\.[0-3]$/.test(op)) stack.push(loadArg(op==='ldarg.s'?v:Number(op.slice(6))));
      else if(op==='ldarga.s') stack.push(addr(args,v));
      else if(op==='starg.s') args[v]=copy(stack.pop());
      else if(op==='ldloc.s'||/^ldloc\.[0-3]$/.test(op)) stack.push(getLocal(op==='ldloc.s'?v:Number(op.slice(6))));
      else if(op==='ldloca.s'||op==='ldloca') stack.push(addr(locals,v));
      else if(op==='stloc.s'||/^stloc\.[0-3]$/.test(op)) locals[op==='stloc.s'?v:Number(op.slice(6))]=copy(stack.pop());
      else if(op==='ldfld') stack.push(fieldGet(stack.pop(),v));
      else if(op==='ldflda') stack.push(addr(deref(stack.pop()),v));
      else if(op==='stfld') {const value=stack.pop(),object=stack.pop();fieldSet(object,v,value);}
      else if(op==='ldsfld') {
        if(v===67142340) stack.push(Object.fromEntries([...fields].map(([k,x])=>[k,x.value])));
        else if(v===67134719) stack.push(point(0,0));
        else throw Error('Unproved static field '+v);
      }
      else if(op==='dup') stack.push(stack.at(-1));
      else if(op==='pop') stack.pop();
      else if(op==='neg') stack.push(-deref(stack.pop()));
      else if(['add','sub','mul','div','and','or','xor','ceq','cgt.un','clt','cgt'].includes(op)) {
        const b=deref(stack.pop()),a=deref(stack.pop());
        const operations={add:()=>a+b,sub:()=>a-b,mul:()=>a*b,div:()=>a/b,and:()=>a&b,or:()=>a|b,xor:()=>a^b,ceq:()=>a===b?'1':0,'cgt.un':()=>a!=null&&b===null?1:a>b?1:0,clt:()=>a<b?1:0,cgt:()=>a>b?1:0};
        stack.push(op==='ceq'?(a===b?1:0):operations[op]());
      }
      else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s') jump(v);
      else if(op==='brtrue'||op==='brtrue.s') {if(truth(stack.pop()))jump(v);}
      else if(op==='brfalse'||op==='brfalse.s') {if(!truth(stack.pop()))jump(v);}
      else if(['beq','bne.un','blt','bgt','ble','bge'].includes(op)) {const b=deref(stack.pop()),a=deref(stack.pop());if(({beq:a===b,'bne.un':a!==b,blt:a<b,bgt:a>b,ble:a<=b,bge:a>=b})[op])jump(v);}
      else if(op==='isinst') {const a=deref(stack.pop());stack.push(isType(a,v)?a:null);}
      else if(op==='castclass') {}
      else if(op==='initobj') stack.pop().set(null);
      else if(op==='newarr') stack.push(new Array(stack.pop()).fill(null));
      else if(op==='stelem.ref') {const value=stack.pop(),n=stack.pop(),a=stack.pop();a[n]=value;}
      else if(op==='call'||op==='callvirt'||op==='newobj') {
        const spec=callSpecs.get(v);assert(spec,`${token} IL ${i.Offset}: unproved call ${v} ${i.Resolved}`);
        const values=pop(spec.count),value=spec.run(values,{token,offset:i.Offset,op,cleanups});
        if(value!==VOID) stack.push(copy(value));
      }
      else if(op==='ret') {assert(stack.length<=1,`${token}: return stack ${stack.length}`);return stack.length?copy(stack.pop()):VOID;}
      else throw Error(`${token}: unsupported ${op} at ${i.Offset}`);
    }
    throw Error('Instruction budget '+token);
  } finally {for(const cleanup of cleanups.reverse())cleanup();}
}
const callSpecs=new Map();
const bind=(id,count,run)=>callSpecs.set(id,{count,run});
const cil=(id,count)=>bind(id,count,args=>execute(id,args));
for(const [id,count] of [[100722156,3],[100695469,1],[100695472,1],[100695456,1],[100707162,2],[100707163,2],
 [100686208,1],[100686209,2],[100686210,1],[100686211,1],[100686212,1],[100686215,1],[100686216,2],
 [100686229,1],[100686241,1],[100686249,11],[100686252,4],[100686260,6],[100695371,3],[100695483,3],[100695481,1],[100688812,3],[100688813,2],
 [100708299,1],[100708300,1],[100708303,2],[100708315,1],[100708318,1],[100722081,1],[100722083,2],
 [100689849,2],[100689190,2],...Array.from({length:11},(_,n)=>[100703710+n,1])]) cil(id,count);
bind(100686207,1,([w])=>{const o={};execute(100686207,[o,w]);return o;});
bind(100703709,6,args=>{const o={};execute(100703709,[o,...args]);return o;});
bind(100732116,0,()=>VOID);bind(167772266,1,()=>VOID);
bind(167785166,0,()=>[]);bind(167785167,2,([a,v])=>{a.push(v);return VOID;});
for(const id of [167772461,167785176,167785178]) bind(id,1,([a])=>enumStart(a));
for(const id of [167772385,167785177,167785179]) bind(id,1,([e])=>{e=deref(e);return e.items[e.index];});
for(const id of [167772305,167785180]) bind(id,1,([e])=>{e=deref(e);return ++e.index<e.items.length;});
bind(167772304,1,()=>VOID);
bind(721422066,1,([a])=>a.length>0);
bind(721422067,2,([a,b])=>a.filter(v=>execute(100689849,[{[167787520]:b},v])));
bind(721422298,2,args=>execute(100689190,args));
bind(167786730,2,([a,v])=>a.includes(v)?1:0);
bind(167785190,2,([a,v])=>a.includes(v));
bind(100701040,1,([w])=>w.children??[]);
bind(100700551,1,([w])=>w.pinned??[]); // all-state/root-layer filtering separately source-bound.
bind(100695369,1,([w])=>w.rect);
bind(100695395,1,([w])=>({bounds:w.aabb??w.rect}));
bind(100722028,1,([s])=>s.bounds);
bind(100716799,2,([a,b])=>a===b);
bind(100716800,2,([a,b])=>a!==b);
bind(100695484,1,([w])=>!!w.background);
bind(100701033,1,([w])=>!!w.currentLayer);
bind(100707160,2,([c,w])=>c.unrounded.get(w));
bind(100707161,2,([c,w])=>c.aabb.get(w));
bind(100707164,2,([c,w])=>c.angles.get(w)??0);
bind(100686247,1,([c])=>c.snapshot);
bind(100695510,1,([w])=>w.style);
bind(100695291,1,([w])=>w.capabilities);
bind(100717741,1,([s])=>s.pinHorizontal??0);bind(100717743,1,([s])=>s.pinVertical??0);
bind(100717745,1,([s])=>!!s.fixedHeight);bind(100717747,1,([s])=>!!s.fixedWidth);
bind(100725028,1,([caps])=>(caps&134217728)!==0);bind(100725029,1,([caps])=>(caps&268435456)!==0);
bind(100708646,0,()=>({keyboard:true}));bind(100710378,1,()=>context.keys);
bind(100691318,1,([keys])=>(keys&-65536)===393216);
bind(100686099,1,([c])=>c.freedom);
for(const [get,setter,key] of [[100702342,100702343,'autoFitWidth'],[100702366,100702367,'autoFitHeight'],[100700759,100700760,'fitToImage'],[100700520,100700521,'fitToContent']]) {
  bind(get,1,([w])=>!!w[key]);
  bind(setter,2,([w,v])=>{context.effects.push({id:w.id,field:key,value:!!v});w[key]=!!v;return VOID;});
}
bind(100686253,6,args=>execute(100686253,args));
bind(100686250,1,([c],frame)=>{const previous=c[67119111];frame.cleanups.push(()=>{c[67119111]=previous;});return {scope:'TrapScaling'};});
bind(100703557,10,args=>{
  const [w,oldRect,oldAabb,delta,parentRect,handle,freedom,scaling,orientation,pin]=args.map(copy);
  context.calls.push({method:'INw2',id:w.id,oldRect,oldAabb,delta,parentRect,handle,freedom,scaling:!!scaling,orientation,pin:pinData(pin)});
  return copy(context.results[w.id]??oldRect);
});
bind(100686251,8,args=>{
  const [c,oldParent,newParent,members,dx,dy,freedom,orientation]=args;
  context.calls.push({method:'ubNp',ids:members.map(n=>n[67119104].id),oldParent,newParent,dx,dy,freedom,orientation});
  return context.union;
});
bind(100703559,4,args=>{context.calls.push({method:'mNwa',pin:pinData(args[0]),oldRect:copy(args[1]),newRect:copy(args[2]),handle:args[3]});return context.pinCorrection;});
bind(100695248,1,()=>({scope:'conglomerate change notification bracket'}));
bind(100695371,3,args=>{
  context.commits.push({id:args[0].id,rect:copy(args[1]),allViews:!!args[2]});
  return execute(100695371,args);
});
bind(100695365,4,([w,s,allViews,notify])=>{context.geometryWrites.push({id:w.id,property:'Size',value:copy(s),allViews:!!allViews,notify:!!notify});return VOID;});
bind(100695349,5,([w,p,allViews,notify,extra])=>{assert.equal(extra,null);context.geometryWrites.push({id:w.id,property:'Location',value:copy(p),allViews:!!allViews,notify:!!notify});return VOID;});
bind(100686186,1,()=>false);
bind(100686082,1,()=>({editor:true}));
bind(100682313,3,()=>VOID);
bind(100707213,3,()=>({scope:'change bracket'}));
for(const [id,key] of [[100722047,'x'],[100722049,'y'],[100722051,'width'],[100722053,'height'],
 [100722055,'x'],[100722056,'y'],[100722956,'width'],[100722954,'height'],[100721934,'x'],[100721936,'y']])bind(id,1,([v])=>deref(v)[key]);
bind(100722057,1,([r])=>deref(r).x+deref(r).width);bind(100722058,1,([r])=>deref(r).y+deref(r).height);
bind(100722076,1,([r])=>point(deref(r).x,deref(r).y));
bind(100722078,1,([r])=>size(deref(r).width,deref(r).height));
bind(100722093,2,([p,s])=>rect(p.x,p.y,s.width,s.height));
bind(100721941,2,([x,y])=>point(x,y));
bind(100721944,2,([a,b])=>point(a.x+b.x,a.y+b.y));
bind(100721945,2,([a,b])=>point(a.x-b.x,a.y-b.y));
bind(100722970,2,([a,b])=>size(a.width-b.width,a.height-b.height));
bind(100722992,2,([a,b])=>Math.abs(a.width-b.width)>=1e-5||Math.abs(a.height-b.height)>=1e-5);
bind(100722077,2,([r,p])=>{const v=deref(r);set(r,{...v,x:p.x,y:p.y});return VOID;});
bind(100721935,2,([p,x])=>{set(p,{...deref(p),x});return VOID;});
bind(100721937,2,([p,y])=>{set(p,{...deref(p),y});return VOID;});
bind(167779192,1,([p])=>deref(p)!==null&&deref(p)!==undefined);
bind(167784144,1,([p])=>copy(p));bind(167779194,1,([p])=>copy(p));bind(167779193,1,([p])=>p);
bind(167774838,1,([v])=>Math.abs(v));bind(167773368,2,([a,b])=>Math.max(a,b));bind(167774824,2,([a,b])=>Math.min(a,b));
bind(167775900,2,([v,mask])=>(v&mask)===mask);
function pinData(p) {return p?{pinHorizontal:p[67127403],pinVertical:p[67127404],fixedWidth:!!p[67127405],fixedHeight:!!p[67127406],oldParent:p[67127407],newParent:p[67127408]}:null;}
function widget(id,kind,r,extra={}) {return {id,kind,rect:r,style:{},capabilities:402653184,[67123780]:false,[67123777]:null,[67123776]:null,...extra};}
function group(id,r,children,extra={}) {const g=widget(id,'Layer',r,{children,...extra});for(const w of children)w[67123776]=g;return g;}
function tree(w){return callSpecs.get(100686207).run([w]);}
function controller(roots,freedom=3) {
  const all=[],visit=w=>{all.push(w);for(const c of w.children??w.pinned??[])visit(c);};roots.forEach(visit);
  const nodes=roots.map(tree);
  return {freedom,[67119111]:true,[67119114]:12,[67119110]:{[67119100]:nodes},snapshot:{unrounded:new Map(all.map(w=>[w,w.rect])),aabb:new Map(all.map(w=>[w,w.aabb??w.rect])),angles:new Map(all.map(w=>[w,0]))},nodes};
}
function runNode(c,node,{dx=20,dy=10,parent=rect(0,0,200,100),overrideLocked=false}={}) {
  return execute(100686249,[c,node,overrideLocked,parent,dx,dy,3,false,c.freedom,null,null]);
}
function assertFit(w,c,dx,dy,fw,fh,expected) {execute(100686253,[c,dx,dy,w,fw,fh]);for(const [key,value]of Object.entries(expected))assert.equal(w[key],value);}

for(let mask=0;mask<16;mask++) test(`touching edges mask ${mask}`,()=>{
  const parent=rect(0,0,100,100),l=mask&1?0:10,t=mask&2?0:10,r=mask&4?100:90,b=mask&8?100:90;
  assert.equal(execute(100722156,[rect(l,t,r-l,b-t),parent,.0001]),mask);
});
for(const delta of [0,.000099999,.0001,.000100001,-.0001]) test(`strict contact tolerance ${delta}`,()=>{
  assert.equal(execute(100722156,[rect(delta,10,50,50),rect(0,0,100,100),.0001]),Math.abs(delta)<.0001?1:0);
});
test('EJdP resolves Layer through containing widget, not its own obsolete field',()=>{
  const outer=group('outer',rect(0,0,200,100),[]);
  const containedOwner=widget('owner','VectorShape',rect(1,2,30,40),{[67123776]:outer});
  const leaf=widget('contained','VectorShape',rect(3,4,10,20),{[67123777]:containedOwner,[67123776]:{id:'unused'}});
  assert.equal(execute(100695456,[leaf]),outer);
});
test('TbN1 includes touching members without using selected IDs; interior excluded',()=>{
  const a=widget('edge','VectorShape',rect(0,10,30,20)),b=widget('inner','VectorShape',rect(20,20,30,20));
  const g=group('g',rect(0,0,100,100),[a,b]),n=tree(g);
  assert.deepEqual(n[67119105].map(x=>x[67119104].id),['edge','inner']);
  assert.deepEqual(n[67119108].map(x=>x[67119104].id),['edge']);
  assert.equal(n[67119105][0][67119107],1);
});
test('TbN1 classifies using supplied rotated AABB, not unrotated rect',()=>{
  const a=widget('rotated-edge','VectorShape',rect(10,10,20,20),{aabb:rect(0,10,40,20)});
  const n=tree(group('g',rect(0,0,100,100),[a]));
  assert.equal(n[67119108].length,1);
});
test('Panel adapter includes supplied pinned objects only and keeps them out of edge subset',()=>{
  const a=widget('pinned','VectorShape',rect(10,10,20,20));
  const n=tree(widget('p','DynamicPanel',rect(0,0,100,100),{pinned:[a],children:[a,widget('not-pinned','VectorShape',rect(20,20,5,5))]}));
  assert.deepEqual(n[67119105].map(x=>x[67119104].id),['pinned']);assert.equal(n[67119108].length,0);
});
test('Relative snapshots subtract immediate Layer origin and preserve distinct AABB sizes',()=>{
  const child=widget('leaf','VectorShape',rect(-20,40,30,10),{aabb:rect(-21,35,32,20)});
  const g=group('g',rect(-40,20,100,80),[child]),c=controller([g]);
  assert.deepEqual(execute(100707162,[c.snapshot,child]),rect(20,20,30,10));
  assert.deepEqual(execute(100707163,[c.snapshot,child]),rect(19,15,32,20));
});
for(const kind of ['VectorShape','SelectionButton','ImageBox','DynamicPanel','Layer']) {
  for(const freedom of [0,1,2,3]) for(const dx of [0,10]) for(const dy of [0,10]) {
    test(`fit ${kind} freedom=${freedom} delta=${dx},${dy}`,()=>{
      const w=widget('w',kind,rect(0,0,100,100),{autoFitWidth:true,autoFitHeight:true,fitToImage:true,fitToContent:true});
      const c={freedom};
      const expected={autoFitWidth:true,autoFitHeight:true,fitToImage:true,fitToContent:true};
      if(kind==='VectorShape'){if(freedom&1)expected.autoFitWidth=dx===0;if(freedom&2)expected.autoFitHeight=dy===0;}
      if(kind==='SelectionButton'&&(freedom&1))expected.autoFitWidth=dx===0;
      if(kind==='ImageBox')expected.fitToImage=dx===0&&dy===0;
      if(kind==='DynamicPanel')expected.fitToContent=dx===0&&dy===0;
      assertFit(w,c,dx,dy,false,false,expected);
    });
  }
}
for(const fw of [false,true]) for(const fh of [false,true]) test(`fixed fit suppression ${fw}/${fh}`,()=>{
  for(const kind of ['VectorShape','ImageBox','DynamicPanel']){
    const w=widget(kind,kind,rect(0,0,100,100),{autoFitWidth:true,autoFitHeight:true,fitToImage:true,fitToContent:true});
    assertFit(w,{freedom:3},10,10,fw,fh,{
      autoFitWidth:kind==='VectorShape'?fw:true,autoFitHeight:kind==='VectorShape'?fh:true,
      fitToImage:kind==='ImageBox'?fw&&fh:true,fitToContent:kind==='DynamicPanel'?fw&&fh:true,
    });
  }
});
test('Initially disabled fit flags never turn on',()=>{
  for(const kind of ['VectorShape','SelectionButton','ImageBox','DynamicPanel']){
    const w=widget(kind,kind,rect(0,0,100,100),{autoFitWidth:false,autoFitHeight:false,fitToImage:false,fitToContent:false});
    assertFit(w,{freedom:3},0,0,false,false,{autoFitWidth:false,autoFitHeight:false,fitToImage:false,fitToContent:false});
  } assert.equal(context.effects.length,0);
});
test('Layer two passes use touching subset then interior; child frames become scope coordinates',()=>{
  const edge=widget('edge','VectorShape',rect(10,30,40,20)),inner=widget('inner','VectorShape',rect(40,40,20,20));
  const g=group('g',rect(10,20,100,100),[inner,edge]),c=controller([g]);
  context.results={g:rect(20,30,200,150),edge:rect(0,15,80,30),inner:rect(60,30,40,30)};
  context.union=rect(0,0,200,150);
  runNode(c,c.nodes[0],{dx:100,dy:50});
  assert.deepEqual(context.calls.filter(x=>x.method==='INw2').map(x=>x.id),['g','edge','inner']);
  assert.deepEqual(context.calls.find(x=>x.method==='ubNp').ids,['edge']);
  assert.deepEqual(context.commits.map(x=>x.id),['edge','inner']);
  assert.deepEqual(context.commits[0].rect,rect(20,45,80,30));
  assert.deepEqual(context.commits[1].rect,rect(80,60,40,30));
  const edgeCall=context.calls.find(x=>x.method==='INw2'&&x.id==='edge');
  assert.deepEqual(edgeCall.oldRect,rect(0,10,40,20));
  assert.deepEqual(edgeCall.pin.oldParent,rect(0,0,100,100));
  assert.deepEqual(edgeCall.pin.newParent,rect(0,0,200,150));
  assert.equal(c[67119111],true);
});
for(const ownLocked of [false,true]) for(const parentLocked of [false,true]) for(const selected of [false,true]) test(`Locked own=${ownLocked} parent=${parentLocked} selected=${selected}`,()=>{
  const w=widget('w','VectorShape',rect(0,0,10,10),{[67123780]:ownLocked});
  group('parent',rect(0,0,20,20),[w],{[67123780]:parentLocked});
  assert.equal(!!execute(100695483,[w,true,selected]),selected?ownLocked:parentLocked);
});
for(const ownLocked of [false,true]) for(const currentLayer of [false,true]) test(`Current Layer lock resolution own=${ownLocked} entered=${currentLayer}`,()=>{
  const w=widget('w','VectorShape',rect(0,0,10,10),{[67123780]:ownLocked});
  group('parent',rect(0,0,20,20),[w],{currentLayer,[67123780]:false});
  assert.equal(!!execute(100695483,[w,true,false]),currentLayer?ownLocked:false);
});
for(const locked of [false,true]) for(const background of [false,true]) for(const overrideLocked of [false,true]) test(`ordinary commit gate locked=${locked} background=${background} override=${overrideLocked}`,()=>{
  const w=widget('w','VectorShape',rect(0,0,100,100),{[67123780]:locked,background}),c=controller([w]);
  context.results.w=rect(10,20,120,130);
  runNode(c,c.nodes[0],{overrideLocked});
  const admitted=!background&&(!locked||overrideLocked);
  assert.equal(context.commits.length,admitted?1:0);
  if(admitted){
    assert.deepEqual(context.geometryWrites.map(r=>r.property),['Size','Location']);
    assert(context.geometryWrites.every(r=>!r.allViews&&r.notify));
  }
});
for(const delta of [0,.000009999,.00001,.000010001,-.00001]) test(`fit change strict delta threshold ${delta}`,()=>{
  const w=widget('w','VectorShape',rect(0,0,100,100),{autoFitWidth:true,autoFitHeight:true});
  assertFit(w,{freedom:3},delta,delta,false,false,{autoFitWidth:Math.abs(delta)<1e-5,autoFitHeight:Math.abs(delta)<1e-5});
});
test('Nested Layer origins are restored once at each level; only leaf commits',()=>{
  const leaf=widget('leaf','VectorShape',rect(20,40,40,30));
  const nested=group('nested',rect(20,40,40,30),[leaf]);
  const outer=group('outer',rect(10,20,100,100),[nested]);
  const c=controller([outer]);
  context.results={outer:rect(30,50,200,200),nested:rect(20,40,80,60),leaf:rect(0,0,80,60)};
  context.union=rect(0,0,80,60);
  runNode(c,c.nodes[0],{dx:100,dy:100});
  assert.deepEqual(context.commits.map(x=>x.id),['leaf']);
  assert.deepEqual(context.commits[0].rect,rect(50,90,80,60));
  assert.deepEqual(context.calls.find(x=>x.method==='INw2'&&x.id==='leaf').oldRect,rect(0,0,40,30));
});
test('Difference predicate preserves nonmembers in original order and removes repeated members',()=>{
  const a={},b={},c={};
  assert.deepEqual(callSpecs.get(721422067).run([[c,a,b,a,c],[a]]),[c,b,c]);
});
test('Layer two passes give rest the candidate parent size, not the requested size',()=>{
  const edge=widget('edge','VectorShape',rect(0,10,50,20)),inner=widget('inner','VectorShape',rect(20,30,20,10));
  const g=group('g',rect(0,0,100,100),[inner,edge]),c=controller([g]);
  context.results={g:rect(15,25,200,150),edge:rect(0,15,50,20),inner:rect(20,30,20,10)};
  context.union=rect(0,0,170,120);
  runNode(c,c.nodes[0],{dx:100,dy:50});
  const calls=context.calls.filter(x=>x.method==='INw2');
  assert.deepEqual(calls.map(x=>x.id),['g','edge','inner']);
  assert.deepEqual(calls[1].pin.newParent,rect(0,0,200,150));
  assert.deepEqual(calls[2].pin.newParent,rect(0,0,170,120));
  assert.deepEqual(calls[1].delta,point(100,50));
  assert.deepEqual(calls[2].delta,point(100,50));
});
test('Panel pinned propagation uses absolute snapshots, all movement freedom, no Layer origin',()=>{
  const pinned=widget('pin','VectorShape',rect(20,30,25,20),{style:{pinHorizontal:1,pinVertical:2}});
  const panel=widget('panel','DynamicPanel',rect(50,70,100,100),{pinned:[pinned]});
  const c=controller([panel],1);
  context.results={panel:rect(60,80,150,120),pin:rect(20,30,25,20)};
  runNode(c,c.nodes[0],{dx:50,dy:20});
  assert.deepEqual(context.commits.map(x=>x.id),['panel','pin']);
  const child=context.calls.find(x=>x.method==='INw2'&&x.id==='pin');
  assert.equal(child.freedom,3);
  assert.deepEqual(child.oldRect,rect(20,30,25,20));
  assert.deepEqual(child.parentRect,rect(0,0,100,100));
  assert.deepEqual(child.pin.newParent,rect(0,0,150,120));
  assert.deepEqual(context.commits[1].rect,rect(20,30,25,20));
});
test('Nested resize restores temporary scaling flag for the next sibling',()=>{
  const edge=widget('edge','VectorShape',rect(0,0,100,20),{style:{fixedWidth:true,fixedHeight:true}});
  const inner=widget('inner','VectorShape',rect(20,40,20,20));
  const g=group('g',rect(0,0,100,100),[edge,inner]),c=controller([g]);
  context.results={g:rect(0,0,200,150),edge:rect(0,0,100,20),inner:rect(40,60,40,30)};
  context.union=rect(0,0,200,150);
  runNode(c,c.nodes[0],{dx:100,dy:50});
  assert.equal(c[67119111],true);
  const innerCall=context.calls.find(x=>x.method==='INw2'&&x.id==='inner');
  assert.equal(innerCall.scaling,true);
});

const report={
  schemaVersion:1,originalDllExecuted:false,originalGuiCompared:false,
  description:'Bounded interpretation of retained CIL with source-bound collection/value stubs and injected geometry sinks',
  sinks:['INw2 returns per-widget supplied rectangles; no numeric resize formula tested','ubNp/mNwa return supplied rectangles','Panel get_AllPinnedObjects supplied list; its source filter is documented separately','VbN8 and YJ0S ordinary branch instructions are interpreted; final Size/Location setters are captured, notifications/history are not executed','TrapScaling cleanup modeled from its retained closure; enumerator Dispose is inert','SizingRect/rotated AABB/UnroundedRect/effective pin style/capabilities are explicit inputs; rectangle numeric solver is not run'],
  summary:{total:resultCases.length,passed:resultCases.filter(r=>r.passed).length,failed:0},
  sources:[...inputFiles,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'].map(file=>({file,sha256:sha(file)})),
  results:resultCases,
};
fs.writeFileSync('research/layer-resize-controller-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
