# Adaptive visibility reset: events, defaults and exclusions

2026-10-15. Additive follow-up to `adaptive-style-reset-evidence.md`; that report and all product/AutoFit files remain unchanged.

## Confirmed implementation contract

**Adaptive Show/Hide restoration must be silent with respect to the direct `onShow`/`onHide` dispatch.** It must not simply invoke the product's normal Show/Hide action path if that path always emits those events.

The exact retained call chain is:

1. `adaptive.js:266`: `_applyView` calls `visibility.addLimboAndHiddenIds`.
2. `visibility.js:1302`: the latter calls `_setWidgetVisibility(elementId, { value: shouldBeVisible, noContainer: true })`. It does **not** pass `fire`.
3. `visibility.js:55–124`: `_setWidgetVisibility` adds `containInner:true` and delegates to `_setVisibility` at108. `noContainer:true` skips the panel/layer container-animation block at71–107.
4. With no easing, `_setVisibility` sets actual visibility and completes synchronously at333–336 (the zero-wrapped-node equivalent is317–330).
5. Its completion only raises `onShow`/`onHide` inside `if(options.fire)` at310–313. That branch is not taken for adaptive restoration.

The controlled replay executes these exact function bodies, including `SetVisible` and completion. Positive controls pass `fire:true` and do produce one `onShow` or `onHide`, so the negative adaptive results do not come from a missing event recorder. This establishes the direct event gate only. It does not claim that no other side effects or events can ever occur: selected-class handling, focus, fit, animations and later repeater refresh are separate paths.

## Omitted visibility in the target view

`adaptive.js:299–316` computes adaptive/state overrides and then `$.extend({}, diagramObject.style, adaptiveStyle)`. Only exact `compoundStyle.visible === false` enters `hiddenIds`.

For the normal-state base-to-one-view cases:

| Base declaration | Target view declaration | Target visibility |
| --- | --- | --- |
| false | omitted | hidden |
| true | omitted | visible |
| omitted | omitted | visible |
| false | true | visible |
| true | false | hidden |

A prior action changing the live visibility is not an input to that merge; it is only the old state compared against the declaration-derived result. On return to Base, `visibility.js:1321–1324` resets from `_defaultLimbo/_defaultHidden`.

For more than one adaptive inheritance level, `style.js:1798–1819` visits the declared view chain and merges earlier values before later ones. This is static supporting evidence, not an additional executed multi-level test here. The replay injects the already-computed normal-state adaptive dictionary, then runs the actual object-base merge. Named styles and selected/error/disabled overrides remain outside this small matrix.

## Exclusions are phase-specific

| Object/condition | Inline geometry/opacity reset, `adaptive.js:70–87` | Visibility application, `visibility.js:1288–1303` |
| --- | --- | --- |
| Ordinary non-contained shape | reset | reset to destination declaration |
| Contained object | skipped | skipped |
| Table cell | native containment/type determines early step | explicitly skipped |
| Submenu | no universal early exclusion established here | explicitly skipped by `sub_menu` class |
| Table inside menu | no universal early exclusion established here | explicitly skipped when parent has `ax_menu` |
| Dynamic panel root | owner reset; children reset only if fitToContent | not excluded; `noContainer:true` avoids ordinary panel animation wrapping |
| Repeater root | not excluded merely because it is a repeater | not excluded merely because it is a repeater |
| Repeater descendant | explicitly skipped | `_applyView` does not pass `skipRepeater`; this particular phase can still visit it before the subsequent full refresh |
| Caller explicitly passes `skipRepeater:true` | unrelated | repeater descendants skipped at1293–1296 |

These are not a claim that a simple visibility patch reconstructs all panel or repeater behavior. The following repeater refresh discards and recreates row instances; panel caches, active states and fit are additional operations. Product implementation can first accept ordinary shapes, but should not describe that bounded subset as the source's universal type gate.

## Limbo is not ordinary action-hidden state

`visibility.js:1299` makes a destination-limbo object invisible even if it is not explicitly hidden. After the loop,1306 merges the new limbo IDs into `_limboIds`.

`_setWidgetVisibility:58–61` blocks a later Show action for a limbo ID. The probe confirms target `limbo:true` → hidden, and a subsequent direct `fire:true` Show request neither shows it nor emits `onShow`. `_switchView` clears the old limbo dictionary before applying the new view, so a later placed view can restore it. The current product does not have a separately modeled limbo state; do not implement this by pretending it is only `Widget.hidden`.

## Replay and artifacts

Command: `node research/adaptive-style-reset-events-probe.mjs`.

Result: **18/18 passed**, including five default/override combinations, same visibility, Base reset, four excluded types/classes, panel and repeater roots, both repeater-descendant gates, limbo, and two explicit-event positive controls.

The source is the same pinned extraction as the parent report. Whole-file and exact range SHA-256 identities are in `adaptive-style-reset-events-probe.json`. The full `_setVisibility` body is retained and executed, but the exercised path has no easing. DOM is a minimal mocked tree; no native GUI, complete generated original page or browser pixels are involved.

Failure/pass provenance for the first comparison harness is retained separately in `adaptive-style-reset-validation-log.txt`. The discrepancy JSON preserves actual original and product values. No snapshot was updated to hide a product failure.

Recommended narrow acceptance adds three assertions to the initial report's matrix: omitted target hidden inherits declarations; adaptive restoration emits zero direct Show/Hide callbacks; normal explicit Show/Hide still emits the existing callback. Same-view requests should not restore action state. Limbo and container/row lifecycle should be separate future tests when their model support is present.
