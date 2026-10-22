import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const sha = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const result = JSON.parse(fs.readFileSync('research/selection-pointer-solver-review.json', 'utf8'));
for (const source of result.sources) assert.equal(sha(source.path), source.sha256, source.path);
assert.deepEqual(result.summary, {total:12, passed:12, failed:0, frames:36});
assert.equal(sha('research/selection-pointer-manifest.json'), '48817f74752559816d8b6d1072d2041fd4a715a6bab148079a835b08e75c805d');
const files = [...new Set([...result.sources.map(source => source.path),
  'research/selection-pointer-solver-review.json',
  'research/selection-pointer-solver-review.md',
  'research/selection-pointer-solver-review-initial-run.json',
  'research/selection-pointer-solver-review-freeze.mjs',
  'research/selection-pointer-evidence.md',
  'research/selection-pointer-evidence.json',
])].sort();
const output = {
  kind:'Independent bounded selection pointer pure-model review manifest',
  summary:result.summary,
  productChanged:false,
  originalDllExecuted:false,
  originalGuiCompared:false,
  findings:[],
  sources:files.map(path => ({path, sha256:sha(path)})),
};
fs.writeFileSync('research/selection-pointer-solver-review-manifest.json', JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({files:files.length,summary:output.summary,
  sha256:sha('research/selection-pointer-solver-review-manifest.json')}));
