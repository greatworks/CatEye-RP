# Adaptive sets, state maps and view actions — native format evidence

Target: the retained Axure RP 11.0.0.4150 `AxureRP11.dll`, SHA-256
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
This investigation reads metadata/CIL and the eleven original corpus files. It
does not load or execute the target DLL, launch Axure, generate an original
prototype, or claim original GUI equivalence. The replay below interprets a
bounded set of decoded instructions with explicitly documented dependency stubs.

## 1. Scope and usable result

Native adaptive definitions belong to **project-level view sets**. A Page stores
a set identity; several Pages can resolve to the same set and view identities.
Widget styles remain associated with each diagram object's view-ID map. This is
different from an independent definition list on each page. The new independent
editor model uses project definitions plus page-local override maps accordingly.

The real corpus contains residual adaptive styles and shared set IDs, but **no
complete named-view set assigned to its pages**. This stage does not expand
native RP import. In particular, orphan references are not converted into guessed
hierarchies or runtime actions.

## 2. Project set and Page ownership

| Evidence | Exact path / meaning |
|---|---|
| `document-cil`, `set-lookup-cil` | DesignDocument's `AdaptiveViewSets` collection; `dtZ8.ftZA` token **100716686** resolves by set ID. |
| `set-predicate-cil` | Predicate **100716755** compares the requested Guid with `itPU.itPs`, the set ID. |
| `page-cil` / `scope-set-cil` | `IJvQ.OJAL` **100697112**: ordinary Page reads `MJAz` field **67124485** and looks it up in the document; Master reads its direct set field `xJAo` **67124484**. |
| `page-type-cil`, `master-type-cil` | Confirms these branches are `Axure:Page` and `Axure:Master`, respectively, rather than inferred from obfuscated names. |
| `scope-set-cil` | `jJvm.AdaptiveViewSet` **100697000** resolves the owning diagram's set. |
| `page-views-cil`, `page-views-iterator-cil` | Getter **100697001**, iterator **100697027**, enumerate the resolved set's `mt7r` named-view list. |

The stored keys witnessed are `AdaptiveViewSetId`, `AdaptiveViewSet`,
`AdaptiveViewMatchInfos` on Page, and `Id`, `Name`, `DefaultAdaptiveView`,
`AdaptiveViews` on the set. `ParentAdaptiveViewSet` is the view's back-reference,
distinct from a view's `BaseViewId` inheritance parent.

The native default Base sentinel is **19e82109-f102-476f-9335-82835c373474**;
the Auto sentinel is **982030d6-73df-4586-8f11-149ca2b8b02f**. Base is not
Guid.Empty. Earlier hierarchy evidence contains the static sentinel creation.
The independent model represents Base by an omitted parent ID instead of
persisting the native default's self-parent.

## 3. Page reassignment is a matching migration

`IJvQ.vJQM` **100697117** constructs match information from the old set's named
views, stores the new set ID (IL203), and invokes `oJQ7` **100697128**. The latter
calls `itPU.ftPT` **100715550** / `htPf` **100715549** to match each old view.
The exact priority is:

1. Match default Base ID, then a named ID.
2. Otherwise match the first named view whose **stored name is exactly equal**.
3. Case differences, empty names and unmatched names do not produce a match.

`ltiO.Wtin` **100715433**, `Lti8` **100715434**, predicates **100715444** /
**100715440**, and `Bbib.xbP2` **100689107** prove exact name/Guid comparison
and first-result behavior. Neither dimensions nor parent relationships are
matching criteria. The assignment loop enumerates named views, not Base, so it
does not migrate Base/MyStyle through this path.

`IJvQ.RJQ2` **100697129** and `KJm7.hIs2` **100695534** migrate page and widget
adaptive styles. If the target style is missing/empty, the source moves to the
new key. If the target exists, its `OverriddenProps` are retained and reapplied
over the moved source. Thus target local properties win; target non-overridden
cached values do not. The old key is removed after a match. An unmatched old
key is untouched and remains inactive. `WtTU.WtwM` **100717150** supplies the
overridden-props collection. P21 is one property, so a target state map replaces
the source map as a whole rather than merging individual states.

