import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import { planAuthorLayerResize } from '../src/model/author-layer-resize';
import type { Widget, WidgetType } from '../src/model/types';
import { resolveAdaptiveWidgets } from '../src/model/adaptive';
import oracle from '../research/layer-resize-controller-planner-fixtures.json';
import entryOracle from '../research/layer-resize-controller-planner-entry-fixtures.json';

function leaf(id: string, x: number, y: number, width: number, height: number, type: WidgetType = 'box'): Widget {
  return { ...createWidget(type, x, y), id, width, height };
}
function group(id: string, widgets: Widget[]): Widget {
  return { ...createWidget('layer'), id, layer: { widgets, propagate: false } };
}
function frame(w: Pick<Widget, 'x' | 'y' | 'width' | 'height'>) {
  return { x: w.x, y: w.y, width: w.width, height: w.height };
}
function resized(layer: Widget, options: Partial<Parameters<typeof planAuthorLayerResize>[0]> = {}) {
  const before = structuredClone(layer);
  const result = planAuthorLayerResize({ layer, delta: { x: 100, y: 50 }, handle: 12, ...options });
  expect(layer).toEqual(before);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const pair = () => group('g', [leaf('a', 0, 0, 50, 100), leaf('b', 50, 0, 50, 100)]);
type SourceNode = {
  id: string; rect?: { x: number; y: number; width: number; height: number };
  children?: SourceNode[]; angle?: number; h?: number; v?: number;
  fixedWidth?: boolean; fixedHeight?: boolean; locked?: boolean;
  autoFitWidth?: boolean; autoFitHeight?: boolean;
};
function sourceWidget(s: SourceNode): Widget {
  const w = s.children ? group(s.id, s.children.map(sourceWidget))
    : leaf(s.id, s.rect!.x, s.rect!.y, s.rect!.width, s.rect!.height);
  w.rotation = s.angle ?? 0; w.locked = !!s.locked;
  w.style = { ...w.style,
    pinHorizontal: ({ 0: 'none', 1: 'left', 4: 'right', 5: 'both', 256: 'center' } as const)[(s.h ?? 0) as 0],
    pinVertical: ({ 0: 'none', 2: 'top', 8: 'bottom', 10: 'both', 512: 'center' } as const)[(s.v ?? 0) as 0],
    fixedWidth: !!s.fixedWidth, fixedHeight: !!s.fixedHeight,
  };
  if (s.autoFitWidth !== undefined || s.autoFitHeight !== undefined) w.shapeText = { autoFitWidth: !!s.autoFitWidth, autoFitHeight: !!s.autoFitHeight };
  return w;
}
function byId(w: Widget): Map<string, Widget> {
  const result = new Map<string, Widget>();
  const visit = (w: Widget) => { result.set(w.id, w); w.layer?.widgets.forEach(visit); };
  visit(w); return result;
}

describe('controller + numeric CIL oracle, independent of product solver', () => {
  it.each(oracle.cases)('$name', testcase => {
    const input = testcase.input as typeof testcase.input & {
      freedom?: 0 | 1 | 2 | 3; orientation?: 0 | 1 | 2 | 3;
      preserveAspect?: boolean; keys?: number; currentLayerId?: string; overrideLocked?: boolean;
    };
    const root = sourceWidget(input.root), original = byId(root);
    const result = resized(root, {
      // These 78 cases enter jbNm directly, below the constructor's handle-axis default.
      delta: input.delta, handle: input.handle as 1, freedom: input.freedom ?? 3, orientation: input.orientation,
      preserveAspect: input.preserveAspect, currentLayerId: input.currentLayerId, overrideLocked: input.overrideLocked,
      modifiers: { control: !!((input.keys ?? 0) & 131072), alt: !!((input.keys ?? 0) & 262144), shift: !!((input.keys ?? 0) & 65536) },
    });
    const actual = byId(result.layer);
    for (const commit of testcase.expected.commits) {
      const before = original.get(commit.id)!, after = actual.get(commit.id)!;
      for (const pair of [['x','y'],['width','height']] as const) {
        const changed = pair.some(key => Math.abs(commit.rect[key] - before[key]) >= 1e-5);
        for (const key of pair) expect(after[key], `${commit.id}.${key}`).toBeCloseTo(changed ? commit.rect[key] : before[key], 8);
      }
    }
    for (const expected of testcase.expected.finalFit) if (original.get(expected.id)?.shapeText) {
      expect(actual.get(expected.id)?.shapeText).toEqual({ autoFitWidth: expected.autoFitWidth, autoFitHeight: expected.autoFitHeight });
    }
    const committed = testcase.expected.commits.map(c => c.id);
    expect(result.patches.every(p => committed.includes(p.id))).toBe(true);
    expect(result.patches.map(p => p.id)).toEqual(committed.filter(id => result.patches.some(p => p.id === id)));
  });
});

describe('native resize controller entry', () => {
  it.each(entryOracle.cases)('source entry + numeric replay: $name', testcase => {
    const input = testcase.input as typeof testcase.input & {
      selectionRect?: { x: number; y: number; width: number; height: number };
    };
    const root = sourceWidget(input.root), before = byId(root);
    const result = resized(root, {
      handle: input.handle as 1, delta: input.delta, selectionRect: input.selectionRect,
    });
    const after = byId(result.layer);
    for (const node of before.values()) if (node.type !== 'layer') {
      const expected = testcase.expected.commits.find(commit => commit.id === node.id)?.rect ?? node;
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(after.get(node.id)![key]).toBeCloseTo(expected[key], 8);
    }
    for (const expected of testcase.expected.finalFit) if (before.get(expected.id)?.shapeText) {
      expect(after.get(expected.id)?.shapeText).toEqual({
        autoFitWidth: expected.autoFitWidth, autoFitHeight: expected.autoFitHeight,
      });
    }
    if (result.trace.length) {
      expect(result.trace[0].parentRect).toEqual(frame(testcase.expected.entry.selectionRect));
      expect(result.trace[0].delta).toEqual(testcase.expected.entry.delta);
    }
  });

  it.each([
    [1, { x: -50, y: 35 }, { x: -50, y: 0, width: 150, height: 100 }],
    [4, { x: 50, y: 35 }, { x: 0, y: 0, width: 150, height: 100 }],
    [2, { x: 35, y: -50 }, { x: 0, y: -50, width: 100, height: 150 }],
    [8, { x: 35, y: 50 }, { x: 0, y: 0, width: 100, height: 150 }],
  ] as const)('derives native axis freedom from side handle %s', (handle, delta, expected) => {
    expect(frame(resized(pair(), { handle, delta }).layer)).toEqual(expected);
  });

  it('uses the same scope-coordinate selection frame for independent selected Layer roots', () => {
    const selectionRect = { x: 0, y: 0, width: 400, height: 100 };
    const roots = [group('g1', [leaf('a', 0, 0, 100, 100)]), group('g2', [leaf('b', 300, 0, 100, 100)])];
    const results = roots.map(layer => resized(layer, { selectionRect, handle: 4, delta: { x: 100, y: 35 } }));
    expect(results.map(result => frame(result.layer))).toEqual([
      { x: 0, y: 0, width: 125, height: 100 }, { x: 375, y: 0, width: 125, height: 100 },
    ]);
    expect(results.map(result => result.trace[0].parentRect)).toEqual([selectionRect, selectionRect]);
  });

  it('clamps against the shared selection width, not the individual root width', () => {
    const selectionRect = { x: 0, y: 0, width: 400, height: 100 };
    const result = resized(group('g', [leaf('a', 300, 0, 100, 100)]), {
      selectionRect, handle: 4, delta: { x: -150, y: 0 },
    });
    expect(frame(result.layer)).toEqual({ x: 187.5, y: 0, width: 62.5, height: 100 });
  });

  it.each([
    { x: 0, y: 0, width: 0, height: 100 },
    { x: 0, y: 0, width: NaN, height: 100 },
    { x: 1, y: 0, width: 99, height: 100 },
  ])('rejects an invalid or incomplete external selection snapshot without writes', selectionRect => {
    const layer = pair(), before = structuredClone(layer);
    const result = planAuthorLayerResize({ layer, selectionRect, handle: 4, delta: { x: 10, y: 0 } });
    expect(result.ok).toBe(false);
    expect(layer).toEqual(before);
    expect('patches' in result).toBe(false);
  });
});

describe('author Layer resize plans from immutable source frames', () => {
  it('scales the two ordinary members, returns paired writes, and caches only the derived Layer frame', () => {
    const root = pair(), result = resized(root);
    expect(result.layer.layer!.widgets.map(frame)).toEqual([
      { x: 0, y: 0, width: 100, height: 150 }, { x: 100, y: 0, width: 100, height: 150 },
    ]);
    expect(frame(result.layer)).toEqual({ x: 0, y: 0, width: 200, height: 150 });
    expect(result.patches).toEqual([
      { id: 'a', geometry: { width: 100, height: 150 } },
      { id: 'b', geometry: { x: 100, y: 0, width: 100, height: 150 } },
    ]);
    expect(result.patches.some(p => p.id === 'g')).toBe(false);
    expect(root.width).toBe(0); // Stale authored cache is not a solver input.
  });

  it('uses the opposite fixed corner for a top-left handle', () => {
    const result = resized(group('g', [leaf('a', 0, 0, 100, 100)]), { handle: 3, delta: { x: 20, y: 10 } });
    expect(frame(result.layer.layer!.widgets[0])).toEqual({ x: 20, y: 10, width: 80, height: 90 });
  });

  it('restores the shared page origin once for nested Layers', () => {
    const nested = group('nested', [leaf('a', 10, 20, 50, 40), leaf('b', 60, 20, 50, 40)]);
    const result = resized(group('outer', [nested]), { delta: { x: 100, y: 40 } });
    expect(result.layer.layer!.widgets[0].layer!.widgets.map(frame)).toEqual([
      { x: 10, y: 20, width: 100, height: 80 }, { x: 110, y: 20, width: 100, height: 80 },
    ]);
    expect(result.patches.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('includes hidden and unplaced members in author geometry', () => {
    const root = pair();
    root.layer!.widgets[0].hidden = true;
    root.layer!.widgets[1].placed = false;
    const result = resized(root);
    expect(result.patches.map(p => p.id)).toEqual(['a', 'b']);
    expect(result.layer.layer!.widgets[0].hidden).toBe(true);
    expect(result.layer.layer!.widgets[1].placed).toBe(false);
  });

  it('delegates a member lock to an unentered Layer but respects it inside the current Layer', () => {
    const root = pair(); root.layer!.widgets[0].locked = true;
    expect(resized(root).patches.map(p => p.id)).toEqual(['a', 'b']);
    const inside = resized(root, { currentLayerId: 'g' });
    expect(inside.patches.map(p => p.id)).toEqual(['b']);
    expect(frame(inside.layer.layer!.widgets[0])).toEqual(frame(root.layer!.widgets[0]));
  });

  it('leaves a locked selected root unchanged and never changes background members', () => {
    const root = pair(); root.locked = true;
    expect(resized(root).patches).toEqual([]);
    const overridden = resized(root, { overrideLocked: true, backgroundIds: ['a'] });
    expect(overridden.patches.map(p => p.id)).toEqual(['b']);
  });

  it('clears only the affected shared AutoFit flags and keeps their absent state absent', () => {
    const root = pair();
    root.layer!.widgets[0].shapeText = { autoFitWidth: true, autoFitHeight: true };
    const result = resized(root, { delta: { x: 100, y: 0 } });
    expect(result.patches[0].shapeText).toEqual({ autoFitWidth: false, autoFitHeight: true });
    expect(result.layer.layer!.widgets[0].shapeText).toEqual({ autoFitWidth: false, autoFitHeight: true });
    expect(result.layer.layer!.widgets[1].shapeText).toBeUndefined();
  });

  it('does not materialize geometry or fit fields for a source-equal result', () => {
    const root = pair();
    root.layer!.widgets[0].shapeText = { autoFitWidth: true, autoFitHeight: true };
    expect(resized(root, { delta: { x: 0, y: 0 } }).patches).toEqual([]);
  });

  it('plans from effective adaptive geometry and pins while leaving every stored map untouched', () => {
    const doc = createDocument(), page = doc.pages[0];
    page.widgets = [pair()];
    page.adaptiveViews = [
      { id: 'parent', name: 'Parent', width: 600, overrides: { a: { width: 40, style: { fixedWidth: true } }, b: { x: 60, width: 40 } } },
      { id: 'child', name: 'Child', width: 300, baseViewId: 'parent', overrides: { a: { hidden: true } } },
      { id: 'inactive', name: 'Inactive', width: 900, overrides: { b: { x: 700, style: { pinHorizontal: 'right' } } } },
    ];
    const before = structuredClone(doc);
    const [effective] = resolveAdaptiveWidgets(page, 'child');
    const result = resized(effective, { delta: { x: 100, y: 0 } });
    expect(result.layer.layer!.widgets[0].width).toBe(40);
    expect(result.layer.layer!.widgets[0].hidden).toBe(true);
    expect(result.layer.layer!.widgets[1].width).toBe(80);
    expect(result.layer.layer!.widgets[1].x).toBe(120);
    expect(doc).toEqual(before);
    expect(result.patches.every(p => !p.geometry || p.geometry.y === undefined || p.geometry.x !== undefined)).toBe(true);
  });

  it('does not treat a sub-epsilon frame result as a changed local axis', () => {
    const result = resized(pair(), { delta: { x: 0.000001, y: 0.000001 } });
    expect(result.patches).toEqual([]);
  });

  it('rejects duplicate identities before publishing any result', () => {
    const root = pair(); root.layer!.widgets[1].id = 'a';
    const result = planAuthorLayerResize({ layer: root, delta: { x: 100, y: 0 }, handle: 4 });
    expect(result).toMatchObject({ ok: false, code: 'duplicate-id', widgetIds: ['a'] });
  });

  it.each([
    [4, { x: -150, y: 0 }], [1, { x: 150, y: 0 }],
    [8, { x: 0, y: -150 }], [2, { x: 0, y: 150 }],
  ] as const)('does not turn an edge crossing into a reflected positive frame (%s)', (handle, delta) => {
    const root = group('g', [leaf('a', 0, 0, 100, 100)]), before = structuredClone(root);
    const result = planAuthorLayerResize({ layer: root, handle, delta });
    expect(result.ok).toBe(false);
    expect(root).toEqual(before);
  });

  it.each(['input', 'textarea', 'button', 'select', 'inlineFrame', 'hotspot', 'image'] as const)(
    'uses the proven ordinary geometry carrier for %s', type => {
      const w = leaf(type, 10, 20, 100, 40, type);
      const result = resized(group('g', [w]), { delta: { x: 50, y: 20 } });
      expect(frame(result.layer.layer!.widgets[0])).toEqual({ x: 10, y: 20, width: 150, height: 60 });
      expect(result.layer.layer!.widgets[0].type).toBe(type);
    },
  );

  it('preserves all payloads, order, independent Layer degree and document round-trip', () => {
    const root = pair(); root.rotation = 37;
    root.layer!.widgets[0].shapeText = { autoFitWidth: true, autoFitHeight: false };
    root.layer!.widgets[0].notes = 'preserved';
    root.layer!.widgets[0].richText = { paragraphs: [{ runs: [{ text: 'A', style: { color: '#f00' } }] }] };
    root.layer!.widgets[0].text = 'A';
    const result = resized(root), a = result.layer.layer!.widgets[0];
    expect(result.layer.rotation).toBe(37);
    expect(a.style).toEqual(root.layer!.widgets[0].style);
    expect(a.richText).toEqual(root.layer!.widgets[0].richText);
    expect(a.notes).toBe('preserved');
    const doc = createDocument(); doc.pages[0].widgets = [result.layer];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it.each(['panel', 'repeater', 'table', 'tableCell', 'menu', 'tree', 'treeNode', 'checkbox', 'radio'] as const)(
    'atomically refuses unclosed %s descendant semantics', type => {
      const root = pair(); root.layer!.widgets.push(leaf('unclosed', 150, 20, 100, 100, type));
      const before = structuredClone(root);
      const result = planAuthorLayerResize({ layer: root, delta: { x: 50, y: 20 }, handle: 12 });
      expect(result.ok).toBe(false);
      if (!result.ok) { expect(result.code).toBe('unsupported-widget'); expect(result.widgetIds).toContain('unclosed'); }
      expect(root).toEqual(before);
    },
  );

  it.each([
    ['empty Layer', group('g', []), { x: 10, y: 10 }],
    ['nonfinite delta', pair(), { x: NaN, y: 10 }],
    ['outside the model range', pair(), { x: 200_000, y: 0 }],
    ['collapsed member', pair(), { x: -100, y: 0 }],
  ] as const)('rejects %s before publishing partial writes', (_label, root, delta) => {
    const before = structuredClone(root);
    const result = planAuthorLayerResize({ layer: root, delta, handle: 12 });
    expect(result.ok).toBe(false);
    expect('patches' in result).toBe(false);
    expect(root).toEqual(before);
  });
});
