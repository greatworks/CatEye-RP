// Bounded interpretation of extracted CIL records. Never loads the target assembly.
// Native object-context predicates are explicit supplied sinks, not original execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { foldFlowFields } from './gradient-angle-static-flow.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const cilFile = 'research/layer-resize-capability-getters-cil.json';
const metadataFile = 'research/layer-resize-capability-metadata.json';
const cil = read(cilFile), metadata = read(metadataFile);
const pinned = 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
assert.equal(cil.SHA256, pinned);
assert.equal(metadata.sha256, pinned);
assert.equal(hash(metadata.assembly), pinned);
const methods = new Map(cil.Types.flatMap(t => t.Methods).map(m => [m.Token, m]));
const types = new Map(metadata.records.map(t => [t.name, t]));
const fields = foldFlowFields();
const width = 0x08000000n, height = 0x10000000n, both = width | height;
const hex = n => '0x' + BigInt.asUintN(64, n).toString(16).padStart(16, '0');

function replay(token, supplied = {}) {
  const method = methods.get(token), instructions = method.Instructions;
  const indexes = new Map(instructions.map((i, n) => [i.Offset, n]));
  const stack = [], locals = [], trace = [], calls = [];
  let pc = 0, budget = 2000;
  while (budget-- > 0) {
    const i = instructions[pc++], op = i.Op, v = i.Operand;
    assert(i, 'Unexpected instruction end');
    trace.push(i.Offset);
    const jump = target => { assert(indexes.has(target)); pc = indexes.get(target); };
    if (op === 'ldarg.0') stack.push(supplied);
    else if (op === 'ldc.i8') { assert.equal(typeof v, 'string'); stack.push(BigInt(v)); }
    else if (op.startsWith('ldc.i4')) stack.push(op === 'ldc.i4' || op === 'ldc.i4.s' ? v : op === 'ldc.i4.m1' ? -1 : +op.slice(7));
    else if (op === 'conv.i8') stack.push(BigInt(stack.pop()));
    else if (op === 'ldloc.s') stack.push(locals[v]);
    else if (op === 'stloc.s') locals[v] = stack.pop();
    else if (op === 'ldsfld') { assert.equal(v, 67142340); stack.push('opaque initializer'); }
    else if (op === 'ldfld') {
      assert.equal(stack.pop(), 'opaque initializer');
      assert(fields.has(v)); stack.push(fields.get(v).value);
    } else if (['add', 'sub', 'and', 'or', 'xor'].includes(op)) {
      const b = stack.pop(), a = stack.pop();
      stack.push(op === 'sub' ? a - b : op === 'add' ? a + b : op === 'and' ? a & b : op === 'or' ? a | b : a ^ b);
    } else if (op === 'not') stack.push(~stack.pop());
    else if (op === 'br' || op === 'br.s') jump(v);
    else if (op === 'brtrue' || op === 'brtrue.s') { if (stack.pop()) jump(v); }
    else if (op === 'brfalse' || op === 'brfalse.s') { if (!stack.pop()) jump(v); }
    else if (['beq', 'bne.un', 'bgt', 'bgt.un'].includes(op)) {
      const b = stack.pop(), a = stack.pop();
      if (op === 'beq' ? a === b : op === 'bne.un' ? a !== b : op === 'bgt' ? a > b : (a >>> 0) > (b >>> 0)) jump(v);
    } else if (op === 'call') {
      calls.push({ offset: i.Offset, token: v });
      if (v === 100702789) stack.push(stack.pop().shape);
      else if (v === 100708406) { stack.pop(); stack.push(supplied.shapePredicate); }
      else if (v === 100702741) stack.push(stack.pop().objectPredicate);
      else if (v === 100702502) stack.push(stack.pop().isTreeRoot);
      else if (v === 100701928) stack.push(stack.pop().isMaster);
      else if (v === 100725036) { const b = stack.pop(), a = stack.pop(); stack.push(a & ~b); }
      else if (v === 100695292) {
        // Signature is instance void(Capabilities), passed by value.
        // Its exact downstream LtwL stores that argument into a style field.
        const mask = stack.pop(); assert.equal(typeof mask, 'bigint'); assert.equal(stack.pop(), supplied);
      } else throw Error('Unproved call ' + v + ' at ' + i.Offset);
    } else if (op === 'ret') {
      assert.equal(stack.length, 1);
      const mask = BigInt.asUintN(64, stack.pop());
      return { mask, trace, calls };
    } else throw Error('Unproved opcode ' + op);
  }
  throw Error('Bound exceeded');
}

function getterFor(type) {
  for (const name of type.chain) {
    const owner = types.get(name), method = owner?.methods.find(m => m.name === 'get_Capabilities');
    if (method) return { owner, method };
  }
  throw Error('Missing getter');
}

