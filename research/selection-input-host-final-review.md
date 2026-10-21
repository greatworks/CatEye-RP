# Selection input host: final independent review

No unresolved blocking defect was found in the reviewed input/session integration. This is a read-only code review plus bounded Node execution of the actual product modules. It is not an original Axure GUI comparison, a browser pointer-capture test, or a claim that all native input modes are implemented.

The reviewed App bytes are SHA-256 `d82eb1a5a0eed1d13ae2f4129acc6138093e45da070b2c9c0925dd97745c26c6`; the session is `b3e812e35ccda2e368aeefd0d5702879329e11e1b196ead18a5074d6d1879602`; the new input model is `b15ed45f68c83bc3c5f866a9d259eca6b68f534ae8bbb2d6b96811af5aceaba5`. Exact retained bytes and all other bindings are listed in the companion JSON/manifest. Product files and historical research were not edited by this review.

## Host and queue

`src/App.tsx:469` captures the initial pointer-down modifiers before asynchronous font preparation. `prepareSelectionPointerInput` retains its own copy of mode and settings. An initial multi-selection exact-Control mode is rejected as unsupported rotation; later Ctrl changes do not reselect the mode. Single SelectionButton remains in resize mode. Selected locked roots remain in the common bounds, while the prior resize model skips their layout.

`selectionPointerRequest` at line 792 records absolute diagram coordinates from the current surface rectangle and the gesture's captured zoom, together with that move's keys. The selection branch returns before the older generic accumulated-delta grid rounding. In `startSelectionResize`, each queued request is projected only after the preceding accepted layout: `currentBounds` is recomputed from `state.model.targets[].layout.ownerRect` at line 516. The immutable geometry snapshot used by the resize solver is separate from this live union.

`src/runtime/selection-pointer-session.ts` copies both point and key objects before queuing. It replays requests in order after preparation, passes the preceding accepted state to each plan, publishes the batch only after successful planning, and rolls back on failure. Gesture identity, document ownership, context serial, view/scope and zoom changes are guarded. Source ownership checks prevent rollback from overwriting a different document.

`pointerUp` at App line 796 calls only `finish()`. It does not produce a new size request from release coordinates or keys. A finishing gesture tolerates the pointer-capture release while fonts are pending; cancel/lost capture outside finishing rolls back. No-move press/release remains a no-op in the coordinator. This matches the bounded original `PF4p → obNM.Moved → EbNf` dispatch contract, whose native history implementation remains outside the replay.

## Extra-key boundary found and addressed

The frozen Windows `M1Ei` method **100727662** reads virtual keys 16/17/18 only. However, `J1Nt.g3GS` **100726677** subsequently reads `S3G9` **100726678**, which returns field `n1Nh` **67136999**, and ORs `SpaceModifier=1048576` when true. Therefore a three-Boolean Ctrl/Alt/Shift carrier is not the complete platform mask. The original exact-Control predicate must not be generalized to all possible Windows modifiers.

The new `selection-input-host-review-keys-probe.mjs/.json` replays these retained methods and the exact-Control predicate for **16/16** combinations. `GetKeyState` values, its high-bit test and `n1Nh` are explicit facades. This proves the extra-field effect, not the physical Space-key setter. No MacControl emission occurs in the replayed Windows reader.

The final host expressly rejects browser Space/Meta at press; capture-phase key events cancel an active gesture; each pointer move also checks the observed flags. Capture cancellation stops immediate propagation, avoiding a single Meta+Z event both cancelling this gesture and then undoing an older command. This is an explicit product protection boundary. It does not pretend to reproduce the unclosed native physical Space mapping or native key-only recomputation.

The review raised the missing extra-mask boundary while integration was in progress. No executable failing-product snapshot was captured for that interim state, so this report does not claim a red-to-green product test. The final guard was read directly from the hash-bound App source.

## Executed integration checks

`selection-input-host-final-review-probe.mjs/.json` passes **3/3** checks using Vite SSR in middleware mode with no listening port or browser:

1. Actual session → input → resize composition, with two raw moves queued before preparation. It matches the independent original-CIL live-session oracle. For the shared 530×20 frame, the first move gives delta `(106,4)` and live width636. The second gives `(123,5.031446540880509)`, not stale-bounds `(119.5,4.905660377358487)`. Final owners match the frozen oracle within `1e-8`. Mutating the caller's first request after enqueue does not alter it. Release adds zero frames and only one batch publication occurs.
2. A controlled second-frame failure during the pending batch causes one rollback and no partial publication or completion.
3. A multi-selection mode captured as rotation at Ctrl-only press remains rejected after Ctrl is released.

The composition uses the oracle's explicit constant text metrics, minimum1×1 and identity CSS inset2 services. It does not establish native font/graphics values. App handlers were read, not executed by this Node probe. Existing parent-owned browser and unit runs are separate evidence and are not counted here.

## Remaining boundaries

- Native rotation-mode gestures, physical Space-field binding, Mac input and key-only layout dispatch remain unimplemented or unclosed.
- Grid-only behavior is the new input domain; guides/object snap providers and arbitrary rotated/contained scopes are not established by this review.
- Grid8 and uniform `5/zoom` tolerance are explicit host policies/services, not a claim about native persisted defaults or arbitrary device transforms.
- Nonfinite input/grid results are rejected atomically as a product safety boundary.
- Real DOM event ordering, pointer capture, scrolling, browser font readiness and window/system-key delivery require the parent-owned browser checks. No original DLL methods or GUI were executed here.

The prior keys evidence remains unchanged: 139 dispatch cases and 80 complete-resize differential cases (240 actual plus 240 control frames). The number128 is a subset of the139 dispatch cases, not another resize-suite count.
