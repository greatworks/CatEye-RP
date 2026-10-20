import type { AdaptiveStateKey, AdaptiveStateStyles, AdaptiveTextPaddingSides, AdaptiveView, AdaptiveWidgetOverride, GradientFill, GradientPoint, Page, VectorPath, Widget, WidgetStyle } from './types';
import { deleteWidgetTree, mapWidgets, mergeWidgetStyle, uid } from './document';
import { menuSharedDescendantIds } from './menu';
import { treeSharedDescendantIds } from './tree-widget';
import { adaptiveViewChain } from './adaptive-selection';
import { applyRichTextStyle, RICH_TEXT_STYLE_KEYS } from './rich-text';
import { parseVectorPath } from './vector';
import { resolveVectorEditPath, vectorEditPathUnsupportedReason } from './vector-authoring';
import { commitVectorGeometry } from './vector-commit';
import { widgetChildCollections } from './widget-structure';
import { fitLayerTree } from './layer-geometry';
import { resolveResizePins } from './resize-pins';
export { adaptiveViewChain, chooseAdaptiveView } from './adaptive-selection';

export const ADAPTIVE_LAYOUT_FIELDS = ['x', 'y', 'width', 'height', 'rotation', 'hidden', 'placed'] as const;

/** Point data/type are shared; the actual TN46 point-edit entry updates only
 * changed Location/Size groups in the current view. It does not use the ordinary
 * Affect All Views command, RN4I's per-view rebasing or its AutoFit clearing.
 * Inspecting/no-op gestures remain a product no-history policy. */
export function applyAdaptivePointEdit(page: Page, viewId: string | null | undefined, widgetId: string, value: VectorPath): Page {
  const widget = indexWidgets(resolveAdaptiveWidgets(page, viewId)).get(widgetId);
  if (!widget) throw new Error('Point-edit widget does not exist');
  if (vectorEditPathUnsupportedReason(widget)) throw new Error('Point editing is unavailable for this border or corner configuration.');
  const previous = resolveVectorEditPath(widget);
  if (!previous) throw new Error('Widget does not have an editable vector path');
  const requested = parseVectorPath(value);
  if (JSON.stringify(previous) === JSON.stringify(requested)) return page;
  // Fill-rule-only authoring retains the previous shared-content command. It is
  // not evidence of a native node gesture and must not trigger rebounding.
  const geometry = JSON.stringify(previous.commands) === JSON.stringify(requested.commands) ? undefined : commitVectorGeometry(widget, requested);
  const vectorPath = geometry?.vectorPath ?? requested, layout: Partial<Pick<Widget, 'x' | 'y' | 'width' | 'height'>> = {};
  if (geometry) {
    const bounds = geometry.bounds;
    if (Math.abs(bounds.x - widget.x) >= 1e-5 || Math.abs(bounds.y - widget.y) >= 1e-5) { layout.x = bounds.x; layout.y = bounds.y; }
    if (Math.abs(bounds.width - widget.width) >= 1e-5 || Math.abs(bounds.height - widget.height) >= 1e-5) { layout.width = bounds.width; layout.height = bounds.height; }
  }
  return { ...page,
    widgets: fitLayerTree(mapWidgets(page.widgets, source => source.id === widgetId
      ? { ...source, ...(!viewId ? layout : {}), type: source.type === 'box' ? 'path' : source.type, vectorPath }
      : source)),
    ...(viewId && Object.keys(layout).length ? { adaptiveViews: page.adaptiveViews.map(view => view.id !== viewId ? view : { ...view, overrides: { ...view.overrides, [widgetId]: { ...view.overrides[widgetId], ...layout } } }) } : {}),
  };
}
const STYLE_FIELDS: (keyof WidgetStyle)[] = ['fill', 'stroke', 'strokeWidth', 'radius', 'color', 'fontSize', 'fontFamily', 'fontWeight', 'textAlign', 'opacity'];
const PADDING_SIDES = ['top', 'right', 'bottom', 'left'] as const;
function effectivePadding(widget: Widget): [number, number, number, number] {
  if (widget.style.textPadding) return [...widget.style.textPadding];
  const value = ['input', 'textarea', 'select'].includes(widget.type) ? 7 : 5;
  return [value, value, value, value];
}
function declaredPadding(patch: AdaptiveWidgetOverride): AdaptiveTextPaddingSides {
  return { ...(patch.style?.textPadding ? Object.fromEntries(PADDING_SIDES.map((side, index) => [side, patch.style!.textPadding![index]])) : {}), ...patch.textPaddingSides };
}
function removePaddingTuple(patch: AdaptiveWidgetOverride): void {
  if (patch.style) {
    delete patch.style.textPadding;
    if (!Object.keys(patch.style).length) delete patch.style;
  }
}
type ViewId = string | null | undefined;
const STATE_FIELDS = {
  mouseOver: 'mouseOverStyle', mouseDown: 'mouseDownStyle', focused: 'focusedStyle', selected: 'selectedStyle',
  error: 'errorStyle', hint: 'hintStyle', disabled: 'disabledStyle',
} as const satisfies Record<AdaptiveStateKey, keyof Widget>;

