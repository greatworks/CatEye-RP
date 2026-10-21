// Bounded retained-CIL interpretation, plus exact shipped-JS slices.
// Does not load or execute the target assembly, or modify old evidence.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const read = p => JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
process.on('uncaughtException',error=>{
 const message=String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-CIL-adapter>');
 let n=1;while(fs.existsSync(`research/selection-layout-render-harness-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-layout-render-harness-failure-${n}.json`,JSON.stringify({message,probeSha256:sha('research/selection-layout-render-probe.mjs')},null,2)+'\n');
 console.error(message);process.exitCode=1;
});
const adapterFile='research/layer-resize-controller-probe.mjs';
const old=fs.readFileSync(adapterFile,'utf8');
const boundary='for(let mask=0;mask<16;mask++)';
assert(old.includes(boundary));
const prefix=old.slice(0,old.indexOf(boundary))
  .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
  .replace("else if(op==='isinst')", "else if(op==='bge.un'){const b=deref(stack.pop()),a=deref(stack.pop());if(a>=b||Number.isNaN(a)||Number.isNaN(b))jump(v);}\nelse if(op==='isinst')");
const extra=String.raw`
const extraFiles=['research/selection-author-resize-class-cil.json','research/selection-layout-render-dependencies-cil.json'];
for(const file of extraFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [id,count]of [[100702036,3],[100702037,1],[100695372,1],[100695373,1]])cil(id,count);
bind(100702026,1,([w])=>w.buttonSize);
bind(100702027,1,([w])=>size(w.buttonSize,w.buttonSize));
bind(100702327,1,([w])=>w.panel);
bind(100702302,1,([p])=>p.rect.height);
bind(100702294,1,([p])=>p.rect);
bind(100695348,1,([w])=>point(w.rect.x,w.rect.y));
bind(100695389,1,([w])=>w.diagramLocation);
bind(100695586,1,([w])=>w.align);
bind(100702331,1,([w])=>w.empty);
bind(100702031,1,([w])=>w.alignRight);
bind(100720541,2,([s,g])=>size(s.width*g.unitX,s.height*g.unitY));
bind(100722102,2,([r,p])=>rect(r.x+p.x,r.y+p.y,r.width,r.height));
bind(100722049,1,([r])=>deref(r).y);
bind(100722069,1,([r])=>deref(r).y+deref(r).height/2);
bind(100722058,1,([r])=>deref(r).y+deref(r).height);
bind(100722057,1,([r])=>deref(r).x+deref(r).width);
bind(100722051,1,([r])=>deref(r).width);
bind(100722053,1,([r])=>deref(r).height);
bind(100722954,1,([s])=>deref(s).height);
bind(100722966,2,([w,h])=>size(w,h));
bind(100722091,3,([x,y,s])=>rect(x,y,s.width,s.height));
export function indicator(input,local=false){
 const w={kind:'SelectionButton',rect:rect(...input.owner),panel:{rect:rect(...input.panel)},
 diagramLocation:point(...input.diagramLocation),buttonSize:input.buttonSize,
 align:input.align,alignRight:input.alignRight,empty:input.empty};
 const actual=execute(local?100702037:100702036,local?[w]:[w,{unitX:input.unitX,unitY:input.unitY},input.noInset]);
 const {__struct,...result}=actual;return result;
}
export const sources=[...inputFiles,...extraFiles];
`;
const api=await import('data:text/javascript;base64,'+Buffer.from(prefix+extra).toString('base64'));
const results=[];
function test(name,input,actual,expected,kind) {
 assert.deepEqual(actual,expected,name);
 results.push({name,kind,input,actual,expected,passed:true});
}
for(const h of [0,5,13,30])for(const align of [0,1,2])for(const alignRight of [false,true])for(const empty of [false,true]){
 const i={owner:[100,200,120,50],panel:[5,3,80,h],diagramLocation:[310,420],buttonSize:13,align,alignRight,empty,unitX:.5,unitY:.75,noInset:false};
 const short=empty||h<13;
 test(`CNUW local h${h} a${align} right${alignRight} empty${empty}`,i,api.indicator(i,true),
  {x:alignRight?107:0,y:short?0:[0,(h-13)/2,h-13][align],width:13,height:13},'retained-CIL');
 test(`XNUc graphics h${h} a${align} right${alignRight} empty${empty}`,i,api.indicator(i),
  {x:alignRight?207:100,y:short?200:[424.5,423+h/2-6.5,423+h-1.5-13][align],width:13,height:13},'retained-CIL');
}
for(const noInset of [false,true])for(const unitY of [.5,1,2])for(const align of [0,1,2]){
 const i={owner:[0,0,100,40],panel:[0,0,80,40],diagramLocation:[0,0],buttonSize:13,align,alignRight:false,empty:false,unitX:1,unitY,noInset};
 const gap=noInset?0:2*unitY;
 test(`XNUc inset ${noInset} unitY ${unitY} align${align}`,i,api.indicator(i),
 {x:0,y:[gap,13.5,27-gap][align],width:13,height:13},'retained-CIL');
}
// Original HJCk collection construction is a straight sequence after IL0x3b.
const keysMethod=read('research/selection-layout-render-json-keys-cil.json').Types.flatMap(t=>t.Methods)[0];
const list=[],stack=[];
for(const i of keysMethod.Instructions.filter(i=>i.Offset>=0x3b&&i.Offset<=0x19e)){
 if(i.Op==='newobj')stack.push(list);
 else if(i.Op==='dup')stack.push(stack.at(-1));
 else if(i.Op.startsWith('ldc.i4'))stack.push(i.Op==='ldc.i4'||i.Op==='ldc.i4.s'?i.Operand:Number(i.Op.slice(7)));
 else if(i.Op==='callvirt'){assert.equal(i.Operand,167789329);const v=stack.pop();stack.pop().push(v);}
 else if(i.Op==='stsfld'){assert.equal(i.Operand,67123356);assert.equal(stack.pop(),list);}
 else throw Error('Unreplayed key instruction '+JSON.stringify(i));
}
test('HJCk ordinary/adaptive/recursive state/action property subset includes94',null,list.includes(94),true,'retained-CIL-collection');
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/';
const queryFile=root+'axQuery.std.js',exprFile=root+'expr.js';
const query=fs.readFileSync(queryFile,'utf8'),expr=fs.readFileSync(exprFile,'utf8');
function between(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);assert(a>=0&&b>a,start);return s.slice(a,b);}
const resizable=between(query,'    var RESIZABLE_TYPES =','    $ax.public.fn.IsSelectionButton');
// The exact consumer is retained through its closing registration, not reimplemented.
const resize=between(query,'    $ax.public.fn.resize =','    $ax.public.fn.');
const isResizable=between(query,'    $ax.public.fn.IsResizable =','    var RESIZABLE_TYPES');
const autofit=between(expr,'    var autofitWidget =','    _exprFunctions.GetCheckState');
function runRuntime(type,align='left',vertical='top',fitW=true,fitH=true,measuredW=240,measuredH=30){
 const calls=[], owner={width:100,height:20},style={paddingLeft:5,paddingRight:7,paddingTop:2,paddingBottom:3,horizontalAlignment:align,verticalAlignment:vertical};
 const text={height:()=>measuredH};
 const paragraph={children:()=>[{spanWidth:measuredW}]};
 const jobj={children:()=>text,find:()=>[paragraph]};
 const $=v=>typeof v==='object'&&'spanWidth'in v?{width:()=>v.spanWidth}:typeof v==='object'?v:jobj;
 $.inArray=(v,a)=>a.indexOf(v);$.extend=Object.assign;
 const $ax=()=>q;Object.assign($ax,{public:{fn:{}},visibility:{},event:{},dynamicPanelManager:{},style:{},adaptive:{},constants:{},deepCopy:v=>structuredClone(v)});
 for(const k of ['BUTTON','DYNAMIC_PANEL','IMAGE_BOX','IMAGE_MAP_REGION','INLINE_FRAME','LAYER','LIST_BOX','COMBO_BOX','VECTOR_SHAPE','TEXT_AREA','TEXT_BOX','SNAPSHOT'])$ax.constants[k+'_TYPE']=k;
 $ax.getTypeFromElementId=()=>type;
 $ax.getObjectFromElementId=()=>({type,autoFitWidth:fitW,autoFitHeight:fitH});
 $ax.GetTextPanelId=()=> 'u_text';
 $ax.style.computeFullStyle=()=>style;
 $ax.style.generateState=()=> 'normal';
 $ax.visibility.GetWidgetVisible=()=>true;
 $ax.visibility.setResizingRect=(...args)=>calls.push(['setResizingRect',...args]);
 $ax.visibility.GetWidgetOpacity=()=>1;
 $ax.event.raiseSyntheticEvent=(...args)=>calls.push(['synthetic',...args]);
 $ax.move={MoveWidget:(...args)=>calls.push(['MoveWidget',...args]),releaseResize:()=>calls.push(['releaseResize']),releaseMove:()=>calls.push(['releaseMove'])};
 const q={getElementIds:()=>['u'],getElementId:()=> 'u',size:()=>({...owner}),offsetBoundingRect:()=>({left:0,top:0,width:100,height:20})};
 const c={console,$,$ax,query:q,calls,owner,$obj:$ax.getObjectFromElementId,
 _displayWidgetIfNeeded:()=>({jObject:jobj,trap:()=>calls.push(['Restore'])}),
 _setAutoFitId:(...args)=>calls.push(['registered',...args]),
 _autoFitIds:{},_autoFitLimits:{},_getObjVisible:()=>true};
 vm.createContext(c);
 vm.runInContext(resizable+isResizable+resize,c);
 q.resize=(...args)=>$ax.public.fn.resize.apply(q,args);
 c.$axure=id=>q;
 vm.runInContext(autofit+'\nthis.runAutofit=autofitWidget;',c);
 c.runAutofit('u');
 return {owner,calls};
}
// Runtime facade details are recorded in output. These are not DOM font measurements.
const runtimeCases=[];
try {
 for(const type of ['checkbox','radioButton'])for(const align of ['left','center','right'])for(const vertical of ['top','middle','bottom']){
  const actual=runRuntime(type,align,vertical);
  assert.deepEqual(actual.owner,{width:100,height:20});
  assert.deepEqual(JSON.parse(JSON.stringify(actual.calls.at(-1))),['registered','u',{width:252,height:35}]);
  const move=actual.calls.find(c=>c[0]==='MoveWidget');
  const dx={left:0,center:-76,right:-152}[align],dy={top:0,middle:-7.5,bottom:-15}[vertical];
  if(dx||dy)assert.deepEqual(move.slice(1,4),['u',dx,dy]);else assert.equal(move,undefined);
  runtimeCases.push({name:`autofit ${type} ${align}/${vertical}`,actual,passed:true});
 }
}catch(error){
 fs.writeFileSync('research/selection-layout-render-runtime-first-failure.json',JSON.stringify({message:error.stack,sources:[queryFile,exprFile].map(path=>({path,sha256:sha(path)}))},null,2)+'\n');
 throw error;
}
results.push(...runtimeCases);
const sources=[...new Set([...api.sources,adapterFile,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',
 'research/selection-layout-render-json-keys-cil.json',queryFile,exprFile,'research/selection-layout-render-probe.mjs'])].map(path=>({path,sha256:sha(path)}));
fs.writeFileSync('research/selection-layout-render-probes.json',JSON.stringify({
 method:'Retained CIL-record interpretation + exact original JavaScript slices in NodeVM; no vendor DLL or original GUI executed.',
 sources,summary:{total:results.length,passed:results.length,failed:0},propertySubset:list,
 sinks:['XNUc current style/button size, text-panel measurement and coordinate-provider are supplied.',
 'N5pp graphics conversion represented by explicit unitX/unitY, not a claim that generated HTML uses those factors.',
 'CIL arithmetic uses JavaScript double and explicit Rect/Point/Size facades.',
 'Runtime jQuery paragraph widths/text-layer height and visibility are explicit facades; no font/browser layout measured.'],
 results},null,2)+'\n');
console.log(JSON.stringify({total:results.length,passed:results.length}));
