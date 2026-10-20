# Runtime Rotate — core implementation and verification

This report covers the independent runtime implementation owned by `editor_core` for the runtime-rotate stage. It does not claim a completed release or vendor-GUI pixel comparison. Final package/full-suite results belong to the parent stage verification record. Earlier native-point reports and the first Rotate audit are unchanged.

## Implementation

`src/runtime/export-runtime.ts` remains a self-contained `createOfflineRuntime` factory. The identical function is called by React preview and serialized without imported closures for offline HTML and nested frame players. No retained vendor module is copied into the distributable.

- Rotate supports By/To, clockwise/counterclockwise, the nine anchors, independent angle/offset expressions, all 33 authored easing values, and actual elapsed-time interpolation. To uses the signed difference without a shortest arc. Angle uses `parseFloat`, offsets use `Number`, at the queued start. Nonfinite values fail the independent runtime transaction.
- The 32 numeric easing functions plus `none` are independently implemented from the retained numeric contract. In particular Expo is power six. Tests compare quarter-progress samples to the retained source oracle, including overshoot.
- Motions reserve channels by complete instance identity, including nested row tuples. Separate targets progress concurrently. A trigger promise follows its own motions; other input is not blocked. Timed Rotate expressions are evaluated after the synchronous event tail and again when each queued operation starts. Existing immediate Move/Resize behavior is retained.
- OnRotate fires before geometry and before reading the current angle for By/To, including zero-degree requests. Ordinary center completion releases the next Rotate before fitting parents. Ordinary off-center completion releases its Move channel and fits before the final orientation step, then releases Rotate and fits again. Zero center delta skips fitting. Parent-fit updates use destination-angle bounds and issue Resize only when the fitted size changes; the panel's prior size is pinned during the tween.
- Offset motion uses the current local angle, native outer-shadow center convention and the orientation eligibility gate. Other controls orbit without changing orientation. Native moved-location, live CSS angle and final-angle bounds cache are separate. A cached zero falls back to the authored angle. Public This/Target.rotation uses the live getter, and public x/y can differ from CSS after a negative-shadow orbit.
- Flat `groupId` targets are a bounded product compatibility path: actual siblings in one page, direct container and repeater ancestry share a union pivot and group-angle cache; every member has its own Rotate event and Move/Rotate channel reservations. Hidden members participate, own unplaced members do not. Mixed-container IDs fail explicitly. This is not an imported native Layer hierarchy, nor a panel substituted for a group.
- A live ordinary tween survives adaptive geometry reset. Row generation changes prevent old motion from painting a replacement row, while the next queued action resolves the replacement generation. Navigation/disposal end the independent runtime lifetime. Transaction snapshots include queued/active motion, cache and generation state; failed destination Loaded restores old motion and removes destination work.
- Cross-trigger start failures are isolated. A queued bad expression rejects its own trigger, leaves the previous successful endpoint committed and permits following jobs. Errors do not leave an unresolved motion promise or a timer loop.

`RuntimeState.motionState` is optional execution data, emitted only when a cache is nonempty. It contains group angles, rotation targets and native moved locations. It is not a Document field and is never serialized into a saved prototype. Record-backed cache access survives `engine.ts` snapshot restore. Snapshot execution returns a detached clone before disposal, and `getRuntimeWidget` uses the same cached-angle/shadow bounds for fitted panels. This fixes the concrete authored-30° → To0 case where CSS becomes zero but native bounds fall back to 30°.

`expressions.ts` admits only the verified `This.rotation` and `Target.rotation` chains. Case variants, method calls and unverified Repeater.rotation remain rejected. The original getter is `doc.js:422,472–473`; this is not inferred from the new action schema.

## Evidence and red/green history

Original contracts are in [runtime-rotate-motion-evidence.md](runtime-rotate-motion-evidence.md), its hash-bound JSON/fixtures, and the separately retained source-composition review outputs. Those contain 131 source cases, including actual isolated Edge/jQuery cases, with controlled sinks and explicit limits. They are not product GUI comparisons. The earlier [runtime-rotate-authoring-analysis.md](runtime-rotate-authoring-analysis.md) records the pre-implementation source audit.

