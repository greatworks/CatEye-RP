import test from 'node:test';
import assert from 'node:assert/strict';
import { readObjectPackage } from './read-rp-objects.mjs';
import { recoverInteractionMap } from './read-rp-interactions.mjs';

// Independently constructed fixtures, not files produced or accepted by Axure.
// Storage keys/types and sentinels are grounded in the retained reader/writer
// CIL; the eleven original samples contain no positive action/event witness.
const ZERO = '0'.repeat(32);
const BASE = '19e82109f102476f933582835c373474';
const AUTO = '982030d673df45868f11149ca2b8b02f';
const NAMED = '0123456789abcdef0123456789abcdef';
const id = n => n.toString(16).padStart(32, '0');
const ref = (value, referenceTag = 3, name) => ({ $reference:value, referenceTag, ...(name === undefined ? {} : { name }) });
const object = (n, type, pairs) => ({ id:id(n), type, properties:{ $map:pairs } });
const set = (o, key, value) => { const p = o.properties.$map.find(p => p[0] === key); if (p) p[1] = value; else o.properties.$map.push([key, value]); };
const remove = (o, key) => { o.properties.$map = o.properties.$map.filter(p => p[0] !== key); };
function fixture({ ownerType = 'Axure:Page', eventType = 338, guid = NAMED, auto = false } = {}) {
  const objects = new Map(), add = o => { objects.set(o.id, o); return o; };
  const owner = add(object(1, ownerType, [[ownerType.startsWith('Axure:DiagramObject:') ? 'InteractionMap' : 'interactionmap', ref(id(2))]]));
  const map = add(object(2, 'Axure:InteractionTreeMap', [['node-table', { $map:[] }], ['tree', ref(id(3))], ['PackageMode', false]]));
  const tree = add(object(3, 'Axure:Tree', [['children', [ref(id(4))]], ['tree', ref(id(3))]]));
  const event = add(object(5, 'Axure:InteractionEvent', [['Disabled', false], ['event-type', eventType], ['master-containing-raised-event', ref(ZERO, 16, null)], ['raised-event-id', { $guid:ZERO }], ['variable-id', { $guid:ZERO }]]));
  const firstCase = add(object(7, 'Axure:InteractionCase', [['Disabled', false], ['Description', 'Adaptive case'], ['Condition', ref(ZERO)], ['IsNewIfGroup', true]]));
  const action = add(object(9, 'Axure:InteractionSetAdaptiveView', [['Disabled', false], ['set_adaptive_view_id', { $guid:guid }], ['set_adaptive_view_to_auto', auto]]));
  const node = (n, parent, member, children) => {
    add(object(n, 'Axure:Node', [['children', children.map(n => ref(id(n)))], ['parent-node', ref(id(parent))], ['tree', ref(tree.id)]]));
    map.properties.$map[0][1].$map.push([ref(id(n)), ref(member.id)]);
  };
  node(4, 3, event, [6]); node(6, 4, firstCase, [8]); node(8, 6, action, []);
  return { owner, objects, packageId:id(100), map, tree, event, firstCase, action, add, node };
}
const decode = f => recoverInteractionMap(f);
const event = f => decode(f).events[0];
const action = f => { const e = event(f); assert.equal(e.status, 'supported-event', e.reason); return e.cases[0].actions[0]; };
function rejected(f, pattern) {
  const e = event(f); assert.equal(e.status, 'unsupported-event'); assert.match(e.reason, pattern); assert.equal(e.cases, undefined);
}

