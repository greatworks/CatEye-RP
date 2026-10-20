# Selected state property filtering in the RP 11 generator

This is a read-only investigation of the retained **11.0.0.4150** distribution. It closes the previously unresolved IX_STYLES generator question in `font-style-format-evidence.md`; that historical report is unchanged. No original GUI capture, native DLL execution, full application launch, or generated native page comparison was performed. No product file was edited.

**Result:** the actual recursive JSON style writer admits local state properties only when the property exists, is **Overridden**, and is **Determined**. The two Exp. Date Selected snapshots each contain 52 properties, but only PName6 (foreground color) satisfies this predicate. Their 51 other entries are inactive snapshot values, not 51 active unsupported style changes. The specialized font writer independently applies the same predicate to PName1002.

## Source identity and method

- Original distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- REA extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Original `AxureRP11.dll`: `C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll`.
- DLL SHA-256, checked by each new CIL/metadata extraction: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Form library SHA-256: `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`.

The existing static PEReader script decodes methods without loading the assembly. Caller byte scans were used only to select methods; conclusions below use full decoded CIL and metadata signatures. [Machine-readable evidence](selected-style-filter-evidence.json) pins the source snapshots and new artifacts by SHA-256. IL offsets below are decimal offsets within the named method, not source-code line numbers.

## 1. Anchored IX_STYLES → recursive state output path

| Step | Exact evidence |
|---|---|
| Native IX_STYLES property | `TtuV.ituB.Jtsu`, token **100717315**, IL8 loads **21**, IL10 calls `WtTU.get_Item`, IL15 casts to `H5bI.c5b1`. [Getter CIL](selected-style-filter-ix-getters.json). |
| Concrete property's value type | `c5b1`, TypeDef **33558757**, derives from TypeSpec **0x1B00048E**. Its signature is `1512C000438C0112C000416C`, a generic property whose argument is `wtXX.FtXa`, TypeDef **33558619**. This same TypeSpec appears in the JSON writer below. [Metadata](selected-style-filter-types.json). |
| Real widget writer entry | `sJeD.wJe6.jJeK`, token **100694305**, IL721 reads `KJm7.cJO3`, IL726 clones, IL731 casts to `ituB`, then IL891–907 passes that style into `EJep`. Its adaptive branches also invoke `EJep` at IL1385/1417. [Widget-entry CIL](selected-style-filter-widget-entry.json). |
| Ordinary style writer | `wJe6.EJep`, token **100694319**, IL74 calls the dedicated font writer `IJeq`; IL80 reads **all** properties (`Mtwe`); IL85 applies `ttf7.RtTr`; IL93 calls `rJeU`. [JSON-entry CIL](selected-style-filter-json-entry.json). |
| General property writer | `wJe6.rJeU`, token **100694323**, IL7–19 applies the optional property-name subset (`Dtfz`) and then **RtTr** before enumerating. |
| State collection dispatch | The same `rJeU` at IL960 tests **0x1B00048E**, IL971–976 obtains its `FtXa` value, IL993 enumerates state styles, IL1017 reads each style name, and IL1040 recursively calls **EJep(state, writer, context, names, false, null)**. State properties therefore go through the same filter; this is the IX_STYLES writer, not `ApplyStyleInfo`. |

The recursive call passes `null` as its last argument. That matters for the specialized font writer: this state call has no separate widget font-format argument from which to add a fallback normal/italic declaration.

`rJeU` may additionally omit or specially encode particular eligible property types. The proven predicate is an **admission requirement**, not a claim that every possible eligible PropInfo has an implemented or faithful product conversion.

## 2. Exact predicate and persisted flag correspondence

`ttf7.RtTr`, token **100717059**, constructs a filter with `<OD>b__21_0`, token **100717092**. That lambda invokes `O5FO.a5FY`, token **100717956**, at IL8. Its actual reachable control flow is:

