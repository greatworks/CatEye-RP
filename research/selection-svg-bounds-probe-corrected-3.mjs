process.on('uncaughtException',error=>{console.error(String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<bounded-CIL-adapter>'));process.exitCode=1;});
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const moduleFrom=code=>import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const absoluteImports=code=>code.replaceAll("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href)).replaceAll("'./text-autofit-native-literals.mjs'",JSON.stringify(pathToFileURL('research/text-autofit-native-literals.mjs').href));
// Reuse only the inert engine setup; no existing probe's output statements run.
const padSetup=fs.readFileSync('research/selection-layout-border-probe.mjs','utf8').split("process.on('uncaughtException'")[0];
let padCode=(await moduleFrom(padSetup+'\nexport const engineCode=code;')).engineCode
 .replace("const loadArg=i=>copy(args[i])","const loadArg=i=>args[i]?.__ref?args[i]:copy(args[i])")
 .replace("else if(op==='isinst')","else if(op==='ldobj'){stack.push(copy(deref(stack.pop())));}\nelse if(op==='stobj'){const v=stack.pop(),r=stack.pop();set(r,v);}\nelse if(op==='isinst')");
padCode+=String.raw`
const boundsExtra=['research/selection-layout-indicator-html-geometry-cil.json','research/selection-svg-bounds-origin-cil.json'];
for(const file of boundsExtra)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
cil(100699651,2);
bind(100702038,1,([w])=>w.indicatorRect);
bind(100722103,2,([r,p])=>rect(r.x-p.x,r.y-p.y,r.width,r.height));
bind(100695613,1,()=>({scope:'disable-transform'}));
bind(100695308,1,([w])=>w.selected);
bind(100695309,2,([w,v])=>{w.selected=!!v;return VOID;});
bind(167775900,2,([v,flag])=>(v&flag)===flag);
bind(100699685,5,([w,ctx,id,state,r])=>{context.calls.push({sink:'rNP4',id,state,rect:r});return 'source.svg';});
export function projection(input){
 context={calls:[]};const w={kind:'SelectionButton',x:100,y:70,width:100,height:30,boxModel:0,shadow:null,selected:false,...input};
 const out={value:null};const asset=execute(100699650,[w,{},'u_img',0,addr(out,'value')]);
 return {asset,cssRect:out.value,padding:execute(100695435,[w,true,false]),calls:context.calls};
}
export const boundsSources=[...sourceFiles,...boundsExtra];
`;
const pad=await moduleFrom(padCode);
let domCode=absoluteImports(fs.readFileSync('research/text-autofit-dom-replay.mjs','utf8').split('const results=[];')[0]);
domCode=domCode
 .replace("const methods=new Map(sources", "sources.push('research/selection-layout-indicator-html-geometry-cil.json','research/line-style-svg-writer-cil.json');\nconst methods=new Map(sources")
 .replace("if(op==='beq')", "if(op==='ble'||op==='bgt'||op==='bge.un'){const b=pop(),a=pop();if(op==='ble'?a<=b:op==='bgt'?a>b:a>=b||Number.isNaN(a)||Number.isNaN(b))jump();continue}\n  if(op==='beq')")
 .replace("const c=i.Resolved;out.calls",String.raw`const c=i.Resolved;
   if(c==='System.String::IndexOf'){const start=n===167778682?pop():0,needle=pop(),str=pop();s.push(str.indexOf(needle,start));continue}
   if(c==='System.String::Substring'){const count=pop(),start=pop();s.push(pop().slice(start,start+count));continue}
   if(c==='System.String::Replace'){const to=pop(),from=pop();s.push(pop().replaceAll(from,to));continue}
   if(c==='System.String::Concat'&&n!==167772192){const count=n===167772398?3:n===167774567?4:0;assert.ok(count,'Unmodelled concat '+n);s.push(s.splice(s.length-count,count).join(''));continue}
   if(c==='UNxR.xNxg::wNxY'){const asset=pop(),ctx=pop();s.push({asset,text:ctx.assetSource});continue}
   if(c==='System.IO.File::Exists'){s.push(!!pop().text);continue}
   if(c==='System.IO.File::OpenText'){s.push(pop());continue}
   if(c==='System.IO.TextReader::ReadToEnd'){s.push(pop().text);continue}
   if(c==='oNCN.BNCJ::NNCs'){s.push(pop());continue}
   if(c==='System.Text.StringBuilder::Append'){const text=pop(),writer=pop();out.events.push({kind:'raw',text});s.push(writer);continue}
   if(c==='HHbr.dHbV::KHbM'){const value=pop(),key=pop(),target=pop();target[key]=value;out.events.push({kind:'root-attribute',key,value});continue}
   if(c==='cbDk.ebDE::kbLB'){s.push(String(pop()));continue}
   if(c==='h5uH.j5u5::get_Location'){const r=deref(pop());s.push({x:r.x,y:r.y});continue}
   if(c==='m5wr.f5wV::R5w7'){const p=deref(pop());s.push(p.x+' '+p.y+' ');continue}
   if(c==='m5wr.f5wV::s5wU'){s.push(deref(pop()).x);continue}
   if(c==='m5wr.f5wV::I5wY'){s.push(deref(pop()).y);continue}
   if(c==='jbe2.Wbe7::Ubem'){const y=pop(),x=pop();s.push({a:1,b:0,c:0,d:1,e:x,f:y});continue}
   if(c==='jbe2.Wbe7::op_Multiply'){const b=pop(),a=pop();assert.deepEqual(b,{a:1,b:0,c:0,d:1,e:0,f:0});s.push(a);continue}
   out.calls`);
domCode+='\nexport {run};export const sourceFiles=sources;';
const dom=await moduleFrom(domCode);
const cssSetup=fs.readFileSync('research/selection-layout-indicator-css-probe.mjs','utf8').split("process.on('uncaughtException'")[0];
const cssCode=(await moduleFrom(cssSetup+'\nexport const engineCode=code;')).engineCode;
const css=await moduleFrom(cssCode);
const results=[];
for(const b of [14,18])for(const strokeWidth of [0,1,3])for(const alignRight of [false,true]){
 // Only the previously closed XNUc top-align 1:1 unrotated placement is supplied.
 const indicatorRect={x:alignRight?200-b:100,y:72,width:b,height:b};
 const input={b,strokeWidth,alignRight,indicatorRect};
 const actual=pad.projection(input),p=strokeWidth>1?strokeWidth/2:0,extra=strokeWidth>1?strokeWidth+1:1;
 const expected={x:(alignRight?100-b:0)-p,y:2-p,width:b+extra,height:b+extra};
 for(const key of Object.keys(expected))assert.equal(actual.cssRect[key],expected[key]);
 const cssOutput=css.replay('SNLp',[{TNKT:{}},'u_img',actual.cssRect,0,1,null,null,null,false,0,false,false,false]);
 const style=cssOutput.rules[0].style;
 for(const[key,n]of [['left',expected.x],['top',expected.y],['width',expected.width],['height',expected.height]])assert.equal(style[key],n+'px');
 const root={};const rootReplay=dom.run('SHbE',[{JHJS:actual.cssRect,VHJI:1},root]);
 assert.deepEqual(root,{width:(b+extra)+'px',height:(b+extra)+'px'});
 const source='<svg version="1.1" width="'+root.width+'" height="'+root.height+'"><g data-test-body="unchanged"><path d="M 0 0 L 1 1"/></g></svg>';
 const inline=dom.run('uNCx',[{}, {assetSource:source},'u_img','source.svg','', 'img']).out;
 const open=inline.events.find(e=>e.kind==='open');assert.deepEqual(open,{kind:'open',tag:'svg',attributes:{data:'source.svg',id:'u_img',class:'img'}});
 assert.equal(inline.events.find(e=>e.kind==='raw').text,'<g data-test-body="unchanged"><path d="M 0 0 L 1 1"/></g>');
 const transform=dom.run('qHbu',[{BHJg:{x:indicatorRect.x,y:indicatorRect.y},CHJR:{a:1,b:0,c:0,d:1,e:0,f:0}}]).value;
 assert.deepEqual(transform,{a:1,b:0,c:0,d:1,e:-indicatorRect.x,f:-indicatorRect.y});
 results.push({input,actual,css:{rules:cssOutput.rules},root,rootVisited:rootReplay.out.trace,inline: inline.events,transform,passed:true});
}
// Control: an explicit viewBox in an unrelated source is copied, not synthesized.
const control=dom.run('uNCx',[{}, {assetSource:'<svg viewBox="-1 -2 18 18" width="18px" height="18px"><path d="M0 0"/></svg>'},'c_img','control.svg','alt', 'img']).out;
assert.equal(control.events.find(e=>e.kind==='open').attributes.viewbox,'-1 -2 18 18');
results.push({name:'explicit-viewbox-copy-control',events:control.events,passed:true});
const sourcePaths=[...new Set([...pad.boundsSources,...dom.sourceFiles,...css.sourceFiles,'research/selection-layout-border-probe.mjs','research/layer-resize-controller-probe.mjs','research/text-autofit-dom-replay.mjs','research/text-autofit-style-css-replay.mjs','research/selection-layout-indicator-css-probe.mjs','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literals.mjs',import.meta.filename])];
const report={method:'Interpreted retained aNP5/jNPH/UJ0a + SNLp/TNKD/hNKx + SHbE + uNCx + qHbu, with explicit facades; no vendor DLL execution or GUI/pixel observation.',passed:results.length,failed:0,boundaries:['XNUc global indicator rect is a supplied previously closed placement fixture, not re-executed in this probe.','rNP4 full asset rendering is a sink. SHbE is separately supplied the final TIdc mode1 and aNP5 crop size after the statically inspected generator chain.','No full native path/body serialization is asserted. uNCx receives an explicit synthetic marker body and proves root rewriting only.','Matrix multiplication is limited to right-side identity and numeric CSS formatting to these exact values.','Selection CSS rectangle and root/inline attribute projection are closed independently of final path translation and clipping.','No transformed/shadow/gradient/explicit-image/master/adaptive context.'],sources:sourcePaths.map(path=>({path,sha256:sha(path)})),results};
fs.writeFileSync('research/selection-svg-bounds-probes.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:results.length,cases:results.slice(0,6).map(r=>({input:r.input,rect:r.actual.cssRect,root:r.root}))},null,2));