# SelectionButton property and text-tail numeric transactions

This increment extends `src/model/selection-layout.ts`. It changes neither the DOM renderer nor the document commit host. The ordinary, unrotated numeric domain, injected graphics/unit/minimum/union services, and atomic candidate policy remain in force. This is source-derived behavior with controlled services, not an Axure GUI or font comparison.

## API and behavior

- `styleChanged: { changedKeys: number[], notify: boolean, contained: boolean }` consumes the **updated** effective style and the **previous** text panel. Property keys must be nonnegative safe integers; their order and duplicates are preserved. Unknown numeric keys can still cause the general style notification; an empty list is not a no-op.
- SelectionButton's P94 preflight runs before the base notification gates: when text is nonempty and the new indicator is wider than the owner, request `indicator + previousPanel.width` with the current owner height, `allViews=false`, and `notify=true`. The ordinary Size validator then applies current fit/padding/minimum behavior. Thus caller `notify=false` does not suppress a Size-triggered layout from this preflight.
- The base gate is `notify && !owner.guard && !contained`, excluding only the exact single-element `[101]` list. For ordinary nonediting panels, BNZT → vNOg → CNOH → iIyW(false) invokes `OI8Z(true)`, then invalidates the panel; outer MIue then invokes `OI8Z(false)` and finally base MIue. The two layouts are separate and can measure different results.
- New optional `input.panelChangeGuard` models pNOC, independently of the owner recursion guard. Editing or pNOC skips the internal vNOg refresh, while the outer false layout remains. No VJm0 notification is attributed to `iIyW(false)`.
- `textChanged: { kind: 'textChanged' }` is explicitly the **post-synchronization RNO1 tail**. The host must already have stored/normalized the text and completed any required rich-style/inline-link synchronization. The adapter performs iIyW(false) → `OI8Z(true)` and then RNO1's separate `VJm0(false, null)`. It is not a replacement for the native plain/rich setters, their Overridden/notify gates, or their synchronization services. Existing pNOC does not suppress this tail.
- `measureText(request).flag` is now Boolean. AFW measurements use `!editingText`; other graphics measurements retain true. This corrects an observed older pure-adapter omission. The browser author measurer still explicitly rejects false and the current host completes inline editing before invoking it; active native editor graphics are not implemented by this increment.

Native Size changes may precede a later measurement failure. Those attempted writes remain in `diagnosticPartialState` and effects, but failed results never expose a committable `state`. The owner's temporary guard is restored. Negative candidate panel sizes are explicitly rejected as a product boundary rather than silently clamped or presented as native negative-size parity.

## Evidence

The new complete source chain is in `selection-author-properties-replay.mjs` / `selection-author-properties-probes.json`, with original managed method records. Relevant tokens include SelectionButton.MIue 100702033; TextRect.MIue 100702383; BNZT 100702385; vNOg 100701893; CNOH 100701874; RichTextPanel.iIyW 100701895; and RNO1 100701880. The original DLL was not loaded or executed. Graphics, unions, lower providers, rich-text construction/synchronization and notifications remain explicitly bounded services in those replays.

The previous `selection-layout-transaction-probes.json` modeled BNZT as a sink. Its four **blocked** property cases are still valid and tested; its ungated style cases are not used as complete-refresh oracles. Twenty-six new full style transactions compare owner/panel geometry, measurement count and all observable effects except the explicit product minimum-read instrumentation. Six native text paths supply post-synchronization tail oracles.

Eight additional source-only transactions in `selection-properties-model-source-fixtures.json` cover P94 gating, current fit/padding, differing measurement passes, duplicate Location keys, and failure cleanup. Their producer was run while the source research was at 43 cases. The original file and pins are retained. `selection-properties-model-source-confirmation.json` subsequently replayed all eight against the expanded source producer and verified exact equality, including attempted states and source traces. The intermediate producer hash in the first fixture is historical; the confirmation binds the current producer and its sources.

For injected failures, the retained fixture throws immediately before its graphics facade records a call; the product test throws inside the explicit service after the attempted call has been recorded. The comparison excludes that one extra attempted `graphics.measure` event and compares every other effect, cleanup and diagnostic value. This is an explicit injection-location difference, not a relaxed geometry assertion.

## Verification and preserved failures

- Existing geometry baseline: 194/194.
- First new entry tests: 0/10, then 0/12; expanded initial matrix: 5/46 (41 absent-entry failures; invalid-key rejection already passed).
- First implementation: 236/240. Four failures exposed the real editing+AFW graphics Boolean difference and led to the targeted correction.
- Next focused run: 260/260.
- Additional source fixtures: 266/268 initially; two failures were the injection-location trace difference documented above.
- First text test run recorded 54/73 because the concurrently expanded source research also added eleven rows outside that test adapter's mapped domain. The test now selects its named, intended oracle families explicitly; those extra harness mismatches are retained, not reported as product regressions.
- Isolated text entry red: 54/62, with all eight text-tail tests failing before that entry existed.
- Final: **276/276**, comprising **62 new property/text tests + 194 unchanged geometry tests + 20 unchanged browser-measurer unit tests**. Typecheck exited 0.

Commands: `npx vitest run tests/selection-layout-properties.test.ts tests/selection-layout-geometry.test.ts tests/selection-author-measure.test.ts --reporter=json --outputFile=.build/selection-properties-model-green-final.json`; `npm run typecheck` (captured in `.build/selection-properties-model-typecheck-final.log`). No full suite, browser, build or packaging was run by this agent.

Pre-edit bytes are retained under `.build/selection-properties-before/editor-core/`. Final source/test snapshots and every report's SHA256 are indexed by `selection-properties-model-implementation.json`. Only the numeric model source and the new test are product/test changes owned by this increment. Parent-owned host integration and its acceptance evidence are separate.

Remaining boundaries include native panel cache object identity, arbitrary transformed text, actual native font/unit services, full rich-string synchronization/inline-link effects and original GUI pixels. These results do not establish full Axure parity.
