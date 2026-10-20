import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';
import type { AdaptiveWidgetOverride } from '../src/model/types';

type NativeProperty = { key: number; value: unknown; flags?: number };
type MatrixCase = {
  name: string;
  properties: NativeProperty[];
  states?: { name: string; properties: NativeProperty[] }[];
  paragraphLineSpacing?: number;
  expected?: AdaptiveWidgetOverride;
  rejection?: RegExp;
};
const map = (values: Record<string, unknown>) => ({ $map: Object.entries(values) });
const solid = (color: number) => map({ 'fill-type': 'solid', 'fill-color': color });
const property = (key: number, value: unknown, flags?: number): NativeProperty => ({ key, value, ...(flags === undefined ? {} : { flags }) });
const style = (name: string, properties: NativeProperty[], expected: AdaptiveWidgetOverride['style']): MatrixCase => ({ name, properties, expected: { style: expected } });
// The expected colors, geometry and enum names below are literal, independent
// test oracles. Neither the reader output nor its conversion helpers supply them.
const stops = [
  { offset: 0, color: '#ff0000' }, { offset: .5, color: '#00ff0040' },
  { offset: .5, color: '#0000ff' }, { offset: 1, color: '#ffffff' },
];
const nativeGradient = (type: 'linear' | 'radial') => map({
  'fill-type': type === 'linear' ? 'linear-gradient' : 'radial-gradient',
  'fill-center-point': map({ X: .2, Y: .3 }), 'fill-axis1': map({ X: .8, Y: .9 }),
  ...(type === 'linear' ? { 'fill-angle': 73 } : { 'fill-axis2': map({ X: -.2, Y: .8 }) }),
  'fill-offsets': [0, .5, .5, 1], 'fill-colors': [-65536, 1073807104, -16776961, -1],
});
const linear = { type: 'linear' as const, start: { x: .2, y: .3 }, end: { x: .8, y: .9 }, stops };
const radial = { type: 'radial' as const, center: { x: .2, y: .3 }, axis1: { x: .8, y: .9 }, axis2: { x: -.2, y: .8 }, stops };
const nativeShadow = (on: boolean, spread: number) => map({ On: on, OffsetX: -3, OffsetY: 4, BlurRadius: 7, Color: -2147418368, Spread: spread });
const shadow = { on: true, offsetX: -3, offsetY: 4, blurRadius: 7, color: '#00ff0080' };
const positives: MatrixCase[] = [
  style('font family', [property(1, 'Open Sans')], { fontFamily: 'Open Sans' }),
  style('font point-to-pixel size', [property(2, 18)], { fontSize: 24 }),
  style('font weight', [property(1001, 700)], { fontWeight: 700 }),
  style('italic', [property(1002, 1)], { fontStyle: 'italic' }),
  style('explicit normal reset', [property(1002, 0)], { fontStyle: 'normal' }),
  style('both text decorations', [property(5, true), property(95, true)], { underline: true, strikethrough: true }),
  style('explicit decoration clears', [property(5, false), property(95, false)], { underline: false, strikethrough: false }),
  style('ARGB text color', [property(6, solid(0x80123456))], { color: '#12345680' }),
  style('solid fill', [property(7, solid(-65536))], { fill: '#ff0000' }),
  style('solid alpha stroke', [property(8, solid(0x80123456))], { stroke: '#12345680' }),
  style('linear fill keeps modern endpoints and duplicate stops', [property(7, nativeGradient('linear'))], { fillGradient: linear }),
  style('radial fill keeps both axes', [property(7, nativeGradient('radial'))], { fillGradient: radial }),
  style('linear stroke', [property(8, nativeGradient('linear'))], { strokeGradient: linear }),
  style('radial stroke', [property(8, nativeGradient('radial'))], { strokeGradient: radial }),
  style('opacity', [property(70, .35)], { opacity: .35 }),
  style('fractional border width', [property(15, 2.5)], { strokeWidth: 2.5 }),
  style('dash-dot-dot pattern', [property(16, 6)], { linePattern: 'dash-dot-dot' }),
  style('atomic start and end arrows', [property(17, map({ Start: 3, End: 1 }))], { lineEnds: { start: 'filled-triangle', end: 'none' } }),
  style('four padding sides use TRBL order', [property(11, 4), property(12, 1), property(13, 2), property(14, 3)], { textPadding: [1, 2, 3, 4] }),
  style('right and bottom alignment', [property(9, 2), property(10, 2)], { textAlign: 'right', verticalAlign: 'bottom' }),
  style('explicit left and top alignment', [property(9, 0), property(10, 0)], { textAlign: 'left', verticalAlign: 'top' }),
  style('outer shadow', [property(72, nativeShadow(true, 0))], { outerShadow: shadow }),
  style('inner shadow with spread', [property(73, nativeShadow(true, 2))], { innerShadow: { ...shadow, spread: 2 } }),
  style('explicit text shadow off', [property(74, nativeShadow(false, 0))], { textShadow: { ...shadow, on: false } }),
  style('partial rectangle borders', [property(80, 10)], { borderVisibility: [true, false, true, false] }),
  style('all rectangle borders off preserves the declaration', [property(80, 0)], { borderVisibility: [false, false, false, false] }),
  { name: 'location and paired size', properties: [property(101, map({ X: 0, Y: -10 })), property(105, map({ Width: 123, Height: 45 }))], expected: { x: 0, y: -10, width: 123, height: 45 } },
  { name: 'visibility false means hidden', properties: [property(110, false)], expected: { hidden: true } },
  { name: 'explicit visibility true', properties: [property(110, true)], expected: { hidden: false } },
  style('automatic line spacing with observed normal rich paragraphs', [property(20, 0)], { lineHeight: 'normal' }),
  { name: 'empty whole state map remains a barrier', properties: [], states: [], expected: { stateStyles: {} } },
  { name: 'MouseOver native state identity', properties: [], states: [{ name: 'MouseOver', properties: [property(7, solid(-65536))] }], expected: { stateStyles: { mouseOver: { fill: '#ff0000' } } } },
  { name: 'MouseDown explicit equal-base normal reset', properties: [], states: [{ name: 'MouseDown', properties: [property(1002, 0)] }], expected: { stateStyles: { mouseDown: { fontStyle: 'normal' } } } },
  { name: 'Focused explicit decoration clears', properties: [], states: [{ name: 'Focused', properties: [property(5, false), property(95, false)] }], expected: { stateStyles: { focused: { underline: false, strikethrough: false } } } },
  { name: 'Selected border width', properties: [], states: [{ name: 'Selected', properties: [property(15, 0)] }], expected: { stateStyles: { selected: { strokeWidth: 0 } } } },
  { name: 'Error color', properties: [], states: [{ name: 'Error', properties: [property(6, solid(-65536))] }], expected: { stateStyles: { error: { color: '#ff0000' } } } },
  { name: 'Hint color', properties: [], states: [{ name: 'Hint', properties: [property(6, solid(-16711936))] }], expected: { stateStyles: { hint: { color: '#00ff00' } } } },
  { name: 'Disabled explicit empty state', properties: [], states: [{ name: 'Disabled', properties: [] }], expected: { stateStyles: { disabled: {} } } },
  { name: 'inactive unsupported properties do not become local overrides', properties: [property(5000, 'inactive unknown', 2), property(7, solid(-65536), 1)], expected: {} },
];
const negatives: MatrixCase[] = [
  { name: 'one padding side', properties: [property(11, 4)], rejection: /Partial local adaptive padding/ },
  { name: 'solid fill with extra field', properties: [property(7, map({ 'fill-type': 'solid', 'fill-color': -65536, unknown: true }))], rejection: /Invalid local adaptive property map/ },
  { name: 'unmapped transform even when identity', properties: [property(1401, map({ ScaleX: 1, ScaleY: 1, TranslateX: 0, TranslateY: 0, Rotate: 0 }))], rejection: /Unsupported local adaptive visual property 1401/ },
  { name: 'unknown active property', properties: [property(5000, true)], rejection: /Unsupported local adaptive visual property 5000/ },
  { name: 'incomplete paired size', properties: [property(105, map({ Width: 123 }))], rejection: /Invalid local adaptive property map/ },
  { name: 'nonautomatic P20 spacing', properties: [property(20, 1)], rejection: /Unrepresentable local adaptive visual value 20/ },
  { name: 'automatic P20 without normal source paragraphs', properties: [property(20, 0)], paragraphLineSpacing: 12, rejection: /Unrepresentable local adaptive visual value 20/ },
  { name: 'unknown active state property rejects entire owner', properties: [], states: [{ name: 'Selected', properties: [property(5000, true)] }], rejection: /Unsupported local adaptive visual property 5000/ },
];

