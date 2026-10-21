# SelectionButton rendering and runtime text layout

Target: retained Axure RP **11.0.0.4150**. This stage reads metadata/CIL, interprets bounded retained instructions, and executes exact shipped JavaScript slices with retained jQuery in an isolated Edge page. It does **not** load/invoke the vendor DLL, operate the original GUI, generate a page with Axure, or establish original full-page pixel parity. Product, tests and historical reports are unchanged.

The source is the extracted `AxureRP11.dll`, SHA-256 **dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7**. Distribution SHA-256 is **f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0**; extraction Evidence ID is **ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7**. The JSON and manifest bind complete paths and current byte hashes.

## Findings that govern implementation

1. **P94 is an independent numeric style property, admitted to normal, adaptive, IX state and ApplyStyleInfo JSON.** It is not a shared-only AutoFit flag. State/action admission is now supported by actual generator call sites, independently of the reconstruction's former whitelist omission.
2. **Generated selection text is inside a label.** The bounded checkbox/radio writer replay yields owner div → label → indicator SVG and `_text` div; label closes, then the input is emitted as another owner child. Label attributes include absolute positioning and left0. Its CSS rule supplies width100%, height100%, left0px.
3. **Managed author sizing and browser runtime sizing differ.** The author methods reserve indicator width and position text/indicator using measured text and padding. The original browser Resize consumer excludes both checkbox and radioButton.
4. **Runtime SetText nevertheless executes AutoFit.** Width sums direct spans of each descendant paragraph, adds horizontal padding, and omits indicator width. Resize is skipped, but alignment Move and candidate registration still occur.
5. **The generated nesting exposes an AutoFitHeight defect.** Original `autofitWidget` queries `owner.children('#owner_text')`; the selection text is under label, so retained jQuery returns undefined height. The candidate becomes NaN, and vertical alignment can pass NaN to MoveWidget. This is observed in controlled DOM execution, not guessed from a filename. A product must not serialize/apply nonfinite geometry. All **39** real selection samples in the frozen census have AutoFitHeight=false; no genuine enabled-height sample or original GUI comparison is asserted.

## P94 generation, type and range

Evidence IDs **SLR-01–SLR-04**:

| Binding | Exact source |
|---|---|
| Effective property read | `jtoq.ttoo` **100717685**, IL8 loads94, IL10 gets property, IL15 casts typed carrier. `a5Vc` **100717838** unwraps it. SelectionButton `get_ButtonSize` **100702026** reads this value and applies effective ScaleX when present. |
| Generator subset | `wJe6..cctor` **100694421**, IL0x197 loads94, IL0x199 Add, IL0x19e assigns `HJCk`. The collection replay confirms94 is present. |
| Normal and adaptive output | `jJeK` **100694305**, IL891–907 /1367–1385 /1395–1417 passes `HJCk` to `EJep`. |
| IX state output | `rJeU` **100694323**, IL960–1040 dispatches the P21 state collection and recursively calls `EJep(state,writer,context,names,false,null)`. It retains the same subset. `EJep` and `rJeU` apply the established Overridden-and-Determined filter. |
| ApplyStyleInfo action | Closure `<ToJson>b__0` **100694538**, IL0x308–0x326 reads `ApplyStyleInfo.get_Style` **100703340**, loads `HJCk`, and calls `EJep`. This is a real action-style generator, not a hypothetical reuse of the widget writer. |

Records: `selection-layout-render-{json-keys,unit-property,action-property,action-unit}-cil.json`, with `selected-style-filter-{widget-entry,json-entry,generator-IJeq}.json`.

`OJev` **100694336** delegates property-key naming through `mJG4.Name` then the camel-case formatter; this investigation proves P94's inclusion, not a fresh literal decode of that lookup dictionary. The shipped runtime independently consumes `buttonSize`, including SVG image-pattern dimensions and checkbox tick width. The latter uses **base `obj.buttonSize`**, `3 * obj.buttonSize / 14` (`style.js:1375–1378`); it must not be summarized as a uniform recalculation of every indicator dimension after every override.

The real values12/13/14/16/18 and uniquely matched effective12 cache entries are documented in frozen [selection-author-resize-evidence.md](selection-author-resize-evidence.md). They do not establish a universal12 default or full native legal domain. A zero result in an effective ScaleX=0 probe does not establish that stored P94=0 is accepted by the original author UI. Any product finite/nonnegative bound is an explicit safety rule until that setter/UI range is separately demonstrated.

## Author geometry and coordinate spaces

