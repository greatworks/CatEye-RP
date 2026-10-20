// Retained CIL arithmetic replay only. No native DLL or browser is executed.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { nativePrimitive } from './probe-line-style-arrows.mjs';
const source='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/style.js';
const entry=path=>({path,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')});
const cases=[{position:{x:200,y:40},direction:{x:1,y:0}},{position:{x:0,y:40},direction:{x:-1,y:0}},{position:{x:35,y:80},direction:{x:0,y:1}},{position:{x:180,y:20},direction:{x:.6,y:-.8}}];
const results=[];
for(const width of [2,8])for(const style of [3,5,20])for(const {position,direction}of cases){
  const base=nativePrimitive(style,width),actual=nativePrimitive(style,width,position,direction);
  const transform=p=>({x:position.x+direction.x*p.x-direction.y*p.y,y:position.y+direction.y*p.x+direction.x*p.y});
  assert.equal(actual.length,base.length);
  for(let i=0;i<base.length;i++)for(let j=0;j<base[i].length;j++)for(const key of ['a','b']){
    const expected=transform(base[i][j][key]),observed=actual[i][j][key];assert.ok(Math.abs(expected.x-observed.x)<1e-9);assert.ok(Math.abs(expected.y-observed.y)<1e-9);
  }
  results.push({style,width,position,direction,observed:actual,pass:true});
}
const report={kind:'Bounded retained-CIL arithmetic replay, no assembly execution',
  sources:[source,'research/scripts/probe-line-style-arrows.mjs','research/line-style-arrow-base-cil.json','research/line-style-arrow-point-cil.json'].map(entry),
  staticEvidence:{method:'T5Rf.o5R8.i5RQ',token:100718992,meaning:'Result paths already include supplied widget-space position and direction.',runtime:'style.js1182–1218 assigns the same stroke gradient reference to shaft and arrowhead fill/stroke.'},
  results,
  limitation:'This establishes positioned primitive coordinates and shared runtime paint references, not a complete original GUI pixel comparison.'};
fs.writeFileSync('research/line-style-arrow-paint-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.pass).length}));
