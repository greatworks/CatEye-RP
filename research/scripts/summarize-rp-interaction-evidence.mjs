// Reconcile retained, execution-free PE/CLI observations and sample object records.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, root), 'utf8').replace(/^\uFEFF/, ''));
const assemblySha256 = 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
const definitions = [
  ['IxEventType', 'Axure.Constants', 'IxEventType'],
  ['BinaryOperation', 'Axure.Platform', 'LogicalComparison'],
  ['FadeActionType', 'Axure.DocumentModel.Interaction', 'FadeActionType'],
  ['SetStateType', 'Axure.DocumentModel.Interaction', 'SetStateType'],
  ['IxTargetType', 'Axure.DocumentModel.Interaction', 'IxTargetType'],
  ['LinkType', 'Axure.DocumentModel.Interaction', 'LinkType'],
  ['InputType', 'Axure.DocumentModel.Objects', 'InputType'],
  ['PrototypeLinkStyle', 'Axure.DocumentModel.Generators', 'PrototypeLinkStyle'],
];
const enums = definitions.map(([file, namespace, name]) => {
  const evidenceFile = `rp-interaction-${file}-cil.json`, record = read(evidenceFile);
  assert.equal(record.SHA256, assemblySha256);
  const type = record.Types.find(type => type.Name === name && type.Namespace === namespace);
  assert.ok(type, `${namespace}.${name}`);
  return { type: `${namespace}.${name}`, token: type.Token, evidenceFile,
    values: Object.fromEntries(type.Fields.filter(field => field.Constant !== null).map(field => [field.Name, Buffer.from(field.Constant, 'hex').readInt32LE()])) };
});
const find = name => enums.find(item => item.type.endsWith(`.${name}`)).values;
assert.equal(find('IxEventType').OnSelect, 53); assert.equal(find('IxEventType').OnLoad, 288);
assert.equal(find('LogicalComparison').And, 1); assert.equal(find('LogicalComparison').NotEquals, 4);
assert.equal(find('InputType').Password, 1); assert.equal(find('SetStateType').Diagram, 0);
assert.equal(find('IxTargetType').Page, 1); assert.equal(find('LinkType').Current, 1);
assert.deepEqual(find('FadeActionType'), { Hide: 0, Show: 1, Toggle: 2 });
const binary = read('rp-interaction-BinaryExpr-cil.json').Types[0];
const operation = binary.Methods.find(method => method.Name === 'get_Operation');
assert.equal(operation.Signature, '200011BA4C');
// Method signature: HASTHIS, zero parameters, VALUETYPE, compressed TypeDefOrRef.
const codedToken = ((0xba & 0x3f) << 8) | 0x4c;
assert.equal(codedToken & 3, 0); assert.equal((codedToken >>> 2) + 0x02000000, enums[1].token);
const manifest = readdirSync(root).filter(name => /^rp-interaction-.*-cil\.json$/.test(name)).sort().map(file => {
  const bytes = readFileSync(new URL(file, root)), record = read(file);
  assert.equal(record.SHA256, assemblySha256);
  return { file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    types: record.Types.map(type => `${type.Namespace}.${type.Name}`), methodCount: record.Types.reduce((sum, type) => sum + type.Methods.length, 0) };
});
const summary = { inspection: 'retained-static-evidence-only', assemblySha256, enums,
  limitations: ['Serialized key strings remain obfuscated in CIL; sample keys are observations, not decoded CIL strings.',
    'Metadata constant names are not proof of serialized enum string values.',
    'No target assembly or native GUI was loaded or executed.'], manifest };
writeFileSync(new URL('rp-interaction-mappings.json', root), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ verifiedEnums: enums.length, cilRecords: manifest.length, assemblySha256 }));
