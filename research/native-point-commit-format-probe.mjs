// Static replay of retained CIL records. No target DLL or application is loaded.
// Geometry, document providers and notifications are explicitly named sinks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fields, readJson, sha256 } from './gradient-angle-static-flow.mjs';

const files = [
  'research/native-point-commit-format-geometry-setters-cil.json',
  'research/native-point-commit-format-view-write-cil.json',
  'research/native-point-commit-format-view-enumerator-cil.json',
  'research/native-point-commit-format-set-enumerator-cil.json',
  'research/native-point-commit-format-default-view-cil.json',
  'research/native-point-commit-format-ignore-check-cil.json',
  'research/adaptive-all-views-effects-rich-object-cil.json',
  'research/adaptive-all-views-effects-fit-height-cil.json',
  'research/native-point-editing-evidence-edit-cil.json',
  'research/native-point-commit-format-snapshot-cil.json',
  'research/native-point-commit-format-style-snapshot-cil.json',
  'research/native-point-editing-evidence-shape-cil.json',
  'research/adaptive-all-views-position-cil.json',
  'research/adaptive-all-views-size-cil.json',
  'research/adaptive-all-views-geometry-write-cil.json',
  'research/adaptive-all-views-owner-cil.json',
  'research/native-point-commit-format-size-comparison-cil.json',
];
const methods = new Map(files.flatMap(file => readJson(file).Types.flatMap(t => t.Methods.map(m => [m.Token, { ...m, file }]))));
const results = [], baseView = { kind: 'Default', id: 'native-base-sentinel' };
const unref = value => value?.ref ? value.ref[value.key] : value;
const compact = value => typeof value === 'object' ? value?.kind ?? '<object>' : value;
const h = (n, fn, ret = true) => ({ n, fn, ret });

