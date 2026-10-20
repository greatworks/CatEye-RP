import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { inspectRpSemantics } from './scripts/read-rp-semantics.mjs';

const root = path.resolve(import.meta.dirname, '..');
const absolute = file => path.resolve(root, file);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = file => hash(fs.readFileSync(absolute(file)));
const pin = file => ({ path: path.isAbsolute(file) ? file : file.replaceAll('\\', '/'), sha256: sha(file) });
const read = file => JSON.parse(fs.readFileSync(absolute(file), 'utf8'));
const baselineFile = 'research/rotation-import-baseline.json';
const rotationFile = 'research/rotation-import-audit.json';
const corpusFile = 'research/text-autofit-corpus-evidence.json';
const frozen = {
  [baselineFile]: 'a5555ed0d04ebce49a3dcff130823cbb0516809ad6b14c63e451160fd797f5ed',
  [rotationFile]: 'f081e275cfa0f702027b470c5e48d81c1a20923a080cbba66735945ef85a7973',
  [corpusFile]: '5f878e9a52ab60045c00aa3411e8d7c6aa97b1809887cbe838aa90edf7252b26',
};
for (const [file, expected] of Object.entries(frozen)) assert.equal(sha(file), expected, `Frozen evidence changed: ${file}`);
const baseline = read(baselineFile), rotations = read(rotationFile), corpus = read(corpusFile);
assert.equal(baseline.samples.length, 11); assert.equal(corpus.records.length, 1778);
assert.equal(rotations.samples.reduce((n, sample) => n + sample.rotations.length, 0), 12);

const moduleSources = new Map(), urls = new Map();
function moduleUrl(file) {
  file = absolute(file); if (urls.has(file)) return urls.get(file);
  moduleSources.set(file, sha(file));
  const source = stripTypeScriptTypes(fs.readFileSync(file, 'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, quote, relative) => `from ${JSON.stringify(moduleUrl(path.resolve(path.dirname(file), relative.endsWith('.ts') ? relative : `${relative}.ts`)))}`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`; urls.set(file, url); return url;
}
const readerFiles = ['container', 'objects', 'semantics', 'interactions'].map(name => `research/scripts/read-rp-${name}.mjs`);
const readerPins = readerFiles.map(pin);
const { importRpSemantics } = await import(moduleUrl('src/model/import-rp.ts'));
const { parseDocument, serializeDocument } = await import(moduleUrl('src/model/document.ts'));

function walk(widgets, result = []) {
  for (const widget of widgets) {
    result.push(widget);
    for (const state of widget.states ?? []) walk(state.widgets, result);
    walk(widget.repeater?.template ?? [], result);
    walk(widget.table?.cells ?? [], result);
    walk(widget.menu ? [widget.menu.table, ...widget.menu.submenus] : [], result);
    walk(widget.tree?.nodes ?? [], result);
    walk(widget.treeNode ? [widget.treeNode.label, ...widget.treeNode.children] : [], result);
  }
  return result;
}
const allWidgets = document => walk(document.pages.flatMap(page => page.widgets));
const groupCount = (values, getter) => values.reduce((counts, value) => { const key = getter(value); counts[key] = (counts[key] ?? 0) + 1; return counts; }, {});
function firstDifference(actual, expected, location = '$') {
  if (isDeepStrictEqual(actual, expected)) return null;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return { path: `${location}.length`, actual: actual.length, expected: expected.length };
    for (let i = 0; i < actual.length; i++) { const diff = firstDifference(actual[i], expected[i], `${location}[${i}]`); if (diff) return diff; }
  } else if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    for (const key of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
      if (Object.hasOwn(actual, key) !== Object.hasOwn(expected, key)) return { path: `${location}.${key}`, actualPresent: Object.hasOwn(actual, key), expectedPresent: Object.hasOwn(expected, key) };
      const diff = firstDifference(actual[key], expected[key], `${location}.${key}`); if (diff) return diff;
    }
  }
  const brief = value => JSON.stringify(value)?.slice(0, 500);
  return { path: location, actual: brief(actual), expected: brief(expected) };
}
function same(actual, expected, label) {
  const diff = firstDifference(actual, expected);
  if (diff) { const error = new Error(label); error.difference = diff; throw error; }
}
function expectedDocument(old, after, semantics) {
  assert.equal(after.priorCompleteDocumentPreserved, true);
  const document = structuredClone(old.document), additions = [];
  for (const original of after.rotations) {
    const { pageId, sourcePackageId, sourceId, provenance, omittedInteractionIssues, ...widget } = original;
    const page = document.pages.find(item => item.id === pageId); assert.ok(page, `Added widget page missing: ${pageId}`);
    assert.ok(!allWidgets(document).some(item => item.id === widget.id));
    const diagram = semantics.diagrams.find(item => item.packageId === sourcePackageId); assert.ok(diagram);
    const sourceOrder = diagram.widgets.map(item => `rp-w-${sourcePackageId}-${item.id}`);
    const rank = sourceOrder.indexOf(widget.id); assert.notEqual(rank, -1);
    // Insert only the recorded addition; do not sort or rebuild any old node.
    const before = page.widgets.findIndex(item => sourceOrder.indexOf(item.id) > rank);
    const insertionIndex = before === -1 ? page.widgets.length : before;
    page.widgets.splice(insertionIndex, 0, structuredClone(widget));
    additions.push({ id: widget.id, pageId, sourcePackageId, sourceId, sourceIndex: rank, insertionIndex });
  }
  const addedIds = new Set(additions.map(item => item.id));
  const prior = structuredClone(document);
  for (const page of prior.pages) page.widgets = page.widgets.filter(widget => !addedIds.has(widget.id));
  same(prior, old.document, 'Expected reconstruction changed an old node or order');
  return { document, additions };
}
function semanticNodes(semantics) {
  const nodes = new Map();
  function visit(value, packageId) {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && typeof value.id === 'string' && value.storedFlags && typeof value.type === 'string') {
      const key = `${packageId}:${value.id}`, old = nodes.get(key);
      if (old) same({ type: value.type, storedFlags: value.storedFlags }, { type: old.type, storedFlags: old.storedFlags }, `Ambiguous native node ${key}`);
      else nodes.set(key, value);
    }
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child, packageId);
  }
  for (const diagram of semantics.diagrams) visit(diagram.widgets, diagram.packageId);
  return nodes;
}

