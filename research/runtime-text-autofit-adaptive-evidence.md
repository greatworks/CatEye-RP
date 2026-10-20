# Runtime text AutoFit: remeasurement and adaptive transition

2026-10-14. Independent narrow review and controlled retained-JavaScript replay. This work changes no product source. The accompanying lifecycle tests use an explicit fake measurement host; they do not establish browser font or layout measurements.

## Finding and correction to the first test assumption

A height-only AutoFit can still write the unchanged width into the native two-axis resize cache. A subsequent direct `expr.updateAutoFitted()` does **not** discard that cache. It is incorrect to demand that this call alone adopt a new adaptive base width.

The original view-switch routine is a separate operation. For the supported ordinary non-contained, non-repeater owner, it clears inline geometry and geometry caches **before** applying a different view, refreshing repeaters, and remeasuring registered objects. Therefore the correct distinction is:

- Product `updateAutoFitted(false)`: remeasurement only; retain the existing two-axis resize cache.
- Product `updateAutoFitted(true)`: the agreed view-transition entry point for this milestone; reset supported native ordinary-shape geometry, refresh repeaters, then remeasure registrations.

The first lifecycle run had 24 passing and 2 failing tests. Those two failures were the module/serialized versions of the invalid assumption that `false` represented a complete view switch. They are **not recorded as a proven product defect**. The corrected assertions retain the cached width on `false`; they additionally verify the explicit `true` transition after the parent implementation landed.

## Retained source chain

All sources are from the retained Axure RP 11 `DefaultSettings/Prototype_Files/resources/scripts/axure` distribution. Exact absolute paths, whole-file SHA-256 values and per-range hashes are in `runtime-text-autofit-adaptive-probe.json`.

| Source | Lines | Directly observed behavior |
| --- | --- | --- |
| `adaptive.js`, `_switchView` | 48–56 | An unchanged view returns without resetting or remeasuring. |
| `adaptive.js` | 69–87 | Clears owner inline top/left/width/height/opacity/transforms, and eligible immediate-child values. Skips contained objects and descendants of repeaters. |
| `adaptive.js` | 135–142 | Switching to Base resets visibility, clears moved/resized caches and applied styles, refreshes repeaters and relevant panel caches, then calls `updateAutoFitted`. |
| `adaptive.js` | 144–151 | Switching to a named view clears visibility/geometric caches/applied styles, applies that view, refreshes repeaters and panel caches, then calls `updateAutoFitted`. |
| `visibility.js` | 1382–1394 | Size cache getter/setter stores a width/height pair. |
| `visibility.js` | 1416–1420 | `clearMovedAndResized` replaces moved, resized, rotated and resizing dictionaries with empty dictionaries. |
| `expr.js` | 400–404 | `updateAutoFitted` only traverses registered IDs and invokes the AutoFit routine. It does not itself clear geometry. |

The native query-resize and AutoFit geometry details are independently covered by the existing parent/sibling geometry evidence. This narrow replay seeds a representative existing size cache; it does not rerun the full original resize implementation.

## Four controlled replay cases

Command: `node research/runtime-text-autofit-adaptive-probe.mjs`.

Result: **4/4 passed**. The script executes exact source slices in a bounded Node VM. A single ordinary shape is supplied. DOM mutation, CSS view application, panel/repeater operations, and final measurement are logged injected sinks. It launches no original application, DLL, browser or generated page.

1. Direct remeasurement preserves the existing width/height cache and registration.
2. Base → named view clears four geometry dictionaries before applying the view, then refreshes before measuring. The measurement sink sees the injected new 61.125 × 20.5 base CSS, not the prior 500.75 × 110.25 inline size.
3. Named view → Base also clears geometry before refresh and measurement; the inline reset is observed, while the actual Base stylesheet cascade is not modeled.
4. Same-view switching performs no reset or measurement.

This proves the inspected call order and dictionary behavior under those explicit dependencies. It does not prove a full original page cascade, inherited font dimensions, repeaters' internal refresh behavior, or master/panel/tree branches.

## Product lifecycle verification

Command: `npm test -- tests/runtime-text-autofit-lifecycle.test.ts`.

Final result: **28/28 passed**, 14 scenarios in both module and serialized-factory modes. `npm run typecheck` also passed (exit 0).

Coverage:

- Same template ID and duplicate row values remain distinct through full row contexts; external actions measure each visible instance.
- Zero-delta registrations and setter markers are removed by sort/filter refresh; deleted rows cannot re-register through stale callbacks.
- Nested repeater parent/child keys and descendant cleanup remain distinct.
- Navigation and disposal clear private registrations; returning to a page creates fresh row identities.
- Direct remeasurement retains both cached axes while accepting the host's current typography/alignment. An explicit transition reverts to the new effective view rectangle before remeasurement.
- Transition resets supported shape move/resize/rotation overrides while retaining SetText content, rich formatting, registration and other runtime state under the agreed product API.
- Repeater refresh versus registered-only remeasurement has separate ItemLoaded behavior.
- Failed registration or remeasurement restores previous state; recursive Resize → SetText is bounded and rolls back without poisoning later valid setters.

All measurement candidates are deliberately injected numbers. The tests do not import the product DOM measurement helper as an oracle and do not assert native pixels.

## Explicit implementation boundary

The product `true` transition is currently limited to the supported `shapeText` ordinary-shape subset for geometry reset. The original `_switchView` has broader reset behavior, including applied styles, opacity, additional widget classes and panel-specific caches. The present product contract retains other runtime state rather than claiming that broader switch routine is completely reconstructed. This limitation is explicit in the tests and should remain in release verification.

No runtime, model, renderer, previous evidence or previous manifest was changed by this work. No browser suite or package was run.

Frozen artifacts:

| File | SHA-256 |
| --- | --- |
| `tests/runtime-text-autofit-lifecycle.test.ts` | `af92219624237ca1befabfcf1a0c7240e359ac2e843b9f6170e6c56583177624` |
| `research/runtime-text-autofit-adaptive-probe.mjs` | `bc164a9230b37c93e5b1b86ad6af5127518a57f3e9e069eef973d329d180cdad` |
| `research/runtime-text-autofit-adaptive-probe.json` | `4127e3738db73d9c764b1fb6b2f684dc3ba76eb7b740f12dbf6917ad9132dc45` |
