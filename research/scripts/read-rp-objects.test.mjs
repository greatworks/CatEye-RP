import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readObjectPackage, inspectRpObjects } from './read-rp-objects.mjs';
import { inspectRpSemantics, property, recoverPlainText, recoverRpSemantics } from './read-rp-semantics.mjs';

const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const f64 = n => { const b = Buffer.alloc(8); b.writeDoubleLE(n); return b; };
const cat = (...b) => Buffer.concat(b);
const valInt = n => cat(i32(5), i32(n));
const valString = n => cat(i32(8), i32(n));
const map = entries => cat(i32(1), i32(entries.length), ...entries.flat());
const header = (strings = [], guids = []) => cat(...[27, 11, 0, 0, 0, 50001, 31, strings.length].map(i32), ...strings.map(s => { const b = Buffer.from(s); return cat(i32(b.length), b); }), i32(30), i32(guids.length), ...guids);
const standalone = (v, strings) => cat(header(strings), v, i32(28));
const fixturePath = name => fileURLToPath(new URL(`../samples/${name}`, import.meta.url));
const dataMap = pairs => ({ $map: pairs });

test('independent stream exercises one-based pools, .NET GUID byte order, object links and null indexes', () => {
  const b = cat(header(['Axure:Example', 'text', 'hello'], [Buffer.from('78563412bc9af0de1234567890abcdef', 'hex')]), ...[26,15,1,18,1,9,1,1].map(i32), map([[valString(2),valString(3)], [valString(0),cat(i32(3),i32(0))]]), i32(28));
  const p = readObjectPackage(b);
  assert.equal(p.rootId, '123456789abcdef01234567890abcdef');
  assert.equal(p.objects[0].type, 'Axure:Example');
  assert.equal(property(p.objects[0].properties,'text'),'hello');
  assert.equal(p.objects[0].properties.$map[1][0],null);
  assert.equal(p.objects[0].properties.$map[1][1].$reference,'0'.repeat(32));
});

