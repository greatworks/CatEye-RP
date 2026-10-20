// Static CIL replay only. No original assembly, GUI, or product module executes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as numeric from './layer-resize-numeric-replay.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const controllerFile = 'research/layer-resize-controller-probe.mjs';
const composedFile = 'research/layer-resize-controller-planner-oracle.mjs';
const controller = fs.readFileSync(controllerFile, 'utf8');
const prefix = controller.slice(0, controller.indexOf('for(let mask=0;mask<16;mask++)'))
  .replace("'./gradient-angle-static-flow.mjs'", JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href));
const composed = fs.readFileSync(composedFile, 'utf8');
const begin = composed.indexOf('const adapter=`') + 'const adapter=`'.length;
const end = composed.indexOf('\n`;', begin);
assert(begin > 0 && end > begin);
const adapter = composed.slice(begin, end)
  .replace('c[67119114]=input.handle;c[67119111]=!!input.preserveAspect;',
    'c[67119114]=input.handle;c[67119111]=!!input.preserveAspect; const entry=entryPolicy(input,root.rect); c.freedom=entry.freedom;')
  .replace('root.rect,input.delta.x,input.delta.y,input.orientation??3',
    'pr(entry.selectionRect),entry.delta.x,entry.delta.y,input.orientation??3')
  .replace('rootFrame:root.rect,', 'rootFrame:root.rect,entry,');
assert(adapter.includes('const entry=entryPolicy'));
const entryAdapter = `
for(const file of [
  'research/layer-resize-controller-planner-axis-cil.json',
  'research/layer-resize-controller-planner-selection-cil.json',
]) for(const type of read(file).Types) for(const method of type.Methods) methods.set(method.Token,{...method,file});
for(const id of [100708345,100708321,100708324]) cil(id,1);
bind(100722026,1,([r])=>r.width);
bind(100722027,1,([r])=>r.height);
const sourceEntry=methods.get(100686248);
// Exact contiguous clamp instructions, with an explicit stop before root iteration.
methods.set(-100686248,{
  Instructions:[...sourceEntry.Instructions.filter(i=>i.Offset>=786&&i.Offset<=905),
    {Offset:906,Op:'ret',Operand:null,Resolved:null}],
});
export function entryPolicy(input,defaultRect) {
  const selectionRect=input.selectionRect??defaultRect;
  const freedom=input.freedom??execute(100708345,[input.handle]);
  const args=[{[67119114]:input.handle,[67119118]:selectionRect},input.delta.x,input.delta.y];
  execute(-100686248,args);
  return {selectionRect,freedom,delta:{x:args[1],y:args[2]}};
}
`;
const replay = await import('data:text/javascript;base64,' + Buffer.from(prefix + entryAdapter + adapter).toString('base64'));
const cases = [], policies = [];
const box = (id,x,y,width,height,extra={}) => ({id,rect:{x,y,width,height},...extra});
const group = (id,children,extra={}) => ({id,children,...extra});
const selectionRect = {x:0,y:0,width:400,height:100};
for(const handle of [1,2,3,4,6,8,9,12]) {
  for(const delta of [{x:-500,y:-150},{x:500,y:150},{x:100,y:35},{x:0,y:0}]) {
    const expected = replay.entryPolicy({handle,delta,selectionRect},null);
    assert.equal(expected.freedom, handle===1||handle===4 ? 1 : handle===2||handle===8 ? 2 : 3);
    assert.equal(expected.delta.x,handle&1?Math.min(delta.x,400):Math.max(delta.x,-400));
    assert.equal(expected.delta.y,handle&2?Math.min(delta.y,100):Math.max(delta.y,-100));
    policies.push({handle,delta,selectionRect,expected,passed:true});
  }
  for(const [id,x] of [['a',0],['b',300]]) {
    const input = {root:group('g-'+id,[box(id,x,0,100,100)]),selectionRect,handle,delta:{x:60,y:25}};
    cases.push({name:'shared selection default handle '+handle+' root '+id,input,expected:replay.oracle(input,numeric)});
  }
}
for(const [handle,delta] of [[4,{x:100,y:35}],[8,{x:35,y:50}]]) {
  const input={root:group('g',[box('a',100,100,100,100),box('b',200,100,100,100)]),handle,delta};
  cases.push({name:'single root native default freedom '+handle,input,expected:replay.oracle(input,numeric)});
}
for(const [id,x] of [['a',-100],['b',200]]) {
  const input={root:group('g-'+id,[box(id,x,60,100,100)]),selectionRect:{x:-100,y:60,width:400,height:100},
    handle:4,delta:{x:-150,y:35}};
  cases.push({name:'translated shared frame shrink '+id,input,expected:replay.oracle(input,numeric)});
}
for(const locked of [false,true]) {
  const input={root:group('g',[box('a',300,0,100,100)],{locked}),
    selectionRect,handle:4,delta:{x:100,y:35}};
  cases.push({name:'selected root lock with shared bounds '+locked,input,expected:replay.oracle(input,numeric)});
}
const sources = [
  controllerFile,composedFile,'research/layer-resize-numeric-replay.mjs',
  '.build/next-layer-authoring/resize-propagation-cil.json',
  'research/layer-resize-controller-planner-host-cil.json',
  'research/layer-resize-controller-planner-entry-cil.json',
  'research/layer-resize-controller-planner-axis-cil.json',
  'research/layer-resize-controller-planner-selection-cil.json',
];
const output = {
  originalDllExecuted:false,originalGuiCompared:false,productSolverUsed:false,
  description:'Actual recorded MSON CIL and CbNX IL0x312–0x389 clamp, composed with recorded jbNm/INw2/mNwa/ubNp.',
  methods:{handleFreedom:100708345,constructor:100686217,controller:100686248,clampOffsets:[786,905]},
  scope:'Visible ordinary Layer selection in one page/state coordinate scope; declared root snapshots supplied. Native selection discovery is not executed.',
  sinks:['The source-contiguous clamp slice stops before selection enumeration',
    'Root selection bounds are explicit fixture inputs; containment and positive dimensions are product guards',
    'Notification/history and setter effects are captured, not executed in Axure',
    'Positive nonempty rectangle union uses the source-bound H5px min/max branch'],
  summary:{total:policies.length+cases.length,policyCases:policies.length,composedCases:cases.length,passed:policies.length+cases.length,failed:0},
  sources:sources.map(file=>({file,sha256:sha(file)})),policies,cases,
};
fs.writeFileSync('research/layer-resize-controller-planner-entry-fixtures.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary));
