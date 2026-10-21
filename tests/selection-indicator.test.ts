import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createWidget } from '../src/model/document';
import { createSelectionIndicatorRenderer, type SelectionIndicatorPaint } from '../src/model/selection-indicator';
import type { Widget } from '../src/model/types';

// Independent retained-source outputs, not regenerated with the product helper.
// The source replay used declared graphics sinks; these tests do not assert
// vendor rasterization, theme colors, cap/join pixels or a native asset crop box.
type Point = { x: number; y: number };
type Segment = { kind: 'line' | 'cubic'; a: Point; b: Point; c1?: Point; c2?: Point };
type Rect = Point & { width: number; height: number };
type BorderCase = {
  input: { shape: number; b: number; width: number }; passed: boolean;
  actual: {
    strokeRect?: Rect; strokeInset?: number; fillInset?: number;
    segments?: Segment[] | null; fillSegments?: Segment[] | null;
    template?: Point[]; fillPath?: Segment[]; strokePath?: Segment[];
  };
};
type GlyphCase = {
  input: { kind: 'checkbox' | 'radio'; b: number; height: number; x: number; y: number; disabled: boolean };
  passed: boolean;
  actual: { kind: string; pen?: { width: number }; points?: Point[];
    paths?: { ellipses: Rect[] }[] }[];
};
const borderFile = 'research/selection-layout-border-geometry-probes.json';
const glyphFile = 'research/selection-layout-indicator-glyph-probes.json';
const borderBytes = readFileSync(borderFile), glyphBytes = readFileSync(glyphFile);
const border = JSON.parse(borderBytes.toString()) as { passed: number; failed: number; results: BorderCase[] };
const glyph = JSON.parse(glyphBytes.toString()) as { summary: { total: number; passed: number; failed: number }; results: GlyphCase[] };
type SolidColor = { red: number; green: number; blue: number; alpha: number };
const paintBytes = readFileSync('research/selection-paint-glyph-probes.json');
const solidPaint = JSON.parse(paintBytes.toString()) as { summary: { total: number; passed: number; failed: number }; results: {
  input: { kind: 'checkbox' | 'radio'; b: number; disabled: boolean; alpha: number | null };
  actual: { pen?: { color: SolidColor; width: number }; brush?: { color: SolidColor } }[]; passed: boolean;
}[] };
const template = border.results.find(record => record.actual.template)!.actual.template!;
const runtimePaintBytes = readFileSync('research/selection-paint-runtime-probes-second.json');
type ObservedPaint = { attributes: Record<string, string>; computed: { fill: string; stroke: string; strokeWidth: string; display: string } };
const runtimePaint = JSON.parse(runtimePaintBytes.toString()) as { results: {
  input: { type: 'checkbox' | 'radioButton'; initialWidth: number };
  actual: { name: string; fill: ObservedPaint; outline: ObservedPaint; mark: ObservedPaint }[];
}[] };
type BodyCase = {
  input: { type: 'checkbox' | 'radio'; b: number; width: number; alpha: number; origin: number[] };
  elements: { tag: string; attrs: Record<string, string> }[];
  matrix: { path: number[]; outer: number[]; net: number[] };
};
const bodyBytes = readFileSync('research/selection-svg-body-paint-probes-final.json');
const body = JSON.parse(bodyBytes.toString()) as { cases: number; elements: number; results: BodyCase[] };
const modes: [string, typeof createSelectionIndicatorRenderer][] = [
  ['module', createSelectionIndicatorRenderer],
  ['serialized', new Script(`(${createSelectionIndicatorRenderer.toString()})`).runInNewContext({}) as typeof createSelectionIndicatorRenderer],
];

