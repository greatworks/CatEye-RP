# Native Tree widget recovery — Axure RP 11.0.0.4150

The Default library now imports its actual Tree as **one Tree root, four node objects and four independently identified text labels**. This is the Tree widget, not the document/page sitemap. The implementation uses self-written static container/object readers, retained metadata/CIL, and the existing strict pure importer. No vendor DLL was loaded or executed; no original GUI capture or generated-original prototype comparison was performed.

## Exact witness and geometry

Eleven SHA-pinned samples were inspected. Only `Default.rplib` contains `Axure:DiagramObject:TreeNodeObject`: five records including the root. The other ten contain none. The library SHA-256 is `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`; page `Tree`, package `90a0737fc2d74911b0b27573a1b35a40`, native version `[11,0,0,0]`. The root ID is `c12c45f115fa475ca3030ab782caf1f4`, with stored position `(100,100)` and size `95×80`.

| Row | Native node ID | Native label ID | Node local x,y,w,h | Label local x,y,w,h |
|---|---|---|---|---|
| Item 1 | `53bf6b2066d640b087f380d64ea63d01` | `05e9c51533824f12bc61ad74cae0a512` | 0,0,64,20 | 22,0,42,20 |
| Item 1.1 | `018feb95e0c94c4a9ecc2c87ddc3064c` | `8972230951cd42b99720c6ec4dcbd3fa` | 20,20,75,20 | 22,0,53,20 |
| Item 1.2 | `e0b06e03161f472882a8876ae2208eb1` | `cfcddd63dcf74da2a8bf13a50bcab3d8` | 20,40,75,20 | 22,0,53,20 |
| Item 1.3 | `a3095c0ce0b044a495ae122be5a81ba5` | `345ed3d76d034553a32899e21706ebad` | 20,60,75,20 | 22,0,53,20 |

The first row's own style omits LOCATION. Its `(0,0)` comes from the **complete, exact library+style identity cache chain**, not a guessed zero fallback. Labels store explicit `ContainedLocation`/`ContainedSize`, have `IsContained=true`, and omit their own `MyStyle`. Their text is stored in separate rich-text blocks. Raw node, label, auxiliary image maps, offsets, style IDs and cache entries are retained in `tree-widget-format-census.json`; the compact conclusions and selected instructions are in `tree-widget-format-evidence.json`.

The root stores itself as `rootnode`, zero `parentnode`, zero `buttonshape`/`plusminus`/`icon`, and one `childnodes` entry. Each nonroot stores its root, parent, label, plus/minus ImageBox and static-icon ImageBox identities. All five `isexpanded` values are true; `rootshowplusminus=true`, `rootshowicon=false`. Nonroot Item 1's ordered `childnodes` are Item 1.1/1.2/1.3. Its `diagram-objects` sequence is **label, child1, expand image, child2, child3**. The two collections are checked separately: active membership must be complete, child order must be exact, and objects cannot be multiply owned. Leaf expand/static image records exist but are not active diagram members.

## Contained label appearance is inherited, not guessed

`KJm7.cJO3` (token **100695512**) tests `XJdz` at IL `0054`/`0059`. The contained branch obtains `LIsW()` (parent) at `0029`, then the parent's `cJO3` at `002e`; the other branch reads its own `lJZZ` at `0022`. `XJdz` is token **100695494** and `LIsW` is **100695469**. The serializer `KJm7.NIwY` (**100695637**) uses this accessor and separately retains contained location/size. These methods are in `tree-widget-format-property-cil.json` and `tree-widget-format-contained-cil.json`.

The exact default identity is style `627587b6038d43cca051c114ac41ad32`, library `53f4a189168b474893d409a1b736ad03`. The node's base TreeNode style is `93a4c3353b6f4562af635b7116d6bf94`. Every label resolves to:

- Arial 13px, weight 400, normal style, no underline/strikethrough; foreground `#333333`.
- Transparent white fill `#ffffff00`; stored stroke `#797979` with width 0.
- Left/middle alignment, padding `[2,2,2,2]`, browser `normal` line-height from automatic native rich paragraph spacing.
- Literal rich text, not expression interpolation. No active interaction style, selection/error/disabled state, or original event exists in these four labels/nodes.

Reader output makes the inheritance explicit in `treeLabelRecovery` with owner/root/style IDs and inherited fields. The label's `storedGeometry.styleId` remains **null** because there was no raw local `MyStyle`. The existing common style cache provenance is retained. Native `AutoFitWidth=true` remains a warning: the imported width is the stored snapshot. We do not claim recomputed original font metrics; `TreeNodeObject.oIwv` (**100702574**, IL `02eb`/`02f1`) contains load-time autofit behavior.

## Layout and selection anchors

Static CIL is retained from `AxureRP11.dll`, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

| Method/token | Evidence and supported conclusion |
|---|---|
| `TreeNodeObject.get_IsTreeRoot` / 100702502 | Compares the object to RootNode. Root and rows share the same native type. |
| `get_IsExpanded` / 100702503 | Reads the stored expansion wrapper. Expansion is not inferred from whether children exist. |
| `get_AttributedString` / 100702532, IL 0022–0027 | Nonroot text delegates to the separate VectorShape; root has no label text. |
| `get_ChildNodes` / 100702535 | Dedicated ordered child collection. |
| `xNYh` / 100702515 | Expansion image `(6,6)` at IL 0022–0041; 20-unit indentation constants at 0325/04d6/0594; label origin and row extent at 0443–045e and 0518–0546; child location assignment at 05ad/05b5. |
| `qNY2` / 100702514 | Recurses through children and invokes layout/root-size methods; this is static call evidence, not original GUI execution. |
| `FNiU.QNPC` / 100699668 | Gets RootNode then generated identity at 00a7/00ac; appends an unresolved suffix and calls the label group setter at 00d1. Emits label through INPr at 012b and clears the temporary group with BJqr at 0085. |
| `KJm7.BJqr` / 100695270; `vJqV` / 100695269 | Setter/getter use the same SelectedStyleGroup backing field `PJZb`; serialization reads it at 00cd. |
| `FNiU.UNPi` / 100699669 | Reads ChildNodes at 007c, emits child through INPr at 0146, consults IsExpanded at 00e4/01e6. |
| `wJe6.BJe7` / 100694312 | Reads ChildNodes at 0022, IsExpanded at 0068 and separate label identity at 00b0/00b5. Runtime interpretation as `buttonShapeId` is covered separately. |

