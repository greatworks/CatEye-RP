# Native rich text explicit breaks: narrow static follow-up

The ordinary shape text writer emits actual HTML `<br>` elements for explicit line breaks. It does not rely on `white-space:pre-wrap` for these breaks. This supports retaining explicit breaks when implementing the independently proved AutoFitWidth → nowrap behavior, without changing the owner rectangle or font size.

Source: retained Axure RP 11.0.0.4150 `AxureRP11.dll`, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. All new CIL records were read with PEReader through the existing `inspect-rp-serialization.ps1`; no original assembly/application was loaded or executed. No product, test, old evidence or old manifest was modified. No sample census or browser run was performed.

## Exact ordinary writer chain

Offsets below are decimal CIL offsets.

| Source | Method/token and IL | Established result |
|---|---|---|
| `text-autofit-native-text-callers-cil.json` | fNPD 100699662, IL348–355 | Calls ONiF with final arguments true, false. The final false selects the ordinary text encoding branch below. |
| `rich-text-format-html-cil.json` | ONiF 100699551, IL802–817 and996–1006 | Both direct runs and runs under a hyperlink pass ONiF argument4 as KNiN argument3. |
| `rich-text-format-html-inline-cil.json` | KNiN 100699555, IL270–307 | False argument3 takes run.get_Text → nNiB; the alternate true branch zNir is not part of this ordinary fNPD call. Span template decoded at IL176 is `<span{0}>{1}</span>`. |
| `rich-text-format-html-text-cil.json` | nNiB 100699548, IL7–14 | zNiG(text), then rNiV(result, leading-space flag). |
| New `text-autofit-breaks-normalize-cil.json` and `normalize-init-cil.json` | PbDL 100688584, IL86–125; ebDE .cctor100688636, IL61–71 | Null becomes empty. `nbL5` is Regex `\r\n?`; replacement is LF. Thus CRLF and standalone CR each become one LF. |
| `rich-text-format-html-text-cil.json` | zNiG100699547, IL360/388/393 | LF is replaced by literal `<br>`. |
| Same | zNiG IL426/459/464 | U+2028 LINE SEPARATOR is replaced by literal `<br>`. |
| Same | zNiG IL35–333 | Escapes &, <, >, double quote and bullet before creating `<br>`, so user `<br>` text is escaped, not interpreted. |
| `rich-text-format-html-linebreak-cil.json` | rNiV100699549 | This misleadingly named record handles leading/double spaces with `&nbsp;`; it is not the newline converter. |

`text-autofit-breaks-literals.mjs` resolves only selected method arguments using the already retained static literal decoder and arithmetic flow fields. Its JSON records the exact file, method/token, IL, folded resource offset and decoded text. No guessed replacement literals are used.

## Paragraph terminators are distinct

ONiF first clones its attributed string (IS0V100707936, captured in `text-autofit-breaks-prepare-cil.json`) and then calls ES0b100707942 at IL205. ES0b enumerates `ReverseEnumerable(paragraphs).Skip(1)`: the original last paragraph is excluded. Iterator types and MoveNext CIL are retained in the new enumeration/skip/reverse records. For each remaining paragraph, IL91–122 obtains its last recursive inline edge, normalizes CR with PbDL, applies `TrimEnd(char10)`, and writes that text back to the clone. The container MIQt implementation follows `Inlines.Last().MIQt`; hierarchy and edge CIL are captured separately. This is static inspection of paragraph preparation, not a full ONiF replay.

Therefore non-final paragraph terminal LF sequences are removed before per-run HTML encoding; an internal LF survives and becomes `<br>`. The already imported corpus convention (one terminal LF on each observed non-final paragraph, normalized once into a paragraph boundary) remains compatible. The final paragraph is excluded from this cleanup. This investigation does not broaden importer acceptance for unobserved run arrangements or claim complete empty-paragraph/list behavior.

## Narrow replay and product consequence

`node research/text-autofit-breaks-replay.mjs` passes **24/24** cases against the actual retained nNiB/zNiG/rNiV/PbDL/SbDY instruction streams. Cases cover LF, CRLF, CR, U+2028, repeated/leading/trailing LF, empty/null, escaped literal HTML and mixed breaks; both leading-space flag values are exercised. U+2029 is not replaced by this serializer chain. That last result is not a claim about a browser's eventual treatment of U+2029. .NET String/Regex operations are explicit narrow sinks, and the regular-expression literal is asserted from the initializer. The replay does not invoke ONiF, native text measurement, or a browser.

Current product rendering differs structurally:

- `RichTextContent.tsx` emits each run as a React text node under `whiteSpace:'pre-wrap'`; it adds `<br>` only for an entirely empty paragraph.
- Offline `paintRichContent` writes `run.text` via textContent and also relies on pre-wrap, with a BR only for an empty paragraph.
- `rich-text-dom.ts` writes run textContent; its BR is an editor caret sentinel for empty/trailing-LF paragraphs, not a conversion of every internal LF. Selection offsets and readback count text nodes and synthetic paragraph separators. The editor's own input path normalizes CRLF/CR to LF and represents Shift+Enter as a run-internal LF; original keyboard command parity remains unverified by the earlier inline-text investigation.

Simply setting the existing rich wrapper to nowrap would thus discard its current CSS mechanism for explicit LF display. A future native-layout branch needs structural breaks (or another explicitly justified newline-preserving mechanism), including breaks across separately styled/link runs. If the contenteditable DOM itself changes to BR tokens, its offset/readback/sentinel logic also needs a coherent mapping because BR contributes no textContent character. Rendering BR fragments alone must not silently rewrite run identity, links, saved text or owner geometry.

Remaining unknowns: native keyboard mapping to U+2028 versus LF; alternative zNir branch and other caller modes; complete original final cascade/ink; all empty/list paragraphs; unsupported native run layouts. The independent corpus worker owns actual occurrence counts. No finding here justifies reducing fonts, resizing the owner or declaring final overflow pixels proven.

New report manifest: `text-autofit-breaks-evidence.json`. Old reports remain unchanged. Reproduce the narrow decoding/replay with `node research/text-autofit-breaks-literals.mjs`, then `node research/text-autofit-breaks-replay.mjs`, then `node research/text-autofit-breaks-report.mjs`.
