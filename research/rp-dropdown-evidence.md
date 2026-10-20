# Native ComboBox / ListBox evidence and bounded recovery

This stage uses static original package data and ECMA-335 metadata/CIL. The Axure DLL and GUI were not executed. The independent browser experiment is recorded separately in `dropdown-evidence.md`; it is an isolated original-function/HTML probe, not a generated Axure project or GUI comparison.

## Sources and immutable identities

- Original `AxureRP11.dll`: SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Original distribution ZIP: SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Original `Sample form patterns.rplib`: SHA-256 `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`.
- Original `Default.rplib`: SHA-256 `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`.
- `rp-dropdown-evidence.json`: original pre-implementation census, raw native widgets/options, geometry, then-current rejection and event results; SHA-256 `ad5499366b7677c9990ce24b1de05ce3c65749947efa10096fcde4cfd7986d05`. Its parser/importer source hashes describe the historical census run, not the subsequently edited files.
- `rp-dropdown-recovery-census.json`: final reader census, current parser/test hashes, complete eleven-file path/hash manifest, every source ID, and separate standard-HTML initial selection calculation; SHA-256 `8fa41e5bee6bbec01f095a5840d29b5f3a2d61e93b570ec50fe081018dd3908f`.
- `rp-dropdown-function-records.json`: all sixteen actual GetSelectedOption records, their paths, direct parents, containing widget/case references and OptionLiteral operands; SHA-256 `a4baadf68c97d4cc1d9e2e1bddb89645173caa3136b0982c3af0cb38ced1b0f8`.
- `rp-dropdown-option-literal-cil.json`: SHA-256 `958589043edc709d43c8d23ee27658fa611aa536a3f6951b3f5b0be888d141ee`.

The original sample bytes, vendor code, and CIL evidence remain research material. Product packaging uses only the independently written bounded parsers, never these original samples or DLLs. The earlier caption/default-library identity evidence, fonts and frozen screenshot sources were not changed.

## Actual corpus census

| Original file | ComboBox | ListBox | Result |
| --- | ---: | ---: | --- |
| Default.rplib | 1 | 1 | Both have empty option lists |
| Sample form patterns.rplib | 26 | 0 | All 26 ordered option lists decoded |
| Flow, Icons, Sample UI patterns, Prototype Starter, Prototyping Basics, Quick Win, UX Prototyping, Tab Menu, Required Fields | 0 | 0 | No instances of these exact native types |

Across eleven SHA-pinned originals there are **28 controls and 2,108 option records**. Every actual control has `multiple=false`; no original multiple-selection fixture is claimed. Twenty-six controls have no stored selected option and two have precisely index 0 selected. Every observed option value is a string, every selected flag is Boolean, and every list contains unique references and unique label strings. Duplicate labels are nevertheless representable by the recovered ordered records; they are not normalized or deduplicated.

All 28 satisfy the new parser's select-property subset and receive a select type candidate. The final `dropdown-import-audit.json` also verifies all 28 were imported, with 2,108 options. This does not imply complete native container geometry, styles or interactions. **Eight focus/blur owner events decode successfully, but zero of them import.** Their four owners and two `Exp. Date Label` action targets are present; both targets reject selection recovery on `FONT_STYLE=1002`, so the importer's `requireSelection` guard rejects the entire events. Form-library imported events remain 38, and this stage adds zero events. See `rp-dropdown-event-reasons.md/json` for exact IDs and rejection evidence. Eight other owner events are OnSelectionChange and still fail during native decoding on `SetWidgetRichText`; they are not partially imported.

## Requested Personal information form controls

Both belong to source package `784fffad1a36482594f6f965760990d6`, root `d20f3a83e762467eb6b7ffdd464ee1a1`, diagram `27b2986a81484c1b95187016936fd7f8`.

| Field | Country/Region | State/Province |
| --- | --- | --- |
| Native type | Axure:DiagramObject:ComboBox | Axure:DiagramObject:ComboBox |
| Native widget ID | d8fa7295bba34065956efd90f1c4b300 | 89ea7c71f7b54eed986cd4e8569b14e5 |
| Native name | Country Droplist | State Droplist |
| MyStyle ID | adb9cc53f9944a9eb030ea2bee46f404 | b99870d394d344499f26e2783486f26a |
| Stored x,y,width,height | 20,466,400,48 | 240,676,160,48 |
| Option count | 197 | 52 |
| Raw selected indices | [0] | [] |
| First option | One ASCII space, selected=true | One ASCII space, selected=false |
| Subsequent examples | Afghanistan, Albania; last Zimbabwe | AK, AL; last WY |
| InteractionMap | Absent | Absent |

