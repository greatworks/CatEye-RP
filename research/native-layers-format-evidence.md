# Native Layer storage and strict import — Axure RP 11.0.0.4150

This stage restores structural Layer identities, without flattening their children or adding the saved Layer location to child coordinates. It does not claim full Axure parity. Evidence is static metadata/CIL, literal-resource decoding, original-file reads, and tests of the independent reader/importer. No original assembly method or original GUI was executed.

The pinned `AxureRP11.dll` SHA-256 is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. Exact paths and current hashes are in `native-layers-format-evidence.json` and `native-layers-format-manifest.json`.

## Observed storage and scope

The exact native type is `Axure:DiagramObject:Layer` (managed `Axure.DocumentModel.Objects.Layer`, type token **33557506**). It is distinct from `Axure.Axvg.Graphics.Layer`.

- `NIwY` **100701072** writes capital **`DiagramObjects`**, Boolean **`Propagate`**, and **`ExpandedOnOutlineTreeView`**, following the base object fields.
- `oIw4` **100701073** reads those fields, creates the collection, then calls `child.yJd7(this)` for each member.
- `get_DiagramObjects` **100701040** and `get_SubObjects` **100701037** expose the same ordered collection.
- `yJd7` **100695457** changes the parent reference and invalidates dependent state; it does not rebase child coordinates.
- The HTML-data writer `wJe6.jJeK` **100694305** dispatches Layer to `IJei` **100694310**. That writer emits **`objs`** by enumerating the same collection and recursively generating each child; **`propagate`** is emitted separately.

The resource literals are statically decoded in `native-layers-format-literals.json`; `IJei` has `propagate` at IL327 and `objs` at IL416. The decoder does not execute the original assembly.

All observed Layer members also occur once in the nearest ordinary `diagram-objects` array. Layer membership is a second index over this flat diagram; it is not a new panel-state coordinate scope. Every observed Layer and direct member has `IsContained=false`. Direct membership order agrees with the flat painter order. Layer nesting reaches depth 2 (three Layer levels).

## Original-file census

`native-layers-format-census.json` retains the complete Layer records, original properties, styles, member references, decoded offsets, package SHA, and original file SHA.

| Sample | Raw Layers | Direct member references |
| --- | ---: | ---: |
| Default.rplib | 1 | 4 |
| Sample form patterns.rplib | 178 | 733 |
| Sample UI patterns.rplib | 82 | 280 |
| Prototype Starter.rp | 12 | 24 |
| Prototyping Basics.rp | 3 | 7 |
| Other six samples | 0 | 0 |
| Total | **276** | **1,048** |

There are 125 Layer-to-Layer membership edges. The remaining direct types include vectors, images, panels, text inputs, textareas, repeaters, checkbox/radio controls and dropdowns. This is a storage observation, not blanket admission of those members.

`Propagate` is false on 215 Layers and true on 61. Two Layers have initial Selected=true; two have Disabled=true. Every observed Layer has an empty `AdaptiveStyles` array. There is **no real positive witness of Layer-local adaptive declarations** in these eleven files.

Observed direct MyStyle properties are Location P101 (216), PinHorizontal P106 (63), PinVertical P107 (51), FixedHeight P108 (53), FixedWidth P109 (38), and Visible P110 (8). No Layer has direct Size P105 or rotation P50 in this corpus. Pin/fixed-size values remain source metadata with an explicit authoring-gap diagnostic; they are not silently represented as generic style.

## Editor frame, separate from runtime bounds

`Layer.get_Location` **100701017** and `get_Size` **100701018** return zero for an empty Layer; otherwise they derive values from `KJm7.get_BoundingRect` **100695406**, not saved Layer P101.

The bounded call chain is:

`get_BoundingRect → IJ0g(100695407, false,false,false,true,true) → MJ0k(100695413) → virtual KIs9`.

Layer's `KIs9` **100701035** enumerates member `MJ0k` rectangles recursively. A nested Layer's cached frame/rotation is not rotated again. The true fourth flag bypasses visible/placed filtering, so hidden and unplaced members participate in the editor frame. Ordinary member `<EnclosingRectsInternal>d__291.MoveNext` **100695807** supplies the owner rectangle with its own center rotation; border/effect expansion is disabled on this path.

`d5pN.X5pe` **100720525** seeds a nonempty union from the **first member rectangle**, then aggregates the rest. An entirely negative group does not expand to the origin.

`Layer.UN0B` **100701021** is a different placed-object bounds path and is not used as evidence for the above editor getter. The independent original-JS study, `native-layers-runtime-evidence.md`, describes runtime bounds that filter hidden/limbo/fixed children and include effects. The two calculations must not be conflated.

Example: Form's **Trailing icon button**, package `d6160e6bca3a49fea2de31d17f1fba94`, Layer `d50d105c974445c69a3a03a48bd9db7b`, has no stored Location or Size. Members are `283b995945d24279aff2c5bba16255bc` at (10,10), 92×36, followed by `c9b1a072e4394cae81f95714170e4891` at (72,19), 18×18. The derived Layer frame is **(10,10), 92×36** and Propagate=true.

Conversely, Default's Card Layer `30a36769a456436fab6a282cea7a4a70` stores Location (-311,-114) while its members use repeater-scope coordinates near zero. This is not a translation to apply. That Layer remains outside the supported repeater template import.

