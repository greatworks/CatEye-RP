// Read-only identity counterexamples; reuses frozen census and verifies raw witnesses.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';
import { property as p, recoverRectanglePath } from './scripts/read-rp-semantics.mjs';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const pin = file => ({ file, sha256: sha(file) });
const vectors = read('research/rp-vector-census.json');
const corners = read('research/native-corners-format-census.json');
const pills = read('research/native-pills-format-inventory.json');
const adaptive = read('research/adaptive-behavior-format-census.json');
const corner = r => corners.widgets.find(w => w.id === r.id && w.packageId === r.packageId && w.sourceSha256 === r.sampleSha256);
const literalRectangle = r => {
  if (r.paths.length !== 1 || r.paths[0].length !== 4) return false;
  const points = r.paths[0];
  return points.every((v, i) => v[6] === true && v.slice(2, 6).every(n => n === 'NaN')
    && (v[0] === points[(i + 1) % 4][0]) !== (v[1] === points[(i + 1) % 4][1]))
    && new Set(points.map(v => v[0])).size === 2 && new Set(points.map(v => v[1])).size === 2;
};
const custom = vectors.records.filter(r => r.shape === 300);
const rectangles = custom.filter(literalRectangle);
const localCornerCustom = custom.filter(r => Object.keys(corner(r)?.local ?? {}).some(k => ['71', '81'].includes(k)));
assert.equal(rectangles.length, 2);
assert.equal(localCornerCustom.length, 2);
const rawWitnesses = [];
for (const sample of vectors.samples) {
  assert.equal(sha(sample.file), sample.sha256);
  const selected = [...rectangles, ...localCornerCustom].filter(r => r.sampleSha256 === sample.sha256);
  if (!selected.length) continue;
  const decoded = inspectRpObjects(sample.file);
  for (const record of selected) {
    const pack = decoded.packages.find(x => x.packageId === record.packageId);
    assert.equal(pack.sha256, record.packageSha256);
    const object = pack.objects.find(o => o.id === record.id), c = corner(record);
    const styleRef = p(object.properties, 'MyStyle');
    const style = pack.objects.find(o => o.id === styleRef.$reference);
    assert.equal(p(object.properties, 'Shape'), 300);
    const points = p(object.properties, 'ControlPoints');
    // The standalone family helper is deliberately invoked without the native identity gate.
    const family = recoverRectanglePath(points, c.size.Width, c.size.Height);
    if (literalRectangle(record)) assert.deepEqual(family.cornerRadii, [0, 0, 0, 0]);
    else assert.equal(family, null);
    rawWitnesses.push({ sample: pin(sample.file), packageId: pack.packageId,
      sourcePartSha256: pack.sha256, version: pack.version, sourceId: object.id,
      name: p(p(object.properties, 'name-block'), 'text'), sourceType: object.type,
      shape: p(object.properties, 'Shape'), controlPoints: points,
      myStyleReference: styleRef, myStyle: style.properties,
      adaptiveStyles: p(object.properties, 'AdaptiveStyles'),
      flags: Object.fromEntries(['IsContained','AutoFitWidth','AutoFitHeight','Selected'].map(k => [k,p(object.properties,k)])),
      size: c.size, location: c.location, effectiveRadius: c.effective[71], effectiveCornerMask: c.effective[81],
      witnessKind: literalRectangle(record) ? 'custom-identity-exact-rectangle' : 'custom-identity-retained-radius',
      familyOnlyCheck: { matched: Boolean(family), derivedRadii: family?.cornerRadii,
        meaning: 'Geometry only. Production native candidate still requires Shape0; no claim about how this object was authored.' } });
  }
  assert.equal(sha(sample.file), sample.sha256);
}
const adaptiveCustom = custom.filter(r => (r.semantic?.storedGeometry?.adaptiveStyleCount ?? 0) > 0);
const report = {
  capturedAt: new Date().toISOString(),
  method: 'Frozen 11-file census reuse; exact original UI/Form package/objects reread for two Shape300 rectangle counterexamples and two custom paths retaining local P71. No original assembly/application execution, no before/after editing history.',
  counts: { vectorRecords: vectors.records.length, shape0: vectors.records.filter(r => r.shape === 0).length,
    shape300: custom.length, exactFourAnchorRectanglesWithShape300: rectangles.length,
    shape300WithLocalCornerProperty: localCornerCustom.length,
    shape300WithObservedAdaptiveMapsInHistoricalSemanticTraversal: adaptiveCustom.length },
  samples: vectors.samples.map(s => ({ file: s.file, sha256: s.sha256,
    shape300: custom.filter(r => r.sampleSha256 === s.sha256).length })),
  rawWitnesses,
  adaptiveCustom: adaptiveCustom.map(r => ({ sample: r.sample, sampleSha256: r.sampleSha256,
    packageId: r.packageId, sourcePartSha256: r.packageSha256, sourceId: r.id,
    historicalFlatArrayLength: r.semantic.storedGeometry.adaptiveStyleCount,
    actualStyleReferences: p(adaptive.adaptiveStyles.find(a => a.id === r.id && a.packageId === r.packageId)?.properties, 'AdaptiveStyles')?.length / 2 })),
  localCornerCustom: localCornerCustom.map(r => ({ sample: r.sample, sourceId: r.id,
    packageId: r.packageId, local: corner(r).local })),
  parameterPillContrast: pills.owners.filter(w => ['e6d3d1fe008947a0a3ef9244d3296be6', 'd515a37dfd114af6877e6c6d4d244032'].includes(w.sourceId)).map(w => ({
    sample: w.sample, sampleSha256: w.sha256, packageId: w.packageId, sourcePartSha256: w.sourcePartSha256,
    sourceId: w.sourceId, shape: w.shape, size: w.size, actualRadius: w.effective[71],
    actualCornerMask: w.effective[81], savedControlPoints: w.rawControlPoints })),
  limitations: ['A Shape300 rectangle proves custom identity can coexist with rectangular geometry, not its user editing history.',
    'Historical census semantic admission is not refreshed or claimed current. Raw identities/path/part hashes are the relevant evidence.',
    'No native gesture, undo timing, or automatic restoration from custom identity to Rectangle is inferred from geometry.'],
  sources: ['research/rp-vector-census.json', 'research/native-corners-format-census.json',
    'research/adaptive-behavior-format-census.json',
    'research/native-pills-format-inventory.json', 'research/scripts/read-rp-objects.mjs',
    'research/scripts/read-rp-container.mjs', 'research/scripts/read-rp-semantics.mjs',
    'research/native-point-editing-format-inventory.mjs'].map(pin),
};
fs.writeFileSync('research/native-point-editing-format-inventory.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ counts: report.counts, rawWitnesses: rawWitnesses.map(w => ({sourceId:w.sourceId, shape:w.shape, size:w.size, matched:w.familyOnlyCheck.matched})), output:pin('research/native-point-editing-format-inventory.json') }, null, 2));
