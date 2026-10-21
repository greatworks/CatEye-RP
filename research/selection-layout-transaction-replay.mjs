// Complete OI8Z control flow over retained CIL. No target assembly executes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const controllerFile='research/layer-resize-controller-probe.mjs';
const controller=fs.readFileSync(controllerFile,'utf8');
const marker='for(let mask=0;mask<16;mask++)';
assert(controller.includes(marker));
let prefix=controller.slice(0,controller.indexOf(marker))
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("else if(v===67134719) stack.push(point(0,0));",
  "else if(v===67134719) stack.push(point(0,0)); else if(v===167773079)stack.push({eventArgs:true}); else if(v===67134735)stack.push(rect(NaN,NaN,NaN,NaN));")
 .replace("else if(op==='ldnull') stack.push(null);",
  "else if(op==='ldftn') stack.push(v); else if(op==='ldnull') stack.push(null);")
 .replace("const m=methods.get(token); assert(m,'Missing CIL '+token);",
  "const m=methods.get(token); assert(m,'Missing CIL '+token); if(context){context.methods??={};context.methods[token]=(context.methods[token]??0)+1;}")
 .replace("['beq','bne.un','blt','bgt','ble','bge']", "['beq','bne.un','blt','bgt','ble','bge','ble.un','bge.un']")
 .replace("ble:a<=b,bge:a>=b", "ble:a<=b,bge:a>=b,'ble.un':Number.isNaN(a)||Number.isNaN(b)||a<=b,'bge.un':Number.isNaN(a)||Number.isNaN(b)||a>=b");
