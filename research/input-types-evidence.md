# Text-field input types: original functions and isolated Edge evidence

## Scope and provenance

This report concerns the **11 types documented for the text-field UI**: text, password, email, number, tel, url, search, file, date, month and time. Enum-only checkbox/radio/button/reset/etc. are not added to that claim. The [official reference](https://docs.axure.com/axure-rp/reference/text-fields-text-areas/#input-types-text-fields-only) describes these as browser HTML controls, notes browser-specific presentation, and describes File as a local chooser without prototype upload capability. It also documents Hint, Read only and Maximum length.

Target: Axure RP **11.0.0.4150**, existing extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. Installer SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; managed DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

Original scripts reside under `C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\DefaultSettings\Prototype_Files\resources\scripts\axure`.

| File | SHA-256 |
| --- | --- |
| style.js | `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| flyout.js | `13e003db00c1f89f6e628ea61492de4d09053143e5f9c68c5bf30c35e6f2a788` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| ../jquery-3.7.1.min.js | `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85` |

Run `node research/scripts/probe-input-types.mjs`. The probe verifies every digest before extracting exact source slices and loading them with shipped jQuery into a local blank Edge page. **54 grouped probes passed**, including **86 normalization vectors** each observed as initial value attribute, initial value property and original SetText. Browser **155.0.4283.45**; **0 network requests**, **0 uncaught page errors**. Captured expected setter exceptions remain in [input-types-evidence.json](input-types-evidence.json). No original app/compiler/GUI or product code was executed. Style paint and simple source-to-input resolution are explicit adapters; the value/Hint/action functions are original code.

## Original execution contract

- `events.js:855–933` registers Hint for text-box/text-area objects when `placeholderText` exists, including an empty string. Password status is captured from the actual input type at line923. Initialization updates Hint using **the browser value after normalization**, `!inputJobj.val()` (932), not raw authored text.
- `flyout.js:214–256` stores Hint text/password/active. On a state change it commits `active` first, then calls `SetWidgetPlaceholder`; while active, logical `GetWidgetText` is empty.
- `style.js:291–320` switches input type **only for password**: nonempty active Hint becomes text; deactivation restores password. Other types keep their type. It always calls `.val(text)` at307. There is no catch around this write; the local catches cover only changing the type.
- `expr.js:289–300` compares current DOM `.val()` with the requested SetText. Equal values, or an empty request while Hint is active, return from the entire setter. Otherwise it writes `.val(value)`, updates Hint using **requested `!value`**, then attempts TextChanged. Thus browser-sanitized empty output from a nonempty invalid request does **not** itself reactivate Hint.
- `events.js:1796–1808`, with `doc.js:715–721`, compares/caches the **raw DOM value** for TextChanged. `expr.js:586–590` returns empty while Hint is active; otherwise `axQuery.std.js:883–917` reads `.val()`. Raw event cache, logical text and authored text are distinct.

### File Hint is not a native UI capability

Independent static evidence in [rp-interaction-TextBox-cil.json](rp-interaction-TextBox-cil.json), `get_SupportsHint` token100702277, returns false for InputType File(12). [rp-input-types-hint-cil.json](rp-input-types-hint-cil.json) records the caller checking SupportsHint; [rp-input-types-evidence.md](rp-input-types-evidence.md) owns the chooser/CIL/import mapping analysis. The artificial File+nonempty-Hint fixture throws at the original `.val(text)` and leaves already-written flags active; it demonstrates function behavior for an injected combination, **not a supported/generated native design**. Do not expose that combination on the strength of this probe.

## Observed value normalization

The following are actual Edge results with original SetWidgetFormText and shipped jQuery. Accepted strings remain strings; number/date/time values are not canonicalized through Number/Date formatting.

| Type | Observed result |
| --- | --- |
| text, password, tel, search | Remove CR/LF; retain spaces and tab characters. Unicode and literal `[[...]]` remain unchanged. |
| email, url | Remove CR/LF and trim surrounding HTML ASCII whitespace. Form feed trims; vertical tab and NBSP do not. Invalid syntax such as an interior space remains in `.value`, with `typeMismatch=true`. A single email input retains a comma-separated list but marks it invalid. |
| number | Preserve `0`, `-0`, `-1`, `1.5`, `.5`, `-.5`, `01`, `1e2`, `1e+2`, `1e-9999`, **`1.e2`** exactly. Clear `+1`, `1.`, padded ` 1 `, `1,000`, `Infinity`, `NaN`, `1e309`, `-`, `1e`. Underflow may be accepted as the original string; overflow is rejected. |
| date | Preserve valid Gregorian `YYYY-MM-DD`, including years with more than four digits. Clear invalid leap days, non-two-digit month/day, year0000, whitespace/newlines. `0001`, `10000`, leap years0004/2000/10000 are accepted; 1900-02-29 is rejected. Current Edge upper date is `275760-09-13`; the following day and year999999 clear. |
| month | Preserve year-month syntax, year≥1. `0001-01`, `10000-01`, `275760-09` accepted; missing padding, month13, year0000, `275760-10`, year999999 and trailing newline clear. |
| time | Preserve `HH:mm`, optional `:ss`, optional 1–3 decimal digits after seconds. `.000`, `.1`, `.10`, `.100` retain exact spelling. Four fractional digits, hour24, minute60, one-digit hour or surrounding newline clear. |
| file | A nonempty **HTML value attribute** is retained in markup but initial `.value` and logical text are empty. A nonempty property/SetText write throws `InvalidStateError`, except the original setter's equal-current-value early return. Empty SetText clears the selected file list. |

Do not turn `validity.valid=false` into a universal rule to clear text. Without explicit step settings, number `.5`/`1.5` and time containing nonzero seconds may retain their value while `stepMismatch=true`. An authored **value attribute can establish the step base**, producing different validity from writing the same string into an initially empty control. The probe records both. The generator's original Text value is passed to its HTML writer according to the independent CIL work; its obfuscated default step/min/max literal output has not been proven. No exact generator default is invented here.

A portable sanitizer can reproduce these finite string observations, but this report does not establish a universal lexical grammar for every possible Unicode/length/range input or every browser. In particular, rejecting `1.e2` merely because an assumed grammar demands digits after the decimal would contradict the measured Edge behavior.

Appended LF, U+2028 and U+2029 each clear number/date/month/time values in the measured browser. The independent product test `tests/input-types-edge-runtime.test.ts` checks those twelve cases in module and serialized modes. These are positive regression checks, not a demonstrated bug in the earlier product regex: an initially suspected JavaScript `$` end-anchor issue was disproved by direct evaluation without the multiline flag and was withdrawn.

## Hint and user input consequences

- Nonempty Hint in number/date/month/time can leave DOM `.value=''` while Hint active/style flags are true. It is not automatically replaced with a visible HTML placeholder or a text-type input. Email/URL Hint can display while HTML validity reports a type mismatch.
- An invalid authored number/date/month/time value becomes empty **before** Hint initialization, so Hint activates. An email Hint `'  a@b.com  '` displays normalized `'a@b.com'`, but its logical getter remains empty.
- Starting with number Hint `'123'`, SetText `'invalid'` produces DOM empty, deactivates Hint, and fires one TextChanged because raw cache changed from123 to empty. Starting without Hint and already empty, the same invalid SetText fires no TextChanged because normalized value did not change.
- Actual keyboard input `-` into a number field produces an empty public value with `badInput=true`. The original handlers leave Hint inactive both after input and on blur because the input is invalid. Do not overwrite this in-progress browser editing buffer merely because its public value is empty.
- Parent report [error-hint-evidence.md](error-hint-evidence.md) remains authoritative for the focus/typing hide modes, event ordering and clearing mechanics. This stage changes no previously observed order.

## Maximum length, selection and local files

Actual keyboard typing with maxlength3 stops after three characters for **text, password, email, tel, url and search**; number accepts all six typed digits. Original SetText writes all six for each. Date/month/time actual browser-control fill accepts a value longer than three characters despite maxlength3. File with maxlength1 accepts a longer filename. The date/time experiment uses Playwright's actual control fill, not a native calendar/clock UI capture.

`action.js:2071–2093` invokes native `.select()` for direct input/textarea children after Focus if Hint is inactive. In Edge this completes without error for **all 11 types**. Text/password/search/tel/url expose the selected full range. Email/number/file/date/month/time expose `selectionStart/End=null`; direct `setSelectionRange(1,2)` throws `InvalidStateError` for them. This does not claim an unavailable range API proves absence of all browser visual selection. `flyout.js:258–275` explicitly limits Hint caret `setSelectionRange` to text/search/url/tel/password (or non-input elements), and avoids calling it on the other input types.

Local file injection supplies a synthetic text file to the real browser file control without upload. Native logical reading returns `C:\fakepath\选择-test.txt`, and FileList contains one selected File. SetText of exactly that existing path is a no-op; a different nonempty string throws **before changing value/FileList/cache**, and SetText empty clears FileList and emits the raw TextChanged event. A renderer must not write a persisted nonempty fakepath back into a file input: that is not how a browser restores a file selection. No file contents or OS path were read from the user's filesystem by this experiment.

## Acceptance and limits

Suggested regressions: all 11 editor choices/save-open; initial and SetText normalization above; invalid number buffers; requested-vs-normalized Hint emptiness; email Hint trim; File authored value attribute ignored, local selection and clear, forbidden write error preserving prior selection; full Focus action on a non-range API type; maxlength only where browser applies it. Test preview and actual offline export, and preserve source design text separately from runtime normalized input state.

Verified: original function entry points, SHA identities, deterministic Edge values/flags, local file readback and actual keyboard behaviors stated above. Static-only: generated control metadata/SupportsHint and text parameter flow. Unknown/unclaimed: original GUI/compiler execution, native file chooser dialog, uploading, Android branch, other engines/mobile keyboards, exact picker appearance, native generated min/max/step/default constraints, IME-specific event sequences and all possible date/number strings. No enum-only input type is promoted to supported text-field UI.
