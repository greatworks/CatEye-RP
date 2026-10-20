import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripTypeScriptTypes } from 'node:module';

const files = [
  'src/model/widget-structure.ts', 'src/model/layer-geometry.ts', 'src/model/document.ts',
  'src/model/adaptive.ts', 'src/model/components.ts', 'src/model/adaptive-view-sets.ts',
  'src/App.tsx', 'src/components/WidgetView.tsx', 'src/components/Inspector.tsx',
  'src/components/LayerEditor.tsx', 'tests/native-layers-model.test.ts',
  'tests/e2e/native-layers-authoring.spec.ts', 'tests/e2e/native-layers-rich-display.spec.ts', 'src/model/rich-text.ts',
];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = files.map(file => ({ file, sha256: hash(file) }));
const results = [];
const check = (name, run) => {
  try { const detail = run(); results.push({ name, passed: true, ...(detail ? { detail } : {}) }); }
  catch (error) { results.push({ name, passed: false, error: String(error), stack: error.stack }); }
};
const server = await createServer({ configFile: false, root: path.resolve('.'), plugins: [react()], logLevel: 'error',
  server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
  const d = await server.ssrLoadModule('/src/model/document.ts');
  const a = await server.ssrLoadModule('/src/model/adaptive.ts');
  const sets = await server.ssrLoadModule('/src/model/adaptive-view-sets.ts');
  const c = await server.ssrLoadModule('/src/model/components.ts');
  const g = await server.ssrLoadModule('/src/model/layer-geometry.ts');
  const s = await server.ssrLoadModule('/src/model/widget-structure.ts');
  const rich = await server.ssrLoadModule('/src/model/rich-text.ts');
  const { WidgetContent } = await server.ssrLoadModule('/src/components/WidgetView.tsx');
  // Execute exactly the new pure display closure in App, supplying only its
  // existing lexical dependencies. This is not a reimplementation of the fix.
  const appText = fs.readFileSync('src/App.tsx', 'utf8');
  const displaySource = /  function resolveCanvasDisplay\([\s\S]*?\r?\n  }\r?\n/.exec(appText)?.[0];
  assert.ok(displaySource, 'Expected actual App display function');
  const displayJs = stripTypeScriptTypes(displaySource);
  const displayFor = (page, viewId) => new Function(
    'page', 'viewId', 'effectPreview', 'resolveAdaptiveOverride', 'resolveInteractionStylePatch',
    'projectTextStyleOverride', 'findWidget', 'mergeWidgetStyle', 'resolveSelectedStyle', 'applyRichTextStyle',
    `${displayJs}; return source => resolveCanvasDisplay(source).widget;`,
  )(page, viewId, null, a.resolveAdaptiveOverride, d.resolveInteractionStylePatch,
    rich.projectTextStyleOverride, d.findWidget, d.mergeWidgetStyle, d.resolveSelectedStyle, rich.applyRichTextStyle);
  const leaf = (id, x = 100, y = 80) => ({ ...d.createWidget('text', x, y), id, width: 80, height: 30, text: id });
  const project = widgets => { const doc = d.createDocument(); doc.pages[0].widgets = widgets; return doc; };
  const roundTrip = doc => assert.deepEqual(d.parseDocument(d.serializeDocument(doc)), doc);

  check('negative member union excludes nested degrees, effects and origin', () => {
    const item = { ...leaf('a', -100, -80), width: 40, height: 20, hidden: true, placed: false, rotation: 90 };
    item.style.outerShadow = { on: true, offsetX: 100, offsetY: 100, blurRadius: 100, color: '#ff0000' };
    const inner = d.createLayer([item]); inner.rotation = 37;
    assert.deepEqual(g.layerAuthoringBounds([inner]), { x: -90, y: -90, width: 20, height: 40 });
  });
  check('nested clone offsets shared coordinates once and preserves panel/repeater local coordinates', () => {
    const panel = d.createWidget('panel', 240, 130);
    panel.states[0].widgets = [d.createLayer([leaf('panel-child', 6, 7)])];
    const repeater = d.createWidget('repeater', 400, 200);
    repeater.repeater.template = [d.createLayer([leaf('row-child', 8, 9)])];
    const outer = d.createLayer([d.createLayer([leaf('a'), panel, repeater])]);
    const [copy] = d.cloneWidgets([outer], 20), nested = copy.layer.widgets[0];
    assert.deepEqual(nested.layer.widgets.map(w => [w.x, w.y]), [[120, 100], [260, 150], [420, 220]]);
    assert.deepEqual(nested.layer.widgets[1].states[0].widgets[0].layer.widgets.map(w => [w.x,w.y]), [[6,7]]);
    assert.deepEqual(nested.layer.widgets[2].repeater.template[0].layer.widgets.map(w => [w.x,w.y]), [[8,9]]);
    assert.equal([...d.collectWidgetIdentifiers([copy]).keys()].some(id => d.collectWidgetIdentifiers([outer]).has(id)), false);
    roundTrip(project([copy]));
  });
  check('grouping in child view preserves base and unrelated view local declarations', () => {
    const doc = project([leaf('a'), leaf('b', 220, 120)]), page = doc.pages[0];
    page.adaptiveViews = [
      { id: 'parent', name: 'Parent', width: 800, overrides: { a: { x: 10, style: { color: '#ff0000' } } } },
      { id: 'child', name: 'Child', width: 400, baseViewId: 'parent', overrides: { a: { x: 10, hidden: false }, b: { width: 40 } } },
      { id: 'other', name: 'Other', width: 1200, overrides: { a: { x: 70 }, b: { placed: false } } },
    ];
    const original = structuredClone(page), visible = a.resolveAdaptiveWidgets(page, 'child');
    const grouped = d.groupIntoLayer(visible, ['a', 'b']);
    const next = a.applyAdaptiveWidgetEdits(page, 'child', grouped.widgets, { placementAllViews: true });
    assert.deepEqual(next.adaptiveViews, original.adaptiveViews);
    assert.deepEqual(next.widgets[0].layer.widgets, original.widgets);
    assert.deepEqual(a.resolveAdaptiveWidgets(next, 'child')[0].layer.widgets, visible);
    const ungrouped = a.applyAdaptiveWidgetEdits(next, 'child', d.ungroupLayers(a.resolveAdaptiveWidgets(next, 'child'), [grouped.layer.id]).widgets);
    assert.deepEqual(ungrouped, original);
    roundTrip({ ...doc, pages: [next] });
  });
  check('all-views grouping is structural and does not clear unchanged member declarations', () => {
    const doc = project([leaf('a'), leaf('b')]), page = doc.pages[0];
    page.adaptiveViews = [{ id: 'v', name: 'V', width: 400, overrides: { a: { x: 11, style: { color: '#ff0000' } } } }];
    const grouped = d.groupIntoLayer(a.resolveAdaptiveWidgets(page, 'v'), ['a', 'b']);
    const next = a.applyAdaptiveWidgetEdits(page, 'v', grouped.widgets, { allViews: true, placementAllViews: true });
    assert.deepEqual(next.adaptiveViews, page.adaptiveViews);
    assert.deepEqual(next.widgets[0].layer.widgets, page.widgets);
  });
  check('deleting a nested group prunes active and inactive shared maps', () => {
    let doc = project([d.createLayer([d.createLayer([leaf('a'), leaf('b')]), leaf('c')])]);
    const pageId = doc.pages[0].id;
    doc = sets.createAdaptiveViewSet(doc, 'Shared');
    doc.adaptiveViewSets[0].views = [{ id: 'v', name: 'V', width: 400, height: 0 }];
    doc = sets.assignAdaptiveViewSet(doc, pageId, doc.adaptiveViewSets[0].id);
    doc.pages[0].adaptiveOverrides = { v: { a: { hidden: true }, c: { x: 7 } }, orphan: { b: { style: { color: '#ff0000' } }, c: {} } };
    let effective = sets.resolveAdaptivePage(doc, doc.pages[0]);
    effective = a.deleteAdaptiveWidgets(effective, null, [effective.widgets[0].layer.widgets[0].id], true);
    doc = sets.commitAdaptivePage(doc, effective);
    assert.deepEqual(doc.pages[0].adaptiveOverrides, { v: { c: { x: 7 } }, orphan: { c: {} } });
    roundTrip(doc);
  });
  check('cloning group remaps legacy group and rich link, action, submit and local-binding references', () => {
    const first = leaf('first'), second = { ...d.createWidget('input'), id: 'second' };
    first.groupId = second.groupId = 'legacy-group';
    first.richText = { paragraphs: [{ runs: [{ text: 'link', linkId: 'link-id' }] }], links: [{ id: 'link-id', name: 'Link', interactions: [{ id: 'link-case', name: 'Click', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: 'link-action', type: 'setText', targetId: 'second', value: 'value' }] }] }] };
    first.text = 'link'; second.submitButtonId = 'first';
    second.interactions = [{ id: 'case', name: 'Move', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: 'action', type: 'move', move: { targets: [{ target: { kind: 'widget', id: 'first' }, mode: 'delta', trajectory: 'straight', x: { text: '[[Target.x]]', bindings: { a: { kind: 'widget', targetId: 'second' } } }, y: { text: '0' }, easing: 'none', duration: 0 }] } }] }];
    const [copy] = d.cloneWidgets([d.createLayer([first, second])], 0), [f, v] = copy.layer.widgets;
    assert.notEqual(f.groupId, first.groupId); assert.equal(v.groupId, f.groupId);
    assert.equal(f.richText.links[0].interactions[0].actions[0].targetId, v.id);
    assert.equal(f.richText.paragraphs[0].runs[0].linkId, f.richText.links[0].id);
    assert.equal(v.submitButtonId, f.id);
    assert.equal(v.interactions[0].actions[0].move.targets[0].target.id, f.id);
    assert.equal(v.interactions[0].actions[0].move.targets[0].x.bindings.a.targetId, v.id);
    roundTrip(project([copy]));
  });
  check('component child deletion through group synchronizes siblings and prunes inactive maps', () => {
    const component = c.createComponent([d.createLayer([leaf('a'), leaf('b', 230, 80)])]);
    const first = c.createComponentInstance(component, 10, 20), second = c.createComponentInstance(component, 310, 20);
    let doc = project([d.createLayer([first, second])]); doc.components = [component];
    const firstChild = first.states[0].widgets[0].layer.widgets[0], secondChild = second.states[0].widgets[0].layer.widgets[0];
    doc.pages[0].adaptiveOverrides = { inactive: { [firstChild.id]: { hidden: true }, [secondChild.id]: {} } };
    const definition = structuredClone(component); definition.widgets[0].layer.widgets.shift();
    definition.widgets = g.fitLayerTree(definition.widgets);
    doc = c.updateComponent(doc, definition);
    assert.deepEqual(doc.pages[0].adaptiveOverrides, { inactive: {} });
    assert.equal(d.findWidget(doc.pages[0], firstChild.id), undefined);
    assert.equal(d.findWidget(doc.pages[0], secondChild.id), undefined);
    roundTrip(doc);
  });
  check('repeater rich text row projection occurs once through nested groups', () => {
    const label = leaf('row'); label.text = '[[Item.Name]]';
    label.richText = { paragraphs: [{ runs: [{ text: '[[Item.Name]]', style: { fontSize: 17 } }] }] };
    const repeater = d.createWidget('repeater');
    repeater.repeater.template = [d.createLayer([d.createLayer([label])])];
    repeater.repeater.rows = [{ Name: '[[Item.Next]]', Next: 'wrong second expansion' }];
    const doc = project([repeater]), resolveChildDisplay = displayFor(doc.pages[0], null);
    const html = renderToStaticMarkup(React.createElement(WidgetContent, { widget: repeater, resolveChildDisplay }));
    assert.ok(html.includes('[[Item.Next]]')); assert.ok(!html.includes('wrong second expansion'));
    assert.ok(html.includes('font-size:17px'));
  });
  check('named adaptive rich formatting is identical outside and inside a group', () => {
    const label = leaf('rich'); label.text = 'Rich';
    label.richText = { paragraphs: [{ runs: [{ text: 'Rich', style: { fontSize: 14, color: '#000000' } }] }] };
    const doc = project([d.createLayer([label])]), page = doc.pages[0];
    page.adaptiveViews = [{ id: 'v', name: 'V', width: 400, overrides: { rich: { style: { fontSize: 32, color: '#ff0000' } } } }];
    const group = a.resolveAdaptiveWidgets(page, 'v')[0];
    const before = structuredClone(doc), resolveChildDisplay = displayFor(page, 'v');
    const groupedHtml = renderToStaticMarkup(React.createElement(WidgetContent, { widget: group, resolveChildDisplay }));
    const child = group.layer.widgets[0];
    const displayPatch = rich.projectTextStyleOverride(a.resolveAdaptiveOverride(page, 'v', 'rich').style);
    const enteredHtml = renderToStaticMarkup(React.createElement(WidgetContent, { widget: { ...child, richText: rich.applyRichTextStyle(child.richText, displayPatch) }, resolved: true }));
    assert.ok(enteredHtml.includes('font-size:32px'), 'App current-scope projection must apply the explicit adaptive font');
    assert.ok(groupedHtml.includes('font-size:32px'), `Closed group lost adaptive run projection: ${groupedHtml}`);
    assert.ok(!groupedHtml.includes('font-size:14px'), `Group run still uses 14px: ${groupedHtml}\nEntered group: ${enteredHtml}`);
    assert.ok(groupedHtml.includes('font-size:32px;color:#ff0000'));
    assert.deepEqual(doc, before, 'Display projection must never materialize formatting into the document');
    // An explicit color-only view must not flatten the unrelated base font
    // default over a 14px rich run.
    page.adaptiveViews[0].overrides.rich = { style: { color: '#ff0000' } };
    page.widgets[0].layer.widgets[0].style.fontSize = 40;
    const partial = a.resolveAdaptiveWidgets(page, 'v')[0];
    const partialHtml = renderToStaticMarkup(React.createElement(WidgetContent, { widget: partial, resolveChildDisplay: displayFor(page, 'v') }));
    assert.ok(partialHtml.includes('font-size:14px;color:#ff0000'));
    return { groupedHtml, enteredHtml, partialHtml, extractedHostFunctionSha256: crypto.createHash('sha256').update(displaySource).digest('hex') };
  });
} finally { await server.close(); }
const sourceStableDuringProbe = sources.every(source => hash(source.file) === source.sha256);
const report = {
  generatedAt: new Date().toISOString(),
  kind: 'read-only independent Layer author/model review',
  originalAxureGuiCompared: false,
  productEdited: false,
  probeKind: 'direct source model calls and React server markup; no browser, DLL or GUI execution',
  sources, sourceStableDuringProbe,
  checks: { total: results.length, passed: results.filter(result => result.passed).length },
  results, blockingFindings: results.filter(result => !result.passed),
};
const output = process.argv[2] ?? 'research/native-layers-authoring-review-probe.json';
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, checks: report.checks, stable: sourceStableDuringProbe, failures: report.blockingFindings.map(result => ({ name: result.name, error: result.error })) }));
if (report.blockingFindings.length || !sourceStableDuringProbe) process.exitCode = 1;
