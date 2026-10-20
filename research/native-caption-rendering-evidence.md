# Native caption layout and font evidence

Date: 2026-10-13. Target: retained Axure RP 11.0.0.4150. This is a bounded static investigation plus an isolated Edge font experiment. It did not launch the original application, retry the blocked GUI bridge, modify the product, install fonts, or compare a complete original generated page pixel for pixel.

## Implementation conclusion

The safe correction is to recover the document's actual style chain, including the exact cached style identity, and preserve the stored label bounds. Neither a small label box nor a VectorShape type justifies inventing padding, border, alignment, or line height. Current isolated Edge can actually render Roboto on this machine: CDP identifies `Roboto-Regular` for CSS `font-family: Roboto`. **A subsequent packaged Electron diagnostic identifies Noto Sans SC for the same requested CSS family**, confirming a process-specific fallback problem. The Edge observation must not be generalized to the desktop application; neither probe identifies Times.

The original HTML generator contains additional font-name cache construction and a concatenated string suffix, but its encrypted literal has not been decoded. Therefore this investigation does **not** establish that the generated fallback list is Arial, `sans-serif`, or any other particular list. Do not add a purported native fallback list from this evidence.

## Source identities

Extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.

Source root: `C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11`.

| Relative source | SHA-256 |
| --- | --- |
| `AxureRP11.dll` | `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7` |
| `DefaultSettings/Prototype_Files/resources/scripts/axure/style.js` | `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c` |
| `DefaultSettings/Prototype_Files/resources/scripts/axure/doc.js` | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| `DefaultSettings/Prototype_Files/resources/css/axure_rp_page.css` | `595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a` |
| `DefaultSettings/Prototype_Files/resources/css/reset.css` | `579b70dd71cfaca21c03a770a89fb182413a3228bdff0febcb0513f112b2cb59` |
| `DefaultSettings/Prototype_Files/resources/css/previewfonts.css` | `40d0e4df7ca9d1864565c2a19c2099c703a321c7510ccbc1ef37a9799fb2099f` |
| `Fonts/Roboto-Regular.ttf` | `017c0be9aaa6d0359737e1fa762ad304c0e0107927faff5a6c1f415c7f5244ed` |

[The machine-readable record](native-caption-rendering-evidence.json) retains the source manifest, bounded excerpts, complete inspected CIL methods, and actual browser observations. CIL was read using `PEReader` through the existing `scripts/inspect-rp-serialization.ps1`; the target DLL was not loaded for execution.

## Style inheritance is the recovery entry point

Executed `style.js:1872–1879` computes the effective style in this order: document default, matching base style, local object style, current panel style, and interaction/adaptive overrides. A later property replaces the same earlier property. `style.js:1674–1679` obtains the four text padding sides from this full style when applying text overrides. That function's local zero initialization is an operational fallback for its arguments; it is not proof that missing serialized padding means zero.

The independent cache repair being performed by the format/parser owner uses the exact `(Id, LibraryId)` style identity. A nonzero library identity is not, by itself, evidence that the cached style is invalid. This report does not duplicate that parser implementation or its new sample census.

Previously established sample evidence remains useful: [rp-text-layout-evidence.md](rp-text-layout-evidence.md) and [rp-text-layout-sample-evidence.json](rp-text-layout-sample-evidence.json), SHA-256 `e55c45d9e9f6b572df0fa8d297fe518ec49cbace42bfb4a13f32a202f9cf1396`. In Required Fields, Email is 36×16 and Password is 62×16, with Arial 14 CSS px, four-side padding zero, and vertical top from their resolved styles. The inputs and button instead resolve four-side padding 2 and vertical middle. Blanket zero padding is therefore as unsupported as blanket 5 px padding.

Padding keys are PName 11–14; vertical alignment is key 10; line spacing is key 20. Use complete determined values and provenance. Border recovery likewise needs its effective native style values; no new universal label-border default was proven here.

## Text container, overflow, and geometry

