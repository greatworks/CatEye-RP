import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';

// Preserve native connector records before defining an independent connector
// model. Stored endpoints are not interchangeable with ordinary vector paths.
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const property = (value, name) => value?.$map?.find(([key]) => key === name)?.[1];
const samples = JSON.parse(fs.readFileSync('research/line-style-import-audit.json', 'utf8')).samples;
const plain = value => Array.isArray(value?.$map)
  ? Object.fromEntries(value.$map.map(([key, item]) => [key, plain(item)]))
  : Array.isArray(value) ? value.map(plain) : value;
const result = { capturedAt: new Date().toISOString(), method: 'Read-only native object parsing; no target application execution', samples: [], connectors: [] };
for (const sample of samples) {
  if (sha(sample.file) !== sample.sha256) throw new Error(`Changed native sample: ${sample.file}`);
  const decoded = inspectRpObjects(sample.file);
  let count = 0;
  for (const pack of decoded.packages) for (const object of pack.objects ?? []) {
    if (object.type !== 'Axure:DiagramObject:Connector') continue;
    count++;
    const properties = plain(object.properties);
    const references = [];
    function collect(value) {
      if (value && typeof value === 'object') {
        if (typeof value.$reference === 'string') references.push(value.$reference);
        for (const child of Object.values(value)) collect(child);
      }
    }
    collect(properties);
    const referenced = [...new Set(references)].map(id => {
      const target = pack.objects.find(item => item.id === id);
      return target ? { id, type: target.type, offset: target.offset, properties: plain(target.properties) } : { id, unresolvedInPackage: true };
    });
    const styleId = property(object.properties, 'MyStyle')?.$reference;
    result.connectors.push({ sample: path.basename(sample.file), sampleSha256: sample.sha256, packageId: pack.packageId, packageSha256: pack.sha256, id: object.id, objectOffset: object.offset, styleId, properties, referenced });
  }
  result.samples.push({ file: sample.file, sha256: sample.sha256, connectors: count });
}
result.sources = ['research/connector-format-census.mjs', 'research/line-style-import-audit.json', 'research/scripts/read-rp-container.mjs', 'research/scripts/read-rp-objects.mjs'].map(file => ({ file, sha256: sha(file) }));
fs.writeFileSync('research/connector-format-census.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ samples: result.samples.length, connectors: result.connectors.map(({ properties, referenced, ...identity }) => ({ ...identity, propertyNames: Object.keys(properties), referenceTypes: referenced.map(item => item.type ?? 'unresolved') })) }, null, 2));
