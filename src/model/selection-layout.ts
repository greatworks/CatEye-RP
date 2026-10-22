/** Ordinary, unrotated SelectionButton author layout. This is not runtime SetText.
 * Source boundaries: research/selection-layout-transaction-evidence.md and
 * research/selection-author-properties-probes.json (MIue/BNZT refresh chain).
 * Fonts, graphics units, rectangle-union semantics and minimum-size policy belong
 * to explicit services. No original assembly, graphics library or DOM is used.
 */
export interface SelectionLayoutPoint { x: number; y: number }
export interface SelectionLayoutSize { width: number; height: number }
export interface SelectionLayoutRect extends SelectionLayoutPoint, SelectionLayoutSize {}
export interface SelectionLayoutFit { width: boolean; height: boolean }
export interface SelectionLayoutInput {
  /** UnroundedRect in the owner's Location coordinate space. */
  ownerRect: SelectionLayoutRect
  textPanelRect: SelectionLayoutRect
  /** Only a translation between Location and LocationInDiagram is admitted. */
  coordinateContext: {
    kind: 'translation'
    locationInDiagram: SelectionLayoutPoint
    ownerRotation: 0
    textRotation: 0
  }
  rawFit: SelectionLayoutFit
  effectiveFit: SelectionLayoutFit
  alignRight: boolean
  empty: boolean
  guard: boolean
  padding: readonly [number, number, number, number] // top, right, bottom, left
  indicatorSize: number
  horizontalAlignment: 'left' | 'center' | 'right'
  verticalAlignment: 'top' | 'middle' | 'bottom'
  /** KNYS from the style-editor scope. Undefined is missing; NaN is invalid input. */
  styleEditorReference?: SelectionLayoutRect
  editingText?: boolean
  /** RichTextPanel pNOC content-change guard; distinct from the owner guard. */
  panelChangeGuard?: boolean
}
export type SelectionLayoutEntry =
  | { kind: 'layout'; recalculateFit: boolean }
  | { kind: 'size'; size: SelectionLayoutSize; allViews: boolean; notify: boolean }
  | { kind: 'fit'; axis: 'width' | 'height'; value: boolean }
  | { kind: 'alignRight'; value: boolean }
  | { kind: 'styleChanged'; changedKeys: number[]; notify: boolean; contained: boolean }
  /** Post-synchronization RNO1 tail only: host has stored/normalized text and
   * completed any style/inline-link synchronization. Not the text setter. */
  | { kind: 'textChanged' }
export interface SelectionLayoutState {
  ownerRect: SelectionLayoutRect
  textPanelRect: SelectionLayoutRect
  locationInDiagram: SelectionLayoutPoint
  rawFit: SelectionLayoutFit
  effectiveFit: SelectionLayoutFit
  guard: boolean
  styleEditorReference?: SelectionLayoutRect
}
export interface SelectionLayoutServiceContext {
  /** Independent copy; service mutation cannot change the transaction. */
  state: SelectionLayoutState
  /** Models a synchronous layout notification on this transaction's guarded owner. */
  reenterLayout(recalculateFit: boolean): void
}
export interface SelectionLayoutServices {
  measureText(request: {
    pass: number; constraint: SelectionLayoutSize; width: number; flag: boolean
  }, context: SelectionLayoutServiceContext): SelectionLayoutSize
  readEditorHeight?(context: SelectionLayoutServiceContext): number
  readMinimumSize(context: SelectionLayoutServiceContext): SelectionLayoutSize
  convertIndicatorInset(request: {
    sourceSpace: 2; targetSpace: 0; size: SelectionLayoutSize
  }, context: SelectionLayoutServiceContext): SelectionLayoutSize
  /** H5px's native empty/sentinel union semantics are not proved by these fixtures. */
  unionRectangles(a: SelectionLayoutRect, b: SelectionLayoutRect, options: {
    ignoreEmpty: true
  }, context: SelectionLayoutServiceContext): SelectionLayoutRect
}
export interface SelectionLayoutEffect { name: string; [key: string]: unknown }
interface SelectionLayoutResultBase {
  effects: SelectionLayoutEffect[]
  measurementPasses: number
}
export type SelectionLayoutResult =
  | (SelectionLayoutResultBase & { ok: true; state: SelectionLayoutState })
  | (SelectionLayoutResultBase & {
    ok: false; reason: string
    /** Native-style attempted changes, for diagnostics only. Never a commit payload. */
    diagnosticPartialState?: SelectionLayoutState
  })

