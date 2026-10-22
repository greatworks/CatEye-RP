import type { EditorKey } from './editor-shortcuts';

/** Session navigation only; never serialized into the prototype or its undo stack. */
export interface PageVisitHistory { ids: string[]; cursor: number }
export type PageTabCommand = 'historyForward' | 'historyBack' | 'visualNext' | 'visualPrevious' | 'close' | 'closeAll';

// Axure's Windows bindings. macOS close-window/close-all bindings differ.
export function resolvePageTabShortcut(event: EditorKey): PageTabCommand | undefined {
  if (!event.ctrlKey || event.metaKey || event.isComposing || event.getModifierState?.('AltGraph')) return;
  const key = event.key.toLowerCase();
  if (!event.altKey && key === 'tab') return event.shiftKey ? 'historyBack' : 'historyForward';
  if (!event.altKey && key === 'w') return event.shiftKey ? 'closeAll' : 'close';
  if (!event.altKey && !event.shiftKey && key === 'f4') return 'close';
  if (event.altKey && !event.shiftKey && key === 'arrowright') return 'visualNext';
  if (event.altKey && !event.shiftKey && key === 'arrowleft') return 'visualPrevious';
}

export function pageVisitHistory(id?: string): PageVisitHistory { return { ids: id ? [id] : [], cursor: id ? 0 : -1 }; }

/** A new activation after Back discards the forward branch. */
export function visitPage(history: PageVisitHistory, id: string): PageVisitHistory {
  if (history.ids[history.cursor] === id) return history;
  const ids = [...history.ids.slice(0, history.cursor + 1), id];
  return { ids, cursor: ids.length - 1 };
}

export function stepPageHistory(history: PageVisitHistory, direction: -1 | 1): PageVisitHistory {
  const cursor = history.cursor + direction;
  return cursor < 0 || cursor >= history.ids.length ? history : { ...history, cursor };
}

/** Native CloseTab removes every occurrence backwards and adjusts its cursor. */
export function retainPageHistory(history: PageVisitHistory, openIds: readonly string[]): PageVisitHistory {
  const allowed = new Set(openIds), ids = history.ids.slice(); let cursor = history.cursor;
  for (let index = ids.length - 1; index >= 0; --index) {
    if (allowed.has(ids[index])) continue;
    ids.splice(index, 1);
    if (cursor > 0 && cursor >= index) --cursor;
  }
  if (!ids.length) return pageVisitHistory();
  if (ids.every(id => id === ids[0])) return pageVisitHistory(ids[0]);
  return { ids, cursor: Math.min(cursor, ids.length - 1) };
}

export function adjacentPageTab(ids: readonly string[], activeId: string, direction: -1 | 1): string | undefined {
  const index = ids.indexOf(activeId);
  return index < 0 || !ids.length ? undefined : ids[(index + direction + ids.length) % ids.length];
}
