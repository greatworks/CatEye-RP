import type { AdaptiveViewDefinition, AdaptiveViewSet, AdaptiveWidgetOverride, Document, Page } from './types';
import { mapWidgets, uid } from './document';

type Overrides = Record<string, Record<string, AdaptiveWidgetOverride>>;
export interface AdaptiveViewSetPatch {
  name?: string;
  baseSize?: { width: number; height: number };
  views?: AdaptiveViewDefinition[];
}

function pageById(doc: Document, id: string): Page {
  const page = doc.pages.find(page => page.id === id);
  if (!page) throw new Error('Page does not exist');
  return page;
}
function setById(doc: Document, id: string): AdaptiveViewSet {
  const set = doc.adaptiveViewSets?.find(set => set.id === id);
  if (!set) throw new Error('Adaptive view set does not exist');
  return set;
}
function name(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) throw new Error('Adaptive view set requires a name of at most 500 characters');
  return value.trim();
}
function dimension(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100_000) throw new Error('Adaptive view dimensions must be between 0 and 100000');
  return value;
}
function identity(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('Invalid adaptive view identity');
  return value;
}
function size(value: { width: number; height: number }) {
  return { width: dimension(value.width), height: dimension(value.height) };
}
function definitions(views: AdaptiveViewDefinition[]): AdaptiveViewDefinition[] {
  if (!Array.isArray(views) || views.length > 50) throw new Error('A set supports at most 50 adaptive views');
  const ids = new Set<string>();
  const result = views.map(view => {
    const id = identity(view.id);
    if (ids.has(id)) throw new Error('Duplicate adaptive view identity');
    ids.add(id);
    // Saved native names are matched exactly. Editing an unrelated dimension
    // must not trim them or change name-based set reassignment semantics.
    if (typeof view.name !== 'string' || view.name.length > 500) throw new Error('Invalid adaptive view name');
    return { id, name: view.name, width: dimension(view.width),
      ...(view.height === undefined ? {} : { height: dimension(view.height) }),
      ...(view.baseViewId === undefined ? {} : { baseViewId: identity(view.baseViewId) }) };
  });
  const byId = new Map(result.map(view => [view.id, view]));
  for (const view of result) {
    const seen = new Set<string>(); let current: AdaptiveViewDefinition | undefined = view;
    while (current) {
      if (seen.has(current.id)) throw new Error('Adaptive view parent cycle');
      seen.add(current.id);
      if (current.baseViewId === undefined) break;
      current = byId.get(current.baseViewId);
      if (!current) throw new Error('Adaptive parent does not exist in this view set');
    }
  }
  return result;
}

/** Only genuinely removed definitions are reparented, never arbitrary missing IDs. */
function reparentRemoved(previous: AdaptiveViewDefinition[], next: AdaptiveViewDefinition[]): AdaptiveViewDefinition[] {
  const old = new Map(previous.map(view => [view.id, view])), kept = new Set(next.map(view => view.id));
  return next.map(view => {
    let parent = view.baseViewId; const seen = new Set<string>();
    while (parent !== undefined && !kept.has(parent) && old.has(parent)) {
      if (seen.has(parent)) throw new Error('Adaptive view parent cycle');
      seen.add(parent); parent = old.get(parent)!.baseViewId;
    }
    const result = { ...view };
    if (parent === undefined) delete result.baseViewId;
    else result.baseViewId = parent;
    return result;
  });
}

function prune(page: Page, maps: Overrides | undefined, deleted: Set<string> = new Set()): Overrides | undefined {
  if (maps === undefined) return undefined;
  const widgetIds = new Set<string>(); mapWidgets(page.widgets, widget => { widgetIds.add(widget.id); return widget; });
  return Object.fromEntries(Object.entries(maps).filter(([id]) => !deleted.has(id)).map(([id, map]) => [id,
    Object.fromEntries(Object.entries(map).filter(([widgetId]) => widgetIds.has(widgetId)).map(([widgetId, patch]) => [widgetId, structuredClone(patch)])),
  ]));
}

function storedSharedPage(page: Page, setId: string, maps: Overrides | undefined): Page {
  const result: Page = { ...page, adaptiveViewSetId: setId, adaptiveViews: [] };
  delete result.adaptiveSelection; delete result.adaptiveBaseSize;
  if (maps === undefined) delete result.adaptiveOverrides;
  else result.adaptiveOverrides = maps;
  return result;
}

