// Bind this new static research record; never rewrites prior evidence or production.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { sha256, readJson } from './gradient-angle-static-flow.mjs';
const dll = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
const dllHash = 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
assert.equal(sha256(dll), dllHash);
const probe = readJson('research/native-point-commit-format-probes.json');
assert.equal(probe.passed, 79); assert.equal(probe.results.length, 79);
const retained = [
  'research/scripts/inspect-rp-serialization.ps1',
  'research/gradient-angle-static-flow.mjs', 'research/gradient-angle-flow-init-cil.json',
  'research/native-point-editing-evidence-mode-cil.json', 'research/native-point-editing-evidence-state-cil.json',
  'research/native-point-editing-evidence.md', 'research/native-point-editing-format-evidence.md',
  'research/native-point-editing-format-inventory.json',
  'research/adaptive-all-views-effects-evidence.md', 'research/adaptive-all-views-effects-provider-set-cil.json',
  'research/adaptive-all-views-effects-provider-index-cil.json', 'research/adaptive-all-views-effects-adaptive-chain-cil.json',
  'research/adaptive-all-views-current-chain-cil.json', 'research/adaptive-all-views-current-provider-cil.json',
  'research/adaptive-all-views-properties-cil.json', 'research/adaptive-hierarchy-format-set-cil.json',
  'research/adaptive-hierarchy-format-view-cil.json', 'research/adaptive-behavior-format-scope-set-cil.json',
  'research/runtime-text-autofit-bridge-evidence.md', 'research/rp-next-coverage-textrect-cil.json',
  'research/native-pills-scalar-comparison-cil.json',
  'research/adaptive-placement-authoring-owner-cil.json',
  'research/native-point-commit-evidence-point-zero-cil.json',
  'research/native-point-commit-evidence-point-equality-cil.json',
  'research/native-point-commit-evidence-point-components-cil.json',
  'research/native-point-commit-evidence-entry-callers.json',
  'research/native-point-commit-evidence-pointmode-commit-cil.json',
];
const own = fs.readdirSync('research').filter(f => f.startsWith('native-point-commit-format-') && f.endsWith('-cil.json')).map(f => `research/${f}`);
const sources = [...new Set([dll, ...retained, ...own, ...probe.sources.map(s => s.path)])].map(path => ({ path, sha256: sha256(path) }));
for (const item of probe.sources) assert.equal(sha256(item.path), item.sha256, `Probe source changed: ${item.path}`);
const summary = {
  schema: 1, stage: 'native-point-commit-format', generatedAt: new Date().toISOString(),
  originalComparison: false, originalAxureGuiCompared: false, originalDllExecuted: false, productionModified: false,
  target: { version: '11.0.0.4150', path: dll, sha256: dllHash },
  ordinaryPointCommit: {
    entry: 'AjIh.Kj3n100685481 -> VectorShape.TN46100702684(points,false)',
    geometryScope: 'current effective provider only, Location and Size independently compared and atomically written',
    shared: ['Shape identity conversion is separate', 'ControlPoints normalized path'],
    autoFit: 'unchanged', allViewsFlagRead: false, inactiveMaps: 'unchanged',
    normalizedBounds: 'hN4K(false), peer geometry evidence; not the RN4I true-path contract',
    propertyIds: { location: 101, size: 105, rotationRead: 50 },
    equality: { components: ['x', 'y', 'width', 'height'], absoluteDifferenceLessThan: 0.00001 },
    sizeValidation: { baseNIuy: { token: 100695364, behavior: 'identity' }, minimumProvider: 100695441, perAxisMaximumWithMinimum: [100722980, 100688832], generalVirtualOverridesProven: false, native20000MaximumEstablished: false },
  },
  separateRN4I: {
    token: 100702640, normalizationFlag: true, autoFitWidth: false, autoFitHeight: false,
    scope: 'Base then assigned-set named views in stored order',
    eligibility: 'effective P111 != Ignore0 AND local OD P101/P105/P50 any',
    twoPhase: 'all effective frames read before all Location writes, followed by all Size writes',
    allViewsFlagRead: false, currentViewControlsScope: false, inactiveOrphanMapsEnumerated: false,
    caveat: 'Not the observed ordinary point-mode drag entry',
  },
  autoFitCarrier: { width: { key: 'AutoFitWidth', field: 'GNZZ', setter: 100702343 }, height: { key: 'AutoFitHeight', field: 'mNYN', setter: 100702367 }, pName: null, shared: true },
  history: { styleSnapshot: [100707201, 100707202], geometrySnapshot: [100707152, 100707153], restoration: 'MyStyle and complete fJZ4 cloned/restored, effective fit values restored', outerHistoryDispatcherExecuted: false },
  checks: { total: probe.results.length, passed: probe.results.length, originalExecution: 0 },
  limitations: ['No original GUI, DLL or native history transaction execution', 'Geometry and size-validation sinks are labelled in the scope replay', 'Ordinary adaptive-capable non-contained rotation-only owner contract; generic transform/master/temporary-provider gates remain separate', 'Boolean placement cannot distinguish native Ignore0 from FALSE2 for the separate RN4I route', 'RN4I dimension guard is not claimed to be a universal 20000 clamp'],
  sources,
  files: ['research/native-point-commit-format-evidence.md', 'research/native-point-commit-format-probe.mjs', 'research/native-point-commit-format-probes.json'].map(path => ({ path, sha256: sha256(path) })),
};
fs.writeFileSync('research/native-point-commit-format-evidence.json', JSON.stringify(summary, null, 2) + '\n');
const manifest = { schema: 1, stage: summary.stage, originalComparison: false, sources,
  files: [...summary.files, ...['research/native-point-commit-format-evidence.json', 'research/native-point-commit-format-freeze.mjs'].map(path => ({ path, sha256: sha256(path) }))] };
fs.writeFileSync('research/native-point-commit-format-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
for (const item of [...manifest.sources, ...manifest.files]) assert.equal(sha256(item.path), item.sha256);
console.log(JSON.stringify({ checks: summary.checks, hashes: manifest.sources.length + manifest.files.length, summarySha256: sha256('research/native-point-commit-format-evidence.json'), manifestSha256: sha256('research/native-point-commit-format-manifest.json') }));
