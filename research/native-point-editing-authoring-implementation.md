# Native point editing: authoring integration

This report covers the authoring implementation and its focused unit validation. It does not claim original GUI observation or final package acceptance. The parent task owns browser, desktop and release verification.

## Contract and source boundaries

The retained managed-code investigation in [native-point-editing-evidence.md](native-point-editing-evidence.md) distinguishes preparing a non-custom shape's current points from converting its identity at an anchor/handle mutation. The product's previous discrepancy and entry points are recorded without alteration in [native-point-editing-authoring-analysis.md](native-point-editing-authoring-analysis.md). The shared geometry implementation is `src/model/vector-authoring.ts`, owned and independently tested by the evidence agent.

The editor prepares geometry from the effective adaptive **normal** widget, including its current size, uniform radius and corner mask. While editing points, the target renders that prepared path as a temporary `path` widget. Selected/error/disabled flags and their styles remain saved, but their paint and the temporary Inspector effect preview are not applied to the editing target. Entering point mode clears the temporary effect preview; leaving restores ordinary state painting. This is the explicit product authoring policy, not a claim about every original style-provider context.

An actual change to any eligible `box` with a vector path commits `type: 'path'` and the new shared path together. A custom path remains a path even if its points again form a rectangle. Ellipse identity is not broadened by this conversion policy. The target's style, bounds, rotation, text, shapeText flags and interactions stay unchanged. Active, ancestor and inactive adaptive declarations stay unchanged. Changing points remains shared content regardless of the Affect all views checkbox.

Merely entering or leaving point mode, selecting a node, a cancelled gesture, or returning the gesture to its starting path does not persist the prepared geometry. This lazy document-commit/undo policy is an explicit reconstruction choice. The original snapshot/gesture evidence does not establish an identical GUI undo boundary.

## Implementation

- `src/model/adaptive.ts`: `applyAdaptivePointEdit(page, viewId, widgetId, value)` resolves the effective normal target, checks the unsupported-configuration gate, parses the bounded vector schema, compares against the prepared path, and replaces only the target's shared Base type/path. Its no-op result is the original Page object. The generic `applyAdaptiveWidgetEdits` type-change prohibition remains intact.
- `src/App.tsx`: toolbar/keyboard entry and double-click hit testing use the shared geometry and gate. Numeric and canvas mutations both call the dedicated command rather than the generic adaptive edit path. The existing `commit` boundary creates one undo record for each completed mutation. A temporary `type: 'path'` displays the prepared or held-drag geometry so the parameterized rectangle renderer cannot regenerate it over the draft.
- `src/components/CanvasVectorTools.tsx`: the prepared path is memoized from its geometry/style input values. Gesture baseline, no-op checks, keyboard changes after a held gesture, anchors and segment hits all use this path. Draft pointers still make no document changes until a completed gesture.
- `src/components/Inspector.tsx`: numeric node controls use the same prepared contour; interacting with them enters normal point-edit display. The original raw JSON is not exposed. Current-widget-only path mutation remains separate from ordinary multiselection style edits.

`vectorEditPathUnsupportedReason` prevents a parameterized display from exposing different saved points. Partial-border and legacy independent-corner configurations are unavailable **when the current renderer actually regenerates that parameterized rectangle**. The toolbar is disabled and Inspector says: “Point editing is unavailable for this border or corner configuration.” The numeric controls are absent, and the model command also rejects mutation. Custom paths and truly legacy snapshots whose display is not regenerated keep their stored-path editor.

No WidgetView, renderer/runtime, import/parser, schema, original evidence, browser test, or package file was changed by this authoring work.

## Red and green validation

The initial test adapter deliberately exercised the previous App flow:

```ts
applyAdaptiveWidgetEdits(page, viewId,
  updateWidgetTree(resolveAdaptiveWidgets(page, viewId), id, { vectorPath: path }))
```

The first 10 tests produced **3 passes / 7 failures**, recorded in `.build/native-point-editing-authoring-red.json` and `.log`. The failures show missing box-to-path conversion and missing no-op object identity through the old generic command. This was an old-pipeline behavior adapter, not a missing-export failure.

During integration the approved contract narrowed unsupported partial-border editing to rejection. An intermediate run (`.build/native-point-editing-authoring-green-first.json`, despite its prospective name) has **9 passes / 1 failure** because the earlier partial-border success expectation had not yet been updated. That record remains intact. The final test asserts rejection, no source mutation and absence of numeric controls for both unsupported configurations.

Final focused result: **124 / 124** tests passed in `.build/native-point-editing-authoring-focused.json`:

| File | Count | Scope |
| --- | ---: | --- |
| `tests/native-point-editing-authoring.test.ts` | 16 | Base/child/shared-set preservation, inactive declarations, nested templates, legacy/custom identity, prepared-path no-op, invalid data/targets, Inspector/overlay alignment, unsupported configurations |
| `tests/adaptive-hierarchy.test.ts` | 35 | Existing adaptive hierarchy |
| `tests/adaptive.test.ts` | 12 | Existing adaptive editing and type guard |
| `tests/vector-editing-review.test.ts` | 23 | Existing independent curve/closure/transform checks |
| `tests/vector-editing.test.ts` | 13 | Existing point-edit geometry helpers |
| `tests/vector.test.ts` | 25 | Existing schema/render/export/control checks |

`node node_modules/typescript/bin/tsc --noEmit` completed successfully; log `.build/native-point-editing-authoring-typecheck.log`. The new 16 tests include server-rendered Inspector/overlay assertions, not interactive-browser claims. Browser gesture, history, save/reopen and player validation remain with the parent task's `tests/e2e/native-point-editing.spec.ts`.

## Remaining boundaries

- Partial-border and independent-corner parameter geometry is deliberately blocked until its native construction and displayed-point equivalence are established.
- Editing keeps existing normalized coordinates and owner bounds. It does not reproduce native out-of-bounds rebound/normalization or smart-shape side effects.
- Existing shapeText flags remain unchanged during conversion. This report makes no new native text-layout claim for the converted object.
- Prepared author geometry follows the retained managed construction; it is not asserted to be identical to the later HTML dynamic stroke inset pipeline.
- Effect/state preview is intentionally suspended for the point-edit target. Original GUI selection/effect context and gesture pixels were not available for verification.

Source and test hashes, baseline copies and the retained red/green evidence are bound by `native-point-editing-authoring-implementation.json`. Final integrated browser and package results belong to the parent release audit.
