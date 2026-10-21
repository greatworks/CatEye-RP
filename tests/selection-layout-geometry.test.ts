import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  planSelectionLayout, type SelectionLayoutInput, type SelectionLayoutEntry,
  type SelectionLayoutServices, type SelectionLayoutState,
} from '../src/model/selection-layout'

// Retained-CIL output, with font, union and conversion services explicitly injected.
// These are author-layout oracles, not original-application pixel observations.
const source = JSON.parse(readFileSync('research/selection-layout-transaction-probes.json', 'utf8'))
type SourceInput = {
  force?: boolean; rect?: { x: number; y: number; width: number; height: number }
  panel?: { x?: number; y?: number; width: number; height: number }
  widthFit?: boolean; heightFit?: boolean; empty?: boolean; guarded?: boolean
  cache?: { x: number; y: number; width: number; height: number }
  buttonSize?: number; padding?: [number, number, number, number]
  textAlign?: number; align?: number; alignRight?: boolean
  entry?: string; request?: { width: number; height: number }; value?: boolean
  measurements?: { width: number; height: number }[]; throwAtMeasure?: number
  reenterAtMeasure?: number; editingText?: boolean; editorHeight?: number
}
function inputFor(i: SourceInput = {}): SelectionLayoutInput {
  const ownerRect = i.rect ?? { x: 20, y: 30, width: 100, height: 20 }
  return {
    ownerRect, textPanelRect: { x: 0, y: 0, width: 50, height: 15, ...i.panel },
    coordinateContext: { kind: 'translation', locationInDiagram: { x: ownerRect.x, y: ownerRect.y },
      ownerRotation: 0, textRotation: 0 },
    rawFit: { width: !!i.widthFit, height: !!i.heightFit },
    effectiveFit: { width: !!i.widthFit, height: !!i.heightFit },
    alignRight: !!i.alignRight, empty: !!i.empty, guard: !!i.guarded,
    padding: i.padding ?? [0, 0, 0, 0], indicatorSize: i.buttonSize ?? 13,
    horizontalAlignment: ['left', 'center', 'right'][i.textAlign ?? 0] as SelectionLayoutInput['horizontalAlignment'],
    verticalAlignment: ['top', 'middle', 'bottom'][i.align ?? 0] as SelectionLayoutInput['verticalAlignment'],
    styleEditorReference: i.cache, editingText: !!i.editingText,
  }
}
function entryFor(i: SourceInput = {}): SelectionLayoutEntry {
  if (i.entry === 'size') return { kind: 'size', size: i.request!, allViews: false, notify: true }
  if (i.entry === 'widthFlag' || i.entry === 'heightFlag')
    return { kind: 'fit', axis: i.entry === 'widthFlag' ? 'width' : 'height', value: !!i.value }
  return { kind: 'layout', recalculateFit: !!i.force }
}
function servicesFor(i: SourceInput = {}): SelectionLayoutServices {
  return {
    measureText(request, context) {
      if (i.throwAtMeasure === request.pass) throw Error('Injected graphics measurement error')
      if (i.reenterAtMeasure === request.pass) context.reenterLayout(true)
      return i.measurements?.[Math.min(request.pass, i.measurements.length - 1)] ?? { width: 60, height: 15 }
    },
    readEditorHeight: () => i.editorHeight ?? 19.25,
    readMinimumSize: () => ({ width: 0, height: 0 }),
    convertIndicatorInset: () => ({ width: 2, height: 2 }),
    unionRectangles(a, b) {
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
      return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y }
    },
  }
}
function projected(state: SelectionLayoutState) {
  return { rect: state.ownerRect, panel: state.textPanelRect, guard: state.guard,
    widthFit: state.rawFit.width, heightFit: state.rawFit.height }
}
const comparedEvents = new Set([
  'guard', 'panel.rect', 'panel.invalidate', 'style.Size', 'style.Location', 'DJ0E',
  'size.changed', 'location.changed', 'NJ01', 'finally.dispose',
])

