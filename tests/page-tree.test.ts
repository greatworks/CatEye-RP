import { describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import { addPageNode, deletePageNode, getPageTree, movePageNode, pageDescendantIds, pageTreeEntries, renamePageNode, shiftPageNode } from '../src/model/page-tree';
import type { Document, PageFolder } from '../src/model/types';

function mixed() {
  const doc = createDocument(), landing = doc.pages[0], child = createPage('Child'), last = createPage('Last');
  landing.name = 'Landing';
  const folder: PageFolder = { id: uid(), name: 'Section' }, empty: PageFolder = { id: uid(), name: 'Empty' };
  landing.parentId = folder.id; child.parentId = landing.id;
  doc.pages = [landing, child, last]; doc.pageFolders = [folder, empty];
  doc.pageOrder = [folder.id, landing.id, child.id, empty.id, last.id];
  return { doc, landing, child, last, folder, empty };
}
const ids = (doc: Document) => pageTreeEntries(doc).map(entry => entry.id);
const roundtrip = (doc: Document) => parseDocument(serializeDocument(doc));
function invalid(doc: Document, edit: (value: any) => void) { const next = structuredClone(doc); edit(next); return () => parseDocument(JSON.stringify(next)); }

describe('page/folder schema and canonical ordering', () => {
  it('keeps legacy fields absent, parents intact, and normalizes only out-of-order pages', () => {
    const doc = createDocument(), child = createPage('Child'), peer = createPage('Peer');
    child.parentId = doc.pages[0].id; doc.pages.push(child, peer);
    expect(roundtrip(doc)).toEqual(doc);
    expect(roundtrip(doc)).not.toHaveProperty('pageFolders'); expect(roundtrip(doc)).not.toHaveProperty('pageOrder');
    doc.pages = [child, doc.pages[0], peer];
    const parsed = roundtrip(doc);
    expect(parsed.pages.map(page => page.name)).toEqual(['Page 1', 'Child', 'Peer']);
    expect(parsed.pages[1].parentId).toBe(parsed.pages[0].id);
    expect(parsed).not.toHaveProperty('pageOrder');
  });
  it('produces nested and flat mixed preorder, including pages used as parents and empty folders', () => {
    const { doc, folder, landing, child, empty, last } = mixed();
    expect(getPageTree(doc)).toEqual([
      { id: folder.id, name: 'Section', kind: 'folder', children: [{ id: landing.id, name: 'Landing', kind: 'page', children: [{ id: child.id, name: 'Child', kind: 'page', children: [] }] }] },
      { id: empty.id, name: 'Empty', kind: 'folder', children: [] }, { id: last.id, name: 'Last', kind: 'page', children: [] },
    ]);
    expect(pageTreeEntries(doc)).toEqual([
      { id: folder.id, name: 'Section', kind: 'folder', depth: 0 }, { id: landing.id, name: 'Landing', kind: 'page', parentId: folder.id, depth: 1 },
      { id: child.id, name: 'Child', kind: 'page', parentId: landing.id, depth: 2 }, { id: empty.id, name: 'Empty', kind: 'folder', depth: 0 }, { id: last.id, name: 'Last', kind: 'page', depth: 0 },
    ]);
    expect(roundtrip(doc)).toEqual(doc);
  });
  it('treats a complete permutation as sibling ranks and stores a canonical tree without losing nodes', () => {
    const { doc, folder, landing, child, empty, last } = mixed();
    doc.pages.reverse(); doc.pageFolders!.reverse(); doc.pageOrder = [child.id, empty.id, landing.id, folder.id, last.id];
    const parsed = roundtrip(doc);
    expect(parsed.pageOrder).toEqual([empty.id, folder.id, landing.id, child.id, last.id]);
    expect(parsed.pages.map(page => page.id)).toEqual([landing.id, child.id, last.id]);
    expect(parsed.pageFolders!.map(node => node.id)).toEqual([empty.id, folder.id]);
    expect(roundtrip(parsed)).toEqual(parsed);
  });
  it('supports folders without an explicit order using a stable fallback, without materializing pageOrder', () => {
    const { doc, last, folder, landing, child, empty } = mixed(); delete doc.pageOrder;
    const parsed = roundtrip(doc);
    expect(ids(parsed)).toEqual([last.id, folder.id, landing.id, child.id, empty.id]);
    expect(parsed).not.toHaveProperty('pageOrder');
  });
  it.each(['missing', 'duplicate', 'unknown', 'wrong-type', 'unsafe'])('rejects %s order metadata', mode => {
    const { doc } = mixed();
    expect(invalid(doc, value => {
      if (mode === 'missing') value.pageOrder.pop();
      if (mode === 'duplicate') value.pageOrder[1] = value.pageOrder[0];
      if (mode === 'unknown') value.pageOrder[1] = 'missing-id';
      if (mode === 'wrong-type') value.pageOrder[1] = 123;
      if (mode === 'unsafe') value.pageOrder[1] = '__proto__';
    })).toThrow(/pageOrder|identifier/);
  });
  it.each(['folder-self', 'mixed-cycle', 'missing-parent', 'page-self'])('rejects %s without silently dropping a subtree', mode => {
    const { doc } = mixed();
    expect(invalid(doc, value => {
      if (mode === 'folder-self') value.pageFolders[0].parentId = value.pageFolders[0].id;
      if (mode === 'mixed-cycle') value.pageFolders[0].parentId = value.pages[1].id;
      if (mode === 'missing-parent') value.pages[0].parentId = 'missing';
      if (mode === 'page-self') value.pages[2].parentId = value.pages[2].id;
    })).toThrow(/parentId/);
  });
  it('rejects folder IDs colliding with a page, nested widget, document, style or component', () => {
    const { doc } = mixed(), panel = createWidget('panel'), nested = createWidget('text');
    panel.states![0].widgets.push(nested); doc.pages[0].widgets.push(panel);
    const component = { id: uid(), name: 'Component', widgets: [], width: 100, height: 100 }; doc.components.push(component);
    const style = { id: uid(), name: 'Style', style: nested.style }; doc.styles.push(style);
    for (const id of [doc.id, doc.pages[0].id, nested.id, style.id, component.id, doc.pageFolders![1].id]) expect(invalid(doc, value => { value.pageFolders[0].id = id; })).toThrow(/duplicate identifier/);
  });
  it('strictly validates folder fields, names and IDs', () => {
    const { doc } = mixed();
    for (const field of ['widgets', 'kind', 'background']) expect(invalid(doc, value => { value.pageFolders[0][field] = []; })).toThrow(/unknown field/);
    expect(invalid(doc, value => { value.pageFolders[0].name = 1; })).toThrow(/string/);
    expect(invalid(doc, value => { value.pageFolders[0].name = 'x'.repeat(501); })).toThrow(/500/);
    expect(invalid(doc, value => { value.pageFolders[0].id = ''; })).toThrow(/identifier/);
    expect(invalid(doc, value => { value.pageFolders[0].parentId = false; })).toThrow(/string/);
    expect(invalid(doc, value => { value.pageFolders = null; })).toThrow(/array/);
    const text = JSON.stringify(doc).replace('"name":"Section"', '"name":"Section","__proto__":{}');
    expect(() => parseDocument(text)).toThrow(/unsafe key/);
  });
  it('accepts 200 folders and rejects the 201st; the page limit stays separate', () => {
    const doc = createDocument(); doc.pageFolders = Array.from({ length: 200 }, (_, i) => ({ id: uid(), name: `Folder ${i}` }));
    expect(roundtrip(doc).pageFolders).toHaveLength(200);
    expect(invalid(doc, value => { value.pageFolders.push({ id: uid(), name: 'Too many' }); })).toThrow(/200/);
    expect(() => addPageNode(doc, { kind: 'folder', name: 'Too many' })).toThrow(/200/);
  });
  it('permits exactly twelve mixed levels and rejects the thirteenth including legacy page-only chains', () => {
    const doc = createDocument(); doc.pageFolders = Array.from({ length: 11 }, (_, i) => ({ id: `folder-${i}`, name: `F${i}`, ...(i ? { parentId: `folder-${i - 1}` } : {}) }));
    doc.pages[0].parentId = 'folder-10';
    expect(pageTreeEntries(roundtrip(doc)).at(-1)!.depth).toBe(11);
    expect(invalid(doc, value => { value.pageFolders.push({ id: 'extra', name: 'Extra', parentId: 'folder-10' }); value.pages[0].parentId = 'extra'; })).toThrow(/12 levels/);
    const legacy = createDocument();
    for (let i = 1; i <= 12; i++) legacy.pages.push({ ...createPage(), parentId: legacy.pages.at(-1)!.id });
    expect(() => roundtrip(legacy)).toThrow(/12 levels/);
  });
});

describe('pure page tree editing', () => {
  it('adds independent pages before/after/inside and folders at root without changing existing content', () => {
    const { doc, landing, child, folder, empty, last } = mixed(), snapshot = structuredClone(doc);
    const a = addPageNode(doc, { kind: 'page', name: 'Before' }, landing.id, 'before');
    expect(a.document.pageOrder).toEqual([folder.id, a.id, landing.id, child.id, empty.id, last.id]);
    expect(a.document.pages.find(page => page.id === a.id)).toMatchObject({ name: 'Before', parentId: folder.id, width: 1200, height: 900, widgets: [] });
    const b = addPageNode(a.document, { kind: 'folder', name: 'After subtree' }, landing.id, 'after');
    expect(b.document.pageOrder).toEqual([folder.id, a.id, landing.id, child.id, b.id, empty.id, last.id]);
    const c = addPageNode(b.document, { kind: 'page', name: 'Last child' }, landing.id, 'inside');
    expect(c.document.pages.find(page => page.id === c.id)!.parentId).toBe(landing.id);
    expect(c.document.pageOrder).toEqual([folder.id, a.id, landing.id, child.id, c.id, b.id, empty.id, last.id]);
    const d = addPageNode(c.document, { kind: 'folder', name: 'Root tail' });
    expect(d.document.pageOrder!.at(-1)).toBe(d.id);
    expect(d.document.pageFolders!.find(f => f.id === d.id)).not.toHaveProperty('parentId');
    expect(doc).toEqual(snapshot); expect(roundtrip(d.document)).toEqual(d.document);
    expect(d.document.pages.find(page => page.id === landing.id)).toBe(landing);
  });
  it('rejects invalid add targets/positions/names and excessive depth without changing the document', () => {
    const { doc } = mixed(), snapshot = structuredClone(doc);
    for (const position of ['before', 'after', 'inside'] as const) expect(() => addPageNode(doc, { kind: 'page', name: 'x' }, 'missing', position)).toThrow(/target/);
    expect(() => addPageNode(doc, { kind: 'page', name: 'x' }, undefined, 'bogus' as any)).toThrow(/position/);
    expect(() => addPageNode(doc, { kind: 'page', name: 'x'.repeat(501) })).toThrow(/500/);
    expect(doc).toEqual(snapshot);
    const deep = createDocument(); let current = deep;
    for (let i = 1; i < 12; i++) current = addPageNode(current, { kind: 'page', name: String(i) }, current.pages.at(-1)!.id, 'inside').document;
    expect(() => addPageNode(current, { kind: 'folder', name: 'Too deep' }, current.pages.at(-1)!.id, 'inside')).toThrow(/12 levels/);
  });
  it('moves complete subtrees across mixed sibling lists and keeps the real landing page order synchronized', () => {
    const { doc, folder, landing, child, empty, last } = mixed(), before = structuredClone(doc);
    const next = movePageNode(doc, folder.id, last.id, 'after');
    expect(next.pageOrder).toEqual([empty.id, last.id, folder.id, landing.id, child.id]);
    expect(next.pages.map(page => page.id)).toEqual([last.id, landing.id, child.id]);
    expect(next.pages[1]).toBe(landing); expect(next.pages[2]).toBe(child);
    expect(doc).toEqual(before); expect(roundtrip(next)).toEqual(next);
    const nested = movePageNode(next, folder.id, last.id, 'inside');
    expect(nested.pageFolders!.find(node => node.id === folder.id)!.parentId).toBe(last.id);
    expect(nested.pages.find(page => page.id === landing.id)!.parentId).toBe(folder.id);
    expect(nested.pages.find(page => page.id === child.id)!.parentId).toBe(landing.id);
  });
  it('reparents before/after a target, removes parentId when moving to root, and never loses descendants', () => {
    const { doc, landing, child, folder, empty, last } = mixed();
    const next = movePageNode(doc, landing.id, last.id, 'before');
    expect(next.pageOrder).toEqual([folder.id, empty.id, landing.id, child.id, last.id]);
    expect(next.pages[0]).not.toHaveProperty('parentId'); expect(next.pages[1].parentId).toBe(landing.id);
    expect(pageDescendantIds(next, landing.id)).toEqual(new Set([landing.id, child.id]));
    expect(pageDescendantIds(next, 'missing')).toEqual(new Set());
  });
  it('returns the exact original document for cycles, descendant drops, nonexistent IDs and no-op slots', () => {
    const { doc, folder, landing, child, empty, last } = mixed();
    for (const position of ['before', 'after', 'inside'] as const) {
      expect(movePageNode(doc, folder.id, child.id, position)).toBe(doc);
      expect(movePageNode(doc, landing.id, landing.id, position)).toBe(doc);
      expect(movePageNode(doc, 'missing', last.id, position)).toBe(doc);
      expect(movePageNode(doc, last.id, 'missing', position)).toBe(doc);
    }
    expect(movePageNode(doc, folder.id, empty.id, 'before')).toBe(doc);
    expect(movePageNode(doc, empty.id, folder.id, 'after')).toBe(doc);
    expect(movePageNode(doc, child.id, landing.id, 'inside')).toBe(doc);
    expect(movePageNode(doc, last.id, folder.id, 'bogus' as any)).toBe(doc);
    const legacy = createDocument(); legacy.pages.push(createPage('Next'));
    expect(movePageNode(legacy, legacy.pages[0].id, legacy.pages[1].id, 'before')).toBe(legacy);
    expect(legacy).not.toHaveProperty('pageOrder');
  });
  it('returns the original document when a subtree move would exceed twelve levels', () => {
    const doc = createDocument();
    doc.pageFolders = Array.from({ length: 12 }, (_, i) => ({ id: `f-${i}`, name: String(i), ...(i ? { parentId: `f-${i - 1}` } : {}) }));
    expect(movePageNode(doc, doc.pages[0].id, 'f-11', 'inside')).toBe(doc);
    expect(roundtrip(doc).pages).toEqual(doc.pages);
  });
  it('shifts up/down as complete sibling blocks, indents under the previous sibling, and outdents after the parent subtree', () => {
    const { doc, folder, landing, child, empty, last } = mixed();
    const down = shiftPageNode(doc, folder.id, 'down');
    expect(down.pageOrder).toEqual([empty.id, folder.id, landing.id, child.id, last.id]);
    expect(shiftPageNode(down, folder.id, 'up').pageOrder).toEqual(doc.pageOrder);
    const indented = shiftPageNode(doc, last.id, 'indent');
    expect(indented.pages.find(page => page.id === last.id)!.parentId).toBe(empty.id);
    expect(shiftPageNode(indented, last.id, 'outdent').pageOrder).toEqual(doc.pageOrder);
    const out = shiftPageNode(doc, child.id, 'outdent');
    expect(out.pages.find(page => page.id === child.id)!.parentId).toBe(folder.id);
    expect(out.pageOrder).toEqual([folder.id, landing.id, child.id, empty.id, last.id]);
  });
  it('shift boundary cases, unknown IDs and same-name rename are reference no-ops', () => {
    const { doc, folder, last } = mixed();
    for (const direction of ['up', 'indent', 'outdent'] as const) expect(shiftPageNode(doc, folder.id, direction)).toBe(doc);
    expect(shiftPageNode(doc, last.id, 'down')).toBe(doc);
    expect(shiftPageNode(doc, 'missing', 'up')).toBe(doc);
    expect(renamePageNode(doc, folder.id, folder.name)).toBe(doc);
    expect(renamePageNode(doc, 'missing', 'Changed')).toBe(doc);
    expect(deletePageNode(doc, 'missing')).toBe(doc);
  });
  it('renames without changing IDs, links, content, metadata, or absent legacy fields', () => {
    const { doc, landing, folder } = mixed(), button = createWidget('button');
    button.interactions = [{ id: uid(), name: 'Link', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'openPage', targetId: landing.id }] }];
    doc.pages[2].widgets.push(button); doc.variables = { Keep: 'value' };
    const renamed = renamePageNode(renamePageNode(doc, landing.id, 'Renamed page'), folder.id, 'Renamed folder');
    expect(renamed.pages[2].widgets[0]).toBe(button); expect(renamed.variables).toBe(doc.variables);
    expect(renamed.pageOrder).toBe(doc.pageOrder); expect(renamed.pages[0].id).toBe(landing.id);
    expect(renamed.pages[0].widgets).toBe(landing.widgets); expect(roundtrip(renamed)).toEqual(renamed);
    const legacy = createDocument(), next = renamePageNode(legacy, legacy.pages[0].id, 'Legacy renamed');
    expect(next).not.toHaveProperty('pageFolders'); expect(next).not.toHaveProperty('pageOrder');
  });
  it('deletes all descendants recursively, retains external dangling links, and refuses to delete the last real page', () => {
    const { doc, folder, landing, last, empty } = mixed(), button = createWidget('button');
    button.interactions = [{ id: uid(), name: 'Link', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'openPage', targetId: landing.id }] }];
    last.widgets.push(button); const before = structuredClone(doc);
    const next = deletePageNode(doc, folder.id);
    expect(next.pages).toEqual([last]); expect(next.pageFolders).toEqual([empty]); expect(next.pageOrder).toEqual([empty.id, last.id]);
    expect(next.pages[0].widgets[0].interactions[0].actions[0].targetId).toBe(landing.id);
    expect(roundtrip(next)).toEqual(next); expect(doc).toEqual(before);
    expect(() => deletePageNode(next, last.id)).toThrow(/at least one page/);
    const only = createDocument(), parent = addPageNode(only, { kind: 'folder', name: 'Parent' });
    const nested = movePageNode(parent.document, only.pages[0].id, parent.id, 'inside');
    expect(() => deletePageNode(nested, parent.id)).toThrow(/at least one page/);
  });
  it('deletes an empty folder while preserving one real page and an empty folder carrier', () => {
    const doc = createDocument(), added = addPageNode(doc, { kind: 'folder', name: 'Empty' });
    const next = deletePageNode(added.document, added.id);
    expect(next.pages).toEqual(doc.pages); expect(next.pageFolders).toEqual([]); expect(next.pageOrder).toEqual([doc.pages[0].id]);
    expect(roundtrip(next)).toEqual(next);
  });
});
