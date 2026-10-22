// Confirm the additional fixtures after the source research expanded from its
// first 43 cases. Preserve the earlier fixture and its historical source pins.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { api, sourceFiles } from './selection-author-properties-replay.mjs';
const priorPath = 'research/selection-properties-model-source-fixtures.json';
const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
const cases = prior.cases.map(row => {
  const actual = JSON.parse(JSON.stringify(api.transaction(row.input)));
  let error;
  try { assert.deepEqual(actual, row.actual); } catch (caught) { error = caught.message; }
  return { name: row.name, input: row.input, actual, passed: !error, ...(error ? { error } : {}) };
});
const sources = [...new Set([priorPath, 'research/selection-author-properties-replay.mjs', ...sourceFiles])]
  .map(path => ({ path, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex') }));
const output = { kind: 'retained-CIL-record fixture confirmation; no product execution',
  originalDllExecuted: false, originalGuiCompared: false, passed: cases.filter(row => row.passed).length,
  total: cases.length, cases, sources };
fs.writeFileSync('research/selection-properties-model-source-confirmation.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ passed: output.passed, total: output.total }));
if (output.passed !== output.total) process.exitCode = 1;
