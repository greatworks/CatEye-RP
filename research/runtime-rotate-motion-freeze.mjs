import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bound=rel=>({path:rel.replaceAll('\\','/'),sha256:digest(fs.readFileSync(path.resolve(root,rel)))});
const probe=JSON.parse(fs.readFileSync(path.join(root,'research/runtime-rotate-motion-probes.json')));
const prior=JSON.parse(fs.readFileSync(path.join(root,'research/rotation-runtime-evidence.json')));
assert.equal(probe.summary.failed,0);
assert.deepEqual(probe.requests,[]);assert.deepEqual(probe.errors,[]);
assert.equal(probe.script.sha256,bound(probe.script.path).sha256);
for(const source of probe.sources)assert.equal(bound(source.path).sha256,source.sha256);
const dll=prior.sources.find(s=>s.path.endsWith('/AxureRP11.dll'));
assert.equal(bound(dll.path).sha256,dll.sha256);
const selected=probe.results.filter(x=>/^(angle-|gate-|rotated-local-offset-|native-bounds-|layer-split-|retained-tween-|batch-|stop-|coalesced-)/.test(x.name));
const fixtures={schema:1,kind:'actual retained source outputs with declared VM/browser sinks; not independent implementation simulation',probe:bound('research/runtime-rotate-motion-probes.json'),tolerances:{transcendental:1e-9,browserAngle:0.001,browserOrbit:0.05},fixtures:selected.map(x=>({name:x.name,kind:x.kind,observed:x.observed}))};
fs.writeFileSync(path.join(root,'research/runtime-rotate-motion-fixtures.json'),JSON.stringify(fixtures,null,2)+'\n');
const jquery=fs.readFileSync(probe.sources.find(x=>x.path.endsWith('/jquery-3.7.1.min.js')).path,'utf8');
const easingStart=jquery.indexOf('Y = {}, V.each(["Quad"'),easingEnd=jquery.indexOf('; y = V.effects',easingStart);
assert.ok(easingStart>=0&&easingEnd>easingStart);
const sources=[dll,...probe.sources];
const evidence=[
  'research/runtime-rotate-motion-evidence.md','research/runtime-rotate-motion-probes.json',
  'research/runtime-rotate-motion-fixtures.json','research/runtime-rotate-motion-first-probes.json',
  'research/rotation-runtime-evidence.md','research/rotation-runtime-evidence.json',
].map(bound);
const report={
  schema:1,version:'Axure RP 11.0.0.4150',capturedAt:new Date().toISOString(),
  packageSha256:prior.packageSha256,extractionEvidence:prior.extractionEvidence,
  method:'39 exact-source NodeVM cases with declared sinks and 92 actual Edge cases using retained complete jQuery plus exact Axure slices; no vendor GUI/DLL execution and no product edits',
  sources,evidence,tests:[bound('research/scripts/probe-runtime-rotate-motion.mjs'),bound('research/runtime-rotate-motion-freeze.mjs')],implementation:[],screenshots:[],
  validation:{...probe.summary,nodeVm:probe.results.filter(x=>x.kind==='exact-source-node-vm-with-explicit-sinks').length,browser:probe.results.filter(x=>x.kind.startsWith('actual-edge')).length,requests:0,pageErrors:0},
  sourceSlices:probe.ranges,
  jqueryEasing:{path:probe.sources.find(x=>x.path.endsWith('/jquery-3.7.1.min.js')).path,coordinateSystem:'UTF-16 code units in decoded UTF-8 source',start:easingStart,endExclusive:easingEnd,sha256:digest(jquery.slice(easingStart,easingEnd)),functions:32,samplesPerTween:7,unexpectedNames:{Expo:'inward p^6',Back:'inward p*p*(3*p-2)'}},
  claims:[
    {id:'RRM-01',source:'action.js:1061-1256; doc.js:195-207',contract:'start-time expressions; clockwise sign; To direct subtraction; next action not awaiting animation'},
    {id:'RRM-02',source:'move.js:442-491',contract:'integer inline angle retained, fractional computed-matrix atan2 getter'},
    {id:'RRM-03',source:'action.js:1192-1223; move.js:256-381; axQuery.std.js:1438-1575',contract:'CSS center vs offset orbital path; local anchor rotation; shadow-aware bounds center; type eligibility'},
    {id:'RRM-04',source:'math.js:88-101; action.js:1109-1161,1240-1256',contract:'native layer deep recursion incl hidden; separate stored layer angle; split-stop quirk'},
    {id:'RRM-05',source:'action.js:5-349; events.js:394',contract:'per-ID per-kind queues; action-group barrier; duration slicing; per-slice easing selection'},
    {id:'RRM-06',source:'action.js:1180; move.js:338-381; axQuery.std.js:541-568; repeater.js:1590-1626',contract:'OnRotate before mutation; target cache vs live CSS; queue before fit before annotation; two offset fit callbacks'},
    {id:'RRM-07',source:'jquery-3.7.1.min.js full pinned dependency and source fragment above',contract:'32 real easing funcs; elapsed timer animation; step before object property update'},
    {id:'RRM-08',source:'move.js:327-381; adaptive.js:69-87,137-151; repeater.js:1070-1078',contract:'private-object tween unaffected by DOM stop/removal; full page/row lifecycle remains bounded unknown'},
    {id:'RRM-09',source:'action.js:1286-1506; move.js:383-440; axQuery.std.js:559-568',contract:'Resize-coalesced clockwise omission; separately unused compound helper; public multi-target fit closure'},
  ],
  limits:probe.substitutions.concat([
    'No entire generated page/author GUI observation. Parent fitting is source-executed route logic with sinks, not real parent layout.',
    'Changed-size combined Resize geometry, fixed positioning, RDO/master containment, full repeater/adaptive/page races and annotation layout are not closed.',
    'Target path/limbo expansion is static corroboration here, not executed by the browser action fixture.',
    'First 76/77 run preserved; its compound cos90 equality assertion was a harness bug. Earlier harness source revision was not separately retained.',
    'No clean modulo angle normalization, shortest-path interpolation, panel-as-layer substitution or transaction rollback is attributed to native behavior.',
  ]),
};
fs.writeFileSync(path.join(root,'research/runtime-rotate-motion-evidence.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({validation:report.validation,evidence:bound('research/runtime-rotate-motion-evidence.json'),markdown:bound('research/runtime-rotate-motion-evidence.md'),fixtures:bound('research/runtime-rotate-motion-fixtures.json'),probe:bound('research/runtime-rotate-motion-probes.json'),script:bound('research/scripts/probe-runtime-rotate-motion.mjs')},null,2));
