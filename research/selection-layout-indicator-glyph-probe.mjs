// Bounded interpretation of retained instruction records. No vendor assembly loads.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const adapter='research/layer-resize-controller-probe.mjs';
let code=fs.readFileSync(adapter,'utf8').split('for(let mask=0;mask<16;mask++)')[0]
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("else if(op==='stelem.ref')","else if(op==='stelem.ref'||op==='stelem')")
 .replace("else if(op==='isinst')","else if(op==='bge.un'){const b=deref(stack.pop()),a=deref(stack.pop());if(a>=b||Number.isNaN(a)||Number.isNaN(b))jump(v);}\nelse if(op==='isinst')");
code+=String.raw`
const extraFiles=['research/selection-layout-indicator-draw-cil.json','research/selection-layout-indicator-dependencies-cil.json','research/selection-layout-indicator-html-geometry-cil.json'];
for(const file of extraFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [id,n]of [[100710703,5],[100710704,5],[100720517,2],[100720518,2],[100722075,1],[100722109,2],[100721950,2],[100722973,2]])cil(id,n);
bind(100720817,2,([a,b])=>a===b);
bind(100720805,1,([f])=>f.color);
bind(100720811,3,([fill,r,flag])=>({fill,rect:r,flag}));
bind(100720056,2,([color,width])=>({color,width}));
bind(100722966,2,([w,h])=>size(w,h));
bind(100721941,2,([x,y])=>point(x,y));
bind(100722093,3,([target,p,s])=>{set(target,rect(p.x,p.y,s.width,s.height));return VOID;});
// The same constructor is emitted both by call (address + args) and newobj (args).
callSpecs.set(100722093,{count:3,run:([target,p,s])=>{set(target,rect(p.x,p.y,s.width,s.height));return VOID;}});
bind(100721058,1,()=>null);
bind(100721038,4,([g,pen,points,flag])=>{g.calls.push({kind:'polyline',pen,points,flag});return VOID;});
bind(100719058,1,([color])=>({color}));
bind(100719836,2,([nullable,flag])=>({kind:'path',nullable,flag,ellipses:[]}));
bind(100719853,2,([path,r])=>{path.ellipses.push(r);return VOID;});
bind(721423821,1,([p])=>[p]);
bind(100721050,4,([g,brush,paths,flag])=>{g.calls.push({kind:'fill',brush,paths,flag});return VOID;});
export function glyph(kind,b,widthHeight=b,fill=null,disabled=false,x=0,y=0){
 const theme={67130271:'disabled-theme',67130272:'normal-theme'},g={calls:[]};
 execute(kind==='checkbox'?100710703:100710704,[theme,g,rect(x,y,b,widthHeight),disabled,fill]);
 return JSON.parse(JSON.stringify(g.calls,(k,v)=>k==='__struct'?undefined:v));
}
export const sourceFiles=[...inputFiles,...extraFiles];
`;
// Constructor handling is opcode-sensitive; avoid conflating its call/newobj stack.
code=code.replace('const values=pop(spec.count),value=spec.run(values,{token,offset:i.Offset,op,cleanups});',
`const count=v===100722093?(op==='newobj'?2:3):spec.count;
const values=pop(count),value=v===100722093&&op==='newobj'?rect(values[0].x,values[0].y,values[1].width,values[1].height):spec.run(values,{token,offset:i.Offset,op,cleanups});`);
process.on('uncaughtException',error=>{
 const message=String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-glyph-adapter>');
 let n=1;while(fs.existsSync(`research/selection-layout-indicator-glyph-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-layout-indicator-glyph-failure-${n}.json`,JSON.stringify({message,sourceHash:sha(import.meta.filename)},null,2)+'\n');
 console.error(message);process.exitCode=1;
});
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const close=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const results=[];
for(const kind of ['checkbox','radio'])for(const b of [0,12,13,14,16,18,25.5])for(const disabled of [false,true])for(const hasFill of [false,true]){
 const input={kind,b,height:b+8,fill:hasFill?{color:'#123456'}:null,disabled,x:10,y:20};
 const actual=api.glyph(kind,b,input.height,input.fill,disabled,10,20);
 assert.equal(actual.length,1);
 const top=24;
 if(kind==='checkbox'){
  assert.equal(actual[0].pen.color,hasFill?'#123456':disabled?'disabled-theme':'normal-theme');
  close(actual[0].pen.width,3*b/14);
  const expected=[[10+3*b/14,top+b/2],[10+6*b/14,top+10*b/14],[10+11*b/14,top+3*b/14]];
  actual[0].points.forEach((p,i)=>{close(p.x,expected[i][0]);close(p.y,expected[i][1]);});
 }else{
  const r=actual[0].paths[0].ellipses[0];
  close(r.x,10+b/4);close(r.y,top+b/4);close(r.width,b/2);close(r.height,b/2);
  if(!hasFill)assert.equal(actual[0].brush.color,disabled?'disabled-theme':'normal-theme');
 }
 results.push({input,actual,passed:true});
}
fs.writeFileSync('research/selection-layout-indicator-glyph-probes.json',JSON.stringify({
 method:'Retained CIL records interpreted with JavaScript numbers and declared Point/Size/Rect, pen/brush and graphics sinks; no original DLL, GUI or rasterizer.',
 sources:[...new Set([...api.sourceFiles,adapter,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',import.meta.filename])].map(path=>({path,sha256:sha(path)})),
 summary:{total:results.length,passed:results.length,failed:0},
 sinks:['Theme colors are distinct labeled inputs, not recovered ARGB defaults.','Fill-to-color/brush conversion and native pen/path/SVG graphics are captured sinks.','Arithmetic, centering and inset source instructions execute; IEEE double tolerance 1e-10.','Zero is a supplied lower-level input, not proof of native author acceptance.'],results
},null,2)+'\n');
console.log({passed:results.length});
