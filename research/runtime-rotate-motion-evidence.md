# Axure RP 11 Rotate motion: source-bound contract

This stage investigates the retained **Axure RP 11.0.0.4150** generated runtime. It does not execute the vendor application, invoke managed DLL methods, operate the authenticated GUI, or modify product source. It supplements, and does not overwrite, `rotation-runtime-evidence.*`.

Evidence IDs below are local claim IDs. The extraction evidence remains `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`; package SHA-256 is `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`. Full source paths and SHA-256 values are in the accompanying JSON manifest.

## Method and result

`research/scripts/probe-runtime-rotate-motion.mjs` executes exact, line-bounded retained JavaScript slices, checked against the prior pinned sources. **131 / 131** cases pass: **39 NodeVM cases** and **92 actual headless Edge cases**. Edge `155.0.4283.62` loads the retained complete jQuery 3.7.1 / jQuery UI 1.13.2 file into an isolated local DOM. Network requests are aborted; observed requests and page errors are both zero. No web server or product browser suite is involved.

The browser uses real CSS transforms, computed styles, jQuery timers and Tween execution. Object lookup, generated model data, expression lookup, target resolution, annotation and visibility caches are controlled sinks. Event handlers and parent fit operations are logged; they do not execute a complete generated page. The main browser fixture's `offsetBoundingRect` supplies its known layout center. Separate exact-function VM cases test the real bounds function and its shadow/cache rules. Fixed positioning, RDO/master offsets, nested scrolling, full repeater refresh and page navigation are not reproduced end to end.

The first retained run is `runtime-rotate-motion-first-probes.json`: 76 / 77 passed. The failed harness assertion required `cos(90°) == 0`; the actual matrix contained `1.22465e-16`. The corrected assertion uses `1e-12` tolerance. No target implementation was changed. That first JSON contains its then-script digest, but a separate copy of that earlier harness revision was not retained. The final script and final output are fully hash-bound.

## Contract

### RRM-01 — dispatch, evaluation, direction, values

`action.js:1061–1256` is the authored Rotate path. `rotateWidget` resolves each object path, queues one operation per concrete element, then immediately dispatches the next action. The original resolver (`doc.js:195–207`) excludes an unplaced / limbo script ID before expanding repeater instances. Hidden and disabled are not additional guards inside the Rotate functions. The controlled hidden-element case rotates successfully; it does not replace the original target resolver or prove arbitrary missing-ID behavior.

At the animation's actual queue start, `_addRotate` evaluates `degree` using `parseFloat`, `offsetX/Y` using `Number`, and then negates the degree when `options.clockwise` is false. For example `"22.5suffix"` parses to 22.5. The expression sink in these probes is explicit; arbitrary Axure expression semantics are outside this stage.

`rotateType == "location"` is To; otherwise the runtime follows By. To uses `desired − current`, without a shortest-path adjustment. From 350° to 10° goes through −340°, not +20°. By uses the requested signed delta. Degrees are floating point, not rounded integers.

The proposed action carrier therefore needs: mode By/To, an angle expression, clockwise flag, anchor, independent X/Y offset expressions, easing, duration in milliseconds. Target identity and repeater context remain separate. Original native enum/default serialization is covered by the parallel format investigation, not inferred from this runtime.

### RRM-02 — the angle getter is not a clean modulo operation

`move.js:442–491` first recognizes an inline `rotate(integerdeg)` using an integer-only regular expression. That preserves −90, 720 and other signed/full-turn integers. Fractional inline values fall back to the browser's computed matrix and `atan2`, adjusted into the nonnegative turn. Thus:

- `rotate(720deg)` then By15 produces inline 735°.
- `rotate(720.5deg)` reads approximately 0.5° before By15, producing inline approximately 15.5°.
- From −90.5°, the getter reads approximately 269.5°, so By10 produces approximately 279.5°.
- By360.5 from zero stores a 360.5° visibility cache and inline transform, while the getter reads approximately 0.5°.

Computed matrix decimal serialization introduces small browser-dependent errors. Numeric fixtures record both inline and getter values; they do not assert arbitrary exact transcendental equality. A product that preserves a clean unbounded numeric angle independently of CSS must describe this getter difference explicitly.

### RRM-03 — center and offset geometry

`move.js:338–381` replaces the element transform with a CSS `rotate(...)`, relying on the generated 50% / 50% transform origin. It does not compose an existing scale/translate matrix. Center Rotate has no local widget-type filter.

`action.js:1192–1223` first modifies the offset by half the **unrotated CSS width/height** for anchor strings containing left/right/top/bottom. It then rotates that local offset by the current angle and adds it to `offsetBoundingRect().centerPoint`. `move.circularMove` orbits the element's center around that pivot; eligible types also rotate their own orientation. Math uses ordinary degrees-to-radians trigonometry, with no cardinal snapping.

