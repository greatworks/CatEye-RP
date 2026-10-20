# Native point contours: authoring integration analysis

Date: 2026-10-17. Scope: current independent product source, retained static evidence, and a read-only execution of current product helpers. **No production/test/old-evidence edits, original DLL execution, browser, GUI, build or suite run.** This is a design handoff, not a parity or release verification.

The companion JSON binds 23 source snapshots and contains the full current-product observations. New rotation extraction files are identified as snapshots of ongoing peer research; their presence is not a claim that the final native contour contract has frozen.

## Current behavior and representability

| Case | Current behavior | Entry |
|---|---|---|
| Empty command array | Strictly rejected, including serialization; a widget can instead omit vectorPath. | vector.ts:6–36, 44; types.ts:5–7 |
| M-only, MZ, consecutive M | Valid stored paths, with logical anchors but no drawing segments. A changed path cannot commit because bounds have no participating segment. An unchanged prepared path remains a product no-op before that check. | vector-editing.ts:12–30, 66–81; vector-commit.ts:70; adaptive.ts:24–28 |
| Exact zero L/C | Counted as a segment and included in bounds. Repeated point at (150,150), stroke1 gives owner (149,149,1,1), normalized point (1,1). | vectorSegments; commitVectorGeometry |
| Tiny segment | No .001 filtering. The probe's nominal world lengths .000999/.001/.001001 all participate. Floating representations are retained in JSON; these are observations, not exact native threshold assertions. | vector-editing.ts:66; vector-commit.ts:60 |
| Multiple subpaths | M resets the segment start; no spurious segment connects separate contours. Bounds union all L/C and noncoincident Z closure segments. Isolated M anchors do not affect bounds but remain in the output and are normalized with every other command. | vector-editing.ts:66–81; vector-commit.ts:15–22, 60–89 |
| Coincident cubic endpoints with nontrivial handles | True cubic extrema contribute; endpoints alone are insufficient to classify degeneracy. The probe gives 88×88 bounds for its loop-like cubic. | vector-commit.ts:26–40 |
| Tiny nonzero angle | Every nonzero angle generates rotated world controls and takes the rotated bounds branch; there is no 1e-5 angle gate. At +.000009°, the test polygon gives Y99.99999607300919 instead of the angle0 Y100. | vector-commit.ts:10–13, 55, 57, 73–76 |
| Delete two anchors to one | Editing helper returns a valid M-only path; dedicated geometry commit then rejects it. This is an integration gap, not parser inability. | vector-editing.ts:132–138; vector-commit.ts:70 |

The model expresses open/closed M/L/C/Z paths, mixed contours, repeated anchors, cubic handles, fill rule and isolated anchors. It does **not** independently store native HigherSegmentExists, an inactive outgoing edge or inactive closing handles. Do not equate that flag with Z without the native construction/selection proof. It is still unknown whether the supported authoring/import subset needs new persistent metadata or whether an internal derived-contour representation suffices.

The native rectangle preparation in vector-authoring.ts:16–55 is a separate bounded constructor. Its .44 handles and 1e-5 coincident-point coalescer reproduce that builder's rules, including its restart quirk. It must not become a generic path simplifier or substitute for native ReIndex.

## Evidence boundary

The frozen native-point-commit-evidence.md:38–56 and :82 already distinguish unrotated/rotated selection and acknowledge incomplete contour assembly/ReIndex. Ordinary node edits remain **Cj34 → Kj3n → TN46(points,false)**. The independent format report closes current-view Location/Size writing, shared path, retained AutoFit and no Affect All Views read. None of this investigation reopens RN4I's different operation.

Retained instructions directly inspected here include:

- ReIndex predicate 100723281, IL13–22 passes .001 to curve K3ju; MHr4 100723166 contains a separate single-remaining-curve endpoint comparison with literal1 at IL185–194 and a conditional Remove at IL212. The branch direction and complete cubic predicate are left to the topology replay, rather than inferred from method names.
- Peer topology investigation reports Manhattan strict comparison, Last→First plus adjacent curves, separate Y5XV participation, and filtering of **derived curves rather than saved ControlPoints**. Final ordering, selector and empty-contour results are pending.
- d5sq 100722226, IL33–48 calls TbxU(angle,1e-5); the small-angle branch returns boxed unrotated j5u5, while the other constructs g5s7. jbxa 100688805 multiplies by π/180 at IL7–17, establishing degrees. The peer traces this factory through get_SizingRect, before world-control generation. Therefore merely replacing the later `angle !== 0` test would leave the wrong tiny-rotated inputs.
- Unrotated iN4x has a first-stored-anchor fallback. The rotated branch has no equivalent explicit fallback in the presently tracked source. The complete all-filtered/empty union result remains pending. Do not manufacture a shared fallback or keep a blanket rejection as if either were already native proof.

Original GUI/canvas behavior is unobserved. Parent reports the fresh FrameArrived/window capture attempts still failed. Static/CIL-derived results are not screenshots or original interactive history verification.

## Minimal implementation seam

Keep authored commands and measurement topology separate. A small pure internal contour projection can retain command/anchor provenance, open/closed status, actual cubic geometry and participation flags while deriving the curves used for native bounds. Apply native degeneration/reindex rules to that temporary list only. Continue mapping the **original full command list** into the committed frame unless evidence explicitly proves persistent point removal.

