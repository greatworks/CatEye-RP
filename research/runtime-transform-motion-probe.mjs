import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Execute exact retained JavaScript slices. Geometry/queue consumers are
// recording sinks, not a browser, a generated page, or vendor GUI execution.
const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const expected = {
  'action.js': 'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
  'move.js': 'c823954b5ed5862d56176b8984837e8f26588540ee4768d4483d68a399b95644',
  'axQuery.std.js': '0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd',
  'events.js': 'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
  'utils.temp.js': 'ef33a9174ea5b4cdcd48229f896195d2f67941116aa7eeae6308a99e02b4832f',
};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const sources = Object.entries(expected).map(([name, hash]) => {
  const file = path.join(root, name), bytes = fs.readFileSync(file);
  assert.equal(sha(bytes), hash, `Pinned source changed: ${name}`);
  return { path: file.replaceAll('\\', '/'), sha256: hash, bytes: bytes.length };
});
const source = Object.fromEntries(Object.keys(expected).map(name => [name, fs.readFileSync(path.join(root, name), 'utf8').split(/\r?\n/)]));
const slices = [];
const slice = (file, from, through) => {
  const text = source[file].slice(from - 1, through).join('\n');
  if (!slices.some(item => item.file === file && item.from === from && item.through === through)) slices.push({ file, from, through, sha256: sha(text) });
  return text;
};
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
function test(name, family, fn) {
  try { results.push({ name, family, passed: true, observed: fn() }); }
  catch (error) { results.push({ name, family, passed: false, error: String(error.stack || error) }); }
}
function context(base, code) {
  const realm = vm.createContext(base);
  vm.runInContext(code, realm, { timeout: 1500 });
  return realm;
}
function batching() {
  const log = [];
  const record = kind => (id, event, info, options, move, rotate) => log.push(clone({ kind, id, eventTag: event.tag, info, options, move, rotate }));
  const $ax = { action: {}, splice: (array, start, count) => array.splice(start, count), public: { fn: { convertToSingleImage() {} } } };
  const realm = context({ $ax, $jobj: id => ({ id }), _addMove: record('move'), _addRotate: record('rotate'), _addResize: record('resize') },
    `var _action=$ax.action;${slice('action.js', 5, 12)}\n${slice('action.js', 143, 349)}\nglobalThis.api={queue:_queueResizeMove,flush:_action.flushAllResizeMoveActions};`);
  return { realm, log, queue: (kind, info, event, id = 'a') => realm.api.queue(id, { move: 1, resize: 4, rotate: 5 }[kind], event, info), flush: event => realm.api.flush(event) };
}
const info = (kind, duration, easing = kind === 'move' ? 'linear' : kind === 'resize' ? 'easeInQuad' : 'easeOutBounce') => kind === 'resize' ? { label: kind, width: 300, height: 160, duration, easing, anchor: 'top left' } : { label: kind, options: { duration, easing }, ...(kind === 'move' ? { moveType: 'delta', xValue: 100, yValue: 20 } : { degree: 90, rotateType: 'delta', offsetX: 0, offsetY: 0, anchor: 'center' }) };
const permutations = values => values.length ? values.flatMap((v, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [v, ...rest])) : [[]];

