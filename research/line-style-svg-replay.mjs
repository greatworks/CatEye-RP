// Bounded replay of retained CIL instruction records. Never loads the target DLL.
// External formatting and writer calls are symbolic sinks; opaque strings stay opaque.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readJson, sha256, fields } from './gradient-angle-static-flow.mjs';

const inputs = ['line-style-platform-functions-cil.json', 'line-style-pen-cil.json', 'line-style-dash-rva.json', 'line-style-json-pattern-cil.json', 'line-style-svg-pen-cil.json', 'line-style-svg-pen-base-cil.json', 'line-style-svg-writer-cil.json', 'gradient-angle-zero-cil.json', 'gradient-angle-flow-init-cil.json'];
const sources = inputs.map(name => ({ file: `research/${name}`, sha256: sha256(`research/${name}`) }));
const documents = inputs.filter(name => name.endsWith('-cil.json')).map(name => readJson(`research/${name}`));
const methods = new Map(documents.flatMap(d => d.Types.flatMap(t => t.Methods.map(m => [m.Token, { ...m, owner: `${t.Namespace}.${t.Name}` }]))));
const rvaArrays = new Map(readJson('research/line-style-dash-rva.json').map(item => {
  const bytes = Buffer.from(item.bytes, 'hex'), values = Array.from({ length: bytes.length / 8 }, (_, index) => bytes.readDoubleLE(index * 8));
  assert.deepEqual(values, item.values); return [item.token, values];
}));
const dictionary = new Map(), flowObject = { flow: true }, records = [];
const arities = new Map([[100720067, 1], [100720063, 1], [100720064, 2], [100720068, 2], [100720051, 0], [100720052, 0], [100720055, 0], [100720653, 2], [100688813, 2]]);
const truth = value => value !== null && value !== undefined && value !== false && value !== 0;
function replay(token, args = [], customInstructions) {
  const method = methods.get(token); assert(method, `Missing method ${token}`);
  const code = customInstructions ?? method.Instructions, byOffset = new Map(code.map((i, n) => [i.Offset, n]));
  const stack = [], locals = [], trace = []; let pc = 0, count = 0;
  const pop = () => { assert(stack.length, `Stack underflow ${token}`); return stack.pop(); };
  const take = count => { assert(stack.length >= count, `Call stack ${token}`); return stack.splice(stack.length - count, count); };
  const jump = offset => { assert(byOffset.has(offset), `Unknown target ${offset}`); pc = byOffset.get(offset); };
  while (pc < code.length) {
    assert(++count <= 10000, `Instruction budget ${token}`);
    const i = code[pc++], op = i.Op, value = i.Operand; trace.push(i.Offset);
    if (op.startsWith('ldc.i4')) stack.push(op === 'ldc.i4' || op === 'ldc.i4.s' ? value : op === 'ldc.i4.m1' ? -1 : Number(op.slice(7)));
    else if (op === 'ldc.r8') stack.push(value);
    else if (op.startsWith('ldarg')) stack.push(args[op === 'ldarg.s' || op === 'ldarg' ? value : Number(op.slice(6))]);
    else if (op.startsWith('ldloc')) stack.push(locals[op === 'ldloc.s' || op === 'ldloc' ? value : Number(op.slice(6))]);
    else if (op.startsWith('stloc')) locals[op === 'stloc.s' || op === 'stloc' ? value : Number(op.slice(6))] = pop();
    else if (op === 'ldnull') stack.push(null);
    else if (op === 'ldsfld') { assert([67142340, 67129903].includes(value)); stack.push(value === 67142340 ? flowObject : dictionary); }
    else if (op === 'ldfld') { const obj = pop(); if (obj === flowObject) { assert(fields.has(value)); stack.push(fields.get(value).value); } else { assert(Object.hasOwn(obj, value), `Unknown input field ${value}`); stack.push(obj[value]); } }
    else if (op === 'stfld') { const v = pop(), obj = pop(); obj[value] = v; }
    else if (op === 'newarr') stack.push(Array(pop()).fill(0));
    else if (op === 'dup') { const v = pop(); stack.push(v, v); }
    else if (op === 'ldtoken') stack.push({ rva: value });
    else if (op === 'stelem.r8') { const v = pop(), index = pop(), a = pop(); a[index] = v; }
    else if (op === 'ldelem.r8') { const index = pop(), a = pop(); stack.push(a[index]); }
    else if (op === 'ldlen') stack.push(pop().length);
    else if (op === 'box') { const v = pop(); stack.push(value === 33558159 ? { dashEnum: v } : v); }
    else if (op === 'unbox.any') { const v = pop(); assert(value === 33558159 && Object.hasOwn(v, 'dashEnum')); stack.push(v.dashEnum); }
    else if (op === 'isinst') { const v = pop(); stack.push(value === 33558159 ? (v && Object.hasOwn(v, 'dashEnum') ? v : null) : value === 452987268 ? (Array.isArray(v) ? v : null) : assert.fail(`Unexpected isinst ${value}`)); }
    else if (op === 'castclass' || op === 'conv.i4') { /* proved values already use the corresponding JS number/array representation */ }
    else if (['add', 'sub', 'mul', 'xor', 'shl', 'shr', 'clt'].includes(op)) { const b = pop(), a = pop(); stack.push(op === 'add' ? a + b : op === 'sub' ? a - b : op === 'mul' ? a * b : op === 'xor' ? a ^ b : op === 'shl' ? a << b : op === 'shr' ? a >> b : a < b ? 1 : 0); }
    else if (op === 'neg') stack.push(-pop());
    else if (op === 'not') stack.push(~pop());
    else if (op === 'br' || op === 'br.s') jump(value);
    else if (op === 'brtrue' || op === 'brfalse') { const yes = truth(pop()); if (op === 'brtrue' ? yes : !yes) jump(value); }
    else if (['beq', 'bne.un', 'blt', 'ble', 'bge'].includes(op)) { const b = pop(), a = pop(); if (op === 'beq' ? a === b : op === 'bne.un' ? a !== b : op === 'blt' ? a < b : op === 'ble' ? a <= b : a >= b) jump(value); }
    else if (op === 'switch') { const index = pop(); if (index >= 0 && index < value.length) jump(value[index]); }
    else if (op === 'ldftn') stack.push({ method: value });
    else if (op === 'newobj') {
      if (value === 100720059) { pop(); stack.push({ 67133744: 0, 67133741: [] }); } // supplied pen shell; methods below are replayed
      else if (value === 167792211) { const fn = pop(), owner = pop(); stack.push({ ...fn, owner }); }
      else assert.fail(`Unadmitted constructor ${value}`);
    }
    else if (op === 'call' || op === 'callvirt') {
      if (arities.has(value)) { const result = replay(value, take(arities.get(value))); if (![100720064, 100720068].includes(value)) stack.push(result.value); }
      else if (value === 167774424) { const ref = pop(), array = pop(); assert(rvaArrays.has(ref.rva)); assert.equal(array.length, rvaArrays.get(ref.rva).length); array.splice(0, array.length, ...rvaArrays.get(ref.rva)); }
      else if (value === 167792895) { const item = pop(), key = pop(), map = pop(); assert(!map.has(key)); map.set(key, item); }
      else if (value === 167789206) { const key = pop(), map = pop(); assert(map.has(key)); stack.push(map.get(key)); }
      else if (value === 167786524) stack.push([...pop()]);
      else if (value === 100719290) stack.push({ brush: 'opaque-default' });
      else if (value === 100732102) stack.push({ opaqueStringKey: pop() });
      else if (value === 167774838) stack.push(Math.abs(pop()));
      else if (value === 100688625) stack.push({ formattedNumber: pop() });
      else if (value === 721424378) { const fn = pop(), source = pop(); assert.equal(fn.method, 100720653); stack.push(source.map(dash => replay(fn.method, [fn.owner, dash]).value)); }
      else if (value === 167775994) { const parts = pop(), separator = pop(); stack.push({ join: parts, separator }); }
      else if ([100723512, 100723515].includes(value)) { const [sink, key, v] = take(3); sink.push({ token: value, key, value: v, at: i.Offset }); }
      else if ([100690265, 100690263, 100690267].includes(value)) { const [sink, v, flag] = take(3); sink.push({ token: value, value: v, flag, at: i.Offset }); }
      else if (value === 100690268) { const [sink, v] = take(2); sink.push({ token: value, value: v, at: i.Offset }); }
      else if ([100690275, 100690276].includes(value)) pop().push({ token: value, at: i.Offset });
      else assert.fail(`Unadmitted call ${value} at ${token}:${i.Offset}`);
    }
    else if (op === 'ret') { records.push({ token, trace }); assert(stack.length <= 1, `Return stack ${token}`); return { value: stack[0], trace }; }
    else assert.fail(`Unadmitted opcode ${op} at ${token}:${i.Offset}`);
  }
  return { value: stack[0], trace };
}

