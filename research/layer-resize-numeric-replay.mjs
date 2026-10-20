// Bounded interpretation of retained ECMA-335 instruction records.
// This script never imports/loads/executes the vendor assembly.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { foldFlowFields } from './gradient-angle-static-flow.mjs';
export const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
export const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export const sourceFiles = [
  '.build/next-layer-authoring/constraint-bridge-cil.json',
  '.build/next-layer-authoring/pin-info-cil.json',
  'research/layer-resize-numeric-solver-cil.json',
  'research/layer-resize-numeric-primitives-cil.json',
  'research/layer-resize-numeric-sizing-cil.json',
  'research/layer-resize-numeric-extra-cil.json',
];
if (fs.existsSync('research/layer-resize-numeric-dependencies-cil.json')) sourceFiles.push('research/layer-resize-numeric-dependencies-cil.json');
const methods = new Map(sourceFiles.flatMap(p => read(p).Types.flatMap(t => t.Methods)).map(m => [m.Token, m]));
const flow = foldFlowFields();
const copy = v => v && typeof v === 'object' && !v.get && !Array.isArray(v) ? structuredClone(v) : v;
const val = v => v?.get ? v.get() : v;
const ref = (array, key) => ({ get: () => array[key], set: v => { array[key] = copy(v); } });
const sig = m => {
  const b = Buffer.from(m.Signature, 'hex'); let p = 0;
  const n = () => { const a = b[p++]; if (a < 128) return a; if (a < 192) return ((a & 63) << 8) | b[p++]; return ((a & 31) * 16777216) + (b[p++] << 16) + (b[p++] << 8) + b[p++]; };
  const flags = n(); if (flags & 16) n(); const count = n(), returns = n() !== 1;
  return { count, instance: !!(flags & 32), returns };
};
const math = new Map([
  [167773368, [2, Math.max]], [167774824, [2, Math.min]], [167774838, [1, Math.abs]],
  [167772266, [1, () => undefined, false]], // Object constructor; no data effect.
  [167775900, [2, (value, flag) => +((value & flag) === flag)]], // Enum.HasFlag
  [100689177, [1, array => array.reduce((a,b)=>b<a?b:a)]], // Bbib min collection adapter, source retained.
  [100689183, [1, array => array.reduce((a,b)=>b>a?b:a)]], // Bbib max collection adapter, source retained.
  [167784878,[1,v=>+Number.isNaN(v)]], [167784567,[1,Math.sin]], [167784568,[1,Math.cos]],
  [167792890,[2,(a,v)=>a.indexOf(v)]], [167792891,[1,a=>a.length]],
  [167792892,[2,(a,i)=>{assert(i>=0&&i<a.length&&Number.isInteger(i));return a[i]}]],
]);
export const coverage = new Map();
export const externalCalls = new Map();
export function replay(token, input, options = {}) {
  let total = 0; const trace = [], states = [];
  const execute = (token, args) => {
    const m = methods.get(token); assert(m, `Missing method ${token}`);
    args = args.map(copy);
    const locals = [], stack = [], indexes = new Map(m.Instructions.map((i, n) => [i.Offset, n]));
    let pc = 0;
    const pop = () => { assert(stack.length, `stack underflow ${token}`); return stack.pop(); };
    const jump = o => { assert(indexes.has(o), `missing offset ${token}:${o}`); pc = indexes.get(o); };
    while (++total < 200000) {
      const i = m.Instructions[pc++]; assert(i, `out of method ${token}`);
      const { Op: op, Operand: a } = i;
      if (!coverage.has(token)) coverage.set(token, new Set());
      coverage.get(token).add(i.Offset); if (options.trace) trace.push([token, i.Offset]);
      const index = prefix => op.endsWith('.s') || op === prefix ? a : Number(op.slice(prefix.length + 1));
      if (op === 'nop') continue;
      if (op.startsWith('ldarga')) stack.push(ref(args, index('ldarga')));
      else if (op.startsWith('ldarg')) stack.push(copy(args[index('ldarg')]));
      else if (op.startsWith('starg')) args[index('starg')] = copy(pop());
      else if (op.startsWith('ldloca')) stack.push(ref(locals, index('ldloca')));
      else if (op.startsWith('ldloc')) stack.push(copy(locals[index('ldloc')]));
      else if (op.startsWith('stloc')) { locals[index('stloc')] = copy(pop()); if (options.states === token) states.push({offset:i.Offset,local:index('stloc'),value:copy(locals[index('stloc')])}); }
      else if (op.startsWith('ldc.i4')) stack.push(op === 'ldc.i4' || op === 'ldc.i4.s' ? a : op === 'ldc.i4.m1' ? -1 : Number(op.slice(7)));
      else if (op === 'ldc.r8' || op === 'ldc.r4') stack.push(a);
      else if (op === 'ldnull') stack.push(null);
      else if (op === 'box' || op === 'unbox.any') { /* primitive enum carrier */ }
      else if (op === 'dup') stack.push(copy(stack.at(-1)));
      else if (op === 'newarr') stack.push(new Array(pop()));
      else if (op === 'stelem.r8') { const v=pop(),i=pop(),array=pop();array[i]=v; }
      else if (op === 'pop') pop();
      else if (op === 'ldsfld') {
        if (a === 67142340) stack.push({ module: true });
        else if (options.staticFields?.has(a)) stack.push(copy(options.staticFields.get(a)));
        else throw Error(`Unknown static field ${a} in ${token}:${i.Offset}`);
      } else if (op === 'ldfld') {
        const obj = val(pop());
        if (obj?.module) { assert(flow.has(a)); stack.push(flow.get(a).value); }
        else { assert(obj && a in obj, `missing field ${a} in ${token}:${i.Offset}`); stack.push(copy(obj[a])); }
      } else if (op === 'stfld') { const v = pop(), r = pop(), obj = val(r) ?? {}; obj[a] = copy(v); if (r?.set) r.set(obj); }
      else if (op === 'ldobj') stack.push(copy(val(pop())));
      else if (op === 'stobj') { const v = pop(), r = pop(); assert(r?.set); r.set(v); }
      else if (op === 'initobj') { const r = pop(); assert(r?.set); r.set({}); }
      else if (['add', 'sub', 'mul', 'div', 'rem', 'and', 'or', 'xor', 'shl', 'shr', 'ceq', 'cgt', 'clt', 'cgt.un', 'clt.un'].includes(op)) {
        const b = pop(), v = pop(); const un = Number.isNaN(v) || Number.isNaN(b);
        stack.push(({ add: () => v + b, sub: () => v - b, mul: () => v * b, div: () => token===100708343&&i.Offset===75?Math.trunc(v/b):v / b, rem: () => v % b,
          and: () => v & b, or: () => v | b, xor: () => v ^ b, shl: () => v << b, shr: () => v >> b,
          ceq: () => +(v === b), cgt: () => +(v > b), clt: () => +(v < b), 'cgt.un': () => +(un || v > b), 'clt.un': () => +(un || v < b) })[op]());
      } else if (op === 'neg') stack.push(-pop());
      else if (op === 'not') stack.push(~pop());
      else if (op === 'conv.r8' || op === 'conv.r4') stack.push(Number(pop()));
      else if (op === 'conv.i4') stack.push(pop() | 0);
      else if (op === 'br' || op === 'br.s') jump(a);
      else if (op === 'brtrue' || op === 'brtrue.s') { if (pop()) jump(a); }
      else if (op === 'brfalse' || op === 'brfalse.s') { if (!pop()) jump(a); }
      else if (/^(beq|bne|bgt|bge|blt|ble)/.test(op)) {
        const b = pop(), v = pop(), un = op.includes('.un') && (Number.isNaN(v) || Number.isNaN(b));
        const yes = op.startsWith('beq') ? v === b : op.startsWith('bne') ? v !== b : op.startsWith('bgt') ? v > b : op.startsWith('bge') ? v >= b : op.startsWith('blt') ? v < b : v <= b;
        if (un || yes) jump(a);
      } else if (op === 'switch') { const v = pop(); if (v >= 0 && v < a.length) jump(a[v]); }
      else if (op === 'call' || op === 'callvirt' || op === 'newobj') {
        const dep = methods.get(a), signature = dep && sig(dep), sink = options.sinks?.get(a) ?? math.get(a);
        if (!dep && !sink) throw Error(`Missing call ${a} ${i.Resolved} from ${token}:${i.Offset}`);
        const count = sink ? sink[0] : signature.count + (op === 'newobj' ? 0 : +signature.instance);
        assert(stack.length >= count, `call stack ${token}:${i.Offset}`);
        const values = stack.splice(stack.length - count, count);
        if (sink) {
          externalCalls.set(a, i.Resolved);
          const output = sink[1](...values.map(val));
          if (sink[2] !== false) stack.push(copy(output));
        } else if (op === 'newobj') {
          const holder = [{}]; execute(a, [ref(holder, 0), ...values]); stack.push(copy(holder[0]));
        } else {
          const result = execute(a, values); if (signature.returns) stack.push(copy(result));
        }
      } else if (op === 'ret') {
        const signature = sig(m);
        assert.equal(stack.length, signature.returns ? 1 : 0, `return stack ${token}`);
        return signature.returns ? copy(pop()) : undefined;
      } else throw Error(`Unimplemented opcode ${op} ${token}:${i.Offset}`);
    }
    throw Error('Instruction budget exceeded');
  };
  return { value: execute(token, input), trace, states, total };
}
export function rect(x, y, width, height) { return replay(100722090, [null,x,y,width,height]); }
export function construct(token, values) { const holder=[{}]; replay(token,[ref(holder,0),...values]); return holder[0]; }
export const makeRect = (x,y,width,height) => construct(100722090,[x,y,width,height]);
export const rectValues = r => Object.fromEntries([['x',100722047],['y',100722049],['width',100722051],['height',100722053]].map(([k,t])=>[k,replay(t,[r]).value]));
export const makePin = (h,v,fw,fh,oldParent,newParent) => construct(100703709,[h,v,+fw,+fh,oldParent,newParent]);
export const runPin = (pin,original,projected,anchor=12,options={}) => {
  const result = replay(100703559,[pin,original,projected,anchor],options);
  return {...result,value:rectValues(result.value)};
};
export const makeVector = (x,y) => construct(100721941,[x,y]);
export const vectorValues = v => ({x:replay(100721934,[v]).value,y:replay(100721936,[v]).value});
export function runProjection(parent, original, delta, anchor, freedom=3, bypass=false, options={}) {
  const out=[undefined];
  const result=replay(100703558,[parent,original,delta,anchor,freedom,ref(out,0),bypass],options);
  return {...result,value:rectValues(result.value),scaledDelta:vectorValues(out[0])};
}
export function geometryOptions(angle=0, extra={}) {
  const point = (x,y)=>({67134717:x,67134718:y});
  return {
    ...extra,
    staticFields:new Map([
      [67134719,point(0,0)], [67134722,point(NaN,NaN)],
      [67120182,NaN], // unused lazy field sentinel; no caller reads it in bounded execution.
      [67129904,[3,2,6,4,12,8,9,1]], // cSqL.cctor100708486 IL0xAB5..0xAF4, source retained separately.
      ...(extra.staticFields??[]),
    ]),
    sinks:new Map([
      [100695380,[1,()=>angle]], // supplied effective widget rotation; provider chain outside this probe.
      [100722000,[3,(c,s,k)=>({c,s,k})]], // affine matrix allocation, captured point-commit CIL formula.
      [100721995,[2,(m,p)=>{const x=p[67134717]-m.c[67134717],y=p[67134718]-m.c[67134718];return point(m.c[67134717]+x*m.k-y*m.s,m.c[67134718]+x*m.s+y*m.k)}]],
      ...(extra.sinks??[]),
    ]),
  };
}
export function runINw2(widgetRect, bbox, delta, parent, anchor, freedom, bypass, orientation, pin, angle=0,extra={}) {
  const options=geometryOptions(angle,extra);
  const result=replay(100703557,[{},widgetRect,bbox,delta,parent,anchor,freedom,+bypass,orientation,pin],options);
  return {...result,value:rectValues(result.value)};
}
export function sizingBounds(r,angle,extra={}) {
  const holder=[{}],options=geometryOptions(angle,extra);
  replay(100722221,[ref(holder,0),r,angle],options);
  return rectValues(replay(100722239,[holder[0]],options).value);
}
export function runAspect(v,r,freedom,orientation,options={}) {
  const holder=[v],result=replay(100721966,[ref(holder,0),r,freedom,orientation],options);
  return {...result,value:vectorValues(holder[0])};
}
