import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceRoot = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins = {
  'expr.js': '530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
  'sto.js': 'c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6',
  'variables.js': '91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188',
  'action.js': 'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
};
const record = file => { const bytes = fs.readFileSync(path.resolve(root, file)); return { path: file, sha256: sha(bytes), bytes: bytes.length }; };
const sources = Object.entries(pins).map(([file, expected]) => {
  const r = record(path.join(sourceRoot, file)); assert.equal(r.sha256, expected); return r;
});
const reviewed = ['src/model/types.ts', 'src/model/document.ts', 'src/runtime/expressions.ts', 'src/model/components.ts', 'tests/runtime-transform-model.test.ts', 'tests/expressions.test.ts', 'tests/runtime-transform-expressions.test.ts'].map(record);
const harnessFile = 'research/runtime-transform-expression-probe.mjs';
const harnessText = fs.readFileSync(path.join(root, harnessFile), 'utf8');
const begin = harnessText.indexOf('function harness() {'), end = harnessText.indexOf('\nconst results = [];', begin);
assert.ok(begin >= 0 && end > begin);
// Reuse the already documented controlled input realm, without executing that
// script's main or overwriting any prior result. All vendor logic is read from
// the pinned shipped resources at execution time.
const source = file => fs.readFileSync(path.join(sourceRoot, file), 'utf8');
const slice = (file, from, through) => source(file).split(/\r?\n/).slice(from - 1, through).join('\n');
const harness = new Function('vm', 'source', 'slice', `${harnessText.slice(begin, end)}\nreturn harness;`)(vm, source, slice);
const results = [];
function check(name, fn) { try { results.push({ name, passed: true, observed: fn() }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }
const safely = fn => { try { return { kind: 'value', value: fn() }; } catch (error) { return { kind: 'error', name: error.name, message: error.message }; } };
const server = await createServer({ configFile: false, root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { evaluateExpression } = await server.ssrLoadModule('/src/runtime/expressions.ts');
  const model = await server.ssrLoadModule('/src/model/document.ts');
  const portable = vm.runInNewContext(`(${evaluateExpression.toString()})`);
  const cases = [
    { expression: 'missing.width || 10', sto: 'bin("||",prop("missing","width"),lit(10))', expected: '10' },
    { expression: '(!missing.width) + 10', sto: 'bin("+",{sto:"unOp",op:"!",inputSTO:prop("missing","width")},lit(10))', expected: '11' },
    { expression: '(missing.width == 0) + 10', sto: 'bin("+",bin("==",prop("missing","width"),lit(0)),lit(10))', expected: '10' },
    { expression: 'missing.width && 10', sto: 'bin("&&",prop("missing","width"),lit(10))', expected: 'undefined' },
  ];
  for (const item of cases) check(`RTRANS-REVIEW-01 ${item.expression}`, () => {
    const native = harness()(`var s=${item.sto}, text=${JSON.stringify(`[[${item.expression}]]`)};var direct;try{direct={kind:'value',value:$ax.evaluateSTO(s,{},event)}}catch(e){direct={kind:'error',name:e.name}};return {direct:direct,stringLiteral:$ax.expr.evaluateExpr(stringExpr(text,[s]),event)};`);
    const module = safely(() => evaluateExpression(item.expression, () => undefined, 'motion'));
    const serialized = safely(() => portable(item.expression, () => undefined, 'motion'));
    assert.equal(native.direct.kind, 'error'); assert.equal(native.direct.name, 'TypeError');
    assert.equal(native.stringLiteral, `[[${item.expression}]]`);
    assert.deepEqual(module, serialized);
    // A parity assertion intentionally remains red while this specific defect
    // is present. Observed results are retained regardless of its status.
    const defectPresent = module.kind === 'value';
    if (defectPresent) assert.equal(module.value, item.expected);
    return { native, module, serialized, parity: !defectPresent, status: defectPresent ? 'confirmed mismatch' : 'missing-value rejection corrected' };
  });
  for (const [expression, sto, expected] of [
    ['false && missing.width', 'bin("&&",lit(false),prop("missing","width"))', 'false'],
    ['true || missing.width', 'bin("||",lit(true),prop("missing","width"))', 'true'],
    ['missing.width + 10', 'bin("+",prop("missing","width"),lit(10))', 'undefined10'],
    ['missing.width - 10', 'bin("-",prop("missing","width"),lit(10))', 'NaN'],
  ]) check(`undefined control ${expression}`, () => {
    const native = harness()(`return $ax.expr.evaluateExpr(stringExpr(${JSON.stringify(`[[${expression}]]`)},[${sto}]),event)`);
    const actual = evaluateExpression(expression, () => undefined, 'motion');
    assert.equal(native, expected); assert.equal(actual, expected); return { native, actual };
  });
  check('clone scopes across nested panel and hyperlink actions', () => {
    const owner = model.createWidget('box'), target = model.createWidget('box'), external = model.createWidget('box');
    owner.id = 'scope-owner'; target.id = 'scope-target'; external.id = 'external-target';
    const expr = { text: '[[track.width + Widget.scope-target.text + "Widget.scope-target.text"]]', bindings: { track: { kind: 'widget', targetId: target.id }, external: { kind: 'widget', targetId: external.id } } };
    const move = { id: 'motion-action', type: 'move', move: { targets: [{ target: { kind: 'widget', id: target.id }, mode: 'location', x: expr, y: { text: '' }, trajectory: 'straight', easing: 'linear', duration: 70, boundary: { kind: 'compare', operator: '<=', direction: 'right', left: expr, right: { text: '100' } } }] } };
    owner.richText = { paragraphs: [{ runs: [{ text: 'link', style: {}, linkId: 'scope-link' }] }], links: [{ id: 'scope-link', name: 'Link', interactions: [{ id: 'link-event', event: 'click', enabled: true, name: '', conditions: [], conditionMode: 'all', actions: [move] }] }] };
    const panel = model.createWidget('panel'); panel.states[0].widgets = [owner, target];
    const before = JSON.stringify(panel), copy = model.cloneWidgets([panel], 0)[0];
    const [co, ct] = copy.states[0].widgets, a = co.richText.links[0].interactions[0].actions[0].move.targets[0];
    assert.equal(a.target.id, ct.id); assert.equal(a.x.bindings.track.targetId, ct.id); assert.equal(a.boundary.left.bindings.track.targetId, ct.id);
    assert.equal(a.x.bindings.external.targetId, external.id); assert.ok(a.x.text.includes(`Widget.${ct.id}.text`)); assert.ok(a.x.text.includes('"Widget.scope-target.text"'));
    assert.equal(JSON.stringify(panel), before); assert.notEqual(co.richText.links[0].id, 'scope-link');
    return { localRemapped: true, externalPreserved: true, quotedTextPreserved: true, originalUnchanged: true };
  });
  for (const alias of ['constructor', '__proto__', 'prototype']) check(`unsafe alias ${alias} rejected`, () => {
    const value = JSON.parse(`{"text":"1","bindings":{"${alias}":{"kind":"widget","targetId":"x"}}}`);
    assert.throws(() => model.parseMotionExpression(value)); return { rejected: true };
  });
  for (const text of ['track.constructor', 'globalThis.process', 'window.location', 'process.exit()', '(1).constructor("x")', 'value("__proto__")']) check(`no arbitrary evaluation ${text}`, () => {
    let reads = 0; assert.throws(() => evaluateExpression(text, () => { reads++; return 'x'; }, 'motion')); assert.equal(reads, 0); return { rejectedBeforeProvider: true };
  });
} finally { await server.close(); }
for (const input of reviewed) assert.equal(record(input.path).sha256, input.sha256, `source changed during review: ${input.path}`);
const output = process.argv[2] ?? 'research/runtime-transform-review-probes-first.json';
assert.ok(!fs.existsSync(path.join(root, output)), 'Choose a new output to preserve prior review evidence');
const report = { capturedAt: new Date().toISOString(), execution: 'Pinned original complete expr/sto/variables + exact action helper in Node VM; current source loaded with Vite SSR, plus serialized interpreter. No browser or DLL execution.', sources, implementation: reviewed, evidence: [record(harnessFile), record('research/runtime-transform-expression-final-probes.json'), record('research/runtime-transform-bindings-evidence.json')], script: record(path.relative(root, import.meta.filename)), summary: { total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, confirmedMismatches: results.filter(r => r.observed?.parity === false).length }, results, limitations: ['Controlled STO carriers are not generated by the original native expression compiler.', 'Geometry/text providers and event context use the explicitly documented parent probe facade.', 'The in-progress core action consumer and browser were intentionally not reviewed.', 'A rejected invalid input is an independent bounded-product policy; it does not prove full original error handling.'] };
fs.writeFileSync(path.join(root, output), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, summary: report.summary, failures: results.filter(r => !r.passed) }, null, 2));
if (report.summary.failed) process.exitCode = 1;
