# Native Inline Frame format — RP 11.0.0.4150

The strict native reader now recovers the one real **empty Inline Frame** in the eleven-file corpus. It preserves explicit geometry, an independent border switch, and the scrollbar enum. It does not guess external/page/file destinations or native Frame actions from an unobserved carrier.

## Corpus and remaining Default objects

The previously frozen Tree milestone left these seven Default objects:

| ID | Page | Native type |
|---|---|---|
| `a242d373d93f443cb7674d57893bd3d2` | Checkbox | Checkbox |
| `b769efe672984338a41af22f1ee374af` | Snapshot | Screenshot |
| `6234f52073a3484d94162e46c8373b4c` | Hot spot | ImageMapRegion |
| `fde99102eb56443a8195d884090104ab` | Repeater - table | Repeater |
| `9f64346dd1fb40a49fd445fe3c0c05be` | Inline frame | InlineFrame |
| `d5460278ddf64fc7b390e97baaea99ca` | Image | ImageBox |
| `a9540d486f004aa5b8ce1f0d7c470ca6` | Repeater - card | Repeater |

Only the InlineFrame is admitted in this stage. Its library SHA-256 is `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`; package `3c3e2cd305e946b3b27144b535aafc99`; version `[11,0,0,0]`. The other ten files have no Frame-named native carrier. No native Frame/ParentFrame action is observed. The two non-current-page window links in the corpus are the previously supported external hyperlinks, not frame actions. `inline-frame-format-census.json` contains all sample hashes, the raw frame package closure and this inventory.

The frame's explicit local location is `(100,100)` and size `300×170`. It stores `ShowBorder=true`, `Scrollbars=1`, `Preview=0`, and `CustomImage={$map:[['Hash','']]}`. Name and tooltip are empty, VisibleFromSettings=true, IsLocked=false, IsContained=false, Disabled/Selected/Error=false; no adaptive styles, selection group or event is stored.

## Target graph

```text
InlineFrame 9f64346dd1fb40a49fd445fe3c0c05be
  DefaultTarget -> InteractionTarget 9fddda23e2ac451197c2abc462983aef
    target-type: 0 (WebUrl)
    target-page-id: zero, referenceTag19, name Axure:Page
    target-literal -> Expr:StringLiteral 4b21887860e442319f96c6acb899a65b
      value: ""
      variable-identifiers: []
      repeater-scope: zero ref3
      TargetRepeaterScope: zero ref3
```

This graph maps to an omitted product `target`, preserving a blank frame. Every field and reference shape is checked; unknown/duplicate fields, missing target/literal records, wrong types, variables, scope references, nonempty literal or nonzero inactive page cause whole-frame rejection. Literal addresses were never fetched or executed.

`IxTargetType` is independently enumerated as WebUrl0, Page1, ReloadPage2 and BackUrl3. There is **no distinct native File enum** in this target type. It would be incorrect to infer that arbitrary literal text can safely be classified into URL/file or to reuse local-file privileges. Native internal/external/file initial destinations remain explicitly unsupported by this import subset. Product authoring capabilities are a separate contract.

## Native enums and CIL anchors

All CIL is read as ECMA-335 metadata/bytes, never by loading or executing the target assembly. Assembly SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

| Property | Native type / values | Product mapping |
|---|---|---|
| ShowBorder | bool field GNm4 | hideBorders = !ShowBorder |
| Scrollbars | FrameScrollBars, TypeDef33557491, getter signature `200011AFCC`: Auto1, Scroll2, Hidden3 | auto / yes / no |
| Preview | FramePreview, TypeDef33557492, getter signature `200011AFD0`: None0, Custom1, Video2, Map3 | Only witnessed None admitted |
| LinkType | Invalid0, Current1, New2, Popup3, Parent4, Frame5, ParentFrame6 | No new native frame action decoding in this stage |

Getter tokens are DefaultTarget100700876, ShowBorder100700878, Scrollbars100700880, Preview100700882 and CustomImage100700884. `InlineFrame.NIwY` token100700893 calls them at IL0065/0097/00c9/00f5/0120, followed by their individual writes. The raw sample proves the stored field names; obfuscated string literals are not executed or claimed decrypted. `oIw4`100700894 reads corresponding setters and also contains legacy string branches, outside current admission.

