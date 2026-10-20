import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// A narrow retained-JS replay. It does not launch Axure, a browser or a page.
// DOM/CSS, view application and the eventual text measurement are explicit sinks.
const originalRoot = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const files = Object.fromEntries(['adaptive.js', 'visibility.js', 'expr.js'].map(name => [name, fs.readFileSync(path.join(originalRoot, name), 'utf8')]));
const specs = [
  ['adaptive.js', 48, 159, '_switchView'],
  ['visibility.js', 1382, 1390, 'getResizedSize'],
  ['visibility.js', 1392, 1394, 'setResizedSize'],
  ['visibility.js', 1416, 1421, 'clearMovedAndResized'],
  ['expr.js', 400, 404, 'updateAutoFitted'],
];
const ranges = specs.map(([file, first, last, label]) => {
  const text = files[file].split(/\r?\n/).slice(first - 1, last).join('\n');
  assert.ok(text.includes(label), `Source moved: ${file}:${first} (${label})`);
  return { file, first, last, label, sha256: hash(text), text };
});

function replay(name, previousView, action) {
  const trace = [], owner = { id: 'w', css: { left: 400.5, top: 600.25, width: 500.75, height: 110.25, transform: 'rotate(123deg)' } }, child = { id: 'w_text', css: { width: 500.75, height: 110.25 } };
  const object = { type: 'vectorShape', isContained: false, fitToContent: false };
  const snapshot = value => JSON.parse(JSON.stringify(value));
  const query = element => ({
    length: 1,
    css: values => { trace.push({ kind: 'css-reset', id: element.id, values: snapshot(values) }); Object.assign(element.css, values); },
    children: selector => selector ? { length: 0 } : { length: 1, css: values => { trace.push({ kind: 'child-css-reset', values: snapshot(values) }); Object.assign(child.css, values); } },
  });
  const each = callback => callback(object, 'w');
  const ax = selector => ({ each });
  Object.assign(ax, {
    adaptive: { currentViewId: previousView, triggerEvent: name => trace.push({ kind: name }) },
    public: { fn: { IsTreeNodeObject: () => false, IsDynamicPanel: () => false } },
    getParentRepeaterFromElementIdExcludeSelf: () => undefined,
    constants: { CONNECTOR_TYPE: 'connector' },
    style: Object.fromEntries(['clearAdaptiveStyles', 'reselectElements', 'updateElementIdImageStyle', 'clearAppliedStyles'].map(key => [key, () => trace.push({ kind: key })])),
    visibility: { resetLimboAndHiddenToDefaults: () => trace.push({ kind: 'visibility-defaults' }), clearLimboAndHidden: () => trace.push({ kind: 'visibility-clear' }) },
    repeater: { refreshAllRepeaters: () => trace.push({ kind: 'refresh-repeaters' }) },
    dynamicPanelManager: Object.fromEntries(['resetFixedPanel', 'resetAdaptivePercentPanel', 'updateParentsOfNonDefaultFitPanels', 'updatePercentPanelCache', 'updateAllLayerSizeCaches'].map(key => [key, () => trace.push({ kind: key })])),
    expr: {}, placeholderManager: { refreshPlaceholder: () => {} }, annotation: { updateAllFootnotes: () => {} },
    postAdaptiveViewChanged: () => trace.push({ kind: 'post-view' }),
  });
  const context = vm.createContext({ $ax: ax, $axure: () => ({ each }), $jobj: () => query(owner),
    $: element => element === '*' ? { removeClass: value => trace.push({ kind: 'remove-class', value }) } : query(element),
    document: { getElementById: id => id === 'w' ? owner : undefined }, _loadFinished: false,
    _applyView: id => { trace.push({ kind: 'apply-view', id }); Object.assign(owner.css, { left: 45.5, top: 70.25, width: 61.125, height: 20.5 }); },
    _setLineImage: () => { throw new Error('Unexpected line branch'); }, _setAdaptiveConnectorImages: () => { throw new Error('Unexpected connector branch'); },
  });
  vm.runInContext(`var _visibility = {}, _movedIds={w:{left:400.5,top:600.25}}, _resizedIds={w:{width:500.75,height:110.25}}, _rotatedIds={w:123}, _resizingIds={w:{width:500.75}}, _autoFitIds={w:{width:120.75,height:50.25}};\n${ranges.map(item => item.text).join('\n')}`, context, { timeout: 1000 });
  const state = () => JSON.parse(vm.runInContext('JSON.stringify({moved:_movedIds,resized:_resizedIds,rotated:_rotatedIds,resizing:_resizingIds,registered:_autoFitIds})', context));
  const clear = ax.visibility.clearMovedAndResized;
  ax.visibility.clearMovedAndResized = () => { clear(); trace.push({ kind: 'clear-geometry', state: state() }); };
  context.autofitWidget = id => { trace.push({ kind: 'measure-sink', id, ownerCss: snapshot(owner.css), state: state() }); };
  const before = state(); vm.runInContext(action, context, { timeout: 1000 });
  return { name, action, previousView, before, after: state(), ownerCss: owner.css, trace };
}

