# Runtime transform core: implementation design and preserved capability baseline

This is a read-only plan for the Move / Set Size / Rotate milestone. No product, test, script, package, prior report, or release artifact was edited. The new probe executes the current independent runtime in NodeVM, without a browser or original vendor code. It does not establish original GUI equivalence.

The authoritative inputs for this revision are `runtime-transform-motion-evidence.md/.json` (36 exact-source NodeVM cases) and `runtime-transform-format-evidence.md` (64 bounded CIL cases and 8 corpus assertions). Their hashes, current source hashes, and the new probe are bound in the adjacent JSON. The sibling's subsequent changing-size DOM and the parent's drag probes are still being finalized; their reported results below are integration requirements to verify against those final artifacts, not additional acceptance counts.

## Main design decision

Keep the released numeric action route compatible. Add a new, explicit structured Move/Resize route, then implement **two independent scheduling layers**: an event-owned planner and concrete-instance channel reservations. A larger version of the current per-action `Motion` object alone cannot reproduce third-channel eager emission, per-slice easing, event-local expression caches, or the distinct completion/release orders.

The current runtime already provides useful transaction, row identity, animation, event, and snapshot infrastructure. Reuse it, including the recently fixed cross-trigger queued-start error attribution. Do not replace it with an asynchronous function that holds the global input queue until every tween finishes.

## Recommended saved action contract (proposal, not implemented)

Use ordered action-level target/info arrays. The native corpus contains eight two-target Move actions, and the generator emits an ordered array as one action. A flat list of unrelated new actions would discard this provenance and assume scheduling equivalence that has not been established.

```ts
type MoveMode = 'location' | 'delta' | 'drag' | 'dragX' | 'dragY'
  | 'locationBeforeDrag' | 'withThis' | 'sizeDeltaX' | 'sizeDeltaY';
type MoveTrajectory = 'straight' | 'arcClockwise' | 'arcAntiClockwise';
type WidgetMotionTarget = { kind: 'widget'; id: string } | { kind: 'this' };
type MoveTarget = WidgetMotionTarget
  | { kind: 'widgetsBelow' } | { kind: 'widgetsRight' };
type ResizeTarget = WidgetMotionTarget | { kind: 'thisItem' };

// Updated after the format peer's binding audit; no string-only native carrier.
interface MotionInput {
  text: string;
  bindings?: Record<string, { kind: 'widget'; targetId: string }>;
}
interface MoveInfo {
  target: MoveTarget;
  mode: MoveMode;
  x: MotionInput;
  y: MotionInput;
  trajectory: MoveTrajectory;
  easing: RotationEasing; // reuse the 33 proven strings
  duration: number;
  boundary?: MotionBoundary; // unresolved exact safe AST/binding contract below
}
interface ResizeInfo {
  target: ResizeTarget;
  width: MotionInput;
  height: MotionInput;
  anchor: RotationAnchor;
  easing: RotationEasing;
  duration: number;
}
// New optional Action fields:
// move?: { targets: MoveInfo[] }
// resize?: { targets: ResizeInfo[] }
```

The canonical nine anchor strings are a runtime-supported product interface. Only top-left Set Size is witnessed in the format corpus; the report does not claim the whole original authoring list has been recovered. Set Size has no native By mode: relative dimensions use expressions. Move has trajectories, not a Rotate-style pivot/direction pair. When native Move easing is None, its generator omits easing, duration, and trajectory; a product struct may retain chosen controls for later editing, but execution must take the instant straight route.

Strict schema rules should reject new structured fields combined with legacy `targetId/x/y/value/duration/style`, reject unrelated structured fields on another action type, require an ordered nonempty target list, and bound count/input length/work. Do not deduplicate repeated target entries unless original evidence requires it. Existing limits such as 60000ms are product bounds, not recovered native authoring limits. Saved dangling author targets can follow the existing authoring policy; native import remains stricter and rejects an entire event if any paired target, boundary, or binding is unresolved.

`Action.rotate` should retain its existing shape and old bytes. The planner normalizes its single target into the same internal request type. If native multi-target Rotate is later admitted, it needs an equally explicit ordered carrier; this proposal does not silently change the current Rotate schema. The existing flat `groupId` model is not a native Layer. A future explicit group target can preserve that product extension, but it must not inherit the ordinary-widget square-ratio size rule or claim native Layer recursion.

