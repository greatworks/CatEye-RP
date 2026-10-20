# Runtime Move / Resize / Rotate core implementation

This report records the new independent core implementation and its focused checks. It does not declare the Axure reconstruction complete. No original DLL or original GUI was executed by this implementation task. The source researchers' isolated JavaScript/CIL experiments, their real Edge observations, and the product tests below are separate evidence classes. Final full-suite, host, desktop, and release results belong to the parent milestone verification, not this report.

## Contract and sources

- [Original scheduling evidence](runtime-transform-motion-evidence.md): event-local pending lists, channel reservations, slice leadership, and source branches.
- [Original real-browser motion evidence](runtime-transform-browser-evidence.md): 98 unique cases, including 95 normal observations and three explicitly bounded pathological consumers. The two complete executions are repetitions, not 196 independent cases.
- [Original action/binding format](runtime-transform-format-evidence.md), [binding and boundary compiler evidence](runtime-transform-bindings-evidence.md): typed saved records, independent local expression scopes, ordered false-boundary projection.
- [Original expression pipeline](runtime-transform-expression-evidence.md): saved StringLiteral expressions produce strings, even whole `[[0]]`; numeric-zero downstream probes do not justify a different native StringLiteral contract.
- [Original drag lifecycle](runtime-transform-drag-evidence.md): zero-distance first move, incremental versus public drag values, Drop/Swipe timing and movement contexts.
- [Original special consumers](runtime-transform-special-evidence.md): real compression selection and Move consumers, repeater item sizing/pushing, and eight controlled-frame arc trajectories.
- [Orbit correction](runtime-transform-review-orbit-cache-correction.json): the six finite corner/shadow results are not a universally exact endpoint oracle. One pair of original browser runs differs by about 0.219/0.214 CSS pixels. The source helper returns a new point, and the unassigned call does not rotate `resizeShift` in place.

The original read-only [core plan](runtime-transform-core-plan.md), [baseline red probe](runtime-transform-core-red.json), and previous release evidence remain unchanged. The implementation's adjacent manifest hashes its current inputs and all new test results.

## Implemented architecture

`createOfflineRuntime` remains a self-contained factory. Its bare `toString()` is exercised in a NodeVM as well as the module implementation. No vendor script, hidden closure dependency, additional factory argument, or copied vendor module is required in the offline output.

The event planner and instance queues are separate. Each event continuation owns three ordered pending lists. A third populated list emits the shortest remaining slice; end-of-event or Wait boundaries flush the remainder. Resize leads Rotate, which leads Move. Move easing takes precedence when present. Queue reservations belong to complete widget/row identities, including nested rows. Channel release is independent of tween lifetime: a release can start the next consumer while another tween from the previous slice still paints.

New structured `Action.move` and `Action.resize` routes consume ordered target records. Legacy numeric `x`/`y` Move/Resize actions keep their existing instant semantics; an old unused `duration` is not silently reinterpreted. Existing Rotate and flat-group Rotate continue through the same execution engine. New Move/Resize group targets are rejected because the flat `groupId` representation is not a native Layer object.

Each moving instance maintains independent live paint and execution caches. Public geometry expressions can read a destination before CSS arrives. Size, movement, and angle caches are not collapsed into the widget's live width/position/rotation. Completed snapshot interactions preserve these values through `RuntimeMotionState`; the engine's fitted-panel projection reads the same caches. No execution state is added to a saved Document.

## Consumer details tested against evidence

