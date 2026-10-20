import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { recoverPageTree, recoverRpSemantics, property as get } from './read-rp-semantics.mjs';

const sample = name => fileURLToPath(new URL(`../samples/${name}`, import.meta.url));
const evidence = JSON.parse(readFileSync(new URL('../page-management-evidence.json', import.meta.url), 'utf8'));
const data = new Map(evidence.samples.map(({ file }) => [file, inspectRpObjects(sample(file))]));
const set = (object, key, value) => { const pair = object.properties.$map.find(pair => pair[0] === key); if (pair) pair[1] = value; else object.properties.$map.push([key, value]); };
const local = id => ({ $reference: id, referenceTag: 3 });
function graph(source) {
  const pack = source.packages.find(pack => pack.path === 'DesignDocument'), objects = new Map(pack.objects.map(object => [object.id, object]));
  const root = objects.get(pack.rootId), sitemap = objects.get(get(root.properties, 'sitemap').$reference), tree = objects.get(get(sitemap.properties, 'tree').$reference);
  const pairs = get(sitemap.properties, 'node-table').$map;
  return { pack, objects, root, sitemap, tree, pairs, node: objects.get(pairs[0][0].$reference), folderPairs: pairs.filter(pair => pair[1].referenceTag === 3), pagePairs: pairs.filter(pair => pair[1].referenceTag === 19) };
}

for (const saved of evidence.samples) test(`actual ${saved.file} recovers the independently recorded tree and source hashes`, () => {
  const source = data.get(saved.file), before = JSON.stringify(source), result = recoverPageTree(source);
  assert.equal(source.fileSha256, saved.fileSha256);
  assert.equal(result.status, 'supported-page-tree');
  assert.equal(result.sourcePartSha256, saved.designDocumentSha256);
  assert.equal(result.treeId, saved.treeId);
  assert.deepEqual(result.nodes, saved.nodes.map(({ nodeId, parentNodeId, kind, name, packageId, folderId }) => ({ nodeId, parentNodeId, kind, ...(kind === 'page' ? { packageId } : { folderId }), name })));
  assert.equal(result.nodes.filter(node => node.kind === 'page').length, saved.pageCount);
  assert.equal(result.nodes.filter(node => node.kind === 'folder').length, saved.folderCount);
  assert.equal(JSON.stringify(source), before);
});

test('children order wins over reverse node-table and PackageInfos order', () => {
  const source = structuredClone(data.get('UX Prototyping.rp')), expected = recoverPageTree(source), g = graph(source);
  g.pairs.reverse(); get(g.root.properties, 'PackageInfos').reverse(); g.pack.objects.reverse();
  assert.deepEqual(recoverPageTree(source), expected);
  assert.equal(expected.nodes[0].name, 'Overview');
  assert.equal(expected.nodes.filter(node => node.kind === 'folder' && node.name === 'Exploration').length, 2);
  assert.equal(new Set(expected.nodes.filter(node => node.kind === 'folder').map(node => node.folderId)).size, 6);
});

test('documented page-child edges use the same Node grammar (synthetic topology, not native GUI observation)', () => {
  const source = structuredClone(data.get('complex-interactions-required-fields.rp')), g = graph(source), [first, second] = get(g.tree.properties, 'children');
  set(g.tree, 'children', [first]); set(g.objects.get(first.$reference), 'children', [second]); set(g.objects.get(second.$reference), 'parent-node', first);
  const result = recoverPageTree(source);
  assert.equal(result.status, 'supported-page-tree'); assert.equal(result.nodes[1].parentNodeId, result.nodes[0].nodeId);
});

test('excessive nesting is rejected without recursively exhausting the reader', () => {
  const source = structuredClone(data.get('UX Prototyping.rp')), g = graph(source), ids = g.pairs.map(pair => pair[0].$reference);
  set(g.tree, 'children', [local(ids[0])]);
  ids.forEach((id, index) => { const node = g.objects.get(id); set(node, 'parent-node', local(index ? ids[index - 1] : g.tree.id)); set(node, 'children', index + 1 < ids.length ? [local(ids[index + 1])] : []); });
  const result = recoverPageTree(source); assert.equal(result.status, 'unsupported-page-tree'); assert.match(result.reason, /depth/); assert.deepEqual(result.nodes, []);
});