// Extract only the eight dictionary-insertion expressions, not unrelated .cctor behavior.
const initializer = methods.get(100708486), insertionBlocks = [];
for (let n = 0; n < initializer.Instructions.length; n++) {
  if (initializer.Instructions[n].Operand !== 167792895) continue;
  let begin = n; while (begin && !(initializer.Instructions[begin].Op === 'ldloc.s' && initializer.Instructions[begin].Operand === 0)) begin--;
  const block = initializer.Instructions.slice(begin, n + 1);
  // Substituting the known dictionary local is the only change to these instruction records.
  replay(initializer.Token, [dictionary], block.map((i, at) => at === 0 ? { ...i, Op: 'ldarg.0', Operand: null } : i));
  insertionBlocks.push({ start: block[0].Offset, end: block.at(-1).Offset });
}
assert.equal(dictionary.size, 8);
const expected = [null, 0, [17, 8], [9, 4], [3, 1], [9, 4, 2, 4], [9, 4, 2, 4, 2, 4], [17, 4, 5, 4], [1, 1], 0];
const names = ['solid', 'long-dash', 'medium-dash', 'short-dash', 'dash-dot', 'dash-dot-dot', 'long-dash-short-dash', 'dot', 'none'];
const results = [];
for (let style = 1; style <= 9; style++) {
  const sink = [], json = replay(100694329, [style, sink]);
  const values = sink.filter(v => v.token === 100690268).map(v => v.value);
  const actual = values.length ? values : sink.find(v => v.token === 100690267)?.value;
  assert.deepEqual(actual, expected[style]);
  const svg = [];
  for (const width of [0, .5, 1, 2.5, 7]) {
    // Solid/None use the writer's non-dashed path here, not a claim about None's separate paint gate.
    const pen = { 67134008: width, 67134015: Array.isArray(actual) ? actual : [] }, writes = [];
    const flow = replay(100720652, [pen, writes]);
    const joined = writes.find(v => v.value?.join)?.value;
    if (Array.isArray(actual) && width > 0) assert.deepEqual(joined.join.map(v => v.formattedNumber), actual.map(v => v * width));
    else assert.equal(joined, undefined);
    svg.push({ width, writes, trace: flow.trace });
  }
  results.push({ enum: style, name: names[style - 1], cssLabel: sink.find(v => v.token === 100690265)?.value, jsonArray: actual, jsonTrace: json.trace, svg });
}

