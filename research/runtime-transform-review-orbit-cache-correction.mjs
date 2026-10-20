import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const pin = file => ({ path: file, sha256: createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex') });
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const firstFile = 'research/runtime-transform-browser-final-probes.json', secondFile = 'research/runtime-transform-browser-confirmation-probes.json';
const first = read(firstFile), second = read(secondFile);
const cases = first.results.filter(x => x.name.startsWith('finite-shadow-corner-')).map(a => {
  const b = second.results.find(x => x.name === a.name); assert.ok(b);
  const af = a.observed.final, bf = b.observed.final;
  const delta = { left: bf.moved.left - af.moved.left, top: bf.moved.top - af.moved.top };
  return { name: a.name, first: { moved: af.moved, resized: af.resized, angle: af.angle }, confirmation: { moved: bf.moved, resized: bf.resized, angle: bf.angle }, delta, satisfiesPrevious1eMinus7Tolerance: Math.max(Math.abs(delta.left), Math.abs(delta.top)) <= 1e-7 };
});
assert.equal(cases.length, 6); assert.equal(cases.filter(x => !x.satisfiesPrevious1eMinus7Tolerance).length, 1);
const math = first.sources.find(x => /[\\/]math\.js$/.test(x.path)), move = first.sources.find(x => /[\\/]move\.js$/.test(x.path));
assert.ok(math && move); assert.equal(pin(math.path).sha256, math.sha256); assert.equal(pin(move.path).sha256, move.sha256);
const realm = vm.createContext({});
vm.runInContext('var ax={public:{fn:{}}}; var $axure={internal:function(fn){fn(ax)}};', realm);
vm.runInContext(fs.readFileSync(math.path, 'utf8'), realm, { timeout: 1500 });
const mutation = JSON.parse(vm.runInContext(`JSON.stringify((function(){var point={x:10,y:20},center={x:0,y:0};var out=ax.public.fn.getPointAfterRotate(90,point,center);return {point:point,center:center,out:out,sameIdentity:point===out};})())`, realm));
assert.deepEqual(mutation.point, { x: 10, y: 20 }); assert.deepEqual(mutation.center, { x: 0, y: 0 }); assert.equal(mutation.sameIdentity, false);
assert.ok(Math.abs(mutation.out.x + 20) < 1e-10 && Math.abs(mutation.out.y - 10) < 1e-10);
const report = {
  capturedAt: new Date().toISOString(), status: 'Additive correction; prior raw outputs and reports remain unchanged',
  evidence: [pin(firstFile), pin(secondFile), pin('research/runtime-transform-browser-fixtures.json'), pin('research/runtime-transform-browser-evidence.md')],
  sources: [pin(math.path), pin(move.path)], script: pin(path.relative(root, import.meta.filename)),
  method: 'Read-only comparison of two already retained real Edge runs; one new full retained math.js Node VM call. No new browser, DLL or GUI execution.',
  cases, getPointAfterRotate: mutation,
  corrections: [
    'The compact fixture orbitalCaches=1e-7 tolerance is disproved by its own two retained runs. Do not use one recorded orbit/cache endpoint as a universal deterministic oracle.',
    'move.js:283 invokes getPointAfterRotate for resizeShift but discards the returned point. The helper does not mutate its input. The previous prose implying this call rotates and accumulates resizeShift is withdrawn.',
    'The exact cause of the observed endpoint variation has not been isolated here. Same-frame source-step comparison is required before attributing it to a particular initial angle or changing an implementation.',
  ],
  acceptance: ['Keep deterministic resized-size and final angle checks where proved.', 'Compare per-step results under the same clock/frame sequence for orbital cache fidelity.', 'Do not weaken tests using an arbitrary broad endpoint tolerance to hide a different algorithm.'],
};
const output = 'research/runtime-transform-review-orbit-cache-correction.json';
assert.ok(!fs.existsSync(path.join(root, output)), 'Preserve additive correction evidence');
fs.writeFileSync(path.join(root, output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, comparedCases: cases.length, toleranceContradictions: 1, helperMutationCheck: 'passed' }));
