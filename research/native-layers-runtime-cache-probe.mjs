import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { layerHarness } from './native-layers-runtime-probe.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const results=[];
function test(name,code,check){let observed;try{observed=layerHarness(code);check(observed);results.push({name,passed:true,observed})}catch(e){results.push({name,passed:false,observed,error:String(e.stack)})}}
const fixture=`add('g',{left:700,top:800,width:900,height:600},{type:'layer'},'base');add('a',{left:100,top:80,width:40,height:20},{type:'vectorShape'},'g');`;
test('Layer data attributes take precedence over normal style geometry',fixture+`Object.assign(nodes.g.attrs,{'data-left':'100','data-top':'80','data-width':'40','data-height':'20'});return $ax('#g').offsetBoundingRect();`,r=>assert.deepEqual(r.location,{x:100,y:80,left:100,top:80}));
test('Layer moved and resized caches take precedence over data attributes',fixture+`Object.assign(nodes.g.attrs,{'data-left':'100','data-top':'80','data-width':'40','data-height':'20'});_visibility.setMovedLocation('g',55,66);_visibility.setResizedSize('g',77,88);return $ax('#g').offsetBoundingRect();`,r=>{assert.deepEqual(r.location,{x:55,y:66,left:55,top:66});assert.deepEqual(r.size,{width:77,height:88})});
test('Zero numeric string data attributes are present, not absent fallback',fixture+`Object.assign(nodes.g.attrs,{'data-left':'0','data-top':'0','data-width':'0','data-height':'0'});return $ax('#g').offsetBoundingRect();`,r=>{assert.deepEqual(r.location,{x:0,y:0,left:0,top:0});assert.deepEqual(r.size,{width:0,height:0})});
test('All-excluded sentinel is actually written to Layer caches',fixture+`nodes.a.style.visibility='hidden';_updateLayerRectCache('g');return {state:currentState(),rect:$ax('#g').offsetBoundingRect()};`,r=>{assert.deepEqual(r.state.moved.g,{left:99999,top:99999});assert.deepEqual(r.state.resized.g,{width:-99999,height:-99999});assert.deepEqual(r.rect.size,{width:-99999,height:-99999});assert.deepEqual(r.state.calls.filter(x=>x.kind==='event').map(x=>x.event),['onResize','onMove'])});
test('Member movement cache keys remain full element ids in separate row instances',`add('g-1',{left:100,top:100,width:40,height:20},{type:'layer'},'base');add('a-1',{left:100,top:100,width:40,height:20},{type:'vectorShape'},'g-1');add('g-2',{left:100,top:100,width:40,height:20},{type:'layer'},'base');add('a-2',{left:100,top:100,width:40,height:20},{type:'vectorShape'},'g-2');_visibility.moveMovedLocation('g-1',30,40);return currentState();`,r=>{assert.deepEqual(r.moved['a-1'],{left:130,top:140});assert.equal(r.moved['a-2'],undefined);assert.equal(r.moved['g-2'],undefined)});
const summary={total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length};
const file='research/native-layers-runtime-cache-final-probes.json';
assert.ok(!fs.existsSync(file),'Preserve existing report');
fs.writeFileSync(file,JSON.stringify({capturedAt:new Date().toISOString(),kind:'Exact original query/cache functions inside the existing declared NodeVM facade; data-* are controlled DOM string attributes. Row instance binding itself is not executed.',sources:JSON.parse(fs.readFileSync('research/native-layers-runtime-second-probes.json','utf8')).sources,script:{path:'research/native-layers-runtime-cache-probe.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},dependency:{path:'research/native-layers-runtime-probe.mjs',sha256:hash(fs.readFileSync('research/native-layers-runtime-probe.mjs'))},summary,results},null,2)+'\n');
console.log(JSON.stringify({summary,failures:results.filter(x=>!x.passed)},null,2));
if(summary.failed)process.exitCode=1;
