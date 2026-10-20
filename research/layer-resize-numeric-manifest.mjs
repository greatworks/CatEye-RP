import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const prefix = 'research/layer-resize-numeric-';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const sha = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const file = path => ({ path, sha256: sha(path) });
const probes = read(prefix + 'probes.json');
assert.deepEqual(probes.summary, {
  total: 5004, passed: 5004, failed: 0,
  groups: { pin: 3000, projection: 672, aspect: 384, 'sizing-bounds': 24, evaluator: 480, 'evaluator-pin': 300, 'evaluator-edge': 144 },
});
assert.equal(sha(probes.original.path), probes.original.sha256);
for (const source of probes.sources) assert.equal(sha(source.path), source.sha256, source.path);

const fallbackFiles = [
  prefix + 'first-formula.mjs.txt', prefix + 'first-replay.mjs.txt', prefix + 'first-probe.mjs.txt',
  prefix + 'second-formula.mjs.txt',
];
const fallbacks = new Map(fallbackFiles.map(path => [sha(path), path]));
const history = ['first', 'second'].map(stage => {
  const path = prefix + stage + '-probes.json';
  const report = read(path);
  const bindings = report.sources.map(source => {
    const currentMatches = fs.existsSync(source.path) && sha(source.path) === source.sha256;
    const retainedPath = currentMatches ? source.path : fallbacks.get(source.sha256);
    assert(retainedPath, `Missing retained bytes for ${stage}: ${source.path} ${source.sha256}`);
    assert.equal(sha(retainedPath), source.sha256);
    return { originalPath: source.path, sha256: source.sha256, retainedPath, historicalBytesVerified: true };
  });
  return {
    ...file(path), summary: report.summary, sourceBindings: bindings,
    interpretation: 'Disagreement in the independently expressed research formula; not an original DLL execution or product failure.',
  };
});

const redPath = '.build/layer-resize-numeric-product-red.json';
const greenPath = '.build/layer-resize-numeric-product-green.json';
const red = read(redPath), green = read(greenPath);
assert.equal(red.success, false);
assert.equal(red.numTotalTests, 0);
assert.equal(red.numFailedTestSuites, 1);
assert.equal(green.success, true);
assert.equal(green.numPassedTests, 8);
assert.equal(green.numFailedTests, 0);

