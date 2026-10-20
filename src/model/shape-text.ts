import type { Widget } from './types';

/** Independently implemented ordinary-shape initial text layout. The default
 * native writer omits text coordinates and dimensions; the owner's descendant
 * rule supplies absolute positioning, flex alignment, padding and full width.
 * This is separate from runtime AutoFit actions that can resize the owner. */
export function createShapeTextRenderer() {
  const supports = (widget: Widget) => Boolean(widget.shapeText
    && ['box', 'ellipse', 'path'].includes(widget.type)
    && widget.style.verticalAlign !== undefined && widget.style.textPadding !== undefined);
  const css = (widget: Widget) => supports(widget) ? {
    position: 'absolute' as const, inset: 'auto', width: '100%', height: 'auto',
    display: 'block', boxSizing: 'border-box' as const, padding: widget.style.textPadding!.map(value => `${value}px`).join(' '), overflow: 'visible',
    alignSelf: widget.style.verticalAlign === 'top' ? 'flex-start' : widget.style.verticalAlign === 'bottom' ? 'flex-end' : 'center',
    lineHeight: widget.style.lineHeight ?? 'normal',
    whiteSpace: widget.shapeText!.autoFitWidth ? 'nowrap' : 'normal',
    overflowWrap: widget.shapeText!.autoFitWidth ? 'normal' as const : 'break-word' as const,
    wordBreak: 'normal' as const, alignItems: 'normal', justifyContent: 'normal',
  } : undefined;
  // Explicit breaks remain structural when nowrap disables automatic wrapping.
  // Text is always inserted as text nodes, including literal HTML-looking input.
  const parts = (value: string, leading = true) => {
    let text = value.replace(/\r\n?/g, '\n');
    if (leading) text = text.replace(/^ /, '\u00a0');
    text = text.replace(/  /g, '\u00a0 ').replace(/  /g, '\u00a0 ');
    return text.split(/[\n\u2028]/);
  };
  const paint = (element: HTMLElement, value: string, leading = true) => {
    const content = parts(value, leading), children = Array.from(element.childNodes);
    if (children.length === content.length * 2 - 1 && children.every((node, index) => index % 2
      ? node.nodeName === 'BR' : node.nodeType === 3 && node.textContent === content[index / 2])) return;
    const nodes: Node[] = [], document = element.ownerDocument;
    for (const [index, part] of content.entries()) {
      if (index) nodes.push(document.createElement('br'));
      nodes.push(document.createTextNode(part));
    }
    element.replaceChildren(...nodes);
  };
  return { supports, css, parts, paint };
}
export type ShapeTextRenderer = ReturnType<typeof createShapeTextRenderer>;
