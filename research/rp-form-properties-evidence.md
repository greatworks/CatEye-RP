# Axure RP 11 native form properties and Set Focus

This stage uses the 11 original files pinned in `rp-form-candidates-evidence.json`, the self-written container/object reader, and static ECMA-335 metadata/CIL. No target assembly was loaded or executed. No original Axure GUI or generated-original-page differential was performed. The independent shipped-JavaScript/browser work is recorded separately in `form-properties-evidence.md`; isolated functions and DOM probes are not original GUI validation.

## Sources and reproducibility

- Target: extracted `Axure RP 11/AxureRP11.dll`, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Original installer ZIP: `research/vendor/AxureRP-Setup.zip`, SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Census: `node research/rp-form-properties-audit.mjs`. It reads all 11 originals, verifies their unchanged SHA, decodes their graphs, and imports the complete semantics including embedded resource bytes. It records file/package/object identity and current conversion results in `rp-form-properties-evidence.json`.
- Census JSON SHA-256: `31e8541420ee469d0609998490bf3fbcb833a4b89961e11bd364dfdc5710892b`.
- New metadata call-candidate inventory: `rp-form-properties-metadata.ps1/.json`. This is a static byte scan to narrow candidates, not sufficient proof by itself. Selected methods below were decoded by the existing full opcode reader `scripts/inspect-rp-serialization.ps1`.
- New selected CIL: `rp-form-properties-html-cil.json` SHA `f8dd3ab52df4e291b45da9cb2c5c2ea5622856f669068fc50df46b33b219dde5`; `rp-form-properties-html-writer-cil.json` SHA `a776d379b5b4dda8ddba19238995b9bb665af376d55fed116b85f7b40891646f`; `rp-form-properties-focus-cil.json` SHA `7653ad9dcc6a65612776f18c230a743d8a62209f5ac2e5c2403b3233ce17912d`.
- Previously retained CIL: `rp-interaction-PlainTextObject-cil.json`, `rp-interaction-TextBox-cil.json`, `rp-interaction-InputType-cil.json`, `rp-interaction-IxDiagramObjectPathsAction-cil.json`. Their exact hashes, parser/converter hashes, and test source hashes are in the new census manifest.

Offsets below are decimal IL offsets, method tokens are decimal metadata tokens. Serialization key strings pass through an obfuscated string accessor; this report does not claim those literals were decrypted. Exact native key spelling is independently observed in original decoded packages, and getter/serializer references establish the corresponding typed values.

## Evidence and implemented contract

| Native property | Static and sample evidence | Recovery |
|---|---|---|
| `ReadOnly` | PlainTextObject getter `100701328` IL8 reads `kNpW`, setter `100701329` IL36 writes the same field. Writer `100701362` IL352 reads the getter; reader `100701363` IL320 calls setter. All 125 inputs store an actual Boolean. | Input and TextArea explicit Boolean → `readOnly`. Missing/string/null is not inferred false. |
| `MaxLength` | TextBox ctor `100702268` IL83–88 explicitly sets `2147483647`. Getter `100702278` IL8 reads `ANZi`; setter `100702279` IL35 stores it. Writer `100702282` IL94 reads getter. All 120 actual TextBoxes store `2147483647`; all five TextAreas omit the field. | TextBox integer 0…2147483647; default Int32.MaxValue → omitted model field (unlimited). Explicit 0 remains 0. Negative, fraction, excess and missing values fail. TextArea field presence fails rather than introducing a feature. |
| `Type` | PlainTextObject getter/setter `100701335/336` read/write `nNpL`; InputType enum gives Text0, Password1, Email2, Number3, Phone4, Url5, Search6, and other HTML-oriented types. | This stage keeps only Text0/Password1 for TextBox and Text0 for TextArea. The single Phone4 sample remains unsupported. Enum identification alone is not full behavior equivalence. |
| `SubmitButton` | All 125 native input records have the exact local zero reference `{referenceTag:3,$reference:000…000}`. There is no nonzero sample in this census. A native nonzero serialization/target-type chain was not established. | Only explicit zero is recovered as no binding. Missing, wrong-tag, extra-field or nonzero references reject the form input. Authored product `submitButtonId` is a separate feature; this importer does not claim native binding recovery. |
| Focus `panelobjectpaths` | IxSetFocusOnWidgetAction derives from IxDiagramObjectPathsAction. Getter `100703447` IL8 reads `MNTn`, parent writer `100703463` IL373 reads `get_DiagramObjectPaths`; focus writer `100705070` IL34 calls parent writer. Four real actions each contain one local path reference. | Exactly one complete local path; empty rdo/repeater paths, non-dummy, exact local widget target or validated This sentinel. Target must decode and import as input/TextArea. No name rebinding or other-package fallback. |
| `SelectTextOnFocus` | Getter `100705065` IL8 and setter `100705066` IL36 address `MNoM`; writer `100705070` IL93 reads getter; reader `100705071` writes field at IL199/346. Four real actions store false. | Explicit Boolean → `setFocus.selectText`; false is retained. True is tested using a mutation of a real graph plus static field evidence, not claimed as a witnessed native nondefault sample. |

### Generator maximum-length boundary

`FNiU.SNPF` (`100699642`) reads input type at IL42 and `InputTypeFunctions.GNpV` at IL47, reads ReadOnly at IL74 and MaxLength at IL80, and passes them to `BNCJ.JNCt` at IL87. The latter method (`100699500`) compares argument9 with `2147483647` at IL1067–1074 and skips its corresponding output when equal; otherwise IL1133–1145 converts the integer using invariant culture and calls the attribute writer. ReadOnly argument8 branches at IL538–540. Attribute-name literals are still obfuscated.