// Real bytes -> container -> object decoder -> semantic reader, once per case.
// Only the test request is serialized here; expectations are not sent to readers.
const response = JSON.parse(execFileSync(process.execPath, ['research/adaptive-import-property-matrix-decode.mjs'], {
  input: JSON.stringify([...positives, ...negatives].map(({ expected: _expected, rejection: _rejection, ...input }) => input)),
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
})) as any;
const ids = response.ids;
const targetId = `rp-w-${ids.pagePackage}-${ids.target}`;
const tabletId = `rp-av-${ids.tablet}`;
const orphanId = `rp-w-${ids.pagePackage}-${ids.orphan}`;
const baseline = importRpSemantics(response.baselineSemantics);
const baselineTarget = baseline.document.pages[0].widgets.find(w => w.id === targetId);
const resultByName = new Map<string, any>(response.cases.map((c: any) => [c.name, c]));
const observations: Record<string, unknown>[] = [];
function decodeResult(name: string) {
  const record = resultByName.get(name)!;
  expect(record.rawSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(record.semantics.packageFailures).toEqual([]);
  expect(record.semantics.semanticFailures).toEqual([]);
  const widget = record.semantics.diagrams.find((d: any) => d.packageId === ids.pagePackage).widgets.find((w: any) => w.id === ids.target);
  return { record, widget };
}
function verifyIndependentGraphs(result: ReturnType<typeof importRpSemantics>) {
  expect(result.report.eventsImported).toBe(4);
  expect(result.report.actionsImported).toBe(3);
  expect(result.report.eventsSkipped).toBe(0);
  expect(result.document.pages[0].adaptiveOverrides![`rp-av-${ids.inactive}`]).toEqual({ [orphanId]: {} });
  expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
}

describe('SYNTHETIC RP adaptive property matrix across both conversion boundaries', () => {
  it('retains the pinned source and six-package complete carrier', () => {
    expect(response.synthetic).toBe(true);
    expect(response.originalSourceSha256).toBe('0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4');
    expect(response.carrierSha256).toBe('1889bb1c2ee4a4c4dd10585cccdd2c3c1c1dd0ed83ff7cfede667aed89f56d7b');
    expect(response.cases).toHaveLength(positives.length + negatives.length);
    expect(baselineTarget).toBeDefined();
    expect(baseline.report.eventsImported).toBe(4);
    expect(baseline.report.actionsImported).toBe(3);
  });
  it.each(positives)('recovers $name exactly without flattening the inherited declaration', test => {
    const { record, widget } = decodeResult(test.name), recovery = widget.adaptiveStyleRecovery;
    expect(recovery.status).toBe('decoded-adaptive-styles');
    expect(recovery.entries).toHaveLength(1);
    expect(recovery.entries[0].patch).toEqual(test.expected);
    const result = importRpSemantics(record.semantics), page = result.document.pages[0];
    expect(page.adaptiveOverrides![tabletId][targetId]).toEqual(test.expected);
    expect(page.widgets.find(w => w.id === targetId)).toEqual(baselineTarget);
    expect(result.report.widgetsImported).toBe(6);
    verifyIndependentGraphs(result);
    observations.push({ name: test.name, outcome: 'supported', rawSha256: record.rawSha256, rawBytes: record.rawBytes,
      input: test, readerPatch: recovery.entries[0].patch, importedPatch: page.adaptiveOverrides![tabletId][targetId],
      widgetsImported: result.report.widgetsImported, eventsImported: result.report.eventsImported, actionsImported: result.report.actionsImported });
  });
  it.each(negatives)('atomically rejects $name and preserves unrelated events', test => {
    const { record, widget } = decodeResult(test.name);
    expect(widget.adaptiveStyleRecovery.status).toBe('unsupported-adaptive-styles');
    expect(widget.adaptiveStyleRecovery.reason).toMatch(test.rejection!);
    const result = importRpSemantics(record.semantics), page = result.document.pages[0];
    expect(page.widgets.some(w => w.id === targetId)).toBe(false);
    expect(Object.values(page.adaptiveOverrides!).some(map => Object.hasOwn(map, targetId))).toBe(false);
    expect(result.report.issues).toContainEqual(expect.objectContaining({ code: 'widget-skipped', sourceId: ids.target,
      packageId: ids.pagePackage, severity: 'skipped', message: widget.adaptiveStyleRecovery.reason }));
    expect(result.report.widgetsImported).toBe(5);
    verifyIndependentGraphs(result);
    observations.push({ name: test.name, outcome: 'rejected-atomically', rawSha256: record.rawSha256, rawBytes: record.rawBytes,
      input: { ...test, rejection: test.rejection!.source }, reason: widget.adaptiveStyleRecovery.reason,
      widgetsImported: result.report.widgetsImported, eventsImported: result.report.eventsImported, actionsImported: result.report.actionsImported });
  });
});

// Opt-in evidence export; ordinary test-suite execution never overwrites the
// frozen evidence. This records only cases whose assertions above completed.
afterAll(() => {
  if (process.env.REA_ADAPTIVE_PROPERTY_MATRIX_EVIDENCE !== '1') return;
  const sources = ['tests/import-rp-adaptive-property-matrix.test.ts', 'research/adaptive-import-property-matrix-decode.mjs',
    'scripts/synthetic-rp-adaptive-fixture.mjs', 'scripts/synthetic-rp-object-carrier.mjs',
    'research/scripts/read-rp-container.mjs', 'research/scripts/read-rp-objects.mjs', 'research/scripts/read-rp-semantics.mjs',
    'research/scripts/read-rp-adaptive.mjs', 'research/scripts/read-rp-interactions.mjs',
    'src/model/import-rp.ts', 'src/model/import-rp-adaptive.ts', 'src/model/document.ts', 'src/model/types.ts'];
  fs.writeFileSync('research/adaptive-import-property-matrix-evidence.json', JSON.stringify({ synthetic: true,
    originalAxureExecuted: false, originalSourceSha256: response.originalSourceSha256, carrierSha256: response.carrierSha256,
    counts: { expectedCases: positives.length + negatives.length, assertedCases: observations.length,
      supported: observations.filter(row => row.outcome === 'supported').length,
      rejectedAtomically: observations.filter(row => row.outcome === 'rejected-atomically').length, carrierCheck: 1 },
    sources: sources.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') })),
    cases: observations,
  }, null, 2) + '\n');
});