### Expression/boundary decision required before implementation

`evaluateExpression` internally retains primitive types but always formats its ordinary public result as text (`expressions.ts:5,172,250–255`). `resolve` also performs text interpolation (`export-runtime.ts:882`). Original Move To tests `xValue == ''`; direct number 0 preserves the axis, whereas direct string `"0"` moves it to zero. Size uses a similar loose empty-value test. This proves a consumer-level distinction, **not that a real native StringLiteral containing `[[0]]` supplies number0**.

**Correction before implementation:** an initial proposal assumed that a whole motion expression returned its primitive result while mixed interpolation became text. The parent subsequently traced original `expr.js:203–235`: `_substituteSTOs` retains `retval` only for Object results; numeric/boolean primitives are substituted into the string, with `retval || retvalString` at return. Original `sto.js:165+` also performs numeric addition first, falling back to concatenation only for NaN, with computed/desired-type casts. Therefore neither the whole-expression primitive assumption nor ordinary JavaScript `+` is an approved contract. The parent is executing the complete expr/STO pipeline. Wait for it before deciding a `primitive` overload or motion-specific evaluator mode. Keep existing text/error callers unchanged. Explicit native widget bindings and local scope values still need typed identities and clone/remap support, but input/output typing must follow the complete native pipeline. Do not invoke JavaScript eval or flatten native aliases into unresolved global names.

The format peer has now supplied a bounded binding contract: each expression has `{text,bindings?}`, with each binding a widget target identity; capture each bound widget when that expression starts evaluating. Normalize/validate alias keys and parse them with the safe lexer, not regex substitution. This is the event source; Target is the current paired target. Window comes from the event's own realm/viewport snapshot. Its 62 inspected binding carriers resolve local widget paths without RDO/repeater paths; those wider paths are not implied. The current text-valued core readers cannot preserve native provider metadata by guessing from strings. Resolve provider identity and the subsequent STO casts explicitly once the complete pipeline report settles those types.

`MotionBoundary` remains an exact-schema decision gate. Source `action.js:976–1039` evaluates a boolean boundary expression, then optional compiled X/Y solution trees with their own scopes. It is not simply a rectangle clamp: nested boolean structure, target dimensions, source aliases, withThis replacements, and direction-specific solution order matter. The format peer now recommends preserving the AND/OR comparison tree, each direction and its left/right MotionInput; evaluate the predicate first and, only when false, compute the ordered min/max solutions, including right/bottom dimension subtraction and strict-inequality ±1. Its corrected corpus count is **10 DragX AND >=/<= boundaries plus two Move-To `top > 0` boundaries**. Strict +1 is therefore a real-file requirement, not only a synthetic edge case; the earlier all-AND summary was incorrect. The format report and parent's drag follow-up must settle exact member names and remaining cases before parser implementation. Retaining only an opaque native AST would be storage, not working support; accepting a boundary and ignoring it is unacceptable.

Enclosing event type belongs to the runtime frame derived from the actual interaction, not an independently editable saved field that can disagree with that interaction. It is needed for size-delta and drag/special target routes.

## Current integration surface

