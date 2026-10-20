# Runtime text AutoFit: downstream geometry and event order

Target: retained Axure RP 11.0.0.4150 scripts. This stage reuses the already-closed native flag bridge and investigates only `expr.js:523–544` → public query `resize` → direct `MoveWidget`. It does not alter product files, earlier reports, or source flags. **18/18 exact-function VM probes pass**; DOM, measurement, handler bodies, queue and selected parent-layout dependencies are declared stubs. There was no vendor GUI, full application, font measurement, or browser pixel execution.

## Implementable ordinary-shape sequence

The AutoFit caller computes width/height and their deltas first. If either exact delta is nonzero, it calls `query.resize(css,{})`. That call follows the immediate branch because `resizeInfo.easing` is absent (`axQuery.std.js:736–758`). For an ordinary resizable owner the resulting order is:

1. Record its old unrotated bounding rectangle as the resizing rectangle (585–586).
2. Test `IsResizable`. For an accepted type, compute child graphic changes. Cache the **requested** new dimensions if `width || height` is truthy (730–733).
3. Write graphic-child CSS/transforms, then owner CSS (737–757).
4. Call `fitParentPanel(owner)` (657), then completion/queue handling. Here AutoFit omitted `axShouldFire`, `moves`, and completion callback, so this completion helper does not fire the resize animation queue.
5. Adjust annotation, raise synthetic owner `onResize`, then clear all resizing rectangles (660–662).
6. Return to `autofitWidget`. Compute alignment offsets from the previously measured deltas and effective style. If nonzero, call **direct** `MoveWidget(..., to=false, callback=null, shouldFire=true)`.
7. MoveWidget records movement, writes relative left/top CSS immediately, fires the **move** queue, then raises synthetic `onMove` (`move.js:84–108,120–165`).
8. Return to AutoFit, remove any hidden-measurement clone, then register the owner for subsequent AutoFit updates (`expr.js:547–550`).

This is **not one atomic final-box update**. Parent fit and synchronous `onResize` processing can see the new dimensions at the old position. The old resizing rectangle is still available during `onResize`, and is cleared before the ordinary later `onMove`. Event handlers can change geometry before AutoFit's alignment movement. One probe makes the resize handler set position100,200: the original center/middle correction−15,−7.5 then results in85,192.5, rather than replacing that handler change with a precomputed final position.

`events.js:1701–1711` invokes the handler synchronously when an interaction exists; the disabled-event blacklist only contains `onLongClick` (1714–1716). The ordinary no-menu handler path processes case groups then flushes resize/move actions before returning (281–404; dispatch at583). Wait, case-selection menus, suppression, or handler-created asynchronous work can change when individual actions run. The probes use synchronous handler stubs and do not claim all such cases complete before alignment. Synthetic events do not take the ordinary hidden-widget suppression branch (`324` tests `!synthetic`).

## Dimensions: logical cache and DOM must stay distinct

The resize function contains **no minimum1 clamp, integer rounding, finite-number check or negative-value rejection** for requested dimensions. `visibility.setResizedSize` directly stores `{width,height}` (`visibility.js:1392–1394`). Query size defaults to ignoring rotation and outer shadow (`axQuery.std.js:1628–1630`); the underlying size lookup prefers this logical cache (1512–1513).

| Probe | Proven logical/CSS-assignment result |
| --- | --- |
|100×20 →130.125×35.375|Cache preserves130.125×35.375; right/bottom alignment shifts x−30.125,y−15.375 without rounding.|
|100×20 →0×35|Cache becomes0×35, because the other axis is truthy.|
|100×20 →0×0|Owner CSS is assigned0×0, but the `width || height` guard skips the cache update. Query size remains100×20, while AutoFit registration records0×0.|
|Prior cache80×15 →0×0|The prior80×15 cache survives, not just the generated initial size.|
|Direct query resize to−2.25×−3.5|Negative requests pass to both logical cache and CSS assignment unchanged at this JavaScript layer.|
|Measured size unchanged|AutoFit skips resize and move but still registers the instance.|

The negative request is a synthetic boundary probe, not evidence that supported native padding/text measurement normally produces it. The CSS stub records writes; **browser rejection/clamping, border minimums, DPR and 1/64 layout quantization were not measured here**. Earlier repeater box/quantization studies prove that requested/logical values and browser-used boxes can differ, but their exact arithmetic cannot be transplanted to ordinary shape resizing. A renderer can clamp a drawing box where necessary without silently rewriting the demonstrated logical cache semantics.