const sourcePaths = [...new Set([
  probes.original.path, ...probes.sources.map(s => s.path),
  'research/native-layers-format-extract.ps1',
])];
const evidencePaths = [
  prefix + 'evidence.md', prefix + 'probes.json', ...history.map(item => item.path), ...fallbackFiles,
  prefix + 'layer-bounds.mjs', prefix + 'layer-bounds.json', prefix + 'layer-bounds-before.ts.txt',
];
const implementation = [file('src/model/author-resize-solver.ts')];
const tests = [file('tests/author-resize-solver.test.ts'), file(redPath), file(greenPath)];
const sources = sourcePaths.map(file);
const evidence = evidencePaths.map(file);
const output = {
  schemaVersion: 1,
  stage: 'layer-resize-numeric',
  source: { ...probes.original, version: '11.0.0.4150' },
  kind: probes.kind,
  originalDllLoaded: false, originalDllMethodsExecuted: false, originalGuiCompared: false,
  summary: probes.summary,
  methods: [
    { id: 'LRN-01', token: 100703557, name: 'IxEvaluator.INw2', source: '.build/next-layer-authoring/constraint-bridge-cil.json', role: 'Full numeric evaluator, rotation and PinInfo dispatch' },
    { id: 'LRN-02', token: 100703558, name: 'IxEvaluator.tNwh', source: prefix + 'solver-cil.json', role: 'Preliminary AABB and parent projection' },
    { id: 'LRN-03', token: 100703559, name: 'IxEvaluator.mNwa', source: prefix + 'solver-cil.json', role: 'Per-axis pin and fixed-size correction' },
    { id: 'LRN-04', token: 100721966, name: 'f5wV.g5w3', role: 'Aspect-ratio constraint including equality early return' },
    { id: 'LRN-05', tokens: [100722221, 100722216, 100722239], name: 'g5s7 rotated sizing frame', role: 'Degree-based frame and AABB, retained near-one shortcut' },
    { id: 'LRN-06', tokens: [100708343, 100708486], name: 'cSqL.Rotate and handle-list initializer', role: 'Eight-handle nearest-octant rotation; initializer IL 0xAB5..0xAF4' },
  ],
  contract: {
    numericOnly: true, positionBits: { left: 1, top: 2, right: 4, bottom: 8 },
    handleOrder: [3, 2, 6, 4, 12, 8, 9, 1],
    horizontalPins: { none: 0, left: 1, right: 4, both: 5, center: 256 },
    verticalPins: { none: 0, top: 2, bottom: 8, both: 10, center: 512 },
    orientation: { horizontal: 0, vertical: 1, both: 2, none: 3 },
    freedomAxisBits: { horizontal: 1, vertical: 2 },
    independentFixedFlags: true,
    bothPinsOverrideFixed: true,
    nearPinMinimum: 1,
    farPinWeightedMinimum: 0,
    unpinnedAndBothNoUniversalMinimum: true,
    nonfinite: 'Returned with finite:false; controller rejection is a product policy.',
    angleUnit: 'degrees; retained multiply-by-pi/180 call',
    nearOneBoundingShortcut: 'abs(rotation-1) < 1e-5 returns the stored rectangle',
    sourceOfOriginalRect: 'Caller supplied old unrounded, unrotated rectangle',
    sourceOfOriginalBounds: 'Caller supplied old rotated AABB in the same scope',
    widgetStyleProviderIncluded: false,
  },
  execution: probes.execution,
  instructionCoverage: probes.methodCoverage,
  externalCalls: probes.externalCalls,
  authorBoundsComparison: {
    ...file(prefix + 'layer-bounds.json'),
    count: 24,
    shortcut: read(prefix + 'layer-bounds.json').shortcut,
    oldProductSourceSnapshot: read(prefix + 'layer-bounds.json').sourceSnapshot,
    recommendation: read(prefix + 'layer-bounds.json').recommendation,
  },
  history,
  productValidation: {
    module: implementation[0],
    unit: { ...file(greenPath), total: 8, passed: 8, failed: 0, numericFixtureResults: 3948 },
    firstRun: { ...file(redPath), reason: 'Missing production module; test collection failed with zero executed assertions.' },
    typecheck: { command: 'npx tsc --noEmit', exitCode: 0, observedThisStage: true },
    importsOriginalOrResearchCode: false,
    sourceInterface: ['solveAuthorResize', 'applyAuthorResizePins', 'getAuthorResizeBounds', 'hasAuthorResizePins', 'hasAuthorResizePinEdges'],
  },
  limits: [
    ...probes.execution.limits,
    'No claim that every source double input, every CLR math rounding case, or the original GUI is exhausted.',
    'Matrix allocation/application are declared affine arithmetic sinks, not original matrix-method execution.',
    'Empty union, Layer traversal, capability gates, parent fit, snapping, adaptive provider and final writeback are outside this numeric module.',
    'Original finite/nonfinite arithmetic is retained; product controller may reject inadmissible document results.',
  ],
  sources, evidence, implementation, tests, screenshots: [],
};
fs.writeFileSync(prefix + 'evidence.json', JSON.stringify(output, null, 2) + '\n');
const manifest = {
  schemaVersion: 1, stage: 'layer-resize-numeric', source: output.source,
  originalDllMethodsExecuted: false, originalGuiCompared: false,
  summary: probes.summary,
  sources,
  evidence: [...evidence, file(prefix + 'evidence.json'), file(prefix + 'manifest.mjs')],
  implementation, tests, screenshots: [],
};
fs.writeFileSync(prefix + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({
  summary: manifest.summary, implementation, tests: { passed: green.numPassedTests, failed: green.numFailedTests },
  manifest: file(prefix + 'manifest.json'),
}));
