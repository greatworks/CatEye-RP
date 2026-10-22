import { Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createWidget } from '../src/model/document';
import { createSelectionDisplay } from '../src/runtime/selection-display';
import type { SelectionDisplayLayout, SelectionTextLayout } from '../src/runtime/selection-text-layout';
import type { Widget } from '../src/model/types';
import type { SelectionIndicatorPaint } from '../src/model/selection-indicator';

// Host lifecycle only. This DOM/painter facade does not test fonts or SVG pixels.
class Element {
  parentElement: Element | null = null;
  children: Element[] = [];
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  textContent = '';
  constructor(readonly tagName: string, readonly ownerDocument: TestDocument) {}
  get isConnected(): boolean { return this === this.ownerDocument.body || !!this.parentElement?.isConnected; }
  append(...nodes: Element[]) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  prepend(node: Element) { node.parentElement = this; this.children.unshift(node); }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  querySelector(selector: string): Element | null {
    if (selector === ':scope > svg[data-selection-indicator]')
      return this.children.find(child => child.tagName === 'svg' && child.dataset.selectionIndicator !== undefined) ?? null;
    throw Error(`Unexpected selector ${selector}`);
  }
}
class TestDocument {
  body = new Element('body', this);
  createElementNS(_namespace: string, tag: string) { return new Element(tag, this); }
}
function nodes(document = new TestDocument()) {
  const owner = new Element('div', document), label = new Element('label', document);
  const text = new Element('span', document), input = new Element('input', document);
  Object.assign(owner.style, { left: '31px', top: '47px', width: '160px', height: '30px', transform: 'rotate(0deg)' });
  text.textContent = 'Live text'; document.body.append(owner); owner.append(label); label.append(input, text);
  return { document, owner, label, text, input };
}
const labelNode = (node: Element) => node as unknown as HTMLLabelElement;
const textNode = (node: Element) => node as unknown as HTMLElement;
const inputNode = (node: Element) => node as unknown as HTMLInputElement;
function widget() {
  const result = createWidget('checkbox', 31, 47);
  Object.assign(result, { width: 160, height: 30, text: 'Authored',
    selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false } });
  Object.assign(result.style, { selectionButtonSize: 14, textPadding: [1, 2, 3, 4], verticalAlign: 'middle' });
  return result;
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const turn = async () => { await Promise.resolve(); await Promise.resolve(); };
const modes: [string, typeof createSelectionDisplay][] = [
  ['module', createSelectionDisplay],
  ['serialized', new Script(`(${createSelectionDisplay.toString()})`).runInNewContext({}) as typeof createSelectionDisplay],
];
function harness(factory: typeof createSelectionDisplay) {
  const requests: ReturnType<typeof deferred>[] = [];
  const supports = vi.fn((source: Widget) => source.rotation === 0 && !!source.selectionText);
  const measure = vi.fn((source: Widget): SelectionDisplayLayout | undefined => ({
    origin: 'browser-derived',
    panel: { x: 18, y: 2, width: source.text.length * 10, height: 22 },
    text: { x: 14, y: 2, width: source.text.length * 10 + 6 },
    indicator: { x: 0, y: 4, width: 14, height: 14 },
  }));
  const fontsReady = vi.fn((_source: Widget, _document: Document) => {
    const request = deferred(); requests.push(request); return request.promise;
  });
  const paint = vi.fn((svg: SVGSVGElement, source: Widget, current: Widget, _rect: unknown, _paint?: SelectionIndicatorPaint) => {
    svg.setAttribute('data-test-source', source.text);
    svg.setAttribute('data-test-current', current.text);
  });
  const layout = { supports, measure, fontsReady, project: vi.fn() } as SelectionTextLayout;
  const host = factory(layout, { supports: () => true, paint });
  const update = (dom: ReturnType<typeof nodes>, source: Widget, current = source, paint?: SelectionIndicatorPaint | null) =>
    host.update(labelNode(dom.label), textNode(dom.text), inputNode(dom.input), source, current, paint);
  return { host, update, requests, measure, fontsReady, paint };
}

