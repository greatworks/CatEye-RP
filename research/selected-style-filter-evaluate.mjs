// Bounded interpretation of the retained, decoded a5FY CIL. The vendor DLL is
// not loaded/executed; the three property/object accessors below are explicit
// inputs. This verifies branch logic, not the whole original generator.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const dllHash = 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
const cilFile = 'research/selected-style-filter-flag-helpers.json';
const cil = read(cilFile);
assert.equal(cil.SHA256, dllHash);
const method = cil.Types.flatMap(t => t.Methods).find(m => m.Token === 100717956);
const instructions = new Map(method.Instructions.map((i, index) => [i.Offset, { ...i, next: method.Instructions[index + 1]?.Offset }]));
function evaluate(property) {
  let pc = 0; const stack = [], trace = [];
  for (let steps = 0; steps < 200; steps++) {
    const i = instructions.get(pc); assert.ok(i, `Unknown instruction ${pc}`); trace.push(pc); pc = i.next;
    if (i.Op === 'br' || i.Op === 'br.s') pc = i.Operand;
    else if (i.Op === 'ldarg.0') stack.push(property);
    else if (i.Op === 'ldnull') stack.push(null);
    else if (i.Op === 'ldc.i4') stack.push(i.Operand);
    else if (i.Op === 'ldc.i4.0') stack.push(0);
    else if (i.Op === 'sub') { const b = stack.pop(), a = stack.pop(); stack.push((a - b) | 0); }
    else if (i.Op === 'beq') { const b = stack.pop(), a = stack.pop(); if (a === b) pc = i.Operand; }
    else if (i.Op === 'brfalse') { if (!stack.pop()) pc = i.Operand; }
    else if (i.Op === 'brtrue') { if (stack.pop()) pc = i.Operand; }
    else if (i.Op === 'ceq') { const b = stack.pop(), a = stack.pop(); stack.push(Number(a === b)); }
    else if (i.Op === 'call' && i.Operand === 100717988) { const b = stack.pop(), a = stack.pop(); stack.push(a !== b); }
    else if (i.Op === 'callvirt' && i.Operand === 100717984) stack.push(Number(stack.pop().overridden));
    else if (i.Op === 'callvirt' && i.Operand === 100717982) stack.push(Number(stack.pop().indeterminate));
    else if (i.Op === 'ret') { assert.equal(stack.length, 1); return { result: Boolean(stack.pop()), trace }; }
    else throw Error(`Unsupported reached opcode ${i.Op} at ${i.Offset}; do not infer opaque branches`);
  }
  throw Error('Bound exceeded');
}
const truthTable = [null, ...[false, true].flatMap(overridden => [false, true].map(determined => ({ overridden, indeterminate: !determined })))].map(input => {
  const output = evaluate(input), expected = input !== null && input.overridden && !input.indeterminate;
  assert.equal(output.result, expected); return { input, ...output };
});
const sourceFile = 'research/font-style-format-evidence.json', source = read(sourceFile);
const p = (map, name) => map?.$map?.find(([key]) => key === name)?.[1];
const targets = source.targets.map(target => {
  const props = p(target.selectedStyle.properties, 'PropList');
  const decisions = props.map(prop => {
    const doaName = p(prop, 'DOAName'), input = { overridden: Boolean(doaName & 0x40000000), indeterminate: !(doaName & 0x80000000) };
    return { property: doaName & 0x0fffffff, rawDoaName: doaName, ...input, emittedByOD: evaluate(input).result, value: p(prop, 'Value') };
  });
  assert.equal(props.length, 52);
  assert.deepEqual(decisions.filter(d => d.emittedByOD).map(d => d.property), [6]);
  const outer = p(target.localStyle.properties, 'PropList').find(prop => (p(prop, 'DOAName') & 0x0fffffff) === 21);
  assert.equal(evaluate({ overridden: Boolean(p(outer,'DOAName') & 0x40000000), indeterminate: !(p(outer,'DOAName') & 0x80000000) }).result, true);
  return { packageId: target.packageId, objectId: target.id, styleId: target.selectedStyle.id, sampleSha256: target.sourceSha256, packageSha256: target.sourcePartSha256,
    allFlag: p(target.selectedStyle.properties, 'All'), outerIxDoaName: p(outer, 'DOAName'), decisions };
});
const files = fs.readdirSync('research').filter(f => /^selected-style-filter-.*\.json$/.test(f) && !f.endsWith('-evidence.json') && !f.endsWith('-predicates-raw.json')).map(f => `research/${f}`);
const result = { method: 'Read-only exact decoded CIL branch interpretation with explicit getter stubs; no native DLL/app or generated page execution', assemblySha256: dllHash,
  extractionEvidenceId: 'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7', packageSha256: 'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',
  predicate: { token: 100717956, expression: 'property != null && overridden && determined', truthTable }, targets,
  files: [...files, sourceFile, 'research/selected-style-filter-evaluate.mjs'].map(file => ({ file, sha256: hash(file) })) };
fs.writeFileSync('research/selected-style-filter-evidence.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ truthTable: truthTable.length, sourceProperties: targets.reduce((sum,t) => sum + t.decisions.length,0), targets: targets.map(t => ({objectId:t.objectId,kept:t.decisions.filter(d=>d.emittedByOD).map(d=>d.property)})) }));
