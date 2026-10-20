# Independent adaptive property conversion matrix

This is **SYNTHETIC integration evidence**, not a new Axure-authored adaptive project, original GUI comparison, native save/export validation, or native write-back support. No product source, existing fixture/helper, historical report, or original sample was changed for this matrix.

## Pipeline and independent oracle

`tests/import-rp-adaptive-property-matrix.test.ts` supplies handwritten native property records and handwritten expected model declarations. The expected values are not sent to either reader and are not derived from its output or conversion helpers.

`research/adaptive-import-property-matrix-decode.mjs` calls the existing synthetic fixture builder, decodes its complete six-package RP container, replaces only the target's Tablet adaptive style carrier (and the explicitly requested rich paragraph mutation), and re-encodes actual bytes with the existing encoder. Every individual case then passes through `inspectRpSemantics`, including the container and object readers, before the TypeScript test calls `importRpSemantics`. No semantic report is injected or patched to imitate a source file.

The original Tab Menu source remains `research/samples/the-basics-tab-menu.rp`, SHA-256 `0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4`. The complete baseline SYNTHETIC carrier SHA-256 is `1889bb1c2ee4a4c4dd10585cccdd2c3c1c1dd0ed83ff7cfede667aed89f56d7b`. Its six packages include the exact referenced HTML configuration dependency; the matrix does not repeat the former version-only omission of that configuration.

Target identities are original page package `216580735aa64e1db9043586ecd32d66` and original vector source object `2f76607a24f242f6ba9db84b579676c9`. Matrix-local style object IDs use a distinct synthetic `fb` prefix. The original object bytes are never overwritten. Each encoded case's digest and byte length are recorded in the JSON evidence; temporary raw files are removed after decoding.

## Results

Focused result: **48/48 passed**: one pinned carrier check, 39 positive cases, and eight negative cases. TypeScript checking passed. No full suite, browser run, native application execution, rebuild, or package operation was performed.

| Family | Explicit expectations checked through both conversion boundaries |
| --- | --- |
| Fonts and decorations | Family; point-to-pixel size 18 → 24; weight; italic and explicit normal; simultaneous underline/strike and explicit false clears; ARGB alpha text color |
| Paint | Solid fill/stroke; linear and radial fill/stroke; preserved normalized endpoints/axes; duplicate stop offsets and alpha; modern RP11 nonzero stored angle does not rotate endpoint geometry |
| Border and opacity | Opacity; fractional width; dash-dot-dot enum; atomic start/end arrow pair; TRBL visibility including all false without converting it to a width reset |
| Text and effects | Four-side padding order, left/top and right/bottom alignment, outer shadow, inner shadow spread, explicit text-shadow off, P20 automatic spacing with proven normal rich paragraphs |
| Geometry and visibility | Complete Location/Size pairs, zero/negative position, explicit visible and hidden values |
| State maps | All seven native state names map to the exact camelCase model keys; explicit normal/false resets remain; empty Disabled state and empty whole-map barrier are distinct |
| Eligibility | Inactive unknown and inactive known fields do not become declarations |

Each positive checks exact reader patch equality, exact imported patch equality, unchanged Base widget, sparse page maps, unchanged orphan inactive map, six imported top-level widgets, four independent events, three actions, and strict document serialization/parse equality.

Each negative checks complete target rejection and removal of its adaptive maps while preserving five other top-level widgets, the independent four events/three actions, orphan map, and document round trip. The source-bound `widget-skipped` issue must carry the exact reader rejection reason. Negative carriers cover partial padding, extra solid-paint fields, an unsupported identity transform, an unknown active property, incomplete size, nonautomatic P20, automatic P20 contradicted by source paragraph spacing, and an unknown active state property.

The first run had 40 passes and eight failures. All eight were a **test diagnostic-code assumption**: the test looked for a code containing `adaptive`, while the importer intentionally emits its general `widget-skipped` code with the exact source ID and adaptive rejection message. The rejection and preservation behavior had already passed before that assertion. The test was corrected to require the actual precise code/source/package/severity/message contract; no product behavior or expectations for admitted values were relaxed. First-run log/JSON remain separately preserved.

## Reproduction and evidence

Normal focused verification:

```powershell
npx vitest run tests/import-rp-adaptive-property-matrix.test.ts
npx tsc --noEmit
```

Evidence regeneration is explicit so a future full test run cannot silently overwrite this snapshot:

```powershell
$env:REA_ADAPTIVE_PROPERTY_MATRIX_EVIDENCE='1'
npx vitest run tests/import-rp-adaptive-property-matrix.test.ts --reporter=verbose --reporter=json --outputFile=research/adaptive-import-property-matrix-results.json *> research/adaptive-import-property-matrix.log
Remove-Item Env:REA_ADAPTIVE_PROPERTY_MATRIX_EVIDENCE
```

`adaptive-import-property-matrix-evidence.json` stores all inputs, fixed expectations, observed outputs/reasons, raw case hashes, and product/reader source hashes. Its `assertedCases` only counts tests whose assertions completed. `adaptive-import-property-matrix-manifest.json` pins evidence files and source dependencies. All tests use independently encoded synthetic values; the real corpus still has no complete named adaptive-view set witness. This test result establishes consistency and strict boundaries of the implemented dual conversion, not completeness of the original format or pixel parity.
