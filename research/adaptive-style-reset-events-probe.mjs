import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const files = Object.fromEntries(['adaptive.js', 'visibility.js', 'axQuery.std.js'].map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
const specs = [
  ['visibility.js', 15, 32, 'SetIdVisible'],
  ['visibility.js', 40, 53, 'SetVisible'],
  ['visibility.js', 55, 124, '_setWidgetVisibility'],
  ['visibility.js', 148, 607, '_setVisibility'],
  ['visibility.js', 1267, 1325, '_addLimboAndHiddenIds'],
  ['adaptive.js', 245, 269, '_applyView'],
  ['adaptive.js', 271, 317, '_applyAdaptiveViewOnObject'],
];
const ranges = specs.map(([file, first, last, label]) => {
  const text = files[file].split(/\r?\n/).slice(first - 1, last).join('\n'); assert.ok(text.includes(label));
  return { file, first, last, label, text, sha256: hash(text) };
});
function run(config) {
  const events = [], trace = [];
  const node = { id: 'w', style: { visibility: config.visible ? 'inherit' : 'hidden', display: config.visible ? '' : 'none' } };
  const object = { type: config.type ?? 'buttonShape', isContained: config.contained ?? false, style: config.base ?? {}, adaptiveStyles: { mobile: config.view ?? {} } };
  const each = callback => callback(object, 'w');
  const wrap = element => ({ 0: element, length: element ? 1 : 0, parent: () => ({ attr: () => 'parent', hasClass: name => name === 'ax_menu' && config.menuParent }),
    hasClass: name => name === 'sub_menu' && config.submenu, removeClass: () => {}, remove: () => {},
    children: () => ({ length: 0 }), css: (name, value) => value === undefined ? element?.style[name] : element.style[name] = value,
  });
  const all = { not: () => all, addClass: () => {} };
  const $ = element => element === '*' ? all : wrap(element); $.extend = Object.assign;
  const ax = () => ({ each });
  const doc = { getElementById: id => id === 'w' ? node : undefined };
  Object.assign(ax, {
    visibility: {}, adaptive: { isDeviceMode: () => false }, constants: { CONNECTOR_TYPE: 'connector' },
    public: { fn: { IsReferenceDiagramObject: () => false, IsTableCell: type => type === 'tableCell', IsDynamicPanel: type => type === 'dynamicPanel', IsLayer: type => type === 'layer', convertToSingleImage: () => {} } },
    getObjectFromElementId: () => object, getParentRepeaterFromElementIdExcludeSelf: () => config.inRepeater ? 'repeater' : undefined,
    repeater: { getScriptIdFromElementId: id => id, applySuffixToElementId: (id, suffix) => id + suffix },
    style: { generateState: () => 'normal', computeAllOverrides: () => config.view ?? {}, setAdaptiveStyle: () => {}, SetWidgetSelected: () => { throw new Error('Unexpected selected-class branch'); } },
    dynamicPanelManager: { isIdFitToContent: () => false, isPercentWidthPanel: () => false, updatePercentPanelCache: () => {} },
    event: { raiseSyntheticEvent: (id, name) => { events.push({ id, name }); trace.push(name); } },
    action: { queueTypes: { fade: 'fade' }, fireAnimationFromQueue: () => trace.push('queue-next') },
    flyoutManager: { unregisterPanel: () => {} }, model: { idsInRdoToHideOrLimbo: () => [] },
  });
  const context = vm.createContext({ $ax: ax, $, $obj: () => object, $jobj: id => wrap(id === 'w' ? node : undefined), document: doc, window: { document: doc }, MOBILE_DEVICE: false,
    _getAdaptiveIdChain: () => ['mobile'], _pushContainer: () => { throw new Error('Unexpected adaptive container animation'); },
  });
  vm.runInContext(`var _visibility=$ax.visibility,_defaultLimbo={},_defaultHidden=${JSON.stringify(config.base?.visible === false ? { w: true } : {})},HIDDEN_CLASS='ax_default_hidden',UNPLACED_CLASS='ax_default_unplaced',SELECTED_ClASS='selected';\n${ranges.map(item => item.text).join('\n')}`, context);
  if (config.operation === 'direct') vm.runInContext(`_setWidgetVisibility('w',${JSON.stringify({ value: config.desired, noContainer: true, fire: true })})`, context);
  else if (config.operation === 'base') ax.visibility.resetLimboAndHiddenToDefaults();
  else if (config.operation === 'skipRepeater') ax.visibility.addLimboAndHiddenIds({}, {}, { each }, true);
  else vm.runInContext('_applyView("mobile")', context);
  const first = { visible: node.style.visibility !== 'hidden', events: [...events], trace: [...trace] };
  if (config.tryShowAfterLimbo) vm.runInContext("_setWidgetVisibility('w',{value:true,noContainer:true,fire:true})", context);
  return { name: config.name, config, first, final: { visible: node.style.visibility !== 'hidden', events, trace, limbo: JSON.parse(vm.runInContext('JSON.stringify(_limboIds)', context)) } };
}
const configs = [
  { name: 'missing-view-visible-inherits-hidden-base', base: { visible: false }, visible: true, expected: false },
  { name: 'missing-view-visible-inherits-visible-base', base: { visible: true }, visible: false, expected: true },
  { name: 'missing-view-and-base-visible-defaults-visible', visible: false, expected: true },
  { name: 'view-true-overrides-hidden-base', base: { visible: false }, view: { visible: true }, visible: false, expected: true },
  { name: 'view-false-overrides-visible-base', base: { visible: true }, view: { visible: false }, visible: true, expected: false },
  { name: 'same-visibility-no-event', visible: true, expected: true },
  { name: 'base-reset-hidden-does-not-fire', operation: 'base', base: { visible: false }, visible: true, expected: false },
  { name: 'contained-object-skipped', contained: true, visible: false, expected: false },
  { name: 'table-cell-skipped', type: 'tableCell', visible: false, expected: false },
  { name: 'submenu-skipped', submenu: true, visible: false, expected: false },
  { name: 'menu-contained-table-skipped', type: 'table', menuParent: true, visible: false, expected: false },
  { name: 'panel-root-reset-without-container-animation', type: 'dynamicPanel', visible: false, expected: true },
  { name: 'repeater-root-reset', type: 'repeater', visible: false, expected: true },
  { name: 'repeater-descendant-not-automatically-skipped-by-applyView', inRepeater: true, visible: false, expected: true },
  { name: 'explicit-skipRepeater-skips-descendant', operation: 'skipRepeater', inRepeater: true, visible: false, expected: false },
  { name: 'limbo-hides-and-later-action-cannot-show', view: { limbo: true }, visible: true, expected: false, tryShowAfterLimbo: true },
  { name: 'ordinary-explicit-show-fire-positive-control', operation: 'direct', visible: false, desired: true, expected: true, expectedEvent: 'onShow' },
  { name: 'ordinary-explicit-hide-fire-positive-control', operation: 'direct', visible: true, desired: false, expected: false, expectedEvent: 'onHide' },
];
const results = configs.map(run);
for (const item of results) {
  assert.equal(item.final.visible, item.config.expected, item.name);
  assert.deepEqual(item.final.events, item.config.expectedEvent ? [{ id: 'w', name: item.config.expectedEvent }] : [], item.name);
}
assert.deepEqual(results.find(item => item.config.tryShowAfterLimbo).final.limbo, { w: true });
const output = 'research/adaptive-style-reset-events-probe.json';
fs.writeFileSync(output, JSON.stringify({ schema: 'adaptive-style-reset-events-v1', capturedAt: new Date().toISOString(), kind: 'Exact retained applyView/addLimboAndHiddenIds/SetWidgetVisibility/SetVisibility/SetVisible bodies in Node VM. DOM nodes and nonanimated side-effect APIs are explicit mocks. No browser or original GUI.', sources: Object.entries(files).map(([file, text]) => ({ path: path.join(root, file), sha256: hash(text) })), ranges: ranges.map(({ text, ...entry }) => entry), cases: results.length, results, boundaries: ['No easing/animations; all adaptive calls omit easing and fire.', 'Normal-state computeAllOverrides is an injected view dictionary; merge of object base and supplied overrides is actual adaptive.js code. Full nested adaptive/named/state style resolution is not reproduced.', 'Panel root visibility gate is executed, not state scroll/fit/layout behavior.', 'Repeater descendant visibility gate is executed before a mocked refresh; row destruction/reinitialization is outside this probe.', 'Synthetic event dispatch is a recording sink; no actions or case menus execute.'] }, null, 2) + '\n');
console.log(JSON.stringify({ passed: results.length, output }));
