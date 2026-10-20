# Recovered native shapes: AutoFit and text-layout coverage

Verified 2026-10-14 by **pure JSON joins**, without extracting or parsing the eleven source inputs again and without executing the importer. No product, old audit, old manifest or historical report was changed. The original files were read only to verify their retained SHA-256 identities.

## Scope and identity

The complete documents in `rotation-import-baseline.json` are joined to the twelve additions in `rotation-import-audit.json`. That audit asserts that every prior complete document was preserved; this scan verifies each sample's resulting node count against its post-rotation import totals. Thus the figures describe the retained **post-rotation coverage snapshot**, not a newly executed current import.

Source AutoFit flags come from `rp-vector-census.json`, joined by **sample SHA + package ID + object ID**. Every recovered native VectorShape has exactly one matching record. IDs alone are insufficient: the same source ID occurs in different packages. TableCell flags are joined from `table-format-census.json` separately. Padding, alignment and rich paragraphs below are the recovered document values; they are not a new native style resolution or measured final CSS.

Eleven inputs were considered. Ten have imported documents; `Icons.rplib` was rejected by the retained importer at the page-count limit and contributes no recovered objects. There are 1,778 recovered nodes, including containers and nested nodes:

- **1,575 native VectorShapes**: 1,571 ordinary shapes and four contained tree labels.
- Fifteen native TableCells: nine in the Classic table and six inside the two classic menus.
- The other 188 nodes are panels, forms, images, frame/tree/table/menu containers.

The ordinary category includes box, ellipse and general path shapes, including shapes nested in panel states. It excludes a VectorShape used as a tree node's contained label. It does not include TableCells merely because they share text presentation. This avoids accidentally applying an ordinary-shape contract to those distinct container rules.

## AutoFit coverage

Flags are listed as **Width / Height**. They are stored metadata, **not proof that the initial owner or runtime resizes**.

| W / H | All ordinary shapes | Nonempty text | Structured rich text | Objects containing projected LF |
|---|---:|---:|---:|---:|
| false / false | 929 | 455 | 167 | 13 |
| true / true | 343 | 337 | 212 | 6 |
| false / true | 259 | 259 | 220 | 82 |
| true / false | 40 | 40 | 22 | 0 |
| **Total** | **1,571** | **1,091** | **621** | **101** |

The four previously studied Problems/Ideas owners are only four of the 343 true/true shapes. Both other one-axis combinations occur in recovered real samples and require deliberate handling.

| Sample | Ordinary shapes | FF | TT | FT | TF |
|---|---:|---:|---:|---:|---:|
| Default.rplib | 23 | 17 | 5 | 1 | 0 |
| Flow.rplib | 21 | 21 | 0 | 0 | 0 |
| Sample form patterns.rplib | 868 | 556 | 202 | 80 | 30 |
| Sample UI patterns.rplib | 197 | 114 | 41 | 38 | 4 |
| Prototype Starter.rp | 81 | 47 | 8 | 26 | 0 |
| Prototyping Basics.rp | 218 | 115 | 21 | 82 | 0 |
| Quick Win.rp | 27 | 10 | 14 | 3 | 0 |
| UX Prototyping.rp | 127 | 44 | 48 | 29 | 6 |
| the-basics-tab-menu.rp | 4 | 4 | 0 | 0 | 0 |
| complex-interactions-required-fields.rp | 5 | 1 | 4 | 0 | 0 |

Of these shapes, 1,129 are recovered as `box`, 138 as `ellipse`, and 304 as `path`. There are 511 ordinary shapes inside panel states. Native package versions are 11.0.0.0 for 1,570 records and 9.0.1.0 for one record; that older record is not evidence of a universal RP 11 writer path.

## Padding, alignment, rich text and rotation

- All ordinary records have a recovered TRBL `textPadding` tuple. There are **31 distinct tuples**, including zero padding735, `[2,2,2,2]`557, `[10,10,10,10]`103. There are **145 asymmetric-padding** objects. Full counts are in the JSON; no missing tuple was silently treated as zero.
- `verticalAlign`: middle913, top644, bottom14. A top-only implementation would miss most recovered text surfaces.
- Widget-level `lineHeight` is `normal`968 or absent603. **Absent is kept distinct from normal** in this audit. Paragraph-level values independently include `normal`825 paragraphs,16px41,24px3,26px16,28px75,34px2,36px12,64px1. There are **91 owners with numeric paragraph line height**.
- There are **621 rich owners** and **129 owners with more than one distinct run style**. The remaining950 use the plain model representation, including480 empty shapes. “Plain model” does not assert that the native source had no paragraphs or no omitted formatting.
- Rotation is0 for1,559 shapes,180 for6, and89.13596303062127 for6. **All twelve nonzero-rotation recovered shapes have empty text**. The corpus offers no recovered positive for simultaneous nonempty text and nonzero rotation.

## Explicit line breaks and paragraph boundaries

These counts inspect the imported `Widget.text` and actual recovered `richText.paragraphs[].runs[].text`, not rendered line wrapping.

| Representation | Owners (nonempty) | Owners with LF / total LF in Widget.text | CR | Run-internal LF / CR | Structured paragraphs |
|---|---:|---:|---:|---:|---|
| Plain model | 950 (470) | 11 / 24 | 0 | Not structurally represented | Native paragraph count unknown from this plain projection |
| Rich model | 621 (621) | 90 / 354 | 0 | 0 / 0 | 975 paragraphs in621owners;90multi-paragraph owners |

