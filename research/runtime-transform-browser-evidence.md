# Changing-size Move / Resize / Rotate in retained Axure 11 runtime

This closes the ordinary-widget changing-size DOM gap in `runtime-transform-motion-evidence.md`. The primary probe and a second execution each pass **88/88 checks**; a Move-To supplement and its confirmation each pass **10/10**. Together there are **98 unique cases:95 normal timed DOM cases and three bounded pathological-queue cases**. This is **actual headless Edge 155.0.4283.62**, complete retained jQuery 3.7.1 / jQuery UI 1.13.2, and exact retained Axure source slices. It is not the original Axure application, a generated authored project, or a vendor GUI comparison. No vendor DLL method, product code, product test, historical evidence, package, or artifact was changed.

The adjacent JSON and manifest bind full source paths, SHA-256 values, exact slice ranges/hashes, executable probe revisions, all result files including failures, and compact numeric fixtures. Distribution SHA-256 is `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; extraction evidence is `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.

## RTB-01 — What actually runs

The harness loads the complete retained jQuery/UI, complete `math.js` and `move.js`, real `eventCopy/deepCopy`, geometry caches, ordinary bounding-rect and size readers, public Move/Resize/Rotate consumers, both queue layers, real action dispatch and the ordinary three action handlers. It does **not** replace jQuery animation with a simulated clock or independent interpolator. Transparent wrappers record original calls, delegates, per-property steps, completions, CSS, bounds, and caches. Network is blocked; both final runs have zero requests and zero uncaught page errors.

Controlled dependencies are explicit: generated object/style records and direct target IDs; a literal/variable expression evaluator; synthetic-event logging with selected variable-changing hooks; no-op/logging parent-fit, containment, flyout and annotation services; false percent-width and empty fixed-layout providers. Event-end flush is invoked explicitly after the real action dispatcher. Thus call order into `onRotate/onMove/onResize` and fit services is observed, but complete event-case execution and actual parent resizing are not. Each fixture is an absolutely positioned border-box DIV, even when its model type is textBox/inlineFrame/dynamicPanel. Those type cases verify routing and outer geometry, not native controls, iframe navigation, or panel-child layout.

Default owner is `(100,100,200,100)`, rotation0; Move is By(40,20), Resize is To(300,160) anchored top-left, Rotate is clockwise By90 centered. Actual animation frame timestamps and intermediate CSS depend on scheduling; they are observations, not universal exact timing requirements.

## RTB-02 — Two ratios produce a real final size residual

All six orders of the three actions, and both orders of each pair, are executed with equal100 durations and with Move40 / Resize70 / Rotate100. With Move present at40, the planner splits Resize into40 and30. For the ordinary source path:

`nextSize = oldSize + Math.round(requestedSize - oldSize) * ((end-start)/(len-start))²`

The first ratio is in `action.js:1422–1428`; the second is in `1571–1586`. This is now confirmed through real Resize consumers and live DOM, not just recorded CSS arguments.

| Batch | First Resize target cache | Final size cache | Typical final CSS serialization |
| --- | --- | --- | --- |
| Move40 + Resize70, either order | 232.65306122448976 × 119.59183673469387 | 299.65306122448976 × 159.59183673469386 | 299.653px × 159.592px |
| Same plus Rotate100, all six orders | same | same | same |
| Equal100 pair/triple | 300 × 160 | 300 × 160 | 300px × 160px |
| Resize70 + Rotate100 without Move | 300 × 160 | 300 × 160 | 300px × 160px |

The residual is not a missed final animation tick: every normal case waits for actual jQuery timers and native operation queues to drain. Rounding the remaining67.346938... to67 prevents a final exact300. Equal-duration and Resize-leading-only controls reach their target.

Real cache state precedes paint. At the first Resize animation start, DOM width remains200 while `resizedSize.width` and native query `size().width` already report232.65306122448976. Intermediate width frames are captured. The second segment similarly publishes its final target before all pixels reach it. A single mutable geometry record cannot stand for both live CSS and source cache.

## RTB-03 — Segment-specific direction, expression capture and easing

With initial30 and equal100 Resize+Rotate, clockwise and counterclockwise inputs both finish120 for By90 and90 for To90. Resize-led dispatch ignores the clockwise flag (`action.js:1463`). With Resize70 and Rotate100, the remaining standalone Rotate segment applies it again: **counterclockwise By90 finishes66**, while **counterclockwise To90 finishes−90**. This is a changing-size DOM result, not extrapolation from the previous unchanged-size probe.