function run(token, args, handlers = {}, trace = []) {
  const m = methods.get(token); assert(m, `Missing method ${token}`);
  const code = m.Instructions, at = new Map(code.map((i, n) => [i.Offset, n])), stack = [], locals = [];
  let pc = 0, count = 0;
  while (pc < code.length) {
    assert(++count < 30000, `Loop budget ${token}`);
    const i = code[pc++], o = i.Op;
    const branch = target => { assert(at.has(target)); pc = at.get(target); };
    if (['br', 'br.s', 'leave', 'leave.s'].includes(o)) { branch(i.Operand); continue; }
    if (/^ldarg\.[0-3]$/.test(o)) { stack.push(args[Number(o.slice(6))]); continue; }
    if (o === 'ldarg.s' || o === 'ldarg') { stack.push(args[i.Operand]); continue; }
    if (o === 'ldarga.s') { stack.push({ ref: args, key: i.Operand }); continue; }
    if (o === 'starg.s') { args[i.Operand] = stack.pop(); continue; }
    if (/^ldloc\.[0-3]$/.test(o)) { stack.push(locals[Number(o.slice(6))]); continue; }
    if (o === 'ldloc.s') { stack.push(locals[i.Operand]); continue; }
    if (o === 'ldloca.s') { stack.push({ ref: locals, key: i.Operand }); continue; }
    if (o.startsWith('stloc.')) { locals[o === 'stloc.s' ? i.Operand : Number(o.slice(6))] = stack.pop(); continue; }
    if (o.startsWith('ldc.i4')) { stack.push(o === 'ldc.i4' || o === 'ldc.i4.s' ? i.Operand : o === 'ldc.i4.m1' ? -1 : Number(o.slice(7))); continue; }
    if (o === 'ldc.r8') { stack.push(i.Operand); continue; }
    if (o === 'ldnull') { stack.push(null); continue; }
    if (o === 'ldsfld') {
      if (i.Resolved === 'jJv0.jJvm::jJvv') stack.push(baseView);
      else if (i.Resolved === 'System.EventArgs::Empty') stack.push({ kind: 'EventArgs.Empty' });
      else { assert(i.Resolved.startsWith('.<Module>')); stack.push({ module: true }); }
      continue;
    }
    if (o === 'ldfld') {
      const value = unref(stack.pop());
      if (value.module) { assert(fields.has(i.Operand)); stack.push(fields.get(i.Operand).value); }
      else stack.push(value[i.Resolved.split('::')[1]]);
      continue;
    }
    if (o === 'stfld') { const value = stack.pop(), target = unref(stack.pop()); target[i.Resolved.split('::')[1]] = value; trace.push({ method: token, il: i.Offset, write: i.Resolved, value: compact(value) }); continue; }
    if (o === 'brtrue' || o === 'brfalse') { if (!!stack.pop() === (o === 'brtrue')) branch(i.Operand); continue; }
    if (['beq', 'bne.un', 'bge', 'ble', 'bgt', 'blt'].includes(o)) {
      const b = stack.pop(), a = stack.pop();
      if (({ beq: a === b, 'bne.un': a !== b, bge: a >= b, ble: a <= b, bgt: a > b, blt: a < b })[o]) branch(i.Operand);
      continue;
    }
    if (o === 'switch') { const n = stack.pop(); if (n >= 0 && n < i.Operand.length) branch(i.Operand[n]); continue; }
    if (['add', 'sub', 'mul', 'div', 'ceq', 'cgt', 'clt', 'or', 'and'].includes(o)) {
      const b = stack.pop(), a = stack.pop(); stack.push(({ add: () => a + b, sub: () => a - b, mul: () => a * b, div: () => a / b, ceq: () => a === b, cgt: () => a > b, clt: () => a < b, or: () => a | b, and: () => a & b })[o]()); continue;
    }
    if (o === 'dup') { stack.push(stack.at(-1)); continue; }
    if (o === 'pop') { stack.pop(); continue; }
    if (o === 'isinst') { const value = stack.pop(); stack.push(value?.nativeTypes?.includes(i.Resolved) ? value : null); continue; }
    if (['box', 'nop', 'constrained.', 'castclass'].includes(o)) continue;
    if (o === 'call' || o === 'callvirt' || o === 'newobj') {
      const handler = handlers[i.Resolved] ?? handlers[i.Operand];
      assert(handler, `Unmodelled ${i.Resolved} at ${token}/${i.Offset.toString(16)}`);
      assert(stack.length >= handler.n);
      const values = stack.splice(stack.length - handler.n, handler.n);
      trace.push({ method: token, il: i.Offset, call: i.Resolved, args: values.map(compact) });
      const value = handler.fn(...values); if (handler.ret !== false) stack.push(value);
      continue;
    }
    if (o === 'ret') return { value: stack.pop(), trace };
    throw Error(`Unsupported ${o} at ${token}/${i.Offset.toString(16)}`);
  }
  throw Error('No return');
}
function check(name, fn) { results.push({ name, observed: fn() }); }
function enumerator(values) { return { kind: 'enumerator', values, index: -1 }; }
const enumHandlers = {
  'System.Collections.IEnumerator::MoveNext': h(1, e => ++unref(e).index < unref(e).values.length),
  'TypeSpecification:1B00019B::get_Current': h(1, e => unref(e).values[unref(e).index]),
  'TypeSpecification:1B00019A::GetEnumerator': h(1, enumerator),
};
function setViews(set, trace) {
  const state = { '<>4__this': set, '<>1__state': 0 }, output = [];
  const handlers = { ...enumHandlers,
    'PtPZ.itPU::ltPQ': h(1, s => s.base),
    'PtPZ.itPU::mt7r': h(1, s => s.names),
    '.<get_AdaptiveViewsWithDefault>d__23::<>m__Finally1': h(1, s => { s['<>1__state'] = -1; }, false),
  };
  while (run(100715581, [state], handlers, trace).value) { output.push(state['<>2__current']); assert(output.length <= set.names.length + 1); }
  return output;
}

