import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const pin = file => ({ path: file, sha256: createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex') });
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const probe = read('research/runtime-transform-review-probes-first.json');
const tests = read('research/runtime-transform-review-focused-first.json');
assert.equal(tests.numPassedTests, 134); assert.equal(tests.numFailedTests, 0);
assert.equal(probe.summary.total, 18); assert.equal(probe.summary.confirmedMismatches, 4);
const evidence = [
  'research/runtime-transform-review-probe.mjs', 'research/runtime-transform-review-probes-first.json',
  'research/runtime-transform-review-evidence.md', 'research/runtime-transform-review-report.mjs',
  'research/runtime-transform-expression-probe.mjs', 'research/runtime-transform-expression-final-probes.json',
  'research/runtime-transform-expression-properties-probes.json', 'research/runtime-transform-expression-evidence.md',
  'research/runtime-transform-bindings-evidence.md', 'research/runtime-transform-bindings-evidence.json',
  'research/runtime-transform-browser-evidence.md', 'research/runtime-transform-browser-evidence.json',
].map(pin);
const report = {
  capturedAt: new Date().toISOString(), scope: 'Read-only motion model/parser/clone/expression review; changing runtime core excluded',
  sources: probe.sources, implementation: probe.implementation, evidence,
  tests: [pin('research/runtime-transform-review-focused-first.json')],
  summary: { focusedTests: { passed: 134, failed: 0 }, observationChecks: { passed: 18, failed: 0 }, sourceParityMismatches: 4, findings: 1, productChanges: 0, browserRuns: 0 },
  findings: [{ id: 'RTRANS-REVIEW-01', status: 'confirmed for uncast retained STO consumer; compiler-dependent reachability', file: 'src/runtime/expressions.ts', line: 174, reviewedSha256: probe.implementation.find(x => x.path === 'src/runtime/expressions.ts').sha256, title: 'Undefined boolean conversion silently produces a value', source: 'sto.js:210–213; expr.js:203–235', examples: probe.results.filter(x => x.observed?.parity === false), recommendation: 'Reject undefined at the actual motion boolean coercion; preserve eager operand evaluation and short-circuit conversion controls. Consumer error policy is separate.' }],
  boundaries: probe.limitations.concat(['No general compiler inference or whole-application security/parity claim.', 'Any fix must create a new correction artifact; the first observed mismatch output is immutable.']),
  originalAxureGuiCompared: false, originalDllExecuted: false,
};
const output = path.join(root, 'research/runtime-transform-review-evidence.json');
assert.ok(!fs.existsSync(output), 'Preserve the hash-bound first review');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ path: path.relative(root, output), sha256: pin(output).sha256, summary: report.summary }, null, 2));
