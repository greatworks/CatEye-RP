import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const prefix='research/layer-resize-numeric-final-entry-';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const record=p=>({path:p,sha256:hash(p)});
const sourceFiles=[
  'src/model/author-layer-resize.ts','src/model/author-resize-solver.ts','src/model/layer-geometry.ts','src/model/resize-pins.ts',
  'research/layer-resize-numeric-entry-review-oracle-before.mjs.txt',
  'research/layer-resize-controller-probe.mjs','research/layer-resize-numeric-replay.mjs',
  '.build/next-layer-authoring/resize-propagation-cil.json',
  'research/layer-resize-controller-planner-host-cil.json',
  'research/layer-resize-controller-planner-axis-cil.json',
  'research/layer-resize-controller-planner-selection-cil.json',
];
const sources=sourceFiles.map(record);
assert.equal(sources[0].sha256,'2d578f9151299197e9efb0e0f690449705991331f97a091860932e483e620bc6');
const oraclePath=sourceFiles[4], full=fs.readFileSync(oraclePath,'utf8');
const boundary=full.indexOf('\nconst cases=[];');assert(boundary>0);
let isolated=full.slice(0,boundary)
  .replace("'./layer-resize-numeric-replay.mjs'",JSON.stringify(pathToFileURL(path.resolve(sourceFiles[6])).href));
function replace(before,after){
  assert.equal(isolated.split(before).length,2,`Unique source adapter anchor: ${before}`);
  isolated=isolated.replace(before,after);
}
replace('export function oracle(input,numeric) {',`
function sourceEntry(handle,delta,selection,freedom) {
  for(const f of ['research/layer-resize-controller-planner-axis-cil.json','research/layer-resize-controller-planner-selection-cil.json'])
    for(const t of read(f).Types)for(const m of t.Methods)methods.set(m.Token,m);
  for(const t of [100708315,100708318,100708321,100708324])cil(t,1);
  const nativeFreedom=execute(100708345,[handle]);
  const c=controller([],freedom??nativeFreedom);c[67119114]=handle;c[67119118]=selection;
  bind(100722026,1,([s])=>s.width);bind(100722027,1,([s])=>s.height);
  const original=methods.get(100686248), args=[c,delta.x,delta.y];
  methods.set(100686248,{...original,Instructions:[
    ...original.Instructions.filter(i=>i.Offset>=786&&i.Offset<907),{Offset:907,Op:'ret'}
  ]});
  try{execute(100686248,args);}finally{methods.set(100686248,original);}
  return {delta:{x:args[1],y:args[2]},freedom:freedom??nativeFreedom,nativeFreedom};
}
export function oracle(input,numeric) {`);
replace('const root=build(input.root),c=controller([root],input.freedom??3);',
  'const roots=input.roots.map(build),selection=combine(roots.map(w=>w.aabb)),entry=sourceEntry(input.handle,input.delta,selection,input.freedom),c=controller(roots,entry.freedom);');
replace('};walk(root);','};roots.forEach(walk);');
replace('rootFrame:root.rect,','rootFrame:selection,entry,');
replace('execute(100686249,[c,c.nodes[0],!!input.overrideLocked,root.rect,input.delta.x,input.delta.y,input.orientation??3,false,c.freedom,null,null]);',
  'for(const node of c.nodes)execute(100686249,[c,node,!!input.overrideLocked,selection,entry.delta.x,entry.delta.y,input.orientation??3,false,c.freedom,null,null]);');
