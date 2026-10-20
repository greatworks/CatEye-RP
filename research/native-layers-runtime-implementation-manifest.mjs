import fs from 'node:fs';
import { createHash } from 'node:crypto';

const digest = path => ({ path, bytes: fs.statSync(path).size, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex') });
const product = ['src/runtime/export-runtime.ts', 'src/runtime/engine.ts', 'src/components/Preview.tsx', 'src/runtime/inline-frame-runtime.ts'];
const tests = ['tests/native-layers-runtime.test.ts', 'tests/fixtures/native-layers-runtime.ts', 'tests/e2e/native-layers-runtime.spec.ts'];
const logs = [
  '.build/native-layers-runtime-red.json',
  '.build/native-layers-runtime-initial-green.json',
  '.build/native-layers-runtime-motion-red.json',
  '.build/native-layers-runtime-motion-first.json',
  '.build/native-layers-runtime-review-red.json',
  '.build/native-layers-runtime-focused-first.json',
  '.build/native-layers-runtime-cache-special-red.json',
  '.build/native-layers-runtime-cache-special-green-first.json',
  '.build/native-layers-runtime-cache-special-green.json',
  '.build/native-layers-runtime-combined-offset-red.json',
  '.build/native-layers-runtime-combined-offset-green.json',
  '.build/native-layers-runtime-initial-state-red.json',
  '.build/native-layers-runtime-initial-state-red-valid.json',
  '.build/native-layers-runtime-initial-state-green.json',
  '.build/native-layers-runtime-lifecycle-first.json',
  '.build/native-layers-runtime-focused-final.json',
];
const final = JSON.parse(fs.readFileSync(logs.at(-1), 'utf8'));
if (!final.success || final.numFailedTests !== 0 || final.numPassedTests !== 531) throw new Error('Unexpected focused verification result');
const units = JSON.parse(fs.readFileSync('.build/native-layers-runtime-lifecycle-first.json', 'utf8'));
const evidence = [
  'research/native-layers-runtime-evidence.md', 'research/native-layers-runtime-evidence.json', 'research/native-layers-runtime-manifest.json',
  'research/native-layers-runtime-supplement-evidence.md', 'research/native-layers-runtime-supplement-evidence.json',
];
const report = {
  schema: 1, capturedAt: new Date().toISOString(), stage: 'native-layers', owner: 'editor_core',
  originalGuiCompared: false, fullAxureParity: false,
  production: product.map(digest), tests: tests.map(digest),
  report: digest('research/native-layers-runtime-implementation.md'),
  generator: digest('research/native-layers-runtime-implementation-manifest.mjs'),
  originalEvidence: evidence.map(digest),
  focused: { total: final.numTotalTests, passed: final.numPassedTests, failed: final.numFailedTests, files: final.testResults.map(x => x.name), ownLayerCases: units.numPassedTests },
  typecheck: { exitCode: 0, log: digest('.build/native-layers-typecheck-final.log') },
  historicalRuns: logs.map(path => {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    return { ...digest(path), passed: data.numPassedTests, failed: data.numFailedTests, log: digest(path.replace(/\.json$/, '.log')) };
  }),
  classifications: {
    productCorrections: ['rotated member edge-anchor resize displacement', 'reserved member channel overtaken by reentrant legacy Move', 'initial Base incorrectly auto-unioned', 'Layer special compression scope unsupported', 'combined offsets evaluated before root callbacks', 'Selected initialization blocked by authored Disabled'],
    harnessCorrections: ['invalid selected event name; strict parser correctly rejected', 'invalid setSelected fixture in first rollback test; strict parser correctly rejected', 'multiple runtimes retained different fake Date objects after clock reset', 'initial named selection fixture needed explicit Base threshold', 'snapshot fixture Layer needed valid derived author bounds'],
    withdrawnInference: 'Member Move-To delta mismatch was a low-level MoveWidget(to=true) observation. The actual user action calls moveBy, so current shared translation is correct.',
    intermediateSourceAvailability: 'Independent red records bind intermediate source hashes; complete bytes were not saved for every such version. No reconstructed historical snapshot is claimed.',
  },
  browser: { status: 'defined; parent owns execution and final production results', cases: 2, file: tests[2] },
  release: { status: 'parent-owned; not verified by this focused manifest' },
};
const target = 'research/native-layers-runtime-implementation.json';
if (fs.existsSync(target)) throw new Error(`Preserve existing ${target}`);
fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ manifest: digest(target), focused: report.focused }, null, 2));