For an unshadowed fixture `(x,y,width,height)=(100,100,200,100)`:

| Initial angle | Request | Final location | Final orientation |
| --- | --- | --- | --- |
| 0 | By90, center | (100,100) | 90 |
| 0 | By90, top left | (−50,150) | 90 |
| 0 | By90, offset(30,−10) | (120,60) | 90 |
| 90 | By90, offset(30,−10) | (140,120) | 180 |

The off-center orientation whitelist is image, image-map region/hotspot, dynamic panel, vector shape, horizontal line and vertical line. Ineligible children/targets still orbit but retain orientation. A text field at center rotates; the same field around top left orbits without rotating. This is an observed source-path distinction, not a proposed UX improvement.

The **real** `offsetBoundingRect` (`axQuery.std.js:1438–1575`) includes outer shadow unless told otherwise. With the same fixture, shadow `(offsetX=10, offsetY=20, blurRadius=6)` gives center `(208,163)`; `(−10,−20,6)` gives `(192,137)`. Off-center Rotate calls the default bounds method, so its pivot can differ from the layout center even though center Rotate remains CSS-centered. Native fixed/master/layer-coordinate branches exist but are not fully replayed here.

### RRM-04 — Layer recursion is separate from panel rotation

`math.js:88–101` and `action.js:1109–1161` traverse layer descendants deeply, including hidden descendants and nested layers. An empty layer returns without an OnRotate event. The group pivot comes from layer bounds, with the anchor offset added directly. The layer itself uses a `layerDegree` data value; children receive OnRotate, and non-layer descendants orbit with the type whitelist above. A dynamic panel is an eligible ordinary target, not a replacement for the native Layer object.

`_initRotateLayer` writes the **whole** new layer angle before animation, then scales its returned delta by `(end−start)/(length−start)`. This differs from ordinary By slicing. Exact split fixtures demonstrate that By180 split at 40 / 100 returns 72 then 180 and stores layer angle 360; To180 returns 72 then 0 and stores 180. This source quirk must not be generalized to ordinary widgets. A model with only flat `groupId` does not yet express the original layer object and queue identity.

### RRM-05 — queue and batching contract

`action.js:5–126,143–349` maintains queues by concrete element ID and operation type. Rotate uses queue type 5; Move uses 1; Resize uses 4. Animation groups reserve multiple queues and start only when all required heads are ready. Different widgets can animate concurrently. Repeated Rotate actions for the same target wait in order. A subsequent queued expression is re-evaluated when it starts, not when the containing action list first runs.

The event tail (`events.js:394`) flushes pending Move/Resize/Rotate batches. Instant actions can run before that flush when there is no pending same-type batch. Animated actions continue the containing action chain before the animation begins. A Wait creates a new copied event batch (`action.js:354–367`); the full Wait/event dispatcher is static corroboration here, not executed by the harness.

When two or three operation types are present, the original batches overlap them and divide the work into the shortest remaining durations. For Rotate100 + Move40, the slices are Rotate40 with Move, then Rotate60. For Move40 + Resize70 + Rotate100: Resize40 with both, Resize30 with Rotate, then Rotate30. Easing is selected from Move when present, otherwise Resize for a resize-led slice, otherwise Rotate. Each slice starts its easing curve afresh.

For a sliced ordinary Rotate:

- By delta = requested × `(end−start)/length`.
- To delta = `(requested−current) × (end−start)/(length−start)`.

The probes execute the real batching functions with recording sinks for the eventual Move/Resize/Rotate bodies; the byte-exact queue and stop behavior is established, while complete simultaneous resize geometry is not.

### RRM-06 — events, cache, callbacks and fit

`_addRotate` raises OnRotate **before** `_rotateSingle` reads current angle and mutates geometry. A synthetic handler that changes 30° to 60° therefore makes By90 finish at150°, while To90 still finishes at90°. Even a zero delta raises OnRotate. Center zero-delta rotation advances the queue but skips fit and annotation.

For nonzero center Rotate, `move.rotate` writes `visibility.setRotatedAngle(finalAngle)` **before its first animation step**. The CSS transform/getter follows the current frame, while `offsetBoundingRect` may already use the target angle's AABB. The bounds getter uses a truthy test, so a cached zero falls back to authored rotation. These are distinct observable sources, not a single interchangeable rotation field.

Ordinary completion order is: advance Rotate queue → completion callback (`fitParentPanel`) → adjust annotation. Consequently the next queued OnRotate can occur before the preceding fit callback. Off-center rotation starts circular movement before orientation rotation and has separate Move/Rotate completion and fit callbacks; the controlled case records two fits. Circular movement alone does not synthesize OnMove; `_addRotate` adds OnMove only for an accompanying Move action.

