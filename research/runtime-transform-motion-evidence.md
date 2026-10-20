# Runtime Move / Resize / Rotate: source-first combined-motion contract

This is a new, bounded investigation of retained Axure RP **11.0.0.4150**. It does not replace the frozen `runtime-rotate-motion-*` evidence. The current result is **36/36 exact-source NodeVM cases**, plus static call-chain inspection. **No browser was started** in this stage; no product source, tests, old evidence, or artifacts were edited. Actual changing-size DOM tween behavior remains a required next verification step.

Extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`. The adjacent JSON binds exact file paths, source bytes, slice hashes, probes, and this report.

## RTM-01: two scheduling layers, not three independent tweens

The first layer is `eventInfo.idToResizeMoveState[concreteElementId]`: three FIFO queues, each with a consumed duration `used`. Move=1, Resize=4, Rotate=5. `_queueResizeMove` (`action.js:143–240`) executes an instant request immediately if its same-type pending queue is empty. Animated pairs wait for a flush. Arrival of a third type can emit a combined segment immediately, before the remainder of the event's action list has executed. The six action-order permutations are exercised, not merely inferred.

The second layer is `animationQueue[concreteElementId][queueType]` (`action.js:14–126`). `_addAnimations` reserves all required queues. A group starts only when every member is at its queue head. These are operation/channel reservations, not native visual Layer identities. Different concrete IDs remain independent. An emitted segment can still wait on this second layer, so expression evaluation occurs later than first-layer planning.

`events.js:365–394` runs case groups then flushes the event. `action.js:359–367` resumes Wait with copied event info but explicitly clears `idToResizeMoveState`, dispatches the remaining actions, then flushes that new batch. Thus “same event” means the same batching object, not merely equal event names. Ordinary target resolution is shared (`doc.js:175–207`): relative object path → script ID with limbo exclusion → concrete repeater IDs. Special Move `widgetsBelow/widgetsRight` bypasses this coalescer; Resize `thisItem` sets item size directly. Those routes must not be silently represented as ordinary widget transforms.

## RTM-02: segment priority, duration, easing, and stop carriers

`_flushResizeMoveActions` (`action.js:247–349`) chooses **Resize, else Rotate, else Move**. A segment duration is the shortest remaining duration among participating channels. Each channel carries its own `{start,end,len}` interval: `stop` is the leader, with `moveStop` and/or `rotateStop` for other channels. New slice easing starts at its own beginning; it is not a continuation of the original easing progress.

Easing is **Move's if present**, else Resize's for a Resize-led segment, else Rotate's. There is no independent per-channel easing within the chosen segment.

| Requests in one batch | Emitted segments |
| --- | --- |
| Move40, Resize70, Rotate100 | Resize40 + Move + Rotate using Move easing; Resize30 + Rotate using Resize easing; Rotate30 using Rotate easing |
| Move40, Move40, Resize70, Rotate100 | Resize40; Resize30; Rotate10 + remaining Move; Rotate20 |
| Move40 + Rotate100 | Rotate40 with Move easing; Rotate60 with Rotate easing |

All six permutations of the first triple produce that same sequence in the recording consumer, with its first segment emitted before explicit flush. Repeated same-type requests, separate event objects, and separate concrete row IDs are covered. This proves the planner's outputs, not the real consumers' completion scheduling.

An important unexecuted malformed/mixed-boundary branch exists at `action.js:182–193`: when another pending channel is instant, the branch calls its consumer with the incoming `actionInfo` and continues without visibly shifting that pending queue. Do not repair or generalize it from intention; test with an execution timeout and real consumers before deciding its reachable behavior.

## RTM-03: value evaluation and actual shared cache identity

Move's `_getMoveLoc` (`866–1042`) uses `comboState.moveResult`: To stores the evaluated destination then applies `(end-start)/(len-start)` to the current remaining distance; By stores the evaluated displacement then applies `(end-start)/len`. Final or instant slices clear this result. Empty Move-To coordinates mean zero displacement for that axis. The direct exact helper test changes its input between two slices and observes the cached first value.

`_getSizeFromInfo` (`1528–1551`) returns absolute requested dimensions, not a native By mode. Empty/nonnumeric dimensions preserve the old dimension; negative numbers clamp to zero. It caches `resizeResult` when a state exists. However, ordinary `_addResize` clears that result whenever dimensions actually change (`1459`), in addition to final-stop clearing in its CSS helper. Do not assume Resize expressions are evaluated once for the whole authored action.

`utils.temp.js:28–49` is crucial. Although `eventCopy` calls `_deepCopy`, its actual filtered-object line is `filter.indexOf[key] != -1`, using property access rather than a call. Three **same-realm original-function identity tests** confirm that eventCopy creates a distinct outer object but shares `idToResizeMoveState`, `dragInfo`, and an ordinary nested object. Unfiltered `deepCopy` creates distinct nested objects. The geometry harness's shallow event-copy sink is therefore consistent for those tested carriers. This is a source quirk, not a recommendation to introduce that typo into independent code.

Rotate-led `_addRotate` evaluates angle and offsets before OnRotate. Resize-led `_addResize` evaluates width/height and offsets, raises OnRotate, then evaluates angle (`1444–1463`). A controlled handler changing degree90 to180 produces a dispatched90 in the former and180 in the latter. Current-angle reading is later still, in `_rotateSingle`/`_rotateSingleOffset`.

## RTM-04: actual changed-size CSS request contains a second ratio

For ordinary widgets, `_addResize` first computes:

`d = Math.round(requestedSize - oldSize) * r`, where `r=(end-start)/(len-start)`.

It passes `oldSize+d` into `_getCssForResizingWidget`, which computes a new `delta = (newSize-oldSize) * r` again (`1572–1586`). For this source path, the consumer receives `oldSize + Math.round(requested-oldSize) * r²`.

The exact caller/helper composition, with **genuinely changed requested size**, yields:

| Old → requested | Resize slice | CSS sent to resize consumer |
| --- | --- | --- |
| 200×100 →300×160 | 0..100 /100 | 300×160 |
| 200×100 →300×160 | 0..50 /100 | 225×115 |
| 200×100 →300×160 | 0..40 /100 | 216×109.6 |

These are recorded CSS arguments. They are **not yet an end-to-end changing-size DOM animation oracle**, and not an assumption that every widget or native Layer uses this formula. Layer percentage sizing is separately implemented in `1329–1336` and child sizing in `1654–1731`, so applying the ordinary square-ratio rule to groups would be incorrect.

The original JavaScript `Math.round` remains significant for negative/fractional differences. Later real-browser tests should verify full sequences after actual prior slices mutate CSS, not simply add the above isolated deltas.

## RTM-05: direction and two different anchors

Resize-led angle parsing (`1360`, `1463`) does not apply `clockwise=false`. Two new exact dispatch cases request an actual200×100→300×160 resize plus By90 and send+90 for both direction flags. This extends the source-level coverage of RRM-09 beyond unchanged-size cases, while **not claiming its full DOM size/rotation result**.

The Resize anchor controls size-related location shift. The Rotate anchor controls the orbit pivot, and they must remain separate. Nine plain Resize anchors are executed. For a frame at100,100 changing200×100→300×160, top-left stays100,100; center becomes50,70; bottom-right becomes0,40.

Ordinary standalone Rotate obtains anchor dimensions from unrotated CSS (`1168–1170`). Resize-led Rotate obtains them from default `offsetBoundingRect()` (`1447`), including rotation/shadow/cache effects. The controlled90-degree200×100 fixture supplies AABB100×200: a top-right Rotate offset becomes local(+50,-100), then rotates to(+100,+50), giving pivot300,200. This is a numeric AABB sink test, not a fresh browser bounds test.

For off-center Resize-led rotation, `_getCssForResizingWidget(...handleMove=false)` adds its location shift to the Move delta; `_applyAnchorToResizeOffset` is independently given the **first**, not squared, deltaWidth/deltaHeight and the Rotate anchor (`1466`). A changed-size example with Resize bottom-right, Rotate top-right, Move(40,20) sends Move delta(-60,-40) and resizeOffset(+50,-30), while its size CSS has no left/top. Its `css.deltaX/Y` include an additional shift; the public resize consumer only updates the move cache when left or top is truthy, so those fields alone cannot be treated as a second motion instruction.

The Layer branch differs again: its child Rotate pivot update uses **resizeInfo.anchor** (`1393`), not rotateInfo.anchor, and its Y expression uses original eventInfo while X uses eventInfoCopy. These are static source observations awaiting bounded Layer execution. Native Layers must not be substituted with dynamic panels or unqualified flat-group semantics.

## RTM-06: eligibility, events, geometry caches, and completion

Resize's public consumer (`axQuery.std.js:570–826`) first records a resizing rect, then applies `IsResizable`. The exact whitelist at75–81 is button, dynamicPanel, imageBox, imageMapRegion, inlineFrame, layer, listBox, comboBox, vectorShape, textArea, textBox, screenshot. Table, tableCell, menu, tree, checkbox/radio and the old horizontal/vertical line types are not in that whitelist. A rejected resize releases channels and invokes its completion callback but does not follow the normal Resize event path. SizeInfo dispatch itself has no additional hidden/disabled guard.

Dynamic panel Resize clears fitToContent and sets overflow hidden in `_addResize` before queue execution (`1307–1310`). Percent-width/pinned panels and textarea child size have special paths. Those are explicit scope items for a complete implementation; the current numeric fixture does not execute them.

For an ordinary changed-size Resize-led combination, observed dispatch order is: determine size/Move; evaluate Rotate offsets; **OnRotate**; calculate CSS; evaluate angle and start Rotate/circular motion; **OnMove** if a Move action exists; start Resize. Actual ordinary Resize completion is statically: parent fit → release Resize → release Move if `moves` → caller completion → annotation → OnResize → clear resizing rectangles (`656–663`). Dynamic-panel completion adds flyout/percent-width updates before release. Unchanged CSS follows the immediate release→OnResize path (`1483–1486`).

This differs from standalone Move completion: parent-fit callback runs before releasing Move (`move.js:137–165`), and standalone Rotate releases Rotate before fitting. Circular motion releases Move before its fit callback (`move.js:306–319`). Consequently next queued work can run between different callbacks; one generic “complete everything, fit once, then release all” contract is unsupported.

The center Rotate branch inside `_addResize` can release Move at1471 and later Resize completion can release Move again when `moves` is truthy. This is a concrete call-chain observation, **not yet a verified queued-successor outcome**; next probes must include real queue reservations and callback timing. Similarly public resize uses truthy left/top and width/height checks at722–734; zero-coordinate/zero-dimension cache cases require explicit tests.

`move.circularMove` uses incremental tween degree, the current bounds center, and the preceding `rotation.degree` when rotating each resizeShift (`267–303`). jQuery calls step before writing the animated degree property. Resizing and orientation run on separate targets, so real timer insertion and step order matter. The current report does not collapse this into an ideal affine interpolation.

## Executable next-probe plan

The adjacent JSON contains machine-readable phases and coverage. Priority is:

1. **Same-realm queue composition, no browser:** load exact queue functions, all three action bodies, actual eventCopy, and numerical/recording animation consumers. Schedule callbacks explicitly; test occupied channels, queued successors, cross-event requests, Wait boundary, immediate event reentrancy, duplicate-release branches, expression cache invalidation and incomplete triples. Keep every sink declared.
2. **Actual local DOM, only after parent releases browser slot:** retained complete jQuery/UI plus exact public resize/Move/Rotate and bounds/cache dependencies. Test actual size changes200×100→300×160; durations40/70/100 and equal durations; all pair/triple action orders; By/To and both direction flags; initial angle0/30/90; distinct Resize/Rotate anchors; positive/negative shadow; moved/resized cache; zero dimensions; nonresizable controls; hidden elements. Observe intermediate CSS, source cache, public getters, events and queued successors. Block network. Do not substitute jQuery's animation scheduler with an independent interpolation for these cases.
3. **Layer and layout boundary:** one native Layer with eligible/noneligible children; nested Layer; fixed/percent panel; manually resized textarea; thisItem and widgetsBelow/Right special routes. Bounds/object providers must be explicitly declared if still synthetic. The editor's flat group is a separate product design question.
4. **Interruption:** DOM stop, CSS overwrite, element detach/replacement, adaptive cache clear and row refresh during combined animations. Reuse only prior Rotate evidence that actually applies; do not infer Resize interruption from private angle tweens, because panel resize animates the element itself while ordinary resize animates a private location object.

All phases preserve exact source hashes. This stage does not authorize product changes or claim the plan has run.

## Execution record and limits

`runtime-transform-motion-first-probes.json`:31/33. Both failures were harness faults: a strict expected object omitted the real `moveTo:false` field, and the recording facade omitted `action.queueTypes`. They are retained, not product regressions. `runtime-transform-motion-probes.json`:33/33 after correcting those fixtures. `runtime-transform-motion-final-probes.json`:36/36 after three actual eventCopy identity cases. Earlier evolving script revisions were not separately copied; their hashes are recorded in their outputs. The final runnable script is bound in the manifest.

This report establishes planner outputs, source formulas, identity, and ordinary dispatch/argument order under explicit sinks. It does not establish a real generated page's end-to-end changing-size animation, native UI gesture behavior, native Layer flattening, fixed-position layout, or full lifecycle races. No vendor DLL method or original GUI was executed. No full product suite, build, package, browser server, configuration installation, or network download was run.