Graphic children have additional behavior: nontext children receive new dimensions; different-sized image/background graphics retain scaled offsets (666–703). An `svg.img` child instead gets `transform-origin:top left` and newScale=`newDimension / oldDimension * oldScale` (706–719,741–742). There is no zero-old-axis division guard: a controlled old width0→130 case assigns `Scale(Infinity,1.75)`. Its actual invalid-CSS paint is **not** tested and should not be claimed supported by a clean normalized-vector implementation.

## Rotation and alignment

Resize does not change the owner's CSS rotation or supply a new origin. Query size ignores rotation. Ordinary direct MoveWidget applies alignment offsets to the owner's containing-coordinate left/top; it does not inverse-rotate those deltas or rotate them into local axes. The90° probe retains `rotate(90deg)` and applies the same right/bottom x−30,y−15 as an unrotated owner.

Combined with the separately proven ordinary50%/50% CSS origin: left/top alignment changes the center by half the size delta; center/middle alignment cancels that change and preserves the center; right/bottom preserves the unrotated layout right/bottom. This is not preservation of a selected rotated visual corner. General transforms, custom origins, fixed panels, layer wrappers and parent coordinate transformations are outside the simple-owner probe.

## Parent fit, hidden objects and repeater rows

The original fit dispatcher at `repeater.js:1590–1626` runs during resize completion, **before alignment movement**. It first considers a layer/reference container, then a panel, then a repeater. A fixed-size parent panel stops traversal; a fit panel only propagates changed current-state geometry. Its inactive state may update internally but does not enlarge the current panel (`2022–2078`). These are reused prior fit findings, not newly generalized container behavior.

For a fit repeater, the source uses the target instance's item ID and its container's `childrenBoundingRect().right/bottom`, then `setItemSize`. Hidden/limbo children and certain fixed panels are excluded; rotated AABBs participate, as already established by the frozen rotation/fit evidence. The explicit row-size/push/event implementation remains the prior repeater subsystem.

**There is no second built-in parent fit after AutoFit's direct alignment move.** The public query move wrapper normally supplies such a completion callback (`axQuery.std.js:457–482`); this AutoFit call passes null. With the sole child at10,20 growing100×20→130×35, the original fit callback receives140×55. Right/bottom alignment subsequently moves the child to−20,5; this direct sequence does not refit the row to the final110×40. A user's onMove action or some other later layout operation may independently refit it. A reconstruction that always derives parent fit from the latest child state will differ from this native cached timing.

Hidden measurement clones affect only measurement; resize/move still target the real owner. The original calls have no hidden-owner gate. The controlled hidden-owner case executes resize and both synthetic events while row-fit aggregation excludes the hidden owner; clone cleanup follows the move/event sequence. The probe's visible-child bounds and clone itself are stubs, so complex inherited style or hidden ancestor CSS correctness remains unproved.

## Supported type versus flag-emission boundary

`RESIZABLE_TYPES` (`axQuery.std.js:76–80`) includes vector shapes and images, but not table cells, checkboxes/radios, tree nodes or the repeater itself. This is independent of native TextRectObject flag generation. Unsupported resize types take the early continue after setting the old resizing rectangle (585–592), without owner resize, fit or `onResize`.

AutoFit does not inspect whether resize succeeded. It can still apply alignment movement and register the measured size. The table-cell probe therefore preserves its100×20 dimensions but moves by the requested width delta, fires onMove, and leaves the old resizing-rectangle record uncleared by this call. This is evidence to **retain a type boundary**, not an invitation to treat every cell as an independently resizable shape.

## Recommended first implementation boundary

Implement the proven ordinary VectorShape path with source-derived flags, safe structured text and actual host measurement. Preserve separate requested/CSS and logical geometry where this native path distinguishes them; expose resize-before-move ordering to synchronous events; use instance-local registrations and original parent-fit timing. Do not silently normalize double-zero behavior or coalesce the two events into one transaction.

Keep these explicitly pending unless separately implemented and verified: zero-old-size SVG scaling/invalid CSS paint; negative/nonfinite requests beyond an admitted source subset; nonresizable TextRectObject types; general transform/fixed/layer geometry; full nested parent/repeater event recursion, menus and Wait; hidden clone font/cascade fidelity. No original GUI parity is claimed. The probe is reproducible with `node research/runtime-text-autofit-geometry-probe.mjs`; evidence and hashes are in the matching JSON/manifest.
