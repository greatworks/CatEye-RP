import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createWidget } from '../src/model/document';
import { createSelectionIndicatorRenderer, type SelectionIndicatorPaint } from '../src/model/selection-indicator';

type Rect = { x: number; y: number; width: number; height: number };
type BoundsCase = { input?: { b: number; strokeWidth: number; alignRight: boolean; indicatorRect: Rect };
  actual?: { cssRect: Rect }; inline?: { kind: string; attributes?: Record<string, string> }[]; passed: boolean };
const boundsBytes = readFileSync('research/selection-svg-bounds-probes.json');
const bounds = JSON.parse(boundsBytes.toString()) as { passed: number; failed: number; results: BoundsCase[] };
const cases = bounds.results.filter((item): item is BoundsCase & { input: NonNullable<BoundsCase['input']>; actual: NonNullable<BoundsCase['actual']> } => !!item.input);
const modes: [string, typeof createSelectionIndicatorRenderer][] = [
  ['module', createSelectionIndicatorRenderer],
  ['serialized', new Script(`(${createSelectionIndicatorRenderer.toString()})`).runInNewContext({}) as typeof createSelectionIndicatorRenderer],
];

// Attribute/identity sink only. Actual overflow is independently exercised by
// research/selection-svg-body-css-probe.mjs and browser acceptance tests.
class SvgNode {
  readonly attrs = new Map<string, string>(); readonly children: SvgNode[] = [];
  readonly style: Record<string, string> = {}; parent?: SvgNode;
  readonly ownerDocument = { createElementNS: (_namespace: string, tag: string): SvgNode => new SvgNode(tag) };
  constructor(readonly tagName = 'svg') {}
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  removeAttribute(name: string) { this.attrs.delete(name); }
  querySelector(selector: string): SvgNode | null {
    const key = selector.match(/^\[([^\]]+)\]$/)?.[1];
    if (!key) throw Error(`Unexpected test selector ${selector}`);
    for (const child of this.children) {
      if (child.attrs.has(key)) return child;
      const nested = child.querySelector(selector); if (nested) return nested;
    }
    return null;
  }
  append(node: SvgNode) { node.remove(); node.parent = this; this.children.push(node); }
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = undefined; } }
}
const element = (node: SvgNode) => node as unknown as SVGSVGElement;
function widget(type: 'checkbox' | 'radio', size: number, strokeWidth: number) {
  const value = createWidget(type);
  Object.assign(value.style, { selectionButtonSize: size, strokeWidth, fill: '#ffffff', stroke: '#123456', radius: 0 });
  delete value.style.borderWidths; delete value.style.cornerRadii;
  value.rotation = 0; return value;
}
function primitive(svg: SvgNode, name: string) {
  const result = svg.querySelector(`[data-selection-${name}]`);
  expect(result, `missing ${name} primitive`).not.toBeNull(); return result!;
}

it('pins the native bounds oracle, including its separate explicit-viewBox control', () => {
  expect(createHash('sha256').update(boundsBytes).digest('hex')).toBe('4cbac1e3c6bfd401b6874f8a70eabfa92cdaf96c72a8d89a510ea534f565f15f');
  expect(bounds.passed).toBe(13); expect(bounds.failed).toBe(0); expect(cases).toHaveLength(12);
  expect(bounds.results.every(item => item.passed)).toBe(true);
});

