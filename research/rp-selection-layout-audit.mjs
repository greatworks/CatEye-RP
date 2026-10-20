// Research-only sample evidence; does not execute the target application or DLL.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';

const hash = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const property = (value, key) => {
  const entries = value?.$map?.filter(entry => entry[0] === key) ?? [];
  assert.ok(entries.length < 2, `ambiguous property ${key}`);
  return entries[0]?.[1];
};
const properties = value => (value ?? []).map(p => ({ key: property(p, 'DOAName') & 0x0fffffff, rawDoaName: property(p, 'DOAName'), determined: Boolean(property(p, 'DOAName') & 0x80000000), value: property(p, 'Value') }));
const pair = (entry, keys) => entry?.determined ? Object.fromEntries(keys.map(k => [k, property(entry.value, k)])) : null;
const plainText = props => (property(property(property(props, 'RichTextBlock'), 'attributed-string'), 'Paragraphs') ?? []).map(p => (property(p, 'Inlines') ?? []).map(r => property(r, 'Text') ?? '').join('')).join('\n');
const selectedKeys = ['Selected', 'Disabled', 'Error', 'VisibleFromSettings', 'IsContained', 'SelectedStyleGroup', 'radio-group', 'align-selection-button-right', 'AutoFitWidth', 'AutoFitHeight', 'fit-to-content', 'is-fixed', 'is-percent-width', 'panel-diagrams'];
const corpus = ['the-basics-tab-menu.rp', 'Quick Win.rp', 'Default.rplib'].map(file => {
  const path = `research/samples/${file}`, decoded = inspectRpObjects(path);
  let defaultStyleId;
  for (const pack of decoded.packages.filter(p => p.path === 'DesignDocument')) {
    const objects = new Map(pack.objects.map(o => [o.id, o]));
    const root = objects.get(pack.rootId), sheet = objects.get(property(root?.properties, 'StyleSheet')?.$reference);
    const style = objects.get(property(sheet?.properties, 'DefaultStyle')?.$reference);
    defaultStyleId = property(style?.properties, 'Id')?.$guid;
  }
  const diagrams = [];
  for (const pack of decoded.packages) {
    const objects = new Map((pack.objects ?? []).map(o => [o.id, o])), root = objects.get(pack.rootId);
    if (!root) continue;
    const caches = property(property(root.properties, 'StyleCache'), 'Styles');
    const diagram = objects.get(property(root.properties, 'diagram')?.$reference);
    if (!diagram) continue;
    const members = property(diagram.properties, 'diagram-objects') ?? [];
    const widgets = [];
    for (const ref of members) {
      const widget = objects.get(ref.$reference); if (!widget) continue;
      const p = widget.properties, style = objects.get(property(p, 'MyStyle')?.$reference);
      const local = properties(property(style?.properties, 'PropList'));
      const match = property(style?.properties, 'MatchInfo'), matchId = property(match, 'Id')?.$guid, libraryId = property(match, 'LibraryId')?.$guid;
      const baseId = local.find(p => p.key === 0)?.value?.$guid;
      const defaults = (caches ?? []).filter(c => property(property(c, 'Info'), 'Id')?.$guid === defaultStyleId && property(property(c, 'Info'), 'LibraryId')?.$guid === '0'.repeat(32));
      const bases = (caches ?? []).filter(c => property(property(c, 'Info'), 'Id')?.$guid === matchId && property(property(c, 'Info'), 'LibraryId')?.$guid === libraryId);
      const chainComplete = Boolean(defaultStyleId && defaults.length === 1 && bases.length === 1 && baseId === matchId);
      const chain = chainComplete ? [
        { kind: 'cached-document-default', styleId: defaultStyleId, props: properties(property(defaults[0], 'Props')) },
        { kind: 'cached-matched-base', styleId: matchId, libraryId, props: properties(property(bases[0], 'Props')) },
      ] : [];
      chain.push({ kind: 'local-object-style', objectId: style?.id, props: local });
      const effective = new Map();
      for (const source of chain) for (const p of source.props) effective.set(p.key, { ...p, source: { ...source, props: undefined } });
      const ix = effective.get(21), selectedRef = property(ix?.value, 'Selected'), selectedStyle = objects.get(selectedRef?.$reference);
      widgets.push({
        id: widget.id, type: widget.type, text: plainText(p), label: property(property(p, 'name-block'), 'text'),
        fields: Object.fromEntries(selectedKeys.filter(key => property(p, key) !== undefined).map(key => [key, property(p, key)])),
        adaptiveStyleCount: property(p, 'AdaptiveStyles')?.length ?? null,
        localProperties: local,
        geometry: { chainComplete, location: pair(effective.get(101), ['X', 'Y']), size: pair(effective.get(105), ['Width', 'Height']), locationEvidence: effective.get(101) ?? null, sizeEvidence: effective.get(105) ?? null, rotation: effective.get(50) ?? null, transform: effective.get(1401) ?? null, outerShadow: effective.get(72) ?? null },
        baseFill: effective.get(7) ?? null,
        selectedStyle: { ixEvidence: ix ?? null, reference: selectedRef ?? null, resolvedType: selectedStyle?.type ?? null, properties: selectedStyle ? properties(property(selectedStyle.properties, 'PropList')) : [] },
        geometryStyleChain: chain.map(source => ({ ...source, props: source.props.filter(p => [0,7,21,50,72,101,105,1401].includes(p.key)) })),
      });
    }
    const panelStyle = objects.get(property(diagram.properties, 'PanelDiagramStyle')?.$reference);
    diagrams.push({ packageId: pack.packageId, rootType: root.type, rootId: root.id, name: property(diagram.properties, 'Name') ?? null, panelStyleProperties: panelStyle ? properties(property(panelStyle.properties, 'PropList')) : null, widgets });
  }
  return { file, path, sha256: hash(path), defaultStyleId, diagrams };
});