for (const order of permutations(['move', 'resize', 'rotate'])) test(`triple order ${order.join('/')}`, 'exact batch planner', () => {
  const h = batching(), event = { tag: 'same-event' };
  const durations = { move: 40, resize: 70, rotate: 100 };
  for (const kind of order) h.queue(kind, info(kind, durations[kind]), event);
  const beforeFlush = clone(h.log);
  h.flush(event);
  assert.deepEqual(h.log.map(x => [x.kind, x.options.duration, x.options.easing]), [['resize', 40, 'linear'], ['resize', 30, 'easeInQuad'], ['rotate', 30, 'easeOutBounce']]);
  assert.equal(beforeFlush.length, 1);
  return { beforeFlush, afterFlush: h.log };
});
for (const kinds of [['move', 'resize'], ['move', 'rotate'], ['resize', 'rotate']]) test(`pair ${kinds.join('/')}`, 'exact batch planner', () => {
  const h = batching(), event = {};
  h.queue(kinds[0], info(kinds[0], 40), event); h.queue(kinds[1], info(kinds[1], 100), event);
  assert.equal(h.log.length, 0); h.flush(event);
  assert.deepEqual(h.log.map(x => x.options.duration), [40, 60]);
  const leader = kinds.includes('resize') ? 'resize' : 'rotate';
  assert.equal(h.log[0].kind, leader);
  assert.equal(h.log[0].options.easing, kinds.includes('move') ? 'linear' : 'easeInQuad');
  return h.log;
});
test('two move requests split across resize and rotate', 'exact batch planner', () => {
  const h = batching(), e = {};
  for (const [kind, duration] of [['move', 40], ['move', 40], ['resize', 70], ['rotate', 100]]) h.queue(kind, info(kind, duration), e);
  h.flush(e);
  assert.deepEqual(h.log.map(x => [x.kind, x.options.duration]), [['resize', 40], ['resize', 30], ['rotate', 10], ['rotate', 20]]);
  return h.log;
});
test('instant operation is dispatched before unrelated animated batch', 'exact batch planner', () => {
  const h = batching(), e = {};
  h.queue('rotate', info('rotate', 100), e); h.queue('resize', info('resize', 500, 'none'), e);
  assert.equal(h.log[0].kind, 'resize'); assert.equal(h.log[0].options.duration, 0);
  h.flush(e); assert.equal(h.log[1].kind, 'rotate');
  return h.log;
});
test('separate event batches do not combine same target', 'exact batch planner', () => {
  const h = batching(), a = { tag: 'a' }, b = { tag: 'b' };
  h.queue('move', info('move', 40), a); h.queue('rotate', info('rotate', 100), b);
  h.flush(a); h.flush(b);
  assert.deepEqual(h.log.map(x => [x.kind, x.options.duration]), [['move', 40], ['rotate', 100]]);
  return h.log;
});
test('concrete IDs have separate batches', 'exact batch planner', () => {
  const h = batching(), e = {};
  h.queue('move', info('move', 40), e, 'row-1'); h.queue('rotate', info('rotate', 100), e, 'row-2');
  h.flush(e); assert.deepEqual(h.log.map(x => [x.id, x.kind]), [['row-1', 'move'], ['row-2', 'rotate']]);
  return h.log;
});

