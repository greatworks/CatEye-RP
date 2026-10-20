import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverRpSemantics, inspectRpSemantics } from './read-rp-semantics.mjs';

const guid = n => n.toString(16).padStart(32, '0');
const ref = (n, referenceTag = 3, name) => ({ $reference: guid(n), referenceTag, ...(name ? { name } : {}) });
const object = (n, type, pairs) => ({ id: guid(n), type, properties: { $map: Object.entries(pairs) } });
function fixture() {
  return { fileSha256: 'a'.repeat(64), packages: [
    { path: 'DesignDocument', sha256: 'b'.repeat(64), rootId: guid(1), objects: [
      object(1, 'Axure:DesignDocument', { GlobalVariableSet: ref(2), 'default-prototype-configuration-id': ref(9, 19, 'Axure:HtmlPrototypeGeneratorConfiguration') }),
      object(2, 'Axure:GlobalVariableSet', { 'global-variables': [ref(3)] }),
      object(3, 'Axure:GlobalVariable', { name: 'Label', 'variable-id': { $guid: guid(4) }, 'default-value': 'literal [[data]]' }),
    ] },
    { path: 'config', sha256: 'c'.repeat(64), packageId: guid(9), rootId: guid(5), objects: [object(5, 'Axure:HtmlPrototypeGeneratorConfiguration', { 'link-style': 'DisplayMultipleTargetsOnly' })] },
  ] };
}
const decode = data => recoverRpSemantics(data).documentSettingsRecovery;
test('recovers literal variable defaults and corroborated Case Behavior without mutating package data', () => {
  const data = fixture(), before = structuredClone(data), result = decode(data);
  assert.deepEqual(data, before);
  assert.deepEqual(result.variables.variables, [{ id: guid(4), name: 'Label', value: 'literal [[data]]' }]);
  assert.equal(result.caseSelection.value, 'auto'); assert.equal(result.caseSelection.sourcePackageId, guid(9));
});
test('rejects ambiguous documents and configuration package IDs rather than taking the last match', () => {
  let data = fixture(); data.packages.push(structuredClone(data.packages[0])); assert.equal(decode(data).variables.status, 'unsupported');
  data = fixture(); data.packages.push(structuredClone(data.packages[1])); assert.equal(decode(data).caseSelection.status, 'unsupported');
});
test('does not infer a serialized string from an enum name', () => {
  for (const name of ['AlwaysDisplayTargets', 'NeverDisplayTargets', 'Unknown']) {
    const data = fixture(); data.packages[1].objects[0].properties.$map[0][1] = name;
    assert.equal(decode(data).caseSelection.status, 'unsupported'); assert.equal(decode(data).variables.status, 'supported');
  }
});
test('rejects malformed variable references and duplicate case-insensitive names as one collection', () => {
  let data = fixture(); data.packages[0].objects[1].properties.$map[0][1][0].referenceTag = 19;
  assert.equal(decode(data).variables.status, 'unsupported'); assert.equal(decode(data).caseSelection.status, 'supported');
  data = fixture(); data.packages[0].objects[1].properties.$map[0][1].push(ref(6));
  data.packages[0].objects.push(object(6, 'Axure:GlobalVariable', { name: 'LABEL', 'variable-id': { $guid: guid(7) }, 'default-value': '' }));
  assert.equal(decode(data).variables.status, 'unsupported');
});
test('four official samples corroborate the same serialized setting and OnLoadVariable carrier', () => {
  for (const name of ['complex-interactions-required-fields.rp', 'the-basics-tab-menu.rp', 'Quick Win.rp', 'UX Prototyping.rp']) {
    const result = inspectRpSemantics(new URL(`../samples/${name}`, import.meta.url)).documentSettingsRecovery;
    assert.equal(result.variables.status, 'supported'); assert.equal(result.variables.variables.length, 1);
    assert.equal(result.variables.variables[0].name, 'OnLoadVariable'); assert.equal(result.variables.variables[0].value, '');
    assert.equal(result.caseSelection.sourceValue, 'DisplayMultipleTargetsOnly'); assert.equal(result.caseSelection.value, 'auto');
  }
});
