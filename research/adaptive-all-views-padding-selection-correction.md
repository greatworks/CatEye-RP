# Mixed-selection padding correction

This is an additive correction to `adaptive-all-views-authoring-implementation.md/.json`. The earlier report and manifest remain unchanged. It does not replace the original native property evidence or claim a new native GUI observation.

## Defect and correction

The Inspector previously constructed a complete padding tuple from the current widget. `App.patchSelected` then applied that tuple to every selected target. For a right-edge edit, a second target's top, bottom and left values could be copied from the first target. With Affect all views enabled, the adaptive model correctly treated those unintended differences as edits and cleared their declarations in active and inactive view maps. A target whose right edge already matched the command could also be changed.

`Inspector.onWidgetChange` now accepts an optional third argument, `WidgetStyleEditIntent`. Each individual padding control emits `{ kind: 'textPaddingSide', side, value }`. Existing patch and explicit-style arguments remain compatible. The new `resolveWidgetStyleCommand(widget, patch, intent?)` resolves that edge against each target's own effective tuple before style merging. It uses the existing default of 7 for input/textarea/select and 5 otherwise. An unchanged edge contributes no padding patch, so defaults are not materialized and inherited declarations remain intact.

The App uses this resolution for ordinary multi-selection, selected table cells, menu items, tree labels and its existing Base typography-command path. Explicit full-tuple commands, including the Custom text padding checkbox, retain their previous whole-tuple meaning. This correction changes no runtime, schema or adaptive property-clearing algorithm.

## Verification

- Before changing existing source, exact App and Inspector bytes were copied under `.build/adaptive-all-views-before-multiselect/src/`. The accompanying correction manifest binds their before and after SHA-256 values.
- Focused unit red: 11 tests, 10 failures and 1 pass. The new command resolver was initially a behavior-preserving extraction returning the original patch; the tests reproduced the previous complete-tuple application before the single-side behavior was implemented. This is a unit-level reproduction, distinct from the parent agent's real browser failure against the candidate build.
- Initial corrected run: 10/11 passed. The remaining assertion demanded Page reference identity in the existing current-view model path. That path returns a serialized-equal copy, and App already suppresses history by serialized equality. The test now requires identical saved bytes for that path and still requires reference identity for the all-views path. The earlier failure log remains preserved; no product change was made to satisfy reference identity.
- Final focused run: **186/186** tests passed in nine files, comprising 15 new correction tests and 171 prior adaptive authoring/model tests. The new tests cover the heterogeneous A/B/unchanged-target example, current/Base/all-views behavior, inactive declarations, all four edge controls, control-specific defaults, unchanged defaults, full-tuple compatibility, mixed table cells, mixed rich runs and save/parse round-trip.
- `npx tsc --noEmit` exited 0.

The real browser mixed-selection regression, full integration, release build and packaged verification are owned by the parent agent and are not counted as completed here. Unit tests exercise the shared command resolver plus real adaptive model functions; they do not mount the Inspector or assert browser history interactions.

## Evidence and scope

See the paired JSON manifest for exact source and log hashes. Primary logs are `.build/adaptive-all-views-padding-selection-red.json`, `.build/adaptive-all-views-padding-selection-green.json` (initial corrected run), `.build/adaptive-all-views-padding-selection-focused-final.json` and `.build/adaptive-all-views-padding-selection-typecheck-final.log`.

Production changes are limited to `src/App.tsx`, `src/components/Inspector.tsx` and new `src/components/widget-style-command.ts`. The only test change is new `tests/adaptive-all-views-padding-selection.test.ts`. No previous test, manifest, runtime source, browser script or release artifact was rewritten.
