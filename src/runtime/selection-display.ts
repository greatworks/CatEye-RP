import type { Widget } from '../model/types';
import type { SelectionTextLayout, SelectionDisplayRect } from './selection-text-layout';

export interface SelectionIndicatorPainter {
  supports(widget: Widget): boolean;
  paint(svg: SVGSVGElement, source: Widget, current: Widget, rect: SelectionDisplayRect): void;
}

/** Portable DOM host. All computed panels are transient browser substitutes.
 * Its source is an authored template, never the text after a runtime setter. */
export function createSelectionDisplay(layout: SelectionTextLayout, indicator: SelectionIndicatorPainter) {
  type Entry = {
    key: string; source: Widget; current: Widget; text: HTMLElement; input: HTMLInputElement;
    result: NonNullable<ReturnType<SelectionTextLayout['measure']>>;
  };
  const entries = new WeakMap<HTMLLabelElement, Entry>();
  const supports = (widget: Widget) => layout.supports(widget) && indicator.supports(widget);
  const apply = (label: HTMLLabelElement, entry: Entry) => {
    const { source, current, result, text, input } = entry, document = label.ownerDocument;
    Object.assign(label.style, { position: 'absolute', display: 'block', left: '0px', top: '0px',
      width: '100%', height: '100%', border: '0px', margin: '0px', padding: '0px', gap: '0px', overflow: 'visible' });
    label.dataset.selectionDisplay = result.origin; delete label.dataset.selectionDisplayError;
    Object.assign(input.style, { position: 'absolute', left: '0px', top: '0px', width: '0px', height: '0px',
      margin: '0px', padding: '0px', borderWidth: '0px', opacity: '0', transform: 'none' });
    const padding = source.style.textPadding!;
    // rNPL expands the horizontal rectangle; nNLd independently emits all four
    // padding sides with border-box, including top/bottom after panel placement.
    Object.assign(text.style, { position: 'absolute', left: `${result.text.x}px`, top: `${result.text.y}px`,
      width: `${result.text.width}px`, height: '', margin: '0px', boxSizing: 'border-box',
      padding: padding.map(value => `${value}px`).join(' '), overflow: 'visible',
      lineHeight: String(current.style.lineHeight ?? 'normal'), whiteSpace: source.selectionText!.autoFitWidth ? 'nowrap' : 'normal',
      overflowWrap: source.selectionText!.autoFitWidth ? 'normal' : 'break-word' });
    let svg = label.querySelector<SVGSVGElement>(':scope > svg[data-selection-indicator]');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.dataset.selectionIndicator = ''; svg.setAttribute('aria-hidden', 'true'); label.prepend(svg);
    }
    indicator.paint(svg, source, current, result.indicator);
    const owner = label.parentElement;
    if (owner) Object.assign(owner.style, { backgroundColor: 'transparent', backgroundImage: 'none',
      borderWidth: '0px', borderRadius: '0px', boxShadow: 'none', overflow: 'visible' });
  };
  const fallback = (label: HTMLLabelElement, text: HTMLElement, input: HTMLInputElement, current: Widget, error: unknown) => {
    label.dataset.selectionDisplay = 'fallback';
    label.dataset.selectionDisplayError = error instanceof Error ? error.message : String(error);
    label.querySelector(':scope > svg[data-selection-indicator]')?.remove();
    Object.assign(label.style, { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', padding: '3px 3px 3px 25px', margin: '0px' });
    Object.assign(text.style, { position: 'static', width: 'auto', height: '', padding: '0px', margin: '0px' });
    Object.assign(input.style, { position: 'absolute', left: '3px', top: '50%', width: '', height: '',
      margin: '0px', padding: '', borderWidth: '', opacity: '1', transform: 'translateY(-50%)' });
    const owner = label.parentElement, style = current.style;
    if (owner) Object.assign(owner.style, { backgroundColor: style.fillGradient ? 'transparent' : style.fill,
      borderWidth: (style.borderWidths ?? [style.strokeWidth,style.strokeWidth,style.strokeWidth,style.strokeWidth]).map(value => `${value}px`).join(' '),
      borderColor: style.stroke, borderRadius: (style.cornerRadii ?? [style.radius,style.radius,style.radius,style.radius]).map(value => `${value}px`).join(' ') });
  };
  const update = (label: HTMLLabelElement, text: HTMLElement, input: HTMLInputElement, source: Widget, current: Widget) => {
    if (!supports(source) || !indicator.supports(current)) {
      entries.delete(label); fallback(label, text, input, current, 'Unsupported selection display source'); return false;
    }
    const key = JSON.stringify([source.type, source.width, source.height, source.rotation,
      source.selectionText, source.style, source.text, source.richText]);
    let entry = entries.get(label);
    try {
      if (entry?.key === key) {
        entry.current = current; entry.text = text; entry.input = input; apply(label, entry); return true;
      }
      entries.delete(label);
      const result = layout.measure(source, label.ownerDocument);
      if (!result) { fallback(label, text, input, current, 'No selection display measurement'); return false; }
      entry = { key, source, current, text, input, result }; entries.set(label, entry); apply(label, entry);
      label.dataset.selectionFonts = 'pending';
      const pending = entry;
      void layout.fontsReady(source, label.ownerDocument).then(() => {
        if (!label.isConnected || entries.get(label) !== pending) return;
        try {
          const measured = layout.measure(source, label.ownerDocument);
          if (measured) { pending.result = measured; apply(label, pending); label.dataset.selectionFonts = 'ready'; }
        } catch (error) { label.dataset.selectionDisplayError = String(error); label.dataset.selectionFonts = 'fallback'; }
      }, error => {
        if (entries.get(label) === pending) { label.dataset.selectionDisplayError = String(error); label.dataset.selectionFonts = 'fallback'; }
      });
      return true;
    } catch (error) {
      entries.delete(label); fallback(label, text, input, current, error); return false;
    }
  };
  return { supports, update };
}
export type SelectionDisplay = ReturnType<typeof createSelectionDisplay>;
