# Native adaptive style import: declarations, references and behavior

This is a bounded, read-only investigation of the retained Axure RP **11.0.0.4150** distribution. Only new `adaptive-import-styles-*` research files were written. No product, parser, test, historical evidence, or source sample was modified. The work did not operate the original GUI or execute the managed DLL.

The new evidence consists of a pure join of frozen raw-object records and **58 passing exact-source JavaScript NodeVM cases**. DOM styling, scrolling, image conversion and final painting are explicit sinks; this is not a generated-page pixel comparison. Full original-file hashes, sample hashes, slice ranges and dependencies are in the JSON files.

## Corpus result and recovery opportunity

The phrase “25 nonempty AdaptiveStyles” means 25 owners have nonempty **view-to-style reference arrays**. It does not mean 75 nonempty visual patches.

| Source | Owners | Referenced styles | Owner types |
| --- | ---: | ---: | --- |
| Default.rplib | 2 | 6 | Repeater |
| Flow.rplib | 13 | 39 | VectorShape |
| Sample form patterns.rplib | 8 | 24 | Repeater |
| Sample UI patterns.rplib | 2 | 6 | Repeater |
| Other seven retained samples | 0 | 0 | — |
| Total | **25** | **75** | **13 VectorShape, 12 Repeater** |

All 75 targets are package-local `Axure:Style` objects with explicit `All=false` and **`PropList:[]`**. Every owner has exactly three distinct view keys; all owners store `IsContained=false`. All 12 repeaters also have explicit empty `AdaptiveRepeaterStyles:[]`. There are six distinct view GUIDs, none matching a declared view in the same source snapshot. No referenced property list contains even a non-OD property. All 11 original sample hashes were checked before and after the join and remain unchanged.

All 13 Flow vector owners are absent from the frozen `text-autofit-import-audit.json` vector-node list. This is a concrete potential admission gain, **not a measured current importer delta**. That frozen vector audit cannot establish repeater admission. The new census records source/package/object identities for every owner, rather than deduplicating the repeated form-library object IDs across packages.

Pages have separate stored `page-style` and `AdaptiveStyles` properties. The frozen full inventory has **zero nonempty Page AdaptiveStyles**. The retained full-object snapshots provide direct explicit-empty witnesses for all40 Default pages, the1 tab-menu page and both required-fields pages. Do not interpret zero nonempty Page records as proof the Page property does not exist. Page adaptive styles, when present, need a separate page-level representation; they are not widget overrides.

The safe storage interpretation is an **empty local ordinary declaration for an unresolved view key**. Keeping it as an inactive page override preserves data without fabricating a view definition. It must not become `stateStyles:{}`, which would suppress inherited interaction styles. The missing view's name, dimensions, inheritance parent and set membership cannot be inferred from the orphan GUID or the style name `adaptive style`.

An empty raw PropList does not prove that every emitted native JSON object is literally `{}`: the ordinary generator also accepts a widget font provider and performs type-specific processing. The restricted recovery claim is “preserved empty local declaration,” not “reproduced every byte of generated style.”

## Reference and identity contract

The stored map is an alternating array:

```text
[ {$guid: nativeViewId}, {$reference: styleObjectId, referenceTag: 3}, ... ]
```

Resolve the tagged reference against **the same object package**. The referenced object's own `Id` field is a style identity and is not its object-graph key. Internal style IDs repeat across package copies. For example, Default's `Table repeater`, owner `fde99102eb56443a8195d884090104ab` in package `51731aceeba44bd89cb6863da9c0ed88`, maps view `ecbbf17ca51e42e0a49c35d3edc84510` to object `98c11ef6f0554cf0b1701bc26a38f396`; that object's stored style ID is `fce8c2643237462db5b384fd669cfe3b`.