function geometry(options = {}) {
  const state = { x: 100, y: 100, width: 200, height: 100, angle: 0, type: 'vectorShape', position: 'absolute', ...options };
  const calls = [], values = { degree: 90 }, events = [];
  const read = expr => typeof expr === 'string' && expr.startsWith('$') ? values[expr.slice(1)] : expr;
  const query = {
    size: () => ({ width: state.width, height: state.height }),
    offsetLocation: () => ({ left: state.x, top: state.y }),
    offsetBoundingRect: () => {
      const rad = state.angle * Math.PI / 180;
      const width = Math.abs(state.width * Math.cos(rad)) + Math.abs(state.height * Math.sin(rad));
      const height = Math.abs(state.height * Math.cos(rad)) + Math.abs(state.width * Math.sin(rad));
      return { width, height, left: state.x, top: state.y, centerPoint: { x: state.x + state.width / 2, y: state.y + state.height / 2 } };
    },
    rotate: (...args) => calls.push({ kind: 'rotate', args: clone(args) }),
    circularMoveAndRotate: (...args) => calls.push({ kind: 'circular', args: clone(args) }),
    resize: (css, resizeInfo, ...rest) => calls.push({ kind: 'resize', css: clone(css), info: clone(resizeInfo), flags: rest.slice(0, 2) }),
  };
  const jq = { css: key => key === 'position' ? state.position : `${({ left: state.x, top: state.y, width: state.width, height: state.height })[key]}px`, children: () => ({ attr: () => 'a-input' }) };
  const $ = () => ({ scrollLeft: () => 0, scrollTop: () => 0, css() {} }); $.inArray = (item, array) => array.indexOf(item);
  const $ax = Object.assign(() => query, {
    action: { queueTypes: { move: 1, resize: 4, rotate: 5 }, fireAnimationFromQueue: (id, type) => calls.push({ kind: 'release', id, type }) },
    public: { fn: { IsDynamicPanel: type => type === 'dynamicPanel', IsLayer: type => type === 'layer', IsTextArea: type => type === 'textArea' } },
    constants: { IMAGE_BOX_TYPE: 'imageBox', IMAGE_MAP_REGION_TYPE: 'imageMapRegion', DYNAMIC_PANEL_TYPE: 'dynamicPanel', VECTOR_SHAPE_TYPE: 'vectorShape', VERTICAL_LINE_TYPE: 'verticalLine', HORIZONTAL_LINE_TYPE: 'horizontalLine' },
    deepCopy: clone, eventCopy: e => ({ ...e }), getNumFromPx: parseFloat,
    expr: { evaluateExpr: (expr, event) => { calls.push({ kind: 'evaluate', expr, target: event.targetElement }); return read(expr); } },
    event: { raiseSyntheticEvent: (id, name) => { events.push(name); calls.push({ kind: 'event', id, name }); if (name === 'onRotate' && options.onRotateDegree !== undefined) values.degree = options.onRotateDegree; } },
    dynamicPanelManager: { isPercentWidthPanel: () => false },
    move: { getRootLayer: () => null, getRotationDegree: () => state.angle },
  });
  const $axure = { fn: { getPointAfterRotate: (degree, point, origin) => {
    const rad = degree * Math.PI / 180, x = point.x - origin.x, y = point.y - origin.y;
    point.x = origin.x + x * Math.cos(rad) - y * Math.sin(rad); point.y = origin.y + x * Math.sin(rad) + y * Math.cos(rad); return point;
  } } };
  const realm = context({ $ax, $axure, $, $jobj: () => jq, $obj: () => state, window: {}, SAFARI: false, IOS: false, SHARE_APP: false,
    _actionHandlers: {}, queueTypes: { move: 1, resize: 4, rotate: 5 },
    _addAnimations: animations => { calls.push({ kind: 'reservations', entries: animations.map(x => ({ id: x.id, type: x.type })) }); for (const animation of animations) animation.func(); },
    _fireAnimationFromQueue: (id, type) => calls.push({ kind: 'release', id, type }),
    _moveSingleWidget: (id, delta, options) => calls.push({ kind: 'moveSingle', id, delta: clone(delta), options: clone(options) }),
  }, [slice('action.js', 143, 146), slice('action.js', 866, 1042), slice('action.js', 1061, 1065), slice('action.js', 1082, 1256), slice('action.js', 1286, 1506), slice('action.js', 1528, 1551), slice('action.js', 1571, 1651), 'globalThis.api={resize:_addResize,rotate:_addRotate,size:_getSizeFromInfo,move:_getMoveLoc};'].join('\n'));
  const e = { targetElement: 'a', idToResizeMoveState: { a: {} } };
  return { state, calls, events, values, e, realm };
}
const stop = (start = 0, end = 100, len = 100) => ({ start, end, len });
function resized(config = {}) {
  const h = geometry(config);
  const requested = { width: 300, height: 160, anchor: 'top left', duration: 100, easing: 'linear', ...config.resize };
  const rotate = config.rotate ? { rotateType: 'delta', degree: 90, offsetX: 0, offsetY: 0, anchor: 'center', options: { clockwise: true }, ...config.rotate } : undefined;
  const move = config.move ? { moveType: 'delta', xValue: 40, yValue: 20, options: { duration: 100, easing: 'linear' }, ...config.move } : undefined;
  const options = { easing: 'linear', duration: 100, stop: stop(), rotateStop: stop(), moveStop: stop(), ...config.segment };
  h.realm.api.resize('a', h.e, requested, options, move, rotate);
  return h;
}
for (const [end, expectedWidth, expectedHeight] of [[100, 300, 160], [50, 225, 115], [40, 216, 109.6]]) test(`real changed size slice end ${end}`, 'exact ordinary resize dispatch and CSS', () => {
  const h = resized({ segment: { stop: stop(0, end, 100) } });
  const css = h.calls.find(x => x.kind === 'resize').css;
  assert.equal(css.width, expectedWidth); assert.ok(Math.abs(css.height - expectedHeight) < 1e-10);
  return { input: { old: [200, 100], requested: [300, 160], slice: stop(0, end, 100) }, css, calls: h.calls };
});
for (const clockwise of [true, false]) test(`changed-size rotate direction ${clockwise}`, 'exact ordinary resize dispatch and CSS', () => {
  const h = resized({ rotate: { options: { clockwise } } });
  assert.equal(h.calls.find(x => x.kind === 'resize').css.width, 300);
  assert.equal(h.calls.find(x => x.kind === 'rotate').args[0], 90);
  assert.equal(h.events[0], 'onRotate');
  return h.calls;
});
for (const anchor of ['top left', 'top', 'top right', 'left', 'center', 'right', 'bottom left', 'bottom', 'bottom right']) test(`resize anchor ${anchor}`, 'exact ordinary resize dispatch and CSS', () => {
  const h = resized({ resize: { anchor } });
  const css = h.calls.find(x => x.kind === 'resize').css;
  const expectedX = anchor.includes('left') ? 100 : anchor.includes('right') ? 0 : 50;
  const expectedY = anchor.includes('top') ? 100 : anchor.includes('bottom') ? 40 : 70;
  assert.equal(css.left, expectedX); assert.equal(css.top, expectedY);
  return { anchor, css };
});
test('resize+rotate anchors use current AABB unlike rotate-only unrotated CSS', 'exact ordinary resize dispatch and CSS', () => {
  const h = resized({ angle: 90, rotate: { anchor: 'top right' } });
  const c = h.calls.find(x => x.kind === 'circular');
  // AABB is100x200, so local(+50,-100) is rotated to(+100,+50).
  assert.ok(Math.abs(c.args[2] - 300) < 1e-10); assert.ok(Math.abs(c.args[3] - 200) < 1e-10);
  assert.deepEqual(c.args[6], { x: 50, y: -30 });
  return h.calls;
});
test('offcenter orbit receives resize-anchor shift and raw slice resizeOffset', 'exact ordinary resize dispatch and CSS', () => {
  const h = resized({ resize: { anchor: 'bottom right' }, rotate: { anchor: 'top right' }, move: {} });
  const c = h.calls.find(x => x.kind === 'circular');
  assert.deepEqual(c.args[5], { x: -60, y: -40, moveTo: false });
  assert.deepEqual(c.args[6], { x: 50, y: -30 });
  assert.deepEqual(h.events, ['onRotate', 'onMove']);
  const css = h.calls.find(x => x.kind === 'resize').css;
  assert.equal(css.left, undefined); assert.equal(css.top, undefined);
  assert.equal(css.deltaX, -160); assert.equal(css.deltaY, -100);
  return h.calls;
});
test('resize route evaluates degree after onRotate; rotate route before', 'exact evaluation ordering', () => {
  const h = resized({ onRotateDegree: 180, rotate: { degree: '$degree' } });
  assert.equal(h.calls.find(x => x.kind === 'rotate').args[0], 180);
  const r = geometry({ onRotateDegree: 180 });
  r.realm.api.rotate('a', r.e, { degree: '$degree', offsetX: 0, offsetY: 0, anchor: 'center', rotateType: 'delta', options: { clockwise: true } }, { easing: 'linear', duration: 100, stop: stop() });
  assert.equal(r.calls.find(x => x.kind === 'rotate').args[0], 90);
  return { resizeRoute: h.calls, rotateRoute: r.calls };
});
test('size coercion and cached result reuse', 'exact size evaluator', () => {
  const h = geometry();
  const first = clone(h.realm.api.size({ width: '', height: -20 }, h.e, 200, 100, 'a'));
  const second = clone(h.realm.api.size({ width: 333, height: 444 }, h.e, 210, 110, 'a'));
  assert.deepEqual(first, { width: 200, height: 0 }); assert.deepEqual(second, first);
  return { first, second, calls: h.calls };
});
test('size nonnumeric falls back to old dimensions; fractional is not rounded here', 'exact size evaluator', () => {
  const h = geometry();
  const value = clone(h.realm.api.size({ width: 'bad', height: 12.25 }, h.e, 200, 100, 'a'));
  assert.deepEqual(value, { width: 200, height: 12.25 });
  return { value, calls: h.calls };
});
test('Move expression is cached over its slices and clears at final slice', 'exact move evaluator', () => {
  const h = geometry(); const state = {}; const options = {};
  h.values.x = 100;
  const a = clone(h.realm.api.move('a', { moveType: 'delta', xValue: '$x', yValue: 20 }, h.e, stop(0, 40), state, options));
  h.values.x = 500;
  const b = clone(h.realm.api.move('a', { moveType: 'delta', xValue: '$x', yValue: 20 }, h.e, stop(40, 100), state, options));
  assert.equal(a.x, 40); assert.equal(b.x, 60); assert.equal(state.moveResult, undefined);
  return { first: a, second: b, calls: h.calls };
});

