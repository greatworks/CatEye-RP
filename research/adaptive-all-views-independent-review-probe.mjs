import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

// Read-only model imports. No Vite server, build, browser or target DLL execution.
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !path.extname(specifier)) return next(`${specifier}.ts`, context); throw error; }
} });
const { createPage, createWidget, mergeWidgetStyle } = await import('../src/model/document.ts');
const { resolveAdaptiveWidgets, applyAdaptiveWidgetEdits } = await import('../src/model/adaptive.ts');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [
  'src/model/adaptive.ts', 'src/model/types.ts', 'src/model/document.ts', 'src/model/adaptive-view-sets.ts',
  'src/App.tsx', 'src/components/Inspector.tsx', 'src/model/rich-text.ts', 'src/runtime/export-runtime.ts',
  'tests/adaptive-all-views-authoring.test.ts', 'tests/adaptive-all-views-padding.test.ts',
  'tests/runtime-adaptive-padding.test.ts', 'tests/e2e/adaptive-all-views-authoring.spec.ts',
  'scripts/adaptive-all-views-scenario.mjs',
];
const sources = files.map(file => ({ path: file, sha256: sha256(file) }));
const evidence = [
  'research/adaptive-all-views-authoring-evidence.md', 'research/adaptive-all-views-authoring-evidence.json',
  'research/adaptive-all-views-effects-evidence.md', 'research/adaptive-all-views-effects-evidence.json',
  'research/adaptive-all-views-static-probe.json', 'research/adaptive-all-views-effects-replay.json',
  'research/adaptive-all-views-effects-first-state-replay.json',
].map(file => ({ path: file, sha256: sha256(file) }));
const app = fs.readFileSync('src/App.tsx', 'utf8');
const start = app.indexOf('  function patchSelected('), end = app.indexOf('\n  function undo(', start);
if (start < 0 || end < 0) throw new Error('App.patchSelected extraction boundary changed');
const extracted = app.slice(start, end);
const executable = stripTypeScriptTypes(extracted);
const slice = { path: 'src/App.tsx', startLine: app.slice(0, start).split('\n').length,
  endLine: app.slice(0, end).split('\n').length - 1,
  sha256: crypto.createHash('sha256').update(extracted).digest('hex') };

