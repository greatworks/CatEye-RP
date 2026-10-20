import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const prefix = 'research/runtime-transform-browser-';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const record = file => ({ path: file.replaceAll('\\', '/'), sha256: sha(fs.readFileSync(file)), bytes: fs.statSync(file).size });
const read = suffix => JSON.parse(fs.readFileSync(prefix + suffix + '.json', 'utf8'));
const final = read('final-probes'), repeat = read('confirmation-probes');
const to = read('to-probes'), toRepeat = read('to-confirmation-probes');
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
assert.deepEqual(final.summary, { total: 88, passed: 88, failed: 0 });
assert.deepEqual(repeat.summary, final.summary);
assert.equal(final.script.sha256, record(prefix + 'probe.mjs').sha256);
assert.equal(repeat.script.sha256, final.script.sha256);
for (const r of [to, toRepeat]) {
  assert.deepEqual(r.summary, { total: 10, passed: 10, failed: 0 });
  assert.equal(r.harness.sha256, final.script.sha256);
  assert.equal(r.script.sha256, record(prefix + 'to-probe.mjs').sha256);
}
for (const r of [final, repeat, to, toRepeat]) {
  assert.equal(r.requests.length, 0); assert.equal(r.errors.length, 0); assert.equal(r.fatal, undefined);
  for (const source of r.sources) assert.equal(record(source.path).sha256, source.sha256);
}
for (const [suffix, script] of [['expanded-probes', 'expanded-probe.mjs'], ['closure-probes', 'closure-failed-probe.mjs']]) {
  assert.equal(read(suffix).script.sha256, record(prefix + script).sha256);
}
const originalPins = [
  ['research/runtime-transform-motion-evidence.md', '627974789b105c1d39e0fda8f69ad2c76bb83c44342f967d6db2189e9a6a119b'],
  ['research/runtime-transform-motion-evidence.json', 'dca7a6e57da97c0e4021fa6df8311258ef788ddb85803cbcd6127fadaa6c0151'],
  ['research/runtime-transform-motion-final-probes.json', 'c5838542ffd7b21cd6a24d897f1ffd9ba1cfb32c44cc0f1eb9f071cb50787e03'],
];
for (const [file, hash] of originalPins) assert.equal(record(file).sha256, hash, 'Frozen previous-stage bytes');

const wanted = (r, name) => { const x = r.results.find(x => x.name === name); assert.ok(x, name); return x; };
const firstW = 200 + Math.round(300 - 200) * (40 / 70) ** 2;
const firstH = 100 + Math.round(160 - 100) * (40 / 70) ** 2;
const finalW = firstW + Math.round(300 - firstW);
const finalH = firstH + Math.round(160 - firstH);
const verified = [];
for (const r of [final, repeat]) {
  for (const x of r.results.filter(x => /^triple-/.test(x.name))) {
    const unequal = x.name.endsWith('-unequal');
    near(x.observed.final.resized.width, unequal ? finalW : 300);
    near(x.observed.final.resized.height, unequal ? finalH : 160);
    near(x.observed.final.moved.left, 140); near(x.observed.final.moved.top, 120);
    near(x.observed.final.angle, 90);
  }
  for (const pair of ['move-resize', 'resize-move']) {
    const x = wanted(r, 'pair-' + pair + '-unequal');
    near(x.observed.final.resized.width, finalW); near(x.observed.final.resized.height, finalH);
  }
  near(wanted(r, 'split-direction-switch-delta').observed.final.angle, 66);
  near(wanted(r, 'split-direction-switch-location').observed.final.angle, -90);
  for (const x of r.results.filter(x => x.name.startsWith('successor-move-overlap-repeat-'))) near(x.observed.final.moved.left, 240);
  verified.push({ capturedAt: r.capturedAt, checks: 'Independent size formula, all 12 triple permutations/duration modes, two unequal Move+Resize orders, split direction and four successor caches', passed: true });
}
for (const r of [to, toRepeat]) {
  for(const x of r.results.filter(x=>/^long-move-to-(move|resize|rotate)/.test(x.name))) {
    const starts=x.observed.trace.filter(t=>t.kind==='animate-start');
    const sizeStarts=starts.filter(t=>t.detail.properties.width!==undefined);
    const directMove=starts.find(t=>t.detail.targetKind==='element');
    assert.ok(sizeStarts[1].n < directMove.n);
    near(sizeStarts[1].snapshot.moved.left,128);
    near(Number(directMove.detail.properties.left.slice(2)),12);
    near(directMove.snapshot.moved.left,140);
    assert.ok(directMove.snapshot.x<128);
  }
  verified.push({capturedAt:r.capturedAt,checks:'All six long-Move-To orders: second Resize starts before final direct Move, 128 cache then +=12 from earlier CSS, final cache140',passed:true});
}