for (const count of [0, 1, 3]) for (const assigned of [false, true]) check(`view enumeration assigned=${assigned} named=${count}`, () => {
  const names = Array.from({ length: count }, (_, i) => ({ kind: `view-${i}` }));
  const obj = { kind: 'owner', set: assigned ? { names, base: baseView } : null }, state = { obj, '<>1__state': 0 }, output = [], trace = [];
  const handlers = { ...enumHandlers,
    'jJv0.jJvm::AdaptiveViewSet': h(1, o => o.set),
    'RtnB.ztnG::op_Inequality': h(2, (a, b) => a !== b),
    'PtPZ.itPU::At7B': h(1, s => setViews(s, trace)),
    '.<AdaptiveViewsWithDefault>d__10::<>m__Finally1': h(1, s => { s['<>1__state'] = -1; }, false),
  };
  while (run(100697038, [state], handlers, trace).value) { output.push(state['<>2__current']); assert(output.length <= count + 1); }
  assert.deepEqual(output, [baseView, ...(assigned ? names : [])], JSON.stringify({ assigned, count, state, trace }));
  return { assigned, named: count, output: output.map(compact), trace };
});

function scopeCase({ local = [false, false, false], placed = 0, named = true, allViews = false, current = 'phone', vectorsZero = false, attached = true } = {}) {
  const owner = { kind: 'owner', allViews, current, views: named ? [baseView, { kind: 'tablet' }, { kind: 'phone' }] : [baseView] };
  const writes = [], reads = [], trace = [], derived = [], orphan = { kind: 'inactive-orphan', untouched: true };
  const providers = new Map(owner.views.map((view, index) => [view, { kind: `provider-${view.kind}`, view, local, placed, index }]));
  const handlers = { ...enumHandlers,
    'kJm2.KJm7::JJdW': h(1, () => attached ? { kind: 'diagram' } : null),
    'RtnB.ztnG::op_Inequality': h(2, (a, b) => a !== b),
    'm5wr.f5wV::W5wn': h(1, () => vectorsZero),
    'jJv0.jJvm::pJvY': h(1, o => o.views),
    'kJm2.KJm7::lJ0A': h(2, (_o, view) => { reads.push(view.kind); assert.equal(writes.length, 0, 'Read all providers before writes'); return providers.get(view); }),
    'TypeSpecification:1B000328::htoW': h(1, p => p.local),
    'TtuV.ituB::ctui': h(1, p => p[0]), 'TtuV.ituB::ytu7': h(1, p => p[1]), 'TtuV.ituB::mtsl': h(1, p => p[2]),
    'j5FU.O5FO::a5FY': h(1, p => p),
    'xtod.jtoq::w5GQ': h(1, p => p.placed), 'zJGn.mJG4::Ignore': h(1, p => run(100691414, [p]).value),
    'xtod.jtoq::p5Gp': h(1, p => ({ kind: 'location', x: 100 + p.index, y: 200 + p.index, provider: p })),
    'xtod.jtoq::T5Gd': h(1, p => ({ kind: 'size', width: 300 + p.index, height: 400 + p.index })),
    'xtod.jtoq::f5Vj': h(1, p => 15 * p.index),
    'h5uH.j5u5::.ctor': h(2, (location, size) => ({ kind: 'rect', location, size })),
    'h5uH.j5u5::h3bm': h(2, (rect, rotation) => ({ kind: 'rotated-rect', rect: unref(rect), rotation })),
    'w5s2.g5s7::G3bq': h(3, (r, a, b) => { derived.push({ view: r.rect.location.provider.view.kind, rotation: r.rotation, a, b }); return { kind: 'derived-geometry-sink', location: { x: r.rect.location.x + 7, y: r.rect.location.y + 11 }, size: { width: r.rect.size.width + 13, height: r.rect.size.height + 17 } }; }),
    'Axure.DocumentModel.Objects.VectorShape::lN47': h(5, () => {}, false),
    'h5uH.j5u5::get_Location': h(1, r => unref(r).location), 'h5uH.j5u5::get_Size': h(1, r => unref(r).size),
    'TypeSpecification:1B0007AE::.ctor': h(0, () => new Map()), 'TypeSpecification:1B000F36::.ctor': h(0, () => new Map()),
    'TypeSpecification:1B0007AE::set_Item': h(3, (m, k, v) => m.set(k, v), false),
    'TypeSpecification:1B000F36::set_Item': h(3, (m, k, v) => m.set(k, v), false),
    'TypeSpecification:1B0007AE::GetEnumerator': h(1, m => enumerator([...m])),
    'TypeSpecification:1B000F36::GetEnumerator': h(1, m => enumerator([...m])),
    'kJm2.KJm7::oJ0u': h(4, (_o, key, value, view) => { writes.push({ view: view.kind, key, value }); }, false),
    'kJm2.KJm7::EIuw': h(2, () => {}, false),
  };
  for (const token of ['1B000F35', '1B000F38']) {
    handlers[`TypeSpecification:${token}::MoveNext`] = enumHandlers['System.Collections.IEnumerator::MoveNext'];
    handlers[`TypeSpecification:${token}::get_Current`] = enumHandlers['TypeSpecification:1B00019B::get_Current'];
  }
  for (const token of ['1B000F34', '1B000F37']) {
    handlers[`TypeSpecification:${token}::get_Key`] = h(1, v => unref(v)[0]);
    handlers[`TypeSpecification:${token}::get_Value`] = h(1, v => unref(v)[1]);
  }
  run(100702696, [owner, { x: .1, y: .2 }, { x: .3, y: .4 }], handlers, trace);
  assert.deepEqual(orphan, { kind: 'inactive-orphan', untouched: true });
  return { localOD: local, placed, named, allViews, current, vectorsZero, attached, writes, reads, derived, notificationCount: trace.filter(i => i.call === 'kJm2.KJm7::EIuw').length, trace };
}