Preserved product test records:

| Record | Result and meaning |
| --- | --- |
| `.build/runtime-rotate-unit-red.json` | 0/88 passed against the no-op Rotate implementation. |
| `.build/runtime-rotate-unit-first.json` | 88/88 passed after the initial core implementation. |
| `.build/runtime-rotate-unit-groups-red.json` | 92/100 passed; group behavior and state-effective shadow revealed eight failures across module/serialized paths. |
| `.build/runtime-rotate-unit-groups-first.json` | 100/100 passed. |
| `.build/runtime-rotate-queue-failure-red.json` | Two focused failures: cross-trigger queued errors were attributed to the previous tween and left the bad trigger pending. |
| `.build/runtime-rotate-queue-failure-green.json` | 102/102 passed, including first-success / bad-next / last-success recovery. |
| `.build/runtime-rotate-cache-fit-first.json` | 107/109 passed; two parent-fit timing/cache assertions failed. |
| `.build/runtime-rotate-cache-fit-green.json` | 109/109 passed. |
| `.build/runtime-rotate-orbit-order-red.json` | Harness mistake: focused selector skipped all tests because a test was inserted in another test body. This is not a product red result. |
| `.build/runtime-rotate-orbit-order-red-valid.json` | Correctly registered module/serialized tests fail the premature orientation step / stale moved readback. |
| `.build/runtime-rotate-orbit-order-green.json` | 111/111 passed after preserving Move-before-orientation completion order. |
| `.build/runtime-rotate-core-final-focused.json` | 303/305 passed; the two remaining old expression-whitelist assertions still expected Target.rotation to be unsupported. Their replacement retains invalid-case/call-chain rejection and adds positive getter tests. |
| `.build/runtime-rotate-core-focused-green.json` | Final owner scope: 309/309 passed. |
| `.build/runtime-rotate-core-typecheck-final.log` | TypeScript exited successfully, no diagnostics. |

The final focused set comprises 113 new Rotate cases (module and bare factory serialization, plus continuous snapshot execution), 39 expression tests, 37 repeater-box tests, 54 adaptive-transition tests, 28 native-text lifecycle tests, 20 Wait tests, 17 existing runtime tests, and the parent's one snapshot-projection regression. Parent-owned model/authoring/browser/import/package results are not counted here. The independent sibling review retains its own earlier counterexamples and corrected results; none are replaced by this report.

## Deliberate boundaries

- Existing Move/Resize schemas remain immediate. Full native timed Move/Resize/Rotate coalescing, slicing, easing precedence and the resize-led clockwise omission are **not implemented**. Preserving the current immediate actions is not a claim of complete mixed-animation equivalence.
- The model has flat groups, not native Layer objects, nested layer queue identity or layerDegree split quirks. Fixed positioning, master coordinate transforms, general scale/translate matrices, mobile scrolling and annotations remain outside the represented Rotate contract.
- The timer uses a bounded 16 ms timeout and elapsed time rather than the exact jQuery requestAnimationFrame/13 ms fallback scheduler. Numeric interpolation and completion are tested; exact browser frame counts are not claimed.
- Fractional-angle getter behavior is modeled by turn normalization. Integer full turns are preserved. Browser-specific decimal rounding when a computed matrix is serialized is not reproduced bit-for-bit.
- Atomic rollback/cancellation and generation isolation are explicit independent-runtime policies. Retained source proves private tweens survive CSS resets and detached nodes, but does not establish this single-page runtime's complete unload/rollback semantics. Timers themselves are not resumable serialized snapshot data; snapshots preserve execution caches after awaited work.
- The current snapshot helper's historical page/adaptive carrier limits remain. It preserves the new Rotate caches, but this stage does not add a separate active-view field to the legacy snapshot facade.
- The complete source and browser review boundaries remain as documented in the source evidence. No authenticated original application operation or new native GUI screenshot was used for this implementation.

The accompanying `runtime-rotate-core-implementation.json` binds the final owner source/test files, focused results and this report. Parent final release acceptance remains separate.
