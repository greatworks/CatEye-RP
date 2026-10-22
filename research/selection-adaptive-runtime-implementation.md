# Selection adaptive SVG runtime implementation

Status: owned production and focused tests are frozen. This report does not publish a release. fullAxureParity=false, originalGuiCompared=false, published=false.

## Delivered behavior

The portable runtime now advances each selection SVG's transform ledger at actual adaptive initialization or changed-view application. Returning to Base retains nested SVG transform history; re-selecting the same managed view does not replay it. A named view without an effective width or height declaration does not scale. Painting state, SetStyle, reading a paint snapshot, font/display refresh and owner Resize do not advance the ledger. Rebuilding a row creates a new asset ledger under the existing product lifecycle.

The transform origin is recorded before ratio validation. The denominator is the normal Base owner size, independent of live action/SetText dimensions and P94. Finite scale pairs are stored raw for CSS submission. The next event reads a separate browser-equivalent computed pair. An invalid pair preserves both previous axes, while retaining the newly written origin; zero is valid. Identity ratios do not silently quantize the previous raw submission.

The numeric reader reconstructs the exact float32 rational and rounds to six significant decimal digits with ties to even. Finite values are first clamped to the float32 range. This preserves both Chromium's computed string behavior and the finer raw value submitted for rendering. It avoids raw double accumulation, toPrecision ties-away, and imprecise decimal midpoint comparisons.

Fresh-factory snapshot restoration now restores adaptive mode, selected identity, viewport policy and initialized phases before event execution. The optional RuntimeAdaptiveState is runtime-only; no Document schema or saved project field was added. Engine snapshot helpers use this constructor path instead of copying dictionaries into a fresh runtime with unrelated closure state. Legacy snapshots without metadata retain unmanaged compatibility. A held state reference is synchronized on identity/phase mutations, and atomic rollback restores both carrier and closures. No adaptive event is replayed merely to restore a snapshot.

## Ownership and exact snapshots

- src/runtime/export-runtime.ts — 07752b1d3d70b7097bb824c8643caa99fbe46b184e0b843736ddb572470d1d9a; exact copy .build/selection-adaptive-runtime-final/src/runtime/export-runtime.ts
- src/runtime/engine.ts — c3c9786f2e402f2106754b750a9a68c54553da4e94bc26bff881a3ec73542e1a; exact copy .build/selection-adaptive-runtime-final/src/runtime/engine.ts
- src/model/types.ts — 538877901e569b34df6d1af75d50ee4b821c3671c3c5bab0bb1a003f11cbba8f; exact copy .build/selection-adaptive-runtime-final/src/model/types.ts
- tests/selection-adaptive-runtime.test.ts — 4dd40832042d2d0705513bca399e484d39638f9560d48330be11c51709e3c2b0; exact copy .build/selection-adaptive-runtime-final/tests/selection-adaptive-runtime.test.ts

Before snapshots remain in .build/selection-adaptive-runtime-before, before-midpoint, and before-held-state. The last preserves export-runtime 5f7791df7bedb5aa9639e84678c291b9e16dab433e473666a2f6965032acba9f corresponding to the pre-correction product candidate. Its test copy already includes the subsequent held-state red case and is not claimed to be the parent's earlier build test input.

## Independent source basis and schema bridge

The new test pins the four frozen evidence JSON hashes and directly consumes 18 full-module source sequences (76 steps), 6 numeric sequences (26 steps), and 27 browser readback controls in both module and bare serialized-factory modes. These are 24 selected sequences / 102 steps, separate from test counts. The source agent's complete evidence is 58 sequences / 292 steps plus a separate 8-sequence numeric probe, not all new product tests.

The retained setAdaptiveStyle helper reads a sparse override size and the Base normal denominator. Product width and height are independently inherited fields. The deliberate REA bridge constructs a complete pair only when the effective declaration chain contains either axis; a missing axis comes from effective declarations/Base, never action state. Native shallow partial size JSON can instead lose the companion axis and be rejected by CSS. This implementation does not mislabel the bridge as that malformed native carrier.

