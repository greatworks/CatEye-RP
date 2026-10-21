# Selection indicator: retained RP 11 rendering evidence

Frozen scope: Axure RP 11.0.0.4150 checkbox/radio indicator arithmetic, generated wrapper/input CSS, selected-mark classes, and a bounded original JavaScript SVG consumer. This stage changes no product source, old evidence, sample, or product test. It does not execute the vendor DLL or operate the vendor GUI.

The results are **89/89: 78 retained-CIL-record cases and 11 controlled Edge cases**. CIL instructions are interpreted with declared substitutes; they are not native CLR executions. Edge executes the retained JavaScript and jQuery against constructed fixtures, not an original generated project.

## Source binding

- `AxureRP11.dll`: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- `style.js`: `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`.
- `jquery-3.7.1.min.js`: `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85`.
- `axure_rp_page.css`: `595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a`.
- Distribution: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Retained extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.

Absolute source paths, CIL files, probe dependencies and SHA-256 values are in `selection-layout-indicator-evidence.json` and `selection-layout-indicator-manifest.json`. The preceding `selection-layout-render-evidence.*` and manifest remain unchanged.

## SLI-01 — Checkmark and radio dot

`Checkbox.SIll` token **100699787** calls `N95X.B9HX` **100710703**. `RadioButton.SIll` **100701393** calls `N95X.V9Hm` **100710704**. The calls pass the current disabled value and supplied border fill. The property bindings are independently retained in `selection-layout-indicator-properties.json`: `Disabled` getter 100695304, `Selected` getter 100695308, and `BorderFill` getter 100717782. The latter leads through 100717701 to property key 8.

Both drawing functions use the supplied rectangle's width as `b` and center a `b × b` square inside that rectangle. Define the centered square's origin as `(sx, sy)` and `u = b / 14`.

| Output | Source-derived rule |
|---|---|
| Checkbox check | Polyline `(sx+3u, sy+b/2)`, `(sx+b/2-u, sy+b-4u)`, `(sx+b-3u, sy+3u)` |
| Checkbox pen width | `3b/14` |
| Radio dot bounds | `(sx+b/4, sy+b/4, b/2, b/2)` |
| Checkbox non-null fill | Convert supplied fill to the color used by the pen |
| Radio non-null fill | Construct a brush from supplied fill and the original supplied rectangle |
| Null fill | Select a theme field according to disabled state |

At `b=14`, the checkbox points relative to the square are `(3,7) → (6,10) → (11,3)` with pen width 3. The radio dot is a 7 × 7 ellipse at `(3.5,3.5)`.

`selection-layout-indicator-glyph-probes.json` contains **56/56** cases: both types; sizes 0, 12, 13, 14, 16, 18, 25.5; disabled on/off; supplied/null fill. Each uses a translated, nonsquare input rectangle to verify centering rather than assuming an origin or square input. Arithmetic, centering and inset instructions execute; native pen, brush, path and drawing operations are captured substitutes. Zero is a lower-level probe input, not proof of its acceptance in the native author UI. Pen cap/join raster equivalence is not established.

Static theme constructor evidence records packed values `0xFFE4E4E7` and `0xFFA1A1AA` through the retained color factories. The glyph probes deliberately use distinct labeled theme inputs. This report does not promote those constructor constants to an immutable universal disabled/normal palette or claim a complete theme lifecycle.

## SLI-02 — SVG class and selected-state asset behavior

The retained SVG graphics methods `dHbV.y3jB` **100723527** and `dHbV.G3jJ` **100723564** append `btn_check` for the corresponding flagged mark. Literal decoding binds:

- `y3jB`: `class`/`stroke` at IL 336/363, then `class`/`btn_check` at IL 513/541.
- `G3jJ`: `class` at IL 91, `fill`/`stroke` alternatives at IL 124/156, then `class`/`btn_check` at IL 207/234.

The shipped page stylesheet hides `.btn_check` and sets `.selected .btn_check` to `display: inherit`. The exact computed display in the controlled absolutely positioned SVG fixture is `block`; it is incorrect to describe this rule as universally `inline`.

`FNiU.aNP5` **100699650** is separately replayed in **16/16** cases. For state flags 0, or flags containing bit 8, it temporarily sets `Selected=true` while invoking the asset renderer, then restores the original selected value on successful completion. Other tested flags retain the prior selected value. The matrix covers initial selected false/true and flags 0, 1, 2, 4, 8, 9, 16, 24.

Graphics rendering, asset serialization, local rectangle construction, shadow expansion and transform trapping are declared substitutes in that replay. It proves the selected-value control flow, not complete initial assets or exception cleanup.

## SLI-03 — Owner, absolute label, text and invisible input

The retained `pNPt` writer route is replayed for checkbox and radio. The structure is:

1. Owner `div`.
2. Absolute `label`, referring to the input ID.
3. Indicator SVG and `_text` inside that label.
4. Input as an owner child outside the label.