describe.each(modes)('%s SVG viewport', (_mode, factory) => {
  it.each([
    { selectionButtonSize: undefined }, { selectionButtonSize: NaN }, { selectionButtonSize: Infinity }, { selectionButtonSize: -1 },
    { strokeWidth: NaN }, { strokeWidth: Infinity }, { strokeWidth: -1 },
    { selectionButtonSize: Number.MAX_VALUE, strokeWidth: Number.MAX_VALUE },
  ])('rejects invalid crop declarations before writing a retained asset: %j', patch => {
    const renderer = factory(), source = widget('radio', 14, 1), root = new SvgNode();
    Object.assign(source.style, patch);
    const paint: SelectionIndicatorPaint = { assetSize: 14, assetStrokeWidth: 1, fill: '#ffffff', stroke: '#123456', outlineWidth: 1,
      markFill: '#123456', markStroke: 'none' };
    expect(renderer.supports(source, paint)).toBe(false);
    expect(() => renderer.paint(element(root), source, source, { x: 0, y: 0, width: 14, height: 14 }, paint)).toThrow(/Unsupported/);
    expect(root.attrs.size).toBe(0); expect(root.children).toHaveLength(0); expect(root.style).toEqual({});
  });
  it('allows a finite declaration stroke wider than the captured asset', () => {
    const renderer = factory(), source = widget('radio', 14, 20), root = new SvgNode();
    const paint: SelectionIndicatorPaint = { assetSize: 14, assetStrokeWidth: 1, fill: '#ffffff', stroke: '#123456', outlineWidth: 20,
      markFill: '#123456', markStroke: 'none' };
    expect(renderer.supports(source, paint)).toBe(true);
    renderer.paint(element(root), source, source, { x: 0, y: 0, width: 14, height: 14 }, paint);
    expect(root.style).toMatchObject({ width: '35px', height: '35px', left: '-10px', top: '-10px' });
  });
  describe.each(['checkbox', 'radio'] as const)('%s', type => {
    it.each(cases)('matches the independent size $input.b / stroke $input.strokeWidth / right $input.alignRight envelope', record => {
      const renderer = factory(), source = widget(type, record.input.b, record.input.strokeWidth), root = new SvgNode();
      // A retained node may contain the previous renderer's root attributes.
      for (const [name, value] of Object.entries({ viewBox: '0 0 99 99', width: '99', height: '99' })) root.setAttribute(name, value);
      root.style.overflow = 'visible';
      const before = structuredClone(source), logical = record.input.indicatorRect;
      renderer.paint(element(root), source, source, { ...logical, x: logical.x - 100, y: logical.y - 70 });
      const expected = record.actual.cssRect;
      expect(root.style).toMatchObject({ position: 'absolute', left: `${expected.x}px`, top: `${expected.y}px`,
        width: `${expected.width}px`, height: `${expected.height}px`, overflow: 'hidden', pointerEvents: 'none' });
      const inlineRoot = record.inline!.find(item => item.kind === 'open')!.attributes!;
      for (const name of ['viewBox', 'width', 'height']) {
        expect(inlineRoot[name]).toBeUndefined(); expect(root.getAttribute(name)).toBeNull();
      }
      for (const name of ['fill', 'outline', 'mark']) primitive(root, name);
      expect(source).toEqual(before);
    });

    it('keeps asset and viewport stable through runtime stroke changes and repeated scale projection', () => {
      const renderer = factory(), source = widget(type, 14, 1), current = structuredClone(source), root = new SvgNode();
      const paint: SelectionIndicatorPaint = { assetSize: 14, assetStrokeWidth: 1, fill: '#ffffff', stroke: '#123456', outlineWidth: 1,
        markFill: type === 'radio' ? '#123456' : 'none', markStroke: '#123456', markWidth: 1,
        svgScaleX: 2, svgScaleY: 3, svgTransformOrigin: 'top left' };
      const rect = { x: 7, y: 9, width: 14, height: 14 };
      renderer.paint(element(root), source, current, rect, paint);
      const nodes = ['fill', 'outline', 'mark'].map(name => primitive(root, name));
      const paths = nodes.map(node => node.getAttribute('d') ?? node.getAttribute('points'));
      for (const width of [3, 0, 20, 1]) {
        current.style.strokeWidth = width; current.style.selectionButtonSize = 28;
        paint.outlineWidth = width; paint.markWidth = width;
        const before = structuredClone(paint);
        renderer.paint(element(root), source, current, rect, paint);
        expect(paint).toEqual(before);
        expect(root.style).toMatchObject({ left: '7px', top: '9px', width: '15px', height: '15px', overflow: 'hidden', transform: 'scale(2, 3)' });
        ['fill', 'outline', 'mark'].forEach((name, index) => {
          const node = primitive(root, name); expect(node).toBe(nodes[index]);
          expect(node.getAttribute('d') ?? node.getAttribute('points')).toBe(paths[index]);
        });
        expect(primitive(root, 'outline').getAttribute('stroke-width')).toBe(String(width));
      }
    });

    it('projects a new declaration crop without rebuilding the captured paths or accumulating its outer scale', () => {
      const renderer = factory(), base = widget(type, 14, 1), view = widget(type, 18, 3), root = new SvgNode();
      const paint: SelectionIndicatorPaint = { assetSize: 14, assetStrokeWidth: 1, fill: '#ffffff', stroke: '#123456', outlineWidth: 20,
        markFill: type === 'radio' ? '#123456' : 'none', markStroke: '#123456', markWidth: 20,
        svgScaleX: 2, svgScaleY: 3, svgTransformOrigin: 'top left' };
      renderer.paint(element(root), base, base, { x: 7, y: 9, width: 14, height: 14 }, paint);
      const nodes = ['fill', 'outline', 'mark'].map(name => primitive(root, name));
      const paths = nodes.map(node => node.getAttribute('d') ?? node.getAttribute('points'));
      for (const source of [view, view, base]) {
        renderer.paint(element(root), source, source, { x: 7, y: 9, width: source.style.selectionButtonSize!, height: source.style.selectionButtonSize! }, paint);
        expect(root.style).toMatchObject(source === view
          ? { left: '5.5px', top: '7.5px', width: '22px', height: '22px' }
          : { left: '7px', top: '9px', width: '15px', height: '15px' });
        expect(root.style.transform).toBe('scale(2, 3)');
        ['fill', 'outline', 'mark'].forEach((name, index) => {
          const node = primitive(root, name); expect(node).toBe(nodes[index]);
          expect(node.getAttribute('d') ?? node.getAttribute('points')).toBe(paths[index]);
        });
      }
    });
  });
});
