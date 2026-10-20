# RP Error, Hint and input hint fields

2026-10-13 · Axure RP 11.0.0.4150 · self-written static container/object recovery, retained ECMA metadata/CIL, and the extracted original JavaScript. No target assembly or original GUI was executed. This report separates stored data, bounded import behavior, and unverified native rendering. Related runtime function experiments are independently recorded in [Error/Hint runtime evidence](error-hint-evidence.md); those probes are not GUI verification.

## Pinned evidence and reproduction

- DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Original installer ZIP SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- [Full sample and recovery ledger](rp-error-hint-evidence.json): SHA-256 `73d97cb3400701e2e8a2de76816ec5ae163771eb3110af3ff648773539151582`. It includes all eleven source SHAs, source object/package/style IDs, raw hint/error fields and style properties, matched named caches, SetErrorState argument graphs, reader/importer statuses, final imported records, and hashes of the self-written code used.
- [CIL windows](rp-error-hint-cil-excerpts.json): SHA-256 `8d457ef067833971e67f232cae39435b1344d0d2506c24b56b44db6dd0dd5e8b`. The unchanged parent CIL evidence is `rp-interaction-PlainTextObject-cil.json`; the excerpt records its own SHA.
- [Audit script](rp-error-hint-audit.mjs) verifies every sample hash before decoding. Unlike a metadata-only scan, its final import census uses `inspectRpSemantics(file)` including original image resources; it then invokes only our own pure converter and model save/readback validator.

Original JS files are under the existing extracted `DefaultSettings/Prototype_Files/resources/scripts/axure` directory:

| File | SHA-256 |
|---|---|
| events.js | a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3 |
| style.js | f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c |
| expr.js | 530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6 |
| flyout.js | 13e003db00c1f89f6e628ea61492de4d09053143e5f9c68c5bf30c35e6f2a788 |
| axQuery.std.js | 0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd |

## Field identity and exact subset

Real TextBox/TextArea objects explicitly store `PlaceholderText` as a string and `HideHintOnFocus` as a Boolean. The JavaScript generator's runtime property is spelled **HideHintOnFocused**. The product mapping is `hintText` and `hintHideOn:'focus'|'typing'`; true maps to focus, false to typing. Text stays in the separate TextBlock carrier. An initial `Error` Boolean is stored on native diagram objects and maps to the independent `error` flag.

Static PlainTextObject evidence corroborates field identity:

| Method | Token | Relevant IL |
|---|---:|---|
| get_PlaceholderText | 100701331 | offset8 loads field MNp6 (67126430) |
| set_PlaceholderText | 100701332 | offset35 stores MNp6 |
| get_HideHintOnFocus | 100701333 | offset8 loads field CNpD (67126431) |
| set_HideHintOnFocus | 100701334 | offset35 stores CNpD |
| PlainTextObject.NIwY writer | 100701362 | offset905 calls get_HideHintOnFocus; 1118 calls get_PlaceholderText |
| PlainTextObject.oIw4 reader | 100701363 | offset255 calls set_HideHintOnFocus; 682 calls set_PlaceholderText |

The serializer's string-key construction remains obfuscated in these retained CIL windows. Exact serialized names above are observed directly in the structured real object records; this report does not pretend the string decoder was executed or completely recovered.

The previous TextBox subset remains Type0 text / Type1 password, WordWrap=false, ReadOnly=false. The previous TextArea subset remains Type0, WordWrap=true, ReadOnly=false and zero SubmitButton. TextArea's former empty-hint-only restriction is replaced by explicit bounded string/Boolean validation. Hint text is literal, at most 100,000 characters; unimplemented expression substitution markers are rejected. Missing or malformed fields are reported, not inferred from GUI defaults.

## Hint behavior: original JS evidence

- `events.js:865–880`: text inputs/areas register a placeholder, including an explicitly empty placeholder. Focus mode clears active placeholder text on focus; typing mode does not.
- `events.js:883–913`: blur reactivates a placeholder only when the value is empty and the native input is valid. Typing mode input handlers deactivate the active placeholder or reactivate it after deletion to an empty valid value.
- `events.js:915–923`: typing mode also clears the placeholder before keydown/beforeinput/paste and registers whether the original input is password type.
- `events.js:929–932`: initialization clears an actual input value equal to the placeholder text before activation. The source describes this as a browser history restoration workaround. Every nonempty hint in this sample corpus has a separately stored empty input value; equal-nonempty authored values have no real sample here.
- `flyout.js:217–255`: per-element placeholder info stores text, password and active separately; update exits if active state is unchanged. There is a separate Android branch, which this import phase does not implement or claim to verify.
- `style.js:291–311`: the Hint visual flag requires active **and nonempty text**. The original implementation temporarily changes password input type while displaying a hint and writes display text into the DOM value. Our document model instead keeps input value and hint separately; storage recovery must never copy hint into widget.text.
- `expr.js:586–587,603`: GetWidgetText returns empty string and GetWidgetValueLength returns zero while placeholder info is active. This is why hints cannot be normalized into actual input text.