1. IL33–40: require a non-null property.
2. IL71–77: require `e5jG.V5jg` (Overridden).
3. IL108–117: return `!e5jG.v5jI` (not Indeterminate).

References: [filter and font lambdas](selected-style-filter-predicates.json), [flag helper CIL](selected-style-filter-flag-helpers.json), [property fields](selected-style-filter-property-flag.json), and the pre-existing `font-style-format-property-filter-full-cil.json`.

The correspondence to persisted DOAName is independently traced:

- `mJG4.Overridden` token **100691356** tests `0x40000000` (existing `font-style-format-flags-cil.json`).
- `mJG4.aJG8` token **100691355** tests `0x80000000`. [New CIL](selected-style-filter-determined-bit.json).
- `d5jO<T>.Y5jQ`, token **100718026**, IL37 reads `aJG8`, IL42–45 negates it and writes the Indeterminate field; IL73–78 reads Overridden and writes the Overridden field. Existing `font-style-format-flag-caller-1.json` retains this load path.

Therefore the local serialized property rule is:

```text
eligible = propertyExists && (DOAName & 0x40000000) != 0
                          && (DOAName & 0x80000000) != 0
```

`selected-style-filter-evaluate.mjs` interprets **the actual decoded a5FY instructions**, with the property-accessor results supplied explicitly. It does not execute the DLL or substitute a handwritten predicate for the branch trace. All five cases pass (null plus all four flag combinations); none of their executed paths requires guessing an obfuscator module field. It then applies those branch results to all 104 retained source records. This is a bounded CIL logic verification, not a native GUI or complete generator run.

## 3. Specialized font output does not restore the inactive normal value

The font path precedes the general PropList loop, so checking only `RtTr` would have been incomplete.

`wJe6.IJeq`, token **100694320**:

- IL58–70 reads `ituB.otuT` and calls the same `a5FY`; only a true result takes the branch to IL3213–3232 that inserts PName1002 into the outgoing font-property dictionary.
- `otuT`, token **100717283**, is explicitly bound to PName1002 at IL8–18; `Otl0` is its typed font-style accessor. [Font-getter CIL](selected-style-filter-font-getters.json).
- IL427–439 similarly gates PName6 through `Stst` → `a5FY`; IL547–557 inserts the color.
- Other fallback-font reads refer to argument3; the recursive IX_STYLES invocation above supplies `null` for that parameter.

[Complete relevant font-writer CIL](selected-style-filter-generator-IJeq.json) is retained. This proves the target snapshots' merely determined `FONT_STYLE=Normal` is not an active font-style reset. It does **not** expand product font support beyond the separately established Normal/Italic subset; explicit unsupported Oblique still requires rejection or an independent implementation.

## 4. The two actual 52-entry snapshots

| Package | Widget | Selected style | Package-part SHA-256 |
|---|---|---|---|
| `d769a1bb062d46ae9140ccafe936455e` | `81407e7110764806ab119ed3a69a5ace` | `e62ca07fe2f14766ab1236ab95864e46` | `29a9a1b33ad623b8ce47ee012f36b8dcbefd74985e4ef4ae59c7398820035e23` |
| `c356742c685a47b0b1a9b4abc4dd2ad8` | `f5ba5ff93b4d4b5c8467778d88421fc4` | `ec1de2c9ed1644a2a28fbb3d44f60bee` | `82404621d611e635b7dbe7e3fd9b36b9f3be19523f8e4e44305a89d79563051a` |

Both target styles explicitly store `All=false` and no MatchInfo. Their parent IX_STYLES entry has DOAName **-1073741803** (OD=true, PName21). In each Selected list:

- The one eligible entry is PName6, DOAName **-1073741818**, solid ARGB **-14772009** → `#1e98d7`.
- PName1002 is DOAName **-2147482646**, value0: determined but not overridden, and is omitted.
- All 51 noneligible records and their actual values remain in the new evidence JSON for audit; no records in the original source were removed or mutated.

