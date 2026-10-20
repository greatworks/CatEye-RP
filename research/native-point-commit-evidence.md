# Native point commit: geometry and the actual point-mode entry

This is a **static metadata/CIL investigation and bounded JavaScript interpretation of retained CIL instructions** from Axure RP 11.0.0.4150. No target DLL method, authenticated editor interaction, original generated page, or GUI pixel behavior was executed by this investigation. The 98 cases combine actual retained instruction-array replay with explicitly identified JavaScript sinks and independent composition. They must not be called 98 native GUI tests.

The source assembly is `AxureRP11.dll`, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`, from distribution SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`, extraction Evidence `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. The companion JSON binds the new source records, previous retained inputs and executable probe by SHA-256.

## Entry correction: ordinary point edits use TN46

The originally proposed `RN4I` entry is **not the ordinary point-mode commit**. Its geometry findings remain useful, but its AutoFit and multi-view effects must not be attached to ordinary anchor/handle edits.

| Source entry | Retained route | Meaning established here |
|---|---|---|
| `hbbp.hInw`100685553 / `XbJ5.hInw`100685587 | `FjI4` conversion wrapper, then `Cj34`100685480 | Anchor/handle update route. |
| `Cj34`, IL003B–003D | `Kj3n(true)`100685481, followed by redraw callbacks | Exact CIL replay confirms commit before callbacks. |
| `Kj3n`, IL0238 | `TN46(points,false)`100702684 | Controls are grouped by contour; replay confirms false argument. |
| `TN46`, IL0007–0033 | `hN4K(points,false,out normalized)` → Location → Size → `DN4W(normalized)` | Replayed direct sequence. Geometry normalization uses the expanded new owner rectangle. |
| `RoundSelectedPoints`100685469 / `SharpenSelectedPoints`100685470 | `Nj3m`100685471 → `rbb7` wrapper and `Cj34` | Selected-point commands share the point-mode family. They do not call `VectorShape.ANnk/DNnE`. |
| `DeleteSelectedPoints`100685466 | `rbb7` wrappers and `Cj34` | Static direct-call evidence; complete delete/history execution is not replayed. |
| `OI8V`100685653 | `Tj3H`100685437 | Exit cleanup. Four retained-CIL cases for Shape300, edited/line-like flag combinations, perform pending-mode handling and overlay-end cleanup without RN4I. |

The whole-assembly direct-token call inventory of `RN4I`100702640 finds only `EFqs.YFZz`100682679, `EFqs.nFYG`100682680, `VectorShape.DNnE`100702758, and `VectorShape.ANnk`100702759. The latter pair belong to the **object** commands `MakeSharp`/`MakeRound`: `EFqs.WFYb/EFYj` → `mFYV`100682682 enumerates objects, converts eligible shapes via `JN4H`, then applies the command delegate per object. This is distinct from `AjIh` selected-point commands.

The mode-exit source has special line reclassification and rotation finalization branches. These are not treated as a general second rebounding pass. The ordinary Shape300 exit replay uses explicit external classification/history sinks, not a running undo manager. The direct-token inventories do not establish the absence of every reflection-based or external event callback.

The independent property-scope investigation, `native-point-commit-format-evidence.md`, closes TN46's normal provider writes: current Location and current Size, native atomic pairs, with per-component equality tolerance1e-5. TN46(false) does not read Affect All Views or directly set AutoFit. The first parameter-shape conversion still replaces the native default-style-chain member; preserving all independently stored product styles is a bounded design policy, not proof that every native effective default is invariant.

## Keyboard binding is exact metadata, not a label guess

`Ljg2.FI8B`100685668 has signature `20020212968411A240`. The new PEReader-only metadata script decodes its second parameter to **Axure.Constants.AxKeys**, TypeDef33556624, whose constants are **D1=35, D2=36**. This point-mode override calls:

- D1 → `SharpenSelectedPoints(mode,false)` at IL00D8.
- D2 → `RoundSelectedPoints(mode,false,3)` at IL00F8.

Six CIL cases cover D1, D2 and another code with/without an active mode. This override does not inspect modifier flags. Filtering by a higher-level keyboard dispatcher, physical keyboard layouts, and original GUI shortcut execution remain unobserved.

## Geometry contract

`hN4K`100702689 reads the current `SizingRect`. If its rotation has absolute value below1e-5 it delegates to `iN4x`100702690. Input controls are world coordinates; `oN42/vN4h`100702698/699 and `WNnH`100702750 supply the corresponding world-point mapping. NaN absent handles are preserved by `z5EE.v5ED`100719036.

For unrotated ordinary participating contours:

1. Build curves with `WHV4.wHrl/uHry`100723170/171. A cubic uses previous anchor, its higher handle, the next lower handle, and next anchor. Missing handles become their respective endpoints. `HigherSegmentExists` determines participating segments in the unrotated path.
2. Obtain each segment's **actual curve extrema**, not the control-point hull, using `I5hl.h3jv`100720182. The union includes endpoints and cubic values at derivative roots in[0,1].
3. Round outward using `Y5uk(false)`100722119, then expand each too-small dimension to `max(borderWidth,1)` with `KN4C`100702693.
4. For **TN46's false flag**, normalize anchors and valid handles against that expanded owner. Store the returned rectangle and normalized controls. Normalized controls may remain outside[0,1].

The cubic coefficients are `p0`, `3(p1-p0)`, `3(p2-2*p1+p0)`, `p3-3*p2+3*p1-p0` (`F5aG`100720122). The derivative solver `IbMo.zbCG`100688988 has nontrivial thresholds:

- Only `abs(A)<1e-5 && abs(B)>=1e-5` takes linear `-C/B`.
- Otherwise it computes `D=B*B-4*A*C`, including when both A and B are tiny.
- D<0 produces no roots. Nonnegative `abs(D)<1e-6` produces `-B/(2*A)` with multiplicity2; otherwise the usual pair.
- The subsequent[0,1] filter rejects nonfinite roots. Example A=1e-6,B=-1e-6,C=0 produces0.5, not an empty root set. A=B=0 can produce NaN; zero A/tiny nonzero B can produce Infinity. The report serializes nonfinite results as strings, not JSON null.

Rounding is also one-sided. `LbxA`100688828 normally floors x, but returns x unchanged when `abs(x-floor(x)-1)<1e-5`. `ibxo`100688829 normally ceils x, but returns x unchanged when `abs(ceil(x)-x-1)<1e-5`. Thus0.999999 is retained while1.000001 floors1. This is not symmetric nearest-integer snapping.

If a dimension is below the minimum m, `KN4C` sets its origin to `floor(origin+(size-m)/2)` and its size to m. `PN4L`100702688 uses0.5 when the normalization dimension's absolute value is below1e-5. The unrotated empty-curve branch can use the first stored anchor as a zero-size rectangle. Complete empty/move-only behavior after contour reindex, especially under rotation, is not closed; atomically rejecting such inputs is an explicit implementation boundary.

### Rotation

For nonzero rotation a, `hN4K` inverse-rotates world controls around the **old owner center**, obtains local-axis bounds B, rotates B's top-left and bottom-right back around the old center, and uses their midpoint C as the new center. It inverse-rotates that new top-left around C to form the unrotated new owner rectangle with B's width/height. Outward rounding and minimum-size expansion follow. TN46 then normalizes original world controls by inverse-rotating them around the **expanded new owner center** and dividing by the expanded dimensions. It does not set a new rotation angle.

Executable examples:

- Old frame(100,100,200,100), angle0, `M(0,0) C(0,-1)(1,0)(1,1)` has world minimum Y58.5786437627, producing owner(100,58,200,142). The four normalized Y values are `[42,-58,42,142]/142`.
- Old frame(100,100,200,100), angle90, rectangle-like polygon whose first anchor X changes to-.25 produces owner(75,75,250,100), angle90 retained. The new owner is not simply(50,100,250,100).
- A repeated world point(125.25,96.75), stroke4, yields owner(123,94,4,4). TN46 normalization gives(.5625,.6875); the separate RN4I-true branch gives(.25,.75).

A near-flat cubic with derivative A=1e-6,B=-.8e-6,C=(.4-1/3)*1e-6 uses the native collapsed root.4, yielding minimum Y=-1.6e-8. With frame(0,0,1,1), stroke2, one-sided rounding followed by minimum-size expansion gives owner(-1,-2,2,2). Dropping the tiny derivative root would incorrectly give Y=-1.

The numeric orchestration above is independently composed from retained instructions, while the indicated extrema, rounding, minimum-size and normalization primitives execute their retained CIL in the probe. General P1401 transforms, shear, explicit transform origins and nested coordinate providers are not validated by these cases.

## RN4I is preserved as separate evidence

`RN4I` calls `hN4K(...,true)`, which normalizes using the rounded **preminimum** rectangle, then explicitly sets AutoFitHeight/Width false and propagates geometry through `w5s8`/`tN4P`/`G3bq`. The format report documents its view eligibility. It is not used to justify ordinary point-mode scope or AutoFit changes.

`w5s8` expresses changes of old/new rotated top-left and bottom-right in the old rectangle's horizontal/vertical basis. `G3bq` applies those ratios to each target view and inverse-rotates about the resulting midpoint. Fifteen source replays verify the round trip. `lN47`100702697's20000 adjustment is **not a universal cap**: when both endpoint deltas are nonzero, its one-edge adjustment can leave a width50000 or height52000. These comparison cases do not impose a20000 limit on TN46.

## Validation and limits

`node research/native-point-commit-evidence-probe.mjs` passes **98 bounded cases**, executing21 distinct retained method instruction arrays. The JSON records every source SHA and case output. Cases include cubic extrema, threshold branches, one-sided rounding, minimum dimensions, zero-axis normalization, rotation, direct TN46/Cj34/Kj3n routing, Shape300 exit wrappers, keyboard routing, and the separate RN4I comparison.

Explicit sinks include arithmetic/point/rectangle storage, rotation matrices, collection/delegate operations, method dispatch, editor redraw and history callbacks. Full `hN4K` and contour assembly/reindex are not executed end-to-end. Reindex uses Manhattan distance, removes curves degenerate within.001, and has an additional isolated-curve rule; rotated versus unrotated inactive closing-segment filtering requires more evidence. The complete original cancellation, zero-motion mouse release, history merge, special line conversion and runtime visual layout are not observed. No old report, production file, product test, original application or browser suite was modified/run by this research task.