describe.each(modes)('%s selection display host', (_mode, factory) => {
  it('keeps an unsupported runtime cascade on fallback even when the author source is supported', async () => {
    const h = harness(factory), dom = nodes(), source = widget();
    h.update(dom, source); const count = h.paint.mock.calls.length;
    expect(h.host.supports(source, null)).toBe(false);
    expect(h.update(dom, source, source, null)).toBe(false);
    h.requests[0].resolve(); await turn();
    expect(h.paint).toHaveBeenCalledTimes(count);
    expect(dom.label.dataset.selectionDisplay).toBe('fallback'); expect(dom.input.style.opacity).toBe('1');
  });
  it('forwards the latest immutable runtime paint through cache hits and late font measurement', async () => {
    const h = harness(factory), dom = nodes(), source = widget();
    const first: SelectionIndicatorPaint = Object.freeze({ assetSize: 14, assetStrokeWidth: 1, fill: '#ffffff', stroke: '#123456', outlineWidth: 3,
      markFill: '#123456', markStroke: '#123456', markWidth: 3, svgScaleX: 2, svgScaleY: 3, svgTransformOrigin: 'top left' });
    const next: SelectionIndicatorPaint = Object.freeze({ ...first, fill: 'transparent', stroke: '#654321', markFill: '#654321', markStroke: '#654321',
      svgScaleX: 6, svgScaleY: 9 });
    h.update(dom, source, source, first);
    expect(h.paint.mock.calls.at(-1)?.[4]).toBe(first);
    h.update(dom, source, source, next);
    h.requests[0].resolve(); await turn();
    expect(h.paint.mock.calls.at(-1)?.[4]).toBe(next);
    expect(h.paint.mock.calls.at(-1)?.[4]).toMatchObject({ svgScaleX: 6, svgScaleY: 9, svgTransformOrigin: 'top left' });
    expect(first.svgScaleX).toBe(2); expect(next.svgScaleX).toBe(6);
    expect(h.measure).toHaveBeenCalledTimes(2); expect(h.fontsReady).toHaveBeenCalledOnce();
    h.update(dom, source);
    expect(h.paint.mock.calls.at(-1)?.[4]).toBeUndefined();
  });
  it('applies transient child geometry without committing owner/model geometry or replacing live text', () => {
    const h = harness(factory), dom = nodes(), source = widget(), current = { ...source, text: 'Runtime' };
    const original = structuredClone(source), ownerBefore = { ...dom.owner.style };
    expect(h.update(dom, source, current)).toBe(true);
    expect(dom.label.dataset.selectionDisplay).toBe('browser-derived');
    expect(dom.text.style).toMatchObject({ left: '14px', top: '2px', width: '86px', height: '', padding: '1px 2px 3px 4px' });
    expect(dom.input.style).toMatchObject({ width: '0px', height: '0px', opacity: '0' });
    expect(dom.text.textContent).toBe('Live text');
    for (const key of ['left', 'top', 'width', 'height', 'transform']) expect(dom.owner.style[key]).toBe(ownerBefore[key]);
    expect(source).toEqual(original); expect(h.measure.mock.calls[0][0]).toBe(source);
  });
  it('refreshes current paint while retaining authored cache and latest child nodes during font readiness', async () => {
    const h = harness(factory), dom = nodes(), source = widget();
    h.update(dom, source);
    const replacement = new Element('span', dom.document), replacementInput = new Element('input', dom.document);
    replacement.textContent = 'Changed by SetText'; dom.text.remove(); dom.input.remove();
    dom.label.append(replacementInput, replacement);
    const current = { ...source, text: 'Runtime text', checked: true, width: 777 };
    h.update({ ...dom, text: replacement, input: replacementInput }, structuredClone(source), current);
    expect(h.measure).toHaveBeenCalledOnce(); expect(h.fontsReady).toHaveBeenCalledOnce();
    h.requests[0].resolve(); await turn();
    expect(h.measure).toHaveBeenCalledTimes(2);
    expect(h.measure.mock.calls.every(([sample]) => sample.text === 'Authored' && sample.width === 160)).toBe(true);
    expect(h.paint.mock.calls.at(-1)?.[2]).toBe(current);
    expect(replacement.textContent).toBe('Changed by SetText'); expect(replacement.style.width).toBe('86px');
  });
  it('rejects a stale font completion after a different author declaration becomes current', async () => {
    const h = harness(factory), dom = nodes(), source = widget();
    h.update(dom, source);
    const next = structuredClone(source); next.text = 'Next'; h.update(dom, next);
    h.requests[0].resolve(); await turn();
    expect(h.measure).toHaveBeenCalledTimes(2); expect(dom.text.style.width).toBe('46px');
    h.requests[1].resolve(); await turn();
    expect(h.measure).toHaveBeenCalledTimes(3); expect(h.measure.mock.calls.at(-1)?.[0]).toBe(next);
    expect(dom.label.dataset.selectionFonts).toBe('ready');
  });
  it('keeps simultaneous labels isolated even when their source widget IDs match', async () => {
    const h = harness(factory), first = nodes(), second = nodes(first.document), source = widget();
    const other = structuredClone(source); other.text = 'Other';
    h.update(first, source); h.update(second, other);
    h.requests[1].resolve(); await turn();
    expect(first.label.dataset.selectionFonts).not.toBe('ready'); expect(second.label.dataset.selectionFonts).toBe('ready');
    expect(first.text.style.width).toBe('86px'); expect(second.text.style.width).toBe('56px');
    h.requests[0].resolve(); await turn();
    expect(h.paint.mock.calls.at(-1)?.[0].ownerDocument).toBe(first.document);
    expect(first.text.style.width).toBe('86px'); expect(second.text.style.width).toBe('56px');
  });
  it('does not remeasure or paint detached labels on late font resolution', async () => {
    const h = harness(factory), dom = nodes(); h.update(dom, widget()); dom.owner.remove();
    h.requests[0].resolve(); await turn();
    expect(h.measure).toHaveBeenCalledOnce(); expect(h.paint).toHaveBeenCalledOnce();
  });
  it('retains a usable initial layout when font loading rejects', async () => {
    const h = harness(factory), dom = nodes(); h.update(dom, widget());
    h.requests[0].reject(Error('Font unavailable')); await turn();
    expect(dom.label.dataset.selectionFonts).toBe('fallback');
    expect(dom.label.dataset.selectionDisplayError).toContain('Font unavailable');
    expect(dom.label.dataset.selectionDisplay).toBe('browser-derived');
    expect(dom.text.style.width).toBe('86px'); expect(h.paint).toHaveBeenCalledOnce();
  });
  it('retains the last usable layout when the post-font measurement rejects', async () => {
    const h = harness(factory), dom = nodes(); h.update(dom, widget());
    h.measure.mockImplementationOnce(() => { throw Error('Too wide'); });
    h.requests[0].resolve(); await turn();
    expect(dom.label.dataset.selectionFonts).toBe('fallback'); expect(dom.text.style.width).toBe('86px');
    expect(dom.label.dataset.selectionDisplayError).toContain('Too wide');
  });
  it('uses native-input fallback after an initial measurement error and recovers on a subsequent update', () => {
    const h = harness(factory), dom = nodes(), source = widget(), before = structuredClone(source);
    h.measure.mockImplementationOnce(() => { throw Error('Invalid content'); });
    expect(h.update(dom, source)).toBe(false);
    expect(dom.label.dataset.selectionDisplay).toBe('fallback'); expect(dom.input.style.opacity).toBe('1');
    expect(dom.input.style.width).toBe(''); expect(dom.label.querySelector(':scope > svg[data-selection-indicator]')).toBeNull();
    expect(h.update(dom, source)).toBe(true); expect(dom.label.dataset.selectionDisplayError).toBeUndefined();
    expect(source).toEqual(before);
  });
  it('cancels an older font completion after a newer measurement fails', async () => {
    const h = harness(factory), dom = nodes(), source = widget(); h.update(dom, source);
    const next = { ...source, text: 'Bad' }; h.measure.mockImplementationOnce(() => { throw Error('Bad source'); });
    expect(h.update(dom, next)).toBe(false); const paints = h.paint.mock.calls.length;
    h.requests[0].resolve(); await turn();
    expect(h.paint).toHaveBeenCalledTimes(paints); expect(dom.label.dataset.selectionDisplay).toBe('fallback');
  });
  it('invalidates a pending display when the same label changes to unsupported geometry', async () => {
    const h = harness(factory), dom = nodes(), source = widget(); h.update(dom, source);
    expect(h.update(dom, { ...source, rotation: 37 })).toBe(false);
    const paints = h.paint.mock.calls.length, measurements = h.measure.mock.calls.length;
    h.requests[0].resolve(); await turn();
    expect(h.paint).toHaveBeenCalledTimes(paints); expect(h.measure).toHaveBeenCalledTimes(measurements);
  });
  it('invalidates older font work when a newer supported declaration returns no measurement', async () => {
    const h = harness(factory), dom = nodes(), source = widget(); h.update(dom, source);
    h.measure.mockReturnValueOnce(undefined);
    expect(h.update(dom, { ...source, text: 'No result' })).toBe(false);
    const paints = h.paint.mock.calls.length;
    h.requests[0].resolve(); await turn();
    expect(h.paint).toHaveBeenCalledTimes(paints);
  });
  it('handles painter failure on a cache hit through the same fallback as first paint', () => {
    const h = harness(factory), dom = nodes(), source = widget(); h.update(dom, source);
    h.paint.mockImplementationOnce(() => { throw Error('Painter failed'); });
    expect(() => h.update(dom, source, { ...source, selected: true })).not.toThrow();
    expect(dom.label.dataset.selectionDisplay).toBe('fallback'); expect(dom.input.style.opacity).toBe('1');
    expect(dom.label.querySelector(':scope > svg[data-selection-indicator]')).toBeNull();
  });
});
