# Native Shape0 pills: merged endpoints and rendering phases

The retained Axure RP11.0.0.4150 evidence supports recognizing a pill as a **strict rounded-rectangle path with coincident side endpoints merged**, rather than a new shape enum or an arbitrary six-point path. This investigation does not load/execute the vendor DLL, operate its GUI, generate an original HTML page, or modify product code. It extends the frozen corner evidence with 58 checks: 18 bounded CIL coordinate/coalescing replays, six coalescing guard cases, 28 comparisons with actual retained raw pills, and six exact shipped-JavaScript VM cases using explicit DOM sinks.

## Geometry contract

For Shape0, all four corners enabled, all four sides visible, nonnegative radius and positive dimensions, the effective radius is `min(requestedRadius, width/2, height/2)`. The half-short-axis restriction here depends on the complete four-corner arrangement. It must not replace the previously proven single/diagonal-corner ceilings.

`L5vW.i5vf` (token100722498) constructs eight control points at IL05AB–06C4, then calls `m5vw(points, 0)` at IL06CA. The control points use normalized widget coordinates and the retained coefficient `0.43999999999999995` (the binary Double form of 0.44) at IL02AB/02BF. This corresponds to cubic quarter-corner control distances; it is not a mathematically exact circular arc or a claim of CSS ellipse pixel identity.

With all corners enabled:

| Dimensions/radius | Result after coalescing |
| --- | --- |
| 100×40, radius19 | 8 anchors; both vertical straight sections remain |
| 100×40, radius20 | 6 anchors; left/right midpoint duplicates merge |
| 40×100, radius20 | 6 anchors; top/bottom midpoint duplicates merge |
| 40×40, radius20 | 4 anchors; all straight sections collapse |
| 48×24, requested30 | radius12 and 6 anchors |
| 200×6, requested5 | radius3 and 6 anchors |

For a horizontal pill, let `a=radius/width` and `radius=height/2`. A possible clockwise sequence is `(0,.5), (a,0), (1-a,0), (1,.5), (1-a,1), (a,1)`. The left pole has lower `(0,.78)` and higher `(0,.22)`; the right pole has lower `(1,.22)` and higher `(1,.78)`. The other handles use `0.44*a` and `1-0.44*a`, with the straight-side handle missing. All outgoing segment flags are true in the 28 real examples. The JSON records exact numeric values and NaN carriers; a cyclic starting-point change is permitted when comparing complete contours.

Six anchors alone are not enough: ordinary rectangles with only two rounded corners also have six anchors. Strict recognition must verify Shape0 provenance when importing, one closed contour, every anchor, each control handle, direction, segment flag, and consistency with the radius/mask/size model. It must keep the old eight-point encoding accepted, and it must not infer a pill from arbitrary edited path geometry.

## Exact coalescing rule

The new static records close this previously unexecuted part of the retained builder:

* `L5vW.m5vw`, token100722500: when starting index is0, IL000D–003E compares last with first, removes the last entry, and sets entry0 to `P5vT(last, first)`. IL0054–008B then checks adjacent points, removes the latter, stores the merged point at the former index, and recursively resumes from that index.
* `z5EE.N5Ex`, token100719039: anchors must compare equal; the former point's higher handle must be missing or equal to its anchor, and the latter point's lower handle must be missing or equal to its anchor. A coincident anchor with a nondegenerate connecting handle is not merged.
* `L5vW.P5vT`, token100722499, IL0007–0020: the merged value uses the **second anchor, first lower handle, second higher handle, and second outgoing-segment flag**. This also establishes the closing-seam behavior; the incoming handle is not lost.
* Point equality goes through `f5wV.op_Equality`100721975 → `j5wL`100721978 → `y5wx`100721980 / `n5wM`100721982. Each axis passes tolerance0.00001 to `rbx2.qbxO`100688812, whose test is `abs(a-b) < tolerance` (strictly less). The builder coordinates are normalized at this point. The replay proves a0.000009 gap can merge while0.00001 does not.
* Missing handle checks `U5EL`100719037 / `N5EK`100719038 use the both-axis NaN predicate `m5wf`100721939 or the same anchor-equality test. The static replay folds the retained assembly's opaque integer control-flow fields; it does not assume every branch is false.