`repeater.js:1590–1626` routes parent fitting through layer/RDO cache updates first, then a parent panel and mobile scroll, then fit-to-content repeater item bounds, otherwise page/mobile scroll. Five exact-function VM route cases log those branches; full DOM reflow and recursively changing parent geometry are not exercised.

### RRM-07 — actual easing and timing

The retained dependency contains jQuery3.7.1 plus jQueryUI1.13.2. Its easing catalog has 32 functions: linear, swing and in/out/in-out forms of Quad, Cubic, Quart, Quint, Expo, Sine, Circ, Elastic, Back, Bounce. `none` is an Axure sentinel, not a jQuery easing function.

**Do not substitute a different library's identically named easing.** The shipped UI builds Quad/Cubic/Quart/Quint/**Expo** as powers2/3/4/5/**6**. Its Back inward curve is `p²(3p−2)`. Its Elastic and Bounce also have source-specific formulas. All32 functions were actually called at seven fixed progress positions through retained `$.Tween.run`, in addition to real timed animations. The JSON includes numeric oracle values; for example Expo(.5)=.015625, Back(.5)=−.125 and easeOutElastic(.25)=1.125. Overshoot is permitted.

jQuery calls `step(now)` before writing the animated plain object's `degree` property. The source's `now−rotation.degree` therefore computes a per-frame delta correctly. The timer uses requestAnimationFrame when the document is visible and available, otherwise a13ms timeout; elapsed progress uses Date.now. Real frame counts and exact completion timestamps are environment-dependent and are recorded, not asserted.

`none`, missing easing, or duration≤0 selects the direct ordinary/circular branch. The separate `compoundRotateAround` helper turns such requests into a1ms linear jQuery animation. That timer may already complete during its initial synchronous tick; it is not guaranteed asynchronous.

### RRM-08 — interruption and lifecycle limits

Each center/circular angle animation targets a private plain `{degree:0}` object with `queue:false`. The DOM element is captured separately. In actual Edge:

- `$('#a').stop(true,true)` does not stop the active angle tween.
- Replacing the element's CSS rotation with12° mid-animation is overwritten by later tween frames.
- Detaching the node does not stop its retained tween or completion callbacks.
- Replacing it with a new node of the same ID leaves the old tween writing the old node; when the old operation completes, a queued next action resolves the new node and acts on it.
- Direct public query rotations called concurrently are not the authored action queue; a longer old tween can overwrite a shorter later tween's endpoint.

Static corroboration: adaptive view reset clears inline transform (`adaptive.js:69–87`) and the geometry caches (`137/145`); repeater removal removes nodes and clears geometry caches (`repeater.js:1070–1078`). Neither retained path shown here cancels the private Rotate object. Searches in the retained Axure scripts find no Rotate queue cancellation call. These facts do **not** prove a complete original page's navigation/row/adaptive race. Whole-document navigation destroys its JavaScript realm naturally; an independent single-page runtime needs an explicit documented lifecycle policy. Do not present deliberate cancellation-on-dispose or per-row invalidation as observed native same-ID behavior.

### RRM-09 — mode-specific quirks and excluded helper

The Resize-led coalesced path parses degree at `action.js:1360/1463` but does not apply `clockwise=false`. Two actual-browser, exact `_addResize` cases with an unchanged200×100 size and By90 produce+90 for both clockwise values. The size provider is a supplied sink; the missing sign branch and ensuing real Rotate behavior are source-executed.

`move.compoundRotateAround` composes the existing linear matrix and orbits its translated center; its1ms test retains scale2×3 and produces a90° matrix. A search of the retained runtime finds its definition but no callsite. `axQuery.std.js:561` explicitly says its rotate method no longer handles compound vectors. This helper is documented independently and must not be used as evidence that ordinary authored Rotate preserves an existing scale/translate.

Public multi-ID query `rotate` also closes over a function-scoped `elementId`; two animated targets cause both fit callbacks to use the last ID. The authored handler resolves and calls individual IDs, so this public-query quirk is not generalized to authored multi-target actions.

## Implementation acceptance and remaining gaps

Use the source-bound fixture JSON for By/To, clockwise, all32 easing functions, pivots, getter/full-turn distinctions, deferred evaluation, queue order and zero-delta behavior. Test animation progress as well as its final angle, and test a second queued expression changed while the first runs. Keep separate tests for ordinary center, offset motion and native layers; do not use panels as groups.

Complete target expansion, limbo/contained selection, real authored event reentrancy, fixed-position/panel-percent behavior, outer-shadow-aware orbit in a full generated page, complete Resize+Rotate changing-size geometry, full lifecycle races and annotation placement remain outside this bounded harness. Native group representation is a model question, not established by flat product grouping. Invalid expression errors and transaction rollback are independent product policy; this source does not supply a transaction rollback contract. There is no vendor GUI comparison or claim of full generated-page pixel parity.
