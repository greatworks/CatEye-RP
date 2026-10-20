# Error and Hint implementation

This stage implements the bounded behaviors evidenced by [38 original-function probes](error-hint-evidence.md) and [native file recovery](rp-error-hint-evidence.md). It does not establish full Axure parity or original GUI comparison. The original GUI bridge remained unavailable; it was not retried with unchanged conditions.

## Model and authoring

Optional `error`, `errorStyle`, `hintText`, `hintHideOn` and `hintStyle` preserve old files. Hint fields are restricted to text inputs/areas, remain literal during duplication, and are never written to incompatible widgets in a mixed selection. Removing hint configuration removes its three fields together. All effects reuse the existing property-level override, undo and transient canvas editor. Input hints default to typing mode when omitted. The new form hint color fallback is #999999, from a named Default Form Hint cache; explicit imported overrides such as #bdbdbd and #d7d7d7 retain their values.

Error set/removed are widget events. Set error state accepts literal true/false/toggle or one complete bounded expression. Expression primitives remain typed until Error coercion, so numeric 0 is false while string '0' and 'FALSE' are true. Arbitrary JavaScript objects and the complete native expression system are unsupported.

Known geometry/count and Item metadata providers retain their numeric/boolean meaning for Error expressions; global variables, row cells and widget text remain strings. Form initial text expressions are resolved before logical text and raw-cache comparisons; user input and Set Text results retain literal text without a second evaluation. Independent review found and regression-tested both boundaries before the final package.

## Runtime

Preview and exported HTML use the same serialized runtime function. Each row instance has independent error flags, last-painted error state, hint manager state and raw text-change cache. Pointer/focus rules precede Selected → Error → Hint → Disabled. Disabling ignores subsequent Error setters but preserves existing Error. Panel setters propagate one desired value through every state and stop at repeater branches; a disabled panel still allows its enabled children's own setters. Ordinary user-disabled form interaction remains blocked by the browser.

Error writes its flag, dispatches a changed event, then paints the originally requested state. Separate flag and paint preserve the witnessed nested-handler quirk. No-op assignments do not raise another event. Synchronous cycles are limited to 64 levels and 10,000 transitions per event task; these are product limits, not claimed native limits. A failing action segment restores both public runtime data and private hint/error/cache state. Public setters follow the existing runtime API contract rather than introducing a separate transaction boundary.

Hints use input.value plus separate logical empty text, not HTML placeholder. Focus effects and user Focus/Blur actions run before the hint handler. Typing mode clears on keydown, beforeinput or paste; valid empty input restores it. Focus mode clears on focus and restores on blur. Password controls show nonempty hints as text and restore the password type when the hint clears. Set Text can reactivate a hint while focused, retains the native raw-value equality/whole-target-loop early return, and checks the raw text-change cache after updating the hint. Keyboard/input change events also compare raw values; logical text may remain empty through such events.

Initial authored Error is rendered without synthesizing an initial Error Set event. The original compiler's initial class and corresponding startup event remain unknown. Existing page/row lifecycle and navigation/reset isolation are retained. Saved design bytes are independent of these temporary runtime states.

## Native recovery and validation boundary

The new `errorHintRecovery` protocol coexists with the prior four-state protocol. Source identities and inherited named colors require unambiguous evidence. Native event recovery is atomic, including complete panel descendants; an unsupported condition/action rejects its entire event. Source files are read-only. All 144 witnessed native SetErrorState calls remain inside otherwise unsupported real events, so no complete real Error event is claimed recovered. Synthetic modifications of real decoded objects exercise the new action and event decoder.

Validation includes model/import/parser tests, module and serialized runtime tests, authoring tests, actual browser keyboard/clear/blur/password/row behavior, and packaged desktop save/reopen/export. Synthetic beforeinput/paste events verify the pre-edit hooks; they are not a claim of OS clipboard or IME parity. Original-function probes use small synthetic adapters, not the full original browser player. Unusual Hint background/border pixels, mobile/Android behavior, complex adaptive inheritance and complete RP write-back remain unsupported or unverified. Current counts, exact bundle hashes, logs and screenshots are recorded in `error-hint-verification.json` after final verification.
