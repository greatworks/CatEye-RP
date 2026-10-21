// Source-only arithmetic regression. No product module or original DLL runs.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { sourceSession, sources } from './selection-rotation-host-review-oracle.mjs';
const input = {
  handle: 1, grid: false,
  down: { x: -99.98446339083083, y: -1.7626912513572113 },
  targets: [
    { id: 'a', rect: { x: -100, y: -10, width: 20, height: 20 } },
    { id: 'b', rect: { x: 80, y: -10, width: 20, height: 20 } },
  ],
  requests: [{ point: { x: -98.17492321363702, y: -17.835340621969827 },
    modifiers: { shift: false, control: false, alt: false } }],
};
const actual = sourceSession(input);
const snap = actual.frames[0].controller.events.find(event => event.name === 'angle.snap');
if (snap.raw !== 9.999999999999972 || snap.answer !== snap.raw) throw Error('Unexpected retained K5wb/abNY boundary');
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const output = 'research/selection-rotation-model-angle-unit-probes.json';
if (fs.existsSync(output)) throw Error('Refusing to overwrite the first retained-source regression output');
fs.writeFileSync(output, JSON.stringify({ kind: 'retained-source K5wb unit-operation boundary', originalDllExecuted: false,
  originalGuiCompared: false, fullAxureParity: false, published: false, input, actual,
  sources: [...new Set([...sources, 'research/selection-rotation-host-review-oracle.mjs',
    'research/selection-rotation-model-angle-unit-probe.mjs'])].map(file => ({ file, sha256: sha256(file) })) }, null, 2) + '\n');
console.log(JSON.stringify({ output, snap }));