const tab = corpus[0], quick = corpus[1], library = corpus[2];
const radios = quick.diagrams.flatMap(d => d.widgets).filter(w => w.type === 'Axure:DiagramObject:RadioButton');
assert.equal(radios.length, 6);
assert.deepEqual(radios.map(w => w.fields['radio-group']), ['', '', 'Duration Radio Group', 'Duration Radio Group', 'Duration Moving', 'Duration Moving']);
assert.deepEqual(radios.map(w => w.fields.Selected), [true, false, false, true, true, false]);
assert.ok(radios.every(w => w.fields['align-selection-button-right'] === 'False'));
assert.equal(quick.diagrams.flatMap(d => d.widgets).filter(w => w.type === 'Axure:DiagramObject:Checkbox').length, 0);
const tabStates = tab.diagrams.filter(d => d.rootType === 'Axure:PanelState');
assert.equal(tabStates.length, 2);
for (const state of tabStates) {
  assert.equal(state.widgets.length, 1);
  const child = state.widgets[0];
  assert.ok(child.geometry.chainComplete);
  assert.equal(child.localProperties.some(p => p.key === 101), false);
  assert.deepEqual(child.geometry.location, { X: 0, Y: 0 });
  assert.deepEqual(child.geometry.size, { Width: 300, Height: 170 });
  assert.equal(child.geometry.locationEvidence.source.kind, 'cached-document-default');
}
const tabButtons = tab.diagrams.find(d => d.rootType === 'Axure:Page').widgets.filter(w => w.type === 'Axure:DiagramObject:VectorShape');
assert.deepEqual(tabButtons.map(w => w.fields.Selected), [true, false]);
for (const button of tabButtons) {
  assert.equal(button.fields.SelectedStyleGroup, 'Tab Control Group');
  assert.equal(property(button.baseFill.value, 'fill-color'), -1);
  assert.equal(button.selectedStyle.resolvedType, 'Axure:Style');
  assert.deepEqual(button.selectedStyle.properties.map(p => p.key), [7]);
  assert.equal(property(button.selectedStyle.properties[0].value, 'fill-color'), -8268808);
}
const checkboxes = library.diagrams.flatMap(d => d.widgets).filter(w => w.type === 'Axure:DiagramObject:Checkbox');
assert.equal(checkboxes.length, 1); assert.equal(checkboxes[0].fields.Selected, false);

const stateRectangles = [tab, quick].flatMap(sample => sample.diagrams.filter(d => d.rootType === 'Axure:PanelState').map(d => {
  assert.ok(d.widgets.every(w => w.geometry.location && w.geometry.size));
  const visible = d.widgets.filter(w => w.fields.VisibleFromSettings !== false);
  return { sample: sample.file, statePackageId: d.packageId, name: d.name, calculation: 'Unrotated simple child geometry; visible right/bottom maxima anchored at zero; not native runtime observation', width: Math.max(0, ...visible.map(w => w.geometry.location.X + w.geometry.size.Width)), height: Math.max(0, ...visible.map(w => w.geometry.location.Y + w.geometry.size.Height)), childIds: d.widgets.map(w => w.id) };
}));
const quickFit = stateRectangles.filter(s => s.sample === 'Quick Win.rp' && ['1dc108e8c0864ae2970bc76105b03a18','0dafad5771cf4d8088ce17fb2c8d9929'].includes(s.statePackageId));
assert.deepEqual(quickFit.map(s => [s.width,s.height]).sort((a,b) => a[1]-b[1]), [[600,231],[600,294]]);

// Keep only objects and diagrams relevant to this research question.
const kept = corpus.map(sample => ({ ...sample, diagrams: sample.diagrams.map(d => ({ ...d, widgets: d.widgets.filter(w => sample.file.startsWith('the-basics') || d.rootType === 'Axure:PanelState' || ['Axure:DiagramObject:DynamicPanel','Axure:DiagramObject:RadioButton','Axure:DiagramObject:Checkbox'].includes(w.type)) })).filter(d => d.widgets.length) }));
const output = { inspection: 'Own static file parser; no target code execution', observedControls: { quickWinRadioButtons: 6, quickWinCheckboxes: 0, defaultLibraryCheckboxes: 1, defaultLibraryCheckedCheckboxes: 0 }, sourceSamples: kept, inferredSimpleStateRectangles: stateRectangles, restrictions: ['State rectangles are supported simple geometry deductions, not observed native renders.', 'Unknown/omitted descendants, adaptive geometry, shadows, rotations, percentage widths and contained/master/repeater coordinates require separate handling.', 'Empty-group radios must not be collapsed into one shared empty-name group.', 'SelectedStyleGroup and radio-group are distinct fields.'] };
fs.writeFileSync('research/rp-selection-layout-samples.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, radioButtons: radios.length, checkboxLibraryExamples: checkboxes.length, stateRectangles, outputSha256: hash('research/rp-selection-layout-samples.json') }, null, 2));
