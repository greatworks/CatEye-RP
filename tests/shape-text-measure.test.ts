import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createWidget } from '../src/model/document';
import { createShapeTextRenderer } from '../src/model/shape-text';
import { createShapeTextMeasurer } from '../src/runtime/shape-text-measure';
import type { Widget } from '../src/model/types';

// This DOM double checks structure, safety, measurement order and cleanup.
// It deliberately does not estimate browser font or line-box measurements.
class TextNode {
  readonly nodeType = 3; readonly nodeName = '#text'; parentElement: ElementNode | null = null;
  readonly childNodes: never[] = [];
  constructor(public textContent: string, public ownerDocument: TestDocument) {}
}
class ElementNode {
  readonly nodeType = 1; readonly nodeName: string; readonly tagName: string;
  parentElement: ElementNode | null = null;
  childNodes: (ElementNode | TextNode)[] = [];
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  className = '';
  attributes = new Map<string, string>();
  offsetWidth = 0; offsetHeight = 0;
  constructor(tag: string, public ownerDocument: TestDocument) { this.nodeName = this.tagName = tag.toUpperCase(); }
  get children(): ElementNode[] { return this.childNodes.filter((node): node is ElementNode => node.nodeType === 1); }
  get firstElementChild(): ElementNode | null { return this.children[0] ?? null; }
  get firstChild(): ElementNode | TextNode | null { return this.childNodes[0] ?? null; }
  get isConnected(): boolean { return this === this.ownerDocument.body || Boolean(this.parentElement?.isConnected); }
  get textContent(): string { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value: string) { this.replaceChildren(new TextNode(value, this.ownerDocument)); }
  set innerHTML(_: string) { throw new Error('The measurement copy must never parse text as HTML'); }
  append(...nodes: (ElementNode | TextNode)[]): void { for (const node of nodes) { node.parentElement = this; this.childNodes.push(node); } }
  appendChild<T extends ElementNode | TextNode>(node: T): T { this.append(node); return node; }
  replaceChildren(...nodes: (ElementNode | TextNode)[]): void { for (const old of this.childNodes) old.parentElement = null; this.childNodes = []; this.append(...nodes); }
  remove(): void { const parent = this.parentElement; if (parent) parent.childNodes = parent.childNodes.filter(node => node !== this); this.parentElement = null; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  getClientRects(): unknown[] { return this.isConnected ? [{}] : []; }
  getBoundingClientRect(): never { throw new Error('Transformed screen geometry is not a content measurement'); }
  querySelectorAll(selector: string): ElementNode[] {
    const direct = selector.startsWith(':scope > '), name = direct ? selector.slice(9) : selector;
    const matches = (node: ElementNode) => name.startsWith('.') ? node.className.split(' ').includes(name.slice(1))
      : name.startsWith('[data-') ? Object.hasOwn(node.dataset, name.slice(6, -1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()))
        : node.tagName.toLowerCase() === name;
    return (direct ? this.children : descendants(this)).filter(matches);
  }
  querySelector(selector: string): ElementNode | null { return this.querySelectorAll(selector)[0] ?? null; }
}
function descendants(node: ElementNode): ElementNode[] { return node.children.flatMap(child => [child, ...descendants(child)]); }
class TestDocument {
  body = new ElementNode('body', this);
  elements: ElementNode[] = [];
  defaultView = {
    getComputedStyle: vi.fn((element: ElementNode) => ({ display: element.style.display ?? 'inline', boxSizing: element.style.boxSizing ?? 'content-box',
      width: element.style.width ?? 'auto', height: element.style.height ?? 'auto',
      paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
      borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px', ...element.style })),
  };
  createElement(tag: string): ElementNode { const result = new ElementNode(tag, this); this.elements.push(result); return result; }
  createTextNode(value: string): TextNode { return new TextNode(value, this); }
}
function fixture(): Widget {
  const w = createWidget('box');
  Object.assign(w, { x: 41.25, y: 17, width: 95.25, height: 27.125, rotation: 90, text: 'First\nSecond',
    shapeText: { autoFitWidth: true, autoFitHeight: true } });
  Object.assign(w.style, { textPadding: [1.25, 2.5, 3.75, 4.5], verticalAlign: 'top',
    fontFamily: 'Open Sans', fontSize: 28, fontWeight: 700, lineHeight: 'normal' });
  return w;
}

function asElement(node: ElementNode): HTMLElement { return node as unknown as HTMLElement; }
function asDocument(document: TestDocument): Document { return document as unknown as Document; }
function liveText(document: TestDocument) {
  const owner = document.createElement('div'), layer = document.createElement('span'), p = document.createElement('span');
  layer.className = 'widget-text'; p.dataset.richParagraph = '0';
  document.body.append(owner); owner.append(layer); layer.append(p);
  return { owner, layer, p };
}
function directRun(document: TestDocument, parent: ElementNode, text: string) {
  const span = document.createElement('span'); span.append(document.createTextNode(text)); parent.append(span); return span;
}
const modes: [string, typeof createShapeTextMeasurer][] = [
  ['module', createShapeTextMeasurer],
  ['serialized', new Script(`(${createShapeTextMeasurer.toString()})`).runInNewContext({}) as typeof createShapeTextMeasurer],
];

describe.each(modes)('%s shared shape-text measurement', (_, factory) => {
  it.each([[false, false], [true, false], [false, true], [true, true]])('only measures enabled axes W=%s H=%s and preserves exact inactive dimensions', (autoFitWidth, autoFitHeight) => {
    const document = new TestDocument(), widget = fixture(), original = JSON.stringify(widget);
    widget.shapeText = { autoFitWidth, autoFitHeight };
    const { owner, layer, p } = liveText(document), run = directRun(document, p, 'First');
    const order: string[] = [];
    const read = vi.fn((element: HTMLElement, axis: 'width' | 'height') => {
      order.push(axis); expect(element).toBe(axis === 'height' ? layer : run); return axis === 'height' ? 23.625 : 52.125;
    });
    const before = JSON.stringify(widget), result = factory(createShapeTextRenderer(), read).measure(widget, asElement(owner), asDocument(document));
    expect(result).toEqual(!autoFitWidth && !autoFitHeight ? undefined : { width: autoFitWidth ? 59.125 : 95.25, height: autoFitHeight ? 28.625 : 27.125 });
    expect(order).toEqual([...(autoFitHeight ? ['height'] : []), ...(autoFitWidth ? ['width'] : [])]);
    expect(JSON.stringify(widget)).toBe(before); expect(JSON.parse(original).width).toBe(widget.width);
    expect(document.body.children).toEqual([owner]); expect(owner.children).toEqual([layer]); expect(p.children).toEqual([run]);
  });

  it('sums only direct spans per paragraph, excludes nested hyperlink text, and takes the maximum paragraph width', () => {
    const document = new TestDocument(), widget = fixture(), { owner, layer, p } = liveText(document);
    const a = directRun(document, p, 'A'), link = document.createElement('a'); p.append(link);
    const linked = directRun(document, link, 'Very long linked text'), b = directRun(document, p, 'B');
    const second = document.createElement('span'); second.dataset.richParagraph = '1'; layer.append(second);
    const c = directRun(document, second, 'Second line');
    const widths = new Map([[a, 20.25], [linked, 900], [b, 10.5], [c, 40.125]]), measured: ElementNode[] = [];
    const helper = factory(createShapeTextRenderer(), (element, axis) => {
      if (axis === 'height') return 36.5;
      measured.push(element as unknown as ElementNode); return widths.get(element as unknown as ElementNode)!;
    });
    expect(helper.measure(widget, asElement(owner), asDocument(document))).toEqual({ width: 47.125, height: 41.5 });
    expect(measured).toEqual([a, b, c]); expect(link.children).toEqual([linked]);
  });

  it('does not construct a copy or touch DOM for unsupported shapes, disabled flags or a missing realm', () => {
    const document = new TestDocument(), read = vi.fn(() => 1), helper = factory(createShapeTextRenderer(), read);
    for (const widget of [createWidget('input'), createWidget('box'), { ...fixture(), shapeText: { autoFitWidth: false, autoFitHeight: false } }]) {
      expect(helper.measure(widget, undefined, asDocument(document))).toBeUndefined();
    }
    expect(helper.measure(fixture(), undefined, { body: document.body, defaultView: null } as unknown as Document)).toBeUndefined();
    expect(helper.measure(fixture(), undefined, { body: null, defaultView: document.defaultView } as unknown as Document)).toBeUndefined();
    expect(read).not.toHaveBeenCalled(); expect(document.elements).toHaveLength(0); expect(document.body.children).toEqual([]);
  });

  it('rejects owners from another realm before reading or changing either document', () => {
    const first = new TestDocument(), second = new TestDocument(), { owner } = liveText(first), read = vi.fn(() => 1);
    expect(() => factory(createShapeTextRenderer(), read).measure(fixture(), asElement(owner), asDocument(second))).toThrow('must share a realm');
    expect(first.body.children).toEqual([owner]); expect(second.body.children).toEqual([]); expect(read).not.toHaveBeenCalled();
  });

  it('makes an isolated hidden copy at the old dimensions without showing or cloning the hidden ancestor', () => {
    const document = new TestDocument(), widget = fixture(), ancestor = document.createElement('section');
    ancestor.style.display = 'none'; ancestor.style.transform = 'rotate(37deg)'; document.body.append(ancestor);
    const { owner, layer } = liveText(document); owner.remove(); ancestor.append(owner); owner.style.display = 'flex';
    const before = JSON.stringify(widget), ownerChildren = [...owner.childNodes], seen: string[] = [];
    const helper = factory(createShapeTextRenderer(), (element, axis) => {
      const measured = element as unknown as ElementNode, containers = document.body.children.filter(node => Object.hasOwn(node.dataset, 'shapeTextMeasure'));
      expect(containers).toHaveLength(1); expect(containers[0].style.visibility).toBe('hidden');
      const copy = containers[0].firstElementChild!;
      expect(copy).not.toBe(owner); expect(copy.style).toMatchObject({ width: '95.25px', height: '27.125px', display: 'block', transform: 'none', fontFamily: 'Open Sans', fontSize: '28px' });
      expect(copy.style.width).toBe('95.25px'); expect(measured.isConnected).toBe(true); expect(measured).not.toBe(layer);
      expect(ancestor.style.display).toBe('none'); expect(owner.style.display).toBe('flex');
      seen.push(axis); return axis === 'height' ? 15.75 : 24.25;
    });
    expect(helper.measure(widget, asElement(owner), asDocument(document), { plainSetter: true })).toEqual({ width: 31.25, height: 20.75 });
    expect(seen).toEqual(['height', 'width']); expect(document.body.children).toEqual([ancestor]); expect(owner.childNodes).toEqual(ownerChildren);
    expect(JSON.stringify(widget)).toBe(before);
  });

  it('safely paints effective rich fonts and direct/link structure in missing-owner copies', () => {
    const document = new TestDocument(), widget = fixture();
    widget.richText = { paragraphs: [{ textAlign: 'right', lineHeightPx: 36, runs: [
      { text: '<script>  first\nnext', style: { fontFamily: 'Roboto', fontSize: 17, fontStyle: 'italic', underline: true } },
      { text: 'linked', linkId: 'example', style: { color: '#123456' } },
    ] }, { runs: [{ text: '' }] }], links: [{ id: 'example', name: 'Example', interactions: [] }] };
    const before = JSON.stringify(widget), order: string[] = [];
    const helper = factory(createShapeTextRenderer(), (element, axis) => {
      const node = element as unknown as ElementNode, container = document.body.children[0], copy = container.firstElementChild!;
      expect(copy.querySelectorAll('script')).toEqual([]); expect(copy.querySelectorAll('a')).toHaveLength(1);
      expect(copy.querySelector('a')!.getAttribute('href')).toBeNull();
      const paragraphs = copy.querySelectorAll('[data-rich-paragraph]');
      expect(paragraphs).toHaveLength(2); expect(paragraphs[0].style).toMatchObject({ textAlign: 'right', lineHeight: '36px' });
      const first = paragraphs[0].firstElementChild!;
      expect(first.style).toMatchObject({ fontFamily: 'Roboto', fontSize: '17px', fontStyle: 'italic', textDecorationLine: 'underline' });
      expect(first.textContent).toBe('<script>\u00a0 firstnext'); expect(first.querySelectorAll('br')).toHaveLength(1);
      expect(paragraphs[1].querySelectorAll('br')).toHaveLength(1);
      order.push(axis); expect(node.isConnected).toBe(true); return axis === 'height' ? 72 : 22;
    });
    expect(helper.measure(widget, undefined, asDocument(document))).toEqual({ width: 29, height: 77 });
    expect(order).toEqual(['height', 'width', 'width']); expect(document.body.children).toEqual([]); expect(JSON.stringify(widget)).toBe(before);
  });

  it.each(['throw', 'NaN', 'Infinity'] as const)('always removes its temporary container after a %s measurement failure', (kind) => {
    const document = new TestDocument(), retained = document.createElement('main'); document.body.append(retained);
    const helper = factory(createShapeTextRenderer(), () => { if (kind === 'throw') throw new Error('reader failed'); return kind === 'NaN' ? NaN : Infinity; });
    expect(() => helper.measure(fixture(), undefined, asDocument(document))).toThrow(kind === 'throw' ? 'reader failed' : 'must be finite');
    expect(document.body.children).toEqual([retained]);
    expect(document.elements.filter(node => Object.hasOwn(node.dataset, 'shapeTextMeasure')).every(node => !node.isConnected)).toBe(true);
  });

  it('retains live nodes and live display state even when measuring them throws', () => {
    const document = new TestDocument(), { owner, layer, p } = liveText(document); directRun(document, p, 'Same');
    const helper = factory(createShapeTextRenderer(), () => { throw new Error('read failed'); });
    expect(() => helper.measure(fixture(), asElement(owner), asDocument(document))).toThrow('read failed');
    expect(document.body.children).toEqual([owner]); expect(owner.firstElementChild).toBe(layer); expect(p.textContent).toBe('Same'); expect(owner.style).toEqual({});
  });

  it('paints plain runtime line breaks safely without initial NBSP or CR/U+2028 conversion, and preserves identical nodes', () => {
    const document = new TestDocument(), run = document.createElement('span'), helper = factory(createShapeTextRenderer());
    helper.paintPlainSetter(asElement(run), '  A\r\n\n<b>\n');
    expect(run.children.map(node => node.tagName)).toEqual(['SPAN', 'BR', 'BR', 'SPAN', 'BR']);
    expect(run.children.filter(node => node.tagName === 'SPAN').map(node => node.textContent)).toEqual(['  A', '<b>']);
    expect(run.querySelectorAll('b')).toEqual([]); const old = [...run.childNodes];
    helper.paintPlainSetter(asElement(run), '  A\r\n\n<b>\n'); expect(run.childNodes.every((node, index) => node === old[index])).toBe(true);
    helper.paintPlainSetter(asElement(run), ' A\rB\u2028C\u2029D  E');
    expect(run.childNodes).toHaveLength(1); expect(run.firstChild?.nodeType).toBe(3); expect(run.textContent).toBe(' A\rB\u2028C\u2029D  E');
    helper.paintPlainSetter(asElement(run), ''); expect(run.childNodes).toEqual([]);
  });

  it('keeps a sole linked setter run inside its link and excludes it from the width sum', () => {
    const document = new TestDocument(), widget = fixture();
    widget.richText = { paragraphs: [{ runs: [{ text: 'New linked text', linkId: 'l', style: { fontSize: 17 } }] }], links: [{ id: 'l', name: 'Link', interactions: [] }] };
    const read = vi.fn((element: HTMLElement, axis: 'width' | 'height') => {
      expect(axis).toBe('height'); expect((element as unknown as ElementNode).querySelector('a')!.textContent).toBe('New linked text'); return 15;
    });
    expect(factory(createShapeTextRenderer(), read).measure(widget, undefined, asDocument(document), { plainSetter: true })).toEqual({ width: 7, height: 20 });
    expect(read).toHaveBeenCalledOnce(); expect(document.body.children).toEqual([]);
  });

  it('measures an empty hidden setter layer through a safe no-BR copy and adds padding without borders', () => {
    const document = new TestDocument(), widget = fixture(), { owner, layer, p } = liveText(document);
    widget.text = ''; widget.style.textPadding = [2.25, 3.75, 2.25, 3.75]; widget.style.strokeWidth = 4;
    layer.style.display = 'none'; layer.style.visibility = 'hidden'; directRun(document, p, '');
    const read = vi.fn((element: HTMLElement, axis: 'width' | 'height') => {
      const measured = element as unknown as ElementNode;
      expect(measured).not.toBe(layer); expect(measured.isConnected).toBe(true);
      const container = document.body.children.find(node => Object.hasOwn(node.dataset, 'shapeTextMeasure'))!;
      expect(container).toBeDefined(); expect(container.querySelectorAll('br')).toEqual([]);
      expect(container.querySelector('[data-rich-run]')!.childNodes).toEqual([]);
      expect(layer.style).toEqual({ display: 'none', visibility: 'hidden' });
      expect(axis === 'height' ? measured.className : measured.dataset.richRun).toBe(axis === 'height' ? 'widget-text' : '0');
      return 0;
    });
    expect(factory(createShapeTextRenderer(), read).measure(widget, asElement(owner), asDocument(document), { plainSetter: true })).toEqual({ width: 7.5, height: 4.5 });
    expect(read.mock.calls.map(([, axis]) => axis)).toEqual(['height', 'width']); expect(document.body.children).toEqual([owner]);
  });

  it('uses computed fractional content sizes, subtracts border-box insets, and falls back to untransformed inline offsets', () => {
    const document = new TestDocument(), widget = fixture(), { owner, layer, p } = liveText(document), run = directRun(document, p, 'x');
    Object.assign(layer.style, { display: 'block', boxSizing: 'border-box', height: '50.5px', paddingTop: '2.25px', paddingBottom: '2.25px', borderTopWidth: '1px', borderBottomWidth: '1px' });
    Object.assign(run.style, { display: 'inline', width: 'auto', paddingLeft: '3.75px', paddingRight: '3.75px', borderLeftWidth: '1px', borderRightWidth: '1px', transform: 'rotate(37deg)' });
    run.offsetWidth = 59;
    const helper = factory(createShapeTextRenderer());
    expect(helper.measure(widget, asElement(owner), asDocument(document))).toEqual({ width: 56.5, height: 49 });
    // Computed inline width wins even though offsetWidth differs; zero inline width uses the offset branch.
    run.style.width = '123.375px'; expect(helper.measure(widget, asElement(owner), asDocument(document))?.width).toBe(130.375);
    run.style.width = '0px'; expect(helper.measure(widget, asElement(owner), asDocument(document))?.width).toBe(56.5);
    Object.assign(run.style, { display: 'inline-block', width: '31.375px', boxSizing: 'border-box' });
    expect(helper.measure(widget, asElement(owner), asDocument(document))?.width).toBe(28.875);
    Object.assign(run.style, { boxSizing: 'content-box' });
    expect(helper.measure(widget, asElement(owner), asDocument(document))?.width).toBe(38.375);
    expect(document.defaultView.getComputedStyle.mock.calls.every(([element]) => element === layer || element === run)).toBe(true);
  });

  it('keeps true zero dimensions instead of replacing them with an offset or a nonzero minimum', () => {
    const document = new TestDocument(), widget = fixture(), { owner, layer, p } = liveText(document), run = directRun(document, p, '');
    widget.style.textPadding = [0, 0, 0, 0];
    Object.assign(layer.style, { display: 'block', height: '0px' }); layer.offsetHeight = 40;
    Object.assign(run.style, { display: 'inline-block', width: '0px' }); run.offsetWidth = 80;
    expect(factory(createShapeTextRenderer()).measure(widget, asElement(owner), asDocument(document))).toEqual({ width: 0, height: 0 });
  });
});

