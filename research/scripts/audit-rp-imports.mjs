/** Research-only audit. Uses Node's type stripper on our own source, never a target assembly.
 * Usage: node research/scripts/audit-rp-imports.mjs "<extracted Axure RP 11 directory>"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { inspectRpSemantics } from './read-rp-semantics.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const samples = path.join(root, 'research/samples');
const transpile = file => stripTypeScriptTypes(fs.readFileSync(path.join(root, file), 'utf8'));
const dataURL = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const vectorURL = dataURL(transpile('src/model/vector.ts'));
const documentURL = dataURL(transpile('src/model/document.ts').replace("'./vector'", JSON.stringify(vectorURL)));
const importerURL = dataURL(transpile('src/model/import-rp.ts').replace("'./document'", JSON.stringify(documentURL)).replace("'./vector'", JSON.stringify(vectorURL)));
const { importRpSemantics } = await import(importerURL);
const { parseDocument, serializeDocument } = await import(documentURL);
if (!process.argv[2]) throw new Error('Pass the extracted official Axure RP 11 directory');
const shipped = JSON.parse(fs.readFileSync(path.join(samples, 'shipped-containers-summary.json')));
const inputs = shipped.map(s => ({ ...s, inputPath: path.join(process.argv[2], s.file) }));
inputs.push(...[
  ['the-basics-tab-menu.rp', '0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4'],
  ['complex-interactions-required-fields.rp', '0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c'],
].map(([file, sha256]) => ({ file, sha256, inputPath: path.join(samples, file) })));
const summary = [];
for (const input of inputs) {
  const semantic = inspectRpSemantics(input.inputPath);
  if (semantic.fileSha256 !== input.sha256) throw new Error(`Hash mismatch: ${input.file}`);
  const members = semantic.diagrams.flatMap(d => d.widgets);
  const item = {
    file: input.file, sha256: input.sha256, diagrams: semantic.diagrams.length,
    typeCandidates: members.filter(w => w.typeCandidate).length,
    uniqueCacheChains: members.filter(w => w.styleRecovery?.cacheChainComplete).length,
    roundedRectangles: members.filter(w => w.typeCandidate?.cornerRadii?.some(r => r > 0)).length,
    semanticFailures: semantic.semanticFailures, unsupportedFields: members.filter(w => w.status !== 'stored-fields-recovered').length,
  };
  try {
    const { document, report } = importRpSemantics(semantic, input.file);
    parseDocument(serializeDocument(document));
    item.import = { status: 'converted-and-model-validated', pages: report.pagesImported, widgets: report.widgetsImported, skipped: report.widgetsSkipped, panelStates: report.panelStatesImported, nestedWidgets: report.nestedWidgetsImported, nestedSkipped: report.nestedWidgetsSkipped, frozenAutoFit: report.issues.filter(i => i.code === 'stored-autofit-snapshot').length, events: report.eventsImported, skippedEvents: report.eventsSkipped, skippedInteractionTrees: report.interactionTreesSkipped, cases: report.casesImported, actions: report.actionsImported, variables: report.variablesImported, caseSelection: document.caseSelection ?? null };
  } catch (error) { item.import = { status: 'rejected', reason: error.message }; }
  summary.push(item);
}
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