| Location in current source | Change required after authorization |
| --- | --- |
| `types.ts:110` Action | New ordered motion specs; typed targets/bindings; no change to legacy numeric meaning |
| `document.ts:693–746` action parsing | Strict new-carrier validation, mutually exclusive old/new forms, round-trip and bounds |
| `document.ts:320–370` remapWidgetIds | Remap every paired target and every expression/boundary widget binding; preserve This/special targets and entry order |
| `components.ts` callers of remapWidgetIds | Verify instance clone/update and clipboard use the same mapping; no new parallel remapper |
| `export-runtime.ts:287,869` EventFrame | Add explicit planner identity, enclosing event type, source movement/drag context when established |
| `export-runtime.ts:309` queueTask | Stop globally flushing every pending batch; flush the batch(es) completed by this synchronous event/continuation |
| `export-runtime.ts:1302–1557` Motion implementation | Event planner plus emitted segment reservations; reuse proven easing, cache, live-angle and clock primitives |
| `export-runtime.ts:1559–1595` action/target expansion | Normalize native new carriers; handle targets in authored order; concrete row resolution before planner registration |
| `export-runtime.ts:1670–1686` numeric geometry actions | Preserve legacy branch; new consumers must not accidentally reuse min-size 1 or old permissive type gates |
| `export-runtime.ts:1818–1821,2004–2041` events/fit | Retain old legacy order; new Move/Resize/Rotate consumer-specific event/release/fit ordering |
| `export-runtime.ts:1826,1843,1917–1974` Wait/atomic/cases/menu | Wait starts a new planner, snapshots preserve planner/cache aliases, menu resumes the correct frame |
| `export-runtime.ts:1080,320–328,2440,2687` row/nav/view/dispose | Per-generation paint isolation and transaction-safe deferred cancellation; distinguish native DOM and private tween lifetimes |
| `engine.ts:11–23,48–86` snapshots/projection | Await own motion tasks, preserve runtime caches and committed fit results; never embed pending callbacks in saved documents |
| `Preview.tsx:173–181`, portable mount, frame player | Shared drag input bridge and cleanup after parent evidence; core owns event semantics, hosts only collect actual input/metrics |
| `export.ts:41–43,56–57`, `frame-player.ts:27–32` | Same core/evaluator in root and nested players; serialized dependency audit if typed evaluator API changes |
| Inspector interaction action editor | Author ordered targets, native modes/trajectory/size anchor and expression/boundary controls; retain legacy action editing |

Line numbers refer to the hashes in the JSON, not future patched sources. No runtime-to-editor DOM manipulation should be added. Nested frames already create independent core instances; drag coordinates and Window measurements must use the correct realm.

## Layer 1: event-owned planner

Use an explicit internal `MotionBatch` identity referenced by `EventFrame`. Its map is keyed by the existing collision-safe `instanceKey(widgetId, fullRowContext)`, never the template ID alone. Each entry contains three FIFO request queues, consumed durations, and the original event-local `moveResult`/`resizeResult` caches. An emitted segment keeps a reference to that combo state; copying the scalar results into every segment would lose the original invalidation and shared-cache behavior.

At intake, reproduce the source's instant fast path and third-channel eager combination. At explicit event-end flush, emit according to Resize > Rotate > Move. The segment duration is the shortest remaining participating interval. Keep `{start,end,len}` for every participating channel, the selected leader, and the selected easing. Move easing wins when present; otherwise Resize's or Rotate's. Each segment begins a new easing curve from zero. Preserve action order and repeated same-type requests; do not sort all requests by channel before intake.

The original filtered eventCopy creates a new outer frame while sharing its ordinary nested planner/drag objects. Model the proven aliases deliberately instead of copying the vendor typo. `TaskGroup` is an asynchronous result/error owner, not event identity. Equal event names do not imply shared batches; a reentrant event's relation must follow the source entry point. The current `geometryEvent` creates a fresh frame: determine which new consumer callbacks explicitly carry a copied originating frame and which dispatch a fresh event.

Wait must flush the preceding synchronous batch, suspend only its remainder, and resume with a distinct planner while preserving the appropriate source/row/drag carrier semantics. A case-selection menu retains its continuation frame; a later user selection must not merge with an unrelated live event. Empty/no-match events should not leave inert batch records or task counts.

The source's mixed pending-instant branch does not visibly make progress and passes surprising arguments. The sibling's subsequently reported 88-case actual-Edge run now includes two bounded nonprogress cases and a separate real consumer TypeError: M40/MNone/R100/Rot100 repeatedly forwards RotateInfo to Move; Rot40/RotNone/R100/M100 is symmetric; M40/MNone/Rot100/R100 reaches a missing-options TypeError. The first two were stopped after ten real consumer calls by the research harness. Do not silently repair these into an ideal queue or copy an infinite loop. Proposed product behavior is a deterministic work-budget/nonprogress error with atomic cleanup; this is a safety divergence requiring explicit approval and tests. Final source-bound DOM evidence remains the authority for the precise sequences and counts.

## Layer 2: instance/channel reservations and animation consumers