for (let mask = 0; mask < 8; mask++) for (const placed of [0, 1, 2]) check(`tN4P local OD bits=${mask} placed=${placed}`, () => {
  const local = [!!(mask & 1), !!(mask & 2), !!(mask & 4)];
  const observed = scopeCase({ local, placed });
  // Independent expected predicate is recorded after replay confirms the native branch ordering.
  assert.equal(observed.writes.length, placed !== 0 && local.some(Boolean) ? 6 : 0);
  if (observed.writes.length) assert.deepEqual(observed.writes.map(v => v.key), [101, 101, 101, 105, 105, 105]);
  return observed;
});
for (const allViews of [false, true]) for (const current of ['Base', 'tablet', 'phone']) check(`scope does not read UI mode ${allViews}/${current}`, () => {
  const observed = scopeCase({ local: [true, false, false], placed: 1, allViews, current });
  assert.equal(observed.writes.length, 6); return observed;
});
for (const input of [{ attached: false }, { vectorsZero: true }, { named: false }]) check(`tN4P entry ${JSON.stringify(input)}`, () => scopeCase({ local: [true, true, true], placed: 1, ...input }));

for (const key of [101, 105]) for (const view of [baseView, { kind: 'phone' }]) check(`explicit view writer ${key}/${view.kind}`, () => {
  const owner = { kind: 'owner' }, provider = { kind: 'provider' }, value = { kind: 'assigned-value' }, writes = [], trace = [];
  run(100695506, [owner, key, value, view], {
    'kJm2.KJm7::lJ0A': h(2, (o, v) => { assert.equal(o, owner); assert.equal(v, view); return provider; }),
    'TypeSpecification:1B000328::ltAo': h(3, (p, k, v) => { assert.equal(p, provider); writes.push([k, v.kind]); }, false),
    'kJm2.KJm7::DJ0E': h(3, (o, a, b) => { assert.equal(o, owner); assert.equal(a, 1); assert.equal(b, 1); }, false),
  }, trace);
  assert.deepEqual(writes, [[key, value.kind]]); return { key, view: view.kind, writes, trace };
});

