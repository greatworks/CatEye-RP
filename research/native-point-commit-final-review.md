# Native point commit: independent final review

The reviewed ordinary point-edit path follows **TN46(points,false)**. No blocking
finding remains in this review's supported scope. The separate RN4I route is not
used to decide ordinary point-edit geometry, adaptive writes, or AutoFit changes.

This review loads the independent product model through Vite's server module
loader. It does not execute the vendor DLL, native editor, browser, desktop
package, or history dispatcher. `originalComparison` is false. Parent-owned
browser/package checks are not counted here.

## Independent checks

The final probe contains **135 checks**, all passing against source hashes that
remain unchanged during execution:

- 72 complete-document cases: page-owned/shared adaptive definitions × ordinary
  page/panel/repeater nesting × Base/parent/child view × changed Location, Size,
  both pairs, or interior-only path change. Expected documents are constructed
  independently. All other fields are compared exactly, including active and
  inactive overrides, style/state maps, captions, AutoFit flags, siblings and
  other pages. Save/parse readback and source immutability are checked.
- 55 hashes from the frozen geometry replay source list, plus one integrity check
  binding its 98 cases, 21 replayed methods, probe source and final JSON hash.
- Four source-derived numerical cases: cubic extrema, 90-degree rotation,
  TN46's minimum-size-expanded normalization, and the tiny-derivative quadratic
  fallback that changes minimum-owner origin.
- One rotation-roundoff case confirms that an unchanged named Size pair is not
  materialized from width/height differences around 1e-14.
- Two previously imported real Shape300 rectangular paths retain custom `path`
  identity; a fill-rule-only edit preserves owner geometry and all other fields.

The first run was 132/133. Its only failure was an exact floating-point assertion
on the 90-degree numeric oracle: y=74.99999999999999 versus75 and
height=100.00000000000001 versus100. That first report is preserved. The revised
assertion compares every coordinate to the original retained expected number
with absolute tolerance1e-10; it does not replace expectations with product
output. Complete non-path document comparisons remain exact. An intermediate
run correctly refused final status when product source changed during its run.
The final run uses the frozen corrected polynomial solver and keyboard mapping.

## Static integration review

`applyAdaptivePointEdit` reads the effective current widget, prepares its editable
contour, and returns the same Page for an exact no-op. A changed path is shared;
only changed Location/Size groups enter the current geometry slot. Each pair uses
per-axis native1e-5 comparison and writes both members together. It preserves all
other declarations. The command never reads Affect All Views and does not clear
AutoFit. Unsupported contours and out-of-budget bounds throw before returning a
mutated document.

`App.changePointPath` resolves the effective shared page, invokes that command,
and commits the projected result once. It does not serialize an effective view
as a new base document. `CanvasVectorTools` keeps a gesture snapshot and a draft;
pointer-up clears the gesture before committing, so lost capture cannot commit a
second time. Pointer-cancel and external frame/path changes clear the draft.
Keyboard point changes cancel a held gesture before editing the committed path.
The native key mapping is1=sharpen and2=round.

The overlay's session key excludes changing geometry, preserving the selected
logical anchor after its own commit. A separate frame key still cancels a held
gesture on an external geometry change. Undo/redo resets vector tools before
switching the document. These are source-level observations; actual browser
pointer/history behavior remains parent-owned validation.

## Scope limits

- General native transforms, master/contained provider special cases, contour
  reindexing and connection behavior are not established by these probes.
- Empty/no-participating-segment paths are rejected atomically. Existing partial
  border and independent-corner point-edit guards remain in force.
- The product retains its existing finite document bounds and1..100000 dimension
  budget. The ordinary base NIuy is identity and UHB4 takes per-axis Math.Max
  against minima; this supplies no native20000 maximum. RN4I/lN47 is a different
  operation. General virtual override validation remains outside this claim.
- The original GUI, native drawing backend, actual history manager and saved-file
  writeback were not executed. The real Shape300 fixtures establish current
  storage/import identity, not a historical user's exact editing sequence.

The JSON summary and its source references bind the final probe, first-run
record, format manifest, geometry replay, author implementation report and
reviewed production/test files. No production or historical evidence was
modified by this review.
