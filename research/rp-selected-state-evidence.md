# Native selected/checked interactions: RP 11 static evidence

Scope: read-only inspection of official RP samples, shipped JavaScript, and managed metadata/CIL. No original GUI execution was performed. “Observed” below means a file or instruction was inspected; event behavior is a static derivation, not a native browser execution claim. The independent decoder changes only recover fully representable events.

## Sources and identity

Axure RP **11.0.0.4150**, extracted from package SHA256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; REA extraction `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. `AxureRP11.dll` SHA256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

Local source root: `C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\DefaultSettings\Prototype_Files\resources\scripts\axure`. Line numbers below are one-based. Exact paths, hashes, relevant CIL slices, raw sample records, and decoded event output are in [rp-selected-state-evidence.json](rp-selected-state-evidence.json).

| File | SHA256 |
|---|---|
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| style.js | `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |

Official documents, checked 2026-10-13:

- [Tab menu tutorial](https://docs.axure.com/axure-rp/tutorials/tab-menu/), sections 3–4: clicking a tab changes the panel and explicitly selects This widget; the two tabs share a selection group, with Tab 1 initially selected.
- [Selection groups](https://docs.axure.com/axure-rp/reference/selection-groups/): groups make selected state exclusive; adding widgets to a group still requires interactions to select them. Selected, Unselected, and Selected or unselected are separate events.
- [Radio buttons](https://docs.axure.com/axure-rp/reference/radio-buttons/): radio groups are assigned separately; Set selected/checked offers true, false, and toggle.
- [Style effects](https://docs.axure.com/axure-rp/reference/style-effects/), Selected: ordinary widgets use a selection action, while checkbox/radio clicks apply the effect automatically.

## RP graph and normalized contract

Observed Tab sample SHA256 `0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4`; main package `216580735aa64e1db9043586ecd32d66`. Both cases contain ordered **SetPanelState then SetCheckState**. The exact action type is `Axure:InterationActionSetFunction` (serialized spelling).

| Node type | Observed properties |
|---|---|
| InterationActionSetFunction | `Disabled=false`, `SetFunction='SetCheckState'`, `action` → Block |
| Expr:Block | `subexpressions` → ordered FCall references |
| Expr:FCall | `function-name='SetCheckState'`, `args` → [DiagramObjectPathLiteral, StringLiteral] |
| Expr:DiagramObjectPathLiteral | `value` → DiagramObjectPath |
| DiagramObjectPath | empty `rdo-path`/`repeater-path`, `is-dummy=false`, tag-22 `object-id` all zero |
| Expr:StringLiteral | `value='true'`, empty `variable-identifiers`, zero `repeater-scope` and `TargetRepeaterScope` |

Tab 1 owner `2f76607a24f242f6ba9db84b579676c9`, selection action `5f59984f93514eaebb42de8020c580f0`; Tab 2 owner `bcfb632e6e7b4fe288077a145b7330df`, action `c0388e597ae542e793a62f926c0ff5a3`. Their `SelectedStyleGroup` is `Tab Control Group`; `Selected` values are respectively true/false. The JSON retains all 12 action/expression/path records.

The zero path is corroborated as This by independent evidence: in `dJ8s` (`sJ8l`, TypeDef token 33557131), `.cctor` IL562–567 assigns `Guid.Empty` to `GJfZ`; `rJfW` token 100696374 IL7–23 compares the object-ID getter `xJfE` against that field. `IxAction.KN8A` token 100703077 IL33–70 resolves a matching path to `get_ThisObject`; ordinary paths take the other branch. See the CIL slices in the JSON and [IxAction evidence](rp-interaction-IxAction-cil.json). Shipped `expr.js:106–114` separately resolves generated `isThis` paths to `eventInfo.srcElement`. The official sample tutorial targets This explicitly.

Normalized action: `{sourceId, type:'setSelected', targetSourceId, value:'true'|'false'|'toggle'}`. This is resolved to the local interaction owner only for this proven action. Explicit local plain paths are also accepted. The decoder does not infer owner by name or cross package boundaries.

`IxEventType` metadata (same DLL) distinguishes `OnSelectionChange=51` from `OnSelectedChange=52`, `OnSelect=53`, `OnUnselect=54`: field tokens 67121718–67121721, little-endian constants `33000000` through `36000000`. The latter three normalize to `selectedChange`, `select`, `unselect`; 51 remains the existing change event. [Enum evidence](rp-interaction-IxEventType-cil.json).

Quick Win SHA256 `04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051`: six native RadioButtons have empty `SelectedStyleGroup`. Their separate `radio-group` values are empty (two), `Duration Radio Group` (two), and `Duration Moving` (two). Four use event 53. The first named group has static panel changes, supported now; the second has animated fade and relative move, still rejected atomically. This is not evidence that shape selection groups and radio groups are interchangeable.

## Action, state, and event semantics

| Supported static conclusion | Exact source |
|---|---|
| Ordinary shape clicks do not themselves select the shape. An action is required. Checkbox/radio clicks have separate automatic handling. | Official style/group/tutorial docs; `events.js:1213–1244`; no ordinary shape selection in the inspected setter call sites |
| A SetCheckState action synchronously evaluates its expression block and continues the outer action list. | `action.js:351–356,370–378`; block order `expr.js:93–97` |
| Exact string `toggle` negates the current query selected value. Otherwise conversion is `Boolean(value) && value != 'false'`. This differs from native condition `getBool`. Nonempty string `FALSE` and string `0` therefore coerce true. | `expr.js:263–270` |
| Query reads ordinary selected state from the style manager, but checkbox/radio state from DOM `checked`. | `axQuery.std.js:1202–1206` |
| Ordinary setter invokes the style manager. Form setter compares current checked; only a different checked value writes checked and calls style with alwaysApply=true. | `axQuery.std.js:1241–1251` |
| Style selection exits for disabled targets; it records whether style state actually changed before processing peers. Repeating a value normally does not raise a new selected event, but setting true still processes its selection group. | `style.js:186–201,251–256` |
| Selecting an ordinary group member first recursively unselects peers, then stores the target flag and raises its events. Changed peers therefore finish their immediate unselect-event dispatch before the target's select dispatch. | `style.js:191–199,251–252` |
| Event order for each changed style flag is SelectedChange followed by Select or Unselect. These calls are synchronous and may reenter interaction handling. | `events.js:1688–1710` |

Important form distinction: the action entry, expression evaluator, and form query setter contain **no target disabled guard before the checked assignment** (`action.js:370–378`, `expr.js:127–179,263–270`, `axQuery.std.js:1210–1251`). Consequently a programmatic action can change a disabled form's checked value, while `style.js:187` prevents updating its style state or raising the associated selected events. The synthetic-event guard at `events.js:1702` only blacklists onLongClick (`1714–1716`); it adds no selection-specific guard.

Programmatic radio assignment also differs from clicking: DOM radio checked assignment performs browser group exclusivity, but this setter calls style only for the target. It does not synchronize a peer's selected-style dictionary or emit peer Unselect events. This is a static derivation of the JS and HTML-radio contract, not an observed native-browser trace. For an ordinary UI radio click, `events.js:1224–1233` explicitly clears style for **every** same-name group member, including itself, before setting its own style true. Thus clicking an already selected grouped radio can produce its own Unselect then Select sequence. Empty-group radios use a self element ID as name and skip that group-clear branch; they do not form one shared unnamed group.

The empty-group name is supported by independent CIL inspection: `FNiU.pNPt` token 100699649 IL2274–2284 checks RadioGroup for null/empty; the empty branch IL2345–2358 uses `BNCJ.MNCS`, while IL2523 uses the explicit RadioGroup value. `MNCS` token100699496 delegates to `XNC9` token100699497; without a row index this returns the element ID. See [radio HTML CIL](rp-selection-layout-radio-html-cil.json), [name writer CIL](rp-selection-layout-radio-name-writer-cil.json), and [ID CIL](rp-selection-layout-radio-id-cil.json). Output escaping exists; arbitrary punctuation/whitespace and component isolation naming are not claimed byte-for-byte verified.

## Group scope, containers, and initialization

- Shape groups use the entire document's exact `selectiongroup` attribute selector (`style.js:192–198`). The peer loop excludes self and limbo template script IDs; it does not generally exclude hidden widgets. No lowercase/uppercase/trim normalization occurs in this runtime path. The known ASCII sample group names are preserved; general generator escaping remains a separate boundary.
- A disabled peer exits the recursive style setter too (`style.js:187`); group selection does not override that guard. The usual exclusivity rule does not imply forced mutation of disabled peers.
- Repeater row isolation is conditional: `repeater.js:265–272` appends row ID to radio names only with `isolateRadio`; `308–309` rewrites selection groups only with `isolateSelection`. These are distinct flags. The latter helper inserts a row suffix before an underscore (`1483–1489`). Native grouping must not be described as always isolated by row. CIL also exposes repeater/component radio-isolation settings; full nested combinations remain unverified.
- Dynamic-panel/layer selected state propagates through children (`style.js:208–227`), skipping later members of a selection group when selecting all. Tree nodes use another special path (`axQuery.std.js:1187–1240`). A flat target assignment would not match those semantics. This decoder intentionally rejects container/tree SetCheckState targets; support is limited to current ordinary imported `VectorShape`, `ImageBox`, `TextBox`, `CheckBox`, `RadioButton` types.
- Initialization applies selected/error before disabled. It processes one initial selected member per group with `skipSelectedIds` (`events.js:803–825`); repeater reset and pre-eval have distinct branches (`827–835`). Whether every initially selected widget fires OnSelect cannot be inferred from this setter alone: generated selected classes and initial input checked values participate in its changed-state check. No startup-event fidelity claim is made here.
- Native style dispatch may redirect contained text/image nodes to an interaction-owning parent (`style.js:229–246`). Decoder targets only imported object-level controls. Generic containment redirection and reentrant mutation quirks are not newly implemented by this work.

## Decoder validation and remaining limits

The action accepts only a validated Block of SetCheckState calls with exactly two typed arguments. Static true/false/toggle values are preserved. Native arbitrary-string coercion is documented above but deliberately not used to guess dynamic RP expressions. Variable bindings, nonzero repeater scopes, compound/dummy paths, wrong types, extra properties (including unknown animation/dont-fire flags), mismatched SetFunction/FCall names, disabled actions, and unrepresentable target types reject the **entire event**, including any preceding panel action. Multiple supported block calls flatten in stored order and retain source action identity.

`node --test research/scripts/read-rp-interactions.test.mjs`: **24/24 passed**. Includes the real four-sample matrix plus exact This/explicit target mapping, all three new events, two-call order, unknown options at every graph level, dynamic/invalid literals, container rejection, local-owner validation, and atomic rejection of a bad later call.

| Sample | Supported events | Unsupported events |
|---|---:|---:|
| Required Fields | 3 | 0 |
| Tab Menu | 2 | 0 |
| Quick Win | 2 | 2 |
| UX Prototyping | 8 | 7 |

These are independent-decoder results, not a claim that every referenced owner/target can be imported or that runtime/browser parity is complete. Geometry availability, selected-style property recovery, radio group initialization, import remapping, UI editing, native animation/move behavior, original-browser execution, and full repeater/component isolation require their own validation.

Companion investigation for native selected-style fields, radio/checkbox geometry, and Tab panel fit: [selection and layout evidence](rp-selection-layout-evidence.md).
