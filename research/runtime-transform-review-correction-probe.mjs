import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const sha = text => createHash('sha256').update(text).digest('hex');
const pin = file => ({ path: file, sha256: sha(fs.readFileSync(path.resolve(root, file))) });
const first = JSON.parse(fs.readFileSync(path.join(root, 'research/runtime-transform-review-probes-first.json'), 'utf8'));
for (const original of first.sources) assert.equal(pin(original.path).sha256, original.sha256);
const sourceRoot = path.dirname(first.sources[0].path);
const source = file => fs.readFileSync(path.join(sourceRoot, file), 'utf8');
const slice = (file, from, through) => source(file).split(/\r?\n/).slice(from - 1, through).join('\n');
const harnessFile = 'research/runtime-transform-expression-probe.mjs', text = fs.readFileSync(path.join(root, harnessFile), 'utf8');
const begin = text.indexOf('function harness() {'), end = text.indexOf('\nconst results = [];', begin);
assert.ok(begin >= 0 && end > begin);
const harness = new Function('vm', 'source', 'slice', `${text.slice(begin, end)}\nreturn harness;`)(vm, source, slice);
const file = 'src/runtime/expressions.ts', before = pin(file);
const js = stripTypeScriptTypes(fs.readFileSync(path.join(root, file), 'utf8')).replace('export function evaluateExpression', 'function evaluateExpression');
const evaluate = vm.runInNewContext(`${js}\nevaluateExpression`), portable = vm.runInNewContext(`(${evaluate.toString()})`);
const results = [];
function test(name, fn) { try { results.push({ name, passed: true, observed: fn() }); } catch (e) { results.push({ name, passed: false, error: e.stack }); } }
const cases = [
  ['missing.width || 10', 'bin("||",prop("missing","width"),lit(10))'],
  ['(!missing.width) + 10', 'bin("+",{sto:"unOp",op:"!",inputSTO:prop("missing","width")},lit(10))'],
  ['(missing.width == 0) + 10', 'bin("+",bin("==",prop("missing","width"),lit(0)),lit(10))'],
  ['missing.width && 10', 'bin("&&",prop("missing","width"),lit(10))'],
];
for (const [input, sto] of cases) test(`RTRANS-REVIEW-01 correction ${input}`, () => {
  const original = harness()(`return $ax.expr.evaluateExpr(stringExpr(${JSON.stringify(`[[${input}]]`)},[${sto}]),event);`);
  assert.equal(original, `[[${input}]]`);
  const outcomes = [evaluate, portable].map(fn => {
    let thrown; try { fn(input, () => undefined, 'motion'); } catch (error) { thrown = { name: error.name, message: error.message }; }
    assert.equal(thrown?.name, 'MotionEvaluationError'); return thrown;
  });
  return { original, outcomes, inventedFiniteValuePrevented: true, consumerMarkerFallbackNotExecutedHere: true };
});
for (const [input, sto, expected] of [
  ['false && missing.width', 'bin("&&",lit(false),prop("missing","width"))', 'false'],
  ['true || missing.width', 'bin("||",lit(true),prop("missing","width"))', 'true'],
  ['missing.width + 10', 'bin("+",prop("missing","width"),lit(10))', 'undefined10'],
  ['missing.width - 10', 'bin("-",prop("missing","width"),lit(10))', 'NaN'],
]) test(`unchanged control ${input}`, () => {
  const original = harness()(`return $ax.expr.evaluateExpr(stringExpr(${JSON.stringify(`[[${input}]]`)},[${sto}]),event);`);
  assert.equal(original, expected);
  const reads = [];
  for (const fn of [evaluate, portable]) { let n = 0; assert.equal(fn(input, () => { n++; return undefined; }, 'motion'), expected); reads.push(n); }
  assert.deepEqual(reads, [1, 1]); return { original, reads };
});
for (const [input, sto] of cases) test(`explicit compiler cast boundary ${input}`, () => {
  const cast = sto.replaceAll('prop("missing","width")', 'Object.assign(prop("missing","width"),{computedType:"float"})');
  const original = harness()(`return $ax.expr.evaluateExpr(stringExpr(${JSON.stringify(`[[${input}]]`)},[${cast}]),event);`);
  const actual = evaluate(input, () => NaN, 'motion'); assert.equal(actual, original);
  return { original, actual, typedProvider: 'NaN', explanation: 'Controlled numeric cast, not evidence of what the native compiler emits.' };
});
test('unsafe failures remain distinguishable', () => {
  for (const fn of [evaluate, portable]) for (const input of ['globalThis.process', 'x'.repeat(4097)]) assert.throws(() => fn(input, () => '', 'motion'), { name: 'ExpressionError' });
  return { securityAndBudgetErrorsNotMotionEvaluationErrors: true };
});
assert.equal(pin(file).sha256, before.sha256, 'expression source changed during review');
const output = 'research/runtime-transform-review-correction-probes.json';
assert.ok(!fs.existsSync(path.join(root, output)), 'Preserve correction output');
const report = { capturedAt: new Date().toISOString(), execution: 'Same pinned original source harness; current TypeScript stripped without semantic transformation and standalone function serialized into separate VM. No browser or core consumer.', sources: first.sources, implementation: [before], evidence: [pin('research/runtime-transform-review-probes-first.json'), pin(harnessFile)], script: pin(path.relative(root, import.meta.filename)), summary: { total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length }, results };
fs.writeFileSync(path.join(root, output), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, summary: report.summary, failures: results.filter(r => !r.passed) }, null, 2));
if (report.summary.failed) process.exitCode = 1;