// A narrow independent binary encoder exercises pool GUID byte order and the
// actual object decoder before the interaction reader. It is a test encoder,
// not a native document writer or a claim of original-application acceptance.
function binaryFixture(f) {
  const strings = [], guids = [ZERO];
  const index = (pool, value) => { if (!pool.includes(value)) pool.push(value); return pool.indexOf(value); };
  const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
  const cat = (...parts) => Buffer.concat(parts);
  const str = s => cat(i32(8), i32(s === null ? 0 : index(strings, s) + 1));
  const guid = s => i32(index(guids, s));
  const value = v => {
    if (typeof v === 'string' || v === null) return str(v);
    if (typeof v === 'boolean') return cat(i32(25), Buffer.from([Number(v)]));
    if (typeof v === 'number') return cat(i32(5), i32(v));
    if (Array.isArray(v)) return cat(i32(2), i32(v.length), ...v.map(value));
    if (v.$map) return cat(i32(1), i32(v.$map.length), ...v.$map.flatMap(([k, x]) => [value(k), value(x)]));
    if ('$guid' in v) return cat(i32(17), guid(v.$guid));
    if ('$reference' in v) return cat(i32(v.referenceTag), ...([16, 19].includes(v.referenceTag) ? [i32(v.name == null ? 0 : index(strings, v.name) + 1)] : []), guid(v.$reference));
    throw new Error('Unexpected synthetic value');
  };
  const body = cat(...[26, 15].map(i32), guid(f.owner.id), i32(18), guid(f.packageId), ...[...f.objects.values()].map(o => cat(i32(9), guid(o.id), i32(index(strings, o.type) + 1), value(o.properties))), i32(28));
  const bytes = cat(...[27, 11, 0, 0, 0, 50001, 31, strings.length].map(i32), ...strings.map(s => { const b = Buffer.from(s); return cat(i32(b.length), b); }), i32(30), i32(guids.length - 1), ...guids.slice(1).map(g => {
    const b = Buffer.from(g, 'hex'); b.subarray(0, 4).reverse(); b.subarray(4, 6).reverse(); b.subarray(6, 8).reverse(); return b;
  }), body);
  const result = readObjectPackage(bytes), objects = new Map(result.objects.map(o => [o.id, o]));
  assert.equal(result.trailingBytes, 0);
  return { owner:objects.get(result.rootId), objects, packageId:result.packageId };
}

for (const [name, guid, auto, expected] of [
  ['auto overrides the stored Base choice', BASE, true, { kind:'auto' }],
  ['auto accepts a stored empty GUID', ZERO, true, { kind:'auto' }],
  ['Base is its nonzero sentinel', BASE, false, { kind:'base' }],
  ['named identity stays a GUID', NAMED, false, { kind:'nativeGuid', guid:NAMED }],
  ['unresolved zero stays unresolved', ZERO, false, { kind:'nativeGuid', guid:ZERO }],
  ['Auto sentinel without auto flag is not Auto', AUTO, false, { kind:'nativeGuid', guid:AUTO }],
]) test(`synthetic native action: ${name}`, () => {
  const f = fixture({ guid, auto }), before = structuredClone([...f.objects]);
  assert.deepEqual(action(f), { sourceId:f.action.id, type:'setAdaptiveView', adaptiveView:expected });
  assert.deepEqual([...f.objects], before);
});

for (const [name, guid, auto, expected] of [
  ['Auto', NAMED, true, { kind:'auto' }], ['Base', BASE, false, { kind:'base' }],
  ['named GUID', NAMED, false, { kind:'nativeGuid', guid:NAMED }],
]) test(`independently encoded binary ${name} traverses the real object and interaction readers`, () => {
  const f = fixture({ guid, auto }), decoded = binaryFixture(f);
  assert.deepEqual(action(decoded), { sourceId:f.action.id, type:'setAdaptiveView', adaptiveView:expected });
  assert.equal(event(decoded).event, 'adaptiveViewChange'); assert.equal(event(decoded).nativeEventType, 338);
});

test('Page event 338 preserves ordered cases, branch flags and successors of the terminal runtime action', () => {
  const f = fixture();
  const laterAction = f.add(object(11, 'Axure:InteractionSetAdaptiveView', [['Disabled', false], ['set_adaptive_view_id', { $guid:BASE }], ['set_adaptive_view_to_auto', false]]));
  f.node(10, 6, laterAction, []); set(f.objects.get(id(6)), 'children', [ref(id(8)), ref(id(10))]);
  const nextCase = f.add(object(13, 'Axure:InteractionCase', [['Disabled', false], ['Description', 'Following IF'], ['Condition', ref(ZERO)], ['IsNewIfGroup', true]]));
  f.node(12, 4, nextCase, []); set(f.objects.get(id(4)), 'children', [ref(id(6)), ref(id(12))]);
  const e = event(f); assert.equal(e.status, 'supported-event', e.reason);
  assert.deepEqual(e.cases.map(c => [c.id, c.name, c.isNewIfGroup]), [[f.firstCase.id, 'Adaptive case', true], [nextCase.id, 'Following IF', true]]);
  assert.deepEqual(e.cases[0].actions.map(a => a.adaptiveView.kind), ['nativeGuid', 'base']);
  assert.deepEqual(e.cases[1].actions, []); // Runtime, not import, decides successor dispatch.
});

test('supported ordinary widget events can contain SetAdaptiveView without a widget target', () => {
  for (const ownerType of ['Axure:DiagramObject:VectorShape', 'Axure:DiagramObject:Hyperlink']) {
    const f = fixture({ ownerType, eventType:16 });
    assert.deepEqual(action(f), { sourceId:f.action.id, type:'setAdaptiveView', adaptiveView:{ kind:'nativeGuid', guid:NAMED } });
  }
});

