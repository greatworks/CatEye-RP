# Native corner authoring implementation

This report covers the model and authoring scope for independent uniform radius and corner visibility. It does not certify a final release, original GUI behavior, or native pixel equivalence. Runtime geometry, native import, browser integration, and package acceptance are owned by the other stage workstreams.

## Evidence and contract

The retained-source investigation is recorded in [native-corners-evidence.md](native-corners-evidence.md), [native-corners-runtime-probes.json](native-corners-runtime-probes.json), [native-corners-static-probes.json](native-corners-static-probes.json), and [native-corners-format-census.json](native-corners-format-census.json). It identifies P71 as a uniform radius and P81 as a separate Position mask. The model represents P81 as `cornerVisibility: [topLeft, topRight, bottomRight, bottomLeft]`; the native bits are 1, 2, 4, 8. Eleven retained document defaults explicitly contain radius 0 and mask 15. The reconstruction uses omitted mask = all corners enabled without inserting a field into old documents.

This authoring implementation does not use the native mask as an alias for the legacy four-radius extension. Changing uniform radius preserves the mask and retains the established product command that clears `cornerRadii`. Changing a mask bit preserves both uniform radius and any legacy tuple. The renderer's corner/border interaction and native clamp algorithms are separate from these authoring commands.

## Implemented paths

`WidgetStyle.cornerVisibility` is validated as exactly four strict booleans. It is accepted through the existing common style parser for ordinary styles, seven effects, SetStyle actions, adaptive declarations, shared styles, and components. Old omitted fields and legacy tuples retain their saved representation.

The adaptive difference path treats P81 independently. Current-view explicit all-corners resets can override an inherited disabled corner. Affect all views writes only the actually changed native property: a mask change clears mask declarations while preserving radius declarations, and a radius change preserves mask declarations. Existing whole-P21 effect graph rules, including the first-effect exception, remain in the common adaptive model.

`CornerStyleCommand` carries radius, one mask bit, or one override property intent. `resolveWidgetStyleCommand` and `editCornerOverride` resolve that intent against each selected target's own effective style or own effect patch. Heterogeneous selection therefore retains other corners and unrelated effect properties. Same-value targets return no change and do not have their other-view declarations cleared. No command metadata is stored in the document.

`CornerEditor` exposes the base radius/mask controls; `CornerOverrides` supplies separate radius and mask overrides in interaction effects and SetStyle. App routing preserves existing table-cell, menu-item, and tree-label selection semantics. The shared table/menu/tree authoring rules are not broadened by this stage.

## Accessible controls

Base controls use `Radius`, group `Corner visibility`, and `Corner top left rounded`, `Corner top right rounded`, `Corner bottom right rounded`, `Corner bottom left rounded`. `Use default corner visibility` restores the all-enabled default. For a native vector rectangle it keeps an explicit all-enabled declaration, because that declaration also distinguishes an editable native rectangle from a legacy path snapshot.

Effect controls use their existing display prefix, for example `Override MouseOver radius`, `Override MouseOver corner visibility`, `MouseOver radius`, and `MouseOver corner top left rounded`. SetStyle uses the corresponding `Action 1` prefix. Radius and mask overrides can be removed separately. The legacy checkbox retains accessible name `Independent corner radii`, with visible wording `Legacy independent corners`.

## Compatibility limits

- New corner controls call the shared `supportsCorners` capability. A strict vector rectangle requires an explicit base mask. Old vector snapshots without a mask remain unchanged and use the existing path-node editor; there is no automatic geometry hydration or inference of a new mask.
- Aspect-ratio changes of a proven native rectangle are recognized by the parent's normalized rectangle helper. Arbitrary vectors and excluded surfaces do not gain mask controls. Existing nonvector radius controls on excluded types remain available.
- Legacy `cornerRadii` remains a product extension. Its uniform-radius reset behavior is not presented as a native P81 operation.
- A mask bit is convenient UI input, but the resulting P81 value is still one atomic four-boolean mask. Unlike the preceding padding work, it does not introduce sparse per-corner adaptive metadata.
- This work does not add a native authoring GUI observation or a new browser run. Safe native source evidence and product unit/SSR checks are identified separately.

## Validation and retained failures

Before production edits, the new 19-case model suite produced 15 passes and four meaningful failures: cross-carrier parse/roundtrip, current-view all-corners reset, all-views mask-only editing, and component roundtrip. These are preserved in `.build/native-corners-authoring-model-red.json` and its log. The same suite then passed 19/19 in the separate model-green files.

The final focused run passed **198/198 tests: 31 new and 167 existing**, across nine files. The new controls suite covers heterogeneous multi-selection in current/all views, true no-op targets, independent radius/mask reset, legacy tuples, per-target effect attributes, whole-P21 behavior, old-vector preservation, aspect-resized capability, default vector reset, and stable SSR labels. Existing regression coverage includes legacy corner radii, all-views and padding selection, hierarchy/shared sets, interaction styles, and error/hint models.

The complete typecheck passed with exit 0. An earlier typecheck failure caused by a parent-owned scenario declaration still in progress remains in its original log; it was not overwritten. No full test suite, build, browser, or package command was run for this authoring handoff.

The companion JSON binds the eight changed production files, two new tests, seven before snapshots, shared helper dependency, logs, and report with SHA-256. `adaptive-view-sets.ts` was reviewed and snapshotted but required no change. Previous all-views implementation/correction manifests remain untouched. Final browser and package results belong to the stage's parent verification record.