function baseStateStyles(widget: Widget): AdaptiveStateStyles {
  const result: AdaptiveStateStyles = {};
  for (const key of Object.keys(STATE_FIELDS) as AdaptiveStateKey[]) {
    const style = widget[STATE_FIELDS[key]];
    if (style !== undefined) result[key] = structuredClone(style);
  }
  return result;
}

function withStateStyles(widget: Widget, states: AdaptiveStateStyles): Widget {
  const result = { ...widget };
  for (const key of Object.keys(STATE_FIELDS) as AdaptiveStateKey[]) {
    const field = STATE_FIELDS[key];
    delete result[field];
    if (states[key] !== undefined) result[field] = structuredClone(states[key]);
  }
  return result;
}

function sharedAdaptiveState(page: Page, widget: Widget): boolean {
  return ['table', 'tableCell', 'menu', 'tree'].includes(widget.type) ||
    menuSharedDescendantIds(page.widgets).has(widget.id) || treeSharedDescendantIds(page.widgets).has(widget.id);
}

/** The nearest present map replaces all older maps, including Base's flat
 * effects. Empty maps and empty individual state entries stay distinct. */
export function getEffectiveAdaptiveStateStyles(page: Page, viewId: ViewId, widgetId: string): AdaptiveStateStyles {
  const chain = adaptiveViewChain(page, viewId), widget = indexWidgets(page.widgets).get(widgetId);
  if (!widget) return {};
  if (!sharedAdaptiveState(page, widget)) {
    for (let i = chain.length - 1; i >= 0; i--) {
      const states = chain[i].overrides[widgetId]?.stateStyles;
      if (states !== undefined) return structuredClone(states);
    }
  }
  return baseStateStyles(widget);
}

/** Presence intentionally differs from effective lookup: current-chain entries
 * (even {}) count across a later whole-map barrier; Base entries must be nonempty.
 * Native image-override and contained-owner gates are outside this model helper. */
export function hasAdaptiveState(page: Page, viewId: ViewId, widgetId: string, state: AdaptiveStateKey): boolean {
  const chain = adaptiveViewChain(page, viewId), widget = indexWidgets(page.widgets).get(widgetId);
  if (!widget) return false;
  if (!sharedAdaptiveState(page, widget) && chain.some(view => view.overrides[widgetId]?.stateStyles?.[state] !== undefined)) return true;
  const style = widget[STATE_FIELDS[state]];
  return style !== undefined && Object.keys(style).length > 0;
}

function sameGradient(a: GradientFill | undefined, b: GradientFill): boolean {
  if (!a || a.type !== b.type || a.stops.length !== b.stops.length || !a.stops.every((stop, index) => stop.offset === b.stops[index].offset && stop.color === b.stops[index].color)) return false;
  const point = (a: GradientPoint, b: GradientPoint) => a.x === b.x && a.y === b.y;
  return a.type === 'linear' && b.type === 'linear' ? point(a.start, b.start) && point(a.end, b.end) : a.type === 'radial' && b.type === 'radial' && point(a.center, b.center) && point(a.axis1, b.axis1) && point(a.axis2, b.axis2);
}

function selectedView(page: Page, viewId: ViewId): AdaptiveView | undefined {
  if (!viewId) return undefined;
  const view = page.adaptiveViews.find(item => item.id === viewId);
  if (!view) throw new Error('Adaptive view does not exist');
  return view;
}

function editableView(page: Page, viewId: string): AdaptiveView {
  const view = selectedView(page, viewId);
  if (!view) throw new Error('Base has no local adaptive overrides');
  return view;
}

function indexWidgets(widgets: Widget[]): Map<string, Widget> {
  const index = new Map<string, Widget>();
  mapWidgets(widgets, widget => {
    if (index.has(widget.id)) throw new Error(`Duplicate widget identifier: ${widget.id}`);
    index.set(widget.id, widget); return widget;
  });
  return index;
}

/** Compose sparse declarations without filling defaults or losing explicit resets. */
function combinedOverride(chain: AdaptiveView[], widgetId: string, widget?: Widget): AdaptiveWidgetOverride | undefined {
  let result: AdaptiveWidgetOverride | undefined;
  let padding: [number, number, number, number] | undefined;
  for (const view of chain) {
    const patch = view.overrides[widgetId];
    if (!patch) continue;
    const style = patch.style ? { ...result?.style, ...patch.style } : result?.style;
    if (style && patch.style) {
      // These atomic pairs have the same reset semantics as mergeWidgetStyle,
      // but this object is a sparse patch, never a complete WidgetStyle.
      for (const [plain, richer] of [['fill', 'fillGradient'], ['stroke', 'strokeGradient'], ['radius', 'cornerRadii'], ['strokeWidth', 'borderWidths']] as const) {
        if (Object.hasOwn(patch.style, plain) && !Object.hasOwn(patch.style, richer)) delete style[richer];
      }
    }
    if (patch.style?.textPadding) padding = [...patch.style.textPadding];
    if (patch.textPaddingSides && Object.keys(patch.textPaddingSides).length) {
      padding ??= widget ? effectivePadding(widget) : [5, 5, 5, 5];
      PADDING_SIDES.forEach((side, index) => { if (patch.textPaddingSides![side] !== undefined) padding![index] = patch.textPaddingSides![side]!; });
    }
    const { textPaddingSides: _sides, ...properties } = patch;
    result = { ...result, ...properties, ...(style ? { style } : {}) };
    if (padding) result.style = { ...result.style, textPadding: [...padding] };
  }
  return result;
}

