import type { Widget, WidgetStyle } from '../model/types';
import type { ShapeTextRenderer } from '../model/shape-text';

export interface ShapeTextMeasureOptions { plainSetter?: boolean }
export interface ShapeTextMeasurement { width: number; height: number }
export type ReadTextContentBox = (element: HTMLElement, axis: 'width' | 'height') => number;

/** Independent DOM adapter for the supported ordinary-shape text subset.
 * Explicit dependencies keep this factory portable through Function#toString.
 * No saved geometry, live display state, document text or action state is changed.
 */
export function createShapeTextMeasurer(
  shapeText: Pick<ShapeTextRenderer, 'supports' | 'css' | 'paint'>,
  readContentBox?: ReadTextContentBox,
) {
  const finite = (value: number): number => {
    if (!Number.isFinite(value)) throw new Error('Shape text measurement must be finite');
    return value;
  };
  // Verified against retained jQuery in modern Edge: inline auto sizes use
  // integer offsets, while resolved CSS pixel sizes preserve fractions. This
  // deliberately does not use transformed screen bounds or estimate glyphs.
  // Legacy browser reliability/table/scroll-gutter branches are outside scope.
  const contentBox: ReadTextContentBox = readContentBox ?? ((element, axis) => {
    const realm = element.ownerDocument.defaultView;
    if (!realm) throw new Error('Shape text measurement requires a document view');
    const css = realm.getComputedStyle(element), value = css[axis];
    const pixels = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:px)?$/.test(value.trim());
    let amount = pixels ? Number.parseFloat(value) : 0;
    let borderBox = css.boxSizing === 'border-box';
    if ((!pixels || !amount && css.display === 'inline') && element.getClientRects().length) {
      amount = axis === 'width' ? element.offsetWidth : element.offsetHeight;
      borderBox = true;
    }
    if (borderBox) {
      const sides = axis === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom'];
      for (const side of sides) {
        const values = css as unknown as Record<string, string>;
        amount -= Number.parseFloat(values[`padding${side}`]) || 0;
        amount -= Number.parseFloat(values[`border${side}Width`]) || 0;
      }
    }
    return finite(amount);
  });

  /** Fill an existing outer run as the plain runtime setter does. Initial
   * native text escaping/NBSP conversion remains shapeText.paint's job.
   * CRLF/LF split; a lone CR, U+2028, markup and spaces remain literal text.
   */
  const paintPlainSetter = (element: HTMLElement, value: string): void => {
    const lines = value.split(/\r\n|\n/), document = element.ownerDocument;
    const expected: { kind: 'text' | 'br' | 'span'; text: string }[] = [];
    if (lines.length === 1) { if (value !== '') expected.push({ kind: 'text', text: value }); }
    else for (const [index, line] of lines.entries()) {
      if (index) expected.push({ kind: 'br', text: '' });
      if (line) expected.push({ kind: 'span', text: line });
    }
    const old = Array.from(element.childNodes);
    if (old.length === expected.length && expected.every((item, index) => {
      const node = old[index];
      if (item.kind === 'text') return node.nodeType === 3 && node.textContent === item.text;
      if (item.kind === 'br') return node.nodeName === 'BR' && !node.childNodes.length;
      return node.nodeName === 'SPAN' && node.childNodes.length === 1
        && node.firstChild?.nodeType === 3 && node.textContent === item.text;
    })) return;
    const nodes = expected.map(item => {
      if (item.kind === 'text') return document.createTextNode(item.text);
      const node = document.createElement(item.kind);
      if (item.kind === 'span') node.append(document.createTextNode(item.text));
      return node;
    });
    element.replaceChildren(...nodes);
  };

  const decoration = (style: Partial<WidgetStyle>) => style.underline
    ? style.strikethrough ? 'underline line-through' : 'underline'
    : style.strikethrough ? 'line-through' : 'none';
  const applyRunStyle = (element: HTMLElement, base: WidgetStyle, style?: Partial<WidgetStyle>) => {
    for (const field of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color'] as const) {
      const value = style?.[field];
      if (value !== undefined) (element.style as unknown as Record<string, string>)[field] = field === 'fontSize' ? `${value}px` : String(value);
    }
    element.style.textDecorationLine = decoration({ underline: style?.underline ?? base.underline, strikethrough: style?.strikethrough ?? base.strikethrough });
  };
  const structuredText = (owner: HTMLElement) => {
    const layer = owner.querySelector<HTMLElement>(':scope > .widget-text');
    return layer && layer.querySelector('[data-rich-paragraph]') ? layer : undefined;
  };
  const hiddenByInlineStyle = (owner: HTMLElement): boolean => {
    for (let node: HTMLElement | null = owner; node; node = node.parentElement) if (node.style.display === 'none') return true;
    return false;
  };

  const measure = (widget: Widget, owner: HTMLElement | undefined, document: Document, options: ShapeTextMeasureOptions = {}): ShapeTextMeasurement | undefined => {
    if (!shapeText.supports(widget) || !widget.shapeText || !widget.shapeText.autoFitWidth && !widget.shapeText.autoFitHeight) return;
    if (!document.body || !document.defaultView) return;
    if (owner && owner.ownerDocument !== document) throw new Error('Shape text owner and measurement document must share a realm');
    const padding = widget.style.textPadding!;
    let layer = owner?.isConnected && !hiddenByInlineStyle(owner) ? structuredText(owner) : undefined;
    // SetText('') hides the text layer itself. jQuery measures it with a
    // temporary display swap; our isolated equivalent never changes live DOM.
    if (layer?.style.display === 'none') layer = undefined;
    let container: HTMLElement | undefined;
    try {
      if (!layer) {
        container = document.createElement('div');
        container.setAttribute('aria-hidden', 'true');
        container.dataset.shapeTextMeasure = '';
        Object.assign(container.style, { position: 'absolute', left: '0px', top: '0px', width: '0px', height: '0px', visibility: 'hidden', pointerEvents: 'none' });
        const copy = document.createElement('div'), style = widget.style;
        copy.className = `widget ${widget.type}`;
        // A hidden owner is measured as an isolated block, not by showing it.
        const hidden = widget.hidden || !owner || hiddenByInlineStyle(owner);
        Object.assign(copy.style, { position: 'absolute', left: '0px', top: '0px', width: `${widget.width}px`, height: `${widget.height}px`,
          display: hidden ? 'block' : 'flex', boxSizing: 'border-box', padding: '0px', margin: '0px', overflow: 'visible',
          borderStyle: 'solid', borderColor: 'transparent', borderWidth: widget.vectorPath ? '0px' : (style.borderWidths ?? [style.strokeWidth, style.strokeWidth, style.strokeWidth, style.strokeWidth]).map(value => `${value}px`).join(' '),
          fontFamily: style.fontFamily, fontSize: `${style.fontSize}px`, fontWeight: String(style.fontWeight), fontStyle: style.fontStyle ?? 'normal', color: style.color,
          lineHeight: 'normal', textAlign: style.textAlign, justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start', transform: 'none', textDecorationLine: 'none' });
        layer = document.createElement('span'); layer.className = 'widget-text';
        Object.assign(layer.style, shapeText.css(widget));
        const block = document.createElement('span'); block.className = 'rich-text-content';
        Object.assign(block.style, { display: 'block', width: '100%', minWidth: '0', whiteSpace: 'inherit', overflowWrap: 'inherit' });
        const paragraphs = widget.richText?.paragraphs ?? [{ runs: [{ text: widget.text }] }];
        for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
          const p = document.createElement('span'); p.dataset.richParagraph = String(paragraphIndex);
          Object.assign(p.style, { display: 'block', margin: '0px', textAlign: paragraph.textAlign ?? '', lineHeight: typeof paragraph.lineHeightPx === 'number' ? `${paragraph.lineHeightPx}px` : paragraph.lineHeightPx ?? '' });
          for (let index = 0; index < paragraph.runs.length;) {
            const id = paragraph.runs[index].linkId;
            const parent = id ? document.createElement('a') : p;
            if (id) { parent.dataset.richLinkId = id; Object.assign(parent.style, { color: 'inherit', textDecoration: 'none' }); p.append(parent); }
            do {
              const run = paragraph.runs[index], span = document.createElement('span');
              span.dataset.richRun = String(index); applyRunStyle(span, style, run.style);
              if (options.plainSetter) paintPlainSetter(span, run.text);
              else shapeText.paint(span, run.text, index === 0);
              parent.append(span); index++;
            } while (id && index < paragraph.runs.length && paragraph.runs[index].linkId === id);
          }
          if (!options.plainSetter && paragraph.runs.every(run => run.text === '')) p.append(document.createElement('br'));
          block.append(p);
        }
        layer.append(block); copy.append(layer); container.append(copy); document.body.append(container);
      }
      let height = widget.height, width = widget.width;
      if (widget.shapeText.autoFitHeight) height = finite(contentBox(layer, 'height')) + padding[0] + padding[2];
      if (widget.shapeText.autoFitWidth) {
        width = 0;
        for (const paragraph of layer.querySelectorAll<HTMLElement>('[data-rich-paragraph]')) {
          let sum = 0;
          for (const span of Array.from(paragraph.children)) if (span.tagName === 'SPAN') sum += finite(contentBox(span as HTMLElement, 'width'));
          width = Math.max(width, sum);
        }
        width += padding[1] + padding[3];
      }
      return { width: finite(width), height: finite(height) };
    } finally { container?.remove(); }
  };
  return { measure, paintPlainSetter };
}
export type ShapeTextMeasurer = ReturnType<typeof createShapeTextMeasurer>;