`adaptive-behavior-format-remap-replay.mjs` interprets the actual `htPf` and
`hIs2` CIL control flow. **13/13** cases pass: six lookup cases, seven migration
cases. The JSON preserves executed offsets, inputs, expected and actual results.
Collection access, exact-match helper calls and explicit property flags are
stubs; `Style.IsEmpty` is represented by zero properties only for these fixtures.
This is not a native application or generated-page execution test.

## 4. Set lifecycle and explicit product boundaries

`dtZ8.DtYS` **100716724** adds an existing set or constructs a new one when its
argument is null. `TVlY.CVlf` **100676288** constructs/copies set data and, for a
Page assignment branch, uses `WSHZ.Commit` **100706529**; undo **100706530**
calls `vJQM` with the previous ID. There is no evidence here that every new Page
automatically receives a set.

`OVyY.cVyA` **100676348** asks whether to delete an adaptive set, explicitly
warning that deletion cannot be undone. It calls document `otYt`
**100716726**, which removes the indexed set, then refreshes its UI. The inspected
handler/refresh do not prove full downstream Page-reference cleanup. Therefore
the independent editor deliberately rejects removal of a referenced set and
requires reassignment/detachment first. This is a documented product safeguard,
not a claim about every native deletion side effect.

The previously established native *view* deletion reparent rule remains: direct
children take the removed view's parent. Independent set edits apply this rule
and remove only deleted view IDs' overrides on pages assigned to that set.
Unrelated inactive maps remain. Deleting widgets prunes their IDs from both
active and inactive maps.

## 5. P21 state maps: absence, empty map and state entries

Stored property **21 / IX_STYLES** uses `FtXa`. Its string/enum setters
**100715987** / **100715989** and enumerator are retained in `state-map-cil`.
The generator `wJe6.EJep` **100694319** visits eligible properties through the
previously established Overridden-and-not-Indeterminate filter.

`rJeU` **100694323**, IL643–656, obtains the property name through `OJev`
**100694324**, `mJG4.Name`, then `AJCR`. The static name table's literal
**StateStyles** at IL2988 becomes generated `stateStyles`. At IL960 the writer
recognizes `Prop<FtXa>`, opens a map at IL984, enumerates it at IL993, converts
each style name to a lower-first-character key at IL1017–1022, and recursively
calls `EJep` at IL1040 with `(false, null)`.

Consequently, on this writer path:

- Absent/non-eligible outer P21 does not emit a `stateStyles` key.
- An eligible P21 with no entries emits `{}`.
- A named entry with no eligible inner properties still emits that state as `{}`.
- No state-by-state inheritance merge occurs inside this JSON writer.

The effective upstream inheritance/materialization policy is separate from
serialization. `bVk8.CVko` **100673788**, `QVkz` **100673789**, `UVcB`
**100673791** build/edit state collections and clone missing standard entries,
but the exact adaptive author command committing a complete effective map has
not been closed. The independent editor's whole-map snapshot when editing an
effect is therefore labeled an authoring design choice. No `normal` key was
observed in the eleven samples, and no native UI authoring route for it is claimed.

## 6. Set Adaptive View action and Page event

`IxSetAdaptiveViewAction` is `Axure:InteractionSetAdaptiveView`. Its reader/writer
**100705052** / **100705051** store `set_adaptive_view_id` (Guid) and
`set_adaptive_view_to_auto` (bool). The ID getter/setter are **100705047** /
**100705048**. Generated action writer `wJe6.tJMh` **100694374** uses key
`setAdaptiveViewTo` and value `zNo6` **100705050**:

- Auto flag true → literal `auto`.
- Auto false + native Base sentinel → literal `default`.
- Guid.Empty or unresolved named selection → null/omitted value.
- Resolved named selection → encoding of its owning set list index using
  `Qbx3.Tbxk` **100688792**, radix26/mode3, not the original Guid.

`Vbxc` **100688793** is the integer encoder; `qbxR` **100688790** mode3 selects
field `sbxe`. Its initializer **100688797**, IL55/65, reads the literal
`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`; radix26 limits
this use to the lowercase alphabet. This is not a decimal-index string.