for (const ownerType of ['Axure:Master', 'Axure:PanelState', 'Axure:Diagram', 'Axure:PageLike', 'Axure:DiagramObject:VectorShape', 'Axure:DiagramObject:Repeater', 'Axure:DiagramObject:Hyperlink']) {
  test(`event 338 rejects non-Page owner ${ownerType}`, () => rejected(fixture({ ownerType }), /AdaptiveViewChange.*Page/));
}

test('event and case Disabled remain editable, while a Disabled adaptive action rejects its whole event', () => {
  let f = fixture(); set(f.event, 'Disabled', true); assert.equal(event(f).cases[0].enabled, false);
  f = fixture(); set(f.firstCase, 'Disabled', true); assert.equal(event(f).cases[0].enabled, false);
  f = fixture(); set(f.action, 'Disabled', true); rejected(f, /Disabled action/);
});

test('adaptive action bools must be present and boolean, not truthy/coercible values', () => {
  for (const key of ['Disabled', 'set_adaptive_view_to_auto']) {
    for (const bad of [undefined, null, 0, 1, '', 'true', [], {}]) {
      const f = fixture(); if (bad === undefined) remove(f.action, key); else set(f.action, key, bad);
      rejected(f, key === 'Disabled' ? /action Disabled/ : /adaptive view auto/);
    }
  }
});

test('adaptive target requires an exact inert lowercase GUID carrier even when Auto ignores the value', () => {
  for (const bad of [undefined, null, NAMED, { $guid:1 }, { $guid:NAMED.toUpperCase() }, { $guid:'auto' }, { $guid:'a'.repeat(31) }, { $guid:'a'.repeat(33) }, ref(NAMED), { $guid:NAMED, referenceTag:17 }, { $guid:NAMED, extra:true }, Object.assign(Object.create({ $guid:NAMED }), {})]) {
    for (const auto of [false, true]) {
      const f = fixture({ auto }); if (bad === undefined) remove(f.action, 'set_adaptive_view_id'); else set(f.action, 'set_adaptive_view_id', bad);
      rejected(f, /adaptive view GUID/);
    }
  }
});

test('adaptive action rejects unknown, dangerous and duplicate fields rather than emitting a partial target', () => {
  for (const key of ['setAdaptiveViewTo', 'target', 'RunCustomScript', '__proto__', 'constructor', 'prototype']) {
    const f = fixture(); set(f.action, key, 'ignored?'); rejected(f, /Unsupported .* property/);
  }
  for (const key of ['Disabled', 'set_adaptive_view_id', 'set_adaptive_view_to_auto']) {
    const f = fixture(); f.action.properties.$map.push([key, false]); rejected(f, /Ambiguous object property map/);
  }
});

test('unsupported companion actions reject the entire adaptive event; independent Page Loaded remains supported', () => {
  const f = fixture();
  const bad = f.add(object(11, 'Axure:UnknownAction', [['Disabled', false]]));
  f.node(10, 6, bad, []); set(f.objects.get(id(6)), 'children', [ref(id(8)), ref(id(10))]);
  const loaded = f.add(object(13, 'Axure:InteractionEvent', [['Disabled', false], ['event-type', 320], ['master-containing-raised-event', ref(ZERO, 16, null)], ['raised-event-id', { $guid:ZERO }], ['variable-id', { $guid:ZERO }]]));
  f.node(12, 3, loaded, []); set(f.tree, 'children', [ref(id(4)), ref(id(12))]);
  const result = decode(f); assert.equal(result.status, 'decoded-interaction-tree');
  assert.deepEqual(result.events.map(e => e.status), ['unsupported-event', 'supported-event']);
  assert.equal(result.events[0].cases, undefined); assert.match(result.events[0].reason, /UnknownAction/);
  assert.equal(result.events[1].event, 'load');
});

test('Page AdaptiveViewChange retains the existing strict event carrier guard', () => {
  for (const [key, bad] of [['event-type', '338'], ['event-type', 338.5], ['Disabled', 'false'], ['master-containing-raised-event', ref(NAMED, 16, null)], ['raised-event-id', { $guid:NAMED }], ['variable-id', { $guid:NAMED }], ['UnknownEventBehavior', true]]) {
    const f = fixture(); set(f.event, key, bad); rejected(f, /Unsupported|Invalid/);
  }
});
