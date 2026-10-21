# Selection state renderer static review

Reviewed on 2026-10-21 at 15:29 +08:00 by the independent evidence agent. The review used retained original-runtime evidence and source inspection only. No product files were changed by the reviewer; no browser, package script, tests, original DLL, GUI, or REA session/configuration operation was run.

**Disposition: bounded pass for the five reviewed files after one confirmed host-gate defect was corrected by the parent agent.** This is not execution acceptance or full Axure parity. `src/runtime/export-runtime.ts`, including ledger generation, initialization, callbacks and offline mounting, was excluded from this review while its owner was editing it.

## Confirmed finding and correction

The initial review of `src/components/Preview.tsx:186` found `onMouseEnter` forwarding `mouseOver:true` only when `!w.disabled`. That introduces a disabled gate absent from the retained original checkbox/radio style binding:

- Original `events.js:1364-1379` admits these control types, checks parent ownership and duplicate mouse-over bookkeeping, then calls `SetWidgetHover`. It has no disabled entrance guard.
- Original `style.js:97-103` checks only `_widgetHasState(id, MOUSE_OVER)` before generating the full state and applying it. When disabled, the computed state can be disabled while the hover request still causes an SVG application.
- The frozen `disabled-blocks-and-hover` sequences for both checkbox and radio in `selection-state-dispatch-probes-extended.json` record a disabled control receiving a hover request, then an apply and SVG call with event `disabled`. Selected/focused/down/error requests in that same disabled phase record only the blocked request.

Thus the extra Preview guard could omit a real paint-history transition. A useful visible case is an initially checked disabled radio, solid base border width 0, a nonempty mouseOver style, and no disabled style. Initialization leaves the mark fill-only; a qualifying disabled hover can apply the base/disabled cascade, adding the generic mark stroke with its default width 1 while outline width remains 0. The mouseOver width does not override disabled-state precedence.

The parent agent was notified during review and corrected Preview to forward hover for checkbox/radio even when disabled (`!w.disabled || w.type==='checkbox' || w.type==='radio'`). Static reinspection confirmed that correction at line 186. The parent also added the above regression carrier and expected stroke/width assertions to `tests/e2e/selection-state-paint.spec.ts:18-19,65-71`. This review did not execute that test or inspect the separate offline mount correction.

## Projection and cache checks

`src/model/selection-indicator.ts:62-96` consumes the supplied paint values directly. It does not compare source/current colors, synthesize state setters, deduce an SVG application from selection, or mutate the paint snapshot. Geometry comes from the retained asset size and asset border width. Mark visibility reads the current selected/checked projection separately. A repeated React/font paint therefore cannot advance the ledger by itself.

The explicit snapshot is a projection of computed paint rather than a copy of Axure's presentation-attribute/CSS storage. Rewriting the projected `stroke-width` attribute on every paint is consistent with that boundary: the runtime owns prior nonzero width writes, and the renderer receives their effective result. Removing the radio width attribute when no mark width is supplied correctly restores the initial fill-only asset on DOM reuse. Initial checkbox width preserves CIL operation order `(b/14)*3`; subsequent runtime width must arrive in the snapshot with original JavaScript operation order `3*b/14`.

`src/runtime/selection-display.ts:64-81` excludes paint from the authored measurement key but assigns `entry.paint` on every cache hit. Font completion references the same mutable entry and therefore reads the latest current widget, DOM nodes and snapshot. Replaced entries and detached labels reject stale completions. A new SVG node also receives the complete latest snapshot, so preserved paint does not depend on DOM survival.

The parent added a separate null sentinel during this review: `undefined` denotes stateless authoring; `null` denotes an unsupported runtime cascade. `supports` and `update` explicitly reject null before painting, clear the entry and take fallback. `WidgetView.tsx:140,148,255` forwards the union without converting null to undefined. The authoring/source fallback therefore cannot silently replace an explicitly unsupported runtime cascade.

`WidgetContent` forwards props to its body without a custom memo comparator. `SelectionControl` invokes the display update in its layout effect on every render. `Preview.tsx:198` forwards the row-context-aware paint result. None of these inspected call sites dispatches an extra selection event merely to render a snapshot. The implementation of the API getter itself is outside this report.

## Assertion and boundary assessment