for (const [token, field] of [[100702343, 'GNZZ'], [100702367, 'mNYN']]) for (const before of [0, 1]) check(`shared AutoFit setter ${field} ${before} to false`, () => {
  const owner = { kind: 'owner', [field]: before }, trace = [];
  run(token, [owner, 0], { 'Axure.DocumentModel.Objects.RichTextObject::OI8Z': h(2, (_o, flag) => assert.equal(flag, 1), false) }, trace);
  assert.equal(owner[field], 0); assert.equal(trace.filter(v => v.write).length, before); assert.equal(trace.filter(v => v.call).length, before);
  return { before, after: owner[field], trace };
});

for (const priorWidth of [0, 1]) for (const priorHeight of [0, 1]) check(`RN4I normal-path order fit ${priorWidth}/${priorHeight}`, () => {
  const owner = { kind: 'owner', GNZZ: priorWidth, mNYN: priorHeight, tN8N: 'old-a', cN8J: 'old-b' }, trace = [], order = [];
  const set = (ref, value) => { ref.ref[ref.key] = value; };
  const snapshot = { kind: 'snapshot' }, points = { kind: 'normalized-points' }, oldRect = { kind: 'old-rect' }, newRect = { kind: 'new-rect' };
  const callSetter = token => h(2, (o, value) => { order.push(token === 100702367 ? 'AutoFitHeight=false' : 'AutoFitWidth=false'); run(token, [o, value], { 'Axure.DocumentModel.Objects.RichTextObject::OI8Z': h(2, () => {}, false) }, trace); }, false);
  const result = run(100702640, [owner, { kind: 'edited-points' }], {
    'Axure.DocumentModel.Objects.VectorShapeEdit::.ctor': h(1, o => { order.push('snapshot'); snapshot.flags = [o.GNZZ, o.mNYN]; return snapshot; }),
    'kJm2.KJm7::get_SizingRect': h(1, () => oldRect),
    'Axure.DocumentModel.Objects.VectorShape::hN4K': h(4, (o, _p, flag, output) => { assert.equal(flag, 1); order.push('normalize-measure-sink'); o.tN8N = 'temporary'; o.cN8J = 'temporary'; set(output, points); return newRect; }),
    'GSWN.USWJ::ASWS': h(3, (edit, o, flag) => { assert.equal(edit, snapshot); assert.equal(o, owner); assert.equal(flag, 1); order.push('TrapConns'); return { kind: 'connection-scope' }; }),
    'Axure.DocumentModel.Objects.TextRectObject::set_AutoFitHeight': callSetter(100702367),
    'Axure.DocumentModel.Objects.RichTextObject::set_AutoFitWidth': callSetter(100702343),
    'Axure.DocumentModel.Objects.VectorShape::DN4W': h(2, (o, p) => { order.push('write-shared-path'); o.points = p; }, false),
    'kJm2.KJm7::uIuQ': h(1, () => 25),
    'w5s2.g5s7::.ctor': h(2, (rect, angle) => { assert.equal(rect, newRect); assert.equal(angle, 25); return { kind: 'new-rotated-rect' }; }),
    'w5s2.g5s7::w5s8': h(4, (before, _after, a, b) => { assert.equal(before, oldRect); set(a, { kind: 'relative-a' }); set(b, { kind: 'relative-b' }); order.push('relative-vectors-sink'); }, false),
    'Axure.DocumentModel.Objects.VectorShape::tN4P': h(3, () => { order.push('write-view-geometry'); }, false),
    'Axure.DocumentModel.Objects.VectorShape::MN4M': h(2, (_o, flag) => { assert.equal(flag, 1); order.push('initialize-no-dimension'); }, false),
  }, trace);
  assert.equal(result.value, snapshot); assert.equal(owner.GNZZ, 0); assert.equal(owner.mNYN, 0); assert.equal(owner.points, points);
  assert.equal(owner.tN8N, 'old-a'); assert.equal(owner.cN8J, 'old-b');
  assert.deepEqual(order, ['snapshot', 'normalize-measure-sink', 'TrapConns', 'AutoFitHeight=false', 'AutoFitWidth=false', 'write-shared-path', 'relative-vectors-sink', 'write-view-geometry', 'initialize-no-dimension']);
  return { priorWidth, priorHeight, order, trace, boundary: 'Normal-path replay skips exception/finally execution; Dispose is separately present in retained CIL, not dynamically verified here.' };
});

