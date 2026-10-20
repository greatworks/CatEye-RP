import type { Document } from './types';

export type PageNodeKind = 'page' | 'folder';
export interface PageTreeNode { id: string; name: string; kind: PageNodeKind; children: PageTreeNode[] }
export interface PageTreeEntry { id: string; name: string; kind: PageNodeKind; parentId?: string; depth: number }
export const PAGE_TREE_LIMITS = { pages: 200, folders: 200, levels: 12 } as const;
type PageTreeDocument = Pick<Document, 'pages' | 'pageFolders' | 'pageOrder'>;
const fail = (message: string): never => { throw new Error(`Invalid project at document.pageTree: ${message}`); };

/** Type-only dependency: the document parser can validate/order trees without a factory cycle. */
export function getPageTree(doc: PageTreeDocument): PageTreeNode[] {
  if (!doc.pages.length || doc.pages.length > PAGE_TREE_LIMITS.pages) fail('expected 1..200 pages');
  if ((doc.pageFolders?.length ?? 0) > PAGE_TREE_LIMITS.folders) fail('expected at most 200 folders');
  const records = [
    ...doc.pages.map(page => ({ id: page.id, name: page.name, parentId: page.parentId, kind: 'page' as const })),
    ...(doc.pageFolders ?? []).map(folder => ({ ...folder, kind: 'folder' as const })),
  ];
  const byId = new Map(records.map(node => [node.id, node]));
  if (byId.size !== records.length) fail('duplicate page/folder identifier');
  const order = doc.pageOrder ?? records.map(node => node.id);
  if (order.length !== records.length || new Set(order).size !== records.length || order.some(id => !byId.has(id))) fail('pageOrder must contain every page and folder exactly once; no missing, duplicate or unknown identifiers');
  const depths = new Map<string, number>(), visiting = new Set<string>();
  function depth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visiting.has(id)) fail('cyclic parentId');
    visiting.add(id);
    const parent = byId.get(id)!.parentId;
    if (parent !== undefined && !byId.has(parent)) fail('parentId references an unknown page or folder');
    const value = parent === undefined ? 0 : depth(parent) + 1;
    if (value >= PAGE_TREE_LIMITS.levels) fail('page tree nesting exceeds 12 levels');
    visiting.delete(id); depths.set(id, value); return value;
  }
  records.forEach(node => depth(node.id));
  const nodes = new Map(records.map(node => [node.id, { id: node.id, name: node.name, kind: node.kind, children: [] } as PageTreeNode]));
  const roots: PageTreeNode[] = [];
  for (const id of order) {
    const parentId = byId.get(id)!.parentId;
    (parentId === undefined ? roots : nodes.get(parentId)!.children).push(nodes.get(id)!);
  }
  return roots;
}

export function flattenPageTree(nodes: PageTreeNode[], parentId?: string, depth = 0): PageTreeEntry[] {
  return nodes.flatMap(node => [{ id: node.id, name: node.name, kind: node.kind, ...(parentId === undefined ? {} : { parentId }), depth }, ...flattenPageTree(node.children, node.id, depth + 1)]);
}
export function pageTreeEntries(doc: PageTreeDocument): PageTreeEntry[] { return flattenPageTree(getPageTree(doc)); }

/** A full input permutation defines sibling ranks; output is always canonical preorder. */
export function normalizePageTree<T extends PageTreeDocument>(doc: T): T {
  const entries = pageTreeEntries(doc), pages = new Map(doc.pages.map(page => [page.id, page]));
  const folders = new Map((doc.pageFolders ?? []).map(folder => [folder.id, folder]));
  const orderedPages = entries.filter(entry => entry.kind === 'page').map(entry => pages.get(entry.id)!);
  const orderedFolders = entries.filter(entry => entry.kind === 'folder').map(entry => folders.get(entry.id)!);
  const order = entries.map(entry => entry.id);
  const unchanged = orderedPages.every((page, i) => page === doc.pages[i])
    && (doc.pageFolders === undefined || orderedFolders.every((folder, i) => folder === doc.pageFolders![i]))
    && (doc.pageOrder === undefined || order.every((id, i) => id === doc.pageOrder![i]));
  if (unchanged) return doc;
  return { ...doc, pages: orderedPages, ...(doc.pageFolders === undefined ? {} : { pageFolders: orderedFolders }), ...(doc.pageOrder === undefined ? {} : { pageOrder: order }) };
}
