# Native adaptive sets: isolated import reader

This stage adds `research/scripts/read-rp-adaptive.mjs`, a pure JavaScript reader of already-decoded packages. It does not load the original DLL, execute the original application, infer missing views from names, or claim original GUI validation. The target remains the retained Axure RP 11.0.0.4150 assembly, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

## Stored graph and scope

The existing pinned CIL establishes these distinct identities and carriers:

| Carrier | Serialization / resolution evidence | Reader contract |
|---|---|---|
| Project | `DesignDocument.AdaptiveViewSets`; `dtZ8.ftZA` 100716686 and predicate100716755 compare stored set IDs | Only sets declared by one valid DesignDocument are live candidates. |
| Set | `PtPZ.itPU`, writer100715542 / reader100715543 | `Id` tagged Guid, `Name`, local ref3 `DefaultAdaptiveView`, ordered ref3 `AdaptiveViews`. Object ID remains separate from stored `Id`. |
| View | `Ot71.bt7H`, type writer100715627, writer100715630 / reader100715631 | `Id`, `Name`, structured `Size.Width/Height`, `BaseViewId`, `BaseViewName`, `Cursor`, `ParentAdaptiveViewSet`. |
| Parent | getters100715616/618, setter100715619 | Base sentinel or a complete named ID in the same set. `ParentAdaptiveViewSet` instead points back to the set object. |
| Page | `IJvQ.OJAL`100697112; Page type `NJvD`, field `MJAz`67124485 | Resolve `AdaptiveViewSetId` by project set ID. The separate `AdaptiveViewSet` direct ref is preserved, with a diagnostic if nonzero; it cannot change that resolution. |

The Master branch uses field `xJAo`67124484 and is **not** treated as Page assignment. Unreferenced sets, `AdaptiveViewMatchInfos`, and orphan widget style GUIDs never manufacture definitions.

Base is `19e82109f102476f933582835c373474`; Auto is `982030d673df45868f11149ca2b8b02f`. Native Base is self-parented in storage. The reader preserves this sentinel; conversion to the independent model's absent-parent Base belongs to the consuming importer.

The view reader's `oIw4`100715631, IL671–686, compares the package version with `QbzB.cbzf`; the frozen version initializer establishes 9.0.0.0. Its modern branch reads `ParentAdaptiveViewSet`. The new reader uses only the existing object reader's exact version allowlist (9.0.0.0, 9.0.1.0, 10.0.1.0, 10.0.3.0, 10.0.4.0, 11.0.0.0), schema50001, and complete modern carriers. This is not a claim of compatibility with every version at or above9. Unknown fields, legacy `Condition`, wrong tags, incomplete parents and unsupported versions are rejected atomically at the set boundary.

## Cursor: retain the field, distinguish player behavior

New narrow ECMA metadata extraction identifies `Axure.Platform.PageCursor`, TypeDef33558193: `Desktop=0` (field67129900), `Touch=1` (field67129901). `ft7h`100715604 loads `ct2N`67132203 and has the enum return signature. The generated-view writer `OJeL`100694304 writes decoded literal `cursor` at IL384, calls `ft7h` at IL390, and passes its value directly to numeric writer `gbOo`100690305 at IL396. No name-based inference is needed.

The companion runtime investigation traces sitemap cursor attributes into the player device mode: `plugins/sitemap/sitemap.js`251 and274–275, `axplayer.js`1654–1673/1749, `adaptive.js`522–580. Device mode and player context gate touch-cursor application. The reader therefore preserves raw0/1. The independent player's shell cursor behavior requires an explicit omission report; absence of an effect in a particular view is not justification to discard the native field. This report's own tests do not execute those original runtime functions.

## Public protocol and failure boundaries

`recoverAdaptiveSets({packages})` returns schema1 with `sets`, `pages`, `diagnostics` and `baseViewId`:

- `supported-adaptive-set`: package/object IDs, stored set ID/name, complete `base`/`views`, and `{version, sourcePartSha256, documentSourceId}` provenance. Each view retains its object/stored IDs, name, dimensions, cursor, parent ID and parent name.
- `unsupported-adaptive-set`: source IDs, reliably readable stored ID if available, and a reason. No partial view list is exposed.
- Page `assigned`, `unassigned`, or `unsupported-assignment`: source IDs, stored assignment, raw direct ref and package provenance; an assigned Page includes resolved set package/object IDs.
- Fatal inventory ambiguity returns `unsupported-adaptive-inventory` and no successful sets/pages. A malformed independent set does not erase unrelated complete sets. Missing/ambiguous project scope is diagnostic and does not promote orphan definitions.

References are package-local; Page assignments use project stored IDs across package boundaries. Repeated package IDs, object IDs within a package, set IDs, named IDs across sets, cycles and out-of-set parents are rejected. Repeated Base sentinel across separate sets is valid. Decoded standalone-value parts (such as library `widgetinfo`) are explicitly identified and excluded because they contain no object identities; malformed object packages cannot use this exception.

Dimensions remain literal, including0×0. A consumer must not substitute canvas dimensions and call them native declarations. The 50-view/100-set/100000-dimension limits and other resource caps are independent implementation limits, not inferred native UI maxima. The module does not recover styles, actions, events, generator ordinal IDs, global `useViews` or Master ownership.

## Real coverage and correction to the previous report

The new census re-reads all11 original files and verifies each sample SHA against the frozen prior census. It finds3 complete **Base-only** sets,0 named views,1084 Pages,0 assigned Pages,165 zero/unassigned Pages and919 unresolved assignments in Icons. All919 use a stored set ID absent from the project. They remain unsupported; no hierarchy is guessed from residual caches.

| File | Stored Base size | Cursor | Named views | Page assignments |
|---|---:|---:|---:|---|
| Default.rplib | 0×0 | 1 | 0 | 40 unassigned |
| Flow.rplib | 0×0 | 1 | 0 | 37 unassigned |
| Prototype Starter.rp | **1366×1000** | 1 | 0 | 8 unassigned |

**Correction:** the frozen `adaptive-hierarchy-format-evidence.md` prose incorrectly described all three Base sizes as0×0. Its retained raw census and current byte-verified reading show Starter1366×1000. That earlier file and manifest are not rewritten. A stored nonzero Base with Touch cursor is not by itself proof that any of these unassigned Pages uses it in an original generated player.

The new census records every package/object/stored identity, raw Base values and `sourcePartSha256`. Complete named-view or assigned-set recovery has **zero real corpus witnesses**. The positive hierarchy, cross-page assignment and parent-chain tests are explicitly self-written decoded fixtures, based on the serializer contracts; they are not original Axure exports.

## Focused verification and reproduction

The suite has **41/41 passing tests**:38 synthetic boundary/protocol cases and3 original-sample cases. The first red log records the missing new module; the green log includes atomic failures, scopes, duplicate identities, cursor values, malformed references, version and resource guards, standalone parts, and the original Default/Flow/Starter results. No full suite, build, package, browser or original application was run for this module.

```powershell
node --test research/scripts/read-rp-adaptive.test.mjs
node research/adaptive-import-sets-census.mjs
node research/adaptive-import-sets-summary.mjs
```

`research/adaptive-import-sets-fixture.mjs` exports `fixture`, `id`, `guid`, `ref`, `map`, `object`, `pack`, `get`, and `set` for independent integration tests. The summary creates the new bridge selection, evidence JSON and SHA manifest. It does not regenerate or modify historical evidence. The consumer's widget/page conversion and GUI behavior require separate validation.