## Reader and independent importer boundary

The reader leaves the original flat semantic member list intact and emits:

```text
layerRecovery {
  status: "supported-layer-membership",
  childIds: ordered native GUID[],
  propagate: boolean,
  localProperties: [{key, rawDoaName, value}],
  source: {
    sourceType, field:"DiagramObjects", coordinateSpace:"diagram",
    diagramId, parentLayerId:GUID|null, packageVersion:[11,0,0,0],
    sourcePartSha256, styleId
  }
}
```

This requires the evidenced package version, exact reference tags/identity, known fields, direct noninherited MyStyle, valid determined+overridden properties, same-diagram members, unique parentage, no cycles, supported depth, and complete contiguous preorder. Unknown style fields, inherited/named Layer styles, nonempty Layer adaptive declarations, selection-group membership, other transforms or malformed flags are not guessed.

A rejected wrapper may retain **`membershipReferences`** containing only literal child IDs plus diagram/version/part-SHA provenance. It remains `unsupported-layer-membership`, with no type candidate. This index can verify the parent reference of a complete inner Layer; it cannot authorize the rejected wrapper. This allows six complete inner UI Layers to survive rejected selection-group ancestors.

The TS boundary independently validates the protocol and assembles a Layer only after all direct children are admitted. Children retain IDs, original order, coordinates, styles, text, interactions and local adaptive maps. A missing/unsupported child prevents its entire wrapper. Any already valid inner Layer or ordinary member is retained in original order. Later rich-link/adaptive dependency failures unwrap affected Layer wrappers while preserving surviving members; rejection of a containing panel still discards that owned subtree and its target entries.

The product representation is `type:'layer', layer:{widgets,propagate}`. Neutral Layer style creates no native paint claim. The importer derives its author frame using the evidenced member rectangle union; the saved P101 remains in source diagnostics.

Existing action/condition/sibling gates remain. This change does not decode new native action classes. Complete Layer owners can now receive already-supported interactions. Move and Rotate recognize admitted Layer targets; Resize remains outside this native mapper target subset. Nonempty selection-group Layer wrappers and their six source selection actions are still not admitted.

## Fresh eleven-file result

`native-layers-format-import-audit.json` contains complete resulting documents and reports, all 182 added Layer widgets, per-Layer omission reasons, and the 13 newly reachable cases/actions.

| Sample | Added complete Layers | Added cases/actions |
| --- | ---: | ---: |
| Form | 129 | 10 Click → SetSelected on an admitted ordinary target |
| UI | 40 | 0 |
| Starter | 12 | 3 Click → SetPanelState |
| Basics | 1 | 0 |
| Total | **182** | **13** |

Of 276 raw Layers, 272 appear in Page/Panel semantic diagrams. Four belong to unsupported repeatable diagrams. Among the 90 remaining semantic omissions, 50 fail complete-child admission, 34 remain inside an already omitted parent graph, and six have unsupported named selection-group membership. No former leaf is removed to manufacture a complete group.

The audit independently flattens only newly added Layer wrappers and asserts the **entire resulting document is deeply equal to the immutable preimplementation document**. This covers every prior widget plus page/global fields, all old interactions, rich text, styles and adaptive maps. Ten documents pass; Icons keeps the identical pre-existing rejection. There are zero unexpected added non-Layer widgets and zero lost prior widgets.

The largest compact semantic JSON is **28,926,107 bytes**, below the **32 MiB desktop worker boundary**. Original sample SHA values are unchanged. The baseline file intentionally contains historical source hashes; current implementation hashes are recorded separately.

The independent `native-layers-runtime-import-events-review.json` follows the raw object graph without calling the semantic interaction reader or importer. All **13/13** checks pass: ten literal `SetSelected(toggle)` actions target direct members, and three SetPanelState actions reference a state belonging to the target panel. All targets remain in the same native page scope.

## Validation and limits

- Initial reader red: 19 failures before the new capability. Final reader: **23/23**.
- Initial Layer mapper red: 10 passed / 4 failed. Final new Layer mapper: **26/26**; related existing hyperlink/Rotate/Move-Resize mapper tests: **83/83**.
- Explicit tests cover nested parent IDs, same-diagram geometry, empty groups, malformed provenance, unknown fields/DOA flags, bad members, partial-parent fallback, inactive adaptive maps and empty state barriers, late dependency rejection, and persistence.
- The eight affected legacy mapper files pass **153/153**. Assertions were updated only where flat traversal/count assumptions became obsolete. The original caption, Phone/dropdown, rich/style, rotation and pill assertions remain unchanged after recursive Layer lookup. The five-source rotation integration test receives a 15-second execution budget; this does not weaken assertions.
- Original GUI rendering, original author group resize/pins, general Layer transforms/rotation storage, unsupported parent graphs, nonempty Layer adaptive declarations, and original selection-group Layer semantics are not declared equivalent. Native DLL methods were not executed.
- `ExpandedOnOutlineTreeView` remains an observed author-outline flag in the raw census; the product does not claim to restore the native editor's outline expansion session.

Refresh only this stage's evidence after agreed source freeze:

```powershell
node research/native-layers-format-census.mjs
node research/native-layers-format-import-audit.mjs
node research/native-layers-format-freeze.mjs
```

Never rerun `native-layers-format-admission.mjs` to overwrite the immutable preimplementation baseline.
