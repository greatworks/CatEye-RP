import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDocument, serializeDocument } from '../src/model/document';
import { importRpSemantics } from '../src/model/import-rp';
import { pageTreeEntries, renamePageNode } from '../src/model/page-tree';

const script = fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs', import.meta.url));
const read = (name: string) => JSON.parse(execFileSync(process.execPath, [script, fileURLToPath(new URL(`../research/samples/${name}`, import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
const samples = new Map(['UX Prototyping.rp', 'Default.rplib', 'complex-interactions-required-fields.rp'].map(name => [name, read(name)]));
type Recovery = ReturnType<typeof read>;
const clone = (name = 'UX Prototyping.rp'): Recovery => structuredClone(samples.get(name));

describe('native RP page-tree boundary and identity preservation', () => {
  it.each([
    ['UX Prototyping.rp', 10, 6, 'Overview'],
    ['Default.rplib', 40, 5, 'Box 1'],
    ['complex-interactions-required-fields.rp', 2, 0, 'Page 1'],
  ] as const)('recovers the actual %s tree without changing widget/interaction counts', (name, pageCount, folderCount, firstPage) => {
    const source = clone(name), before = JSON.stringify(source), legacy = structuredClone(source); delete legacy.pageTreeRecovery;
    const recovered = importRpSemantics(source), flat = importRpSemantics(legacy);
    expect(recovered.document.pages).toHaveLength(pageCount); expect(recovered.document.pageFolders).toHaveLength(folderCount);
    expect(recovered.document.pageOrder).toHaveLength(pageCount + folderCount);
    expect(recovered.document.pages[0].name).toBe(firstPage);
    expect(recovered.report.issues.some(issue => issue.code === 'page-tree-recovered')).toBe(true);
    expect(recovered.report.issues.some(issue => issue.code === 'page-tree-omitted')).toBe(false);
    for (const key of ['pagesImported', 'widgetsImported', 'widgetsSkipped', 'nestedWidgetsImported', 'nestedWidgetsSkipped', 'eventsImported', 'actionsImported'] as const) expect(recovered.report[key]).toBe(flat.report[key]);
    for (const page of recovered.document.pages) {
      const { parentId: _parent, ...content } = page;
      expect(content).toEqual(flat.document.pages.find(old => old.id === page.id));
    }
    expect(parseDocument(serializeDocument(recovered.document))).toEqual(recovered.document);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('preserves duplicate folder names, nested folder ancestry and exact sibling order', () => {
    const { document } = importRpSemantics(clone()), entries = pageTreeEntries(document);
    expect(entries.map(({ name, kind, depth }) => [name, kind, depth])).toEqual([
      ['Overview','page',0], ['Exploration','folder',0], ['Problems and ideas','page',1], ['Inspiration','page',1], ['Concept prototypes','page',1],
      ['Solution','folder',0], ['Solution prototype','page',1], ['Sample','folder',0], ['Sample Overview','page',1], ['Exploration','folder',1],
      ['Sample problems and ideas','page',2], ['Sample concept prototypes','page',2], ['Solution','folder',1], ['Sample UX prototype','folder',2],
      ['Request email','page',3], ['Manage time off','page',3],
    ]);
    const repeated = document.pageFolders!.filter(folder => folder.name === 'Exploration');
    expect(repeated).toHaveLength(2); expect(repeated[0].id).not.toBe(repeated[1].id);
    expect(repeated[0].parentId).toBeUndefined(); expect(repeated[1].parentId).toBe(document.pageFolders!.find(folder => folder.name === 'Sample')!.id);
  });

  it('GUID-based links survive source reordering, renaming and project round-trip', () => {
    const source = clone('complex-interactions-required-fields.rp');
    source.pageTreeRecovery.nodes.reverse();
    const { document, report } = importRpSemantics(source);
    expect(report.eventsImported).toBeGreaterThan(0);
    expect(document.pages[0].name).toBe('Page 2');
    const target = document.pages.find(page => page.name === 'Page 2')!;
    const actions = document.pages.flatMap(page => page.widgets.flatMap(widget => widget.interactions.flatMap(interaction => interaction.actions))).filter(action => action.type === 'openPage');
    expect(actions.length).toBeGreaterThan(0); expect(actions.every(action => action.targetId === target.id)).toBe(true);
    const renamed = renamePageNode(document, target.id, '重命名 / literal [[Page]]');
    const reopened = parseDocument(serializeDocument(renamed));
    expect(reopened.pages[0]).toMatchObject({ id: target.id, name: '重命名 / literal [[Page]]' });
    expect(reopened.pages.flatMap(page => page.widgets.flatMap(widget => widget.interactions.flatMap(interaction => interaction.actions))).filter(action => action.type === 'openPage')).toEqual(actions);
  });

  it('uses a distinct deterministic namespace even when a native folder GUID equals a page package GUID', () => {
    const source = clone(), nodes = source.pageTreeRecovery.nodes;
    const page = nodes.find((node: Recovery) => node.kind === 'page'), folder = nodes.find((node: Recovery) => node.kind === 'folder');
    folder.folderId = page.packageId;
    const { document } = importRpSemantics(source);
    expect(document.pages.some(page => page.id === `rp-p-${folder.folderId}`)).toBe(true);
    expect(document.pageFolders!.some(item => item.id === `rp-f-${folder.folderId}`)).toBe(true);
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });

  it('legacy semantics without tree metadata keeps its flat order and widgets', () => {
    const source = clone(); delete source.pageTreeRecovery;
    const { document, report } = importRpSemantics(source);
    expect(document.pages[0].name).toBe('Problems and ideas');
    expect(document.pageFolders).toBeUndefined(); expect(document.pageOrder).toBeUndefined();
    expect(document.pages.every(page => page.parentId === undefined)).toBe(true);
    expect(report.issues.find(issue => issue.code === 'page-tree-omitted')?.message).toContain('旧版');
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });

  const corruptions: [string, (source: Recovery) => void][] = [
    ['unsupported recovery', source => { source.pageTreeRecovery = { status: 'unsupported-page-tree', reason: 'Broken native tree', nodes: [] }; }],
    ['invalid provenance', source => { source.pageTreeRecovery.sourcePartSha256 = 'unknown'; }],
    ['duplicate node IDs', source => { source.pageTreeRecovery.nodes[1].nodeId = source.pageTreeRecovery.nodes[0].nodeId; }],
    ['unknown parent', source => { source.pageTreeRecovery.nodes[0].parentNodeId = 'f'.repeat(32); }],
    ['implicit missing root parent', source => { delete source.pageTreeRecovery.nodes[0].parentNodeId; }],
    ['self-cycle', source => { const node=source.pageTreeRecovery.nodes[0];node.parentNodeId=node.nodeId; }],
    ['unknown package', source => { source.pageTreeRecovery.nodes[0].packageId = 'f'.repeat(32); }],
    ['missing page node', source => { source.pageTreeRecovery.nodes.shift(); }],
    ['unimported page', source => { source.diagrams=source.diagrams.filter((diagram:Recovery)=>diagram.packageId!==source.pageTreeRecovery.nodes[0].packageId); }],
    ['duplicate page reference', source => { const pages=source.pageTreeRecovery.nodes.filter((node:Recovery)=>node.kind==='page');pages[1].packageId=pages[0].packageId;pages[1].name=pages[0].name; }],
    ['duplicate folder GUID', source => { const folders=source.pageTreeRecovery.nodes.filter((node:Recovery)=>node.kind==='folder');folders[1].folderId=folders[0].folderId; }],
    ['mismatched name', source => { source.pageTreeRecovery.nodes[0].name='Different name'; }],
    ['unknown node type', source => { source.pageTreeRecovery.nodes[0].kind='component'; }],
    ['mixed page/folder carrier', source => { source.pageTreeRecovery.nodes[0].folderId='f'.repeat(32); }],
    ['noncanonical preorder', source => { const nodes=source.pageTreeRecovery.nodes;const child=nodes.splice(2,1)[0];nodes.push(child); }],
    ['excessive hierarchy depth', source => { const nodes=source.pageTreeRecovery.nodes;nodes.forEach((node:Recovery,index:number)=>{node.parentNodeId=index?nodes[index-1].nodeId:null;}); }],
  ];
  it.each(corruptions)('falls back atomically for %s while preserving imported content', (_label, mutate) => {
    const source = clone(); mutate(source); const before = JSON.stringify(source), legacy = structuredClone(source); delete legacy.pageTreeRecovery;
    const result = importRpSemantics(source), expected = importRpSemantics(legacy);
    expect(result.document).toEqual(expected.document);
    expect(result.document.pageFolders).toBeUndefined(); expect(result.document.pageOrder).toBeUndefined();
    expect(result.report.issues.some(issue => issue.code === 'page-tree-omitted')).toBe(true);
    expect(result.report.widgetsImported).toBe(expected.report.widgetsImported);
    expect(result.report.actionsImported).toBe(expected.report.actionsImported);
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
    expect(JSON.stringify(source)).toBe(before);
  });
});