for (const fitWidth of [0, 1]) for (const fitHeight of [0, 1]) check(`VectorShape geometry/style snapshot round trip ${fitWidth}/${fitHeight}`, () => {
  const owner = { kind: 'owner', nativeTypes: ['Axure.DocumentModel.Objects.VectorShape'], GNZZ: fitWidth, mNYN: fitHeight,
    myStyle: { geometry: { x: 10, y: 20, width: 100, height: 40 }, color: 'baseline' },
    fJZ4: new Map([['tablet', { x: 3, stateStyles: {} }], ['phone', { width: 8 }], ['orphan', { hidden: true, stateStyles: { selected: { color: 'red' } } }]]) };
  const before = structuredClone(owner), snapshot = { kind: 'geometry-snapshot' }, trace = [];
  const handlers = {
    'tIaS.UIaN::DkYN': h(0, () => {}, false),
    'TypeSpecification:1B000E91::.ctor': h(2, (s, o) => { s.ESgn = o; }, false),
    'ESgf.pSg8::.ctor': h(2, (s, o) => { s.ESgn = o; }, false),
    'kJm2.KJm7::NJ01': h(1, () => {}, false),
    'kJm2.KJm7::cJO3': h(1, o => o.myStyle),
    'RtnB.ztnG::QIlt': h(1, value => structuredClone(value)),
    'kJm2.KJm7::EJOg': h(2, (o, value) => { o.myStyle = value; }, false),
    'kJm2.KJm7::get_Rect': h(1, o => o.myStyle.geometry),
    'kJm2.KJm7::uIuQ': h(1, () => 17),
    'Axure.DocumentModel.Objects.RichTextObject::get_AutoFitWidth': h(1, o => o.GNZZ),
    'Axure.DocumentModel.Objects.TextRectObject::get_AutoFitHeight': h(1, o => o.mNYN),
    'Axure.DocumentModel.Objects.RichTextObject::set_AutoFitWidth': h(2, (o, v) => { o.GNZZ = v; }, false),
    'Axure.DocumentModel.Objects.TextRectObject::set_AutoFitHeight': h(2, (o, v) => { o.mNYN = v; }, false),
    'kJm2.KJm7::GJOW': h(1, () => 'phone'),
    'vtiE.ktiR::Hti6': h(1, value => value),
    'kJm2.KJm7::Update': h(2, () => {}, false),
  };
  for (const type of ['1B000CC5', '1B00103C']) {
    handlers[`TypeSpecification:${type}::.ctor`] = h(0, () => new Map());
    handlers[`TypeSpecification:${type}::GetEnumerator`] = h(1, m => enumerator([...m]));
    handlers[`TypeSpecification:${type}::set_Item`] = h(3, (m, key, value) => m.set(key, value), false);
    handlers[`TypeSpecification:${type}::Clear`] = h(1, m => m.clear(), false);
  }
  for (const type of ['1B000CCC', '1B00103E']) {
    handlers[`TypeSpecification:${type}::MoveNext`] = enumHandlers['System.Collections.IEnumerator::MoveNext'];
    handlers[`TypeSpecification:${type}::get_Current`] = enumHandlers['TypeSpecification:1B00019B::get_Current'];
  }
  for (const type of ['1B000C28', '1B00103D']) {
    handlers[`TypeSpecification:${type}::get_Key`] = h(1, value => unref(value)[0]);
    handlers[`TypeSpecification:${type}::get_Value`] = h(1, value => unref(value)[1]);
  }
  handlers['nSWB.ASWG::.ctor'] = h(1, o => { const s = { kind: 'style-snapshot' }; run(100707201, [s, o], handlers, trace); return s; });
  handlers['TypeSpecification:1B000E91::Apply'] = h(1, s => { assert.equal(s.kind, 'style-snapshot'); run(100707202, [s], handlers, trace); }, false);
  run(100707152, [snapshot, owner], handlers, trace);
  owner.GNZZ = 0; owner.mNYN = 0; owner.myStyle.color = 'changed'; owner.myStyle.geometry.width = 333;
  owner.fJZ4.delete('orphan'); owner.fJZ4.set('phone', { width: 999 }); owner.fJZ4.set('new-map', { opacity: 0 });
  run(100707153, [snapshot], handlers, trace);
  assert.deepEqual(owner, before);
  assert.notEqual(owner.myStyle, snapshot.nScj.DSWV);
  assert.notEqual(owner.fJZ4.get('tablet'), snapshot.nScj.ESWr.get('tablet'));
  return { fitWidth, fitHeight, mapsRestored: [...owner.fJZ4], baselineRestored: owner.myStyle, trace,
    boundary: 'Effective AutoFit getters are supplied as identity raw flags for the rotation-only scenario; scaled-transform getter differences remain outside this replay.' };
});

