// Read-only current-product capability probe. No original code is executed here.
// The structured Move/Resize payloads below are a PROPOSED contract, deliberately
// bypassing the current document parser. Their failures are missing capabilities,
// not regressions in the released legacy numeric action contract.
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';

const output = process.argv[2] ?? 'research/runtime-transform-core-red.json';
assert(/^research[\\/]runtime-transform-core-[^\\/]+\.json$/.test(output));
assert(!fs.existsSync(output), `Refusing to overwrite evidence: ${output}`);
const hash = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const files = ['src/runtime/export-runtime.ts', 'src/runtime/expressions.ts', 'src/runtime/engine.ts', 'src/model/types.ts', 'src/model/document.ts'];
const sources = files.map(path => ({ path, sha256: hash(path) }));
const strip = path => stripTypeScriptTypes(fs.readFileSync(path, 'utf8'), { mode: 'transform' }).replaceAll('export function ', 'function ');
const source = `${strip(files[1])}\n${strip(files[0])}\nglobalThis.factory=createOfflineRuntime;globalThis.evaluator=evaluateExpression;`;
const baselinePath = 'artifacts/runtime-rotate-source.rea.json';
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const evidence = ['research/runtime-transform-motion-evidence.md', 'research/runtime-transform-motion-evidence.json', 'research/runtime-transform-format-evidence.md'].map(path => ({ path, sha256: hash(path) }));
let uid = 0;
const event = (...actions) => ({ id: `e${++uid}`, event: 'click', name: 'Core gap probe', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ id: `a${++uid}`, ...action })) });
const variable = (targetId, value) => ({ type: 'setVariable', targetId, value });
const rotate = (targetId, patch = {}) => ({ type: 'rotate', targetId, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 64, ...patch } });
const moveInfo = (id, patch = {}) => ({ target: { kind: 'widget', id }, mode: 'delta', x: '80', y: '40', trajectory: 'straight', easing: 'linear', duration: 64, ...patch });
const resizeInfo = (id, patch = {}) => ({ target: { kind: 'widget', id }, width: '300', height: '160', anchor: 'bottom right', easing: 'linear', duration: 64, ...patch });
const move = (...targets) => ({ type: 'move', move: { targets } });
const resize = (...targets) => ({ type: 'resize', resize: { targets } });
const near = (a, b) => Math.abs(a - b) < 1e-8;
const geometry = w => ({ x: w.x, y: w.y, width: w.width, height: w.height, rotation: w.rotation });
function fixture() {
  const style = structuredClone(baseline.pages[0].widgets[0].style);
  const shape = { id: 'a', name: 'Probe shape', type: 'box', x: 100, y: 100, width: 200, height: 100, rotation: 0, text: '', style, interactions: [] };
  const doc = { ...structuredClone(baseline), id: 'core-probe', variables: { N: '0', Seen: '' }, pages: [{ id: 'page', name: 'Probe', width: 1200, height: 800, background: '#fff', widgets: [shape], interactions: [], adaptiveViews: [] }] };
  delete doc.adaptiveViewSets;
  return { doc, shape };
}
function harness(doc, portable) {
  let now = 0, sequence = 0;
  const timers = new Map();
  class ClockDate extends Date { static now() { return now; } }
  const bindings = { structuredClone, Date: ClockDate, URL, setTimeout: (fn, ms = 0) => { const id = ++sequence; timers.set(id, { fn, time: now + Number(ms) }); return id; }, clearTimeout: id => timers.delete(id) };
  const module = vm.createContext(bindings); vm.runInContext(source, module);
  let factory = module.factory, evaluator = module.evaluator;
  if (portable) {
    const standalone = vm.createContext(bindings);
    factory = vm.runInContext(`(${factory.toString()})`, standalone);
    evaluator = vm.runInContext(`(${evaluator.toString()})`, standalone);
  }
  const runtime = factory(doc, undefined, evaluator, undefined, {});
  const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
  const advance = async ms => {
    await flush(); const end = now + ms; let iterations = 0;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].time - b[1].time || a[0] - b[0])[0];
      if (!next || next[1].time > end) break;
      assert(++iterations <= 1000, 'Timer work budget exceeded');
      now = next[1].time; timers.delete(next[0]); next[1].fn(); await flush();
    }
    now = end; await flush();
  };
  return { runtime, flush, advance, timers, evaluator };
}
function watch(promise) {
  const state = { status: 'pending' };
  promise.then(() => { state.status = 'fulfilled'; }, error => { state.status = 'rejected'; state.error = error.message; });
  return state;
}
const results = [];
for (const portable of [false, true]) {
  const mode = portable ? 'bare-factory-toString' : 'source-module-function';
  async function check(name, kind, body) {
    const f = fixture(), h = harness(f.doc, portable);
    try { const result = await body({ ...f, ...h }); results.push({ mode, name, kind, ...result }); }
    catch (error) { results.push({ mode, name, kind, harnessError: error.stack }); }
    finally { h.runtime.dispose(); await h.flush(); }
  }
  await check('legacy numeric Move keeps duration inert and settles immediately', 'compatibility-control', async ({ runtime, shape, flush, timers }) => {
    const task = watch(runtime.execute(event({ type: 'move', targetId: 'a', x: 180, y: 140, duration: 64 }))); await flush();
    const actual = geometry(runtime.widget(shape));
    return { passed: actual.x === 180 && actual.y === 140 && task.status === 'fulfilled' && timers.size === 0, task, actual, timers: timers.size };
  });
  await check('legacy numeric Resize keeps duration inert and settles immediately', 'compatibility-control', async ({ runtime, shape, flush, timers }) => {
    const task = watch(runtime.execute(event({ type: 'resize', targetId: 'a', x: 300, y: 160, duration: 64 }))); await flush();
    const actual = geometry(runtime.widget(shape));
    return { passed: actual.width === 300 && actual.height === 160 && task.status === 'fulfilled' && timers.size === 0, task, actual, timers: timers.size };
  });
  await check('released Rotate interpolates while unrelated input proceeds', 'compatibility-control', async ({ runtime, shape, advance, flush }) => {
    const task = watch(runtime.execute(event(rotate('a')))); await advance(32); const midpoint = runtime.widget(shape).rotation;
    const input = watch(runtime.execute(event(variable('N', '7')))); await flush(); await advance(32);
    return { passed: near(midpoint, 45) && runtime.widget(shape).rotation === 90 && input.status === 'fulfilled' && task.status === 'fulfilled', midpoint, final: geometry(runtime.widget(shape)), variable: runtime.state().variables.N, input, task };
  });
  await check('Wait continuation keeps its completion without blocking a current Rotate', 'compatibility-control', async ({ runtime, shape, advance, timers }) => {
    const task = watch(runtime.execute(event(rotate('a'), { type: 'wait', value: '16' }, rotate('a', { degrees: '30' }))));
    await advance(16); const early = runtime.widget(shape).rotation; await advance(112);
    return { passed: near(early, 22.5) && near(runtime.widget(shape).rotation, 120) && task.status === 'fulfilled' && timers.size === 0, early, final: geometry(runtime.widget(shape)), task, timers: timers.size };
  });
  await check('proposed structured delta Move needs a real midpoint and final frame', 'proposed-contract-gap', async ({ runtime, shape, advance }) => {
    const task = watch(runtime.execute(event(move(moveInfo('a'))))); await advance(32); const midpoint = geometry(runtime.widget(shape)); await advance(32); const final = geometry(runtime.widget(shape));
    const expected = { midpoint: { x: 140, y: 120 }, final: { x: 180, y: 140 } };
    return { contractSatisfied: near(midpoint.x, 140) && near(midpoint.y, 120) && near(final.x, 180) && near(final.y, 140), midpoint, final, expected, task, basis: 'RTM-03 standalone delta; new payload intentionally not accepted by released schema' };
  });
  await check('proposed structured Resize needs its independent bottom-right anchor', 'proposed-contract-gap', async ({ runtime, shape, advance }) => {
    const task = watch(runtime.execute(event(resize(resizeInfo('a'))))); await advance(64); const actual = geometry(runtime.widget(shape));
    return { contractSatisfied: near(actual.x, 0) && near(actual.y, 40) && near(actual.width, 300) && near(actual.height, 160), actual, expected: { x: 0, y: 40, width: 300, height: 160 }, task, basis: 'RTM-05 full-duration ordinary Resize endpoint; does not assert unknown mixed DOM interpolation' };
  });
  await check('proposed ordered paired targets remain a single action carrier', 'proposed-contract-gap', async ({ doc, shape, runtime, flush }) => {
    // Both targets must be present when the runtime builds its immutable index.
    // A second runtime is therefore used; this is still current product code.
    const second = { ...structuredClone(shape), id: 'b', x: 300 }; doc.pages[0].widgets.push(second);
    const h = harness(doc, portable);
    try {
      const task = watch(h.runtime.execute(event(move(moveInfo('a', { easing: 'none', duration: 0 }), moveInfo('b', { x: '-20', y: '0', easing: 'none', duration: 0 }))))); await h.flush();
      const actual = [geometry(h.runtime.widget(shape)), geometry(h.runtime.widget(second))];
      return { contractSatisfied: actual[0].x === 180 && actual[0].y === 140 && actual[1].x === 280 && actual[1].y === 100, actual, expected: [{ x: 180, y: 140 }, { x: 280, y: 100 }], task, basis: 'format census: 8 real two-target Move actions; proposed schema, not native import admission' };
    } finally { h.runtime.dispose(); await h.flush(); }
  });
  await check('third timed channel must emit before a later variable action', 'proposed-contract-gap', async ({ shape, runtime, flush }) => {
    shape.interactions = [{ ...event(variable('Seen', '[[N]]')), event: 'rotate' }];
    const task = watch(runtime.execute(event(move(moveInfo('a', { duration: 40 })), resize(resizeInfo('a', { duration: 70 })), rotate('a', { duration: 100 }), variable('N', '9')))); await flush();
    const actual = runtime.state().variables.Seen;
    return { contractSatisfied: actual === '0', actual, expected: '0', task, basis: 'RTM-01 exact original third-channel eager emission; current Rotate-only flush sees later N=9' };
  });
  await check('motion expression API must preserve numeric zero versus string zero', 'existing-api-gap', async ({ evaluator }) => {
    const a = evaluator('0', () => undefined), b = evaluator('"0"', () => undefined);
    return { contractSatisfied: typeof a === 'number' && typeof b === 'string', actual: [{ value: a, type: typeof a }, { value: b, type: typeof b }], expected: [{ value: 0, type: 'number' }, { value: '0', type: 'string' }], basis: 'original action.js location uses loose xValue == empty-string; current public text evaluator intentionally formats both to text' };
  });
}
const summary = {
  compatibilityControls: results.filter(x => x.kind === 'compatibility-control').length,
  compatibilityPassed: results.filter(x => x.kind === 'compatibility-control' && x.passed).length,
  capabilityChecks: results.filter(x => x.kind !== 'compatibility-control').length,
  confirmedGaps: results.filter(x => x.kind !== 'compatibility-control' && x.contractSatisfied === false).length,
  harnessErrors: results.filter(x => x.harnessError).length,
};
const sourceStable = sources.every(item => hash(item.path) === item.sha256);
const result = { schema: 1, capturedAt: new Date().toISOString(), classification: 'pre-implementation capability red evidence, not a released-contract regression suite', execution: 'NodeVM; TypeScript stripped without semantic rewrite; deterministic clock; no browser, original JavaScript, build or test suite', payloadStatus: 'proposed Move/Resize payload bypasses current document parser; schema acceptance is not claimed', sources, sourceStable, baseline: { path: baselinePath, sha256: hash(baselinePath) }, evidence, probe: { path: 'research/runtime-transform-core-probe.mjs', sha256: hash('research/runtime-transform-core-probe.mjs') }, summary, results };
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output, sourceStable, summary }));
if (!sourceStable || summary.harnessErrors || summary.compatibilityPassed !== summary.compatibilityControls) process.exitCode = 1;
