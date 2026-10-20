import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const prefix = 'research/layer-resize-numeric-integration-review-';
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const record = file => ({ path: file, sha256: hash(file) });
const sourceFiles = [
  'src/model/author-layer-resize.ts', 'src/model/author-resize-solver.ts',
  'src/model/layer-geometry.ts', 'src/model/resize-pins.ts',
  'research/layer-resize-controller-planner-oracle.mjs',
  'research/layer-resize-controller-probe.mjs',
  'research/layer-resize-numeric-replay.mjs',
  'research/layer-resize-controller-manifest.json',
  'research/layer-resize-numeric-manifest.json',
];
const sources = sourceFiles.map(record);
const plannerBytes = fs.readFileSync(sourceFiles[0]);
const snapshot = prefix + sources[0].sha256.slice(0, 12) + '.ts.txt';
if (!fs.existsSync(snapshot)) fs.writeFileSync(snapshot, plannerBytes);
const oraclePath = 'research/layer-resize-controller-planner-oracle.mjs';
const oracleSource = fs.readFileSync(oraclePath, 'utf8');
const boundary = oracleSource.indexOf('\nconst cases=[];');
assert(boundary > 0, 'Composed controller adapter boundary must remain explicit');
// Do not execute its case loop or overwrite its existing report.
const isolated = oracleSource.slice(0, boundary)
  .replace("'./layer-resize-numeric-replay.mjs'", JSON.stringify(pathToFileURL(path.resolve('research/layer-resize-numeric-replay.mjs')).href))
  + '\nexport {oracle,numeric};';