Evidence IDs **SLR-05–SLR-07**. The prior author report and independent [selection-layout-transaction-evidence.md](selection-layout-transaction-evidence.md) own the OI8Z transaction, measurement/cache timing, AutoFit state and rounding. This stage does not replace those transaction results.

`XNUc` **100702036** returns the graphic indicator rectangle. For effective button size `b`, owner location/rect, and panel rectangle:

- It converts `(2,2)` through `N5pp` unless the boolean argument requests no inset. `N5pp` **100720541** invokes `Transform` **100720540** with `(size,2,0,graphics)`; the latter transforms `[origin,size]` then subtracts the points. `AxCoordinateSpace` metadata binds World0, and both retained Page/Device aliases2. Thus the inset is **source space2 converted to World0**, not a proven unconditional CSS2px.
- Empty text or `panel.height < b`: indicator y is **owner.Location.y**.
- Otherwise it constructs `panel.Rect + owner.LocationInDiagram`: top gives rect.top+convertedInset.height; middle gives rect.centerY−b/2; bottom gives rect.bottom−convertedInset.height−b.
- AlignRight=false: x=owner.Location.x. True: x=owner.Rect.right−b. Width=height=b.
- `mNU6` **100702038** obtains graphics, applies `oIuN`, then calls `XNUc(...,false)`.

`CNUW` **100702037** is a different, local rectangle:

- Empty/short text: y0. Otherwise top0, middle `(panel.height−b)/2`, bottom `panel.height−b`.
- x0 or `owner.width−b` according to AlignRight. No 2-unit inset conversion.

The **114** geometry cases deliberately use unequal owner-location and location-in-diagram inputs to expose the exact branch distinction. The graphic-unit conversion remains a named sink with explicit factors. They do not claim a fully composed nested-coordinate rendering result.

The frozen author layout chain remains useful: SelectionButton `WIyL` **100702035** puts the text at paddingLeft+indicatorWidth when AlignRight=false, or paddingLeft when true; its short-text vertical cases use top/middle/bottom padding and indicator size. Width-fit reserves indicatorWidth. Native graphics measurement and positioned text feed subsequent owner union. The transaction agent now replays this composition, including integer rounding; use that evidence rather than transplanting browser AutoFit into author sizing.

## Initial HTML and text CSS

Evidence IDs **SLR-08–SLR-10**:

- Selection writer `pNPt` **100699649** opens owner through `DNCg`, label through `rNCc` **100699510**, emits indicator and `fNPD` **100699662** text, closes label through `gNCW` **100699511**, then emits `JNCt` input. The **2** controlled CIL cases cover checkbox and radio with no adaptive/master/repeater/IX variants.
- Label ID uses the input ID plus `_label`; `for` references the input. Label inline style is `position: absolute; left: 0px;`.
- `kNLm` **100699215** emits `#owner label` with width100%, height100%, left0px. This is label CSS, not a generic `.text` flex rule.
- Selection `fNPD` calls `rNPL` **100699663** with the SelectionButton owner. **4** additional CIL cases explicitly select the non-VectorShape branch. With supplied measured panel `(18,3,80,20)` and paddingLeft5/right7, emitted text rectangle is `(13,3,92,-1)` for either AutoFitWidth state: x subtracts left padding, width adds both horizontal paddings, height−1 omits CSS height. The branch does **not** call PNZ8 in these cases; it consumes the existing measured panel.
- AutoFitWidth=true emits `white-space:nowrap`; false emits `word-wrap:break-word`. Text call has scrollbars0, displayFlex=false and owner=null. It does not establish a selection `#owner .text {width:100%}` rule or generic vector padding/alignment cascade.

Sources and decoded literals are retained in `selection-layout-render-{writer,tags,input-id}-cil.json`, `selection-layout-render-literals.json`; DOM and text-CSS instruction traces are in their `*-probes.json`.

The previously audited `axure_rp_page.css` supplies zero paragraph margins and input defaults but no universal `.text` positioning/overflow rule. A player-shell `overflow:hidden` rule is not a widget text clipping rule. This stage establishes the label/text relationship, not every style in an original generated project.

## Runtime SetText, Resize and measured results

Evidence IDs **SLR-11–SLR-14**:

| Original source | Contract |
|---|---|
| `axQuery.std.js:75–81`, IsResizable | Selection types absent from RESIZABLE_TYPES. |
| `axQuery.std.js:570–595`, resize | Records old resizing rect, then skips non-resizable object. Completion can release queues/call callback; the ordinary CSS/cache/onResize/fit path is not reached. |
| `expr.js:316–385`, SetWidgetRichText | Changes `_text` content/visibility, preserves first plain-run formatting, calls AutoFit afterward. The one-span/one-line shortcut can preserve a hyperlink wrapper. Multiline replacement creates one outer span with nested line spans and BRs. |
| `expr.js:469–552`, autofitWidget | Candidate width=max per-paragraph direct-span sum+paddingLR, candidate height=direct `_text` child height+paddingTB. Resize attempted before alignment-dependent Move and registration. No indicator-width term. |
| `doc.js:545–563`, GetTextPanelId | Finds `.text` through descendants of button shape; selection owner is its own button shape. This differs from AutoFitHeight's later direct-child query. |

The **18 NodeVM cases** use explicit direct-child measurement facades, proving control flow only. Given owner100×20, measured240×30 and padding2/7/3/5, they register252×35 while owner remains100×20; right/bottom emits Move(-152,-15). This direct-child facade is **not** the SelectionButton generated nesting.

The **22 actual Edge cases** use retained jQuery3.7.1, exact original setter/AutoFit/resize consumers and the CIL-proven label nesting. They run with controlled monospace16px/20px fixture CSS, not native font defaults:

- Owner100×20 remains unchanged in all cases.
- `A longer label`, AFWidth=true/AFHeight=false registers135×20 and right alignment emits Move(-35,0), in both checkbox and radio cases. This is a measured fixture number, not a promise about Arial/Open Sans.
- AutoFitHeight=true: direct query length0, `.height()` undefined, candidate height NaN. The report encodes nonfinite numbers as `"NaN"` and records movement as a sink. It does not claim how a complete original page finally paints an invalid Move.
- Single-line linked span has no direct paragraph span and yields padding-only width12. A multiline setter removes that old wrapper during reconstruction and measures the new direct outer span. The fixture `One`, `One\nTwo`, `One\n\nTwo` yields38 when a direct span exists; explicit BRs remain in DOM.
- Empty text hides its text layer; this does not cause valid owner resize through the selection Resize gate.

**Safety boundary:** keep finite geometry and clearly choose reject/no-op or a separately described compatibility policy for the native NaN branch. Do not silently present corrected finite height fitting as original runtime equivalence. Likewise, an author-mode fit implementation can reserve indicator width because the managed author chain proves it; the runtime width candidate cannot add the same reservation while claiming the exact source behavior.

## Font measurement source and remaining gaps

Managed author measurement follows `INOR` **100701896** → `GtCX`/`dtCa` → `KIf5` **100715354**. AutoFitWidth uses the recorded large measuring width10000; constrained measurement keeps available width. Font engine, fallback resolution and actual glyph metrics are **not executed**. The transaction report explicitly supplies that measurement sink, then replays rounding/layout.

The separate HTML font-size writer evidence [font-size-runtime-evidence.md](font-size-runtime-evidence.md) proves the96/72 unit conversion. It does not prove browser and native graphics line boxes are identical. This stage uses that distinction and does not reassign saved font sizes to make labels fit.

Remaining limits:

- Complete original generated CSS cascade and native indicator SVG pixels, including all state/action overrides.
- Original stored P94 author range, broad negative/zero/domain semantics and universal defaults.
- Exact graphic source-space2→World conversion under arbitrary transforms/containers; nested coordinate branches remain explicit.
- Native graphics font-engine metrics and browser-vs-author line-box parity.
- Original full-page behavior after invalid AFHeight movement; product safety behavior must be named.
- No original GUI screenshot or user-driven original selection manipulation was available/claimed. Parent reported unchanged FrameArrived and coordinate-input failures; this stage did not retry them.

## Reproduction and freeze

Run only the new scripts:

```powershell
node research/selection-layout-render-probe.mjs
node research/selection-layout-render-dom-probe.mjs
node research/selection-layout-render-text-css-probe.mjs
node research/selection-layout-render-browser.mjs
node research/selection-layout-render-report.mjs
```

Final checks: **133 +2 +4 +22 =161**, all passed. They comprise121 retained-CIL cases,18 exact-JS NodeVM cases and22 controlled Edge cases, not161 original GUI tests. Early missing-opcode/slice-boundary/DOM-adapter and missing-constant harness failures are retained under the new prefix. They are harness failures, not failures of the reconstructed product or original application.

The report/manifest freezes the new research, exact original-source hashes and reused dependency bytes. No production source, test, historical report, source sample, package or release artifact was changed.