const oldSource=fs.readFileSync('research/selection-author-resize-probe.mjs','utf8');
const start=oldSource.indexOf('const adapter = `\n'),end=oldSource.indexOf('\n`;',start);
assert(start>=0&&end>start);
const oldAdapter=oldSource.slice(start+'const adapter = `\n'.length,end);
const extension=`
const transactionFiles=['research/selection-author-resize-invalidation-cil.json',
 'research/selection-layout-transaction-dependencies-cil.json','research/selection-layout-transaction-scopes-cil.json',
 'research/selection-layout-transaction-guard-cil.json','research/selection-layout-transaction-sentinel-cil.json',
 'research/selection-layout-transaction-panel-setters-cil.json','research/text-autofit-style-point-cil.json',
 'research/font-size-runtime-round-cil.json','research/font-size-runtime-panel-rect-setter-cil.json',
 'research/font-size-runtime-textpanel-cil.json',
 'research/font-size-runtime-richpanel-layout-cil.json','research/font-size-runtime-graphics-layout-cil.json',
 'research/font-size-runtime-size-normalization-cil.json',
 'research/selection-layout-transaction-rect-values-cil.json',
 'research/adaptive-all-views-size-cil.json','research/adaptive-all-views-position-cil.json'];
for(const file of transactionFiles)for(const type of read(file).Types)for(const m of type.Methods)methods.set(m.Token,{...m,file});
const event=(name,data={})=>context.events.push({name,...data});
const geometry=v=>{v=deref(v);return {x:v.x,y:v.y,width:v.width,height:v.height};};
for(const [id,n] of [[100702374,2],[100702375,1],[100702409,2],[100688773,1],[100688769,1],
 [100722087,1],[100688826,1],[100702372,2],[100702369,2],[100702342,1],[100702366,1],
 [100702385,1],[100702383,3],[100702027,1],[100722069,1]])cil(id,n);
bind(100695610,1,()=>null); // ordinary no general transform scope
bind(100695494,1,([w])=>context.input.suppressStyleLayout?1:0);
bind(167774392,1,([p])=>p);
bind(100689223,1,([a])=>a.length);
bind(721423424,1,([a])=>a[0]);
bind(100701893,1,()=>{event('panel.cache-clear');return VOID;});
bind(100695251,3,()=>{event('style.changed.base');return VOID;});
bind(167789576,2,([keys,key])=>keys.includes(key)?1:0);
bind(100695375,1,([w])=>w.rect.width);
bind(100695374,1,([w])=>w.rect.height);
bind(167784878,1,([v])=>Number.isNaN(v));
bind(167778491,1,([v])=>Math.floor(v));
bind(167773396,2,([target,method])=>({target,method}));
bind(100689051,2,([target,method])=>({target,method}));
bind(167786506,2,([fn,v])=>{event('guard',{value:!!v});return execute(fn.method,[fn.target,v]);});
bind(100689052,1,([fn])=>execute(fn.method,[fn.target]));
bind(100688772,0,()=>({}));
bind(100688765,2,args=>{const o={};execute(100688765,[o,...args]);return o;});
bind(100688766,2,(args,frame)=>{
 const scope=execute(100688766,args);
 if(scope)frame.cleanups.push(()=>{event('finally.dispose');execute(100688769,[scope]);});
 return scope;
});
bind(100702326,2,args=>{event('OI8Z.enter',{force:!!args[1],alreadyGuarded:!!args[0][67126836]});return execute(100702374,args);});
bind(100695370,1,([w])=>w.rect);
bind(100695488,1,([w])=>w);
bind(100707903,1,([w])=>w);
bind(100707785,1,([w])=>w.textAlign);
bind(100702376,1,([w])=>w.rect.width); // no rotation or text rotation; DIyx/jNZf branch
bind(100722091,3,([x,y,s])=>rect(x,y,s.width,s.height));
const roundEven=v=>{const lo=Math.floor(v),f=v-lo;return f===.5?(lo%2===0?lo:lo+1):Math.round(v);};
cil(100721957,3);cil(100688822,3);cil(100702293,2);
const roundToken=methods.get(100688822).Instructions.find(i=>i.Resolved==='System.Math::Round').Operand;
bind(roundToken,3,([v,digits,mode])=>{
 if(digits!==0||![0,1].includes(mode))throw Error('Only source zero-digit ToEven/AwayFromZero rounds are admitted');
 return mode===0?roundEven(v):Math.sign(v)*Math.floor(Math.abs(v)+.5);
});
bind(100702294,1,([p])=>p.rect);
bind(100722083,2,([r,p])=>rect(p.x,p.y,deref(r).width,deref(r).height));
bind(100702295,2,([p,r])=>{p.rect=copy(r);event('panel.rect',{rect:geometry(r)});return VOID;});
bind(100701900,2,([p,deep])=>{event('panel.invalidate',{deep:!!deep});return VOID;});
bind(100701897,2,args=>execute(100701897,args));
bind(100702377,1,args=>{event('WIyL');return execute(100702035,args);});
bind(100720541,2,([s,g])=>{
 const v=context.input.convertedIndicatorInset??{width:2,height:2};
 event('graphics.convert-size',{sourceSpace:2,targetSpace:0,input:{width:s.width,height:s.height},answer:v});
 return size(v.width,v.height);
});
bind(100695373,1,([w])=>w.rect.y);bind(100695372,1,([w])=>w.rect.x);
bind(100695389,1,([w])=>point(w.rect.x,w.rect.y)); // same page/diagram origin in probe
bind(100695369,1,([w])=>w.rect);
bind(100722102,2,([r,p])=>rect(r.x+p.x,r.y+p.y,r.width,r.height));
bind(100702038,1,([w])=>{
 const v=context.input.indicator??execute(100702036,[w,{graphics:true},0]);
 event('indicator.rect',{rect:geometry(v)});return rect(v.x,v.y,v.width,v.height);
});
for(const [id,n] of [[100715355,2],[100715353,3],[100722983,3]])cil(id,n);
bind(100702287,1,([p])=>p.owner);
bind(100702315,1,([p])=>context.input.editingText?1:0);
bind(100701885,1,([p])=>p.owner.empty);
bind(100701875,1,([p])=>p);
bind(100702303,1,([p])=>p);
bind(100712280,1,()=>context.input.editorHeight??19.25);
bind(167773568,2,([w,h])=>size(w,h));
bind(100722967,1,([s])=>s);
bind(100722084,2,([r,s])=>rect(deref(r).x,deref(r).y,s.width,s.height));
bind(100722992,2,([a,b])=>Math.abs(a.width-b.width)>=1e-5||Math.abs(a.height-b.height)>=1e-5);
bind(100715354,3,([p,width,flag])=>{
 const i=context.input,index=context.measures-1;
 event('graphics.measure',{index,width,flag:!!flag});
 const answer=i.measurements?.[Math.min(index,i.measurements.length-1)]??{width:60,height:15};
 return {size:size(answer.width,answer.height)};
});
for(const m of [methods.get(100715353),methods.get(100715355)])
 for(const ins of m.Instructions)if(ins.Resolved==='.bHzv::zHzo')bind(ins.Operand,1,([r])=>r.size);
bind(100701896,2,([p,constraint])=>{
 const n=context.measures++,i=context.input;
 event('measure',{index:n,constraint:{width:constraint.width,height:constraint.height}});
 if(i.throwAtMeasure===n)throw Error('Injected graphics measurement error');
 if(i.reenterAtMeasure===n)execute(100702374,[context.owner,true]);
 // Interpret INOR itself. Only the downstream KIf5 font measurement answer is injected.
 execute(100701896,[p,constraint]);
 event('panel.measured',{width:p.rect.width,height:p.rect.height});return VOID;
});
bind(100695409,3,([w,a,b])=>{event('DJ0E',{a:!!a,b:!!b});return VOID;});
bind(100695399,1,()=>{event('NJ01');return VOID;});
bind(100695359,2,()=>{event('size.before');return VOID;});
bind(100695356,2,(args,frame)=>{
 if(frame.token===100702372&&frame.op==='call'){event('size.changed');return VOID;}
 return execute(100702372,args);
}); // callvirt dispatches override; its explicit base call is a notification sink.
bind(100695346,2,()=>{event('location.changed');return VOID;});
bind(167789632,1,([arg])=>({arg}));
bind(100695347,1,([w])=>point(w.rect.x,w.rect.y));
bind(100721976,2,([a,b])=>Math.abs(a.x-b.x)>=1e-5||Math.abs(a.y-b.y)>=1e-5);
bind(100695360,1,([w])=>size(w.rect.width,w.rect.height));
bind(100695364,2,args=>execute(100702369,args));
bind(100695441,1,()=>size(0,0)); // ordinary non-transform minimum boundary explicitly injected
bind(100722980,2,([a,b])=>size(Math.max(deref(a).width,b.width),Math.max(deref(a).height,b.height)));
bind(100695508,1,([w])=>w);
bind(167789631,1,([w])=>!!w.temporaryProvider);
bind(100695362,1,()=>true);bind(100695363,1,()=>true);
bind(100695366,4,([w,s,all,notify])=>{w.rect={...w.rect,width:s.width,height:s.height};
 event('style.Size',{width:s.width,height:s.height,allViews:!!all,notify:!!notify});return VOID;});
bind(100695350,5,([w,p,all,notify,extra])=>{w.rect={...w.rect,x:p.x,y:p.y};
 event('style.Location',{x:p.x,y:p.y,allViews:!!all,notify:!!notify,extra});return VOID;});
// pJ0V has four arguments including this; keep exact source signature.
bind(100695350,4,([w,p,all,notify])=>{w.rect={...w.rect,x:p.x,y:p.y};
 event('style.Location',{x:p.x,y:p.y,allViews:!!all,notify:!!notify});return VOID;});
bind(100695365,4,args=>{event('uJ0j.request',{width:args[1].width,height:args[1].height,guard:!!args[0][67126836]});
 return execute(100695365,args);});
bind(100695349,5,args=>execute(100695349,args));
bind(100695371,3,args=>{event('YJ0S.request',{rect:geometry(args[1]),allViews:!!args[2]});return execute(100695371,args);});
export function transaction(input) {
 context={events:[],calls:[],effects:[],commits:[],geometryWrites:[],keys:0,results:{},measures:0,input};
 const r=input.rect??{x:20,y:30,width:100,height:20},p=input.panel??{width:50,height:15};
 const w=widget('selection','SelectionButton',rect(r.x,r.y,r.width,r.height),{
  style:{buttonSize:input.buttonSize??13},padding:input.padding??[0,0,0,0],align:input.align??0,
  textAlign:input.textAlign??0,alignRight:!!input.alignRight,empty:!!input.empty,
  autoFitWidth:!!input.widthFit,autoFitHeight:!!input.heightFit,
  [67126826]:input.widthFit?1:0,[67126834]:input.heightFit?1:0,
  panel:{rect:rect(p.x??0,p.y??0,p.width,p.height)},[67126836]:input.guarded?1:0,
  [67126835]:input.cache?rect(input.cache.x,input.cache.y,input.cache.width,input.cache.height):rect(NaN,NaN,NaN,NaN)});
 context.owner=w;
 w.panel.owner=w;
 let error=null;
 try {
  if(input.entry==='size')execute(100695365,[w,size(input.request.width,input.request.height),false,true]);
  else if(input.entry==='widthFlag')execute(100702343,[w,input.value?1:0]);
  else if(input.entry==='heightFlag')execute(100702367,[w,input.value?1:0]);
  else if(input.entry==='styleChanged')execute(100702383,[w,input.keys??[],input.notify===false?0:1]);
  else if(input.entry==='selectionStyleChanged')execute(100702033,[w,input.keys??[],input.notify===false?0:1]);
  else execute(100702374,[w,!!input.force]);
 }catch(e){error=e.message;}
 return {rect:geometry(w.rect),panel:geometry(w.panel.rect),guard:!!w[67126836],cache:geometry(w[67126835]),
  widthFit:!!w[67126826],heightFit:!!w[67126834],
  measures:context.measures,events:context.events,methods:context.methods,error};
}
export function sentinelChecks() {
 const rows=[];
 for(let mask=0;mask<16;mask++){const a=[0,0,0,0].map((v,n)=>mask&(1<<n)?NaN:v);rows.push({mask,invalid:!!execute(100722087,[rect(...a)])});}
 return rows;
}
export const sourceInputs=[...inputFiles,...selectionFiles,...transactionFiles];
`;
const moduleCode=prefix+oldAdapter+extension;
export const api=await import('data:text/javascript;base64,'+Buffer.from(moduleCode).toString('base64'));
export const sourceFiles=[...new Set([controllerFile,'research/selection-author-resize-probe.mjs',
 'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',...api.sourceInputs,
 'research/selection-layout-transaction-replay.mjs'])];
