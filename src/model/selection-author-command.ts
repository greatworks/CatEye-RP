import type { Widget } from './types';
import {
  planSelectionLayout, type SelectionLayoutEntry, type SelectionLayoutRect,
  type SelectionLayoutServices,
} from './selection-layout';

export type SelectionAuthorCommand =
  | { kind: 'size'; width?: number; height?: number; allViews: boolean }
  | { kind: 'fit'; axis: 'width' | 'height'; value: boolean }
  | { kind: 'alignRight'; value: boolean };

/** The author host supplies one pre-edit browser panel and explicit geometry
 * services. This wrapper neither measures fonts nor writes a document. */
export function planSelectionAuthorCommand(
  source: Widget, panel: SelectionLayoutRect, command: SelectionAuthorCommand,
  services: SelectionLayoutServices,
) {
  if ((source.type !== 'checkbox' && source.type !== 'radio') || !source.selectionText)
    throw Error('Select a checkbox or radio button with text layout settings');
  if (source.rotation !== 0) throw Error('Text fitting for rotated selection controls is not available');
  if (!source.style.textPadding || source.style.verticalAlign === undefined || source.style.selectionButtonSize === undefined)
    throw Error('Selection text layout requires explicit padding, alignment and indicator size');
  const flags = source.selectionText;
  const entry: SelectionLayoutEntry = command.kind === 'size'
    ? { kind: 'size', size: { width: command.width ?? source.width, height: command.height ?? source.height },
      allViews: command.allViews, notify: true }
    : command;
  const text = source.richText?.paragraphs.map(p => p.runs.map(run => run.text).join('')).join('\n') ?? source.text;
  return planSelectionLayout({
    ownerRect: { x: source.x, y: source.y, width: source.width, height: source.height },
    textPanelRect: { ...panel },
    // The host admits only the page and Layer scopes, whose owner coordinates
    // share the diagram space. Container-local diagrams need separate evidence.
    coordinateContext: { kind: 'translation', ownerRotation: 0, textRotation: 0,
      locationInDiagram: { x: source.x, y: source.y } },
    rawFit: { width: flags.autoFitWidth, height: flags.autoFitHeight },
    effectiveFit: { width: flags.autoFitWidth, height: flags.autoFitHeight },
    alignRight: flags.alignRight, empty: text === '', guard: false,
    padding: source.style.textPadding, indicatorSize: source.style.selectionButtonSize,
    horizontalAlignment: source.style.textAlign, verticalAlignment: source.style.verticalAlign,
  }, entry, services);
}
