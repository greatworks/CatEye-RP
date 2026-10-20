import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const prefix = 'adaptive-behavior-format-', base = 'research/';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const record = file => ({ file, sha256: hash(file) });
const census = read(base + prefix + 'census.json');
const replay = read(base + prefix + 'remap-replay.json');
const tests = read('.build/adaptive-view-sets-focused.json');
for (const entry of census.samples) assert.equal(hash(entry.file), entry.sha256);
for (const test of replay.cases) assert.deepEqual(test.actual, test.expected);
assert.equal(tests.numFailedTests, 0);
const get = (object, key) => object?.$map?.find(([name]) => name === key)?.[1];
const stateNames = {};
for (const entry of census.stateProperties) {
  for (const [name] of get(entry.entry, 'Value')?.$map ?? []) stateNames[name] = (stateNames[name] ?? 0) + 1;
}
const adaptiveStateEntries = census.adaptiveStyleTargets.filter(entry => (get(entry.target?.properties, 'PropList') ?? []).some(property => (get(property, 'DOAName') & 0x3fffffff) === 21));
const evidence = {
  target: { version: '11.0.0.4150', ...record(read(base + prefix + 'action-cil.json').AssemblyPath) },
  method: 'Static managed metadata/CIL, original corpus read by self-written readers, and bounded decoded CIL replay; no target DLL, application or original generated page executed.',
  samples: census.samples,
  totals: {
    samples: census.samples.length, objects: census.samples.reduce((sum, item) => sum + item.objects, 0),
    adaptiveStyleFields: census.samples.reduce((sum, item) => sum + item.adaptiveStyleFields, 0),
    nonemptyAdaptiveStyles: census.adaptiveStyles.length, resolvedAdaptiveStyleTargets: census.adaptiveStyleTargets.filter(entry => entry.target).length,
    adaptiveStateEntries: adaptiveStateEntries.length, pageRecords: census.pageAssignments.length,
    nonzeroSetIdPages: census.pageAssignments.filter(page => page.setId?.$guid && page.setId.$guid !== '0'.repeat(32)).length,
    nonzeroDirectSetRefs: census.pageAssignments.filter(page => page.setReference?.$reference && page.setReference.$reference !== '0'.repeat(32)).length,
    completeSets: census.sets.length, namedViews: census.sets.reduce((sum, set) => sum + (get(set.properties, 'AdaptiveViews')?.length ?? 0), 0),
    stateProperties: census.stateProperties.length, stateNames, actionsOrLiterals: census.actions.length, adaptivePageEvents: census.adaptivePageEvents.length,
  },
  conclusions: {
    ownership: 'Document owns multiple sets; Page resolves assigned set ID. Widgets keep view-keyed local styles. Masters have a distinct direct-set field branch.',
    matching: ['Base identity', 'exact named identity', 'first exact case-sensitive stored name', 'unmatched unchanged'],
    migration: 'Matched old key moves to target; target overridden properties win. Whole P21 map is atomic. Unmatched keys remain inactive. Base is not in the named assignment loop.',
    baseSentinel: '19e82109-f102-476f-9335-82835c373474', autoSentinel: '982030d6-73df-4586-8f11-149ca2b8b02f',
    stateWriter: 'Eligible P21 emits stateStyles even when empty; each named entry recursively emits an object. Absent/noneligible P21 emits no key.',
    actionStorage: { type: 'Axure:InteractionSetAdaptiveView', guidKey: 'set_adaptive_view_id', autoKey: 'set_adaptive_view_to_auto' },
    actionGenerated: { key: 'setAdaptiveViewTo', auto: 'auto', base: 'default', unresolved: null, named: 'Owning set index encoded radix26 with lowercase alphabet; context view-id dictionary population remains unresolved.' },
    pageEvent: { name: 'OnAdaptiveViewChange', value: 338, fieldToken: 67121749 },
    globalConfiguration: 'cJFt.VJFD 100691574 writes useViews:true at IL373/378/380 on the inspected ordinary configuration writer. GenerateAllAdaptiveViews is a separate generation-range option.',
  },
  validation: { decodedCilReplay: { passed: replay.cases.length, total: replay.cases.length, evidence: record(base + prefix + 'remap-replay.json') },
    model: { passed: tests.numPassedTests, failed: tests.numFailedTests, newCases: tests.testResults.find(suite => suite.name.endsWith('adaptive-view-sets.test.ts')).assertionResults.length, report: record('.build/adaptive-view-sets-focused.json') },
    originalGuiCompared: false, nativeImportExpanded: false },
  unknowns: [
    'Context YNMq population linking generated named-view IDs exactly to ordinal action encoding.',
    'All downstream Page cleanup after deleting a referenced native view set; inspected direct handler only removes and refreshes UI.',
    'Default new-Page assignment and exact adaptive author commit materialization of state maps.',
    'No complete live named adaptive set in the eleven samples; residual map recovery is not implemented.',
    'Full original generated-prototype/GUI equivalence was not tested.',
  ],
  productBoundaries: ['Legacy conversion requires explicit native-size mode.', 'Referenced set removal is refused until reassigned/detached.', 'Independent state-map editing is a documented authoring policy, not proof of native author command behavior.'],
};
fs.writeFileSync(base + prefix + 'evidence.json', JSON.stringify(evidence, null, 2) + '\n');
const priorSources = [...census.sources, ...replay.sources, ...replay.dependencies];
const sources = [...new Set([
  evidence.target.file, 'src/model/adaptive-view-sets.ts', 'tests/adaptive-view-sets.test.ts',
  'research/scripts/inspect-rp-serialization.ps1', 'research/text-autofit-native-literals.mjs',
  ...priorSources.map(item => item.file),
])].filter(file => !file.startsWith(base + prefix)).map(record);
const files = fs.readdirSync(base).filter(file => file.startsWith(prefix) && file !== prefix + 'manifest.json').sort().map(file => record(base + file));
const manifest = { scope: 'This native-format stage only; historical reports preserved.', sources, samples: census.samples.map(({ file, sha256 }) => ({ file, sha256 })), files };
for (const entry of [...sources, ...manifest.samples, ...files]) assert.equal(hash(entry.file), entry.sha256);
fs.writeFileSync(base + prefix + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ ...evidence.totals, hashChecks: sources.length + files.length + manifest.samples.length, sources: sources.length, files: files.length, manifestSha256: hash(base + prefix + 'manifest.json') }, null, 2));