Country option 0 is `e0d6df0c0db747b68c2511d757ea6f52`; State option 0 is `aa7637274dcb4f11980a67f3fff44d67`. The empty `TextBlock.text` is not the current selected option. In particular, State's raw no-selection flags must not be rewritten as if the first flag had been true. Its initial ordinary HTML dropdown selects the first option because of the HTML initialization rule, a separate layer of evidence and conversion.

Previous rejection came from the absence of a ComboBox/ListBox type candidate; it was not a corrupt source, missing options or an unsupported action on these two widgets.

## Stored field and CIL mapping

The exact spelling of native keys below comes from original package records. Obfuscated CIL string accessor `sIho` was not decrypted; named property/getter/serializer relationships establish the corresponding values and types.

| Wire field / object | Static evidence | Bounded meaning |
| --- | --- | --- |
| ComboBox / ListBox | Exact native record names; concrete metadata types | Dropdown / visible listbox |
| `list-options` | ListObject.get_Options `100701174`; serializer NIwY `100701187`, get_Options at IL163 then list serialization at168/map write173 | Ordered tag-3 local references |
| `multiple` | get_Multiple `100701179`; NIwY reads it at IL94 before Boolean serialization/map write104 | Explicit Boolean; native Combo generator separately forces false |
| Axure:SelectObject | Metadata implementation `otfF.Wtfr`, type token `33558711`; serializer `100717026` | Native option record |
| `object` | Wtfr.Ptfb `100717018`; NIwY getter at IL41; string and object-valued branches exist | Only literal string branch supported |
| `selected` | Wtfr.TtfS `100717020`; NIwY getter at IL155 then Boolean wrapper160/map write165 | Per-option stored flag |
| Option text | Wtfr.ltft `100717023` | String path preserves the string; other object branches are not coerced by our reader |
| SelectedObjects | ListObject.get_SelectedObjects `100701181`; predicate `100701194` calls TtfS | Collection derives from flags; no independent native selectedIndex field was observed |

The CIL is in `rp-dropdown-ListObject-cil.json` and `rp-dropdown-select-object-cil.json`. `rp-dropdown-metadata.json` contains a preliminary raw-call-byte candidate scan; conclusions use the decoded CIL, not that scan alone. Native option records observed here contain exactly `object` and `selected`. The option writer takes selected/text/id and no disabled-option parameter. This supports the present subset; it does not prove all future versions lack additional option properties. Unknown option properties (including a synthetic disabled flag) reject the whole control.

All observed inherited TextObject flags are `Type=0`, `WordWrap=true`, `ReadOnly=false`, `PlaceholderText=''`, `HideHintOnFocus=false`, zero tag-3 SubmitButton, and empty TextBlock text. The reader requires these exact witnessed values; it does not drop an unknown hint, input-type setting or submit binding. Ordinary disabled/error/style recovery remains subject to its existing separate rules.

## Generator parameters and HTML initial selection boundary

Decoded methods in `rp-dropdown-html-cil.json`, `rp-dropdown-html-writer-cil.json` and `rp-dropdown-option-writer-cil.json`:

- Combo path `FNiU.mNPJ`, token `100699645`: get_Options IL203, `false` IL223, `-1` IL224, call `BNCJ.GNCH` IL225.
- ListBox path `FNiU.GNPN`, token `100699646`: get_Options IL108, get_Multiple IL129, constant `2` IL134, call GNCH IL135.
- `BNCJ.GNCH`, token `100699502`: its final integer parameter is omitted when -1 (IL80–83); otherwise formatted invariantly and written (IL116–128). The preceding Boolean controls a flag attribute (IL278–319). Options are enumerated in source order; TtfS/ltft feed INC1 at IL446/452/458. No selection fallback is applied in this writer loop.
- `BNCJ.INC1`, token `100699503`: the option text is passed to both a named-attribute writer at IL240–274 and body writer at IL201–214; selected controls a separate Boolean flag; the generated option ID is a different argument at IL305–334.

This establishes the parameter roles and ordered text/flag flow. **The precise obfuscated attribute-name literals `value`, `size`, `multiple` were not decoded.** An explicit value equal to the literal option text, listbox size 2, and the following browser default-selection rules are the independent HTML mapping contract; do not describe them as a captured byte-for-byte original export.

The separate SHA-pinned `dropdown-evidence.json` (`7973f1dc39cdd5de100d6011d8838345b3016e2540afbd5aea424753d20312d2`) records **48 passed isolated original-function/Edge DOM probes**, Edge `155.0.4283.45`, no page errors and no network requests. Its initial-selection cases confirm:

- Single ordinary dropdown: last selected flag wins, or first item if none are flagged and the list is nonempty.
- Single size>1 listbox: last selected flag wins; none remains no selection.
- Multiple listbox: preserve every selected flag, including none.
- Empty list: no selection. An explicit runtime selectedIndex=-1 is distinct from initialization and stays unselected.

