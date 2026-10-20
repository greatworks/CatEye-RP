# Axure RP 11 pen and vector-point editing evidence

Checked 2026-10-13. Scope: official authoring documentation and a narrow reread of already extracted control-point CIL. No original GUI execution, product edits, or claim of observed pointer behavior. The unchanged native GUI access limitation was respected.

## 1. Documented interaction contract

The references below are current official documentation, not a frozen description of every build-4150 implementation detail. Line numbers refer to the text returned by the web reader on this date; the section anchors are durable links.

| Operation | Documented result | Official source |
| --- | --- | --- |
| Activate Pen | `P` or `Ctrl+Shift+P`; available through Insert | [Shortcuts, Insert object](https://docs.axure.com/axure-rp/reference/keyboard-shortcuts/#insert-object), line 114 |
| Place point | Click creates a point; dragging during placement creates a curved point | [Shapes, Pen](https://docs.axure.com/axure-rp/reference/shapes/#the-pen-tool), lines 70–73 |
| Constrain curve handle | Shift aligns the dragged handle horizontally or vertically | [Shapes, Pen](https://docs.axure.com/axure-rp/reference/shapes/#the-pen-tool), line 74 |
| Independent handles | Alt while dragging allows independent handles | [Shapes, Pen](https://docs.axure.com/axure-rp/reference/shapes/#the-pen-tool), line 75 |
| Finish closed | Click the initial point | [Shapes, Pen](https://docs.axure.com/axure-rp/reference/shapes/#the-pen-tool), line 76 |
| Finish open | Double-click canvas **or Escape** completes an open shape | [Lines, Pen](https://docs.axure.com/axure-rp/reference/lines/#the-pen-tool), lines 64–70 |
| Open-path classification | Exactly two straight points are labeled Line; curves or additional points are labeled Shape | [Lines, Pen](https://docs.axure.com/axure-rp/reference/lines/#the-pen-tool), line 73 |
| Begin point editing | Select shape, then double-click its border, or use Edit points from its context menu | [Shapes, Edit vector points](https://docs.axure.com/axure-rp/reference/shapes/#edit-vector-points), line 141 |
| Move / insert / delete | Drag a point; click an unoccupied border location to insert; select a point and Delete or use its context menu | [Shapes, Edit vector points](https://docs.axure.com/axure-rp/reference/shapes/#edit-vector-points), line 143 |
| Curve / sharpen | Double-click a point toggles; corresponding context-menu commands also exist | [Shapes, Edit vector points](https://docs.axure.com/axure-rp/reference/shapes/#edit-vector-points), line 144 |
| Keyboard point style | `1` curves; `2` sharpens; these refer to selected vector points | [Shortcuts, Vector](https://docs.axure.com/axure-rp/reference/keyboard-shortcuts/#vector), line 180 |
| Point cursor mode | `Ctrl+Alt+P` on Windows | [Shortcuts, Tools](https://docs.axure.com/axure-rp/reference/keyboard-shortcuts/#tools), line 203 |

**Escape must not discard an ordinary multi-point Pen draft.** The explicit lines-page instruction resolves the shapes page's shorter finish description. The separate Line tool uses Shift for 45-degree snapping ([Lines, Line tool](https://docs.axure.com/axure-rp/reference/lines/#the-line-tool), line 55); do not transplant that rule into Pen handle dragging.

## 2. Narrow static corroboration

Target is extracted `AxureRP11.dll`, version `11.0.0.4150`:

- DLL SHA-256, rechecked this pass: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Original package SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Existing REA extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Reused source-bound evidence: `rp-vector-path-controlpoint-cil.json`, `rp-vector-path-platform-builder-cil.json`, and `rp-vector-path-evidence.md/.json`. Companion JSON records their current digests and exact method excerpts.

Observed storage and helpers, not a traced UI gesture state machine:

1. `F5Ek.z5EE` stores anchor `g5Eq`, incoming/lower handle `E5Ed`, outgoing/higher handle `a5EO`, and outgoing-segment flag `W5EU`. Existing Load/Save evidence binds these to Path/LowerHandle/HigherHandle/HigherSegmentExists.
2. `M5EW`, token **100719033**, IL139–151 computes supplied anchor minus old anchor. Its semantic blocks assign the new anchor (112–114) and add the delta to lower (34–48) and higher (73–87) handles. This supports retaining each handle's offset when relocating its node. The obfuscated control-flow predicates are retained in the evidence, not executed here.
3. `Translate`, token **100719034**, adds the supplied delta to anchor (71–84), lower handle (33–46), and higher handle (115–128).
4. `x5Ea`, token **100719021**, IL33–35 sets only the outgoing flag. Changing this flag alone does not erase handle coordinates.
5. `L5vW.J5vd`, token **100722490**, implements each enabled previous→current segment from previous higher/current lower handles. Both absent means a line; a missing side of a cubic falls back to that side's anchor. Its preceding-point loop includes last→first. The prior [path evidence](rp-vector-path-evidence.md) records the exact offsets and partial-NaN limitation.
6. Open-tail storage is representable without destroying the path: `W5EM`, token **100719041**, IL108–129 creates the final point with its incoming handle, missing outgoing handle, and false outgoing flag. `t5E7`, token **100719045**, IL7–38 writes last outgoing=false, then IL43–68 writes first outgoing=true. These are storage helpers; **they do not prove which gesture calls them** or that Escape clears an outgoing handle.

No new broad CIL dump was needed. The existing control-point evidence is sufficient to inform the normalized path adapter but not the mouse-mode decisions below.

## 3. Model implications and explicit implementation choices

The source model is anchor-centric; SVG `C` is segment-centric. For a moved logical anchor, its arriving cubic owns control 2, and its departing cubic owns control 1. A closed curved contour usually encodes the first logical anchor twice: initial `M`, then the final cubic endpoint before `Z`. A native-derived contour must keep these coordinates synchronized when moving its first point. This is a **representation inference** from the established native edge contract, not a new observed GUI action. Equal coordinates alone do not prove that arbitrary user-authored SVG anchors have the same identity; choose and document the adapter's closure policy.

Recommended bounded choices, explicitly **not native-parity findings**:

- Use one logical point model for pointer editing, projecting to M/L/C/Z only on commit. Preserve independent controls rather than replacing an entire cubic with a line whenever one endpoint is sharpened.
- For border insertion on a cubic, calculate a nearest parameter then split with de Casteljau so the original curve is unchanged before the new point is dragged. For a line, insert a collinear point. The mathematical split is a good acceptance invariant; the original algorithm and its tolerance are unknown.
- A point drag is one undoable change; pointer cancellation restores the pre-drag state. Keep Escape-to-finish Pen separate from any explicitly labeled Discard action. Drafts containing zero or one point need a declared policy because their native result is not documented here.
- Choose a documented default coupling policy for ordinary handle drag; symmetric mirrored handles are reasonable for new smooth points, but exact equal lengths, length preservation, or angle-only coupling are **not established**. Alt must preserve the other handle under the documented independent operation. Combined Alt+Shift precedence is also a product decision.
- Keep point editing scoped to the active widget and active contour. Do not apply geometry patches to mixed selections or neighboring repeater/component instances except through the existing deliberate component-publish operation.

## 4. Concrete acceptance suggestions

Each check below distinguishes a documented visible outcome from additional reconstruction invariants.

1. **Finish:** P, place three points, Escape → one retained open path without Z. Repeat with double-click. Click the initial point instead → closed path. Assert no duplicate terminal zero-length segment from the browser's two clicks preceding dblclick; duplicate suppression is an implementation invariant, not a documented Axure event sequence.
2. **Modifiers:** Drag a new curved point with Shift at a diagonal; the chosen handle becomes X- or Y-aligned. Alt-drag one handle and assert the opposing handle is unchanged. Test pressed/released modifier transitions without extrapolating undocumented coupling ratios.
3. **Existing nodes:** Enter point mode through the border; drag a middle node; verify its anchor and attached control offsets move coherently and unrelated nodes remain unchanged. On an imported closed cubic ellipse, drag the initial point and assert the explicit closing endpoint follows it, with no accidental closing straight edge.
4. **Point style:** Select a point, 1/2 and double-click; assert curved/sharp outcome. A neighboring node's surviving control must still influence its adjacent cubic. Exact autogenerated handle lengths are intentionally outside parity assertions.
5. **Insert:** Click a line segment and a cubic away from existing points; node count increases exactly once in that contour. Sample the pre/post cubic over parameter space to verify the chosen split algorithm preserves its shape. Repeat on the closing edge and in the second contour of a compound path.
6. **Delete:** Delete a middle point, first point, and last point; validate serialized command ordering and the chosen minimum-count policy. Preserve other contours and avoid dangling C/Z commands. Native reconnection and last-point behavior remain unknown; test the product's declared policy rather than label it Axure fidelity.
7. **Coordinates/history:** Repeat editing under canvas zoom, scroll, widget rotation, and non-square width/height; pointer-to-local conversion must be invertible. Undo/redo, save/reopen, preview, and real offline export retain path commands, fill rule, selected styling, and text. These are reconstruction quality checks.
8. **Containment:** Run a node edit inside panel/repeater/component editing contexts, then return to the page. Confirm intended template/component propagation and no unrelated widget mutation. Text input focus must suppress P/1/2/Delete canvas shortcuts.

## 5. Unresolved / outside this investigation

- Enter-to-finish, Backspace during Pen placement, zero/one-point Escape result, explicit draft-discard shortcut, and tool-switch behavior.
- Hit radius for closing the first point; whether closing by dragging changes the first node's incoming handle; treatment of already coincident endpoints.
- Default handle length/angle coupling, Alt press/release transitions, Shift tie-breaking, node-position Shift constraints, and modifier behavior outside initial Pen placement.
- Whether insertion uses de Casteljau or another method, nearest-point tolerance, deletion's curve reconstruction, minimum permitted contour size, open-end sharpening, and separate cut/split-path gestures.
- The docs' Combine/Break apart concern shape-level contour aggregation; they do not establish a node-cut command or Delete splitting a contour.
- Geometry bounds rebasing after point moves, text placement after rebasing, and exact selected-point undo grouping in the native editor.
- No original GUI validation and no claim of final raster/paint parity. Existing native stroke-displacement, cap/join, winding-processing, and rounding limitations remain as documented in the prior path report.

Only official documentation supports the UI facts above. Search results from forums and unrelated vector applications were not used as evidence. Static helper capability is not promoted to an observed mouse/keyboard call chain.
