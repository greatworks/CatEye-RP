# Selection controls and fitted panel layout: narrow native evidence

Date: 2026-10-13. Target distribution: Axure RP 11.0.0.4150, `AxureRP11.dll` SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. This investigation used the existing own `.rp` container/object reader, static metadata/CIL, and read-only shipped JavaScript. It did not load/execute the original DLL or JavaScript, use the original GUI, decrypt its string table, or change production source.

**Observed** below means stored sample data or readable native script. **Corroborated** combines metadata/CIL with those observations. **Derived** means a calculation for the explicitly supported geometry subset, not an original rendered screenshot.

## Evidence and reproduction

- [rp-selection-layout-samples.json](rp-selection-layout-samples.json): package-local object IDs, exact native fields, local styles, relevant cached style chains, selected-style references, and derived state rectangles.
- [rp-selection-layout-audit.mjs](rp-selection-layout-audit.mjs): research-only real-sample assertions and reproducible evidence extraction; run `node research/rp-selection-layout-audit.mjs` from the repository root. It only writes the preceding dedicated research JSON file.
- [rp-selection-layout-js-evidence.json](rp-selection-layout-js-evidence.json): 16 original-source excerpts with source paths, SHA-256, and one-based line numbers. These snippets are research evidence and are not product runtime code.
- [rp-selection-layout-manifest.json](rp-selection-layout-manifest.json): SHA-256 and byte size of all retained JSON/CIL/helper records, plus existing PName metadata and the static reader. New CIL files use the `rp-selection-layout-` prefix.

| Sample | SHA-256 |
| --- | --- |
| the-basics-tab-menu.rp | `0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4` |
| Quick Win.rp | `04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051` |
| Default.rplib | `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50` |

The samples are evidence of these stored documents, not a complete format specification. Method-name matching in the PowerShell reader is case-insensitive; use retained MethodDef tokens to identify methods unambiguously.

## Tab Menu: missing local locations are explicitly inherited

The panel object `c909f8f46aa742d4a7e1677418cdac66` has local LOCATION `(50,90)`, local SIZE `10×10`, `fit-to-content=true`, `is-fixed=false`, and `is-percent-width=false`. The stored `10×10` is not a proven displayed size. Its ordered state references are:

1. State1 package `23eeb8170eeb46959589f1496236e76b`, containing `880ff8c9e9b14ebeba025eee03a2b75b` (Tab 1 Content).
2. State2 package `cd27998bdbb547138fc87312c1037656`, containing `2efa74ba1423425db32bfe2a3f113dca` (Tab 2 Content).

Each state contains exactly one rectangular VectorShape with local SIZE `300×170`, no local LOCATION, `AutoFitWidth=false`, `AutoFitHeight=false`, `Selected=false`, `Disabled=false`, and explicit visibility true. Its cache chain is complete: the document default `627587b6038d43cca051c114ac41ad32` stores determined LOCATION `(0,0)`; matched Box 1 base `4b7bfc596114427989e10bb0b557d0ce` has no overriding properties; local properties override SIZE and fill but not LOCATION. This is evidence for inherited `(0,0)`, **not** a general rule that absent LOCATION means zero.

The effective location record has raw DOAName `-1073741723` (`0xc0000065`, PName 101) and both determined/override bits set in its cached source. Record provenance as `cached-document-default`; do not rewrite it as a local stored coordinate. Both PanelDiagramStyle objects have empty local PropList. There are no adaptive overrides, active outer shadows, or rotations in these two content shapes.

For this specific simple content, both state bounds are **derived 300×170**. The panel's page origin remains `(50,90)`, and each child's state-local origin remains `(0,0)`. Neither the panel nor its children should be translated by the minimum child coordinate when fitting.

## Fit-to-content: implementable runtime subset

The shipped `repeater.js:2022–2085` `_updateFitPanel` reads the selected state's content children bounds and sets `size.width = childrenRect.right`, `size.height = childrenRect.bottom`. It is not the union of every state and is not `right-left` / `bottom-top`.

The underlying `axQuery.std.js:1325–1352` algorithm:

- Initializes right and bottom to **0**.
- Skips missing objects, limbo objects, invisible objects, fixed dynamic panels, and empty layer bounds.
- Reads each eligible child's `offsetBoundingRect()` and takes maxima of right/bottom.
- Also computes left/top for other consumers, but the fit calculation uses right/bottom only.

