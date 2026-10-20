import type { Widget, WidgetStyle } from '../model/types';
import { mergeWidgetStyle } from '../model/document';

export type CornerEffectField = 'mouseOverStyle' | 'mouseDownStyle' | 'focusedStyle' | 'selectedStyle' | 'errorStyle' | 'hintStyle' | 'disabledStyle';
export type CornerStyleCommand =
  | { kind: 'radius'; value: number }
  | { kind: 'visibility'; corner: 0 | 1 | 2 | 3; value: boolean }
  | { kind: 'inherit' | 'override'; property: 'radius' | 'cornerVisibility' };

/** A single-edge control is distinct from an intentional full-padding command. */
export type WidgetStyleEditIntent = {
  kind: 'textPaddingSide';
  side: 'top' | 'right' | 'bottom' | 'left';
  value: number;
} | { kind: 'corners'; command: CornerStyleCommand; effect?: CornerEffectField };

/** A single native property command; P71 never resets P81, nor vice versa. */
export function cornerStylePatch(style: WidgetStyle, command: CornerStyleCommand): Partial<WidgetStyle> {
  if (command.kind === 'radius') {
    if (style.radius === command.value && !style.cornerRadii) return {};
    return { radius: command.value };
  }
  if (command.kind === 'visibility') {
    const mask = style.cornerVisibility ?? [true, true, true, true];
    if (mask[command.corner] === command.value) return {};
    const cornerVisibility = [...mask] as [boolean, boolean, boolean, boolean];
    cornerVisibility[command.corner] = command.value;
    return { cornerVisibility };
  }
  if (command.kind === 'inherit') return { [command.property]: undefined };
  return command.property === 'radius' ? { radius: style.radius } : { cornerVisibility: [...(style.cornerVisibility ?? [true, true, true, true])] };
}

/** Edit a target's own state/action patch without copying another target's styles. */
export function editCornerOverride(base: WidgetStyle, patch: Partial<WidgetStyle>, command: CornerStyleCommand): Partial<WidgetStyle> {
  if (command.kind === 'inherit') {
    if (!Object.hasOwn(patch, command.property)) return patch;
    const next = { ...patch }; delete next[command.property]; return next;
  }
  if (command.kind === 'override' && Object.hasOwn(patch, command.property)) return patch;
  const change = cornerStylePatch(mergeWidgetStyle(base, patch), command);
  if (!Object.keys(change).length) return patch;
  const next = { ...patch, ...change };
  if (Object.hasOwn(change, 'radius')) delete next.cornerRadii;
  return next;
}

/** Resolve a style command against one target, before multi-selection merging. */
export function resolveWidgetStyleCommand(
  widget: Widget,
  patch: Partial<WidgetStyle>,
  intent?: WidgetStyleEditIntent,
): Partial<WidgetStyle> {
  if (!intent) return patch;
  if (intent.kind === 'corners') {
    // A declared mask also opts a proven rectangle path into native corner
    // regeneration. Resetting its value must not remove that declaration.
    if (widget.vectorPath && intent.command.kind === 'inherit' && intent.command.property === 'cornerVisibility') {
      return widget.style.cornerVisibility?.every(Boolean) ? {} : { cornerVisibility: [true, true, true, true] };
    }
    return cornerStylePatch(widget.style, intent.command);
  }
  const index = (['top', 'right', 'bottom', 'left'] as const).indexOf(intent.side);
  const inset = ['input', 'textarea', 'select'].includes(widget.type) ? 7 : 5;
  const current = widget.style.textPadding ?? [inset, inset, inset, inset];
  const { textPadding: _paddingFromCurrentSelection, ...otherChanges } = patch;
  // Do not materialize defaults or clear inherited declarations for an unchanged edge.
  if (current[index] === intent.value) return otherChanges;
  const textPadding = [...current] as [number, number, number, number];
  textPadding[index] = intent.value;
  return { ...otherChanges, textPadding };
}
