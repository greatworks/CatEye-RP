import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = ['runtime-transform-expression-first-probe.mjs', 'runtime-transform-expression-first-probes.json', 'runtime-transform-expression-probe.mjs', 'runtime-transform-expression-final-probes.json', 'runtime-transform-expression-properties-probe.mjs', 'runtime-transform-expression-properties-probes.json', 'runtime-transform-expression-evidence.md', 'runtime-transform-expression-manifest.mjs'];
const reports = [1,3,5].map(index => JSON.parse(fs.readFileSync(path.join(root, 'research', files[index]), 'utf8')));
for (let i = 0; i < reports.length; i++) assert.equal(hash(fs.readFileSync(path.join(root, 'research', files[i*2]))), reports[i].script.sha256, files[i*2]);
assert.deepEqual(reports.map(report => report.summary), [{total:35,passed:33,failed:2},{total:36,passed:36,failed:0},{total:15,passed:15,failed:0}]);
const sources = [...new Map(reports.flatMap(report => report.sources).map(entry => [entry.path, entry])).values()];
for (const entry of sources) assert.equal(hash(fs.readFileSync(entry.path)), entry.sha256, entry.path);
const slices = [...new Map(reports.flatMap(report => report.ranges).map(entry => [`${entry.file}:${entry.from}-${entry.through}`, entry])).values()];
for (const entry of slices) {
  const original = sources.find(source => path.basename(source.path) === entry.file);
  const slice = fs.readFileSync(original.path, 'utf8').split(/\r?\n/).slice(entry.from-1, entry.through).join('\n');
  assert.equal(hash(slice), entry.sha256, entry.file);
}
const artifacts = files.map(name => { const bytes = fs.readFileSync(path.join(root, 'research', name)); return { path: `research/${name}`, sha256: hash(bytes), bytes: bytes.length }; });
const output = path.join(root, 'research/runtime-transform-expression-manifest.json');
assert.ok(!fs.existsSync(output), 'Preserve frozen evidence; manifest already exists');
fs.writeFileSync(output, JSON.stringify({schema:1,capturedAt:new Date().toISOString(),sources,slices,artifacts,summary:{finalTotal:51,finalPassed:51,finalFailed:0,preservedFirstRun:{total:35,passed:33,failed:2}},verified:true,originalDllExecuted:false,originalAxureGuiCompared:false}, null, 2)+'\n');
console.log(JSON.stringify({output,finalPassed:51,artifacts:artifacts.length,sources:sources.length,slices:slices.length}));
