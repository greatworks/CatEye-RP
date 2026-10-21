# Selection inline SVG bounds: retained generator evidence

Date: 2026-10-21. Target: Axure RP 11.0.0.4150, ordinary Checkbox / RadioButton, unrotated, no shadow, solid paint, explicit BoxModel 0. **This is static CIL evidence and bounded instruction projection, not vendor execution, an original generated page, original GUI comparison, or pixel parity.** The full native path/body serialization remains open. No product or configuration files were changed.

## Closed contract

The logical indicator square and its exported asset/CSS rectangle differ. Let R be the global graphical indicator rectangle returned by mNU6 (ultimately XNUc), O the widget rectangle location, b the indicator size, and w the source stroke width. jNPH returns R minus O while also returning unmodified R by reference. aNP5 writes the following CSS rectangle:

- w <= 1: R - O + (x:0, y:0, width:1, height:1).
- w > 1: R - O + (x:-w/2, y:-w/2, width:w+1, height:w+1).

This is component-wise rectangle addition, not an inset operation. pNPt sends this rectangle directly into SNLp with rotation 0, opacity 1, null prior styles and false flags (IL 1408–1444). SNLp emits absolute left, top, width and height in px. UJ0a computes the expansion; this formula is for its SelectionButton non-Vector, BoxModel 0 and no-shadow branch only.

| b | source w | CSS width/height | CSS delta x/y from logical indicator |
|---:|---:|---:|---:|
| 14 | 0 | 15px | 0 / 0 |
| 14 | 1 | 15px | 0 / 0 |
| 14 | 3 | 18px | -1.5 / -1.5 |
| 18 | 0 | 19px | 0 / 0 |
| 18 | 1 | 19px | 0 / 0 |
| 18 | 3 | 22px | -1.5 / -1.5 |

AlignRight is handled before this expansion by indicator placement: left = widget right - b, versus widget left on the ordinary left-side branch. The existing XNUc evidence also supplies top/middle/bottom vertical placement. The new probes supply the previously closed top-aligned unit-transform fixture, with widget (100,70,100,30) and indicator y=72; they do not re-execute native font measurement or XNUc. This yields x=0 or 100-b relative to the owner, then the expansion above. Existing border geometry independently places the w-wide centerline at (w/2,w/2,b-w,b-w), with filled path geometry spanning (0,0,b,b). These local path facts do not themselves close the exported body transform.

The source SVG root and the inline SVG root are distinct:

1. rNP4 adds the same UJ0a expansion to global R before yNP8 / qNPf / tJ0X. TIdc configures the SVG writer as mode VHJI=1 and calls aHb9 with R.Location. tJ0X supplies the generated crop to uHbR after widget rendering.
2. SHbE mode 1 writes width and height using the crop dimensions and then returns without writing viewBox. For the scoped cases its source root dimensions are the sizes in the table.
3. uNCx reads that source text, opens a new inline svg, writes data, id, class and optional alt, and copies only an explicitly present source viewBox. It does not carry source width/height attributes or invent a viewBox. The actual inline dimensions therefore come from the CSS rectangle. In the no-viewBox probe, the inline attributes are exactly data/source.svg, id/u_img, class/img; a separate explicit-viewBox control confirms the conditional copy. CIL spells the attribute key viewbox; in HTML parsing it is handled as the SVG viewBox attribute.
4. uNCx copies the contents between the source root's first closing angle bracket and closing svg tag, with documented ID/style string replacements. The marker-body probe verifies this copy only; it is not a native geometry fixture.
5. DOM ancestry is owner div > label > inline svg, followed by text inside the same label; label closes before the input. SVG is not an immediate child of the owner. This matters to adaptive.js immediate-child transform clearing.

The top-level drawing wrapper is partly closed: aHb9 stores R.Location in BHJg; qHbu returns Translate(-BHJg.x,-BHJg.y) multiplied by CHJR. For the unrotated identity CHJR fixture, the probe confirms this negative-origin matrix. OHbT / eHbt create the resulting wrapper group when necessary. **This does not prove the net body/path placement:** the positive graphics translation and command-state serialization must also be composed before applying the CSS padding to a renderer.

## Method and instruction anchors

All method identifiers below belong to the same pinned AxureRP11.dll SHA-256 dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7.