For an unrotated, unshadowed, non-fixed child with a supported current rectangle, the fit rule is therefore:

```text
width  = max(0, each visible child's x + width)
height = max(0, each visible child's y + height)
```

Negative coordinates do not shift the origin: a child at x=-10 with width=30 contributes right=20, not width=30. Empty or all-hidden content gives `0×0` in this **HTML runtime calculation**. Do not substitute the native editor's `DynamicPanel.get_DefaultFitSize` result of `100×100`, which belongs to a different empty/editor fallback path.

`offsetBoundingRect` (`axQuery.std.js:1438–1575`) prefers runtime moved location and resized size, falls back to effective style location/size, includes outer-shadow extents, and applies rotated bounding boxes. It also contains master/layer/fixed-position logic. A simple product implementation must either implement these effects or reject affected imported fit containers. Unknown or skipped children cannot simply disappear from a fit calculation: require every relevant descendant's geometry and visibility to be recoverable, or report the whole fit container as unsupported. Unsupported shadow/rotation/transform, percent width, adaptive views, masters/repeaters, unknown containment, and ambiguous style inheritance remain outside the simple subset.

For the simple-layout gate, the metadata identifies PName72 as `OUTER_SHADOW` (73 `INNER_SHADOW`, 74 `TEXT_SHADOW`), PName50 as `ROTATION` (51 `TEXT_ROTATION`), and PName1401 as `TRANSFORM` (1402 `TRANSFORM_ORIGIN`). The complete effective chains recorded for the Tab/Quick state children resolve outer shadow to the map `{On:false, OffsetX:5, OffsetY:5, BlurRadius:5, Color:1493172224, Spread:0}`, rotation to `0`, and transform to `{ScaleX:1, ScaleY:1, TranslateX:0, TranslateY:0, Rotate:0}`. Only `On:false` establishes no outer-shadow contribution; the nonzero inactive offsets/blur are not active geometry. The samples JSON retains each value and its source. A missing or malformed effective value must not be silently replaced by this observed default.

Updates are required after actual state changes:

| Trigger | Original evidence | Consequence |
| --- | --- | --- |
| Show/hide child | `axQuery.std.js:400–413` | Completion calls `fitParentPanel` |
| Move child | `axQuery.std.js:454–481` | Completion calls `fitParentPanel` |
| Resize child | `axQuery.std.js:654–662` | Completion calls `fitParentPanel` |
| Switch panel state | `visibility.js:733–753` | Computes target state's right/bottom and calls `setResizedSize` on the panel itself |
| Finish switching state | `visibility.js:756–779` | Fits ancestor panel and raises panel-state-change event |
| Nested fitted panel changes | `repeater.js:1590–1626` | Recursively propagates changed child bounds to its parent |
| Explicitly resize the panel itself | `axQuery.std.js:599–620` | Calls `setFitToContentCss(..., false, ...)`; fit is disabled |

`repeater.js:1581–1586` checks both source `fitToContent` and absence of runtime `data-notfit`. Thus a product `fitToContent` flag should be runtime mutable when explicit resize is supported. Instant current-state recomputation is a suitable simple product mechanism for the listed nonanimated actions, but it does not reproduce animation timing, percentage dimensions, resize events, mobile scroll, flyouts, or every original layout side effect.

Native CIL corroboration is retained in `rp-selection-layout-DynamicPanel-cil.json`, `rp-selection-layout-panel-geometry-cil.json`, and `rp-selection-layout-panel-fit-cil.json`:

- `DynamicPanel.get_Size`, token 100700494: IL 9 reads CurrentPanelIndex; IL 16 calls `aNaX`.
- `aNaX`, token 100700497: IL 80 reads FitToContent; false goes to base stored Size (IL 59); true delegates to `INam` (IL 73).
- `INam`, token 100700500: obtains a selected state and its child collection before a bounds helper. Its obfuscated geometry helpers were not fully reconstructed; the readable HTML runtime supplies the exact simple rule above.
- `get_DefaultFitSize`, token 100700499: loads 100 and 100 at IL 7 and 16. This is evidence of a separate fallback, not a minimum for the HTML fit calculation.

## Quick Win panel geometry

The fitted panel `0c553076164845fe8104581fb7f0e9ee` is at `(800,1248)` with stored `100×100`. Its two states have different **derived simple** sizes:

