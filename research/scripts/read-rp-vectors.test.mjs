import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { property as get, recoverVectorPath } from './read-rp-semantics.mjs';
import { fileURLToPath } from 'node:url';

const source = inspectRpObjects(fileURLToPath(new URL('../samples/Default.rplib', import.meta.url)));
const ellipse = source.packages.find(p => p.packageId === 'b03be8f331a44681af88fcd04b65d4f5').objects.find(o => o.id === 'c3a933c53d05434c95ec7908c6240a69');
const nativeEllipse = get(ellipse.properties, 'ControlPoints');
const map = entries => ({ $map: Object.entries(entries) });
const absent = { $number: 'NaN', numberTag: 6 };
const point = (x, y) => map({ X: x, Y: y });
const vertex = (x, y, segment = true, lower = point(absent, absent), higher = point(absent, absent)) => map({ Path: point(x, y), LowerHandle: lower, HigherHandle: higher, HigherSegmentExists: segment });
const set = (value, key, replacement) => { value.$map.find(pair => pair[0] === key)[1] = replacement; };

test('real RP ellipse preserves all four native cubic segments, including the closing curve', () => {
  const before = JSON.stringify(nativeEllipse), result = recoverVectorPath(nativeEllipse);
  assert.deepEqual(result.commands, [
    { op: 'M', x: .5, y: 0 },
    { op: 'C', x1: .78, y1: 0, x2: 1, y2: .21999999999999997, x: 1, y: .5 },
    { op: 'C', x1: 1, y1: .78, x2: .78, y2: 1, x: .5, y: 1 },
    { op: 'C', x1: .21999999999999997, y1: 1, x2: 0, y2: .78, x: 0, y: .5 },
    { op: 'C', x1: 0, y1: .21999999999999997, x2: .21999999999999997, y2: 0, x: .5, y: 0 },
    { op: 'Z' },
  ]);
  assert.equal(JSON.stringify(nativeEllipse), before);
});

test('a false final HigherSegmentExists leaves an open line with no synthetic closing edge', () => {
  const result = recoverVectorPath([[vertex(0, .5), vertex(1, .5, false)]]);
  assert.deepEqual(result.commands, [{ op: 'M', x: 0, y: .5 }, { op: 'L', x: 1, y: .5 }]);
});

test('native one-sided curves substitute the missing handle with its anchor', () => {
  const first = [vertex(0, 0, true, undefined, point(.25, -.2)), vertex(1, 1, false)];
  assert.deepEqual(recoverVectorPath([first]).commands[1], { op: 'C', x1: .25, y1: -.2, x2: 1, y2: 1, x: 1, y: 1 });
  const second = [vertex(0, 0), vertex(1, 1, false, point(1.2, .7))];
  assert.deepEqual(recoverVectorPath([second]).commands[1], { op: 'C', x1: 0, y1: 0, x2: 1.2, y2: .7, x: 1, y: 1 });
});

test('partial-axis NaN and infinity are outside the common native builder domain', () => {
  const path = [[vertex(0, 0, true, undefined, point(absent, .25)), vertex(1, 1, false)]];
  assert.equal(recoverVectorPath(path), null);
  set(get(path[0][0], 'HigherHandle'), 'X', Infinity);
  assert.equal(recoverVectorPath(path), null);
});

test('multiple contours and their orientation are retained independently', () => {
  const paths = [[vertex(0, 0), vertex(1, 0), vertex(1, 1), vertex(0, 1)], [vertex(.2, .2), vertex(.2, .8), vertex(.8, .8), vertex(.8, .2)]];
  const commands = recoverVectorPath(paths).commands;
  assert.equal(commands.filter(c => c.op === 'M').length, 2);
  assert.equal(commands.filter(c => c.op === 'Z').length, 2);
  assert.deepEqual(commands.slice(6, 9), [{ op: 'M', x: .2, y: .2 }, { op: 'L', x: .2, y: .8 }, { op: 'L', x: .8, y: .8 }]);
});

test('unverified interior gaps are not silently joined or filled', () => {
  assert.equal(recoverVectorPath([[vertex(0, 0), vertex(1, 0, false), vertex(1, 1), vertex(0, 1)]]), null);
});

test('unknown fields, duplicate keys, malformed numbers and missing flags reject the entire vector', () => {
  for (const mutate of [
    p => p[0][0].$map.push(['Unknown', true]),
    p => p[0][0].$map.push(['Path', point(0, 0)]),
    p => set(p[0][0], 'HigherSegmentExists', 1),
    p => set(get(p[0][0], 'Path'), 'X', '0.5'),
    p => set(get(p[0][0], 'Path'), 'X', absent),
    p => set(get(p[0][0], 'LowerHandle'), 'Y', { $number: 'NaN', numberTag: 5 }),
    p => get(p[0][0], 'Path').$map.push(['Unknown', 1]),
  ]) {
    const path = structuredClone(nativeEllipse); mutate(path); assert.equal(recoverVectorPath(path), null);
  }
});

test('budgets reject oversized vectors without clamping valid outside-bounds controls', () => {
  assert.equal(recoverVectorPath(Array(257).fill(nativeEllipse[0])), null);
  assert.equal(recoverVectorPath([Array(3501).fill(nativeEllipse[0][0])]), null);
  assert.equal(recoverVectorPath([[]]), null);
  const valid = [[vertex(-2, 0, true, undefined, point(-4, 2)), vertex(3, 1, false)]];
  assert.equal(recoverVectorPath(valid).commands[1].x1, -4);
  set(get(valid[0][0], 'Path'), 'X', 10001);
  assert.equal(recoverVectorPath(valid), null);
});