The native widget writer `wJe6.jJeK` (**100694305**) maps the view GUID through generator context `QNx2` at IL1155 (or the separate alternate branch), then skips an unresolved mapped key at IL1210. Thus the generator itself does not invent a selectable view for every raw key. Preserving orphan declarations in the independent model is a lossless-storage choice; they remain inactive until an explicitly valid view definition is associated.

Minimum validation before accepting a map:

1. Explicit array; even length; exact GUID keys and local referenceTag3 values; no duplicate native view IDs.
2. Exactly one same-package target with the referenced object ID and expected `Axure:Style` type; validate the target property map, including duplicate keys and supported metadata.
3. Explicit PropList array, valid DOAName integers, unique PName values; never convert missing/malformed data into an empty patch.
4. Resolve declared set/page membership independently. Keep orphan and unsupported diagnostics separate from unrelated base-widget recovery; do not guess a parent chain or discard every otherwise recoverable owner.
5. Preserve the native view identity namespace consistently between set definitions and inactive page declarations. Do not resolve package-local style object references against a global map of style identities.

## Which local properties are declarations

The adaptive branch of `jJeK` clones its style at IL1248 and calls the ordinary `EJep` writer at IL1385/1417. `EJep` (**100694319**) invokes specialized font writing at IL74, then obtains all properties at IL80, filters with `RtTr` at IL85, and dispatches `rJeU` at IL93. `rJeU` (**100694323**) again uses `RtTr` at IL14.

The retained predicate chain is `RtTr` **100717059** → `<OD>b__21_0` **100717092** → `a5FY` **100717956**. It requires a non-null property, Overridden and not Indeterminate. Persisted flags mean:

```text
eligible = property exists AND (DOAName & 0x40000000) != 0
                           AND (DOAName & 0x80000000) != 0
```

This is the same exact predicate previously interpreted from retained CIL in `selected-style-filter-evidence.json`. It is an admission requirement, not a guarantee that every native eligible property has a supported converter. The ordinary font provider is an additional source: `jJeK` supplies `widget.lJ0A(view)` at IL1380/1412, whereas recursive IX_STYLES writes pass null at `rJeU` IL1039. Do not apply the local filter to an already materialized named/default style cache as if it were the same kind of record.

The existing `recoverStyle` returns a complete effective appearance, with cached/base fallback, uniform rich-run fallback and path-derived corner geometry. Its whole output is not a sparse adaptive declaration. A local converter may reuse the **value converters**, but should emit only fields triggered by eligible local properties. Local equality to Base is still an explicit declaration and must not be removed by a value-diff optimization.

## Runtime merge and atomicity

`style.js:1794–1847` applies normal adaptive styles ancestor → leaf, resolving each optional named `baseStyle` before its local fields. Each operation is a shallow `$.extend`. `:1869–1879` combines document defaults, named object style, object style, current panel diagram style, then those overrides. The new VM cases execute these functions directly.

