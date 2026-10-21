// Independent bounded product/source comparison; no browser, build or vendor DLL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {session,multiple} from './selection-pointer-session-probe.mjs';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const product='src/model/selection-pointer-resize.ts';
const before=sha(product);assert.equal(before,'d502dfd682dcc1baa4197e7d8ed80722a28682a441df665bb3ecd23743de6869');
const compile=p=>stripTypeScriptTypes(fs.readFileSync(p,'utf8'),{mode:'transform'});
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
let moduleCode=compile(product);
for(const file of ['author-resize-solver','selection-layout'])moduleCode=moduleCode.replaceAll("'./"+file+"'",JSON.stringify(uri(compile('src/model/'+file+'.ts'))));
const cases=[];
try{
 const {prepareSelectionPointerResize:prepare,planSelectionPointerResize:plan}=await import(uri(moduleCode));
 const union=(a,b)=>{const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};};
 const fixtures=[];
 for(const alignRight of [false,true])for(const widthFit of [false,true])for(const handle of [1,4])fixtures.push({alignRight,widthFit,handle,heightFit:false,rect:{x:80,y:60,width:200,height:40},panel:{x:14,y:0,width:186,height:20},buttonSize:14,padding:[2,4,3,5],measurements:[{width:62,height:16},{width:52,height:30},{width:65,height:22},{width:75,height:18}],deltas:[{x:-20,y:8},{x:0,y:0},{x:40,y:0}]});
 for(const widthFit of [false,true])for(const handle of [1,12])fixtures.push({widthFit,handle,heightFit:false,rects:[{x:80,y:60,width:200,height:40},{x:380,y:90,width:100,height:20}],selectionRect:{x:80,y:60,width:400,height:50},panel:{x:14,y:0,width:86,height:20},buttonSize:14,padding:[0,0,0,0],measurements:[{width:60,height:18}],deltas:[{x:80,y:10},{x:0,y:0},{x:-40,y:-5}]});
 for(const input of fixtures){const expected=input.rects?multiple(input):session(input);const rects=input.rects??[input.rect];
  const targets=rects.map((r,n)=>({id:input.rects?'selection'+n:'selection',type:n%2?'radio':'checkbox',input:{ownerRect:r,textPanelRect:input.panel,coordinateContext:{kind:'translation',locationInDiagram:{x:r.x,y:r.y},ownerRotation:0,textRotation:0},rawFit:{width:input.widthFit,height:false},effectiveFit:{width:input.widthFit,height:false},alignRight:!!input.alignRight,empty:false,guard:false,padding:input.padding,indicatorSize:14,horizontalAlignment:'left',verticalAlignment:'top'},services:{measureText(req){return input.measurements[Math.min(req.pass,input.measurements.length-1)];},readMinimumSize(){return{width:1,height:1};},convertIndicatorInset(){return{width:2,height:2};},unionRectangles:union}}));
  const prepared=prepare(targets,input.handle);let state=prepared.state;const actual=[];let error=null;
  try{for(const [index,delta]of input.deltas.entries()){assert.equal(expected[index].error,null);const prior=structuredClone(state),result=plan(prepared.original,state,{delta});assert.equal(result.ok,true,result.reason);assert.deepEqual(state,prior,'Input state mutated');state=result.state;const current=state.targets.map(t=>({id:t.id,rect:t.layout.ownerRect,panel:t.layout.textPanelRect,fit:t.layout.rawFit.width}));const want=input.rects?expected[index].after:[{id:'selection',...expected[index].after}];assert.deepEqual(current,want.map(({id,rect,panel,fit})=>({id,rect,panel,fit})));actual.push(current);}}
  catch(e){error=e.message;}cases.push({input,expected,actual,error,passed:!error});
 }
}finally{}
assert.equal(sha(product),before,'Product changed during review');
const paths=[product,'src/model/selection-layout.ts','src/model/author-resize-solver.ts','tests/selection-pointer-resize.test.ts','research/selection-pointer-manifest.json','research/selection-pointer-session-probe.mjs','research/selection-pointer-solver-review.mjs'];
const report={kind:'Independent static review plus new bounded product versus retained-CIL oracle inputs',productChanged:false,originalDllExecuted:false,originalGuiCompared:false,
 summary:{total:cases.length,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,frames:cases.reduce((n,c)=>n+c.input.deltas.length,0)},
 sources:paths.map(path=>({path,sha256:sha(path)})),cases,
 limitations:['Only unrotated page-scope ordinary controls are implemented','Shift/Ctrl/Alt currently reject even where original handles permit them','Negative measured panel width is an atomic product rejection, not native parity','Original readMinimumSize is a virtual call; 1x1 is this ordinary provider result, not a literal in obN4','History and native graphics/font services remain bounded facades']};
fs.writeFileSync('research/selection-pointer-solver-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;