function fixture() {
  const page = createPage('Independent review'); page.id = 'review-page';
  const a = createWidget('box'), b = createWidget('box'); a.id = 'review-a'; b.id = 'review-b';
  Object.assign(a, { x: 10, y: 20, width: 100, height: 80 });
  Object.assign(b, { x: 50, y: 60, width: 200, height: 90 });
  a.style.textPadding = [1, 2, 3, 4]; b.style.textPadding = [51, 52, 53, 54];
  page.widgets = [a, b];
  page.adaptiveViews = [{ id: 'review-child', name: 'Child', width: 390, overrides: {
    [a.id]: { x: 11, y: 21, width: 101, height: 81, style: { textPadding: [11, 12, 13, 14], fontSize: 20 } },
    [b.id]: { x: 51, y: 61, width: 201, height: 91, style: { textPadding: [61, 62, 63, 64], fontSize: 30 } },
  } }];
  page.adaptiveOverrides = { 'review-inactive': { [b.id]: { x: 71, y: 81, width: 221, height: 111, style: { textPadding: [71, 72, 73, 74], fontSize: 40 } } } };
  return page;
}
function command(page, patch, explicitTextStyle) {
  const widgets = resolveAdaptiveWidgets(page, 'review-child'); let edited;
  const context = { selectedTree: undefined, selectedTreeNode: undefined, treeSelection: undefined,
    activeMenuRoot: undefined, activeMenu: undefined, selectedTable: undefined, tableSelection: undefined,
    current: widgets[0], widgets, selected: widgets.map(widget => widget.id), mergeWidgetStyle,
    filterLineStylePatch: (_widget, value) => value,
    viewId: 'review-child', placementAllViews: true, changeWidgets: value => { edited = value; } };
  const patchSelected = Function(...Object.keys(context), `return (${executable})`)(...Object.values(context));
  patchSelected(patch, explicitTextStyle);
  if (!edited) throw new Error('Expected ordinary selected-widget branch');
  return applyAdaptiveWidgetEdits(page, 'review-child', edited, {
    allViews: true, placementAllViews: true, explicitTextStyle,
    explicitTextWidgetIds: widgets.map(widget => widget.id),
  });
}
const results = [];
{
  const page = fixture(), current = resolveAdaptiveWidgets(page, 'review-child')[0];
  const result = command(page, { style: { ...current.style, textPadding: [11, 40, 13, 14] } }, { textPadding: [11, 40, 13, 14] });
  const observed = { base: result.widgets[1].style.textPadding,
    child: result.adaptiveViews[0].overrides['review-b'], inactive: result.adaptiveOverrides['review-inactive']['review-b'] };
  const expected = { base: [51, 40, 53, 54], child: { x: 51, y: 61, width: 201, height: 91,
    style: { fontSize: 30 }, textPaddingSides: { top: 61, bottom: 63, left: 64 } },
    inactive: { x: 71, y: 81, width: 221, height: 111, style: { fontSize: 40 }, textPaddingSides: { top: 71, bottom: 73, left: 74 } } };
  results.push({ name: 'mixed-selection-right-padding-preserves-other-three-sides',
    pass: JSON.stringify(observed) === JSON.stringify(expected), observed, expected });
}
{
  const page = fixture(), result = command(page, { x: 99 });
  const observed = result.widgets.map(widget => ({ x: widget.x, y: widget.y }));
  const expected = [{ x: 99, y: 21 }, { x: 99, y: 61 }];
  results.push({ name: 'mixed-selection-x-keeps-each-target-effective-y-in-atomic-point',
    pass: JSON.stringify(observed) === JSON.stringify(expected) && !('y' in result.adaptiveOverrides['review-inactive']['review-b']), observed, expected });
}
{
  const page = fixture(), result = command(page, { width: 120 });
  const observed = result.widgets.map(widget => ({ width: widget.width, height: widget.height }));
  const expected = [{ width: 120, height: 81 }, { width: 120, height: 91 }];
  results.push({ name: 'mixed-selection-width-keeps-each-target-effective-height-in-atomic-size',
    pass: JSON.stringify(observed) === JSON.stringify(expected) && !('height' in result.adaptiveOverrides['review-inactive']['review-b']), observed, expected });
}
{
  const page = fixture(), current = resolveAdaptiveWidgets(page, 'review-child')[0];
  const result = command(page, { style: { ...current.style, fontSize: 20 } }, { fontSize: 20 });
  const observed = { firstBaseFont: result.widgets[0].style.fontSize,
    firstLocal: result.adaptiveViews[0].overrides['review-a'].style.fontSize,
    secondBaseFont: result.widgets[1].style.fontSize,
    secondLocal: result.adaptiveViews[0].overrides['review-b'].style.fontSize ?? null,
    secondPadding: result.widgets[1].style.textPadding };
  const expected = { firstBaseFont: page.widgets[0].style.fontSize, firstLocal: 20, secondBaseFont: 20,
    secondLocal: null, secondPadding: [51, 52, 53, 54] };
  results.push({ name: 'mixed-selection-font-compares-per-owner-without-copying-other-style',
    pass: JSON.stringify(observed) === JSON.stringify(expected), observed, expected });
}
const output = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), kind: 'independent-read-only-code-review',
  execution: 'Exact current App.patchSelected slice after TypeScript erasure plus current model modules; not original Axure or GUI execution.',
  stubs: ['No table/menu/tree selection; no React/render/undo host.', 'filterLineStylePatch is an identity sink for unrelated line-style capabilities; only padding/font/ordinary geometry commands run.', 'changeWidgets captures the ordinary widget array, then directly calls real applyAdaptiveWidgetEdits with the same view/All Views selection options.'],
  sources, evidence, slice, results,
  finding: { id: 'AAV-REVIEW-01', priority: 'P1', status: 'confirmed-before-fix',
    title: 'Single-edge padding edit copies the current widget tuple into every selected widget',
    locations: [{ path: 'src/components/Inspector.tsx', line: 578 }, { path: 'src/App.tsx', line: 319 }, { path: 'src/App.tsx', line: 339 }],
    consequence: 'Untouched padding sides are overwritten in other selected widgets and their active/inactive adaptive declarations are cleared.',
    recommendation: 'Preserve side intent, apply only that edge to each target effective tuple, then retain current per-edge model diff.' },
  boundaries: ['Native evidence is retained decoded-CIL replay with sinks; no authenticated native GUI result.',
    'cornerRadii/borderWidths reset pairs remain product extensions, distinct from native uniform radius/width and independent visibility masks.',
    'Whole-widget rich reset commands are product policy; all native character-selection toolbar paths and contained owner commands are not proved.',
    'No production browser, build, package or full test suite executed for this review.'],
};
const target = process.argv[2] ?? 'research/adaptive-all-views-independent-review.json';
// Preserve the first failed witness; subsequent verification must name a new file.
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ target, passed: results.filter(item => item.pass).length, failed: results.filter(item => !item.pass).map(item => item.name), sources }));
