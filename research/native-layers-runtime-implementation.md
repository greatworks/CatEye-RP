# Native Layer runtime implementation

This is an independent implementation of the source-backed Layer subset. It does not execute or distribute Axure scripts, does not represent an original-GUI comparison, and does not establish full Axure parity. The parent stage verification owns the final production-browser, complete-suite, desktop and release results. This report records the runtime owner's focused checks.

## Representation and coordinate system

The parent model introduces `Widget.type = 'layer'` and `layer.widgets`, with optional `layer.propagate`. Layer children retain their enclosing page, panel-state or repeater-item coordinates. They are not rebased into the Layer frame. Ordinary panel/repeater children retain their existing local coordinate systems. Legacy flat `groupId` targets remain a separate compatibility path.

The core indexes Layer descendants, including nested Layers, without adding a repeater context or coordinate origin. Movement/state membership recurses through Layers but treats ordinary containers as individual members where the original query does. Preview and portable DOM render an unrotated Layer wrapper with an inner negative-x/y compensation. The independent Layer angle is stored in execution `groupAngles`; it never rotates that wrapper. Inline-frame counting and the shape-text measurement traversal also visit Layer descendants. `export.ts` and `frame-player.ts` already use the shared portable core/mount, so they required no new production edits.

## Initial bounds, runtime bounds and fit

Saved/author bounds and runtime union are deliberately distinct:

- Initial Base reads saved bounds corresponding to generated data attributes. It includes the author's hidden/unplaced members and does not implicitly run `childrenBoundingRect`.
- A named-view update refreshes Layer caches in reverse document order. Nested caches are available before parents read them. Returning to Base clears execution geometry and falls back to saved bounds, without an unconditional Layer refresh.
- Child fit uses the runtime union: own hidden/limbo members and empty zero-size Layers are excluded; ordinary children include rotation/final-angle-cache and outer-shadow effects. Nested Layer degree is not applied a second time.
- The runtime union retains the native zero-initialized right/bottom behavior for negative coordinates and the all-excluded sentinel. Empty member lists produce zero bounds.
- A cache change writes size and raises Resize before writing location and raising Move. Ancestor fit stops when unchanged. Engine snapshots consume committed Layer geometry instead of recomputing an unrelated author union.

Negative logical sentinel dimensions are retained in runtime getters, while host CSS dimensions clamp to zero. That clamp is an explicit rendering safety policy; the original browser's acceptance of negative CSS dimensions was not demonstrated by the source probes.

## Motion

Layer Move updates every same-scope Layer descendant, including hidden/limbo members, and dispatches visible member Move events in preorder. A user Move-To first resolves to root translation, so member `withThis` info correctly shares that translation. An earlier review inference from direct low-level `MoveWidget(to=true)` was withdrawn after tracing the actual `_addMove → moveBy` caller; no incorrect “fix” was applied.

Layer Resize and Rotate reserve member channels before executing root callbacks. Nested Layers receive their appropriate event/release jobs; ordinary members receive Resize/Move or Rotate/Move channels. This prevents a reentrant root handler from overtaking the already reserved member operation. Existing per-instance timers, event planners, Wait/task completion, generation isolation, atomic rollback and unload cancellation are reused.

Resize calculates the source-defined rounded requested delta and remaining-duration percentage. Edge-anchor member displacement uses the unrotated `offsetLocation` path, preserving shadow effects; center displacement uses the rotated bounds center. Nonresizable members keep their dimensions while their positions follow the source branches. Rotation retains the independent Layer degree, including its partial-slice full-target behavior, without updating a nested Layer's own degree. Member orientation still follows the existing native type gate.

The Resize/Rotate combined path retains the observed root's double Rotate event, Resize-anchor pivot, direction quirk, per-member resize displacement and resize offset. Its offset expressions execute for each member after starting that member's Resize consumer. X uses the target-bound event copy and Y the captured original target. The zero-angle branch retains member resize translation. Timed interpolation uses the existing independently implemented easing and motion consumers; no vendor module is embedded.

`widgetsBelow`/`widgetsRight` can cross visible Layer ancestors, stop at a hidden Layer scope, recurse through potential Layer candidates and move a wholly matching sibling Layer once. They still stop at normal panel/item coordinate boundaries. The model does not invent unsupported fixed-position/native-state metadata.