Easing is selected per emitted segment. Move `easeInQuad`40 + Resize `easeOutBounce`70 + Rotate `easeInCubic`100 produces40 using Quad,30 using Bounce,30 using Cubic. Both size/location and degree consumers receive that segment's easing. Real original jQuery easing functions are used; the new stage does not re-test all33 functions independently.

Resize-led OnRotate occurs before degree evaluation. A controlled synchronous OnRotate hook changing degree90→180 yields180. A width variable300→400 is read as300 for the first changing-size slice and400 for the second, finishing399.65306122448976. By contrast, an in-progress Move variable40→400 is evaluated only once and remains40 across its slices. This uses the retained shared event-copy/cache identity; it is not a proposed expression interpreter contract beyond the tested supplied values.

## RTB-04 — Anchors, shadow geometry and invalid cache values

Resize and Rotate anchors are independent. The four Rotate corner anchors all yield finite cache locations with a changing-size Resize. With Resize-center, equal100, no Move, initial0, their moved-cache endpoints are approximately:

| Rotate anchor | left | top |
| --- | ---: | ---: |
| top-left | −230 | 110 |
| top-right | 70 | −90 |
| bottom-left | −130 | 270 |
| bottom-right | 170 | 70 |

Do not replace this orbit plus resize-shift algorithm with an ideal transformed final rectangle. `move.js:267–303` uses incremental degree, current bounds and the preceding degree property when rotating each resize shift; jQuery calls step before assigning that property's new value.

`action.js:1498–1506` initializes `resizeOffset` as an empty object and writes an axis only if the Rotate anchor contains left/right or top/bottom. For tested top/right/bottom/left anchors, and center with a nonzero explicit offset, changing-size circular motion consumes a missing axis and writes **NaN to both moved-cache axes**. Real CSS remains at100,100 while rotation and size still complete. Center with zero offset takes another branch and is finite. The expanded/final reports encode nonfinite values explicitly as `"NaN"`; the earliest43-case report serialized them as JSON null and is not the authoritative nonfinite-value evidence.

Six additional changing-size cases combine initial0/30/90 with top-right orbit and positive/negative shadows. Actual retained bounds/cache consumers are used. With offset(−10,−20), blur6, the final moved-cache location differs from DOM by(−16,−26); positive-offset cases do not have this negative-edge adjustment. Compact fixtures preserve exact cache observations and tolerances. CSS strings can accumulate small serialization differences, so they are not copied as universal exact orbital endpoints. No actual painted shadow, parent-fit result or original generated page is claimed.

## RTB-05 — Completion reentrancy and overlapping successors are observable

The basic unequal triple's synthetic-event call sequence is:

`OnRotate → OnMove → OnRotate → OnResize → OnRotate → OnResize`.

The third request can start work before the following ordinary action and before event-end flush; a marker after the third request confirms this. The first Resize completion fits, releases its Resize reservation, and immediately starts the second segment; only afterwards does that first completion invoke its OnResize. The second Resize's orientation finishes and releases Rotate before the private location/size tween's final callback. A following Rotate segment can therefore begin while size pixels are still intermediate.

The source contains two distinct Move releases: the center Rotate branch releases Move immediately (`action.js:1471`), and the Resize consumer later releases it again when `moves` is truthy (`axQuery.std.js:656–663`). Literal offset-expression carriers are objects, so even a carrier whose value is zero is truthy for the reservation flag. Real traces retain both releases; this is not a hypothetical double-release warning.

Adding a second Move By(100,0)/60 after Move40 + Resize70 + Rotate100 makes a concrete difference. The second Move is split30/30. Its last DOM relative tween begins **before** the second Resize tween completes. In repeated executions, final moved cache is240 but final DOM left is216.667 or218.333 (and may vary with sampling). The new Move captured intermediate CSS, then competed with the older Resize's left writes. The assertion is the stable causal ordering, `+=50` request and cache240—not a fabricated single stable CSS endpoint. Parent-fit calls are logged but their actual geometry effects remain a sink.

The additional Move-To matrix tests all six orders with Move-To(140,120)/100, Resize70 and Rotate40. Its second Resize starts and publishes moved cache128,114 while DOM is still116,108. The preceding Resize completion then releases Move again, starting the final Move slice. That slice computes the remaining(12,6) from cache128,114 but gives a relative tween to DOM116,108. The recorded DOM ends128,114 while moved cache ends140,120. A negative target similarly gives DOM2,16 versus cache−40,−20. This is **not** a claim that the final Move started before the second Resize; the preserved trace shows the opposite. Equal100 Move-To reaches the requested point, an empty To axis stays unchanged, and the cached To expression is evaluated once despite OnRotate changing its variable. This supplements the By cases rather than inferring To behavior from them.

