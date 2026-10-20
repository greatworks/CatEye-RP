# Interaction styles: original runtime evidence

2026-10-13. Axure RP 11.0.0.4150, read-only shipped resources plus **33 passing isolated original-function probes**. No native app, original GUI, generated prototype or browser was launched. The probe does not execute the whole vendor application. It uses exact SHA-pinned function slices with synthetic widget data, a minimal jQuery/DOM event adapter and recording paint endpoints; it therefore establishes state/merge/call behavior, not pixel rendering or browser hit-testing.

- [Probe](scripts/probe-interaction-styles.mjs), run with `node research/scripts/probe-interaction-styles.mjs`.
- [Evidence JSON](interaction-styles-evidence.json): exact paths, hashes, one-based line excerpts, all probe outputs and a bounded CSS search.
- REA extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Installer SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- `style.js` SHA-256 `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`; `events.js` `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3`; `axQuery.std.js` `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd`.

## Official description

[Style effects](https://docs.axure.com/axure-rp/reference/style-effects/) describes temporary, state-driven alternatives: MouseOver follows cursor presence, MouseDown follows a held click, Selected follows selection actions or checkbox/radio clicks, Disabled follows disable actions, and Focused follows browser focus. Form widgets obtain focus on click/tab; Focus can also be an action. Effects are configured by choosing properties to alter. Error and Hint are separate native effects. Form widgets have default Disabled effects, while hint text has its own styling. Transitions and transform origins are supported natively but outside this work. These descriptions do **not** specify conflict precedence; that comes from the shipped implementation below.

[Styling widgets](https://docs.axure.com/axure-rp/reference/styling-widgets/) gives the ordinary base hierarchy: individual widget settings override its applied widget style, which overrides the document default. [Checkboxes](https://docs.axure.com/axure-rp/reference/checkboxes/) describes Disabled as preventing user interaction and activating its disabled visual effect. That user-facing behavior is separate from programmatic checked assignment.

## Determined contract: composition, not a single winning style

`style.js:1794–1846` merges overrides in this order:

`normal → mouseOver → mouseDown → focused → selected → error → hint → disabled`

Later properties replace earlier properties; fields absent from the later effect survive. The merge is shallow (`$.extend`), so a structured property such as `fill` is replaced as a whole, not merged channel by channel. Explicit zero, false and empty-string scalar values survive. `style.js:1869–1879` then combines default style, applied base style, object style, current panel diagram style and the computed overrides. `style.js:1906–1914` merges an effect's referenced custom style before that effect's own settings. Source style objects are not mutated.

However, active states are **not all applied simultaneously**. `_generateFullState` (`style.js:137–159`) first retains selected/error/hint, then:

| Actual state | Included transient effects | Retained persistent effects |
|---|---|---|
| Disabled | none of hover/down/focus | selected/error/hint, followed by disabled |
| Focused style class active | focus only | selected/error/hint |
| Otherwise | mouseOver and mouseDown may coexist | selected/error/hint |

This means a focus effect that only sets a border does **not** retain a hover-only fill: with focus active, that fill returns to the base value (unless selected or another included state supplies it). A selected-only text color can coexist with the focused border. This exclusion was observed in actual generator/combiner functions, not inferred from visual priority.

### Focus activation and fallback

`SetWidgetFocused` (`style.js:176–184`) returns if disabled or `_widgetHasState(id,'focused')` is false. A browser focus event alone therefore does not necessarily activate a focused style class. `_widgetHasState` (`74–95`) treats a nonempty default state object as present; missing or empty default objects are absent. An image override can also establish presence. An adaptive state's object is considered present even when it is `{}`. The last two mechanisms are outside a simplified model containing only nonempty direct style patches.

`events.js:759–785` attaches the focus style handlers to supported form widgets, buttons, and **tabbable** shapes/images/tree nodes/table cells. For `dObj.tabbable`, it sets `tabIndex=0` on the focusable node. A generic shape with only a focused style but no `tabbable` is not bound by this runtime block. Whether the original generator automatically emits `tabbable` for certain editor selections remains **unknown here**; exposing a Focused effect by making a product shape tabbable is an explicit mapping choice until that generation path is proven. The isolated attachment probes cover both the false/true flag and a text input without the flag.

The focused class is maintained by repaint, not an independent query of `document.activeElement` (`style.js:435–437`). Disabling with an effect removes it. Re-enabling recomputes pointer/selected state but does not restore focus merely because an element might still have browser focus; a subsequent focus event can restore it. This was observed in the function sequence, not a claim that every browser preserves focus while disabling a particular control.

### Adaptive and contained-style limits

`_computeStateStyleForViewChain` (`style.js:1849–1865`) searches the view chain from most specific to least. The first matching state object is copied. If a view has an explicit `stateStyles` map but lacks this state, it returns `{}` and blocks lower-view/default state fallback. It does not merge missing effect fields across view maps. For contained objects it first walks `isContained` parents. The proposed direct-patch product subset must not be described as complete native adaptive/contained-style support.

## Pointer lifecycle: exact ordinary-widget path

Actual `_attachIxStyleEvents` (`events.js:1361–1436`) and setters were probed together.

| Input sequence | Result |
|---|---|
| enter | record hover, apply MouseOver |
| down while over | record pressed object, apply MouseOver+MouseDown |
| leave while still held | remove hover only; pressed object persists; apply MouseDown |
| reenter while held | MouseOver+MouseDown again |
| release on the widget | clear pressed object, normally return to MouseOver |
| release elsewhere via document handler | clear pressed object; use actual hover list, so no phantom MouseOver |

`mouseleave` (`1382–1392`) does not clear `mouseDownObjectId`. Mousedown (`1396–1409`) registers one-shot document mouseup and dragend cleanup. Mouseup (`1412–1428`) clears the global pressed ID and re-evaluates style; document cleanup supplies `checkMouseOver:true` (`1343–1350`, `1406`). `_updateStateClassesHelper` (`style.js:1722–1735`) removes all known effect classes and applies the current combination each time.

Two exact quirks should not be erased from the evidence:

- The ordinary mouseup setter forces hover unless `checkMouseOver` is true (`style.js:129–133`). A direct synthetic mouseup with no preceding enter can therefore paint hover while the hover list remains empty.
- Dragend cleanup supplies no `checkMouseOver` data. In the probed enter/down/leave/dragend path, down clears but hover is forced, again with an empty hover list. Treating drag cancellation as “clear all” is a reasonable product rule, but differs from this observed source path.

The ordinary mousedown/mouseup style handlers do not inspect `button` or `which`. A final original-handler probe supplied buttons 0, 1 and 2: all entered the same pressed state, and a mouseup with button 0 cleared each. A primary-button-only policy would therefore differ from this desktop mouse path.

This block excludes native dynamic panels, layers/RDOs, repeaters, tree nodes and hyperlink-specific paths; parent style propagation has its own functions. The new evidence does not claim those container paths behave identically. `events.js:1671–1686` has separate panel-state exit calls to both setters; its interaction with the retained global pressed ID was not promoted into a fully validated container contract.

## Disabled handling and forms

`style.js:259–268` stores disabled independently of visual styles. If the widget has no Disabled effect, it returns without repaint. Thus disabling during hover can temporarily leave the old painted hover style until another repaint. A later hover setter is allowed, but `_generateFullState` produces disabled state and excludes hover/down/focus. MouseDown, Focused and Selected setters instead return immediately for disabled widgets (`129–131`, `176–178`, `186–187`).

There is **no unconditional ordinary-widget opacity multiplier** in these paths. A base opacity of `0.8` remains `0.8` with a Disabled effect that only sets fill; an explicit disabled opacity `0.25` replaces it with `0.25`. The bounded search of `axure_rp_page.css` and `default.css` found no general disabled opacity rule. The separate jQuery UI theme has `.ui-state-disabled` opacity `.35`, not a rule for every Axure widget. Browser-native form appearance and generated per-widget CSS remain separate from this negative finding.

The checked value and selected-style state must remain distinct:

- `axQuery.std.js:1202–1206` reads ordinary selection from the style manager but checkbox/radio selection from input `checked`.
- The checkbox/radio setter (`1244–1250`) changes `checked` **before** calling `SetWidgetSelected`. On a disabled target, the checked assignment succeeds while selected-style state and selected events stay unchanged. Both checkbox and radio paths passed the isolated probe; native browser peer-radio unchecking was not simulated.
- Initial setup runs selected/error before disabled (`events.js:808–825`). A selected+disabled form can therefore correctly display both effects, with disabled winning conflicts. Do not “fix” its style state by consulting only the current checked property.
- Query `enabled` calls the style setter, then sets the actual input's `disabled` for text/form types, but returns early for checkbox/radio at `axQuery.std.js:1130`. That early exit and text-input assignment were separately probed. The original checkbox/radio interaction blocking also uses event/style guards; this minimal adapter does not establish full browser default-action cancellation.

Existing selection-group and radio-click ordering evidence remains in [rp-selected-state-evidence.md](rp-selected-state-evidence.md). This stage did not change that contract.

## Proposed bounded product behavior and acceptance

For ordinary widgets and supported form controls with direct style patches: preserve immutable base styling, merge only the active effects by property, exclude hover/down during active focus, suppress all three while disabled, retain existing selected-versus-checked state, and remove the arbitrary disabled alpha multiplier. Keep transient flags out of saved documents. Recompute from the base on every transition so removed effect properties cannot leak.

Verify: independent hover/down properties and conflicts; leave/reenter while held; release outside; focus border with hover-only fill reverting to base; selected text styling over focus; disabled overriding selection while retaining unspecified selected fields; no focused effect leaving hover functional; no disabled opacity effect leaving opacity unchanged; per-row/component instance isolation; preview/export equivalence; save/reopen without transient state. Adaptation choices for immediate disabled repaint, pointer cancellation, generic tabbability, Error/Hint, native default form styles, adaptive state maps, container propagation, transitions and generated CSS must remain explicit. No claim of complete Axure paint or interaction-style parity is warranted from these 33 bounded probes.
