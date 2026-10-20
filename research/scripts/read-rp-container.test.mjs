import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { decodeLz4Block, readRpContainer } from './read-rp-container.mjs';

function varint(n) { const bytes = []; do { bytes.push((n & 127) | (n >= 128 ? 128 : 0)); n >>>= 7; } while (n); return Buffer.from(bytes); }
function fixture(indexObject = { root: { parts: { example: 0 } } }, data = Buffer.from('example payload'), gzip = true) {
  const json = Buffer.from(JSON.stringify(indexObject));
  const extra = []; if (json.length >= 15) { let n = json.length - 15; while (n >= 255) { extra.push(255); n -= 255; } extra.push(n); }
  const block = Buffer.concat([Buffer.from([Math.min(15, json.length) << 4, ...extra]), json]);
  const index = Buffer.concat([Buffer.from([1]), varint(json.length), varint(block.length), block]);
  const header = Buffer.alloc(8); header.writeUInt16LE(0xefac, 0); header.writeUInt16LE(11, 2); header.writeUInt32LE(index.length, 4);
  const payload = gzip ? gzipSync(data) : data;
  const part = Buffer.alloc(8); part.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, index, part, payload]);
}

test('independent synthetic gzip container produces unchanged payload and indexed boundaries', () => {
  const r = readRpContainer(fixture());
  assert.equal(r.entries.length, 1); assert.equal(r.entries[0].codec, 'gzip');
  assert.equal(r.entries[0].data.toString(), 'example payload');
  assert.equal(r.entries[0].fileOffset, r.bodyStart);
});
test('stored opaque payload is preserved and never interpreted', () => {
  const payload = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  assert.deepEqual(readRpContainer(fixture(undefined, payload, false)).entries[0].data, payload);
});
test('LZ4 overlapping matches are decoded correctly', () => {
  assert.equal(decodeLz4Block(Buffer.from([0x14, 0x61, 1, 0, 0x10, 0x62]), 10).toString(), 'aaaaaaaaab');
});
test('LZ4 rejects truncated input, impossible matches, incorrect output size, and oversized allocation', () => {
  for (const [bytes, size] of [[[0xf0], 15], [[0x00, 0, 0], 4], [[0x00, 1, 0], 4], [[0x10, 65], 2]]) {
    assert.throws(() => decodeLz4Block(Buffer.from(bytes), size), /invalid RP container/);
  }
  assert.throws(() => decodeLz4Block(Buffer.from([0]), 9 * 1024 * 1024), /output limit/);
});
test('rejects unsupported file version and encoding', () => {
  const b = fixture(); b.writeUInt16LE(10, 2); assert.throws(() => readRpContainer(b), /magic\/version/);
  const c = fixture(); c[8] = 2; assert.throws(() => readRpContainer(c), /index encoding/);
});
test('rejects truncation and unexpected extra bytes', () => {
  const b = fixture(); assert.throws(() => readRpContainer(b.subarray(0, b.length - 1)), /part length/);
  assert.throws(() => readRpContainer(Buffer.concat([b, Buffer.from([0])])), /part length/);
});
test('rejects gzip checksum corruption', () => {
  const b = fixture(); b[b.length - 8] ^= 0xff; assert.throws(() => readRpContainer(b), /gzip integrity/);
});
test('enforces gzip and total decoded byte budgets', () => {
  const b = fixture(undefined, Buffer.alloc(1000));
  assert.throws(() => readRpContainer(b, { partBytes: 100 }), /gzip integrity\/size/);
  assert.throws(() => readRpContainer(b, { totalBytes: 100 }), /gzip integrity\/size/);
});
test('rejects malicious or unsupported index offsets, overlapping entries and excessive depth', () => {
  for (const offset of [-1, 0.5, 10000000, '0']) assert.throws(() => readRpContainer(fixture({ root: { parts: { a: offset } } })), /invalid RP container/);
  assert.throws(() => readRpContainer(fixture({ root: { parts: { a: 0, b: 0 } } })), /overlapping/);
  assert.throws(() => readRpContainer(fixture({ root: { children: { a: { parts: { b: 0 } } } } }), { depth: 0 }), /depth/);
});
test('rejects unknown part flags and index lengths', () => {
  const b = fixture(); b.writeUInt32LE(1, 8 + b.readUInt32LE(4)); assert.throws(() => readRpContainer(b), /part flags/);
  const c = fixture(); c.writeUInt32LE(0xffffffff, 4); assert.throws(() => readRpContainer(c), /index bounds/);
});
for (const [name, digest, parts, version] of [
  ['the-basics-tab-menu.rp', '0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4', 11, '11.0.0.4127.version'],
  ['complex-interactions-required-fields.rp', '0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c', 11, '11.0.0.4122.version'],
  ['Default.rplib', '9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50', 128, '11.0.0.4112.version'],
]) test(`official sample ${name} retains its source hash and all indexed parts decode`, () => {
  const bytes = readFileSync(new URL(`../samples/${name}`, import.meta.url));
  const r = readRpContainer(bytes);
  assert.equal(r.fileSha256, digest); assert.equal(r.entries.length, parts);
  assert.ok(r.entries.find(e => e.path === version)?.data.toString().includes('<BreakingChanges>'));
  assert.ok(r.entries.find(e => e.path === 'DesignDocument')?.data.includes(Buffer.from('Axure:DesignDocument')));
  assert.equal(r.entries.at(-1).fileOffset + 8 + r.entries.at(-1).compressedBytes, bytes.length);
});