The TextArea generator `FNiU.tNPb` (`100699644`) reads ReadOnly at IL57, supplies constant Int32.MaxValue at IL62, then calls `BNCJ.ANC5` at IL73. The latter compares its maximum argument7 with Int32.MaxValue at IL985–992. This supports the native default/no-output distinction and the absence of an independently configured native TextArea maximum. It does not prove that a negative number is a valid UI entry or a special unlimited sentinel; no such assumption is used.

### New decoder protocol

```json
{
  "status": "recovered-form-properties",
  "sourceType": "TextBox",
  "readOnly": true,
  "maxLength": 2147483647,
  "submitButton": null
}
```

`sourceType` is TextBox/TextArea, with TextArea `maxLength:null`. Invalid source values produce `unsupported-form-properties` and a reason. The converter independently verifies all keys, types, bounds, source identity and absence of a submit target. It skips the whole malformed input instead of silently weakening a read-only or length constraint. Legacy semantics without this protocol remain compatible and receive no new defaults.

Focus emits `{sourceId,type:'setFocus',targetSourceId,selectText}`. Action fields are revalidated again by the converter. The existing package-qualified target table and ambiguity checks apply; same source ID in another page cannot satisfy a reference. The entire event is rejected if any sibling action, case, condition or target is unsupported. Multiple focus paths are explicitly rejected even though original JavaScript uses only its first path: preserving the unused native editable targets is outside this single-target model.

## Original-file census and useful fixtures

There are **125 native text inputs: 120 TextBox and five TextArea**. ReadOnly is true4/false121. Native Type is Text117 (112 TextBox + five TextArea), Password7, Phone1. There are **zero finite MaxLength examples**, **zero nonzero input SubmitButton examples**, and **four SetFocus actions** (all SelectTextOnFocus=false).

All four actual read-only candidates successfully import from `Sample form patterns.rplib`, source SHA `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`:

| Page | Package | Object | Name / stored bounds |
|---|---|---|---|
| Time picker | `9a71bac8a6bf4e1fa6a9ee089e07a934` | `872aebaa8e954ea88db1bd532436cc3f` | Time input; x0 y18, 160.44776119402985×32 |
| Date picker | `0913f1d8cedb48dbb2e8fd7bae9f639e` | `318449c787c4401abb9c3b3229e41cc0` | Date field; x20 y38, 200×32 |
| Instructions | `9f2226d0f29c47a8b104b1293e29b97d` | `0c4ef1fc2cf44640a7a2846cb65c82ae` | Time Input; x20 y2183 |
| Instructions | same | `5d31bb5676714f14aad2fda5805547b1` | Date Field; x20 y2530 |

These controls are read-only text fields; the separate date/time popup interactions are not thereby recovered.

Two native Focus actions target explicit TextBox IDs: action `e1bfbf91885141ea9896cc76b40a3199` in package `7a4f596111ec489b94533436e3827e03` targets `37ef7d17c8154ad4b097ba0403a30f7a`; action `bfa7c0685c5945478737c3926f3b9b00` in Instructions targets `2587616b28dc42479ad0f2982092a7a1`. Both belong to Clear-click events containing unsupported SetWidgetRichText. The other two Focus actions (`9747e2defb0246b9908d005912eff4c1`, `7f5ecb58ef1b467587ca6902fcb4922b`) in package `684b472c8d9b43d6ae7e454749596a63` use zero This; owners are non-direct TextBox records Name input/Email input, and their event code33 is unsupported. Consequently **zero complete original Focus events/actions newly import**. Synthetic isolated mutations verify the implemented Focus subset without changing this claim.

Full original-file importer counts (top-level imported/skipped; nested imported/skipped):

| File | Top level | Nested |
|---|---:|---:|
| Default.rplib | 26/14 | 0/0 |
| Flow.rplib | 21/16 | 0/0 |
| Icons.rplib | rejected existing page-count limit | — |
| Sample form patterns.rplib | **529/202** (previous 525/206) | 406/64 |
| Sample UI patterns.rplib | 171/88 | 10/0 |
| Prototype Starter.rp | 57/31 | 28/0 |
| Prototyping Basics.rp | 172/27 | 52/0 |
| Quick Win.rp | 33/9 | 2/0 |
| UX Prototyping.rp | 126/27 | 0/0 |
| the-basics-tab-menu.rp | 3/0 | 2/0 |
| complex-interactions-required-fields.rp | 7/0 | 0/0 |

## Validation and limits

- New `node --test research/scripts/read-rp-form-properties.test.mjs`: **12/12 passed**. Tests include pinned native sample hashes, all four actual readonly candidates, MaxLength 0/bounds/malformed/missing, strict textarea and submit constraints, Focus This/local-path/strict-options, and unsupported-sibling atomic rejection.
- Together with `read-rp-shapes-forms.test.mjs`, `read-rp-interactions.test.mjs`, and `read-rp-error-hint.test.mjs`: **56/56 passed**. The existing TextArea negative test now uses string `ReadOnly:'true'`; Boolean true is intentionally supported.
- `npx vitest run tests/import-rp-form-properties.test.ts`: **23/23 passed**. Tests check pure conversion, persistence, no truncation of existing text, unlimited omission, malformed/unknown protocol, target eligibility, cross-package scope, duplicate IDs and atomic event rejection.
- `npm run typecheck`: passed. Product/parser/tests frozen after these checks. Parent owns full-suite, desktop and browser validation; their results are not inferred here.
- No `.rp` writing, target DLL execution, target GUI validation, finite native max-length sample, nonzero native SubmitButton recovery, expanded native InputType support, compound/repeater/native-master Focus path, arbitrary focusable-widget target or text-selection equivalence claim.
