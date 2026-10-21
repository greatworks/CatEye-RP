import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';
import type { Widget } from '../src/model/types';
// Layer edges share the diagram coordinate scope; panel states remain separate.
const diagramWidgets = (widgets: Widget[]): Widget[] => widgets.flatMap(w => [w,...(w.layer ? diagramWidgets(w.layer.widgets) : [])]);

const file = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const manifest = JSON.parse(fs.readFileSync(file('../research/rp-form-candidates-evidence.json'), 'utf8'));
const reader = file('../research/scripts/read-rp-semantics.mjs');
const readScript = "import {pathToFileURL} from 'node:url';const reader=process.argv[1],file=process.argv[2];process.argv[1]='';const {inspectRpSemantics}=await import(pathToFileURL(reader).href);process.stdout.write(JSON.stringify(inspectRpSemantics(file)));";
const read = (file: string) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', readScript, reader, file], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
const recovered = read(manifest.samples.find((s: {file: string}) => s.file.endsWith('Sample form patterns.rplib')).file);
const imported = importRpSemantics(recovered), sourcePage = recovered.diagrams.find((p: {name: string}) => p.name === 'Personal information form');
const countryId = 'd8fa7295bba34065956efd90f1c4b300', stateId = '89ea7c71f7b54eed986cd4e8569b14e5';
function fixture(mode = 'dropdown', selected = [1], values = ['A', 'A', '', ' '], multiple = false) {
  const data = structuredClone({ ...recovered, diagrams: recovered.diagrams.filter((p: {rootType: string}) => p.rootType === 'Axure:Page').map((p: {packageId: string}) => ({ ...p, widgets: p.packageId === sourcePage.packageId ? [sourcePage.widgets.find((w: {id: string}) => w.id === countryId)] : [], interactionRecovery: { status: 'decoded-interaction-tree', events: [] } })) });
  const page = data.diagrams.find((p: {packageId: string}) => p.packageId === sourcePage.packageId), item = page.widgets[0];
  item.type = `Axure:DiagramObject:${mode === 'dropdown' ? 'ComboBox' : 'ListBox'}`; item.typeCandidate = { type: 'select', selectMode: mode, mapping: 'native-select-options' };
  item.selectRecovery = { status: 'decoded-select-properties', selectMode: mode, multiple, options: values.map((value, index) => ({ sourceId: (index + 1).toString(16).padStart(32, '0'), value, selected: selected.includes(index) })), storedSelectedIndices: selected };
  item.interactionRecovery.events = [];
  return { data, page, item };
}
const widget = (data: unknown) => importRpSemantics(data).document.pages.find(p => p.name === 'Personal information form')!.widgets[0];
const event = (sourceId: string, source = 'selectedOption') => ({ status: 'supported-event', id: 'a'.repeat(32), nativeEventType: 51, event: 'change', cases: [{ id: 'b'.repeat(32), name: 'Selection', enabled: true, isNewIfGroup: true, conditionMode: 'all', conditions: [{ source, targetSourceId: sourceId, operator: 'equals', value: 'A', comparisonMode: 'axure' }], actions: [{ sourceId: 'c'.repeat(32), type: 'setFocus', targetSourceId: sourceId, selectText: true }] }] });

