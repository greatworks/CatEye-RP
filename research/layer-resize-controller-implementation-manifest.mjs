import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const read = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const record = file => ({file,sha256:sha(file)});
const frozenFile = 'research/layer-resize-controller-manifest.json';
const frozen = read(frozenFile);
const verified = new Set();
function verifyRefs(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.file === 'string' && typeof value.sha256 === 'string') {
    assert.equal(sha(value.file),value.sha256,`Frozen source drift: ${value.file}`);
    verified.add(value.file);
  }
  for (const child of Object.values(value)) verifyRefs(child);
}
verifyRefs(frozen);
const prod = 'src/model/author-layer-resize.ts';
assert.equal(sha(prod),'2d578f9151299197e9efb0e0f690449705991331f97a091860932e483e620bc6');
const testFile='tests/author-layer-resize.test.ts';
const resultFile='.build/layer-resize-controller-planner-accepted.json';
const result=read(resultFile), entry=read('research/layer-resize-controller-planner-entry-fixtures.json');
assert.equal(result.success,true);
assert.equal(result.numTotalTests,145);
assert.equal(result.numFailedTests,0);
assert.equal(entry.summary.total,54);
const newResearch=fs.readdirSync('research')
  .filter(file=>file.startsWith('layer-resize-controller-planner-'))
  .map(file=>'research/'+file).sort();
const dependencies=[
  'src/model/author-resize-solver.ts','src/model/resize-pins.ts','src/model/types.ts',
  'src/model/document.ts','src/model/adaptive.ts',
];
const stableEvidence=[
  frozenFile,'research/layer-resize-controller-evidence.json','research/layer-resize-controller-evidence.md',
  'research/layer-resize-controller-probe.mjs','research/layer-resize-controller-probes.json',
  'research/layer-resize-numeric-evidence.json','research/layer-resize-numeric-evidence.md',
  'research/layer-resize-numeric-manifest.json','research/layer-resize-numeric-replay.mjs',
];
const logs=[
  '.build/layer-resize-controller-planner-red.json',
  '.build/layer-resize-controller-planner-red.log',
  '.build/layer-resize-controller-planner-origin-first.json',
  '.build/layer-resize-controller-planner-crossing-red.json',
  '.build/layer-resize-controller-planner-crossing-red.log',
  '.build/layer-resize-controller-planner-entry-red.json',
  '.build/layer-resize-controller-planner-entry-red.log',
  resultFile,'.build/layer-resize-controller-planner-accepted.log',
  '.build/layer-resize-controller-planner-accepted-typecheck.log',
  '.build/layer-resize-controller-planner-entry-oracle.log',
];
const backupDir='.build/layer-resize-controller-before-crossing/';
const backups=fs.readdirSync(backupDir).map(file=>backupDir+file).sort();
const report={
  schemaVersion:1,stage:'layer-resize-controller-implementation',
  originalDllExecuted:false,originalGuiCompared:false,fullAxureParity:false,
  source:frozen.source,
  production:record(prod),tests:record(testFile),
  summary:{productTests:{total:145,passed:145,failed:0},typecheckExitCode:0,
    controllerCases:142,numericCases:5004,composedLowerLevelCases:78,
    entryReplay:{...entry.summary},frozenControllerReferencesVerified:verified.size},
  api:{
    name:'planAuthorLayerResize',authoritativeInput:'delta + handle',
    coordinates:'nearest page/state scope; Layer location is not accumulated',
    selectionRect:'optional common old visible selection bounds; default root derived frame',
    defaultFreedom:'W/E = 1, N/S = 2, corners = 3; explicit native freedom retained',
    currentAdaptiveOnly:true,shapeTextShared:true,atomicFailure:true,
    geometryPatch:'complete changed Location/Size pairs; each pair preserves omission under native strict 1e-5 equality',
  },
  sourceMethods:[
    {token:100686217,name:'obNM constructor',role:'MSON(handle) to movement freedom',il:'0x6D–0x74'},
    {token:100708345,name:'MSON',role:'Left/Right -> horizontal; Top/Bottom -> vertical'},
    {token:100686248,name:'CbNX',role:'common selection frame and entry clamp then ordered roots',il:'0x2F4–0x3C3'},
    {token:100686207,name:'TbN1 constructor',role:'ordered membership/contact subset'},
    {token:100686249,name:'jbNm',role:'two-pass member resize, immutable snapshots and lock/fit gates'},
    {token:100686251,name:'ubNp',role:'contacting member predictions'},
    {token:100686252,name:'kbNq',role:'pin/fixed facts and exact Control+Alt bypass'},
    {token:100686253,name:'JbNd',role:'fit effects before geometry'},
    {token:100695371,name:'YJ0S',role:'ordinary Size then Location current provider writes'},
    {token:100720526,name:'k5pM',role:'candidate union'},
    {token:100720611,name:'BoundingRect fold',role:'union reducer'},
    {token:100720524,name:'H5px',role:'finite positive rectangle min/max union'},
  ],
  supported:['layer nesting','box','ellipse','path','text','button','image','placeholder','line','input','textarea','select','hotspot','inlineFrame'],
  unsupported:['panel','repeater','table/tableCell','menu','tree/treeNode','checkbox/radio',
    'component instances and embedded compound payloads','new Connector behavior',
    'native ImageBox FitToImage flag not represented in the current model'],
  limitations:[
    'Static CIL interpretation only; no original assembly or GUI execution',
    'Native selection discovery, editor visibility overrides and hidden/unplaced selected-root differences between KJYm and SJYh remain outside the ordinary visible-selection entry',
    'Native undo/notification/snapping behavior not executed; host history is independently implemented',
    'Product minimum dimension 1, coordinate/dimension bound 100000, depth/node and ID guards are document constraints',
    'Zero and empty resize trees/results are rejected atomically rather than claimed native-equivalent',
    'Inspector each-root requested size is an explicit product policy; pointer multi-root requires common selectionRect',
  ],
  failures:{
    baseline107:record('.build/layer-resize-controller-before-crossing/layer-resize-controller-planner-origin-first.json'),
    beforeSource:record('.build/layer-resize-controller-before-crossing/author-layer-resize.ts'),
    crossing:{...record('.build/layer-resize-controller-planner-crossing-red.json'),total:114,failed:4},
    entry:{...record('.build/layer-resize-controller-planner-entry-red.json'),total:123,failed:13},
    accepted:{...record(resultFile),total:145,passed:145,failed:0},
  },
  sources:[record(prod),record(testFile),...dependencies.map(record),...stableEvidence.map(record)],
  evidence:newResearch.map(record),logs:logs.map(record),backups:backups.map(record),
};
const jsonFile='research/layer-resize-controller-implementation.json';
fs.writeFileSync(jsonFile,JSON.stringify(report,null,2)+'\n');
const manifest={
  schemaVersion:1,stage:report.stage,source:frozen.source,
  originalDllExecuted:false,originalGuiCompared:false,
  summary:report.summary,sources:report.sources,
  files:[...report.evidence,...report.logs,...report.backups,
    record('research/layer-resize-controller-implementation.md'),record(jsonFile),
    record('research/layer-resize-controller-implementation-manifest.mjs')],
};
const manifestFile='research/layer-resize-controller-implementation-manifest.json';
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
verifyRefs(manifest);
console.log(JSON.stringify({manifest:record(manifestFile),report:record(jsonFile),
  product:record(prod),tests:record(testFile),summary:report.summary,hashRecords:manifest.sources.length+manifest.files.length}));
