# Native point commit: authoring implementation

This stage replaces the previous type/path-only commit with the geometry behavior
of the ordinary point-mode entry **Kj3n → TN46(points,false)**. It does not use the
different RN4I entry. The reconstruction is based on retained instruction replay
and product tests; it is not an observation of the original editor GUI.

## Entry correction and retained failures

The initial RN4I hypothesis would have cleared AutoFit and propagated relative
frame changes through eligible named views. The connected point-mode caller
disproved that hypothesis before any of that integration was implemented.
`.build/native-point-commit-rn4i-hypothesis.json` records the correction and binds
the preserved test snapshot and its 18 failures / 2 passes. Those results must not
be counted as proof of ordinary point-edit scope.

The revised TN46 tests were then run against the unchanged product:
`.build/native-point-commit-tn46-unit-red.json`. The independent format evidence
documents current-slot Location/Size writes, per-axis comparison tolerance,
unchanged AutoFit, and the lack of an Affect All Views branch:
[format evidence](native-point-commit-format-evidence.md).
The geometric primitives and their explicit replay boundaries are retained in
`native-point-commit-evidence-probe.mjs` and its JSON output.

## Implemented behavior

- `src/model/vector-commit.ts` exports `commitVectorGeometry(widget, path)`.
  It transforms the edited normalized controls into their displayed coordinates,
  computes bounds of the actual line/cubic segments, handles the original center
  rotation, applies the retained one-sided outward-rounding rule, expands axes
  below `max(strokeWidth,1)`, then normalizes against that expanded owner frame.
  This last order is TN46's false branch, not RN4I's pre-minimum normalization.
- Cubic derivative handling uses the retained solver's thresholds: `1e-5` for
  degeneracy of the quadratic/linear coefficients and `1e-6` for a repeated-root
  discriminant. Bézier handles outside the curve do not inflate the owner to
  their control hull. `M/L/C/Z`, command order and fill rule are preserved.
- `applyAdaptivePointEdit` prepares geometry from the current effective normal
  view. A changed Location writes both X/Y; a changed Size writes both W/H.
  Per-axis differences below `1e-5` do not materialize a declaration. Base edits
  write Base, named-view edits write only that named view. Other active and
  inactive maps, styles, rotation, content and shared-set definitions are kept.
- The existing box-to-path conversion policy and shared path semantics remain.
  The general adaptive editor's type-change guard stays intact. AutoFit flags
  are retained exactly, including omitted `shapeText` in legacy documents.
  The Affect All Views checkbox does not alter this dedicated command.
- Merely entering point mode, Done, cancellation, or an exactly unchanged
  prepared path still makes no document/history change. This is the explicit
  product commit policy, not a claim about every native notification.
- A fill-rule-only edit keeps the earlier shared content/type conversion command
  without rebounding. It is a compatibility decision, not a proven TN46 gesture.
- The canvas point-editor session no longer remounts merely because its own
  successful commit changed the owner frame. Its logical selected anchor survives
  for a subsequent drag or Round/Sharp command. An external frame/path change
  cancels an active drag; page/view/scope/tool/selection changes still remount or
  exit the session. Draft gestures remain outside the document until completion.
- The point-mode keys now match the retained native key metadata and dispatch:
  **1 sharpens, 2 rounds**. `Axure.Constants.AxKeys` D1=35/D2=36 and FI8B
  100685668 establish this mapping in
  `native-point-commit-evidence-keyboard-metadata.json` and
  `native-point-commit-evidence-keyboard-cil.json`.
  The existing product modifier policy is unchanged.

## Verification in this scope

The first corrected implementation passed the 22 revised command/oracle cases.
The final scoped run recorded in `.build/native-point-commit-focused.json` has
**194 passing tests across eight files**, including 37 new commit tests and all
16 existing point-authoring tests. TypeScript completed successfully in
`.build/native-point-commit-typecheck.log`. After the source-proven key mapping
correction, the same 194 tests and typecheck passed again in
`.build/native-point-commit-focused-key-fix.json` and
`.build/native-point-commit-typecheck-key-fix.log`.

A final retained-solver replay corrected the both-coefficients-tiny branch: it
falls through to the quadratic discriminant calculation instead of returning no
roots. The new failing regression in
`.build/native-point-commit-tiny-solver-red.json` makes that difference observable
through a tiny negative curve extremum and the subsequent floored minimum-size
origin. After the narrow guard correction, the final scoped result is **195/195
tests, including 38 new commit tests**, with successful typecheck:
`.build/native-point-commit-focused-final.json` and
`.build/native-point-commit-typecheck-final.log`.

The new tests cover exact polygon and cubic-extrema frames; 90°/37° rotation and
world-coordinate preservation; source-derived cubic/rounding examples; expanded
zero-axis normalization; current-only whole Point/Size writes; inherited, shared
and inactive declarations; preserved AutoFit configurations; consecutive rebound
and Round/Sharp commands; fill-rule-only compatibility; and atomic failures.

Eight old point-authoring assertions initially failed only because the newly
required world-coordinate normalization changes floating-point representations.
They now check numeric path coordinates within `1e-11` while retaining exact
checks of every other widget field and the unchanged adaptive maps. Independent
new tests assert the rebounded frames and displayed coordinates; no assertion
was removed to conceal a changed frame.

Real browser gestures, packaged desktop behavior, full regression counts and
release checks are owned by the parent stage verification. They are not claimed
as completed by this scoped unit report.

## Remaining boundaries

- Only the existing center-rotation model is implemented. General native scale,
  translation and platform transform matrices are not synthesized.
- The helper rejects paths without a participating line/curve segment before
  any document write. Native unrotated first-anchor fallback has evidence, but
  the full rotated empty-contour flow is not closed. Contour reindex filtering
  and connection trapping are not claimed as fully reproduced.
- Existing document coordinate/path bounds remain enforced atomically. The
  separate RN4I/tN4P `lN47` 20000-size cap is not applied to TN46. Native geometry
  validation beyond the traced ordinary branch is not represented as complete
  parity for arbitrary huge or malformed inputs.
- Previously unsupported partial-border/independent-corner parameter geometry
  remains blocked at the existing point-edit entry guards. Legacy and custom
  path compatibility remains as previously documented.
- The source-derived cubic oracle cases reused from RN4I have no minimum-size
  expansion, so their geometric values also apply to TN46. Their AutoFit and
  adaptive side effects are explicitly not reused as an oracle.

The sibling JSON binds this scope's before/after source hashes and test logs.
Prior stage evidence and manifests remain unchanged.