for (const key of ['idToResizeMoveState', 'dragInfo', 'ordinaryNested']) test(`actual eventCopy shares ${key}`, 'exact event copy identity', () => {
  const realm = context({ $ax: {} }, slice('utils.temp.js', 5, 49));
  const observed = vm.runInContext(`(() => {
    const original={${key}:{value:1}}, copied=$ax.eventCopy(original), deep=$ax.deepCopy(original);
    copied.${key}.value=2;
    return {outerDistinct:copied!==original,nestedSame:copied.${key}===original.${key},originalValue:original.${key}.value,unfilteredDeepDistinct:deep.${key}!==original.${key},deepValue:deep.${key}.value};
  })()`, realm, { timeout: 1000 });
  assert.deepEqual(clone(observed), { outerDistinct: true, nestedSame: true, originalValue: 2, unfilteredDeepDistinct: true, deepValue: 1 });
  return clone(observed);
});

const output = process.argv[2] || 'research/runtime-transform-motion-probes.json';
assert.ok(path.basename(output).startsWith('runtime-transform-motion-'), 'Only new scoped outputs are allowed');
assert.equal(fs.existsSync(output), false, `Refusing to overwrite ${output}`);
const report = { schema: 1, capturedAt: new Date().toISOString(), kind: 'exact retained JavaScript slices in NodeVM with recording sinks',
  sources, slices, script: { path: 'research/runtime-transform-motion-probe.mjs', sha256: sha(fs.readFileSync(import.meta.filename)) },
  substitutions: ['Batch consumers record calls; they do not execute real animation queues.', 'Geometry probe runs ordinary _addResize/_addRotate and exact helper functions; _addAnimations runs collected callbacks immediately.', 'CSS size, current angle, AABB, expression values, events and element identity are explicit numeric sinks.', 'resize/rotate/circularMoveAndRotate consumers record requested CSS/arguments, not real animated DOM results.', 'No vendor GUI, DLL invocation, browser, product test/build/package, or network request.'],
  totals: { total: results.length, passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length }, results };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, sha256: sha(fs.readFileSync(output)), totals: report.totals, failures: results.filter(x => !x.passed).map(x => ({ name: x.name, error: x.error })) }));
if (report.totals.failed) process.exitCode = 1;
