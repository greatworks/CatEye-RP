import { Script } from 'node:vm';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, EventType, Interaction, RuntimeState } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime, type RuntimeViewport } from '../src/runtime/export-runtime';
import { createRuntime, executeInteraction, executeWidgetEvent, getRuntimeWidget } from '../src/runtime/engine';
import { evaluateExpression } from '../src/runtime/expressions';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of sessions.splice(0)) runtime.dispose(); });
const interaction = (event: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({
  id: uid(), name: event, event, enabled: true, conditionMode: 'all', conditions: [],
  actions: actions.map(action => ({ ...action, id: uid() })),
});
const select = (viewId: string) => interaction('click', { type: 'setAdaptiveView', adaptiveView: { kind: 'view', viewId } });

type SourceCase = { input: { name: string; type: string; alignRight?: boolean; baseSize?: { width: number; height: number }; styles: Record<string, { size?: { width?: number; height?: number }; buttonSize?: number }> }; actual: { step: { call: string; view?: string }; before: { svg: { computed: { transform: string } } }; after: { svg: { inline: string | null; computed: { transform: string; transformOrigin: string } } } }[] };
function sourceCases(file: string) {
  return JSON.parse(readFileSync(new URL(`../research/${file}`, import.meta.url), 'utf8')).results as SourceCase[];
}
const sourceFile = 'selection-adaptive-svg-probes-final.json';
const sourceCasesForModel = sourceCases(sourceFile).filter(c => ['initial-named-and-return', 'view-css-without-inline-position', 'zero-scale-return', 'zero-base-denominator'].includes(c.input.name));
const decimalCases = sourceCases('selection-adaptive-svg-numerics-probes.json').filter(c => ['decimal-view-repeat', 'fraction-view-repeat', 'tiny-finite-precision'].includes(c.input.name));
const roundingControls = ['selection-adaptive-svg-rounding-controls.json', 'selection-adaptive-svg-midpoint-controls.json'].flatMap(file =>
  JSON.parse(readFileSync(new URL(`../research/${file}`, import.meta.url), 'utf8')).results) as { input: number; actual: { parsed: { m11: number; m22: number } } }[];
const matrixScale = (text: string): [number, number] => text === 'none' ? [1, 1] : [Number(text.slice(7, -1).split(',')[0]), Number(text.slice(7, -1).split(',')[3])];

function fixture() {
  const document = createDocument(), page = document.pages[0], selection = createWidget('checkbox', 20, 30);
  document.caseSelection = 'never'; document.variables = { Reads: '', Changes: '0' };
  delete page.adaptiveSelection; delete page.adaptiveBaseSize; page.width = 1000;
  Object.assign(selection, { width: 100, height: 24, checked: false, selectionText: { autoFitWidth: false, autoFitHeight: false, alignRight: false } });
  Object.assign(selection.style, { selectionButtonSize: 14, strokeWidth: 1, stroke: '#102030', fill: '#ffffff', linePattern: 'solid' });
  selection.interactions = [interaction('click', { type: 'setVariable', targetId: 'Reads', value: '[[This.width]]' })];
  page.widgets = [selection];
  page.adaptiveViews = [
    { id: 'phone', name: 'Phone', width: 600, overrides: { [selection.id]: { width: 200, height: 72 } } },
    { id: 'tablet', name: 'Tablet', width: 900, overrides: { [selection.id]: { width: 150, height: 24 } } },
  ];
  page.interactions = [interaction('adaptiveViewChange', { type: 'setVariable', targetId: 'Changes', value: '[[Changes + 1]]' })];
  const doc = parseDocument(serializeDocument(document));
  return { doc, page: doc.pages[0], selection: doc.pages[0].widgets[0] };
}

function runtime(doc: Document, portable: boolean, viewport?: RuntimeViewport, snapshot?: RuntimeState) {
  const factory: typeof createOfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })
    : createOfflineRuntime;
  const instance = factory(doc, undefined, evaluateExpression, undefined, viewport, snapshot); sessions.push(instance); return instance;
}