The supported local state patch for these specific targets is `{ color: '#1e98d7' }`. This removes a concrete blocker for eight dependent focus/blur events, but **event recovery is not itself demonstrated by this research**: the importer must still validate complete events and their targets atomically.

## 5. Minimal implementation contract and tests

Suggested bounded patch, handed to the parser owner rather than applied here:

1. Validate local PropList structure and duplicate property IDs before filtering. A malformed property or ambiguous list must not become an empty valid patch.
2. Filter those local state records by both flags, then validate and convert every surviving value. An unknown active property still rejects the whole state.
3. Apply exactly that filtered list both to `recoverStyle`'s `stored-active-state-style` merge and to Selected/named-state validation. Filtering only the validator would allow inactive font/fill/padding snapshot values to overwrite base appearance.
4. Preserve explicit reset values even when equal to base (e.g. selected normal while hover is italic).
5. Retain absent/nonarray PropList, reference integrity, and unknown inheritance guards. This evidence is **not** a blanket rule to discard non-overridden default or named StyleCache properties. Existing named-color cache resolution materializes cached properties into state evaluation; that resolved-cache path must remain distinct from filtering original local records.

New independently owned tests: `research/scripts/read-rp-selected-filter.test.mjs`. Initial baseline on the unchanged parser: **7 tests, 3 passed, 4 failed as expected**. They cover the original metadata chain, both real form targets, inactive fields not changing selected appearance, the four ordinary named interaction states, active unsupported values, malformed/duplicate records, and explicit normal/empty filtered patches.

```powershell
node research/selected-style-filter-evaluate.mjs
node --test research/scripts/read-rp-selected-filter.test.mjs
```

The old tests that demanded rejection merely because an inner state property was undetermined/not overridden encode the previously conservative behavior. Changing those expectations must cite this new native generator evidence. Outer IX map uncertainty and unresolved reference cases are separate and are not automatically relaxed.

## Limits

- Static generator admission and the two source snapshots are proved; the complete original HTML generator was not executed.
- No claim is made that arbitrary named style inheritance, adaptive-state cache construction, malformed source recovery, or every eligible property is implemented.
- `All=true` and unresolved base identities are outside the target subset.
- No original screenshot or final-paint pixel equivalence is claimed. No full suite, product build, or GUI bridge retry was run by this evidence task.

## 6. Independent post-implementation verification

After the parser owner applied the bounded OD filter, `node --test research/scripts/read-rp-selected-filter.test.mjs` independently passed **7/7**. The earlier 3/7 baseline above remains evidence of the prior failure, not the current result.

The broader recovery is independently audited by `selected-style-filter-verify-import.mjs`, with retained results in `selected-style-filter-import-verification.json`. This reads the original Form package again; it does not trust the parser's active-property classification. It independently checks raw flags, local references, complete property lists, `All=false`, absence of unresolved MatchInfo, and ARGB color conversion.

- **36 complete imported events** across 30 owners: 20 click, 10 focus, 6 blur. Every imported event/case/action is compared with a fresh full interaction-tree decode; none is reconstructed by deleting unsupported actions or branches.
- **2 newly imported radio controls** have the same state-property check.
- Across all these events and controls, **30 distinct Selected targets** contain **70 eligible OD properties**, all solid colors in PName 6, 7 or 8. Their independently reconstructed output exactly matches the imported selectedStyle patches.
- **1,392 inactive property records** remain recorded in the verification JSON and do not affect those patches. The broader gain is not an unexamined relaxation of typography, shadow, border, or layout defaults.
- The eight originally targeted Exp.Date focus/blur interactions are included in the 36-event check; the remaining 28 events are checked by the same procedure.

The verification JSON pins the original source/package SHA values, extraction identity, reader/decoder/importer revision hashes and the exact source audit used. No product source was changed by this independent review.
