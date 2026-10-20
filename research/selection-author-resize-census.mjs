// Read-only native serialization census. No target code or product importer runs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const p = (o, key) => {
  const rows = o?.$map?.filter(([k]) => k === key) ?? [];
  assert(rows.length < 2, `Duplicate field ${key}`);
  return rows[0]?.[1];
};
const props = rows => (rows ?? []).map(o => {
  const raw = p(o, 'DOAName');
  return { key: raw & 0x0fffffff, raw, determined: !!(raw & 0x80000000), overridden: !!(raw & 0x40000000), value: p(o, 'Value') };
});
const keys = new Set([0, 20, 50, 94, 101, 105, 106, 107, 108, 109, 1401]);
const samples = [], widgets = [];
for (const source of read('research/runtime-transform-format-census.json').samples) {
  assert.equal(sha(source.file), source.sha256);
  const decoded = inspectRpObjects(source.file), found = [];
  const docPack = decoded.packages.find(pack => pack.path === 'DesignDocument');
  const docObjects = new Map((docPack?.objects ?? []).map(o => [o.id, o]));
  const doc = docObjects.get(docPack?.rootId);
  const sheet = docObjects.get(p(doc?.properties, 'StyleSheet')?.$reference);
  const defaultStyle = docObjects.get(p(sheet?.properties, 'DefaultStyle')?.$reference);
  const defaultIdentity = { id: p(defaultStyle?.properties, 'Id')?.$guid,
    libraryId: p(defaultStyle?.properties, 'LibraryId')?.$guid,
    sourceId: defaultStyle?.id, packageId: docPack?.packageId, sourcePartSha256: docPack?.sha256 };
  for (const pack of decoded.packages) {
    const objects = new Map((pack.objects ?? []).map(o => [o.id, o]));
    const root = objects.get(pack.rootId), parents = new Map();
    for (const o of objects.values()) if (o.type === 'Axure:DiagramObject:Layer') {
      for (const ref of p(o.properties, 'DiagramObjects') ?? []) {
        const id = ref?.$reference;
        if (id) { assert(!parents.has(id)); parents.set(id, o.id); }
      }
    }
    const cache = p(p(root?.properties, 'StyleCache'), 'Styles') ?? [];
    for (const o of objects.values()) {
      if (!/:(?:RadioButton|CheckBox|Checkbox)$/.test(o.type)) continue;
      const style = objects.get(p(o.properties, 'MyStyle')?.$reference);
      const local = props(p(style?.properties, 'PropList'));
      const match = p(style?.properties, 'MatchInfo'), matchId = p(match, 'Id')?.$guid;
      const matchLibrary = p(match, 'LibraryId')?.$guid;
      const baseId = local.find(e => e.key === 0)?.value?.$guid;
      const defaults = cache.filter(c => p(p(c, 'Info'), 'Id')?.$guid === defaultIdentity.id
        && p(p(c, 'Info'), 'LibraryId')?.$guid === defaultIdentity.libraryId);
      const bases = cache.filter(c => p(p(c, 'Info'), 'Id')?.$guid === matchId
        && p(p(c, 'Info'), 'LibraryId')?.$guid === matchLibrary);
      const chainComplete = !!defaultIdentity.id && !!defaultIdentity.libraryId && !!matchId && !!matchLibrary
        && defaults.length === 1 && bases.length === 1 && baseId === matchId;
      const chain = chainComplete ? [
        { kind: 'cached-document-default', identity: defaultIdentity, properties: props(p(defaults[0], 'Props')) },
        { kind: 'cached-matched-base', identity: { id: matchId, libraryId: matchLibrary }, properties: props(p(bases[0], 'Props')) },
      ] : [];
      chain.push({ kind: 'local-object-style', sourceId: style?.id, properties: local });
      const indicatorCandidates = chain.flatMap(s => s.properties.filter(v => v.key === 94).map(property => ({
        kind: s.kind, identity: s.identity, sourceId: s.sourceId, property })));
      const fields = Object.fromEntries(['AutoFitWidth', 'AutoFitHeight', 'align-selection-button-right', 'IsContained',
        'VisibleFromSettings', 'IsLocked', 'Selected', 'Disabled', 'radio-group']
        .filter(k => p(o.properties, k) !== undefined).map(k => [k, p(o.properties, k)]));
      const text = (p(p(p(o.properties, 'RichTextBlock'), 'attributed-string'), 'Paragraphs') ?? [])
        .map(q => (p(q, 'Inlines') ?? []).map(r => p(r, 'Text') ?? '').join('')).join('\n');
      const layerChain = []; let parent = parents.get(o.id);
      while (parent) { assert(!layerChain.includes(parent)); layerChain.push(parent); parent = parents.get(parent); }
      const row = { sourceFile: source.file, sourceSha256: source.sha256, packageId: pack.packageId,
        packagePath: pack.path, sourcePartSha256: pack.sha256, version: pack.version ?? null,
        sourceId: o.id, type: o.type, text, fields, layerAncestors: layerChain,
        styleSourceId: style?.id, matchInfo: p(style?.properties, 'MatchInfo'),
        localProperties: local.filter(v => keys.has(v.key)),
        indicatorEvidence: { chainComplete, defaultIdentity, baseId, matchId, matchLibrary,
          defaultMatches: defaults.length, baseMatches: bases.length, candidates: indicatorCandidates,
          effective: indicatorCandidates.at(-1) ?? null },
        adaptive: (p(o.properties, 'AdaptiveStyles') ?? []).map(entry => {
          const target = objects.get(entry[1]?.$reference);
          return { view: entry[0], target: entry[1], type: target?.type,
            properties: props(p(target?.properties, 'PropList')).filter(v => keys.has(v.key)) };
        }),
        cacheProperties: cache.map(c => ({ info: p(c, 'Info'), properties: props(p(c, 'Props')).filter(v => keys.has(v.key)) }))
          .filter(c => c.properties.some(v => v.key === 94)),
      };
      found.push(row);
    }
  }
  samples.push({ ...source, counts: undefined, objects: undefined, selectionControls: found.length });
  widgets.push(...found);
}
const count = fn => Object.fromEntries([...new Set(widgets.map(fn))].map(k => [k, widgets.filter(w => fn(w) === k).length]));
const output = { method: 'Own static raw file reader; P94 evidence requires unique default/matched-base identities and matching local base ID. No product admission claim.',
  targetCodeExecuted: false, originalGuiCompared: false,
  sources: ['research/selection-author-resize-census.mjs', 'research/scripts/read-rp-objects.mjs',
    'research/runtime-transform-format-census.json'].map(file => ({ file, sha256: sha(file) })),
  summary: { samples: samples.length, total: widgets.length, types: count(w => w.type),
    autoFitWidth: count(w => String(w.fields.AutoFitWidth)), autoFitHeight: count(w => String(w.fields.AutoFitHeight)),
    alignRight: count(w => String(w.fields['align-selection-button-right'])),
    withLayerAncestor: widgets.filter(w => w.layerAncestors.length).length,
    localP94: widgets.filter(w => w.localProperties.some(p => p.key === 94)).length,
    adaptiveEntries: widgets.reduce((n, w) => n + w.adaptive.length, 0) },
  samples, widgets };
fs.writeFileSync('research/selection-author-resize-census.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output.summary));
