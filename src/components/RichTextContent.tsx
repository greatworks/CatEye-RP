import { useLayoutEffect, useRef, type ReactNode, type MouseEvent, type CSSProperties } from 'react';
import type { RichText, WidgetStyle } from '../model/types';
import { textDecorationLine } from '../model/rich-text';
import { createShapeTextRenderer } from '../model/shape-text';
import { createShapeTextMeasurer } from '../runtime/shape-text-measure';

const shapeText = createShapeTextRenderer();
const shapeTextMeasurer = createShapeTextMeasurer(shapeText);
function PlainSetterRun({ text, index, style }: { text: string; index: number; style: CSSProperties }) {
  const element = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => { if (element.current) shapeTextMeasurer.paintPlainSetter(element.current, text); });
  return <span ref={element} data-rich-run={index} style={style}/>;
}
export function explicitTextBreaks(value: string, leading = true): ReactNode[] {
  return shapeText.parts(value, leading).flatMap((part, index) => index ? [<br key={`break-${index}`}/>, part] : [part]);
}

/** Rendering is structural: text remains a React text node, never executable markup. */
export interface RichLinkHandlers {
  onLinkClick?: (id: string, event: MouseEvent<HTMLElement>) => void;
  onLinkPointer?: (id: string, phase: 'enter'|'leave'|'down'|'up') => void;
  linksDisabled?: boolean;
}
export function RichTextContent({ richText, baseStyle, nativeLayout, plainSetter, onLinkClick, onLinkPointer, linksDisabled }: { richText: RichText; baseStyle?: Partial<WidgetStyle>; nativeLayout?: boolean; plainSetter?: boolean } & RichLinkHandlers) {
  function runs(paragraph: RichText['paragraphs'][number]): ReactNode[] {
    const output: ReactNode[] = [];
    for (let index = 0; index < paragraph.runs.length;) {
      const start = index, id = paragraph.runs[index].linkId, contents: ReactNode[] = [];
      do {
        const run = paragraph.runs[index], { underline, strikethrough, ...style } = run.style ?? {};
        const runStyle = { ...style, textDecorationLine: textDecorationLine({ underline: underline ?? baseStyle?.underline, strikethrough: strikethrough ?? baseStyle?.strikethrough }) };
        contents.push(plainSetter ? <PlainSetterRun key={index} text={run.text} index={index} style={runStyle}/> : <span key={index} data-rich-run={index} style={runStyle}>{nativeLayout ? explicitTextBreaks(run.text, index === 0) : run.text}</span>);
        index++;
      } while (id && index < paragraph.runs.length && paragraph.runs[index].linkId === id);
      if (!id) { output.push(...contents); continue; }
      const link = richText.links?.find(link => link.id === id);
      if (!onLinkClick) { output.push(<span key={`link-${start}`} data-rich-link-id={id}>{contents}</span>); continue; }
      output.push(<a key={`link-${start}`} data-rich-link-id={id} role="link" aria-label={link?.name || undefined} aria-disabled={linksDisabled || undefined} tabIndex={linksDisabled ? -1 : 0} style={{ color: 'inherit', textDecoration: 'none', cursor: linksDisabled ? 'default' : 'pointer', pointerEvents: 'auto' }}
        onClick={event => { event.preventDefault(); if (!linksDisabled) onLinkClick(id, event); }}
        onMouseEnter={() => onLinkPointer?.(id,'enter')} onMouseLeave={() => onLinkPointer?.(id,'leave')}
        onMouseDown={event => { event.preventDefault(); event.stopPropagation(); onLinkPointer?.(id,'down'); }} onMouseUp={() => onLinkPointer?.(id,'up')}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (!linksDisabled && !event.repeat) event.currentTarget.click(); } }}>{contents}</a>);
    }
    return output;
  }
  return <span className="rich-text-content" style={{ display: 'block', width: '100%', minWidth: 0, whiteSpace: nativeLayout ? 'inherit' : 'pre-wrap', overflowWrap: nativeLayout ? 'inherit' : 'anywhere' }}>
    {richText.paragraphs.map((paragraph, index) => <span key={index} data-rich-paragraph={index} style={{ display: 'block', margin: 0, textAlign: paragraph.textAlign, lineHeight: typeof paragraph.lineHeightPx === 'number' ? `${paragraph.lineHeightPx}px` : paragraph.lineHeightPx }}>
      {runs(paragraph)}
      {!plainSetter && paragraph.runs.every(run => run.text === '') && <br/>}
    </span>)}
  </span>;
}
