# Layer author resize: numeric projection and PinInfo

The retained `IxEvaluator.INw2` → `tNwh` → `mNwa` instruction chain is now replayed against an independently expressed numeric implementation. **5,004 / 5,004 comparisons pass**. This is bounded interpretation of extracted ECMA-335 CIL in Node.js, not execution of Axure DLL methods or observation of the original GUI.

The assembly is Axure RP **11.0.0.4150**, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`, at the exact path recorded in the JSON report. The existing `.build/next-layer-authoring/` input evidence is unchanged. New source extractions use the existing static `PEReader` extractor; the target assembly is never loaded.

## Contract

The independent solver should accept plain rectangles and numeric enum carriers, without reading a Widget or style provider:

```text
originalRect: old unrotated / unrounded object rectangle
originalBounds: old rotated AABB, in the same coordinate scope
delta: drag displacement supplied by the controller
parentRect: old projection frame; Layer child calls use (0,0,oldWidth,oldHeight)
handle: Position bits, Left=1, Top=2, Right=4, Bottom=8
freedom: MovementFreedom, Horizontal bit1 / Vertical bit2
preserveAspect: INw2 argument7, after the controller's pin-dependent adjustment
orientation: Horizontal0 / Vertical1 / Both2 / None3
pin?: horizontal, vertical, fixedWidth, fixedHeight,
      originalParentRect, newParentRect
