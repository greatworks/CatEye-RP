import fs from 'node:fs';
import { createHash } from 'node:crypto';

const prefix = 'research/runtime-transform-special-integration-review-';
const hash = data => createHash('sha256').update(data).digest('hex');
const bind = path => ({ path, sha256: hash(fs.readFileSync(path)) });
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const requireThat = (test, message) => { if (!test) throw new Error(message); };
const writeNew = (path, value) => {
  requireThat(!fs.existsSync(path), `Refuse to replace ${path}`);
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const expectedCore = 'db4ff9b6e2784405b29f3000fdfc1037151d33b1e3dd2db0623899fcc57f4fed';
requireThat(bind('src/runtime/export-runtime.ts').sha256 === expectedCore, 'Reviewed core changed');
const sourceEvidence = read('research/runtime-transform-special-evidence.json');
for (const source of sourceEvidence.sources) {
  requireThat(bind(source.path).sha256 === source.sha256, `Original source drift: ${source.path}`);
}
const initial = read(`${prefix}initial-findings.json`);
requireThat(bind(`${prefix}initial-findings.json`).sha256 === '77dfed2c6f86f2c51c0f531950f781e4601363c77174dca1bf582c1e487ab092', 'Frozen initial review changed');
for (const source of initial.evidence) {
  requireThat(bind(source.path).sha256 === source.sha256, `Frozen red evidence drift: ${source.path}`);
}
const independent = read(`${prefix}final-probes.json`);
requireThat(independent.summary.total === 48 && independent.summary.passed === 48 && independent.sourceDrift.length === 0, 'Independent comparison failed/drifted');
for (const source of independent.sourcesAfter) {
  requireThat(bind(source.path).sha256 === source.sha256, `Post-probe source drift: ${source.path}`);
}
const corrected = read(`${prefix}page-scope-correction.json`);
requireThat(!corrected.defect && corrected.cases.length === 2 && corrected.cases.every(x => x.ok && x.log === 'continued'), 'Correction failed');
for (const source of corrected.sources) {
  requireThat(bind(source.path).sha256 === source.sha256, `Correction source drift: ${source.path}`);
}
const focused = read(`${prefix}focused-final.json`);
requireThat(focused.success && focused.numTotalTests === 58 && focused.numPassedTests === 58 && focused.numFailedTests === 0, 'Focused validation failed');
const implementation = [
  'src/runtime/export-runtime.ts', 'src/runtime/expressions.ts',
  'src/runtime/engine.ts', 'src/model/types.ts',
].map(bind);
const tests = [
  'tests/runtime-transform-core-special.test.ts',
  'tests/runtime-transform-core-consumers.test.ts',
].map(bind);
const evidence = [
  `${prefix}final-review.md`, `${prefix}freeze.mjs`,
  `${prefix}initial-findings.md`, `${prefix}initial-findings.json`,
  `${prefix}first-probe.mjs`, `${prefix}probe.mjs`,
  `${prefix}probes.json`, `${prefix}started-probes.json`, `${prefix}final-probes.json`,
  `${prefix}page-scope-first-probe.mjs`, `${prefix}page-scope-probe.mjs`,
  `${prefix}page-scope.json`, `${prefix}page-scope-source-parent.json`,
  `${prefix}page-scope-correction.json`, `${prefix}focused.json`, `${prefix}focused-final.json`,
  'research/runtime-transform-special-probe.mjs',
  'research/runtime-transform-special-final-probes.json',
  'research/runtime-transform-special-fixtures.json',
  'research/runtime-transform-special-evidence.md',
  'research/runtime-transform-special-evidence.json',
  'research/runtime-transform-special-manifest.json',
].map(bind);
const report = {
  schema: 'runtime-transform-special-integration-review-v1',
  capturedAt: new Date().toISOString(),
  status: 'confirmed-issue-corrected-no-further-confirmed-defect-in-bounded-review',
  finding: {
    id: 'RTS-INTEGRATION-01',
    title: 'This Item page-event resize required a widget and blocked continuation',
    status: 'independently-verified-corrected',
    redCoreSha256: initial.sources[0].sha256,
    correctedCoreSha256: expectedCore,
    currentLocation: { path: 'src/runtime/export-runtime.ts', from: 1995, through: 2005 },
    originalConsumer: { path: sourceEvidence.sources.find(s => s.path.endsWith('action.js')).path, from: 1258, through: 1284 },
    generatedPageEntryOrGuiVerified: false,
  },
  results: {
    independentComparisons: independent.summary,
    pageScopeCorrection: { total: 2, passed: 2, failed: 0 },
    focusedTests: { total: 58, passed: 58, failed: 0 },
    originalFrozenSuite: sourceEvidence.summary,
    countsAreOverlapping: true,
  },
  preservedFailure: {
    firstIndependentRun: { total: 48, passed: 34, failed: 14, cause: 'Probe omitted runtime.start; normal startup added in new script/output only', productDefect: false },
    pageScopeRed: { total: 2, passed: 0, failed: 2, productDefect: true },
  },
  sources: sourceEvidence.sources,
  implementation, tests, evidence, screenshots: [],
  boundaries: [
    'Exact original consumers in NodeVM have explicit DOM/query, geometry and controlled scheduling facades; no original generated page or GUI comparison.',
    'Original fit and queue-release callbacks remain sinks; no new native scheduler or reentrancy equivalence claim.',
    'No expansion to native Layer, fixed positioning, independent panel-state size, parent fit, wrapper generation or real CSS box model.',
    'No full dataset or native deletion/refresh/animation lifecycle coverage; row fixtures use zero borders.',
    'Product validation, finite limits, unsafe-expression rejection and atomic rollback are independent safety behavior.',
  ],
  productModifiedByReviewer: false, originalDllExecuted: false,
  originalGuiCompared: false, browserStarted: false,
};
writeNew(`${prefix}final-review.json`, report);
const manifest = {
  schema: 'runtime-transform-special-integration-review-manifest-v1',
  capturedAt: report.capturedAt,
  sources: sourceEvidence.sources, implementation, tests,
  evidence: [...evidence, bind(`${prefix}final-review.json`)],
  screenshots: [],
};
writeNew(`${prefix}manifest.json`, manifest);
console.log(JSON.stringify({
  status: report.status, results: report.results,
  report: bind(`${prefix}final-review.json`),
  manifest: bind(`${prefix}manifest.json`),
}, null, 2));