| Native local property | Safe supported mapping / required boundary |
| --- | --- |
| 101 LOCATION | Complete finite `{X,Y}` → both `x,y`; retain negative/zero values. Native location is one replaced object, not independently merged coordinates. |
| 105 SIZE | Complete finite `{Width,Height}` → both dimensions within product validation bounds. A half-size object must not inherit the missing axis silently. Fit-to-content panels are a separate generator branch: `jJeK` IL1280–1325 computes size and panel padding before writing. |
| 110 VISIBLE | Explicit Boolean → `hidden = !visible`. Absence inherits. The consumer tests `visible === false`, not generic falsiness. |
| 111 PLACED | Generator `rJeU` IL396–450 negates the Boolean for the runtime limbo concept; limbo is not ordinary hidden. Current model has no complete limbo representation, so retain a specific unsupported diagnostic rather than lowering it to hidden. |
| 7 FILL / 8 BORDER_FILL / 6 FORE_GROUND_FILL | Atomic native paint objects. Use already established solid/linear/radial gates. A solid declaration clears an inherited gradient; do not merge its colors/stops into the inherited object. Foreground support remains its existing bounded subset. |
| 72/73/74 shadows, 17 line ends, 80 border visibility | Whole native values. Use previously proved type/value gates and preserve explicit off/none/false fields. Do not merge individual line endpoints or shadow fields. |
| 1/2/1001/1002/5/95 | Existing font family/size/weight/style/underline/strike converters, but only for actual local eligible fields. P2 uses the separately proved stored-size conversion. Unsupported style enums remain unsupported. No uniform-rich-run fallback should manufacture a local delta. |
| 9/10 alignment | Existing horizontal/vertical enum gates. Native individual fields remain separate declarations. |
| 11/12/13/14 padding | Four **independent** native properties (left/top/right/bottom). Complete local quartets can map to the model TRBL tuple. Partial quartets cannot safely be completed from the current Base: that would freeze inherited sides and change descendant-view behavior. Either model independent declarations or diagnose the unsupported partial tuple. |
| 20 LINE_SPACING | The present generic mapper only establishes an automatic/normal subset with matching paragraph evidence. Do not treat every local number as normal or arbitrary CSS pixels without the existing specialized text evidence. |
| 71 CORNER_RADIUS / 81 CORNER_VISIBILITY | Existing base recovery derives corners from the native path. That is not proof that an arbitrary adaptive pair can reuse the same static candidate path. Require the independent local geometry conversion, or preserve a precise unsupported diagnostic. |
| 50 ROTATION | Reuse only the established pure center-rotation/type/text/transform gate. P51 TEXT_ROTATION, active P1401 TRANSFORM and P1402 origin are distinct and must not disappear. |
| 0 named style reference | Resolve explicit matching style/library identity and complete cache provenance. Do not assume a GUID-only reference or a default library. Normal and state named-style handling should preserve actual precedence, not flatten unknown inheritance. |

`setAdaptiveStyle` (`style.js:2377–2416`) applies text/paint and performs SVG size work. Its location assignment is commented out at2411–2415: generated CSS supplies important geometry. The JS merge probes prove values/precedence, **not complete final generated positioning or every native type's resize equivalence**. Master viewOverride chains, images/compound assets and adaptive repeater configuration are separate native behaviors and need their own supported representation.

## State maps, contained owners and rich text

Outer P21 is one atomic map. Its eligible empty collection writes `stateStyles:{}`; absent or ineligible P21 emits no state-map declaration. Each inner state style again goes through the local OD filter with no separate widget font provider. The existing retained format report closes the `StateStyles` → `stateStyles` key and recursive writer.

`style.js:1849–1866` searches leaf → ancestors. A present state entry, even `{}`, wins; a truthy state map with no matching entry returns `{}` and blocks older maps. An entirely null state map falls through in raw JS, while a null entry in a nonempty map blocks. Those malformed-storage possibilities are not a recommendation to accept null in the importer. Numeric zero, a malformed map or a missing target are not proven substitutes for an explicit empty collection. Zero-GUID references must retain their typed null-reference meaning; they must not be fabricated as resolved empty style objects.

The supported seven keys are mouseOver, mouseDown, focused, selected, error, hint and disabled. The JS also consumes `normal`; an encountered native Normal state must be diagnosed until the model supports it. Normal view `{}` and P21 `{}` therefore require different output shapes:

```text
empty ordinary local PropList       -> override {}
eligible P21 with zero state entries -> override {stateStyles:{}}
eligible P21 with Selected empty     -> override {stateStyles:{selected:{}}}
```

State overlay order is Normal → MouseOver → MouseDown → Focused → Selected → Error → Hint → Disabled, subject to the original generated state token/gates. The previous frozen 234-case state report covers existence gates separately from the effective-map barrier. Do not infer focus capability merely from the effective patch being nonempty.

A contained label uses its own normal adaptive style but climbs to its containing owner for state-map lookup. `_applyAdaptiveViewOnObject`, `adaptive.js:271–317`, skips direct adaptive paint and limbo collection for contained objects; its hidden-ID collection itself has no containment test, with later visibility processing providing additional exclusions. Product parentage alone must not manufacture native `isContained`.