const results = [], table = [];
for (const type of metadata.records.filter(t => t.chain.includes('kJm2.KJm7'))) {
  const { owner, method } = getterFor(type);
  const inputs = method.token === 100702674
    ? [-1, 0, 1, 10, 29, 30, 300, 301].flatMap(shape => [false, true].flatMap(shapePredicate => [false, true].map(objectPredicate => ({ shape, shapePredicate, objectPredicate }))))
    : method.token === 100702552 ? [{ isTreeRoot: false }, { isTreeRoot: true }]
    : method.token === 100701918 ? [{ isMaster: false }, { isMaster: true }] : [{}];
  const cases = inputs.map(input => {
    const value = replay(method.token, input);
    const r = { type: type.name, input, getter: method.token, mask: hex(value.mask),
      fixedWidthCapability: !!(value.mask & width), fixedHeightCapability: !!(value.mask & height),
      trace: value.trace, calls: value.calls };
    results.push(r); return r;
  });
  assert.equal(new Set(cases.map(c => c.fixedWidthCapability)).size, 1);
  assert.equal(new Set(cases.map(c => c.fixedHeightCapability)).size, 1);
  table.push({ type: type.name, typeToken: type.token, base: type.base, chain: type.chain,
    getterOwner: owner.name, getterToken: method.token, getterAttributes: method.attributes,
    inherited: owner.name !== type.name, masks: [...new Set(cases.map(c => c.mask))],
    fixedWidthCapability: cases[0].fixedWidthCapability, fixedHeightCapability: cases[0].fixedHeightCapability,
    normalFixedWidth: cases[0].fixedWidthCapability ? 'effective P109' : 'forced true',
    normalFixedHeight: cases[0].fixedHeightCapability ? 'effective P108' : 'forced true',
    cases: cases.length });
}

// Exhaustive bit-preservation argument independent of shape IDs/context predicate values.
const vector = methods.get(100702674);
const c = offset => BigInt(vector.Instructions.find(i => i.Offset === offset).Operand);
assert.equal(c(0x24f) & both, both);
for (const offset of [0x92, 0xf3, 0x2ac]) assert.equal(c(offset) & both, 0n);
assert.equal(c(0xd1) & both, both);
const integerOr = vector.Instructions.find(i => i.Offset === 0x159);
assert.equal(BigInt(integerOr.Operand) & both, 0n);
assert.equal(types.get('kJm2.KJm7').methods.find(m => m.name === 'vJml').signature, '20010111C0004DC4');
const invariant = {
  conclusion: 'Every VectorShape return retains both capability bits independently of shape/context branches.',
  initial: { offset: 0x24f, mask: hex(c(0x24f)) },
  transforms: [
    { offset: 0x9b, operation: 'Remove', operand: hex(c(0x92)), affectsEitherBit: false },
    { offset: 0xfc, operation: 'Remove', operand: hex(c(0xf3)), affectsEitherBit: false },
    { offset: 0xda, operation: 'AND', operand: hex(c(0xd1)), preservesBothBits: true },
    { offset: 0x15f, operation: 'OR', operand: hex(BigInt(integerOr.Operand)), affectsEitherBit: false },
    { offset: 0x2b7, operation: 'OR', operand: hex(c(0x2ac)), affectsEitherBit: false },
  ],
  sideEffect: 'vJml 100695292 is void and receives Capabilities by value, not byref. Its style-write sink LtwL 100717143 stores the passed mask to WtTU.MtwY (67132852); it does not replace the caller local.',
  contextPredicates: 'get_Shape/DSO4/oNnF are supplied sinks in the branch replay, not independently executed native object conditions.',
};
const enumType = metadata.records.find(t => t.name === 'Axure.Platform.Controls.Capabilities');
const enumBits = enumType.fields.filter(f => ['FixedWidth', 'FixedHeight'].includes(f.name));
assert.equal(enumBits.find(f => f.name === 'FixedWidth').constantLEHex, '0000000800000000');
assert.equal(enumBits.find(f => f.name === 'FixedHeight').constantLEHex, '0000001000000000');
const sourceFiles = [metadataFile, cilFile, 'research/layer-resize-capability-style-sink-cil.json',
  'research/layer-resize-capability-metadata.ps1', 'research/layer-resize-capability-extract.ps1',
  'research/layer-resize-capability-probe.mjs', 'research/gradient-angle-static-flow.mjs',
  'research/gradient-angle-flow-init-cil.json', '.build/next-layer-authoring/pin-propagation-cil.json',
  '.build/next-layer-authoring/pin-input-probe.json', '.build/next-layer-authoring/README.md'];
const report = {
  schema: 1, kind: 'static metadata, exact Int64 bit analysis and bounded CIL-record replay',
  assembly: { path: metadata.assembly, sha256: pinned }, enumBits,
  summary: { types: table.length, replayCases: results.length, failed: 0, vectorMaskInvariants: 6 },
  boundaries: [
    'No target DLL loaded/executed, no GUI, no product changes or product tests.',
    'Full capability masks have unrelated shape/context differences; only FixedWidth/FixedHeight are asserted invariant.',
    'Normal kbNq capability gating does not prove final sizing or bypass special widget/controller branches.',
    'P106–P109 default values and full style-provider precedence are separate parent-owned research.',
    'Tree label is a distinct VectorShape, not a TreeNode capability alias.',
    'Current product input types may share fewer model classes than the native class inventory; mapping must use import/source identity, not names alone.',
  ],
  sources: sourceFiles.map(file => ({ file, sha256: hash(file) })), table, vectorInvariant: invariant, results,
};
fs.writeFileSync('research/layer-resize-capability-evidence.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