// These behavior regressions predate the new scale fields. They expose that a
// snapshot restores the ledger but loses its adaptive closure identity/policy.
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} adaptive snapshot continuity`, () => {
  it('keeps a held live state reference current after identity and initialization change', async () => {
    const { doc, selection } = fixture(), r = runtime(doc, portable, { width: 1000 });
    const held = r.state();
    await r.start(); await r.setAdaptiveView({ kind: 'view', viewId: 'phone' });
    // No second state() call is allowed to refresh this reference first.
    expect(held.adaptiveState).toMatchObject({ mode: 'forced', selectedViewId: 'phone', pageInitialized: true, repeatersInitialized: true });
    await r.execute(interaction('click', { type: 'move', targetId: selection.id, x: 333 }));
    const after = await executeInteraction(doc, held, select('phone'));
    expect(getRuntimeWidget(selection, after).x).toBe(333);
    await r.setViewport({ width: 550, height: 710 });
    expect(held.adaptiveState!.viewport).toEqual({ width: 550, height: 710 });
  });
  it('keeps declarations available to a subsequent widget event without replaying a view action', async () => {
    const { doc, selection } = fixture(), r = runtime(doc, portable, { width: 500 });
    await r.start();
    const before = structuredClone(r.state());
    await r.trigger(selection.id, 'click');
    expect(r.state().variables.Reads).toBe('200');
    const after = await executeWidgetEvent(doc, before, selection.id, 'click');
    expect(after.variables.Reads).toBe('200');
    expect(before.variables.Reads).toBe('');
  });

  it('keeps a same-ID forced selection from resetting a prior action after snapshot restoration', async () => {
    const { doc, selection } = fixture(), r = runtime(doc, portable, { width: 1000 });
    await r.start(); await r.execute(select('phone'));
    await r.execute(interaction('click', { type: 'move', targetId: selection.id, x: 777, y: 88 }));
    const before = structuredClone(r.state());
    await r.execute(select('phone'));
    expect(r.widget(selection)).toMatchObject({ x: 777, y: 88 });
    const after = await executeInteraction(doc, before, select('phone'));
    expect(getRuntimeWidget(selection, after)).toMatchObject({ x: 777, y: 88 });
    expect(after.variables.Changes).toBe(before.variables.Changes);
  });

  it('retains viewport policy when navigation resets forced mode to automatic selection', async () => {
    const { doc } = fixture(), destination = createPage('Destination'), target = createWidget('checkbox');
    delete destination.adaptiveSelection; delete destination.adaptiveBaseSize; destination.width = 1200;
    target.width = 90; target.interactions = [interaction('load', { type: 'setVariable', targetId: 'Reads', value: '[[This.width]]' })];
    destination.widgets = [target];
    destination.adaptiveViews = [{ id: 'destination-phone', name: 'Phone', width: 600, overrides: { [target.id]: { width: 230 } } }];
    doc.pages.push(destination);
    const r = runtime(doc, portable, { width: 500, height: 700 });
    await r.start(); await r.execute(select('tablet'));
    const before = structuredClone(r.state());
    await r.navigate(destination.id);
    expect(r.adaptiveSelectionMode()).toBe('auto'); expect(r.adaptiveViewId()).toBe('destination-phone');
    expect(r.state().variables.Reads).toBe('230');
    const after = await executeInteraction(doc, before, interaction('click', { type: 'openPage', targetId: destination.id }));
    expect(after.variables.Reads).toBe('230');
  });

  it('retains the initialized page phase so a later real transition emits its event once', async () => {
    const { doc } = fixture(), r = runtime(doc, portable, { width: 1000 });
    await r.start(); await r.execute(select('phone'));
    const before = structuredClone(r.state()); expect(before.variables.Changes).toBe('1');
    await r.execute(select('tablet')); expect(r.state().variables.Changes).toBe('2');
    const after = await executeInteraction(doc, before, select('tablet'));
    expect(after.variables.Changes).toBe('2');
  });

  it('restores forced mode and policy without dispatch, then resumes automatic selection explicitly', async () => {
    const { doc, selection } = fixture(), original = runtime(doc, portable, { width: 500, height: 700, clampToPage: true });
    await original.start(); await original.setAdaptiveView({ kind: 'view', viewId: 'tablet' });
    await original.execute(interaction('click', { type: 'move', targetId: selection.id, x: 777 }));
    const saved = structuredClone(original.state()), copy = structuredClone(saved);
    const restored = runtime(doc, portable, undefined, saved);
    expect(restored.adaptiveViewId()).toBe('tablet'); expect(restored.adaptiveSelectionMode()).toBe('forced');
    expect(restored.state()).toEqual(copy);
    await restored.setViewport({ width: 550, height: 710 });
    expect(restored.adaptiveViewId()).toBe('tablet'); expect(restored.widget(selection).x).toBe(777);
    await restored.setAdaptiveView({ kind: 'auto' });
    expect(restored.adaptiveViewId()).toBe('phone'); expect(restored.widget(selection).width).toBe(200);
    expect(restored.state().adaptiveState).toMatchObject({ mode: 'auto', viewport: { width: 550, height: 710 }, selectedViewId: 'phone' });
    expect(saved).toEqual(copy); expect(original.adaptiveViewId()).toBe('tablet');
  });

  it.each([{ kind: 'base' as const }, { kind: 'view' as const, viewId: 'deleted-view' }])('restores identity for $kind without inventing a declaration', async target => {
    const { doc, selection } = fixture(), original = runtime(doc, portable, { width: 500 });
    await original.start(); await original.setAdaptiveView(target);
    await original.execute(interaction('click', { type: 'move', targetId: selection.id, x: 456 }));
    const restored = runtime(doc, portable, undefined, structuredClone(original.state()));
    expect(restored.adaptiveViewId()).toBe(target.kind === 'view' ? target.viewId : undefined);
    expect(restored.adaptiveSelectionMode()).toBe('forced');
    await restored.setAdaptiveView(target);
    expect(restored.widget(selection).x).toBe(456);
    expect(restored.adaptiveWidgetOverride(selection.id)).toBeUndefined();
  });

  it('keeps legacy snapshots unmanaged and never saves the carrier in Document JSON', () => {
    const { doc, selection } = fixture(), source = runtime(doc, portable), savedDocument = serializeDocument(doc);
    const saved = structuredClone(source.state()); expect(saved).not.toHaveProperty('adaptiveState');
    const restored = runtime(doc, portable, undefined, saved);
    expect(restored.adaptiveViewId()).toBeUndefined(); expect(restored.widget({ ...selection, width: 789 }).width).toBe(789);
    expect(restored.state()).not.toHaveProperty('adaptiveState');
    expect(serializeDocument(doc)).toBe(savedDocument);
  });

  it('rejects invalid adaptive restoration and ambiguous viewport input before any event', () => {
    const { doc } = fixture(), source = runtime(doc, portable, { width: 500 }), saved = structuredClone(source.state());
    for (const patch of [
      { mode: 'invalid' }, { viewport: { width: -1 } }, { viewport: { height: NaN } },
      { viewport: { clampToPage: 'true' } }, { selectedViewId: '__proto__' },
      { pageInitialized: 1 }, { repeatersInitialized: undefined }, { extra: true },
    ]) {
      const input = { ...saved, adaptiveState: { ...saved.adaptiveState, ...patch } } as RuntimeState;
      expect(() => runtime(doc, portable, undefined, input)).toThrow();
    }
    expect(() => runtime(doc, portable, { width: 500 }, saved)).toThrow(/cannot also specify a viewport/);
    expect(() => runtime(doc, portable, undefined, { ...saved, pageId: 'missing-page' })).toThrow(/missing page/);
  });

  it('rolls restored view identity and the carrier back when its change handler fails', async () => {
    const { doc, page } = fixture(), original = runtime(doc, portable, { width: 1000 });
    await original.start(); await original.setAdaptiveView({ kind: 'view', viewId: 'phone' });
    page.interactions.push(interaction('adaptiveViewChange', { type: 'setSelected', targetId: page.widgets[0].id, value: 'invalid' }));
    const before = structuredClone(original.state()), restored = runtime(doc, portable, undefined, before);
    await expect(restored.setAdaptiveView({ kind: 'view', viewId: 'tablet' })).rejects.toThrow(/Invalid selected state/);
    expect(restored.adaptiveViewId()).toBe('phone'); expect(restored.adaptiveSelectionMode()).toBe('forced');
    expect(restored.state()).toEqual(before);
  });
});

it('preserves the same-view gate across consecutive public snapshot helpers', async () => {
  const { doc, selection } = fixture(), saved = serializeDocument(doc);
  let state = await executeInteraction(doc, createRuntime(doc), select('phone'));
  state = await executeInteraction(doc, state, interaction('click', { type: 'move', targetId: selection.id, x: 333 }));
  state = await executeInteraction(doc, state, select('phone'));
  expect(getRuntimeWidget(selection, state).x).toBe(333);
  expect(serializeDocument(doc)).toBe(saved);
});

it('pins the retained full-module adaptive oracle independently of the product factory', () => {
  expect(createHash('sha256').update(readFileSync(new URL(`../research/${sourceFile}`, import.meta.url))).digest('hex'))
    .toBe('f95272000dfcc934afbbb6ac364d12d435387862c4e6de76620d3c8d14bd921d');
  for (const [file, sha] of [
    ['selection-adaptive-svg-numerics-probes.json', '82a53df7b3f5771b791c8830a312e7762b5f3bc9469fee68180568036f0222e9'],
    ['selection-adaptive-svg-rounding-controls.json', '44f26eab589b881ed955d3df827f6233e406f69e556d6dfc054231324f2e48e7'],
    ['selection-adaptive-svg-midpoint-controls.json', 'd0a316eb4415a5867673b0757fbcfa8ea86a888f1dda40dad782450cfd6dfe45'],
  ]) expect(createHash('sha256').update(readFileSync(new URL(`../research/${file}`, import.meta.url))).digest('hex')).toBe(sha);
});

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} selection adaptive scale events`, () => {
  it('matches browser numeric and exact midpoint controls at the next event while retaining the raw CSS submission', async () => {
    for (const source of roundingControls) {
      // These deliberately include negative/out-of-schema carriers to test the
      // CSS numeric adapter, not to broaden legal saved widget dimensions.
      const { doc, page, selection } = fixture(); selection.width = 1; selection.height = 1;
      page.adaptiveViews = [
        { id: 'a', name: 'A', width: 600, overrides: { [selection.id]: { width: source.input, height: source.input } } },
        { id: 'b', name: 'B', width: 600, overrides: { [selection.id]: { width: 2, height: 2 } } },
      ];
      const r = runtime(doc, portable, { width: 1000 }); await r.start(); await r.setAdaptiveView({ kind: 'view', viewId: 'a' });
      expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: source.input, svgScaleY: source.input });
      await r.setAdaptiveView({ kind: 'view', viewId: 'b' });
      expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: source.actual.parsed.m11 * 2, svgScaleY: source.actual.parsed.m22 * 2 });
    }
  });
  for (const [index, source] of [...sourceCasesForModel, ...decimalCases].entries()) it(`retained source ${index}: ${source.input.type} ${source.input.name}`, async () => {
    const { doc, selection, page } = fixture(); selection.type = source.input.type === 'radioButton' ? 'radio' : 'checkbox';
    selection.selectionText!.alignRight = source.input.alignRight ?? false;
    Object.assign(selection, source.input.baseSize ?? { width: 100, height: 24 });
    const ids = [...new Set(source.actual.flatMap(frame => frame.step.view && frame.step.view !== 'default' ? [frame.step.view] : []))];
    page.adaptiveViews = ids.map(id => {
      const style = source.input.styles[id] ?? {};
      return { id, name: id, width: 600, overrides: { [selection.id]: {
        ...style.size, ...(style.buttonSize === undefined ? {} : { style: { selectionButtonSize: style.buttonSize } }),
      } } };
    });
    // Zero-size/very-small raw source carriers are runtime-consumer robustness
    // probes. Ordinary positive cases additionally traverse the saved parser.
    const allSizes = [selection, ...page.adaptiveViews.map(v => v.overrides[selection.id])];
    const input = allSizes.every(s => (s.width ?? 1) >= 1 && (s.height ?? 1) >= 1) ? parseDocument(serializeDocument(doc)) : doc;
    const first = source.actual[0].step;
    const r = runtime(input, portable, { width: first.view ? 500 : 1000 });
    let expectedRaw: [number, number] | undefined;
    for (const frame of source.actual) {
      if (frame.step.call === 'initialize') {
        await r.start();
      } else if (frame.step.call === 'switch') {
        await r.setAdaptiveView(frame.step.view === 'default' ? { kind: 'base' } : { kind: 'view', viewId: frame.step.view! });
      } else throw new Error(`Unsupported oracle operation ${frame.step.call}`);
      const requested = frame.step.view && frame.step.view !== 'default' ? source.input.styles[frame.step.view]?.size : undefined;
      if (requested) {
        const old = matrixScale(frame.before.svg.computed.transform);
        const next: [number, number] = [(requested.width! / selection.width) * old[0], (requested.height! / selection.height) * old[1]];
        if (next.every(Number.isFinite) && (old[0] !== next[0] || old[1] !== next[1])) expectedRaw = next;
      }
      const paint = r.selectionIndicatorPaint(selection.id)!;
      expect([paint.svgScaleX, paint.svgScaleY]).toEqual(expectedRaw ?? [undefined, undefined]);
      expect(paint.svgTransformOrigin).toBe(frame.after.svg.inline?.includes('transform-origin:') ? 'top left' : undefined);
      const sourceScale = matrixScale(frame.after.svg.computed.transform);
      expect((paint.svgScaleX ?? 1).toPrecision(6)).toBe(sourceScale[0].toPrecision(6));
      expect((paint.svgScaleY ?? 1).toPrecision(6)).toBe(sourceScale[1].toPrecision(6));
      expect(paint.assetSize).toBe(14);
    }
  });

  it('advances only view-size events, preserving identity/origin, actions and state paints independently', async () => {
    const { doc, page, selection } = fixture();
    page.adaptiveViews.push(
      { id: 'identity', name: 'Identity', width: 700, overrides: { [selection.id]: { width: 100, height: 24 } } },
      { id: 'p94', name: 'Indicator only', width: 700, overrides: { [selection.id]: { style: { selectionButtonSize: 28 } } } },
      { id: 'empty', name: 'Empty', width: 700, overrides: {} },
    );
    selection.selectedStyle = { strokeWidth: 3 }; selection.mouseOverStyle = { stroke: '#ff0000' };
    const r = runtime(doc, portable, { width: 1000 }); await r.start();
    await r.setAdaptiveView({ kind: 'view', viewId: 'identity' });
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgTransformOrigin: 'top left' });
    expect(r.selectionIndicatorPaint(selection.id)).not.toHaveProperty('svgScaleX');
    await r.setAdaptiveView({ kind: 'view', viewId: 'phone' });
    const scale = { svgScaleX: 2, svgScaleY: 3, svgTransformOrigin: 'top left' };
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject(scale);
    for (let n = 0; n < 4; n++) { r.widget(selection); r.selectionDisplaySource(selection.id); r.selectionIndicatorPaint(selection.id); }
    await r.setAdaptiveView({ kind: 'view', viewId: 'phone' });
    await r.select(selection.id, true); r.setInteractionState(selection.id, { mouseOver: true });
    await r.execute(interaction('click', { type: 'setStyle', targetId: selection.id, style: { strokeWidth: 6, selectionButtonSize: 30 } },
      { type: 'move', targetId: selection.id, x: 999 }, { type: 'resize', targetId: selection.id, x: 555, y: 444 }));
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ ...scale, outlineWidth: 6, assetSize: 14 });
    expect(r.widget(selection).width).toBe(555); // Preserved legacy numeric Resize compatibility.
    await r.execute(interaction('click', { type: 'resize', resize: { targets: [{ target: { kind: 'widget', id: selection.id }, width: { text: '888' }, height: { text: '999' }, anchor: 'center', easing: 'none', duration: 0 }] } }));
    expect(r.widget(selection).width).toBe(555); // Native motion Resize excludes checkbox/radio.
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject(scale);
    for (const target of [{ kind: 'view' as const, viewId: 'p94' }, { kind: 'view' as const, viewId: 'empty' }, { kind: 'base' as const }]) {
      await r.setAdaptiveView(target); expect(r.selectionIndicatorPaint(selection.id)).toMatchObject(scale);
    }
    const copy = r.selectionIndicatorPaint(selection.id)!; copy.svgScaleX = 999;
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject(scale);
  });

  it('bridges independent product axes using declarations and inheritance, never action geometry', async () => {
    const { doc, page, selection } = fixture();
    page.adaptiveViews = [
      { id: 'parent', name: 'Parent', width: 800, overrides: { [selection.id]: { width: 200 } } },
      { id: 'child', name: 'Child', width: 600, baseViewId: 'parent', overrides: { [selection.id]: { height: 48, style: { selectionButtonSize: 28 } } } },
      { id: 'plain-child', name: 'Plain child', width: 600, baseViewId: 'parent', overrides: {} },
    ];
    const r = runtime(parseDocument(serializeDocument(doc)), portable, { width: 1000 }); await r.start();
    await r.setAdaptiveView({ kind: 'view', viewId: 'child' });
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 2, svgScaleY: 2 });
    r.state().widgetOverrides[selection.id] = { width: 999, height: 777 };
    await r.setAdaptiveView({ kind: 'view', viewId: 'plain-child' });
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 4, svgScaleY: 2 });
  });

  it('keeps transform history through fresh snapshot restoration without replaying initial named scale', async () => {
    const { doc, selection } = fixture(), r = runtime(doc, portable, { width: 500 }); await r.start();
    const snapshot = structuredClone(r.state()), restored = runtime(doc, portable, undefined, snapshot);
    expect(restored.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 2, svgScaleY: 3 });
    await restored.setAdaptiveView({ kind: 'view', viewId: 'phone' });
    expect(restored.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 2, svgScaleY: 3 });
    await restored.setAdaptiveView({ kind: 'base' }); await restored.setAdaptiveView({ kind: 'view', viewId: 'phone' });
    expect(restored.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 4, svgScaleY: 9 });
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 2, svgScaleY: 3 });
  });

  it('does not replace a finite transform when the whole next CSS pair is invalid', async () => {
    const { doc, page, selection } = fixture(); selection.width = 1; selection.height = 1;
    page.adaptiveViews = [
      { id: 'a', name: 'A', width: 600, overrides: { [selection.id]: { width: 1e308, height: 2 } } },
      { id: 'b', name: 'B', width: 600, overrides: { [selection.id]: { width: 1e308, height: 3 } } },
    ];
    const r = runtime(doc, portable, { width: 1000 }); await r.start(); await r.setAdaptiveView({ kind: 'view', viewId: 'a' });
    const before = r.selectionIndicatorPaint(selection.id);
    await r.setAdaptiveView({ kind: 'view', viewId: 'b' });
    expect(r.selectionIndicatorPaint(selection.id)).toEqual(before); // Infinity X rejects finite Y too.
  });

  it('rolls scale and adaptive identity back together if a transition event fails', async () => {
    const { doc, page, selection } = fixture(), r = runtime(doc, portable, { width: 500 }); await r.start();
    page.interactions.push(interaction('adaptiveViewChange', { type: 'setSelected', targetId: selection.id, value: 'invalid' }));
    const before = structuredClone(r.state());
    await expect(r.setAdaptiveView({ kind: 'view', viewId: 'tablet' })).rejects.toThrow(/Invalid selected state/);
    expect(r.state()).toEqual(before); expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 2, svgScaleY: 3 });
    page.interactions.pop(); await r.setAdaptiveView({ kind: 'view', viewId: 'tablet' });
    expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 3, svgScaleY: 3 });
  });

  it('initializes hidden/inactive assets once and starts a fresh asset on page navigation', async () => {
    const { doc, page, selection } = fixture(), hidden = structuredClone(selection), panel = createWidget('panel');
    hidden.id = uid(); hidden.hidden = true; selection.placed = false;
    panel.states!.push({ id: uid(), name: 'Inactive', widgets: [hidden] }); page.widgets = [selection, panel];
    for (const view of page.adaptiveViews) view.overrides[hidden.id] = { ...view.overrides[selection.id] };
    const destination = createPage('Away'); doc.pages.push(destination);
    const r = runtime(doc, portable, { width: 500 }); await r.start();
    for (const target of [selection, hidden]) expect(r.selectionIndicatorPaint(target.id)).toMatchObject({ svgScaleX: 2, svgScaleY: 3 });
    await r.setAdaptiveView({ kind: 'base' }); await r.setAdaptiveView({ kind: 'view', viewId: 'phone' });
    for (const target of [selection, hidden]) expect(r.selectionIndicatorPaint(target.id)).toMatchObject({ svgScaleX: 4, svgScaleY: 9 });
    await r.navigate(destination.id); expect(r.selectionIndicatorPaint(selection.id)).toBeUndefined();
    await r.navigate(page.id); expect(r.selectionIndicatorPaint(selection.id)).toMatchObject({ svgScaleX: 2, svgScaleY: 3 });
    r.dispose(); expect(r.selectionIndicatorPaint(selection.id)).toBeUndefined(); expect(r.state().selectionPaintState).toBeUndefined();
  });

  it('isolates nested row assets and resets scale on the product actual row-generation path', async () => {
    const { doc, page, selection } = fixture(), inner = createWidget('repeater'), outer = createWidget('repeater');
    inner.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [selection], itemHeight: 90, gap: 0 };
    outer.repeater = { columns: ['Name'], rows: [{ Name: 'Outer A' }, { Name: 'Outer B' }], template: [inner], itemHeight: 200, gap: 0 };
    page.widgets = [outer]; const r = runtime(doc, portable, { width: 500 }); await r.start();
    const parents = r.rows(outer), a = r.rows(inner, parents[0].context)[0], b = r.rows(inner, parents[1].context)[0];
    expect(r.selectionIndicatorPaint(selection.id, a.context)).toMatchObject({ svgScaleX: 2, svgScaleY: 3 });
    await r.execute(interaction('click', { type: 'setStyle', targetId: selection.id, style: { strokeWidth: 6 } }), a.data, a.context);
    expect(r.selectionIndicatorPaint(selection.id, a.context)?.outlineWidth).toBe(6);
    expect(r.selectionIndicatorPaint(selection.id, b.context)?.outlineWidth).toBe(1);
    await r.setAdaptiveView({ kind: 'view', viewId: 'tablet' });
    for (const parent of r.rows(outer)) for (const row of r.rows(inner, parent.context))
      expect(r.selectionIndicatorPaint(selection.id, row.context)).toMatchObject({ svgScaleX: 1.5, svgScaleY: 1, outlineWidth: 1 });
  });
});
