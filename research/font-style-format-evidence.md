# Native font style: format evidence and strict recovery

This stage reads the original RP 11 files and ECMA-335 metadata/CIL without loading or executing the vendor assembly. It does not claim complete rich-text compatibility or original GUI validation. Product changes are limited to `fontStyle: normal | italic`; rich-text actions remain research only.

The original census is retained unchanged in [font-style-format-evidence.json](font-style-format-evidence.json). Its parser hashes and unresolved-property snapshots describe the **pre-implementation** state. [font-style-format-verification.json](font-style-format-verification.json) adds the typed run writer, full run census, final source hashes and targeted validation. It is produced by `node research/font-style-format-finalize.mjs`; it never rewrites historical dropdown or caption evidence. The parent-owned final importer audit is [font-style-import-audit.json](font-style-import-audit.json).

## 1. Property 1002 is an enum, not font-weight bits

Original `AxureRP11.dll` SHA-256:

`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`

The retained metadata identifies `Axure.Platform.AxFontStyle`, TypeDef `33558145`, signature `11BA04`:

| Value | Native enum | This release |
|---:|---|---|
| -1 | None | Not mapped; retained as unknown |
| 0 | Normal | `normal` |
| 1 | Italic | `italic` |
| 2 | Oblique | Not mapped; retained as unknown |

Evidence: [font-style-format-metadata.json](font-style-format-metadata.json), [font-style-format-property-cil.json](font-style-format-property-cil.json). `xtod.jtoq.ktz1`, token `100717693` (`0x0600d47d`), loads `1002` at IL `0x08`, calls `get_Item` at `0x0d`, and returns the generic property whose value type is `11BA04`. `K5BG` token `100717756` returns `11BA04` through that property. `W5BB` is the corresponding typed setter.

Do not confuse this with `Axure.Axvg.Graphics.FontStyle`: its values are Normal=0, Oblique=1, Italic=2. `RPFormatExtensions.zJcu`, token `100692666`, explicitly converts Platform 1→Graphics 2 and Platform 2→Graphics 1. See [font-style-format-conversion-cil.json](font-style-format-conversion-cil.json).

CSS formatting is also independently visible: `PNKu.CNxN` token `100699317`, IL `0xf2–0xfd`, constrains `Platform.AxFontStyle`, calls `ToString`, then `PNKu.LNx3`. `LNx3`, token `100699325`, calls `String.ToLower` at IL `0x08`, then replaces spaces with underscores at `0x11`. Oblique is therefore not an alias for Italic in that formatter. The property-name literal remains obfuscated. The independently pinned shipped-JS/Edge evidence in [font-style-runtime-evidence.json](font-style-runtime-evidence.json) shows direct `fontStyle` assignment and distinct CSS oblique. Product support remains deliberately two-valued.

## 2. The attributed-string run carrier uses the Platform enum too

This is separately verified; the PName numbering alone was not used to infer run values.

[font-style-format-run-base-cil.json](font-style-format-run-base-cil.json) contains:

- `aSXQ.iSXv.OIQV`, token `100707827`, signature `200011BA04`, reads field `NSmW`, signature `0611BA04`.
- `aSXQ.iSXv.eIwT`, token `100707862` (`0x0600ae16`), builds an ordered 12-entry `MtXw.StXT` property map. The sixth value is `OIQV` at IL `0x132`, followed directly by `Wtnq.op_Implicit` at `0x137` and `StXT.Add` at `0x13c`. There is no graphics-enum conversion here.
- Every one of the 2,862 observed `Axure:AttributedString:AxRun` maps has exactly the same key order: `Type, Text, Family, Size, Weight, Style, Stretch, Underline, Color, Baseline, CharacterSpacing, Strikethrough`. The typed getter sequence in `eIwT` matches that map, including Style in position six.
- The later rendering conversion `RPFormatExtensions.bJcT` calls `Typeface.N5Cc` at IL `0x6a`, `zJcu` at `0x6f`, then graphics `Run.set_Style` at `0x74`. This is where the enum values change for graphics rendering, not in the persisted map above.

Boundary: the obfuscated key literal itself was not decrypted. The map field identification is a joint observation of its unique ordered structure, the matching getters and their metadata signatures. No original DLL function was executed.

## 3. Eleven-file census and the eight blocked focus/blur events

All eleven source paths and SHA-256 values are stored in both census manifests. The form source is `Sample form patterns.rplib`, SHA-256 `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`.

The property and run populations are different:

- 2,069 PName1002 records, including caches and state snapshots: all numeric **0**.
- 2,862 attributed-string runs: **2,742 Style0** and **120 Style1**. The italic runs occur in Form (71), UI patterns (19), Starter (3), and Basics (27).
- Those 120 italic runs belong to **50 objects**, all with mixed Style0/1. There are **zero uniformly italic objects** in this corpus.
- 49 of these mixed objects are imported, all without a declared widget `fontStyle`; the mixed format remains reported instead of becoming a claimed uniform normal/italic style. One source object is omitted. For example, Form package `c598ff6cf4ba459cbef032f0cd4048f7`, object `be8f445cd91246718ce2410f92d0be0b`, has runs `[0,0,0,0,0,1,0,0,0]` and no imported `fontStyle`. All 50 owner IDs, run sequences and imported-member matches are in the verification JSON.

The two Exp. Date targets from the earlier [dropdown event audit](rp-dropdown-event-reasons.md) are:

