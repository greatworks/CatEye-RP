import type { Widget } from '../model/types';
import type { ShapeTextRenderer } from '../model/shape-text';

export interface SelectionDisplaySize { width: number; height: number }
export interface SelectionDisplayRect extends SelectionDisplaySize { x: number; y: number }
export interface SelectionDisplayLayout {
  origin: 'browser-derived';
  panel: SelectionDisplayRect;
  text: { x: number; y: number; width: number };
  indicator: SelectionDisplayRect;
}
export type ReadSelectionTextBox = (element: HTMLElement, constraintWidth: number) => SelectionDisplaySize;

/** Display-only bootstrap; never an author or runtime geometry commit.
 * WIyL/INOR rounding and CNUW local projection are source-derived. Font/line
 * metrics are an explicit browser substitute. Call fontsReady separately when
 * needed: immediate measure may use fallback fonts and does not certify glyph
 * provenance. The complete factory stays portable through Function#toString.
 */
export function createSelectionTextLayout(
  shapeText: Pick<ShapeTextRenderer, 'paint'>,
  readTextBox?: ReadSelectionTextBox,
) {
  const supports = (widget: Widget): boolean => Boolean(
    (widget.type === 'checkbox' || widget.type === 'radio') && widget.rotation === 0
    && widget.selectionText && widget.style.textPadding
    && widget.style.verticalAlign !== undefined && widget.style.selectionButtonSize !== undefined,
  );
  const finite = (value: number, name: string, nonnegative = true) => {
    if (!Number.isFinite(value) || nonnegative && value < 0)
      throw Error(`Selection display ${name} must be finite${nonnegative ? ' and nonnegative' : ''}`);
    return value;
  };
  const roundAway = (value: number) => Math.sign(value) * Math.floor(Math.abs(value) + .5);
  const roundEven = (value: number) => {
    const lower = Math.floor(value);
    return value - lower === .5 ? lower % 2 === 0 ? lower : lower + 1 : Math.round(value);
  };
  const paragraphs = (widget: Widget) => widget.richText?.paragraphs ?? [{ runs: [{ text: widget.text }] }];
  const empty = (widget: Widget) => paragraphs(widget).map(p => p.runs.map(run => run.text).join('')).join('\n') === '';
  const validate = (widget: Widget) => {
    finite(widget.width, 'owner width'); finite(widget.height, 'owner height');
    const style = widget.style, padding = style.textPadding!;
    if (padding.length !== 4) throw Error('Selection display requires four padding values');
    for (const value of padding) finite(value, 'padding');
    finite(style.selectionButtonSize!, 'indicator size');
    if (!['top', 'middle', 'bottom'].includes(style.verticalAlign!)) throw Error('Selection display vertical alignment is invalid');
    for (const field of ['autoFitWidth', 'autoFitHeight', 'alignRight'] as const)
      if (typeof widget.selectionText![field] !== 'boolean') throw Error('Selection display flags must be Boolean');
    if (!widget.selectionText!.autoFitWidth)
      finite(widget.width - padding[1] - padding[3] - style.selectionButtonSize!, 'constraint width');
  };
  const project = (widget: Widget, content: SelectionDisplaySize): SelectionDisplayLayout | undefined => {
    if (!supports(widget)) return;
    validate(widget); finite(content.width, 'content width'); finite(content.height, 'content height');
    const flags = widget.selectionText!, style = widget.style, [top, right, bottom, left] = style.textPadding!;
    // KIf5's extremely long-line wrapping policy is not closed. Keep the
    // browser nowrap substitute inside its source-requested measurement domain.
    if (flags.autoFitWidth && content.width > 10000)
      throw Error('Selection display width-fit content above 10000px is unsupported');
    const button = style.selectionButtonSize!, isEmpty = empty(widget);
    const width = roundAway(flags.autoFitWidth ? content.width : widget.width - left - right - button);
    const height = roundAway(!flags.autoFitWidth && isEmpty ? 16 : content.height);
    const short = height < button, align = style.verticalAlign;
    const x = roundEven(left + (flags.alignRight ? 0 : button));
    const y = roundEven(!short ? 0 : align === 'top' ? top
      : align === 'middle' ? (button - height + top - bottom) / 2 : button - height - bottom);
    const indicatorY = isEmpty || short || align === 'top' ? 0 : align === 'middle' ? (height - button) / 2 : height - button;
    const result: SelectionDisplayLayout = {
      origin: 'browser-derived', panel: { x, y, width, height },
      // Selection rNPL deliberately omits text CSS height.
      text: { x: x - left, y, width: width + left + right },
      indicator: { x: flags.alignRight ? widget.width - button : 0, y: indicatorY, width: button, height: button },
    };
    for (const rectangle of [result.panel, result.text, result.indicator])
      for (const [key, value] of Object.entries(rectangle)) finite(value, `projected ${key}`, key === 'width' || key === 'height');
    return result;
  };
  const requireDocument = (document: Document) => {
    if (!document.body || !document.defaultView) throw Error('Selection display requires a live document realm');
    if (!document.fonts || typeof document.fonts.load !== 'function') throw Error('Selection display requires a document font realm');
  };
  const read: ReadSelectionTextBox = readTextBox ?? ((block) => {
    let width = 0;
    // Range is confined to the untransformed isolated paragraph's contents.
    // Unlike runtime AutoFit, this includes anchors and all nested inline runs.
    for (const paragraph of block.querySelectorAll<HTMLElement>('[data-rich-paragraph]')) {
      const range = block.ownerDocument.createRange();
      try {
        range.selectNodeContents(paragraph);
        width = Math.max(width, finite(range.getBoundingClientRect().width, 'paragraph width'));
      } finally { range.detach(); }
    }
    return { width, height: finite(block.getBoundingClientRect().height, 'line-box height') };
  });
  const paint = (widget: Widget, block: HTMLElement, document: Document) => {
    for (const [paragraphIndex, paragraph] of paragraphs(widget).entries()) {
      const p = document.createElement('span'); p.dataset.richParagraph = String(paragraphIndex);
      Object.assign(p.style, { display: 'block', margin: '0px', padding: '0px', borderWidth: '0px',
        textAlign: paragraph.textAlign ?? widget.style.textAlign,
        lineHeight: typeof paragraph.lineHeightPx === 'number' ? `${paragraph.lineHeightPx}px` : paragraph.lineHeightPx ?? '' });
      for (let index = 0; index < paragraph.runs.length;) {
        const id = paragraph.runs[index].linkId, parent = id ? document.createElement('a') : p;
        if (id) {
          parent.dataset.richLinkId = id;
          Object.assign(parent.style, { color: 'inherit', textDecoration: 'none', font: 'inherit' }); p.append(parent);
        }
        do {
          const run = paragraph.runs[index], span = document.createElement('span'), runStyle = run.style;
          span.dataset.richRun = String(index);
          for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color'] as const) {
            const value = runStyle?.[key];
            if (value !== undefined) (span.style as unknown as Record<string, string>)[key] = key === 'fontSize' ? `${value}px` : String(value);
          }
          const underline = runStyle?.underline ?? widget.style.underline, strike = runStyle?.strikethrough ?? widget.style.strikethrough;
          span.style.textDecorationLine = underline ? strike ? 'underline line-through' : 'underline' : strike ? 'line-through' : 'none';
          shapeText.paint(span, run.text, index === 0); parent.append(span); index++;
        } while (id && index < paragraph.runs.length && paragraph.runs[index].linkId === id);
      }
      if (paragraph.runs.every(run => run.text === '')) p.append(document.createElement('br'));
      block.append(p);
    }
  };
  const measure = (widget: Widget, document: Document): SelectionDisplayLayout | undefined => {
    if (!supports(widget)) return;
    validate(widget); requireDocument(document);
    if (!widget.selectionText!.autoFitWidth && empty(widget)) return project(widget, { width: 0, height: 16 });
    const style = widget.style, padding = style.textPadding!;
    const constraint = widget.selectionText!.autoFitWidth ? 10000 : widget.width - padding[1] - padding[3] - style.selectionButtonSize!;
    const container = document.createElement('div');
    container.dataset.selectionDisplayMeasure = ''; container.setAttribute('aria-hidden', 'true');
    Object.assign(container.style, { position: 'absolute', left: '0px', top: '0px', width: `${constraint}px`,
      height: 'auto', visibility: 'hidden', pointerEvents: 'none', display: 'block', transform: 'none',
      padding: '0px', margin: '0px', borderWidth: '0px', boxSizing: 'content-box', overflow: 'visible',
      fontFamily: style.fontFamily, fontSize: `${style.fontSize}px`, fontWeight: String(style.fontWeight),
      fontStyle: style.fontStyle ?? 'normal', color: style.color, lineHeight: String(style.lineHeight ?? 'normal'),
      textAlign: style.textAlign, textDecorationLine: 'none' });
    try {
      const block = document.createElement('span');
      Object.assign(block.style, { display: 'block', width: '100%', minWidth: '0px', maxWidth: 'none', height: 'auto',
        boxSizing: 'content-box', padding: '0px', margin: '0px', borderWidth: '0px',
        whiteSpace: widget.selectionText!.autoFitWidth ? 'nowrap' : 'normal',
        overflowWrap: widget.selectionText!.autoFitWidth ? 'normal' : 'break-word', wordBreak: 'normal' });
      paint(widget, block, document); container.append(block); document.body.append(container);
      return project(widget, read(block, constraint));
    } finally { container.remove(); }
  };
  const fontsReady = async (widget: Widget, document: Document): Promise<void> => {
    if (!supports(widget)) return;
    // Font preparation also serves an uncommitted author candidate. P94 may
    // exceed its old owner width until the native preflight expands it, so
    // geometry validation belongs to measure/project, after that correction.
    requireDocument(document);
    const requests = new Map<string, string>();
    for (const paragraph of paragraphs(widget)) for (const run of paragraph.runs) {
      const style = run.style, base = widget.style;
      const fontSize = finite(style?.fontSize ?? base.fontSize, 'font size');
      const descriptor = `${style?.fontStyle ?? base.fontStyle ?? 'normal'} ${style?.fontWeight ?? base.fontWeight} ${fontSize}px ${style?.fontFamily ?? base.fontFamily}`;
      requests.set(descriptor, (requests.get(descriptor) ?? '') + run.text);
    }
    await Promise.all([...requests].map(([font, text]) => document.fonts.load(font, text)));
    await document.fonts.ready;
  };
  return { supports, project, measure, fontsReady };
}
export type SelectionTextLayout = ReturnType<typeof createSelectionTextLayout>;