/** Aggregate only declarations; callers can also apply explicit rich-run overrides. */
export function resolveAdaptiveOverride(page: Page, viewId: ViewId, widgetId: string): AdaptiveWidgetOverride | undefined {
  return combinedOverride(adaptiveViewChain(page, viewId), widgetId, indexWidgets(page.widgets).get(widgetId));
}

export function resolveAdaptiveWidgets(page: Page, viewId?: ViewId): Widget[] {
  const chain = adaptiveViewChain(page, viewId);
  if (!chain.length) return fitLayerTree(page.widgets);
  const menuContents = new Set([...menuSharedDescendantIds(page.widgets), ...treeSharedDescendantIds(page.widgets)]);
  return fitLayerTree(mapWidgets(page.widgets, widget => {
    const override = combinedOverride(chain, widget.id, widget);
    if (!override) return widget;
    if (widget.type === 'tableCell' || menuContents.has(widget.id)) return widget;
    if (widget.type === 'table' || widget.type === 'menu' || widget.type === 'tree') return { ...widget, ...(override.hidden === undefined ? {} : { hidden: override.hidden }), ...(override.placed === undefined ? {} : { placed: override.placed }) };
    const { stateStyles, ...properties } = override;
    const resolved = { ...widget, ...properties, style: mergeWidgetStyle(widget.style, override.style) };
    return stateStyles === undefined ? resolved : withStateStyles(resolved, stateStyles);
  }));
}

function layoutDifference(base: Widget, edited: Widget): AdaptiveWidgetOverride {
  const diff: AdaptiveWidgetOverride = {};
  for (const field of ADAPTIVE_LAYOUT_FIELDS) {
    // Group frames are a cache of their effective members, never independent
    // per-view positions/sizes. Moving a group edits its members in that view.
    if (edited.type === 'layer' && ['x', 'y', 'width', 'height'].includes(field)) continue;
    if (field === 'placed') {
      if (edited.placed !== undefined && typeof edited.placed !== 'boolean') throw new Error('Widget placed state must be a boolean');
      if ((edited.placed !== false) !== (base.placed !== false)) diff.placed = edited.placed !== false;
    } else if (field === 'hidden') {
      if (typeof edited.hidden !== 'boolean') throw new Error('Widget hidden state must be a boolean');
      if (edited.hidden !== base.hidden) diff.hidden = edited.hidden;
    } else {
      const value = edited[field], min = field === 'width' || field === 'height' ? edited.type === 'layer' ? 0 : 1 : -100_000;
      if (!Number.isFinite(value) || value < min || value > 100_000) throw new Error(`Invalid adaptive widget ${field}`);
      if (value !== base[field]) diff[field] = value;
    }
  }
  const style: Partial<WidgetStyle> = Object.fromEntries(STYLE_FIELDS.filter(field => edited.style[field] !== base.style[field]).map(field => [field, edited.style[field]]));
  // Native P106–P109 are separate properties. An explicit none/false can reset
  // inherited pins without copying or clearing the other three declarations.
  const basePins = resolveResizePins(base.style), editedPins = resolveResizePins(edited.style);
  for (const key of ['pinHorizontal', 'pinVertical', 'fixedWidth', 'fixedHeight'] as const) {
    if (basePins[key] !== editedPins[key]) Object.assign(style, { [key]: editedPins[key] });
  }
  for (const [solid, gradient] of [['fill', 'fillGradient'], ['stroke', 'strokeGradient']] as const) {
    const paint = edited.style[gradient];
    if (paint) {
      // A solid-color change would otherwise clear the inherited gradient. Keep
      // its complete paint when both are authored in the same view.
      if (Object.hasOwn(style, solid) || !sameGradient(base.style[gradient], paint)) style[gradient] = structuredClone(paint);
    } else if (base.style[gradient]) {
      // Even an identical solid color is a meaningful reset of the base gradient.
      style[solid] = edited.style[solid];
    }
  }
  if (edited.style.cornerRadii) {
    if (!base.style.cornerRadii || edited.style.cornerRadii.some((value, index) => value !== base.style.cornerRadii![index])) style.cornerRadii = [...edited.style.cornerRadii];
    // A radius override implicitly clears corners, so explicitly retain them when both are wanted.
    if (Object.hasOwn(style, 'radius')) style.cornerRadii = [...edited.style.cornerRadii];
  } else if (base.style.cornerRadii) style.radius = edited.style.radius;
  // Native P81 is independent from P71 and the legacy four-radius extension.
  // Explicit all-true is required to override an inherited partial mask.
  const baseCorners = base.style.cornerVisibility ?? [true, true, true, true];
  const editedCorners = edited.style.cornerVisibility ?? [true, true, true, true];
  if (editedCorners.some((corner, index) => corner !== baseCorners[index])) style.cornerVisibility = [...editedCorners] as [boolean, boolean, boolean, boolean];
  if (edited.style.borderWidths) {
    if (!base.style.borderWidths || edited.style.borderWidths.some((value, index) => value !== base.style.borderWidths![index])) style.borderWidths = [...edited.style.borderWidths];
    if (Object.hasOwn(style, 'strokeWidth')) style.borderWidths = [...edited.style.borderWidths];
  } else if (base.style.borderWidths) style.strokeWidth = edited.style.strokeWidth;
  if (edited.style.textPadding) {
    if (!base.style.textPadding || edited.style.textPadding.some((value, index) => value !== base.style.textPadding![index])) style.textPadding = [...edited.style.textPadding];
  } else if (base.style.textPadding) {
    // JSON cannot carry undefined as a local reset; persist equivalent default insets.
    const padding = ['input', 'textarea', 'select'].includes(edited.type) ? 7 : 5;
    style.textPadding = [padding, padding, padding, padding];
  }
  if (edited.style.verticalAlign !== base.style.verticalAlign) style.verticalAlign = edited.style.verticalAlign ?? (edited.type === 'text' ? 'top' : 'middle');
  if (edited.style.lineHeight !== base.style.lineHeight) style.lineHeight = edited.style.lineHeight ?? 1.35;
  // Undefined is not a JSON reset: a view clearing base italic must retain normal.
  if ((edited.style.fontStyle ?? 'normal') !== (base.style.fontStyle ?? 'normal')) style.fontStyle = edited.style.fontStyle ?? 'normal';
  for (const key of ['underline', 'strikethrough'] as const) if ((edited.style[key] ?? false) !== (base.style[key] ?? false)) style[key] = edited.style[key] ?? false;
  if ((edited.style.linePattern ?? 'solid') !== (base.style.linePattern ?? 'solid')) style.linePattern = edited.style.linePattern ?? 'solid';
  const baseEnds = base.style.lineEnds ?? { start: 'none', end: 'none' };
  const editedEnds = edited.style.lineEnds ?? { start: 'none', end: 'none' };
  if (baseEnds.start !== editedEnds.start || baseEnds.end !== editedEnds.end) style.lineEnds = { ...editedEnds };
  const baseSides = base.style.borderVisibility ?? [true, true, true, true];
  const editedSides = edited.style.borderVisibility ?? [true, true, true, true];
  if (editedSides.some((side, index) => side !== baseSides[index])) style.borderVisibility = [...editedSides] as [boolean, boolean, boolean, boolean];
  for (const key of ['outerShadow', 'innerShadow', 'textShadow'] as const) {
    const before = base.style[key], after = edited.style[key];
    const same = before === after || before && after && before.on === after.on && before.offsetX === after.offsetX && before.offsetY === after.offsetY && before.blurRadius === after.blurRadius && before.color === after.color && (key !== 'innerShadow' || base.style.innerShadow?.spread === edited.style.innerShadow?.spread);
    if (!same) {
      // A removed base shadow needs a saved off value; undefined cannot reset it in JSON.
      if (key === 'innerShadow') style.innerShadow = edited.style.innerShadow ? { ...edited.style.innerShadow } : { ...base.style.innerShadow!, on: false };
      else style[key] = after ? { ...after } : { ...before!, on: false };
    }
  }
  if (Object.keys(style).length) diff.style = style;
  return diff;
}