/** Return an effective page for existing adaptive helpers; its metadata is not
 * a valid shared-page storage form until committed with commitAdaptivePage. */
export function resolveAdaptivePage(doc: Document, page: Page): Page {
  if (page.adaptiveViewSetId === undefined) return page;
  const set = setById(doc, page.adaptiveViewSetId);
  return { ...page, adaptiveSelection: 'native-size', adaptiveBaseSize: { ...set.baseSize },
    adaptiveViews: set.views.map(view => ({ ...view, overrides: structuredClone(page.adaptiveOverrides?.[view.id] ?? {}) })) };
}

export function createAdaptiveViewSet(doc: Document, setName: string): Document {
  if ((doc.adaptiveViewSets?.length ?? 0) >= 100) throw new Error('A document supports at most 100 adaptive view sets');
  const set: AdaptiveViewSet = { id: uid(), name: name(setName), baseSize: { width: 0, height: 0 }, views: [] };
  return { ...doc, adaptiveViewSets: [...doc.adaptiveViewSets ?? [], set] };
}

export function convertPageAdaptiveViewsToSet(doc: Document, pageId: string, setName: string): Document {
  const page = pageById(doc, pageId);
  if (page.adaptiveViewSetId !== undefined) throw new Error('Page already uses a shared adaptive view set');
  if (page.adaptiveSelection !== 'native-size') throw new Error('Use view sizes (native-size mode) before converting local adaptive views');
  const created = createAdaptiveViewSet(doc, setName), set = created.adaptiveViewSets!.at(-1)!;
  set.baseSize = size(page.adaptiveBaseSize ?? { width: 0, height: 0 });
  set.views = definitions(page.adaptiveViews);
  const maps: Overrides = { ...structuredClone(page.adaptiveOverrides ?? {}) };
  for (const view of page.adaptiveViews) maps[view.id] = structuredClone(view.overrides);
  return { ...created, pages: created.pages.map(item => item.id === pageId ? storedSharedPage(page, set.id, prune(page, maps)) : item) };
}

/** Native reassignment copies source local props then reapplies existing target
 * local props. Style paint/reset pairs and the P21 state map remain atomic. */
function migratePatch(source: AdaptiveWidgetOverride, target: AdaptiveWidgetOverride): AdaptiveWidgetOverride {
  const result: AdaptiveWidgetOverride = { ...structuredClone(source), ...structuredClone(target) };
  if (source.style || target.style) {
    result.style = { ...structuredClone(source.style), ...structuredClone(target.style) };
    for (const [plain, richer] of [['fill', 'fillGradient'], ['stroke', 'strokeGradient'], ['radius', 'cornerRadii'], ['strokeWidth', 'borderWidths']] as const) {
      if (target.style && Object.hasOwn(target.style, plain) && !Object.hasOwn(target.style, richer)) delete result.style[richer];
    }
  }
  // A target legacy tuple declares every edge, replacing all source sides.
  // Without that tuple, each target sparse edge overrides only its own source.
  if (target.style?.textPadding) {
    if (target.textPaddingSides !== undefined) result.textPaddingSides = structuredClone(target.textPaddingSides);
    else delete result.textPaddingSides;
  } else if (source.textPaddingSides !== undefined || target.textPaddingSides !== undefined) {
    result.textPaddingSides = { ...source.textPaddingSides, ...target.textPaddingSides };
  }
  return result;
}

export function assignAdaptiveViewSet(doc: Document, pageId: string, setId: string | null): Document {
  const page = pageById(doc, pageId);
  if (setId === null) {
    if (page.adaptiveViewSetId === undefined) return doc;
    const old = setById(doc, page.adaptiveViewSetId);
    const detached: Page = { ...page, adaptiveViews: [], adaptiveSelection: 'native-size', adaptiveBaseSize: { ...old.baseSize } };
    delete detached.adaptiveViewSetId;
    return { ...doc, pages: doc.pages.map(item => item.id === pageId ? detached : item) };
  }
  const next = setById(doc, setId);
  if (page.adaptiveViewSetId === setId) return doc;
  if (page.adaptiveViews.length) throw new Error('Convert local adaptive views to a shared set before assignment');
  const old = page.adaptiveViewSetId === undefined ? undefined : setById(doc, page.adaptiveViewSetId);
  const maps = structuredClone(page.adaptiveOverrides ?? {});
  for (const view of old?.views ?? []) {
    const match = next.views.find(candidate => candidate.id === view.id) ?? next.views.find(candidate => candidate.name === view.name);
    if (!match || match.id === view.id || !Object.hasOwn(maps, view.id)) continue;
    const target = maps[match.id] ?? {}, source = maps[view.id];
    maps[match.id] = Object.fromEntries([...new Set([...Object.keys(source), ...Object.keys(target)])].map(id => [id,
      source[id] && target[id] ? migratePatch(source[id], target[id]) : structuredClone(target[id] ?? source[id]),
    ]));
    delete maps[view.id];
  }
  const declarations = page.adaptiveOverrides === undefined && !Object.keys(maps).length ? undefined : maps;
  return { ...doc, pages: doc.pages.map(item => item.id === pageId ? storedSharedPage(page, setId, prune(page, declarations)) : item) };
}