// IMPORTANT: point-mode Kj3n invokes TN46(false), not RN4I. Keep these paths distinct.
for (const current of ['Base', 'phone']) for (const allViews of [false, true]) for (const change of ['both', 'location', 'size', 'neither']) check(`point TN46 false current=${current} allViews=${allViews} change=${change}`, () => {
  const beforeRect = { x: 100, y: 70, width: 200, height: 60 };
  const afterRect = { x: beforeRect.x + (['both', 'location'].includes(change) ? 9 : 0), y: beforeRect.y,
    width: beforeRect.width + (['both', 'size'].includes(change) ? 12 : 0), height: beforeRect.height };
  const owner = { kind: 'owner', current, allViews, GNZZ: true, mNYN: true,
    maps: { Base: { ...beforeRect, opacity: .3 }, tablet: { color: 'blue' }, phone: { ...beforeRect, hidden: true }, orphan: { width: 99 } } };
  const before = structuredClone(owner), trace = [], writes = [];
  const effective = () => ({ ...beforeRect, ...owner.maps[current] });
  const handlers = {
    'Axure.DocumentModel.Objects.VectorShape::hN4K': h(4, (_o, _points, flag, output) => { assert.equal(flag, 0); output.ref[output.key] = { kind: 'normalized-shared-path' }; return afterRect; }),
    'h5uH.j5u5::get_Location': h(1, rect => ({ x: unref(rect).x, y: unref(rect).y })),
    'h5uH.j5u5::get_Size': h(1, rect => ({ width: unref(rect).width, height: unref(rect).height })),
    'kJm2.KJm7::xJ0B': h(5, (...args) => run(100695349, args, handlers, trace), false),
    'kJm2.KJm7::uJ0j': h(4, (...args) => run(100695365, args, handlers, trace), false),
    'kJm2.KJm7::pJ0V': h(4, (...args) => run(100695350, args, handlers, trace), false),
    'kJm2.KJm7::fJ0b': h(4, (...args) => run(100695366, args, handlers, trace), false),
    'kJm2.KJm7::GJqn': h(1, () => ({ x: effective().x, y: effective().y })),
    'kJm2.KJm7::uJqf': h(1, () => ({ width: effective().width, height: effective().height })),
    'm5wr.f5wV::op_Inequality': h(2, (a, b) => a.x !== b.x || a.y !== b.y),
    'hHBO.fHBd::op_Inequality': h(2, (a, b) => a.width !== b.width || a.height !== b.height),
    'kJm2.KJm7::NJ01': h(1, () => {}, false),
    'kJm2.KJm7::wJOS': h(1, () => ({ kind: 'normal-provider-holder' })),
    'TypeSpecification:1B000CC4::tbKf': h(1, () => false),
    'kJm2.KJm7::get_AllowAdaptiveLocation': h(1, o => run(100695363, [o]).value),
    'kJm2.KJm7::get_AllowAdaptive': h(1, o => run(100695362, [o]).value),
    'kJm2.KJm7::XJdz': h(1, () => false),
    'kJm2.KJm7::vJOH': h(1, o => ({ kind: `current-${o.current}`, o })),
    'xtod.jtoq::O5Gq': h(2, (p, value) => { writes.push({ key: 101, current, value }); Object.assign(p.o.maps[current], value); }, false),
    'xtod.jtoq::P5GO': h(2, (p, value) => { writes.push({ key: 105, current, value }); Object.assign(p.o.maps[current], value); }, false),
    'kJm2.KJm7::DJ0E': h(3, () => {}, false),
    'TypeSpecification:1B000CCF::.ctor': h(1, value => value),
    'kJm2.KJm7::OnLocationChanged': h(2, () => {}, false),
    'kJm2.KJm7::xJdR': h(1, () => 0),
    'hHBO.fHBd::UHB4': h(2, (value, angle) => { assert.equal(angle, 0); return unref(value); }),
    'kJm2.KJm7::NIuy': h(2, (_o, value) => value),
    'kJm2.KJm7::EIuw': h(2, () => {}, false), 'kJm2.KJm7::dIuu': h(2, () => {}, false),
    'Axure.DocumentModel.Objects.VectorShape::DN4W': h(2, (o, points) => { o.points = points; }, false),
  };
  run(100702684, [owner, { kind: 'edited-path' }, 0], handlers, trace);
  assert.equal(owner.GNZZ, true); assert.equal(owner.mNYN, true);
  assert.equal(owner.points.kind, 'normalized-shared-path');
  for (const [name, map] of Object.entries(before.maps)) if (name !== current) assert.deepEqual(owner.maps[name], map);
  assert.deepEqual(writes.map(w => w.key), change === 'both' ? [101, 105] : change === 'location' ? [101] : change === 'size' ? [105] : []);
  return { current, allViews, change, writes, flagsUnchanged: true, otherMapsUnchanged: true, trace,
    boundary: 'hN4K geometry and NIuy size validation are explicit sinks; exact unchanged/changed equality inputs use integers away from tolerance.' };
});

for (const delta of [0, .000009, .00001, .000011]) for (const axis of ['width', 'height']) check(`native size equality ${axis} delta=${delta}`, () => {
  const a = { width: 0, height: 0 }, b = { ...a, [axis]: delta };
  const result = run(100722994, [a, b], {
    'hHBO.fHBd::IHVr': h(1, value => unref(value).width),
    'hHBO.fHBd::zHVB': h(1, value => unref(value).height),
    'Ebxh.rbx2::qbxO': h(3, (x, y, epsilon) => Math.abs(x - y) < epsilon),
  });
  assert.equal(!!result.value, delta < .00001);
  return { axis, delta, equal: !!result.value, trace: result.trace, boundary: 'qbxO comparison sink uses independently retained scalar comparison evidence.' };
});

const output = { schema: 1, kind: 'Bounded static CIL replay; provider/geometry/notification sinks; no original DLL or GUI execution', sources: [...files, 'research/gradient-angle-static-flow.mjs', 'research/gradient-angle-flow-init-cil.json'].map(path => ({ path, sha256: sha256(path) })), passed: results.length, results };
fs.writeFileSync('research/native-point-commit-format-probes.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ passed: results.length }));