const corruptions = [
  ['missing DesignDocument', source => { source.packages = source.packages.filter(pack => pack.path !== 'DesignDocument'); }],
  ['duplicate DesignDocument', (source, g) => source.packages.push(structuredClone(g.pack))],
  ['duplicate local identity', (_source, g) => g.pack.objects.push(structuredClone(g.node))],
  ['unknown sitemap tag', (_source, g) => { get(g.root.properties, 'sitemap').referenceTag = 19; }],
  ['unknown sitemap type', (_source, g) => { g.sitemap.type = 'Axure:MasterTreeMap'; }],
  ['tree self reference', (_source, g) => set(g.tree, 'tree', local('f'.repeat(32)))],
  ['missing PackageInfos', (_source, g) => set(g.root, 'PackageInfos', null)],
  ['duplicate PackageInfos reference', (_source, g) => get(g.root.properties, 'PackageInfos').push(get(g.root.properties, 'PackageInfos')[0])],
  ['PackageInfo tag mismatch', (_source, g) => { const info=g.pack.objects.find(object => object.type === 'Axure:PackageInfo' && get(object.properties,'package-id')?.name === 'Axure:Page'); get(info.properties,'package-id').referenceTag=3; }],
  ['page PackageInfo omitted', (_source, g) => { const info=g.pack.objects.find(object => object.type === 'Axure:PackageInfo' && get(object.properties,'package-id')?.name === 'Axure:Page'); set(g.root,'PackageInfos',get(g.root.properties,'PackageInfos').filter(ref=>ref.$reference!==info.id)); }],
  ['missing page package', (source, g) => { source.packages=source.packages.filter(pack=>pack.packageId!==g.pagePairs[0][1].$reference); }],
  ['duplicate page package', (source, g) => source.packages.push(structuredClone(source.packages.find(pack=>pack.packageId===g.pagePairs[0][1].$reference)))],
  ['page package carrier mismatch', (source, g) => { source.packages.find(pack=>pack.packageId===g.pagePairs[0][1].$reference).path='other/package'; }],
  ['missing node table', (_source, g) => set(g.sitemap, 'node-table', null)],
  ['duplicate node-table entry', (_source, g) => g.pairs.push(structuredClone(g.pairs[0]))],
  ['invalid node-table key', (_source, g) => { g.pairs[0][0].referenceTag = 19; }],
  ['children missing', (_source, g) => set(g.node, 'children', null)],
  ['unknown child', (_source, g) => get(g.tree.properties, 'children').push(local('f'.repeat(32)))],
  ['duplicate attachment', (_source, g) => get(g.tree.properties, 'children').push(get(g.tree.properties, 'children')[0])],
  ['wrong reciprocal parent', (_source, g) => set(g.node, 'parent-node', local('f'.repeat(32)))],
  ['wrong owning tree', (_source, g) => set(g.node, 'tree', local('f'.repeat(32)))],
  ['unreachable table entry', (_source, g) => { const id='e'.repeat(32),node=structuredClone(g.node);node.id=id;g.pack.objects.push(node);g.pairs.push([local(id),g.pagePairs[0][1]]); }],
  ['orphan node outside node table', (_source, g) => { const node=structuredClone(g.node);node.id='e'.repeat(32);g.pack.objects.push(node); }],
  ['page contents tag/name mismatch', (_source, g) => { g.pagePairs[0][1].name = 'Axure:Page'; }],
  ['duplicate page attachment', (_source, g) => { g.pagePairs[1][1] = structuredClone(g.pagePairs[0][1]); }],
  ['folder contents type mismatch', (_source, g) => { g.objects.get(g.folderPairs[0][1].$reference).type = 'Axure:Page'; }],
  ['folder identity missing', (_source, g) => set(g.objects.get(g.folderPairs[0][1].$reference), 'folder-id', null)],
  ['duplicate folder GUID', (_source, g) => set(g.objects.get(g.folderPairs[1][1].$reference),'folder-id',get(g.objects.get(g.folderPairs[0][1].$reference).properties,'folder-id'))],
  ['unknown folder name', (_source, g) => set(g.objects.get(g.folderPairs[0][1].$reference),'name',null)],
  ['ambiguous property', (_source, g) => g.node.properties.$map.push(['children', []])],
];
for (const [label, corrupt] of corruptions) test(`atomic tree rejection: ${label}`, () => {
  const source = structuredClone(data.get('UX Prototyping.rp')); corrupt(source, graph(source));
  const result = recoverPageTree(source);
  assert.equal(result.status, 'unsupported-page-tree'); assert.equal(typeof result.reason, 'string'); assert.deepEqual(result.nodes, []);
});

test('a corrupt hierarchy keeps all existing semantic diagrams and widgets', () => {
  const source = structuredClone(data.get('the-basics-tab-menu.rp')), expected = recoverRpSemantics(source), g = graph(source);
  set(g.node, 'parent-node', local('f'.repeat(32)));
  const result = recoverRpSemantics(source);
  assert.equal(result.pageTreeRecovery.status, 'unsupported-page-tree');
  assert.deepEqual(result.diagrams, expected.diagrams);
  assert.deepEqual(result.packageFailures, expected.packageFailures); assert.deepEqual(result.semanticFailures, expected.semanticFailures);
});
