# Native point contours: authoring implementation

This stage extends ordinary **TN46(points,false)** commit measurement for the existing M/L/C/Z document model. It does not add a new path format, change AutoFit, write every adaptive view, or execute the original editor. Source contracts are the frozen [topology evidence](native-point-contours-topology-evidence.md) and [sizing-frame evidence](native-point-contours-rotation-evidence.md). Original GUI comparison remains unavailable.

## Changes

- `src/model/vector-contours.ts` constructs temporary native-style curves, including Last→First, and keeps outgoing participation separate from geometric closure. It filters curves using owner-local physical Manhattan distance, including the strict .001 control/endpoint predicate and single-remaining-curve threshold1. It preserves every saved command.
- `src/model/vector-commit.ts` uses those temporary curves only for bounds. Unrotated selection takes active curves; all-pruned data falls back to the first raw anchor; surviving but wholly inactive curves use zero union. Rotated selection includes inactive retained curves and uses zero union without a first-anchor fallback. Normalization still maps the original commands.
- Sizing-frame creation treats strict `abs(angle)<1e-5` as unrotated before normalized→world mapping. Other angles keep rotated dispatch, including ±360. Native signed-remainder trigonometric shortcuts are applied without rewriting the stored angle.
- The first-anchor fallback skips outward rounding and enters minimum-size expansion with its fractional raw point. Other ordinary bounds retain the existing source-derived rounding and minimum rules.
- The helper's input style type is narrowed to the one field it reads, `strokeWidth`. No shared schema, adaptive, runtime renderer, App or Inspector changes were needed.

The existing dedicated command still writes only changed Location/Size pairs into the current view, shares path/type, preserves other active/inactive declarations and AutoFit flags, and commits one history operation. Existing no-op/fill-rule compatibility and unsupported parametric-point guards remain unchanged.

## Red, green and independent correction

The first new unit run was **59/85 passing, 26 failures**, against frozen old product source. The new temporary topology and sizing-frame implementation made all85 pass. Existing focused checks then produced167/168: the sole obsolete assertion expected M-only to throw. That assertion now tests a truly empty command array instead, retaining out-of-document and whole-page atomicity checks. M-only positive behavior is independently covered by the new tests.

Independent topology review then exposed a real omission in the first candidate: first-anchor fallback had incorrectly passed through outward rounding. The previously chosen stroke4 example happened to mask it. A new stroke1 regression proves world point(12.25,30.75) must produce owner(11,30,1,1) and normalized(1.25,.75). It failed before the narrow correction. Parent preserved the complete first candidate/package/source evidence in `.build/native-point-contours-before-fallback-fix/`; the earlier green records were not overwritten.

After this correction, the focused unit set is **254/254**:86 new cases and168 existing cases. Typecheck passed for the implementation candidate; parent owns subsequent final full typecheck. Independent final reviews report **71/71 topology**, **69/69 rotation/topology differentials**, and **231/231 bounded operation-order comparisons**, with stable production hashes and no remaining blocking findings.

## Browser evidence and current handoff

The first isolated production focused run completed **49/49**,0 skipped,0 unexpected,0 flaky, in140.3s. Its wrapper verified/restored287 historical artifacts. This run used the **pre-fallback-correction dist**; it is retained evidence of those exercised flows, not final validation of the fractional fallback fix.

The new browser file contains six cases: detached tiny contour with seven commands; delete to M-only and a subsequent drag; tiny-angle versus full-turn numeric editing; and shared adaptive view editing with Affect All Views both off/on. They verify save/reopen, undo/redo, selected-anchor continuity and retained fit/other-view data.

After that first run, the M-only case was strengthened to submit a fractional world X108.25 through the actual numeric Inspector, requiring owner X107 and normalized X1.25, plus the additional undo/redo/reopen. It remains one of the same six cases. **That last browser assertion is handed to the parent's rebuilt-candidate run and is not claimed as executed by the earlier49/49.** Final package and comprehensive results belong to `research/native-point-contours-verification.json`, produced by the parent.

The synthetic fixture is `tests/fixtures/native-point-contours.ts`, with `nativePointContoursFixture()`, `CONTOUR_TARGET_ID='contours-target'`, and an independently calculated `expectedDetachedContourCommit()`. The browser's first case writes `artifacts/native-point-contours-source.rea.json` for exact shared desktop input. This is an authored source-derived boundary fixture, not an original saved Axure sample.

## Explicit limits

- M/L/C/Z cannot store independent inactive first-incoming/last-outgoing handles. Its adapter treats absent handles as absent; it does not invent native carrier data. Explicit repeated endpoints and all commands remain stored.
- Empty command arrays remain rejected by the document schema. Native geometry-function behavior on an empty outer list does not prove an original authoring gesture permits an empty saved widget.
- General P1401 transforms, nested native provider stacks, original GUI history/cancellation and arbitrary native editing gestures are outside this reconstruction.
- Pen creation, border hit testing and the general `vectorSegments` editing API are unchanged. Native filtering is not a simplification of the path the author can select.
- Existing document coordinate/size budgets remain in force. Rejected commits do not mutate the document. The pre-existing void editor callback's selection movement after a rejected command is noted in the read-only analysis; this stage does not redesign that API.
- No extra production build, package or full suite was run by this owner. The parent handles final integration and release.

The companion JSON binds final files, old/new unit evidence, preliminary browser evidence, the independent reviews and the preserved failed candidate. Earlier stage evidence and the read-only analysis snapshots are retained.

