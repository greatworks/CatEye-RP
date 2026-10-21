# Selection pointer resize: bounded model integration

This stage adds `src/model/selection-pointer-resize.ts` and its dedicated unit tests. It does not change the existing layout transaction, numerical solver, effect persistence, renderer or runtime. Browser hosts and release verification are separately owned. Passing these tests is not original Axure GUI, font, pixel or whole-product equivalence.

## API and state lifetime

`prepareSelectionPointerResize(targets, handle)` captures immutable initial owner rectangles and a common selection frame without measuring text. Each target supplies an explicit translation-context layout input and synchronous measurement/unit/minimum services. The prepared object contains `original` and initial `state`.

`planSelectionPointerResize(original, state, {delta, modifiers})` synchronously plans one cumulative pointer frame. A success returns every target's next state, ordered incremental layout results for `applySelectionAuthorEffects`, and diagnostics. Failure returns only a reason, target identities and attempted trace; it exposes no commit results or partially updated state. Source and incoming state are not mutated.

Initial geometry and live layout state are deliberately separate. Original owner frames remain fixed throughout a gesture. Current TextPanel rectangle, owner frame, raw/effective fit flags, LocationInDiagram and measurement counters survive between calls. The single-selection fit hot-zone flag is controller state, never saved widget data. Measurement services receive an independent context copy and each target's cumulative pass number. Service implementations, fonts and units remain explicit host inputs.

The host must process pending frames in order against current state and apply each successful frame's complete effects to its current candidate document. Geometry, paired adaptive declarations and fit effects must not be reconstructed by comparing the final owner frame. Pointer history, document ownership, stale async cancellation and publishing remain host responsibilities; the pure planner neither opens an undo transaction nor touches a document.

## Source-bound dispatch

The frozen source contract is `selection-pointer-evidence.md/json`, with instruction hashes in `selection-pointer-manifest.json`. That research interprets retained CIL records and supplies controlled services; it does not invoke the original DLL or GUI.

- Single unrotated SelectionButton admits only Left/Right. It follows `CbNX → obN4 → VbN8`, not the Layer/root proportional path. The original rect supplies geometry; signed dimension delta rounds AwayFromZero and preserves its opposite anchor. `obN4` IL455 calls virtual `xJdR` for the minimum; the product reuses `readMinimumSize`. The source fixtures' ordinary 1×1 value is an explicit provider input, not a literal in obN4.
- Multiple SelectionButtons use the old shared selection rectangle, common clamp and `INw2` projection. Root pin info is absent and fixed-field enforcement is not introduced. Locked roots still contribute to the frame but do not call layout/measurement services or produce writes.
- `JbNd` checks current effective AFW and horizontal freedom. Its strict `abs(dx) < 1e-5` assignment can preserve AFW for an initial zero/tiny frame. A nonzero first horizontal drag disables AFW; returning to the old edge does not restore it. Single hot-zone refresh can skip later setter calls. AFHeight is not changed by this pointer branch.
- The numerical request passes to Size before its requested Location. Size may synchronously change owner dimensions and panel through OI8Z/WIyL. The final requested Location is then written; no generic anchoring pass replaces it using the measured height.
- All pointer geometry effects are current-view writes, independent of Affect All Views. Shared fit changes remain shared. Parent/sibling/inactive declarations and raw text/style content survive effect persistence.

## Verification and preserved failures

The first red run is `.build/selection-pointer-model-red-first.json`: module collection failed because the new implementation did not yet exist. It is not counted as five executed behavioral failures. The first implementation passed five tests; source-driven tests were then added without changing the production module.

The final dedicated suite has **42 passing tests**. It includes seven retained single-session scenarios (21 frames), eleven multi/locked scenarios (22 frames), and twelve zero-angle numerical cases. The session comparisons check every final owner/panel/fit value, requested frame and full ordered layout effect payload. Multi comparison removes only diagnostic measurement indices: the source harness counts all widgets globally while product services count per target. Measurement widths/flags/order and all other compared payloads remain exact.

Other cases verify atomic second-target failure, immutable source/state, west Size-before-Location behavior, shared-frame projection for different target widths, zero-panel locked placeholders with throwing unused services, unsafe/modifier rejection, and incremental adaptive persistence with shared flags, parent/sibling/inactive maps and save/reopen retained. The twenty-percent browser fixture expected frames are written independently as `(100,100,288,20)` and `(520,100,216,20)`.

Related focused validation is **328/328**: 42 pointer + 194 layout geometry + 62 property transactions + 21 ordered effect persistence + 9 async host sessions. Exact commands, logs, counts and SHA-256 values are in the companion JSON. No full suite, browser, packaging or original application was run by this model task.

The first complete typecheck passed. Later typecheck logs preserve two errors in a concurrently authored E2E fixture (`notes` is not an adaptive override field); these are outside this task's files and were reported to its owner. The companion manifest records the final available typecheck evidence without rewriting those failures.

## Deliberate boundaries

Only ordinary checkbox/radio targets in an unrotated translation context are accepted. Single vertical/corner handles, mixed types, general transforms, active inline editing, and any nonzero modifier are rejected. This is an explicit product boundary; source evidence for some rotated/modifier branches is not presented as implemented.

Saved geometry must remain finite with coordinates within ±100000 and owner size 1..100000. The shared frame follows the same bounded domain. A source numeric request may reach a width below the indicator; a resulting negative available text width is atomically rejected by the existing layout adapter. Native partial mutations on failure are not emulated. Native measurement/graphics/empty-sentinel behavior outside explicit services remains unproved here.

A locked host may use an opaque zero TextPanel placeholder because that branch never consumes it. It is not claimed to be the native panel value. The model can safely return an all-locked no-write result; the host remains responsible for hiding unavailable handles. Scope discovery, snapping, browser font substitutions, pixel positions and full native undo subscriptions are outside this model report.

`fullAxureParity=false`; `originalGuiCompared=false`. This report does not mark the complete project or release finished.
