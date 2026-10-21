# Selection adaptive SVG: original entry and browser geometry evidence

Target: Axure RP 11.0.0.4150, ordinary uncontained, noncompound Checkbox and RadioButton. Recorded in headless Edge 155.0.4283.62 on 2026-10-21. The complete retained `style.js` and `adaptive.js` modules execute with original jQuery and page CSS. The ordinary noncompound `convertToSingleImage` gate is retained from `math.js`. No product code supplies expected results. No native DLL, original GUI, configuration change or product modification is involved.

The primary result is **58/58 independently verified sequences, 292 steps and 306 actual SVG calls** in `selection-adaptive-svg-probes-final.json`, SHA-256 `f95272000dfcc934afbbb6ac364d12d435387862c4e6de76620d3c8d14bd921d`. The separate original-module numerics result has **8/8 verified sequences and 36 steps**. Browser CSS controls separately record two origin snapshots, six assignment cases, 21 rounding cases and six exact-midpoint cases. Earlier 36- and 56-sequence files are retained predecessors and are not added to the final coverage count. `selection-adaptive-svg-manifest.json` binds all source, dependency, script and output bytes.

## Actual view-switch contract

For the proven owner > label > SVG ancestry, scale is an event-history value. It is not universally equal to current-view size divided by base size.

| Entry | Observed ordinary-control behavior |
| --- | --- |
| Initial Base via public initialization | No switch, helper or SVG call from adaptive initialization. Separate widget-state initialization is not part of this entry. |
| Initial named view | One real switch and one `setAdaptiveStyle` call per object. |
| Public selection of the same view ID | `_switchView` returns before reset, repaint or helper; zero extra SVG calls. A forced same-view notification also returns after its post-view notification in the retained source. |
| Different named view | Reset owner and immediate children; clear previous adaptive paint; add new view class; compute sparse overrides; call `setAdaptiveStyle`. Previous adaptive paint may add a separate SVG call. |
| Named view to Base | Clear adaptive paint and remove the old class; do not call `setAdaptiveStyle`. Nested SVG transform and origin survive. |
| Direct `applyView` for the same view | Calls the helper again and can multiply scale again. This is a distinct entry from the public same-view setter. |
| Ordinary selected/disabled state apply | Repaints SVG style but leaves root scale and origin intact. |

`adaptive.js:69-87` clears owner and `query.children()` inline top/left/width/height/transform. It does not recursively clear the SVG inside the label. The retained CIL projection proves the ancestry: pNPt **100699649** invokes label-open rNCc **100699510**, indicator uNCx **100699516**, text fNPD **100699662**, label-close gNCW **100699511**, then JNCt input **100699500**. Frozen `selection-layout-render-dom-probes.json`, `selection-layout-indicator-dom-detail-probes.json` and the new `selection-svg-bounds-evidence.md` are included in this manifest.

The direct-SVG-child fixture is a deliberate negative control: it is reset by the same original switch code and returns to identity on Base. It must not be used as the model for native selection ancestry.

For base owner size 100 × 24, an actual named view of 200 × 72 yields scale(2,3). Public same-ID selection preserves it. Direct applyView of that same view yields (4,9); switching to 150 × 24 yields (6,9); switching to 100 × 48 yields (6,18). An empty view, a P94-only view, state paints and return to Base preserve (6,18). Initial named (2,3) → Base → the same named view yields (4,9).

## Helper arguments, origin and dimensions

The entire `setAdaptiveStyle` at `style.js:2377-2416` executes unchanged. It records adaptive style, applies text when a text panel exists, locates `id_img`, requires an SVG, then calls `_applySvg` before its size branch. The controlled ordinary fixtures declare no text panel; rich-text measurement is not replaced with an inferred layout result.

When the supplied `style.size` is truthy and friendlyType is not Rectangle, the helper:

1. Reads `_computeFullStyle(id, NORMAL, "").size`. The explicit empty view ID selects the base full style. The denominator is neither asset viewport size, current owner DOM size, the previous view size, nor the last scale.
2. Writes inline `transformOrigin = 'top left'`.
3. Reads `new WebKitCSSMatrix(getComputedStyle(svg).transform)`.
4. Computes `rawX = (style.size.width / baseWidth) * old.m11` and the corresponding Y expression, in that operation order.
5. Writes `Scale(rawX, rawY)` only if either component differs from its old computed component.