const same = (a: number, b: number) => Math.abs(a - b) < 1e-5
const roundAway = (value: number) => Math.sign(value) * Math.floor(Math.abs(value) + .5)
const roundEven = (value: number) => {
  const lower = Math.floor(value)
  return value - lower === .5 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(value)
}
function finite(value: number, name: string) {
  if (!Number.isFinite(value)) throw Error(`${name} must be finite`)
}
function size(value: SelectionLayoutSize, name: string) {
  finite(value.width, `${name}.width`); finite(value.height, `${name}.height`)
  if (value.width < 0 || value.height < 0) throw Error(`${name} must be nonnegative`)
}
function point(value: SelectionLayoutPoint, name: string) {
  finite(value.x, `${name}.x`); finite(value.y, `${name}.y`)
}
function rect(value: SelectionLayoutRect, name: string) {
  point(value, name); size(value, name)
}
function boolean(value: boolean, name: string) {
  if (typeof value !== 'boolean') throw Error(`${name} must be Boolean`)
}
function copyState(s: SelectionLayoutState): SelectionLayoutState {
  return {
    ownerRect: { ...s.ownerRect }, textPanelRect: { ...s.textPanelRect },
    locationInDiagram: { ...s.locationInDiagram }, rawFit: { ...s.rawFit },
    effectiveFit: { ...s.effectiveFit }, guard: s.guard,
    ...(s.styleEditorReference === undefined ? {} : { styleEditorReference: { ...s.styleEditorReference } }),
  }
}

/** Accumulates an atomic candidate. Native setters can leave partial changes on
 * error; only this product wrapper withholds the candidate. Notification effects
 * are a trace, not dispatch to a document, ancestor or inline-link system.
 */