describe('ordinary unrotated selection author transactions', () => {
  const cases = source.cases.filter((c: { input: SourceInput }) =>
    !['styleChanged', 'selectionStyleChanged'].includes(c.input.entry ?? ''))
  it.each(cases.map((c: unknown, index: number): [number, unknown] => [index, c]) as [number, unknown][])('retained source transaction %i', (_index, row) => {
    const c = row as { input: SourceInput; actual: Record<string, any> }
    const input = inputFor(c.input), original = structuredClone(input)
    const result = planSelectionLayout(input, entryFor(c.input), servicesFor(c.input))
    expect(input).toEqual(original)
    expect(result.ok).toBe(!c.actual.error)
    const state = result.ok ? result.state : result.diagnosticPartialState!
    expect(projected(state)).toEqual({
      rect: c.actual.rect, panel: c.actual.panel, guard: c.actual.guard,
      widthFit: c.actual.widthFit, heightFit: c.actual.heightFit,
    })
    expect(result.measurementPasses).toBe(c.actual.measures)
    expect(result.effects.filter(e => comparedEvents.has(e.name))).toEqual(
      c.actual.events.filter((e: { name: string }) => comparedEvents.has(e.name)))
    if (!result.ok) {
      expect(result.reason).toBe(c.actual.error)
      expect(result).not.toHaveProperty('state')
    }
  })

  it('uses both minimum reads and limits allViews to the external Size write', () => {
    const input = inputFor(), services = servicesFor()
    const minimum = vi.fn(() => ({ width: 90, height: 30 }))
    services.readMinimumSize = minimum
    const result = planSelectionLayout(input, { kind: 'size', size: { width: 1, height: 1 },
      allViews: true, notify: false }, services)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.ownerRect).toEqual({ x: 20, y: 30, width: 90, height: 30 })
    expect(minimum).toHaveBeenCalledTimes(6)
    expect(result.effects.filter(e => e.name === 'style.Size')).toEqual([
      { name: 'style.Size', width: 90, height: 30, allViews: true, notify: true },
    ])
    expect(result.effects.filter(e => e.name === 'size.changed')).toHaveLength(1)
    expect(result.effects.filter(e => e.name === 'NJ01')).toHaveLength(0)
  })

  it('notify=false still performs layout and lower notifications; internal writes remain current-view', () => {
    const result = planSelectionLayout(inputFor(), { kind: 'size', size: { width: 150, height: 20 },
      allViews: true, notify: false }, servicesFor())
    expect(result.ok).toBe(true)
    expect(result.effects.filter(e => e.name === 'style.Size')).toEqual([
      { name: 'style.Size', width: 150, height: 20, allViews: true, notify: true },
      { name: 'style.Size', width: 150, height: 15, allViews: false, notify: true },
    ])
    expect(result.effects.filter(e => e.name === 'NJ01')).toHaveLength(1)
    expect(result.effects.filter(e => e.name === 'size.changed')).toHaveLength(2)
  })

  it('retains a second minimum that changes after fit validation', () => {
    const services = servicesFor(), minimum = vi.fn()
      .mockReturnValueOnce({ width: 0, height: 0 }).mockReturnValue({ width: 90, height: 30 })
    services.readMinimumSize = minimum
    const result = planSelectionLayout(inputFor({ widthFit: true }), {
      kind: 'size', size: { width: 1, height: 1 }, allViews: false, notify: true,
    }, services)
    expect(result.ok).toBe(true)
    expect(result.effects.find(e => e.name === 'style.Size')).toMatchObject({ width: 90, height: 30 })
  })

  it('updates effective getters after a raw flag mutation, and preserves an existing layout guard', () => {
    const input = inputFor({ guarded: true }), services = servicesFor()
    const measure = vi.fn(services.measureText); services.measureText = measure
    const result = planSelectionLayout(input, { kind: 'fit', axis: 'width', value: true }, services)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.rawFit).toEqual({ width: true, height: false })
    expect(result.state.effectiveFit).toEqual(result.state.rawFit)
    expect(result.state.guard).toBe(true)
    expect(measure).not.toHaveBeenCalled()
  })

  it('does not conflate Location, LocationInDiagram or the graphics inset with CSS pixels', () => {
    const input = inputFor({ measurements: [{ width: 70, height: 30 }] })
    input.coordinateContext.locationInDiagram = { x: 220, y: 330 }
    const services = servicesFor({ measurements: [{ width: 70, height: 30 }] })
    services.convertIndicatorInset = vi.fn(() => ({ width: 7, height: 9 }))
    const union = vi.fn(services.unionRectangles); services.unionRectangles = union
    const result = planSelectionLayout(input, { kind: 'layout', recalculateFit: false }, services)
    expect(result.ok).toBe(true)
    expect(services.convertIndicatorInset).toHaveBeenCalledWith(
      { sourceSpace: 2, targetSpace: 0, size: { width: 2, height: 2 } }, expect.anything())
    expect(union.mock.calls[0].slice(0, 3)).toEqual([
      { x: 20, y: 339, width: 13, height: 13 },
      { x: 7, y: 30, width: 87, height: 30 }, { ignoreEmpty: true },
    ])
    if (result.ok) expect(result.state.ownerRect.height).toBe(322)
  })

  it('uses style-editor KNYS as a reference, never as an implicit drag snapshot', () => {
    const input = inputFor({ widthFit: true, heightFit: true, textAlign: 1, align: 1,
      cache: { x: 10, y: 15, width: 90, height: 17 } })
    const result = planSelectionLayout(input, { kind: 'layout', recalculateFit: true },
      servicesFor({ measurements: [{ width: 70, height: 28 }] }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.ownerRect).toEqual({ x: 14, y: 9, width: 83, height: 28 })
    expect(result.state.styleEditorReference).toEqual(input.styleEditorReference)
  })

  it.each(['measure', 'minimum', 'conversion', 'union'] as const)('atomically rejects %s failure and cleans its guard', service => {
    const input = inputFor(), before = structuredClone(input), services = servicesFor()
    const fail = () => { throw Error(`${service} failed`) }
    if (service === 'measure') services.measureText = fail
    if (service === 'minimum') services.readMinimumSize = fail
    if (service === 'conversion') services.convertIndicatorInset = fail
    if (service === 'union') services.unionRectangles = fail
    const result = planSelectionLayout(input, { kind: 'layout', recalculateFit: true }, services)
    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty('state')
    if (!result.ok) expect(result.diagnosticPartialState?.guard).toBe(false)
    expect(input).toEqual(before)
    expect(result.effects.at(-1)).toEqual({ name: 'guard', value: false })
  })

  it.each([
    (i: SelectionLayoutInput) => { i.ownerRect.width = NaN },
    (i: SelectionLayoutInput) => { i.styleEditorReference = { x: NaN, y: 0, width: 1, height: 1 } },
    (i: SelectionLayoutInput) => { i.styleEditorReference = { x: NaN, y: NaN, width: NaN, height: NaN } },
    (i: SelectionLayoutInput) => { i.effectiveFit.width = !i.rawFit.width },
    (i: SelectionLayoutInput) => { i.coordinateContext.ownerRotation = 1 as 0 },
    (i: SelectionLayoutInput) => { i.coordinateContext.textRotation = 1 as 0 },
    (i: SelectionLayoutInput) => { i.coordinateContext.kind = 'general-transform' as 'translation' },
    (i: SelectionLayoutInput) => { i.indicatorSize = Infinity },
  ])('rejects out-of-domain input before measurement %#', change => {
    const input = inputFor(); change(input)
    const services = servicesFor(), measure = vi.fn(services.measureText); services.measureText = measure
    const result = planSelectionLayout(input, { kind: 'layout', recalculateFit: false }, services)
    expect(result.ok).toBe(false)
    expect(result.effects).toEqual([])
    expect(measure).not.toHaveBeenCalled()
  })

  it('rejects a nonfinite callback result instead of silently committing a partial rectangle', () => {
    const services = servicesFor()
    services.measureText = () => ({ width: Infinity, height: 12 })
    const result = planSelectionLayout(inputFor({ widthFit: true }), { kind: 'layout', recalculateFit: true }, services)
    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty('state')
    if (!result.ok) expect(result.diagnosticPartialState?.guard).toBe(false)
  })

  it('gives callbacks independent snapshots and allows same-transaction reentry only through the guard', () => {
    const input = inputFor({ widthFit: true }), services = servicesFor()
    services.measureText = (_request, context) => {
      expect(context.state.guard).toBe(true)
      context.state.ownerRect.x = 900
      context.reenterLayout(true)
      return { width: 70, height: 28 }
    }
    const result = planSelectionLayout(input, { kind: 'layout', recalculateFit: true }, services)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.ownerRect.x).toBe(20)
    expect(result.measurementPasses).toBe(2)
  })
})
