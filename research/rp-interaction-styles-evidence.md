# Native RP interaction appearance: restricted recovery

Date: 2026-10-13. Target: the existing official Axure RP 11.0.0.4150 distribution and eleven SHA-pinned RP/RPLIB samples. This phase reads static ECMA metadata and executes only the self-written container/object/semantic reader and our own pure importer. It does not load or execute the target assembly, start the original application, or claim a GUI comparison.

## Evidence identity

- Target `AxureRP11.dll`: SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Original distribution ZIP: SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- [Static state enum](rp-interaction-styles-enum.json): SHA-256 `7efee46073693ffd06fdec33b57fb9c3fef2ea5289d457f83143039d2ecfe9dc`.
- [Narrow metadata inventory](rp-interaction-styles-metadata.json): SHA-256 `6e9ce10491317281b1723e8913a61e49f06bee03c305eca02edea35d6c2412f9`.
- [Metadata probe](inspect-rp-interaction-styles.ps1): SHA-256 `ef412e4ec8a3304bd9798d2e97d5c200f707619ce7afee6f6e807f6d8f159fbc`. It uses PEReader/MetadataReader; it does not invoke target methods.
- [Sample/candidate/import ledger](rp-interaction-styles-evidence.json): SHA-256 `43aa37e6d28e82c7a358d5d0079a75a6ad8a22b55b971ae30ed8093f92d6550d`. Contains every sample SHA, source package/object/style IDs, raw state PropList entries, status/reasons, provenance, final imported styles, and the hashes of our executing source files.
- [Reproducible audit](rp-interaction-styles-audit.mjs) pins input hashes from the unchanged [earlier sample manifest](rp-form-candidates-evidence.json). It uses Node type stripping only on our own TypeScript converter and validates resulting documents through our model parser.

Existing field evidence is retained in [text-layout evidence](rp-text-layout-evidence.md), [selection evidence](rp-selected-state-evidence.md), and [geometry style metadata](repeater-geometry-style-evidence.json). No earlier evidence ledger was replaced.

## Confirmed state identity and storage

The relevant enum is `Axure.Platform.ObjectPersistanceContext.IxStyleState`, TypeDef token **33558616**. These are static constant fields, not an inference from arbitrary text matches:

| State | Value | Field token | Output state / model field |
|---|---:|---:|---|
| MouseOver | 1 | 67132361 | mouseover / mouseOverStyle |
| MouseDown | 2 | 67132362 | mousedown / mouseDownStyle |
| Focused | 4 | 67132363 | focused / focusedStyle |
| Selected | 8 | 67132364 | existing selectedStyle pipeline |
| Error | 16 | 67132365 | omitted |
| Hint | 32 | 67132366 | omitted |
| Disabled | 64 | 67132367 | disabled / disabledStyle |

`Axure.Constants.PName.IX_STYLES` is **21**, field token **67121794**. Do not substitute the differently numbered `Platform.ControlState` enum. `Interaction=128` and combined enum members also exist; these do not establish a supported serialized map entry or combined-state evaluator.

Observed chain in real structured object packages: `widget.MyStyle` → Style.PropList PName21 → map keyed by `MouseOver`, `MouseDown`, `Focused`, `Disabled` → package-local reference tag3 → `Axure:Style` → explicit PropList. The state references, their resolved objects, and solid fill payloads are in the ledger. This establishes storage correspondence together with the enum. This phase does **not** claim that the obfuscated serializer was proven to use a specific `Enum.ToString` implementation.

Every accepted real state has `All=false`, an explicit PropList, and only supported properties. `All=false` is a conservative observed-pattern gate; this work does not derive every meaning of `All` for arbitrary styles. Metadata keys outside the observed set, missing PropList, inherited style PName0, gradients, unresolved references and combined state map names remain unsupported.

## Recovery contract and limits

Each semantic widget may contain `interactionStyleRecovery`. A successful map has status `recovered-interaction-styles`, boolean `cacheChainComplete`, and exactly four lowercase state records. Every record identifies its exact native `sourceState` and one of:

- `supported-state-style`: sourceStyleId, sourceProperties, explicit partial style, and provenance.
- `no-state-style`: absence established by a complete cache chain, or an explicit zero reference. It does not mean the other states are absent.
- `unsupported-state-style`: reason and any source identity already recovered. No partial style is applied for that state.

If the IX_STYLES map/chain itself cannot be established, status is `unsupported-interaction-styles`. Error/Hint entries are retained as `unhandledStates`, not interpreted as one of the four new states.

An unresolved base does not invalidate an independently stored solid color. When the IX_STYLES map is explicitly local/determined/overridden and its state explicitly supplies **only PName6/7/8**, the patch is marked `independentOfInheritedBase:true`. These values fully specify color/fill/stroke. Missing local states remain unknown; no font, border-width, geometry, or complete normal appearance is inferred from this exception.

With the already validated complete cache chain, the restricted converter recognizes PName1 fontFamily, 2 point-size converted to CSS size, 6 color, 7 fill, 8 stroke, 9 horizontal alignment, 10 vertical alignment, 15 strokeWidth, 20 automatic line spacing, 70 opacity, and 1001 fontWeight. Padding11/12/13/14 is accepted only as a complete four-side tuple. Automatic spacing still requires the previously documented object and all-paragraph zero values; browser `normal` is not proof of exact native font metrics.

Every explicit output is preserved even when equal to the normal style. For example, a white hover reset must remain `{fill:'#ffffff'}` when a selected layer is blue. A patch is never produced by merely comparing its effective appearance to the base. The importer checks native state identity, nonzero style ID, source-property/output correspondence, allowed values, and independence claims again; an invalid state is omitted atomically while valid siblings remain available. The importer does not substitute the new `baseStyleRecovery` for normal style, and existing Selected/initial Disabled restrictions remain unchanged.

This is storage recovery plus the product's state-style contract. It does not establish exact native combined-state priority, transition timing, renderer font metrics, Error/Hint behavior, or arbitrary inherited state style resolution. No vendor code or sample bytes are included in the product implementation.

## Coverage: raw records, parser candidates, final imports

Raw counts refer to IX_STYLES entries across all stored Style objects, including objects that cannot become editable widgets. Candidate counts refer to direct diagram members returned by the semantic reader, including panel-state diagrams. Final import counts refer only to widgets that survive all existing geometry/container/behavior constraints and are present in the resulting document.

| State | Raw map entries | Supported parser candidates | Final imported patches |
|---|---:|---:|---:|
| MouseOver | 603 | 412 | 345 |
| MouseDown | 88 | 57 | 41 |
| Focused | 157 | 20 | 16 |
| Disabled | 61 | 19 | 17 |

All accepted **real** patches in this census use PName6/7/8. Broader appearance fields are verified through synthetic malformed/valid protocol cases, not claimed to have real sample coverage for these four states. Explicit equal-base preservation is likewise tested using a clearly synthetic state added to a real decoded tab sample.

| Sample | Candidate hover/down/focus/disabled | Final hover/down/focus/disabled | Top-level imported/skipped | Nested imported/skipped |
|---|---|---|---|---|
| Default.rplib | 0/0/0/0 | 0/0/0/0 | 26/14 | 0/0 |
| Flow.rplib | 0/0/0/0 | 0/0/0/0 | 21/16 | 0/0 |
| Icons.rplib | 0/0/0/0 | rejected by existing page limit | — | — |
| Sample form patterns.rplib | 335/54/16/18 | 293/38/12/16 | 525/206 | 406/64 |
| Sample UI patterns.rplib | 76/0/4/0 | 51/0/4/0 | 171/88 | 10/0 |
| Prototype Starter.rp | 0/3/0/0 | 0/3/0/0 | 57/31 | 28/0 |
| Prototyping Basics.rp | 1/0/0/1 | 1/0/0/1 | 172/27 | 52/0 |
| Quick Win.rp | 0/0/0/0 | 0/0/0/0 | 31/11 | 2/0 |
| UX Prototyping.rp | 0/0/0/0 | 0/0/0/0 | 124/29 | 0/0 |
| the-basics-tab-menu.rp | 0/0/0/0 | 0/0/0/0 | 3/0 | 2/0 |
| complex-interactions-required-fields.rp | 0/0/0/0 | 0/0/0/0 | 7/0 | 0/0 |