// View declarations remain local even when an ancestor later happens to match
// their value. Compare against the previous leaf, not only the current parent.
function sameStyleValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameStyleValue(left[key], right[key]));
}

function preserveUnchangedDeclarations(diff: AdaptiveWidgetOverride, local: AdaptiveWidgetOverride | undefined, previous: Widget, edited: Widget): void {
  if (!local) return;
  for (const key of ADAPTIVE_LAYOUT_FIELDS) {
    if (Object.hasOwn(local, key) && edited[key] === previous[key]) Object.assign(diff, { [key]: local[key] });
  }
  if (!local.style) return;
  const groups = [['fill', 'fillGradient'], ['stroke', 'strokeGradient'], ['radius', 'cornerRadii'], ['strokeWidth', 'borderWidths']] as const;
  const grouped = new Set<keyof WidgetStyle>(groups.flat());
  const preserve = (key: keyof WidgetStyle) => {
    if (Object.hasOwn(local.style!, key)) diff.style = { ...diff.style, [key]: structuredClone(local.style![key]) };
  };
  // Omission and an explicit native default have the same effective value.
  // A no-op edit must not erase an existing false/none declaration.
  const previousPins = resolveResizePins(previous.style), editedPins = resolveResizePins(edited.style);
  for (const key of ['pinHorizontal', 'pinVertical', 'fixedWidth', 'fixedHeight'] as const) {
    if (previousPins[key] === editedPins[key]) preserve(key);
  }
  // A changed member replaces the atomic pair through layoutDifference. Keeping
  // its old partner could otherwise resurrect a gradient or per-side geometry.
  for (const group of groups) {
    if (group.every(key => sameStyleValue(previous.style[key], edited.style[key]))) group.forEach(preserve);
  }
  for (const key of Object.keys(local.style) as (keyof WidgetStyle)[]) {
    if (!grouped.has(key) && sameStyleValue(previous.style[key], edited.style[key])) preserve(key);
  }
}

/** Unchanged legacy tuples stay byte-for-byte. Once an edge changes, retain
 * the other explicit edges sparsely so each can still inherit independently. */
