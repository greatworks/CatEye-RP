import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { makeSyntheticAdaptiveRp, IDS, SOURCE_SHA256 } from '../scripts/synthetic-rp-adaptive-fixture.mjs';
import { encodeSyntheticRpContainer } from '../scripts/synthetic-rp-object-carrier.mjs';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';
import { inspectRpSemantics } from './scripts/read-rp-semantics.mjs';

// Test-only binary carrier mutation. Every result is SYNTHETIC, not an Axure
// save/export and not evidence that the original corpus contains these values.
const map = pairs => ({ $map: pairs });
const get = (value, key) => value.$map.find(([name]) => name === key)?.[1];
const put = (value, key, next) => {
  const pair = value.$map.find(([name]) => name === key);
  if (pair) pair[1] = next; else value.$map.push([key, next]);
};
const prop = ({ key, value, flags = 3 }) => map([['DOAName', key | (flags << 30)], ['Value', value]]);
const ref = id => ({ $reference: id, referenceTag: 3 });
const syntheticId = n => 'fb' + n.toString(16).padStart(30, '0');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
if (!Array.isArray(cases) || cases.length > 100) throw Error('Expected a bounded matrix request');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rea-adaptive-property-matrix-'));
try {
  const { bytes } = makeSyntheticAdaptiveRp();
  const original = path.join(directory, 'SYNTHETIC-carrier.rp');
  fs.writeFileSync(original, bytes);
  const decoded = inspectRpObjects(original);
  const baselineSemantics = inspectRpSemantics(original);
  if (decoded.packages.length !== 6) throw Error('The matrix requires the complete six-package carrier');
  const results = cases.map((test, index) => {
    const packages = structuredClone(decoded.packages);
    const pack = packages.find(p => p.packageId === IDS.pagePackage);
    const target = pack.objects.find(o => o.id === IDS.target);
    const styleId = syntheticId(1), properties = test.properties.map(prop);
    if (test.states !== undefined) {
      const stateRefs = [];
      for (const [i, state] of test.states.entries()) {
        const id = syntheticId(10 + i);
        pack.objects.push({ id, type: 'Axure:Style', properties: map([['All', false], ['PropList', state.properties.map(prop)]]) });
        stateRefs.push([state.name, ref(id)]);
      }
      properties.push(prop({ key: 21, value: map(stateRefs) }));
    }
    pack.objects.push({ id: styleId, type: 'Axure:Style', properties: map([['All', false], ['PropList', properties]]) });
    put(target.properties, 'AdaptiveStyles', [{ $guid: IDS.tablet }, ref(styleId)]);
    if (test.paragraphLineSpacing !== undefined) {
      const rich = get(target.properties, 'RichTextBlock');
      const attributed = get(rich, 'attributed-string');
      for (const paragraph of get(attributed, 'Paragraphs')) put(paragraph, 'LineSpacing', test.paragraphLineSpacing);
    }
    const raw = encodeSyntheticRpContainer(packages);
    const file = path.join(directory, `SYNTHETIC-property-${index}.rp`);
    fs.writeFileSync(file, raw);
    const semantics = inspectRpSemantics(file);
    return { name: test.name, rawSha256: hash(raw), rawBytes: raw.length, semantics };
  });
  process.stdout.write(JSON.stringify({ synthetic: true, originalSourceSha256: SOURCE_SHA256, carrierSha256: hash(bytes), ids: IDS, baselineSemantics, cases: results }));
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
