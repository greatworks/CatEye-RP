# Selection author effects: persistence handoff

2026-10-20. Scope: the new effects persistence module and its focused tests.
No original DLL or GUI execution, browser test, package build or full suite was
performed for this handoff. Existing frozen evidence was not modified.

`applySelectionAuthorEffects(page, viewId, widgetId, result): Page` is exported
from `src/model/selection-author-edits.ts`. Pass an effective page produced by
`resolveAdaptivePage`; commit the returned page with `commitAdaptivePage`.
The caller owns measurement, command freshness, all-target atomicity and undo.

The module persists only ordered `fit.flag`, `alignRight.flag`, `style.Size` and
`style.Location` effects. Fit/AlignRight change shared `selectionText`; Size and
Location retain both components. An all-view geometry effect writes Base and
clears that pair from every active and inactive declaration. A later internal
current-view effect writes a complete pair to that view. Existing unrelated
styles, state maps and empty entries survive. Nested targets keep their native
coordinate scope; only derived Layer frame caches are refreshed.

Do not replace this replay with a diff of the transaction's final owner rectangle
through generic `changeWidgets`. The tested source-derived external Size example
emits `(150,20,allViews=true)` followed by `(150,15,allViews=false)`: in a named view
the correct saved result is Base 150×20 plus current 150×15. Reversing those effects
has a different result. Panel rect, guard, temporary style-editor KNYS, measurement,
requests and notifications are not persisted or dispatched by this helper.

Failed transactions and malformed/out-of-model persistent writes throw without
mutating the input page. All persistent effects are validated before replay.
Shared stored pages must be projected first, including for Base edits. An explicit
checkbox/radio `selectionText` declaration is required; no legacy defaults are
invented. A derived Layer frame outside the existing model range is rejected
atomically. Browser font equivalence, native minimum/union services, parent fit
notifications, asynchronous command routing and multi-target undo are outside this
module's validation.

Validation: **21/21 focused tests passed; `npx tsc --noEmit` exited 0.** Tests cover
actual adapter effects including AlignRight, external/internal scope ordering,
equal-component provider pairs, inheritance, inactive/shared maps, nested Layer/
inactive panel/repeater template targets, failure after attempted writes, domain
rejection and document serialization. Initial red was a missing new module
(collection failure, zero executed assertions), not a native behavior regression.
The first implementation passed 19 tests; two final persistence-boundary cases
were then added and passed. No failed numerical assertion was discarded.

| File | SHA-256 |
| --- | --- |
| `src/model/selection-author-edits.ts` | `ec025356b9a4d40b61d15a186f6dd44bbd8b4c58c0419ad43855ef163e21dc78` |
| `tests/selection-author-edits.test.ts` | `f2f47c4cafb5399f36556f5b3cfa789d35506f1e8036e08d53f7c10940043d94` |
| Tested dependency `src/model/selection-layout.ts` | `fe18d99c7b85f17435fe668a3cb720183f82d34b113cefe790e32fa086605c94` |
| `.build/selection-author-edits-red.json` | `29bd2405ee41eb29336b756f05fa1f4588746b4857e06690126e85d567f3527d` |
| `.build/selection-author-edits-first.json` | `c97f74c973b83d8c5c21f214c6010920a00238e1dd3932e443df0def40c82b87` |
| `.build/selection-author-edits-final.json` | `15edaa172555c130fdf69313227a89c697e135c7eb3f3173ee6591cd5f4f2cf6` |
| Retained transaction evidence `research/selection-layout-transaction-evidence.md` | `9f16651b6248fa84206de91dff4690aca0d20aeafd6ed70254a89f9808656b5f` |

This handoff freezes the two owned implementation/test files. Concurrent App and
service integration is parent-owned and is not claimed as frozen or independently
browser-verified by this report.
