# Selection pointer input: model boundary and integration plan

This is the pre-implementation review for a new `src/model/selection-pointer-input.ts` and dedicated tests. It does not replace the numerical resize planner or claim full native snapping. Current source hashes are recorded in the companion JSON. No old source, evidence or fixture is modified by this review.

## Existing product input path

`App.selectionPointerRequest` converts client displacement from pointer-down using the gesture's captured zoom. When the gesture's captured Snap setting is true, it independently applies `Math.round(delta/8)*8` to each axis, then passes the current Shift/Ctrl/Alt tuple to the async session. This is displacement quantization; it is not a proof of native edge/candidate grid snapping. An off-grid initial edge and a negative half-grid displacement can distinguish the two.

The session copies every request and retains order while fonts prepare. The pure resize planner uses initial owner/common geometry and current text/fit state. A new input adapter must run once per physical pointer frame from the captured input snapshot, before the result is queued. It must not resnap queued values at replay time, read later key state, mutate a prior request, or use a newly text-corrected owner as the input origin.

Pointer-up computes one last full request and compares it with the prior request, including modifiers. That deduplication must remain after input projection. A zero-movement click currently does not run layout just because a modifier was held. Key-only dispatch remains an explicit source/host boundary from the prior stage.

## Source contract already known, not yet a complete algorithm

The frozen `selection-pointer-modifiers-evidence.md` identifies native jF4A's active-resize sequence: test the platform bypass key and snap settings; construct the xFY0 candidate; call iFYq/SnapRectW; add correction to the current point; subtract the original start point; then call hInw. It also binds the Shift four-corner correction adjustment. This is not equivalent to rounding accumulated delta first.

The new research has identified the concrete NIoi override returning AxKeys.Alt (262144). The platform factory binding and ordinary resize start/controller checks are being verified by the evidence owner. This should become an explicit Alt snap-bypass rule only when that complete bounded chain is confirmed. hInw independently reads Shift; consuming Alt must never erase Shift. Ctrl may also have an upstream/start role and cannot be declared irrelevant from its lack of a bit test in the downstream solver.

The format researcher is interpreting xFY0 and the full grid-only iFYq branch. Exact rounding, candidate edge selection, grid origin/spacing, near thresholds and Shift adjustments must come from those outputs. No grid formula is invented here. Guides and object candidates are a separate unimplemented domain; the grid-only API must identify that domain rather than silently pretending those settings were evaluated.

## Proposed pure API, pending source parameter closure

The adapter should accept explicit same-diagram-unit points: original pointer start and current pointer point, initial selection/controller geometry, handle/freedom, current modifier booleans and explicit grid settings. The host remains responsible for converting browser client coordinates using its captured zoom and canvas scope. There is no implicit DPI, global document or browser realm in the model.

Proposed function: `planSelectionPointerInput(input)` returning a discriminated success/failure. Success includes raw displacement, processed displacement, a downstream layout modifier tuple, and a read-only trace containing the original modifiers, candidate rectangle, correction and `off | grid | bypassed` decision. Failure returns no usable request. Final field names for the candidate geometry, grid size/origin and controller flags await source closure.

The existing resize planner's modifier guard remains intact during research. If the source proves Alt is fully consumed by this input layer in the admitted ordinary resize branch, the adapter can return a layout tuple with Alt cleared and Shift retained, while preserving raw modifiers in diagnostics. That avoids opening an unsafe direct bypass in the numerical planner. Any wider Ctrl/Alt change must be coordinated with the parent and tested across input plus layout together.

Product grid spacing 8 is a host setting, explicitly supplied to the adapter. It is not identified as the original application's default. Do not automatically hardcode source zoom/tolerance/origin from that current product setting. The pure result must remain deterministic for the supplied coordinate frame and settings.

## Required verification

- Exact source candidate/correction comparisons for all admitted handles, off-grid initial edges, positive/negative and half-grid points, unequal grid axes if the source supports them, and no-candidate/disabled cases.
- Ordinary single horizontal versus multiple shared geometry, including Shift's four-corner correction and its independent downstream aspect gate.
- Bypass key alone and with Shift, sampled separately each frame; retain Ctrl rejection until its input/start contract is closed.
- Input-to-resize composition: compare final owner, live panel/AFW and ordered Size→Location effects with original source composition. A correct correction number alone does not prove a correctly composed gesture.
- Repeated identical physical points with modifier transitions; queued snapshots must preserve their own settings/keys, with no double snapping on pointer-up or replay.
- Nonfinite points, invalid grid parameters and unsupported domains reject atomically. Product safety limits must be labeled as policy rather than native constraints.
- Real host checks at zoom 0.5/1/2, delayed fonts, final-up modifier changes, cancellation and one Undo remain parent-owned browser work.

The implementation should be a small self-contained numerical model, without modifying old solver/layout/native reports. Unknown guides/object search, key-only dispatch, rotated/general-transform inputs and platform DPI behavior remain explicit gaps.