The new probe captures the complete `SNLp` call: 12 explicit arguments plus its receiver. This corrects the earlier research harness's coarse six-argument CSS capture without rewriting that frozen report. The current owner call carries `displayFlex=true`; label positioning removes its contents from ordinary flex-item sizing. The visible indicator is SVG, not the native input.

The retained CSS writer and zero-rectangle static initializer establish the input rule:

```css
border-width: 0px;
position: absolute;
left: 0px;
top: 0px;
width: 0px;
height: 0px;
opacity: 0;
```

`O5sD` is the zero rectangle constructed by token **100722161**, IL 0x21–0x4a. `SNLp`/`TNKD`/`hNKx`/`xNKi` emit the rectangle and opacity declarations. `kNLm` **100699215** emits label width/height 100% and left 0; the label's inline style includes absolute positioning. The four CSS cases include opacity 0, 1 and 0.5 plus the label rule.

Owner and text writer calls use scroll mode 0 in the observed ordinary selection route. They do not request an overflow declaration. The shipped base stylesheet supplies no general clipping rule for this ordinary owner. With the proven structure, source stylesheet and controlled values, Edge computes owner `overflow: visible`.

This supports avoiding an added owner clip in that bounded selection layout. It does **not** prove a complete generated project cascade, override ancestor clipping, or establish overflow for every widget/container. Keeping a temporary native input from flex shrinking is an independent product compatibility fix; it is not the original SVG/input implementation.

The existing native text-panel rectangle remains a separate input to the generator. The preceding render report records the padding/AlignRight/autofit projection and its native graphics measurement boundary. This stage does not replace that measurement with browser text estimates. Although the core indicator rectangle is square, the final SVG asset/viewBox may include stroke or shadow bounds; an unconditional outer SVG width equal to `b` is not established.

## SLI-04 — Exact runtime SVG consumer

`selection-layout-indicator-browser-probes.json` records **11/11 actual headless Edge cases**, executing the complete retained jQuery and these exact `style.js` slices:

- Lines 991–1645: `_applySvg`.
- Lines 810–812: RGBA helper.
- Lines 2503–2532: color helpers.

The fixture uses the proven owner/label/input structure and independently constructed source-formula mark paths. Object/type/style lookup and normal-state provider are supplied. The outer indicator border is a controlled shape. No Vite server or original application is involved.

For base button size 14, override button size 28, border width 2 and border color `#123456`:

- Checkbox mark pen width becomes 3, from **base `obj.buttonSize × 3/14`**, rather than the override value.
- Radio mark receives the solid border color as fill as well as stroke; its stroke width follows the supplied generic border width.
- The existing glyph path and SVG rectangle are unchanged by this consumer invocation.
- Selected class controls mark visibility through the shipped stylesheet.
- Supplying the disabled input attribute alone does not add another mark CSS change in this isolated consumer. Full disabled state resolution/assets are not being exercised.

Additional cases compare base/override 12/18 and 18/12. A deliberately missing base size makes the exact consumer emit `stroke-width: NaN`; the browser rejects that declaration and retains the generic rule. This is an internal-carrier boundary, not evidence that normal native author input produces a missing size.

Static source lines 1067–1071 separately use override button size for checkbox/radio image-pattern dimensions. That branch is retained but not covered by this browser matrix.

Crucially, these observations are **not** the entire P94 state/action behavior. The generator enumerates IX/adaptive variants and emits assets and state CSS separately. P94's admission to normal/adaptive/state/action data was proved by the preceding render stage. Its complete visual update across those generated variants has not been replayed here. It would be wrong to conclude from this single consumer that P94 never changes the indicator dimensions.

## Failures, method boundaries and implementation status

The new prefix retains six earlier harness failures: two glyph dependency bindings, two CSS interpreter bindings, one asset reference dereference, and one incorrect expectation that inherited SVG display computes inline. They are **research harness failures**, not product or vendor failures. Their logs bind the failed-attempt script hashes, but those intermediate script bytes were not retained; they are hash-only attempt records. The final passing scripts and all current dependencies are bound by actual file bytes in the manifest.

No product file was edited by this research task. Parent-reported selection-only native-input `flex: none` and owner-overflow fixes are independent product work and are not verified by these 89 cases. **The product still uses its native input; this stage does not replace it with the source-derived SVG. Complete selected/disabled/adaptive assets and the full P94 drawing update remain unfinished.**

Other explicit limits are native font measurement, complete input serialization, exact outer border/shadow SVG, native rasterization, all theme mutations, full generated CSS cascade, and exception paths during asset rendering. The previous direct-child autofit-height NaN finding remains as recorded in the frozen render report; this work neither fixes nor broadens that result.

The report is an implementation contract for the established subset and a record of the remaining gaps. It is not original-GUI pixel verification or a claim of complete SelectionButton parity.
