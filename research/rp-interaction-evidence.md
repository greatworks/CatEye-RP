# Native RP interaction object evidence

2026-10-13. Static inspection of four official samples with the existing bounded `read-rp-container.mjs`, `read-rp-objects.mjs`, and `read-rp-semantics.mjs` readers. No Axure execution or native preview comparison was performed. Raw maps, reference tags, object offsets, package hashes, reader hashes, and ordered interaction trees are retained in [rp-interaction-object-evidence.json](rp-interaction-object-evidence.json). Offsets below are decimal offsets in the decoded object package, not offsets in the compressed RP file.

## Sources and coverage

| Sample | SHA-256 | Packages / events / cases / actions |
|---|---|---|
| [Required fields](https://docs.axure.com/samples/complex-interactions-required-fields.rp) | `0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c` | 8 / 3 / 4 / 4 |
| [Tab menu](https://docs.axure.com/samples/the-basics-tab-menu.rp) | `0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4` | 9 / 2 / 2 / 4 |
| Shipped `DefaultSettings/Training/Quick Win.rp` | `04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051` | 11 / 4 / 4 / 6 |
| Shipped `DefaultSettings/Training/UX Prototyping.rp` | `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72` | 25 / 15 / 15 / 17 |

All 53 packages decode without unsupported package records. All 52 owner interaction maps have structurally consistent ordered trees; 24 are nonempty. Counts are package occurrences, not globally deduplicated GUIDs. The training files came from official `AxureRP-Setup.zip`, package SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`, extraction evidence `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.

Companion metadata evidence uses `AxureRP11.dll` SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`: [event constants](rp-interaction-IxEventType-cil.json), [binary comparison constants](rp-interaction-BinaryOperation-cil.json), [fade constants](rp-interaction-FadeActionType-cil.json), [panel-state constants](rp-interaction-SetStateType-cil.json), [target constants](rp-interaction-IxTargetType-cil.json), [link constants](rp-interaction-LinkType-cil.json). Numeric interpretations below are anchored by those named constants and actual sample structure, not guessed from UI labels.

## Exact graph schema

| Object type | Property | Observed structure |
|---|---|---|
| `Axure:DiagramObject:*` | `InteractionMap` | Local reference tag 3 to an `Axure:InteractionTreeMap`. Case-sensitive spelling. |
| `Axure:Page`, `Axure:PanelState` | `interactionmap` | Same role, different spelling. Some maps are empty. |
| `Axure:InteractionTreeMap` | `node-table` | `$map` pairs: **Node reference → member reference**. Keys are reference objects, not strings. |
| same | `tree`, `PackageMode` | Local reference to `Axure:Tree`; `PackageMode=false` in all samples. |
| `Axure:Tree` | `children`, `tree` | Ordered event-node references; `tree` points to itself. |
| `Axure:Node` | `children`, `parent-node`, `tree` | Ordered descendants, parent reference, shared tree reference. Event nodes contain case nodes; case nodes contain action nodes. |
| `Axure:InteractionEvent` | `Disabled`, `event-type` | Boolean and native integer. Other observed fields: `master-containing-raised-event`, `raised-event-id`, `variable-id`. |
| `Axure:InteractionCase` | `Disabled`, `Description`, `Condition`, `IsNewIfGroup` | Condition is a local expression reference or zero GUID. Case/event/action order comes from the tree, not the object stream or node-table order. |
| action objects | `Disabled` plus type-specific fields | Disabled is present independently on events, cases, and actions. |

All 25 observed cases store `IsNewIfGroup=false`, including the first case of an event. Do not turn a false first case into a second independent branch; preserve native ordering and evaluate the first eligible case in a chain. These samples do not demonstrate a later `IsNewIfGroup=true` boundary; its semantics come from the separate [conditional-case investigation](conditional-case-evidence.md).

**Identity boundary:** local type-3 references resolve in their own package. Quick Win has the same Page root object GUID `14b7c86d5db64bc89e65bf71ffd23cd9` in packages `c6428b5a8ae84f939ae7fb9ac0cddb61` and `990b0f0c6fe44617900b184763aaff5b`; UX repeats action GUIDs with different page targets in different packages. A global GUID→object map silently selects the wrong object. External page/state references identify a **package**, whose `rootId` is different from its `packageId`.

`Axure:DiagramObjectPath` contains `rdo-path`, `repeater-path`, `object-id` (tag 22), and `is-dummy`. All four samples have empty rdo/repeater paths and `is-dummy=false`. A diagram object target can nevertheless cross from a panel-state package to a widget in its parent page: UX path `4fb62e5da6024fdea4c64e6ae35a151d` targets page-level panel `77600609975c4b4bbcde8d2a4b7b6ddc`. Therefore “local helper references” does not mean every widget target is local. A bounded local-only decoder must explicitly reject such targets until a page/container resolver exists.

## Required Fields: complete witnessed path

Main package: `1455edf5f56a48e99b2c94ee5d1ea987/package`.

- Email Field `28de2d860170465c8b28bbe3e69a5e42`, offset 14272 → map `89b4fc426ded4aff990f2d1cb445c197` → event `6364bcc484f14dc0a3d976d0aa6a3c70`, offset 15186, `event-type=48` (`OnFocus`). Its only action is FadeWidget `1623e566f06f4754aba7feceede2368e` with fade-action-type 0 (`Hide`).
- Password Field `65078eb0278d4c4fb0bbd3b77fa06c8b`, offset 19171 → focus event `46887a0f6da4477da248cde19493aefa`; same hide target.
- Sign Up `cb0cc5841b274fdfb0698f9e05198f77`, offset 21943 → map `a8bdb8c8d4c54335862530c02bb9043c` → event `f5a77aa72cf74aad8851303f4a7d144a`, offset 24990, `event-type=16` (`OnClick`). Ordered cases are Successful Signup `a5205725172f4d52b3628baeece06220`, then Unsuccessful Signup `907f53a24ebb4b62b3821bd48f63872f`.

Successful condition at offset 25169 is `Axure:Expr:BinaryExpr` `952cc9cfe4d24a85821876d2db090c8e`, `operation=1` (`And`). Each operand is a BinaryExpr with operation 4 (`NotEquals`):

```text
BinaryExpr(And)
  BinaryExpr(NotEquals)
    FCall(function-name='GetWidgetText', args=[DiagramObjectPathLiteral])
      DiagramObjectPath(object-id=Email Field GUID)
    StringLiteral(value='')
  BinaryExpr(NotEquals)
    FCall(function-name='GetWidgetText', args=[DiagramObjectPathLiteral])
      DiagramObjectPath(object-id=Password Field GUID)
    StringLiteral(value='')
```

Exact expression properties: BinaryExpr `left-expr`, `right-expr`, `operation`; FCall `function-name`, `args`; DiagramObjectPathLiteral `value`; StringLiteral `value`, `variable-identifiers`, `repeater-scope`, `TargetRepeaterScope`. All witnessed literal variable lists are empty and both scope references are zero. Literal text must remain literal: decoding must not evaluate or re-interpret a stored `[[...]]` string.

**Equality is not the receiving model's default strict string comparison.** Shipped `resources/scripts/axure/expr.js:7–8,19–59` evaluates both operands, rejects undefined for equality, and ultimately compares `$ax.getBool(left) == $ax.getBool(right)`; NotEquals negates that result. `sto.js:210–213` recognizes case-insensitive exact strings true/false as booleans and otherwise returns the original value. It does not trim whitespace or lowercase other strings. For the decoder's string-only operands: `FALSE == ''` is true, `TRUE == '1'` is true, `'0' == ''` is false, `' true ' == 'true'` is false. These are implications of the static code and JavaScript equality, not GUI observations. Therefore decoded equals/notEquals conditions carry `comparisonMode:'axure'`; ordinary existing project conditions retain their previous mode. Numeric greater/less are withheld: `expr.js:68–73` converts the right side with Number and permits coercion of an empty left string, while the receiving model rejects empty operands. Raw source excerpts and hashes are in [rp-interaction-comparison-evidence.json](rp-interaction-comparison-evidence.json). Date/object recursive equality exists in the native helper but is outside the witnessed GetWidgetText/StringLiteral subset.

Success action `e8c66a2a12134e369e1a51bcc83990a9` (offset 25895) is `Axure:InteractionLinkWindowAction`, `link-type=1` (`Current`), `target` → `Axure:InteractionTarget` `ce1881d8cd414bcaa9cf11eb46123bcf` (25960). Target has `target-type=1` (`Page`), `target-page-id` tag 19 named `Axure:Page`, value `1862954f3d4d4eb69fb481b7b3512b77`. This is the destination package ID; destination Page root object is `43e964d4e3bd4b3bb613667cfa923346`. `target-literal` is a StringLiteral containing `Page 2.html`; it is not the authoritative page identity.

Failure case has a zero condition and FadeWidget action `d69f4a37b6114147ac01d88f68c91a7e`. Its FadeWidgetInfo `f157bc38f6324ed39965b3dd69f7080d` at 26380 has fade-action-type 1 (`Show`). All three fade actions target Error Message `eb900b90427f4f4b828f41c72e8db177`. All use animation-show/hide=0 and easing=0, so stored duration 500 alone must not be treated as evidence of a visible animation.

The [official Required Fields tutorial](https://docs.axure.com/axure-rp/tutorials/required-fields/) independently describes the nonempty AND condition, success navigation, fallback error display, and focus-to-hide behavior. That corroborates this sample's graph; it is not a substitute for general expression or action semantics.

## Tab Menu: panel targets and an additional action

Main package `216580735aa64e1db9043586ecd32d66/package`; both Click cases are unconditional. Each has **two** ordered actions: SetPanelState, then `Axure:InterationActionSetFunction` (this exact serialized spelling omits the c in Interaction).

SetPanelState fields are `panelobjectpaths`, `PanelPaths`, `SetStateInfos`; the two latter arrays pair targets and per-target settings by position in the observed samples. `PanelPaths` resolves through DiagramObjectPath to panel `c909f8f46aa742d4a7e1677418cdac66`.

| Source | SetPanelStateInfo | `set-state-type` | `diagram-id` | Resolved state root |
|---|---|---|---|---|
| Tab 1 `2f76607a24f242f6ba9db84b579676c9` | `00ac31a30de44b43bf65b986bf8970b1`, offset 12689 | 0 = Diagram | `23eeb8170eeb46959589f1496236e76b` | `628fc38edd3841efa7a1a38fdd82da20` |
| Tab 2 `bcfb632e6e7b4fe288077a145b7330df` | `4880c069c04045a1ac3d175e40b335a5`, offset 17333 | 0 = Diagram | `cd27998bdbb547138fc87312c1037656` | `065d6649bcab4d4b8fa5a4c6bc7f00ae` |

Both `state-value` expressions contain the string `1`. They do **not** identify the two different states in Diagram mode; use `diagram-id`. The target panel's ordered `panel-diagrams` list contains the same two external package IDs. Extra stored behavior includes loop, show-when-set, repeat/repeat-interval/repeat-skip-first, compress settings, enter/exit animation/easing/duration/scale/anchor. Preserve or reject behavior that the receiving runtime cannot express; do not only recover the target and discard an active setting.

The second action's fields are `Disabled=false`, `SetFunction='SetCheckState'`, and `action` → Expr:Block (`subexpressions`) → FCall(`SetCheckState`, two args). The first argument is DiagramObjectPathLiteral with all-zero target object ID; the second is StringLiteral `true`. The [official Tab Menu tutorial](https://docs.axure.com/axure-rp/tutorials/tab-menu/) explicitly uses This widget for this action, matching that sample encoding. The tabs also store `SelectedStyleGroup='Tab Control Group'` and Selected true/false. Subsequent CIL/runtime research confirms this path and distinguishes selected style from checked form state; see [selected-state evidence](rp-selected-state-evidence.md). Both ordered actions are now recovered. Dropping the selection action and calling the whole event recovered would be incorrect.

## Cross-sample corroboration and limits

- Quick Win has four `event-type=53` (`OnSelect`) events on RadioButtons, not Click. Two use SetPanelStateInfo with Diagram mode and distinct state package IDs, corroborating Tab's field structure. Two contain FadeWidget then MoveWidget, corroborating multi-action order. MoveWidgetInfo has `Easing=1`, `Duration=300`, `XValue`, `YValue`, `MoveType=1`, `BoundaryCondition`, `MoveTrajectory`, `scope`; the current receiving model's absolute move action must not silently replace this relative/animated movement.
- UX contains fourteen Click events and one `event-type=288` (`OnLoad`) on a Page. Seven page-navigation actions corroborate LinkWindowAction → InteractionTarget → external Page package. It also supplies six FadeWidget and four SetPanelState actions. Several targets cross nested package boundaries; some sources are ImageMapRegion widgets unsupported by the current geometry converter. Decodable interaction structure is not proof its owner/target exists in the imported document.
- Every sample has DesignDocument.`GlobalVariableSet` → `Axure:GlobalVariableSet`.`global-variables` → `Axure:GlobalVariable` with `name='OnLoadVariable'`, a separate `variable-id` GUID, and `default-value=''`. This proves declaration storage, not variable read/write expression encoding. None of these four samples exercises variable conditions or variable mutation.
- Conditions occur only in Required Fields: one AND with two NotEquals leaves. No mixed AND/OR, unary condition, global-variable read, dynamic expression literal, nonempty repeater scope, Wait, or SetText action is witnessed in these samples. Metadata names alone cannot establish their serialized keys or runtime behavior.
- None of these cases/actions/events is disabled; the boolean field exists, but sample execution does not independently establish disabled behavior. No sample demonstrates a nonempty rdo/repeater target path. No original GUI export/preview was executed.

## Decoder boundary

The independent decoder is designed to return a complete supported event or a diagnostic for that event. Unknown case members, unknown actions, mixed boolean expressions, unresolved references, and behavior-changing unsupported options must not be deleted while retaining an ELSE case. A structurally untrustworthy tree is rejected as a whole. A supported native action remains subject to the importer verifying owner, widget target, destination page/state, and geometry availability before attaching the event. The evidence JSON retains raw records for future expansion without pretending that static decoding equals native runtime fidelity.

Implementation: [read-rp-interactions.mjs](scripts/read-rp-interactions.mjs), exported `recoverInteractionMap({owner,objects,packageId})`; validation: [read-rp-interactions.test.mjs](scripts/read-rp-interactions.test.mjs). A missing/zero/empty interaction map yields `decoded-interaction-tree` with empty events. All returned condition strings are literal; conditions additionally require the importer/runtime's explicit native comparison mode. State actions return both `targetSourceId` (panel object) and `targetPackageId` (state package), without substituting the inactive state-value string.

Current four-sample decode counts after the selected-state extension: Required 3 supported / 0 unsupported; Tab 2 / 0; Quick Win 2 / 2 (animated fade/relative movement still rejected); UX 8 / 7 (7 page links and one plain show supported, 6 cross-package widget targets and one lightbox rejected). Disabled actions are rejected because the normalized action model cannot preserve their editable enabled state. Variable conditions, Wait and SetText are not fabricated without witnessed serialized schemas. Twenty-four dedicated Node tests pass, covering sample results, atomic rejection, ordered selection blocks, strict This/local targets, unknown behavior options, reordered object storage, duplicate package identities, expression limits, literal preservation, disabled state, and broken/cyclic trees. Details and source identity: [selected-state evidence](rp-selected-state-evidence.md).