test('primitive values preserve non-finite numbers and signed 64-bit precision without execution', () => {
  const long = Buffer.alloc(8); long.writeBigInt64LE(9223372036854775807n);
  const b = standalone(cat(i32(2),i32(4),i32(6),f64(Infinity),i32(29),long,i32(25),Buffer.from([1]),i32(4),i32(3),Buffer.from('abc')));
  const p = readObjectPackage(b);
  assert.deepEqual(p.rootValue[0],{$number:'Infinity',numberTag:6});
  assert.equal(p.rootValue[1].$int64,'9223372036854775807');
  assert.equal(p.rootValue[2],true);
  assert.equal(p.rootValue[3].$bytes.sha256,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('untrusted map keys remain inert and duplicate keys are not silently collapsed', () => {
  const p = readObjectPackage(standalone(map([[valString(1),valInt(1)],[valString(1),valInt(2)]]),['__proto__']));
  assert.equal(p.rootValue.$map.length,2);
  assert.equal({}.polluted,undefined);
  assert.throws(()=>property(p.rootValue,'__proto__'),/duplicate/);
});

test('every truncated position, extra byte and wrong end marker is rejected', () => {
  const b = standalone(map([[valString(1),valInt(42)]]),['answer']);
  for(let n=0;n<b.length;n++) assert.throws(()=>readObjectPackage(b.subarray(0,n)));
  assert.throws(()=>readObjectPackage(cat(b,Buffer.from([0]))),/Trailing/);
  const wrong=Buffer.from(b);wrong.writeInt32LE(14,wrong.length-4);
  assert.throws(()=>readObjectPackage(wrong),/Expected token 28/);
});

test('unknown version, schema, tag, invalid references and UTF-8 fail closed', () => {
  const b=standalone(valInt(1));
  for(const [offset,value,pattern] of [[4,12,/version/],[20,50002,/schema/]]){const c=Buffer.from(b);c.writeInt32LE(value,offset);assert.throws(()=>readObjectPackage(c),pattern);}
  assert.throws(()=>readObjectPackage(standalone(i32(0))),/Unsupported value tag/);
  assert.throws(()=>readObjectPackage(standalone(valString(1))),/string index/);
  assert.throws(()=>readObjectPackage(standalone(cat(i32(3),i32(1)))),/GUID index/);
  assert.throws(()=>readObjectPackage(standalone(cat(i32(25),Buffer.from([2])))),/boolean/);
  const invalid=standalone(valInt(1),['x']); invalid[36]=255;
  assert.throws(()=>readObjectPackage(invalid),/UTF-8/);
});

test('collection, byte and recursion budgets prevent unbounded reads', () => {
  assert.throws(()=>readObjectPackage(standalone(cat(i32(2),i32(200001)))),/count limit/);
  assert.throws(()=>readObjectPackage(standalone(cat(i32(4),i32(33554433)))),/count limit/);
  let value=valInt(1);for(let i=0;i<66;i++)value=cat(i32(2),i32(1),value);
  assert.throws(()=>readObjectPackage(standalone(value)),/nesting/);
});

test('metadata evidence gives exact geometry enum constants and name mask', () => {
  const constants=name=>new Map(JSON.parse(readFileSync(fixturePath(`metadata-${name}.json`))).Types[0].Fields.filter(f=>f.Constant).map(f=>[f.Name,Buffer.from(f.Constant,'hex').readUInt32LE()]));
  assert.equal(constants('PName').get('LOCATION'),101);assert.equal(constants('PName').get('SIZE'),105);
  assert.equal(constants('DOAName').get('NAME'),0x0fffffff);
  assert.equal(constants('DOAName').get('DETERMINED'),0x80000000);
  assert.equal(constants('DOAName').get('OVERRIDDEN'),0x40000000);
});

for(const [name,hash,parts,objects] of [
  ['the-basics-tab-menu.rp','0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4',9,123],
  ['complex-interactions-required-fields.rp','0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c',8,137],
  ['Default.rplib','9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50',87,870],
])test(`official fixed-hash ${name} consumes every object part with no trailing bytes`,()=>{
  const r=inspectRpObjects(fixturePath(name));assert.equal(r.fileSha256,hash);assert.equal(r.packages.length,parts);
  assert.ok(r.packages.every(p=>p.status==='decoded-observed-object-structure' && p.trailingBytes===0));
  assert.equal(r.packages.reduce((n,p)=>n+p.objects.length,0),objects);
});

test('Tab menu recovery distinguishes explicit coordinates from absent and computed layout',()=>{
  const r=inspectRpSemantics(fixturePath('the-basics-tab-menu.rp'));assert.equal(r.semanticFailures.length,0);
  const page=r.diagrams.find(d=>d.name==='Page 1');assert.ok(page);
  assert.deepEqual(page.widgets.slice(0,2).map(w=>[w.text.text,w.storedGeometry.location.value,w.storedGeometry.size.value]),[
    ['Tab 1',{X:50,Y:50},{Width:140,Height:40}],['Tab 2',{X:190,Y:50},{Width:140,Height:40}],
  ]);
  const panel=page.widgets[2];assert.equal(panel.storedFlags['fit-to-content'],true);
  // Curved corners are matched to their stored control points, not guessed from Shape=0 alone.
  assert.deepEqual(page.widgets[0].typeCandidate.cornerRadii,[5,5,0,0]);
  assert.equal(r.diagrams.find(d=>d.name==='State1').widgets[0].typeCandidate.type,'box');
  assert.deepEqual(panel.storedGeometry.size.value,{Width:10,Height:10});assert.equal(panel.storedGeometry.isComputedLayout,false);
  assert.equal(r.diagrams.find(d=>d.name==='State1').widgets[0].storedGeometry.location,null);
  assert.equal(r.diagrams.find(d=>d.name==='State1').widgets[0].text.text,'Tab 1 Content');
  assert.deepEqual(panel.panelStatePackages.map(x=>x.$reference),['23eeb8170eeb46959589f1496236e76b','cd27998bdbb547138fc87312c1037656']);
});

test('second official document recovers two page names, empty form values and instructional text',()=>{
  const r=inspectRpSemantics(fixturePath('complex-interactions-required-fields.rp'));
  assert.deepEqual(r.diagrams.map(d=>d.name),['Page 1','Page 2']);
  const email=r.diagrams[0].widgets[1];assert.equal(email.label,'Email Field');assert.deepEqual(email.text,{status:'stored-plain-text',text:''});
  assert.equal(email.typeCandidate.type,'input');assert.equal(email.typeCandidate.inputType,'text');
  assert.equal(r.diagrams[0].widgets[3].typeCandidate.type,'input');assert.equal(r.diagrams[0].widgets[3].typeCandidate.inputType,'password');
  assert.deepEqual(email.storedGeometry.location.value,{X:50,Y:75});assert.deepEqual(email.storedGeometry.size.value,{Width:300,Height:25});
  assert.equal(r.diagrams[1].widgets[0].text.text,'Thank you for signing up!');
});

test('unknown rich-text inline is reported without fabricating its display text',()=>{
  const inline=dataMap([['Type','Unobserved:Inline'],['Text','guess']]);
  const input=dataMap([['RichTextBlock',dataMap([['attributed-string',dataMap([['Paragraphs',[dataMap([['Inlines',[inline]]])]]])]])]]);
  assert.equal(recoverPlainText(input).status,'unsupported-rich-text-inline');assert.equal(recoverPlainText(input).text,undefined);
});

test('duplicate object identities and parser failures remain visible to a potential importer',()=>{
  const r=recoverRpSemantics({fileSha256:'example',packages:[{path:'bad',status:'unsupported',reason:'unknown tag'},{path:'ambiguous',objects:[{id:'a'},{id:'a'}]}]});
  assert.equal(r.packageFailures.length,1);assert.match(r.semanticFailures[0].reason,/Duplicate object ID/);assert.equal(r.diagrams.length,0);
});