- `doc.js:545–563`: rich-text lookup finds a `.text` descendant of the button-shape container. If asked to create a missing node, it appends an absolutely positioned, inherited-visibility `.text` div containing `p > span`, then applies adaptive styling. This fallback markup has no explicit overflow, padding, or line-height attribute.
- `style.js:1647–1702`: changing styles resets original text CSS, computes full style, and applies text overrides. It changes the border element's measured width/height only for the corresponding `autoFitWidth`/`autoFitHeight` flags. The other branch restores parent dimensions. This is not a general instruction to enlarge small label boxes.
- `style.js:2076–2094`: the executed vertical-alignment wrapper caches original text, checks that the node exists, and invokes the transform callback. Older alignment calculations beneath this function are commented out. They must not be cited as current executed default-middle or default-padding behavior.
- `style.js:2427–2442`: text styling starts with the text container's `offsetWidth/offsetHeight`, applies CSS to descendants, and includes padding in candidate dimensions. It only increases height in this routine when the computed line-height check is false. This is a state-style measurement path, not a full initial HTML layout specification.
- `axure_rp_page.css:44–52` sets paragraph margins to zero and enables kerning/text rendering options. Lines 63–67 set input padding and border-box sizing; those declarations apply to native input elements, not arbitrary VectorShape captions.

The inspected common CSS contains no general `.text` overflow rule. **Absence in common CSS does not prove visible overflow**, because the retained distribution does not contain the actual generated sample `data/styles.css` and per-page stylesheets. Original static caption clipping, wrapper display/flex rules, and exact inner box height remain unverified. Do not claim `overflow:hidden`, `overflow:visible`, or stretching as native parity based on this scan.

## Automatic line spacing remains a bounded mapping

Existing [rp-text-layout-cil.json](rp-text-layout-cil.json), SHA-256 `51988b277827c38ad561cc96358b35a110d8c239655cf8eb96a8d487a3e04594`, records the paragraph conversion: `RPFormatExtensions.XJc4` (100692660), IL 88–129, uses a caller-supplied default when spacing is zero; nonzero spacing is divided by 0.75. Zero is an automatic-spacing sentinel, not a zero-height line.

This investigation retained the full `cNCQ.ONiF` method (100699551). Its IL 2139–2265 has the corresponding zero/nonzero branch and font-run size aggregation before calling `ituB.ptlU` (100717352). The latter uses generic property key 2; this inspection does not independently establish it as a line-height setter. Encrypted formatting literals prevent a full generated-CSS conclusion.

Executed `style.js:2496` applies lineHeight only for truthy `style.lineSpacing`. The shipped reset CSS supplies no general line-height. Thus `line-height: normal` remains the project's explicitly bounded browser mapping for proven native automatic spacing, not proof of original HTML line metrics, baselines, clipping, or wrapping. Stored box height is not a substitute for the missing generated layout rules.

## Font family generation and actual availability

Runtime `style.js:2471` assigns `style.fontName` verbatim to CSS fontFamily. It does not append a fallback in this runtime override function.

The static HTML generation path is more involved:

| Method/token | Observed CIL |
| --- | --- |
| `cNCQ.KNiN` / 100699555 | IL 62–70 reaches the CSS-string helper; IL 307 appends the formatted rich-text run. |
| `cNCQ.BNiS` / 100699556 | IL 12 calls `PNKu.RNxS`, IL 17 calls `cNCQ.WNit`. |
| `PNKu.RNxS` / 100699318 | IL 12 calls the common font-property builder `PNKu.CNxN`. |
| `PNKu.CNxN` / 100699317 | IL 40 reads Typeface; IL 45 calls `X5ML.g5Md`; IL 80 calls `X5ML.a5MY`; IL 85 calls `PNKu.PNx5`; IL 90 writes the CSS dictionary entry. |
| `PNKu.PNx5` / 100699321 | IL 7 loads its string argument; IL 30 decodes an additional string through `sIho`; IL 35 concatenates them. The suffix bytes are unknown. |
| `X5ML.a5MY` / 100719514 | Lazily accesses cached strings via `A5Ch` and `K5Mp`. |
| `X5ML.K5Mp` / 100719507 | Builds candidate strings, including name comparison/substrings; IL 793 names the `AddToCssNameCache` callback; IL 820 joins a sequence and IL 858 concatenates strings before storing in `F5iV`. Separators/quotes/suffixes remain encrypted. |