Each emitted segment reserves its actual Move/Resize/Rotate channels in per-concrete-instance FIFO order. It starts only when every required reservation is at the head. Different instances, independent input events, and different frame realms continue. Already-running animations must not cause a global Promise lock.

Keep the originating requests and task ownership on the segment. One request may produce multiple segments; Promise accounting must settle it once after all its parts finish or fail. Do not count only `Motion` deletion. Reentrant/shared-frame cases must not attribute a queued-start exception to whichever previous animation happened to release the channel—the published Rotate fix explicitly prevents that failure. Later start evaluation gets its own transaction and error owner, while completed prior work remains committed.

Evaluate parameters at actual reservation start, not initial action dispatch. Move caches evaluated destinations/displacements across slices with its distinct To/By ratios and clears on final/instant. Size preserves empty/nonnumeric axes, clamps negatives to zero, but its cache is invalidated when the source's actual-change path invalidates it. Rotate-led degree/offset evaluation occurs before OnRotate; Resize-led degree evaluation occurs after OnRotate. Resize-led clockwise omission is a proven source quirk, not an excuse to ignore direction for standalone Rotate.

For ordinary changed-size Resize, the exact source caller/helper currently proves a second ratio in the size CSS request. Do not implement ideal linear interpolation to the authored final width. Sibling preliminary real-DOM feedback reports Move40+Resize70 finishing at 299.65306122448976×159.59183673469386 for a 200×100→300×160 request, while equal durations reach the request. Accept this as a numeric oracle only after its final source-bound browser report is frozen. Resize anchor and Rotate orbit anchor are independent; Resize-led orbit uses different bounds/offset inputs from standalone Rotate.

Use separate consumer completion paths, not one `finishAll` callback:

| Consumer | Source ordering to preserve |
| --- | --- |
| Standalone Move | fit parent, then release Move |
| Standalone Rotate | release Rotate, then fit parent |
| Circular movement | release Move, then fit parent; orientation completion is separate |
| Changed ordinary Resize | fit, release Resize, optionally release Move, caller callback, annotation boundary, OnResize, clear resizing rect |
| Unchanged Resize | immediate release and Resize event path |
| Nonresizable target | release/callback without normal Resize event |

A next queued request can begin between these steps. The new source has a duplicate Move-release path; do not automatically deduplicate it before its successor behavior is established. The original opacity/size DOM tweens and private angle tween also have different stop/lifetime behavior. A single ideal affine interpolation would erase these differences.

Retain separate paint geometry, moved/resized public caches, final-angle bounds cache, live rotation, source movement delta/options, and temporary resizing rectangles. Do not make `This.width/height` a rotated AABB. Do not force a zero dimension into the document's minimum-one rule: runtime zero CSS and logical-cache truthiness are separate source branches, and need real DOM proof. The existing native text setter and parent-fit caches must remain distinct from authored size and transient resize info.

## Transactions, lifetime and snapshots

Extend `atomic` with planner-map identities, queue entries/used counters, shared expression caches, segment reservations, request completion counts, source movement context, and any new runtime paint/cache maps. Snapshot the graph once so rollback restores aliases among motions, Wait/menu frames and batches. Independent `structuredClone` calls on each frame would create equal-looking but disconnected planners. Keep TaskGroup Promise callbacks outside cloned data and journal their pending-count changes.

Retain outermost-commit rules for irreversible timer cancellation, navigation and menu replacement. A failing destination Loaded must restore old timers/planners and cancel newly created destination work. A queued-start failure must reject its own task, drain/release its reservations as specified, and allow unrelated/prior/following work to settle. Budget recursion, queued work and total split segments; rejection must be atomic rather than a frozen player.

Use the existing full row identity plus generation counter: an active tween must not paint a replacement row with the same stable row ID, while a later queued request can resolve the replacement when it starts. Row deletion, row refresh, page navigation, dispose and adaptive transition need separate cases. Do not infer one universal cancellation rule from Rotate: original private angle animation survives DOM stop and detachment, whereas actual Move/Resize DOM behavior is under current investigation. Retain the published product's safe unload policy unless explicitly revised with evidence and tests.