rotation: supplied effective angle in degrees
```

Valid horizontal pin values are None0, Left1, Right4, LeftRight5, CenterHorizontal256; vertical values are None0, Top2, Bottom8, TopBottom10, CenterVertical512. The solver does not resolve capabilities. `kbNq` forces a fixed dimension when the corresponding native capability is absent; that is an upstream controller responsibility.

Return the resulting rectangle and an explicit finite-result flag. Zero source-parent axes can produce NaN or infinity. A product controller may reject those atomically; substituting zero is not the source behavior. The numeric result does not decide the final document minimum-size policy, locking, snapping, fit flags, adaptive write scope, or undo transaction.

## Source methods

| Evidence | Method | Meaning |
|---|---|---|
| LRN-01 | `INw2` 100703557 | Main projection, pins, and rotation-dependent recovery |
| LRN-02 | `tNwh` 100703558 | Parent-to-member preliminary AABB projection |
| LRN-03 | `mNwa` 100703559 | Per-axis PinInfo correction |
| LRN-04 | `f5wV.g5w3` 100721966 | Proportion constraint, including equal-value return |
| LRN-05 | `g5s7` constructor 100722221; `i5sa` 100722216; `get_BoundingRect` 100722239 | Degree-based rotated frame and AABB |
| LRN-06 | `cSqL.Rotate` 100708343; `.cctor` 100708486 IL `0xAB5–0xAF4` | Discrete eight-handle rotation |

Complete instructions, tokens, offsets and SHA-256 bindings are in `layer-resize-numeric-*-cil.json`, the probe's `methodCoverage`, and `layer-resize-numeric-evidence.json`. The original controller argument binding and recursion remain in the separate `layer-resize-controller-evidence.md`.

## Preliminary projection

`tNwh` IL `0x07–0x22` scales each delta axis by `memberBoundsSize / parentSize`. When argument6 is false, it removes axes excluded by MovementFreedom. It flips signs for the opposite handle, changes member size around that fixed anchor, and recalculates position from the original relative position in the parent. Parent displacement uses the same dragged handle and movement freedom.

`INw2` aspect mode sets MovementFreedom to All before applying `g5w3`, and passes the resulting vector to `tNwh` without its ordinary axis-removal step. The eight-handle table is `[3,2,6,4,12,8,9,1]`; its order is directly present in the retained initializer, not inferred from enum names.

Aspect Horizontal/Vertical changes one component, then recalculates the other. If the proposed first component exactly equals the existing component, the method returns first. This is observable for zero axes: a simplistic algebraically equivalent one-pass expression produces different NaN propagation. Both/None selects the larger signed ratio; it does not select the larger absolute displacement.

## PinInfo rules

`mNwa` starts from the projected rectangle, saves both projected-minus-original position and size deltas, and applies fixed dimensions before pin branches. The two axes use matching logic.

* **None:** keep projected size (or original size when fixed). Translate by the parent near-edge delta for a far-side drag, parent far-edge delta for a near-side drag, or the average of both edge deltas when that axis is not present in the handle.
* **Both:** preserve both original margins: size becomes original size plus parent size change, and position becomes the new parent near edge plus the original near margin. This branch **overrides fixed size** and has no minimum clamp.
* **Center:** keep the original absolute offset from parent center; center the current projected/fixed size at that offset in the new parent.
* **Near pin, fixed:** preserve the original near margin.
* **Near pin, not fixed:** for a near-side drag, use the original absolute far-edge ratio against the old parent's absolute far edge; limit the near position to the new parent far edge and clamp size with `max(1,min(value,newParentSize))`. For other handles, clamp the projected size using the same clamp and then restore the near margin. This is not a generic CSS percentage constraint.
* **Far pin, fixed or not dragging that far side:** preserve the original far margin.
* **Far pin, nonfixed and dragging the far side:** let `D = abs(projectedSize-originalSize) + abs(projectedPosition-originalPosition)`. If D is zero, leave this axis unchanged. Otherwise distribute the far-edge error between position and size in those two absolute-change proportions. Size is clamped at zero; position is clamped at the new parent near edge.

For parent `(0,0,200,100)` → `(0,0,300,160)`, child `(20,10,50,30)`, preliminary `(30,16,75,48)`, bottom-right handle:

| Horizontal pin | Fixed width | Final X / width |
|---|---:|---:|
| None | false | 30 / 75 |
| None | true | 30 / 50 |
| Left | false | 20 / 75 |
| Right | false | 48.5714285714 / 121.4285714286 |
| Right | true | 120 / 50 |
| Both | false or true | 20 / 150 |
| Center | false | 57.5 / 75 |
| Center | true | 70 / 50 |

These are direct `mNwa` records. They do not imply an arbitrary caller can supply global coordinates: the controller composes local frames and adds the Layer origin after the solver.

## Rotation and crossing

After preliminary projection and pins, `INw2` tests the effective angle's exact remainder modulo 90. Integer quarter-turns recover the unrotated rectangle using the AABB of the desired rectangle rotated by the negative angle. Non-quarter-turns use:

1. The source frame's sin/cos and inverse-rotated scaled delta.
2. A discretely rotated opposite handle, used to flip local delta signs.
3. The ratio `(originalWidth + localDeltaX / rotatedParentWidth) / (originalHeight + localDeltaY / rotatedParentHeight)`.
4. A height-limited candidate, followed by a width-limited candidate if the first AABB is too wide.
5. Translation against the desired AABB, with residual alignment on the left/top handle sides.

This is not a simple inverse transform followed by scaling. The formula is in the research-only independent implementation and checked against the full `INw2` instruction path.

For the same parent/child and delta `(100,60)`, no pins and bottom-right handle:

| Angle | Result x, y, width, height |
|---:|---|
| 0 | 30, 16, 75, 48 |
| 30 | 29.9855355263, 14.9615506240, 75.0289289474, 44.9498935933 |
| 90 | 27.5, 17.5, 80, 45 |

Degrees are established by the retained `jbxa` multiply-by-π/180 operation. Cardinal trigonometry uses signed remainder and source epsilon predicates; negative quarter-turns can follow the ordinary trig branch. Full turns are not silently erased before `INw2` dispatch.

One unusual source branch is preserved: `g5s7.get_BoundingRect` IL `0x74–0x88` calls `pbxZ(angle,1e-5)`, and the captured `pbxZ` method tests `abs(angle-1)<epsilon`. It returns the stored rectangle near **1 degree**, not near zero. This is a retained-instruction finding; no original GUI observation is claimed.

Precisely, `get_BoundingRect` token **100722239** loads the angle via `uIuQ` **100722214** at IL `0x75`, loads **`ldc.r8 0.00001`** at `0x7A`, calls **100688814** at `0x83`, and branches to the stored-rectangle return at `0x129` when true. `pbxZ` has signature `0002020D0D` (`static bool(double,double)`); its IL `0x08` is **`ldc.r8 1.0`**, then `sub`, `Math.Abs`, the second argument, and `clt`. These are Double constants, not integer enum values. The angle getter directly returns field **67134764**; the frame's trig initialization calls the degree-to-radian helper `jbxa` **100688805** from **100722216** IL `0x1C1`.

The existing `layerAuthoringBounds` used ordinary absolute sine/cosine for every leaf. For `(20,10,50,30)` at 1°, it yields `(19.742021524530966,9.565974411722044,50.51595695093807,30.868051176555912)`, while this retained CIL returns `(20,10,50,30)`. The reviewed old helper bytes and 24-case comparison are preserved in `layer-resize-numeric-layer-bounds-before.ts.txt` and `layer-resize-numeric-layer-bounds.json`. To avoid display/snapshot frame disagreement, the authoring collector and resize planner should use the same source-bound sizing-bounds function, while preserving nested-Layer flattening. This is an integration recommendation; this numeric work does not modify `layer-geometry.ts` or claim that every original Layer collector call was executed.

Crossing a parent edge can generate a negative preliminary size. The final rotated-frame AABB can normalize such a size; pins also contain branch-specific clamps. There is no universal “clamp all sizes to 1” rule at this numeric boundary. Parent zero axes are intentionally represented as nonfinite tagged outputs in the oracle.

## Verification and limitations

Final comparison groups: PinInfo **3,000**, projection **672**, aspect **384**, frame AABB **24**, full evaluator **480**, evaluator with pins **300**, zero/crossed evaluator **144**.

The first independently written formula disagreed on 58 zero-axis cases; the first raw report, formula, replay and runner bytes are retained. Correcting explicit two-step aspect arithmetic and zero-angle AABB axis isolation left two exact-equality early-return cases. Those were corrected from the actual branch, leaving **5,004 / 5,004**. These are research-formula failures, not product defects or failures observed in Axure.

The interpreter executes retained arithmetic and control flow, including opaque branch constants recovered from the separately retained initializer. Explicit substitutions are host Math functions, enum/object operations, source-order array min/max, list access, plain matrix allocation/application, static sentinels, and the supplied effective widget angle. Matrix arithmetic is a declared primitive facade; no original CLR execution, screen pixels, GUI gesture dispatch, all-view provider resolution, parent-fit policy or undo behavior is inferred from these probes.

The independent product solver is `src/model/author-resize-solver.ts`. It exports `solveAuthorResize`, `applyAuthorResizePins`, `getAuthorResizeBounds`, `hasAuthorResizePins`, and `hasAuthorResizePinEdges`. It does not import research files, original instructions, a Widget model, or a style provider.

`tests/author-resize-solver.test.ts` passes eight aggregate tests, including 3,948 retained numeric results: 3,000 pin cases, 924 full evaluator cases, and 24 frame bounds cases. Inputs are also checked for mutation, and the finite flag is checked against the tagged source outputs. The first product test run is retained as a **missing-module collection failure**, not misrepresented as a numerical assertion failure. The next run is 8/8 green; a separate `npx tsc --noEmit` completed with exit code zero.

Rejecting nonfinite output is a product controller safety policy, not a claim that this native numeric method rejects it. Empty union behavior, Layer traversal, pinned Panel recursion and capability projection are separate controller questions; this module does not implement or claim them.
