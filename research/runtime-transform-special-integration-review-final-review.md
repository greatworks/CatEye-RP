# Special transform integration — final independent review

**RTS-INTEGRATION-01 is fixed and independently rechecked. No further confirmed defect was found within this bounded review.** The final reviewed `src/runtime/export-runtime.ts` SHA-256 is `db4ff9b6e2784405b29f3000fdfc1037151d33b1e3dd2db0623899fcc57f4fed`.

This review used the frozen RP 11.0.0.4150 special-consumer research and executed the independent implementation in module and serialized-factory modes. It did not run a browser, an original generated page, the Axure GUI, or vendor DLL methods. No product or existing test file was edited by this reviewer.

## Confirmed issue and correction

The original reviewed implementation required an existing widget in the `Resize thisItem` branch. On Page Loaded, the legal product action `Resize(thisItem, "120", "35")` followed by `SetVariable(Log, "continued")` threw `Resize thisItem requires a widget event source`. Both factory modes failed. The original failure hash and observations remain in [initial findings](runtime-transform-special-integration-review-initial-findings.md) and its JSON; they were not rewritten.

The stronger red probe executed retained `action.js:1258–1284`, the size helper and repeater consumers, plus the actual `doc.js:660–672` parent lookup with an empty controlled parent index. It evaluated both dimensions, found no item, and dispatched the next action. This demonstrates the consumer contract for a controlled source ID, not native Page Loaded authoring availability or the generated event entry itself.

The correction at `export-runtime.ts:1995–2005` uses an expression context without requiring a widget object. It still evaluates both dimensions, explicitly omits Target, and performs no item mutation when no item exists. This is not a fabricated This/Target fallback. The unchanged independent probe now completes with `Log="continued"` in both factory modes:

- [Original red with source parent lookup](runtime-transform-special-integration-review-page-scope-source-parent.json).
- [Independent correction replay](runtime-transform-special-integration-review-page-scope-correction.json).
- The implementer's new focused tests also verify undefined This/Target and unsafe-expression rollback. Those tests were rerun successfully by this reviewer.

## Coverage and results

| Check | Result | Meaning |
|---|---:|---|
| Independent compression/row comparison | 48/48 | 24 cases in each factory mode, compared with frozen original consumer outputs |
| Independent Page Loaded correction | 2/2 | Same previously failing cases, both factory modes |
| Existing special/consumer test files after correction | 58/58 | Includes eight exact-source arc trajectories in each factory mode, sampled at 0, .25, .5, .75 and 1 |

These are overlapping suites; their numbers must not be summed into a unique native-parity case count. The original retained-source special suite is separately frozen at 57/57 and was not rewritten or rerun wholesale here.

The 48 independent comparisons cover growth, shrinkage, unchanged size, inferred and explicit signed compression, complementary displacement, strict interval boundaries, unwrapped row reflow, wrapped primary/secondary reflow, peer maxima and single ItemResize counts. They use the independent runtime's normal startup before row actions.

The first independent comparison was 34/48 because its fixture omitted `runtime.start()`: the first action flushed pending row initialization and replaced premature layout mutations. The script and output remain preserved as a harness failure, not a product defect. Adding normal startup produced 48/48 before and after the Page Loaded fix.

## Read-only implementation checks

- `export-runtime.ts:1596` implements the arc sampler independently. The focused tests compare all eight frozen original direction/trajectory cases at the same sample fractions. They do not test real timer cadence.
- `export-runtime.ts:1935` keeps direct compression outside the ordinary planner/reservation wait while releasing the instance Move channel on completion. It preserves the missing-trajectory arc choice. Zero movement still follows its event/release branch.
- `export-runtime.ts:1953` selects direct same-container siblings using the old leading threshold and strict cross-interval overlap. Explicit signed primary displacement, inferred displacement, complementary displacement, hidden candidate handling, and direct non-fit row push match the reviewed source fixtures.
- `export-runtime.ts:1995` now evaluates This Item dimensions outside an item without requiring or manufacturing a widget. Item mutation remains immediate and ignores the motion options, as the retained branch does.
- `export-runtime.ts:2457` writes width then height, uses the row reflow helpers, and emits one ItemResize after the complete size update. Existing consumer tests exercise rollback of the event's layout changes.

## Boundaries retained

- Original-source execution uses declared DOM/query, numeric geometry and scheduling facades. Fit callbacks and queue release in that original harness are sinks. Thus read-only inspection of the independent queue integration is not new proof of complete native reentrancy or simultaneous-tween behavior.
- Native Layer objects, fixed-position flags, independently sized panel states, transformed/shadow DOM bounds, margins, and generated wrapper identity are not expanded by this review. The product's explicit unsupported table/menu/tree-container compression gate is not claimed to reproduce those native wrappers.
- Positive row fixtures have zero borders. Original repeater border and box-model details remain the prior evidence boundary.
- No new claim is made for parent fitting, full dataset/filter refresh, deletion during native animation, browser lifecycle timing, or all Axure special-target combinations.
- Product finite-size limits, unsafe-expression rejection and transactional rollback are independent safety behavior. Passing these tests does not establish complete native failure semantics.
- The focused command emitted the existing Vite future config-loader warning about an extensionless helper import; it did not affect the tests and was not modified in this review.

The companion JSON and manifest bind all reviewed product files, exact original sources, scripts, preserved failures and final outputs. No old report or published artifact was overwritten.
