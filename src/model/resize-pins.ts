import type { ResizePins, WidgetStyle } from './types';

/** Resolve stored author constraints without mutating or materializing them.
 * Widget capabilities are a separate controller gate, not stored pin defaults. */
export function resolveResizePins(style: Pick<WidgetStyle, keyof ResizePins>): ResizePins {
  return {
    pinHorizontal: style.pinHorizontal ?? 'none',
    pinVertical: style.pinVertical ?? 'none',
    fixedWidth: style.fixedWidth ?? false,
    fixedHeight: style.fixedHeight ?? false,
  };
}
