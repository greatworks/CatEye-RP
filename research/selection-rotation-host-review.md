# Selection rotation: independent host and model review

Final readonly review: **73/73** integration checks and **1/1** independent angle-boundary regression passed. No unresolved confirmed defect remains in the reviewed scope. This review edited no product or tests and started no browser, original DLL, or original GUI. It is not a claim of complete Axure parity.

The first 73-check result remains unchanged in `selection-rotation-host-review-probes.json`. The final run is `selection-rotation-host-review-final-probes.json`; source hashes were stable throughout. The final JSON and manifest bind the precise product, original instruction records, replay services, and retained first result.

## Corrected defect and clarified evidence

The core agent found and fixed a real operation-order defect after the first review. Original K5wb multiplies atan2 by the literal **57.29577951308232** before adding 90. The former product expression `atan2 * 180 / Math.PI` changed a boundary result: the retained source produces **9.999999999999972**, outside the inclusive five-degree magnet around 15; the reassociated expression selected 15. The final independent probe verifies the exact source angle and resulting owner locations using `selection-rotation-model-angle-unit-probes.json`. The core agent retained its failing regression and old product bytes in `.build/selection-rotation-model-angle-red.json` and `.build/selection-rotation-model-before-angle-constant/`. This is a resolved product defect, not merely a test correction.

Upstream freedom is now closed independently. `obNM::.ctor` **100686217**, IL **0x6D–0x74**, calls `VI8y(MSON(handle))`; `VI8y` **100686100** writes field **67119078**, and `TI8l` **100686099** returns it. MSON **100708345** yields W/E=1, N/S=2, corner=3. No mode-2 replacement of that field was found in the exact field/setter call references. App already supplies these values correctly. The older frozen 256 input observations and 32 composed sessions injected freedom=3 as an explicit service facade; they remain valid observations of that function domain, not literal side-handle constructor observations.

The new `selection-rotation-host-review-source-probes.json` executes the retained constructor/getter chain and source input/controller composition for **64 sessions / 256 consecutive frames**: eight handles, grid on/off, physical-down offset 0/1.5, and first target locked/unlocked. Full inputs and observations are retained independently of product imports. The product matches all 64 sessions. Base UI construction, ordinary union, numeric primitives, graphics conversion, and history/provider services remain explicit interpreter facades; the vendor assembly is never executed.

## Host contract checked

App captures actual diagram down synchronously at pointer-down. It separately computes the native logical hot-zone point, captures exact-Control mode once, and passes both through the rotation preparation. Each frame projects raw absolute input against the previous accepted live owner union; angle calculation uses actual down plus corrected delta and the original pivot. Locked roots stay in the union/pivot and are skipped for writes. Shift and Alt are sampled from pointer frames; mode is not reselected after Control release. No active key-only dispatch is added.

Rotation returns before font readiness, text-panel capture, or layout preparation. The model emits changed complete Location pairs only, current-view false / notify true. No Size, own Rotation, fit, text, rich-run, or panel write is emitted. Four persistence checks cover shared/local view definitions and nested Layer content, preserving Base widgets, inherited and inactive declarations, with full JSON roundtrip.

The existing session queues raw requests in order and consumes live accepted state. Pointer-up completes without an additional frame. Whole-document comparison governs the single undo entry. Empty writes do not materialize overrides. A later invalid target cannot mutate an earlier candidate or source. A later failed frame rolls back the published gesture; stale ownership cancellation preserves an externally replaced document. These are actual module/session probes and readonly App-handler inspection, not real-browser event assertions; parent browser acceptance remains separate.

## Boundaries

The admitted host scope is multiple explicit Selection controls with zero own angle in an unrotated page/Layer coordinate space. Mixed widgets, legacy controls without selectionText, general transforms, panel/repeater coordinate spaces, and standalone single-control rotation are outside this integration. Grid spacing 8 and tolerance 5/captured uniform zoom are explicit product settings/services, not assertions of original defaults or universal DPI conversion. Guides/object providers are disabled. Finite ±100000 locations and 1..100000 dimensions remain document bounds. Atomic product rollback is not generalized to all original exceptional editor transactions.

No original font measurement, original GUI comparison, native writeback, real pointer capture, OS keyboard state, or complete original editor transaction was exercised by this independent review. Frozen historical reports were not rewritten.