The probe uses a size-4 single listbox to exercise the greater-than-one rule; the original static generator constant is separately 2. No native UI validation of option entry restrictions, default visible row sizing on every platform, mobile popup behavior, or generated full-page behavior is claimed.

## Native conditions and actions

There are **16 actual GetSelectedOption FCall records and zero SetSelectedOption FCall records** in the eleven files. Eight GetSelectedOption records occur in string-expression variable bindings, which remain unsupported by this native literal-only reader. Eight occur in conditions on two Subject Droplist controls (four cases each).

The first real condition is in package `e75bf1b9234d40d9bb3c2f8a4ece4689`, owner `c6d7e16a852f411ba0fc0a11b769ba6f`, FCall `14489d07e56a4f798f1cea8cbfa6577a`. It has a single DiagramObjectPathLiteral argument, local path `482b8578e42e4e75b420d976d80ae8bb`, zero object-id = This, empty repeater/RDO paths, and is-dummy=false. Its BinaryExpr operation is 3 (= equals). Right operand `07c087cb369c45cbb911f9189934adfd` is **Axure:Expr:OptionLiteral**, with `Option` tag-3 reference to SelectObject `af2a380bcd7a42f0bc670fff4f10b58c`, whose string is `Suggestion`. The other copied option values include the trailing space in `Compliment `.

`OptionLiteral.get_TextValue` token `100706408`, IL8/13, calls get_Option then Wtfr.ltft. Serializer `100706409`, IL67–77, writes the Option reference. This corroborates the exact observed OptionLiteral carrier without inventing a generic object coercion. The decoder accepts this strict local string-option branch or its already-supported literal StringLiteral carrier. It emits `source:'selectedOption'`, not `widgetText`: the original GetSelectedOption scalar and multiple-list GetWidgetText array semantics are different.

This is still whole-event recovery. The real Subject events include unsupported SetWidgetRichText actions; they remain rejected. Tests isolate copied real condition nodes only to test the condition decoder; that isolation is explicitly synthetic and never occurs in production. Native SetSelectedOption action recovery is not added because its serialized action carrier was not witnessed or separately proven. Product-authored selected-option actions are a separate capability.

SetFocus's existing strict single local path can target ComboBox/ListBox as supported form controls; the explicit selectText flag is preserved. The original runtime probe establishes that selecting text on a select has no text-selection effect. Unsupported compound paths, missing local targets, disabled action state and extra parameters keep the existing atomic failure policy. Programmatic SetText/select compiler eligibility is unproven and no such native mapping is introduced.

## Reader protocol and limits

```js
selectRecovery = {
  status: 'decoded-select-properties',
  selectMode: 'dropdown' | 'listbox',
  multiple: false | true,
  options: [{ sourceId: '<native GUID>', value: '<literal string>', selected: false | true }],
  storedSelectedIndices: [/* ordered raw selected flags */]
};
typeCandidate = {
  type: 'select', selectMode: 'dropdown' | 'listbox',
  mapping: 'native-select-options', evidence: '...'
};
```

The reader does not emit effective selectedIndices as if they were stored data. The importer revalidates all fields and computes the selected set from the separate HTML contract. A failure emits `unsupported-select-properties` with a reason and no select candidate/options array.

Limits are 500 options and 2,000 JavaScript string characters per value, matching the independent model's bounded representation. These are product safety/representation limits, not claimed Axure editor limits. The reader requires exact local owner identity, tag-3 option references, unique references, exact SelectObject type, literal string values, explicit Boolean selected flags and no unknown/duplicate option keys. Duplicate label strings and whitespace remain unchanged. A malformed option rejects the complete list rather than shifting subsequent indices. Source objects are not mutated; inherited style identity and precedence are unchanged.

## Verification and remaining boundary

New `research/scripts/read-rp-dropdown.test.mjs`: **21/21 passed**. Combined targeted run with existing interaction/form-property tests: **57/57 passed**.

```powershell
node --test research/scripts/read-rp-dropdown.test.mjs research/scripts/read-rp-interactions.test.mjs research/scripts/read-rp-form-properties.test.mjs
node research/rp-dropdown-functions.mjs
node research/rp-dropdown-recovery-census.mjs
```

Coverage includes real source hashes, both requested option sequences, empty default controls, raw no-selection flags, duplicate literal values, whitespace/markup/expression-looking inert strings, synthetic multiple lists, malformed/missing/duplicate/cross-package references, unknown option flags, text/count bounds, strict inherited-field guards, real OptionLiteral/This conditions, unsupported real whole events, and Focus target identity. Synthetic cases prove the bounded parser behavior, not the presence of those combinations in the original eleven files.

Native enum/UI option editing rules beyond these records, expression-valued options, disabled options, inherited nondefault list hints/readonly/type/submit semantics, compound/master/repeater target paths, native SetSelectedOption serialized actions, and exact original generated attribute literals remain outside this evidence-backed subset.
