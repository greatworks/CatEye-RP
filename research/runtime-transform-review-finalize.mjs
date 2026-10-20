import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const pin = file => ({ path: file, sha256: createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex') });
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const first = read('research/runtime-transform-review-probes-first.json');
const corrected = read('research/runtime-transform-review-correction-probes.json');
const focused = read('research/runtime-transform-review-focused-correction.json');
const orbit = read('research/runtime-transform-review-orbit-cache-correction.json');
assert.equal(corrected.summary.passed, 13); assert.equal(corrected.summary.failed, 0);
assert.equal(focused.numPassedTests, 196); assert.equal(focused.numFailedTests, 0);
for (const row of corrected.implementation.concat(corrected.sources, orbit.sources)) assert.equal(pin(row.path).sha256, row.sha256, row.path);
const files = [
  'research/runtime-transform-review-evidence.md', 'research/runtime-transform-review-evidence.json', 'research/runtime-transform-review-report.mjs',
  'research/runtime-transform-review-probe.mjs', 'research/runtime-transform-review-probes-first.json',
  'research/runtime-transform-review-correction.md', 'research/runtime-transform-review-correction-probe.mjs', 'research/runtime-transform-review-correction-probes.json',
  'research/runtime-transform-review-correction-interrupted.json',
  'research/runtime-transform-review-orbit-cache-correction.mjs', 'research/runtime-transform-review-orbit-cache-correction.json',
  'research/runtime-transform-review-finalize.mjs',
].map(pin);
const report = {
  capturedAt: new Date().toISOString(), status: 'Bounded review complete; expression discrepancy corrected; earlier browser endpoint tolerance corrected additively',
  sources: [...new Map(corrected.sources.concat(orbit.sources).map(x => [x.path, x])).values()],
  implementation: corrected.implementation,
  historicalImplementation: first.implementation,
  historicalImplementationNote: 'These hashes were actually tested by the first review. Do not compare them to evolving current files or claim the later drag/control schema expansion was reviewed.',
  evidence: files,
  tests: [pin('research/runtime-transform-review-focused-first.json'), pin('research/runtime-transform-review-focused-correction.json')],
  result: {
    firstFocused: { passed: 134, failed: 0 }, firstObservationChecks: { passed: 18, failed: 0, parityMismatches: 4 },
    correctionFocused: { passed: 196, failed: 0 }, correctionProbe: corrected.summary,
    sourceOrbitRunComparisons: { cases: 6, previousToleranceContradictions: 1, exactHelperMutationCheck: true },
    productChangesByReviewer: 0, browserRuns: 0,
  },
  remaining: ['Completed action consumers and marker fallback were not reviewed here.', 'Native compiler type inference remains unexecuted.', 'The precise frame-dependent source of orbital cache variation requires controlled matching-frame replay.', 'Initial model/parser/clone conclusions remain tied to the first reviewed hashes; later drag schema additions are separate.'],
};
const output = 'research/runtime-transform-review-correction.json';
assert.ok(!fs.existsSync(path.join(root, output)), 'Preserve correction report');
fs.writeFileSync(path.join(root, output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...pin(output), expression: corrected.implementation[0], result: report.result }, null, 2));
