# Selection-control solid paint and SVG update lifetime

Target: Axure RP 11.0.0.4150. This investigation extends existing indicator evidence with alpha/zero-width/state sequence observations. It edits no product implementation and no frozen evidence. The original DLL is read as ECMA-335 metadata/CIL, never loaded or executed. The browser executes retained original JavaScript against constructed SVG fixtures; no original GUI or complete generated Axure project is tested.

**The opaque-only restriction is a product boundary, not an established Axure restriction.** The source accepts non-null solid colors with alpha zero or fractional alpha. Zero outline width and a checkbox's independent tick width are separate values. Implementing state changes requires tracking the original runtime's conditional writes; accepting more color strings alone does not close the existing runtime paint gap.

## Source identity and methods

The original DLL SHA-256 is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. `style.js` is `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`. Full paths and hashes, including every reused CIL adapter dependency, are in `selection-paint-manifest.json`.

| Source | Binding | Established behavior |
|---|---|---|
| SelectionButton.TIdc | 100702041; IL 0x669–0x675 and 0x626–0x62d | Effective BorderFill enters local12 and is passed directly to SIll; no width/alpha-to-null filter lies between these assignments/calls. |
| Checkbox.SIll / RadioButton.SIll | 100699787 / 100701393 | Pass disabled flag and supplied BorderFill to B9HX / V9Hm. |
| N95X.B9HX / V9Hm | 100710703 / 100710704 | Non-null fill is used; only null chooses disabled/normal theme. Checkbox width is `(b/14)*3`; radio is a brush-only dot. |
| uHV0.gIQJ | 100723090 | Return stored color field 67135106 unchanged, including alpha data. |
| uHV0.b3bV | 100723099 | Get the same color and construct the solid brush; no disabled or opacity gate. |
| t5Oz.op_Equality | 100720817 | Null/equality check; transparent is not the null branch. Object equality remains a declared sink in the glyph replay. |
| style.js::_getColorFromFill | 2503–2516 | Solid fill alpha is explicit `fill.opacity`, default 1. Packed color high byte is not used here. |
| style.js::_getColorFromArgbColorProp | 2518–2528 | A different carrier: packed high byte /255 supplies alpha. |
| style.js::_applySvg | 991–1645 | Solid paint overrides, generic width mutations, checkbox mark width, radio mark fill. |

`uHV0`'s solid-color role is also bound by the retained gradient-format generator/serialization dispatches. The new replay uses its actual getter/brush instructions, replacing the older glyph probe's color/brush property facades. Native pen/brush objects, graphics sinks, structs, and theme inputs remain declared substitutes. No claim of native raster or SVG serialization equivalence is made.

## Initial paint

`selection-paint-glyph-probes.json` records **40/40** retained-CIL cases: two control types, sizes14/18, disabled on/off, and fill null or alpha0/1÷255/0.5/1. Non-null color structs pass unchanged to checkbox pen or radio brush, regardless of disabled flag. A transparent non-null stroke therefore makes the corresponding mark transparent; it does not request theme color.

For null supplied fill only, disabled controls use the labeled disabled-theme input and enabled controls the normal-theme input. The actual application theme lifecycle/palette is not reconstructed by these cases. Source TIdc's direct effective BorderFill route supports keeping explicit non-null colors independent of disabled state; it does not justify inventing opacity reduction for disabled controls.

The previous frozen border replay already covers widths0/1/2/3/5. It establishes full fill geometry and half-width-inset outline geometry within `b>w>=0`; new paint research does not extend oversized widths, corner or shadow coverage. Initial radio dot is fill-only, with `stroke:none` and no mark stroke-width. Initial checkbox tick width depends on b, not outline width. These initial graphics facts are distinct from the later runtime consumer.

## Runtime mutation sequence

`selection-paint-runtime-probes-second.json` records **24/24** original-JavaScript sequences (two control types × initial outline widths0/1/3 × selected on/off × disabled attribute on/off), **216 SVG observations**, plus **12/12** color-carrier cases. The entire retained `_applySvg` function and color helper slices execute in Edge with retained jQuery and base CSS. Initial geometry/classes/paint and normal-style lookup are controlled fixture inputs. State resolution, generated asset selection, native rendering and complete P94 updates are not invoked.

Each sequence starts from an independently constructed initial asset and performs these eight updates:

| Update | Outline width after update | Checkbox mark width | Radio mark width | Paint |
|---|---:|---:|---:|---|
| Opaque, borderWidth2 | 2 | 3 | 2 | Supplied solid colors |
| Alpha, borderWidth3 | 3 | 3 | 3 | Fill alpha0.35; border/mark alpha0.5 |
| Same alpha, borderWidth0 | 3 | 3 | 3 | Same supplied colors |
| linePattern none | 0 | 3 | 0 | Same supplied colors |
| Transparent non-null, width2 | 2 | 3 | 2 | Explicit rgba alpha0 |
| Absent fill/borderFill, width1 | 1 | 3 | 1 | Initial color attributes; radio stroke:none |
| Null fill/borderFill, width0 | 1 | 3 | 1 | Initial color attributes; radio stroke:none |
| Restore opaque, width2 | 2 | 3 | 2 | Same as first update |

The table's checkbox b is14. CSS widths are computed values, not proof that a hidden/transparent path paints pixels.

The precise mechanism is important:

1. Every `_applySvg` call rebuilds and replaces `svg.style.innerHTML`; style text from the previous call does not remain.
2. Nonzero `borderWidth` with ordinary solid pattern visits all `.stroke` paths and **sets their `stroke-width` presentation attribute** (lines1342–1347). It also writes the current generic CSS width. Both outline and mark have this class. The fixture has no mask; the source's masked-and-closed double-width branch remains out of scope.
3. A zero `borderWidth` fails the truthiness guard. It writes no new width attribute or generic width CSS, so the last written width attribute persists. This is history-dependent. Starting directly with width0 would use the initial asset attribute/default, which is a different history from width3→0.
4. `linePattern:'none'` writes generic width0 in CSS without modifying stored width attributes. Checkbox's later, more specific `.stroke.btn_check` width still overrides it with `3*obj.buttonSize/14`. Radio has no analogous width override.
5. Solid BorderFill changes generic stroke color via CSS. For radio it additionally changes mark fill via a specific selector. It does not rewrite initial color attributes. If the next invocation omits BorderFill or supplies null, the rebuilt CSS omits those color declarations, exposing the original color attributes again. Transparent non-null supplies a real rgba(...,0) declaration and therefore does not fall back.
6. Missing/zero/transparent fill does not alter mark geometry. The supplied full state style determines colors; merely setting the native input's disabled attribute does not add a color transform inside this function.

The initial fixture's radio is fill-only. Once a real invocation supplies solid BorderFill, generic `.stroke` sets radio mark stroke as well as the radio-specific mark fill; width follows the generic rule. This is why repainting every DOM refresh with a single static rule cannot claim both initial and runtime equivalence.

## Mapping to product source/current lifetime

Treat initial authored/generated asset paint separately from a proven runtime style application. Preserve initial fill/stroke presentation colors. Track mutable stroke-width state independently, since nonzero widths update it while zero leaves it unchanged. Replacing the runtime override CSS should remove absent-color declarations, not convert null to transparent or retain the previous color. Reinitializing a genuinely new source/asset resets these attributes.

Do not trigger this stateful path merely because `current` exists or object identity changes. Original `SetWidgetEnabled` (style.js259–269) records disabled, then returns when no disabled state style exists. `SetWidgetSelected` likewise has an `alwaysApply || widgetHasSelectedState` gate before `_applyImageAndTextJson`. The latter invokes `_applySvg` at line1664. Full call eligibility across adaptive/state/action/initialization still needs caller-level integration evidence; this report does not define a universal equality heuristic for the product's source/current API.

## Limits and failure provenance

This proves ordinary solid colors, not arbitrary CSS color grammar, currentColor, gradients/images, partial borders, shadows, radius, masked paths, all state providers, regenerated asset geometry or original GUI/pixel equality. Browser alpha0 and alpha0.5 declarations were observed; input syntax conversion into the project's independent CSS model remains implementation work.

The first runtime probe incorrectly asserted that all presentation attributes remain unchanged. Its original script and failure JSON are retained; the exact original function disproved that assumption by mutating `stroke-width`. The successful second script changes the expectation and retains the original function unchanged. Initial static reasoning reported to the parent about width0 falling back to the pristine asset was explicitly withdrawn after this failure; the successful sequence establishes last-written-width behavior.

The first glyph probe used JavaScript `3*b/14` as an exact expected value, while retained CIL executes `(b/14)*3`; at b18 these differ by one floating-point rounding step. The first script is preserved, and the second matches the source operation order. This is a harness expectation failure, not a native/product defect.

A failed extraction invocation passed an array to a single-TypeName parameter, before target parsing. Its empty output path is retained and excluded from positive evidence. Four subsequent per-type extractions succeeded. No frozen report was rerun or overwritten.