| Ordered state | Package | Content determining extents | Derived fit size |
| --- | --- | --- | --- |
| State 1 | `1dc108e8c0864ae2970bc76105b03a18` | Image at `(0,63)`, size `600×231`; two smaller form objects | 600×294 |
| State 2 | `0dafad5771cf4d8088ce17fb2c8d9929` | Image at inherited `(0,0)`, size `600×231` | 600×231 |

These differing sizes justify per-current-state fitting. Freezing both states to 600×294 or to the stored 100×100 would change the sample. Recovery still depends on supporting each image/content object, not geometry alone.

There is a specific restriction in State 1: text label `5f3f2e3c40324947b60e37cd167a459e` at `(29,24)`, stored size `28×11`, has both `AutoFitWidth=true` and `AutoFitHeight=true`. Its stored rectangle does not determine the initial maximum extents above, but runtime text/font changes could alter it. A gate that requires every child to have static dimensions must therefore reject this Quick Win fitted panel, or explicitly report a frozen text-size limitation under a separately justified policy. The calculated `600×294` is an initial stored-rectangle derivation, not evidence that every descendant has static native dimensions.

The other panel `db5819e0c3024a3e94f0730c10acaf8b` is explicitly `fit-to-content=false`, at `(1862,1173)` with stored size `236.0759493670887 × 65.00000000000011`. Its child extents are only `193×45`; retain its fixed stored size. State package: `77acb582b35849c5966ebf99489cd6dc`.

## RadioButton and Checkbox fields

Quick Win contains **six RadioButton objects and zero Checkbox objects**. All six have `Disabled=false`, `VisibleFromSettings=true`, `AutoFitWidth=true`, `AutoFitHeight=false`, `SelectedStyleGroup=""`, and string-valued `align-selection-button-right="False"`. Preserve the leading space in their stored rich-text labels.

| Object ID | Text | Location | Stored size | Selected | radio-group |
| --- | --- | --- | --- | --- | --- |
| `025a88aee010499bb539bea44185fc76` | ` Full day` | 922,564 | 63×15 | true | empty |
| `86bd380d65694091a5080e13ed8d6153` | ` Custom hours` | 922,585 | 96×15 | false | empty |
| `12bd9c9a44d14d2792e50920203cb292` | ` Full day` | 922,1199 | 63×15 | false | Duration Radio Group |
| `8d40dbcd7f2444a197cd2322a81bcfc4` | ` Custom hours` | 922,1220 | 96×15 | true | Duration Radio Group |
| `b200cc5232f64680ab9a3bd102ed6981` | ` Full day` | 1975,1132 | 63×15 | true | Duration Moving |
| `4da21ff8ea2d407ca2f178bd31fe7e11` | ` Custom hours` | 1975,1153 | 96×15 | false | Duration Moving |

For supported radio controls, map explicit boolean Selected to initial checked/selected state and explicit native `radio-group` to a separate radio group field. Never use `SelectedStyleGroup` as the radio-group substitute. Empty radio groups are independent; they must not collapse into a shared empty-name group. These sizes remain AutoFit snapshots; mapping the glyph to a browser form control does not establish exact native glyph dimensions or subsequent font-based auto sizing.

The native string field spelling is **`radio-group`**, not `RadioGroupName`. `RadioButton.get_RadioGroup` (100701391) reads its backing field; `NIwY` (100701395) calls the getter at IL 68 then writes a value; `oIw4` (100701396) reads a value and calls the setter at IL 110. The serialization key is obtained via an indirect string helper, so its literal identity is corroborated by stored samples, not falsely presented as a decoded CIL string. See `rp-selection-layout-RadioButton-cil.json`.

`SelectionButton.get_AlignRight` (100702031) reads boolean field `qNUe`. Its writer `NIwY` (100702039) loads that field at IL 220 and calls `Boolean.ToString` at IL 225; this matches the stored string `"False"`. `oIw4` reads a string before writing `qNUe` at IL 151. See `rp-selection-layout-SelectionButton-cil.json`. Only the left-button `False` arrangement is exercised here; do not claim an observed right-aligned example.

`Default.rplib` supplies one additional explicit `Axure:DiagramObject:Checkbox` example, `a242d373d93f443cb7674d57893bd3d2`: text `Checkbox`, local `(100,100)`, size `75×15`, Selected=false, Disabled=false, string alignment `False`, AutoFitWidth=true, no `radio-group` key. Its library cache chain is not complete under this document-only audit; use it as a field/type example, not proof that the complete control is importable. There is no checked Checkbox sample in this corpus. Checkbox inherits the SelectionButton behavior path in retained constructors (`rp-selection-layout-Checkbox-cil.json`), but tri-state/indeterminate behavior is unestablished.