The importer can compare a deterministically generated expected rectangle sequence after the proven merges, instead of accepting arbitrary near-equal points. Native tolerance is a description of the original implementation, not permission to loosen unrelated path validation.

## Stored/managed points versus later SVG updates

The stages are deliberately kept separate.

1. **Stored source geometry.** The 28 actual pill records in `native-pills-format-inventory.json` are Shape0, mask15, six-point closed contours. Replaying the retained builder at each stored width/height and requested radius matches every normalized anchor, handle and segment flag to1e-12, allowing only cyclic starting-point variation. Examples include the Form Track `e6d3d1fe008947a0a3ef9244d3296be6`, package`cad416ad75484897b9fd26b7bdded719`, 48×24/radius30; and `d515a37dfd114af6877e6c6d4d244032`, package`e60b879dcd664f83b848b6f88263b0a3`, 200×6/radius5. This is a numerical raw-data/CIL comparison, not an original generated-page observation.
2. **Managed rectangle path construction.** `w5Qk`100722530 obtains a half-border-width offset unless its no-line predicate applies, then routes the complete rectangle to `i5vf`; partial border masks route through `b5QE`100722529. Inside `i5vf`, the Boolean retained from IL0156–016A (active top pair or active bottom pair) reaches IL01C6–01D4 and, when true, sets the offset argument to0. All-corner replays with supplied offsets0,0.5 and2 therefore produce the same outer-boundary normalized points. Those are path-builder results, **not proof of final SVG stroke clipping, width or painted bounds**. This replay stops after coalescing, before disconnected-contour splitting and final SVG output. Earlier evidence already establishes that partial-border managed fill and stroke can take separate calls and different clamps.
3. **Shipped JavaScript repaint.** `style.js`991–1034 computes/receives the effective style and invokes `setBorder`. The Rectangle branch1228–1340 rounds dimensions and writes a new fill/stroke `d`. For a capsule it writes four cubic curves plus four straight commands, including zero-length straight commands at the collapsed sides. It does not call the managed coalescer. It computes the stroke centerline inset by half the current border width and a separate outer fill path; the same geometric curve can therefore have a different serialized command count from stored six-point controls.
4. **Dynamic gate and retained paths.** `style.js`1218–1222 handles line-pattern`none` before rectangle rebuilding. The following branch1222 requires a truthy border width; width0 skips both new paths. The six new JS cases show no replacement of existing path data in those skip cases. Thus changing radius/mask while width0/none does not establish a new source-generated initial outline. The current product may choose declarative updates for its authored geometry, but that is a stated behavior difference rather than an exact original update replay.

Observed call sites are also bounded: action-applied styles call `_applySvg` around line917; image/text state refresh calls it around1664; `setAdaptiveStyle` calls it around2386 for an existing SVG container. `_applySvg` rejects missing/non-SVG noncompound containers and empty effective styles. A state or view change does not imply every object necessarily enters the Rectangle reconstruction branch. No claim is made that all initial page loads automatically rewrite every saved pill.

## Implementable scope and remaining gaps

The immediate defensible scope is strict horizontal/vertical full-corner Shape0 pills, with compatibility for their six-point merged encoding and the existing eight-point encoding, using the proven 0.44 handles and independent P71/P81 metadata. Square/full-round four-point Shape0 is also produced by the replay, but should only be admitted if its complete provenance/geometry is separately checked; it must not be confused with native Ellipse merely because it resembles a circle.

Current-size anisotropic old paths, arbitrary edited handles, contained tree-label coordinate conventions, final native SVG clipping/paint for every type, and original GUI pixels are outside this new proof. The companion format inventory identifies non-pill records separately. The previous corner report's initial managed oversized-fill versus dynamic-fill difference still applies; this work does not erase it. No previous evidence or product file was changed.