const ctor = methods.get(100720687), baseCtor = methods.get(100720645), mapper = methods.get(100720653);
for (const token of [100720049, 100720045, 100720067, 100720685]) assert(ctor.Instructions.some(i => i.Operand === token));
assert(baseCtor.Instructions.some(i => i.Op === 'stfld' && i.Operand === 67134008));
assert(baseCtor.Instructions.some(i => i.Op === 'stfld' && i.Operand === 67134015));
assert.deepEqual(mapper.Instructions.filter(i => i.Offset >= 7).map(i => i.Op), ['ldarg.1', 'ldarg.0', 'ldfld', 'mul', 'call', 'ret']);
const writerUses = documents.find(d => d.Types.some(t => t.Name === 'dHbV')).Types.flatMap(t => t.Methods).flatMap(m => m.Instructions.filter(i => i.Operand === 100720687).map(i => ({ method: m.Token, name: m.Name, offset: i.Offset })));
const report = { method: 'Bounded static CIL-record replay; no target assembly loading or execution', limitations: ['Opaque string decoder was not executed; CSS label and SVG attribute/separator literals are unresolved.', 'JSON writer and numeric-formatting methods are symbolic sinks, not a full HTML generator.', 'Dictionary insertion blocks are replayed independently; the unrelated enclosing static constructor is not run.', 'Caps/joins and geometry are outside this arithmetic replay.'], assemblySha256: documents[0].SHA256, sources, insertionBlocks, dictionary: [...dictionary].map(([key, value]) => ({ key, value })), writerUses, mapper: { token: mapper.Token, owner: mapper.owner, il: mapper.Instructions.filter(i => i.Offset >= 7) }, counts: { patternCases: results.length, svgWidthCases: results.length * 5, multipliedNonzeroDashCases: 7 * 4, replayedMethodInvocations: records.length }, results };
fs.writeFileSync('research/line-style-svg-replay.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.counts));
