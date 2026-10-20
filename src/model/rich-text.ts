import type { RichText, RichTextLink, RichTextParagraph, RichTextRun, RichTextRunStyle, Widget, WidgetStyle } from './types';

export const RICH_TEXT_STYLE_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'underline', 'strikethrough'] as const;
/** Apply only at the text leaf: an ancestor's decoration cannot be cleared by a run. */
export function textDecorationLine(style: Pick<WidgetStyle, 'underline' | 'strikethrough'>): 'none' | 'underline' | 'line-through' | 'underline line-through' {
  return style.underline ? style.strikethrough ? 'underline line-through' : 'underline' : style.strikethrough ? 'line-through' : 'none';
}
/** Native style.js converts the combined adaptive/state patch into one CSS property.
 * Its false/true combination writes invalid "noneline-through", ignored after
 * the original text cache is restored. Keep baseline runs in that case. */
export function projectTextStyleOverride(patch: Partial<WidgetStyle>): Partial<WidgetStyle> {
  const { underline, strikethrough, ...other } = patch;
  if (underline === undefined && strikethrough === undefined || underline === false && strikethrough === true) return other;
  return { ...other, underline: underline === true, strikethrough: strikethrough === true };
}
export const RICH_TEXT_WIDGET_TYPES = ['box', 'ellipse', 'path', 'text', 'button', 'placeholder', 'checkbox', 'radio', 'tableCell'] as const;
export function richTextPlainText(rich: RichText): string {
  return rich.paragraphs.map(p => p.runs.map(r => r.text).join('')).join('\n');
}
export function richTextFromPlainText(text: string, style?: RichTextRunStyle): RichText {
  return { paragraphs: text.replace(/\r\n?/g, '\n').split('\n').map(text => ({ runs: [{ text, ...(style ? { style: { ...style } } : {}) }] })) };
}
function textStylePatch(style: Partial<WidgetStyle>): RichTextRunStyle {
  return Object.fromEntries(RICH_TEXT_STYLE_KEYS.filter(key => Object.hasOwn(style, key)).map(key => [key, style[key]]));
}
function mergedStyle(base: RichTextRunStyle | undefined, patch: RichTextRunStyle): RichTextRunStyle {
  const result = { ...base, ...patch };
  for (const key of RICH_TEXT_STYLE_KEYS) if (result[key] === undefined) delete result[key];
  return result;
}
function sliceRuns(runs: RichTextRun[], start: number, end: number): RichTextRun[] {
  let offset = 0;
  return runs.flatMap(run => {
    const from = Math.max(0, start - offset), to = Math.min(run.text.length, end - offset);
    offset += run.text.length;
    return to > from ? [{ ...run, ...(run.style ? { style: { ...run.style } } : {}), text: run.text.slice(from, to) }] : [];
  });
}
function location(rich: RichText, offset: number): [number, number] {
  for (let i = 0; i < rich.paragraphs.length; i++) {
    const size = rich.paragraphs[i].runs.reduce((n, r) => n + r.text.length, 0);
    if (offset <= size || i === rich.paragraphs.length - 1) return [i, Math.min(offset, size)];
    offset -= size + 1;
  }
  return [0, 0];
}
function styleAt(rich: RichText, offset: number): RichTextRunStyle | undefined {
  const [index, at] = location(rich, offset);
  const runs = rich.paragraphs[index].runs;
  let cursor = 0;
  for (const run of runs) {
    cursor += run.text.length;
    if (at < cursor) return run.style;
  }
  return runs[runs.length - 1]?.style;
}
function linkIdAt(rich: RichText, offset: number): string | undefined {
  if (offset < 0 || offset >= richTextPlainText(rich).length) return undefined;
  const [paragraph, at] = location(rich, offset); let cursor = 0;
  for (const run of rich.paragraphs[paragraph].runs) { cursor += run.text.length; if (at < cursor) return run.linkId; }
  return undefined;
}
export function richTextLinkAt(rich: RichText, offset: number): RichTextLink | undefined {
  const id = linkIdAt(rich, offset); return rich.links?.find(link => link.id === id);
}
function pruneLinks(rich: RichText): RichText {
  const ids = new Set(rich.paragraphs.flatMap(p => p.runs.map(r => r.linkId)).filter(Boolean));
  const links = rich.links?.filter(link => ids.has(link.id));
  const result = { ...rich }; if (links?.length) result.links = structuredClone(links); else delete result.links;
  return result;
}
function mapLinkRange(rich: RichText, start: number, end: number, linkId?: string): RichText {
  range(rich, start, end); let offset = 0;
  const paragraphs = rich.paragraphs.map(p => {
    const runs = p.runs.flatMap(run => {
      const from = Math.max(0, start - offset), to = Math.min(run.text.length, end - offset); offset += run.text.length;
      if (to <= from) return [structuredClone(run)];
      const middle = { ...structuredClone(run), text: run.text.slice(from, to) };
      if (linkId) middle.linkId = linkId; else delete middle.linkId;
      return [...(from ? [{ ...structuredClone(run), text: run.text.slice(0, from) }] : []), middle, ...(to < run.text.length ? [{ ...structuredClone(run), text: run.text.slice(to) }] : [])];
    }); offset++; return { ...p, runs };
  });
  return pruneLinks({ ...rich, paragraphs });
}
export function assignRichTextLink(rich: RichText, start: number, end: number, link: RichTextLink): RichText {
  if (start === end) throw new Error('Select text to create a hyperlink');
  return mapLinkRange({ ...rich, links: [...(rich.links ?? []).filter(item => item.id !== link.id), structuredClone(link)] }, start, end, link.id);
}
export function removeRichTextLinkRange(rich: RichText, start: number, end: number): RichText { return mapLinkRange(rich, start, end); }
export function removeRichTextLink(rich: RichText, id: string): RichText {
  return pruneLinks({ ...rich, paragraphs: rich.paragraphs.map(p => ({ ...p, runs: p.runs.map(run => { const next = structuredClone(run); if (next.linkId === id) delete next.linkId; return next; }) })) });
}
export function updateRichTextLink(rich: RichText, id: string, patch: Partial<Omit<RichTextLink, 'id'>>): RichText {
  if (!rich.links?.some(link => link.id === id)) throw new Error('Cannot edit a missing hyperlink');
  return { ...structuredClone(rich), links: rich.links.map(link => structuredClone(link.id === id ? { ...link, ...patch, id } : link)) };
}
function range(rich: RichText, start: number, end: number): void {
  const length = richTextPlainText(rich).length;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > length) throw new Error('Invalid rich text selection');
}
/** UTF-16 offsets match browser textarea/Selection offsets; surrounding formatting survives. */
export function replaceRichTextRange(rich: RichText, start: number, end: number, text: string, insertionStyle?: RichTextRunStyle): RichText {
  return replaceRange(rich, start, end, text, insertionStyle, false);
}
/** Shift+Enter inserts a line break in the current paragraph, preserving its properties. */
export function insertRichTextSoftBreak(rich: RichText, start: number, end: number, insertionStyle?: RichTextRunStyle): RichText {
  return replaceRange(rich, start, end, '\n', insertionStyle, true);
}
function replaceRange(rich: RichText, start: number, end: number, text: string, insertionStyle: RichTextRunStyle | undefined, softBreak: boolean): RichText {
  range(rich, start, end);
  const [fromP, from] = location(rich, start), [toP, to] = location(rich, end);
  const first = rich.paragraphs[fromP], last = rich.paragraphs[toP];
  const before = sliceRuns(first.runs, 0, from), after = sliceRuns(last.runs, to, Infinity);
  const inherited = styleAt(rich, start), style = insertionStyle ? mergedStyle(inherited, insertionStyle) : inherited;
  const inserted = softBreak ? [{ runs: [{ text, ...(style ? { style: { ...style } } : {}) }] }] : richTextFromPlainText(text, style).paragraphs;
  // Typing inside a link inherits it; a collapsed caret at its outer edge does
  // not extend it. A replacement wholly inside the same link retains identity.
  const linkId = linkIdAt(rich, start);
  const inheritedLink = linkId && (start === end ? linkIdAt(rich, start - 1) === linkId : fromP === toP && sliceRuns(first.runs, from, to).every(run => run.linkId === linkId)) ? linkId : undefined;
  if (inheritedLink) for (const paragraph of inserted) for (const run of paragraph.runs as RichTextRun[]) run.linkId = inheritedLink;
  const replacement = inserted.map((paragraph, index) => ({ ...first, ...paragraph, runs: paragraph.runs }));
  replacement[0].runs = [...before, ...replacement[0].runs];
  replacement[replacement.length - 1].runs.push(...after);
  // Typing at one caret must not consume a new run for every character. Only
  // normalize the edited paragraphs; retained native empty runs stay intact.
  for (const paragraph of replacement) {
    const compact: RichTextRun[] = [];
    for (const run of paragraph.runs) {
      const previous = compact.at(-1);
      if (previous?.text && run.text && previous.linkId === run.linkId && RICH_TEXT_STYLE_KEYS.every(key => previous.style?.[key] === run.style?.[key])) previous.text += run.text;
      else compact.push(run);
    }
    paragraph.runs = compact;
  }
  return pruneLinks({ ...rich, paragraphs: [...structuredClone(rich.paragraphs.slice(0, fromP)), ...replacement, ...structuredClone(rich.paragraphs.slice(toP + 1))] });
}
export function formatRichTextRange(rich: RichText, start: number, end: number, patch: RichTextRunStyle): RichText {
  range(rich, start, end);
  let offset = 0;
  return { ...rich, paragraphs: rich.paragraphs.map(paragraph => {
    const runs = paragraph.runs.flatMap(run => {
      const from = Math.max(0, start - offset), to = Math.min(run.text.length, end - offset);
      const at = offset; offset += run.text.length;
      if (to <= from) return [{ ...run, ...(run.style ? { style: { ...run.style } } : {}) }];
      return [
        ...(from ? [{ ...run, text: run.text.slice(0, from) }] : []),
        { ...run, text: run.text.slice(from, to), style: mergedStyle(run.style, patch) },
        ...(at + to < offset ? [{ ...run, text: run.text.slice(to) }] : []),
      ];
    });
    offset++;
    return { ...paragraph, runs };
  }) };
}
/** Explicit whole-widget commands override every run, even when equal to the widget base. */
export function applyRichTextStyle(rich: RichText, patch: Partial<WidgetStyle>): RichText {
  const runPatch = textStylePatch(patch);
  return { ...rich, paragraphs: rich.paragraphs.map(p => {
    const paragraph: RichTextParagraph = { ...p, runs: p.runs.map(r => ({ ...r, style: mergedStyle(r.style, runPatch) })) };
    if (Object.hasOwn(patch, 'textAlign')) paragraph.textAlign = patch.textAlign;
    if (Object.hasOwn(patch, 'lineHeight')) delete paragraph.lineHeightPx;
    return paragraph;
  }) };
}
/** An intentional plain replacement retains the first run's baseline formatting. */
export function replaceWidgetText(widget: Widget, text: string): Widget {
  if (!widget.richText) return { ...widget, text };
  const first = widget.richText.paragraphs[0];
  const richText = { ...widget.richText, ...richTextFromPlainText(text, first.runs[0]?.style) };
  richText.paragraphs = richText.paragraphs.map(p => ({ ...first, runs: p.runs }));
  if (widget.richText.paragraphs.length === 1 && first.runs.length === 1 && first.runs[0].linkId && !/[\r\n]/.test(text)) richText.paragraphs[0].runs[0].linkId = first.runs[0].linkId;
  return { ...widget, text: richTextPlainText(richText), richText: pruneLinks(richText) };
}
export function patchWidgetTextStyle(widget: Widget, patch: Partial<WidgetStyle>): Widget {
  return { ...widget, style: { ...widget.style, ...patch }, ...(widget.richText ? { richText: applyRichTextStyle(widget.richText, patch) } : {}) };
}
/** Replace whole-text matches across run boundaries; inserted text inherits the first character. */
export function mapRichTextMatches(rich: RichText, pattern: RegExp, replace: (match: RegExpExecArray) => string): RichText {
  const source = richTextPlainText(rich), regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const changes: { start: number; end: number; text: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    if (!match[0].length) throw new Error('Empty rich text match');
    const text = replace(match);
    if (text !== match[0]) changes.push({ start: match.index, end: match.index + match[0].length, text });
  }
  let result = rich;
  for (const change of changes.reverse()) result = replaceRichTextRange(result, change.start, change.end, change.text);
  return result;
}
export function resolveRichText(rich: RichText, resolve: (text: string) => string): RichText {
  if (rich.expressionMode === 'literal') return rich;
  const result = mapRichTextMatches(rich, /\[\[([^\[\]]+)\]\]/g, match => resolve(match[0]));
  if (richTextPlainText(result).length > 100000) throw new Error('Resolved text exceeds 100000 characters');
  return result;
}
