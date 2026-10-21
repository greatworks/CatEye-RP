# SelectionButton initial indicator border and text padding

Target: the retained Axure RP **11.0.0.4150** distribution. This stage uses static PE metadata/CIL records and bounded JavaScript interpretation of those records. It does **not** load or execute the original DLL, operate Axure's GUI, generate a project in Axure, or claim original browser pixel equivalence. It changes no product, test, sample or historical evidence file.

The DLL SHA-256 is **dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7**. Distribution SHA-256 is **f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0**; retained extraction Evidence ID is **ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7**. The companion JSON/manifest bind all reused and new evidence by path/hash.

## Implementable narrow contract

For an ordinary checkbox/radio with effective indicator size `b`, solid fill and border, uniform border width `w`, all borders visible, radius0, and no image or shadow, the proven domain used by the probes is **b > w >= 0**:

1. The indicator is a separate **b × b** drawing in local coordinates; the owner width/height are not its outer-shape dimensions.
2. Fill geometry uses the full `(0,0,b,b)` square or round template.
3. Border centerline geometry is inset by **w/2**: `(w/2,w/2,b-w,b-w)`. The border is then stroked with width `w`.
4. Checkbox radius0 path: `M(w/2,w/2) L(b-w/2,w/2) L(b-w/2,b-w/2) L(w/2,b-w/2) Z`.
5. Radio is **four cubic segments**, not a mathematically exact SVG circle. Its unit template is:

   ```
   M .5 0
   C .78 0, 1 .22, 1 .5
   C 1 .78, .78 1, .5 1
   C .22 1, 0 .78, 0 .5
   C 0 .22, .22 0, .5 0 Z
   ```

   The exact retained double for `.22` is `0.21999999999999997`. Map every point into the fill rectangle or the inset border rectangle. The first border control point, for b14/w1, is `(10.64,.5)`; this is not the ideal-circle control coefficient.
6. Initial selected-radio dot is a **fill-only** round path with rectangle `(b/4,b/4,b/2,b/2)`. It also uses four cubics with a `0.56` radius handle, equivalent to the `.22/.78` template. Do not give this initial dot the owner's border width.
7. The checkbox tick remains the separately proven three-point polyline, pen width `3*b/14`, with its color brush derived from BorderFill. The retained SVG pen construction does not introduce a new line-cap/join setting; existing default-cap/join evidence is unchanged.

An independently implemented `viewBox="0 0 b b"` with overflow visible can consume these coordinates. **That viewport is an explicit product choice**, not a claim that the complete original generated SVG asset has exactly these bounds. Original asset padding, shadow expansion, placement, and final serialization are separate layers.

## Original call and geometry bindings

**SLB-01 — selection entry and effective values.**
`SelectionButton.TIdc` **100702041** calls `XNUc` to obtain the indicator rectangle, then `X5s9` to obtain its origin-zero size rectangle. At IL0x6c7–0x6ee it calls `L5vW.C5vD` **100722468** with the effective provider, checkbox Shape0 or radio Shape15, local indicator rect, effective `N5BZ` border width, **BoxModel0**, no image/extra path, zero sketch factor and false final flag. This call-site BoxModel value is explicit; it does not require inferring a document-version-to-BoxModel mapping.

`C5vD` dispatches Shape0 to `R5A7`, Shape15 to `L5vW`, and calls `Init`. The common `Init` **100722472** reads the effective provider's fill (`z5BL`), border fill (`y5Bx`), width (`N5BZ` supplied by the caller), line pattern, inner shadow, border visibility, corner visibility and corner radius. It clamps its radius record to `min(radius, rect.height, rect.width)` before path-specific work. The independent narrow implementation must retain complex branches as fallback; this one `Min` does not establish all rounded-path geometry.

**SLB-02 — inset calculation.**
`x5ve` **100722473** performs the BoxModel0 branch and records `S5A1=w/2`, `T5AI=0`, and `t5A3=w`, then insets the stroke rectangle by `S5A1`. `M3b8` **100722475** returns false for Shape0 and Shape15: its static supported-shape array, initialized from 80 retained RVA bytes, contains neither. The boolean is an explicit source-proven predicate facade in the bounded replay.

`R5A7.r5Am` **100722633** executes the actual corner/side and coordinate instructions. With radius0 and full sides it emits the four segments quoted above. `R5A7.o3bT` **100722630** calls this path producer separately for fill and border via `K5AX`/`P5Aa`; it does not use the fill's un-inset rectangle as the stroked centerline.

**SLB-03 — radio geometry.**
`L5vW.o3bT` **100722477**, IL77–269, uses `I5hl.D5Xr` for Shape15. The fill template is transformed using the full rectangle (the recorded fill inset is zero); the border template is transformed using `H5AR`, the inset rectangle. `I5hl..cctor` **100720186**, IL33–386, constructs the 12 unit points explicitly. `n5va` **100722484** and `k5v0` **100722487** iterate in steps of three, including the closing segment, to convert that template into path/segment records. Their mapping closures **100722608/100722612** multiply each point by the supplied rectangle matrix.

The final SVG stroke path goes through `e5QW` **100722532**, `H57Q` **100719887**, and the SVG graphics backend. `H57Q` stores the border-padding metadata and copies path records through `P57v` **100719886**; this is not an extra translation of every point. `dHbV.n3jV` **100723529** constructs `E5dq` from the pen. `E5dq..ctor` **100720687** reads pen width, brush and dash array; it does not read the managed pen's `C5h5` offset field. These are static path/pen bindings, not a replay of the complete XML renderer.

