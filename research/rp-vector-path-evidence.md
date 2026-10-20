# Axure RP 11 vector control-point and paint evidence

Investigated 2026-10-13. This is static evidence from the shipped Axure RP 11.0.0.4150 assembly, cross-checked against the independently decoded shipped sample census. The vendor application and DLL were not executed. No product source was changed.

## Identity and method

- Assembly: `AxureRP11.dll`, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7` (rechecked this investigation).
- Original installer SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- REA extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Local assembly: `C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll`.
- CIL extracted using the existing PEReader/System.Reflection.Metadata script `scripts/inspect-rp-serialization.ps1`. Method tokens below are decimal; IL offsets are decimal byte offsets. `rp-vector-path-evidence.json` records the evidence-file hashes and selected decoded instructions.
- The assembly's dead entry calls and opaque branches are not executed. Raw call-token scans in the `*-callers.json` files are discovery indexes only; the conclusions below use decoded instructions of the named methods.

## 1. Confirmed control-point contract

Raw `ControlPoints` is an ordered outer array of contours, each containing ordered map records with `Path`, `LowerHandle`, `HigherHandle`, and boolean `HigherSegmentExists`. Each point/handle has X and Y. The parsed binary NaN value is a tagged number, not a missing map and not zero. The census gives exact raw records and samples; this report does not infer a default for absent fields.

| Stored member | Internal field/provider | Confirmed role |
|---|---|---|
| Path | `z5EE.g5Eq` | Anchor/end point |
| LowerHandle | `z5EE.E5Ed` | Incoming cubic handle at that anchor |
| HigherHandle | `z5EE.a5EO` | Outgoing cubic handle at that anchor |
| HigherSegmentExists | `z5EE.W5EU`, getter `o5Eh` | Whether the edge from this anchor to the next exists for stroke/segment geometry |

The structural mapping is cross-supported by the sample property order, `z5EE.Save` (100719032, IL46–57/96–107/146–157/190–201), and the explicitly named Axvg `BezierData` setters in `<GetAxvgPathDataArray>b__27_0` (100692679). Serialization strings are obfuscated; this does not claim they were decrypted.

The clearest edge implementation is `R5v6.L5vW.J5vd` (100722490), in `rp-vector-path-platform-builder-cil.json`:

1. `prev = Last(contour)` at IL13–19, then iterate each `current` at IL20–39.
2. If `prev.HigherSegmentExists == false`, set `prev = current` and skip this edge (IL40–54).
3. Read `prev.HigherHandle` and `current.LowerHandle` (IL59–88).
4. Both handles absent: add a line between `prev.Path` and `current.Path`, except equal anchors produce no line (IL90–145).
5. Otherwise add a cubic. An absent outgoing handle becomes `prev.Path`; an absent incoming handle becomes `current.Path` (IL150–219).
6. Continue with `prev = current` (IL224–225).

Thus the outgoing boolean belongs to the preceding anchor. The final point's true value enables final→first; its false value leaves that contour open. An interior false value suppresses only that particular edge. It must not delete either adjacent point or the other neighboring edges.

Two independently used branches agree for ordinary stored data: `VectorShape.SNnI` (100702752, named `WorldBezierCurves` by its lambdas), IL1876–1980, constructs every circular adjacent pair as `I5hl` and sets `Y5XV=false` when the preceding point's boolean is false. `I5hl` constructor 100720124 IL17–43 explicitly passes previous Path/Higher and current Lower/Path, and IL74–82 copies the preceding boolean.

## 2. Missing handles: supported and unsafe boundaries

`f5wV.c5ww` (100721940) tests `IsNaN(X) || IsNaN(Y)`. `f5wV.m5wf` (100721939) tests `IsNaN(X) && IsNaN(Y)`. Both are captured in `rp-vector-path-point-cil.json`.

- Axvg conversion and `J5vd` use **any-axis NaN** (`c5ww`). Axvg replaces such a handle with a null `Nullable<Point>`; it does not change the anchor.
- `I5hl` constructor 100720125 IL270–296,321–347,372–392 and `R57t.u57o` 100719889 IL172–259 use **both-axis NaN** (`m5wf`): each absent handle independently falls back to its own endpoint. Both absent marks a straight segment.
- Therefore a one-coordinate-NaN point has different treatment in the two native chains. It is not safe to generalize either behavior to all renderers.
- The independently inspected 2,805 sample vectors / 66,897 points have **zero partial-axis-NaN handles**. A faithful bounded decoder can accept only double-finite or double-NaN handles and reject partial NaN, missing keys, Infinity, and malformed tagged values.
- A segment with just one of its two handles absent is a real cubic, with that missing handle replaced by the matching endpoint. Do not convert it to a quadratic or line. The census found 20 enabled edges of this kind in 7 Flow library objects.

`z5EE.Load` (100719031 IL185–295) has a special anchor-NaN repair behind its second boolean parameter: each NaN coordinate can become 0.5. The calling context of that compatibility flag was not established here. This is not authority to repair malformed imported anchors; reject nonfinite anchors in the bounded converter.

## 3. Axvg representation is not SVG path command enumeration

`RPFormatExtensions.aJcs` (100692667) selects the generated/stored contour arrays. `dJcl` (100692668) maps each point with 100692679. That lambda always creates `BezierData` and sets `PathData.Type=3` (IL33–40), even where its handles are null.

`<GetAxvgPathArray>b__0` (100692691): creates an Axvg `Path`, assigns its Data and decorations, and sets `Closed = LastOrDefault(contour).o5Eh()` (IL49–63). Its point array does not carry interior segment booleans. Do not assume this Axvg interchange representation alone proves handling of arbitrary interior gaps.

Two different enums must not be conflated (`rp-vector-path-enums.json`):

- `Axure.Axvg.Graphics.PathDataType`: Start=0, End=1, Line=2, Bezier=3, Arc=4.
- `Axure.Platform.Drawing.PathDataType`: Arc=0, Close=1, Ellipse=2, Line=3, Transform=4, Curve=5, Bezier=6, TrueArc=7, PolyBezier=8, AxisAlignedRect=9.

The proposed `M/L/C/Z` document commands are a new normalized representation derived from the verified geometry contract, not a copy of either numeric enum.

## 4. Fill, open contours and compound paths

There is positive evidence for **nonzero** fill; this is not an assumption from an enum's default value.

- `YHFL.vHFD.QHFh` (100723365), ordinary fill branch IL272–321, maps the complete `oHjG` contour collection through `xHFY`, then calls the graphics `G3jJ(brush, paths, false)` method. The sibling branch IL108–157 uses `SHFZ` identically.
- SVG graphics implementation `HHbr.dHbV.G3jJ` (100723564) IL14–32 explicitly constructs `E5dq(..., 0)`, whose final parameter is `Axure.Platform.Drawing.FillRuleSvg`. `E3jb` (100723563) does the same. Enum metadata establishes 0=NonZero, 1=EvenOdd, 2=Unspecified.
- `E5dq.M5do` (100720708 IL7–38) iterates all supplied render paths into the **same** path object. The compound contour collection therefore shares one winding calculation. Preserve original contour order/orientation; do not normalize the orientation of holes.
- `E5dq.I5dz` (100720709 IL33–39 and295–301) skips the fill-rule writer only for Unspecified=2; otherwise it calls `q5qO.O5qZ` with the stored rule. The writer selects distinct strings for values 0 and1, but those exact strings remain behind the string decoder. The meaningful enum names and explicit call-site argument establish nonzero without guessing the hidden string.

**An open outline is not automatically excluded from fill.** The fill preparation and stroke preparation diverge:

- `vHFD.nHFe` (100723358, lambda names establish `DisplaceCurvesForShape`) IL1760–1813 maps unmaterialized segments through `lHF2` and adds the contour to fill collection `oHjG`.
- `lHF2` (100723364) returns a materialized segment unchanged; when `Y5XV=false`, IL33–56 creates a straight segment between the same start and end. This loses any missing edge's unused handles for fill purposes.
- `xHFY`/`SHFZ` (100723376/375) pass `true,true` to `CHFd`. `CHFd` (100723372) IL185–192 appends a close when its final boolean is true. `R57t.a572` (100719862 IL34–45) appends a drawing close object.
- Stroke builder `R57t.u57o` (100719889) checks each outgoing flag at IL261–268. A false edge does not add its cubic; it marks the preceding path segment's end at IL328–353. Only an entirely unbroken contour appends a close at IL405–412.

For a contour where **only the last flag is false**, SVG commands without `Z` produce the right topology: no last→first stroke and a straight implicit close for fill. Do not emit a final cubic based on the last outgoing/first incoming handles in that case.

For an **interior false flag**, splitting stroke into multiple SVG subpaths can change implicit fill closure: native fill replaces the omitted edge with its direct endpoint chord while retaining the complete contour. A single shared fill/stroke command list is not proven equivalent for these contours. Either represent fill and stroke separately, or reject this case in the initial shared-command implementation. This is an explicit bounded-support decision, not an assertion that Axure cannot render it.

The exact behavior of arbitrary intersecting/overlapping contours after native stroke-displacement and winding-zone processing is not fully reproduced by this investigation. Nonzero geometry is established; final raster pixels are not.

## 5. Coordinate scaling and shape-generated changes

The control points are normalized geometry. Their coordinates are not pixel coordinates, and valid control handles can extend beyond [0,1]. The correct transform is interpolation over the chosen sizing rectangle, not clamping.

Confirmed transform chain:

`VectorShape.WNnH` 100702750 → `<ToWorldAxBezierPoints>b__0` 100702892 → `WNn5` 100702749 → `z5EE.v5ED` 100719036 → `<ToWorldAxBezierPoint>b__0` 100702888 → `KJm7.eJmT` 100695285 → `d5pN.g5pa` 100720534 → `A5ph` 100720533.

`A5ph` interpolates the two horizontal rectangle edges by X, then between those results by Y. Its `D5pZ` (100720547) is exactly component-wise `start + (end - start) * t` (IL7–57). For an unrotated rectangle this gives `left + width * x`, `top + height * y`. `z5EE.v5ED` transforms the anchor and each nonmissing handle, retaining the outgoing flag (IL7–105).

**Stored outline recovery does not reproduce all final paint adjustments.**

- `cSqL.DSO4` (100708406) is exactly `Shape == 300` (IL7–15).
- `VectorShape.LN4g` (100702676) returns the cached/stored contour list directly only for Shape300. Other enums invoke `jN4k` and replace the cached points via `DN4W` (IL7–43).
- `jN4k` (100702679) obtains the sizing rectangle and clamps the corner-radius input with both dimensions, then calls `L5vW.w5Qk` (100722530) with shape, radius, border width/style, smart shape options and border flags. The shape factory contains substantial enum-specific generation.
- `VectorShape.NIwY` (100702762 IL401–465) invokes `LN4g(0)` before serializing ControlPoints. Thus a valid saved native file carries the then-generated outline, but inconsistent hand-edited shape/style/point combinations can be regenerated differently by the original application.
- `WorldBezierCurves` 100702752 uses an internal sizing rectangle, accounts for border width/style/open-loop state, and may snap near-axis straight segments (notably IL120–198,535–614,1258–1852). `uN4m` 100702705 calls the border/shape-dependent `d5pN.l5qE` (100720583), whose branch logic includes half-pixel offsets and horizontal/vertical-line dimension changes. These adjustments are additional to normalized path decoding.
- Full Placeholder decorations, smart-control regeneration, partial borders, corner treatment, stroke alignment, cap/join/dash and pixel rounding are not established as equivalent by recovering ControlPoints alone. Keep those caveats visible rather than call every stored path an exact final-paint clone.

## 6. Empty text across vector shape enums

The existing RP11 empty-text inference can apply to additional recognized VectorShape enums: the same `VectorShape.NIwY` method calls `TextRectObject.NIwY` at IL345–346 without a Shape enum check. The prior narrow evidence in `rp-next-coverage-evidence.md` shows empty rich text is omitted by the shared base serializer and initialized empty by the reader/constructor path.

This supports an RP11 `Axure.DocumentModel.Objects.VectorShape` with absent known text carriers, not a malformed RichTextBlock and not an unknown widget type. It does not validate that inference for old 9.0 document schemas or unknown additional fields. `SmartControlPoints` cases require their separate handling/explicit rejection; absence of text does not establish that their geometry is safe.

## 7. Sample cross-checks and useful fixtures

The companion `rp-vector-census.md/json` was independently produced by the format agent. It reports 11 samples, 2,805 VectorShapes, 66,897 points; no partial-axis-NaN handles; 879 compound-path objects; 107 objects with any false edge and five with an interior false edge. Vertex-level one-sided handles (1,443 objects) and segment-level one-sided handles (20 enabled edges in seven Flow objects) are different counts.

Representative raw records (full arrays in the census):

| Purpose | Sample SHA-256 | Package / object |
|---|---|---|
| Ellipse with four genuine cubic segments | Default.rplib `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50` | `b03be8f331a44681af88fcd04b65d4f5` / `c3a933c53d05434c95ec7908c6240a69`; four anchors (0.5,0),(1,0.5),(0.5,1),(0,0.5), handle coefficient 0.56 |
| One missing handle on an enabled edge; valid handle outside unit square | Flow.rplib `95d85ffaddac36144ae8ebd645341b2e557f0a6157b092319e7dac7b71d9d451` | `a54b78fa63b74288806a69616ceff901` / `faf5956c4dad4ea5aa21fe383b24a645` (Delay) |
| Interior break, not safe for one shared fill/stroke list | Same Flow SHA | `92476d9294a046d287418b0e2bca600a` / `9b4ede1f17314ff080e3468a52cc0eff` |
| Compound contours | Sample form patterns.rplib `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179` | `0581800951de42b9b1e81ec3aa427dfa` / `a013e4439c9f4eea97bd3e1e19144660` |
| Fully closed compound contours, no stroke | Prototype Starter.rp `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714` | `90fd4ed4c9744465add63a878e1da5f1` / `9400519e576846fba77e7f7b43374366` (Blood); two contours with 5 and6 anchors, 24×33 at (298,142), solid fill, stroke width0 |

For the ellipse, preserving the stored cubic handles removes the browser-ellipse substitution from the prior implementation. This establishes stored curve fidelity, not equality to native stroke rasterization.

## Recommended first implementation boundary

Accept complete, finite anchors and strictly finite-or-double-NaN handles; preserve contour order and handle coordinates without clamping. Emit `M`, then `L` or `C` using the verified endpoint fallbacks. A fully connected contour gets its actual final segment plus `Z`; a last-false contour has no final segment and no `Z`. Use a shared nonzero fill rule for accepted ordinary contours. Reject interior false flags, partial-axis NaN, missing/duplicate/unknown path fields, and unsupported smart-control metadata until the product can faithfully express those cases. Apply existing independent text/style/interaction rejection rules unchanged.

Remaining unknowns are final border/displacement raster parity, arbitrary compound-path fill after all native processing, exact legacy-schema defaults, and malformed-data recovery. No original-application render or GUI comparison was performed in this investigation.