**Stored library value and constructor default differ.** Constructor100700869 sets Auto1 at IL0034–0035 and ShowBordertrue at007a–007b, but Preview **Custom1** at0096–0097. Constructor100700870 also sets Custom1 at0052–0053. The actual Default library stores Preview **None0**. Therefore a product author's default preview None is a product choice; this report does not call it the native factory default.

`FNiU.PNPm`100699676 passes ShowBorder and Scrollbars separately to `BNCJ.uNCI`100699504 at IL0055/005b/006d and to the CSS writer `JNLP.SNLp`100699217 at00f3/00f9/0100. This path does not call Preview/CustomImage getters. Those choices must not be treated as the embedded runtime page. Exact obfuscated HTML attribute spellings/CSS border pixel values are not decoded here; `auto/yes/no` and `frameborder0/1` are the product's standard HTML mapping.

## Why the wrapper does not use recovered shape style

The frame's MyStyle object `dc74a8d3370b42ed953308a2e50e16cb` contains only determined+overridden LOCATION101 and SIZE105. Its MatchInfo names an Inline Frame base, but there is no base-style PName0 pointer. The existing complete style-cache resolver correctly reports `cacheChainComplete=false` and no recovered style values. This stage does not loosen that resolver or merge a guessed cache entry.

Frame import validates that the local property list contains exactly those two explicit geometry properties, uses transparent fill/zero ordinary stroke as a neutral product wrapper, and puts the actual border flag in `inlineFrame.hideBorders`. The generic default font fields in the document are not asserted as recovered native fonts. The report retains the unresolved style/cache provenance. Extra local style, rotation, transform, adaptive geometry, initial disabled/selected/error or injected interaction style is rejected.

## Action boundary

`IxLinkFrameAction.get_FrameToTarget`100704482 reads dictionary field ENQL. Serializer100704486 enumerates dictionary key/value pairs (`get_Value` IL0097, `get_Key`0107) and uses CurrentLinkType at01a8. The keys are DiagramObjectPath and values IxTarget; this is a different carrier from the existing single-target LinkWindowAction. `get_CurrentLinkType`100704489 reads ENQK; `get_IsChildFrame`100704491 consults the current type.

There is no raw serialized frame-action object in the eleven samples, and the exact action property literals remain obfuscated. Accordingly no native Frame/ParentFrame action is guessed. Existing event atomic rejection remains intact: unsupported actions never become partly recovered cases. Retained source files are `inline-frame-format-action-cil.json`, target/object/html CIL files and `inline-frame-format-metadata.json`.

## Reader/import protocol and results

`typeCandidate={type:'inlineFrame',mapping:'native-inline-frame'}` accompanies `inlineFrameRecovery` with status `supported-inline-frame`, hideBorders, scrolling, preview `{kind:'none'}`, and exact target/literal/style identities, native enum values and empty target fields in `source`. The importer independently validates the protocol, identity uniqueness, literal/scopes, explicit geometry and style policy. Unknown protocol keys or a recovery payload attached to another type are rejected atomically. This is a strict subset, not full Inline Frame compatibility.

`inline-frame-format-import-audit.json` pins the preceding `tree-widget-format-import-audit.json`, verifies all eleven source hashes, strict save/open and unchanged full graphs for the previous Tree root+4nodes+4labels, both Menus, standalone Table and both rich hyperlinks. Default changes from33/25/7 to **34 top /25 nested /6 skipped**. Every other sample count remains unchanged; Icons retains its prior page-budget rejection. Added events/actions: **0**. Largest compact response remains the form library at25,873,524 bytes; Default is1,238,814 bytes.

Executed focused checks:

```powershell
node --test research/scripts/read-rp-inline-frame.test.mjs
# 28/28
npx vitest run tests/import-rp-inline-frame.test.ts tests/import-rp-tree-widget.test.ts tests/import-rp-vectors.test.ts tests/import-rp-shapes-forms.test.ts
# 93/93, including31 new frame importer tests
npm run typecheck
node research/inline-frame-format-import-audit.mjs
node --check scripts/smoke-rp-shapes-forms.mjs
```

The native packaged smoke script is prepared for Preview and actual offline output: actual Default frame metadata/300×170, independent frameborder1, scrollingauto, blanktarget/srcabout:blank and `inline-frame-native-preview.png`. The parent runs that package verification; no packaged/GUI result is claimed here. Original GUI comparison, browser URL/file security behavior and full nested-frame runtime are separate investigations.
