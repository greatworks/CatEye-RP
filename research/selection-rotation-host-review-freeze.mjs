import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const ref=path=>({path,sha256:sha(path)});
const final=read('research/selection-rotation-host-review-final-probes.json');
assert.equal(final.summary.failed,0);assert.equal(final.summary.total,73);assert(final.angleBoundaryReview.passed&&final.sourceStableDuringProbe);
for(const item of final.sources)assert.equal(sha(item.path),item.sha256,item.path);
const sourceMatrix=read('research/selection-rotation-host-review-source-probes.json');
for(const item of sourceMatrix.sources)assert.equal(sha(item.path),item.sha256,item.path);
const currentSourcePaths=[...final.sources.filter(item=>item.path.startsWith('src/')).map(item=>item.path),
 'tests/selection-pointer-rotate.test.ts','tests/selection-pointer-input.test.ts','tests/selection-author-edits.test.ts'];
const evidencePaths=['research/selection-rotation-host-review.md','research/selection-rotation-host-review-probe.mjs',
 'research/selection-rotation-host-review-probes.json','research/selection-rotation-host-review-final-probe.mjs',
 'research/selection-rotation-host-review-final-probes.json','research/selection-rotation-host-review-oracle.mjs',
 'research/selection-rotation-host-review-source-probe.mjs','research/selection-rotation-host-review-source-probes.json',
 'research/selection-rotation-host-review-constructor.mjs','research/selection-rotation-host-review-freedom-cil.json',
 'research/selection-rotation-host-review-freedom-callers.json','research/selection-rotation-host-review-freedom-set-callers.json',
 'research/selection-rotation-host-review-freeze.mjs','research/selection-rotation-input-evidence.md',
 'research/selection-rotation-input-evidence.json','research/selection-rotation-input-manifest.json',
 'research/selection-rotation-controller-evidence.md','research/selection-rotation-controller-evidence.json',
 'research/selection-rotation-model-angle-unit-probes.json','.build/selection-rotation-model-angle-red.json',
 '.build/selection-rotation-model-before-angle-constant/src/model/selection-pointer-rotate.ts'];
const artifact='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
const report={schemaVersion:1,status:'frozen',kind:'Independent readonly source/model/host integration review',
 originalDllExecuted:false,originalGuiCompared:false,browserStarted:false,productEdited:false,fullAxureParity:false,
 summary:{total:74,passed:74,failed:0,integration:73,angleBoundary:1,unresolvedConfirmedProductDefects:0},
 sourceComposition:{sessions:64,frames:256,constructorDerivedFreedoms:true},blockingFindings:[],
 fixedFindings:[{id:'K5wb-operation-order',status:'resolved',description:final.angleBoundaryReview.fixedDefect,
  regression:ref('research/selection-rotation-model-angle-unit-probes.json'),red:ref('.build/selection-rotation-model-angle-red.json')}],
 clarifications:['Upstream freedom is actual obNM constructor MSON(handle), matching existing App. Prior 256/32 fixtures had explicit freedom3 facade; they were not rewritten.',
  'The first 73-case review predated the angle-boundary fix and did not cover that boundary. Its bytes remain retained and are not claimed to bind final product.'],
 sourceStableDuringProbe:final.sourceStableDuringProbe,artifact:ref(artifact),sources:currentSourcePaths.map(ref),evidence:evidencePaths.map(ref),
 limits:['Readonly App handlers; actual browser/capture/OS keys verified separately by parent',
 'Ordinary unrotated multi Selection scope and explicit grid-only services',
 'Original union/provider/graphics/history facades and no DLL/GUI execution',
 'Current-view Location only; product atomic rollback and saved-document bounds are explicit product policies']};
fs.writeFileSync('research/selection-rotation-host-review.json',JSON.stringify(report,null,2)+'\n');
const paths=[...new Set([artifact,...currentSourcePaths,...evidencePaths,...sourceMatrix.sources.map(item=>item.path),
 'research/native-layers-format-extract.ps1','research/selection-pointer-modifiers-callers.ps1',
 'research/selection-rotation-host-review.json'])];
const manifest={schemaVersion:1,status:'frozen',originalDllExecuted:false,originalGuiCompared:false,files:paths.map(ref)};
for(const item of manifest.files)assert.equal(sha(item.path),item.sha256,item.path);
fs.writeFileSync('research/selection-rotation-host-review-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:paths.length,report:ref('research/selection-rotation-host-review.json'),manifest:ref('research/selection-rotation-host-review-manifest.json')},null,2));