The object's original `style.size` remains unchanged in every recorded sequence. `_computeFullStyle` and the precise helper argument are both saved in every snapshot. Initial ratio 1 writes only origin and leaves transform absent. An existing (2,3) multiplied by (0.5,1/3) writes an explicit (1,1) transform; a later ratio-1 call leaves that declaration present.

The prior/leaf adaptive merge is shallow. Parent size `{width:200,height:72}` plus a leaf containing only P94 preserves that complete size. A leaf size `{width:150}` replaces the whole parent size; it does not receive the parent's height. Normal object size is not automatically inserted into sparse helper arguments. Empty/P94-only views without inherited or state size therefore do not scale. A selected-state size can supply the helper size on the next adaptive entry even when the new view itself is empty; changing that selected state alone does not scale.

The native generator's ability to emit sparse half-axis `size` JSON has **not** been established. A product schema with independent width/height patches may deliberately reconstruct a complete size carrier, but that is a schema bridge, not a native half-axis observation. The probes distinguish full sizes where only one value changes from genuinely partial size objects.

Absent size and falsy size values 0, false and null do not write origin or transform. Truthy `{}` and partial size objects write origin, then generate nonfinite scale text which the browser rejects as a whole; prior transform remains. Valid zero-axis sizes produce true zero scales. Once an axis is zero, later finite multiplication keeps it zero. A zero base denominator produces Infinity/NaN and rejected scale text after origin has been updated. No clamp-to-one or automatic identity restore is justified.

## Asset viewport, positioning and browser boxes

The primary carrier now follows the separately proven ordinary inline-root envelope: source b14/border1 gives **15px CSS width/height**, and uNCx copies no width, height or invented viewBox attributes. The DOM stays owner > absolute label > inline SVG. Earlier probes with a 14px attributed/viewBox root are retained explicitly as predecessor/negative controls. Native body/path translation remains open; the probe's constructed paths are declared fixtures, not a native asset serialization claim.

The helper does not set selection SVG left/top/width/height. Its width/height assignment branch is specific to friendlyType Rectangle and is not reached for these controls. The asset attributes, root and path identities stay stable in the recorded sequences. At scale(2,3), the primary 15px CSS viewport has an actual browser bounding box of 30 × 45; CSS viewport changes and transform changes are separately recorded.

Generated view classes are added **before** the adaptive helper is called. The declared view-CSS carrier shows new SVG left/top/width/height already visible in `adaptive-enter.before`. Origin is then written before transform; MutationObserver old/new style records preserve that order. The helper leaves these CSS dimensions and positions unchanged. If an SVG has inline left/top from an earlier controlled operation, owner/label reset does not clear them; they continue to override view CSS. Owner and label inline positions are cleared, while nested SVG inline positions survive.

AlignRight is an upstream indicator-placement concern. The independent bounds evidence closes logical left = owner width minus b for the right branch, before asset padding. This probe tests both declared left/right position carriers and confirms the adaptive helper does not introduce another alignment adjustment. Absolute 3/83/183/133px fixture offsets are explicit inputs, not claimed native measurements. Native generated view CSS, text measurement, body translation and final asset crop require the separate layout/bounds evidence.

Fresh primary SVG computed origin is 7.5px 7.5px for its 15px viewport until the helper writes top left. A separate 14px root control gives 7px 7px before and after loading the original page CSS. The retained original page CSS has no transform-origin rule. Thus the initial center in these browser carriers comes from browser CSS behavior; the later top-left origin comes from the helper, not from a newly discovered original stylesheet rule.

## Computed-style precision is part of the sequence

The source rereads the **serialized computed transform** on every qualifying call. Retaining raw doubles and multiplying them indefinitely changes later results. Conversely, writing only the serialized six-digit numbers to the renderer loses the finer value the browser actually uses for that current paint.

Four different named views with the same 133.3 × 31.7 size over base 100 × 24 produce these actual readback pairs:

| Entry | computed m11 | computed m22 |
| --- | ---: | ---: |
| 1 | 1.333 | 1.32083 |
| 2 | 1.77689 | 1.7446 |
| 3 | 2.36859 | 2.30433 |
| 4 | 3.15733 | 3.04364 |

The first screenCTM pair is approximately (1.3329999446868896, 1.3208333253860474), reflecting the actual float32 paint values rather than the six-digit readback. The independent module verification computes raw next values from the recorded pre-call WebKitCSSMatrix and confirms the resulting screenCTM. Keep the raw value submitted for current DOM paint separate from the browser-equivalent value used as the next multiplication's input.

CSS controls close two tempting but incorrect shortcuts:

- Raw `toPrecision(6)` matches only 11 of 21 rounding controls. Float32 conversion must precede serialization: 1.234565 reads back 1.23457, 2.000005 reads back 2.00001, and 0.0001234565 reads back 0.000123456.
- `Math.fround(raw).toPrecision(6)` still differs at exact midpoint cases because JavaScript's midpoint policy differs. Chromium reads 1.015625 as 1.01562, 123456.5 as 123456, and -1.015625 as -1.01562. It reads 1.046875 as 1.04688 and 123457.5 as 123458, consistent with **six significant digits, nearest with ties to even** after float32 conversion.

For the 21 controls, float32 plus JavaScript six-digit conversion matched 19 cases; the two remaining finite extremes (1e40 and 1e308) were accepted and clamped to float32 maximum, then serialized as 3.40282e38. They are different from textual Infinity/NaN, which CSS rejects. This bounded Chromium evidence does not establish a universal formatter for every number, transform composition or browser. A product implementation must state its supported finite range and midpoint handling rather than claim generic floating-point equivalence.

## Resize and other lifecycle boundaries

Static handoff only: `axQuery.std.js:570-803` has a different Resize chain. It gets the current query size at 595-597, processes immediate child sizes/offsets at 666-703, and selects **`query.children('svg.img')`** at 706. Its 710-715 scale uses new size/current size and existing computed scale, with immediate/animated writes later at 742/782. The native selection SVG is nested in a label, so this immediate-SVG list is empty for the proven carrier. Do not automatically apply that SVG branch to selection controls. Queue execution, label resizing and animation were not expanded here.

`repeater.js:316` calls adaptive.applyView only when a current view ID is truthy. The existing asset evidence separately describes retained versus reconstructed item DOM. This investigation does not execute complete repeater refresh, nested row, hidden/unplaced, inactive-panel, master/contained or image-compound lifecycle combinations. The helper has no visibility gate beyond the SVG's existence, while `_applyAdaptiveViewOnObject` has its isContained gate; those static facts are not a replacement for the missing combined runtime probes.

## Data and provenance

`results[].input` declares type, alignment, original owner size, adaptive style map, parent chain, fixture CSS and steps. Each `actual[]` entry contains the exact step, before/after snapshots, original helper arguments, actual full style sent to `_applySvg`, class operations and ordered DOM mutations. Snapshots separate owner/label/SVG CSS and bounding boxes, original object size, base/current full styles, sparse overrides, viewport attributes, SVG getBBox, screenCTM and identity checks. Numeric snapshots additionally record the exact WebKitCSSMatrix fields used by the source. Page-service/repeater/layout callback sinks are explicitly declared and traced.

Key original anchors: adaptive.js 48-159 switch, 245-317 applyView/object entry, 707-750 public initialization/setter; style.js 1794-1879 override/full-style resolution and 2377-2416 helper; math.js 151-153 and 169-201 noncompound conversion gate; axQuery.std.js 570-803 Resize. Original style.js SHA-256 remains `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`. Exact original paths, all remaining hashes and byte counts are in the manifest.

Failures remain separate: the first adaptive harness had an unescaped newline in a generated script; no matrix result was accepted from it. The first numerics harness cut its imported module at a nested marker string; no browser/original module executed. Its raw diagnostic accidentally retained a literal newline suffix and is preserved alongside a separately normalized JSON copy. Corrected scripts and passing results have new names. Historical files were not overwritten. These are harness failures, not Axure/product failures.