if(process.argv[1]?.replaceAll('\\','/').endsWith('/selection-layout-transaction-replay.mjs')) {
 const cases=[];
 for(const force of [false,true])for(const widthFit of [false,true])for(const heightFit of [false,true])
  for(const cache of [undefined,{x:10,y:15,width:90,height:17}])for(const textAlign of [0,1,2])for(const align of [0,1,2]) {
   const input={force,widthFit,heightFit,cache,textAlign,align,measurements:[{width:70,height:28}]};
   const actual=api.transaction(input);assert.equal(actual.error,null,JSON.stringify(input)+actual.error);
   const reference=force?(cache??{x:20,y:30,width:100,height:20}):{x:20,y:30,width:100,height:20};
   const width=widthFit?83:reference.width,firstHeight=heightFit?28:reference.height;
   const adjust=(oldValue,newValue,alignment)=>alignment===1?Math.floor(oldValue/2)-Math.floor(newValue/2):alignment===2?oldValue-newValue:0;
   const expected={x:reference.x+(force?adjust(reference.width,width,textAlign):0),
    y:reference.y+(force?adjust(reference.height,firstHeight,align):0),width,height:28};
   assert.deepEqual(actual.rect,expected);
   assert.deepEqual(actual.panel,{x:13,y:0,width:widthFit?70:width-13,height:28});
   assert.equal(actual.measures,force&&(widthFit||heightFit)?2:1);
   assert.equal(actual.guard,false);
   assert.equal(actual.events.at(-2).name,'finally.dispose');
   assert.deepEqual(actual.events.at(-1),{name:'guard',value:false});
   cases.push({name:'Full fit/cache/alignment matrix',input,expected,actual,passed:true});
  }
 for(const input of [{guarded:true,force:true},{force:true,reenterAtMeasure:0,widthFit:true},
  {force:true,throwAtMeasure:0},{force:false,throwAtMeasure:0},{entry:'size',request:{width:150,height:20},widthFit:false},
  {entry:'size',request:{width:150,height:20},widthFit:true}]) {
  const actual=api.transaction(input);
  if(input.throwAtMeasure!==undefined)assert.equal(actual.error,'Injected graphics measurement error');
  else assert.equal(actual.error,null);
  assert.equal(actual.guard,!!input.guarded);cases.push({input,actual,passed:true});
 }
 const add=(name,input,check)=>{
  const actual=api.transaction(input);check(actual);cases.push({name,input,actual,passed:true});
 };
 add('Two measurements can change size twice; alignment is not repeated', {
  force:true,widthFit:true,heightFit:true,textAlign:1,align:1,
  measurements:[{width:70,height:28},{width:90,height:40}]},a=>{
  assert.equal(a.error,null);assert.deepEqual(a.rect,{x:29,y:26,width:103,height:40});
  assert.deepEqual(a.events.filter(e=>e.name==='style.Size').map(e=>[e.width,e.height]),[[83,28],[103,40]]);
  assert.deepEqual(a.events.filter(e=>e.name==='style.Location').map(e=>[e.x,e.y]),[[29,26]]);
  const names=a.events.map(e=>e.name);assert(names.indexOf('size.changed')<names.indexOf('location.changed'));
  assert(names.indexOf('location.changed')<names.indexOf('WIyL'));
 });
 add('Second measurement exception cleans guard but retains prior mutation', {
  force:true,widthFit:true,throwAtMeasure:1,measurements:[{width:70,height:28}]},a=>{
  assert.equal(a.error,'Injected graphics measurement error');
  assert.deepEqual(a.rect,{x:20,y:30,width:83,height:20});
  assert.equal(a.guard,false);assert(!a.events.some(e=>e.name==='WIyL'));
 });
 add('External Size entry applies KNZn before the size notification', {
  entry:'size',request:{width:150,height:20},widthFit:true,textAlign:1,measurements:[{width:70,height:28}]},a=>{
  assert.equal(a.error,null);assert.deepEqual(a.rect,{x:10,y:30,width:83,height:28});
  assert.deepEqual(a.events.filter(e=>e.name==='style.Size').map(e=>[e.width,e.height]),[[63,20],[83,20],[83,28]]);
 });
 for(const align of [0,1,2])for(const alignRight of [false,true]) {
  add('Short text uses rounded local panel position and an independent height fit validator',{
   force:true,widthFit:true,heightFit:true,align,alignRight,padding:[2,4,6,8],measurements:[{width:5,height:4}]},a=>{
   assert.equal(a.error,null);assert.equal(a.rect.width,30);assert.equal(a.rect.height,12);
   assert.equal(a.panel.x,alignRight?8:21);assert.equal(a.panel.y,[2,2,3][align]);
  });
 }
 for(const [height,y] of [[8,2],[6,4]])add('LNOE midpoint rounding is ToEven',{
  force:false,align:1,measurements:[{width:30,height}],buttonSize:13},a=>{
  assert.equal(a.error,null);assert.equal(a.panel.y,y);
 });
 for(const empty of [false,true])add('INOR non-editing height comes from graphics or explicit empty-text 16',{
  force:false,empty,measurements:[{width:32.25,height:18.5}]},a=>{
  assert.equal(a.error,null);assert.equal(a.panel.height,empty?16:19);
  assert.equal(a.events.filter(e=>e.name==='graphics.measure').length,empty?0:1);
 });
 add('Editing RTF height is a separate explicit sink', {
  force:false,editingText:true,editorHeight:19.5},a=>{
  assert.equal(a.error,null);assert.equal(a.panel.height,20);
  assert.equal(a.events.filter(e=>e.name==='graphics.measure').length,0);
 });
 for(const entry of ['widthFlag','heightFlag'])for(const before of [false,true])for(const value of [false,true]) {
  const input={entry,widthFit:entry==='widthFlag'?before:false,heightFit:entry==='heightFlag'?before:false,value};
  add('Fit setters invalidate only when the raw shared flag changes',input,a=>{
   assert.equal(a.error,null);assert.equal(a[entry==='widthFlag'?'widthFit':'heightFit'],value);
   assert.equal(a.measures>0,before!==value);
   if(before!==value)assert(a.events.some(e=>e.name==='OI8Z.enter'&&e.force));
  });
 }
 for(const input of [
  {keys:[2]},{keys:[101]},{keys:[101,2]},{keys:[]},
  {keys:[2],notify:false},{keys:[2],guarded:true},{keys:[2],suppressStyleLayout:true},
 ])add('Style notification gates and singleton P101 exception', {entry:'styleChanged',...input},a=>{
  assert.equal(a.error,null);
  const shouldLayout=input.notify!==false&&!input.guarded&&!input.suppressStyleLayout&&!(input.keys.length===1&&input.keys[0]===101);
  assert.equal(a.measures>0,shouldLayout);
  assert.equal(a.events.some(e=>e.name==='panel.cache-clear'),shouldLayout);
  assert.equal(a.events.at(-1).name,'style.changed.base');
 });
 for(const empty of [false,true])add('Selection P94 preflight precedes the base style notification',{
  entry:'selectionStyleChanged',keys:[94],buttonSize:150,empty},a=>{
  assert.equal(a.error,null);assert.equal(a.rect.width,empty?100:200);assert.equal(a.rect.height,150);
  const names=a.events.map(e=>e.name);
  if(!empty)assert(names.indexOf('uJ0j.request')<names.indexOf('panel.cache-clear'));
  else assert.equal(names[0],'panel.cache-clear');
 });
 for(const change of [1e-6,1e-4])add('External Size near-equality controls whether layout is notified',{
  entry:'size',request:{width:100+change,height:20}},a=>{
  assert.equal(a.error,null);assert.equal(a.measures>0,change===1e-4);
  assert.equal(a.events.some(e=>e.name==='size.changed'),change===1e-4);
 });
 const sentinel=api.sentinelChecks();assert(sentinel.every(r=>r.invalid===(r.mask===15)));
 const result={method:'Bounded CIL-record interpretation, not target execution. KIf5 measurement, RTF editor height, indicator rectangle, effective provider and notification sinks are explicit.',
  originalGuiCompared:false,sources:sourceFiles.map(file=>({file,sha256:sha(file)})),
  scope:{owner:'ordinary SelectionButton; no general transform, owner/text rotation, active text editor except named sink case',
   indicator:'Source XNUc retained; N5pp source-space2 toWorld0 size conversion injected (default synthetic identity2x2); page/diagram origins equal',
   geometry:'Source YJ0S/uJ0j/xJ0B validation/order; minimum size and final effective provider writes injected',
   notifications:'Order recorded; external subscribers, ancestor refit and inline-link synchronization not executed',
   measurement:'Source INOR/GtCX/dtCa/rounding retained; KIf5 returned size is synthetic, not a font or GUI measurement',
   exceptionFinally:'CIL EH metadata checked; exact guard callback registered with interpreter cleanup, no general CLR EH emulation'},
  summary:{total:cases.length+sentinel.length,passed:cases.length+sentinel.length,failed:0},sentinel,cases};
 fs.writeFileSync('research/selection-layout-transaction-probes.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result.summary));
}
