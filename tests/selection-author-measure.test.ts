import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createWidget } from '../src/model/document';
import { createShapeTextRenderer } from '../src/model/shape-text';
import { planSelectionLayout, type SelectionLayoutInput, type SelectionLayoutServiceContext } from '../src/model/selection-layout';
import { createSelectionAuthorMeasurer } from '../src/runtime/selection-author-measure';
import type { SelectionDisplayLayout, SelectionTextLayout } from '../src/runtime/selection-text-layout';
import type { Widget } from '../src/model/types';

// Connected DOM structure and explicit measurements only, not a font/SVG oracle.
class Text {
  readonly nodeType = 3; readonly nodeName = '#text';
  parentElement: Element | null = null;
  constructor(public textContent: string) {}
}
class Element {
  readonly nodeType = 1; readonly nodeName: string; readonly tagName: string;
  parentElement: Element | null = null; childNodes: (Text | Element)[] = [];
  style: Record<string, string> = {}; dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  constructor(tag: string, readonly ownerDocument: TestDocument) { this.nodeName = this.tagName = tag.toUpperCase(); }
  get children() { return this.childNodes.filter((child): child is Element => child instanceof Element); }
  get isConnected(): boolean { return this === this.ownerDocument.body || !!this.parentElement?.isConnected; }
  get textContent(): string { return this.childNodes.map(child => child.textContent).join(''); }
  append(...nodes: (Text | Element)[]) { for (const node of nodes) { node.parentElement = this; this.childNodes.push(node); } }
  replaceChildren(...nodes: (Text | Element)[]) { this.childNodes = []; this.append(...nodes); }
  remove() {
    if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter(child => child !== this);
    this.parentElement = null;
  }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  set innerHTML(_: string) { throw Error('Literal text must not be parsed as HTML'); }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap(child => [
      ...(selector === '[data-rich-paragraph]' && child.dataset.richParagraph !== undefined ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  getBoundingClientRect() { return { width: 10000, height: this.ownerDocument.height }; }
}
class TestDocument {
  body = new Element('body', this); created: Element[] = []; defaultView = {};
  rangeWidth = 22.625; height = 17.375;
  createElement(tag: string) { const node = new Element(tag, this); this.created.push(node); return node; }
  createTextNode(text: string) { return new Text(text); }
  createRange() {
    return { selectNodeContents: (_node: Element) => {}, getBoundingClientRect: () => ({ width: this.rangeWidth }), detach: vi.fn() };
  }
}
const document = (doc: TestDocument) => doc as unknown as Document;
function widget() {
  const source = createWidget('checkbox');
  Object.assign(source, { text: 'Source', width: 160, height: 30, rotation: 0,
    selectionText: { autoFitWidth: false, autoFitHeight: false, alignRight: false } });
  Object.assign(source.style, { textPadding: [1, 2, 3, 4], selectionButtonSize: 14, verticalAlign: 'middle' });
  return source;
}
const panel: SelectionDisplayLayout = { origin: 'browser-derived',
  panel: { x: 18, y: 0, width: 140, height: 20 }, text: { x: 14, y: 0, width: 146 },
  indicator: { x: 0, y: 3, width: 14, height: 14 } };
function display() {
  return {
    supports: (source: Widget) => source.type === 'checkbox' && source.rotation === 0,
    fontsReady: vi.fn(async (_source: Widget, _document: Document) => {}),
    measure: vi.fn((_source: Widget, _document: Document) => structuredClone(panel)),
  } satisfies Pick<SelectionTextLayout, 'supports' | 'fontsReady' | 'measure'>;
}
function context(fit = false): SelectionLayoutServiceContext {
  return { state: { ownerRect: { x: 0, y: 0, width: 160, height: 30 },
    textPanelRect: { x: 18, y: 0, width: 140, height: 20 },
    locationInDiagram: { x: 0, y: 0 }, rawFit: { width: fit, height: false }, effectiveFit: { width: fit, height: false }, guard: true },
    reenterLayout: () => { throw Error('Measuring must not initiate another transaction'); } };
}
const request = (width: number, pass = 0) => ({ pass, width, flag: true as const, constraint: { width, height: 1 } });
const modes: [string, typeof createSelectionAuthorMeasurer][] = [
  ['module', createSelectionAuthorMeasurer],
  ['serialized', new Script(`(${createSelectionAuthorMeasurer.toString()})`).runInNewContext({ structuredClone }) as typeof createSelectionAuthorMeasurer],
];

describe.each(modes)('%s selection author measurement', (_mode, factory) => {
  it('captures a detached source before font waiting and returns detached panel/source values', async () => {
    const source = widget(), doc = new TestDocument(), layout = display(), before = structuredClone(source);
    source.richText = { paragraphs: [{ runs: [{ text: 'Authored', style: { fontSize: 17 } }] }] };
    const session = factory(createShapeTextRenderer(), layout).prepare(source, document(doc))!;
    source.text = 'Later'; source.richText.paragraphs[0].runs[0].text = 'Later';
    const exposed = session.sourceSnapshot(); exposed.text = 'Mutation'; exposed.style.fontSize = 99;
    await session.fontsReady();
    expect(layout.fontsReady.mock.calls[0][0]).toMatchObject({ text: 'Source', richText: { paragraphs: [{ runs: [{ text: 'Authored' }] }] } });
    const oldPanel = session.capturePanel()!; oldPanel.panel.width = 999;
    expect(session.capturePanel()!.panel.width).toBe(140);
    expect(session.sourceSnapshot().style.fontSize).toBe(before.style.fontSize);
    expect(session.origin).toBe('browser-derived'); expect(doc.created).toEqual([]);
  });
  it('uses each request width and current effective fit, returning raw dimensions without reserved space', () => {
    const doc = new TestDocument(), source = widget(), records: { width: number; whitespace: string }[] = [];
    const session = factory(createShapeTextRenderer(), display(), (node, width) => {
      records.push({ width, whitespace: node.style.whiteSpace });
      return { width: 42.625, height: 18.375 };
    }).prepare(source, document(doc))!;
    const before = structuredClone(source);
    expect(session.measureText(request(87.25), context())).toEqual({ width: 42.625, height: 18.375 });
    expect(session.measureText(request(10000, 1), context(true))).toEqual({ width: 42.625, height: 18.375 });
    expect(records).toEqual([{ width: 87.25, whitespace: 'normal' }, { width: 10000, whitespace: 'nowrap' }]);
    expect(source).toEqual(before); expect(doc.body.children).toEqual([]);
  });
  it('retains rich links, run typography, paragraph alignment/line height, hard breaks and literal HTML', () => {
    const source = widget(), doc = new TestDocument();
    source.richText = { paragraphs: [
      { textAlign: 'right', lineHeightPx: 31, runs: [
        { text: '<b>A</b>\nB', style: { fontSize: 27, fontWeight: 700 } },
        { text: 'Link', linkId: 'one', style: { fontStyle: 'italic', fontFamily: 'Open Sans' } },
      ] }, { runs: [{ text: '' }] },
    ] };
    const session = factory(createShapeTextRenderer(), display(), (node) => {
      const block = node as unknown as Element, paragraphs = block.querySelectorAll('[data-rich-paragraph]');
      expect(block.isConnected).toBe(true); expect(block.style.padding).toBe('0px');
      expect(paragraphs[0].style).toMatchObject({ textAlign: 'right', lineHeight: '31px' });
      expect(paragraphs[0].children.map(child => child.tagName)).toEqual(['SPAN', 'A']);
      expect(paragraphs[0].children[0].style.fontSize).toBe('27px');
      expect(paragraphs[0].children[0].children.map(child => child.tagName)).toEqual(['BR']);
      expect(paragraphs[0].textContent).toContain('<b>A</b>');
      expect(paragraphs[1].children.at(-1)?.tagName).toBe('BR');
      expect(doc.created.some(child => ['INPUT', 'SVG'].includes(child.tagName))).toBe(false);
      return { width: 27.125, height: 51.625 };
    }).prepare(source, document(doc))!;
    expect(session.measureText(request(75), context())).toEqual({ width: 27.125, height: 51.625 });
    expect(doc.body.children).toEqual([]);
  });
  it('reads full paragraph ranges and line-box height without integer rounding in the default adapter', () => {
    const doc = new TestDocument(), session = factory(createShapeTextRenderer(), display()).prepare(widget(), document(doc))!;
    expect(session.measureText(request(10000), context(true))).toEqual({ width: 22.625, height: 17.375 });
    expect(doc.body.children).toEqual([]);
  });
  it('keeps author sources isolated even for matching widget IDs and captures a distinct pre-edit panel', async () => {
    const doc = new TestDocument(), source = widget(), next = structuredClone(source), seen: string[] = [];
    next.text = 'Edited'; const layout = display();
    const helper = factory(createShapeTextRenderer(), layout, node => {
      seen.push(node.textContent!); return { width: 20.25, height: 18.5 };
    });
    const oldSession = helper.prepare(source, document(doc))!, nextSession = helper.prepare(next, document(doc))!;
    await oldSession.fontsReady(); oldSession.capturePanel();
    nextSession.measureText(request(80), context()); oldSession.measureText(request(80), context());
    expect(seen).toEqual(['Edited', 'Source']); expect(layout.measure.mock.calls[0][0].text).toBe('Source');
  });
  it('requires successful font readiness before capturing the old author panel', async () => {
    const doc = new TestDocument(), layout = display();
    let finish!: () => void;
    layout.fontsReady.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const session = factory(createShapeTextRenderer(), layout).prepare(widget(), document(doc))!;
    expect(() => session.capturePanel()).toThrow(/font|ready/i);
    const ready = session.fontsReady();
    expect(() => session.capturePanel()).toThrow(/font|ready/i); expect(layout.measure).not.toHaveBeenCalled();
    await Promise.resolve();
    finish(); await ready; expect(session.capturePanel()!.origin).toBe('browser-derived');
  });
  it('cleans temporary nodes on paint/read failure and rejects nonfinite/negative measured content', () => {
    const doc = new TestDocument();
    const session = factory(createShapeTextRenderer(), display(), () => { throw Error('measure failure'); }).prepare(widget(), document(doc))!;
    expect(() => session.measureText(request(80), context())).toThrow('measure failure');
    expect(doc.body.children).toEqual([]);
    const badPaint = factory({ paint: () => { throw Error('paint failure'); } }, display()).prepare(widget(), document(doc))!;
    expect(() => badPaint.measureText(request(80), context())).toThrow('paint failure');
    expect(doc.body.children).toEqual([]);
    for (const width of [-1, Infinity, NaN]) {
      const invalid = factory(createShapeTextRenderer(), display(), () => ({ width, height: 1 })).prepare(widget(), document(doc))!;
      expect(() => invalid.measureText(request(80), context())).toThrow(); expect(doc.body.children).toEqual([]);
    }
  });
  it('rejects invalid request widths before DOM creation and excessive width-fit content after cleanup', () => {
    const doc = new TestDocument(), session = factory(createShapeTextRenderer(), display(),
      () => ({ width: 10000.25, height: 12 })).prepare(widget(), document(doc))!;
    for (const width of [-1, NaN, Infinity]) expect(() => session.measureText(request(width), context())).toThrow();
    expect(doc.created).toEqual([]);
    expect(() => session.measureText(request(10000), context(true))).toThrow(/10000/);
    expect(doc.body.children).toEqual([]);
  });
  it('rejects unsupported source/missing DOM realm and propagates font-loading errors without writes', async () => {
    const source = widget(), doc = new TestDocument(), layout = display(), helper = factory(createShapeTextRenderer(), layout);
    expect(helper.prepare({ ...source, rotation: 37 }, document(doc))).toBeUndefined();
    const session = helper.prepare(source, document(doc))!;
    layout.fontsReady.mockRejectedValueOnce(Error('fonts unavailable'));
    await expect(session.fontsReady()).rejects.toThrow('fonts unavailable');
    (doc as unknown as { defaultView: unknown }).defaultView = null;
    expect(() => session.measureText(request(100), context())).toThrow(/document|realm/);
    expect(doc.created).toEqual([]);
  });
  it('feeds separate raw passes to the real planner, whose rounding remains authoritative and atomic', () => {
    const doc = new TestDocument(), source = widget(), widths: number[] = [];
    source.selectionText!.autoFitWidth = true;
    const session = factory(createShapeTextRenderer(), display(), (_node, width) => {
      widths.push(width); return widths.length === 1 ? { width: 42.5, height: 18.5 } : { width: 62.5, height: 20.5 };
    }).prepare(source, document(doc))!;
    const input: SelectionLayoutInput = {
      ownerRect: { x: 10, y: 20, width: 100, height: 30 }, textPanelRect: { x: 18, y: 0, width: 80, height: 20 },
      coordinateContext: { kind: 'translation', locationInDiagram: { x: 10, y: 20 }, ownerRotation: 0, textRotation: 0 },
      rawFit: { width: true, height: false }, effectiveFit: { width: true, height: false },
      alignRight: false, empty: false, guard: false, padding: [1, 2, 3, 4], indicatorSize: 14,
      horizontalAlignment: 'left', verticalAlignment: 'top',
    };
    const before = structuredClone(input);
    const result = planSelectionLayout(input, { kind: 'layout', recalculateFit: true }, {
      measureText: session.measureText, readMinimumSize: () => ({ width: 0, height: 0 }),
      convertIndicatorInset: () => ({ width: 2, height: 2 }),
      unionRectangles: (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
        height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) }),
    });
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.reason);
    expect(widths).toEqual([10000, 10000]);
    expect(result.effects.filter(effect => effect.name === 'panel.measured')).toEqual([
      { name: 'panel.measured', width: 43, height: 19 }, { name: 'panel.measured', width: 63, height: 21 },
    ]);
    expect(result.state.textPanelRect).toMatchObject({ width: 63, height: 21 });
    expect(input).toEqual(before); expect(doc.body.children).toEqual([]);
  });
});
