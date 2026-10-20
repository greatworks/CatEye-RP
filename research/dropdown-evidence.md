# Axure RP 11 DropList / ListBox runtime evidence

Frozen investigation: 2026-10-14. Scope: original shipped functions, isolated Edge DOM, and separately retained managed CIL; no original GUI or generated prototype was run. The product implementation is not used as an oracle.

## Identity and reproducibility

- Axure RP **11.0.0.4150**; extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Distribution SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; managed DLL `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Original source root: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`.
- Run `node research/scripts/probe-dropdown.mjs`. [Machine evidence](dropdown-evidence.json) contains source hashes, bounded exact source slices, individual inputs/results, and limitations. **48 grouped assertions pass**, Edge `155.0.4283.45`, zero network requests, zero page errors.
- Function bodies come from the pinned original files; markup, widget metadata, expression argument provider, and the case-action endpoint are fixtures. Native event dispatch itself is exercised. Supplied array-valued STO fixtures demonstrate interpreter capability, not an editor-produced expression.

| Original file | SHA-256 |
|---|---|
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| sto.js | `c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6` |
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| ../jquery-3.7.1.min.js | `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85` |

## Official UI contract

[DropLists](https://docs.axure.com/axure-rp/reference/droplists/) are single-choice, normally start on the first option, and can use a one-space entry for an initially blank display. Options are authored in the editor; adding/removing them during a prototype is not supported. The page documents disabled, Submit Button, and Set Selected List Option.

[List Boxes](https://docs.axure.com/axure-rp/reference/list-boxes/) can allow multiple selection, normally begin without a selection, and can have authored selected defaults. The documented Set Selected List Option UI selects one option; a selected-option expression returns the topmost selected option. These UI statements do not rule out lower-level interpreter array behavior described below.

[Events](https://docs.axure.com/axure-rp/reference/events-list/) distinguish Selection Changed for lists from Text Changed for text inputs. [Actions](https://docs.axure.com/axure-rp/reference/actions-list/) distinguish Set Selected List Option from Set Text and selected/checked state. Managed `IxEventType` evidence records `OnSelectionChange=51`, distinct from `OnSelectedChange=52`, `OnSelect=53`, and `OnUnselect=54`.

## Scalar action: assignment and synchronous event order

Observed `expr.js:273–283`, `events.js:1184–1190,1701–1717,1810–1814`:

1. `SetSelectedOption` reads the input's **jQuery `.val()`**, compares it to the requested value using JavaScript loose equality, and returns on equality.
2. Otherwise it writes `.val(value)` and synchronously raises `onSelectionChange` when an interaction map contains that event. The changed selection is visible inside the callback. A nested setter completes its synchronous callback before the outer setter continues.
3. No disabled or hidden assignment guard exists. Synthetic SelectionChanged still executes for disabled/hidden targets: disabled synthetic suppression here applies only to LongClick; `_handleEvent`'s visibility rejection does not apply to synthetic dispatch (`events.js:324`). User disabled behavior remains the native DOM's responsibility.
4. Repeating an unmatched value clears selection and fires again each time. An empty request on a single select without an empty option does likewise: its old jQuery value is `null`, not `''`.

Important call-layer distinction: the low-level setter's equality `return` exits its entire passed array loop. **Normal `fcall` path-literal dispatch (`expr.js:127–180`) instead builds one-target argument arrays**, evaluates all targets' arguments in forward order with `eventInfo.targetElement`, restores that target, then executes these calls in reverse order (`172–176`). A matching first target therefore does not suppress other targets in this path. Probe: targets `[a,b,c]`, requested A, old values `[A,B,C]` end all A, with callbacks `c,b`. This is a path-literal dispatch observation, not proof of every possible editor compiler encoding.

## Index, duplicate and empty semantics

Observed actual Edge plus shipped jQuery:

| Case | Result |
|---|---|
| Ordinary single select, options and no selected flags | Browser chooses first option |
| Zero options | No placeholder is invented; index `-1`, DOM value `''`, jQuery value `null` |
| Explicit runtime index `-1` | Remains unselected until changed |
| Single listbox (`size>1`), no flags | No selection, index `-1` |
| Multiple listbox, no flags | Selected indices `[]`, jQuery value `[]` |
| Set A from B, options `[A,A,B]`, single | Chooses first A |
| Already second A, Set A | Loose-equality no-op; second index retained |
| Real ArrowDown first A → second A | Same text/value, different index; **SelectionChanged fires** |
| Real ArrowDown at final option | No change and no event |
| Multiple `[A,A,B]`, Set A from B | Both A options selected |
| Repeat A when both A options selected | Fires again because `['A','A'] != 'A'` |
| Multiple selected A+B, request literal `A,B` | No-op because `['A','B'] == 'A,B'` |
| Empty multiple, request empty string | No-op (`[] == ''`); does not select an empty option |

Selection identity must therefore be indices, not just a value string. Stored “no authored selected flags” and explicitly cleared runtime selection are distinct states. Option value whitespace is significant when an explicit value exists: `"  A \n B  "` stays literal; without a value attribute the browser derives normalized `"A B"` from option text. This host distinction is proven; the exact native attribute-name literal remains a separate generator boundary.

## Getters, SetText and typed values

| API/source | Actual result |
|---|---|
| `GetSelectedOption`, `expr.js:562–565` | First target input's DOM `.value`; topmost selected value in multiple mode; missing/none `''` |
| `GetWidgetText`, `expr.js:586–590`, `axQuery.std.js:883–916` | jQuery `.val()` for select; single string, no single selection coerced from null to `''`; multiple **array**, including `[]` |
| Public query `.text()` getter, `axQuery.std.js:840–846` | Uses GetWidgetText |
| Public query `.value()` getter, `axQuery.std.js:951–968` | Concatenated selected option **display text**, e.g. A+C → `AC` |
| Public query `.text('B')`, `axQuery.std.js:840–881` | Does not change select options or selection and emits no selection event in the normal select markup |

`SupportsRichText` (`axQuery.std.js:103–104`) excludes lists. No compiler evidence in this investigation makes SetWidgetRichText on a select valid. A reconstruction must not alias SetText to option selection merely because both expose strings.

The native setter accepts array values at its low-level API: on a single select `['C','B']` chooses the first matching option in DOM order (B); on a multiple select `['C','A']` selects A+C. A new equal-content array does not compare equal by identity, so it emits. `expr.js:204–244` preserves an object/array returned by a sole interpolation, whereas surrounding text coerces it to a comma string. The STO result in this probe is supplied: **ordinary editor syntax producing these arrays remains unproven**. Supporting scalar action values only is a declared product boundary.

Native comparison also preserves typed-array quirks. `sto.js:210–214` calls `.toLowerCase()` only when available, so an array does not throw there. `expr.js:15–59` recursively compares object properties when both arguments are objects; otherwise it uses converted loose equality. Examples: `['A','C'] == 'A,C'`, `[] == ''`, `[] == false`, `['false'] == false` are true; `['FALSE'] == false` is false, while scalar `'FALSE' == false` is true under this native conversion. Flattening a multi GetWidgetText array into a string changes some conditions. Native imports should either preserve the typed provider or reject those conditions; `GetSelectedOption` is safely a separate scalar provider.

## Focus, error styles, Submit and repeater reset

- ComboBox/ListBox support error styles (`axQuery.std.js:87–93`) and focus style bindings (`events.js:772–790`); shared composition is covered in [interaction style evidence](interaction-styles-evidence.md) and [Error/Hint evidence](error-hint-evidence.md). This probe does not reproduce their visual CSS.
- Query focus (`axQuery.std.js:1257–1266`, `events.js:605–618,693–710`) has the same two callback behavior as other native form controls: synthetic focus trigger then actual focus. Disabled select rejects actual focus and guarded user Focus callbacks. See [form evidence](form-properties-evidence.md) for ordering and host boundaries.
- Generic Submit binding (`events.js:935–959`) applies to lists: Enter keydown prevents default, keyup invokes the configured click endpoint. The probe records this endpoint; it does not re-prove every target's click/default behavior.
- Repeater refresh rebuilds template DOM and removes previous rows (`repeater.js:205–280`), so transient selection is not persistent dataset state. This reset conclusion uses static code and [earlier lifecycle evidence](repeater-lifecycle-evidence.md); this dropdown probe does not execute the complete refresh loop.

## Managed HTML generation and real sample evidence

Separately retained [HTML CIL](rp-dropdown-html-cil.json) and [option writer CIL](rp-dropdown-option-writer-cil.json), DLL identity above:

- `FNiU.mNPJ`, token `100699645`: ComboBox options → `BNCJ.GNCH`, **multiple=false, size=-1**.
- `FNiU.GNPN`, token `100699646`: ListBox options → the same writer, **multiple=get_Multiple(), size=2**. Two is the native HTML argument, not a measured promise of exactly two visible pixel rows under every widget height/CSS setting.
- `BNCJ.GNCH`, token `100699502`: preserves option order and passes each option's selected Boolean and text (`Wtfr.TtfS`/`ltft`) to `INC1`.
- `INC1`, token `100699503`: IL `0xF0–0x112` writes the original text argument through `zNiG` into a named attribute; `0xC9–0xD6` writes the same text through `nNiB` into the body; `0x131–0x14E` writes a generated option ID into another attribute. Obfuscated attribute-name literals remain unresolved. This structurally supports the standard explicit-value mapping but is **not a decoded literal `value` claim**.
- Format agent's corpus: 27 ComboBox + 1 ListBox, 2,108 options, no option-disabled field. Country has 197 options with only the first one-space entry marked selected; State has 52 options all false. Twenty-six controls have no marked default, including two empty controls. The sole ListBox is empty and multiple=false; there is no real multiple-selection default example in this corpus. Do not describe synthetic multiple fixtures as native stored examples.

## Acceptance and scope

Use the 48 named probes as bounded acceptance: duplicate-index user selection; single/multiple no-op differences; repeated missing requests; disabled/hidden program dispatch; synchronous reentrancy; fcall pre-evaluation/reverse fanout; scalar selected-option vs typed widget-text. Preserve real `<select>` controls and exact selected indices across rerenders. Repeater refresh must restore authored state, while ordinary repaint must preserve it.

Unknowns remain explicit: full original GUI and generated page visual comparison; obfuscated attribute names; editor array-expression generation; exact visual listbox row count; native SetText/compiler eligibility for lists beyond the observed public setter; source files have no option-disabled authoring evidence. No product code or original source document was modified by this investigation.
