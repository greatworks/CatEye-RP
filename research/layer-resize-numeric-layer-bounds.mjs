import fs from 'node:fs';
import { createHash } from 'node:crypto';
const hash = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const originalPath = 'src/model/layer-geometry.ts';
const retainedPath = 'research/layer-resize-numeric-layer-bounds-before.ts.txt';
// Preserve the reviewed bytes if the controller later unifies the author bounds helper.
if (!fs.existsSync(retainedPath)) fs.writeFileSync(retainedPath, fs.readFileSync(originalPath));
const probesPath = 'research/layer-resize-numeric-probes.json';
const probes = JSON.parse(fs.readFileSync(probesPath, 'utf8'));
const rows = probes.results.filter(row => row.group === 'sizing-bounds').map(row => {
  const r = row.input.original, angle = row.input.angle * Math.PI / 180;
  // The ordinary single-leaf expression from the captured product helper,
  // independently evaluated here. This is not original Axure code execution.
  const cosine = Math.abs(Math.cos(angle)), sine = Math.abs(Math.sin(angle));
  const width = r.width * cosine + r.height * sine, height = r.width * sine + r.height * cosine;
  const oldProduct = { x: r.x + (r.width - width) / 2, y: r.y + (r.height - height) / 2, width, height };
  return { angle: row.input.angle, rect: r, retainedCilResult: row.actual, oldProduct,
    maxAbsoluteDifference: Math.max(...Object.keys(r).map(key => Math.abs(row.actual[key] - oldProduct[key]))) };
});
const report = {
  schemaVersion: 1,
  kind: 'Source-bound CIL oracle results compared to independently evaluated captured product single-leaf arithmetic',
  sourceSnapshot: { originalPath, retainedPath, sha256: hash(retainedPath) },
  sources: [
    { path: probesPath, sha256: hash(probesPath) },
    { path: 'research/layer-resize-numeric-primitives-cil.json', sha256: hash('research/layer-resize-numeric-primitives-cil.json') },
    { path: 'research/layer-resize-numeric-dependencies-cil.json', sha256: hash('research/layer-resize-numeric-dependencies-cil.json') },
    { path: 'research/layer-resize-numeric-sizing-cil.json', sha256: hash('research/layer-resize-numeric-sizing-cil.json') },
  ],
  shortcut: {
    caller: { token: 100722239, name: 'g5s7.get_BoundingRect', offsets: [116, 117, 122, 131, 136, 297, 298, 303] },
    comparison: { token: 100688814, name: 'rbx2.pbxZ', signature: '0002020D0D', decodedSignature: 'static bool(double value, double epsilon)',
      offsets: [7, 8, 17, 18, 23, 24, 26], constantAt8: { opcode: 'ldc.r8', type: 'System.Double', value: 1 } },
    epsilon: { callerOffset: 122, opcode: 'ldc.r8', type: 'System.Double', value: 0.00001 },
    predicate: 'abs(rotation - 1) < 0.00001',
    angleGetter: { token: 100722214, signature: '20000D', field: 67134764 },
    degreeConversion: { caller: 100722216, callOffset: 449, callee: 100688805, name: 'rbx2.jbxa' },
  },
  recommendation: 'Use one source-bound author sizing-bounds function for both displayed Layer frames and resize snapshots while preserving nested-Layer flattening. No layer-geometry product changes are made by this report.',
  limits: [
    'Existing original CIL results are reused; no new original DLL or GUI execution.',
    'Only the old ordinary single-leaf rectangle expression is compared, not the complete Layer collector.',
    'Controller, provider and final CSS rendering have independent contracts.',
  ],
  results: rows,
};
fs.writeFileSync('research/layer-resize-numeric-layer-bounds.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ count: rows.length, oneDegree: rows.find(row => row.angle === 1), sourceSnapshot: report.sourceSnapshot }));
