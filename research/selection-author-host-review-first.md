# Selection author host integration review — first

Read-only production review, 2026-10-20. The reviewer added only `tests/e2e/selection-author-stale.spec.ts` and new review artifacts. No browser, original DLL, GUI, build, or full test suite was run by this review. The browser tests below are prepared, not yet reported as passing.

## Findings

1. **Asynchronous view round-trip cancellation (corrected by parent; browser verification pending).** The first App implementation captured a context string and checked that it still matched after font preparation. It did not remember intervening context changes. Base → Phone → Base → reselect the original target could therefore restore the same string and allow the old command to commit. The current App increments a monotonic serial whenever the context changes, includes the effect-preview field, and also cancels when pointer dragging starts. Undo/redo increment that serial even when no history is available. The first new browser test exercises the view round trip rather than only a one-way view change.

2. **Adaptive rich text was not projected into the measurement source (blocking until corrected).** `resolveAdaptiveWidgets` combines the declared outer style but preserves the saved raw rich text. App's normal canvas display separately applies the explicit adaptive text-style declaration to those runs. `editSelectionLayout` currently passes the unprojected `widgets` entry directly to `selectionAuthorMeasurer.prepare`. Thus a saved run of 14px plus a Phone declaration of 32px is displayed at 32px but measured at 14px. The correction must apply only `projectTextStyleOverride(resolveAdaptiveOverride(...).style)` to a temporary rich-text copy. It must not flatten all Base styles into the runs, add transient selected/effect styling, or commit the projected rich text. The sixth authored test compares identical 32px-declared labels whose saved runs differ (14px versus 32px), then checks that their fitted widths agree and the saved runs remain unchanged.

## Reviewed transaction boundaries

- `editSelectionLayout` captures a document reference, command serial and view/scope/selection context before waiting for fonts. It checks freshness after the wait and before committing.
- Every pre-edit TextPanel is captured only after its session's `fontsReady`. The independent session retains its own immutable source.
- All target plans complete before any page candidate is replayed. All effect replays then complete before the single `commit`; failures cannot persist an earlier target.
- The writer replays persistent effects in source order; flags are shared content, geometry follows each effect's scope, and transient measurement/guard/notification data is not stored.
- Pending measurement does not change saved geometry. A failure is reported only if the pending command is still current.
- Ordinary document patches invalidate the reference guard; `patchSelected` also invalidates the serial immediately. Undo/redo explicitly invalidate waiting commands.
- This host admits page and unrotated Layer ownership scopes. Other container scopes and selected-state font effects are rejected explicitly.

These are source-review conclusions, not a proof of all React scheduling or browser font behavior.

## Prepared real-UI regressions

The six Playwright tests use File Open, Inspector, adaptive-view selection, keyboard Undo, toolbar Save and the resulting `.rea.json` files. They do not call an App method or replace React state.

1. Font-delayed width command; view round trip and reselection; exact unchanged saved document and no history.
2. Font-delayed width command; Undo both with and without an existing history entry; only the original edit may be redone.
3. A later ordinary X patch cancels the waiting layout and owns the only undo entry.
4. Two waiting size commands; only the newest commits, once; Undo/Redo preserve all unrelated declarations.
5. Adaptive rich-run projection consistency and no persisted rich-text flattening.
6. A Range failure on the second selected target after first-target measurement; no partial geometry/fit flag/history; a successful retry changes both in one undo.

Instrumentation delays the actual `Document.fonts.load` promise or throws from the actual Range metric read only beneath `[data-selection-author-measure]`. It records calls and drains font/React continuations with animation-frame turns. It does not substitute numeric font metrics or claim original-font equivalence.

The latest-size test expects 280 × 20, not 280 × 40: after the external width write, the source-derived WIyL union for this 20px panel and 14px indicator reduces the owner height. Parent identified this oracle correction before browser execution; the earlier test bytes are preserved separately.

## Verification and preserved failures

- Playwright discovery: 6 tests in the single new file.
- Final `npm run typecheck`: exit 0.
- The first typecheck failed only on five explicit test `Window` casts. The first test bytes/log were preserved; the casts now explicitly pass through `unknown`.
- The original five-test discovery output and pre-size-oracle test bytes remain available.
- Browser execution, host pixels, font equivalence and final release verification remain the parent's responsibility.

Source hashes, exact snapshots and log paths are in `selection-author-host-review-first.json`. No earlier report was overwritten.
