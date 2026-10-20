# Affect all views: authoring implementation and focused verification

This records the editor/model work performed on 2026-10-15. It does not replace the prior placement evidence or the initial read-only [code review](adaptive-all-views-code-review.md). Final whole-project, browser and packaged-release acceptance belongs to the parent task; those results are not inferred from this focused run.

## Implemented scope

The editor checkbox is now **Affect all views**. Its value remains transient editor state. Existing placement/insertion/deletion scope uses the same value. Normal layout and style commands now pass it through the existing `changeWidgets` → `applyAdaptiveWidgetEdits` → `commitAdaptivePage` path, rather than promoting the current effective widget to Base.

`AdaptiveWidgetEditOptions` adds `allViews?: boolean`, `explicitTextStyle?: Partial<WidgetStyle>` and `explicitTextWidgetIds?: Iterable<string>` alongside the existing `placementAllViews` option. The function's existing positional arguments remain unchanged. Omission keeps current-view behavior. The explicit text fields are editor intent only and are never serialized.

For ordinary existing widgets, actual property changes are measured against the prior **current effective widget**. Changed property groups are written to raw Base and removed from every active and inactive page-local declaration map. Unchanged values, unrelated style keys, placement, visibility, geometry, effect barriers and unedited widgets remain intact. Shared set definitions do not cause edits to propagate to another page bound to the same set.

The implemented native groups are:

- Location: an actual X or Y change writes the entire current effective `(x,y)` pair to Base and clears both declarations everywhere.
- Size: an actual width or height change writes the entire current effective pair and clears both declarations everywhere.
- Fill and border fill: solid/gradient alternatives are treated as one paint each.
- Normal scalar fields, each shadow object, line-end pair and visibility tuple retain their existing individual style-property boundaries.
- Interaction effects: when the previous effective map contains any state object, an edit writes the complete edited effective state map to Base and clears whole `stateStyles` maps in all views. An empty individual state object counts as present. The native **first-effect exception** is retained: when no effective state object exists, the initial addition stays in the current view slot (or Base when editing Base), even with All Views enabled. A normal-style edit in that same transaction still follows its global path.

The native source basis and its controlled-replay limits are documented in [ordinary authoring evidence](adaptive-all-views-authoring-evidence.md) and [state/effect evidence](adaptive-all-views-effects-evidence.md). This implementation does not claim original-GUI observation of these editor gestures.

## Independent padding provenance

The schema adds `AdaptiveWidgetOverride.textPaddingSides`, a sparse object with optional `top`, `right`, `bottom`, `left` numeric keys. Values must be finite and within the existing 0–1000 padding bound. Unknown keys, arrays, null and invalid numbers are rejected. Empty objects are allowed without inventing a tuple.

Existing `style.textPadding` tuples remain valid and declare all four sides. Composition processes each ancestor's tuple first, then its sparse sides, before moving to the next view. `resolveAdaptiveOverride` and `resolveAdaptiveWidgets` expose a complete `style.textPadding` tuple only when padding is declared; `textPaddingSides` never leaks into a Widget. The established form-control fallback is 7px, other widgets 5px.

An All Views single-side edit changes only that Base side and clears only that edge's local provenance. When a legacy tuple must lose one edge, its remaining three explicit edges become sparse declarations. The cleared side therefore follows future parent/Base changes instead of being frozen to a copied value. Current-view edits also retain only changed edges while preserving other prior explicit sides. An untouched tuple is retained rather than rewritten during notes/content edits. Shared-set reassignment respects a target full tuple replacing source sides, and otherwise combines source/target sparse sides independently.

The parent owns the portable/runtime counterpart. This report's test result covers the model and authoring side, not the parent's runtime or browser runs.

## Rich text, structures and gesture history

Whole-widget text style commands still intentionally reset mixed runs or paragraph formatting. All Views updates raw Base rich content, not a rendering projection. A deliberate normal reset can therefore remove mixed italics while preserving unrelated run colors, paragraph data, literal mode and link identities. Conversely, a repeated command whose outer style and raw runs already match is a true no-op: it does not clear another view's font declaration or add redundant normal fields. Decisions are per target, including mixed selection. Explicit line-height commands still clear raw paragraph pixel-height overrides.