This establishes a generated font-name construction path, not the exact output family list. The encoding might include formatting punctuation as well as font candidates; no particular generic family can be assigned without decoding or original generated CSS. Runtime overrides and initial generated CSS must not be conflated.

The distribution contains 12 Roboto TTF variants, including Regular, Bold, Medium, Light, Thin and their italic variants. The inspected `previewfonts.css` declares Source Sans Pro for preview UI; it does not establish prototype Roboto embedding. Registry queries of HKLM/HKCU font entries found Arial but no Roboto entry, which alone is insufficient to conclude browser unavailability.

Actual isolated Edge 155.0.4283.45 observation at `2026-10-13T15:23:45.985Z`, for the 23-glyph string `Email Password Checkbox` in 14 px inline text with normal line-height:

| CSS family | Actual CDP platform font | Width × height |
| --- | --- | --- |
| Roboto | Roboto-Regular, not custom | 164.6875 × 17 |
| Arial | ArialMT, not custom | 166.515625 × 16 |
| Roboto, Arial, sans-serif | Roboto-Regular, not custom | 164.6875 × 17 |
| Ephemeral alias loaded from retained Roboto-Regular.ttf | Roboto-Regular, custom | 164.6875 × 17 |

The probe used a blank document with network requests blocked, forced layout, two animation frames before CDP `CSS.getPlatformFontsForNode`, and `document.fonts.load` for the temporary FontFace alias. There were no network requests or installed-font changes. The JSON retains the exact font observations. Matching metrics do not prove that the pre-existing platform font came from the same physical TTF file.

These observations establish that font metrics can differ at the same CSS size and that Roboto is available in the tested Edge process. They do not identify the font used by an already-running Electron process, prove a complete label line box, or validate original Axure rendering pixel equivalence.

## Acceptance guidance and unresolved boundaries

1. Keep native geometry unchanged while repairing the exact style-cache chain. Verify recovered font, padding, vertical alignment and automatic-spacing provenance independently.
2. For any remaining apparent font mismatch, inspect the actual failing process's rendered font, not only `fontFamily` or Windows font registry entries. The isolated Edge result does not settle another process's loaded fonts.
3. Do not globally reduce line height, force a fallback, remove clipping, or enlarge labels to make one screenshot fit. Those actions require a deliberate product policy or further original-generated evidence.
4. Remaining native unknowns: exact generated CSS font fallback list; initial caption wrapper overflow/display rules; full paragraph/rich-run layout; font substitution in the original app and generated page; exact original glyph/baseline/wrapping pixels. The original GUI was not retried and no full original page comparison is claimed.

## Addendum: packaged Electron fallback diagnosis

The parent-owned `.build/native-caption-desktop-diagnostic.json` was independently inspected, SHA-256 `2008f255833e46d4edda93a493c91c131ce4e1cd2b9e191ae386820e8bec39cd`. It used packaged app.asar SHA-256 `f9a9814426455d35d41f3ff2c81ca411c7f93686305ecf71c58d3390f95a90d6` and the original form library SHA-256 `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`.

The diagnostic's first caption requests computed `14px Roboto`, but CDP reports actual platform `Noto Sans SC` / `Noto-Sans-SC`, not a custom web font. Its stored 78×16 rectangle remains unchanged, while the character Range reaches bottom 20 relative to the widget. Canvas font bounds are ascent 16/descent 4 and measured ink bounds 12/1; the script's ink-position estimate is not a raster comparison. `Phone number`, stored width 97, wraps to two lines. This is concrete fallback evidence, beyond the earlier comparison of two different measurement types.

Read-only inspection of `desktop/main.cjs`, `desktop/preload.cjs`, and the packaging script found no application font defaults, minimum font sizes, zoomFactor, setZoom, or force-device-scale overrides. Preview is outside the editor's canvas transform; the diagnostic also preserves exact outer dimensions. Thus no application-configured zoom explains the observed mismatch. The lower-level reason the independent Edge process can find Roboto while Electron uses Noto Sans SC remains unproven.

