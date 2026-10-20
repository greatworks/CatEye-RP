import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createWidget } from '../src/model/document';
import { createShapeTextRenderer } from '../src/model/shape-text';
import { RichTextContent } from '../src/components/RichTextContent';
import { WidgetContent } from '../src/components/WidgetView';
import type { RichText, Widget } from '../src/model/types';

function shape(autoFitWidth = true, autoFitHeight = true): Widget {
  const widget = createWidget('box');
  Object.assign(widget, { x: 43.5, y: -7.25, width: 95, height: 27, rotation: 90,
    text: 'Problems', shapeText: { autoFitWidth, autoFitHeight } });
  Object.assign(widget.style, { textPadding: [0, 0, 0, 0], verticalAlign: 'top',
    fontFamily: 'Open Sans', fontSize: 28, fontWeight: 700, lineHeight: 'normal' });
  return widget;
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// This narrow DOM double records node creation, not font metrics or browser layout.
// Any attempt to parse input as HTML fails; the production browser tests own pixels.
function textHost() {
  type Node = { nodeType: number; nodeName: string; textContent: string };
  const document = {
    createTextNode: vi.fn((text: string): Node => ({ nodeType: 3, nodeName: '#text', textContent: text })),
    createElement: vi.fn((tag: string): Node => {
      expect(tag).toBe('br');
      return { nodeType: 1, nodeName: 'BR', textContent: '' };
    }),
  };
  const element = {
    ownerDocument: document,
    childNodes: [] as Node[],
    set innerHTML(_: string) { throw new Error('Text must not be parsed as HTML'); },
    replaceChildren: vi.fn((...nodes: Node[]) => { element.childNodes = nodes; }),
  };
  return { element, document, target: element as unknown as HTMLElement };
}

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} native shape text renderer`, () => {
  // Empty VM context deliberately supplies neither imported helpers nor document.
  const renderer = () => portable
    ? new Script(`(${createShapeTextRenderer.toString()})()`).runInNewContext({}) as ReturnType<typeof createShapeTextRenderer>
    : createShapeTextRenderer();

  it.each([[false, false], [false, true], [true, false], [true, true]])(
    'lays out text independently of the saved owner for flags %s/%s', (width, height) => {
      const widget = freeze(shape(width, height)), before = JSON.stringify(widget), read = renderer();
      const css = read.css(widget);
      expect(read.supports(widget)).toBe(true);
      expect(css).toBeDefined();
      // AutoFitHeight does not rewrite the owner height or force text into 27px.
      expect(css!.height).toBe('auto');
      expect(css!.overflow).toBe('visible');
      expect(css!.whiteSpace).toBe(width ? 'nowrap' : 'normal');
      expect(css!.overflowWrap).toBe(width ? 'normal' : 'break-word');
      expect(css).not.toHaveProperty('fontSize');
      expect(css).not.toHaveProperty('fontFamily');
      expect(JSON.stringify(widget)).toBe(before);
      expect([widget.x, widget.y, widget.width, widget.height, widget.rotation]).toEqual([43.5, -7.25, 95, 27, 90]);
      expect(widget.style.fontSize).toBe(28);
    },
  );

  it('leaves omitted legacy layout alone and limits native text handling to shape carriers', () => {
    const read = renderer(), old = shape(); delete old.shapeText;
    expect(read.supports(old)).toBe(false); expect(read.css(old)).toBeUndefined();
    for (const type of ['box', 'ellipse', 'path'] as const) expect(read.supports({ ...shape(), type })).toBe(true);
    for (const type of ['text', 'input', 'tableCell', 'treeNode', 'image', 'panel'] as const) {
      expect(read.supports({ ...shape(), type })).toBe(false);
      expect(read.css({ ...shape(), type })).toBeUndefined();
    }
  });

  it('preserves every explicit break and literal payload without interpreting markup', () => {
    const read = renderer();
    for (const breakText of ['\n', '\r', '\r\n', '\u2028']) {
      expect(read.parts(`a${breakText}b`)).toEqual(['a', 'b']);
      expect(read.parts(`${breakText}a${breakText}${breakText}`)).toEqual(['', 'a', '', '']);
    }
    expect(read.parts('a\r\nb\rc\nd\u2028e')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(read.parts('')).toEqual(['']);
    expect(read.parts('<img src=x onerror="bad()"> & <br>')).toEqual(['<img src=x onerror="bad()"> & <br>']);
    // No unsupported tab expansion or paragraph-separator normalization is claimed.
    expect(read.parts('\tA\u2029B')).toEqual(['\tA\u2029B']);
  });

  it('converts first-run leading spaces and double spaces without extending the rule across runs or breaks', () => {
    const read = renderer();
    expect(read.parts(' A B ', true)).toEqual(['\u00a0A B ']);
    expect(read.parts(' A B ', false)).toEqual([' A B ']);
    expect(read.parts('A  B   C    D', false)).toEqual(['A\u00a0 B\u00a0\u00a0 C\u00a0 \u00a0 D']);
    expect(read.parts('  A', true)).toEqual(['\u00a0 A']);
    expect(read.parts('\u00a0 A\u00a0', true)).toEqual(['\u00a0 A\u00a0']);
    expect(read.parts('A\n B', true)).toEqual(['A', ' B']);
    expect(read.parts('A ', true).join('') + read.parts(' B', false).join('')).toBe('A  B');
  });

  it('paints only text and structural BR nodes using the destination ownerDocument', () => {
    const read = renderer(), { element, target, document } = textHost();
    read.paint(target, '<script>bad()</script>\r\n\n B\u2028');
    expect(element.childNodes.map(node => [node.nodeName, node.textContent])).toEqual([
      ['#text', '<script>bad()</script>'], ['BR', ''], ['#text', ''], ['BR', ''],
      ['#text', ' B'], ['BR', ''], ['#text', ''],
    ]);
    expect(document.createElement).toHaveBeenCalledTimes(3);
    expect(document.createTextNode).toHaveBeenCalledTimes(4);
    expect(element.replaceChildren).toHaveBeenCalledOnce();
  });

  it('retains node identity for identical output, but repairs changed text and stale break elements', () => {
    const read = renderer(), { element, target } = textHost();
    read.paint(target, ' A\r\nB'); const first = [...element.childNodes];
    read.paint(target, ' A\nB');
    expect(element.replaceChildren).toHaveBeenCalledOnce();
    element.childNodes.forEach((node, index) => expect(node).toBe(first[index]));
    read.paint(target, ' A\nB', false);
    expect(element.replaceChildren).toHaveBeenCalledTimes(2);
    expect(element.childNodes[0].textContent).toBe(' A');
    element.childNodes[1] = { nodeType: 1, nodeName: 'IMG', textContent: '' };
    read.paint(target, ' A\nB', false);
    expect(element.replaceChildren).toHaveBeenCalledTimes(3);
    expect(element.childNodes[1].nodeName).toBe('BR');
    read.paint(target, '');
    expect(element.childNodes).toEqual([{ nodeType: 3, nodeName: '#text', textContent: '' }]);
  });
});

describe('React native shape text structure', () => {
  it('keeps paragraphs, mixed runs and hyperlink identity while using explicit safe breaks', () => {
    const rich: RichText = freeze({ expressionMode: 'literal', links: [{ id: 'help', name: 'Help', interactions: [] }], paragraphs: [
      { textAlign: 'right', lineHeightPx: 36, runs: [
        { text: ' First\nline', style: { fontWeight: 700, fontSize: 28 } },
        { text: ' link\u2028next', linkId: 'help', style: { fontStyle: 'italic', color: '#123456' } },
        { text: '  <img src=x> & [[literal]]', linkId: 'help' },
      ] },
      { runs: [{ text: ' Next paragraph' }] },
      { runs: [{ text: '' }] },
    ] });
    const before = JSON.stringify(rich);
    const markup = renderToStaticMarkup(createElement(RichTextContent, { richText: rich, nativeLayout: true, onLinkClick: () => {} }));
    expect(markup.match(/data-rich-paragraph=/g)).toHaveLength(3);
    expect(markup.match(/data-rich-run=/g)).toHaveLength(5);
    expect(markup.match(/<br\/>/g)).toHaveLength(3); // Two explicit breaks and one empty paragraph.
    expect(markup).toContain('white-space:inherit'); expect(markup).toContain('overflow-wrap:inherit');
    expect(markup).toContain('text-align:right;line-height:36px');
    expect(markup).toContain('font-weight:700;font-size:28px');
    expect(markup).toContain('\u00a0First<br/>line');
    expect(markup).toContain('> link<br/>next</span>'); // Later run is not paragraph-leading.
    expect(markup).toContain('\u00a0 &lt;img src=x&gt; &amp; [[literal]]');
    expect(markup).toContain('>\u00a0Next paragraph</span>');
    expect(markup.match(/<a /g)).toHaveLength(1);
    expect(markup).toMatch(/<a [^>]*data-rich-link-id="help"[^>]*>.*data-rich-run="1".*data-rich-run="2".*<\/a>/);
    expect(markup).not.toContain('<img');
    expect(JSON.stringify(rich)).toBe(before);
  });

  it('renders authoring hyperlink markers without enabling navigation', () => {
    const rich: RichText = { links: [{ id: 'link', name: 'Link', interactions: [] }], paragraphs: [{ runs: [{ text: ' one\ntwo', linkId: 'link' }] }] };
    const markup = renderToStaticMarkup(createElement(RichTextContent, { richText: rich, nativeLayout: true }));
    expect(markup).toContain('<span data-rich-link-id="link">');
    expect(markup).toContain('\u00a0one<br/>two');
    expect(markup).not.toContain('<a'); expect(markup).not.toContain('href=');
  });

  it('keeps omitted nativeLayout on the old pre-wrap path without space or break conversion', () => {
    const text = ' A  B\n C\u2028D <b>&</b>';
    const rich: RichText = { paragraphs: [{ runs: [{ text }] }] };
    const omitted = renderToStaticMarkup(createElement(RichTextContent, { richText: rich }));
    const explicitFalse = renderToStaticMarkup(createElement(RichTextContent, { richText: rich, nativeLayout: false }));
    expect(omitted).toBe(explicitFalse);
    expect(omitted).toContain('white-space:pre-wrap;overflow-wrap:anywhere');
    expect(omitted).toContain(' A  B\n C\u2028D &lt;b&gt;&amp;&lt;/b&gt;');
    expect(omitted).not.toContain('<br'); expect(omitted).not.toContain('\u00a0');
    expect(rich.paragraphs[0].runs[0].text).toBe(text);
  });

  it('opts native plain shapes into structural breaks while old shape documents retain their text', () => {
    const widget = shape(); widget.text = ' A\r\nB\u2028<script>x</script>';
    const before = JSON.stringify(widget);
    const native = renderToStaticMarkup(createElement(WidgetContent, { widget }));
    expect(native).toContain('height:auto'); expect(native).toContain('white-space:nowrap');
    expect(native).toContain('\u00a0A<br/>B<br/>&lt;script&gt;x&lt;/script&gt;');
    expect(native).not.toContain('<script>'); expect(JSON.stringify(widget)).toBe(before);
    const old = { ...widget }; delete old.shapeText;
    const legacy = renderToStaticMarkup(createElement(WidgetContent, { widget: old }));
    expect(legacy).not.toContain('<br');
    expect(legacy).toContain(' A\r\nB\u2028&lt;script&gt;x&lt;/script&gt;');
  });
});
