import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const hash = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const entry = path => ({ path, sha256: hash(path) });
const original = read('research/adaptive-transition-probe.json');
const dom = read('research/adaptive-transition-text-probe.json');
const corpus = read('research/adaptive-transition-containment.json');
const cil = read('research/adaptive-transition-contained-cil.json');
const results = original.results;
assert.equal(results.length, 47);
assert.ok(results.every(result => result.status === 'pass'));
assert.equal(dom.passed, 3);
assert.equal(dom.requests.length, 0);
assert.equal(dom.errors.length, 0);
assert.equal(corpus.records.length, 29);

const sourceMap = new Map();
for (const source of [...original.sources, ...dom.sources, ...corpus.sources,
  { path: cil.AssemblyPath, sha256: cil.SHA256 }]) {
  assert.equal(hash(source.path), source.sha256, `Source changed: ${source.path}`);
  if (sourceMap.has(source.path)) assert.equal(sourceMap.get(source.path).sha256, source.sha256);
  sourceMap.set(source.path, { path: source.path, sha256: source.sha256 });
}
for (const input of corpus.inputs) assert.equal(hash(input.path), input.sha256, `Retained census changed: ${input.path}`);

const evidencePaths = fs.readdirSync('research')
  .filter(name => name.startsWith('adaptive-transition-') && name !== 'adaptive-transition-evidence.json')
  .sort().map(name => `research/${name}`);
const retained = [
  'research/adaptive-style-reset-events-evidence.md',
  'research/adaptive-style-reset-events-evidence.json',
  'research/adaptive-style-reset-events-probe.mjs',
  'research/adaptive-style-reset-events-probe.json',
  'research/table-format-json-dispatch-cil.json',
  'research/tree-widget-format-html-cil.json',
  'research/scripts/inspect-rp-serialization.ps1',
  ...corpus.inputs.map(input => input.path),
];
const manifest = {
  schema: 'adaptive-transition-evidence-v1',
  capturedAt: new Date().toISOString(),
  artifact: { ...original.artifact, assemblySha256: cil.SHA256 },
  sources: [...sourceMap.values()],
  evidence: evidencePaths.map(entry),
  retainedEvidence: retained.map(entry),
  validation: {
    exactSourceNodeVmCases: results.length,
    isolatedEdgeDomCases: dom.passed,
    browserVersion: dom.browser,
    networkRequests: dom.requests.length,
    pageErrors: dom.errors.length,
    retainedContainmentObjects: corpus.records.length,
    priorVisibilityCases: 18,
    priorVisibilityReexecuted: false,
    allSourceHashesVerified: true,
  },
  observations: [
    'Geometry and declaration-visibility resets have different containment/type gates.',
    'Selected, Error, Disabled and Hint dictionaries survive adaptive persist=2; row DOM and pageInfo are rebuilt/reset.',
    'Plain SetText retains content and original inline first-run formatting through a named view and Base; nonplain rich replacement refreshes the cache.',
    'Base-return SVG stale final paint argument is an exact source call-order observation with a terminal sink, separate from real DOM text cache restoration.',
    'Stored IsContained witnesses cover 29 Default library objects; inherited parent DOM clearing can affect a skipped contained child.',
  ],
  limitations: [
    'No original authenticated GUI or complete original generated-page pixel comparison in this task.',
    'NodeVM uses explicit DOM/CSS and terminal operation sinks; Edge DOM uses controlled widget data and an explicit action-effect stylesheet.',
    'General contained DOM nesting, nested repeater addressing, and final native form properties after persist are not established.',
    'PLACED is distinct from VISIBLE; inverse boolean writer is proven, but obfuscated key and full default unplaced-class generation remain unclosed.',
    'Same-DOM SVG definition/offset history and immediate consistent Base repaint may differ from the independent product.',
  ],
  productChanged: false,
  historicalEvidenceChanged: false,
  originalGuiRun: false,
};
const output = 'research/adaptive-transition-evidence.json';
fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ path: output, sha256: hash(output), sources: manifest.sources.length,
  evidence: manifest.evidence.length, retainedEvidence: manifest.retainedEvidence.length, validation: manifest.validation }, null, 2));