| Responsibility | Method ID | Retained file / anchor |
|---|---:|---|
| Outer selection HTML / CSS call and ancestry | FNiU.pNPt 100699649 | rp-selection-layout-radio-html-cil.json; aNP5 IL1381, SNLp IL1444, rNCc IL2677, uNCx IL2897, fNPD IL2644, gNCW IL2411, JNCt IL860; physical IL order is obfuscated, use retained replay traversal |
| Label / input boundaries | BNCJ.rNCc 100699510; gNCW 100699511; JNCt 100699500 | selection-layout-render-tags-cil.json; selection-layout-indicator-html-geometry-cil.json; existing selection-layout-indicator-dom-detail-probes.json |
| Local CSS rectangle and render request | FNiU.aNP5 100699650 | selection-layout-indicator-html-geometry-cil.json, IL65–88 computes out rectangle; calls rNP4 at IL319 |
| Global-to-local indicator rectangle | FNiU.jNPH 100699651 | selection-svg-bounds-origin-cil.json, IL60–67 mNU6/out write, IL33–59 widget location subtraction |
| Indicator graphics placement | SelectionButton.XNUc 100702036; mNU6 100702038 | existing selection-layout-render evidence; mNU6 is supplied as an explicit facade in the new probe |
| Asset padding | KJm7.UJ0a 100695435 | selection-layout-border-chain-cil.json; existing corrected selection-layout-border-padding-probes.json |
| Global crop expansion | FNiU.rNP4 100699685 | selection-layout-border-chain-cil.json, IL257–291 |
| SVG generation path | FNiU.yNP8 100699687; qNPf 100699688; KJm7.tJ0X 100695436 | selection-layout-border-asset-cil.json; selection-layout-border-asset-path-cil.json; selection-layout-border-render-entry-cil.json |
| Drawing branch / writer mode and origin | SelectionButton.TIdc 100702041 | selection-layout-render-writer-cil.json, IL990–1016 sets VHJI=1 / aHb9; e5QW call IL1054 |
| Source rectangle geometry | L5vW.C5vD 100722468 | selection-layout-border-chain-cil.json and existing border geometry probes |
| SVG root bounds and serialization | dHbV.uHbR 100723489; SHbE 100723490; uHbH 100723484; fHbJ 100723476 | line-style-svg-writer-cil.json; SHbE width IL215–289, height IL513–581, mode1 return IL951–954→320 |
| SVG origin wrapper | dHbV.aHb9 100723479; OHbT 100723480; eHbt 100723481; qHbu 100723482; CHb2 100723538 | line-style-svg-writer-cil.json; qHbu negative point translation IL7–42 |
| Inline source rewrite | BNCJ.uNCx 100699516 | selection-layout-indicator-html-geometry-cil.json; viewBox search IL317–351, no-viewBox branch IL1905–1908→567, root close then body extraction; decoded strings in selection-svg-bounds-literals.json |

## Verification and exact remaining boundary

selection-svg-bounds-probes.json contains **13/13 passing cases**: b14/b18 × stroke0/1/3 × left/right (12), plus an explicit-viewBox-copy control (1). It interprets retained aNP5/jNPH/UJ0a, SNLp/TNKD/hNKx, SHbE, uNCx and qHbu. All platform/value/string/CSS facades and source hashes are in that artifact. The main runnable entry is selection-svg-bounds-probe-corrected-3.mjs. Writes use exclusive creation. Earlier new probe source attempts are retained: the first had an import-rewrite quoting error, the second lacked ldobj support, and the third introduced an unescaped newline while adding that opcode; none produced a result artifact or executed vendor code.

This is not a full tJ0X/TIdc-to-XML replay. Specifically:

- y5p9 100720505 saves graphics then calls virtual h3j1 100721066 with the indicator global location (IL245–251). dHbV.h3j1 100723593 creates CHSU constructor 100723776 and passes it to KHbO 100723583. KHbO creates CHJ7 constructor 100723628 and records rHJh into XHJn. These command records must be composed with path emission, not replaced with an assumed SVG translate.
- dHbV.pHbZ 100723595 folds command records through Wbi3 generic 721424779, the callback <Matrix>b__174_0 100723618, and Vb2m generic 721424780. The current bounded interpreter does not execute this command fold, CHSU/CHJ7 payload behavior, or full state save/restore. Save 100723581 calls bHJZ.Copy 100723638.
- TIdc calls L5vW.e5QW 100722532; fill/path routes include dHbV.G3jJ 100723564, E5dq.M5do 100720708 and I5dz 100720709, then drawing state/group sinks MHbW 100723499, MHbP 100723531 and YHb0 100723552. Existing local border/tick/dot probes cover primitive geometry, not the full emitted XML body under this transform state.
- Thus net path translation within the enlarged viewport, clip/overflow behavior, exact complete native SVG output and pixel bounds are still unknown. Do not shift paths by the CSS padding, change viewBox to compensate, or claim b×b overflow-visible matches native output on this evidence alone. The current product's b×b choice stays a documented implementation boundary for this phase.
- Shadow, rotation, master/reference/adaptive generation, nonzero display transforms, gradients, explicit image replacement and exceptional generator paths are not in this contract.
- Whether native adaptive single-axis changes always serialize a complete style.size object is not investigated here. Filling a missing axis in the independent model-to-prototype mapper remains a declared model adaptation, not a proven native serialization rule.

No original DLL was loaded or invoked, no GUI bridge was retried, and no REA session/configuration, product source, old frozen evidence or memory file was changed. No full parity or original-GUI-comparison status is advanced.