Neither representation contains U+2028 or U+2029 in its projected text. Rich paragraph-count distribution is:1→531owners,2→23,3→21,4→2,5→17,6→1,7→5,8→5,9→7,10→4,11→4,14→1.

Every LF in the recovered rich projection is accounted for by a paragraph separator:975−621=354. There is **no retained recovered run-internal LF/CR positive** to present as a native soft-break example. Do not fabricate one or mislabel a source paragraph terminator as a soft break.

Crucially, six **true/true** owners have two paragraphs. Width AutoFit/nowrap must not collapse their explicit paragraph boundaries. Plain-model `Label\n\nHelper text` also requires preserving the saved line breaks; it is not permission to discard whitespace. Since the plain fallback lacks paragraph structure, this audit does not invent that structure or normalize its text.

The already frozen [rich-text-format-evidence.md](rich-text-format-evidence.md), sections3 and5, explains the earlier strict source-terminal-LF conversion: nonfinal native paragraph terminators were removed from runs and represented once between structured paragraphs. It also distinguishes unavailable/unsupported internal break patterns. This task reused that explanation, did not repeat the generator investigation, and did not change any text or conversion.

## Real regression representatives

All IDs below must be combined with the stated sample and package. The JSON contains the full imported text, rich structure, styles, source flags, bounds and source hashes for these representatives. Rectangles are saved/imported values, not measured natural text sizes.

| Case | Sample and package | Source object | Concrete facts |
|---|---|---|---|
| FF fixed button | Default; `cec955773a80421ba5e6b66844e05666` | `fbac60852350422dac27466a44ed07fc` | BUTTON;140×40; middle; padding2; one rich paragraph. |
| TT link button | Default; `33c44bbbdd714f31bfd61c1a41a2ae5e` | `fbac60852350422dac27466a44ed07fc` | BUTTON;58×19; middle; padding2. Same object ID as above, different package. |
| FT paragraph | Default; `274b0c198f5d487f84292efcb8d63906` | `11c5b4292f05487c928277ba67465587` | Lorem ipsum paragraph;300×120; top; padding0. |
| TF with asymmetric padding | Form; `c598ff6cf4ba459cbef032f0cd4048f7` | `dd99e62483d148f18f3b5143ce786907` | SEND;92×36; middle; TRBL10/38/10/16. |
| Plain explicit LF | Form; `9f2226d0f29c47a8b104b1293e29b97d` | `fc4d136af9fd41c9a85ed07de25dc592` | `Label\n\nHelper text`; FF;300×70; middle; padding2/2/2/8. |
| TT with multiple rich paragraphs | Form; `c598ff6cf4ba459cbef032f0cd4048f7` | `e7eb025dd4f24cf484485efbc960e355` | “Buttons ” + “Usage instructions”;2paragraphs/mixedstyles;253×69; top/padding0. |
| Numeric paragraph height | Form; same package as preceding | `be8f445cd91246718ce2410f92d0be0b` | FT;563×32; paragraph lineHeight16px; top/padding0. |
| Bottom alignment | Form; `9f2226d0f29c47a8b104b1293e29b97d` | `e635c803ea5a4b45b2024727d150e68d` | Input label; TT;70×16; bottom/padding0; plain model. |
| Contained tree label—exclude | Default; `90a0737fc2d74911b0b27573a1b35a40` | `05e9c51533824f12bc61ad74cae0a512` | Item1; native VectorShape but IsContained=true; TF;42×20; tree-node child. |
| Table cell—exclude | Default; `556a42319a0a476c8e81f2d6da0ada41` | `40f6d7fa97a243708d54990b189068dc` | Column1; native TableCell; FF;100×30. |
| Menu cell—exclude | Default; `09eed44f62374bfa9f92b9d48fa1a032` | `626afeeef0fb434f8e299976d51b0123` | File; native TableCell; FF;100×30, inside menu→table. |

All four contained tree labels are TF; all fifteen table/menu cells are FF. Their flags do not erase their specialized layout/interaction ownership. The JSON also includes a nested panel-state ordinary shape, a rotated empty shape, and the four exact prior UX Problems/Ideas comparison owners.

Suggested bounded implementation checks are therefore: all four flags; zero/uniform/asymmetric padding; three vertical alignments; plain LF preservation; TT rich multiple paragraphs; numeric per-paragraph height; nested panel-state shapes; unchanged empty rotated geometry; and explicit exclusion or separate treatment for tree/table/menu labels. These are coverage recommendations from stored data, not assertions of original GUI output.

## Reproducibility and provenance

Run `node research/text-autofit-corpus-scan.mjs`. It reads only the five retained evidence JSONs and source bytes for SHA checks, never calls `inspectRpObjects`, `inspectRpSemantics`, or `importRpSemantics`, and writes only this stage's JSON. It validates unique vector joins, all11inputhashes, all10admittednodecounts, exact12rotationadditions and the four exact UX comparison identities.

The result is [text-autofit-corpus-evidence.json](text-autofit-corpus-evidence.json). `sources` includes every native input path/SHA and every reused snapshot path/SHA; ordinary records additionally retain their native package SHA and native version. `evidence` binds the new script/report plus the referenced old rich-text report. The distribution SHA is `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; extraction Evidence ID is `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.

No original GUI, native font engine, proprietary DLL, browser, full tests, build or package was run. No flags were treated as actual resize measurements.
