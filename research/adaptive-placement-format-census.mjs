import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';

// Narrow static corpus inventory of P111; no target assembly/application runs.
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samplesFile = 'research/rich-hyperlink-format-census.json';
const get = (o, key) => o?.properties?.$map?.find(([name]) => name === key)?.[1];
const fields = value => value?.$map ? new Map(value.$map.filter(p => Array.isArray(p) && p.length === 2)) : new Map();
const count = (rows, fn) => rows.reduce((result, row) => { const key = String(fn(row)); result[key] = (result[key] ?? 0) + 1; return result; }, {});
const report = { synthetic: false, method: 'Read-only self-written container/object decoding plus recursive P111 inventory; no target execution or import changes.', samples: [], declarations: [], directFlags: [], adaptiveCarriers: [], sources: [] };
for (const sample of JSON.parse(fs.readFileSync(samplesFile)).samples) {
  assert.equal(sha(sample.file), sample.sha256);
  const decoded = inspectRpObjects(sample.file), records = [], flags = [], adaptive = [];
  for (const pack of decoded.packages) {
    const index = new Map((pack.objects ?? []).map(o => [o.id, o]));
    const refs = new Map();
    const addRef = (id, source) => { if (!id) return; const list = refs.get(id) ?? []; list.push(source); refs.set(id, list); };
    for (const o of pack.objects ?? []) {
      for (const key of ['MyStyle', 'page-style', 'RepeaterStyle', 'DefaultStyle', 'FormatPainterStyle']) {
        const scope = key === 'DefaultStyle' ? 'default-style' : key === 'FormatPainterStyle' ? 'format-painter' : 'base';
        const r = get(o, key); if (r?.referenceTag === 3) addRef(r.$reference, { sourceId: o.id, type: o.type, field: key, scope, isContained: get(o, 'IsContained') });
      }
      for (const key of ['AdaptiveStyles', 'AdaptiveRepeaterStyles']) {
        const values = get(o, key); if (values === undefined) continue;
        const entries = [];
        if (Array.isArray(values)) for (let i = 0; i + 1 < values.length; i += 2) {
          const ref = values[i + 1], target = index.get(ref?.$reference), viewId = values[i]?.$guid;
          addRef(ref?.$reference, { sourceId: o.id, type: o.type, field: key, scope: 'local', viewId, isContained: get(o, 'IsContained') });
          entries.push({ viewId, reference: ref, targetType: target?.type, propListLength: Array.isArray(get(target, 'PropList')) ? get(target, 'PropList').length : null });
        }
        adaptive.push({ file: sample.file, sha256: sample.sha256, packageId: pack.packageId, packageSha256: pack.sha256, sourceId: o.id, type: o.type, field: key, isContained: get(o, 'IsContained'), arrayLength: Array.isArray(values) ? values.length : null, entries });
      }
      for (const [key, value] of o.properties?.$map ?? []) if (/placed|limbo/i.test(key)) flags.push({ file: sample.file, sha256: sample.sha256, packageId: pack.packageId, sourceId: o.id, type: o.type, key, value });
    }
    // Also identify state style references without confusing these with view styles.
    for (const o of pack.objects ?? []) for (const p of get(o, 'PropList') ?? []) {
      const m = fields(p); if ((m.get('DOAName') & 0x0fffffff) !== 21) continue;
      for (const [name, ref] of m.get('Value')?.$map ?? []) if (ref?.referenceTag === 3) addRef(ref.$reference, { sourceId: o.id, type: o.type, scope: 'state', state: name });
    }
    for (const o of pack.objects ?? []) {
      const walk = (value, location, cacheInfo) => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${location}[${i}]`, cacheInfo)); return; }
        if (Array.isArray(value.$map)) {
          const m = fields(value), raw = m.get('DOAName');
          if (location.includes('StyleCache.Styles[') && m.has('Info') && m.has('Props')) cacheInfo = m.get('Info');
          if (Number.isInteger(raw) && (raw & 0x0fffffff) === 111) {
            const uses = refs.get(o.id) ?? [], localProp = /^properties\.PropList\[/.test(location);
            const scopes = localProp && uses.length ? [...new Set(uses.map(r => r.scope))] : [location.includes('StyleCache') ? 'cached' : 'other'];
            records.push({ file: sample.file, sha256: sample.sha256, packageId: pack.packageId, packageSha256: pack.sha256, version: pack.version,
              sourceId: o.id, type: o.type, location, scopes, rawDoaName: raw, determined: Boolean(raw & 0x80000000), overridden: Boolean(raw & 0x40000000),
              eligibleOD: (raw >>> 30) === 3, value: m.get('Value'), property: value, owners: localProp ? uses : [], ...(cacheInfo ? { cacheInfo } : {}) });
          }
          for (const [key, child] of value.$map) walk(child, `${location}.${typeof key === 'string' ? key : JSON.stringify(key)}`, cacheInfo);
        } else for (const [key, child] of Object.entries(value)) walk(child, `${location}.${key}`);
      };
      walk(o.properties, 'properties');
    }
  }
  assert.equal(sha(sample.file), sample.sha256);
  report.declarations.push(...records); report.directFlags.push(...flags); report.adaptiveCarriers.push(...adaptive);
  report.samples.push({ file: sample.file, sha256: sample.sha256, packages: decoded.packages.length,
    unsupportedPackages: decoded.packages.filter(p => p.status !== 'decoded-observed-object-structure').map(p => ({ path: p.path, status: p.status, reason: p.reason })),
    declarations: records.length, values: count(records, r => r.value), flags: count(records, r => `${Number(r.overridden)}${Number(r.determined)}`),
    scopes: count(records, r => r.scopes.join('+')), directFlags: flags.length,
    adaptiveFields: adaptive.length, nonemptyAdaptiveFields: adaptive.filter(a => a.arrayLength > 0).length,
    adaptiveStyleTargets: adaptive.reduce((n, a) => n + a.entries.length, 0) });
}
report.totals = { samples: report.samples.length, declarations: report.declarations.length, values: count(report.declarations, r => r.value),
  scopes: count(report.declarations, r => r.scopes.join('+')), flags: count(report.declarations, r => `${Number(r.overridden)}${Number(r.determined)}`),
  directFlags: report.directFlags.length, adaptiveFields: report.adaptiveCarriers.length, nonemptyAdaptiveFields: report.adaptiveCarriers.filter(a => a.arrayLength > 0).length,
  adaptiveStyleTargets: report.adaptiveCarriers.reduce((n, a) => n + a.entries.length, 0) };
report.sources = [samplesFile, 'research/adaptive-placement-format-census.mjs', 'research/scripts/read-rp-container.mjs', 'research/scripts/read-rp-objects.mjs'].map(file => ({ file, sha256: sha(file) }));
fs.writeFileSync('research/adaptive-placement-format-census.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ totals: report.totals, samples: report.samples }, null, 2));