| Source package | Widget ID | Selected Style ID |
|---|---|---|
| `d769a1bb062d46ae9140ccafe936455e` | `81407e7110764806ab119ed3a69a5ace` | `e62ca07fe2f14766ab1236ab95864e46` |
| `c356742c685a47b0b1a9b4abc4dd2ad8` | `f5ba5ff93b4d4b5c8467778d88421fc4` | `ec1de2c9ed1644a2a28fbb3d44f60bee` |

Both selected PropLists contain **52 entries**. Only PName6 (foreground color) is overridden; PName1002 is numeric0 with raw DOAName `-2147482646`, determined=true, overridden=false. The snapshots also contain unsupported stretch, geometry, image and shadow records. Their base1002=0 originates in default style `627587b6038d43cca051c114ac41ad32`, library `61e3924b25c44f18a45c876a031974fd`.

DOAName flag facts are proved: `mJG4.Overridden` token `100691356` reads the `0x40000000` bit; `d5jO<T>.Y5jQ` token `100718026` transfers it through `Overridden` at IL73 and `e5jG.t5jR` at IL78. `WtTU.WtwM` token `100717150` is the `OverriddenProps` collection getter; `IxEvaluator.YNwU` token `100703567` calls it at IL234 for **ApplyStyleInfo**. Files: `font-style-format-flags-cil.json`, `font-style-format-flag-caller-1.json`, `font-style-format-property-base-cil.json`, `font-style-format-style-full-cil.json`, `font-style-format-native-state-0-cil.json`.

**Still unproved:** the complete IX_STYLES HTML generator's filtering of these 52-entry snapshots. ApplyStyleInfo is not sufficient evidence for that separate path. This release does not silently remove 51 entries or claim the snapshots are color-only. Both selected styles and their eight dependent focus/blur events remain rejected atomically. Parser-decoded eight does not mean imported eight.

## 4. Implemented contract

- PName1002 and uniform AxRun.Style map only numeric 0/1. Oblique, None, wrong types and mixed runs retain unknown details.
- Cached values may provide normal appearance; uniform run typography supersedes cached typography. A local/state font style must be explicitly overridden to supersede run formatting. A merely determined local normal is reported and cannot silently clear a run's italic style. This is a conservative supported subset, not a complete native PropList merge algorithm.
- Named interaction and selected font patches require determined **and** overridden1002. Unknown companion fields or values reject the whole state, while independent other states can survive.
- An explicit selected `normal` is retained even if equal to base. It must still override a simultaneous hover `italic`; equality with base is not proof that the state property is redundant. Existing non-font selected handling is unchanged.
- Import revalidates `normal|italic` and the property-to-output correspondence. Named-state source-property capacity is 16 after adding1002. Unresolved inheritance still supports only the previously proved independent color subset.
- No default fontStyle is injected into older author documents. This stage does not add rich run spans, decode rich-text actions or silently flatten mixed formatting.

The parent final importer audit records **0 added widgets and 0 added events**, and **1,650 imported widgets with normal / 0 with italic**. Form remains 558 top-level +438 nested widgets and 38 imported events. These are corpus recovery counts, not a claim that native italic was absent: the mixed runs above remain unsupported as rich formatting.

## 5. Rich-text action carrier: observed, not implemented

The corpus contains 152 `SetWidgetRichText` FCalls and zero `GetWidgetRichText` FCalls. The detailed source packages, object IDs, actions, blocks and arguments are retained in the original census JSON. The observed action is `Axure:InterationActionSetFunction` (native spelling), `SetFunction='SetWidgetRichText'`, with an `action` reference to an ordered `Expr:Block` containing FCalls. Arguments are:

1. `DiagramObjectPathLiteral`;
2. `StringLiteral` or another `FCall`;
3. `BooleanLiteral`, whose observed `value` is the string `True`, not a JSON boolean.

Some text values contain `[[Item.First_Name]]` and other substitutions; some paths are compound. The existence of a `RichTextLiteral` metadata class does not prove it is the carrier of these 152 calls: none of the observed calls uses it in the second argument. Full rich formatting, dynamic values, substitution, plain/non-plain behavior and target scope require separate recovery work. This release keeps the existing atomic action rejection. The sibling runtime probe covers function behavior independently and does not establish an unwitnessed serialized carrier.

## 6. Validation and reproduction

New tests: 8 parser tests and 15 importer cases. They verify typed enum evidence, uniform/mixed/unknown values, explicit resets, source flag rejection, immutable conversion, serialization round-trip, state atomicity and all16 source properties. The official Tab Menu sample verifies real normal typography without changing its selected fills.

```powershell
node --test research/scripts/read-rp-font-style.test.mjs research/scripts/read-rp-interaction-styles.test.mjs research/scripts/read-rp-appearance.test.mjs
npx vitest run tests/import-rp-font-style.test.ts tests/import-rp-interaction-styles.test.ts
npx tsc --noEmit
node research/font-style-format-finalize.mjs
```

Results from this agent: **39/39 targeted Node, 36/36 targeted Vitest, typecheck passed**. After adding the direct run writer metadata assertion, the eight new Node tests passed again. Full suites, browser font-face validation, native smokes and packaging are parent-owned and are not claimed by this report. Exact evidence/source hashes are recorded in the verification JSON; the original DLL and sample bytes are not included in the product.