const results = [
  replay('direct-remeasurement-retains-two-axis-cache', '', '$ax.expr.updateAutoFitted()'),
  replay('base-to-adaptive-clears-before-apply-refresh-measure', '', '_switchView("narrow")'),
  replay('adaptive-to-base-clears-before-refresh-measure', 'narrow', '_switchView("")'),
  replay('same-view-does-not-reset-or-remeasure', 'narrow', '_switchView("narrow")'),
];
const direct = results[0]; assert.deepEqual(direct.after, direct.before); assert.equal(direct.trace[0].state.resized.w.width, 500.75);
for (const result of results.slice(1, 3)) {
  for (const key of ['moved', 'resized', 'rotated', 'resizing']) assert.deepEqual(result.after[key], {});
  assert.deepEqual(result.after.registered, result.before.registered);
  const kinds = result.trace.map(item => item.kind);
  assert.ok(kinds.indexOf('css-reset') < kinds.indexOf('clear-geometry'));
  assert.ok(kinds.indexOf('clear-geometry') < kinds.indexOf('refresh-repeaters'));
  assert.ok(kinds.indexOf('refresh-repeaters') < kinds.indexOf('measure-sink'));
  assert.deepEqual(result.trace.find(item => item.kind === 'measure-sink').state.resized, {});
}
const narrow = results[1].trace.find(item => item.kind === 'measure-sink'); assert.equal(narrow.ownerCss.width, 61.125); assert.equal(narrow.ownerCss.height, 20.5);
assert.deepEqual(results[3].after, results[3].before); assert.deepEqual(results[3].trace, []);

const report = {
  schema: 'runtime-text-autofit-adaptive-replay-v1', capturedAt: new Date().toISOString(), cases: results.length,
  kind: 'Exact retained JS slices executed in isolated Node VM with injected DOM/CSS/view/measurement sinks. Not a browser, generated original page, DLL or GUI execution.',
  sources: Object.entries(files).map(([name, text]) => ({ path: path.join(originalRoot, name), sha256: hash(text) })),
  ranges: ranges.map(({ text, ...item }) => item),
  boundary: ['One ordinary non-contained, non-repeater shape.', 'View CSS application and eventual AutoFit measurement are injected; no glyph or cascade measurement.', 'Original routine also clears applied styles and more widget classes; the product transition scope remains explicitly narrower.', 'Same-view return is covered; masters, panels, tree branches and repeater internals are not replayed.'],
  results,
};
fs.writeFileSync('research/runtime-text-autofit-adaptive-probe.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ cases: results.length, passed: results.length, output: 'research/runtime-text-autofit-adaptive-probe.json' }));
