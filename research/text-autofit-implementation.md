# Ordinary native shape text: independent initial layout

This stage fixes the four `Problems` / `Ideas` headings recovered from the two UX sample pages. Their saved owners remain 95×27 and 54×27, their explicit Open Sans Bold runs remain 28 CSS px, and their text can extend outside those rectangles without being wrapped or clipped by the shape. It does not establish full Axure parity or original-application pixel equivalence.

## Evidence and a corrected interpretation

The retained target is Axure RP 11.0.0.4150, DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. The real `UX Prototyping.rp` has SHA-256 `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72`.

The decisive [ordinary writer evidence](text-autofit-style-evidence.md) supersedes two overbroad interpretations in the earlier frozen [native helper report](text-autofit-native-evidence.md): its false layout argument was an alternative function scenario, and the x-minus-padding/width-plus-padding adjustment belonged to SelectionButton. The actual ordinary VectorShape writer passes true, replaces its measured text rectangle with a four-NaN sentinel, and skips the entire rectangle CSS writer. It does not export measured top/left/width/height for this text layer.

The owner's descendant rule instead supplies absolute positioning, `align-self`, native padding, `box-sizing:border-box` and width 100%. AutoFitWidth true writes nowrap; false writes break-word. Ordinary text height remains automatic. The new bounded replay has 19 composed cases and six source assertions; no original assembly or native font engine was executed. The [base CSS audit](text-autofit-base-css-evidence.md) and default/named-class closure establish the relevant declarations, not captured original pixels.

The [explicit-break evidence](text-autofit-breaks-evidence.md) independently follows the ordinary rich-text writer: CRLF/CR normalize to LF, then LF and U+2028 produce BR elements, after user markup is escaped. Its 24 narrow CIL cases pass. Non-final paragraph terminators are a separate importer normalization and are not stripped again by the renderer. Spaces follow the examined per-run rule: preserve a paragraph's leading space as NBSP and replace pairs of ordinary spaces twice with NBSP plus space; runs are not concatenated before encoding. TAB remains a text character.

## Implementation

- Optional `Widget.shapeText` retains both required Boolean flags. Strict project validation admits the field only on box, ellipse and path; malformed objects and unknown keys are rejected. Omission keeps existing projects' layout.
- Native ordinary VectorShape import preserves the flags, owner geometry, fonts, vector paths, rotation and all other fields. Tree labels and table/menu cells retain their separate behavior. Both known padding and vertical alignment are required to activate the new initial layout.
- A shared, self-contained renderer supplies an independent absolute text layer with natural height and flex self-alignment. React, standalone HTML and internal frame players use the same rules. When no line height was stored, the native text layer explicitly uses `normal`; it does not inherit the legacy editor's 1.35 multiplier. Explicit line heights remain unchanged. AutoFitHeight is retained, but does not independently change this initial CSS or resize the owner.
- Native text emits safe text nodes and explicit BR nodes. Rich paragraph, run and link identities remain intact. The offline renderer preserves unchanged nodes through pointer/focus events and resets layout properties when repainting.
- The contenteditable editor keeps text nodes and its established selection offsets. It uses pre/pre-wrap to preserve editable LF while respecting automatic-width wrapping. This is an independent editing implementation; it is not a claim about the original keyboard behavior or DOM.

No font shrinking, owner growth, parser broadening or third-party runtime copying is used to fix the headings. The existing licensed Roboto/Open Sans assets and notices remain unchanged.

## Verification

The pre-change browser test failed for all eight observations (four real headings in preview and offline): two lines and a fixed 27px text layer. After the change, all retain 28px runs and their exact owner rectangles while rendering one line at natural height. Captured browser pixels confirm visible dark glyphs beyond each stored owner width, rather than relying on unclipped DOM Range measurements alone.

The [corpus audit](text-autofit-corpus-evidence.md) covers 1,571 ordinary shapes: 929 FF, 343 TT, 259 FT and 40 TF. All have explicit recovered padding and vertical alignment. The [current import audit](text-autofit-import-audit.json) reimports all 11 pinned samples: ten accepted complete documents differ from the immutable baseline only by the new field; the previously rejected icon library retains its exact rejection. All 1,778 recovered nodes, including the 12 earlier rotation additions, retain their old content and geometry. All accepted documents round-trip unchanged. Four tree labels and 15 table/menu cells are excluded correctly.

Focused browser coverage exercises all four flag combinations, three vertical alignments and asymmetric padding in preview, offline and both independent frame players. It also covers explicit LF/U+2028, paragraph boundaries, literal HTML-looking text, legacy layout, and runtime style changes. The editor workflow checks selection formatting, soft breaks versus new paragraphs, local/global undo-redo, cancel, save/reopen, fonts, link identity and owner geometry. See [the stage verification](text-autofit-verification.json) for full unit, parser, production-browser and exact-package results and their hashes.

A later plain-text probe caught a gap in the first 217-test production pass: absent line height inherited 1.35 in preview but used `normal` offline. The new regression failed before the fix, then passed in both modes after the shared default was made explicit. The synthetic fixture and exact-package checks now cover the same case in the editor and all four players. The earlier production result and package reports are preserved under `.build/text-autofit-before-natural-line/`. That first package suite also exposed a stale native-caption assertion about the old text container; the revised assertion checks self-alignment and visible overflow while retaining its geometry and glyph checks. Final verification records the rerun separately.

## Remaining limits

Original Axure GUI/sample export and pixel comparison remain unverified. Native font measurement and complete load/style synchronization were not reproduced. Runtime native SetText AutoFit can resize or move its owner; that separate behavior remains unimplemented, and the import report explicitly retains this limitation. There is no new authoring control for the two native flags in this stage. Missing layout metadata uses the previous layout. Broader native shapes, rich lists/unsupported run structures, text rotation and exact editable trailing-break/TAB spacing require further evidence.

Historical research manifests, screenshots and exports are retained. Regression runs save newly produced replacements separately before restoring those historical files. The current package and verification records identify the exact tested application archive.

The frozen break-writer report also records three pre-change product files as comparison inputs (`RichTextContent`, `RichTextEditor` and `export-runtime`). Their recorded hashes are checked against the previously verified Open Sans source manifest; their updated bytes are checked against this stage's source freeze and change audit. They are explicitly reported as historical comparison inputs, not counted as unchanged live evidence. Original binary, CIL, corpus and importer evidence files still require exact live hash matches.
