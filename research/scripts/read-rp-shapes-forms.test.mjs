import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { recoverRpSemantics, recoverEllipsePath, property as get } from './read-rp-semantics.mjs';

const original = inspectRpObjects(fileURLToPath(new URL('../samples/Default.rplib', import.meta.url)));
const ellipseId = 'fd98c89bf60143758b00e772e08f4b42', textareaId = '6abb79287fe4442993157dfc369e11a8';
const packageId = id => id === ellipseId ? 'dba2c35a591a4d6589fa2c3e9cc30a9b' : '9f7d5f6c9ed14312b3112e36a1604eff';
const find = (source, id) => source.packages.find(p => p.packageId === packageId(id)).objects.find(o => o.id === id);
const result = (source, id) => recoverRpSemantics(source).diagrams.find(d => d.packageId === packageId(id)).widgets.find(w => w.id === id);
const set = (map, key, value) => { const pair = map.$map.find(p => p[0] === key); if (pair) pair[1] = value; else map.$map.push([key, value]); };

test('actual native ellipse includes stored vector geometry and witnessed empty-text omission', () => {
  assert.equal(original.fileSha256, '9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50');
  const w = result(original, ellipseId);
  assert.equal(w.typeCandidate.type, 'ellipse');
  assert.equal(w.typeCandidate.storedControlGeometryPreserved, true);
  assert.equal(w.typeCandidate.mapping, 'native-control-points-to-svg');
  assert.equal(w.typeCandidate.vectorPath.commands.filter(c => c.op === 'C').length, 4);
  assert.deepEqual(w.storedGeometry.size.value, { Width: 30, Height: 30 });
  assert.deepEqual(w.text, { status: 'stored-empty-rich-text', text: '', source: 'native-omitted-empty-rich-text' });
});

test('ellipse recognizer accepts a cyclic starting point but rejects changed curves, open/reversed paths and extra subpaths', () => {
  const path = get(find(original, ellipseId).properties, 'ControlPoints');
  for (let offset = 0; offset < 4; offset++) assert.ok(recoverEllipsePath([[...path[0].slice(offset), ...path[0].slice(0, offset)]]));
  const mutations = [
    p => p.push(structuredClone(p[0])), p => p[0].pop(), p => p[0].reverse(),
    p => set(p[0][0], 'HigherSegmentExists', false),
    p => set(get(p[0][0], 'Path'), 'X', .51),
    p => set(get(p[0][0], 'LowerHandle'), 'X', .224),
    p => set(get(p[0][0], 'HigherHandle'), 'X', Infinity),
    p => set(get(p[0][0], 'HigherHandle'), 'X', '0.78'),
  ];
  for (const mutate of mutations) { const p = structuredClone(path); mutate(p); assert.equal(recoverEllipsePath(p), null); }
  assert.equal(recoverEllipsePath(null), null);
});

test('changed ellipse control geometry becomes an editable path; unknown or ambiguous Shape enums remain unsupported', () => {
  for (const mutation of ['path', 'enum', 'duplicate']) {
    const source = structuredClone(original), p = find(source, ellipseId).properties;
    if (mutation === 'path') set(get(get(p, 'ControlPoints')[0][0], 'LowerHandle'), 'X', .25);
    if (mutation === 'enum') set(p, 'Shape', 1);
    if (mutation === 'duplicate') p.$map.push(['Shape', 15]);
    const w = result(source, ellipseId);
    if (mutation === 'duplicate') assert.equal(w.status, 'unsupported-widget-fields');
    else if (mutation === 'path') { assert.equal(w.typeCandidate.type, 'path'); assert.equal(w.typeCandidate.vectorPath.commands.at(-2).x2, .25); }
    else assert.equal(w.typeCandidate, null);
  }
});

test('missing vector text is empty, but malformed or explicit unsupported rich text remains a failure', () => {
  for (const value of [null, {}, { $map: [] }, { $map: [['attributed-string', { $map: [['Paragraphs', null]] }]] }]) {
    const source = structuredClone(original); set(find(source, ellipseId).properties, 'RichTextBlock', value);
    const w = result(source, ellipseId);
    assert.notEqual(w.text?.status, 'stored-empty-rich-text');
  }
  const source = structuredClone(original); find(source, ellipseId).type = 'Axure:DiagramObject:Unknown';
  assert.equal(result(source, ellipseId).text.status, 'no-observed-text-field');
});

test('empty-text omission does not extend to old wire versions or unknown legacy fields', () => {
  for (const mutation of ['version', 'carrier']) {
    const source = structuredClone(original);
    if (mutation === 'version') source.packages.find(p => p.packageId === packageId(ellipseId)).version = [10, 0, 4, 0];
    else set(find(source, ellipseId).properties, 'UnknownLegacyText', 'must not become empty');
    assert.equal(result(source, ellipseId).text.status, 'no-observed-text-field');
  }
});

test('actual editable wrapped TextArea recovers plain text, stored bounds and its own library default cache', () => {
  const w = result(original, textareaId);
  assert.equal(w.typeCandidate.type, 'textarea');
  assert.equal(w.text.status, 'stored-plain-text'); assert.equal(w.text.text, '');
  assert.deepEqual(w.storedGeometry.size.value, { Width: 300, Height: 170 });
  assert.equal(w.styleRecovery.cacheChainComplete, true);
  assert.equal(w.styleRecovery.defaultStyleId, '627587b6038d43cca051c114ac41ad32');
  assert.equal(w.styleRecovery.defaultStyleLibraryId, '53f4a189168b474893d409a1b736ad03');
});

test('TextArea active or missing options are rejected rather than becoming editable defaults', () => {
  for (const [key, value] of [
    ['Type', 1], ['Type', '0'], ['WordWrap', false], ['ReadOnly', 'true'],
    ['PlaceholderText', false], ['HideHintOnFocus', 'true'],
    ['SubmitButton', { $reference: 'f'.repeat(32), referenceTag: 3 }],
    ['SubmitButton', { $reference: '0'.repeat(32), referenceTag: 19 }],
  ]) {
    const source = structuredClone(original); set(find(source, textareaId).properties, key, value);
    assert.equal(result(source, textareaId).typeCandidate, null, key);
  }
  for (const key of ['Type', 'WordWrap', 'ReadOnly', 'PlaceholderText', 'HideHintOnFocus', 'SubmitButton']) {
    const source = structuredClone(original), p = find(source, textareaId).properties;
    p.$map = p.$map.filter(pair => pair[0] !== key);
    assert.equal(result(source, textareaId).typeCandidate, null, key);
  }
});

test('TextArea recovery preserves literal Unicode and original line endings before model conversion', () => {
  const source = structuredClone(original), text = '一行\r\n\r第二行\n<b>x</b> & [[literal]]\n';
  set(get(find(source, textareaId).properties, 'TextBlock'), 'text', text);
  const w = result(source, textareaId);
  assert.equal(w.typeCandidate.type, 'textarea'); assert.equal(w.text.text, text);
});
