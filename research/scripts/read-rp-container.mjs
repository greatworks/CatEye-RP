/** Research-only reader for the observed RP 11 container. Does not deserialize Axure objects. */
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const LIMITS = Object.freeze({ fileBytes: 128 * 1024 * 1024, indexBytes: 8 * 1024 * 1024,
  partBytes: 32 * 1024 * 1024, totalBytes: 256 * 1024 * 1024, entries: 10000, depth: 64 });
const fail = (message) => { throw new Error(`Unsupported or invalid RP container: ${message}`); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function decodeLz4Block(source, expectedSize, maxSize = LIMITS.indexBytes) {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > maxSize) fail('LZ4 output limit');
  const output = Buffer.alloc(expectedSize);
  let input = 0, written = 0;
  const length = (n) => {
    if (n === 15) {
      let next;
      do { if (input >= source.length) fail('truncated LZ4 length'); next = source[input++]; n += next; } while (next === 255);
    }
    return n;
  };
  while (input < source.length) {
    const token = source[input++];
    const literals = length(token >>> 4);
    if (input + literals > source.length || written + literals > output.length) fail('LZ4 literal bounds');
    source.copy(output, written, input, input + literals);
    input += literals; written += literals;
    if (input === source.length) break;
    if (input + 2 > source.length) fail('truncated LZ4 match');
    const distance = source.readUInt16LE(input); input += 2;
    const match = length(token & 15) + 4;
    if (distance === 0 || distance > written || written + match > output.length) fail('LZ4 match bounds');
    for (let j = 0; j < match; j++) output[written + j] = output[written + j - distance];
    written += match;
  }
  if (written !== expectedSize) fail('LZ4 output size mismatch');
  return output;
}

function varint(bytes, position) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    if (position >= bytes.length) fail('truncated index varint');
    const octet = bytes[position++];
    value += (octet & 127) * (2 ** (i * 7));
    if ((octet & 128) === 0) return { value, position };
  }
  fail('index varint exceeds supported range');
}

export function readRpContainer(bytes, overrides = {}) {
  const limits = { ...LIMITS, ...overrides };
  if (!Buffer.isBuffer(bytes) || bytes.length < 14 || bytes.length > limits.fileBytes) fail('file size');
  if (bytes.readUInt16LE(0) !== 0xefac || bytes.readUInt16LE(2) !== 11) fail('magic/version (only observed version 11 supported)');
  const indexLength = bytes.readUInt32LE(4);
  if (indexLength < 4 || indexLength > limits.indexBytes || 8 + indexLength > bytes.length) fail('index bounds');
  const packedIndex = bytes.subarray(8, 8 + indexLength);
  if (packedIndex[0] !== 1) fail('unknown index encoding');
  const unpacked = varint(packedIndex, 1);
  const packed = varint(packedIndex, unpacked.position);
  if (packed.position + packed.value !== packedIndex.length) fail('index packed length mismatch');
  const indexBytes = decodeLz4Block(packedIndex.subarray(packed.position), unpacked.value, limits.indexBytes);
  let index;
  try { index = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(indexBytes)); }
  catch { fail('index is not valid UTF-8 JSON'); }
  const entries = [];
  const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
  function visit(node, segments, depth) {
    if (depth > limits.depth || !object(node)) fail('index tree/depth');
    if (node.parts !== undefined) {
      if (!object(node.parts)) fail('parts table');
      for (const [name, offset] of Object.entries(node.parts)) {
        if (entries.length >= limits.entries) fail('entry count');
        if (!Number.isSafeInteger(offset) || offset < 0) fail('part offset');
        entries.push({ path: [...segments, name].join('/'), offset });
      }
    }
    if (node.children !== undefined) {
      if (!object(node.children)) fail('children table');
      for (const [name, child] of Object.entries(node.children)) visit(child, [...segments, name], depth + 1);
    }
  }
  if (!object(index) || !Object.hasOwn(index, 'root')) fail('root missing');
  visit(index.root, [], 0);
  if (entries.length === 0) fail('empty part index');
  entries.sort((a, b) => a.offset - b.offset);
  const bodyStart = 8 + indexLength;
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const start = bodyStart + entry.offset;
    const end = i + 1 < entries.length ? bodyStart + entries[i + 1].offset : bytes.length;
    if (start + 8 > end || end > bytes.length) fail('part header bounds or overlapping offset');
    const flags = bytes.readUInt32LE(start), length = bytes.readUInt32LE(start + 4);
    if (flags !== 0) fail(`unknown part flags at ${entry.offset}`);
    if (start + 8 + length !== end) fail(`part length mismatch at ${entry.offset}`);
    const compressed = bytes.subarray(start + 8, end);
    const budget = Math.min(limits.partBytes, limits.totalBytes - total);
    if (budget < 1) fail('total decompression limit');
    // Observed containers mix gzip object packages and directly stored widgetinfo/JPEG parts.
    // Codec detection is evidence-bound; unknown stored bytes remain opaque, never executed.
    const codec = compressed[0] === 0x1f && compressed[1] === 0x8b ? 'gzip' : 'stored-opaque';
    let data = compressed;
    if (codec === 'gzip') {
      try { data = gunzipSync(compressed, { maxOutputLength: budget }); }
      catch { fail(`gzip integrity/size at ${entry.offset}`); }
    } else if (data.length > budget) fail('stored part size limit');
    total += data.length;
    Object.assign(entry, { fileOffset: start, codec, compressedBytes: length, decodedBytes: data.length, sha256: sha256(data), data });
  }
  return { format: 'observed-rp11-container', fileBytes: bytes.length, fileSha256: sha256(bytes),
    indexLength, indexDecodedBytes: indexBytes.length, bodyStart, decodedTotalBytes: total, index, entries };
}

export function inspectRpFile(filePath) {
  if (statSync(filePath).size > LIMITS.fileBytes) fail('file size limit');
  return readRpContainer(readFileSync(filePath));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) { process.stderr.write('Usage: node research/scripts/read-rp-container.mjs <file.rp|file.rplib>\n'); process.exitCode = 2; }
  else {
    try {
      const result = inspectRpFile(process.argv[2]);
      console.log(JSON.stringify({ ...result, entries: result.entries.map(({ data, ...entry }) => ({ ...entry,
        signature: data.subarray(0, 32).toString('hex'), axureTypeStrings: [...new Set(data.toString('latin1').match(/Axure:[A-Za-z0-9:_]+/g) ?? [])] })) }, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
