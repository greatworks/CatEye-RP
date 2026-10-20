import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '../..');
const directory = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/Fonts';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const names = ['ThinItalic', 'LightItalic', 'RegularItalic', 'MediumItalic', 'BoldItalic', 'BlackItalic'];
const faces = names.map(name => {
  const file = path.join(directory, `Roboto-${name}.ttf`), bytes = fs.readFileSync(file), tables = new Map();
  if (bytes.readUInt32BE(0) !== 0x10000) throw Error(`Not a TrueType font: ${name}`);
  for (let index = 0; index < bytes.readUInt16BE(4); index++) {
    const entry = 12 + index * 16, tag = bytes.toString('ascii', entry, entry + 4), offset = bytes.readUInt32BE(entry + 8), length = bytes.readUInt32BE(entry + 12);
    if (offset + length > bytes.length) throw Error(`Table exceeds font: ${name}/${tag}`);
    tables.set(tag, bytes.subarray(offset, offset + length));
  }
  const os2 = tables.get('OS/2'), head = tables.get('head'), post = tables.get('post'), nameTable = tables.get('name'), strings = nameTable.readUInt16BE(4), records = [];
  for (let index = 0; index < nameTable.readUInt16BE(2); index++) {
    const entry = 6 + index * 12, platform = nameTable.readUInt16BE(entry), nameId = nameTable.readUInt16BE(entry + 6), length = nameTable.readUInt16BE(entry + 8), offset = nameTable.readUInt16BE(entry + 10);
    if (![0,1,2,3,4,5,6,8,13,14,16,17].includes(nameId)) continue;
    const raw = Buffer.from(nameTable.subarray(strings + offset, strings + offset + length));
    const value = platform === 0 || platform === 3 ? raw.swap16().toString('utf16le') : raw.toString('latin1');
    if (!records.some(record => record.nameId === nameId && record.value === value)) records.push({ nameId, value });
  }
  const result = { file, bytes: bytes.length, sha256: sha(bytes), nativeWeight: os2.readUInt16BE(4), fsType: os2.readUInt16BE(8), fsSelection: os2.readUInt16BE(62), macStyle: head.readUInt16BE(44), italicAngle: post.readInt32BE(4) / 65536, names: records };
  if (result.fsType !== 0 || !(result.fsSelection & 1) || !(result.macStyle & 2) || result.italicAngle >= 0 || !records.some(record => record.nameId === 13 && record.value.includes('Apache License, Version 2.0'))) throw Error(`Unproven licensed italic face: ${name}`);
  return result;
});
const result = { inspectedAt: new Date().toISOString(), evidenceType: 'Static SFNT bytes; no font or original program execution', distributionSha256: 'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0', extractionEvidenceId: 'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7', faces, limits: ['Original retained font bytes, not a claim of identity to current upstream files.', 'Thin native OS/2 weight is 250; product CSS weight 100 is a separately declared registration.'] };
fs.writeFileSync(path.join(root, 'research/roboto-italic-evidence.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(faces.map(({ file, bytes, sha256, nativeWeight, fsType, fsSelection, macStyle, italicAngle }) => ({ file, bytes, sha256, nativeWeight, fsType, fsSelection, macStyle, italicAngle })), null, 2));