- **Initial selected radio:** the E2E expectation of a colored generic stroke with width 1 is consistent with the original late binding call `SetWidgetSelected(id, true, true)` for an initially selected enabled control. Base outline width 0 does not create a radio mark-width attribute; the generic stroke uses the default 1. Assuming every initial radio remained fill-only would be incorrect.
- **Initial disabled radio:** without a disabled style, early disable records state without applying SVG; the later forced-selected request is blocked. Its initial fill-only expectation is therefore consistent. The added mouseOver carrier correctly tests the separate hover gate.
- **Width 3 -> 0 within one action sequence:** the E2E expected final outline/radio width 3 is supported by the retained original sequence. Zero fails the original truthy width-write condition; it does not clear the last stored 3. The checkbox's size-28 mark retains its separate runtime width 6. The normal restore can still leave outline width 3 when base width is 0.
- **`linePattern:'none'`:** allowing it only with a runtime snapshot is appropriate for this bounded renderer. The original runtime writes generic CSS width 0 while retaining stored attributes; checkbox-specific mark width still wins, whereas radio mark width becomes 0. The renderer must honor those supplied effective widths rather than recalculate them from current border width. The admission rule alone does not establish native initial-asset support for authored line-pattern none.
- **Transparent color:** the bounded solid parser admits explicit alpha-zero and fractional-alpha colors. These remain real non-null colors and do not imply a theme fallback or disabled-opacity transform.

The reviewed E2E file covers initial selected/disabled behavior, real radio clicking, alpha/transparent paint, same-sequence width retention, restoration, unchanged authored serialization, and preview/frame/offline carriers. It does not directly exercise line-pattern none or font completion; inspected companion unit-test source contains snapshot/no-line projection cases and latest-snapshot-after-font-resolution cases. Their presence is not a test-pass claim. Native input `disabled` assertions remain product host behavior: the retained original public enabled function's checkbox/radio path does not itself set that native property.

Remaining bounds include the excluded runtime ledger and mount, real browser event delivery, exported portable execution, native asset selection outside the supported solid subset, pixel/crop equivalence, and original GUI comparison. No unresolved defect was found within the reviewed snapshot projection or font-cache transport after the host correction.

## Reviewed byte identities

SHA-256 values at the static reinspection point:

| File | SHA-256 |
| --- | --- |
| `src/model/selection-indicator.ts` | `a41bdeb77722cfae4f1010ff8085ab0c8c9db7060aedcd4173c9eb1f219e4a3c` |
| `src/runtime/selection-display.ts` | `f4755d8c282079bf572afee76dd8cb8bf2d9285f9499c89795df8ad2b96791a6` |
| `src/components/WidgetView.tsx` | `0c856d939a18ca958572e20faf3245568aa2cdbd941286c4f16bceb2cb641527` |
| `src/components/Preview.tsx` | `696a5606d4b8468cef16e3d0ea20aaf2430dffe06a76e8a8c2cb2f63cb62f29b` |
| `tests/e2e/selection-state-paint.spec.ts` | `a432e37e6cf3423ef43b43c55a520c6d4c90cb7597c6db9a773d17aeeeea399b` |
| Companion `tests/selection-display-host.test.ts` | `6f164ebd22515500f16151eb4dcf2a565dbf46372ab90bf2778b02ad2804e824` |
| Companion `tests/selection-indicator.test.ts` | `a0e2144f6de94df00d2b1ba839ac2da83ce94b65ba68d722cb82d1138198779b` |

The original-runtime root is `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/`. Original `resources/scripts/axure/style.js` SHA-256 is `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`; `events.js` is `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3`.

Frozen evidence used:

| File | SHA-256 |
| --- | --- |
| `research/selection-paint-evidence.md` | `edd58e4aedcfa7634081cde86455998a17966cd1d02347e101cc5defa838957a` |
| `research/selection-state-dispatch-evidence.md` | `afaa20a00913cb9c9e958f17620f5bbafe62a4207ae239dc5dc2ec3c7cf40581` |
| `research/selection-state-dispatch-probes-extended.json` | `a06b0dcbbc8964efb9b13fedff3dad0dae0042970cb3fb2920f097eae2245ce7` |

Earlier reviewed Preview hash, before the reported correction: `8e290bac16b2dca5d4b4ec0e709660d4ce71ff209f404384a367f17b05d06f22`. Later product edits require their own reinspection and are not automatically covered by this report.
