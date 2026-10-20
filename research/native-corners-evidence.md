# Native corner radius and visibility

This investigation uses the retained Axure RP 11.0.0.4150 distribution. It does not execute the original DLL, operate the original GUI, modify product source, or overwrite earlier research. The JavaScript results are **281 exact-source Node VM cases with explicit object/DOM/CSS sinks**. The additional **512 cases interpret a bounded prefix of retained CIL**; they are not observations of the native application's renderer. No original generated page or GUI pixels were obtained during this work.

## Implementable contract

Native **P71 is one uniform Double radius**. **P81 is one independent Position mask**, not four radii. The proven corner order is top-left, top-right, bottom-right, bottom-left, with native bits **1, 2, 4, 8** and runtime string labels **left, top, right, bottom** respectively. This differs from the border-side interpretation of Position: top/right/bottom/left use bits 2/4/8/1.

An independent `cornerVisibility: [TL, TR, BR, BL]` Boolean tuple can represent P81 without inventing per-corner native radius values. Radius and visibility must remain separately inherited and edited properties. The reconstruction's existing `cornerRadii[4]` is an independent extension and explicit vector control points remain geometry; neither should silently become another name for P81.

The companion raw-format census found all eleven DesignDocument default styles explicitly carry P71=0 and P81=15. These are **document default observations**, not a local fallback implemented by the JavaScript painter. The painter uses `.includes` directly on the completed style's mask strings: absent mask fields throw in active branches, while an explicit empty string means no corners. A consumer must distinguish missing/inherited P81 from explicit mask0. See `native-corners-format-census.json` and the companion `native-corners-format-evidence.md` for sample IDs and cache provenance.

## Dynamic SVG rectangle update

The authoritative source is `style.js` SHA-256 `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`, specifically the nested `setBorder` rectangle branch at lines 1228–1340. It runs only when `friendlyType === "Rectangle"`, the border-width truthiness gate is entered, and the earlier line-pattern-none branch has not intercepted the update. This does not authorize rewriting arbitrary vector paths, ellipses, or all widgets that happen to have a radius field.

Let the four border flags be T/R/B/L and corner flags TL/TR/BR/BL. Radius must be greater than zero for any corner to be active.

* Stroke eligibility is corner-mask AND both adjacent borders visible: TL requires L&T, TR T&R, BR R&B, BL B&L.
* Fill eligibility is corner-mask AND adjacent border flags equal: TL requires L==T, and so on. Thus two hidden adjacent sides can retain a rounded **fill** corner. One visible and one hidden side makes that fill corner square.
* Width and height are first rounded with `Math.round`.
* Radius is capped to half the height only if both active stroke corners on the left or on the right are present. It is capped to half the width only if both active stroke corners on the top or on the bottom are present. Otherwise that axis permits the entire dimension. The minimum of requested radius and these two ceilings is used. A single or diagonal pair can therefore exceed half the smaller dimension.
* Fill eligibility is recomputed after stroke construction, but **the already stroke-clamped radius is reused**. The fill pass does not recalculate the ceilings. This is a source-level and executable runtime quirk, not a general idealized rounded-rectangle rule.

Visible stroke edges are inset by half the requested uniform border width; invisible edges use the outside boundary. Curves use coefficient 0.44: fill controls use radius×0.44, while inset stroke controls use `(radius-halfWidth)×0.44+halfWidth`. The branch does not clamp a small positive radius upward to half the border width. Hidden edges produce disconnected stroke pieces; only all-visible sides close the stroke. Fill always closes. Both paths have their previous mask attribute cleared.

Examples at 200×100, requested radius90, stroke width10:

| Corner mask | Borders | Dynamic used radius / result |
| --- | --- | --- |
| TL only | all | 90; one large corner |
| TL+BR | all | 90; diagonal corners |
| TL+BL | all | 50; same-column restriction |
| all | all | 50 |
| all | none | stroke empty; fill retains radius90 and can overlap its own corner regions |

`native-corners-runtime-probes.json` provides exact `strokeD` and `fillD`, not just corner counts. Its first 256 entries cover the complete corner×border mask matrix. The harness's `borderMask` packs TRBL as bits1/2/4/8 for iteration; `matrix.nativePositionBorderBits` explicitly records the native 2/4/8/1 mapping. Corner masks use native bits directly.

Additional cases cover large radii, fractional size rounding, radius0, a negative-radius diagnostic input, width0, line-pattern none, nonrectangle geometry, missing div/mask fields, stale class removal, selected/hover radius-versus-mask composition, and explicit zero/empty state values. Negative radius is a probe of retained code, not a recommendation to accept it in the product schema. Width0 and line-pattern none leave prior SVG geometry in these isolated update calls; this report does not claim initial width0 rendering behaves identically.

## CSS div and image distinctions

`_updateCornersForBorders`, `style.js` lines 935–962, finds the widget's `_div`; a missing div is a no-op. It first removes all four `nocrn*` classes. For a positive radius it applies the **fill eligibility** rule above and adds a disable class for each ineligible corner. It does not calculate a numeric radius, inspect dimensions, or perform the SVG clamp. Radius0 clears old disable classes without requiring mask strings.

The retained `axure_rp_page.css` lines331–345 define these classes as individual corner radius `0px !important`. The other corners retain the existing CSS radius. Browser CSS radius normalization therefore remains a different path from the dynamic SVG cubic construction, especially for oversized radii.