const audit = {
  schema: 'text-autofit-import-audit-v1', capturedAt: new Date().toISOString(), ok: false,
  method: 'Read and import exactly the 11 pinned source inputs. Build expected complete documents from immutable rotation baseline plus the 12 recorded rotation additions, inserted at source diagram order without reordering old widgets. Remove only newly added widget.shapeText from current documents for exact deep equality. Independently compare current native type/AutoFit flags and imported shapeText to the frozen 1778-node corpus. No baseline update or product modification.',
  extractionEvidenceId: corpus.extractionEvidenceId, distributionSha256: corpus.distributionSha256,
  exclusions: ['No original Axure GUI, DLL execution, font measurement, browser or rendering parity assertion.', 'Icons.rplib must retain its exact previous page-count rejection.', 'AutoFit metadata preservation does not prove original initial/runtime resize behavior.'],
  samples: [], totals: { samples: 0, admittedSamples: 0, rejectedSamples: 0, importedNodes: 0, shapeTextMetadata: 0, ordinaryShapes: 0, treeLabelsExcluded: 0, tableMenuCellsExcluded: 0, sourceFlagsChecked: 0, completeDocumentsEqual: 0, roundtrips: 0, rotationAdditions: 0 },
  sources: [], failures: [],
};
for (const old of baseline.samples) {
  const sample = { name: path.basename(old.file), file: old.file, sourceSha256: old.sha256, ok: false };
  try {
    sample.sourceBeforeSha256 = sha(old.file); assert.equal(sample.sourceBeforeSha256, old.sha256);
    const semantics = inspectRpSemantics(old.file), after = rotations.samples.find(item => item.sha256 === old.sha256); assert.ok(after);
    sample.compactSemanticsBytes = Buffer.byteLength(JSON.stringify(semantics));
    if (old.importError) {
      let error; try { importRpSemantics(semantics); } catch (cause) { error = cause.message; }
      same(error, old.importError, 'Previously rejected sample changed outcome');
      sample.importError = error; sample.sameRejection = true; audit.totals.rejectedSamples++;
    } else {
      const { document, report } = importRpSemantics(semantics), { issues, ...counts } = report;
      same(counts, after.import, 'Import counts changed'); sample.counts = counts;
      const { document: expected, additions } = expectedDocument(old, after, semantics);
      sample.rotationAdditions = additions; audit.totals.rotationAdditions += additions.length;
      const expectedCorpus = corpus.records.filter(item => item.sampleSha256 === old.sha256);
      const corpusById = new Map(expectedCorpus.map(item => [item.importedId, item]));
      assert.equal(corpusById.size, expectedCorpus.length);
      const widgets = allWidgets(document), native = semanticNodes(semantics);
      assert.equal(new Set(widgets.map(item => item.id)).size, widgets.length);
      same(widgets.map(item => item.id).sort(), [...corpusById.keys()].sort(), 'Recovered node identities changed');
      sample.nodes = widgets.map(widget => {
        const record = corpusById.get(widget.id), source = native.get(`${record.packageId}:${record.sourceId}`); assert.ok(source, `Missing native source node ${widget.id}`);
        same(source.type, record.sourceType, `Native source type changed: ${widget.id}`);
        same(widget.type, record.importedType, `Imported type changed: ${widget.id}`);
        for (const [key, value] of Object.entries(record.nativeFlags ?? {})) same(source.storedFlags[key], value, `Native flag changed: ${widget.id}.${key}`);
        if (record.nativeFlags) audit.totals.sourceFlagsChecked++;
        const eligible = record.category === 'ordinary-vector-shape';
        assert.equal(Object.hasOwn(widget, 'shapeText'), eligible, `Unexpected shapeText presence: ${widget.id}/${record.category}`);
        if (eligible) {
          same(widget.shapeText, { autoFitWidth: record.nativeFlags.AutoFitWidth, autoFitHeight: record.nativeFlags.AutoFitHeight }, `Imported flags mismatch: ${widget.id}`);
          audit.totals.shapeTextMetadata++; audit.totals.ordinaryShapes++;
        }
        if (record.category === 'tree-contained-vector-label') audit.totals.treeLabelsExcluded++;
        if (record.category === 'table-cell' || record.category === 'menu-table-cell') audit.totals.tableMenuCellsExcluded++;
        return { id: widget.id, packageId: record.packageId, sourceId: record.sourceId, sourceType: source.type, importedType: widget.type, category: record.category, nativeFlags: record.nativeFlags, shapeText: widget.shapeText ?? null };
      });
      const stripped = structuredClone(document);
      for (const widget of allWidgets(stripped)) delete widget.shapeText;
      same(stripped, expected, 'Complete document changed beyond shapeText');
      sample.completeDocumentEqualIgnoringOnlyShapeText = true; audit.totals.completeDocumentsEqual++;
      sample.documentSha256 = hash(serializeDocument(document));
      sample.strippedDocumentSha256 = hash(serializeDocument(stripped));
      sample.expectedDocumentSha256 = hash(serializeDocument(expected));
      same(parseDocument(serializeDocument(document)), document, 'Serialize/parse roundtrip changed document');
      sample.roundtripEqual = true; audit.totals.roundtrips++;
      sample.metadataCount = widgets.filter(widget => Object.hasOwn(widget, 'shapeText')).length;
      sample.flags = groupCount(sample.nodes.filter(item => item.shapeText), item => `${item.shapeText.autoFitWidth}/${item.shapeText.autoFitHeight}`);
      sample.categories = groupCount(sample.nodes, item => item.category);
      sample.issueCount = issues.length;
      audit.totals.admittedSamples++; audit.totals.importedNodes += widgets.length;
    }
    sample.ok = true;
  } catch (error) {
    sample.error = error.message; if (error.difference) sample.firstDifference = error.difference;
    audit.failures.push({ sample: sample.name, error: sample.error, firstDifference: sample.firstDifference });
  } finally {
    sample.sourceAfterSha256 = sha(old.file); sample.sourceUnchanged = sample.sourceAfterSha256 === old.sha256 && sample.sourceBeforeSha256 === old.sha256;
    if (!sample.sourceUnchanged) { sample.ok = false; audit.failures.push({ sample: sample.name, error: 'Native source bytes changed' }); }
    audit.samples.push(sample); audit.totals.samples++;
    console.log(JSON.stringify({ sample: sample.name, ok: sample.ok, metadata: sample.metadataCount, error: sample.error, firstDifference: sample.firstDifference }));
  }
}
try {
  same(audit.totals, { samples: 11, admittedSamples: 10, rejectedSamples: 1, importedNodes: 1778, shapeTextMetadata: 1571, ordinaryShapes: 1571, treeLabelsExcluded: 4, tableMenuCellsExcluded: 15, sourceFlagsChecked: 1590, completeDocumentsEqual: 10, roundtrips: 10, rotationAdditions: 12 }, 'Final corpus totals changed');
  for (const [file, expected] of Object.entries(frozen)) assert.equal(sha(file), expected, `Frozen evidence changed during audit: ${file}`);
  for (const source of readerPins) assert.equal(sha(source.path), source.sha256, `Reader changed during audit: ${source.path}`);
  for (const [file, before] of moduleSources) assert.equal(sha(file), before, `Model changed during audit: ${file}`);
} catch (error) { audit.failures.push({ error: error.message, firstDifference: error.difference }); }
audit.sources = [pin('research/text-autofit-import-audit.mjs'), ...Object.keys(frozen).map(pin), ...readerPins, ...[...moduleSources.keys()].map(file => pin(path.relative(root, file))), ...baseline.samples.map(sample => ({ path: sample.file, sha256: sample.sha256 }))];
audit.ok = audit.failures.length === 0;
fs.writeFileSync(absolute('research/text-autofit-import-audit.json'), JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify({ ok: audit.ok, totals: audit.totals, failures: audit.failures, result: pin('research/text-autofit-import-audit.json') }, null, 2));
if (!audit.ok) process.exitCode = 1;