function retainLocalPadding(diff: AdaptiveWidgetOverride, local: AdaptiveWidgetOverride | undefined, parent: Widget, previous: Widget, edited: Widget): void {
  const before = effectivePadding(previous), after = effectivePadding(edited), inherited = effectivePadding(parent);
  const changed = PADDING_SIDES.filter((_side, index) => before[index] !== after[index]);
  removePaddingTuple(diff);
  if (!changed.length) {
    if (local?.style?.textPadding) diff.style = { ...diff.style, textPadding: [...local.style.textPadding] };
    if (local?.textPaddingSides !== undefined) diff.textPaddingSides = { ...local.textPaddingSides };
    return;
  }
  const sides = local ? declaredPadding(local) : {};
  for (const side of changed) {
    const index = PADDING_SIDES.indexOf(side);
    if (after[index] === inherited[index]) delete sides[side]; else sides[side] = after[index];
  }
  if (Object.keys(sides).length) diff.textPaddingSides = sides;
}

function pruneOverrides(views: AdaptiveView[], widgetIds: Set<string>): AdaptiveView[] {
  return views.map(view => {
    const entries = Object.entries(view.overrides).filter(([id]) => widgetIds.has(id));
    return entries.length === Object.keys(view.overrides).length ? view : { ...view, overrides: Object.fromEntries(entries) };
  });
}

/** Author commands operate on the full graph, not the canvas's placed subset. */
function placementTargets(page: Page, ids: Iterable<string>): Set<string> {
  const index = indexWidgets(page.widgets), targets = new Set(ids);
  const shared = new Set([...menuSharedDescendantIds(page.widgets), ...treeSharedDescendantIds(page.widgets)]);
  for (const id of targets) {
    if (!index.has(id)) { targets.delete(id); continue; }
    if (shared.has(id) || index.get(id)!.type === 'tableCell') throw new Error('Contained content is shared; select its whole table, menu or tree');
  }
  return targets;
}

/** Placement is independent of visibility. An explicit local true is retained
 * even when its ancestor currently happens to be placed. All-views changes
 * clear only this property, including inactive declarations from other sets. */
export function setAdaptivePlacement(page: Page, viewId: ViewId, ids: Iterable<string>, placed: boolean, allViews = false): Page {
  if (typeof placed !== 'boolean') throw new Error('Widget placed state must be a boolean');
  const view = selectedView(page, viewId), targets = placementTargets(page, ids);
  if (!targets.size) return page;
  const next = structuredClone(page);
  if (!view || allViews) next.widgets = mapWidgets(next.widgets, widget => targets.has(widget.id) ? { ...widget, placed } : widget);
  if (allViews) {
    for (const map of [...next.adaptiveViews.map(view => view.overrides), ...Object.values(next.adaptiveOverrides ?? {})]) {
      for (const id of targets) if (map[id]) delete map[id].placed;
    }
  } else if (view) {
    const map = next.adaptiveViews.find(item => item.id === view.id)!.overrides;
    for (const id of targets) map[id] = { ...map[id], placed };
  }
  return sameStyleValue(next, page) ? page : next;
}

/** Delete in a child view is Unplace. Explicit global deletion and Base deletion
 * remove the graph and all its declarations; dangling action targets retain the
 * existing document contract rather than being silently rewritten. */
export function deleteAdaptiveWidgets(page: Page, viewId: ViewId, ids: Iterable<string>, allViews = false): Page {
  selectedView(page, viewId);
  const targets = placementTargets(page, ids);
  if (!targets.size) return page;
  if (viewId && !allViews) return setAdaptivePlacement(page, viewId, targets, false);
  const widgets = deleteWidgetTree(page.widgets, [...targets]);
  const retained = new Set(indexWidgets(widgets).keys());
  const adaptiveViews = pruneOverrides(page.adaptiveViews, retained);
  const adaptiveOverrides = page.adaptiveOverrides === undefined ? undefined : Object.fromEntries(Object.entries(page.adaptiveOverrides).map(([id, map]) => [id, Object.fromEntries(Object.entries(map).filter(([widgetId]) => retained.has(widgetId)))]));
  return { ...page, widgets, adaptiveViews, ...(adaptiveOverrides === undefined ? {} : { adaptiveOverrides }) };
}

/** Authoring scope lookup: a placed child does not bypass an unplaced panel or
 * repeater ancestor. Shared composite contents are edited through their owner. */
