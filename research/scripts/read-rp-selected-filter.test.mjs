import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectRpSemantics, recoverStyle, recoverSelection, recoverInteractionStyles } from './read-rp-semantics.mjs';

const map = values => ({ $map: Object.entries(values) });
const prop = (key, value, flags = 0xc0000000) => map({ DOAName: key | flags, Value: value });
const guid = value => ({ $guid: value });
const solid = value => map({ 'fill-type': 'solid', 'fill-color': value });
const zero = '0'.repeat(32), defaultId = 'a'.repeat(32), baseId = 'b'.repeat(32);
function fixture() {
  const widget = { id: 'e'.repeat(32), type: 'Axure:DiagramObject:VectorShape', properties: map({ Selected: false, SelectedStyleGroup: '', Disabled: false, Error: false }) };
  const ix = map({});
  const style = { id: 'c'.repeat(32), properties: map({ MatchInfo: map({ Id: guid(baseId), LibraryId: guid(zero) }), PropList: [prop(0, guid(baseId)), prop(21, ix)] }) };
  const cache = (id, Props) => map({ Info: map({ Id: guid(id), LibraryId: guid(zero) }), Props });
  const root = { properties: map({ StyleCache: map({ Styles: [cache(defaultId, [prop(1, 'Roboto'), prop(2, 10.5), prop(1001, 400), prop(1002, 1), prop(7, solid(-1)), prop(6, solid(-16777216))]), cache(baseId, [])] }) }) };
  const objects = new Map();
  const state = (name, props) => {
    const id = (objects.size + 1).toString(16).padStart(32, 'd');
    const value = { id, type: 'Axure:Style', properties: map({ All: false, PropList: props }) };
    objects.set(id, value); ix.$map.push([name, { $reference: id, referenceTag: 3 }]); return value;
  };
  const args = [widget, style, root, defaultId, ref => objects.get(ref?.$reference), { type: 'box' }];
  return { state, args, selection: () => recoverSelection(...args), states: () => recoverInteractionStyles(...args), active: () => recoverStyle(...args, true), base: () => recoverStyle(...args, false) };
}

test('original recursive IX_STYLES JSON path and its OD predicate are pinned independently', () => {
  const read = name => JSON.parse(fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  const entry = read('selected-style-filter-json-entry.json');
  assert.equal(entry.SHA256, 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
  const methods = entry.Types.flatMap(t => t.Methods), style = methods.find(m => m.Token === 100694319), props = methods.find(m => m.Token === 100694323);
  assert.equal(style.Instructions.find(i => i.Offset === 85).Operand, 100717059);
  assert.equal(props.Instructions.find(i => i.Offset === 960).Operand, 0x1b00048e);
  assert.equal(props.Instructions.find(i => i.Offset === 1040).Operand, 100694319);
  const proof = read('selected-style-filter-evidence.json');
  assert.equal(proof.predicate.truthTable.length, 5);
  assert.equal(proof.predicate.truthTable.filter(r => r.result).length, 1);
  assert.deepEqual(proof.targets.map(t => t.decisions.filter(d => d.emittedByOD).map(d => d.property)), [[6], [6]]);
});

test('two real 52-entry Exp.Date Selected snapshots recover only the explicit color patch', () => {
  const census = JSON.parse(fs.readFileSync(new URL('../font-style-format-evidence.json', import.meta.url), 'utf8'));
  const sample = census.samples.find(s => s.sha256 === '1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179');
  assert.ok(sample);
  assert.equal(createHash('sha256').update(fs.readFileSync(sample.file)).digest('hex'), sample.sha256);
  const source = inspectRpSemantics(sample.file);
  for (const target of census.targets) {
    const widget = source.diagrams.find(d => d.packageId === target.packageId)?.widgets.find(w => w.id === target.id);
    assert.ok(widget, target.id);
    assert.equal(widget.selectionRecovery.status, 'supported-selection');
    assert.deepEqual(widget.selectionRecovery.selectedStyle, { color: '#1e98d7' });
    assert.equal(widget.selectionRecovery.baseStyleRecovery.style.fontSize, 14);
    assert.equal(widget.selectionRecovery.baseStyleRecovery.style.color, '#00000089');
  }
});

test('non-overridden or indeterminate snapshot records neither reject nor overwrite the active selected appearance', () => {
  for (const flags of [0, 0x80000000, 0x40000000]) {
    const f = fixture();
    f.state('Selected', [prop(6, solid(-14772009)), prop(1002, 0, flags), prop(1001, 900, flags), prop(2, 72, flags), prop(7, solid(-65536), flags), prop(72, map({ On: true }), flags)]);
    assert.equal(f.selection().status, 'supported-selection', String(flags));
    assert.deepEqual(f.selection().selectedStyle, { color: '#1e98d7' });
    const { color: ignored, ...base } = f.base().style, { color: selected, ...active } = f.active().style;
    assert.equal(selected, '#1e98d7'); assert.deepEqual(active, base);
    assert.equal(active.fontStyle, 'italic');
    assert.equal(f.active().unknown.some(item => item.source?.kind === 'stored-active-state-style'), false);
  }
});

test('ordinary named interaction states use the same OD filter without reintroducing ignored snapshot output properties', () => {
  for (const name of ['MouseOver', 'MouseDown', 'Focused', 'Disabled']) {
    const f = fixture();
    f.state(name, [prop(6, solid(-14772009)), prop(1002, 0, 0x80000000), prop(72, map({ On: true }), 0x80000000)]);
    const result = Object.values(f.states().states).find(s => s.sourceState === name);
    assert.equal(result.status, 'supported-state-style', name);
    assert.deepEqual(result.style, { color: '#1e98d7' });
    assert.deepEqual(result.sourceProperties, [6]);
  }
});

test('an active unsupported property still rejects the whole state; unknown values are not guessed away', () => {
  for (const bad of [prop(72, map({ On: true })), prop(1002, 2), prop(7, map({ 'fill-type': 'unknown' }))]) {
    const f = fixture(); f.state('Selected', [prop(6, solid(-14772009)), bad]); f.state('Focused', [prop(6, solid(-14772009)), bad]);
    assert.equal(f.selection().status, 'unsupported-selection');
    assert.equal(f.states().states.focused.status, 'unsupported-state-style');
  }
});

test('property structure and duplicate keys are validated before inactive-property filtering', () => {
  for (const props of [[prop(72, 0, 0x80000000), prop(72, 1, 0x80000000)], [map({ DOAName: 'not-an-int', Value: 0 })], [map({ Value: 0 })]]) {
    const f = fixture(); f.state('Selected', props); f.state('Focused', props);
    assert.equal(f.selection().status, 'unsupported-selection');
    assert.equal(f.states().states.focused.status, 'unsupported-state-style');
  }
});

test('explicit normal reset survives OD filtering and empty filtered states do not inherit snapshot typography', () => {
  const normal = fixture(); normal.state('Selected', [prop(1002, 0)]);
  assert.deepEqual(normal.selection().selectedStyle, { fontStyle: 'normal' });
  const empty = fixture(); empty.state('Selected', [prop(1002, 0, 0x80000000), prop(72, map({ On: true }), 0x80000000)]);
  assert.equal(empty.selection().status, 'supported-selection'); assert.deepEqual(empty.selection().selectedStyle, {});
  assert.equal(empty.active().style.fontStyle, 'italic');
});