Normal style edits do not rewrite rich content; interaction/action editing changes the shared action graph and does not immediately clear the target's authored declarations. Inline text/range editing, options, panel/repeater content and table/menu/tree content retain the existing shared-content contract. Shared composite descendants do not acquire unsupported adaptive layout/style fields. Component publication remains a separate operation.

Every ordinary drag/resize frame uses the document captured at pointer-down as its source. Returning to the origin restores the original declarations; pointer cancellation and the existing held-undo cancellation restore that document. Pointer-up records only an actual final document change. Numeric equal-value submissions and effect-free canvas previews do not themselves create global edits. The parent owns the real browser gesture regressions; the model tests independently check the starting-page recomputation behavior.

## Product extensions and limits

- The existing `radius/cornerRadii` and `strokeWidth/borderWidths` reset pairs remain product conventions. The arbitrary four-value tuples are **not** the native P71/P81 or P15/P80 property pairs. Native uniform radius versus corner visibility and uniform border width versus side visibility remain distinct; this work does not claim complete native corner or border authoring parity.
- The scoped command follows the supported ordinary/root-widget model. It does not add native master/Layer special handling, generalized contained-owner delegation or new temporary provider semantics.
- `Use inherited effects` remains the explicit current-view inheritance command; it is not silently reinterpreted as editing the global state map.
- No original application execution, GUI capture, browser run, build or package operation was performed by this subtask. Original behavior conclusions come from the linked static evidence, and product behavior from the tests below.

## Red/green evidence

| Evidence | Result | Meaning |
| --- | --- | --- |
| `.build/adaptive-all-views-authoring-unit-red.json` | 11 total; 9 failed, 2 passed | Initial ordinary style/inactive-map gaps; existing local/content paths still pass. |
| `.build/adaptive-all-views-authoring-unit-geometry-red.json` | 17 total; 15 failed, 2 passed | Adds actual point/size-group and gesture-baseline regressions before implementation. |
| `.build/adaptive-all-views-authoring-unit-effects-red.json` | 23 total; 3 failed, 20 passed | Whole-map effect edits initially missing. The then-general first-add expectation was later corrected using the dedicated source branch, not treated as native proof. |
| `.build/adaptive-all-views-padding-unit-red.json` | 15 total; 8 failed, 7 passed | Strict new-field support, projection, independent edges and reassignment gaps; invalid-input guards already reject. |
| `.build/adaptive-all-views-first-effect-reset-red.json` | 30 total; 5 failed, 25 passed | Dedicated first-effect exception and existing product richer-carrier reset regressions. |
| `.build/adaptive-all-views-rich-noop-red.json` | 34 total; 3 failed, 31 passed | Uniform/equal rich commands incorrectly erased declarations; mixed-run reset remained covered. |
| `.build/adaptive-all-views-authoring-focused-final.json` | **171 passed / 171**, 8 files | 49 new cases plus 122 existing adaptive, hierarchy, set, effect, placement and component cases. |
| `.build/adaptive-all-views-authoring-typecheck-final.log` | **exit 0** | `npx tsc --noEmit`. |

The new files contain 34 authoring tests and 15 sparse-padding tests. The focused command used only these plus `adaptive.test.ts`, `adaptive-hierarchy.test.ts`, `adaptive-view-sets.test.ts`, `adaptive-state-styles.test.ts`, `adaptive-placement-authoring.test.ts` and `adaptive-component-sync.test.ts`. No whole suite was run here. Each red/green JSON has a neighboring log. Source/test hashes and the result-file hashes are recorded in [the implementation manifest](adaptive-all-views-authoring-implementation.json).

## Owned files at handoff

- `src/model/types.ts`
- `src/model/document.ts`
- `src/model/adaptive.ts`
- `src/model/adaptive-view-sets.ts`
- `src/App.tsx`
- `tests/adaptive-all-views-authoring.test.ts` (new)
- `tests/adaptive-all-views-padding.test.ts` (new)

No Inspector, child editor, runtime, renderer, native reader/importer or existing test file was changed by this implementation subtask. The parent integrates and verifies its separate runtime, browser, desktop and documentation changes.
