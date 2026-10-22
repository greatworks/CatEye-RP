# Selection-control state dispatch and initial SVG mutation

Target: retained Axure RP 11.0.0.4150 prototype runtime. This work executes the **complete original style.js module**, exact public selected/enabled/error functions from axQuery.std.js, and original initialization/click/pointer-binding blocks from events.js in Edge. Added trace wrappers record arguments and forward to the original functions. Original state generation, style resolution, class mutation and `_applySvg` execute unchanged. This is a controlled source-runtime probe, not original GUI, DLL execution, or a complete generated page.

The final extended result is **144/144 sequences, 520 steps, 220 actual `_applySvg` calls**. `selection-state-dispatch-probes-extended.json` records every request, final computed style passed to SVG, state classes, native checked/disabled properties, and radio/checkbox mark paint. Its SHA-256 is `a06b0dcbbc8964efb9b13fedff3dad0dae0042970cb3fb2920f097eae2245ce7`. The earlier 134-sequence result is preserved; it is a subset rerun and is not added to the final count.

## Proven gate contract for an ordinary checkbox or radio

| Entry | Gate before SVG | Repeated same value |
|---|---|---|
| Direct SetWidgetSelected(id,value,alwaysApply) | Return if disabled. Otherwise apply if `alwaysApply || _widgetHasState(selected)` | Can apply every time. Only selected-event emission checks whether the value changed. |
| Public query.selected(value) | Read native input.checked; only if it differs, write checked and call SetWidgetSelected(id,value,true) | Same checked value produces no style call/SVG. |
| Native checkbox click binding | SetWidgetSelected(id,!IsWidgetSelected(id),true) | Each click requests a forced apply, unless style entry rejects disabled. Toggle source is selected state, not checked. |
| Native radio click binding | Return if disabled; deselect matching group members when applicable, then SetWidgetSelected(id,true,true) | An already-selected ungrouped radio click still applies. Group iteration is retained statically but excluded from this matrix. |
| SetWidgetEnabled(id,value) | Set disabled dictionary first; return when no disabled style. On false, apply disabled; on true call SetWidgetSelected(id,IsWidgetSelected(id),true) | No equality deduplication. Existing disabled style gives an apply for each repeated disable/enable. |
| SetWidgetHover | Require mouseOver state; no initial disabled guard | Direct repeated calls apply. State generation can resolve to disabled. |
| SetWidgetMouseDown | Return if disabled or no mouseDown state | Direct repeated calls apply when eligible. Default third argument causes forceMouseOver=true. |
| SetWidgetFocused | Return if disabled or no focused state | Direct repeated calls apply when eligible. |
| SetWidgetError | Return if disabled. Store error and emit changed-only event; apply if error state or existing error class | Direct repeated calls apply when eligible. Without style/class, dictionary still changes. |

`_widgetHasState` is not a comparison of source/current style values:

- A nonempty base `style.stateStyles[state]` qualifies. A base empty `{}` does **not**.
- A truthy adaptive `adaptiveStyles[view].stateStyles[state]` qualifies, including an empty `{}`. The tested v1 empty-state cases all entered SVG.
- An image override can qualify; that source branch is retained, but image override execution is outside this matrix.
- The call decides eligibility separately from state resolution. A qualifying mouseOver style while disabled still calls `_applySvg` with the **disabled** state and its computed style.

For normal restore, `_computeFullStyle` merges document defaults, custom/base widget style, current panel style, and actual state/adaptive overrides. The tested cleared states pass the normal **full style**, including base borderWidth1 and borderFill. Missing properties in a state object therefore do not imply the corresponding argument is missing in the full style consumed by SVG. Earlier lower-level paint tests that passed partial `_applySvg` objects remain valid lower-level observations, not a substitute for this caller contract.

## Initialization: selected may already force a runtime paint

`style.initialize()` itself is empty. Object initialization in events.js performs the following relevant order for ordinary non-repeater objects:

1. Lines805–838: if authored error, public error(true); if authored selected and not skipped by a selection group, public selected(true); then if authored disabled, public enabled(false).
2. Lines1214–1251: install checkbox/radio click binding. First read `selected = style.IsWidgetSelected(elementId)`. **If selected is true, call `SetWidgetSelected(elementId, selected, true)`**. The third argument is explicitly alwaysApply=true.

`IsWidgetSelected` reads the selected dictionary or the owner's selected class. It does not read input.checked. Public selected reads checked and uses its independent gate. The initialization matrix varies authored selected, checked, selected class and authored disabled independently to establish order instead of assuming they are synchronized.

