# Axure RP 11 native interaction serialization: static evidence

Date: 2026-10-13. Target distribution: RP 11.0.0.4150. This pass reads retained sample records and ECMA-335 metadata/CIL with `PEReader`. It does **not** load/execute the target DLL, start the original GUI, decrypt its string table, or modify product code. It establishes a narrow importer boundary, not full `.rp` compatibility.

## Source identity and reproducibility

- Official ZIP SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- `AxureRP11.dll` SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Existing REA extraction Evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`; manifest `agm_4289bead12e4e9a365f6c54b95f4a9dd0d96d4ec6d317d8f486c1dfc6db51336`.
- Existing managed Evidence: `ev_f0036570d4705d93beb771a90d7eea9390e7ff5b75631e8e3ec92bd8d4aa0788` explicitly stopped at a 64 MiB metadata representation budget. The focused PowerShell metadata/CIL records below are separate local evidence, not a claim that REA completed the omitted representation.
- [rp-interaction-mappings.json](rp-interaction-mappings.json) contains eight typed enum inventories and a SHA-256/size manifest for every new CIL record. The `.json` records preserve method token, RVA, signature, instruction offset, raw operand, and resolved token name.
- [rp-interaction-sample-evidence.json](rp-interaction-sample-evidence.json) retains interaction/expression/path/control/configuration objects from the two tutorial samples. [rp-document-settings-sample-evidence.json](rp-document-settings-sample-evidence.json) retains only relevant settings properties from three samples.

Reproduce a focused disassembly, without executing the assembly:

```powershell
$rpDll = (Get-Content research/conditional-case-cil.json -Raw | ConvertFrom-Json).AssemblyPath
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $rpDll -TypeName IxEvent -MethodNames get_EventType,NIwY,oIw4
node research/scripts/show-rp-cil.mjs research/rp-interaction-IxEvent-cil.json get_EventType NIwY oIw4
node research/scripts/summarize-rp-interaction-evidence.mjs
```

The last command checks source digest consistency, enum namespace/type identity, selected critical values, and the compressed signature reference linking `BinaryExpr.get_Operation` to `LogicalComparison`. It passed with **8 enum inventories / 39 retained metadata/CIL JSON records**. Three records (`GlobalVariableSet`, `GlobalVariable`, `DesignDocument`) are empty exact-name searches; the actual obfuscated classes were then located through `GlobalVariableLiteral`. This checks evidence consistency; it does not test the original application's behavior.

Sample hashes:

| Sample | SHA-256 | Observed role |
| --- | --- | --- |
| `the-basics-tab-menu.rp` | `0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4` | Click, state actions, selected-state expressions, project settings |
| `complex-interactions-required-fields.rp` | `0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c` | Focus, conditional text checks, visibility, navigation, password input |
| `Quick Win.rp` | `04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051` | Supplemental project-settings record |

The tutorial samples have a retained package version `[9,0,1,0]`; the inspected reader/writer DLL is RP 11. These are readable legacy-origin documents, not evidence that every newly saved RP 11 document uses identical keys.

## Evidence labels and important limitation

**Metadata confirmed** means enum constants or signatures are directly decoded from the assembly. **CIL confirmed** means a getter/setter/serializer connection is visible in retained instructions. **Sample observed** means an exact key/value/reference is present in a successfully parsed sample. **Corroborated mapping** combines sample keys with matching CIL property/type relationships. **Unknown** remains unimplemented unless independently established.

Most property key strings in this assembly are obtained from `wIhA.zIhQ::sIho` using mixed constants and module fields. This pass did not resolve that string table. Therefore the tables below do **not** claim that CIL alone directly spells keys such as `event-type`, `Condition`, or `target-page-id`. Raw sample spellings and named getter/signature/serialization evidence are presented separately. Early entry jumps also skip deliberately invalid-looking token operands; the inspection script preserves those bytes rather than treating unreachable junk as real calls.

## Events, case grouping, and disabled flags

Source files: `rp-interaction-IxEventType-cil.json`, `-IxEvent-cil.json`, `-IxCase-cil.json`, and `-IxObjectBase-cil.json`.

| Serialized sample type/key | Static anchor | Result and boundary |
| --- | --- | --- |
| `Axure:InteractionEvent.event-type` | `IxEvent.get_EventType` token `0x06009F49`, RVA `0x007F3BC4`, IL `0008` reads `QNlw`. `NIwY` `0x06009F5C`, IL `0066` calls getter then integer wrapper. Modern `oIw4` IL `02A7–02AC` converts integer then calls `set_EventType`. | Corroborated enum-valued event field. Reader also contains version-sensitive legacy conversion paths; do not apply modern numeric rules to arbitrary old encodings. |
| `Axure:InteractionCase.Description` | `get_Description` `0x06009C84`, IL `0008` reads string `ANTh`; `NIwY` IL `00D5` serializes it. | Case name is stored independently of actions. Empty description is observed. |
| `Axure:InteractionCase.Condition` | `get_Condition` `0x06009C8D`, IL `0008` reads `ANT2`; `NIwY` IL `008F–0099` wraps it as an object reference. | Sample condition is zero object ref for unconditional, or a reference to an expression tree. It is not an inline array of simplified conditions. |
| `Axure:InteractionCase.IsNewIfGroup` | Getter `0x06009C8B` reads boolean `WNTa`; setter `0x06009C8C` writes the same field. `NIwY` IL `004A–0054` serializes it; reader has modern bool and older string-conversion paths. | Both observed first cases can store `false`; first-case grouping must be contextual. Constructors do not assign true to `WNTa`, so fresh zero-initialized field is false. Missing serialized key acceptance/default is **not** established by this alone. |
| `Disabled` on event/case/action | Base `IxObjectBase.get_Disabled` `0x0600A19C` reads `TNAj`; setter `0x0600A19D` writes it. Base writer `0x0600A19E` IL `0044` serializes getter. Reader `0x0600A19F` IL `0049` supplies `ldc.i4.0` to boolean lookup, then `set_Disabled`. | Corroborated shared disabled flag, with explicit false lookup fallback. Preserve event/case/action levels rather than considering only widget disabled. Samples contain false. |

Metadata-confirmed event values (not the older `Axure.Document.RPEventType`):

| Value | `Axure.Constants.IxEventType` |
| --- | --- |
| 16 / 17 | OnClick / OnDoubleClick |
| 18 / 19 / 20 | OnMouseOver / OnMouseMove / OnMouseOut |
| 21 / 22 | OnMouseDown / OnMouseUp |
| 32 / 33 | OnKeyDown / OnKeyUp |
| 48 / 49 | OnFocus / OnLostFocus |
| 50 / 51 / 52 | OnTextChange / OnSelectionChange / OnSelectedChange |
| 53 / 54 | OnSelect / OnUnselect |
| 276 / 277 / 278 | OnShow / OnHide / OnPanelStateChange |
| 288 / 289 / 290 / 291 | OnLoad / OnItemLoad / OnItemResize / OnBeforeItemLoad |
| 320 | OnPageLoad |

The complete enum, including unsupported events, is in the mapping JSON. Mapping several distinct native change/selection events to one product `change` event requires an explicit semantic decision; enum knowledge alone does not justify collapsing them.

`InteractionTreeMap` sample `node-table` maps tree-node references to event/case/action object references; a separate `Tree.children` chain stores order/hierarchy. Object record order or hash-map enumeration is not an action ordering contract. That graph is handled by the independent sample parser investigation; this CIL pass did not establish a general replacement ordering rule.

## Actions and target paths

There is no single inferred numeric “action enum” in this report. Samples dispatch by concrete serialized action type, and action-specific enums configure it.

| Sample carrier | Metadata/getter evidence | Safe narrow interpretation |
| --- | --- | --- |
| `InteractionFadeWidgetAction`: `WidgetPaths[]`, `FadeInfos[]`, also legacy `panelobjectpaths[]` | `IxPathInfoMapAction<T>` exposes paths and infos; `IxFadeWidgetAction.EIyA/nIyo` have version-sensitive key-name branches. `FadeWidgetInfo.get_FadeActionType` `0x0600A039` reads `ONv6`, signature refers to `FadeActionType`. | Enum Hide=0, Show=1, Toggle=2. Pair only validated equal-length paths/infos; do not assume legacy and modern lists can be concatenated. |
| `FadeWidgetInfo`: `fade-action-type`, `duration`, `DurationHide`, `easing`, `EasingHide`, `animation-show/hide`, `BringToFront`, compression/lightbox properties | Matching named getters and independent fields retained in `-FadeWidgetInfo-cil.json`. | Plain show/hide is not proof that animation, bring-to-front, compression, lightbox, or background effects are supported. Non-default unsupported side effects must remain in report/rejection policy. |
| `InteractionSetPanelStateAction`: `PanelPaths[]`, `SetStateInfos[]`, legacy `panelobjectpaths[]` | `IxSetPanelStateAction.EIyA/nIyo` are version-sensitive. `SetPanelStateInfo.get_SetStateType` `0x0600A464` reads `XSGc`; `get_DiagramId` `0x0600A466` reads Guid `vSGW`; `get_StateValue` `0x0600A468` reads expression `NSG6`. | SetStateType Diagram=0, Next=1, Previous=2, Value=3, Current=4. For Diagram=0 use the explicit `diagram-id` reference, not the simultaneously saved string `state-value="1"`. |
| Set-state extra fields: `loop`, `repeat`, `repeat-interval`, `repeat-skip-first`, `show-when-set`, enter/exit animation/easing/duration, compression | Every listed property has a named getter and separate field in `-SetPanelStateInfo-cil.json`. | The default-presence of these properties is not permission to ignore non-default values. State switching with repeat, animation, or show-when-set needs equivalent runtime support or rejection. |
| `InteractionLinkWindowAction`: `target` ref and `link-type=1`; referenced `InteractionTarget`: `target-type=1`, `target-page-id` tagged page-package ref, `target-literal` expr ref | `IxLinkAction.get_Target` `0x0600A0CF` reads `ENQ5`; `IxTarget.get_TargetType` `0x0600A544` reads `FSBa`; `get_TargetPagePackageId` `0x0600A54B` reads Guid `RSBh`; `get_LinkLiteral` `0x0600A549` reads `oSBX`. | IxTargetType Page=1 plus LinkType Current=1 establishes the observed internal same-window page navigation candidate. Resolve the page **package** identity before mapping the product page ID. |
| `IxWaitAction` | `get_WaitTime` `0x0600A5B3`, signature `200008` (Int32), reads `iSV9`; writer `0x0600A5B9` IL `0063` serializes field; reader `0x0600A5BA` IL `0069–006E` reads/writes it. | Native wait payload is an Int32 property, but no Wait object is present in this pass's tutorial snapshots, and its exact serialized key is unresolved. **Do not invent `wait-time` or accept it solely from this report.** |

Full navigation enums: `LinkType` Invalid=0, Current=1, New=2, Popup=3, Parent=4, Frame=5, ParentFrame=6; `IxTargetType` WebUrl=0, Page=1, ReloadPage=2, BackUrl=3. This does not authorize translating external URL, frame, reload, or back navigation into a local page jump.

### DiagramObjectPath boundary

Direct sample path has `rdo-path=[]`, `repeater-path=[]`, `object-id={ $reference: <id>, referenceTag:22 }`, `is-dummy=false`. The returned path type can be statically identified: `IxDiagramObjectPathsAction.get_DiagramObjectPaths` signature `2000151281A10112AA2C` resolves element TypeDef row 2699, `sJ8l.dJ8s`. `DiagramObjectPathLiteral` refers to this same element type.

The non-empty master/repeater path semantics and dummy/special targets are not proven by merely reading the final object ID. A direct-path importer should reject them. In particular, all-zero `object-id` is observed in a SetCheckState-related path; this pass did not statically establish a universal “zero means This” rule. It must not be converted to source ID for every path type.

## Text-empty conditions

`BinaryExpr.get_Operation` token `0x0600A740`, RVA `0x008358BC`, reads `lStH`. Its signature is `20 00 11 BA 4C`: return type is VALUETYPE; compressed TypeDefOrRef `0x3A4C` selects TypeDef row **3731**, token `0x02000E93`, **Axure.Platform.LogicalComparison**. This namespace correction matters: it is not `Axure.Constants`.

Metadata values: Null=-1, **And=1**, Or=2, Equals=3, **NotEquals=4**, GreaterThan=5, LessThan=6, GreaterThanEqualTo=7, LessThanEqualTo=8. `BinaryExpr.NIwY` `0x0600A748` serializes `get_LeftExpr` (IL `0043`), `get_Operation` (`008E`), and `get_RightExpr` (`00D4`).

Required Fields sample observed structure:

```text
case.Condition -> Expr:BinaryExpr(operation=1)
  left/right -> further BinaryExpr / leaf comparison
