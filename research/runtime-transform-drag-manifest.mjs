import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [
  'runtime-transform-drag-probe.mjs',
  'runtime-transform-drag-first-probe.mjs',
  'runtime-transform-drag-expanded-probe.mjs',
  'runtime-transform-drag-first-probes.json',
  'runtime-transform-drag-expanded-probes.json',
  'runtime-transform-drag-final-probes.json',
  'runtime-transform-drag-evidence.md',
  'runtime-transform-drag-manifest.mjs',
].map(name => `research/${name}`);
const report = JSON.parse(fs.readFileSync(path.join(root, files[5]), 'utf8'));
assert.deepEqual(report.summary, { total: 52, passed: 52, failed: 0 });
for (const source of report.sources) assert.equal(hash(fs.readFileSync(source.path)), source.sha256, source.path);
for (const [output, script] of [[files[3], files[1]], [files[4], files[2]], [files[5], files[0]]]) {
  const entry = JSON.parse(fs.readFileSync(path.join(root, output), 'utf8'));
  assert.equal(hash(fs.readFileSync(path.join(root, script))), entry.script.sha256, script);
}
for (const range of report.ranges) {
  const source = report.sources.find(item => path.basename(item.path) === range.file);
  const slice = fs.readFileSync(source.path, 'utf8').split(/\r?\n/).slice(range.from - 1, range.through).join('\n');
  assert.equal(hash(slice), range.sha256, `${range.file}:${range.from}`);
}
const artifacts = files.map(file => {
  const bytes = fs.readFileSync(path.join(root, file));
  return { path: file, sha256: hash(bytes), bytes: bytes.length };
});
const output = path.join(root, 'research/runtime-transform-drag-manifest.json');
assert.ok(!fs.existsSync(output), 'Manifest already exists; preserve frozen evidence');
fs.writeFileSync(output, JSON.stringify({ schema: 1, capturedAt: new Date().toISOString(), classification: 'original JavaScript with explicit facades; no original GUI or DLL execution', summary: report.summary, sources: report.sources, slices: report.ranges, artifacts, verified: true }, null, 2) + '\n');
console.log(JSON.stringify({ output, summary: report.summary, verifiedArtifacts: artifacts.length, verifiedSources: report.sources.length, verifiedSlices: report.ranges.length }));
