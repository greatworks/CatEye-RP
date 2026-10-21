import type { Widget } from '../model/types';
import type { ShapeTextRenderer } from '../model/shape-text';
import type { SelectionLayoutServices } from '../model/selection-layout';
import type { ReadSelectionTextBox, SelectionDisplayLayout, SelectionTextLayout } from './selection-text-layout';

export interface SelectionAuthorMeasurement {
  origin: 'browser-derived';
  sourceSnapshot(): Widget;
  fontsReady(): Promise<void>;
  capturePanel(): SelectionDisplayLayout | undefined;
  measureText: SelectionLayoutServices['measureText'];
}
/** Per-command immutable browser measurement source. This implements only the
 * raw text-measurement service, not minimum size, inset conversion, union,
 * alignment, rounding, notifications or document commits. The explicit display
 * dependency supplies font preparation and browser-derived pre-edit panels.
 */
export function createSelectionAuthorMeasurer(
  shapeText: Pick<ShapeTextRenderer, 'paint'>,
  displayLayout: Pick<SelectionTextLayout, 'supports' | 'fontsReady' | 'measure'>,
  readTextBox?: ReadSelectionTextBox,
) {
  const finite = (value: number, name: string) => {
    if (!Number.isFinite(value) || value < 0) throw Error(`Selection author ${name} must be finite and nonnegative`);
    return value;
  };
  const requireDocument = (document: Document) => {
    if (!document.body || !document.defaultView) throw Error('Selection author measurement requires a live document realm');
  };
  const read: ReadSelectionTextBox = readTextBox ?? (block => {
    let width = 0;
    for (const paragraph of block.querySelectorAll<HTMLElement>('[data-rich-paragraph]')) {
      const range = block.ownerDocument.createRange();
      try {
        range.selectNodeContents(paragraph);
        width = Math.max(width, finite(range.getBoundingClientRect().width, 'paragraph width'));
      } finally { range.detach(); }
    }
    return { width, height: finite(block.getBoundingClientRect().height, 'line-box height') };
  });
  const prepare = (source: Widget, document: Document): SelectionAuthorMeasurement | undefined => {
    if (!displayLayout.supports(source)) return;
    requireDocument(document);
    // Detach before any async font work. No caller or dependency gets the
    // internal object; two commands/rows with the same id have separate sources.
    const snapshot = structuredClone(source);
    let ready = false, pending: Promise<void> | undefined;
    const fontsReady = () => {
      if (ready) return Promise.resolve();
      if (!pending) pending = Promise.resolve().then(() => {
        requireDocument(document);
        return displayLayout.fontsReady(structuredClone(snapshot), document);
      }).then(() => { ready = true; }, error => { pending = undefined; throw error; });
      return pending;
    };
    const capturePanel = () => {
      if (!ready) throw Error('Selection author panel capture requires fontsReady first');
      requireDocument(document);
      const result = displayLayout.measure(structuredClone(snapshot), document);
      return result && structuredClone(result);
    };
    const measureText: SelectionLayoutServices['measureText'] = (request, context) => {
      requireDocument(document); finite(request.width, 'request width');
      if (request.flag !== true || !Number.isInteger(request.pass) || request.pass < 0)
        throw Error('Invalid selection author measurement request');
      const fit = context.state.effectiveFit.width;
      if (typeof fit !== 'boolean') throw Error('Selection author effective width fit must be Boolean');
      const style = snapshot.style, container = document.createElement('div');
      container.dataset.selectionAuthorMeasure = ''; container.setAttribute('aria-hidden', 'true');
      Object.assign(container.style, {
        position: 'absolute', left: '0px', top: '0px', width: `${request.width}px`, height: 'auto',
        visibility: 'hidden', pointerEvents: 'none', display: 'block', transform: 'none',
        padding: '0px', margin: '0px', borderWidth: '0px', boxSizing: 'content-box', overflow: 'visible',
        fontFamily: style.fontFamily, fontSize: `${style.fontSize}px`, fontWeight: String(style.fontWeight),
        fontStyle: style.fontStyle ?? 'normal', color: style.color, lineHeight: String(style.lineHeight ?? 'normal'),
        textAlign: style.textAlign, textDecorationLine: 'none',
      });
      try {
        const block = document.createElement('span');
        Object.assign(block.style, {
          display: 'block', width: '100%', minWidth: '0px', maxWidth: 'none', height: 'auto',
          boxSizing: 'content-box', padding: '0px', margin: '0px', borderWidth: '0px',
          whiteSpace: fit ? 'nowrap' : 'normal', overflowWrap: fit ? 'normal' : 'break-word', wordBreak: 'normal',
        });
        const paragraphs = snapshot.richText?.paragraphs ?? [{ runs: [{ text: snapshot.text }] }];
        for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
          const p = document.createElement('span'); p.dataset.richParagraph = String(paragraphIndex);
          Object.assign(p.style, { display: 'block', margin: '0px', padding: '0px', borderWidth: '0px',
            textAlign: paragraph.textAlign ?? style.textAlign,
            lineHeight: typeof paragraph.lineHeightPx === 'number' ? `${paragraph.lineHeightPx}px` : paragraph.lineHeightPx ?? '' });
          for (let index = 0; index < paragraph.runs.length;) {
            const id = paragraph.runs[index].linkId, parent = id ? document.createElement('a') : p;
            if (id) {
              parent.dataset.richLinkId = id;
              Object.assign(parent.style, { color: 'inherit', textDecoration: 'none', font: 'inherit' }); p.append(parent);
            }
            do {
              const run = paragraph.runs[index], span = document.createElement('span');
              span.dataset.richRun = String(index);
              for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color'] as const) {
                const value = run.style?.[key];
                if (value !== undefined) (span.style as unknown as Record<string, string>)[key] = key === 'fontSize' ? `${value}px` : String(value);
              }
              const underline = run.style?.underline ?? style.underline, strike = run.style?.strikethrough ?? style.strikethrough;
              span.style.textDecorationLine = underline ? strike ? 'underline line-through' : 'underline' : strike ? 'line-through' : 'none';
              shapeText.paint(span, run.text, index === 0); parent.append(span); index++;
            } while (id && index < paragraph.runs.length && paragraph.runs[index].linkId === id);
          }
          if (paragraph.runs.every(run => run.text === '')) p.append(document.createElement('br'));
          block.append(p);
        }
        container.append(block); document.body.append(container);
        const measured = read(block, request.width);
        const answer = { width: finite(measured.width, 'content width'), height: finite(measured.height, 'content height') };
        // Same bounded browser substitute as initial display; do not infer
        // KIf5's unproved wrapping policy for extremely long width-fit lines.
        if (fit && answer.width > 10000) throw Error('Selection author width-fit content above 10000px is unsupported');
        return answer;
      } finally { container.remove(); }
    };
    return {
      origin: 'browser-derived', sourceSnapshot: () => structuredClone(snapshot),
      fontsReady, capturePanel, measureText,
    };
  };
  return { prepare };
}