## Error events and actions

`IxStyleState.Error=16` and `Hint=32` retain the exact previously verified enum identity. Error events come from **Axure.Constants.IxEventType**, not that style enum:

| Event | Code | Field token | Product event |
|---|---:|---:|---|
| OnErrorSet | 55 | 67121722 | errorSet |
| OnErrorRemoved | 56 | 67121723 | errorRemoved |

`style.js:275–284` returns immediately for a disabled target. Otherwise it computes change, stores the error flag, raises the relevant error event if changed, and only then applies state appearance. `events.js:1695–1699` emits the two distinct events; no ErrorChanged event appears in this path. Error can still change and dispatch when there is no Error style. The independent runtime probe report documents reentrant setter/class behavior and other implementation limits.

`expr.js:253–261` implements SetErrorState over targets in order. Literal `toggle` negates each target's current error; other values use `Boolean(value) && value != 'false'`. Native .rp recovery intentionally accepts only the explicitly represented literal strings `true`, `false`, `toggle`, not arbitrary native expression evaluation or broad JavaScript coercion.

The observed object chain is `Axure:InterationActionSetFunction` (native spelling) with `SetFunction='SetErrorState'`, `action` referencing `Axure:Expr:Block.subexpressions`, each an FCall `function-name='SetErrorState'`, args `[DiagramObjectPathLiteral, StringLiteral]`. All 144 actual calls have literal values, empty variable bindings and zero repeater scopes: 70 true, 74 false. This sentinel/path decoding uses the same already verified local/This path rules as SetCheckState. Compound master/repeater paths remain unsupported.

`axQuery.std.js:1162–1173` supports ordinary native vector/image/input/list/select/check/radio targets and propagates into DynamicPanel/layer children. The decoder therefore does not blanket-reject panels. The importer requires the panel itself and every source state descendant to be fully recovered and unambiguous before accepting a recursive SetError action. Missing children reject the complete event. Native layers/list/select may decode but still fail conversion if their underlying widget model is not supported. Event conversion remains atomic across all cases, actions and conditions.

## Named Hint cache and state patches

The legacy four-state `interactionStyleRecovery` remains unchanged. A separate **errorHintRecovery** preserves compatibility with older worker results:

- `status:'recovered-error-hint'`, explicit error Boolean, optional inputHint with hintText/hintHideOn and exact sourceFields.
- `styles` uses the same per-state supported/no-state/unsupported contract, now with exactly `error` and `hint` entries. Error/Hint are no longer reported as unhandled when this new protocol exists.
- A standalone initial true error includes `normalStyleRecovery` with active Error unapplied, so clearing can restore normal appearance. Existing simultaneous initial Selected/Disabled constraints remain reported as unsupported; no real initial-error sample establishes those combinations.
- Unresolved normal inheritance still permits only independently explicit solid colors. A complete normal cache permits the existing bounded appearance subset. Thus PName8/15 Error can be represented with a known chain; the 36 real examples currently lack that complete chain and remain unsupported atomically.

For a named state style, PName0 must explicitly match its MatchInfo.Id, and MatchInfo.LibraryId must match the Style's LibraryId. The root StyleCache must contain exactly one matching Info pair. This phase accepts only the complete cached solid-color property set6/7/8 plus local color overrides, excluding PName0 from the output. It **does not merge normal document-default fields into the state patch**. Provenance retains namedStyleMatch `{styleId,libraryId,localProperties}`. Duplicated cache matches, wrong libraries, mismatched base IDs, unknown state properties, or invalid colors reject that state.

Concrete Default **Form Hint** evidence: Basics Hint style `266994d70d6847858a7ce2638f4fd028` references ID `4889d666e8ad4c5e81e59863039a5cc0`, library `53f4a189168b474893d409a1b736ad03`; the unique root cache has Info.Name=`Form Hint` and only PName6 solid `-6710887` → **#999999**. This supports the Default-library preset value, not a universal native hint constant. Real explicit/matched variants also recover **#bdbdbd** and **#d7d7d7**.

## Corpus counts and retained boundaries

The eleven pinned samples contain **125 TextBox/TextArea records**, **15 nonempty hints**, **zero HideHintOnFocus=true**, **zero initial Error=true**, and **zero configured event55/56 records**. True focus policy and initial errors therefore have static JS/metadata support plus synthetic protocol tests, not original GUI fixture coverage.

