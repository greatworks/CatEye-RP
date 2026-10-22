# Callback ordering supplement

This supplements the frozen 144-sequence state-dispatch report. **12/12 new sequences** execute the complete original style module, original events.js `raiseSelectedEvents`, `raiseErrorEvents`, `raiseSyntheticEvent`, `_handleEvent`, `_handleCaseGroup`, and original action.js `_dispatchAction`/`wait`. Each control type runs six callback scenarios. The original wait uses a real browser timer with supplied waitTime1; no replacement deferred scheduler is used.

The controlled terminal actions are a marker sink and a setter sink that calls original SetWidgetSelected or SetWidgetEnabled. Event suppression, case-description UI, recording, empty repeater refresh and document/event-info providers are explicit facades. This closes call ordering for the tested ordinary cases, not all original action opcodes or the entire event environment.

## Required ordering

**Selected:** `SetWidgetSelected` checks disabled and computes whether selected events changed; applies SVG when eligible; writes `_selectedWidgets[id]=value`; then invokes `raiseSelectedEvents`. The latter raises `onSelectedChange` first, followed by `onSelect` or `onUnselect`. Synchronous handlers of onSelectedChange finish before onSelect is entered. Both callbacks therefore see the selected dictionary committed and the initiating SVG already applied.

**Error:** `SetWidgetError` checks disabled; computes changed status; writes `_errorWidgets[id]=value`; invokes changed-only `raiseErrorEvents`; only **after that returns** checks `_widgetHasState(ERROR) || _hasAnyErrorClass(id)`, generates state and applies SVG. A synchronous error handler can change style eligibility, selected/disabled state or paint before the outer error action resolves its state.

**Wait:** The original dispatcher immediately calls the action handler at the current index. Its original wait copies event info, schedules continuation with `window.setTimeout`, and returns. The enclosing selected/error call and subsequent synthetic event therefore continue before the wait continuation. The deferred continuation later executes its setter, which adds another genuine SVG application to the ordered history.

| Scenario | Recorded relevant order |
|---|---|
| Selected log + repeated direct same selected | SVG width3 → change marker → select marker → SVG width3; repeated call adds no repeated selected events |
| Selected change handler immediately disables | SVG3 → change-before → nested SVG0 → change-after → select marker |
| Selected change handler waits then disables | SVG3 → select marker → deferred change-before → nested SVG0 → deferred-done |
| Error handler immediately selects | error-before → nested selected SVG6 → error-after → outer error SVG6 |
| Error handler waits then disables | outer error SVG6 → deferred error-before → nested SVG0 → deferred-done |
| Error has no state; its handler selects | error-before → nested selected SVG3 → error-after → outer error SVG3 |

The last row is significant: the nested forced selected apply generates a compound selected/error state and creates the error class. Even though no error style exists, the outer error call's **later** `_hasAnyErrorClass` test succeeds and triggers a second SVG. A gate captured before invoking the callback would produce the wrong result.

All selected width3→disabled width0 sequences retain mark stroke-width attribute3, connecting callback ordering to the independent paint lifetime evidence. The later synthetic onSelect is still dispatched after the synchronous onSelectedChange handler disabled the widget: the retained disabled synthetic-event blacklist covers onLongClick, not onSelect. This does not imply every interaction/action is permitted in every disabled context.

## Implementation connection

Record original-equivalent SVG applications in event order. Do not wait until React commits, and do not collapse intermediate nonzero/zero widths. Selected callbacks belong after the initiating paint state and selected value commit. Error callbacks belong before its final gate/state/paint calculation. Deferred action continuations append later applications; onSelect does not wait for a preceding onSelectedChange Wait action to finish.

The full gate table and initial selected alwaysApply sequence remain in `selection-state-dispatch-evidence.md`; this supplement does not modify them. `selection-state-dispatch-callback-probes.json` contains request traces, full styles passed to original SVG, callback markers, snapshots immediately after the outer call returns, and final snapshots after the real timer completes. It can serve as an independent ordered-event oracle for ledger tests.

## Failure provenance and scope

The first callback harness imported a retained adapter prefix through a data URL while leaving an unused bare Playwright import; Node rejected resolution before browser execution. Its exact script remains. The second removed that unused import but supplied browser `structuredClone` as an unbound object method for deepCopy/eventCopy; Chromium rejected the facade call with Illegal invocation. That script and failure JSON remain. The third wraps those declared facades in arrow functions and passes all12 sequences. Neither failure is an original runtime/product defect. Main 144-sequence evidence remains unchanged.

No product files, native DLL, original GUI, configuration or historical evidence were modified. Group recursion, master/contained/repeater event forwarding, all action opcodes, case conditions and descriptions, cancellation, event suppression variants, and complete browser-generated project behavior remain separate obligations.