## Radio group HTML identity and its limit

Static `FNiU.pNPt` (100699649; `rp-selection-layout-radio-html-cil.json`) tests the RadioGroup with `String.IsNullOrEmpty` at IL 2279. The nonempty branch loads the stored group at IL 2523 and puts it in local 6; the empty branch at IL 2345–2358 derives an element ID through `BNCJ.MNCS`. `MNCS` calls `XNC9`; without a nullable row index `XNC9` returns the supplied ID unchanged (IL 7–20). The name candidate is passed as argument 11 to the HTML writer `JNCt`, whose IL 61–69 sends it through a string output helper.

The shipped `events.js:1216–1233` checks input `name` against `elementId`: independent/self-named radios do not run the shared-group clearing loop, whereas grouped radios clear other members before selecting the target. `repeater.js:256–271` adds row suffixes when isolation is enabled. These are consistent with the static empty-name branch. Master/repeater isolation is beyond the simple page-level mapping.

No ToLower/ToUpper/Trim operation was found in the inspected name pipeline, but the final string helper performs indirectly named replacements (`rp-selection-layout-html-escape-cil.json`). Its replacement literals were not decoded, so arbitrary whitespace/punctuation normalization is not fully proved. Preserve the observed ASCII group strings and their equality partitions; do not invent case folding or trimming, or claim exact generated HTML spelling for every possible name.

## Selected visual style is an overlay, not a replacement base

The two Tab labels have SelectedStyleGroup `Tab Control Group`. Tab 1 starts Selected=true; Tab 2 starts false. Both have the same normal matched base style ID `c9f35713a1cf4e91a0f2dbac65e6fb5c`, with normal fill `#ffffff`.

Each local determined PName21 (`IX_STYLES`) map has a Selected reference to a package-local `Axure:Style` object:

- Tab 1 → object `51878669d8974ad89c05355624a48813`.
- Tab 2 → object `6cf7df68ef5146e5bcaf54f7c2c59375`.

Each selected style's only PropList entry is PName7 FILL, solid ARGB -8268808 = `#81d3f8`. Their internal Style.Id values happen to match, but their object IDs differ: resolve the actual package-local references, not a global Style.Id lookup.

`style.js:1794–1866` computes a fresh style and overlays state effects in order: normal, mouse-over, mouse-down, focused, selected, error, hint, disabled. `_getFullStateStyle` at 1906–1916 returns undefined when a state's entry is absent; the caller uses an empty object in that case. Thus normal white and selected blue should be retained separately; unselecting must recover white. This evidence does not establish all native adaptive/combined-state precedence for a simplified importer.

For a complete, unambiguous, nonadaptive cache chain, absence of IX_STYLES or an effective map without Selected means no selected visual override; it is not a reason to reject Selected or OnSelect behavior. A missing/invalid **nonzero** selected-style reference remains unknown and must not be silently treated as none. Treating a zero object reference as null may follow the existing parser's null-reference convention, but these samples do not contain an explicit map Selected→zero reference. This distinction is retained as a coverage limitation.

## Verification and remaining limits

The research audit passed assertions on six radio identities/groups/states, two inherited Tab state origins and sizes, two exact base/selected fill pairs, the single library Checkbox's unchecked state, and Quick Win's distinct fitted-state dimensions. It also records the fixed-panel counterexample so future implementations do not fit every panel indiscriminately.

Evidence hashes and method tokens are checked separately; no native GUI differential run was performed. Original event ordering and action decoding are owned by the interaction investigation. This report does not establish complete `.rp` compatibility, native rendering fidelity, animation timing, radio accessibility behavior, arbitrary nested/master/repeater group scope, or unobserved control variants.

Companion action/event investigation: [selected-state evidence](rp-selected-state-evidence.md). A final read-only comparison of the current product's native selection paths and simple fit calculation found no additional concrete mismatch within the subset described here. `npx vitest run tests/selection-runtime.test.ts` passed **11/11** on this snapshot; this is product validation, not an original-browser differential test. Re-running the research audit preserved sample-evidence SHA-256 `b549c6ceefabb86254a8670f292084a34e159d99cc6b2069618a8c5cb3f43250`; all **17** manifest entries matched their stored byte lengths and hashes.