const { oracle, numeric } = await import('data:text/javascript;base64,' + Buffer.from(isolated).toString('base64'));
const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const results = [];
try {
  const { createWidget } = await server.ssrLoadModule('/src/model/document.ts');
  const { planAuthorLayerResize } = await server.ssrLoadModule('/src/model/author-layer-resize.ts');
  const namesH = { 0: 'none', 1: 'left', 4: 'right', 5: 'both', 256: 'center' };
  const namesV = { 0: 'none', 2: 'top', 8: 'bottom', 10: 'both', 512: 'center' };
  const box = (id, x, y, width, height, more = {}) => ({ id, rect: { x, y, width, height }, ...more });
  const group = (id, children, more = {}) => ({ id, children, ...more });
  const build = spec => {
    const w = { ...createWidget(spec.children ? 'layer' : 'box'), id: spec.id, ...(spec.rect ?? {}),
      rotation: spec.angle ?? 0, locked: !!spec.locked };
    w.style = { ...w.style, pinHorizontal: namesH[spec.h ?? 0], pinVertical: namesV[spec.v ?? 0],
      fixedWidth: !!spec.fixedWidth, fixedHeight: !!spec.fixedHeight };
    if (spec.children) w.layer = { widgets: spec.children.map(build), propagate: false };
    else w.shapeText = { autoFitWidth: !!spec.autoFitWidth, autoFitHeight: !!spec.autoFitHeight };
    return w;
  };
  const flatten = w => w.type === 'layer' ? w.layer.widgets.flatMap(flatten) : [w];
  const close = (a, b) => Object.is(a, b) || Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
  function run(name, input) {
    try {
      const expected = oracle(input, numeric), root = build(input.root), before = structuredClone(root);
      const backgroundIds = [];
      const scan = spec => { if (spec.background) backgroundIds.push(spec.id); spec.children?.forEach(scan); };
      scan(input.root);
      const actual = planAuthorLayerResize({
        layer: root, delta: input.delta, handle: input.handle, freedom: input.freedom,
        orientation: input.orientation, preserveAspect: input.preserveAspect,
        currentLayerId: input.currentLayerId, overrideLocked: input.overrideLocked, backgroundIds,
        modifiers: { control: !!((input.keys ?? 0) & 131072), alt: !!((input.keys ?? 0) & 262144), shift: !!((input.keys ?? 0) & 65536) },
      });
      assert.deepEqual(root, before, 'Input mutation');
      assert(actual.ok, actual.reason);
      const originals = new Map(flatten(before).map(w => [w.id, w]));
      const final = new Map(flatten(actual.layer).map(w => [w.id, w]));
      for (const expectedCommit of expected.commits) {
        const old = originals.get(expectedCommit.id), got = final.get(expectedCommit.id);
        for (const pair of [['x', 'y'], ['width', 'height']]) {
          // Final geometry setter pair equality is independently retained with strict 1e-5.
          const changed = pair.some(key => Math.abs(expectedCommit.rect[key] - old[key]) >= 1e-5);
          for (const key of pair) assert(close(got[key], changed ? expectedCommit.rect[key] : old[key]),
            `${expectedCommit.id}.${key}: ${got[key]} != ${changed ? expectedCommit.rect[key] : old[key]}`);
        }
      }
      for (const fit of expected.finalFit) {
        const got = final.get(fit.id); if (!got) continue;
        assert.equal(got.shapeText.autoFitWidth, fit.autoFitWidth, `${fit.id}.autoFitWidth`);
        assert.equal(got.shapeText.autoFitHeight, fit.autoFitHeight, `${fit.id}.autoFitHeight`);
      }
      results.push({ name, passed: true, input, expected, observed: { patches: actual.patches, trace: actual.trace } });
    } catch (error) {
      results.push({ name, passed: false, input, error: String(error.stack ?? error) });
    }
  }
  for (const delta of [0, 0.000009999, 0.00001, 0.000010001, -0.000009999, -0.00001, -0.000010001]) {
    for (const freedom of [1, 2, 3]) for (const keys of [0, 393216, 458752]) {
      run(`fit-and-pair-equality ${delta}/${freedom}/${keys}`, {
        root: group('root', [
          box('fixed', 20, 30, 50, 100, { fixedWidth: true, autoFitWidth: true, autoFitHeight: true }),
          box('free', 70, 30, 50, 100, { autoFitWidth: true, autoFitHeight: true }),
        ]), handle: 12, delta: { x: delta, y: delta }, freedom, keys,
      });
    }
  }
  for (const angle of [0, 0.999999, 1, 1.000001, 30, 90, -90, 360]) {
    for (const handle of [3, 12]) run(`nested-pin-origin ${angle}/${handle}`, {
      root: group('root', [
        group('nested', [
          box('a', -80, -30, 40, 30, { angle, h: 4, v: 8, autoFitWidth: true, autoFitHeight: true }),
          box('b', -20, 20, 40, 40, { fixedWidth: true, fixedHeight: true }),
        ], { h: 256, v: 512 }),
        box('outer', 80, -50, 40, 160),
      ]), handle, delta: { x: handle === 3 ? -60 : 60, y: handle === 3 ? -40 : 40 },
      preserveAspect: true,
    });
  }
  for (const currentLayerId of [undefined, 'root']) for (const overrideLocked of [false, true]) run(`background-and-lock ${currentLayerId}/${overrideLocked}`, {
    root: group('root', [
      box('bg', 10, 10, 80, 80, { background: true, autoFitWidth: true, autoFitHeight: true }),
      box('locked', 90, 10, 80, 80, { locked: true, autoFitWidth: true, autoFitHeight: true }),
    ]), handle: 12, delta: { x: 80, y: 40 }, currentLayerId, overrideLocked,
  });
} finally { await server.close(); }
const stable = sources.map(source => ({ ...source, unchanged: hash(source.path) === source.sha256 }));
const failed = results.filter(result => !result.passed);
const report = {
  schemaVersion: 1, kind: 'Read-only composed CIL oracle versus current product planner; controlled geometry/style/notification facade',
  originalDllExecuted: false, originalGuiCompared: false,
  sources: stable, plannerSnapshot: { originalPath: sources[0].path, path: snapshot, sha256: hash(snapshot) },
  summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
  boundaries: [
    'Reuses the controller adapter prefix only; no existing evidence file is regenerated.',
    'Numeric INw2/mNwa execute retained CIL records, not the product solver.',
    'Positive nonempty union, collections, style/provider/capability facts and final setter effects are declared facade boundaries.',
    'Post-setter equality uses the independently retained per-pair strict 1e-5 predicate.',
    'Vite middleware mode loads product modules without a listening browser server; no browser/artifact suite runs.',
  ],
  results,
};
fs.writeFileSync(prefix + 'probes.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report.summary, sourceStable: stable.every(source => source.unchanged), failures: failed.map(result => ({ name: result.name, error: result.error })) }));
if (failed.length) process.exitCode = 1;
