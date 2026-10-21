import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const path='research/selection-adaptive-svg-probes-final.json',data=JSON.parse(fs.readFileSync(path,'utf8'));
const digest=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const scale=value=>value==='none'?[1,1]:[Number(value.match(/^matrix\(([^)]+)\)$/)[1].split(',')[0]),Number(value.match(/^matrix\(([^)]+)\)$/)[1].split(',')[3])];
const sameNumber=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-8,label+': '+actual+' != '+expected);
const checks=[];
assert.deepEqual(data.errors,[]);assert.deepEqual(data.exceptions,[]);
for(const source of data.sources)assert.equal(digest(source.path),source.sha256,source.path);
for(const result of data.results){
 const input=result.input,rows=result.actual,base=input.baseSize??{width:100,height:24};
 for(const row of rows){
  assert.equal(row.error,undefined);
  for(const s of [row.before,row.after]){
   assert.deepEqual(s.objSize,base);assert.deepEqual(s.fullBase.size,base);
   assert(Object.values(s.identity).every(Boolean));
   assert.equal(s.svg.attrs.viewBox,input.legacyViewport?'0 0 14 14':undefined);
   assert.equal(s.svg.attrs.width,input.legacyViewport?'14':undefined);assert.equal(s.svg.attrs.height,input.legacyViewport?'14':undefined);
   const [x,y]=scale(s.svg.computed.transform);
   sameNumber(s.svg.bbox.width,parseFloat(s.svg.computed.width)*Math.abs(x),'bbox width');
   sameNumber(s.svg.bbox.height,parseFloat(s.svg.computed.height)*Math.abs(y),'bbox height');
  }
  for(let i=0;i<row.trace.length;i++)if(row.trace[i].kind==='adaptive-enter'){
   const entry=row.trace[i],exit=row.trace.slice(i+1).find(t=>t.kind==='adaptive-exit');assert(exit);
   const style=entry.args[1],before=entry.before,after=exit.after;
   assert.deepEqual(after.objSize,before.objSize);
   if(style.size){
    assert.equal(after.svg.computed.transformOrigin,'0px 0px');
    const old=scale(before.svg.computed.transform),expected=[style.size.width/base.width*old[0],style.size.height/base.height*old[1]];
    if(expected.every(Number.isFinite)){const actual=scale(after.svg.computed.transform);sameNumber(actual[0],expected[0],'source multiplier x');sameNumber(actual[1],expected[1],'source multiplier y');}
    else assert.equal(after.svg.computed.transform,before.svg.computed.transform);
   }else{assert.equal(after.svg.computed.transform,before.svg.computed.transform);assert.equal(after.svg.computed.transformOrigin,before.svg.computed.transformOrigin);}
   assert.equal(after.svg.computed.left,before.svg.computed.left);assert.equal(after.svg.computed.top,before.svg.computed.top);
   assert.equal(after.svg.computed.width,before.svg.computed.width);assert.equal(after.svg.computed.height,before.svg.computed.height);
  }
  if(row.step.call==='state')assert.equal(row.after.svg.computed.transform,row.before.svg.computed.transform);
  if(row.step.call==='switch'&&row.step.view==='default'&&!input.directChild)assert.equal(row.after.svg.computed.transform,row.before.svg.computed.transform);
 }
 if(input.name==='complete-switch-chain'){
  assert.deepEqual(rows.map(r=>scale(r.after.svg.computed.transform)),[[1,1],[2,3],[2,3],[4,9],[6,9],[6,18],[6,18],[6,18],[6,18],[6,18],[6,18],[12,54],[12,54]]);
  assert.equal(rows[2].trace.filter(t=>t.kind==='svg').length,0);assert.equal(rows[2].trace.filter(t=>t.kind==='adaptive-enter').length,0);
 }
 if(input.name==='initial-named-and-return')assert.deepEqual(rows.map(r=>scale(r.after.svg.computed.transform)),[[2,3],[2,3],[4,9]]);
 if(input.name==='direct-child-negative-control')assert.deepEqual(rows.map(r=>scale(r.after.svg.computed.transform)),[[1,1],[2,3],[1.5,1],[1,1]]);
 if(input.name==='inherited-view-size-and-child-p94'){
  assert.deepEqual(rows[1].trace.find(t=>t.kind==='adaptive-enter').args[1].size,{width:200,height:72});
  assert.deepEqual(rows[2].trace.find(t=>t.kind==='adaptive-enter').args[1].size,{width:150});
 }
 if(input.name==='zero-scale-return')assert.deepEqual(rows.map(r=>scale(r.after.svg.computed.transform)),[[1,1],[0,1],[0,3],[0,0],[0,0],[0,0]]);
 if(input.name==='generated-css-position-carrier'){
  for(const row of rows.slice(2)){assert.equal(row.after.svg.computed.left,'11px');assert.equal(row.after.svg.computed.top,'13px');assert.equal(row.after.owner.computed.left,'80px');assert.equal(row.after.label.computed.left,'0px');}
 }
 if(input.name==='view-css-without-inline-position'){
  const enter=rows[1].trace.find(t=>t.kind==='adaptive-enter');assert.equal(enter.before.svg.computed.left,input.alignRight?'183px':'3px');assert.equal(enter.before.svg.computed.top,'29px');
  const writes=rows[1].mutations.filter(m=>m.id==='u_img'&&m.attribute==='style');assert.equal(writes[0].new,'transform-origin: left top;');assert.equal(writes[1].new,'transform-origin: left top; transform: scale(2, 3);');
 }
 checks.push({name:input.name,type:input.type,alignRight:input.alignRight??false,baseSize:base,steps:rows.length,passed:true});
}
const result={method:'Read-only verification of retained original-module browser traces. Source formula and explicit witnessed sequences are checked independently of all product code. Original geometry/position declarations remain fixture inputs.',sources:[{path,sha256:digest(path)},{path:import.meta.filename,sha256:digest(import.meta.filename)}],summary:{sequences:checks.length,passed:checks.length,failed:0,steps:checks.reduce((n,c)=>n+c.steps,0)},checks};
fs.writeFileSync('research/selection-adaptive-svg-verification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result.summary));
