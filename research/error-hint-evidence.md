# Error and Hint: original runtime evidence

2026-10-13 · Axure RP 11.0.0.4150 · **38 passing isolated original-function probes**. No product code, product tests or build changed. No original GUI or full vendor application launched. The probe executes SHA-pinned original JavaScript function slices with synthetic data and a small DOM/event adapter; it does not establish generated CSS pixels, native browser input editing, the compiler's initial HTML classes, or every event-dispatch/menu behavior.

- [Probe](scripts/probe-error-hint.mjs): `node research/scripts/probe-error-hint.mjs`.
- [Evidence JSON](error-hint-evidence.json): exact original paths, hashes, one-based source excerpts and every experiment/output.
- [Previous interaction styles report](interaction-styles-evidence.md): precedence, disabled/focus gating and mouse behavior.
- [Independent RP field/default census](rp-error-hint-evidence.json): real stored fields/styles, separate from synthetic runtime inputs.
- REA extraction Evidence `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`; installer SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; native DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

## Official contract and defaults

[Style effects](https://docs.axure.com/axure-rp/reference/style-effects/) and [List of actions](https://docs.axure.com/axure-rp/reference/actions-list/) describe setting Error through an action; its configured Error effect changes appearance. Hint is enabled on text fields/areas by default. [Text fields and text areas](https://docs.axure.com/axure-rp/reference/text-fields-text-areas/) specifies separate hint text and a choice of hiding after focus or typing. Hint uses the field's font and a grey default color; authors can change its Hint effect. Those pages do not specify event ordering, repeated assignments or interactions among effects.

The actual JS runtime treats missing/false `HideHintOnFocused` as typing mode. This is not inferred solely from a property name: the branches at `events.js:871,895` and all three pre-edit handlers at 915–921 are probed. The shipped Default library's Text area stores `HideHintOnFocus=false`, `PlaceholderText=''` (package `9f7d5f6c9ed14312b3112e36a1604eff`, widget `6abb79287fe4442993157dfc369e11a8`; Default.rplib SHA `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`). Four other real text areas also store false. Retained `PlainTextObject` CIL getter 100701333 reads Boolean field `CNpD`; its two constructors do not explicitly assign that field, consistent with zero-initialized false, but that alone would not prove every editor creation path.

The separate RP census currently has 125 inputs, 15 nonempty hints, no `HideHintOnFocus=true` and no initial `Error=true`; this is a sample boundary. It contains an explicit `#bdbdbd` Hint text fill on Prototype Starter / Search, package `68ae2bed587e49b48376490f15b1b086`, widget `cd0ff15f5ea94e349f87cb9f56fc69c0`, style `09c519de43fe4ea8a83a65a37524069f`: PName 6, signed ARGB `-4342339`. Sample SHA `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714`. Its font falls through the underlying field. A default named Form Hint cache resolves to `#999999` in the independent format investigation; see that investigation's final cache records rather than assuming every explicit Hint style is the same grey.

## Error setter, events and reentrancy

`expr.js:253–261` implements SetErrorState over supplied target IDs in order. It recognizes exact `'toggle'`; otherwise it uses `Boolean(value) && value != 'false'`. Thus false, zero, empty string and null are false; strings `'FALSE'` and `'0'` are true. Unlike the form text setter, an unchanged first target does not stop remaining targets.

`style.js:271–285` establishes this sequence:

1. If the target is disabled, return before changing any flag, event or paint.
2. Compute whether the observable prior error differs from the requested value. The getter is **dictionary flag OR any existing error CSS class**.
3. Write the dictionary flag.
4. If changed, synchronously raise exactly one event: `onErrorSet` for true, `onErrorRemoved` for false (`events.js:1695–1699`). There is no Error Changed dispatch here.
5. If there is neither an Error effect nor an existing error class, return. Otherwise compute the state with the requested error value forced, then apply image/text style and update the image style.

Repeated true/false values do not emit their event again, but can still repaint. An absent or empty default Error effect does not stop the flag/event; it stops that setter's paint. An explicit empty adaptive Error object counts as present under `_widgetHasState`, unlike an empty default object (previous report describes this distinction). Existing error classes permit removal/paint even if the effect has become empty.

**Observed reentrant quirk:** `onErrorSet` immediately calls remove error. The nested removal writes false, dispatches Removed and paints normal. The outer setter then paints its original forced true state. Final dictionary flag is false, but the error class and getter remain true. A later hover still includes Error. A further remove emits Removed again because the observable getter was true, then clears the class. The probe verifies the exact event/paint sequence and subsequent hover/getter, not merely a predicted call graph. An implementation with only one Boolean cannot reproduce this distinction.

Error remains combinable with selected, hint and disabled. Disabling an already errored widget does not remove error; attempting to clear while disabled is ignored. Native code has no automatic error clearing on text input in the inspected hint/input handlers; a configured action is needed.

### Targets, containers, rows and initialization

`axQuery.std.js:1145–1178` accepts vector/image/textbox/textarea/listbox/combobox/checkbox/radio. Dynamic panels and layers/RDOs apply to themselves first, then recursively call error on their children. Native button-only and repeater types are absent from this accepted set. A repeater encountered inside a panel therefore stops that recursion branch, rather than receiving an implicit “all row descendants” error action. A disabled container's own setter returns, but the query still proceeds into its enabled children; there is no container-level early return.

The actual `getChildren(false,true)` (`axQuery.js:304–393`) visits the dynamic panel's state containers collectively, not only the active state, and filters unplaced IDs. The probe's child list is synthetic; all-state/limbo behavior is static evidence, not simulated DOM proof. Error dictionaries are keyed by exact element/row IDs. Independent rows are verified. `style.js:2348–2357` clears error/hint/selected/disabled dictionaries on repeater reset; it does not by itself remove old DOM classes, which are handled by the surrounding refresh/rebuild.

Initial ordinary widgets follow `init.temp.js:241` → `event.initialize` → `events.js:1772` → initial object defaults at 809–826. Error is applied at 817 before selected and disabled. This occurs before `init.temp.js:248` invokes the page/widget Loaded traversal. Row initialization at `repeater.js:311` precedes Item Loaded at 353 and descendant Loaded at 356. However **whether initial Error=true dispatches Error Set depends on the initial generated error class**: no class gives an event; an existing class suppresses it. Both inputs are probed. Actual compiler markup for initial Error=true remains unverified, and no such stored input exists in the audited samples. Do not claim unconditional startup Error Set from the setter call alone. This evidence also does not give a complete ordering among every pre-evaluated/reused row and sibling initializer.

## Hint is a distinct runtime mode, not a derived HTML placeholder

`flyout.js:214–256` maintains `{text,password,active}` per exact element ID. `style.js:291–319` maintains a separate “showing Hint style” state. The manager can be active with an empty hint, but the Hint effect is only active when the hint string is nonempty. The original writes the visible hint into **input.value**; `expr.js:586–590` nevertheless returns empty logical text whenever the manager is active (`GetWidgetValueLength` similarly returns zero).

Consequently, `empty && !focused` is insufficient to reproduce Hint. Keep actual input display text, logical authored/action/user text and hint-active state distinct. Hint strings and typed `[[literal]]` are treated as text by these handlers; they are not expression evaluation calls.

| Trigger | Hide after focus | Hide after typing (false/missing native flag) |
|---|---|---|
| Initial empty value | Activate Hint | Activate Hint |
| Initial nonempty value | Keep actual value, inactive | Same |
| Focus while Hint active | Deactivate and clear display text | Leave Hint active and adjust caret |
| Keydown, beforeinput or paste while active | These handlers do not clear Hint | Deactivate and clear before native editing; no key/button/modifier filter |
| Input becomes empty and valid | Do not restore on input | If currently inactive, activate Hint immediately even with focus |
| Blur, empty and valid | Activate Hint | Activate Hint |
| Blur/input empty but invalid browser validity | Do not activate | Do not activate |
| Nonempty blur | Keep current mode/value | Same |

The handlers are exact `events.js:855–933` slices. Validity is supplied by the adapter; numeric/date browser validity was not reproduced. “Typing” includes nonediting keydown such as ArrowLeft: the hint disappears even if no character follows. Active-hint input without a prior keydown (e.g. direct input/autofill-style event) deactivates while retaining a nonempty new DOM value. Input mode clearing at empty/valid has two phases: active → inactive first; an empty subsequent input when inactive can reactivate. These are explicit state transitions, not a continuous recomputation rule.

Hint mode has no disabled guard in the manager or style setter; disabled controls normally cannot receive user focus/input, but an action can update their text/hint. Password fields show their nonempty Hint with native type `text`; leaving hint mode restores `password`. Empty hint does not expose a password as text. The normal non-Android manager path is probed; legacy Android string-splicing and native selection/editing behavior remain outside the probe.

### Set Text and native quirks

`expr.js:289–300` is the exact form text setter:

- If raw DOM value already equals the requested value, or the request is empty while manager-active, return from the **whole multi-target function**. Thus an unchanged first form target can suppress later targets.
- Otherwise assign value, then activate Hint for a falsy/empty new value or deactivate for a nonempty value. There is no focus check. Text-change dispatch is then requested if configured.
- Set Text to `''` after real text therefore activates Hint even while a focus-hide field remains focused.
- Set Text to the displayed hint string while active is treated as raw-value equality and stays logically empty.
- Initial actual text equal to the hint is erased by the native browser-history workaround at `events.js:929–932`; the probe records this quirk separately from ordinary nonempty initialization.

**Focus-hide corner case, verified:** focus → set actual text → Set Text empty → Hint becomes active. Subsequent keydown/beforeinput handlers do not clear in focus mode, and its input handler does nothing. If native editing produces `xHint`, the manager remains active, raw DOM text is `xHint`, and logical GetWidgetText is still empty. Blur sees nonempty raw text and leaves it unchanged; `refreshPlaceholder` overwrites it back to the configured Hint. The probe supplies the browser-edited value explicitly; it does not claim to reproduce native caret position or character insertion placement. This is why focus-mode hint activity cannot be inferred from current display text.

### Event ordering and style scope

`events.js:778–790` registers focus-style handling before user focus interactions; Hint focus handling is registered later at 870. Thus, for a native focus dispatch: focus effect update → configured focus interaction → Hint hide/adjustment. Blur similarly updates focus style and runs user blur before the empty-value Hint restoration. Hint pre-edit/input handlers are registered before the synthetic Text Changed handlers at 1195–1213. `TryFireTextChanged` compares raw input values (1802–1807); hint transitions can therefore affect that native cache. The complete generated browser text-change/selection sequence is not claimed by this adapter, whose Text Changed endpoint only records calls from Set Text.

State composition remains `normal → hover → down → focus → selected → error → hint → disabled`, per property, retaining the prior disabled/focus exclusion rules. In probes, Hint fill supersedes Error/Selected fill, Error-only font weight survives, and Disabled supersedes Hint fill while preserving a Hint-only font size. `SetWidgetPlaceholder` does not just style an HTML `::placeholder`: it computes the complete state overrides, invokes text style application on the input, and applies the combined state classes to the outer widget, `_div` and `_input` elements. `_applyTextStyle` itself only processes text CSS properties; background/border pixel consequences additionally depend on generated stylesheet selectors. No generated CSS/browser screenshot was used to prove arbitrary Hint fill/border rendering in this stage. The model's full partial-style merge is supported at the composition layer; don't present that as a pixel-level proof of all native Hint properties.

## Suggested acceptance cases and implementation boundary

1. Error true/true/false/false: two events total; no configured effect still stores state/events; disabled target ignores setting/removal; selected+error+hint+disabled property fallthrough.
2. Nested Error Set→Error Removed: record flag, effective getter and painted class separately; next hover and second removal match the retained trace. Add a loop guard as a product safety policy, without claiming a native identical limit.
3. Panel target, inactive-state child, disabled child, nested repeater boundary; independent row IDs and row refresh reset. Target resolution outside/inside a repeater should reuse the already proven action-target context rules.
4. Focus/typing mode, keydown without text, paste/beforeinput, valid/invalid empty input, password, Unicode/newline/literal placeholders, clear/restore and focused Set Text empty.
5. Empty Hint and explicit style overrides, initial nonempty actual text, literal equality to Hint, multi-target setter early return and the focus-hide mixed display quirk.
6. Preview and actual exported offline DOM should read Hint as empty in conditions/expressions, preserve authored JSON through interaction, and retain all new fields/actions/events on save/import. These are proposed product acceptance tests, not tests run by this research task.

Unknowns remain explicit: initial compiler error class; generated CSS/pixel behavior for unusual Hint properties; native per-widget editor defaults beyond the stored samples; physical browser caret/selection/IME/paste ordering; legacy Android path; complex reused/pre-evaluated rows; event menus/Wait/navigation reentrancy inside error callbacks beyond the already established event engine contracts.
