import { createWidget } from './document';
import type { WidgetType } from './types';

/** Functional Default-library declarations, independent of vendor assets/IDs.
 * Stored template geometry is retained here. The original clone/style-import
 * notification chain and final native drop geometry are not yet established.
 * See research/selection-creation-evidence.md; parsing old files must not call
 * this factory to fill absent declarations.
 */
export function createLibraryWidget(type: WidgetType, x = 100, y = 100) {
  const widget = createWidget(type, x, y);
  if (type !== 'checkbox' && type !== 'radio') return widget;
  widget.text = type === 'checkbox' ? 'Checkbox' : 'Radio Button';
  widget.width = type === 'checkbox' ? 75 : 93;
  widget.height = 15;
  widget.error = false;
  // This model represents the template's empty radio group by absence.
  widget.selectionText = { autoFitWidth: true, autoFitHeight: false, alignRight: false };
  widget.style = { ...widget.style,
    fill: '#ffffff', stroke: '#797979', strokeWidth: 1, color: '#333333', fontSize: 13,
    selectionButtonSize: 13, textAlign: 'left', verticalAlign: 'top', lineHeight: 'normal', textPadding: [0, 2, 0, 2],
    linePattern: 'solid', lineEnds: { start: 'none', end: 'none' },
    fontStyle: 'normal', underline: false, strikethrough: false,
    outerShadow: { on: false, offsetX: 5, offsetY: 5, blurRadius: 5, color: '#00000059' },
    innerShadow: { on: false, offsetX: 0, offsetY: 5, blurRadius: 5, color: '#00000059', spread: 0 },
    textShadow: { on: false, offsetX: 1, offsetY: 1, blurRadius: 5, color: '#000000a5' },
  };
  widget.disabledStyle = { fill: '#f0f0f0' };
  widget.richText = { expressionMode: 'literal', paragraphs: [{ textAlign: 'left', lineHeightPx: 'normal', runs: [{
    text: widget.text, style: { color: '#333333', fontSize: 13, fontFamily: 'Arial', fontWeight: 400,
      fontStyle: 'normal', underline: false, strikethrough: false },
  }] }] };
  return widget;
}