export function isAdaptiveWidgetPlaced(widgets: Widget[], id: string): boolean {
  const visit = (items: Widget[], parentPlaced: boolean): boolean | undefined => {
    for (const widget of items) {
      const placed = parentPlaced && widget.placed !== false;
      if (widget.id === id) return placed;
      const found = visit(widgetChildCollections(widget).flatMap(children => children.widgets), placed);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return visit(widgets, true) ?? false;
}

export interface AdaptiveWidgetEditOptions {
  placementAllViews?: boolean;
  /** Apply actual property edits to Base and remove those declarations in every
   * view, including inactive maps. This does not promote the effective widget. */
  allViews?: boolean;
  /** Existing whole-widget rich-text commands also carry equal-value resets.
   * These are editor intent, never persistent document metadata. */
  explicitTextStyle?: Partial<WidgetStyle>;
  explicitTextWidgetIds?: Iterable<string>;
}

function needsRichTextReset(widget: Widget, key: typeof RICH_TEXT_STYLE_KEYS[number] | 'textAlign' | 'lineHeight', value: unknown): boolean {
  if (!widget.richText) return false;
  if (key === 'lineHeight') return widget.richText.paragraphs.some(paragraph => paragraph.lineHeightPx !== undefined);
  if (key === 'textAlign') return widget.richText.paragraphs.some(paragraph => value === undefined ? paragraph.textAlign !== undefined : (paragraph.textAlign ?? widget.style.textAlign) !== value);
  const normalized = (value: unknown) => value ?? (key === 'fontStyle' ? 'normal' : key === 'underline' || key === 'strikethrough' ? false : undefined);
  return widget.richText.paragraphs.some(paragraph => paragraph.runs.some(run => value === undefined
    ? run.style?.[key] !== undefined
    : normalized(run.style?.[key] ?? widget.style[key]) !== normalized(value)));
}

function applyAllViewsEdits(page: Page, viewId: ViewId, visibleWidgets: Widget[], options: AdaptiveWidgetEditOptions): Page {
  const previous = indexWidgets(resolveAdaptiveWidgets(page, viewId));
  const visible = indexWidgets(visibleWidgets);
  // Preserve the established shared-content/structure and composite boundaries.
  // Only the property groups below are promoted; current-view diffs for those
  // groups are then removed along with ancestor, sibling and inactive diffs.
  const current = applyAdaptiveWidgetEdits(page, viewId, visibleWidgets, { placementAllViews: options.placementAllViews });
  const result = structuredClone(current), raw = indexWidgets(result.widgets);
  const shared = new Set([...menuSharedDescendantIds(page.widgets), ...treeSharedDescendantIds(page.widgets)]);
  const textTargets = new Set(options.explicitTextWidgetIds ?? []);
  const maps = [...result.adaptiveViews.map(view => view.overrides), ...Object.values(result.adaptiveOverrides ?? {})];
  for (const [id, edited] of visible) {
    const before = previous.get(id), base = raw.get(id);
    if (!before || !base || edited.type === 'tableCell' || shared.has(id)) continue;
    const composite = ['table', 'menu', 'tree'].includes(edited.type);
    const diff = composite ? {} : layoutDifference(before, edited);
    const layoutKeys = new Set<keyof AdaptiveWidgetOverride>();
    if (!composite) {
      // Native LOCATION and SIZE are whole Point/Size values, not independent
      // scalar edits. The untouched axis comes from the current effective view.
      if (diff.x !== undefined || diff.y !== undefined) { layoutKeys.add('x'); layoutKeys.add('y'); }
      if (diff.width !== undefined || diff.height !== undefined) { layoutKeys.add('width'); layoutKeys.add('height'); }
      if (diff.rotation !== undefined) layoutKeys.add('rotation');
    }
    if (before.hidden !== edited.hidden) layoutKeys.add('hidden');
    if ((before.placed !== false) !== (edited.placed !== false)) layoutKeys.add('placed');
    for (const key of layoutKeys) {
      Object.assign(base, { [key]: edited[key as keyof Widget] });
      for (const map of maps) if (map[id]) delete map[id][key];
    }
    if (composite) continue;
    const styleKeys = new Set<keyof WidgetStyle>(Object.keys(diff.style ?? {}) as (keyof WidgetStyle)[]);
    styleKeys.delete('textPadding');
    const beforePadding = effectivePadding(before), afterPadding = effectivePadding(edited);
    const changedSides = PADDING_SIDES.filter((_side, index) => beforePadding[index] !== afterPadding[index]);
    if (changedSides.length) {
      const basePadding = effectivePadding(base);
      for (const side of changedSides) basePadding[PADDING_SIDES.indexOf(side)] = afterPadding[PADDING_SIDES.indexOf(side)];
      base.style.textPadding = basePadding;
      for (const map of maps) if (map[id]) {
        const sides = declaredPadding(map[id]);
        if (!changedSides.some(side => Object.hasOwn(sides, side))) continue;
        changedSides.forEach(side => { delete sides[side]; });
        removePaddingTuple(map[id]);
        if (Object.keys(sides).length) map[id].textPaddingSides = sides; else delete map[id].textPaddingSides;
      }
    }
    // Fill and BorderFill are native atomic paints. The radius/corners and
    // width/side-width pairs retain this product's existing reset convention;
    // the richer tuples are not the native corner/side visibility masks.
    for (const [solid, gradient] of [['fill', 'fillGradient'], ['stroke', 'strokeGradient'], ['radius', 'cornerRadii'], ['strokeWidth', 'borderWidths']] as const) {
      if (styleKeys.has(solid) || styleKeys.has(gradient)) { styleKeys.add(solid); styleKeys.add(gradient); }
    }
    const explicit = textTargets.has(id) && base.richText && options.explicitTextStyle;
    const textPatch: Partial<WidgetStyle> = {};
    if (explicit) {
      for (const key of [...RICH_TEXT_STYLE_KEYS, 'textAlign', 'lineHeight'] as const) {
        if (Object.hasOwn(explicit, key) && (styleKeys.has(key) || needsRichTextReset(base, key, explicit[key]))) {
          Object.assign(textPatch, { [key]: explicit[key] });
          styleKeys.add(key);
        }
      }
    }
    for (const key of styleKeys) {
      if (Object.hasOwn(textPatch, key)) {
        const value = textPatch[key];
        if (value === undefined) delete (base.style as Partial<WidgetStyle>)[key];
        else Object.assign(base.style, { [key]: structuredClone(value) });
      } else if (edited.style[key] === undefined) delete (base.style as Partial<WidgetStyle>)[key];
      else Object.assign(base.style, { [key]: structuredClone(edited.style[key]) });
      for (const map of maps) if (map[id]?.style) {
        delete map[id].style![key];
        if (!Object.keys(map[id].style!).length) delete map[id].style;
      }
    }
    if (base.richText && Object.keys(textPatch).length) base.richText = applyRichTextStyle(base.richText, textPatch);
    // Native P21 is a complete state map. A single-state editor first retains
    // the other effective states, then submits this one atomic property.
    const priorStates = baseStateStyles(before), editedStates = baseStateStyles(edited);
    // Native's first-effect creation bypasses SetStyle/EditAllAdaptive. Keep
    // the established current-slot result when the effective graph was empty;
    // an existing individual empty state ({focused:{}}) is still a graph.
    if (Object.keys(priorStates).length && !sameStyleValue(priorStates, editedStates)) {
      for (const state of Object.keys(STATE_FIELDS) as AdaptiveStateKey[]) {
        const field = STATE_FIELDS[state];
        delete base[field];
        if (editedStates[state] !== undefined) base[field] = structuredClone(editedStates[state]);
      }
      for (const map of maps) if (map[id]) delete map[id].stateStyles;
    }
  }
  result.widgets = fitLayerTree(result.widgets.map(widget => raw.get(widget.id)!));
  return sameStyleValue(result, page) ? page : result;
}

/**
 * Accept the complete visible page tree. Content, structure, additions and deletions are shared.
 * Only layout, visibility and changed style properties belong to the selected view.
 */
export function applyAdaptiveWidgetEdits(page: Page, viewId: ViewId, visibleWidgets: Widget[], options: AdaptiveWidgetEditOptions = {}): Page {
  if (options.allViews) return applyAllViewsEdits(page, viewId, visibleWidgets, options);
  const view = selectedView(page, viewId);
  const original = indexWidgets(page.widgets), visible = indexWidgets(visibleWidgets);
  for (const [id, edited] of visible) {
    const base = original.get(id);
    if (base && base.type !== edited.type) throw new Error('Changing an existing widget type is not supported');
  }
  if (!view) return { ...page, widgets: fitLayerTree(structuredClone(visibleWidgets)), adaptiveViews: pruneOverrides(page.adaptiveViews, new Set(visible.keys())) };

  const inherited = indexWidgets(resolveAdaptiveWidgets(page, view.baseViewId));
  const previous = indexWidgets(resolveAdaptiveWidgets(page, view.id));
  const overrides: Record<string, AdaptiveWidgetOverride> = {};
  const newRoots = new Set<string>();
  if (options.placementAllViews === false) {
    const visit = (items: Widget[], newAncestor = false) => {
      for (const item of items) {
        const added = !original.has(item.id);
        if (added && !newAncestor) newRoots.add(item.id);
        visit(widgetChildCollections(item).flatMap(children => children.widgets), newAncestor || added);
      }
    };
    visit(visibleWidgets);
  }
  const menuContents = new Set([...menuSharedDescendantIds(visibleWidgets), ...treeSharedDescendantIds(visibleWidgets)]);
  // mapWidgets has already processed descendants when this callback runs. Keep those shared edits.
  const baseWidgets = mapWidgets(structuredClone(visibleWidgets), edited => {
    const base = original.get(edited.id);
    if (!base) {
      if (newRoots.has(edited.id)) { overrides[edited.id] = { placed: true }; return { ...edited, placed: false }; }
      return edited;
    }
    const parent = inherited.get(edited.id)!;
    if (edited.type === 'tableCell' || menuContents.has(edited.id)) return edited;
    if (edited.type === 'table' || edited.type === 'menu' || edited.type === 'tree') {
      const local = view.overrides[edited.id];
      if (edited.hidden !== parent.hidden || local && Object.hasOwn(local, 'hidden') && edited.hidden === previous.get(edited.id)!.hidden) overrides[edited.id] = { hidden: edited.hidden };
      if ((edited.placed !== false) !== (parent.placed !== false) || local && Object.hasOwn(local, 'placed') && edited.placed === previous.get(edited.id)!.placed) overrides[edited.id] = { ...overrides[edited.id], placed: edited.placed !== false };
      const result = { ...edited, hidden: base.hidden };
      if (base.placed === undefined) delete result.placed; else result.placed = base.placed;
      return result;
    }
    const diff = layoutDifference(parent, edited);
    // This also retains explicit normal/400/color commands that reset mixed
    // rich runs, without writing inherited values as new local declarations.
    preserveUnchangedDeclarations(diff, view.overrides[edited.id], previous.get(edited.id)!, edited);
    retainLocalPadding(diff, view.overrides[edited.id], parent, previous.get(edited.id)!, edited);
    const priorStates = baseStateStyles(previous.get(edited.id)!), editedStates = baseStateStyles(edited);
    if (!sameStyleValue(priorStates, editedStates)) {
      // Independent authoring policy: editing any effect materializes the whole
      // effective map, so a local edit cannot accidentally erase sibling effects.
      diff.stateStyles = editedStates;
    } else if (view.overrides[edited.id]?.stateStyles !== undefined) {
      diff.stateStyles = structuredClone(view.overrides[edited.id].stateStyles);
    }
    if (Object.keys(diff).length) overrides[edited.id] = sameStyleValue(diff, view.overrides[edited.id]) ? structuredClone(view.overrides[edited.id]) : diff;
    const restored = withStateStyles({ ...edited, x: base.x, y: base.y, width: base.width, height: base.height, rotation: base.rotation, hidden: base.hidden, style: structuredClone(base.style) }, baseStateStyles(base));
    if (base.placed === undefined) delete restored.placed; else restored.placed = base.placed;
    return restored;
  });
  const views = pruneOverrides(page.adaptiveViews, new Set(visible.keys())).map(item => item.id === view.id ? { ...item, overrides } : item);
  return { ...page, widgets: fitLayerTree(baseWidgets), adaptiveViews: views };
}

function validViewName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 500) throw new Error('Adaptive view requires a name of at most 500 characters');
  return trimmed;
}
function validViewDimension(value: number, field: 'width' | 'height', min = 0): number {
  if (!Number.isFinite(value) || value < min || value > 100_000) throw new Error(`Adaptive view ${field} must be between ${min} and 100000`);
  return value;
}

