// Static constant folding of this pinned assembly's opaque control-flow fields.
// Does not load/execute the target DLL. Only arithmetic instruction records are evaluated.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function foldFlowFields() {
  const file = 'research/gradient-angle-flow-init-cil.json';
  const method = readJson(file).Types.flatMap(t => t.Methods).find(m => m.Token === 100732124);
  const fields = new Map();
  const instructions = method.Instructions;
  for (let i = 0; i < instructions.length; i++) {
    const end = instructions[i];
    if (end.Op !== 'stfld') continue;
    let j = i - 1;
    while (j >= 0 && instructions[j].Op !== 'ldsfld') j--;
    if (j < 0 || instructions[j].Operand !== 67142340) throw Error('Unexpected field initializer');
    const stack = [];
    for (const ins of instructions.slice(j + 1, i)) {
      const { Op: op, Operand: value } = ins;
      if (op.startsWith('ldc.i4')) stack.push(op === 'ldc.i4' || op === 'ldc.i4.s' ? value : op === 'ldc.i4.m1' ? -1 : Number(op.slice(7)));
      else if (op === 'neg') stack.push(-stack.pop() | 0);
      else if (op === 'not') stack.push(~stack.pop());
      else {
        const b = stack.pop(), a = stack.pop();
        if (!Number.isInteger(a) || !Number.isInteger(b)) throw Error('Nonconstant stack');
        const operations = { add: () => (a + b) | 0, sub: () => (a - b) | 0, mul: () => Math.imul(a, b), xor: () => a ^ b, and: () => a & b, or: () => a | b, shl: () => a << b, shr: () => a >> b, 'shr.un': () => a >>> b };
        if (!operations[op]) throw Error('Unproved initializer opcode: ' + op);
        stack.push(operations[op]());
      }
    }
    if (stack.length !== 1 || fields.has(end.Operand)) throw Error('Ambiguous field initializer');
    fields.set(end.Operand, { value: stack[0], methodToken: method.Token, firstIL: instructions[j].Offset, lastIL: end.Offset, name: end.Resolved });
  }
  return fields;
}
export const fields = foldFlowFields();
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/gradient-angle-static-flow.mjs')) {
  const report = { method: 'Pure static Int32 arithmetic folding, not target execution', source: { file: 'research/gradient-angle-flow-init-cil.json', sha256: sha256('research/gradient-angle-flow-init-cil.json') }, fields: [...fields].map(([token, value]) => ({ token, ...value })) };
  fs.writeFileSync('research/gradient-angle-static-fields.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ fields: fields.size }));
}