The JSON retains a bounded copy of these measurements and the desktop-source hashes. No additional application was launched for this addendum, and no product/font asset was changed. A verified Roboto web-font source is a candidate implementation route; guessed Arial fallback or label stretching does not reproduce the requested family.

## Addendum: retained Roboto identity and embedding metadata

Read-only SFNT parsing of the original `Roboto-Regular.ttf` confirms these name-table entries (Windows platform 3, encoding 1, language 1033). Table/record byte offsets are retained in the JSON:

| Name ID | Value |
| --- | --- |
| 0 | Copyright 2011 Google Inc. All Rights Reserved. |
| 1 / 4 | Roboto |
| 2 | Regular |
| 5 | Version 2.137; 2017 |
| 6 | Roboto-Regular |
| 7 | Roboto is a trademark of Google. |
| 9 | Google |
| 12 | Christian Robertson |
| 13 | Licensed under the Apache License, Version 2.0 |
| 14 | http://www.apache.org/licenses/LICENSE-2.0 |

The `OS/2` table is version 3 at byte offset 133484; `fsType` at byte offset 133492 is zero. The [OpenType specification](https://learn.microsoft.com/en-us/typography/opentype/spec/os2#fstype) identifies this value as installable embedding; it does not remove the font's applicable license or copyright obligations. No no-subsetting or bitmap-only bits are set.

A filename search for license/licence/copyright/notice in the retained distribution found ImageMagick's license and Source Sans Pro's separate license, but no separate Roboto license file. The TTF itself explicitly identifies Apache 2.0. This is strong artifact metadata for upstream-license verification, not a replacement for checking the original upstream release and required license/notice distribution. Parent owns that independent official-source check. This agent did not copy any vendor font to the product, install it, or rewrite its metadata.

### Six normal-weight files and parent-owned product copies

All six files below were independently byte-parsed. Every file has the same name 0 copyright, name 13 Apache 2.0 declaration, name 14 URL and version 2.137/2017 as Regular, and every `fsType` equals zero. The parent-owned copies under `src/assets/fonts/roboto` match their respective retained source SHA-256 exactly.

| File | Bytes | Raw OS/2 weight | SHA-256 |
| --- | ---: | ---: | --- |
| Roboto-Thin.ttf | 171500 | 250 | `dcac562815b575e6b821bae5fd245fea6590bb3b597fd5b96eae6acccb21d03c` |
| Roboto-Light.ttf | 170012 | 300 | `db02096a91c20ab62d459001a1059bc8d78caa35d637dc91494c4440815a6ac1` |
| Roboto-Regular.ttf | 171272 | 400 | `017c0be9aaa6d0359737e1fa762ad304c0e0107927faff5a6c1f415c7f5244ed` |
| Roboto-Medium.ttf | 171656 | 500 | `e35252aa3dc2e84e9d7211586fee9aede2a426d3230c8b131881d985f16ff836` |
| Roboto-Bold.ttf | 170348 | 700 | `c9cc991deb5d27f267830a19f2301eb164d9e61ec08669c1a1a291c5620ff40a` |
| Roboto-Black.ttf | 171072 | 900 | `354fb9e77252254f3b3b6224cf9a131ac8ed798e13015176125a2c697a19f801` |

Notably the original Thin file stores weight **250**, not 100. A CSS family declaration mapping this named Thin face to 100 would be an explicit renderer choice, not a claim about that raw field.

The local parent-added `LICENSE.txt` contains Apache License Version 2.0, January 2004. Its byte count and hash are retained in the JSON. Parent reports retrieval from the official Google repository at pinned commit `ab4876f650a4aeb9b661c83fee47f908c739bb70`; parent owns that network-source verification. The artifact provenance here is the retained Axure distribution, while the embedded font's own notice identifies Google and Apache 2.0. No claim is made that these 2.137 binaries equal an upstream 2.138 or a current download; the reported upstream Regular size 515100 also differs from this 171272-byte file. No font was downloaded or installed by this agent. Licensing notices and required distribution obligations remain part of the embedding route; raw fsType is not a replacement license.