The generated view's ID uses `xNxg.QNx2` **100699386**. Base becomes the empty
string; named IDs come from `LNee` **100699353** / field `YNMq`. The population
of that context dictionary is the remaining narrow hook needed to prove its
exact equivalence with action ordinal encoding. It is not inferred from similar
names. Runtime evidence independently proves `auto`/`default` special handling
and passes any other generated string through as an ID.

`IxEventType.OnAdaptiveViewChange` field **67121749** has value **338**. The
eleven samples contain no such event and no Set Adaptive View action/literal.
The general event carrier is known, but this does not provide a positive native
import fixture for the new event/action.

## 7. Global `useViews` is not generation-selection settings

The ordinary project configuration writer `cJFt.VJFD` **100691574** writes
literal key `useViews` at IL373 and **constant true** at IL378–380. This inspected
writer does not read a Page-specific switch or `GenerateAllAdaptiveViews` there.
Alternative generation modes and all caller reachability were not exhaustively
audited. `GSrn` separately serializes `GenerateAllAdaptiveViews` and
`AdaptiveViewsToGenerate` (getters **100705822/100705824**, writer **100705892**).
Those are generation range options; they must not be equated with runtime
`configuration.useViews` by name alone. All eleven observed config records have
GenerateAllAdaptiveViews=true; none carries AdaptiveViewsToGenerate.

## 8. Exact corpus coverage and importer boundary

`adaptive-behavior-format-census.json` retains every record's sample SHA, package
SHA/version, object ID and relevant raw fields. It scans **11 files / 41,662
objects**, with no unsupported package failures:

| Item | Count / observation |
|---|---|
| `AdaptiveStyles` fields | 4,698 |
| Nonempty arrays | 25 owners: Default2, Flow13, Form8, UI2 |
| Resolved adaptive-style targets | 75, three alternating Guid/reference pairs per owner |
| P21 in those 75 adaptive styles | 0 |
| Page records | 1,084; all direct AdaptiveViewSet refs zero |
| Nonzero Page set IDs | 919 Icons pages share `6da3246bd13b4df68c5677f8b810703b`, missing its set object |
| Complete set objects | 3: Default, Flow, Prototype Starter; named arrays empty |
| Raw P21 style records | 1,223, including ordinary/non-adaptive state maps |
| New action / event witnesses | 0 SetAdaptiveView, 0 AdaptiveViewLiteral, 0 event338 |

The shared nonzero ID is an actual format witness, not a complete assignable set.
These limited results justify the editor model structure and strict future
import requirements; they do not justify recovering the residual maps today.

## 9. Independent implementation and validation

New `src/model/adaptive-view-sets.ts` exposes create/convert/assign/update/remove,
`resolveAdaptivePage(doc,page)` and `commitAdaptivePage(doc,effectivePage)`.
Definitions project onto pages for existing adaptive helpers, then commit back
without embedding shared metadata in each Page. Conversion explicitly requires
native-size mode; legacy maximum-width selection is not silently changed.
Detaching preserves Base size and content, with no named views. Stored names are
preserved exactly. Metadata-only edits preserve map absence as well as explicit
empty maps. Native ID/name migration is implemented for local declarations with
whole state maps and atomic paint/reset fields. JSON validation remains the
parent-owned trust boundary.

The new suite has **33 focused cases**. With hierarchy/state-style/legacy-model
suites, **108/108 passed**; TypeScript check passed. Red output records the missing
new-module baseline. These are independent model tests, separate from the 13 CIL
replay cases and from native GUI coverage. The RP importer remains unchanged.

Reproduce the focused model run:

```powershell
npx vitest run tests/adaptive-view-sets.test.ts tests/adaptive-hierarchy.test.ts tests/adaptive.test.ts tests/adaptive-state-styles.test.ts
node research/adaptive-behavior-format-remap-replay.mjs
node research/adaptive-behavior-format-summary.mjs
```

The summary generator hashes this stage's artifacts, its frozen dependencies and
the original sample bytes. Historical reports and manifests are not rewritten.
