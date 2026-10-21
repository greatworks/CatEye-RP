import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createWidget } from '../src/model/document';
import { createShapeTextRenderer } from '../src/model/shape-text';
import { createShapeTextMeasurer } from '../src/runtime/shape-text-measure';
import type { Widget } from '../src/model/types';

// Structure/measurement-call oracle only. This double does not measure fonts.
class TextNode {
  readonly nodeType = 3; readonly nodeName = '#text'; readonly childNodes: never[] = [];
  parentElement: ElementNode | null = null;
  constructor(public textContent: string, public ownerDocument: TestDocument) {}
}
class ElementNode {
  readonly nodeType = 1; readonly nodeName: string; readonly tagName: string;
  parentElement: ElementNode | null = null;
  childNodes: (TextNode | ElementNode)[] = [];
  style: Record<string, string> = {}; dataset: Record<string, string> = {};
  className = ''; attributes = new Map<string, string>(); offsetWidth = 0; offsetHeight = 0;
  constructor(tag: string, public ownerDocument: TestDocument) { this.nodeName = this.tagName = tag.toUpperCase(); }
  get children(): ElementNode[] { return this.childNodes.filter((node): node is ElementNode => node.nodeType === 1); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get firstElementChild() { return this.children[0] ?? null; }
  get isConnected(): boolean { return this === this.ownerDocument.body || !!this.parentElement?.isConnected; }
  get textContent(): string { return this.childNodes.map(node => node.textContent).join(''); }
  set innerHTML(_: string) { throw Error('Selection measurement must not parse text as HTML'); }
  append(...nodes: (TextNode | ElementNode)[]) { for (const node of nodes) { node.parentElement = this; this.childNodes.push(node); } }
  replaceChildren(...nodes: (TextNode | ElementNode)[]) {
    for (const node of this.childNodes) node.parentElement = null;
    this.childNodes = []; this.append(...nodes);
  }
  remove() {
    if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter(node => node !== this);
    this.parentElement = null;
  }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  getClientRects() { return this.isConnected ? [{}] : []; }
  getBoundingClientRect(): never { throw Error('Screen bounds must not measure text'); }
  querySelectorAll(selector: string): ElementNode[] {
    const direct = selector.startsWith(':scope > '), name = direct ? selector.slice(9) : selector;
    const descendants = (node: ElementNode): ElementNode[] => node.children.flatMap(child => [child, ...descendants(child)]);
    const matches = (node: ElementNode) => name.startsWith('.') ? node.className.split(' ').includes(name.slice(1))
      : name.startsWith('[data-') ? Object.hasOwn(node.dataset, name.slice(6, -1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()))
        : node.tagName.toLowerCase() === name;
    return (direct ? this.children : descendants(this)).filter(matches);
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
}
class TestDocument {
  body = new ElementNode('body', this); elements: ElementNode[] = [];
  defaultView = {
    getComputedStyle: vi.fn((element: ElementNode) => ({
      display: 'inline', boxSizing: 'content-box', width: 'auto', height: 'auto',
      paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
      borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px',
      ...element.style,
    })),
  };
  createElement(tag: string) { const node = new ElementNode(tag, this); this.elements.push(node); return node; }
  createTextNode(text: string) { return new TextNode(text, this); }
}
const element = (node: ElementNode) => node as unknown as HTMLElement;
const document = (node: TestDocument) => node as unknown as Document;
function fixture(type: 'checkbox' | 'radio' = 'checkbox'): Widget {
  const w = createWidget(type);
  Object.assign(w, { width: 100.25, height: 20.125, rotation: 37, text: 'Label',
    selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false } });
  Object.assign(w.style, { textPadding: [1.25, 2.5, 3.75, 4.5], verticalAlign: 'bottom',
    fontFamily: 'Open Sans', fontSize: 17, fontWeight: 600, fontStyle: 'italic', lineHeight: '1.5',
    selectionButtonSize: 83 });
  return w;
}
function live(doc: TestDocument) {
  const owner = doc.createElement('div'), label = doc.createElement('label'),
    layer = doc.createElement('span'), paragraph = doc.createElement('span');
  layer.className = 'selection-text'; paragraph.dataset.richParagraph = '0';
  doc.body.append(owner); owner.append(label); label.append(layer); layer.append(paragraph);
  return { owner, label, layer, paragraph };
}
function run(doc: TestDocument, parent: ElementNode, text: string) {
  const span = doc.createElement('span'); span.append(doc.createTextNode(text)); parent.append(span); return span;
}
const modes: [string, typeof createShapeTextMeasurer][] = [
  ['module', createShapeTextMeasurer],
  ['serialized', new Script(`(${createShapeTextMeasurer.toString()})`).runInNewContext({}) as typeof createShapeTextMeasurer],
];

describe.each(modes)('%s selection text measurement', (_name, factory) => {
  it.each(['checkbox', 'radio'] as const)('measures %s direct spans, excluding links/P94 and retaining owner height', type => {
    const doc = new TestDocument(), widget = fixture(type), { owner, layer, paragraph } = live(doc);
    const a = run(doc, paragraph, 'A'), link = doc.createElement('a'); paragraph.append(link);
    const linked = run(doc, link, 'Long link'), b = run(doc, paragraph, 'B');
    const second = doc.createElement('span'); second.dataset.richParagraph = '1'; layer.append(second);
    const c = run(doc, second, 'C'), widths = new Map([[a, 20.25], [linked, 999], [b, 10.5], [c, 40.125]]);
    const read = vi.fn((node: HTMLElement, axis: string) => {
      expect(axis).toBe('width'); return widths.get(node as unknown as ElementNode)!;
    });
    const before = JSON.stringify(widget), children = [...owner.childNodes];
    const helper = factory(createShapeTextRenderer(), read);
    expect(helper.measureSelection(widget, element(owner), document(doc))).toEqual({ width: 47.125, height: 20.125 });
    expect(read.mock.calls.map(([node]) => node)).toEqual([a, b, c]);
    expect(JSON.stringify(widget)).toBe(before); expect(owner.childNodes).toEqual(children);
    expect(doc.body.children).toEqual([owner]); expect(owner.style).toEqual({});
  });

  it.each([false, true])('rejects height AutoFit before DOM or content reads, including width=%s', width => {
    const doc = new TestDocument(), widget = fixture(), read = vi.fn(() => 10);
    widget.selectionText = { autoFitWidth: width, autoFitHeight: true, alignRight: true };
    expect(() => factory(createShapeTextRenderer(), read).measureSelection(widget, undefined, document(doc)))
      .toThrow('Native selection text height AutoFit is unsupported');
    expect(read).not.toHaveBeenCalled(); expect(doc.elements).toEqual([]);
  });

  it('does nothing for omitted flags, missing layout metadata, unsupported types or false flags', () => {
    const doc = new TestDocument(), read = vi.fn(() => 1), helper = factory(createShapeTextRenderer(), read);
    const omitted = fixture(); delete omitted.selectionText;
    const noPadding = fixture(); delete noPadding.style.textPadding;
    const noAlign = fixture(); delete noAlign.style.verticalAlign;
    const noFit = fixture(); noFit.selectionText!.autoFitWidth = false;
    const box = { ...fixture(), type: 'box' as const };
    for (const widget of [omitted, noPadding, noAlign, noFit, box])
      expect(helper.measureSelection(widget, undefined, document(doc))).toBeUndefined();
    expect(read).not.toHaveBeenCalled(); expect(doc.elements).toEqual([]);
  });

  it('uses safe label copies with inherited fonts, without shape layout or fabricated panel coordinates', () => {
    const doc = new TestDocument(), widget = fixture(), before = JSON.stringify(widget);
    const renderer = createShapeTextRenderer(), css = vi.fn(renderer.css); renderer.css = css;
    const read = vi.fn((node: HTMLElement, axis: string) => {
      expect(axis).toBe('width');
      const holder = doc.body.children[0], copy = holder.firstElementChild!, label = copy.firstElementChild!;
      const text = label.querySelector(':scope > .selection-text')!;
      expect(holder.getAttribute('aria-hidden')).toBe('true');
      expect(holder.style).toMatchObject({ visibility: 'hidden', pointerEvents: 'none' });
      expect(copy.style).toMatchObject({ width: '100.25px', height: '20.125px', transform: 'none',
        fontFamily: 'Open Sans', fontSize: '17px', fontWeight: '600', fontStyle: 'italic', lineHeight: '1.5' });
      expect(label.tagName).toBe('LABEL');
      expect(text.style).toMatchObject({ whiteSpace: 'nowrap', overflowWrap: 'normal' });
      expect(text.style).not.toHaveProperty('alignSelf');
      expect(text.style).not.toHaveProperty('width');
      expect(text.style).not.toHaveProperty('left');
      expect(text.style.padding ?? '0px').toBe('0px');
      expect(text.querySelector('.rich-text-content')!.style.whiteSpace).toBe('inherit');
      expect((node as unknown as ElementNode).isConnected).toBe(true);
      return 21.375;
    });
    expect(factory(renderer, read).measureSelection(widget, undefined, document(doc))).toEqual({ width: 28.375, height: 20.125 });
    expect(css).not.toHaveBeenCalled(); expect(JSON.stringify(widget)).toBe(before);
    expect(doc.body.children).toEqual([]);
  });

  it.each(['owner', 'ancestor', 'label', 'text', 'detached'] as const)('isolates %s hidden/detached DOM without changing display or geometry', hidden => {
    const doc = new TestDocument(), widget = fixture(), { owner, label, layer, paragraph } = live(doc);
    run(doc, paragraph, 'Old live text');
    const ancestor = doc.createElement('section'); doc.body.append(ancestor); owner.remove(); ancestor.append(owner);
    if (hidden === 'detached') owner.remove();
    else ({ owner, ancestor, label, text: layer })[hidden].style.display = 'none';
    const before = [owner, ancestor, label, layer].map(node => ({ style: { ...node.style }, children: [...node.childNodes] }));
    const read = vi.fn((node: HTMLElement) => {
      expect(node).not.toBe(paragraph.firstElementChild);
      expect((node as unknown as ElementNode).textContent).toBe('Label');
      return 25;
    });
    expect(factory(createShapeTextRenderer(), read).measureSelection(widget, element(owner), document(doc)))
      .toEqual({ width: 32, height: 20.125 });
    [owner, ancestor, label, layer].forEach((node, index) => {
      expect(node.style).toEqual(before[index].style); expect(node.childNodes).toEqual(before[index].children);
    });
    expect(doc.body.children).toEqual([ancestor]);
  });

  it('does not mistake a shape text layer or an unstructured label for a live selection paragraph', () => {
    const doc = new TestDocument(), widget = fixture(), owner = doc.createElement('div'); doc.body.append(owner);
    const wrong = doc.createElement('span'); wrong.className = 'widget-text'; owner.append(wrong);
    const p = doc.createElement('span'); p.dataset.richParagraph = '0'; wrong.append(p); run(doc, p, 'wrong');
    const label = doc.createElement('label'); owner.append(label);
    const text = doc.createElement('span'); text.className = 'selection-text'; label.append(text); run(doc, text, 'unstructured');
    const read = vi.fn((node: HTMLElement) => { expect((node as unknown as ElementNode).textContent).toBe('Label'); return 20; });
    expect(factory(createShapeTextRenderer(), read).measureSelection(widget, element(owner), document(doc))?.width).toBe(27);
    expect(doc.body.children).toEqual([owner]); expect(text.textContent).toBe('unstructured');
  });

  it('reuses safe rich paragraphs and linked-run grouping without making link widths direct', () => {
    const doc = new TestDocument(), widget = fixture();
    widget.richText = { paragraphs: [
      { lineHeightPx: 31.25, textAlign: 'right', runs: [
        { text: '<script>  A\nB', style: { fontFamily: 'Roboto', fontSize: 19, underline: true } },
        { text: 'linked1', linkId: 'link' }, { text: 'linked2', linkId: 'link' },
      ] }, { runs: [{ text: '' }] },
    ], links: [{ id: 'link', name: 'Link', interactions: [] }] };
    const read = vi.fn((node: HTMLElement) => {
      const copy = doc.body.children[0], paragraphs = copy.querySelectorAll('[data-rich-paragraph]');
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0].style).toMatchObject({ lineHeight: '31.25px', textAlign: 'right' });
      expect(copy.querySelectorAll('a')).toHaveLength(1);
      expect(copy.querySelector('a')!.children).toHaveLength(2);
      expect(copy.querySelector('a')!.getAttribute('href')).toBeNull();
      expect(copy.querySelectorAll('script')).toEqual([]);
      expect(paragraphs[0].firstElementChild!.style).toMatchObject({ fontFamily: 'Roboto', fontSize: '19px', textDecorationLine: 'underline' });
      expect(paragraphs[0].firstElementChild!.textContent).toBe('<script>\u00a0 AB');
      expect(paragraphs[0].firstElementChild!.querySelectorAll('br')).toHaveLength(1);
      expect(node).not.toBe(copy.querySelector('a')!.firstElementChild);
      return 30;
    });
    expect(factory(createShapeTextRenderer(), read).measureSelection(widget, undefined, document(doc))?.width).toBe(37);
    expect(read).toHaveBeenCalledTimes(2); expect(doc.body.children).toEqual([]);
  });

