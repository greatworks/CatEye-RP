import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { loadTs } from '../.build/load-ts.mjs';

// Exact retained function bodies with named sinks, not an original generated
// page or a native GUI run. No vendor code is written to product files.
const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const files = Object.fromEntries(['adaptive.js', 'visibility.js', 'style.js'].map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
const specs = [
  ['adaptive.js', 48, 159, '_switchView'],
  ['adaptive.js', 245, 269, '_applyView'],
  ['adaptive.js', 271, 317, '_applyAdaptiveViewOnObject'],
  ['visibility.js', 1267, 1325, '_addLimboAndHiddenIds'],
  ['style.js', 964, 989, '_clearWidgetAppliedStyles'],
];
const ranges = specs.map(([file, first, last, label]) => {
  const text = files[file].split(/\r?\n/).slice(first - 1, last).join('\n');
  assert.ok(text.includes(label));
  return { file, first, last, label, sha256: sha(text), text };
});
const copy = value => JSON.parse(JSON.stringify(value));

function original({ name, previous = '', next = 'mobile', baseHidden = false, viewHidden = false, actualHidden = true, opacity = .25, applied = true, contained = false }) {
  const trace = [], nodes = Object.fromEntries(['w', 'w_div', 'w_text', 'w_input'].map(id => [id, { id, css: { opacity }, classes: new Set(applied ? ['action-style'] : []) }]));
  const widget = { type: 'buttonShape', isContained: contained, style: { visible: !baseHidden }, adaptiveStyles: { mobile: { visible: !viewHidden } } };
  let hidden = actualHidden;
  const each = fn => fn(widget, 'w');
  const wrap = node => ({
    length: node ? 1 : 0,
    hasClass: name => node?.classes.has(name) ?? false,
    parent: () => ({ hasClass: () => false }),
    css: patch => { trace.push({ kind: 'inline-reset', id: node.id, values: copy(patch) }); Object.assign(node.css, patch); },
    children: selector => selector ? { length: 0 } : { length: 3, css: patch => { trace.push({ kind: 'children-inline-reset', values: copy(patch) }); for (const id of ['w_div', 'w_text', 'w_input']) Object.assign(nodes[id].css, patch); } },
    removeClass: name => { node?.classes.delete(name); trace.push({ kind: 'remove-class', id: node?.id, name }); },
    addClass: name => { node?.classes.add(name); },
  });
  const jqueryAll = { not: () => jqueryAll, addClass: name => { trace.push({ kind: 'view-class', name }); }, removeClass: name => { trace.push({ kind: 'remove-view-class', name }); } };
  const ax = () => ({ each });
  Object.assign(ax, {
    adaptive: { currentViewId: previous, triggerEvent: event => trace.push({ kind: event }) },
    public: { fn: { IsTreeNodeObject: () => false, IsDynamicPanel: () => false, IsReferenceDiagramObject: () => false, IsTableCell: () => false, convertToSingleImage: () => {} } },
    constants: { CONNECTOR_TYPE: 'connector' },
    getObjectFromElementId: () => widget,
    getParentRepeaterFromElementIdExcludeSelf: () => undefined,
    model: { idsInRdoToHideOrLimbo: () => [] },
    repeater: { getScriptIdFromElementId: id => id, applySuffixToElementId: (id, suffix) => id + suffix, refreshAllRepeaters: () => trace.push({ kind: 'refresh-repeaters' }) },
    style: {
      clearAdaptiveStyles: () => trace.push({ kind: 'clear-adaptive-styles-sink' }),
      reselectElements: () => trace.push({ kind: 'reselect-sink' }),
      updateElementIdImageStyle: () => {}, generateState: () => 'normal',
      computeAllOverrides: () => widget.adaptiveStyles.mobile,
      setAdaptiveStyle: (_id, style) => trace.push({ kind: 'adaptive-style-sink', style: copy(style) }),
    },
    visibility: { clearMovedAndResized: () => trace.push({ kind: 'clear-geometry-sink' }) },
    dynamicPanelManager: Object.fromEntries(['resetFixedPanel', 'resetAdaptivePercentPanel', 'updateParentsOfNonDefaultFitPanels', 'updatePercentPanelCache', 'updateAllLayerSizeCaches'].map(name => [name, () => trace.push({ kind: name })])),
    expr: { updateAutoFitted: () => trace.push({ kind: 'remeasure-sink' }) },
    placeholderManager: { refreshPlaceholder: () => {} }, annotation: { updateAllFootnotes: () => {} },
  });
  const $ = node => node === '*' ? jqueryAll : wrap(node);
  $.extend = Object.assign;
  const context = vm.createContext({
    $ax: ax, $axure: () => ({ each }), $, $jobj: id => wrap(nodes[id]),
    document: { getElementById: id => nodes[id] }, _loadFinished: false,
    _getAdaptiveIdChain: () => ['mobile'], _isIdVisible: () => !hidden,
    _setWidgetVisibility: (id, options) => { hidden = !options.value; trace.push({ kind: 'visibility-write-sink', id, options: copy(options) }); },
    _clearWidgetAppliedCorners: () => trace.push({ kind: 'clear-corner-classes-sink' }),
  });
  vm.runInContext(`var _visibility={},_defaultLimbo={},_defaultHidden=${JSON.stringify(baseHidden ? { w: true } : {})},_idToAppliedStyles=${JSON.stringify(applied ? { w: { classList: ['action-style'], style: { fill: 'red', opacity } } } : {})};\n${ranges.map(r => r.text).join('\n')}`, context);
  const before = { hidden, ownerOpacity: nodes.w.css.opacity, classes: [...nodes.w.classes], applied: JSON.parse(vm.runInContext('JSON.stringify(_idToAppliedStyles)', context)) };
  vm.runInContext(`_switchView(${JSON.stringify(next)})`, context, { timeout: 1000 });
  const after = { hidden, ownerOpacity: nodes.w.css.opacity, classes: [...nodes.w.classes], applied: JSON.parse(vm.runInContext('JSON.stringify(_idToAppliedStyles)', context)) };
  return { name, parameters: { previous, next, baseHidden, viewHidden, actualHidden, opacity, applied, contained }, before, after, trace };
}

const cases = [
  { name: 'action-hide-then-base-to-visible-mobile' },
  { name: 'action-show-then-return-to-hidden-base', previous: 'mobile', next: '', baseHidden: true, viewHidden: true, actualHidden: false },
  { name: 'action-show-then-switch-to-hidden-mobile', baseHidden: true, viewHidden: true, actualHidden: false },
  { name: 'same-view-preserves-actions', previous: 'mobile', next: 'mobile' },
  { name: 'opacity-and-applied-style-cleared-before-named-view', actualHidden: false },
  { name: 'contained-visibility-and-inline-reset-are-not-generalized', actualHidden: true, contained: true },
];
const results = cases.map(original);
assert.equal(results[0].after.hidden, false);
assert.equal(results[1].after.hidden, true);
assert.equal(results[2].after.hidden, true);
assert.deepEqual(results[3].after, results[3].before);
assert.deepEqual(results[3].trace, []);
for (const i of [0, 1, 2, 4]) {
  assert.equal(results[i].after.ownerOpacity, '');
  assert.deepEqual(results[i].after.applied, {});
  assert.ok(!results[i].after.classes.includes('action-style'));
}
assert.equal(results[5].after.hidden, true);
assert.equal(results[5].after.ownerOpacity, .25);
for (const i of [0, 2]) {
  const t = results[i].trace.map(entry => entry.kind);
  assert.ok(t.indexOf('inline-reset') < t.indexOf('clear-geometry-sink'));
  assert.ok(t.indexOf('clear-geometry-sink') < t.indexOf('remove-class'));
  assert.ok(t.lastIndexOf('remove-class') < t.indexOf('view-class'));
  assert.ok(t.indexOf('view-class') < t.indexOf('visibility-write-sink'));
  assert.ok(t.indexOf('visibility-write-sink') < t.indexOf('refresh-repeaters'));
  assert.ok(t.indexOf('refresh-repeaters') < t.indexOf('remeasure-sink'));
}
const baseKinds = results[1].trace.map(entry => entry.kind);
assert.ok(baseKinds.indexOf('visibility-write-sink') < baseKinds.indexOf('clear-geometry-sink'));

const { createDocument, createWidget } = await loadTs('src/model/document.ts');
const { createOfflineRuntime } = await loadTs('src/runtime/export-runtime.ts');
const comparisons = [];
for (const config of cases.slice(0, 3)) {
  const doc = createDocument(), widget = createWidget('box'); widget.id = 'w';
  widget.hidden = config.baseHidden ?? false; widget.shapeText = { autoFitWidth: true, autoFitHeight: true };
  Object.assign(widget.style, { textPadding: [0, 0, 0, 0], verticalAlign: 'top', fill: '#ffffff', opacity: 1 });
  doc.pages[0].widgets = [widget]; doc.caseSelection = 'never';
  const runtime = createOfflineRuntime(doc);
  const initial = config.previous === 'mobile' ? { ...widget, hidden: config.viewHidden ?? false } : widget;
  runtime.widget(initial);
  const action = (type, extras = {}) => ({ id: type, type, targetId: widget.id, ...extras });
  await runtime.execute({ id: 'case', name: 'Change appearance', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: [action((config.actualHidden ?? true) ? 'hide' : 'show'), action('setStyle', { style: { opacity: .25, fill: '#ff0000' } })] });
  const target = config.next === '' ? widget : { ...widget, hidden: config.viewHidden ?? false, style: { ...widget.style, fill: '#0000ff' } };
  runtime.widget(target, [], false, config.next === '' ? undefined : { fill: '#0000ff' });
  await runtime.updateAutoFitted(true);
  const rendered = runtime.widget(target, [], false, config.next === '' ? undefined : { fill: '#0000ff' });
  comparisons.push({ name: config.name, nativeHidden: results.find(r => r.name === config.name).after.hidden, product: { hidden: rendered.hidden, opacity: rendered.style.opacity, fill: rendered.style.fill }, overrides: copy(runtime.state().widgetOverrides.w) });
  assert.notEqual(rendered.hidden, comparisons.at(-1).nativeHidden);
  assert.equal(rendered.style.opacity, .25); assert.equal(rendered.style.fill, '#ff0000');
  runtime.dispose();
}
const report = {
  schema: 'adaptive-style-reset-probe-v1', capturedAt: new Date().toISOString(),
  kind: 'Exact retained JavaScript slices in Node VM; DOM/CSS, state-style recomputation, visibility writes, repeater refresh and final measurement are explicit sinks. Current product core executed separately without DOM. Not native GUI or original generated-page pixels.',
  artifact: { distributionSha256: 'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0', extractionEvidenceId: 'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7' },
  sources: Object.entries(files).map(([name, text]) => ({ path: path.join(root, name), sha256: sha(text) })),
  ranges: ranges.map(({ text, ...r }) => r),
  product: ['src/runtime/export-runtime.ts', 'src/components/Preview.tsx', '.build/load-ts.mjs'].map(file => ({ path: file, sha256: sha(fs.readFileSync(file)) })),
  originalCases: results.length, productComparisons: comparisons.length, results, comparisons,
  boundaries: ['Single normal-state ordinary shape, plus one isContained exclusion control.', 'Visibility decision is actual retained code; _setWidgetVisibility is a recording sink, so Show/Hide event dispatch is not inferred.', 'Applied-style class removals and dictionary clearing are exact; SVG repaint, text-cache restoration, selected/disabled style recomputation and full CSS cascade are not replayed.', 'Opacity reset proves removal of inline action value, not a particular final stylesheet opacity.', 'Repeaters, masters, submenu and panel branches require their own cases before generalizing.'],
};
const output = 'research/adaptive-style-reset-probe.json';
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ originalCases: results.length, productComparisons: comparisons.length, status: 'observed differences asserted', output }));