// Minimal SVG attribute/identity sink, without browser layout or CSS behavior.
class SvgNode {
  readonly attrs = new Map<string, string>(); readonly children: SvgNode[] = [];
  readonly style: Record<string, string> = {}; parent?: SvgNode;
  constructor(readonly tagName: string, readonly ownerDocument: SvgDocument) {}
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  removeAttribute(name: string) { this.attrs.delete(name); }
  querySelector(selector: string): SvgNode | null {
    const key = selector.match(/^\[([^\]]+)\]$/)?.[1];
    if (!key) throw Error(`Unexpected test selector ${selector}`);
    return this.children.find(child => child.attrs.has(key)) ?? null;
  }
  append(node: SvgNode) { node.parent = this; this.children.push(node); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
}
class SvgDocument {
  createElementNS(namespace: string, tag: string) {
    expect(namespace).toBe('http://www.w3.org/2000/svg'); return new SvgNode(tag, this);
  }
}
const svgElement = (node: SvgNode) => node as unknown as SVGSVGElement;
const svg = () => new SvgNode('svg', new SvgDocument());
const child = (node: SvgNode, kind: string) => {
  const result = node.querySelector(`[data-selection-${kind}]`); expect(result).not.toBeNull(); return result!;
};
function fixture(type: 'checkbox' | 'radio' = 'checkbox', b = 14, strokeWidth = 1): Widget {
  const widget = createWidget(type);
  widget.rotation = 0;
  Object.assign(widget.style, { radius: 0, selectionButtonSize: b, strokeWidth, fill: '#ffffff', stroke: '#123456' });
  delete widget.style.cornerRadii; delete widget.style.borderWidths;
  return widget;
}
function point(actual: Point, expected: Point) {
  expect(actual.x).toBeCloseTo(expected.x, 10); expect(actual.y).toBeCloseTo(expected.y, 10);
}
function segments(actual: Segment[], expected: Segment[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((segment, index) => {
    const want = expected[index]; expect(segment.kind).toBe(want.kind);
    point(segment.a, want.a); point(segment.b, want.b);
    if (want.kind === 'cubic') { point(segment.c1!, want.c1!); point(segment.c2!, want.c2!); }
  });
}
function parsePath(data: string | null): Segment[] {
  expect(data).not.toBeNull();
  const tokens = data!.match(/[MLCZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)!;
  const result: Segment[] = []; let at = 0, cursor: Point | undefined, start: Point | undefined;
  const next = (): Point => ({ x: Number(tokens[at++]), y: Number(tokens[at++]) });
  while (at < tokens.length) {
    const command = tokens[at++];
    if (command === 'M') cursor = start = next();
    else if (command === 'L') { const b = next(); result.push({ kind: 'line', a: cursor!, b }); cursor = b; }
    else if (command === 'C') {
      const c1 = next(), c2 = next(), b = next(); result.push({ kind: 'cubic', a: cursor!, c1, c2, b }); cursor = b;
    } else if (command === 'Z') {
      if (cursor!.x !== start!.x || cursor!.y !== start!.y) result.push({ kind: 'line', a: cursor!, b: start! });
      cursor = start;
    } else throw Error(`Unexpected path command ${command}`);
  }
  return result;
}
function ellipseFromSourceTemplate(rectangle: Rect): Segment[] {
  const scaled = template.map(p => ({ x: rectangle.x + p.x * rectangle.width, y: rectangle.y + p.y * rectangle.height }));
  return [0, 3, 6, 9].map(index => ({ kind: 'cubic', a: scaled[index], c1: scaled[index + 1],
    c2: scaled[index + 2], b: scaled[(index + 3) % 12] }));
}

it('pins the independent retained-source oracle bytes and complete passing matrices', () => {
  expect(createHash('sha256').update(borderBytes).digest('hex')).toBe('73c51956fdf08edc054c39139aba8da17eb7130d8afa945ed62dfb58a94444c6');
  expect(createHash('sha256').update(glyphBytes).digest('hex')).toBe('3abef9322455e3d0e32c6e40cddac26fe908cd92d788974325fb083c91b541a8');
  expect(border.results).toHaveLength(45); expect(border.passed).toBe(45); expect(border.failed).toBe(0);
  expect(glyph.summary).toEqual({ total: 56, passed: 56, failed: 0 });
  expect([...border.results, ...glyph.results].every(record => record.passed)).toBe(true);
  expect(createHash('sha256').update(paintBytes).digest('hex')).toBe('4575c911e1f6e3e74864b5a176343c57709d63d39ac700e8546162cd9462cf9f');
  expect(solidPaint.summary).toEqual({ total: 40, passed: 40, failed: 0 });
  expect(solidPaint.results.every(record => record.passed)).toBe(true);
  expect(createHash('sha256').update(bodyBytes).digest('hex')).toBe('16ec2e316b91990629ee97aa043cbd3f88f9e195a1038ecfb780a382e017438c');
  expect(body.cases).toBe(20); expect(body.elements).toBe(60); expect(body.results).toHaveLength(20);
});

describe.each(modes)('%s selection indicator', (_name, factory) => {
  it.each(body.results.map((record, index) => ({ ...record, index })))('matches the final retained body geometry and initial paint $index', record => {
    const source = fixture(record.input.type, record.input.b, record.input.width), owner = svg();
    source.checked = true;
    Object.assign(source.style, { fill: `rgba(255, 255, 255, ${record.input.alpha})`, stroke: `rgba(18, 52, 86, ${record.input.alpha})` });
    factory().paint(svgElement(owner), source, source, { x: 9, y: 11, width: record.input.b, height: record.input.b });
    expect(record.elements).toHaveLength(3);
    expect(record.matrix.net).toEqual([1, 0, 0, 1, 0, 0]);
    for (const [index, name] of ['fill', 'outline', 'mark'].entries()) {
      const node = child(owner, name), expected = record.elements[index].attrs;
      let actualSegments: Segment[];
      if (node.tagName === 'polyline') {
        const points = node.getAttribute('points')!.split(' ').map(pair => {
          const [x, y] = pair.split(',').map(Number); return { x, y };
        });
        actualSegments = points.slice(1).map((b, at) => ({ kind: 'line', a: points[at], b }));
      } else actualSegments = parsePath(node.getAttribute('d'));
      const nativeSegments = parsePath(expected.d);
      if (name === 'mark' && source.type === 'radio') {
        // Native r57L starts at bottom-mid and closes geometrically without Z.
        // Keep its open subpath: a later runtime stroke must not introduce an
        // extra closing join, even when the initial fill has the same outline.
        expect(nativeSegments).toHaveLength(4); expect(actualSegments).toHaveLength(4);
        point(nativeSegments.at(-1)!.b, nativeSegments[0].a);
        expect(/Z\s*$/i.test(node.getAttribute('d')!)).toBe(false);
        segments(actualSegments, nativeSegments);
      } else segments(actualSegments, nativeSegments);
      expect(node.getAttribute('fill')).toBe(expected.fill);
      expect(node.getAttribute('stroke')).toBe(expected.stroke);
      if (expected['stroke-width'] === undefined) expect(node.getAttribute('stroke-width')).toBeNull();
      else expect(Number(node.getAttribute('stroke-width'))).toBeCloseTo(Number(expected['stroke-width']), 10);
      // The writer's path and wrapper matrices cancel; no crop compensation
      // belongs on these local product paths.
      expect(node.getAttribute('transform')).toBeNull();
    }
  });
  it('projects an adaptive SVG matrix without compounding it on render, and clears it for a fresh asset', () => {
    const renderer = factory(), source = fixture('radio'), current = structuredClone(source), owner = svg();
    const paint: SelectionIndicatorPaint = { assetSize: 14, assetStrokeWidth: 1, fill: '#ffffff', stroke: '#123456', outlineWidth: 1,
      markFill: '#123456', markStroke: '#123456', markWidth: 1,
      svgScaleX: 2, svgScaleY: 3, svgTransformOrigin: 'top left' };
    const rect = { x: 7, y: 9, width: 28, height: 28 };
    renderer.paint(svgElement(owner), source, current, rect, paint);
    expect(owner.style.transform).toBe('scale(2, 3)'); expect(owner.style.transformOrigin).toBe('top left');
    const paths = owner.children.map(child => child.getAttribute('d'));
    renderer.paint(svgElement(owner), source, current, rect, paint);
    expect(owner.style.transform).toBe('scale(2, 3)');
    expect(owner.children.map(child => child.getAttribute('d'))).toEqual(paths);
    expect(owner.style.left).toBe('7px'); expect(owner.style.top).toBe('9px');
    expect(owner.getAttribute('width')).toBeNull(); expect(owner.style.width).toBe('15px');
    paint.svgScaleX = 0; paint.svgScaleY = 18;
    renderer.paint(svgElement(owner), source, current, rect, paint);
    expect(owner.style.transform).toBe('scale(0, 18)');
    delete paint.svgScaleX; delete paint.svgScaleY;
    renderer.paint(svgElement(owner), source, current, rect, paint);
    expect(owner.style.transform).toBe(''); expect(owner.style.transformOrigin).toBe('top left');
    renderer.paint(svgElement(owner), source, current, rect);
    expect(owner.style.transform).toBe(''); expect(owner.style.transformOrigin).toBe('');
  });
  it('rejects incomplete or non-finite adaptive matrix snapshots before mutating SVG', () => {
    const renderer = factory(), source = fixture(), owner = svg();
    const paint: SelectionIndicatorPaint = { assetSize: 14, assetStrokeWidth: 1, fill: '#ffffff', stroke: '#123456', outlineWidth: 1,
      markFill: 'none', markStroke: '#123456', markWidth: 3 };
    for (const patch of [{ svgScaleX: 2 }, { svgScaleY: 3 }, { svgScaleX: Infinity, svgScaleY: 2 }, { svgScaleX: 2, svgScaleY: NaN }]) {
      const invalid = { ...paint, ...patch };
      expect(renderer.supports(source, invalid)).toBe(false);
      expect(() => renderer.paint(svgElement(owner), source, source, { x: 0, y: 0, width: 14, height: 14 }, invalid)).toThrow(/Unsupported/);
      expect(owner.children).toHaveLength(0); expect(owner.attrs.size).toBe(0);
    }
  });
  it('admits a runtime no-line cascade while rejecting invalid snapshots before any SVG write', () => {
    const renderer = factory(), source = fixture('radio'), current = structuredClone(source), owner = svg();
    const paint: SelectionIndicatorPaint = { assetSize: 14, assetStrokeWidth: 1, fill: '#ffffff', stroke: '#123456', outlineWidth: 0,
      markFill: '#123456', markStroke: '#123456', markWidth: 0 };
    current.style.linePattern = 'none'; current.style.strokeWidth = 20;
    expect(renderer.supports(current)).toBe(false); expect(renderer.supports(current, paint)).toBe(true);
    for (const invalid of [{ ...paint, assetSize: 0 }, { ...paint, outlineWidth: NaN }, { ...paint, markWidth: -1 }, { ...paint, fill: 'currentColor' }]) {
      expect(renderer.supports(source, invalid)).toBe(false);
      expect(() => renderer.paint(svgElement(owner), source, current, { x: 0, y: 0, width: 14, height: 14 }, invalid)).toThrow(/Unsupported/);
      expect(owner.children).toHaveLength(0); expect(owner.attrs.size).toBe(0);
    }
    renderer.paint(svgElement(owner), source, current, { x: 0, y: 0, width: 14, height: 14 }, paint);
    expect(child(owner, 'outline').getAttribute('stroke-width')).toBe('0');
    expect(child(owner, 'mark').getAttribute('stroke-width')).toBe('0');
  });
  it.each(runtimePaint.results.map((record, index) => ({ ...record, index })))('renders retained runtime paint sequence $index without inferring extra events', record => {
    expect(createHash('sha256').update(runtimePaintBytes).digest('hex')).toBe('de082960709b96f57b39603d761b90fec00580bdf5109fbda8a797a5dcd9b384');
    const renderer = factory(), owner = svg(), source = fixture(record.input.type === 'radioButton' ? 'radio' : 'checkbox', 14, record.input.initialWidth);
    // The current declaration deliberately differs from the retained asset.
    // A runtime state/adaptive change may update paint without recreating paths.
    source.style.selectionButtonSize = 28; source.style.strokeWidth = 4;
    const current = structuredClone(source);
    let children: SvgNode[] | undefined, paths: (string | null)[] | undefined;
    for (const observed of record.actual) {
      const paint: SelectionIndicatorPaint = {
        assetSize: 14, assetStrokeWidth: record.input.initialWidth,
        fill: observed.fill.computed.fill, stroke: observed.outline.computed.stroke,
        outlineWidth: Number.parseFloat(observed.outline.computed.strokeWidth),
        markFill: observed.mark.computed.fill, markStroke: observed.mark.computed.stroke,
        markWidth: observed.mark.attributes['stroke-width'] === undefined ? undefined : Number.parseFloat(observed.mark.computed.strokeWidth),
      };
      current.selected = observed.mark.computed.display !== 'none';
      const before = structuredClone(paint);
      renderer.paint(svgElement(owner), source, current, { x: 7, y: 9, width: 28, height: 28 }, paint);
      expect(paint).toEqual(before);
      expect(owner.getAttribute('viewBox')).toBeNull();
      expect(owner.style.width).toBe('33px');
      expect(child(owner, 'fill').getAttribute('fill')).toBe(observed.fill.computed.fill);
      expect(child(owner, 'outline').getAttribute('stroke')).toBe(observed.outline.computed.stroke);
      expect(Number(child(owner, 'outline').getAttribute('stroke-width'))).toBe(Number.parseFloat(observed.outline.computed.strokeWidth));
      const mark = child(owner, 'mark');
      expect(mark.getAttribute('fill')).toBe(observed.mark.computed.fill);
      expect(mark.getAttribute('stroke')).toBe(observed.mark.computed.stroke);
      expect(Number(mark.getAttribute('stroke-width') ?? 1)).toBe(Number.parseFloat(observed.mark.computed.strokeWidth));
      expect(mark.style.display).toBe(observed.mark.computed.display);
      const now = owner.children.map(node => node.getAttribute('d') ?? node.getAttribute('points'));
      if (children) { owner.children.forEach((node, i) => expect(node).toBe(children![i])); expect(now).toEqual(paths); }
      else { children = [...owner.children]; paths = now; }
      // A font/React repaint consumes a snapshot; it must not advance paint.
      const attributes = owner.children.map(node => [...node.attrs]);
      renderer.paint(svgElement(owner), source, current, { x: 7, y: 9, width: 28, height: 28 }, paint);
      expect(owner.children.map(node => [...node.attrs])).toEqual(attributes);
    }
    // A fresh session can reuse a host DOM node; no previous width leaks back.
    if (source.type === 'radio') {
      renderer.paint(svgElement(owner), source, current, { x: 0, y: 0, width: 28, height: 28 });
      expect(child(owner, 'mark').getAttribute('stroke-width')).toBeNull();
      expect(child(owner, 'mark').getAttribute('stroke')).toBe('none');
    }
  });
  it.each(border.results.map((record, i) => ({ ...record, i })))('matches retained border geometry $i: shape $input.shape / size $input.b / stroke $input.width', record => {
    const renderer = factory(), widget = fixture(record.input.shape === 15 ? 'radio' : 'checkbox', record.input.b, record.input.width);
    const before = structuredClone(widget), geometry = renderer.geometry(widget)!;
    expect(renderer.supports(widget)).toBe(true);
    if (record.actual.strokeRect) {
      const rect = record.actual.strokeRect;
      expect(geometry.inset).toBe(record.actual.strokeInset);
      expect(geometry.outlineSize).toBeCloseTo(rect.width, 10);
      expect(rect.x).toBe(geometry.inset); expect(rect.y).toBe(geometry.inset);
      expect(record.actual.fillInset).toBe(0);
    }
    const owner = svg(); renderer.paint(svgElement(owner), widget, widget, { x: 8.25, y: -3.5, width: 999, height: 888 });
    const fill = child(owner, 'fill'), outline = child(owner, 'outline');
    expect(fill.tagName).toBe('path'); expect(outline.tagName).toBe('path');
    const expectedFill = record.actual.fillSegments ?? record.actual.fillPath;
    const expectedStroke = record.actual.segments ?? record.actual.strokePath;
    if (expectedFill) segments(parsePath(fill.getAttribute('d')), expectedFill);
    if (expectedStroke) segments(parsePath(outline.getAttribute('d')), expectedStroke);
    expect(owner.getAttribute('viewBox')).toBeNull();
    const offset = record.input.width > 1 ? record.input.width / 2 : 0;
    expect(owner.style).toMatchObject({ left: `${8.25 - offset}px`, top: `${-3.5 - offset}px`, overflow: 'hidden', pointerEvents: 'none' });
    expect(widget).toEqual(before);
  });

  it.each(glyph.results.map((record, i) => ({ ...record, i })))('matches retained glyph geometry $i: $input.kind / size $input.b / disabled $input.disabled', record => {
    const renderer = factory(), input = record.input, widget = fixture(input.kind, input.b, 0);
    widget.disabled = input.disabled; widget.selected = true;
    if (input.b === 0) {
      // The native lower-level zero probe does not establish author acceptance.
      expect(renderer.supports(widget)).toBe(false); expect(renderer.geometry(widget)).toBeUndefined(); return;
    }
    const owner = svg(); renderer.paint(svgElement(owner), widget, widget, { x: 0, y: 0, width: input.b, height: input.b });
    const mark = child(owner, 'mark'), actual = record.actual[0], centeredY = input.y + (input.height - input.b) / 2;
    if (input.kind === 'checkbox') {
      expect(mark.tagName).toBe('polyline'); expect(actual.kind).toBe('polyline');
      const points = mark.getAttribute('points')!.split(' ').map(pair => {
        const [x, y] = pair.split(',').map(Number); return { x: x + input.x, y: y + centeredY };
      });
      expect(points).toHaveLength(actual.points!.length);
      points.forEach((p, i) => point(p, actual.points![i]));
      expect(Number(mark.getAttribute('stroke-width'))).toBeCloseTo(actual.pen!.width, 10);
      expect(mark.getAttribute('fill')).toBe('none');
    } else {
      expect(actual.kind).toBe('fill'); expect(mark.tagName).toBe('path');
      const bounds = actual.paths![0].ellipses[0];
      const expected = ellipseFromSourceTemplate({
        x: bounds.x - input.x, y: bounds.y - centeredY, width: bounds.width, height: bounds.height,
      });
      // This older oracle records an ellipse primitive, not its command start.
      // The final writer oracle above separately pins bottom-mid and no Z.
      segments(parsePath(mark.getAttribute('d')), [...expected.slice(2), ...expected.slice(0, 2)]);
      // Initial native Radio.SIll is fill-only. Later _applySvg stroke behavior
      // is a separate path and is not a reason to add an initial ring.
      expect(mark.getAttribute('stroke')).toBe('none');
      expect(mark.getAttribute('stroke-width')).toBeNull();
    }
    expect(mark.style.display).toBe('inline');
  });

  it.each([
    ['missing P94', (w: Widget) => { delete w.style.selectionButtonSize; }],
    ['zero P94', (w: Widget) => { w.style.selectionButtonSize = 0; }],
    ['negative P94', (w: Widget) => { w.style.selectionButtonSize = -1; }],
    ['nonfinite P94', (w: Widget) => { w.style.selectionButtonSize = Infinity; }],
    ['P94 equals stroke', (w: Widget) => { w.style.selectionButtonSize = w.style.strokeWidth; }],
    ['P94 below stroke', (w: Widget) => { w.style.strokeWidth = 20; }],
    ['negative stroke', (w: Widget) => { w.style.strokeWidth = -1; }],
    ['NaN stroke', (w: Widget) => { w.style.strokeWidth = NaN; }],
    ['rotation', (w: Widget) => { w.rotation = 1; }],
    ['wrong type', (w: Widget) => { w.type = 'box'; }],
    ['uniform radius', (w: Widget) => { w.style.radius = 1; }],
    ['independent corner', (w: Widget) => { w.style.cornerRadii = [0, 1, 0, 0]; }],
    ['partial border', (w: Widget) => { w.style.borderVisibility = [true, false, true, true]; }],
    ['unequal borders', (w: Widget) => { w.style.borderWidths = [1, 2, 1, 1]; }],
    ['non-solid pattern', (w: Widget) => { w.style.linePattern = 'dot'; }],
    ['fill gradient', (w: Widget) => { w.style.fillGradient = { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] }; }],
    ['stroke gradient', (w: Widget) => { w.style.strokeGradient = { type: 'radial', center: { x: .5, y: .5 }, axis1: { x: 1, y: .5 }, axis2: { x: .5, y: 1 }, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] }; }],
    ['outer shadow', (w: Widget) => { w.style.outerShadow = { on: true, offsetX: 1, offsetY: 2, blurRadius: 3, color: '#000000' }; }],
    ['inner shadow', (w: Widget) => { w.style.innerShadow = { on: true, offsetX: 1, offsetY: 2, blurRadius: 3, spread: 0, color: '#000000' }; }],
    ['contextual fill', (w: Widget) => { w.style.fill = 'currentColor'; }],
    ['invalid alpha', (w: Widget) => { w.style.stroke = 'rgba(18,52,86,invalid)'; }],
  ] satisfies [string, (w: Widget) => void][])('leaves %s to explicit fallback without partial SVG writes', (_description, change) => {
    const renderer = factory(), widget = fixture(), owner = svg();
    change(widget);
    expect(renderer.supports(widget)).toBe(false); expect(renderer.geometry(widget)).toBeUndefined();
    expect(() => renderer.paint(svgElement(owner), widget, widget, { x: 0, y: 0, width: 14, height: 14 })).toThrow(/Unsupported/);
    expect(owner.children).toEqual([]); expect(owner.attrs.size).toBe(0); expect(owner.style).toEqual({});
  });

  it.each(['#fff', '#ABCDEF', '#abcdefFF', 'rgb(12, 34, 56)', 'white', 'BLACK', '#1230', '#1238', '#12345600', '#12345680', 'transparent', 'rgba(18, 52, 86, 0)', 'rgba(18, 52, 86, .5)'])('admits bounded solid color spelling %s and explicit inactive styles', color => {
    const renderer = factory(), widget = fixture();
    Object.assign(widget.style, { fill: color, stroke: color, linePattern: 'solid', borderWidths: [1, 1, 1, 1],
      borderVisibility: [true, true, true, true], cornerRadii: [0, 0, 0, 0],
      innerShadow: { on: false, offsetX: 0, offsetY: 0, blurRadius: 1, spread: 0, color: '#000000' } });
    expect(renderer.supports(widget)).toBe(true);
  });

  it.each(solidPaint.results.filter(record => record.input.alpha !== null))('preserves initial $input.kind non-null color at alpha $input.alpha / size $input.b / disabled $input.disabled', record => {
    const renderer = factory(), { input } = record, widget = fixture(input.kind, input.b, 0), owner = svg();
    const color = record.actual[0].pen?.color ?? record.actual[0].brush!.color;
    const css = `rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`;
    Object.assign(widget.style, { fill: 'transparent', stroke: css });
    widget.checked = true; widget.disabled = input.disabled;
    expect(renderer.supports(widget)).toBe(true);
    renderer.paint(svgElement(owner), widget, widget, { x: 0, y: 0, width: input.b, height: input.b });
    expect(child(owner, 'fill').getAttribute('fill')).toBe('transparent');
    expect(child(owner, 'outline').getAttribute('stroke')).toBe(css);
    expect(child(owner, 'outline').getAttribute('stroke-width')).toBe('0');
    const mark = child(owner, 'mark');
    if (input.kind === 'checkbox') {
      expect(mark.getAttribute('stroke')).toBe(css);
      expect(Number(mark.getAttribute('stroke-width'))).toBe(record.actual[0].pen!.width);
    } else {
      expect(mark.getAttribute('fill')).toBe(css);
      expect(mark.getAttribute('stroke')).toBe('none');
      expect(mark.getAttribute('stroke-width')).toBeNull();
    }
    expect(mark.style.display).toBe('inline');
  });

  it.each(['checkbox', 'radio'] as const)('preserves %s SVG node identity and visual selected/checked separation', type => {
    const renderer = factory(), source = fixture(type), owner = svg(), current = structuredClone(source);
    current.selected = false; current.checked = true;
    renderer.paint(svgElement(owner), source, current, { x: 1, y: 2, width: 14, height: 14 });
    const children = [...owner.children], paths = children.map(node => node.getAttribute('d') ?? node.getAttribute('points'));
    expect(child(owner, 'mark').style.display).toBe('none');
    current.selected = true; current.checked = false; current.style.fill = '#eeeeee'; current.style.stroke = '#654321';
    renderer.paint(svgElement(owner), source, current, { x: 3, y: 4, width: 14, height: 14 });
    expect(owner.children).toEqual(children);
    owner.children.forEach((node, index) => expect(node).toBe(children[index]));
    expect(owner.children.map(node => node.getAttribute('d') ?? node.getAttribute('points'))).toEqual(paths);
    expect(child(owner, 'mark').style.display).toBe('inline');
    expect(child(owner, 'fill').getAttribute('fill')).toBe('#eeeeee');
    delete current.selected; current.checked = false;
    renderer.paint(svgElement(owner), source, current, { x: 3, y: 4, width: 14, height: 14 });
    expect(child(owner, 'mark').style.display).toBe('none');
    current.checked = true;
    renderer.paint(svgElement(owner), source, current, { x: 3, y: 4, width: 14, height: 14 });
    expect(child(owner, 'mark').style.display).toBe('inline');
    expect(source.checked).toBe(false); expect(source.selected).toBeUndefined();
  });
});
