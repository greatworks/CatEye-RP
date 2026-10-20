# RP text padding, vertical alignment, and automatic line spacing

Date: 2026-10-13. Target: the retained Axure RP 11.0.0.4150 distribution. This investigation only read sample files with the project's own parsers and read ECMA-335 metadata/CIL using `PEReader`. It did not load or execute the target DLL, run the original application, decode its string table, or modify product code. The findings establish a restricted import mapping, not complete Axure layout compatibility.

## Source identities and retained evidence

- Official distribution ZIP SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- `AxureRP11.dll` SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Existing metadata: [samples/metadata-PName.json](samples/metadata-PName.json), [samples/metadata-AxStringAlignment.json](samples/metadata-AxStringAlignment.json).
- Existing paragraph conversion CIL: [samples/font-scale-cil.json](samples/font-scale-cil.json), method `RPFormatExtensions.XJc4`.
- New minimal CIL record: [rp-text-layout-cil.json](rp-text-layout-cil.json), SHA-256 `51988b277827c38ad561cc96358b35a110d8c239655cf8eb96a8d487a3e04594`. It retains six complete small methods and one explicitly marked HTML-generation excerpt. The excerpt is not a complete control-flow analysis.
- Four-sample observations, source script excerpts, and SHA-256/size manifest of the existing evidence: [rp-text-layout-sample-evidence.json](rp-text-layout-sample-evidence.json), SHA-256 `e55c45d9e9f6b572df0fa8d297fe518ec49cbace42bfb4a13f32a202f9cf1396`.
- Reader used for the new CIL: [scripts/inspect-rp-serialization.ps1](scripts/inspect-rp-serialization.ps1). It opens the assembly as bytes; the target assembly is never loaded for execution.

The JSON sample record preserves exact native-source paths and hashes for the small `reset.css`, `style.js`, and `default.css` excerpts discussed below. These retained vendor excerpts are research evidence only and must not be copied into the product bundle.

## Padding: confirmed property identity and stored values

The `Axure.Constants.PName` metadata directly identifies these integer keys:

| Key | Native property | Product representation |
| --- | --- | --- |
| 11 | PADDING_LEFT | `textPadding[3]` |
| 12 | PADDING_TOP | `textPadding[0]` |
| 13 | PADDING_RIGHT | `textPadding[1]` |
| 14 | PADDING_BOTTOM | `textPadding[2]` |

The product array order is **top, right, bottom, left**. Use a value only when all four effective cache/local entries are determined, finite, and within the product's supported nonnegative range. Preserve the source of each side. A missing or unknown side is not evidence for zero.

The observed Required Fields sample has these effective values. Dimensions are stored snapshots, not recomputed text bounds:

| Object text / label | Stored width × height | Recovered font size | Padding TRBL | Vertical value |
| --- | --- | --- | --- | --- |
| Email | 36 × 16 | 14 px | 0,0,0,0 | 0 |
| Password | 62 × 16 | 14 px | 0,0,0,0 | 0 |
| Error Message | 399 × 21 | 18 px | 0,0,0,0 | 0 |
| Thank you for signing up! | 394 × 37 | 32 px | 0,0,0,0 | 0 |
| Email Field | 300 × 25 | 13 px | 2,2,2,2 | 1 |
| Password Field | 300 × 25 | 13 px | 2,2,2,2 | 1 |
| Sign Up | 140 × 40 | 13 px | 2,2,2,2 | 1 |

The first four padding values come from matching cached base styles; the input/button padding comes from the cached document default. All seven style chains in this sample are complete under the restricted reader. Thus the old common `padding:5px` adds unsupported inset to the small native labels. Clearing padding globally would also be incorrect: other objects explicitly store 2, 10, 30, and asymmetric values.

## Vertical alignment: property-to-enum binding

`PName.VERTICAL_ALIGNMENT = 10`. The following retained getter chain ties key 10 to `Axure.Platform.AxStringAlignment`, rather than merely assuming that an unrelated alignment enum shares the same numbers:

| Method | MethodDef token | Relevant CIL |
| --- | --- | --- |
| `TextPanel.get_VerticalAlignment` | `0x06009851` / 100702289 | Signature `200011BA80`; IL 8 loads its layout field, IL 13 calls `KJm7.OJOl` |
| `KJm7.OJOl` | `0x06007E22` / 100695586 | Signature `200011BA80`; IL 13 calls `jtoq.M5Bh` |
| `jtoq.M5Bh` | `0x0600D4DE` / 100717790 | Signature `200011BA80`; IL 8 calls `Htzm`, IL 13 reads the typed property's value |
| `jtoq.Htzm` | `0x0600D489` / 100717705 | Signature `20001512C000438C0111BA80`; IL 8 loads integer **10**, IL 10 calls `get_Item` |

The `11 BA80` signature reference identifies the retained `AxStringAlignment` TypeDef. Its metadata defines Near=0, Center=1, Far=2, Justify=3, None=-1. The supported mapping is 0→top, 1→middle, 2→bottom. The four samples only exercise 0 and 1; bottom has enum/property evidence but no sample observation in this corpus. None, Justify, and unknown values remain unsupported. A separate Axvg `VerticalAlignment` enum was found during inspection, but it is not needed to establish this binding and must not substitute for it.

## Automatic line spacing: observed sentinel and rendering boundary

Metadata identifies `PName.LINE_SPACING = 20`. All five Required Fields rich-text paragraphs explicitly store `LineSpacing: 0`; all seven widget style chains also resolve key 20 to zero. Email and Password use Arial Size=10.5 in native rich-text runs, recovered as 14 CSS px; Error Message uses Size=13.5, recovered as 18 CSS px. A product line-height multiplier of 1.35 gives 18.9 px for a 16 px-high label even after its padding is corrected.