Rich replacement is another distinction: `_shapesWithSetRichText` causes direct normal adaptive font fields to be removed from a copy before normal overlay; state fonts still apply. A named normal adaptive style can still supply a font because the removal only touches the local copied object. The new probe records that exact quirk. Do not use adaptive local import to rewrite original rich runs or erase links.

## Cursor is actual player behavior, not a widget style

The retained source chain is complete:

- `plugins/sitemap/sitemap.js:251,274–275`: writes `defaultView.cursor` / `currView.cursor` into each view row's cursor attribute.
- `resources/scripts/player/axplayer.js:1654–1673`: reads current view dimensions/cursor. A nonzero declared height makes `isDevice` truthy; width alone does not. `:1749` posts `setDeviceMode` with numeric cursor.
- `adaptive.js:522–580`: ignores this message outside the original player. In device mode on desktop, cursor0 sets `default`; other values set the local touch-cursor resources and class. Mobile devices skip that emulated cursor branch. Leaving device mode clears the cursor and class.

Static metadata in the peer's `adaptive-import-sets-metadata.json` binds Desktop=0 and Touch=1. Actual Base witnesses are **Default0×0/Touch**, **Flow0×0/Touch**, and **Prototype Starter1366×1000/Touch**. The third can activate player device behavior; it is incorrect to summarize all three as inert0×0 defaults. Preserve cursor as view/player metadata or explicitly report its unimplemented presentation behavior. It is not appropriate to set every widget's CSS cursor from this field or let it alter adaptive breakpoint selection.

These are set-level records. The peer's set-reference audit establishes no page assigned to those three sets in the current corpus; therefore the nonzero Starter Base record alone does not prove any actual page currently displays a device cursor. The control-flow capability and the source metadata are established separately from a live page assignment.

The VM also records an original branch quirk: Touch→Desktop while remaining in device mode assigns `cursor:default` but does not remove `mobileFrameCursor`; leaving device mode does remove it. There is no real cursor screenshot claim. The independent preview does not implement the original player's entire device frame/zoom/gesture subsystem merely by storing the enum.

## Protocol suggestion and acceptance

Keep parsing and attachment separate. Each native owner record should expose an ordered list of `{nativeViewId, sourceStyleObjectId, sourceStyleIdentity, localProperties, status, override?, diagnostics}`. `status` distinguishes fully recovered local declaration, unsupported declaration and invalid reference graph. Association separately distinguishes declared/active versus orphan/inactive. Preserve source/package hashes and all unsupported property IDs/values in diagnostics.

For a recovered empty local declaration, attach `{}` under the consistently mapped view ID and imported widget ID. Do not add a view or state barrier. Unknown active properties should reject the **affected declaration's conversion** with a visible diagnostic, not silently produce a partial patch. Whether an incomplete active declaration blocks the owner's import is an integration policy that must prevent a false claim of full behavior; unrelated recoverable widgets and inactive raw metadata need not be discarded.

Focused acceptance should cover malformed/missing/cross-package references; duplicate keys; all four OD combinations; empty local versus empty state map; same-as-parent explicit declarations; atomic full geometry/paint; explicit visible true/false; limbo diagnostics; partial padding rejection; parent and child state barriers; named-style identity mismatches; inactive unknown view preservation; save/reopen IDs; and the real 13 Flow owners. Any resulting import-count changes must come from a new parent-owned audit, not from rewriting old baselines.

New files can be replayed independently:

```powershell
node research/adaptive-import-styles-census.mjs
node research/adaptive-import-styles-probe.mjs
node research/adaptive-import-styles-summary.mjs
```

The report deliberately does not claim native GUI parity, complete CSS geometry, general transforms, Normal-state import, partial tuple fidelity, master overrides or all repeater adaptive properties. These are concrete representation/conversion gaps, not reasons to erase the 75 verified empty local declarations.