The initial CSS writer is also boundedly identified. `JNLP.cNK1` token100699253, IL02B7–02D9, checks the radius property override and passes its value through `FNKB` token100699240. `FNKB` constructs `border-radius` with `QbLj` token100688629; the latter formats the Double and appends `px`, without a dimension clamp. At IL02DE–0321, the visibility-property override selects either the requested border mask or the owner border mask, then calls `lNKV` token100699241. Its four branches apply the same mask/equality tests and emit the corresponding `border-*-radius:0px` for disabled corners. New `native-corners-css-literals.json` decodes those exact strings from the retained resource and CIL; no target assembly is loaded. This is a specific initial/override CSS route, not proof of every concrete widget's complete generator cascade.

The image update path at `style.js`770–774 sets one uniform `border-radius` on its image/border queries when radius is truthy. That small path does not read P81. The generic class updater requires `_div` to exist, and this work does not claim all generated image structures provide it. Thus the true raw Image radius5/mask0 example in the format census is not evidence that dynamic image updates honor the same mask contract as Rectangle SVG. Initial image rendering, arbitrary form/container capabilities, and element clipping need separate type-specific proof.

## Managed geometry is related but not identical

Metadata and setter bodies establish the carriers without relying on names alone:

| Method | Token | Evidence |
| --- | --- | --- |
| `ituB.TtyS` | 100717378 | Writes key71, boxed Double |
| `ituB.StyA` | 100717428 | Writes key81, boxed Position |
| `KJm7.hJOT` / `lJUj` | 100695581 / 100695599 | Read effective provider radius / corner mask |
| `VectorShape.jN4k` | 100702679 | Caps radius by both dimensions, passes shape, border width/mask, corner mask to factory |
| `L5vW.w5Qk` | 100722530 | Rectangle-family dispatch to `i5vf` / `b5QE` |
| `L5vW.i5vf` | 100722498 | General rectangle coordinates, corner/side eligibility and dimension ceilings |
| `L5vW.b5QE` | 100722529 | Calls coordinate builder separately for stroke and fill with the original side mask supplied to the fill branch |

`cSqL` bit predicates independently corroborate the corner mapping. `ISOr` delegates to Position Left1, `ASOF` to Top2, `iSOj` to Right4, and `lSOb` to Bottom8. The coordinates following these predicates identify TL/TR/BR/BL; this is not an inference from enum order.

The new bounded replay executes `i5vf` entry through IL01C4, including actual decoded branches and helper bit-predicate instructions. External sinks are limited to known Rect Width/Height getters, Nullable value access, Enum.HasFlag and Math.Min. The rectangle getter identities are separately recorded by metadata. All 512 stroke/fill flag-and-clamp cases pass independent expectations. It deliberately stops before point construction, path coalescing, painting, SVG output and GUI display.

The managed fill pass in `b5QE` invokes `i5vf` separately with all fill sides enabled and the original border mask in its nullable parameter. Consequently it can recompute a different fill radius ceiling: for all corners, all borders hidden, 200×100 and radius90, this prefix produces radius50 for the fill call, while dynamic `style.js` keeps90. **Initial managed geometry and later JavaScript repaint are not claimed pixel-identical.** The managed builder also has later offset/minimum-radius logic outside the bounded replay; this report does not replace it with the JavaScript formula.

## Authoring, inheritance and All Views

The prior frozen `adaptive-all-views-authoring-evidence.md/json` establishes ordinary authoring's per-owner GetEdit filter against current effective values, followed by key-level Base write and clearing of the corresponding keys in every adaptive map, including inactive ones. A request equal to the current determined value produces no ordinary edit and does not clear maps. Multi-selection processes each owner separately.

P71 and P81 have separate setters and property identities. A radius edit does not by itself justify clearing or replacing P81, nor does a mask edit justify clearing P71. Within P81 the four flags are one native atomic value. No evidence here supports four independent native radius properties. Parent-child selections, contained-owner delegation, and special widget capability handling remain as bounded in the earlier authoring report. Exact GUI numeric control command dispatch was not newly observed.

The JavaScript composition cases confirm a selected mask patch and a hover radius patch coexist independently, explicit selected mask `""` survives, and explicit selected radius0 survives while the mask remains inherited. Existing state whole-map selection and property override rules are unchanged; this phase does not redefine them.

## Scope and acceptance

The defensible product contract is independent uniform radius and corner-mask metadata, strict supported rectangle recognition, no alteration of arbitrary edited paths, and independent inheritance/All Views clearing. A renderer may provide a broader supported surface than the proven native type routes, but should label that as product support. Existing raw path snapshots and legacy four-radius documents require explicit compatibility handling rather than unconditional reconstruction.

Useful regressions are the complete 256 dynamic matrix, single/diagonal oversized corners, mask0 versus missing/default15, both adjacent sides hidden, style width0/none update gates, resizing with clamp recomputation, selected/action/adaptive changes without mask loss, and preservation of gradients/shadows on the changed outline. Initial managed oversized fill differences, complete image/form generator behavior, and original GUI pixels remain explicit limits.

The companion JSON binds original source paths, distribution/extraction identities, retained CIL, literal-decoder dependencies, executable probes and this report. It does not use a completion statement as integrity evidence.
