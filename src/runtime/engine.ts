import { browserBoxReader } from './browser-box';
import type { Document, EventType, Interaction, RuntimeState, Widget } from '../model/types';
import { DOCUMENT_LIMITS, mergeWidgetStyle, resolveInteractionStylePatch } from '../model/document';
import { createOfflineRuntime, type OfflineRuntime, type RowContext } from './export-runtime';
import { evaluateExpression } from './expressions';
import { applyRichTextStyle, projectTextStyleOverride } from '../model/rich-text';

type Row = Record<string, string>;

/** Snapshot helpers use the same action engine as the live preview and portable HTML. */
function fromSnapshot(doc: Document, state: RuntimeState): OfflineRuntime {
  // These noninteractive helpers return one computed snapshot, so they execute
  // directly. Live preview/export retain the document's menu policy and session.
  const session = createOfflineRuntime({ ...doc, caseSelection: 'never' }, state.pageId, evaluateExpression, browserBoxReader, undefined, state);
  delete session.state().pendingNavigation;
  delete session.state().caseMenus;
  return session;
}

export function createRuntime(doc: Document, pageId?: string): RuntimeState {
  return createOfflineRuntime(doc, pageId, evaluateExpression, browserBoxReader).state();
}

/** Editor-only text projection; live prototypes use the context-aware runtime API. */
export function resolveText(text: string, state: RuntimeState, row?: Row): string {
  const read = (name: string): string => {
    if (name.startsWith('Item.')) return row && Object.hasOwn(row, name.slice(5)) ? row[name.slice(5)] : '';
    if (name.startsWith('Widget.') && name.endsWith('.text')) return state.widgetOverrides[name.slice(7, -5)]?.text ?? '';
    return Object.hasOwn(state.variables, name) ? state.variables[name] : '';
  };
  const parts: string[] = []; let length = 0, cursor = 0;
  const append = (part: string) => {
    length += part.length;
    if (length > DOCUMENT_LIMITS.text) throw new Error(`Resolved text exceeds ${DOCUMENT_LIMITS.text} characters`);
    parts.push(part);
  };
  for (const match of text.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    append(text.slice(cursor, match.index));
    const expression = match[1].trim();
    append(Object.hasOwn(state.variables, expression) || expression.startsWith('Item.') && row && Object.hasOwn(row, expression.slice(5))
      ? read(expression) : evaluateExpression(expression, read));
    cursor = match.index! + match[0].length;
  }
  append(text.slice(cursor)); return parts.join('');
}

export function getRuntimeWidget(widget: Widget, state: RuntimeState): Widget {
  const patch = state.widgetOverrides[widget.id];
  const merged = { ...widget, ...(widget.menu?.parentCellId ? { hidden: true } : {}), ...patch, style: mergeWidgetStyle(widget.style, patch?.style) };
  if (merged.inlineFrame && state.frameNavigations?.[widget.id]) merged.inlineFrame = { ...merged.inlineFrame, target: state.frameNavigations[widget.id].target };
  if (merged.treeNode) merged.selected = Boolean(getRuntimeWidget(merged.treeNode.label, state).selected);
  const textPatch = projectTextStyleOverride({ ...state.richTextStyleOverrides?.[widget.id], ...resolveInteractionStylePatch(merged) });
  if (merged.richText) merged.richText = applyRichTextStyle(merged.richText, textPatch);
  merged.style = mergeWidgetStyle(merged.style, textPatch);
  if (merged.layer) {
    // Snapshot geometry uses committed Layer caches or saved data bounds.
    merged.rotation = state.motionState?.groupAngles?.[JSON.stringify(["layer", widget.id, []])] ?? merged.rotation;
  }
  if (merged.type === 'panel' && merged.fitToContent) {
    const active = merged.states?.find(item => item.id === merged.activeStateId) ?? merged.states?.[0];
    merged.width = 0; merged.height = 0;
    for (const item of active?.widgets ?? []) {
      const child = getRuntimeWidget(item, state); if (child.hidden || child.placed === false) continue;
      const motion = state.motionState, location = motion?.rotationLocations?.[item.id];
      if (location || Object.hasOwn(motion?.rotationTargets ?? {}, item.id) || motion?.resizeTargets?.[item.id]) {
        // Rotate's bounds cache is deliberately distinct from live CSS. A
        // cached zero falls back to the original angle, as in the live core.
        const angle = (child.layer ? 0 : motion?.rotationTargets?.[item.id] || item.rotation) * Math.PI / 180;
        const patch = state.widgetOverrides[item.id], shadow = child.style.outerShadow;
        const resized = motion?.resizeTargets?.[item.id];
        let x = location?.x ?? child.x, y = location?.y ?? child.y, width = resized?.width ?? child.width, height = resized?.height ?? child.height;
        if (!child.layer && shadow?.on) {
          if (!location && patch?.x === undefined && patch?.y === undefined) {
            if (shadow.offsetX < 0) x += shadow.offsetX - shadow.blurRadius;
            if (shadow.offsetY < 0) y += shadow.offsetY - shadow.blurRadius;
          }
          if (!resized && patch?.width === undefined && patch?.height === undefined) { width += Math.abs(shadow.offsetX) + shadow.blurRadius; height += Math.abs(shadow.offsetY) + shadow.blurRadius; }
        }
        merged.width = Math.max(merged.width, x + (width + Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle))) / 2);
        merged.height = Math.max(merged.height, y + (height + Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))) / 2);
        continue;
      }
      const angle = (child.layer ? 0 : child.rotation) * Math.PI / 180;
      merged.width = Math.max(merged.width, child.x + (child.width + Math.abs(child.width * Math.cos(angle)) + Math.abs(child.height * Math.sin(angle))) / 2);
      merged.height = Math.max(merged.height, child.y + (child.height + Math.abs(child.width * Math.sin(angle)) + Math.abs(child.height * Math.cos(angle))) / 2);
    }
  }
  if (merged.repeater && state.repeaterRows[widget.id]) merged.repeater = { ...merged.repeater, rows: state.repeaterRows[widget.id] };
  return merged;
}

export function evaluateConditions(doc: Document, state: RuntimeState, interaction: Interaction, row?: Row, context?: RowContext): boolean {
  const session = fromSnapshot(doc, state);
  try { return session.matches(interaction, row, context); } finally { session.dispose(); }
}

export async function executeInteraction(doc: Document, state: RuntimeState, interaction: Interaction, row?: Row, context?: RowContext): Promise<RuntimeState> {
  const session = fromSnapshot(doc, state);
  try {
    if (!session.matches(interaction, row, context)) return state;
    await session.execute(interaction, row, context);
    return structuredClone(session.state());
  } finally { session.dispose(); }
}

export async function executeWidgetEvent(doc: Document, state: RuntimeState, widgetOrId: Widget | string, event: EventType, row?: Row, context?: RowContext): Promise<RuntimeState> {
  const session = fromSnapshot(doc, state);
  let changed = false; session.subscribe(() => { changed = true; });
  try {
    await session.trigger(typeof widgetOrId === 'string' ? widgetOrId : widgetOrId.id, event, row, context);
    return changed ? structuredClone(session.state()) : state;
  } finally { session.dispose(); }
}

export async function executePageEvent(doc: Document, state: RuntimeState, event: EventType = 'load'): Promise<RuntimeState> {
  const session = fromSnapshot(doc, state);
  try {
    await session.triggerPage(event);
    return structuredClone(session.state());
  } finally { session.dispose(); }
}
