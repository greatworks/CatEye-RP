import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const pin = path => ({ path, sha256: sha(path) });
const probeFile = 'research/native-point-commit-final-review-probe.json';
const probe = read(probeFile);
assert.equal(probe.checks.total, 135); assert.equal(probe.checks.passed, 135);
assert.deepEqual(probe.blockingFindings, []); assert.equal(probe.sourceStableDuringProbe, true);
for (const entry of [...probe.sourceHashes, ...probe.evidenceHashes]) assert.equal(sha(entry.path), entry.sha256, `Review reference changed: ${entry.path}`);
const formatPath = 'research/native-point-commit-format-manifest.json', format = read(formatPath);
for (const entry of [...format.sources, ...format.files]) assert.equal(sha(entry.path), entry.sha256, `Format reference changed: ${entry.path}`);
const geometryPath = 'research/native-point-commit-evidence-probes.json', geometry = read(geometryPath);
assert.equal(geometry.caseCount, 98); assert.equal(geometry.results.length, 98); assert.equal(geometry.methodsReplayed.length, 21);
assert.equal(sha(geometryPath), 'a0b9bba9c73cde89e75b281671d2032650cad4a57c8f1a268c0c03c61b6d09ab');
for (const entry of [...geometry.sources, geometry.probe]) assert.equal(sha(entry.path), entry.sha256, `Geometry reference changed: ${entry.path}`);
const authorPath = 'research/native-point-commit-authoring-implementation.json', author = read(authorPath);
for (const entry of author.sources) assert.equal(sha(entry.path), entry.sha256, `Author source changed: ${entry.path}`);
const paths = [...new Set([
  ...probe.sourceHashes.map(x => x.path),
  ...probe.evidenceHashes.map(x => x.path),
  probeFile, formatPath, 'research/native-point-commit-format-evidence.md',
  'research/native-point-commit-format-size-minimum-cil.json',
  'research/native-point-commit-format-scalar-minimum-cil.json',
  'research/adaptive-placement-authoring-owner-cil.json',
  'research/native-point-commit-evidence.json', 'research/native-point-commit-evidence.md',
  authorPath, 'research/native-point-commit-authoring-implementation.md',
  'research/native-point-commit-final-review-probe-first.json',
  'research/native-point-commit-final-review-probe-intermediate.json',
  'research/native-point-commit-final-review.md',
  'research/native-point-commit-final-review-freeze.mjs',
  'tests/native-point-commit.test.ts',
])];
const output = {
  schema: 1, stage: 'native-point-commit', capturedAt: new Date().toISOString(),
  status: 'scoped-independent-review-passed', originalComparison: false,
  originalAxureGuiCompared: false, originalDllExecuted: false, productionModified: false,
  blockingFindings: [], checks: probe.checks, sourceStableDuringProbe: true,
  sources: paths.map(pin),
  nativeEvidence: { formatCases: 79, geometryCases: 98, geometryMethods: 21, formatReferenceHashesVerified: format.sources.length + format.files.length, geometrySourceHashesVerified: geometry.sources.length },
  firstRun: { total: 133, passed: 132, issue: 'Exact rotated-coordinate oracle differed by about 1e-14; no document/scope mismatch.', correction: 'Only numeric owner comparison changed to per-coordinate absolute tolerance 1e-10.' },
  intermediateRun: { issue: 'Source changed during execution; final status correctly withheld and probe rerun.' },
  scope: ['72 independent complete-document current-slot cases', 'shared path/custom identity, current atomic Location/Size pairs, AutoFit retained', 'active/inactive/nested declarations and save/readback', 'four retained native numeric cases and no equal size materialization', 'source-only pointer/cancel/history integration review'],
  limitations: ['No original GUI/native DLL execution or original writeback.', 'Browser/package/history dispatcher validation belongs to parent and is not counted here.', 'General transforms, masters/contained special providers, connections and contour reindexing remain outside scope.', 'Empty participating geometry and guarded partial-border/independent-corner paths remain unsupported.', 'Existing product bounds are not claimed as universal native limits.'],
};
fs.writeFileSync('research/native-point-commit-final-review.json', JSON.stringify(output, null, 2) + '\n');
for (const entry of output.sources) assert.equal(sha(entry.path), entry.sha256);
console.log(JSON.stringify({ checks: output.checks, sourceReferences: output.sources.length, blockingFindings: output.blockingFindings, reviewSha256: sha('research/native-point-commit-final-review.json'), probeSha256: sha(probeFile), formatManifestSha256: sha(formatPath) }));
