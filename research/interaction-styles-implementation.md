# Interaction style implementation boundary

2026-10-13. This stage adds MouseOver, MouseDown, Focused and Disabled alongside Selected. It does not establish full Axure style-effect parity. Original function evidence and its execution boundary are in [interaction-styles-evidence.md](interaction-styles-evidence.md); native-file decoding is recorded in [rp-interaction-styles-evidence.md](rp-interaction-styles-evidence.md).

## Model and composition

Four optional `Partial<WidgetStyle>` records preserve old documents without adding defaults. Strict style parsing is reused. The model helper and self-contained portable runtime recompute from base plus runtime changes on each transition; state patches never become base styling. Disabled suppresses focus/hover/down. A nonempty Focused patch suppresses hover/down; empty or absent focus leaves pointer effects active. Selected overlays active transient properties; Disabled overlays selected properties. Border-width and corner-radius tuple clearing follows the existing document merge contract. Explicit zero and equal-to-base properties remain explicit overrides.

The portable factory owns a private per-instance transient map, not saved widget flags. Repeater context keys isolate rows; refresh and deletion discard their states. Navigation, hidden branches, panel-state switches and disposal clear stale states. Pointer release is observed at window scope, including outside release, drag end, cancellation and window blur. Ordinary mouse leave removes hover without clearing held MouseDown. Native handlers accept each mouse button; both primary and secondary buttons are exercised in both players.

Read-only review found two real defects before release. An effect equal to the authored base suppressed notification even when an adaptive base differed; publishing actual transient-state changes fixes the stale paint. Disabling a parent cleared only its own focus state; clearing focus on affected descendants with an explicit Disabled effect matches the native recursive setter. Four module/serialized regressions failed before the fixes (`.build/interaction-style-review-before.log`). A real offline adaptive-hover browser case also failed before the fix (`test-results/interaction-styles-adaptive-before`); all six focused authoring/player browser cases then passed. The initial React adaptive case happened to repaint and passed, so the recorded failure is not overstated as a two-player failure.

## Authoring and rendering

Interactions → Style effects adds, edits and removes effects. Individual property toggles restore inheritance. Common color, border, font, radius and opacity fields require no JSON; More style properties provides the existing validated patch editor. Editing an effect temporarily paints its patch on the selected canvas widget. It never changes the saved base style or selection state. Closing the effect, changing the selected widget or leaving the Interactions panel removes the temporary preview. Dragging while previewing records only geometry and remains one undo step.

React preview and offline DOM rendering use the same runtime composition. Form focus changes styles independently from configured Focus/Blur cases; case-menu focus restoration still suppresses duplicate interactions. Generic widgets with nonempty focus effects are tabbable. Parent-disabled children receive disabled styling before painting. Explicit opacity is rendered literally; the old blanket disabled opacity multiplier has been removed because it was unsupported by the original code.

## Explicit differences and remaining requirements

- Original GUI/raster comparison remains unavailable. Original-function probes use exact vendor slices with synthetic inputs, not a running original prototype.
- Atomic disabled repaint is intentional: the original can temporarily retain stale hover CSS when no Disabled effect exists. That inconsistent repaint timing is not reproduced.
- The original drag-end path can force hover even outside the widget; the implementation clears pressed state and retains actual hover tracking.
- Generic focus-effect authoring maps to tabbability. The generator rule producing Axure's `tabbable` flag has not been established.
- Error/Hint effects, inherited/default native form styles, per-adaptive-view effect maps, transitions/transforms, image swaps, full container propagation and generated CSS equivalence remain incomplete.
- Geometry/layout effects on native container borders and nested runtime fit still require wider original-browser comparison.

Current-build counts, logs, source hashes and archive identity are recorded in `interaction-styles-verification.json` after final verification. A prior release's report does not verify these changes.

Two development desktop test-oracle issues are preserved separately from product regressions. At host DPR 1.5, a literal 3px border computes to 2.66667px; the smoke now compares an independent plain-CSS border and also checks the exact inline 3px value (`.build/interaction-styles-desktop-first.json`). The real Basics sample stores its Share glyph as a separate path over the hover shape's center; a real pointer hover now targets its exposed top edge, without forced events or document changes (`.build/interaction-styles-desktop-native-hover-first.json`).
