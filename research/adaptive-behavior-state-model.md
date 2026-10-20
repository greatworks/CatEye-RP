# Adaptive state-map model implementation

2026-10-15. This is the independent product/model follow-up to the frozen [original-runtime evidence](adaptive-behavior-state-evidence.md). It is not another native-runtime or native-GUI observation.

Owned product change: `src/model/adaptive.ts`. Owned new test: `tests/adaptive-state-styles.test.ts`. Types, document validation, runtime, renderer and author UI are separate parent/peer scopes.

The model now projects the nearest present adaptive `stateStyles` map onto the widget's seven existing flat effect fields. A present empty map removes all seven projected effects. An absent map inherits the nearest ancestor map or Base flat effects. Normal style/geometry composition remains separate, and the `stateStyles` metadata field never leaks into a resolved `Widget`.

Exported APIs:

- `getEffectiveAdaptiveStateStyles(page, viewId, widgetId)` returns an independent effective map snapshot, preserving empty entries.
- `hasAdaptiveState(page, viewId, widgetId, state)` scans the current chain for an entry (including `{}`), independently of later map barriers; Base entries must be nonempty. It returns false for unknown widget IDs. It does not implement native image override or contained-owner lookup.
- `clearAdaptiveStateStyles(page, viewId, widgetIds?)` deletes only the selected local maps, preserving normal style/geometry/visibility and removing widget override records only when nothing remains.

`applyAdaptiveWidgetEdits` compares the previous visible effect map with the edited map. If an effect changes, it stores the complete edited effective map. If effects do not change, it preserves an existing local map exactly and does not materialize inherited effects. The Base flat fields are restored independently from shared text/content changes. Editing the last effect away writes `{}`; restoring inheritance is the explicit clear operation. The complete snapshot on author edit is an **independent editor design**, not a claim about the native editor's adaptive command implementation.

Current composite constraints are retained: table/menu/tree roots still adapt only visibility, and their shared descendants/table cells retain shared Base effects. Panel descendants and repeater templates can independently adapt their effect maps. No native contained-owner semantics are inferred merely from a product container type.

Validation:

- Initial 19-test run before implementation: **17 failed, 2 passed**, retained in `adaptive-behavior-state-model-red.json`.
- Final focused run: **97 passed, 0 failed** across state-map28, adaptive hierarchy35, existing adaptive12, fill-gradient11 and border-gradient11. The JSON is `adaptive-behavior-state-model-green.json`.
- The first implementation typecheck passed. After adding the nested regression, the owned test's repeater fixture was corrected to use the existing `template` field. The subsequent typecheck reported only an unrelated concurrently edited `Inspector.tsx:356` `AdaptiveViewTarget.viewId` narrowing error; the parent was notified. No change was made to that file.

The 28 new cases cover all seven effect field mappings, map barriers/partial-state replacement, current-chain presence, empty Base vs adaptive entries, immutable snapshots, normal style independence, untouched local declaration retention, Base provenance, explicit removal, clearing inheritance, atomic gradient replacement, shared text/rich content, newly added/deleted widgets, composite limits and nested panel/repeater descendants. No full suite, build, package or product browser server was run by this model task.

The original VM/DOM evidence manifest remains unchanged. A separate [model manifest](adaptive-behavior-state-model-manifest.json) binds this implementation and test/report bytes.
