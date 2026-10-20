// Interpret retained CIL records. Graphics measurement and notification are
// explicit sinks. The original assembly/application is never loaded or run.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const adapterFile = 'research/layer-resize-controller-probe.mjs';
const source = fs.readFileSync(adapterFile, 'utf8');
const boundary = 'for(let mask=0;mask<16;mask++)';
assert(source.includes(boundary));
const prefix = source.slice(0, source.indexOf(boundary))
  .replace("'./gradient-angle-static-flow.mjs'", JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href));
const adapter = `
const selectionFiles=['research/selection-author-resize-class-cil.json','research/selection-author-resize-storage-cil.json',
 'research/selection-author-resize-measure-dependencies-cil.json','research/selection-author-resize-size-layout-cil.json'];
for(const file of selectionFiles)for(const type of read(file).Types)for(const m of type.Methods)methods.set(m.Token,{...m,file});
for(const [id,count] of [[100702025,1],[100702026,1],[100702035,1],[100702371,2],[100702364,1]])cil(id,count);
bind(100717838,1,([s])=>s.buttonSize);
bind(100695614,1,([w])=>({[167789627]:w.transform??null}));
bind(100723734,1,([t])=>t.scaleX);bind(100723736,1,([t])=>t.scaleY);
bind(100702327,1,([w])=>w.panel);
bind(100702302,1,([p])=>p.rect.height);
bind(100702298,1,([p])=>size(p.rect.width,p.rect.height));
bind(100702297,1,([p])=>point(p.rect.x,p.rect.y));
bind(100695348,1,([w])=>point(w.rect.x,w.rect.y));
bind(100695361,1,([w])=>size(w.rect.width,w.rect.height));
bind(100695586,1,([w])=>w.align);
bind(100695590,1,([w])=>w.padding[0]);
bind(100695592,1,([w])=>w.padding[2]);
bind(100695589,1,([w])=>w.padding[3]);
bind(100695591,1,([w])=>w.padding[1]);
bind(100702331,1,([w])=>w.empty);
bind(100702301,1,([p])=>p.rect.width);
bind(100702365,1,([w])=>w.padding[0]+w.padding[2]);
bind(100722966,2,([width,height])=>size(width,height));
bind(100702031,1,([w])=>w.alignRight);
bind(100702363,1,args=>execute(100702026,args)); // virtual SelectionButton override
bind(100701897,2,([p,v])=>{p.position=copy(v);return VOID;});
bind(100702038,1,([w])=>w.indicator); // graphics/indicator placement explicit sink
bind(100722964,2,([s,p])=>rect(p.x,p.y,deref(s).width,deref(s).height));
bind(100720524,3,([a,b,ignoreEmpty])=>{
  assert.equal(ignoreEmpty,1);const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
  return rect(x,y,Math.max(a.x+a.width,b.x+b.width)-x,Math.max(a.y+a.height,b.y+b.height)-y);
});
bind(100722052,2,([r,width])=>{set(r,{...deref(r),width});return VOID;});
bind(100722054,2,([r,height])=>{set(r,{...deref(r),height});return VOID;});
export function runSizing(fit) {
 context={calls:[],effects:[],commits:[],geometryWrites:[],keys:0,results:{}};
 return execute(100702025,[widget('s','SelectionButton',rect(0,0,100,15),{autoFitWidth:fit})]);
}
export function runButtonSize(value,transform) {
 return execute(100702026,[widget('s','SelectionButton',rect(0,0,100,15),{style:{buttonSize:value},transform})]);
}
export function runLayout(input) {
 context={calls:[],effects:[],commits:[],geometryWrites:[],keys:0,results:{}};
 const w=widget('s','SelectionButton',rect(0,0,100,15),{style:{buttonSize:input.buttonSize??13},
  panel:{rect:rect(0,0,input.textWidth??60,input.textHeight)},padding:input.padding??[0,0,0,0],
  align:input.align,alignRight:input.alignRight??false,transform:input.transform,
  indicator:rect(0,0,input.buttonSize??13,input.buttonSize??13)});
 execute(100702035,[w]);
 return {panelPosition:w.panel.position,geometryWrites:context.geometryWrites};
}
export function runFit(input) {
 context={calls:[],effects:[],commits:[],geometryWrites:[],keys:input.keys??0,results:{}};
 const w=widget('s','SelectionButton',rect(0,0,100,15),{autoFitWidth:input.fit,autoFitHeight:false,
  capabilities:134217728,style:{fixedWidth:input.fixedWidth,fixedHeight:input.fixedHeight,
   pinVertical:input.pinVertical??0}});
 const c=controller([w],input.freedom);
 const pin=execute(100686252,[w,rect(0,0,100,15),rect(0,0,200,30),false]);
 execute(100686253,[c,input.dx,100,w,input.fixedWidth,input.fixedHeight]);
 return {fit:w.autoFitWidth,pin:pinData(pin),effects:context.effects};
}
export function runSizeValidation(input) {
 const w=widget('s','SelectionButton',rect(0,0,100,15),{autoFitWidth:input.widthFit,autoFitHeight:input.heightFit,
  empty:input.empty,style:{buttonSize:13},padding:[2,4,3,5],panel:{rect:rect(0,0,60,30)}});
 return execute(100702371,[w,size(150,40)]);
}
export function runMeasurementEntry() {
 const calls=[],w=widget('s','SelectionButton',rect(0,0,100,15),{style:{buttonSize:13},padding:[2,4,3,5],panel:{}});
 bind(100702376,1,()=>100); // no text rotation, source current frame width
 bind(100701896,2,([p,v])=>{calls.push({method:'INOR',size:copy(v)});return VOID;}); // native graphics sink
 bind(100702377,1,()=>{calls.push({method:'virtual WIyL => SelectionButton100702035'});return VOID;});
 execute(100702375,[w]);return calls;
}
export const retainedMethods=[100702025,100702026,100702035,100702371,100702364,100702375,100686252,100686253];
export const retainedInputs=[...inputFiles,...selectionFiles];
`;
const api = await import('data:text/javascript;base64,' + Buffer.from(prefix + adapter).toString('base64'));
const results = [];
const test = (name, input, run, expected) => {
  const actual = run(input); assert.deepEqual(actual, expected, name);
  results.push({ name, input, expected, actual, passed: true });
};
for (const fit of [false, true]) test(`SizingFreedoms fit=${fit}`, fit, api.runSizing, fit ? 65537 : 1);
for (const value of [0, 13, 20]) for (const scaleX of [null, 0, 1, 2, -1]) {
  const input = { value, transform: scaleX === null ? null : { scaleX, scaleY: 7 } };
  test(`ButtonSize ${value} scaleX ${scaleX}`, input,
    v => api.runButtonSize(v.value, v.transform), value * (scaleX ?? 1));
}
for (const fit of [false,true]) for (const freedom of [0,1,2,3]) for (const dx of [0,.000009999,.00001,20]) {
  const input = {fit,freedom,dx,fixedWidth:true,fixedHeight:false};
  const actual = api.runFit(input);
  assert.equal(actual.fit, fit && (!(freedom & 1) || Math.abs(dx)<.00001), JSON.stringify({input,actual}));
  assert.equal(actual.pin.fixedHeight,true);
  results.push({name:`Selection fit ${fit}, freedom ${freedom}, dx ${dx}`,input,actual,passed:true});
}
for (const textHeight of [5,13,30]) for (const align of [0,1,2]) for (const alignRight of [false,true]) {
  const input={textHeight,align,alignRight,padding:[2,4,3,5]};
  const actual=api.runLayout(input);
  const y=textHeight<13?[2,(13-textHeight+2-3)/2,13-textHeight-3][align]:0;
  assert.deepEqual(actual.panelPosition,{__struct:'point',x:alignRight?5:18,y});
  assert.equal(actual.geometryWrites.length,1);
  assert.deepEqual(actual.geometryWrites[0],{id:'s',property:'Size',value:{__struct:'size',width:100,height:Math.max(13,textHeight)},allViews:false,notify:true});
  results.push({name:`Measured-label positioning h${textHeight} align${align} right${alignRight}`,input,actual,passed:true});
}
for(const empty of [false,true]) for(const widthFit of [false,true]) for(const heightFit of [false,true]) {
  const input={empty,widthFit,heightFit};
  test(`NIuy => KNZn empty ${empty} fits ${widthFit}/${heightFit}`,input,api.runSizeValidation,
    {__struct:'size',width:!empty&&widthFit?82:150,height:!empty&&heightFit?35:40});
}
test('PNZ8 subtracts left+right+indicator and measures before virtual positioning',null,api.runMeasurementEntry,
 [{method:'INOR',size:{__struct:'size',width:78,height:1}},{method:'virtual WIyL => SelectionButton100702035'}]);
const files=[...new Set([...api.retainedInputs,adapterFile,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json', 'research/selection-author-resize-class-cil.json',
 'research/selection-author-resize-storage-cil.json','research/selection-author-resize-probe.mjs',
 'research/selection-author-resize-measure-dependencies-cil.json','research/selection-author-resize-size-layout-cil.json'])];
const output={method:'Bounded interpretation of retained CIL; no target execution.',originalGuiCompared:false,
 sinks:['Native font measurement supplies TextPanel size; not executed.',
 'mNU6 graphic indicator rectangle injected at origin, 13x13.',
 'Notification invalidation and actual uJ0j implementation are captured writes.',
 'Current style/transform resolution injected; no new inheritance claim.'],
 retainedMethods:api.retainedMethods,sources:files.map(file=>({file,sha256:sha(file)})),
 summary:{total:results.length,passed:results.length,failed:0},results};
fs.writeFileSync('research/selection-author-resize-probes.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary));