Execution snapshots may retain necessary nonempty completed cache maps under `RuntimeState.motionState`, not under Document. `engine.executeInteraction` should still await its own work and return a detached clone before disposing. Pending animation callbacks/timers are not currently a resumable snapshot format; do not pretend serializing current paint resumes a running segment. If mid-flight resume is desired, it needs a separately versioned explicit API. Completed chained execution must nevertheless give the same next-action caches and fit projection as one uninterrupted session.

## Compatibility, missing domains and task slices

1. **Legacy compatibility:** absent new fields means today's numeric Move/Resize: absolute x/y, Resize x/y as width/height, duration historically inert, existing type/min-size behavior. No migration by merely seeing `duration`. New structured actions use the proven native type gate and semantics. Existing Rotate, Wait, SetText AutoFit, fit, row, adaptive and snapshot tests remain mandatory regressions.
2. **Shared schema and expressions:** parent owns types/parser/author UI/copy/import mapping; agree ordered carrier, typed evaluation, binding/AST and special-target carrier before runtime writes. The raw corpus has real expressions and boundaries, so numeric-only implementation would leave concrete source objects unsupported.
3. **Planner and reservations:** core owner implements source-derived segmentation and lifecycle first, using module and bare-factory tests; then actual consumers. Source tests must include all six triple orders and repeated same-type actions, not only a happy-path final frame.
4. **Consumers:** Move nine modes and three trajectories, Size anchor/zero/type gates/panel behavior, Rotate-led and Resize-led combinations, independent completion order and caches. Compare intermediate frames, events and queued successors to original frozen DOM outputs. The parent owns drag lifecycle and special widgetsBelow/Right evidence; those results are dependencies, not features to omit.
5. **Host bridge:** Preview, portable mount and frame-player must supply real pointer/realm input, clean subscriptions and correctly scope nested rows/frames. No new host drag behavior is claimed by this plan. Pinning/percentage panels and native Layer hierarchy are not fully represented by today's model; they require a shared model/host decision rather than a panel-as-layer substitution.
6. **Importer:** preserve paired targets and scoped expressions; reject unresolved whole events. The 46 Move /9 Set Size corpus counts and six mixed cases are investigation counts, not predicted import successes. Source-reader changes are separate ownership.
7. **Integration:** parent owns browser/desktop/package evidence. Root and nested exported players must execute exactly the same core. Preserve `createOfflineRuntime.toString()` self-containment; keep the pure planner inside this factory unless every serialization call site is deliberately extended. Do not add an imported closure or sixth helper parameter as an incidental refactor.

## Required regressions

| Area | Meaningful cases |
| --- | --- |
| Schema/remapping | Legacy byte round-trip; mixed old/new reject; paired target order/duplicates; This and special targets; nested clone/component/repeater IDs in expressions and boundaries; no arbitrary JS |
| Planner | 40/70/100 triple all six orders; M40/M40/R70/Rot100; equal/unequal pairs; third-channel early event observes pre-following-action variable; distinct event frames and full nested-row identities |
| Evaluation | Start queued behind earlier motion; variable changed between slices; Move destination cache vs Size invalidation; numeric0/string0/empty/nonnumeric/negative; event-handler mutation before/after degree evaluation |
| Paint/cache | Distinct Resize and Rotate anchors; offset/shadow/current-angle cache; unequal final dimensions; zero width/height and position0; arcs; per-frame public geometry versus CSS |
| Ordering | Parent fit/Resize/Move/Rotate events, queued successors at channel release, duplicate release, unchanged and rejected Resize, source movement context for withThis/sizeDelta routes |
| Reentrancy/rollback | Handler adds another transform; cross-trigger invalid queued expression; old Wait survives rollback, new Wait/menu/motion canceled; destination Loaded failure; recursive handlers/work budget |
| Lifecycle | Adaptive reset during each type and combo; row rebuild/delete, active old generation vs queued new generation; nested frame disposal; successful navigation unload |
| Snapshot | Consecutive executeInteraction matches uninterrupted final caches, flat-group angle compatibility, parent fit projection; no motionState added for unused old documents |
| Drag/special | Zero-delta first move, final pointer-up sampling, DragX/Y locks, locationBeforeDrag, withThis missing source, Window/scroll/zoom/coordinate realms, thisItem and widgetsBelow/Right source evidence |