For all ten importable samples, the audit also removes the new interactionStyleRecovery records and reruns the importer: **every numeric existing report count is identical** (`legacyCountDifferences:[]`). This is a current-source comparison, not a comparison against an older milestone's feature scope.

Remaining explicit uncertainty: 2,020 direct members have an unsupported global map/cache. Within recovered maps, 381 hover / 738 down / 772 focus / 788 disabled records remain unsupported. Reasons: 2,303 absent local states with unresolved bases; 344 state property sets exceeding the independently known local-color subset; 32 unknown metadata/inheritance shapes. These counts include an absent state recorded as unknown, so they must not be read as that many observed broken native styles. Known no-state records are separately counted in JSON.

Largest compact semantic result is Icons at 9,337,108 bytes; form patterns 6,673,038; Basics 4,332,831. These are below the existing 20 MiB worker result limit. This audit does not benchmark every arbitrary-file resource boundary.

## Stable real fixtures

**Prototyping Basics.rp** SHA-256 `26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7`; page `Getting started`, package `8165e87159f34c58a974459d9e910e34`:

- Path `6916f399031443218a91b11e4e423a30`, MouseOver style `44f3e5b7ddb4425a822b4cf863068df6`, explicit fill `#f3f3f3`.
- Box `3471e28ded924670841f3dfd061d33a0`, label `Sign up`, Disabled style `8623ec4d39f548068b9cc274ecd3cf4f`, explicit fill `#9e9e9e`.

**Prototype Starter.rp** SHA-256 `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714`; diagram `Device physical nav`, package `dbf50f111c33407cab8d0fdc6bcae297`. Three boxes each store MouseDown fill `#c2c2c2`:

| Widget ID | Referenced state style ID |
|---|---|
| a20c6e08f6a14d48a082a77db645e210 | e2e192f96f944bb0b1da8cd98f20030d |
| b2da27f43c2940cca3f8d99719efea6a | e2e24cdd2ffd4086b13bb42ff24840d4 |
| 3b8e4964c21a49c8b94d4bf35530b219 | 1cbdc5a3ef54472c933c6cfc86fdacdf |

**Sample form patterns.rplib** SHA-256 `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179` contains a real independently recoverable Focused fill: diagram `Checkbox group (styled)`, package `2bebd47451fc421bb7fc84297178d8cf`, widget `5d167d905e0e40a5adfe4f8182491ac7`, state style `163cb30b92fe488d94da0cc41fa82509`, PName7 signed ARGB `-2134719806` → `#c2c2c280`. This example demonstrates a local color despite unknown base cache, not complete inherited appearance recovery. All final imported fixture identities are also listed under each sample's `import.records`.

## Validation and reproduction

From the repository root:

```powershell
node research/rp-interaction-styles-audit.mjs
node --test research/scripts/read-rp-interaction-styles.test.mjs research/scripts/read-rp-appearance.test.mjs
npx vitest run tests/import-rp-interaction-styles.test.ts tests/import-rp.test.ts
npm run typecheck
```

Results at freeze: **31/31 Node tests** (12 new + 19 existing), **43/43 Vitest tests** (21 new + 22 existing), and typecheck passed. Tests cover real sample hashes/state references, explicit reset preservation, sibling-state atomicity, malformed/zero/wrong-type references, map identity/duplicates/combinations, undetermined properties, inherited/unknown fields, unsafe values, incomplete caches, source immutability, importer revalidation, same object IDs in separate packages, source-linked reports, and model save/parse roundtrips.

The phase did not run packaged desktop rendering or the original GUI. Parent integration owns those checks. Static parsing, synthetic mutations, and our model's validation are not presented as native UI parity.
