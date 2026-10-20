import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readJson, fields, sha256 } from './gradient-angle-static-flow.mjs';
import { decodeLiteral } from './text-autofit-native-literals.mjs';
import { run as runClass } from './text-autofit-style-class-replay.mjs';
const sources = ['research/adaptive-placement-format-tristate-conversion-cil.json', 'research/adaptive-placement-format-placed-value-cil.json',
  'research/adaptive-transition-placement-object-cil.json', 'research/adaptive-placement-format-class-predicate-cil.json'];
const methods = new Map(sources.flatMap(f => readJson(f).Types.flatMap(t => t.Methods)).map(m => [m.Token, m]));
const traces = [];
function run(token, args) {
  const m = methods.get(token), il = m.Instructions, at = new Map(il.map((i, n) => [i.Offset, n])), s = [], trace = [];
  let pc = 0, steps = 0; const pop = () => { assert.ok(s.length); return s.pop(); };
  while (pc < il.length) {
    assert.ok(++steps < 1000); const i = il[pc++], op = i.Op, n = i.Operand; trace.push(i.Offset);
    const jump = () => { assert.ok(at.has(n)); pc = at.get(n); };
    if (op === 'br.s' || op === 'br') { jump(); continue; }
    if (op.startsWith('ldarg.')) { s.push(args[Number(op.slice(6))]); continue; }
    if (op.startsWith('ldc.i4')) { s.push(op === 'ldc.i4' || op === 'ldc.i4.s' ? n : Number(op.slice(7))); continue; }
    if (op === 'sub') { const b = pop(); s.push(pop() - b); continue; }
    if (op === 'ceq') { const b = pop(); s.push(Number(pop() === b)); continue; }
    if (op === 'beq') { const b = pop(); if (pop() === b) jump(); continue; }
    if (op === 'brtrue' || op === 'brfalse') { const value = pop(); if (op === 'brtrue' ? value : !value) jump(); continue; }
    if (op === 'ldsfld') { assert.equal(n, 67142340); s.push({ module: true }); continue; }
    if (op === 'ldfld') { assert.ok(pop().module); s.push(fields.get(n).value); continue; }
    if (op === 'call' || op === 'callvirt') {
      if (i.Resolved === 'TypeSpecification:1B000610::n5jA') { s.push(pop().value); continue; }
      if (i.Resolved === 'kJm2.KJm7::get_UnplacedOverride') { s.push(Number(pop().unplacedOverride)); continue; }
      if (i.Resolved === 'kJm2.KJm7::vJOH') { s.push(pop()); continue; }
      if (i.Resolved === 'xtod.jtoq::w5GQ') { s.push(pop().value); continue; }
      if (n === 100695335 || n === 100691415 || n === 100691416) { s.push(run(n, [pop()])); continue; }
      throw Error('Unsupported call ' + i.Resolved);
    }
    if (op === 'ret') { traces.push({ token, arguments: args, offsets: trace }); return pop(); }
    throw Error('Unsupported instruction ' + op);
  }
  throw Error('Missing return');
}
const results = [];
for (const value of [0, 1, 2]) {
  const converted = Boolean(run(100718041, [{ value }])); assert.equal(converted, value === 1);
  for (const unplacedOverride of [false, true]) {
    const placed = Boolean(run(100695335, [{ value, unplacedOverride }])); assert.equal(placed, value === 1 && !unplacedOverride);
    const unplaced = Boolean(run(100699474, [{}, { value, unplacedOverride }])); assert.equal(unplaced, !placed);
    results.push({ name: 'BoolOverride to Boolean and ordinary owner default class predicate', value, unplacedOverride, converted, limboFromEligibleLocal: !converted, placed, unplaced });
  }
}
for (const contained of [false, true]) for (const unplaced of [false, true]) {
  const context = { classNames: { default: 'default-style', base: 'base-style' }, css: { idClasses: false } };
  const widget = { id: 'synthetic-owner', contained, unplaced, visible: true, defaultStyle: { id: 'default' }, localStyle: { baseStyle: { id: 'base' } } };
  const output = runClass('wNxE', [context, widget, false, false, false, []]);
  assert.equal(output.value.includes('ax_default_unplaced'), unplaced && !contained);
  results.push({ name: 'Actual GetClass CIL with explicit predicate sink', contained, unplaced, className: output.value, predicateSink: 'cNxk result supplied; ordinary Placed predicate independently replayed above', trace: output.out.trace });
}
// Exact key literal, narrowly folded from the P111 writer branch.
const writer = readJson('research/selected-style-filter-json-entry.json').Types.flatMap(t => t.Methods).find(m => m.Token === 100694323);
const s = [];
for (const i of writer.Instructions.filter(i => i.Offset >= 397 && i.Offset < 425)) {
  if (i.Op === 'ldc.i4') s.push(i.Operand);
  else if (i.Op === 'ldsfld') s.push({ module: true });
  else if (i.Op === 'ldfld') { assert.ok(s.pop().module); s.push(fields.get(i.Operand).value); }
  else { const b = s.pop(), a = s.pop(); if (i.Op === 'xor') s.push(a ^ b); else if (i.Op === 'shl') s.push(a << b); else throw Error(i.Op); }
}
const literal = decodeLiteral(s[0]), jsonKey = literal[0].toLowerCase() + literal.slice(1);
assert.equal(jsonKey, 'limbo');
const output = { originalAssemblyExecuted: false, method: 'Bounded interpretation of retained CIL with explicit effective-style/property sinks, no GUI or original DLL execution.',
  limits: ['Effective style-chain lookup is supplied, not reimplemented.', 'GetClass cNxk master/compound ancestry is a supplied Boolean sink; ordinary Placed predicate is separately interpreted.', 'No original generated HTML or pixels.'],
  jsonKey: { token: 100694323, il: 425, rawLiteral: literal, transformToken: 100694419, jsonKey },
  totals: { passed: results.length, failed: 0 }, results, traces,
  sources: [...sources, 'research/selected-style-filter-json-entry.json', 'research/adaptive-transition-limbo-writer-cil.json', 'research/text-autofit-style-class-replay.mjs',
    'research/text-autofit-dom-classes-cil.json', 'research/text-autofit-style-classes-cil.json', 'research/text-autofit-style-map-cil.json',
    'research/gradient-angle-static-flow.mjs', 'research/gradient-angle-flow-init-cil.json', 'research/text-autofit-native-literals.mjs'].map(file => ({ file, sha256: sha256(file) })) };
fs.writeFileSync('research/adaptive-placement-format-replay.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ totals: output.totals, jsonKey: output.jsonKey }));