**SLB-04 — initial mark differs from later runtime mutation.**
`RadioButton.SIll` **100701393** calls `V9Hm` **100710704**. The latter builds the dot rectangle with inset `b/4`, obtains a brush from BorderFill (or the separately bounded theme fallback), and calls **G3jJ with a brush and path**, not a border pen. `dHbV.G3jJ` **100723564** constructs `E5dq(NaN,null,null,brush,false)` and requests `I5dz(false)`. No widget border-width getter enters this fill-only route.

The newly decoded literals show that this fill route labels the dot `class="stroke btn_check"`. That class supports later runtime selection; it does not turn the initial brush operation into a pen operation. This distinction explains why reading only the later `_applySvg` class-based mutation would give the wrong initial contract.

The original `R57t.r57L` **100719853** uses four explicit `0.56` radius handles to construct the round dot. It is not a reason to substitute an ideal SVG circle while claiming exact geometry. The retained runtime `_applySvg` mutation of radio paths remains a different stage; the prior indicator report's base/effective P94 and state-asset caveats still apply.

## Text padding closure

**SLB-05** closes a question intentionally left open by the prior frozen render report.

The previous replay already proved that SelectionButton `rNPL` emits a text rectangle with `x = panel.x - L`, `width = panel.width + L + R`, original panel y, and omitted height. It had not executed the owner's descendant rule.

`JNLP.nNLd` **100699219** has a **SelectionButton-specific branch**, not only a VectorShape branch. In the new six bounded cases it emits:

```css
#owner .text {
  position: absolute;
  align-self: /* flex-start, center, or flex-end */;
  padding: /* Tpx Rpx Bpx Lpx */;
  box-sizing: border-box;
}
```

It does **not** write `width:100%` for SelectionButton. `KJm7.WJpE` **100695593**, IL7–36, reads left/top/right/bottom through `SJOQ/GJOA/QJOo/VJOz` and constructs the padding carrier. There is no forced zero top/bottom in this getter or the selection branch.

The frozen `selection-layout-indicator-dom-detail-probes.json` already captures the owner's full `SNLp` arguments for checkbox and radio: a SelectionButton owner is present and argument11 is true. `SNLp` **100699217**, IL706–719, calls `nNLd` under precisely that argument gate. The input/text's other calls are not used to infer this owner rule.

Consequently horizontal content begins at `(panel.x-L)+L = panel.x`, and its available width is `(panel.width+L+R)-L-R = panel.width` under the proven border-box rule. The top/bottom padding also remains present. This is the generated declaration contract; it is not a new full-cascade pixel observation or proof of native text measurement.

## Asset padding, shadow and unresolved viewport

**SLB-06** covers a bounded helper, not final exported dimensions. `KJm7.UJ0a` **100695435** on the non-Vector SelectionButton branch, with explicit document BoxModel0:

| Width / shadow | Returned padding rectangle |
|---|---|
| w0 or w1, shadow off | `(0,0,1,1)` |
| w2, shadow off | `(-1,-1,3,3)` |
| w3, shadow off | `(-1.5,-1.5,4,4)` |
| w5, shadow off | `(-2.5,-2.5,6,6)` |
| w2, shadow dx4/dy5/blur3 | `(-1,-1,10,11)` |
| w2, shadow dx−7/dy−2/blur4 | `(-12,-7,14,11)` |

The replay includes original `f5yT` **100722439** shadow expansion and `d5up` **100722159**, with explicit rectangle/union arithmetic facades. `mJqb` **100695273** obtains the document BoxModel for this helper; the version mapping is not established. The shape path's explicit BoxModel0 and this document-derived asset-padding context must not be conflated.

The caller chain `rNP4/qNPf/tJ0X` and `dHbV` root-attribute writer has been retained but not fully composed into a final SVG `width/height/viewBox` oracle. Outer/inner shadow paint, gradient/image fill, nonzero radius, selective borders, pattern none/oversized width, additional transforms and all generated selected/disabled assets remain outside this narrow numeric contract.

## Probe results and failure provenance

- **45/45** geometry records: 30 inset/rectangle cases across two shapes, b12/14/18 and w0/1/2/3/5; 15 radio template/segment cases. Radio replay stops at original IL270 after fill/stroke path production, before unrelated outline-cache conversion. Template initialization and segment loops execute retained records; property/list/point/matrix/final-record construction are declared facades.
- **6/6** selection descendant-CSS cases: three alignments × zero/asymmetric padding. Native effective padding/alignment values and CSS output are named sinks; instruction branches and string decoding are executed.
- **9/9** padding-helper cases. Every final numeric result is finite and checked against a separate expected fixture.
- No browser was launched for this stage. Prior controlled-Edge evidence is linked, not recounted as new execution.

The first helper attempts failed on missing interpreter call bindings/arity. A subsequent point-address facade omitted dereferencing, producing NaN x/y serialized as null in `selection-layout-border-first-observations.json`. That file and failure1–3 remain unchanged. They are **harness failures**, not native behavior or product defects. `selection-layout-border-padding-probes.json` is the distinct corrected output. Those early script versions have only the hashes captured by their failure records; no claim is made to possessing their full original script bytes.

The final JSON and manifest bind the actual successful probe scripts, source records, prior evidence and this report. The 45-case geometry file is frozen for independent product tests; this report does not claim those product tests ran here.