## Smallest implementation batches that retain the full goal

These are integration checkpoints, not separate claims of completion or reasons to omit difficult modes.

1. **Foundation without legacy behavior changes.** Agree and implement MotionInput and the source-verified expression pipeline, ordered specs, strict parser/remapper, and event context carriers. Land a pure internal event planner and reservation representation inside the portable factory, with source-derived segmentation tests, but do not expose an authoring control whose consumer is absent. Keep the existing numeric path and Rotate regressions green. This batch can progress without guessing DOM geometry, drag deltas, or Layer layout; expression-result typing remains gated by the parent's complete pipeline probe.
2. **Ordinary widget consumers and full combinations.** Wire all documented ordinary Move/Resize modes that have complete context, timing/easing/trajectory, boundaries and queued evaluation; implement actual Resize/Rotate-led callback sequences from final DOM evidence. Test same-event early emission, unequal durations, zero/string coercion, nonresizable targets, intermediate caches, queued successors and rollback. Do not publish this batch as complete while drag-context modes remain unusable. Expression/boundary compiler and drag-context interfaces should already be in place so this does not require a second incompatible schema.
3. **Context-dependent routes and hosts.** Add the parent's actual drag/Drop lifecycle, withThis source motion, size-delta source events, widgetsBelow/Right and thisItem, correct Window/input realms, repeaters, nested frames and cleanup. Specifically preserve the source distinction between public DragX/DragY and retained `GetWidgetDragInfo`: parent probes report Drop zeros the public value while the internal delta remains stale; before any drag the internal empty object yields non-finite deltas. Do not substitute zero for either unknown/missing source behavior. Coordinate bounded-error treatment with the source exception/nonprogress policy.
4. **Close model/lifecycle gaps and integrate.** Validate native Layer/flat group distinctions, fixed/percent panel routes, DOM tween stop behavior, source import atomicity, shared snapshot caches and host projection. Any case that requires new hierarchy/pinning representation must be explicitly decided and implemented or retained as a named incomplete capability; existing groupId or dynamic-panel substitution is not sufficient evidence. Parent performs real preview/offline/frame/desktop and release checks only after all owned runtime sources are stable.

Recommended ownership: core owner handles `export-runtime.ts` core, engine snapshot/projection and focused module/serialized tests; parent handles shared schema, expression implementation, UI/remapping, host drag bridge and integration tests; native format agent handles reader/import protocol under separate ownership. Agree exact files before simultaneous edits—especially shared `expressions.ts` and the `mountOfflinePrototype` portion of `export-runtime.ts`. Source-derived tests can be committed before consumers, preserving explicit red logs, while production behavior remains gated by valid complete specs.

## Preserved current-product red evidence

`runtime-transform-core-probe.mjs` runs the current function and its bare `.toString()` form with the same deterministic clock. `runtime-transform-core-red.json` originally records **8/8 compatibility controls**, **10 failed capability expectations**, **0 harness errors**, and stable product hashes. **Corrected interpretation: eight checks demonstrate missing Move/Resize/planner capabilities; two evaluator checks are an unproven expression-pipeline hypothesis, not established native behavior or a required product change.** Preserve the original report and this correction rather than relabeling its historic output. New structured actions deliberately bypass the current document parser. Their initial proposed inputs are strings, predating the format peer's MotionInput wrapper agreement; use the final wrapped carrier in subsequent red/green tests. Their current no-op is a pre-implementation API gap, not a valid released document regression. Both legacy numeric actions remain immediate; this is the behavior to preserve.

The meaningful ordering counterexample sets N=9 after the third transform action. Current runtime has no structured Move/Resize planner and its existing Rotate flush sees N=9; source RTM-01's eager third-channel path would observe N=0. The interpreter probe separately shows numeric literal0 and quoted string0 both return string0 today; the full native StringLiteral substitution may do the same, so this observation alone does not demand primitive output. These red records should remain even after implementation; later green probes use a new output name and the final agreed schema.

No final candidate, full-suite count, release hash, original GUI comparison, drag implementation, complete Layer support, or complete combined-animation parity is claimed here. Production remains frozen pending the shared schema and final DOM/drag/binding contracts.