  it('plain setter copies keep LF/CRLF BRs, literal markup/spaces and lone CR/Unicode separators', () => {
    const doc = new TestDocument(), widget = fixture();
    widget.text = '  A\rB\u2028C\u2029D\r\n\n<b>\n';
    const read = vi.fn((node: HTMLElement) => {
      const run = node as unknown as ElementNode;
      expect(run.children.map(child => child.tagName)).toEqual(['SPAN', 'BR', 'BR', 'SPAN', 'BR']);
      expect(run.children[0].textContent).toBe('  A\rB\u2028C\u2029D');
      expect(run.querySelectorAll('b')).toEqual([]);
      return 18;
    });
    expect(factory(createShapeTextRenderer(), read).measureSelection(widget, undefined, document(doc), { plainSetter: true }))
      .toEqual({ width: 25, height: 20.125 });
    expect(read).toHaveBeenCalledOnce();
  });

  it('keeps sole linked plain setter text excluded and empty setter copies free of initial BR', () => {
    const doc = new TestDocument(), widget = fixture(), read = vi.fn(() => 500);
    widget.richText = { paragraphs: [{ runs: [{ text: 'Linked', linkId: 'l' }] }],
      links: [{ id: 'l', name: 'L', interactions: [] }] };
    const helper = factory(createShapeTextRenderer(), read);
    expect(helper.measureSelection(widget, undefined, document(doc), { plainSetter: true })).toEqual({ width: 7, height: 20.125 });
    expect(read).not.toHaveBeenCalled();
    delete widget.richText; widget.text = '';
    read.mockImplementation(() => {
      expect(doc.body.children[0].querySelectorAll('br')).toEqual([]);
      expect(doc.body.children[0].querySelector('[data-rich-run]')!.childNodes).toEqual([]);
      return 0;
    });
    expect(helper.measureSelection(widget, undefined, document(doc), { plainSetter: true })).toEqual({ width: 7, height: 20.125 });
    expect(doc.body.children).toEqual([]);
  });