An implementation needs distinct per-event batching state, operation reservations, target caches, live tween geometry and completion ordering. A policy that resolves all components and fits once only at the final common endpoint does not reproduce this source.

## RTB-06 — Pending instant actions expose a reachable source defect

Nine simple cases where one channel's first action is instant complete normally. Pending instant actions behind animated actions are different. The exact `action.js:182–193` loop selects the pending channel's consumer but passes the **incoming action's carrier**, then continues without consuming that pending head.

| Authored sequence | Observed bounded result |
| --- | --- |
| Move40, MoveNone, Resize100, Rotate100 | First Resize40 starts, then Move consumer is repeatedly called with RotateInfo; pending MoveNone remains. |
| Rotate40, RotateNone, Resize100, Move100 | First Resize40 starts, then Rotate consumer is repeatedly called with MoveInfo; pending RotateNone remains. |
| Move40, MoveNone, Rotate100, Resize100 | Second planned consumer is Move with ResizeInfo; original `_addMove` throws `TypeError` while assigning `options.easing`. |

For the first two only, a transparent consumer wrapper throws `HARNESS_CONSUMER_BUDGET` before the11th delegated consumer call. The first ten calls, original queue and source loop are unmodified. This is a bounded nonprogress observation, **not a measured permanent original-browser hang**. The third exception occurs in the retained consumer before reaching that guard. These three cases pass because they assert the source pathology; they are not three successful animations. Reset clears their remaining timers between isolated fixtures.

A reconstruction must make a deliberate, documented policy for this defective branch. Silently normalizing it while claiming full original fidelity, or deliberately freezing its own UI, is not justified by this report.

## RTB-07 — Zero values, gates and retained limits

`_getSizeFromInfo` uses loose `value != ""` (`action.js:1540–1541`). A supplied **number0** equals the empty string and preserves the old axis. A supplied **string"0"** becomes zero. The controlled expression sink preserves that distinction; it does not prove every native expression produces one specific JavaScript type. In particular, **the number0 case must not be used as evidence that native user input `0` keeps the old size**. Original StringLiteral / `_substituteSTOs` conversion is outside this harness and is being investigated separately upstream.

For string"0" on both dimensions, actual DOM becomes0×0 but no resized-size cache is stored, because the consumer's `css.width || css.height` gate is false (`axQuery.std.js:729–734`). Native `size()` and bounds still report the declaration200×100. With string"0" width and string"60" height, resized cache stores0×60. These four cases distinguish conversion from cache truthiness.

The table fixture is not resized and has no normal OnResize call. textBox, inlineFrame and dynamicPanel type fixtures do resize their outer DIV. A display:none ordinary owner also runs the unequal changing-size combination and records the same final size cache. These are specific routing controls, not a full hidden/disabled/contained target matrix.

Remaining gaps: native Layer/group resizing and recursion; percentage/fixed panels and actual fit-parent mutations; special `thisItem` and widgetsBelow/widgetsRight actions; source expression/case interpreter; generated DOM structures and SVG/image/form internals; real repeater row/target resolution; interruption by adaptive changes, row deletion, DOM replacement, cancellation or navigation during combined size animations. Prior Rotate-only lifecycle findings cannot automatically fill these combined-motion gaps. No vendor GUI or DLL execution was performed.

## Preserved execution history

- `runtime-transform-browser-first-probes.json`:43/43 initial observation cases. Its evolving script revision was not separately copied; its recorded hash is retained. Nonfinite JSON null limitation noted above.
- `runtime-transform-browser-expanded-probes.json`:72/74. Two red assertions incorrectly expected numeric0 to behave as string"0". The exact script revision is retained as `runtime-transform-browser-expanded-probe.mjs`; neither failure was hidden or reclassified as a product bug.
- `runtime-transform-browser-closure-probes.json`:fatal harness JSON-cycle serialization error, before results could be returned. The exact script revision is retained as `runtime-transform-browser-closure-failed-probe.mjs`. The recorder now replaces the known `eventInfo` back-reference with a label; source behavior is unchanged.
- `runtime-transform-browser-final-probes.json` and `runtime-transform-browser-confirmation-probes.json`:each88/88, same frozen probe hash,85 ordinary completed cases plus3 bounded source-defect cases. Actual intermediate frames, CSS/cache snapshots, queues, call ordering and errors are preserved.
- `runtime-transform-browser-to-probes.json` and `runtime-transform-browser-to-confirmation-probes.json`:each10/10, same supplemental probe hash and unchanged primary bootstrap. Six Move-To action orders, negative destination, equal duration, empty axis and cached expression are included.

Run the frozen script only with a fresh result filename under this prefix; it refuses to overwrite an existing result. The compact fixtures and manifest are generated without another browser run.