Do not globally alter vectorSegments: it also feeds canvas hit-testing, exact segment splitting and global logical anchor indices. Filtering it would make saved/visible tiny nodes harder to edit and silently change unrelated behavior. A new bounds adapter beside vector-commit.ts is safer; reuse primitive point/curve calculations where contracts truly match.

Coordinate-frame selection belongs before world-point construction, bounds, and normalization. Introduce one evidence-based sizing-frame adapter and keep the stored angle unchanged. Feed the same chosen frame through both directions. Small-angle, signed threshold and full-turn behavior need the native factory oracle; do not collapse every multiple of360 to zero merely because its visual transform is equivalent.

Retain applyAdaptivePointEdit's atomic validation and existing return shape. It already delays mutation until geometry succeeds, shares path/type, writes only changed complete Location/Size in the current slot, preserves active/inactive declarations and shapeText, and handles fill-rule-only compatibility separately. If output topology is preserved, existing point indices can remain stable.

If new native evidence requires persistent topology changes, the commit result must explicitly carry an index mapping/success result through App and both editors before implementing them. Current callbacks are void: App.tsx:148–149 catches an error, while CanvasVectorTools.tsx:125–128 still updates selection using the proposed deletion result. Inspector.tsx:491 similarly moves its command selection after a void callback. This can change selection after a rejected operation; it is a code-path finding, not a browser-observed history defect. Even without remapping, an explicit committed/no-op/rejected result would let each UI retain selection on failure.

## Authoring and global impact

Canvas selection uses logical anchors; numeric Inspector uses raw command indices. Explicit closing endpoints can therefore be one canvas anchor but separate numeric commands. Preserve both established contracts and test their transitions. Canvas source/frame changes cancel a held draft, while its session key survives successful self-commit (App.tsx:125–127, 473). This protects consecutive operations after rebounding; do not return to geometry-key remounting.

The toolbar permits entry for M-only paths, but border double-click cannot hit a path without segments (App.tsx:434, 458). Numeric editing and keyboard deletion already reach the dedicated command; adding another modal or separate canvas is unnecessary. All no-op/Done/cancel and unsupported partial-border/independent-corner guards stay intact.

Pen creation uses a different controls-hull/minimum-size policy (vector-editing.ts:180–191) and requires two points. Do not silently change Pen creation with this commit correction. Ordinary path display/export already emits M/L/C/Z unchanged. Without new serialized fields, runtime/portable renderers, styles, document validation and import should need no behavior change. If inactive edge metadata proves necessary, parser, clone/component, import and portable export become explicit additional scope; they cannot be skipped.

## Meaningful validation plan

1. Native-derived unit matrices: empty collection versus M-only/MZ, consecutive isolated contours, one active plus one distant isolated contour, multiple open/closed contours, inactive closure participation, exactzero and nearzero L/C, coincident endpoints with extended handles, and the single-curve endpoint threshold. Include .001 and1 just below/at/above in the correct world coordinate metric after the full predicate is frozen.
2. Coordinate-frame matrices: angles0, signed values just below/at/above1e-5, and360 (plus negative full turn if source supports it); verify both bounds and normalized controls against source replay, not an implementation-shaped expectation. Preserve original angle, full command order and source immutability.
3. Model integration: Base/current named/shared set, inherited geometry and inactive maps; AutoFit and styles retained; only changed atomic Point/Size written; same prepared path and fill-rule-only command keep prior behavior; rejected bounds/schema input leaves the whole document unchanged.
4. Browser authoring: detached tiny contour does not inflate bounds once proven; delete down to M-only then drag/numeric-edit; one undo/redo and save/reopen; selected anchor survives successful rebound and rejected edits; a second drag and 1-sharp/2-round act on the intended anchor; zoom and nested editing scope retain coordinates.
5. Numeric/canvas equivalence and display: modify the same contour through both entry points, compare stored output and preview/offline SVG topology. Cover M-only visual absence without losing Outline/selection recovery; no new runtime AutoFit semantics.
6. Focused old checks: vector editing/review, native point authoring/commit, vector schema, rotation and relevant adaptive/component tests. Existing tests cover compound splits, unrelated degenerate cubic retention, cubic extrema, rotation37/90, per-view scope and failure atomicity; they do not prove native ReIndex, singleton fallback or tiny-angle thresholds.

The useful implementation split is (a) frozen native contour/rotation oracles, (b) pure bounds adapter plus model unit tests, (c) narrow authoring success/selection plumbing only if required, and (d) parent browser/save/runtime visual acceptance and packaging. No implementation is authorized by this report.

## Observation procedure and integrity

The JSON contains 14 current-product path observations, eight angle observations and one two-to-one deletion observation, all executed from current TypeScript source in memory with Node's stripTypeScriptTypes and vm.SourceTextModule. No assertions or test suite were run; unchanged-input checks are recorded for all14 path inputs. An initial attempt to use TypeScript's transpileModule failed because this checkout exposes only version metadata; esbuild was absent. The successful built-in Node method did not install dependencies or write a compiled module.

Source hashes are the actual bytes read, not copied from the previous release report. The final report creation rechecks those snapshots. Only these two new analysis files are written.