For the normal selected-radio carrier (`authoredSelected=true`, native `checked=true`, owner class selected, enabled): the early public selected call does nothing because checked already matches. The later click-binding setup emits exactly one request `SetWidgetSelected('u',true,true)`, then `_applyImageAndTextJson('u','selected')`, then `_applySvg` with base normal colors/width even if stateStyles is empty. The radio dot starts fill-only but after this initialization has generic stroke color and width1. **An initially selected enabled control must therefore not be assumed to remain on the fill-only asset path.**

If authored selected is true while checked is false, early public selected changes checked and forces an apply; binding setup can force a second apply if still enabled. If disabled was established by the earlier enabled(false) call, the later forced selected request reaches the style entry but is rejected there. A disabled state style can itself have applied a disabled SVG in the earlier step. These are distinguishable trace events, not one merged initialization flag.

All initial no-style/base-width combinations are retained in the 64 initialization sequences. Constructed mismatched selected/checked/class carriers expose the gates; their existence does not assert that Axure normally emits every mismatch.

## Event order, native checked, and batching

Public enabled does not write input.disabled for checkbox/radio: axQuery.std.js returns before its generic property setter. In the supplied fixtures, enabled(false) sets the original style dictionary while nativeDisabled stays false. Real disabled pointer/accessibility behavior may include CSS and other event routing not exercised here.

One original sequence demonstrates why checked and selected cannot share a single inferred cache:

1. Disable a control with no disabled state style: no SVG.
2. Public selected(true): first writes checked=true, then calls SetWidgetSelected(...,true); the disabled entry guard returns. Selected remains false.
3. Repeating public selected(true) does not call style because checked is already true.
4. Enable with no disabled style: no SVG. Another public selected(true) still does nothing.
5. Public selected(false) changes checked and forces one normal SVG.

These are actual retained function calls. The report does not infer a universal policy for programmatically clicking disabled native elements.

The same-turn paint sequence is also explicit: a synchronous SetWidgetSelected(true,true) using selected borderWidth3, immediately followed by SetWidgetEnabled(false) using disabled borderWidth0, produces two `_applySvg` calls with widths `[3,0]`. After both calls, mark stroke-width attribute is **3**, since the second zero fails the original truthiness mutation gate. Both operations occurred inside one browser evaluation without a rendering wait. Collapsing them into a final style comparison would lose authoritative history.

Keep the ordered eligibility/application events distinct from framework render frequency. The product can consume the event sequence into a persistent paint state and render the resulting state, but should not reconstruct history from final `source === current`, final colors, or a single render callback.

## Pointer and state precedence

The exact `_attachIxStyleEvents` block was also exercised with a plain top-level control and no dynamic-panel owner. `HasIxStyles` permits attaching handlers whenever a stateStyles object exists, even if the requested individual state is empty. The later style gate still decides whether SVG runs.

- Repeated actual-bound mouseenter is deduplicated using mouseOverIds/mouseOverObjectId before calling SetWidgetHover. Direct SetWidgetHover has no such deduplication.
- Original mousedown sets mouseDownObjectId before SetWidgetMouseDown; mouseup clears it first and calls SetWidgetMouseDown(false) only if ObjHasMouseDown.
- The tested width-state pointer sequence enter, repeated enter, down, up, leave has SVG counts `[1,0,1,1,1]`. None/empty base states produce no SVG.
- State generation builds hint/error/selected, then disabled takes precedence, then focused, then down/over. Style merge order is normal, mouseOver, mouseDown, focused, selected, error, hint, disabled. Thus combined-state precedence must not be inferred solely from the trigger name.

A selected→error→focused→hover→disabled→enable→clear-error→clear-selected sequence passes SVG widths `[3,6,6,6,0,6,3,1]` under the distinct supplied width styles, confirming both combined-state resolution and restoration.

## Source binding and remaining boundaries

`selection-state-dispatch-manifest.json` binds all original source bytes, exact executable probe scripts, result files and this report. `style.js` SHA remains `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`. The probe records source line ranges and the full style module boundary; instrumentation appends forwarding wrappers without changing gate bodies or replacing the style resolver.

Declared fixtures/facades are document/style data, flat object/type/path lookup, a single adaptive v1 chain, no current dynamic panel, no text panel, no image overrides, top-level owner, ordinary SVG, and captured selection/error event notifications. The native input, jQuery event dispatch, computed SVG paint and original style implementation are real browser operations.

Not covered: full `_initializeObjectEvents` scheduling and unrelated listeners, group mutual exclusion, contained-object parent redirection, master chains, repeater reset/preEval/persist branches, images, applied-style actions, full adaptive switching, document mouseup cleanup and dynamic-panel delegated mouse handling, transitions/text measurement, complete generated CSS, original renderer rasterization and GUI/pixel identity. Their retained branches are not silently treated as proven by this matrix. The initial report's partial source ranges are superseded by the extended result's complete public-function ranges; neither result contains a failed assertion.
