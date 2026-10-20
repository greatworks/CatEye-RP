// Read a retained static CIL JSON record; never imports or runs the inspected assembly.
import { readFileSync } from 'node:fs';
const [path, ...names] = process.argv.slice(2);
if (!path) throw new Error('Usage: node show-rp-cil.mjs record.json [methodName ...]');
const record = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
console.log(`Assembly SHA256: ${record.SHA256}`);
for (const type of record.Types) {
  for (const method of type.Methods.filter(method => !names.length || names.includes(method.Name))) {
    console.log(`\n${type.Namespace}.${type.Name}::${method.Name} token=0x${method.Token.toString(16)} RVA=0x${method.Rva.toString(16)}`);
    for (const instruction of method.Instructions) console.log(`${instruction.Offset.toString(16).padStart(4, '0')} ${instruction.Op.padEnd(12)} ${instruction.Resolved ?? instruction.Operand ?? ''}`);
  }
}
