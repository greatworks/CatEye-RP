import fs from 'node:fs';
import crypto from 'node:crypto';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const record = file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
const census = read('research/adaptive-hierarchy-format-census.json');
const summary = {
  method: 'Original bytes plus static managed metadata/CIL and controlled literal-resource decoding; no target execution or GUI.',
  assembly: { file: read('research/adaptive-hierarchy-format-view-cil.json').AssemblyPath, sha256: read('research/adaptive-hierarchy-format-view-cil.json').SHA256 },
  sampleCount: census.samples.length,
  counts: { completeViews: census.views.length, completeSets: census.sets.length, nonDefaultViews: census.samples.reduce((n, s) => n + s.nonDefaultViews, 0), nonemptySets: census.samples.reduce((n, s) => n + s.nonemptySets, 0) },
  samples: census.samples,
  storedFields: ['Id', 'Name', 'Size', 'Cursor', 'BaseViewId', 'BaseViewName', 'ParentAdaptiveViewSet'],
  generatedFields: ['id (non-Base only)', 'name', 'cursor', 'baseViewId (non-Base parent only)', 'size'],
  anchors: { viewWrite: 100715630, viewRead: 100715631, setWrite: 100715542, generatedView: 100694304, add: 100676306, copy: 100676307, remove: 100676308, directChildPredicate: 100676330 },
  delete: 'Reparent direct children to the deleted view parent, retain their own records, remove selected view.',
  importStatus: 'No native nontrivial hierarchy recovery: actual corpus has only three empty Base-only sets; match caches are not definitions.',
  unknown: ['Alternate compatibility writer Condition gate', 'Native final project-wide style cleanup after view deletion', 'Full widget content-sharing and per-type override capabilities', 'Nontrivial hierarchy generated HTML/GUI comparison'],
};
fs.writeFileSync('research/adaptive-hierarchy-format-evidence.json', JSON.stringify(summary, null, 2) + '\n');
const files = fs.readdirSync('research').filter(name => name.startsWith('adaptive-hierarchy-format-') && name !== 'adaptive-hierarchy-format-manifest.json').sort().map(name => record(`research/${name}`));
const sources = ['research/scripts/read-rp-objects.mjs', 'research/scripts/read-rp-container.mjs', 'research/scripts/inspect-rp-serialization.ps1', 'research/text-autofit-native-literals.mjs', 'research/gradient-angle-static-flow.mjs', 'research/gradient-angle-flow-init-cil.json', 'research/rich-hyperlink-format-census.json'].map(record);
const manifest = { target: summary.assembly, files, sources, samples: census.samples.map(({ file, sha256 }) => ({ file, sha256 })) };
for (const item of [...files, ...sources, ...manifest.samples, summary.assembly]) if (record(item.file).sha256 !== item.sha256) throw Error(`Hash mismatch: ${item.file}`);
fs.writeFileSync('research/adaptive-hierarchy-format-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ counts: summary.counts, verified: files.length + sources.length + manifest.samples.length + 1, manifest: record('research/adaptive-hierarchy-format-manifest.json') }));
