// Independent read-only model review; no target DLL, browser, build or product mutation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pin = path => ({ path, sha256: sha(path) });
const files = ['src/model/vector-commit.ts', 'src/model/vector-authoring.ts', 'src/model/vector-editing.ts', 'src/model/adaptive.ts', 'src/model/adaptive-view-sets.ts', 'src/model/document.ts', 'src/model/types.ts', 'src/App.tsx', 'src/components/CanvasVectorTools.tsx', 'src/components/Inspector.tsx'];
const sourceHashes = files.map(pin), results = [], blockingFindings = [];
const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const rectangle = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 1, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' }] };
const near = (actual, expected, label) => { assert(Number.isFinite(actual)); assert(Math.abs(actual - expected) <= 1e-10, `${label}: ${actual} != ${expected}`); };
function nearPath(actual, expected, label) {
  assert.equal(actual.fillRule, expected.fillRule); assert.equal(actual.commands.length, expected.commands.length);
  for (let i = 0; i < expected.commands.length; i++) for (const [key, value] of Object.entries(expected.commands[i])) {
    if (typeof value === 'number') near(actual.commands[i][key], value, `${label}/${i}/${key}`); else assert.equal(actual.commands[i][key], value);
  }
}
async function check(name, work) {
  try { const detail = await work(); results.push({ name, passed: true, ...detail }); }
  catch (error) { const finding = { name, message: error.message }; results.push({ ...finding, passed: false }); blockingFindings.push(finding); }
}
try {
  const model = await server.ssrLoadModule('/src/model/document.ts');
  const adaptive = await server.ssrLoadModule('/src/model/adaptive.ts');
  const sets = await server.ssrLoadModule('/src/model/adaptive-view-sets.ts');
  const author = await server.ssrLoadModule('/src/model/vector-authoring.ts');
  const { commitVectorGeometry } = await server.ssrLoadModule('/src/model/vector-commit.ts');

  for (const shared of [false, true]) for (const nesting of ['page', 'panel', 'repeater']) for (const viewId of [null, 'tablet', 'phone']) for (const operation of ['location', 'size', 'both', 'interior']) {
    await check(`current-slot ${shared ? 'set' : 'local'} ${nesting} ${viewId ?? 'Base'} ${operation}`, () => {
      let doc = model.createDocument(), page = doc.pages[0], target = model.createWidget('box');
      Object.assign(target, { id: 'target', x: 100, y: 80, width: 200, height: 100, rotation: 0, text: 'shared caption', vectorPath: structuredClone(rectangle), shapeText: { autoFitWidth: true, autoFitHeight: true } });
      target.style = { ...target.style, radius: 0, cornerVisibility: [true, true, true, true], textPadding: [1, 2, 3, 4] };
      target.selectedStyle = { color: '#123456', radius: 9 }; target.mouseOverStyle = { fontStyle: 'italic' };
      const sibling = { ...model.createWidget('box'), id: 'sibling' };
      if (nesting === 'page') page.widgets = [target, sibling];
      else { const parent = model.createWidget(nesting); parent.id = 'container'; if (nesting === 'panel') parent.states[0].widgets = [target, sibling]; else parent.repeater.template = [target, sibling]; page.widgets = [parent]; }
      const definitions = [
        { id: 'tablet', name: 'Tablet', width: 768, height: 0, overrides: { target: { x: 120, width: 240, height: 120, style: { fill: '#222222' }, stateStyles: { selected: {} } } } },
        { id: 'phone', name: 'Phone', width: 390, height: 0, baseViewId: 'tablet', overrides: { target: { y: 160, hidden: false, stateStyles: {} } } },
      ];
      page.adaptiveViews = definitions;
      page.adaptiveOverrides = { inactive: { target: { x: 313, width: 99, style: { radius: 3 }, stateStyles: {} } } };
      const other = model.createPage('Other'); other.widgets = [{ ...model.createWidget('box'), id: 'other-widget' }]; doc.pages.push(other);
      if (shared) {
        doc.adaptiveViewSets = [{ id: 'shared-set', name: 'Shared', baseSize: { width: 1200, height: 0 }, views: definitions.map(({ overrides, ...def }) => def) }];
        page.adaptiveViewSetId = 'shared-set'; for (const view of definitions) page.adaptiveOverrides[view.id] = view.overrides;
        page.adaptiveViews = []; delete page.adaptiveSelection; delete page.adaptiveBaseSize;
      }
      doc = model.parseDocument(model.serializeDocument(doc));
      const before = structuredClone(doc), effective = sets.resolveAdaptivePage(doc, doc.pages[0]);
      const shown = model.findWidget({ widgets: adaptive.resolveAdaptiveWidgets(effective, viewId) }, 'target');
      const prepared = author.resolveVectorEditPath(shown);
      assert.equal(adaptive.applyAdaptivePointEdit(effective, viewId, 'target', structuredClone(prepared)), effective, 'no-op preserves page reference');
      let edited = structuredClone(rectangle), expectedBounds = { x: shown.x, y: shown.y, width: shown.width, height: shown.height };
      if (operation === 'location') { edited.commands = edited.commands.map(c => c.op === 'Z' ? c : { ...c, x: c.x + .25, y: c.y + .5 }); expectedBounds.x += shown.width / 4; expectedBounds.y += shown.height / 2; }
      if (operation === 'size') { edited.commands = edited.commands.map(c => c.op !== 'Z' && c.x === 1 ? { ...c, x: 1.25 } : c); expectedBounds.width *= 1.25; }
      if (operation === 'both') { edited.commands = edited.commands.map(c => c.op !== 'Z' && c.x === 0 ? { ...c, x: -.25 } : c); expectedBounds.x -= shown.width / 4; expectedBounds.width *= 1.25; }
      if (operation === 'interior') edited.commands.splice(1, 0, { op: 'L', x: .5, y: 0 });
      const expectedPath = operation === 'interior' ? edited : rectangle;
      const result = sets.commitAdaptivePage(doc, adaptive.applyAdaptivePointEdit(effective, viewId, 'target', edited));
      assert.deepEqual(doc, before, 'source document is immutable');
      const expected = structuredClone(before), expectedTarget = model.findWidget(expected.pages[0], 'target'); expectedTarget.type = 'path'; expectedTarget.vectorPath = structuredClone(expectedPath);
      const patch = {};
      if (['location', 'both'].includes(operation)) { patch.x = expectedBounds.x; patch.y = expectedBounds.y; }
      if (['size', 'both'].includes(operation)) { patch.width = expectedBounds.width; patch.height = expectedBounds.height; }
      if (!viewId) Object.assign(expectedTarget, patch);
      else if (Object.keys(patch).length) Object.assign(shared ? expected.pages[0].adaptiveOverrides[viewId].target : expected.pages[0].adaptiveViews.find(v => v.id === viewId).overrides.target, patch);
      const actualTarget = model.findWidget(result.pages[0], 'target'); nearPath(actualTarget.vectorPath, expectedPath, 'normalization');
      // Floating-point comparison is restricted to the normalized path; all other document bytes remain exact.
      const exactResult = structuredClone(result); model.findWidget(exactResult.pages[0], 'target').vectorPath = structuredClone(expectedPath);
      assert.deepEqual(exactResult, expected); assert.deepEqual(model.parseDocument(model.serializeDocument(result)), result);
      assert.deepEqual(actualTarget.shapeText, before.pages[0] && model.findWidget(before.pages[0], 'target').shapeText);
      return { pairedWrites: true, noEqualMaterialization: true, inactivePreserved: true, fitPreserved: true, saveRoundTrip: true };
    });
  }

  const evidence = JSON.parse(fs.readFileSync('research/native-point-commit-evidence-probes.json', 'utf8'));
  await check('frozen native geometry replay record is complete', () => {
    assert.equal(evidence.caseCount, 98); assert.equal(evidence.results.length, 98); assert.equal(evidence.methodsReplayed.length, 21);
    assert.equal(sha(evidence.probe.path), evidence.probe.sha256);
    assert.equal(sha('research/native-point-commit-evidence-probes.json'), 'a0b9bba9c73cde89e75b281671d2032650cad4a57c8f1a268c0c03c61b6d09ab');
    return { nativeCases: 98, methods: 21, probeSourcePinned: true };
  });
  for (const entry of evidence.sources) await check(`geometry evidence hash ${entry.path}`, () => { assert.equal(sha(entry.path), entry.sha256); return { source: entry.path }; });
  await check('native cubic extrema browser fixture', () => {
    const expected = evidence.results.find(r => r.name === 'parent browser fixture M0,0 C0,-1 1,0 1,1 at 100,100 200x100').observed;
    const widget = { ...model.createWidget('path'), x: 100, y: 100, width: 200, height: 100, rotation: 0 };
    const path = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'C', x1: 0, y1: -1, x2: 1, y2: 0, x: 1, y: 1 }] };
    const actual = commitVectorGeometry(widget, path); assert.deepEqual(actual.bounds, expected.owner);
    const [p, a, b, c] = expected.normalized;
    nearPath(actual.vectorPath, { fillRule: 'nonzero', commands: [{ op: 'M', ...p }, { op: 'C', x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...c }] }, 'native cubic'); return { nativeReplayMatched: true };
  });
  await check('native 90-degree owner and world path', () => {
    const expected = evidence.results.find(r => r.name === 'parent 90-degree polygon first-anchor x=-.25').observed;
    const widget = { ...model.createWidget('path'), x: 100, y: 100, width: 200, height: 100, rotation: 90 };
    const path = structuredClone(rectangle); path.commands[0].x = -.25;
    const actual = commitVectorGeometry(widget, path);
    // Original CIL replay and JS trig round-trips differ at 1e-14; keep the
    // independently recorded numbers and compare each coordinate, not strings.
    for (const key of ['x', 'y', 'width', 'height']) near(actual.bounds[key], expected.owner[key], `rotated owner ${key}`);
    nearPath(actual.vectorPath, { fillRule: 'nonzero', commands: [...expected.normalizedPoints.map((p, i) => ({ op: i ? 'L' : 'M', ...p })), { op: 'Z' }] }, 'native 90deg'); return { nativeReplayMatched: true };
  });
  await check('native TN46 tiny-axis uses expanded owner for normalization', () => {
    const expected = evidence.results.find(r => r.name === 'TN46 false versus RN4I true tiny-axis normalization false').observed;
    const widget = { ...model.createWidget('path'), x: 100, y: 80, width: 100, height: 60, rotation: 0 }; widget.style.strokeWidth = 4;
    const point = { x: .2525, y: 16.75 / 60 }, path = { fillRule: 'nonzero', commands: [{ op: 'M', ...point }, { op: 'C', x1: point.x, y1: point.y, x2: point.x, y2: point.y, ...point }] };
    const actual = commitVectorGeometry(widget, path); assert.deepEqual(actual.bounds, expected.owner);
    near(actual.vectorPath.commands[0].x, .5625, 'expanded x'); near(actual.vectorPath.commands[0].y, .6875, 'expanded y'); return { nativeFalseBranchMatched: true };
  });
  await check('rotation roundoff does not materialize unchanged named size', () => {
    const page = model.createPage(), target = { ...model.createWidget('path'), id: 'target', x: 100, y: 100, width: 240, height: 60, rotation: 17, vectorPath: structuredClone(rectangle) };
    page.widgets = [target]; page.adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, height: 0, overrides: { target: { style: { color: '#112233' } } } }];
    const edited = structuredClone(rectangle); edited.commands.splice(1, 0, { op: 'L', x: .5, y: 0 });
    const next = adaptive.applyAdaptivePointEdit(page, 'phone', 'target', edited); assert.deepEqual(next.adaptiveViews, page.adaptiveViews); return { noFloatingPointLayoutPatch: true };
  });
  await check('native tiny derivative collapsed-root minimum-owner origin', () => {
    const expected = evidence.results.find(r => r.name === 'tiny derivative collapsed-root changes minimum-owner origin').observed;
    const c = (.4 - 1 / 3) * 1e-6, y1 = c / 3, y2 = -.4e-6 / 3 + 2 * c / 3;
    const widget = { ...model.createWidget('path'), x: 0, y: 0, width: 1, height: 1, rotation: 0 }; widget.style.strokeWidth = 2;
    const path = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: 0 }, { op: 'C', x1: 0, y1, x2: 1, y2, x: 1, y: 0 }] };
    const actual = commitVectorGeometry(widget, path); assert.deepEqual(actual.bounds, { x: -1, y: -2, width: 2, height: 2 });
    assert.deepEqual(actual.bounds, expected.owner);
    const [p, a, b, d] = expected.normalized;
    nearPath(actual.vectorPath, { fillRule: 'nonzero', commands: [{ op: 'M', ...p }, { op: 'C', x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...d }] }, 'native tiny solver');
    return { correctedNativeSolverBranchMatched: true };
  });
  const customFile = 'research/native-point-editing-format-custom-rectangles.rea.json';
  const custom = model.parseDocument(fs.readFileSync(customFile, 'utf8'));
  for (const page of custom.pages) for (const widget of page.widgets) await check(`real Shape300 retained custom identity ${widget.id}`, () => {
    assert.equal(widget.type, 'path'); assert.equal(author.resolveVectorEditPath(widget), widget.vectorPath);
    const before = structuredClone(page), edited = structuredClone(widget.vectorPath); edited.fillRule = edited.fillRule === 'nonzero' ? 'evenodd' : 'nonzero';
    const next = adaptive.applyAdaptivePointEdit(page, null, widget.id, edited), expected = structuredClone(page); model.findWidget(expected, widget.id).vectorPath = edited;
    assert.deepEqual(next, expected); assert.deepEqual(page, before); return { typePathPreserved: true, fillRuleDoesNotRebound: true };
  });
  const sourceStableDuringProbe = JSON.stringify(files.map(pin)) === JSON.stringify(sourceHashes);
  if (!sourceStableDuringProbe) blockingFindings.push({ name: 'Source stability', message: 'Reviewed source changed while probe ran; rerun required.' });
  const report = { capturedAt: new Date().toISOString(), originalComparison: false, originalAxureGuiCompared: false,
    method: 'Read-only Vite ssrLoadModule + independent expected full documents + retained CIL numeric cases; no browser/history dispatcher',
    results, blockingFindings, sourceStableDuringProbe, sourceHashes,
    evidenceHashes: ['research/native-point-commit-format-evidence.json', 'research/native-point-commit-format-probes.json', 'research/native-point-commit-evidence-probes.json', customFile, 'research/native-point-commit-final-review-probe.mjs'].map(pin),
    checks: { total: results.length, passed: results.filter(r => r.passed).length },
    limits: ['Original GUI and native DLL not executed.', 'Pointer/keyboard/history browser workflows are parent-owned validation.', 'Pure geometry extrema assertions do not verify native font or connection behavior.'] };
  fs.writeFileSync('research/native-point-commit-final-review-probe.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report.checks, blockingFindings, sourceStableDuringProbe }));
  if (blockingFindings.length) process.exitCode = 1;
} finally { await server.close(); }
