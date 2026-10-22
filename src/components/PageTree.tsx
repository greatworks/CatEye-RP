import { useEffect, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight, FilePlus2, FileText, Folder, FolderOpen, FolderPlus, Search, Trash2 } from 'lucide-react';
import type { Document } from '../model/types';
import { addPageNode, deletePageNode, getPageTree, movePageNode, pageDescendantIds, pageTreeEntries, renamePageNode, shiftPageNode } from '../model/page-tree';
import { useDialogs } from './Dialogs';
import './PageTree.css';

type Position = 'before' | 'after' | 'inside';
interface Props {
  document: Document; selectedId: string; activePageId: string; search: string;
  onSearch: (value: string) => void; onSelect: (id: string) => void; onOpen: (id: string) => void;
  onChange: (document: Document) => void; onNotice: (message: string) => void;
}

/** Page selection belongs to the tree; opening a page belongs to the canvas. */
export function PageTree({ document: doc, selectedId, activePageId, search, onSearch, onSelect, onOpen, onChange, onNotice }: Props) {
  const { prompt } = useDialogs();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [drop, setDrop] = useState<{ id: string; position: Position } | null>(null);
  const dragging = useRef<string | null>(null), root = useRef<HTMLDivElement>(null), menuRef = useRef<HTMLDivElement>(null);
  const latest = useRef(doc); latest.current = doc;
  const entries = pageTreeEntries(doc), byId = new Map(entries.map(entry => [entry.id, entry]));
  const requestedSelection = byId.has(selectedId) ? selectedId : activePageId;
  const query = search.trim().toLocaleLowerCase();
  const included = new Set<string>();
  if (query) for (const entry of entries) if (entry.name.toLocaleLowerCase().includes(query)) {
    let id: string | undefined = entry.id;
    while (id) { included.add(id); id = byId.get(id)?.parentId; }
  }
  const visible = entries.filter(entry => {
    if (query) return included.has(entry.id);
    let parent = entry.parentId;
    while (parent) { if (collapsed.has(parent)) return false; parent = byId.get(parent)?.parentId; }
    return true;
  });
  // Destructive keys must never target a row hidden by a collapse or search.
  let selection = requestedSelection;
  const visibleIds = new Set(visible.map(entry => entry.id));
  while (selection && !visibleIds.has(selection)) selection = byId.get(selection)?.parentId ?? '';
  if (!selection) selection = visible[0]?.id ?? '';
  const parents = new Set(entries.flatMap(entry => entry.parentId ? [entry.parentId] : []));
  const reveal = (id: string, document = latest.current) => {
    const nodes = new Map(pageTreeEntries(document).map(entry => [entry.id, entry]));
    setCollapsed(previous => {
      const next = new Set(previous); let parent = nodes.get(id)?.parentId;
      while (parent) { next.delete(parent); parent = nodes.get(parent)?.parentId; }
      return next;
    });
  };
  useEffect(() => { reveal(activePageId); }, [activePageId]);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>('button')?.focus();
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);
  const focusNode = (id: string) => requestAnimationFrame(() => {
    const element = [...(root.current?.querySelectorAll<HTMLElement>('[data-page-node-id]') ?? [])].find(node => node.dataset.pageNodeId === id);
    element?.focus(); element?.scrollIntoView({ block: 'nearest' });
  });
  function change(next: Document, focusId = selection) {
    if (next !== latest.current) onChange(next);
    reveal(focusId, next); focusNode(focusId);
  }
  function act(work: () => void) { try { work(); } catch (error) { onNotice(error instanceof Error ? error.message : String(error)); } }
  function add(kind: 'page' | 'folder', targetId?: string, position: Position | 'end' = 'end') {
    act(() => {
      const source = latest.current;
      const names = new Set(pageTreeEntries(source).map(entry => entry.name));
      let index = kind === 'page' ? source.pages.length + 1 : (source.pageFolders?.length ?? 0) + 1;
      const prefix = kind === 'page' ? 'Page' : 'Folder';
      while (names.has(`${prefix} ${index}`)) index++;
      const result = addPageNode(source, { kind, name: `${prefix} ${index}` }, targetId, position);
      onChange(result.document); onSelect(result.id); reveal(result.id, result.document); onSearch('');
      if (kind === 'page') onOpen(result.id);
      focusNode(result.id);
    });
  }
  function addAtSelection(kind: 'page' | 'folder') {
    const node = byId.get(selection);
    add(kind, node?.id, node ? node.kind === 'folder' ? 'inside' : 'after' : 'end');
  }
  async function rename(id: string) {
    const node = pageTreeEntries(latest.current).find(item => item.id === id); if (!node) return;
    const name = await prompt(node.kind === 'page' ? 'Page name' : 'Folder name', node.name);
    if (name?.trim()) act(() => change(renamePageNode(latest.current, id, name.trim()), id));
  }
  function remove(id: string) {
    const source = latest.current, node = pageTreeEntries(source).find(item => item.id === id); if (!node) return;
    const ids = pageDescendantIds(source, id);
    if (source.pages.every(page => ids.has(page.id))) { onNotice('A document must contain at least one page'); return; }
    if (ids.size > 1 && !window.confirm(`Delete "${node.name}" and all ${ids.size - 1} items inside it?`)) return;
    act(() => {
      const next = deletePageNode(source, id);
      const newSelection = node.parentId && !ids.has(node.parentId) ? node.parentId : next.pages[0].id;
      onChange(next); onSelect(newSelection); focusNode(newSelection);
    });
  }
  function shift(id: string, direction: 'up' | 'down' | 'indent' | 'outdent') {
    act(() => change(shiftPageNode(latest.current, id, direction), id));
  }
  function keyDown(event: KeyboardEvent) {
    const mod = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    if (mod && ['s', 'o', 'z', 'y', 'n'].includes(key) || key === 'f5') return;
    event.stopPropagation();
    // Page-tab chords are handled in window capture. Extra modifiers must not
    // turn an unsupported navigation chord into a page hierarchy mutation.
    if ((mod || event.altKey) && key === 'tab' || event.altKey && ['arrowleft', 'arrowright'].includes(key)) { event.preventDefault(); return; }
    if (key === 'f2') { event.preventDefault(); void rename(selection); }
    else if (key === 'delete' || key === 'backspace') { event.preventDefault(); remove(selection); }
    else if (key === 'enter') { event.preventDefault(); if (byId.get(selection)?.kind === 'page') onOpen(selection); else toggle(selection); }
    else if (key === 'tab') { event.preventDefault(); shift(selection, event.shiftKey ? 'outdent' : 'indent'); }
    else if (mod && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault(); shift(selection, key === 'arrowup' ? 'up' : key === 'arrowdown' ? 'down' : key === 'arrowleft' ? 'outdent' : 'indent');
    } else if (['arrowup', 'arrowdown', 'home', 'end'].includes(key)) {
      event.preventDefault(); const index = visible.findIndex(entry => entry.id === selection);
      const target = visible[key === 'home' ? 0 : key === 'end' ? visible.length - 1 : Math.max(0, Math.min(visible.length - 1, index + (key === 'arrowup' ? -1 : 1)))];
      if (target) { onSelect(target.id); focusNode(target.id); }
    } else if (key === 'arrowright') {
      event.preventDefault(); if (collapsed.has(selection)) toggle(selection);
      else { const child = visible.find(entry => entry.parentId === selection); if (child) { onSelect(child.id); focusNode(child.id); } }
    } else if (key === 'arrowleft') {
      event.preventDefault(); if (parents.has(selection) && !collapsed.has(selection)) toggle(selection);
      else { const parent = byId.get(selection)?.parentId; if (parent) { onSelect(parent); focusNode(parent); } }
    }
  }
  function toggle(id: string) {
    if (!collapsed.has(id) && pageDescendantIds(latest.current, id).has(requestedSelection)) { onSelect(id); focusNode(id); }
    setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function dropPosition(event: DragEvent): Position {
    const rect = event.currentTarget.getBoundingClientRect(), fraction = (event.clientY - rect.top) / rect.height;
    return fraction < .25 ? 'before' : fraction > .75 ? 'after' : 'inside';
  }
  function openMenu(id: string, x: number, y: number) { onSelect(id); setMenu({ id, x: Math.max(4, Math.min(x, window.innerWidth - 224)), y: Math.max(4, Math.min(y, window.innerHeight - 410)) }); }
  const actions: [string, () => void][] = menu ? [
    ['Add page before', () => add('page', menu.id, 'before')], ['Add page after', () => add('page', menu.id, 'after')], ['Add child page', () => add('page', menu.id, 'inside')],
    ['Add folder before', () => add('folder', menu.id, 'before')], ['Add folder after', () => add('folder', menu.id, 'after')], ['Add child folder', () => add('folder', menu.id, 'inside')],
    ['Rename', () => { void rename(menu.id); }], ['Move up', () => shift(menu.id, 'up')], ['Move down', () => shift(menu.id, 'down')],
    ['Indent', () => shift(menu.id, 'indent')], ['Outdent', () => shift(menu.id, 'outdent')], ['Delete', () => remove(menu.id)],
  ] : [];
  return <>
    <div className="pane-actions"><Search size={15}/><input aria-label="Search pages and widgets" placeholder="Search" value={search} onChange={event => onSearch(event.target.value)}/>
      <button title="Add page" onClick={() => addAtSelection('page')}><FilePlus2 size={16}/></button>
      <button title="Add folder" onClick={() => addAtSelection('folder')}><FolderPlus size={16}/></button>
      <button title="Delete page or folder" disabled={!selection} onClick={() => remove(selection)}><Trash2 size={14}/></button>
    </div>
    <div className="tree-list page-tree" data-page-tree ref={root} role="tree" aria-label="Pages" onKeyDown={keyDown}>
      {visible.map(entry => {
        const expanded = query ? true : !collapsed.has(entry.id), hasChildren = parents.has(entry.id);
        return <div key={entry.id} role="treeitem" aria-label={entry.name} aria-level={entry.depth + 1} aria-selected={selection === entry.id} aria-expanded={hasChildren ? expanded : undefined}
          data-page-node-id={entry.id} data-page-kind={entry.kind} data-drop-position={drop?.id === entry.id ? drop.position : undefined}
          className={`tree-row ${selection === entry.id ? 'selected' : ''} ${activePageId === entry.id ? 'open-page' : ''}`} style={{ paddingLeft: 7 + entry.depth * 16 }} tabIndex={selection === entry.id ? 0 : -1}
          onClick={event => { onSelect(entry.id); event.currentTarget.focus(); }}
          onDoubleClick={() => entry.kind === 'page' ? onOpen(entry.id) : toggle(entry.id)}
          onContextMenu={event => { event.preventDefault(); openMenu(entry.id, event.clientX, event.clientY); }}
          onKeyDown={event => { if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(entry.id, rect.left + 20, rect.bottom); } }}
          draggable={!query} onDragStart={event => { dragging.current = entry.id; onSelect(entry.id); event.dataTransfer.setData('application/x-rea-page', entry.id); event.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => { dragging.current = null; setDrop(null); }}
          onDragOver={event => { if (!dragging.current) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDrop({ id: entry.id, position: dropPosition(event) }); }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null); }}
          onDrop={event => { event.preventDefault(); const id = dragging.current; dragging.current = null; setDrop(null); if (id) act(() => change(movePageNode(latest.current, id, entry.id, dropPosition(event)), id)); }}>
          {hasChildren ? <button className="page-node-toggle" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${entry.name}`} tabIndex={-1} onClick={event => { event.stopPropagation(); toggle(entry.id); }} onDoubleClick={event => event.stopPropagation()}>{expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</button> : <i className="page-node-spacer"/>}
          {entry.kind === 'folder' ? expanded ? <FolderOpen size={14}/> : <Folder size={14}/> : <FileText size={14}/>}
          <button className="page-node-name" aria-label={entry.name} tabIndex={-1}>{entry.name}</button>
        </div>;
      })}
      {!visible.length && <p className="page-tree-empty">No matching pages or folders</p>}
    </div>
    {menu && <div ref={menuRef} className="page-context-menu" role="menu" aria-label="Page actions" style={{ left: menu.x, top: menu.y }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); setMenu(null); focusNode(menu.id); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')], index = items.indexOf(document.activeElement as HTMLButtonElement);
        items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
      }
    }}>{actions.map(([name, action]) => <button role="menuitem" key={name} onClick={() => { setMenu(null); action(); }}>{name}</button>)}</div>}
  </>;
}

/** Shared tree structure for the preview. Folders never become runtime pages. */
export function PreviewPageTree({ document: doc, pageId, onNavigate }: { document: Document; pageId: string; onNavigate: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const entries = new Map(pageTreeEntries(doc).map(node => [node.id, node]));
    setCollapsed(previous => { const next = new Set(previous); let id = entries.get(pageId)?.parentId; while (id) { next.delete(id); id = entries.get(id)?.parentId; } return next; });
  }, [doc, pageId]);
  function render(nodes: ReturnType<typeof getPageTree>, depth = 0): React.ReactNode {
    return nodes.map(node => {
      const expanded = !collapsed.has(node.id);
      const toggle = () => setCollapsed(previous => { const next = new Set(previous); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; });
      return <div key={node.id} className="page-navigation-branch">
        <div className="page-navigation-row" style={{ paddingLeft: depth * 14 }}>
          {node.children.length > 0 && <button className="page-navigation-toggle" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`} aria-expanded={expanded} onClick={toggle}>{expanded ? '▾' : '▸'}</button>}
          {node.kind === 'page' ? <button className={pageId === node.id ? 'active' : ''} data-page-id={node.id} aria-current={pageId === node.id ? 'page' : undefined} onClick={() => onNavigate(node.id)}>{node.name}</button> : <button className="page-navigation-folder" data-folder-id={node.id} aria-expanded={expanded} onClick={toggle}><Folder size={13}/>{node.name}</button>}
        </div>
        {expanded && render(node.children, depth + 1)}
      </div>;
    });
  }
  return <>{render(getPageTree(doc))}</>;
}