export function updateAdaptiveViewSet(doc: Document, setId: string, patch: AdaptiveViewSetPatch): Document {
  const previous = setById(doc, setId);
  const views = patch.views === undefined ? previous.views : definitions(reparentRemoved(previous.views, patch.views));
  const next: AdaptiveViewSet = { ...previous, views,
    ...(patch.name === undefined ? {} : { name: name(patch.name) }),
    ...(patch.baseSize === undefined ? {} : { baseSize: size(patch.baseSize) }) };
  const deleted = new Set(previous.views.filter(view => !views.some(next => next.id === view.id)).map(view => view.id));
  return { ...doc, adaptiveViewSets: doc.adaptiveViewSets!.map(set => set.id === setId ? next : set),
    pages: doc.pages.map(page => page.adaptiveViewSetId !== setId || !deleted.size ? page : {
      ...page, ...(page.adaptiveOverrides === undefined ? {} : { adaptiveOverrides: prune(page, page.adaptiveOverrides, deleted) }),
    }) };
}

export function removeAdaptiveViewSet(doc: Document, setId: string): Document {
  setById(doc, setId);
  if (doc.pages.some(page => page.adaptiveViewSetId === setId)) throw new Error('Switch or detach all pages referencing this adaptive view set before deleting it');
  return { ...doc, adaptiveViewSets: doc.adaptiveViewSets!.filter(set => set.id !== setId) };
}

/** Commit shared content and the selected page's sparse declarations. Shared
 * definition edits propagate to all bound pages; inactive maps stay local. */
export function commitAdaptivePage(doc: Document, effectivePage: Page): Document {
  const stored = pageById(doc, effectivePage.id);
  if (stored.adaptiveViewSetId !== effectivePage.adaptiveViewSetId) throw new Error('Adaptive view set changed; cannot commit a stale effective page');
  if (stored.adaptiveViewSetId === undefined) {
    const maps = prune(effectivePage, effectivePage.adaptiveOverrides);
    const active = Object.fromEntries(effectivePage.adaptiveViews.map(view => [view.id, view.overrides]));
    const activePruned = prune(effectivePage, active)!;
    const next = { ...effectivePage, adaptiveViews: effectivePage.adaptiveViews.map(view => ({ ...view, overrides: activePruned[view.id] })),
      ...(maps === undefined ? {} : { adaptiveOverrides: maps }) };
    return { ...doc, pages: doc.pages.map(page => page.id === stored.id ? next : page) };
  }
  if (effectivePage.adaptiveSelection !== 'native-size') throw new Error('Shared adaptive definitions require native-size selection');
  const old = setById(doc, stored.adaptiveViewSetId);
  const next = updateAdaptiveViewSet(doc, old.id, { views: effectivePage.adaptiveViews, baseSize: effectivePage.adaptiveBaseSize ?? { width: 0, height: 0 } });
  const deleted = new Set(old.views.filter(view => !effectivePage.adaptiveViews.some(v => v.id === view.id)).map(view => view.id));
  const maps: Overrides = structuredClone(effectivePage.adaptiveOverrides ?? {});
  for (const view of effectivePage.adaptiveViews) {
    if (Object.keys(view.overrides).length || Object.hasOwn(maps, view.id) || Object.hasOwn(stored.adaptiveOverrides ?? {}, view.id)) maps[view.id] = structuredClone(view.overrides);
  }
  const declarations = effectivePage.adaptiveOverrides === undefined && stored.adaptiveOverrides === undefined && !Object.keys(maps).length ? undefined : maps;
  const page = storedSharedPage(effectivePage, old.id, prune(effectivePage, declarations, deleted));
  return { ...next, pages: next.pages.map(item => item.id === page.id ? page : item) };
}