The native empty stored `SelectedStyleGroup` therefore does **not** establish arbitrary independent selection among labels: the generator creates a root-derived group temporarily. Its exact suffix remains undecoded. The imported model preserves the empty source field; the independent runtime implements tree-root/scope selection without fabricating a persistent group string. Runtime selection, event fallback and collapse behavior have separate original-function evidence in [tree-widget-runtime-evidence.md](tree-widget-runtime-evidence.md), with 37 isolated probes. These probes are not original GUI verification.

## Expansion images and strict boundary

The two root-embedded images are exact 9×9 PNGs:

| Field | Native stream offset/length | SHA-256 |
|---|---|---|
| CollapsedImage | 12504 / 175 | `b0ec13894dda3f4c13309076278aa2b4ff3c0fc9989d9da919aa90595ea55380` |
| ExpandedImage | 12743 / 176 | `355c13dccbc66c3e84af4b4491636f997bd83e1b01b023b8d8f6c97c103fdba8` |

The reader verifies the byte range, actual digest and PNG dimensions, then maps only these witnessed identities to the product's independently drawn triangle glyph. Research copies are `tree-widget-format-CollapsedImage.png` / `ExpandedImage.png`; they are **not product assets**. Their PNG `gAMA` chunk is retained in research; the stricter general image parser intentionally does not accept it. This tree mapping uses exact byte identity, not a relaxed general image decoder.

The admitted subset requires complete node/cache identity geometry, unrotated identity transform, no shadow, 20-high rows, indent20, label22,0, no shown static icons, exact active auxiliary membership, known root triangles, and complete simple rectangle labels. Auxiliary ImageBoxes also reject unknown fields, events, transforms and shadows. Unknown fields, ambiguous references, incompatible dimensions, incomplete rich text, missing cache, custom/plus-minus images, shown static icons or unsupported style overrides reject the entire tree. No orphan node or contained label can be imported alone. A label hyperlink whose target fails later removes the whole tree and all eight nested objects; no partial hierarchy survives.

Node events reuse the existing full event/action decoder and package-scoped target checks. A synthetic event on a native node targeting its own label validates that path. The real witness has **zero events**. Auxiliary expander image identities are retained only as reader provenance, not independent runtime widgets; their Load/selection events are not claimed. More general collapsed/multilevel/variable-height layouts, original HTML tags/classes, custom icon serialization, original GUI authoring behavior and font/pixel parity remain outside this native admission contract.

## Corpus audit and verification

`tree-widget-format-import-audit.json` compares against the frozen `menu-format-import-audit.json`, checks every source SHA, performs strict serialize/parse roundtrip, and compares both previous menu graphs, standalone table matrix/geometry and both complete rich hyperlink graphs. None changed.

| Sample | Top / nested / skipped after this stage | Event count |
|---|---:|---:|
| Default.rplib | 33 / 25 / 7 | 0 |
| Flow.rplib | 21 / 0 / 16 | 0 |
| Sample form patterns.rplib | 558 / 440 / 173 | 74 |
| Sample UI patterns.rplib | 183 / 22 / 76 | 7 |
| Prototype Starter.rp | 57 / 28 / 31 | 7 |
| Prototyping Basics.rp | 173 / 52 / 26 | 2 |
| Quick Win.rp | 33 / 2 / 9 | 0 |
| UX Prototyping.rp | 126 / 0 / 27 | 6 |
| the-basics-tab-menu.rp | 3 / 2 / 0 | 2 |
| complex-interactions-required-fields.rp | 7 / 0 / 0 | 3 |
| Icons.rplib | Existing page-count limit rejection unchanged | — |

Only Default changes: **+1 top, +8 nested, −1 skipped, +0 events/actions**. Its compact semantic JSON is 1,238,119 bytes. The largest corpus output remains the form library at 25,873,524 bytes, below the existing 64MiB worker response limit.

Executed focused checks:

```powershell
node --test research/scripts/read-rp-tree-widget.test.mjs
# 26/26
npx vitest run tests/import-rp-tree-widget.test.ts tests/import-rp-menu.test.ts tests/import-rp-vectors.test.ts tests/import-rp-shapes-forms.test.ts
# 84/84, including 26 new Tree importer tests
npm run typecheck
node research/tree-widget-format-import-audit.mjs
node --check scripts/smoke-rp-shapes-forms.mjs
```

The packaged smoke script is prepared, not executed by this agent: both Preview and actual offline HTML check all nine identities, exact four labels/local bounds, collapse/re-expand and unchanged root95×80. The planned screenshot is `artifacts/tree-widget-native-preview.png`; no screenshot result is claimed here. Full production/package/browser validation belongs to the parent milestone verifier. Source digests are recorded in `tree-widget-format-evidence.json` and `tree-widget-format-manifest.json`; historical menu/table evidence remains unchanged.
