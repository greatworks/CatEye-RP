// Additional bounded source transactions for the property adapter. Uses the
// retained-CIL interpreter with explicit geometry/font/provider sinks; no DLL.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { api, sourceFiles } from './selection-author-properties-replay.mjs';
const inputs = [
  { name: 'P94 preflight ignores all three base gates', input: { keys: [94], buttonSize: 150, guarded: true, notify: false, suppressStyleLayout: true } },
  { name: 'P94 request then effective fit and padding', input: { keys: [94], buttonSize: 150, guarded: true, widthFit: true, padding: [2, 7, 3, 5], notify: false } },
  { name: 'P94 ordinary full refresh', input: { keys: [94], buttonSize: 150 } },
  { name: 'P94 preflight remains active with notify false', input: { keys: [94], buttonSize: 150, notify: false } },
  { name: 'P94 measurement failure follows partial size write', input: { keys: [94], buttonSize: 150, notify: false, throwAtMeasure: 0 } },
  { name: 'Distinct forced and outer refresh graphics', input: { keys: [2], widthFit: true, heightFit: true, measurements: [{ width: 60.4, height: 15.4 }, { width: 70.5, height: 18.5 }, { width: 80.5, height: 21.5 }] } },
  { name: 'Outer refresh error after first size commit', input: { keys: [2], throwAtMeasure: 1 } },
  { name: 'Duplicate Location keys are not singleton gate', input: { keys: [101, 101] } },
];
const cases = inputs.map(({ name, input }) => {
  const fullInput = { entry: 'selectionStyleChanged', ...input };
  return { name, input: fullInput, actual: api.transaction(fullInput) };
});
const sources = [...new Set(['research/selection-author-properties-replay.mjs', ...sourceFiles])]
  .map(path => ({ path, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex') }));
const output = { kind: 'retained-CIL-record execution; explicit graphics, union and provider sinks',
  originalDllExecuted: false, originalGuiCompared: false, cases, sources };
fs.writeFileSync('research/selection-properties-model-source-fixtures.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ cases: cases.length, errors: cases.filter(row => row.actual.error).map(row => ({ name: row.name, error: row.actual.error })) }));
