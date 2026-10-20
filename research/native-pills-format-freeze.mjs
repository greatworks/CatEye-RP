// Freeze this stage only. The initial inventory is intentionally historical.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const prefix = 'research/native-pills-format-';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pin = file => ({ file, sha256: sha(file) });
const audit = read(prefix + 'import-audit.json');
const inventory = read(prefix + 'inventory.json');
const gallery = read('research/native-pills-imported-widgets.json');
const review = read('research/native-pills-final-review.json');
const native = read('research/native-pills-evidence.json');
const dll = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(dll), 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
for (const record of [...audit.sources, ...audit.samples]) assert.equal(sha(record.file), record.sha256, record.file);
assert.equal(audit.unexpectedChanges.length, 0);
assert.equal(gallery.widgets.length, 18);
assert.equal(review.summary.failed, 0);
assert.equal(review.summary.passed, 416);
assert.equal(audit.maximumCompactBytes, 28782471);
assert.ok(audit.maximumCompactBytes < 32 * 1024 * 1024);
// Never relabel the pre-implementation reader/renderer snapshot as current.
const historicalInventorySources = inventory.sources.map(record => {
  const file = sha(record.file) === record.sha256 ? record.file : '.build/before-native-pills/' + record.file;
  assert.equal(sha(file), record.sha256, record.file);
  return { recordedFile: record.file, file, sha256: record.sha256 };
});
const cleanLog = file => fs.readFileSync(file, 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
const nodeLog = cleanLog('.build/native-pills-format-reader-green.log');
const vitestLog = cleanLog('.build/native-pills-format-import-final.log');
assert.match(nodeLog, /tests 91/); assert.match(nodeLog, /pass 91/); assert.match(nodeLog, /fail 0/);
assert.match(vitestLog, /Tests\s+36 passed \(36\)/);
const typecheckLog = cleanLog('.build/native-pills-format-typecheck-final.log');
assert.match(typecheckLog, /tsc/); assert.doesNotMatch(typecheckLog, /error TS\d+/);
const peerFiles = ['research/native-pills-evidence.md', 'research/native-pills-evidence.json',
  'research/native-pills-evidence-probe.mjs', 'research/native-pills-evidence-probes.json',
  'research/native-pills-final-review-probe.mjs', 'research/native-pills-final-review.json',
  'research/native-pills-render-analysis.md', 'research/native-pills-render-analysis.json',
  'research/native-pills-render-analysis-probe.mjs',
  ...native.evidence.filter(r => r.path?.startsWith('research/native-pills-') && r.path.endsWith('-cil.json')).map(r => r.path)];
const logs = ['inventory', 'reader-red', 'reader-green', 'import-red', 'import-green', 'import-second',
  'import-final', 'typecheck', 'typecheck-final', 'import-audit', 'import-audit-second', 'import-audit-final']
  .map(s => `.build/native-pills-format-${s}.log`).filter(fs.existsSync);
const diagnostics = ['.build/native-pills-format-import-diagnostic.json',
  '.build/native-pills-format-parent-diagnostic.json', '.build/native-pills-format-audit-first-diffs.json'].filter(fs.existsSync);
const evidence = {
  schema: 'native-pills-format-evidence-v1', capturedAt: new Date().toISOString(),
  target: { version: '11.0.0.4150', ...pin(dll) },
  method: 'Static CIL/native-record inspection and bounded independent replay; fresh original files through before/current complete importers. No DLL execution or original GUI comparison.',
  contract: {
    originalFamily: 'Shape0 current-size quarter-corner family with complete determined native P71/P81 base evidence',
    additionalEncoding: 'Only six stored anchors against eight expected corners: merge eligible closing seam first, then adjacent zero-length straight edges; compare both retained handles, anchors, segment flags and cyclic order.',
    nativeMerge: { method: 'm5vw', token: 100722500, seamIL: '0x0D-0x3E', adjacentIL: '0x54-0x8B',
      constructor: 'P5vT', constructorToken: 100722499, constructorIL: '0x07-0x20',
      fields: 'anchor/segment from second; lower handle from first; higher handle from second' },
    nativeEquality: 'N5Ex requires per-axis anchor distance below 1e-5 and degenerate joining handles; the admitted corpus also matches the independent native builder within 1e-12.',
    parameterRecovery: 'Actual P71 radius and P81 cornerVisibility are retained; clamped path radius is not substituted for the stored scalar.',
    productChanges: ['research/scripts/read-rp-semantics.mjs'],
    unchangedImporter: ['src/model/import-rp.ts', 'src/model/import-rp-adaptive.ts'],
    rendererCompanion: 'Separate line-style normalized-family fix removes only expected numerically degenerate L segments when counts disagree; physical rectangleRadii and paint/tolerances remain unchanged.',
  },
  totals: audit.totals, maximumCompactBytes: audit.maximumCompactBytes, desktopWorkerCapBytes: 32 * 1024 * 1024,
  corpus: audit.samples.map(s => ({ file: s.file, sha256: s.sha256, compactBytes: s.compactBytes,
    changedWidgets: s.changes, before: s.before, after: s.after, importError: s.importError })),
  unimported: audit.unimported,
  exclusions: inventory.owners.filter(w => w.observed.vertexCounts[0] !== 6).map(w => ({
    sourceId: w.sourceId, packageId: w.packageId, sourcePartSha256: w.sourcePartSha256,
    sample: w.sample, sampleSha256: w.sha256, size: w.size,
    nativeRadius: w.effective[71], nativeMask: w.effective[81],
    reason: w.size ? 'Eight-anchor snapshot does not meet current-width/height strict physical-radius consistency; no relaxation this stage.'
      : 'Contained Tree label has no own style size; existing tree-specific geometry remains unchanged, no ordinary box corner admission.',
  })),
  validation: { newNode: 41, newImporter: 1, focusedNode: { passed: 91, failed: 0 },
    focusedVitest: { passed: 36, failed: 0 }, typecheck: true,
    independentNativeReplay: 58, independentReview: review.summary,
    originalSourceHashesUnchanged: true, unexplainedDocumentDifferences: 0,
    fullSuitesRunByThisAgent: false, originalAxureGuiCompared: false },
  corrections: [
    'Initial Node red: 12 passed / 29 failed out of 41; the 28 actual pill records and cyclic case failed the prior reader.',
    'The first importer test incorrectly expected all 28 raw records in the complete document. Actual parent admission is 26 semantic records and 18 document widgets. Evidence corrected the oracle, without relaxing fit-parent or native-repeater boundaries.',
    'Initial audit allowlist omitted derived path-to-box fallback names and explicit all-visible P80 metadata. Final audit allows these only for the 18 exact source IDs, verifies the exact fallback name pattern, and requires raw P80=15.',
  ],
  limitations: [
    'Eight otherwise-recognized pills remain inside four atomically rejected fit-to-content panels with unresolved child shadows/automatic text size. Two are in unsupported native RepeatableDiagram templates, not orphan page packages.',
    'Nine eight-point/current-size mismatches and four contained Tree labels are unchanged. No arbitrary six-point path, general coalescing family, new repeater recovery, or parent-boundary relaxation is claimed.',
    'Full document fields and imported identity sets are compared; numeric report counts are compared. Diagnostic issue text is not asserted byte-identical.',
    'Static native builder and dynamic JS oversized fill/stroke behavior remain the prior documented distinction. No original application execution or original generated-page pixel equivalence is claimed.',
  ],
  historicalInventorySources,
  sources: [pin(prefix + 'inventory.json'), pin(prefix + 'import-audit.json'), pin('research/native-pills-imported-widgets.json'),
    ...peerFiles.map(pin), ...logs.map(pin), ...diagnostics.map(pin)],
};
for (const file of evidence.contract.unchangedImporter)
  assert.equal(sha(file), sha('.build/before-native-pills/' + file), 'Unexpected importer modification: ' + file);
fs.writeFileSync(prefix + 'evidence.json', JSON.stringify(evidence, null, 2) + '\n');
const table = audit.samples.map(s => `| ${path.basename(s.file)} | ${s.changes.length} | ${s.compactBytes.toLocaleString('en-US')} | ${s.importError ? 'same prior rejection' : 'same counts'} |`).join('\n');
fs.writeFileSync(prefix + 'evidence.md', `# Native six-anchor pills: format and complete-import evidence

Target: Axure RP 11.0.0.4150, DLL SHA-256 \`${sha(dll)}\`. This stage uses existing original files, static CIL and controlled independent replay. It does not execute the original DLL or compare the original GUI.

## Narrow geometry contract

Native \`m5vw\` (token100722500) first merges the eligible last/first seam (IL0x0D–0x3E), then adjacent eligible points (IL0x54–0x8B). \`P5vT\` (100722499, IL0x07–0x20) retains the first lower handle and second higher handle, anchor and segment flag. \`N5Ex\` requires coincident anchors and degenerate joining handles; arbitrary coincident control points are not sufficient. The independent [native replay](native-pills-evidence.md) matches all28 observed pills, including every handle and segment, within1e-12.

The reader adds only the witnessed **six stored anchors / eight expected corners** case to the existing current-size rectangle recognizer. It coalesces eligible expected points, then keeps the prior strict coordinate, dual-handle, segment and cyclic-order checks. Existing eight-anchor encoding remains accepted. Edited handles, partial NaN, missing handles, a broken segment, reversed winding and extra contours remain rejected. Actual effective P71/P81 and their existing cache/flag provenance remain mandatory; Shape0 alone grants nothing.

The saved vector commands are unchanged. P71 remains the original scalar even when the generated path is clamped: the reachable200×6 object \`d515a37dfd114af6877e6c6d4d244032\` retains radius5, rather than substituting3. Source \`e6d3d1fe008947a0a3ef9244d3296be6\` is48×24/radius30 but remains inside a rejected parent and is not offered as a complete-import demo.

Only \`read-rp-semantics.mjs\` changes in this agent's production scope. The existing importer checks already accept the verified physical paths. The separately owned renderer fix removes an expected floating-point degenerate straight segment only when normalized-family segment counts differ; it does not change the physical validator or paint formula. See [the renderer analysis](native-pills-render-analysis.md).

## Coverage and unchanged boundaries

The initial41 exclusions resolve to **28 raw six-point pills**, **9 eight-point/current-size mismatches**, and **4 contained Tree labels without their own size**. The four labels already use their independent tree-layout contract. The9 mismatches retain their saved paths. Neither group receives new corner metadata.

All28 raw pills pass recognition, **26** appear in the existing semantic traversal, and **18** are present in complete document imports. Eight stay inside four fit-to-content panels whose child bounds remain unsafe; two belong to native RepeatableDiagram templates outside the current traversal. Their exact IDs, incoming references and part hashes are in the JSON companion. No parent rejection was weakened and no isolated-owner conversion is presented as a successful document import.

[The18-widget data file](native-pills-imported-widgets.json) contains only full actual imported widgets, with original source/package IDs and file/part hashes. It is intended for independently labelled authoring/browser fixtures; later synthetic actions or layout edits are not original sample content.

Fresh current and frozen-before pipelines cover all11 original samples. Exactly18 widget nodes change path→box, scalar radius and explicit corner mask. Where raw P80 is15, the all-visible border tuple is added; a generated unnamed path label becomes the corresponding box label. All IDs, saved commands, geometry, text and interactions remain unchanged. Document/page fields and numeric report counts match; diagnostic issue text is not asserted byte-identical. Added/removed widgets and event/action deltas are all0. Icons retains the same page-count rejection.

| Original file | Changed widgets | Compact semantic bytes | Counts |
|---|---:|---:|---|
${table}

Maximum compact output is **28,782,471 bytes**, below the actual desktop worker32MiB cap. Every original file hash is checked before/after reading.

## Validation and first failures

The new Node file has41 cases; its old-reader baseline was12pass/29fail. Final focused checks are **91/91 Node**, **36/36 Vitest**, and typecheck. The importer test traverses the real complete Form file and save/readback. The independent static/native replay reports58/58; the independent final review reports416/416, including1,232 raw mutations and924 normalized-path mutations. These are research and focused test results, not original GUI equivalence.

The first import test incorrectly treated all28 source records as complete-document widgets. It was corrected to the evidenced26semantic/18complete split, with exact IDs and unchanged atomic boundaries. Initial difference checks also omitted derived fallback names and proven all-visible P80 metadata; the final audit permits those exact changes only. The original red/failure logs and scoped diffs remain pinned.

The initial inventory remains a **pre-implementation snapshot**. Its historical reader/renderer hashes resolve to the frozen backup and are not relabelled as current. Previous native-corners reports and original sample files remain unchanged. No full suite, browser, desktop, build or package run is claimed by this format investigation.

Refresh current import evidence, then freeze (do not rerun the historical inventory):

\`node --disable-warning=ExperimentalWarning research/native-pills-format-import-audit.mjs\`

\`node research/native-pills-format-freeze.mjs\`
`);
const files = [...new Set([prefix + 'inventory.mjs', prefix + 'inventory.json', prefix + 'import-audit.mjs',
  prefix + 'import-audit.json', prefix + 'freeze.mjs', prefix + 'evidence.json', prefix + 'evidence.md',
  'research/native-pills-imported-widgets.json', 'research/scripts/read-rp-native-pills.test.mjs',
  'tests/import-rp-native-pills.test.ts', ...peerFiles, ...logs, ...diagnostics])];
const sources = [...new Map([pin(dll), ...audit.sources, ...historicalInventorySources.map(({file, sha256}) => ({file, sha256}))]
  .map(r => [r.file, r])).values()];
const manifest = { stage: 'native-pills-format', capturedAt: evidence.capturedAt, totals: audit.totals,
  validation: evidence.validation, files: files.map(pin), sources,
  samples: audit.samples.map(({ file, sha256 }) => ({ file, sha256 })) };
for (const r of [...manifest.files, ...manifest.sources, ...manifest.samples]) assert.equal(sha(r.file), r.sha256, r.file);
fs.writeFileSync(prefix + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ evidence: pin(prefix + 'evidence.json'), markdown: pin(prefix + 'evidence.md'),
  manifest: pin(prefix + 'manifest.json'), gallery: pin('research/native-pills-imported-widgets.json'),
  productionReader: pin('research/scripts/read-rp-semantics.mjs'),
  files: manifest.files.length, sources: manifest.sources.length, samples: manifest.samples.length, totals: audit.totals }, null, 2));
