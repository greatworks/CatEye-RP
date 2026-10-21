import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createWidget } from '../src/model/document';
import { createShapeTextRenderer } from '../src/model/shape-text';
import { createSelectionTextLayout } from '../src/runtime/selection-text-layout';
import type { Widget } from '../src/model/types';

// This DOM facade tests structure, requests and cleanup, not font metrics.
class TextNode {
  readonly nodeType = 3; readonly nodeName = '#text';
  parentElement: ElementNode | null = null;
  constructor(public textContent: string) {}
}
class ElementNode {
  readonly nodeType = 1; readonly nodeName: string; readonly tagName: string;
  parentElement: ElementNode | null = null;
  childNodes: (ElementNode | TextNode)[] = [];
  style: Record<string, string> = {}; dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  constructor(tag: string, public ownerDocument: TestDocument) { this.nodeName = this.tagName = tag.toUpperCase(); }
  get children() { return this.childNodes.filter((child): child is ElementNode => child instanceof ElementNode); }
  get textContent(): string { return this.childNodes.map(child => child.textContent).join(''); }
  get isConnected(): boolean { return this === this.ownerDocument.body || !!this.parentElement?.isConnected; }
  append(...nodes: (ElementNode | TextNode)[]) { for (const node of nodes) { node.parentElement = this; this.childNodes.push(node); } }
  replaceChildren(...nodes: (ElementNode | TextNode)[]) { this.childNodes = []; this.append(...nodes); }
  remove() {
    if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter(child => child !== this);
    this.parentElement = null;
  }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  set innerHTML(_: string) { throw Error('No HTML parsing'); }
  querySelectorAll(selector: string): ElementNode[] {
    return this.children.flatMap(child => [
      ...(selector === '[data-rich-paragraph]' && child.dataset.richParagraph !== undefined ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  getBoundingClientRect() { return { width: this.ownerDocument.measuredWidth, height: this.ownerDocument.measuredHeight }; }
}
class TestDocument {
  body = new ElementNode('body', this); created: ElementNode[] = [];
  defaultView = {}; measuredWidth = 100.25; measuredHeight = 23.25;
  fonts = { load: vi.fn(async (_font: string, _text?: string) => []), ready: Promise.resolve() };
  createElement(tag: string) { const element = new ElementNode(tag, this); this.created.push(element); return element; }
  createTextNode(text: string) { return new TextNode(text); }
  createRange() {
    return { selectNodeContents: (_node: ElementNode) => {},
      getBoundingClientRect: () => ({ width: this.measuredWidth }), detach: () => {} };
  }
}
const realm = (doc: TestDocument) => doc as unknown as Document;
const fixture = (type: 'checkbox' | 'radio' = 'checkbox'): Widget => {
  const widget = createWidget(type);
  Object.assign(widget, { text: 'Label', x: 41, y: 71, width: 100, height: 30, rotation: 0,
    selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false } });
  Object.assign(widget.style, { selectionButtonSize: 14, textPadding: [3, 7, 5, 5], verticalAlign: 'middle',
    fontFamily: 'Open Sans', fontSize: 16, fontWeight: 400, lineHeight: 1.25 });
  return widget;
};
const modes: [string, typeof createSelectionTextLayout][] = [
  ['module', createSelectionTextLayout],
  ['serialized', new Script(`(${createSelectionTextLayout.toString()})`).runInNewContext({}) as typeof createSelectionTextLayout],
];

describe.each(modes)('%s selection display layout', (_name, factory) => {
  const create = () => factory(createShapeTextRenderer());
  it.each(['checkbox', 'radio'] as const)('projects %s content, panel and local CNUW independently of owner location', type => {
    const widget = fixture(type), before = structuredClone(widget);
    expect(create().project(widget, { width: 80.5, height: 20.5 })).toEqual({
      origin: 'browser-derived', panel: { x: 19, y: 0, width: 81, height: 21 },
      text: { x: 14, y: 0, width: 93 }, indicator: { x: 0, y: 3.5, width: 14, height: 14 },
    });
    expect(widget).toEqual(before);
  });
  it.each([
    ['top', false, 3, 0], ['middle', false, 2, 0], ['bottom', false, 1, 0],
    ['top', true, 3, 86], ['middle', true, 2, 86], ['bottom', true, 1, 86],
  ] as const)('short panel %s right=%s uses ToEven positioning and indicator y0', (align, right, y, indicatorX) => {
    const widget = fixture(); widget.style.verticalAlign = align; widget.selectionText!.alignRight = right;
    const result = create().project(widget, { width: 12.5, height: 7.5 })!;
    expect(result.panel).toEqual({ x: right ? 5 : 19, y, width: 13, height: 8 });
    expect(result.text).toEqual({ x: right ? 0 : 14, y, width: 25 });
    expect(result.indicator).toEqual({ x: indicatorX, y: 0, width: 14, height: 14 });
  });
  it.each([[.5, 0], [1.5, 2], [2.5, 2], [3.5, 4]])('ToEven x for left padding %s', (left, x) => {
    const widget = fixture(); widget.selectionText!.alignRight = true; widget.style.textPadding![3] = left;
    expect(create().project(widget, { width: 10, height: 30 })!.panel.x).toBe(x);
  });
  it('preserves the supplied constrained width instead of measured glyph width', () => {
    const widget = fixture(); widget.selectionText!.autoFitWidth = false;
    expect(create().project(widget, { width: 999, height: 12.5 })!.panel).toEqual({ x: 19, y: 0, width: 74, height: 13 });
  });
  it('uses empty16 only without width fit; multiple empty paragraphs are structurally nonempty', () => {
    const widget = fixture(); widget.text = ''; widget.selectionText!.autoFitWidth = false;
    expect(create().project(widget, { width: 0, height: 100 })!.panel.height).toBe(16);
    widget.selectionText!.autoFitWidth = true;
    expect(create().project(widget, { width: 0, height: 33.5 })!.panel.height).toBe(34);
    widget.selectionText!.autoFitWidth = false;
    widget.richText = { paragraphs: [{ runs: [{ text: '' }] }, { runs: [{ text: '' }] }] };
    expect(create().project(widget, { width: 0, height: 40 })!.panel.height).toBe(40);
  });
  it('keeps explicit P94 zero, fractional dimensions and negative local indicator positions', () => {
    const widget = fixture(); widget.style.selectionButtonSize = 0;
    expect(create().project(widget, { width: 0, height: 0 })!.indicator).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    widget.selectionText!.alignRight = true; widget.style.selectionButtonSize = 120.25;
    expect(create().project(widget, { width: 3, height: 140 })!.indicator.x).toBe(-20.25);
  });
  it('does not manufacture absent metadata or accept a rotated/other widget', () => {
    const variants = [fixture(), fixture(), fixture(), fixture(), fixture()];
    delete variants[0].selectionText; delete variants[1].style.textPadding;
    delete variants[2].style.selectionButtonSize; variants[3].rotation = .001; variants[4].type = 'box';
    for (const widget of variants) {
      const before = structuredClone(widget);
      expect(create().supports(widget)).toBe(false); expect(create().measure(widget, realm(new TestDocument()))).toBeUndefined();
      expect(widget).toEqual(before);
    }
    expect(create().supports(fixture())).toBe(true);
  });
  it.each([-1, Infinity, NaN])('rejects invalid measured dimensions %s', value => {
    expect(() => create().project(fixture(), { width: value, height: 20 })).toThrow();
  });
  it('rejects a negative constrained width without clamping or mutating owner', () => {
    const widget = fixture(); widget.selectionText!.autoFitWidth = false; widget.width = 10;
    const before = structuredClone(widget);
    expect(() => create().project(widget, { width: 10, height: 10 })).toThrow(/constraint/i);
    expect(widget).toEqual(before);
  });
  it('paints isolated whole rich content including links/BR/literal HTML, preserving explicit run typography', () => {
    const widget = fixture(), doc = new TestDocument(), before = structuredClone(widget);
    widget.richText = { paragraphs: [
      { textAlign: 'right', lineHeightPx: 27, runs: [
        { text: '<b>A</b>\nB', style: { fontSize: 24, fontWeight: 700, color: '#123456' } },
        { text: 'Link', linkId: 'link', style: { fontFamily: 'Roboto', fontStyle: 'italic' } },
      ] },
      { runs: [{ text: '' }] },
    ] };
    const saved = structuredClone(widget), read = vi.fn((block: HTMLElement, width: number) => {
      const tree = block as unknown as ElementNode, paragraphs = tree.querySelectorAll('[data-rich-paragraph]');
      expect(width).toBe(10000); expect(tree.isConnected).toBe(true);
      expect(tree.style.padding).toBe('0px'); expect(tree.style.whiteSpace).toBe('nowrap');
      expect(paragraphs).toHaveLength(2); expect(paragraphs[0].style.lineHeight).toBe('27px');
      expect(paragraphs[0].children.map(node => node.tagName)).toEqual(['SPAN', 'A']);
      expect(paragraphs[0].children[0].style.fontSize).toBe('24px');
      expect(paragraphs[0].children[0].children.map(node => node.tagName)).toEqual(['BR']);
      expect(tree.textContent).toContain('<b>A</b>'); expect(paragraphs[1].children.at(-1)?.tagName).toBe('BR');
      expect(doc.created.some(node => node.tagName === 'INPUT')).toBe(false);
      return { width: 143.25, height: 50.25 };
    });
    expect(factory(createShapeTextRenderer(), read).measure(widget, realm(doc))!.panel.width).toBe(143);
    expect(read).toHaveBeenCalledOnce(); expect(doc.body.children).toEqual([]); expect(widget).toEqual(saved);
    expect(before.width).toBe(widget.width);
  });
  it('passes constrained width and word-wrap, while empty nonfit skips DOM measurement', () => {
    const widget = fixture(), doc = new TestDocument(); widget.selectionText!.autoFitWidth = false;
    const read = vi.fn((block: HTMLElement, width: number) => {
      expect(width).toBe(74); expect(block.style.whiteSpace).toBe('normal');
      expect(block.style.overflowWrap).toBe('break-word'); return { width: 10, height: 55.5 };
    });
    expect(factory(createShapeTextRenderer(), read).measure(widget, realm(doc))!.panel.height).toBe(56);
    widget.text = '';
    expect(factory(createShapeTextRenderer(), read).measure(widget, realm(doc))!.panel.height).toBe(16);
    expect(read).toHaveBeenCalledOnce(); expect(doc.body.children).toEqual([]);
  });
  it('default read uses paragraph content ranges and isolated line-box height', () => {
    const doc = new TestDocument();
    expect(create().measure(fixture(), realm(doc))!.panel).toEqual({ x: 19, y: 0, width: 100, height: 23 });
    expect(doc.body.children).toEqual([]);
  });
  it('cleans the isolated copy when reading throws or returns nonfinite dimensions', () => {
    const doc = new TestDocument();
    expect(() => factory(createShapeTextRenderer(), () => { throw Error('reading failed'); }).measure(fixture(), realm(doc))).toThrow('reading failed');
    expect(doc.body.children).toEqual([]);
    expect(() => factory(createShapeTextRenderer(), () => ({ width: NaN, height: 1 })).measure(fixture(), realm(doc))).toThrow();
    expect(doc.body.children).toEqual([]);
  });
  it('rejects width-fit content beyond the supported 10000px constraint and cleans the tree', () => {
    const doc = new TestDocument(), widget = fixture(), before = structuredClone(widget);
    expect(() => factory(createShapeTextRenderer(), () => ({ width: 10000.125, height: 20 }))
      .measure(widget, realm(doc))).toThrow(/10000/);
    expect(doc.body.children).toEqual([]); expect(widget).toEqual(before);
    expect(factory(createShapeTextRenderer(), () => ({ width: 10000, height: 20 }))
      .measure(widget, realm(doc))!.panel.width).toBe(10000);
    expect(doc.body.children).toEqual([]);
  });
  it('rejects missing DOM/font realm explicitly without creating any nodes', async () => {
    const doc = new TestDocument(); (doc as unknown as { defaultView: unknown }).defaultView = null;
    expect(() => create().measure(fixture(), realm(doc))).toThrow(/realm|document/i);
    await expect(create().fontsReady(fixture(), realm(doc))).rejects.toThrow(/realm|document/i);
    expect(doc.created).toEqual([]);
  });
  it('loads effective run fonts with glyph text and waits for font ready without mutating the widget', async () => {
    const widget = fixture(), doc = new TestDocument();
    widget.richText = { paragraphs: [{ runs: [
      { text: 'Alpha', style: { fontSize: 24, fontWeight: 700 } },
      { text: 'Beta', style: { fontFamily: 'Roboto', fontStyle: 'italic' } },
    ] }] };
    let release!: () => void;
    doc.fonts.ready = new Promise<void>(resolve => { release = resolve; });
    const before = structuredClone(widget), work = create().fontsReady(widget, realm(doc));
    let done = false; void work.then(() => { done = true; });
    await Promise.resolve(); await Promise.resolve();
    expect(done).toBe(false); expect(doc.fonts.load).toHaveBeenCalledWith('normal 700 24px Open Sans', 'Alpha');
    expect(doc.fonts.load).toHaveBeenCalledWith('italic 400 16px Roboto', 'Beta');
    release(); await work; expect(widget).toEqual(before); expect(doc.created).toEqual([]);
  });
  it('propagates font loading errors and does not silently accept an unavailable FontFaceSet', async () => {
    const doc = new TestDocument(); doc.fonts.load.mockRejectedValueOnce(Error('font failed'));
    await expect(create().fontsReady(fixture(), realm(doc))).rejects.toThrow('font failed');
    (doc as unknown as { fonts: unknown }).fonts = undefined;
    await expect(create().fontsReady(fixture(), realm(doc))).rejects.toThrow(/font/i);
  });
});
