# Native six-anchor pills: format and complete-import evidence

Target: Axure RP 11.0.0.4150, DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. This stage uses existing original files, static CIL and controlled independent replay. It does not execute the original DLL or compare the original GUI.

## Narrow geometry contract

Native `m5vw` (token100722500) first merges the eligible last/first seam (IL0x0D–0x3E), then adjacent eligible points (IL0x54–0x8B). `P5vT` (100722499, IL0x07–0x20) retains the first lower handle and second higher handle, anchor and segment flag. `N5Ex` requires coincident anchors and degenerate joining handles; arbitrary coincident control points are not sufficient. The independent [native replay](native-pills-evidence.md) matches all28 observed pills, including every handle and segment, within1e-12.

The reader adds only the witnessed **six stored anchors / eight expected corners** case to the existing current-size rectangle recognizer. It coalesces eligible expected points, then keeps the prior strict coordinate, dual-handle, segment and cyclic-order checks. Existing eight-anchor encoding remains accepted. Edited handles, partial NaN, missing handles, a broken segment, reversed winding and extra contours remain rejected. Actual effective P71/P81 and their existing cache/flag provenance remain mandatory; Shape0 alone grants nothing.

The saved vector commands are unchanged. P71 remains the original scalar even when the generated path is clamped: the reachable200×6 object `d515a37dfd114af6877e6c6d4d244032` retains radius5, rather than substituting3. Source `e6d3d1fe008947a0a3ef9244d3296be6` is48×24/radius30 but remains inside a rejected parent and is not offered as a complete-import demo.

Only `read-rp-semantics.mjs` changes in this agent's production scope. The existing importer checks already accept the verified physical paths. The separately owned renderer fix removes an expected floating-point degenerate straight segment only when normalized-family segment counts differ; it does not change the physical validator or paint formula. See [the renderer analysis](native-pills-render-analysis.md).

## Coverage and unchanged boundaries

The initial41 exclusions resolve to **28 raw six-point pills**, **9 eight-point/current-size mismatches**, and **4 contained Tree labels without their own size**. The four labels already use their independent tree-layout contract. The9 mismatches retain their saved paths. Neither group receives new corner metadata.

All28 raw pills pass recognition, **26** appear in the existing semantic traversal, and **18** are present in complete document imports. Eight stay inside four fit-to-content panels whose child bounds remain unsafe; two belong to native RepeatableDiagram templates outside the current traversal. Their exact IDs, incoming references and part hashes are in the JSON companion. No parent rejection was weakened and no isolated-owner conversion is presented as a successful document import.

[The18-widget data file](native-pills-imported-widgets.json) contains only full actual imported widgets, with original source/package IDs and file/part hashes. It is intended for independently labelled authoring/browser fixtures; later synthetic actions or layout edits are not original sample content.

Fresh current and frozen-before pipelines cover all11 original samples. Exactly18 widget nodes change path→box, scalar radius and explicit corner mask. Where raw P80 is15, the all-visible border tuple is added; a generated unnamed path label becomes the corresponding box label. All IDs, saved commands, geometry, text and interactions remain unchanged. Document/page fields and numeric report counts match; diagnostic issue text is not asserted byte-identical. Added/removed widgets and event/action deltas are all0. Icons retains the same page-count rejection.

| Original file | Changed widgets | Compact semantic bytes | Counts |
|---|---:|---:|---|
| Default.rplib | 0 | 1,384,841 | same counts |
| Flow.rplib | 0 | 929,337 | same counts |
| Icons.rplib | 0 | 22,526,467 | same prior rejection |
| Sample form patterns.rplib | 18 | 28,782,471 | same counts |
| Sample UI patterns.rplib | 0 | 7,903,554 | same counts |
| Prototype Starter.rp | 0 | 2,804,681 | same counts |
| Prototyping Basics.rp | 0 | 5,991,831 | same counts |
| Quick Win.rp | 0 | 1,177,683 | same counts |
| UX Prototyping.rp | 0 | 4,881,014 | same counts |
| the-basics-tab-menu.rp | 0 | 103,831 | same counts |
| complex-interactions-required-fields.rp | 0 | 172,501 | same counts |

Maximum compact output is **28,782,471 bytes**, below the actual desktop worker32MiB cap. Every original file hash is checked before/after reading.

## Validation and first failures

The new Node file has41 cases; its old-reader baseline was12pass/29fail. Final focused checks are **91/91 Node**, **36/36 Vitest**, and typecheck. The importer test traverses the real complete Form file and save/readback. The independent static/native replay reports58/58; the independent final review reports416/416, including1,232 raw mutations and924 normalized-path mutations. These are research and focused test results, not original GUI equivalence.

The first import test incorrectly treated all28 source records as complete-document widgets. It was corrected to the evidenced26semantic/18complete split, with exact IDs and unchanged atomic boundaries. Initial difference checks also omitted derived fallback names and proven all-visible P80 metadata; the final audit permits those exact changes only. The original red/failure logs and scoped diffs remain pinned.

The initial inventory remains a **pre-implementation snapshot**. Its historical reader/renderer hashes resolve to the frozen backup and are not relabelled as current. Previous native-corners reports and original sample files remain unchanged. No full suite, browser, desktop, build or package run is claimed by this format investigation.

Refresh current import evidence, then freeze (do not rerun the historical inventory):

`node --disable-warning=ExperimentalWarning research/native-pills-format-import-audit.mjs`

`node research/native-pills-format-freeze.mjs`
