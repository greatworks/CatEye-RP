# Selection author host review — correction

This appends to `selection-author-host-review-first.md/.json`; the earlier review and App bytes remain unchanged.

The parent ran the nine-test production suite recorded in `.build/selection-author-second.json`. It contains the reviewer's six UI tests and three parent-owned author tests. The actual report records eight passed, one failed, no skips and no flaky results. All five cancellation/transaction tests passed. The adaptive-font test failed exactly at fitted width 118 versus the required value greater than 180, confirming that the original 14px run had entered measurement despite the 32px displayed declaration.

The parent then corrected App's `editSelectionLayout` measurement source. The reviewer reread the resulting code: it projects only the explicit current adaptive text-style declaration into a temporary rich-text value, before `prepare`, font preparation and pre-edit-panel capture. No selected/effect preview is added. The persistent effect writer receives only the planner result and never saves this temporary rich text. This addresses the identified cause without flattening the original runs or changing the measurement service.

The monotonic context/pointer serial correction also remains present. The production tests now demonstrate the view round-trip cancellation, empty/nonempty Undo cancellation, newer ordinary patch cancellation, newest-command single history entry, and second-target failure/retry atomicity.

**No remaining concrete source-review blocker was found.** The corrected rich-font case and the final production suite still require the parent's post-fix run; this report does not count them as passing.

Reviewed corrected App SHA256: `d134417c4204b0ff7d6a5afdd5258c8ba18b424c8b3aec30e5fd0d341b1443b3`.

Frozen reviewer test SHA256: `28ebc0eb10fe52f6692a3f8d38d51aeb39ca26e2ffc2d88a73bdfccb71060c09`.

The companion JSON binds the actual parent browser report and both source snapshots. All product changes were made by the parent. Browser font metrics remain a product substitute, not original-GUI pixel evidence.
