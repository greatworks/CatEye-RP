import type { Document, Page, PageFolder } from './types';
import { createPage, uid } from './document';
import { flattenPageTree, getPageTree, pageTreeEntries, PAGE_TREE_LIMITS } from './page-tree-core';
import type { PageNodeKind, PageTreeNode } from './page-tree-core';
export { getPageTree, pageTreeEntries, PAGE_TREE_LIMITS } from './page-tree-core';
export type { PageNodeKind, PageTreeNode, PageTreeEntry } from './page-tree-core';
export type PageNodeMovePosition = 'before' | 'after' | 'inside';
export type PageNodePosition = PageNodeMovePosition | 'end';
export type PageNodeShiftDirection = 'up' | 'down' | 'indent' | 'outdent';

function locate(nodes: PageTreeNode[], id: string, parent?: PageTreeNode): { node: PageTreeNode; siblings: PageTreeNode[]; index: number; parent?: PageTreeNode } | undefined {
  for (let index = 0; index < nodes.length; index++) {
    if (nodes[index].id === id) return { node: nodes[index], siblings: nodes, index, parent };
    const child = locate(nodes[index].children, id, nodes[index]); if (child) return child;
  }
}
function validateName(name: string): void { if (typeof name !== 'string' || name.length > 500) throw new Error('Page/folder name must be a string of at most 500 characters'); }
function sameTree(a: PageTreeNode[], b: PageTreeNode[]): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function writeTree(doc: Document, tree: PageTreeNode[], extra?: Page | PageFolder): Document {
  const entries = flattenPageTree(tree);
  if (entries.some(entry => entry.depth >= PAGE_TREE_LIMITS.levels)) throw new Error('Page tree nesting exceeds 12 levels');
  const pages = new Map(doc.pages.map(page => [page.id, page])), folders = new Map((doc.pageFolders ?? []).map(folder => [folder.id, folder]));
  if (extra) { if ('widgets' in extra) pages.set(extra.id, extra); else folders.set(extra.id, extra); }
  function update<T extends Page | PageFolder>(old: T | undefined, name: string, parentId?: string): T {
    if (!old) throw new Error('Page tree operation would lose a node');
    if (old.name === name && old.parentId === parentId) return old;
    const { parentId: previousParent, ...rest } = old;
    return { ...rest, name, ...(parentId === undefined ? {} : { parentId }) } as T;
  }
  const nextPages = entries.filter(entry => entry.kind === 'page').map(entry => update(pages.get(entry.id), entry.name, entry.parentId));
  const nextFolders = entries.filter(entry => entry.kind === 'folder').map(entry => update(folders.get(entry.id), entry.name, entry.parentId));
  if (!nextPages.length) throw new Error('A document must contain at least one page');
  if (nextPages.length > PAGE_TREE_LIMITS.pages || nextFolders.length > PAGE_TREE_LIMITS.folders) throw new Error('Page tree supports at most 200 pages and 200 folders');
  return { ...doc, pages: nextPages, ...(doc.pageFolders === undefined && !nextFolders.length ? {} : { pageFolders: nextFolders }), pageOrder: entries.map(entry => entry.id) };
}

export function pageDescendantIds(doc: Document, id: string): Set<string> {
  const found = locate(getPageTree(doc), id);
  return new Set(found ? flattenPageTree([found.node]).map(entry => entry.id) : []);
}

/** end appends at root; inside appends as the last child of the target page or folder. */
export function addPageNode(doc: Document, value: { kind: PageNodeKind; name: string }, targetId?: string, position: PageNodePosition = 'end'): { document: Document; id: string } {
  validateName(value.name);
  if (!['page', 'folder'].includes(value.kind) || Object.keys(value).some(key => !['kind', 'name'].includes(key))) throw new Error('Expected a page or folder with kind and name');
  if (!['before', 'after', 'inside', 'end'].includes(position)) throw new Error('Invalid page insertion position');
  const tree = getPageTree(doc), target = targetId === undefined ? undefined : locate(tree, targetId);
  if (position !== 'end' && !target) throw new Error('Page insertion target does not exist');
  const valueObject = value.kind === 'page' ? createPage(value.name) : { id: uid(), name: value.name };
  const node: PageTreeNode = { id: valueObject.id, name: value.name, kind: value.kind, children: [] };
  if (position === 'end') tree.push(node);
  else if (position === 'inside') target!.node.children.push(node);
  else target!.siblings.splice(target!.index + (position === 'after' ? 1 : 0), 0, node);
  return { document: writeTree(doc, tree, valueObject), id: node.id };
}

export function movePageNode(doc: Document, id: string, targetId: string, position: PageNodeMovePosition): Document {
  if (!['before', 'after', 'inside'].includes(position)) return doc;
  const tree = getPageTree(doc), before = JSON.stringify(tree), source = locate(tree, id), target = locate(tree, targetId);
  if (!source || !target || flattenPageTree([source.node]).some(node => node.id === targetId)) return doc;
  source.siblings.splice(source.index, 1);
  // Removal can shift the target's index within a shared sibling array.
  const currentTarget = locate(tree, targetId)!;
  if (position === 'inside') currentTarget.node.children.push(source.node);
  else currentTarget.siblings.splice(currentTarget.index + (position === 'after' ? 1 : 0), 0, source.node);
  if (before === JSON.stringify(tree) || flattenPageTree(tree).some(entry => entry.depth >= PAGE_TREE_LIMITS.levels)) return doc;
  return writeTree(doc, tree);
}

export function shiftPageNode(doc: Document, id: string, direction: PageNodeShiftDirection): Document {
  const location = locate(getPageTree(doc), id); if (!location) return doc;
  const { siblings, index, parent } = location;
  if (direction === 'up') return index > 0 ? movePageNode(doc, id, siblings[index - 1].id, 'before') : doc;
  if (direction === 'down') return index + 1 < siblings.length ? movePageNode(doc, id, siblings[index + 1].id, 'after') : doc;
  if (direction === 'indent') return index > 0 ? movePageNode(doc, id, siblings[index - 1].id, 'inside') : doc;
  if (direction === 'outdent') return parent ? movePageNode(doc, id, parent.id, 'after') : doc;
  return doc;
}

export function renamePageNode(doc: Document, id: string, name: string): Document {
  validateName(name);
  const node = pageTreeEntries(doc).find(entry => entry.id === id); if (!node || node.name === name) return doc;
  // Renaming preserves legacy optional-field absence and every navigation target identifier.
  return { ...doc, pages: doc.pages.map(page => page.id === id ? { ...page, name } : page), ...(doc.pageFolders === undefined ? {} : { pageFolders: doc.pageFolders.map(folder => folder.id === id ? { ...folder, name } : folder) }) };
}

export function deletePageNode(doc: Document, id: string): Document {
  const tree = getPageTree(doc), before = structuredClone(tree), location = locate(tree, id); if (!location) return doc;
  location.siblings.splice(location.index, 1);
  if (sameTree(before, tree)) return doc;
  // Deliberately preserve external openPage actions, including now-dangling targets.
  return writeTree(doc, tree);
}
