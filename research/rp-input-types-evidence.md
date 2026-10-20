# Axure RP 11: the text-field input-type subset

This stage reads original RP/RPLIB files and retained or newly decoded native metadata/CIL. The target assembly is never loaded/executed. No original Axure GUI session or generated-original-page comparison is claimed. The separate `input-types-evidence.md/json` covers the sibling investigation's isolated shipped-JavaScript and actual browser probes; those are a different evidence layer.

## Provenance

- `AxureRP11.dll` SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Original ZIP SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- `node research/rp-input-types-audit.mjs` checks all 11 original sample hashes, decodes records, and converts full semantics including embedded resources. `rp-input-types-evidence.json` SHA-256: `57354ca850ac30ef6d7a43c06de841dfd0892b00ef4eeab27a3106eff4da1c9e`. It records every original file/package/object identity, fields, stored text/hint, type candidate, and importer counts. Old evidence files were not overwritten.
- `rp-input-types-metadata.ps1/.json` is a static call-byte candidate scan only. Selected calls were then verified with the full opcode reader `scripts/inspect-rp-serialization.ps1`.
- New selected CIL files: `rp-input-types-iterator-cil.json` SHA `6f8cb98e9425c4bb7f72fe1008db05c627e42186f2de4d0d70609a4d81644a6a`; `rp-input-types-chooser-cil.json` SHA `a229e4b6baef343f42e88531830ffcd7a54930fe68d08e2d3479378799a39a14`; `rp-input-types-setter-lambda-cil.json` SHA `df822b8047bb646b5db0706d0feb4c2887480efd5504bfd76ae18ff4a27e3f22`; `rp-input-types-hint-cil.json` SHA `6c8f902aef5224af5e0ababc267c3e9dcffbbf43de407eab84406423441fdbdc`.
- Retained enum/function evidence: `rp-interaction-InputType-cil.json`, `rp-interaction-InputTypeFunctions-cil.json`; retained generator/writer evidence: `rp-form-properties-html-cil.json`, `rp-form-properties-html-writer-cil.json`. All are hashed in the new JSON manifest.
- [Official text field and text area documentation](https://docs.axure.com/axure-rp/reference/text-fields-text-areas/) checked 2026-10-13. It documents eleven selectable categories and identifies them as HTML input types. Its File category opens the device picker; it does not upload to an Axure prototype.

## The chooser has eleven values, not the entire enum

`Axure.DocumentModel.Objects.InputType` has 23 enum values (0…22, excluding its backing `value__` field). Supporting every enum entry would overstate the actual editor feature. `InputTypeFunctions.TNpB` (`100701305`, AllTypes) constructs `<AllTypes>d__0`. Its `MoveNext` method (`100701312`) only assigns these constants to `<>2__current`: **0, 1, 2, 3, 4, 5, 6, 12, 17, 18, 19**. The other enum values are not yielded.

The UI consumes that exact iterator: `aVWK.rV6b` (`100673948`) IL335 calls TNpB, IL374 applies the display-name selector, and IL379 populates the chooser. `aVWK.nV69` (`100673952`) IL652 calls TNpB again and IL669 indexes that list before invoking SetInputType. Thus the subset is proven by the actual chooser call path, not inferred from translated labels alone. All IL offsets here are decimal.

| Native enum value/name | Current standard HTML mapping | Original-sample records |
|---|---|---:|
| 0 Text | `text` | 112 TextBox (plus five separate TextArea) |
| 1 Password | `password` | 7 |
| 2 Email | `email` | 0 |
| 3 Number | `number` | 0 |
| 4 Phone | `tel` | 1 |
| 5 Url | `url` | 0 |
| 6 Search | `search` | 0 |
| 12 File | `file` | 0 |
| 17 Date | `date` | 0 |
| 18 Month | `month` | 0 |
| 19 Time | `time` | 0 |

**Mapping boundary:** `InputTypeFunctions.GNpV` (`100701306`) switches on all 23 native numeric values and returns values from the obfuscated `sIho` string accessor. Its precise return literals were not decrypted. The table's HTML strings are the documented standard mapping used by this independent implementation, not a claim that all eleven native literal bytes have been statically recovered. File, Date, Month, Time, Number, etc. retain browser-specific rendering, sanitization, input validity and keyboard behavior.

## Authoring values, read-only, maximum length, and hints

The chooser's `LjFt.tjjS` (`100684374`) calls its getter/setter pair. Setter lambda `<SetInputType>b__113_1` (`100684548`) at IL36 only calls `PlainTextObject.set_Type`; getter lambda `100684547` reads `get_Type`. The retained setter `100701336` writes the backing enum field. There is no text-clearing call in this path. The independent authoring document therefore preserves text when a user changes an input type.

`FNiU.SNPF` (`100699642`) reads Type (IL42), obtains GNpV (IL47), reads authored Text (IL53), ReadOnly (IL74), and MaxLength (IL80), and calls `BNCJ.JNCt` (IL87). This is a shared generator path; it does not reduce non-text types to Text or clear their source text in that method. The native attribute-name strings remain obfuscated. The writer's ReadOnly and Int32.MaxValue checks are detailed in `rp-form-properties-evidence.md` and remain applicable to stored fields. Browser applicability differs from storage: retaining a maxLength/readOnly property does not claim every HTML type enforces it.

The exact generated `min`, `max`, or `step` attribute defaults were not recovered. In particular, validity/step mismatch must not be treated as proof that the browser's current value is empty. The sibling browser probes distinguish an initial `value` attribute from later `.value` assignments; this report does not substitute an assumed step formula for those observations.

`TextBox.get_SupportsHint` (`100702277`) is precise: get_Type at IL8, compare to File12 at IL13–15, negate at IL17–18. Therefore File is excluded from native hint support. The generator helper `wJe6.HJeX` (`100694316`) references this capability at IL109 and has a false-return branch at IL114→107; it also inspects Hint style state32 and PlaceholderText. Arbitrary File+Hint combinations in a handcrafted browser host are not evidence of normal native UI output. Number/date/time remain in the supported-hint capability set, while actual DOM values can be sanitized by the browser.

No nonempty native File input example exists among the original files. The importer deliberately uses a narrower contract than the authoring model: only **explicit empty TextBlock.text and empty PlaceholderText** permit File recovery. It does not restore a file selection, access a local file, upload a file, or reinterpret a saved path as a selected file. A nonempty or missing text/hint fails the native input. This is a conservative recovery boundary, not a claim that native File stores can never contain residual authoring text after a type change.

## Import and expression contract

The worker's self-contained `.mjs` decoder maps native codes from the proven eleven-value subset. It emits:

```json
{
  "type": "input",
  "inputType": "tel",
  "nativeInputType": 4,
  "inputTypeMapping": "standard-html-input-type"
}
```

The TypeScript converter validates the standard name against shared `INPUT_TYPES`, validates its numeric identity and mapping marker, and reports the native-literal/browser boundary for expanded types. Legacy Text/Password semantics without these provenance fields remain accepted. Out-of-subset enum values, unknown strings, wrong mappings and malformed fields are rejected. ReadOnly, MaxLength, SubmitButton, widget identity, geometry, style and event atomicity constraints from previous stages remain in force.

File conversion additionally requires valid existing form and hint protocols, and rechecks the converted text/hint are empty. The model may preserve nonempty author-created File text for editing, but that is not equivalent to native `.rp` recovery or a browser file selection.

`GetWidgetText` conditions and SetFocus still target only successfully imported input/TextArea widgets. No other carrier types, missing targets, cross-package rebinding or compound paths were added. Native input-type changes do not alter the expression carrier type: it is still an HTML input value. Runtime expression providers must read the actual browser value (including sanitization and transient file chooser state), not blindly treat stored authoring text as the current value. SetFocus may carry `selectText:true` for all these types; unsupported browser selection APIs require runtime handling and are not evidence of all-type text selection equivalence. Atomic import does not execute expressions or user-supplied script.

## The one real newly recoverable control

- Original: `Sample form patterns.rplib`, SHA `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`.
- Page **Personal information form**, package `784fffad1a36482594f6f965760990d6`.
- Widget **Phone Number Input**, source ID `ab5ee8299744448f84b17c9c3f1b3142`.
- Native Type4, WordWrap=false, ReadOnly=false, MaxLength=2147483647, SubmitButton=local zero, text/hint empty; no recovered interaction events.
- Explicit stored x20 y256 width400 height48; local fill `#f9f9f9`, stroke `#c2c2c2`, text `#333333`, Roboto16. Its inherited style cache and some state patches remain unresolved and stay in the import report. It is not an exact native appearance claim.

The form library changes from **529 imported / 202 skipped to 530 / 201**, with nested **406 / 64** unchanged. The prior four read-only controls remain imported. No other original-file counts change: Default26/14, Flow21/16, UI171/88+nested10/0, Starter57/31+nested28/0, Basics172/27+nested52/0, Quick33/9+nested2/0, UX126/27, Tab3/0+nested2/0, Required7/0. Icons still exceeds the existing page-count limit. There is one new real input, not eleven newly witnessed input types.

## Verification

- `node --test research/scripts/read-rp-input-types.test.mjs`: **7/7 passed**. Covers all eleven numeric mappings, excluded enum values, literal authored values, File empty/missing/nonempty constraints, the pinned Phone source and GetWidgetText graph recovery.
- `npx vitest run tests/import-rp-input-types.test.ts`: **29/29 passed**. Covers eleven imported types with Focus/conditions and save/readback, mapping identity, File strictness, legacy compatibility, and actual form-library counts.
- Related parser suite (`read-rp-input-types`, `read-rp-form-properties`, `read-rp-shapes-forms`, `read-rp-interactions`, `read-rp-error-hint`): **63/63 passed**.
- Related six importer suites (`import-rp-input-types`, `import-rp-form-properties`, `import-rp-shapes-forms`, `import-rp-error-hint`, `import-rp-interactions`, `import-rp`): **139/139 passed**.
- `npm run typecheck`: passed. Parser/converter/tests frozen after these checks; parent coordinates full browser, desktop, and packaging checks separately.

No original GUI validation, target assembly execution, new sample download, native `.rp` writing, file-content read/upload, complete native string-table decoding, or full support for every InputType enum member is claimed.
