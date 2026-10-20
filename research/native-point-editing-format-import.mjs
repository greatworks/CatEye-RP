// Fresh complete UI sample import, then exact rectangular Shape300 witness extraction.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { inspectRpSemantics } from './scripts/read-rp-semantics.mjs';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pin = file => ({ file, sha256:sha(file) });
const modules = new Map();
function url(file) {
  file = path.resolve(file); if (modules.has(file)) return modules.get(file);
  const source = stripTypeScriptTypes(fs.readFileSync(file, 'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,
    (_, q, ref) => `from ${JSON.stringify(url(path.resolve(path.dirname(file), ref.endsWith('.ts') ? ref : ref + '.ts')))}`);
  const value = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64'); modules.set(file, value); return value;
}
const { importRpSemantics } = await import(url('src/model/import-rp.ts'));
const { parseDocument, serializeDocument } = await import(url('src/model/document.ts'));
const inventory = JSON.parse(fs.readFileSync('research/native-point-editing-format-inventory.json', 'utf8'));
const witnesses = inventory.rawWitnesses.filter(w => w.witnessKind === 'custom-identity-exact-rectangle');
const sample = witnesses[0].sample;
assert.equal(sha(sample.file), sample.sha256);
const semantics = inspectRpSemantics(sample.file), imported = importRpSemantics(semantics);
assert.deepEqual(parseDocument(serializeDocument(imported.document)), imported.document);
const walk = (ws, parent) => ws.flatMap(w => [{ widget:w, parent },
  ...walk(w.states?.flatMap(s=>s.widgets) ?? [], w.id), ...walk(w.table?.cells ?? [], w.id),
  ...walk(w.menu ? [w.menu.table, ...w.menu.submenus] : [], w.id), ...walk(w.tree?.nodes ?? [], w.id),
  ...walk(w.treeNode ? [w.treeNode.label,...w.treeNode.children] : [],w.id), ...walk(w.repeater?.template ?? [], w.id)]);
const widgets = witnesses.map(source => {
  const id = `rp-w-${source.packageId}-${source.sourceId}`;
  const page = imported.document.pages.find(p => walk(p.widgets).some(w => w.widget.id === id));
  assert.ok(page, 'Actual complete import must contain witness');
  const found = walk(page.widgets).find(w => w.widget.id === id);
  assert.equal(found.widget.type, 'path');
  assert.equal(found.widget.style.cornerVisibility, undefined);
  assert.deepEqual(found.widget.vectorPath.commands, [
    {op:'M',x:1,y:0}, {op:'L',x:1,y:1}, {op:'L',x:0,y:1}, {op:'L',x:0,y:0}, {op:'L',x:1,y:0}, {op:'Z'}]);
  return {sourceId:source.sourceId,packageId:source.packageId,sourcePartSha256:source.sourcePartSha256,
    samplePath:sample.file,sampleSha256:sample.sha256,sourceShape:300,pageId:page.id,parentId:found.parent,widget:found.widget};
});
// This fixture is explicitly an extraction, not an original native document.
// Shared metadata is retained; only page widget arrays are filtered to the exact two witnesses.
const document = { ...imported.document, name:'Extracted native Shape300 rectangle witnesses',
  pages: imported.document.pages.filter(p => widgets.some(w => w.pageId === p.id)).map(p => ({
    ...p, parentId:undefined, adaptiveViews:[], adaptiveOverrides:undefined,
    widgets:widgets.filter(w => w.pageId === p.id).map(w => w.widget) })),
  pageFolders:undefined,pageOrder:undefined };
const normalized = parseDocument(serializeDocument(document));
const fixtureFile = 'research/native-point-editing-format-custom-rectangles.rea.json';
fs.writeFileSync(fixtureFile, serializeDocument(normalized));
assert.equal(sha(sample.file), sample.sha256);
const output = { capturedAt:new Date().toISOString(),
  method:'Original complete UI raw container → object reader → semantics → complete importer → save/readback; two actual imported widgets extracted without changing their IDs, geometry, paths, styles, text or interactions. The new two-page fixture is explicitly a research extraction.',
  sample, report:imported.report, widgets, fixture:pin(fixtureFile),
  sources:['research/native-point-editing-format-import.mjs','research/native-point-editing-format-inventory.json',
    'research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-container.mjs',
    ...[...modules.keys()].map(f=>path.relative(process.cwd(),f).replaceAll('\\','/'))].map(pin) };
fs.writeFileSync('research/native-point-editing-format-import.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({widgets:widgets.map(w=>({sourceId:w.sourceId,type:w.widget.type,parentId:w.parentId,interactions:w.widget.interactions})),fixture:output.fixture},null,2));
