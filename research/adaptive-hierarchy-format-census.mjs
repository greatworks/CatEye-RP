import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = 'research/rich-hyperlink-format-census.json';
const input = JSON.parse(fs.readFileSync(source, 'utf8')).samples;
const report = { capturedAt: new Date().toISOString(), method: 'Static native bytes through the self-written container/object readers; no target assembly execution', samples: [], views: [], sets: [], referencingObjects: [] };
for (const sample of input) {
  assert.equal(sha(sample.file), sample.sha256);
  const decoded = inspectRpObjects(sample.file), counts = { adaptiveViews: 0, adaptiveViewSets: 0, nonemptySets: 0, nonDefaultViews: 0 };
  for (const pack of decoded.packages) {
    const provenance = { file: sample.file, sha256: sample.sha256, packageId: pack.packageId, packageSha256: pack.sha256, version: pack.version };
    for (const object of pack.objects ?? []) {
      if (object.type === 'Axure:AdaptiveView') { counts.adaptiveViews++; report.views.push({ ...provenance, ...object }); }
      if (object.type === 'Axure:AdaptiveViewSet') {
        counts.adaptiveViewSets++; const list = object.properties.$map?.find(([key]) => key === 'AdaptiveViews')?.[1];
        if (Array.isArray(list) && list.length) { counts.nonemptySets++; counts.nonDefaultViews += list.length; }
        report.sets.push({ ...provenance, ...object });
      }
      const links = object.properties?.$map?.filter(([key]) => /AdaptiveView|EditAllAdaptive/.test(key));
      if (links?.length && !/Axure:AdaptiveView/.test(object.type)) report.referencingObjects.push({ ...provenance, id: object.id, type: object.type, offset: object.offset, properties: { $map: links } });
    }
  }
  report.samples.push({ file: sample.file, sha256: sample.sha256, ...counts, packageFailures: decoded.packages.filter(pack => pack.status === 'unsupported').map(pack => ({ path: pack.path, reason: pack.reason })) });
}
report.sources = [source, 'research/adaptive-hierarchy-format-census.mjs', 'research/scripts/read-rp-objects.mjs', 'research/scripts/read-rp-container.mjs'].map(file => ({ file, sha256: sha(file) }));
fs.writeFileSync('research/adaptive-hierarchy-format-census.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ samples: report.samples.map(sample => ({ ...sample, file: path.basename(sample.file) })), views: report.views.length, sets: report.sets.length, references: report.referencingObjects.length }, null, 2));
