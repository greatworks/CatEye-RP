import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const pin = file => ({ path: file.replaceAll('\\', '/'), sha256: sha(fs.readFileSync(file)), bytes: fs.statSync(file).size });
const probe = JSON.parse(fs.readFileSync('research/runtime-transform-motion-final-probes.json', 'utf8'));
assert.equal(probe.totals.total, 36); assert.equal(probe.totals.failed, 0);
for (const item of [...probe.sources, probe.script]) assert.equal(pin(item.path).sha256, item.sha256, item.path);
const old = JSON.parse(fs.readFileSync('research/runtime-rotate-motion-evidence.json', 'utf8'));
const doc = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/doc.js';
assert.equal(pin(doc).sha256, '986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1');
const sourceRoot = path.dirname(doc);
const locations = [
  ['RTM-01', 'action.js', [[14, 126], [143, 240], [359, 367], [702, 740], [1258, 1283]], 'Two queue layers; normal and special targets; Wait batch boundary'],
  ['RTM-01', 'events.js', [[365, 394], [467, 468]], 'Event-tail flush'],
  ['RTM-01', 'doc.js', [[175, 207]], 'Relative object path, limbo exclusion, concrete targets'],
  ['RTM-02', 'action.js', [[247, 349]], 'Priority, slice durations, easing, consumed stop intervals'],
  ['RTM-03', 'action.js', [[866, 1042], [1091, 1101], [1425, 1463], [1528, 1551]], 'Move/size evaluation, cache and OnRotate order'],
  ['RTM-03', 'utils.temp.js', [[5, 49]], 'Actual filtered eventCopy nested identity'],
  ['RTM-04', 'action.js', [[1422, 1431], [1571, 1586]], 'Ordinary changed-size double-ratio CSS request'],
  ['RTM-05', 'action.js', [[1192, 1237], [1333, 1399], [1444, 1506], [1608, 1651]], 'Separate anchors, ignored direction, orbit and resize-offset carriers'],
  ['RTM-06', 'axQuery.std.js', [[75, 81], [541, 566], [570, 826]], 'Eligibility, public resize caches, animation targets, completion'],
  ['RTM-06', 'move.js', [[84, 108], [120, 224], [256, 381]], 'Move trajectories and completion; circular incremental resize shift'],
];
const plan = [
  { phase: 'exact-queue-composition', browser: false, status: 'planned-not-run', coverage: ['occupied channel heads', 'successor release ordering', 'Wait/new event batch', 'reentrant OnRotate/OnMove/OnResize', 'shared cache lifetime', 'instant pending channel branch'] },
  { phase: 'changing-size-real-DOM', browser: true, status: 'deferred-until-parent-slot', coverage: ['200x100 to300x160', '40/70/100 unequal duration', 'same-duration pairs and triples', 'all6 triple orders', 'By/To and clockwise', 'Resize vs Rotate anchor', 'angle0/30/90', 'shadow and geometry caches', 'zero dimensions/coordinates', 'intermediate CSS and getter', 'queue successor and event order'] },
  { phase: 'layer-and-layout', browser: true, status: 'planned-not-run', coverage: ['nativeLayer/nestedLayer', 'eligible/noneligible child', 'fixed/percent panel', 'manually resized textarea', 'thisItem', 'widgetsBelow/Right'] },
  { phase: 'interruption', browser: true, status: 'planned-not-run', coverage: ['DOM stop', 'CSS overwrite', 'detach/same-ID replacement', 'adaptive clear', 'row refresh', 'element vs private animation targets'] },
];
const report = {
  schema: 1, capturedAt: new Date().toISOString(), status: 'source-first-bounded-contract-and-next-probe-plan',
  scope: 'New research only; no product, tests, old evidence, artifacts or research/scripts changes; no browser executed.',
  extractionEvidence: 'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
  distributionSha256: 'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',
  sources: [...probe.sources, pin(doc)], locations: locations.map(([evidenceId, file, ranges, claim]) => ({ evidenceId, path: path.join(sourceRoot, file).replaceAll('\\', '/'), ranges, claim })),
  execution: { kind: probe.kind, totals: probe.totals, browserCount: 0, substitutions: probe.substitutions, slices: probe.slices },
  numericFixtures: [
    { evidenceId: 'RTM-04', old: [200, 100], target: [300, 160], stop: [0, 100, 100], requestedCss: [300, 160] },
    { evidenceId: 'RTM-04', old: [200, 100], target: [300, 160], stop: [0, 50, 100], requestedCss: [225, 115] },
    { evidenceId: 'RTM-04', old: [200, 100], target: [300, 160], stop: [0, 40, 100], requestedCss: [216, 109.6] },
  ],
  contract: {
    batchingIdentity: 'eventInfo.idToResizeMoveState + concreteElementId + operation channel',
    leaderPriority: ['resize', 'rotate', 'move'], easingPriority: ['move-if-present', 'resize-if-leader', 'rotate'],
    slices: 'minimum remaining duration; per-channel start/end/len; slice easing restarts',
    separateAnchors: true, resizeLedIgnoresClockwise: true,
    eventCopyNestedIdentity: 'source-tested shared references for ordinary nested/map/drag carriers despite name deepCopy',
    actualChangingSizeDomClaim: false,
    recommendedImplementationState: ['event-local pending operation queues and used time', 'global concrete-target channel reservations', 'per-operation expression caches', 'separate size anchor/rotation anchor', 'separate drawn and moved/resized/rotated caches', 'original callback-specific release and fit sequence'],
  },
  plan,
  evidence: ['research/runtime-transform-motion-first-probes.json', 'research/runtime-transform-motion-probes.json', 'research/runtime-transform-motion-final-probes.json', 'research/runtime-rotate-motion-evidence.md', 'research/runtime-rotate-motion-evidence.json', 'research/runtime-rotate-motion-probes.json'].map(pin),
  tests: ['research/runtime-transform-motion-probe.mjs', 'research/runtime-transform-motion-report.mjs'].map(pin),
  reports: [pin('research/runtime-transform-motion-evidence.md')],
  historicalFailureClassification: { 'first-probes': '31/33, two harness-only errors; final has both corrected', 'probes': '33/33', 'final-probes': '36/36;3extra exact eventCopy identity checks' },
  remainingGaps: ['actual changing-size simultaneous DOM tween and timer ordering', 'full consumer queue successor semantics including duplicate Move release', 'instant-other-channel reachability/nonprogress behavior', 'nativeLayer recursion and split sizing', 'fixed/percent/RDO/contained layout', 'full lifecycle and event reentrancy'],
};
const destination = 'research/runtime-transform-motion-evidence.json';
assert.equal(fs.existsSync(destination), false, 'Do not overwrite an existing evidence report');
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ report: pin(destination), markdown: report.reports[0], tests: report.execution.totals, sourcePins: report.sources.length }));
