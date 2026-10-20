/** Usage: node audit-rp-samples.mjs "<extracted Axure RP 11 directory>" */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { recoverRpSemantics } from './read-rp-semantics.mjs';

const samples = fileURLToPath(new URL('../samples/', import.meta.url));
if (!process.argv[2]) throw new Error('Pass the extracted official Axure RP 11 directory');
const shipped = JSON.parse(fs.readFileSync(path.join(samples, 'shipped-containers-summary.json')));
const inputs = shipped.map(s => ({ ...s, inputPath: path.join(process.argv[2], s.file) }));
inputs.push(...[
  ['the-basics-tab-menu.rp', '0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4'],
  ['complex-interactions-required-fields.rp', '0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c'],
].map(([file, sha256]) => ({ file, sha256, inputPath: path.join(samples, file) })));
const result = [];
for (const input of inputs) {
  const decoded = inspectRpObjects(input.inputPath);
  if (decoded.fileSha256 !== input.sha256) throw new Error(`Source hash mismatch: ${input.file}`);
  const semantics = recoverRpSemantics(decoded), widgets = semantics.diagrams.flatMap(d => d.widgets);
  const failures = decoded.packages.filter(p => p.status === 'unsupported').map(p => ({ path: p.path, reason: p.reason }));
  const summary = {
    file: input.file, sha256: decoded.fileSha256,
    parts: decoded.packages.length, decoded: decoded.packages.length - failures.length,
    objects: decoded.packages.reduce((n, p) => n + (p.objects?.length || 0), 0),
    versions: [...new Set(decoded.packages.filter(p => p.version).map(p => p.version.join('.')))], failures,
    semantics: {
      pages: semantics.diagrams.filter(d => d.rootType === 'Axure:Page').length,
      panelStates: semantics.diagrams.filter(d => d.rootType === 'Axure:PanelState').length,
      directDiagramMembers: widgets.length,
      storedLocationAndSize: widgets.filter(w => w.storedGeometry?.location && w.storedGeometry?.size).length,
      recoveredText: widgets.filter(w => typeof w.text?.text === 'string').length,
      failures: semantics.semanticFailures,
      unsupportedMembers: widgets.filter(w => w.status !== 'stored-fields-recovered').map(w => ({ id: w.id, status: w.status, reason: w.reason })),
      unsupportedText: widgets.filter(w => w.text?.status.startsWith('unsupported')).map(w => ({ id: w.id, ...w.text })),
    },
  };
  result.push(summary);
}
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