Raw state property shapes:

- Hint121: 113 with `[0]`; four `[0,2,6]`; two `[0,6]`; two `[6]`.
- Error82: 36 `[8,15]`; six `[6]`; 40 large full-style snapshots.

The strict parser produces **15 nonempty-hint candidates, 113 Hint-style candidates, six Error-style candidates**. Final import contains **14 nonempty hints, 86 Hint styles, six Error styles**. A style count includes empty-hint inputs whose explicit Hint style is preserved for future editing.

| Sample | Final nonempty hints | Final Hint styles | Final Error styles |
|---|---:|---:|---:|
| Default.rplib | 0 | 2 | 0 |
| Flow.rplib | 0 | 0 | 0 |
| Icons.rplib | existing page-limit rejection | — | — |
| Sample form patterns.rplib | 11 | 71 | 6 |
| Sample UI patterns.rplib | 2 | 4 | 0 |
| Prototype Starter.rp | 1 | 1 | 0 |
| Prototyping Basics.rp | 0 | 5 | 0 |
| Quick Win.rp | 0 | 1 | 0 |
| UX Prototyping.rp | 0 | 0 | 0 |
| the-basics-tab-menu.rp | 0 | 0 | 0 |
| complex-interactions-required-fields.rp | 0 | 2 | 0 |

All 144 observed SetErrorState calls are in form patterns. Their enclosing events still contain other unsupported conditions/actions; **zero new complete real events are claimed restored**. The decoder's new action/event path is tested on synthetic modifications of real decoded object graphs. It does not salvage the supported actions from a rejected native event.

Largest compact semantic result remains under 20 MiB (Icons 9,450,952 bytes; form patterns 7,329,589). Normal style data is included a second time only for an actual initial-error restoration, avoiding unnecessary repeated recovery payloads for ordinary false flags.

## Stable actual imported fixtures

**Prototype Starter.rp** SHA `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714`:

- Imported Search input: package `06dc4240ee184698944195b5c1b18269`, object `bebad8ede9374fea951d04ac834a7f63`, text empty, hint `Search...`, typing, Hint `#bdbdbd`; source style `b8fad451f42a4ead9a5d5f20fdace79b`.
- The equivalent candidate in package `68ae2bed587e49b48376490f15b1b086`, object `cd0ff15f5ea94e349f87cb9f56fc69c0`, style `09c519de43fe4ea8a83a65a37524069f` is not in the currently recovered parent subtree. It must not be counted as an actual imported widget.

**Sample form patterns.rplib** SHA `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`:

- Search hint: package `7a4f596111ec489b94533436e3827e03`, TextBox `37ef7d17c8154ad4b097ba0403a30f7a`, hint `Search`, typing, named Hint `#999999`.
- Error color: package `1dd62d24bc27417299d6601edc4cceae` / `Text area & character count`, VectorShape `72774a4450a348bc913c048dc1d97a38` / `Character counter`, Error PName6 signed ARGB `-2555877` → `#d9001b`.
- First witnessed setter in that package: FCall `e265b7503d7a4c42b337c2bd5124ed8f`, path literal `1456cebc387842b987cc3d79399f08eb` targets that counter; literal `7f0167cf99c148dca91963c46c2e5120` is `false`. The ledger now includes the containing Block/action identities, not just matching strings.

## Verification

```powershell
node research/rp-error-hint-audit.mjs
node --test research/scripts/read-rp-error-hint.test.mjs research/scripts/read-rp-interaction-styles.test.mjs research/scripts/read-rp-interactions.test.mjs research/scripts/read-rp-appearance.test.mjs research/scripts/read-rp-shapes-forms.test.mjs
npx vitest run tests/import-rp-error-hint.test.ts tests/import-rp-interaction-styles.test.ts tests/import-rp.test.ts tests/import-rp-interactions.test.ts
npm run typecheck
```

At code freeze: **75/75 Node tests** (12 new) and **87/87 Vitest import tests** (16 new), plus typecheck passed. The old textarea rejection test's two previously unsupported valid hint values were replaced with malformed types; all missing-field/type/wrap/read-only/submit guards remain, and new positive tests cover actual hint recovery. Tests also cover named-cache identity/ambiguity/local reset overrides, unsafe colors and text, source immutability, whole-event rejection, This targets, complete versus partial panel propagation, old protocol compatibility, and native source → saved model readback.

Still unknown: the original generator's initial error CSS-class emission and resulting startup error-event timing; exact rendered native pixels; mobile/Android editing; hint expression substitution; full state inheritance; large Error snapshots; and complete error behavior in the sample events whose unrelated expressions/actions remain unsupported. The original GUI bridge was not retried.
