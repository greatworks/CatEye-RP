import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { inspectRpSemantics } from './scripts/read-rp-semantics.mjs';

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const modules = new Map();
function moduleUrl(file) {
  file = path.resolve(file); if (modules.has(file)) return modules.get(file);
  const source = stripTypeScriptTypes(fs.readFileSync(file, 'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, q, relative) => `from ${JSON.stringify(moduleUrl(path.resolve(path.dirname(file), relative.endsWith('.ts') ? relative : relative + '.ts')))}`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`; modules.set(file, url); return url;
}
const walk = widgets => widgets.flatMap(w => [w, ...walk((w.states ?? []).flatMap(s => s.widgets)), ...walk(w.table?.cells ?? []), ...walk(w.menu ? [w.menu.table, ...w.menu.submenus] : []), ...walk(w.tree?.nodes ?? []), ...walk(w.treeNode ? [w.treeNode.label, ...w.treeNode.children] : [])]);
function withoutAdded(value, added) {
  if (Array.isArray(value)) return value.filter(v => !v || typeof v !== 'object' || !added.has(v.id)).map(v => withoutAdded(v, added));
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, withoutAdded(v, added)])) : value;
}

try {
  const { importRpSemantics } = await import(moduleUrl('src/model/import-rp.ts'));
  const { parseDocument, serializeDocument } = await import(moduleUrl('src/model/document.ts'));
  const baseline = read('research/rotation-import-baseline.json'), census = read('research/rotation-format-census.json');
  const audit = { capturedAt: new Date().toISOString(), method: 'Hash-checked native reader and pure importer. Compare complete documents against immutable pre-rotation baseline after removing only the 12 specifically identified additions. No original GUI execution.', samples: [], totals: { addedWidgets: 0, addedNested: 0, addedEvents: 0, addedActions: 0, rotations: 0, fractionalArrowLines: 0, halfTurnCarats: 0 } };
  for (const old of baseline.samples) {
    assert.equal(sha(old.file), old.sha256); const raw = inspectRpSemantics(old.file);
    const sample = { file: old.file, sha256: old.sha256, compactBytes: Buffer.byteLength(JSON.stringify(raw)) };
    if (old.importError) {
      let error; try { importRpSemantics(raw); } catch (e) { error = e.message; }
      assert.equal(error, old.importError); sample.importError = error; sample.rotations = [];
    } else {
      const { document, report } = importRpSemantics(raw), { issues, ...counts } = report;
      assert.deepEqual(parseDocument(serializeDocument(document)), document);
      sample.import = counts;
      sample.delta = Object.fromEntries(Object.keys(counts).filter(k => typeof counts[k] === 'number').map(k => [k, counts[k] - old.import[k]]));
      const oldIds = new Set(walk(old.document.pages.flatMap(p => p.widgets)).map(w => w.id));
      const widgets = walk(document.pages.flatMap(p => p.widgets)), added = widgets.filter(w => !oldIds.has(w.id)), addedIds = new Set(added.map(w => w.id));
      const candidates = census.candidates.filter(c => c.sourceSha256 === old.sha256);
      assert.deepEqual([...addedIds].sort(), candidates.map(c => `rp-w-${c.packageId}-${c.id}`).sort(), `Unexpected additions: ${old.file}`);
      assert.deepEqual(withoutAdded(document, addedIds), old.document, `Prior document changed: ${old.file}`);
      assert.equal(sample.delta.eventsImported, 0); assert.equal(sample.delta.actionsImported, 0);
      sample.priorCompleteDocumentPreserved = true;
      sample.rotations = added.map(w => {
        const candidate = candidates.find(c => w.id === `rp-w-${c.packageId}-${c.id}`);
        assert.equal(w.rotation, candidate.rotation.value);
        assert.deepEqual([w.x, w.y, w.width, w.height], [candidate.location.value.X, candidate.location.value.Y, candidate.size.value.Width, candidate.size.value.Height]);
        assert.deepEqual(w.vectorPath, candidate.typeCandidate.vectorPath); assert.deepEqual(w.interactions, []);
        const page = document.pages.find(p => walk(p.widgets).some(n => n.id === w.id));
        assert.ok(page.widgets.some(n => n.id === w.id), 'The current corpus additions must be top-level');
        const source = raw.diagrams.find(d => d.packageId === candidate.packageId).widgets.find(n => n.id === candidate.id);
        assert.equal(source.rotationRecovery.status, 'supported-center-rotation');
        return { ...w, pageId: page.id, sourcePackageId: candidate.packageId, sourceId: candidate.id, provenance: source.rotationRecovery, omittedInteractionIssues: issues.filter(i => i.packageId === candidate.packageId && i.sourceId === candidate.id && /interaction|event|action|case/.test(i.code)) };
      });
      for (const [key, reportKey] of [['addedWidgets', 'widgetsImported'], ['addedNested', 'nestedWidgetsImported'], ['addedEvents', 'eventsImported'], ['addedActions', 'actionsImported']]) audit.totals[key] += sample.delta[reportKey];
      audit.totals.rotations += sample.rotations.length;
      audit.totals.fractionalArrowLines += sample.rotations.filter(w => w.rotation === 89.13596303062127 && w.style.lineEnds?.end !== 'none').length;
      audit.totals.halfTurnCarats += sample.rotations.filter(w => w.rotation === 180).length;
    }
    assert.equal(sha(old.file), old.sha256); audit.samples.push(sample);
  }
  assert.deepEqual(audit.totals, { addedWidgets: 12, addedNested: 0, addedEvents: 0, addedActions: 0, rotations: 12, fractionalArrowLines: 6, halfTurnCarats: 6 });
  audit.maximumCompactBytes = Math.max(...audit.samples.map(s => s.compactBytes)); assert.ok(audit.maximumCompactBytes < 32 * 1024 * 1024);
  audit.sources = ['research/rotation-import-audit.mjs', 'research/rotation-import-baseline.json', 'research/rotation-format-census.json', ...['container', 'objects', 'semantics', 'interactions'].map(n => `research/scripts/read-rp-${n}.mjs`), ...[...modules.keys()].map(f => path.relative(process.cwd(), f).replaceAll('\\', '/'))].map(file => ({ file, sha256: sha(file) }));
  fs.writeFileSync('research/rotation-import-audit.json', JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify({ totals: audit.totals, maximumCompactBytes: audit.maximumCompactBytes, samples: audit.samples.map(s => ({ name: path.basename(s.file), delta: s.delta, rotations: s.rotations.length, error: s.importError })) }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
