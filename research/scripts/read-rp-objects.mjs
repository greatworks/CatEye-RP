/** Evidence-bound research parser. See axure-file-format.md and serialization-cil.json. */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { inspectRpFile } from './read-rp-container.mjs';

export function readObjectPackage(buffer) {
  const limits = { bytes: 32 * 1024 * 1024, entries: 200000, depth: 64, strings: 100000 };
  if (!Buffer.isBuffer(buffer) || buffer.length > limits.bytes) throw new Error('Object package byte limit');
  let position = 0, nodes = 0;
  const error = message => { throw new Error(`${message} at decoded offset ${position}`); };
  const take = count => { if (!Number.isSafeInteger(count) || count < 0 || position + count > buffer.length) error('Out-of-bounds object read'); const result = buffer.subarray(position, position + count); position += count; return result; };
  const i32 = () => take(4).readInt32LE();
  const expect = expected => { const actual = i32(); if (actual !== expected) error(`Expected token ${expected}, received ${actual}`); };
  const count = max => { const result = i32(); if (result < 0 || result > max) error('Collection count limit'); return result; };
  const guidString = data => `${data.readUInt32LE(0).toString(16).padStart(8, '0')}${data.readUInt16LE(4).toString(16).padStart(4, '0')}${data.readUInt16LE(6).toString(16).padStart(4, '0')}${data.subarray(8).toString('hex')}`;
  expect(27);
  const version = Array.from({ length: 4 }, i32);
  if (!['9.0.0.0', '9.0.1.0', '10.0.1.0', '10.0.3.0', '10.0.4.0', '11.0.0.0'].includes(version.join('.'))) error(`Unsupported object version ${version.join('.')}`);
  const schema = i32(); if (schema !== 50001) error(`Unsupported object schema ${schema}`);
  expect(31); const stringCount = count(limits.strings), strings = [null], stringOffsets = [];
  for (let i = 0; i < stringCount; i++) { const length = count(limits.bytes); const offset = position; const data = take(length); let value; try { value = new TextDecoder('utf-8', { fatal: true }).decode(data); } catch { error('Invalid UTF-8'); } strings.push(value); stringOffsets.push({ index: i + 1, offset, bytes: length }); }
  expect(30); const guidCount = count(limits.entries), guids = ['00000000000000000000000000000000'];
  for (let i = 0; i < guidCount; i++) guids.push(guidString(take(16)));
  const reference = (table, label) => { const index = i32(); if (index < 0 || index >= table.length) error(`Invalid ${label} index ${index}`); return table[index]; };
  const str = () => reference(strings, 'string'), guid = () => reference(guids, 'GUID');
  const statistics = {};
  const value = (depth = 0) => {
    if (depth > limits.depth || ++nodes > limits.entries) error('Object nesting/node limit');
    const offset = position, rawTag = i32(), tag = rawTag & 31;
    statistics[tag] = (statistics[tag] || 0) + 1;
    switch (tag) {
      case 1: { const pairs = count(limits.entries), entries = []; for (let i = 0; i < pairs; i++) entries.push([value(depth + 1), value(depth + 1)]); return { $map: entries }; }
      case 2: { const n = count(limits.entries), items = []; for (let i = 0; i < n; i++) items.push(value(depth + 1)); return items; }
      case 3: case 20: case 21: case 22: return { $reference: guid(), referenceTag: tag };
      case 4: { const length = count(limits.bytes), bytes = take(length); return { $bytes: { offset: position - length, length, sha256: createHash('sha256').update(bytes).digest('hex') } }; }
      case 5: return i32();
      case 6: case 7: { const n = tag === 6 ? take(8).readDoubleLE() : take(4).readFloatLE(); return Number.isFinite(n) ? n : { $number: String(n), numberTag: tag }; }
      case 8: return str();
      case 16: case 19: { const name = str(); return { $reference: guid(), referenceTag: tag, name }; }
      case 17: return { $guid: guid() };
      case 23: { const name = str(); const properties = value(depth + 1); if (!properties?.$map) error('Expected structured named value'); return { $namedValue: name, properties }; }
      case 24: { const prefix = str(), name = str(), properties = value(depth + 1); if (!properties?.$map) error('Expected structured plugin value'); return { $pluginValue: name, prefix, properties }; }
      case 25: { const b = take(1)[0]; if (b > 1) error('Invalid boolean'); return Boolean(b); }
      case 29: return { $int64: take(8).readBigInt64LE().toString() };
      default: error(`Unsupported value tag ${tag} (raw ${rawTag}, starts ${offset})`);
    }
  };
  const dataStart = position;
  const rootTag = i32();
  if (rootTag !== 26) {
    position -= 4; const rootValue = value();
    expect(28);
    if (position !== buffer.length) error('Trailing bytes after standalone value');
    return { status: 'decoded-observed-object-structure', version, schema, decodedBytes: buffer.length, stringCount, guidCount, strings, stringOffsets, dataStart, rootValue, objects: [], valueTags: statistics, trailingBytes: 0 };
  }
  expect(15); const rootId = guid(); expect(18); const packageId = guid();
  const objects = []; let next = i32();
  while (next === 9) {
    if (objects.length >= limits.entries) error('Object count limit');
    const offset = position - 4, id = guid(), type = str();
    const properties = value(); if (!properties?.$map) error('Object has no property map');
    objects.push({ id, type, offset, properties }); next = i32();
  }
  if (next !== 28) error(`Unsupported object-stream termination ${next}`);
  if (position !== buffer.length) error('Trailing bytes after object stream');
  return { status: 'decoded-observed-object-structure', version, schema, decodedBytes: buffer.length, rootId, packageId, stringCount, guidCount, strings, stringOffsets, dataStart, objects, valueTags: statistics, trailingBytes: 0 };
}

export function inspectRpObjects(file) {
  const container = inspectRpFile(file);
  return { file, fileSha256: container.fileSha256, packages: container.entries.filter(e => e.data.length >= 4 && e.data.readUInt32LE(0) === 27).map(entry => {
    try { return { path: entry.path, sha256: entry.sha256, ...readObjectPackage(entry.data) }; }
    catch (error) { return { path: entry.path, sha256: entry.sha256, status: 'unsupported', reason: error.message }; }
  }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) { console.error('Usage: node read-rp-objects.mjs <file.rp|file.rplib>'); process.exitCode = 2; }
  else { try { console.log(JSON.stringify(inspectRpObjects(process.argv[2]), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
}
