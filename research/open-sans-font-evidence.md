# Retained Open Sans font evidence

Read-only local audit, 2026-10-14. No browser, font installation, network download, original assembly execution, or product changes. Bundled Python could not import `fontTools` (`ModuleNotFoundError`); the parent approved the existing Node Buffer SFNT parsing approach. Table boundaries, required table lengths, name record/string ranges, and UTF-16 alignment were checked. Windows platform 3 records use UTF-16BE. Non-Unicode non-ASCII records are retained as raw bytes rather than decoded speculatively. Exact record offsets and names are in `open-sans-font-evidence.json`.

## Result

Eleven files contain **ten unique fonts**: normal and italic faces at **300, 400, 600, 700, 800**. `OpenSans-RegularItalic.ttf` is byte-identical to `OpenSans-Italic.ttf`: 92,240 bytes, SHA-256 `df8cd21a27b100aeb75454d0c4cb04bbf5d1cc54676cc35718189bf07b774000`. Register one 400 italic face. The ten unique fonts total **967,952 bytes**; all report Version 1.10.

Every font has **OS/2.fsType=0** and embedded **nameID13 explicitly identifying Apache License, Version 2.0**. This supports separately licensed, unchanged font embedding with the complete license and applicable notices preserved. `fsType` alone is not a copyright license. A complete generic Apache 2.0 license is already available locally. No Open Sans-specific NOTICE was found in the retained extraction; whether a separate upstream archive contains one remains unknown.

## Exact face mapping

Register family `Open Sans`. Use OS/2 weight, not legacy subfamily “Regular”: the Light, SemiBold and ExtraBold fonts use separate legacy families but provide common typographic family nameID16 and appropriate nameID17. This set contains no 500/900 face.

| Filename | Weight / style | PostScript nameID6 |
|---|---|---|
| OpenSans-Light.ttf | 300 normal | OpenSans-Light |
| OpenSans-LightItalic.ttf | 300 italic | OpenSans-LightItalic |
| OpenSans-Regular.ttf | 400 normal | OpenSans-Regular |
| OpenSans-Italic.ttf | 400 italic | OpenSans-Italic |
| OpenSans-SemiBold.ttf | 600 normal | OpenSans-SemiBold |
| OpenSans-SemiBoldItalic.ttf | 600 italic | OpenSans-SemiBoldItalic |
| OpenSans-Bold.ttf | 700 normal | OpenSans-Bold |
| OpenSans-BoldItalic.ttf | 700 italic | OpenSans-BoldItalic |
| OpenSans-ExtraBold.ttf | 800 normal | OpenSans-ExtraBold |
| OpenSans-ExtraBoldItalic.ttf | 800 italic | OpenSans-ExtraBoldItalic |

The JSON records every file's complete SHA-256, size, source path, SFNT table offsets, and duplicate mapping. All italic faces have `italicAngle=-12`, OS/2.fsSelection italic bit set, and head.macStyle italic bit set. Normal faces have angle 0 and no italic bits. Bold normal flags are fsSelection32/macStyle1; BoldItalic33/3. Other normal faces use64/0; other italic faces1/2. These style-link flags do not override the weight class.

## Specific name records

The following are verified Windows platform3, encoding1, language1033 records; the JSON also retains other available platforms.

- **nameID0:** most files say “Digitized data copyright © 2010-2011, Google Corporation.” ExtraBold normal and SemiBold normal say “Digitized data copyright © 2011, Google Corporation.” Preserve both observed notices.
- **nameID1/2:** legacy family/subfamily. The 300/600/800 families are named Open Sans Light/SemiBold/ExtraBold; 400 and 700 use Open Sans.
- **nameID4:** full display name. **nameID5:** Version 1.10. **nameID6:** exact PostScript name in the table.
- **nameID8:** Ascender Corporation. **nameID11:** `http://www.ascendercorp.com/`. **nameID12:** `http://www.ascendercorp.com/typedesigners.html`.
- **nameID13:** `Licensed under the Apache License, Version 2.0`.
- **nameID14:** `http://www.apache.org/licenses/LICENSE-2.0`.
- **nameID16/17:** common typographic family Open Sans and Light/SemiBold/ExtraBold, with corresponding italic variants, for the split legacy families.

Embedded URLs are metadata; this audit did not open them.

## Complete local license and NOTICE search

`src/assets/fonts/roboto/LICENSE.txt` contains the complete generic Apache 2.0 license: 11,357 bytes, SHA-256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`. All nine numbered sections, END OF TERMS AND CONDITIONS, and appendix were checked. The existing Roboto NOTICE records its prior retrieval from a pinned Google Roboto repository. This is usable generic license text, **not** an Open Sans-specific sidecar. Do not copy the Roboto-specific attribution NOTICE as though it applied to Open Sans.

The retained extraction was inventoried recursively: **1,193 files**. The Fonts directory has no non-font sidecars. Filename candidates for license/notice/copyright/third-party/Apache material were only `SourceSansPro-OpenFontLicense.txt` and `ImageMagick-License`. Neither identifies Open Sans. A narrow search of local txt/md/html/htm/license/notice candidates found no Open Sans or Apache 2.0 grant text. The font metadata itself supplies the Apache 2.0 identification. This local negative result does not establish that every upstream Open Sans distribution lacks a NOTICE.

Relevant requirements in the local full text:

- Section 4(a): provide recipients the full license.
- Section 4(b): modified files need prominent change notices. Keep these font bytes unchanged for the proposed embedding.
- Section 4(c): retain applicable copyright and attribution notices in derivative source.
- Section 4(d): if a NOTICE accompanies the work, preserve applicable attribution notices readably.
- Section 6: no general trademark permission beyond describing origin and reproducing NOTICE.

A future product package can preserve the ten unchanged byte sets, include the generic complete license, and add a clear project attribution/source/version notice retaining the Google copyright strings and Ascender metadata. Offline HTML embedding should carry readable license/attribution as the existing Roboto path does. This audit has not created or altered product assets. It does not assert that Axure application code or unrelated assets share this font license.

## Boundaries

- Original retained font hashes are established; identity to a current upstream release is not claimed.
- Upstream Open Sans-specific NOTICE availability outside the retained extraction is unknown.
- Metadata does not prove browser metrics, native AutoFit behavior, or visual equivalence.
- No rendering or OS installation occurred; fonts and product files remain untouched.
