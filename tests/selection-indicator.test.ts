import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createWidget } from '../src/model/document';
import { createSelectionIndicatorRenderer } from '../src/model/selection-indicator';
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
const template = border.results.find(record => record.actual.template)!.actual.template!;
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
});

describe.each(modes)('%s selection indicator', (_name, factory) => {
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
    expect(owner.getAttribute('viewBox')).toBe(`0 0 ${record.input.b} ${record.input.b}`);
    expect(owner.style).toMatchObject({ left: '8.25px', top: '-3.5px', overflow: 'visible', pointerEvents: 'none' });
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
      segments(parsePath(mark.getAttribute('d')), ellipseFromSourceTemplate({
        x: bounds.x - input.x, y: bounds.y - centeredY, width: bounds.width, height: bounds.height,
      }));
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
    ['transparent fill', (w: Widget) => { w.style.fill = 'transparent'; }],
    ['alpha stroke', (w: Widget) => { w.style.stroke = '#12345680'; }],
  ] satisfies [string, (w: Widget) => void][])('leaves %s to explicit fallback without partial SVG writes', (_description, change) => {
    const renderer = factory(), widget = fixture(), owner = svg();
    change(widget);
    expect(renderer.supports(widget)).toBe(false); expect(renderer.geometry(widget)).toBeUndefined();
    expect(() => renderer.paint(svgElement(owner), widget, widget, { x: 0, y: 0, width: 14, height: 14 })).toThrow(/Unsupported/);
    expect(owner.children).toEqual([]); expect(owner.attrs.size).toBe(0); expect(owner.style).toEqual({});
  });

  it.each(['#fff', '#ABCDEF', '#abcdefFF', 'rgb(12, 34, 56)', 'white', 'BLACK'])('admits bounded opaque color spelling %s and explicit inactive styles', color => {
    const renderer = factory(), widget = fixture();
    Object.assign(widget.style, { fill: color, stroke: color, linePattern: 'solid', borderWidths: [1, 1, 1, 1],
      borderVisibility: [true, true, true, true], cornerRadii: [0, 0, 0, 0],
      innerShadow: { on: false, offsetX: 0, offsetY: 0, blurRadius: 1, spread: 0, color: '#000000' } });
    expect(renderer.supports(widget)).toBe(true);
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
