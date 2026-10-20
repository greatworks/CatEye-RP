# Affect All Views correction review — AAV-REVIEW-01

**The confirmed mixed-selection padding defect is corrected at the source hashes below.** Twenty-four bounded current-product assertions passed. The original failed witness is unchanged; this is a separate follow-up, not a replacement snapshot.

## Verified call chain

The Inspector's numeric padding callback (`Inspector.tsx:579`) now supplies a third transient argument, `{kind:'textPaddingSide',side,value}`. Its actual `updateStyle` function (`557–565`) forwards that argument. `App.tsx:441` passes `patchSelected` directly to `onWidgetChange`, so an intermediate callback does not drop it.

`App.patchSelected` (`307–342`) resolves the command against each actual target through `resolveWidgetStyleCommand` before merging style. The helper reads that target's existing full tuple, or its type-specific fallback, changes only the requested edge, and removes the padding part of the command when that edge already matches. It does not materialize a default tuple for an unchanged target. A command without side intent retains the existing full-tuple semantics.

The adaptive model itself is unchanged from the failed witness. Its independent edge diff now receives the intended per-target values, so it clears only the changed edge's active/inactive declarations. No persistent intent field was added to the document.

## Execution and results

`adaptive-all-views-correction-review-probe.mjs` executes the exact current numeric callback, `updateStyle`, and `App.patchSelected` slices after TypeScript erasure. It imports the real new `widget-style-command.ts` helper and the current adaptive/table/menu/tree/rich model helpers. This differs from the original failing probe by actually carrying the new third argument through the Inspector source, rather than supplying only the old complete tuple.

React commit/undo hosts are explicit capture sinks. Ordinary widget captures are passed to real `applyAdaptiveWidgetEdits`; contained targets use real table/menu/tree model updates with capture wrappers for the App host functions. The unchanged line-style capability filter is an identity sink for padding-only commands. No browser, rendering, original Axure GUI or DLL execution is claimed.

**24/24 passed:**

- Current-view and All Views commands preserve every selected target's other three edges.
- All Views writes only the changed Base edge and preserves other active/inactive edge declarations. Current-view editing leaves Base and inactive maps unchanged.
- An already-matching selected target keeps its entire Base object, current declaration and inactive declaration unchanged, including its unrelated state barrier.
- The source document is not mutated in either mode.
- Base editing preserves per-target values and all view declarations.
- Top, bottom and left commands also resolve against each target, including zero.
- Mixed selected table cells preserve their own edges and unselected cells.
- The actual menu-item and tree-label App branches use the same target-specific command.
- Base rich-text's second style application preserves the resolved tuple and does not modify mixed runs.
- Input, textarea and select targets use their own existing7px fallback when they have no tuple, rather than copying the current box's padding.

In the original failing B example, the corrected All Views Base result is **[51,40,53,54]**, the child resolves to **[61,40,63,64]**, and the inactive top71/bottom73/left74 remain local. The equal-target fixture retains its original Base[81,82,83,84], current[91,40,93,94], and inactive[101,102,103,104] declarations exactly.

## Branch audit and limits

| App target route | Review result |
|---|---|
| Ordinary selected widgets, including panel/repeater-contained editing scopes | Per-target resolver is applied inside the selected-widget map. Current/Base/All Views branches were executed with ordinary targets; the existing panel-scope host assembly is unchanged. |
| Table cell selection | Resolver runs inside `patchTableCells`' per-cell callback; heterogeneous cells and an equal cell were executed. |
| Menu item / tree label | Resolver receives the actual cell/label, not the outer owner. Both branches were executed. |
| Tree node non-label | Existing allowed-field filter still excludes style. No new padding UI was invented. |
| Menu/tree roots and inline frame branches | The style branch invokes the target resolver where applicable, but the Inspector has no single-edge text-padding controls for those roots/frames. No new support is claimed. |
| Table owner in ordinary selection | Existing shared table-layout/style policy remains; this correction does not add owner text-padding support. |
| Rich formatting | Padding is not a rich run style key. Mixed run content is preserved in the executed Base path. Native character-selection editing remains outside the original evidence. |

The original native evidence still supports independent P11/P12/P13/P14 carriers and per-owner current-value filtering; these probes verify the independent product's correction. They do not establish every native GUI multi-selection route. Real browser undo/save/reopen coverage belongs to the parent's new regression and was not rerun here. No product, test or old evidence was modified by this review.

## Source and witness binding

The correction JSON contains hashes for15 current source/test files and all three extracted source slices. It verifies that source files remain unchanged through the probe run.

| File | SHA-256 |
|---|---|
| `src/App.tsx` | `18d59af41c498e0072374cb5aa14c5f94c2d7409b1714976f524329400440d4c` |
| `src/components/Inspector.tsx` | `406eb50c3a634067e111a56d8fee7b7dc7cf94067b9d5a4a1f67eac54b2f0725` |
| `src/components/widget-style-command.ts` | `73500ccf8ab80c0977f397051dd0ba1cec89e3b45eba00fe684d977a9d71c356` |
| Unchanged `src/model/adaptive.ts` | `2cd738e8db66e70d534c76df7ee7b8889b2ed4747bbf1f8a6fa916ff82cbdbb7` |
| Correction JSON | `c718442ba5e48b995d81d0ac3f1e221a215b5711a751ba294d0fe2f5dcca21f5` |
| Correction probe | `3c2d3ec5067b876508896a95229593c05d368ae219c2cdbd9d95f69373cb60ec` |
| Original failed JSON | `9727ba029b7ed9b2bcfe4cddc2cac807ce2cf1ca53911a8b31fa0f8809916616` |
| Original failed MD | `3416f679ea80faa360487d0014d791a08dc7ea9870e456ee34f819b2021f469c` |
| Original failed probe | `3be08ab111042edf6ef60808f381cb27bbab1808c2bcf1c67ba5a68810488194` |

The correction probe, like the original, uses exclusive output creation. Further runs must name a new output path.