// Export the entry from inside the same retained-controller interpreter realm.
replace('const {oracle}=await import(', 'const {oracle,sourceEntry}=await import(');
replace("Buffer.from(prefix+adapter).toString('base64')", "Buffer.from(prefix+adapter+'\\nexport {sourceEntry};').toString('base64')");
isolated+='\nexport {oracle,numeric,sourceEntry};';
const {oracle,numeric,sourceEntry}=await import('data:text/javascript;base64,'+Buffer.from(isolated).toString('base64'));
const server=await createServer({configFile:false,logLevel:'error',server:{middlewareMode:true},appType:'custom'});
const results=[];
const close=(a,b)=>Object.is(a,b)||Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
const box=(id,x,y,width,height,extra={})=>({id,rect:{x,y,width,height},...extra});
const group=(id,children,extra={})=>({id,children,...extra});
try{
  const {createWidget}=await server.ssrLoadModule('/src/model/document.ts');
  const {planAuthorLayerResize}=await server.ssrLoadModule('/src/model/author-layer-resize.ts');
  const namesH={0:'none',1:'left',4:'right',5:'both',256:'center'}, namesV={0:'none',2:'top',8:'bottom',10:'both',512:'center'};
  const build=s=>{
    const w={...createWidget(s.children?'layer':'box'),id:s.id,...s.rect,rotation:s.angle??0,locked:!!s.locked};
    w.style={...w.style,pinHorizontal:namesH[s.h??0],pinVertical:namesV[s.v??0],fixedWidth:!!s.fixedWidth,fixedHeight:!!s.fixedHeight};
    if(s.children)w.layer={widgets:s.children.map(build),propagate:false};
    else w.shapeText={autoFitWidth:!!s.autoFitWidth,autoFitHeight:!!s.autoFitHeight};
    return w;
  };
  const flatten=w=>w.layer?w.layer.widgets.flatMap(flatten):[w];
  function run(name,input){
    try{
      const expected=oracle(input,numeric),roots=input.roots.map(build),before=structuredClone(roots);
      const plans=roots.map(layer=>planAuthorLayerResize({layer,selectionRect:expected.rootFrame,handle:input.handle,delta:input.delta,
        freedom:input.freedom,orientation:input.orientation,preserveAspect:input.preserveAspect,overrideLocked:input.overrideLocked}));
      assert.deepEqual(roots,before,'Must not mutate inputs');
      assert(plans.every(p=>p.ok),JSON.stringify(plans.filter(p=>!p.ok)));
      const old=new Map(before.flatMap(flatten).map(w=>[w.id,w])),final=new Map(plans.flatMap(p=>flatten(p.layer)).map(w=>[w.id,w]));
      for(const [id,w]of old){
        const expectedCommit=expected.commits.find(c=>c.id===id),got=final.get(id);
        for(const pair of [['x','y'],['width','height']]){
          const change=expectedCommit&&pair.some(k=>Math.abs(expectedCommit.rect[k]-w[k])>=1e-5);
          for(const k of pair)assert(close(got[k],change?expectedCommit.rect[k]:w[k]),`${id}.${k}: ${got[k]} != ${change?expectedCommit.rect[k]:w[k]}`);
        }
      }
      for(const p of plans)if(p.trace.length)assert.deepEqual(p.trace[0].delta,expected.entry.delta);
      results.push({name,passed:true,input,expected,observed:plans.map(p=>({patches:p.patches,trace:p.trace}))});
    }catch(error){results.push({name,passed:false,input,error:String(error.stack??error)});}
  }
  for(const handle of [1,2,3,4,6,8,9,12]){
    for(const delta of [{x:100,y:40},{x:-100,y:-40}])for(const locked of [false,true]){
      run(`shared-${handle}-${delta.x}-${locked?'locked':'free'}`,{
        roots:[group('left',[box('a',0,0,100,100)]),group('right',[box('b',300,0,100,100)],{locked})],handle,delta,
      });
    }
    // A translated, non-square selection verifies the shared absolute origin.
    run(`negative-origin-${handle}`,{roots:[
      group('left',[box('a',-300,-150,70,90)]),group('right',[box('b',-40,-50,80,130)]),
    ],handle,delta:{x:40,y:25}});
    // Existing low-level explicit freedom is intentionally not overwritten by MSON.
    run(`explicit-freedom-${handle}`,{roots:[
      group('left',[box('a',0,0,100,100)]),group('right',[box('b',300,0,100,100)]),
    ],handle,delta:{x:40,y:25},freedom:3});
  }
  // Overshoot can collapse an active axis to zero; that native outcome is outside
  // this product's positive-dimension model. Verify entry arithmetic separately
  // and require atomic rejection, never reflection or silent positive clamping.
  const selection={x:-100,y:-50,width:400,height:100};
  for(const handle of [1,2,3,4,6,8,9,12]){
    for(const delta of [{x:-600,y:-250},{x:600,y:250},{x:-600,y:250},{x:600,y:-250},{x:-400,y:-100},{x:400,y:100}]){
      const name=`entry-crossing-${handle}-${delta.x}-${delta.y}`;
      try{
        const entry=sourceEntry(handle,delta,selection), root=build(group('root',[box('whole',-100,-50,400,100)])),before=structuredClone(root);
        const frame=numeric.makeRect(selection.x,selection.y,selection.width,selection.height);
        const projected=numeric.runINw2(frame,frame,numeric.makeVector(entry.delta.x,entry.delta.y),frame,handle,entry.freedom,false,3,null,0).value;
        const actual=planAuthorLayerResize({layer:root,handle,delta});
        assert.deepEqual(root,before);
        const positive=projected.width>=1&&projected.height>=1&&[projected.x,projected.y,projected.width,projected.height].every(Number.isFinite);
        if(positive){
          assert(actual.ok,actual.reason);assert.deepEqual(actual.trace[0].delta,entry.delta);
          const got=actual.layer.layer.widgets[0];for(const k of ['x','y','width','height'])assert(close(got[k],projected[k]),`${k}: ${got[k]} != ${projected[k]}`);
        }else{assert.equal(actual.ok,false);assert.equal(actual.code,'invalid-result');}
        results.push({name,passed:true,input:{handle,delta,selection},entry,projected,policy:positive?'finite native result':'positive-size product rejection',observed:actual});
      }catch(error){results.push({name,passed:false,input:{handle,delta,selection},error:String(error.stack??error)});}
    }
  }
}finally{await server.close();}
const failed=results.filter(r=>!r.passed);
const report={
  schemaVersion:1,kind:'Independent CIL entry/default-axis/shared-selection differential review',
  originalDllExecuted:false,originalGuiCompared:false,
  sourceScope:{clamp:{token:100686248,firstOffset:786,lastOffset:905},axis:{token:100708345},rootDispatch:{token:100686249,callOffset:963}},
  sources:sources.map(s=>({...s,unchanged:hash(s.path)===s.sha256})),
  summary:{total:results.length,passed:results.length-failed.length,failed:failed.length},
  limitations:[
    'Retained CIL records execute in the declared JS interpreter. No original assembly or GUI executes.',
    'Selection members and their positive nonempty union are supplied facade data; this does not execute upstream editor selection.',
    'Locked selected visible roots remain in the supplied union and the original jbNm decides which commits to skip.',
    'MSON handle axes and CbNX clamp execute exact retained instruction records; root enumeration is an explicit loop at the proven call site.',
    'Zero/nonfinite dimensions are tested as an explicit product rejection policy, not as matching native acceptance.',
    'Notification/history UI and hidden/unplaced selection construction remain outside this probe.',
  ],results,
};
fs.writeFileSync(prefix+'probes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report.summary,sourceStable:report.sources.every(s=>s.unchanged),failures:failed.map(r=>({name:r.name,error:r.error}))}));
if(failed.length)process.exitCode=1;
