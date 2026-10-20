import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const file = p => ({ path: p, sha256: hash(p) });
const oraclePath = 'research/layer-resize-controller-planner-oracle.mjs';
const full = fs.readFileSync(oraclePath, 'utf8');
const boundary = full.indexOf('\nconst cases=[];');
assert(boundary > 0);
let isolated = full.slice(0, boundary)
  .replace("'./layer-resize-numeric-replay.mjs'", JSON.stringify(pathToFileURL(path.resolve('research/layer-resize-numeric-replay.mjs')).href));
const replace = (before, after) => {
  assert.equal(isolated.split(before).length, 2, `Single adapter anchor: ${before}`);
  isolated = isolated.replace(before, after);
};
replace('const root=build(input.root),c=controller([root],input.freedom??3);',
  'const roots=input.roots.map(build),selection=combine(roots.map(w=>w.aabb)),c=controller(roots,input.freedom??3);');
replace('};walk(root);', '};roots.forEach(walk);');
replace('rootFrame:root.rect,', 'rootFrame:selection,clampedDelta:{x:entryArgs[1],y:entryArgs[2]},');
replace('execute(100686249,[c,c.nodes[0],!!input.overrideLocked,root.rect,input.delta.x,input.delta.y,input.orientation??3,false,c.freedom,null,null]);', `
  // Execute only the retained common Resize entry clamp. The enclosing editor/
  // selection construction is a declared supplied-root facade, not inferred.
  const originalEntry=methods.get(100686248);
  const clampInstructions=originalEntry.Instructions.filter(i=>i.Offset>=786&&i.Offset<907);
  methods.set(100686248,{...originalEntry,Instructions:[...clampInstructions,{Offset:907,Op:'ret'}]});
  bind(100722026,1,([s])=>s.width);bind(100722027,1,([s])=>s.height);
  c[67119118]=selection;
  const entryArgs=[c,input.delta.x,input.delta.y];
  try{execute(100686248,entryArgs);}finally{methods.set(100686248,originalEntry);}
  for(const node of c.nodes)
    execute(100686249,[c,node,!!input.overrideLocked,selection,entryArgs[1],entryArgs[2],input.orientation??3,false,c.freedom,null,null]);
`);
isolated += '\nexport {oracle,numeric};';
const { oracle, numeric } = await import('data:text/javascript;base64,' + Buffer.from(isolated).toString('base64'));
const plannerPath='src/model/author-layer-resize.ts', plannerHash=hash(plannerPath);
const snapshot=`research/layer-resize-numeric-entry-review-${plannerHash.slice(0,12)}.ts.txt`;
if(!fs.existsSync(snapshot))fs.writeFileSync(snapshot,fs.readFileSync(plannerPath));
const server=await createServer({configFile:false,logLevel:'error',server:{middlewareMode:true},appType:'custom'});
const results=[];
try {
  const {createWidget}=await server.ssrLoadModule('/src/model/document.ts');
  const {planAuthorLayerResize}=await server.ssrLoadModule('/src/model/author-layer-resize.ts');
  const box=(id,x,y,width,height)=>({id,rect:{x,y,width,height}});
  const group=(id,children,more={})=>({id,children,...more});
  const build=spec=>spec.children
    ? {...createWidget('layer'),id:spec.id,locked:!!spec.locked,layer:{widgets:spec.children.map(build),propagate:false}}
    : {...createWidget('box'),id:spec.id,...spec.rect,rotation:spec.angle??0};
  for(const handle of [1,2,3,4,6,8,9,12]) {
    for(const delta of [{x:100,y:40},{x:-100,y:-40}]) {
      const input={roots:[group('left',[box('a',0,0,100,100)]),group('right',[box('b',300,0,100,100)])],handle,delta};
      const expected=oracle(input,numeric);
      const ownFramePlans=input.roots.map(root=>planAuthorLayerResize({layer:build(root),handle,delta}));
      // This represents the reviewed App's original targets.map call signature.
      const ownFrameGeometry=ownFramePlans.flatMap(plan=>plan.ok?plan.layer.layer.widgets.map(w=>({id:w.id,x:w.x,y:w.y,width:w.width,height:w.height})):[]);
      const nativeGeometry=expected.commits.map(c=>({id:c.id,x:c.rect.x,y:c.rect.y,width:c.rect.width,height:c.rect.height}));
      const equal=ownFramePlans.every(p=>p.ok)&&ownFrameGeometry.every((p,i)=>Object.keys(p).every(k=>typeof p[k]==='number'?Math.abs(p[k]-nativeGeometry[i][k])<1e-8:p[k]===nativeGeometry[i][k]));
      results.push({name:`shared-root ${handle}/${delta.x}/${delta.y}`,input,expected,ownFrameGeometry,ownFrameErrors:ownFramePlans.filter(p=>!p.ok),equal});
    }
  }
}finally{await server.close();}
const sources=[
  file('.build/next-layer-authoring/resize-propagation-cil.json'),
  file('research/layer-resize-controller-probe.mjs'),
  file(oraclePath),file('research/layer-resize-numeric-replay.mjs'),
];
const report={schemaVersion:1,originalDllExecuted:false,originalGuiCompared:false,
  kind:'Original CbNX Resize clamp slice + original jbNm/numeric CIL with supplied multi-root selection facade',
  entry:{token:100686248,firstOffset:786,lastOffset:905,thenRootsCallOffset:963},
  planner:{path:plannerPath,sha256:plannerHash,unchanged:hash(plannerPath)===plannerHash,retainedPath:snapshot},
  sources,summary:{total:results.length,different:results.filter(r=>!r.equal).length,same:results.filter(r=>r.equal).length},
  limits:['Selected roots and selection frame are supplied; upstream locked-selection membership is not executed.',
    'All supplied roots are Layers, so the source sizing-frame rotation is zero.',
    'Root enumeration is an explicit loop following the retained CbNX call site; only its clamp instructions and downstream consumers execute.',
    'The product comparison intentionally uses the original per-root call signature, documenting the integration gap rather than claiming a fixed shared-selection API was tested.'],
  results};
fs.writeFileSync('research/layer-resize-numeric-entry-review-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,planner:report.planner,example:results.find(r=>r.input.handle===12&&r.input.delta.x===100)}));