describe('native ordered SelectObject conversion', () => {
  it('imports both real Personal dropdowns with original geometry, order and blank-space values', () => {
    const page = imported.document.pages.find(p => p.name === 'Personal information form')!;
    for (const [id, count, x, y, width] of [[countryId, 197, 20, 466, 400], [stateId, 52, 240, 676, 160]] as const) {
      const w = diagramWidgets(page.widgets).find(w => w.id.endsWith(id))!, raw = sourcePage.widgets.find((w: {id: string}) => w.id === id);
      expect(w).toMatchObject({ type: 'select', selectMode: 'dropdown', multiple: false, selectedIndices: [0], text: '', x, y, width, height: 48 });
      expect(w.options).toHaveLength(count); expect(w.options).toEqual(raw.selectRecovery.options.map((o: {value: string}) => o.value)); expect(w.options![0]).toBe(' ');
      const issue = imported.report.issues.find(i => i.sourceId === id && i.code === 'select-options-recovery')!;
      expect(issue.details).toMatchObject({ storedSelectedIndices: id === countryId ? [0] : [], effectiveSelectedIndices: [0] });
    }
    // The new 18 checkboxes close 10 more Layers (139 total). Ownership moves
    // existing leaves into those groups; the corpus projection preserves them.
    expect(imported.report).toMatchObject({ widgetsImported: 238, widgetsSkipped: 48, nestedWidgetsImported: 921, nestedWidgetsSkipped: 0 });
    expect(imported.document.pages.flatMap(p => diagramWidgets(p.widgets)).filter(w => w.rotation === 180).map(w => w.id.split('-').at(-1)).sort()).toEqual(['04005c928fed455a82ac701931df9a59','2df36c7e04ab487784dc961a588e4db4','79b2d50ac4c04841a57cff1dc51d52b2','800340e5a16440f3874fc504ef278439']);
    expect(parseDocument(serializeDocument(imported.document))).toEqual(imported.document);
  });
  it('imports the actual empty dropdown and ListBox without manufacturing options', () => {
    const sample = manifest.samples.find((s: {file: string}) => /[\\/]Default\.rplib$/.test(s.file));
    const r = importRpSemantics(read(sample.file)), selects = r.document.pages.flatMap(p => p.widgets).filter(w => w.type === 'select');
    expect(selects).toHaveLength(2); expect(selects.map(w => w.selectMode).sort()).toEqual(['dropdown', 'listbox']);
    for (const w of selects) expect(w).toMatchObject({ options: [], selectedIndices: [], multiple: false });
  });
  it.each([
    { mode: 'dropdown', stored: [], multiple: false, effective: [0] },
    { mode: 'dropdown', stored: [0, 2], multiple: false, effective: [2] },
    { mode: 'listbox', stored: [], multiple: false, effective: [] },
    { mode: 'listbox', stored: [0, 2], multiple: false, effective: [2] },
    { mode: 'listbox', stored: [0, 2], multiple: true, effective: [0, 2] },
  ])('maps $mode stored $stored multiple=$multiple to effective $effective', ({mode, stored, multiple, effective}) => {
    const { data } = fixture(mode, stored, ['A', 'A', '', ' '], multiple), before = JSON.stringify(data), w = widget(data);
    expect(w.selectedIndices).toEqual(effective); expect(w.options).toEqual(['A', 'A', '', ' ']); expect(JSON.stringify(data)).toBe(before);
  });
  it('retains literal interpolation syntax and newline text inside an option', () => { const { data } = fixture('dropdown', [1], ['[[Choice]]', 'a\nb']); expect(widget(data).options).toEqual(['[[Choice]]', 'a\nb']); });
  it.each(['missing', 'status', 'field', 'mode', 'mapping', 'multiple-dropdown', 'text', 'flag', 'index', 'duplicate-reference', 'option-field', 'value', 'oversized'])('rejects malformed select evidence: %s', kind => {
    const { data, item } = fixture(); const recovery = item.selectRecovery;
    if (kind === 'missing') delete item.selectRecovery;
    if (kind === 'status') recovery.status = 'unsupported-select-properties';
    if (kind === 'field') recovery.unknown = true;
    if (kind === 'mode') recovery.selectMode = 'listbox';
    if (kind === 'mapping') item.typeCandidate.mapping = 'guessed';
    if (kind === 'multiple-dropdown') recovery.multiple = true;
    if (kind === 'text') item.text.text = 'unmapped';
    if (kind === 'flag') recovery.options[0].selected = 1;
    if (kind === 'index') recovery.storedSelectedIndices = [0];
    if (kind === 'duplicate-reference') recovery.options[1].sourceId = recovery.options[0].sourceId;
    if (kind === 'option-field') recovery.options[0].disabled = true;
    if (kind === 'value') recovery.options[0].value = {};
    if (kind === 'oversized') recovery.options[0].value = 'x'.repeat(2001);
    const r = importRpSemantics(data); expect(r.report.widgetsImported).toBe(0); expect(r.report.widgetsSkipped).toBe(1);
  });
  it('maps selected-option conditions and selection-change/focus while preserving scalar identity', () => {
    const { data, item } = fixture(); item.interactionRecovery.events = [event(item.id)]; const w = widget(data);
    expect(w.interactions[0]).toMatchObject({ event: 'change', conditions: [{ source: 'selectedOption', key: w.id, comparisonMode: 'axure' }], actions: [{ type: 'setFocus', targetId: w.id, selectText: true }] });
  });
  it('supports single GetWidgetText but rejects typed-array multi GetWidgetText atomically', () => {
    const { data, item } = fixture('listbox', [0], ['A', 'B'], false); item.interactionRecovery.events = [event(item.id, 'widgetText')]; expect(widget(data).interactions).toHaveLength(1);
    item.selectRecovery.multiple = true; expect(widget(data).interactions).toEqual([]);
    item.interactionRecovery.events[0].cases[0].conditions[0].source = 'selectedOption'; expect(widget(data).interactions).toHaveLength(1);
  });
  it('still rejects selection-change events whose full native action mapping is absent', () => {
    const { data, item } = fixture(); const e = event(item.id); e.cases[0].actions[0] = { sourceId: 'c'.repeat(32), type: 'setSelectedOption', targetSourceId: item.id, selectText: true }; item.interactionRecovery.events = [e]; expect(widget(data).interactions).toEqual([]);
  });
});