leaf BinaryExpr(operation=4)
  left-expr  -> Expr:FCall(function-name="GetWidgetText")
                  args -> Expr:DiagramObjectPathLiteral -> direct path
  right-expr -> Expr:StringLiteral(value="")
```

This corroborates a conjunction of explicit text-not-empty checks. Do not flatten OR to AND, ignore a failed/unknown child, treat operation 1 as equality, or translate arbitrary FCall names into product expressions. Preserve expression operand order and source references. Function spellings in the object snapshot are observations; this pass does not prove the entire native function library or its coercion rules.

The tab sample also has the serialized type spelling `Axure:InterationActionSetFunction` (missing “c” in Interation), with `Expr:FCall(function-name="SetCheckState")`. It is not safe to discard this action while importing another action in the same event and call the resulting interaction fully recovered.

## Password input and project settings

### Password

`PlainTextObject.get_Type` `0x06009497` reads `nNpL`; setter `0x06009498` writes it. Signature `200011B06C` resolves **Axure.DocumentModel.Objects.InputType** (there is a different Win32 `InputType`; use namespace). Writer `0x060094B2` IL `00AC` calls `get_Type` then the integer serializer. `TextBox.NIwY` `0x0600984A` explicitly calls `PlainTextObject.NIwY` before its own MaxLength serialization. Required Fields stores `Type=1` on its password TextBox.

Confirmed InputType values: Text=0, **Password=1**, Email=2, Number=3, Phone=4, Url=5, Search=6; the remaining 7–22 values are retained in mapping JSON. Restoring the password control as an ordinary visible-text input would lose explicit native semantics. Supporting Password does not automatically support every other enum value.

### Global variables

Observed exact sample chain in three retained snapshots:

```text
DesignDocument.GlobalVariableSet -> ref3 GlobalVariableSet
GlobalVariableSet."global-variables" -> array of ref3 GlobalVariable
GlobalVariable: name:string, variable-id:Guid, default-value:string
```

Static corroboration was found through **GlobalVariableLiteral**, since the serialized type names are not the metadata class names:

- `GlobalVariableLiteral.get_LiteralValue` `0x0600A82D` calls `HtZf.dtZ8.Jt4G()` then `mthl.uths.HthA(variableId)`. Its `get_LiteralTextValue` `0x0600A82C` casts to `Lth0.zthm` and calls `oIYX` to obtain the display/name string.
- `dtZ8.Jt4G` `0x0600D0A6` reads field `et4u`. `dtZ8.NIwY` `0x0600D0BD` IL `034A` calls it, wraps it as object reference at `034F`, then writes it at `0354`.
- `uths.NIwY` `0x0600CD64` writes one array and enumerates `PtaS`, wrapping each item in `Jt0X.Kt0a` at IL `00CB`. This matches the sample reference array shape.
- `zthm.NIwY` `0x0600CD51` writes exactly three values: `oIYX` (string, field `gthT`, IL `00D4`), `mIws` (Guid, field `Hthw`, `008F`), `pth4` (string from wrapper `Ythu`, `0049`). The string/name call chain, GUID type, and remaining string are consistent with sample `name`, `variable-id`, `default-value`.

Exact key spellings are sample-observed, not decoded from `sIho`. Empty-name/duplicate-name resolution and malformed or missing defaults are not established native behavior; importer validation must remain strict and preserve strings literally. No variable default expression evaluation is established here.

### Prototype Case Behavior

Samples store `default-prototype-configuration-id` as a tagged package reference to `Axure:HtmlPrototypeGeneratorConfiguration`, whose `link-style` is the exact string **`DisplayMultipleTargetsOnly`**.

Metadata enum `Axure.DocumentModel.Generators.PrototypeLinkStyle`: AlwaysDisplayTargets=0, DisplayMultipleTargetsOnly=1, NeverDisplayTargets=2. A method with that exact return signature, `LSr8.GSrn.fSFf` `0x0600A62F`, reads `qSbS`. Both retained constructors initialize `qSbS=1` at IL `008C–008D`; that is a class-constructor observation, not a complete factory/settings-precedence claim.

Writer `GSrn.NIwY` `0x0600A660` IL `0767` calls `fSFf`, then **`ESbP.DSbi.kSb7`** at `076C`, then string-value construction. The converter `kSb7` `0x0600A67D` uses a three-way switch (IL `00C2`) returning obfuscated strings; inverse `ySb2` `0x0600A67E` compares obfuscated strings and returns 0/1/2. **It does not call Enum.ToString.** Consequently only the observed `DisplayMultipleTargetsOnly` spelling has sample corroboration. The other two metadata enum names are plausible serialized strings but remain unconfirmed spellings in this pass. Root's importer decision to accept only the observed string and report others unsupported is evidence-consistent.

## Implementation boundary and remaining work

Ready for a narrow parser: typed event enum numbers; case description/condition references; explicit grouping flag; shared disabled property; direct-path visibility and current-window internal-page navigation candidates; Diagram state selection by explicit diagram reference; the observed AND/text-not-empty expression tree; Password input; sample-observed global variable/configuration graph.

Still unknown or unsupported: general legacy-version key migrations; all string-table key bindings; universal absent-IsNewIfGroup behavior; nontrivial target paths/This/dummy targets; arbitrary expression functions/coercions; complete action subclasses; Wait key spelling; non-default animation/compression/repeat/navigation options; native interactive rendering/layout behavior; missing/duplicate project-setting semantics; Always/Never serialized configuration spellings. A rejected action must remain visible in an import report; this evidence does not justify silently shortening a behavior chain.

All new artifacts are under `research/`. Raw CIL, official samples, and vendor DLLs must stay outside the product package. Product conversion and runtime verification are owned by the integrating agents and are not claimed by this static-evidence report.
