import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { Page } from '../model/types';
import './PageTabs.css';

interface Props { pages: Page[]; ids: string[]; activeId: string | null; onOpen: (id: string) => void; onClose: (id: string) => void; onCloseOthers: (id: string) => void; onCloseAll: () => void; onReorder: (ids: string[]) => void }
export function PageTabs({ pages, ids, activeId, onOpen, onClose, onCloseOthers, onCloseAll, onReorder }: Props) {
  const valid = ids.filter(id => pages.some(page => page.id === id));
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null), [list, setList] = useState(false);
  const dragging = useRef<string | null>(null), container = useRef<HTMLDivElement>(null), menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    [...(container.current?.querySelectorAll<HTMLElement>('[role=tab]') ?? [])].find(element => element.dataset.tabId === activeId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId, valid.length]);
  useEffect(() => {
    if (!menu && !list) return;
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node) && !container.current?.contains(event.target as Node)) { setMenu(null); setList(false); } };
    window.addEventListener('pointerdown', dismiss); return () => window.removeEventListener('pointerdown', dismiss);
  }, [menu, list]);
  const open = (id: string) => { setList(false); setMenu(null); onOpen(id); };
  return <div className="page-tabs-container" ref={container} onKeyDown={event => {
    const key = event.key.toLowerCase();
    // Navigation owns editing keys, including when a close button or menu has focus.
    if ((event.ctrlKey || event.metaKey) && ['n', 's', 'o', 'z', 'y'].includes(key) || key === 'f5') return;
    event.stopPropagation();
  }}>
    <div className="open-page-tabs" role="tablist" aria-label="Open pages" onKeyDown={event => {
      const target = event.target as HTMLElement, id = target.dataset.tabId;
      if (!id) return;
      if (event.key === 'Delete') { event.preventDefault(); event.stopPropagation(); onClose(id); }
      else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); const index = valid.indexOf(id);
        const next = valid[event.key === 'Home' ? 0 : event.key === 'End' ? valid.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : valid.length - 1)) % valid.length];
        if (next) { open(next); requestAnimationFrame(() => [...container.current!.querySelectorAll<HTMLElement>('[role=tab]')].find(tab => tab.dataset.tabId === next)?.focus()); }
      }
    }}>
      {valid.map(id => {
        const page = pages.find(page => page.id === id)!;
        return <div className={`open-page-tab ${id === activeId ? 'selected' : ''}`} key={id} draggable
          onDragStart={event => { dragging.current = id; event.dataTransfer.setData('application/x-rea-page-tab', id); event.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={event => { if (dragging.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
          onDragEnd={() => { dragging.current = null; }}
          onDrop={event => { event.preventDefault(); const source = dragging.current; dragging.current = null; if (!source || source === id) return; const remaining = valid.filter(value => value !== source), rect = event.currentTarget.getBoundingClientRect(); remaining.splice(remaining.indexOf(id) + (event.clientX > rect.left + rect.width / 2 ? 1 : 0), 0, source); onReorder(remaining); }}
          onContextMenu={event => { event.preventDefault(); setList(false); setMenu({ id, x: Math.min(event.clientX, window.innerWidth - 210), y: event.clientY }); }}>
          <button role="tab" aria-label={page.name} data-tab-id={id} aria-selected={id === activeId} tabIndex={id === activeId ? 0 : -1} onClick={() => open(id)}>{page.name}</button>
          <button className="close-page-tab" title={`Close ${page.name}`} aria-label={`Close ${page.name}`} onClick={() => onClose(id)}><X size={12}/></button>
        </div>;
      })}
    </div>
    {valid.length > 0 && <button className="open-pages-list-button" title="Open pages list" aria-expanded={list} onClick={() => { setMenu(null); setList(!list); }}><ChevronDown size={14}/></button>}
    {list && <div className="open-pages-list page-context-menu" role="menu" aria-label="Open pages" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setList(false); } }}>{valid.map(id => <button role="menuitem" key={id} onClick={() => open(id)}>{pages.find(page => page.id === id)!.name}</button>)}</div>}
    {menu && <div className="page-context-menu" role="menu" aria-label="Tab actions" ref={menuRef} style={{ left: menu.x, top: menu.y }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setMenu(null); }}>
      <button role="menuitem" onClick={() => { onClose(menu.id); setMenu(null); }}>Close tab</button>
      <button role="menuitem" onClick={() => { onCloseOthers(menu.id); setMenu(null); }}>Close other tabs</button>
      <button role="menuitem" onClick={() => { onCloseAll(); setMenu(null); }}>Close all tabs</button>
    </div>}
  </div>;
}