  it.each(['throw', 'NaN', 'Infinity'] as const)('cleans isolated copies on %s failure', failure => {
    const doc = new TestDocument(), old = doc.createElement('main'); doc.body.append(old);
    const read = () => { if (failure === 'throw') throw Error('read failed'); return failure === 'NaN' ? NaN : Infinity; };
    expect(() => factory(createShapeTextRenderer(), read).measureSelection(fixture(), undefined, document(doc)))
      .toThrow(failure === 'throw' ? 'read failed' : 'must be finite');
    expect(doc.body.children).toEqual([old]);
  });

  it('retains live nodes and display on reader failure', () => {
    const doc = new TestDocument(), { owner, label, layer, paragraph } = live(doc), span = run(doc, paragraph, 'A');
    expect(() => factory(createShapeTextRenderer(), () => { throw Error('read failed'); })
      .measureSelection(fixture(), element(owner), document(doc))).toThrow('read failed');
    expect(owner.children).toEqual([label]); expect(label.children).toEqual([layer]);
    expect(paragraph.children).toEqual([span]); expect(owner.style).toEqual({});
  });

  it('uses realm-local fractional CSS/inline offsets, never rotated screen bounds', () => {
    const doc = new TestDocument(), widget = fixture(), { owner, paragraph } = live(doc), span = run(doc, paragraph, 'A');
    Object.assign(span.style, { width: 'auto', paddingLeft: '3.75px', paddingRight: '3.75px',
      borderLeftWidth: '1px', borderRightWidth: '1px', transform: 'rotate(37deg)' });
    span.offsetWidth = 59;
    const helper = factory(createShapeTextRenderer());
    expect(helper.measureSelection(widget, element(owner), document(doc))).toEqual({ width: 56.5, height: 20.125 });
    Object.assign(span.style, { display: 'inline-block', boxSizing: 'border-box', width: '31.375px' });
    expect(helper.measureSelection(widget, element(owner), document(doc))?.width).toBe(28.875);
    Object.assign(span.style, { width: '0px', paddingLeft: '0px', paddingRight: '0px',
      borderLeftWidth: '0px', borderRightWidth: '0px' });
    widget.style.textPadding = [0, 0, 0, 0];
    expect(helper.measureSelection(widget, element(owner), document(doc))?.width).toBe(0);
    expect(doc.defaultView.getComputedStyle.mock.calls.every(([node]) => node === span)).toBe(true);
  });

  it('rejects a different owner realm and does not measure a missing document view', () => {
    const doc = new TestDocument(), other = new TestDocument(), { owner } = live(other), read = vi.fn(() => 1);
    const helper = factory(createShapeTextRenderer(), read);
    expect(() => helper.measureSelection(fixture(), element(owner), document(doc))).toThrow('share a realm');
    const noView = { body: doc.body, defaultView: null } as unknown as Document;
    expect(helper.measureSelection(fixture(), undefined, noView)).toBeUndefined();
    expect(read).not.toHaveBeenCalled(); expect(doc.elements).toEqual([]);
  });
});