export function createAdaptiveView(page: Page, name = 'Mobile', width = 390, options: { height?: number; baseViewId?: string } = {}): Page {
  if (page.adaptiveViews.length >= 50) throw new Error('A page supports at most 50 adaptive views');
  if (options.baseViewId !== undefined) {
    editableView(page, options.baseViewId); adaptiveViewChain(page, options.baseViewId);
  }
  const view: AdaptiveView = { id: uid(), name: validViewName(name), width: validViewDimension(width, 'width', page.adaptiveSelection === 'native-size' ? 0 : 1),
    ...(options.height === undefined && page.adaptiveSelection !== 'native-size' ? {} : { height: validViewDimension(options.height ?? 0, 'height') }),
    ...(options.baseViewId === undefined ? {} : { baseViewId: options.baseViewId }), overrides: {} };
  return { ...page, adaptiveViews: [...page.adaptiveViews, view] };
}

export function updateAdaptiveView(page: Page, viewId: string, patch: { name?: string; width?: number; height?: number; baseViewId?: string | null }): Page {
  const view = editableView(page, viewId);
  const updated = { ...view,
    ...(patch.name !== undefined ? { name: validViewName(patch.name) } : {}),
    ...(patch.width !== undefined ? { width: validViewDimension(patch.width, 'width', page.adaptiveSelection === 'native-size' ? 0 : 1) } : {}),
    ...(patch.height !== undefined ? { height: validViewDimension(patch.height, 'height') } : {}),
  };
  if (patch.baseViewId === null) delete updated.baseViewId;
  else if (patch.baseViewId !== undefined) {
    editableView(page, patch.baseViewId); updated.baseViewId = patch.baseViewId;
  }
  const result = { ...page, adaptiveViews: page.adaptiveViews.map(item => item.id === view.id ? updated : item) };
  adaptiveViewChain(result, view.id);
  return result;
}