export function planSelectionLayout(
  input: SelectionLayoutInput, entry: SelectionLayoutEntry, services: SelectionLayoutServices,
): SelectionLayoutResult {
  const effects: SelectionLayoutEffect[] = []
  let measurementPasses = 0
  let state: SelectionLayoutState | undefined
  const emit = (name: string, data: Record<string, unknown> = {}) => effects.push({ name, ...data })
  try {
    rect(input.ownerRect, 'ownerRect'); rect(input.textPanelRect, 'textPanelRect')
    const coordinate = input.coordinateContext
    if (coordinate.kind !== 'translation' || coordinate.ownerRotation !== 0 || coordinate.textRotation !== 0)
      throw Error('Selection layout supports only an unrotated translation context')
    point(coordinate.locationInDiagram, 'locationInDiagram')
    if (input.styleEditorReference !== undefined) rect(input.styleEditorReference, 'styleEditorReference')
    for (const axis of ['width', 'height'] as const) {
      boolean(input.rawFit[axis], `rawFit.${axis}`); boolean(input.effectiveFit[axis], `effectiveFit.${axis}`)
      if (input.rawFit[axis] !== input.effectiveFit[axis])
        throw Error('Raw and effective fit must agree in the no-transform domain')
    }
    boolean(input.guard, 'guard'); boolean(input.empty, 'empty'); boolean(input.alignRight, 'alignRight')
    if (input.editingText !== undefined) boolean(input.editingText, 'editingText')
    if (input.panelChangeGuard !== undefined) boolean(input.panelChangeGuard, 'panelChangeGuard')
    if (!['left', 'center', 'right'].includes(input.horizontalAlignment) ||
        !['top', 'middle', 'bottom'].includes(input.verticalAlignment)) throw Error('Invalid text alignment')
    if (input.padding.length !== 4) throw Error('Four padding values are required')
    for (const value of [...input.padding, input.indicatorSize]) {
      finite(value, 'padding/indicatorSize')
      if (value < 0) throw Error('Padding and indicatorSize must be nonnegative')
    }
    if (entry.kind === 'size') {
      size(entry.size, 'requestedSize'); boolean(entry.allViews, 'allViews'); boolean(entry.notify, 'notify')
    } else if (entry.kind === 'fit') {
      if (entry.axis !== 'width' && entry.axis !== 'height') throw Error('Invalid fit axis')
      boolean(entry.value, 'fit value')
    } else if (entry.kind === 'alignRight') boolean(entry.value, 'alignRight value')
    else if (entry.kind === 'styleChanged') {
      boolean(entry.notify, 'notify'); boolean(entry.contained, 'contained')
      if (!Array.isArray(entry.changedKeys) || entry.changedKeys.some(key => !Number.isSafeInteger(key) || key < 0))
        throw Error('Changed property keys must be nonnegative safe integers')
    }
    else if (entry.kind === 'layout') boolean(entry.recalculateFit, 'recalculateFit')
    else if (entry.kind !== 'textChanged') throw Error('Invalid selection layout entry')
    for (const method of ['measureText', 'readMinimumSize', 'convertIndicatorInset', 'unionRectangles'] as const)
      if (typeof services[method] !== 'function') throw Error(`${method} service is required`)
    if (input.editingText && typeof services.readEditorHeight !== 'function') throw Error('readEditorHeight service is required')

    const current: SelectionLayoutState = {
      ownerRect: { ...input.ownerRect }, textPanelRect: { ...input.textPanelRect },
      locationInDiagram: { ...coordinate.locationInDiagram },
      rawFit: { ...input.rawFit }, effectiveFit: { ...input.effectiveFit }, guard: input.guard,
      ...(input.styleEditorReference === undefined ? {} : { styleEditorReference: { ...input.styleEditorReference } }),
    }
    state = current
    let alignRight = input.alignRight
    const [top, right, bottom, left] = input.padding
    const button = input.indicatorSize
    const context = (): SelectionLayoutServiceContext => ({
      state: copyState(current),
      reenterLayout(force) { boolean(force, 'reenterLayout'); enterLayout(force) },
    })
    const invalidate = () => emit('DJ0E', { a: false, b: true })
    const panelWrite = (next: SelectionLayoutRect) => {
      rect(next, 'measured textPanelRect')
      current.textPanelRect = { ...next }
      emit('panel.rect', { rect: { ...next } }); emit('panel.invalidate', { deep: true })
    }
    const fitSize = (requested: SelectionLayoutSize): SelectionLayoutSize => input.empty ? { ...requested } : {
      width: current.effectiveFit.width ? current.textPanelRect.width + left + right + button : requested.width,
      height: current.effectiveFit.height ? current.textPanelRect.height + top + bottom : requested.height,
    }
    function minimumMax(proposed: SelectionLayoutSize): SelectionLayoutSize {
      const minimum = services.readMinimumSize(context())
      size(minimum, 'minimum')
      emit('minimum.read', { size: { ...minimum } })
      const answer = { width: Math.max(proposed.width, minimum.width), height: Math.max(proposed.height, minimum.height) }
      size(answer, 'validatedSize')
      return answer
    }
    function setSize(requested: SelectionLayoutSize, allViews: boolean, notify: boolean) {
      // uJ0j performs two distinct minimum reads, surrounding NIuy/KNZn.
      const next = minimumMax(fitSize(minimumMax(requested)))
      if (same(next.width, current.ownerRect.width) && same(next.height, current.ownerRect.height)) return
      if (notify) emit('NJ01')
      current.ownerRect = { ...current.ownerRect, ...next }
      // notify gates NJ01, not the lower provider write or EIuw notification.
      emit('style.Size', { ...next, allViews, notify: true })
      invalidate()
      enterLayout(true)
      emit('size.changed')
    }
    function setLocation(next: SelectionLayoutPoint) {
      point(next, 'candidateLocation')
      const old = current.ownerRect
      if (same(next.x, old.x) && same(next.y, old.y)) return
      const diagram = { x: current.locationInDiagram.x + next.x - old.x,
        y: current.locationInDiagram.y + next.y - old.y }
      point(diagram, 'candidateLocationInDiagram')
      emit('NJ01')
      current.ownerRect = { ...old, ...next }; current.locationInDiagram = diagram
      emit('style.Location', { ...next, allViews: false, notify: true })
      invalidate(); emit('location.changed')
    }
    function measure(constraint: SelectionLayoutSize) {
      // A negative available width is not silently clamped. The source passes
      // it to graphics; this adapter rejects a resulting negative panel size.
      finite(constraint.width, 'measurement constraint.width'); finite(constraint.height, 'measurement constraint.height')
      const pass = measurementPasses++
      emit('measure', { index: pass, constraint: { ...constraint } })
      let measured: SelectionLayoutSize
      if (current.effectiveFit.width) {
        const flag = !input.editingText
        emit('graphics.measure', { index: pass, width: 10000, flag })
        measured = services.measureText({ pass, constraint: { ...constraint }, width: 10000, flag }, context())
        size(measured, 'graphics measurement')
      } else {
        let height: number
        if (input.editingText) height = services.readEditorHeight!(context())
        else if (input.empty) height = 16
        else {
          emit('graphics.measure', { index: pass, width: constraint.width, flag: true })
          const answer = services.measureText({ pass, constraint: { ...constraint }, width: constraint.width, flag: true }, context())
          size(answer, 'graphics measurement'); height = answer.height
        }
        measured = { width: constraint.width, height }
        size(measured, 'measured panel size')
      }
      const next = { width: roundAway(measured.width), height: roundAway(measured.height) }
      const old = current.textPanelRect
      if (!same(old.width, next.width) || !same(old.height, next.height)) panelWrite({ ...old, ...next })
      emit('panel.measured', next)
    }
    function placePanel() {
      emit('WIyL')
      const panel = current.textPanelRect
      const short = panel.height < button
      let y = 0
      if (short) y = input.verticalAlignment === 'top' ? top : input.verticalAlignment === 'middle'
        ? (button - panel.height + top - bottom) / 2 : button - panel.height - bottom
      const location = { x: roundEven(left + (alignRight ? 0 : button)), y: roundEven(y) }
      if (!same(panel.x, location.x) || !same(panel.y, location.y)) panelWrite({ ...panel, ...location })

      const inset = services.convertIndicatorInset({
        sourceSpace: 2, targetSpace: 0, size: { width: 2, height: 2 },
      }, context())
      size(inset, 'converted indicator inset')
      emit('graphics.convert-size', { sourceSpace: 2, targetSpace: 0,
        input: { width: 2, height: 2 }, answer: { ...inset } })
      const owner = current.ownerRect, text = current.textPanelRect
      let indicatorY = owner.y
      if (!input.empty && !short) {
        const diagramTop = text.y + current.locationInDiagram.y
        indicatorY = input.verticalAlignment === 'top' ? diagramTop + inset.height
          : input.verticalAlignment === 'middle' ? diagramTop + text.height / 2 - button / 2
            : diagramTop + text.height - inset.height - button
      }
      const indicator = { x: owner.x + (alignRight ? owner.width - button : 0),
        y: indicatorY, width: button, height: button }
      rect(indicator, 'indicatorRect')
      emit('indicator.rect', { rect: { ...indicator } })
      // WIyL uses Location minus panel local Location here. It does not union
      // panel.RectInDiagram; XNUc above has a different coordinate read.
      const textRect = { x: owner.x - text.x, y: owner.y - text.y, width: text.width, height: text.height }
      rect(textRect, 'text union rectangle')
      const union = services.unionRectangles({ ...indicator }, textRect, { ignoreEmpty: true }, context())
      rect(union, 'rectangle union')
      const next = { width: owner.width, height: short ? button : union.height }
      emit('uJ0j.request', { ...next, guard: current.guard })
      setSize(next, false, true)
    }
    function layout(force: boolean) {
      if (current.guard) return
      current.guard = true; emit('guard', { value: true })
      try {
        if (force) {
          const reference = { ...(current.styleEditorReference ?? current.ownerRect) }
          if (current.effectiveFit.width) measure({
            width: current.textPanelRect.width, height: current.textPanelRect.height,
          })
          else if (current.effectiveFit.height) measure({
            width: current.ownerRect.width - left - right - button, height: 1,
          })
          const nextSize = fitSize(reference)
          size(nextSize, 'fit candidate')
          const adjustment = (oldValue: number, newValue: number, align: string) =>
            same(oldValue, newValue) ? 0 : align === 'center' || align === 'middle'
              ? Math.floor(oldValue / 2) - Math.floor(newValue / 2)
              : align === 'right' || align === 'bottom' ? oldValue - newValue : 0
          const next = { x: reference.x + adjustment(reference.width, nextSize.width, input.horizontalAlignment),
            y: reference.y + adjustment(reference.height, nextSize.height, input.verticalAlignment), ...nextSize }
          rect(next, 'fit rectangle')
          emit('YJ0S.request', { rect: { ...next }, allViews: false })
          emit('uJ0j.request', { ...nextSize, guard: current.guard })
          setSize(nextSize, false, true)
          setLocation({ x: next.x, y: next.y })
        }
        measure({ width: current.ownerRect.width - left - right - button, height: 1 })
        placePanel()
        invalidate()
      } finally {
        emit('finally.dispose')
        current.guard = false; emit('guard', { value: false })
      }
    }
    function enterLayout(force: boolean) {
      emit('OI8Z.enter', { force, alreadyGuarded: current.guard })
      layout(force)
    }

    if (entry.kind === 'size') setSize(entry.size, entry.allViews, entry.notify)
    else if (entry.kind === 'fit') {
      if (current.rawFit[entry.axis] !== entry.value) {
        current.rawFit[entry.axis] = entry.value
        // No effective Transform is admitted; changing the shared flag changes
        // its effective getter before the ensuing layout reads it.
        current.effectiveFit[entry.axis] = entry.value
        emit('fit.flag', { axis: entry.axis, value: entry.value })
        enterLayout(true)
      }
    } else if (entry.kind === 'alignRight') {
      // SelectionButton.set_AlignRight calls WIyL directly. Only a changed
      // Size can reenter OI8Z; do not proactively remeasure the existing panel.
      if (alignRight !== entry.value) {
        alignRight = entry.value
        emit('alignRight.flag', { value: entry.value })
        placePanel()
        emit('VJm0', { value: false, property: null })
      }
    } else if (entry.kind === 'textChanged') {
      // RNO1 has restored its temporary pNOC by this point. Unlike vNOg,
      // its iIyW(false) tail is not skipped by an already-set pNOC flag.
      // The following VJm0 belongs to RNO1, not to iIyW(false).
      emit('panel.style-refresh', { notify: false })
      enterLayout(true)
      emit('VJm0', { value: false, property: null })
    } else if (entry.kind === 'styleChanged') {
      // SelectionButton.MIue checks P94 before TextRectObject's notify,
      // recursion, containment and singleton-Location gates. It requests the
      // previous panel width, then the ordinary Size validator uses new style.
      if (entry.changedKeys.includes(94) && !input.empty && button > current.ownerRect.width) {
        const requested = { width: button + current.textPanelRect.width, height: current.ownerRect.height }
        emit('uJ0j.request', { ...requested, guard: current.guard })
        setSize(requested, false, true)
      }
      if (entry.notify && !current.guard && !entry.contained &&
          !(entry.changedKeys.length === 1 && entry.changedKeys[0] === 101)) {
        // BNZT -> vNOg clears native panel caches and invokes iIyW(false)
        // only outside editing/pNOC. Services here are fresh reads, not those
        // native caches. The virtual callback forces layout before INOc(true).
        if (!input.editingText && !input.panelChangeGuard) {
          emit('panel.style-refresh', { notify: false })
          enterLayout(true)
          emit('panel.invalidate', { deep: true })
        }
        enterLayout(false)
      }
      emit('style.changed.base')
    } else layout(entry.recalculateFit)
    return { ok: true, state: copyState(current), effects, measurementPasses }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error), effects,
      measurementPasses, ...(state ? { diagnosticPartialState: copyState(state) } : {}) }
  }
}
