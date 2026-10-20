# Native point contours: sizing-frame rotation dispatch

This report is new evidence for Axure RP **11.0.0.4150**. It does not change the frozen `native-point-commit-*` reports. No original DLL method, application, or GUI was executed by this investigation. The outputs combine a bounded interpreter of retained CIL instructions with explicitly identified JavaScript storage/matrix sinks and independent numeric composition. They are not original-application pixels or a complete native point-editing transaction.

## Identity and acquisition

- Assembly: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll`.
- Freshly checked SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Prior extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- A narrow REA request for `O5ut.K5u9` and `w5s2.g5s7` returned a representation-budget limitation, not absence of methods. Retained response: `native-point-contours-rotation-rea.json`; summary evidence `ev_beda7498066e5bf120bfe2599bee8727bd3b5870d3fab57b58b55b5b929f4db4`, parent evidence `ev_0c05896344e3cf3137bd18fe27879c1df9e0420ed8b03548a9f1e3f2cfa37981`.
- Missing narrow method bodies were read using the existing PEReader-based `scripts/inspect-rp-serialization.ps1`. This reads PE/metadata/IL bytes; it does not load or invoke the vendor assembly. All source and output hashes are in the companion evidence JSON.

## Contract

Three separate quantities must remain distinct: the supplied **effective owner angle**, the angle reported by the **SizingRect instance**, and its **sine/cosine geometry**. Normalizing one number modulo 360 and using it for all three changes native behavior.

1. `KJm7.get_SizingRect` reads the effective owner angle and calls `g5s7.d5sq(rect, angle)`.
2. If `abs(angle) < 0.00001`, the factory returns the unrotated boxed `j5u5` rectangle. Its angle getter returns 0 and its sine/cosine getters return 0/1. This happens **before normalized control points are mapped to world coordinates**.
3. At exactly `+0.00001` or `-0.00001`, or outside that interval, it returns `g5s7`, which stores the supplied angle unchanged. Its geometry has separate cardinal-angle snapping described below.
4. `hN4K` reads the resulting frame's angle and applies the same strict epsilon check. The boxed rectangle takes `iN4x`; the rotated frame takes the rotated branch. `360`, `-360`, `720`, and `-720` therefore take the rotated branch even though their sine/cosine are exactly 0/1.
5. The established `TN46(..., false)` path uses the expanded new owner rectangle for final normalization. TN46 does not rewrite the stored rotation in this chain. Do not erase the raw document angle merely because its sizing-frame angle is zero.

The getter chain accepts an effective angle. `KJm7.uIuQ` can read a cached angle, resolved Transform.Rotate, or the eligible rotation style; this report does not redefine their precedence. The fixture `effectiveRotation` input means the angle supplied to SizingRect. For the current product's single rotation field, the implementation adapter must feed that field through the verified frame factory semantics.

## Source locations

Offsets below are hexadecimal IL offsets, not text-file lines.

| Evidence | Method / token | Relevant instructions | Retained file |
|---|---|---|---|
| NPCROT-01 | `KJm7.get_SizingRect` 100695395 | `0021–0027`: owner `uIuQ`; `003D–0045`: Rect + angle to factory | `adaptive-placement-authoring-owner-cil.json` |
| NPCROT-02 | `g5s7.d5sq` 100722226 | `0021–0030`: epsilon test; `004C–004D`: box j5u5; `0090–0092`: g5s7 constructor | `native-point-contours-rotation-factory-cil.json` |
| NPCROT-03 | `rbx2.TbxU` 100688813 | Math.Abs followed by strict `clt`, not `cle` | `native-point-commit-evidence-scalar-cil.json` |
| NPCROT-04 | abstract `K5u9.uIuQ` 100722035; concrete j5u5 100722141, g5s7 100722214 | abstract dispatch; j5u5 returns 0; g5s7 reads `c5lI` | new `*-base-cil.json`, `*-unrotated-cil.json`, `*-frame-cil.json` |
| NPCROT-05 | `g5s7.P5lF` 100722215; `i5sa` 100722216 | stores angle unchanged; cardinal tests or degrees-to-radians then Sin/Cos | `native-point-commit-evidence-rotation-matrix-cil.json` |
| NPCROT-06 | `rbx2.jbxa` 100688805 | multiplies by `0.017453292519943295` | `native-point-contours-rotation-angle-cil.json` |
| NPCROT-07 | `VectorShape.hN4K` 100702689 | `0007–002B`: get frame, angle, epsilon, iN4x; rotated path begins `0031` | `native-point-commit-evidence-bounds-cil.json` |
| NPCROT-08 | WorldPoints closure 100702942 → WNnH 100702750 → WNn5 100702749 → eJmT 100695285 → g5pa 100720534 → A5ph 100720533 → D5pZ 100720547 | applies the captured sizing frame to valid anchors/handles by corner interpolation | prior `*-world-input-cil.json`, `*-world-map-cil.json`, `*-live-operations-cil.json`; `rp-vector-path-{point-transform,widget-transform,scale,inset}-cil.json` |
| NPCROT-09 | `iN4x` 100702690; `hN4K` 100702689; Y5uk 100722119; KN4C 100702693; PN4L 100702688 | bounds, asymmetric near-integer outward rounding, minimum extent, normalization | frozen native-point-commit evidence |

The old and new method bodies and probe file are hash-bound in the JSON manifest; each numeric case also records the frame class, reported angle, trig pair, dispatch, world points, exact bounds, raw/rounded/final owner, and normalized output.

## Cardinal trig behavior

Let `r` be the signed remainder `angle % 360` (the retained CIL uses `rem`). The angle itself remains stored unchanged.

| Test, in source order | Geometry sine/cosine |
|---|---|
| `abs(r) < 1e-5` OR `abs(r - 360) < 1e-5` | 0, 1 |
| `abs(r - 90) < 1e-5` | 1, 0 |
| `abs(r - 180) < 1e-5` | 0, -1 |
| `abs(r - 270) < 1e-5` | -1, 0 |
| otherwise | `sin(angle * π/180)`, `cos(angle * π/180)` |

The branches are `Ibx0` 100688808, `Ybxm` 100688807, `lbxp` 100688809, `Mbxq` 100688810. Exact cardinal setters and frame corners are `v5sX` 100722217, `P5sm` 100722218, `X5s0` 100722219, `X5sp` 100722220. Their retained instruction arrays are replayed, including the quarter-turn corner calculation; rectangle storage and basic point operations are explicit sinks.

Consequently `359.999995`, `360.000005`, and `-360.000005` snap to identity geometry, but `-359.999995` does not. Negative quarter turns also are not first converted to positive modulo angles. At mathematical exact negative quarter turns ordinary trig may happen to be extremely close to a cardinal, but the branch is distinct. This distinction matters for tiny residuals and contour-selection logic; equal visible geometry does not prove equal dispatch.

## Normalized coordinates and final owner

The world mapper interpolates between the frame's top-left/top-right corners at normalized x, repeats for bottom-left/bottom-right, then interpolates those points at normalized y. `D5pZ` uses `a + (b - a) * t`, without clamping t to [0,1]. Thus outside-owner control coordinates remain legitimate inputs.

For the rotated branch, source order is: inverse around the old frame center; compute local curve/segment bounds; forward-transform the bounds' top-left and bottom-right; compute their midpoint; inverse-transform the top-left around that midpoint to obtain the new unrotated owner origin; retain the bounds width/height; outward-round; expand to at least `max(strokeWidth, 1)`; normalize original world points against the expanded frame and its rotation basis. The unrotated branch performs its own contour collection before bounds and directly normalizes against its expanded owner. This report does not claim the two contour collection algorithms are interchangeable.

The numeric composition uses the retained world mapper, curve/scalar/bounds primitives, with independently composed frame and normalization operations. It is not execution of the entire hN4K collection loop. The separate contour/filter/reindex investigation must supply topology expectations.

## Bounded numeric fixtures

`native-point-contours-rotation-fixtures.json` contains **64** source-derived numerical cases. All use owner `(100,100,200,100)` and stroke width 1. The polygon is `M -.25 0 L 1 0 L 1 1 L 0 1 Z`; the cubic is `M 0 0 C 0 -1 1 0 1 1`. The file records the complete normalized result, avoiding decimal truncation in this summary.

| Polygon effective angle | Branch | Final owner x, y, width, height |
|---|---|---|
| 0 and ±0.000009999999 | unrotated | 50, 100, 250, 100 |
| +0.00001 | rotated | 50, 99.99999563667689, 250.00000000000034, 100.00000436332311 |
| -0.00001 | rotated | 50, 100, 250.0000000000004, 100.00000436332314 |
| ±360, ±720 | rotated | 50, 100, 250, 100 |

For identity geometry the polygon's normalized output is exactly `(0,0),(1,0),(1,1),(.2,1)`. At positive threshold the lower anchors have y approximately `.9999999563667707`; at negative threshold the upper anchors have y approximately `4.36332295e-8`. The cubic at zero/below-threshold/identity trig has exact-bound minimum y `200 - 100√2`, final owner `(100,58,200,142)`, and normalized y values `42/142,-58/142,42/142,1`.

Use **1e-9 absolute tolerance only for these bounded numeric fixtures**, because explicit JavaScript matrix sinks do not promise CLR floating-operation ordering. Branch names and frame classes require exact equality. This tolerance is a comparison policy for these fixtures, not a native general tolerance or an added rounding rule.

## Execution and limitations

Run `node research/native-point-contours-rotation-probe.mjs`. Final result: **126 cases, 36 retained method instruction arrays, pass**: 56 frame/dispatch cases, 6 degree conversions, 56 polygon compositions, and 8 cubic compositions. The frozen prior probe's definition section is read into memory; its tests/output section is not evaluated and no prior file is written. The `rem` interpreter operation is added only to that in-memory copy.

There was no original GUI corroboration for this stage. The assembly SHA is verified; this is not evidence that static replay covers the full application. General transform/provider cache precedence, upstream author angle canonicalization, nonfinite angles, empty/inactive contours, callbacks/history, and general matrices remain outside this rotation report. The constructor is an explicit sink that initializes the supplied rectangle, executes retained angle assignment, and executes retained geometry update; complete constructor lifetime was not replayed. Final collection/reindex integration requires the separate topology evidence.

Implementation recommendation: preserve raw rotation in stored data; derive one native sizing-frame object with its branch angle and trig pair; use it consistently for normalized-to-world mapping, bounds dispatch, inverse mapping, and expanded-frame normalization. Do not globally normalize raw degrees or silently replace rotated dispatch at a whole turn with the unrotated contour branch.