export function updateAdaptiveBaseSize(page: Page, patch: { width?: number; height?: number }): Page {
  if (page.adaptiveSelection !== 'native-size') throw new Error('Base selection size requires native-size mode');
  return { ...page, adaptiveBaseSize: {
    width: validViewDimension(patch.width ?? page.adaptiveBaseSize?.width ?? 0, 'width'),
    height: validViewDimension(patch.height ?? page.adaptiveBaseSize?.height ?? 0, 'height'),
  } };
}

export function clearAdaptiveOverrides(page: Page, viewId: string, widgetIds?: Iterable<string>): Page {
  const view = editableView(page, viewId);
  const selected = widgetIds === undefined ? undefined : new Set(widgetIds);
  return { ...page, adaptiveViews: page.adaptiveViews.map(item => item.id === view.id ? {
    ...item, overrides: selected ? Object.fromEntries(Object.entries(item.overrides).filter(([id]) => !selected.has(id))) : {},
  } : item) };
}

/** Restore inherited effects without removing local geometry or normal style. */
export function clearAdaptiveStateStyles(page: Page, viewId: string, widgetIds?: Iterable<string>): Page {
  const view = editableView(page, viewId), selected = widgetIds === undefined ? undefined : new Set(widgetIds);
  return { ...page, adaptiveViews: page.adaptiveViews.map(item => {
    if (item.id !== view.id) return item;
    const overrides: Record<string, AdaptiveWidgetOverride> = {};
    for (const [id, patch] of Object.entries(item.overrides)) {
      if (selected && !selected.has(id) || patch.stateStyles === undefined) { overrides[id] = patch; continue; }
      const rest = { ...patch }; delete rest.stateStyles;
      if (Object.keys(rest).length) overrides[id] = rest;
    }
    return { ...item, overrides };
  }) };
}

export function deleteAdaptiveView(page: Page, viewId: string): Page {
  const removed = editableView(page, viewId);
  adaptiveViewChain(page, viewId);
  return { ...page, adaptiveViews: page.adaptiveViews.filter(view => view.id !== viewId).map(view => {
    if (view.baseViewId !== removed.id) return view;
    const next = { ...view };
    if (removed.baseViewId === undefined) delete next.baseViewId;
    else next.baseViewId = removed.baseViewId;
    return next;
  }) };
}
