# Selection pointer Shift implementation: independent final host review

This is a read-only review of the final Shift implementation, separate from the immutable baseline `selection-pointer-modifiers-host-review.md/json`. No product/test file was changed and no test, browser, vendor DLL or GUI was executed by this reviewer. The parent performs release validation independently. Hashes in the adjacent JSON bind the reviewed files to `.build/selection-layout-pointer-modifiers-final-build-inputs.json`.

## Conclusion

No unresolved confirmed defect was found in the implemented domain: ordinary unrotated checkbox/radio pointer resize with Shift sampled on pointerMove and pointerUp. Ctrl/Alt requests remain atomically rejected. The host does **not** actively dispatch a new resize frame for a stationary key-only change. Native upstream key-only callback behavior and snapping remain unresolved evidence boundaries, not verified product bugs and not claims of full Shift input-pipeline equivalence.

The prior concrete finding SPMH-01 is fixed. `startDrag` now applies additive selection only under `e.shiftKey && !handle`. A resize handle retains the already selected IDs; Shift no longer expands an individually selected legacy `groupId` member to its peers. Body Shift-selection retains its previous rule. Parent browser evidence preserved the initial failure: its first four-case run had three passes and the legacy-group case failed with three selection frames instead of one. The final test checks the target set immediately after pointer-down, then complete saved project equality and Undo, including the untouched sibling.

## Reviewed model and host contract

- The request remains plain `{delta, modifiers}` data. The host reads each pointer event's modifier tuple; the session copies it before queueing. It does not capture Shift permanently at gesture start or consult current keyboard state when delayed frames execute.
- Single SelectionButton Left/Right continues through the existing non-aspect branch. The hidden orthogonal hot-zone excludes aspect; accepting Shift removes the old rejection without inventing a vertical handle. Multiple roots pass the current request's Shift to `solveAuthorResize.preserveAspect`, using the original common selection frame and existing clamp.
- The fit setter still uses the original handle freedom, before the aspect solver. A vertical Shift projection can affect requested width without falsely treating that gesture as a horizontal AutoFitWidth transition. The original frame remains fixed while live TextPanel, raw/effective fit, hot-zone and measurement counters survive between frames.
- Numerical projection is followed by the existing Selection layout transaction. Its text-corrected Size does not replace the final requested Location anchor. The independent browser fixture uses shared 530×20 bounds and east+106: Shift requests height24/y98, then browser text corrects height20 and the final Location remains y98. These metrics are explicit test services/fonts, not original font equivalence.
- Control/Alt rejection occurs before any target iteration. A later-target measurement failure returns no candidate state/results and leaves the previous accepted state unchanged. Host publication remains all-target atomic with one final history entry.
- Pointer-up compares the entire request, including modifiers, against the last move request. A modifier release at unchanged coordinates is appended before `finish()`. `finish()` is called without a second final request, and later updates are refused. Thus Shift release before up is preserved even if Shift is pressed again during font-pending finishing.
- Zero-move press/release without a prior frame remains a no-op. Existing keydown cancellation, ownership/serial checks, captured zoom/snap, abnormal capture-loss rollback and normal-up finishing behavior are unchanged. No new keydown/keyup dispatch was added.

## Evidence and test review, not a duplicate execution

The model's dedicated suite consumes 31 admitted retained-hInw scenarios / 91 frames, excluding every Control/Alt scenario. It compares owner/panel/fit state, single hot-zone state, requested rectangles and ordered setter/measurement effects; only the previously documented multi-target diagnostic measurement index is normalized. False→true→false at identical delta is represented. The added later-target failure/retry test verifies that the accepted prior state survives a failed Shift transition.

The implementation report records 88 dedicated tests and 374 related tests passing. Those are the model agent's recorded runs, not newly executed by this review. Parent red browser records are retained separately: two initial single-Shift failures reflected the old blanket rejection; the first updated four-case run isolated the target-set bug. This report does not pre-claim the final 21-case production run or the parent's full regression while they are running.

The final E2E source contains the prior 16 tests plus five new Shift cases: checkbox and radio single-handle acceptance, legacy-group target preservation, common-frame multi-selection aspect plus text correction, and queued Shift/up flags while fonts are pending. Complete saved document and Undo assertions accompany these cases. The queued test deliberately presses Shift again after pointer-up, proving the intended immutable request contract once the parent executes it; its presence alone is not described as a passing browser observation.

## Explicit remaining scope

No stationary key-only resize callback is implemented or inferred. The existing source entry samples the live key mask when invoked; this does not independently prove which keyboard transitions invoke that entry. Ctrl/Alt upstream delta/start semantics are not accepted merely because a downstream helper can read the masks. Snap remains the captured host policy, with no modifier bypass added.

Outer-Layer recursive SelectionButton resize remains rejected. Entering an unrotated Layer and resizing direct controls is distinct. Adding SelectionButton leaves to the Layer whitelist still requires live per-leaf layout state, capability-derived pins, two-pass propagation and ordered effect persistence; this stage does not implement or certify it.

The final source hashes were rechecked after report generation and matched the final build input record for all reviewed product files. Original GUI comparison and full Axure parity remain false.