const compact = x => ({
  name: x.name, configuration: x.configuration, passed: x.passed,
  resultKind: x.name.startsWith('bounded-') ? 'bounded pathological dispatch; not a completed animation' : 'completed actual DOM animation',
  final: x.observed?.final,
  emittedSegments: x.observed?.trace?.filter(t => t.kind.startsWith('planned-')).map(t => ({ kind: t.kind, detail: t.detail })),
  eventOrder: x.observed?.trace?.filter(t => t.kind === 'event').map(t => t.detail),
  error: x.observed?.error?.split('\n').slice(0, 4).join('\n'),
});
const fixtureFile = prefix + 'fixtures.json';
const fixtures = {
  schema: 1,
  provenance: record(prefix + 'final-probes.json'),
  confirmation: record(prefix + 'confirmation-probes.json'),
  toSupplement: record(prefix + 'to-probes.json'),
  toConfirmation: record(prefix + 'to-confirmation-probes.json'),
  defaultOwner: { x: 100, y: 100, width: 200, height: 100, rotation: 0 },
  tolerances: { deterministicCaches: 1e-9, orbitalCaches: 1e-7, css: 'Do not assert exact orbital/intermediate/successor CSS; browser serialization and real scheduler vary.' },
  formula: { expression: 'old + Math.round(requested-old) * ((end-start)/(len-start))**2', firstW, firstH, finalW, finalH },
  expressionTypeBoundary: 'Downstream-only controlled values. Original expression interpreter is not loaded; numeric0 is NOT asserted to be the value produced by ordinary user input 0.',
  checks: verified,
  cases: [...final.results,...to.results].map(compact),
  repeatSuccessorObservations: [final, repeat].map(r => ({ capturedAt: r.capturedAt, values: r.results.filter(x => x.name.startsWith('successor-move-overlap-repeat-')).map(x => ({ name: x.name, cssX: x.observed.final.x, cacheX: x.observed.final.moved.left })) })),
};
fs.writeFileSync(fixtureFile, JSON.stringify(fixtures, null, 2) + '\n');