## State, events and lifecycle

Hover/down propagation uses `layer.propagate` and false-container barriers. This flag is not a click gate or Selected/Enabled/Error recursion gate. Selected includes hidden/limbo members and emits child before parent; Enabled/Error retain their own existing type and limbo gates.

Layer-subtree initialization starts the relevant execution flags from empty dictionary state, then applies declarations in original object order: Error, Selected, Disabled. This is necessary when a Layer declares both Selected and Disabled: its selection runs before disabling children. A later child Selected declaration is blocked by an already applied parent disable. A source-derived 16-combination parent/child matrix is checked in both module and bare-factory modes. Persisting repeater refresh does not replay these declarations.

Unhandled member clicks reach enclosing Layer handlers independently of Propagate. Set Focus targets only the first ordered descendant, recursively, and does not search later siblings when that first branch is empty. Full native focus-proxy event bubbling and all hover-enter/leave bookkeeping are not claimed here; the current tests establish target selection and the supported propagation path, not every original DOM event sequence.

Full row context identifies every member and Layer degree/cache. The tests cover equal template IDs, generation refresh during a tween, retained Layer degree over adaptive resets, navigation cancellation, reentrant queues and rollback after member-handler failure. These use the product's existing controlled DOM-replacement and cancellation policies; the source probes do not establish that every native private-tween lifecycle is identical.

## Focused evidence and corrections

The exact paths/hashes are bound in `native-layers-runtime-implementation.json`.

- Original source evidence: `native-layers-runtime-evidence.md/json` and immutable original probes (78 bounded NodeVM cases), plus `native-layers-runtime-supplement-evidence.md/json` (33 additional cases). These are source/facade observations, not product browser counts.
- Product: `tests/native-layers-runtime.test.ts`, 46 module/bare-factory test cases. One case in each mode checks all 16 initialization combinations. All saved fixtures pass strict document parse/serialize before execution.
- Regression: `.build/native-layers-runtime-focused-final.json`, **531/531**, 15 targeted unit files; `.build/native-layers-typecheck-final.log`, TypeScript exit 0.
- Host tests defined for parent execution: `tests/e2e/native-layers-runtime.spec.ts` (Preview and actual offline file HTML), using `tests/fixtures/native-layers-runtime.ts`. Both exercise nested Layers, combined Move/Resize followed by Rotate, state propagation, nested repeater instances, an actual inner iframe, and unchanged saved document content.

Failure evidence is retained. The rotated-member Resize edge-coordinate defect and reentrant queue defect were reproduced before correction. Initial Base cache handling, Layer compression, combined offset timing and initial state ordering likewise have separate red/green logs. The first combined-offset serialized test accidentally reset the fake clock between two runtimes; its timeout is a harness defect and was corrected by retaining one clock. The first initial-state test used an invalid event label `selected` instead of the saved schema's `select`; its parse rejection is also classified as harness-only. The valid rerun preserved the actual initialization failure.

Older intermediate source hashes recorded by independent reviewers do not all have preserved full source snapshots. They remain explicitly hash-only records; this report does not reconstruct or claim unavailable historical bytes. The final frozen source snapshot is independently retained by the review agent.

## Remaining boundaries

- No original GUI screenshots or native generated-page pixel parity were obtained for this stage.
- Original temporary push/pop container DOM and ref-count behavior are represented by same-scope geometry and compensating wrappers, not copied DOM internals. Simultaneous native DOM mutation and every reparenting timing interaction remain outside the verified subset.
- Fixed-horizontal/fixed-vertical panel placement, percentage width, RDO/master containers and native independent panel-state dimensions are absent from the current model and not synthesized.
- Nonfinite Layer resize ratios (such as a zero-size denominator) fail atomically rather than manufacturing valid geometry from native NaN behavior.
- Complete focus-proxy event delivery, unrelated generic event bubbling and all pointer bookkeeping require further source-to-host verification.
- Source Layer producer probes establish queue arguments and callback order for the combined path; they are not a full original-GUI animation oracle. Product module tests and parent browser tests are separate forms of verification.

The final package and comprehensive counts belong to the parent native-layers verification, not this focused report.