Source evidence: selection-adaptive-svg-evidence.md/json and manifest-complete.json (6e9f029e630e60a6d43673d98509eb96114dc0022df5a74c22e921e4844895a8). Product read-only architecture report selection-adaptive-product-review.md remains unchanged. Independent static review selection-adaptive-svg-runtime-review.md binds final export-runtime and found no definite source mismatch, without rerunning tests or browser.

## Verification and preserved failures

| Run suffix | Passed | Failed | Pending | Interpretation |
| --- | ---: | ---: | ---: | --- |
| snapshot-red | 0 | 9 | 0 | Snapshot closure identity/phase defects |
| snapshot-first-green | 9 | 0 | 0 | Initial snapshot fix |
| snapshot-focused | 114 | 0 | 0 | Snapshot and related regressions |
| scale-red | 22 | 54 | 0 | Scale implementation absent |
| scale-first | 76 | 0 | 0 | Initial scale implementation |
| scale-coverage | 86 | 0 | 0 | Additional lifecycle/numeric coverage |
| midpoint-red | 82 | 4 | 0 | 2 real midpoint failures + 2 legacy Resize oracle mistakes |
| focused-final | 379 | 2 | 0 | Only the 2 legacy Resize oracle mistakes remain |
| focused-green | 381 | 0 | 0 | Correct legacy carrier/expectations |
| held-state-red | 0 | 2 | 86 | 2 real held live-state metadata failures; targeted run |
| held-state-green | 383 | 0 | 0 | Final frozen result |

All files use .build/selection-adaptive-runtime-<suffix>.json/.log. Final total is **383/383**, comprising 88 new tests and 295 related tests. TypeScript check exits 0; its stdout log is empty. Parent browser/full-suite/build results are deliberately not included.

Final test command:

~~~powershell
node node_modules/vitest/vitest.mjs run tests/selection-adaptive-runtime.test.ts tests/runtime-adaptive-transition.test.ts tests/runtime-adaptive-state-styles.test.ts tests/runtime-adaptive-placement.test.ts tests/runtime-adaptive-padding.test.ts tests/runtime-adaptive-hierarchy.test.ts tests/runtime-adaptive-behavior.test.ts tests/selection-state-runtime.test.ts tests/runtime-rotate-snapshot-projection.test.ts --maxWorkers=1 --reporter=json --outputFile=.build/selection-adaptive-runtime-held-state-green.json
node node_modules/typescript/bin/tsc --noEmit
~~~

Two harness/test corrections are preserved, not presented as product failures: initial tsc rejected a test's nonexistent Action.width/height carrier; the corrected legacy x/y Resize changes owner width to555, so the old expected200 was wrong. Typed Resize exclusion is tested separately. A standalone Vite SSR read-only probe stalled before output and was stopped; no result is claimed from that attempt.

The held-reference regression retains one state object before start/view changes, does not call state() again, and executes another interaction from that same object. Its two red failures proved metadata could lag despite the state being live. Synchronizing on actual mutations fixed both factory modes. Prior first-dist output remains the parent's retained artifact; this report binds corrected final source.

## Explicit remaining boundaries

- REA independent width/height declarations are bridged to a complete size pair using effective declarations/Base, never action geometry. This is not native malformed half-size JSON fidelity.
- Native state-style size carriers are not expressible in the present product state schema and were not added.
- Existing product b-by-b/viewBox indicator crop remains. Native CSS bounds/no-viewBox evidence does not close full body transform and clipping.
- Hidden/unplaced/inactive-panel/nested-row tests are product regressions; the original combined lifecycle was not executed in this stage. Native pre-generated row reuse differs from actual DOM rebuild.
- Readback models recorded Chromium float32/six-significant-digit scale matrices. Arbitrary CSS transforms and all browsers are not claimed.
- Snapshot restoration is fresh-factory only; active timers, DOM registrations and arbitrary live-runtime continuation are not restored.
- Legacy numeric Resize can still change a selection owner for compatibility; typed native Resize excludes selection controls. Neither advances SVG adaptive scale.
- No original GUI comparison, native .rp writeback, or release/publication was performed by this agent.

The earlier architectural shorthand about Resize is narrowed here: only typed native Resize excludes these controls; the pre-existing numeric compatibility action is retained. Neither is treated as an adaptive SVG event. No old evidence/report was rewritten to conceal that distinction.