const sources = final.sources.map(source => ({ ...source, execution: 'Loaded exact source or listed slices in actual Edge' }));
const prior = JSON.parse(fs.readFileSync('research/runtime-transform-motion-evidence.json', 'utf8'));
for (const name of ['events.js', 'doc.js']) {
  const p = prior.sources.find(x => x.path.endsWith('/' + name));
  assert.equal(record(p.path).sha256, p.sha256);
  sources.push({ ...p, execution: 'Static prior-stage event/target context only; not loaded in this browser harness' });
}
const runs = [
  ['first-probes', '43 initial observation checks; historical evolving script unavailable separately; nonfinite cache JSON null'],
  ['expanded-probes', '72/74; two incorrect expectations numeric0 vs string0; exact script revision preserved'],
  ['closure-probes', 'Fatal harness circular JSON serialization; no returned result set; exact script revision preserved'],
  ['final-probes', '88/88; 85 completed ordinary cases and three bounded source-defect cases'],
  ['confirmation-probes', '88/88 confirmation using identical source/script bytes'],
  ['to-probes', '10/10 actual Move-To DOM supplement using unchanged primary bootstrap'],
  ['to-confirmation-probes', '10/10 Move-To confirmation with identical source/script bytes'],
].map(([suffix, interpretation]) => ({ ...record(prefix + suffix + '.json'), summary: read(suffix).summary, interpretation }));
const staticLocations = [
  { id: 'RTB-02', file: 'action.js', ranges: [[143, 240], [247, 349], [1422, 1428], [1571, 1586]] },
  { id: 'RTB-03', file: 'action.js', ranges: [[866, 1042], [1444, 1476], [1528, 1551]] },
  { id: 'RTB-04', file: 'action.js', ranges: [[1444, 1506]] },
  { id: 'RTB-04', file: 'move.js', ranges: [[256, 335]] },
  { id: 'RTB-05', file: 'axQuery.std.js', ranges: [[656, 663], [722, 734], [807, 826]] },
  { id: 'RTB-06', file: 'action.js', ranges: [[178, 193], [756, 764]] },
  { id: 'RTB-07', file: 'action.js', ranges: [[1528, 1551]] },
  { id: 'RTB-07', file: 'axQuery.std.js', ranges: [[75, 81], [570, 589], [729, 734]] },
].map(x => ({ ...x, path: sources.find(s => s.path.endsWith('/' + x.file)).path }));
const evidenceFiles = [prefix + 'evidence.md', prefix + 'probe.mjs', prefix + 'to-probe.mjs', prefix + 'record.mjs', prefix + 'expanded-probe.mjs', prefix + 'closure-failed-probe.mjs', fixtureFile].map(record);
const report = {
  schema: 1, capturedAt: new Date().toISOString(), status: 'frozen bounded changing-size browser evidence',
  target: 'Axure RP 11.0.0.4150',
  distributionSha256: prior.distributionSha256, extractionEvidence: prior.extractionEvidence,
  method: 'Actual Edge + full retained jQuery/UI + exact Axure action/queue/motion/bounds/cache source, controlled dependency services; no original generated page, DLL execution or GUI.',
  environment: final.environment,
  summary: { uniqueCases:98, casesPerPrimaryRun: 88, passingPerPrimaryRun: 88, primaryRuns:2, casesPerToSupplementRun:10, passingPerToSupplementRun:10, toSupplementRuns:2, normalCompletedUniqueCases: 95, boundedPathologicalUniqueCases: 3, networkRequests: 0, uncaughtPageErrors: 0 },
  sources, slices: final.slices, locations: staticLocations, runs,
  evidence: evidenceFiles, previousFrozenEvidence: originalPins.map(([file]) => record(file)),
  substitutions: final.substitutions,
  additionalBoundaries: [
    'Only three pathological cases enable a consumer-budget guard; it stops before the eleventh delegated call, with original source loop and first ten delegates untouched.',
    'Synthetic events invoke logging/selected variable hooks, not full case dispatch. Event-tail flush is explicit.',
    'Size numeric0 result is a downstream coercion edge for controlled primitive values, not proof of native user input 0 behavior.',
    'Type-specific fixtures are outer DIVs, not actual native control/iframe/panel structures.',
    'Clock times, per-frame values and overlapping successor CSS endpoints are observations; deterministic cache and causal-order expectations are separate.',
  ],
  remainingGaps: ['native Layer resize/recursion', 'actual parent fit and containment mutations', 'percentage/fixed panels and native control internals', 'full expression/event interpreter', 'real repeater target resolution', 'combined-motion adaptive/navigation/row/DOM interruption'],
  productChanges: [],
};
fs.writeFileSync(prefix + 'evidence.json', JSON.stringify(report, null, 2) + '\n');
const files = [...evidenceFiles, ...runs.map(({path, sha256, bytes}) => ({path, sha256, bytes})), record(prefix + 'evidence.json')];
fs.writeFileSync(prefix + 'manifest.json', JSON.stringify({ schema: 1, capturedAt: report.capturedAt, sources, files, previousFrozenEvidence: report.previousFrozenEvidence }, null, 2) + '\n');
console.log(JSON.stringify({ report: record(prefix + 'evidence.json'), manifest: record(prefix + 'manifest.json'), summary: report.summary }, null, 2));