The retained `RPFormatExtensions.XJc4` method (`0x060072B4` / 100692660) proves that zero is not an instruction to render a zero-height line:

- IL 88 reads `HSXd.FIvA` (paragraph line spacing), IL 93 loads 0, and IL 102 branches on inequality.
- For zero, IL 107 loads the caller-supplied default spacing and IL 108 goes to the setter.
- For nonzero, IL 114 reads the stored spacing; IL 119 loads 0.75 and IL 128 divides by it.
- IL 129 calls `Paragraph.set_LineSpacing`.

The new CIL record also retains `cNCQ.ONiF` (`0x06008D9F` / 100699551), a method associated with the `GetHtml` callbacks. Its IL 2139–2153 tests the same paragraph spacing against zero, takes distinct font-size aggregation branches, and calls `ituB.ptlU` at IL 2265. Both retained callbacks (`0x06008DAD` / 100699565 and `0x06008DAE` / 100699566) read run `get_Size` at IL 8. This corroborates a default font-layout path. The short excerpt does **not** establish the complete generated CSS or exact font metrics.

The shipped HTML runtime `resources/scripts/axure/style.js:2496` assigns CSS `lineHeight` only when `style.lineSpacing` is truthy. The shipped `resources/css/reset.css` specifies no line-height. Neither observation proves that original generated page CSS uses `normal`: the local distribution does not contain the actual generated `data/styles.css` / per-page stylesheets for these samples. The `line-height: normal` found in `resources/css/default.css:308` belongs to `.pluginHint`, not widget text, and is explicitly excluded as supporting evidence.

**Product mapping:** only when effective determined key 20 is zero and every supported rich-text paragraph explicitly has `LineSpacing=0`, set the optional product `lineHeight` to `normal`. Preserve provenance `kind: browser-default-for-automatic-spacing` and `nativeFontMetricsVerified: false`. This is a deliberate browser-font default mapping for native automatic spacing, **not proof of exact original HTML layout, line metrics, baseline, wrapping, or pixel equivalence**. Missing fields, mixed paragraph values, unsupported rich text, or nonzero spacing do not qualify. Keep them in the report; do not infer a fixed line height from stored object height. Existing documents without this explicit recovered field keep their previous product behavior.

## Four-sample counts

Counts below include every direct widget record in the semantic diagrams, including PanelState contents and unsupported widgets. They are **not** counts of successful product imports. Paragraph counts can exceed the number of widgets because one object may contain multiple paragraphs. The parser snapshot's `normal` mapping count also requires its supported rich-text structure.

| Sample | Diagram widget records | Determined four-side padding | Rich paragraphs | Paragraph spacing=0 | Objects mapped to browser normal |
| --- | ---: | ---: | ---: | ---: | ---: |
| complex-interactions-required-fields.rp | 7 | 7 | 5 | 5 | 5 |
| the-basics-tab-menu.rp | 5 | 4 | 4 | 4 | 4 |
| Quick Win.rp | 48 | 46 | 42 | 42 | 30 |
| UX Prototyping.rp | 201 | 193 | 170 | 170 | 121 |
| Total | 261 | 250 | 221 | 221 | 160 |

Effective layout pattern counts (padding order TRBL):

- Required Fields: top/0,0,0,0 = 4; middle/2,2,2,2 = 3.
- Tab Menu: middle/2,2,2,2 = 4; unresolved = 1.
- Quick Win: top/0,0,0,0 = 17; middle/2,2,2,2 = 12; top/10,10,10,10 = 8; top/30,30,30,30 = 1; middle/2,2,2,10 = 2; top/0,2,0,2 = 6; unresolved = 2.
- UX Prototyping: top/0,0,0,0 = 72; middle/2,2,2,2 = 61; top/10,10,10,10 = 49; top/30,30,30,30 = 5; middle/2,30,2,30 = 6; unresolved = 8.

The separate raw property scan counts cache/local property records before merging, including unused styles. Keys 10–14 produced 96 / 90 / 302 / 544 records respectively across the four samples; none had the determined bit clear. Key 20 produced 16 / 18 / 44 / 56 records, also all determined. Raw cache values include some 12/22 padding that is not an effective layout pattern above; the JSON keeps these two counting scopes separate.

| Sample | SHA-256 |
| --- | --- |
| complex-interactions-required-fields.rp | `0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c` |
| the-basics-tab-menu.rp | `0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4` |
| Quick Win.rp | `04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051` |
| UX Prototyping.rp | `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72` |

## Reproduce focused static checks

```powershell
$rpDll = (Get-Content research/conditional-case-cil.json -Raw | ConvertFrom-Json).AssemblyPath
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $rpDll -TypeName TextPanel -MethodNames get_VerticalAlignment
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $rpDll -TypeName KJm7 -MethodNames OJOl
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $rpDll -TypeName jtoq -MethodNames Htzm,M5Bh
node research/scripts/show-rp-cil.mjs research/samples/font-scale-cil.json XJc4
Get-FileHash research/rp-text-layout-cil.json,research/rp-text-layout-sample-evidence.json -Algorithm SHA256
```

The PowerShell method-name filter is case-insensitive; select MethodDef token 100717790 when inspecting `M5Bh`, because another method named `m5BH` also matches that spelling filter. The retained minimum record selects by exact method token.

Sample counts were recomputed from `inspectRpObjects(path)` and `inspectRpSemantics(path)` using the four explicitly named local files. Validation of the retained record checks its hashes, source identities, required getter chain, sentinel branch offsets, four sample counts, and the `nativeFontMetricsVerified: false` boundary. This verifies evidence consistency; it does not run original Axure or establish visual equivalence.