- Resize's actual changed-size path retains the two ratio applications and rounded intermediate delta. Move40/Resize70 ends at approximately 299.653061 × 159.591837, not an idealized 300 × 160. Equal-duration cases still reach the full target.
- The six action orders preserve the same evidenced batch behavior. Move-To100/Resize70/Rotate40 can finish with logical location 140,120 and painted location 128,114; the tests preserve this observed distinction.
- Resize-led Rotate evaluates its degree after OnRotate and retains that branch's direction handling. Move-led Rotate resolves degree before OnRotate and derives anchor offsets from unrotated CSS dimensions. Its pivot bounds may still include the effective shadow.
- A Resize with unchanged dimensions emits Resize immediately while a merged Move continues. A zero standalone Move emits its event and releases its channel without creating a timer or movement cache. A zero-degree offset Rotate does not turn resizeOffset into motion.
- The 33 authored easing choices are handled independently; previous Rotate easing regressions remain included. Straight and clockwise/anticlockwise arc Move use the retained sampler contract. Eight original controlled-frame paths are compared at five samples in both module and serialized tests.
- Each complete MotionExpression builds local widget bindings. The first geometry property on a binding caches all four axes; This and Target resolve through their current provider lookup. Window uses the event's raw viewport snapshot. Controlled motion evaluation failures retain the original marker; unsafe expressions remain errors. Invalid size text keeps the previous axis, negative size clamps to zero, and nonfinite/oversized geometry is rejected within the product's bounded model.
- A failed boundary predicate triggers a left-to-right fold of its original leaves, including OR. The first direction expression seeds each axis. Right/bottom project to left/top by subtracting target dimensions; strict comparisons use the observed ±1 adjustment. Projection happens after slice scaling. Conflicting leaves are not reordered into an interval.
- `thisItem` bypasses animation planning and evaluates with Target absent. It preserves This, ignores anchor/easing/duration, resizes the current item, pushes following rows and emits the existing item event once. Missing row context evaluates safely but does not manufacture a row.
- `widgetsBelow` / `widgetsRight` use old Resize thresholds, current cross-axis origins, strict overlap, source order, and signed/inferred deltas. Hidden siblings are not filtered out. Ordinary panel states and repeater row instances isolate their siblings. Direct public Move consumers bypass reservations but still release the instance Move channel on completion; their missing trajectory uses the source default arc. Direct non-fit repeater items are pushed immediately.

## Lifecycle and rollback

The input queue remains responsive while tweens run. A trigger promise tracks its own work without blocking another trigger or pointer move. Wait creates a new continuation batch. Failure belongs to the request that fails, and an older independent tween survives rollback. Navigation cancels paints in the unloaded page; a failed navigation restores the prior transaction, timers, queue state, and the shared drag return-location map.

Row rebuilds invalidate active paint generations. A later queued request resolves the replacement row; an old tween cannot paint it or a different row. Adaptive resets clear declared geometry caches while already-running ordinary private tweens may continue painting their captured motion. These are explicit product lifetime policies tested alongside the native source's retained private-tween behavior; they are not a claim to reproduce every original DOM-detach lifecycle.

The drag API accepts page CSS coordinates and a clock. First movement can have zero delta and dispatches DragStart followed by Drag. Further input does not await previous motion. Drop/Swipe use the latest recorded point, then public drag getters reset while the raw last delta remains available to native Move modes. Deletion of the source row and navigation cancel the active drag immediately. Dispose clears drag/movement contexts and pending timers. Host pointer listeners and click suppression are parent-owned and independently verified.

## Focused tests and preserved failures

The final focused run currently recorded here is `runtime-transform-core-implementation-focused-seventh.json`: **457 passed, zero failed**, plus a successful `tsc -b --pretty false`. It explicitly lists the five new core files and the prior Rotate, Rotate snapshot, Wait, and repeater-layout regressions. The full parent suite is separate.

New tests consume complete saved action records through `serializeDocument` and `parseDocument` before starting module/serialized runtimes:

- `tests/runtime-transform-core.test.ts`: planner, all six triple orders, changing Size, cache-versus-paint, expressions, Wait, instant-tail rejection, legacy compatibility.
- `tests/runtime-transform-core-matrix.test.ts`: 176 module/serialized source-case comparisons. The six scheduler-sensitive corner/shadow cases test finite geometry, stable size/angle and cache-versus-CSS relationships, rather than a false universal endpoint tolerance.
- `tests/runtime-transform-core-lifecycle.test.ts`: request failure ownership, rollback, navigation, event viewport, drag/drop, withThis, row rebuilds, adaptive resets, failed Drop navigation, disposal, and consecutive engine snapshots.
- `tests/runtime-transform-core-consumers.test.ts`: source-order boundaries, unchanged Resize timing, fit intake, thisItem, invalid dimensions, degree/event order, shadow anchor dimensions, zero-degree orbit, zero Move.
- `tests/runtime-transform-core-special.test.ts`: eight exact-source arc paths × two implementations, sibling selection, strict overlap, Resize thresholds, default arcs, nested panel/row isolation, item push, outside-row behavior.

Important retained records:

| Record | Result / classification |
| --- | --- |
| `implementation-unit-red.json` | Initial implementation baseline: 4 passed / 28 failed. |
| `implementation-unit-first.json`, `unit-second.json` | Early implementation failures retained; the Wait assertion that demanded an ideal location while Resize writes captured CSS was corrected against source. |
| `implementation-matrix-first.json` | 162/176 passed. Two table fixture geometry issues and twelve scheduler-oracle assertions retained and explicitly corrected; no broad endpoint tolerance was substituted. |
| `implementation-matrix-second.json` | 176/176 passed. |
| `implementation-focused-fourth.json` | Only the 134 old cases ran because PowerShell passed a literal wildcard. This is not a run of the new files. |
| `implementation-focused-fifth.json` | Explicit-file run: 363/363 passed. |
| `implementation-consumers-red.json` | 14/14 red before the boundary/thisItem/unchanged Resize fixes. |
| `implementation-consumers-first.json` | 10 passed / 4 fixture failures: repeater tests had not completed initial Load before resizing. Initial refresh correctly reset their item sizes. |
| `implementation-special-red.json` | 16 source arc checks already passed; 12 special-target checks failed before integration. |
| `implementation-consumers-extra-red-valid.json` | Source-valid extra consumer regressions before correction. Earlier `extra-red.json` retains the invalid unknown-property fixture failure separately. |
| `implementation-focused-sixth.json` | 403/405 passed. Copying the event frame broke nested-event batch flushing and delayed withThis one frame; fixed by retaining the same continuation frame. |
| `implementation-lifecycle-extra-red-valid.json` | Failed Drop rollback and dispose regressions before correction. Earlier unqualified `extra-red.json` retains the parser-rejected literal-state fixture. |
| `implementation-zero-red.json` | Zero Move timer/cache regression before correction. |
| `implementation-focused-seventh.json` | 457/457 passed. |

All abbreviated table names use the prefix `runtime-transform-core-`. Counts are individual run counts and must not be summed into a parity claim.

## Remaining boundaries

Native Layer objects, independent panel-state dimensions, fixed positioning, CSS margins/percentage offsets, and general native transforms are not represented by the current saved widget model. Compression inside table/menu/tree generated wrappers explicitly reports that unsupported container instead of guessing an enclosing coordinate frame. Fixed-position and Layer recursion cannot be claimed from the supported ordinary sibling tests.

The model has no PanelStateChange event carrier. Ordinary Resize compression is implemented; the original PanelStateChange compression route remains a schema/event boundary. The withThis generated boundary-local substitution and arbitrary native compiler casts are not a wholesale reimplementation of the original STO compiler.

Nonfinite orbit anchors and the original mixed instant-tail wrong-carrier/nonprogress cases are rejected atomically. These controlled errors are product safety boundaries, not native outcomes. Native DOM sampling quirks, zero/invalid geometry beyond the supported finite model, and fixed/Layer cleanup are not silently normalized into ideal animations.

LocationBeforeDrag currently uses the runtime's saved local geometry. Its ordinary drag return is tested; parent movement/scroll/general transforms during a drag need an explicit viewport-coordinate contract before claiming original viewportLocation parity.

No browser, package, full-unit, parser-corpus, or release promotion was run by this owner. Parent integration may reveal additional failures; those results must be appended rather than replacing the evidence above.
