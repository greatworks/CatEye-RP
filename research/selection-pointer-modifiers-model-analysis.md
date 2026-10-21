# Selection pointer modifiers: model integration analysis

Scope: `src/model/selection-pointer-resize.ts` and `tests/selection-pointer-resize.test.ts`. The numerical solver, native evidence, prior-stage reports and host implementation are not edited by this task.

## API

The existing per-frame request remains `{delta:{x,y}, modifiers?:{shift?:boolean,control?:boolean,alt?:boolean}}`. Delta is cumulative from the initial gesture geometry; the modifiers belong to this frame. Neither key state nor aspect mode is saved in the document or permanently captured at gesture start. `prepareSelectionPointerResize` and its returned original/state shape are unchanged.

The planner still returns all target states and complete ordered incremental layout effects atomically. Original geometry and common selection frame remain fixed. Live TextPanel, raw/effective AutoFit and hot-zone state remain persistent between frames. Modifier changes must not reset that state or replace the old frame with current geometry.

## Established source and intended mapping

The earlier frozen `selection-pointer-evidence.md` proves the CbNX aspect-boolean gate and includes 12 complete true-boolean sessions. It deliberately did not call that injected boolean a verified live keyboard event. New `selection-pointer-modifiers-key-enum.json` identifies AxKeys Shift=65536, Control=131072, Alt=262144; the feature researcher traced hInw through the live key provider, BJG9 and QJGS's Shift mask. Keyboard and upstream delta processing are being frozen in separate new evidence.

The model maps Shift to the established aspect request. The new `selection-pointer-modifiers-probes.json` executes original hInw plus BJG9/QJGS, rather than injecting only the downstream CbNX boolean. CbNX recomputes its aspect flag for every call and requires the handle rotated by 90 degrees to be visible and not be a fit hot zone. One ordinary SelectionButton exposes only Left/Right, so its orthogonal handle is unavailable and Shift leaves its obN4 geometry behavior unchanged. A multiple selection exposes all eight handles, allowing the aspect branch. Locked roots participate in the selection frame but are skipped for writes; an all-locked input remains a model no-write result, while visible handle admission belongs to the host.

For multiple roots, only the existing solver's `preserveAspect` argument changes. Its parent is the original common selection rectangle. It must not use each widget's aspect ratio independently. Orientation remains the source-proven 3 and the common CbNX clamp still precedes projection. Existing solver code is reused unchanged.

JbNd runs before this solver and continues to receive the original handle freedom. Aspect internally using both axes must not turn a vertical handle into a horizontal AutoFit mutation. Thus Shift+Top/Bottom can change the requested width while retaining AFW; subsequent Selection layout may derive the final width from text. Likewise, Size correction may alter the aspect-projected height, but final requested Location still follows Size. Re-anchoring the final text-corrected rectangle would be incorrect.

Ctrl/Alt are not reinterpreted as aspect, centre-anchor, ignore-pins or override-locked flags. Their upstream delta/start behavior is still under investigation. Current implementation rejects those requests atomically, including combinations with Shift. This is an explicit partial capability, not a claim that native Ctrl/Alt resize is unsupported.

## Red-first implementation

Before editing, exact source and test bytes were copied to `.build/selection-pointer-modifiers-model-before/`; the source was `d502dfd682dcc1baa4197e7d8ed80722a28682a441df665bb3ecd23743de6869` and the test was `faac5e11b999c071f98838f599a83879211f1ce7cea5f9f419f0853210025ee4`.

The existing source comparisons were extended to include the frozen 12 true-aspect sessions. `.build/selection-pointer-modifiers-model-red-first.json` records 42 passes and 12 genuine failures: the model rejected every modifier request before reaching source-proven layout behavior. This run does not invent new native outputs.

The minimal Shift implementation accepts Shift on the single branch, passes its per-frame value to the multiple-root solver, and retains explicit Control/Alt rejection. The first green report records 56 passes, including the 12 prior red cases and additional Control/Alt combination rejection checks. Exact state/panel/requested-geometry and ordered layout-effect comparisons remain intact; only the previously documented multi-widget diagnostic measurement-index difference is normalized.

The final dedicated suite has **88 passing tests**. In addition to the retained source comparisons, it consumes the new hInw oracle's **31 admitted scenarios / 91 frames**. Source cases containing Control/Alt masks are deliberately not admitted: accepting those masks at downstream hInw does not close upstream delta/start behavior. The admitted cases include false/true/false at identical delta for all eight multi handles with both AFW states, single horizontal gates, mixed locked membership and all-locked no-write inputs. The shared 530×20 frame with Right+106+Shift requests and finally locates its two controls at `(100,98,288,20)` and `(520,98,216,20)`; text correction retains height 20 rather than replacing Location from that actual height.

A further failure/retry test changes Shift after an accepted prior frame and makes the second target's measurement throw. No partial results/state escape, the prior live state remains unchanged, and retry uses that same state successfully. Ctrl, Alt and their Shift combination continue to reject without mutating state.

Focused validation is **374/374**: 88 pointer + 194 layout geometry + 62 property transactions + 21 persistence + 9 async session. `npx tsc --noEmit` passed. No full repository test suite, browser, package or original DLL/GUI was run by this model task. Exact files, commands, prior byte snapshots and SHA-256 values are bound in `selection-pointer-modifiers-model-implementation.json`.

## Remaining integration risks

- The source comparison verifies per-frame key changes only when the host calls the planner. It does not prove that real stationary keyboard events cause the browser host to request a new frame.
- The existing current-view persistence regression remains included. The full browser host must still show one gesture Undo/Redo and preserve source content/inactive maps across Shift changes and failures.
- Host key-only refresh, pointer-up key sampling, snapping, zoom, selection changes and async font readiness are separate upstream/lifecycle concerns. A correct pure per-frame API cannot prove those browser behaviors.
- Ctrl/Alt may change the delta before hInw or select another operation at gesture start. No product behavior should be added from the modifier names alone. The old Layer Ctrl+Alt pin path does not establish Selection-root behavior.

No original DLL/GUI is executed by this model task. Browser measurements remain explicit services, not native font parity. Existing unrotated, ordinary-selection, finite model-domain restrictions remain in force.
