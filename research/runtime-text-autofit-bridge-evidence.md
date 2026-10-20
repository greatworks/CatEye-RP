# Native AutoFit flags → runtime object bridge

Frozen scope: pinned Axure RP **11.0.0.4150**, `AxureRP11.dll` SHA256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. This is a read-only static metadata/CIL investigation with bounded interpretation of retained instruction records. No original DLL, application, JavaScript or GUI was executed. Only new `research/runtime-text-autofit-bridge-*` files were written. Earlier reports remain unchanged.

## Conclusion

The native-to-runtime bridge is now established by the actual reader, getter and JSON writer, not by matching names. For a generated **TextRectObject**:

```
autoFitWidth  = stored AutoFitWidth  && (effective Transform is null || Transform.ScaleX == 1)
autoFitHeight = stored AutoFitHeight && (effective Transform is null || Transform.ScaleY == 1)
```

The comparisons are exact native Double equality, independently per axis. Negative unit scale is not positive unit scale. Translation and rotation are not consulted by these two getters. They may matter elsewhere; this is not general transform support.

For the already-supported plain VectorShape subset with no effective transform, or a proven identity transform, the imported native width/height flags and generated runtime flags are therefore the same booleans. `Widget.rotation` must not be substituted for the richer native Transform. Prior rotation evidence distinguishes a resolved active transform from a flattened cache's default identity.

The source function `SetWidgetRichText(ids,value,plain)` still has no AutoFit action argument. The two generated object properties above are the flags consumed by `expr.js:469–472`, as recorded in the separate frozen `runtime-text-autofit-plan` report.

## Exact source chain

| Link | Method / token | Evidence |
| --- | --- | --- |
| Stored keys → raw fields | `TextRectObject.oIw4`, **100702406** | Frozen `rp-next-coverage-textrect-cil.json`: decoded `AutoFitHeight` at IL195, map read200, Boolean conversion205, store `mNYN`210; `AutoFitWidth` at88, read93, conversion98, store `GNZZ`103. Width key-presence check at354–364. |
| Stored writer corroboration | `TextRectObject.NIwY`, **100702405** | Decoded `AutoFitHeight` at95→getter101→write111; `AutoFitWidth` at138→getter144→write154. Serialization uses the getters, so a later save can encode their effective results rather than arbitrary raw backing fields. |
| Width getter | `RichTextObject.get_AutoFitWidth`, **100702342** | New width CIL: backing field `GNZZ` IL90; if true, effective-transform query59/158; nonnull transform ScaleX getter163 then comparison with1 at168–179. |
| Height getter | `TextRectObject.get_AutoFitHeight`, **100702366** | New height CIL: backing field `mNYN` IL34; if true, effective-transform query65/102; ScaleY getter107 then comparison with1 at112–123. |
| Effective transform | `KJm7.AJU3`, **100695610** | New transform CIL IL8→`vJOH`, IL13→`jtoq.get_Transform`. It is not direct raw P1401 access. Effective OD/inheritance resolution remains the separately frozen rotation evidence. |
| Scale identity | `bHSN.mHSH`, **100723734**; `QHSI`, **100723736** | New scales CIL returns fields `aHS6`/`EHSD`; frozen `rotation-format-evidence.md` binds these getters to serialized ScaleX/ScaleY. |
| Generated-object type gate | `wJe6.jJeK`, **100694305** | Frozen `line-style-json-friendly-cil.json`: IL3098 source object;3099 `isinst TextRectObject`;3108 branch to3207 on failure. This tail does not test selected/adaptive state, text emptiness, capability bits, or parent container. Earlier unrelated generation can still fail; this is not a whole-generator execution claim. |
| Runtime width key | same | Exact static literal decode at IL3142 = `autoFitWidth`; getter3149; constantfalse3154; Boolean writer3155. |
| Runtime height key | same | Decode at IL3189 = `autoFitHeight`; getter3196; constantfalse3201; Boolean writer3202. |

All nine decoded literals and their resource offsets are retained in `runtime-text-autofit-bridge-literals.json`. The resource interpreter is reused unchanged from the earlier frozen investigation; no target assembly is loaded. Reader `oIw4` gates the height read on version **>=7.0.0.0** (`gbzX`, independently established by the frozen version CIL). This report targets RP11; it does not add support or certify defaults for older packages. The ordinary width path checks presence. Missing/malformed native flags are not made valid by this evidence and should retain existing strict importer rules.

## Omission and default behavior

`EbOh.hbUB` **100690308** does not compare its Boolean value with a default and does not omit false. Its folded path calls property-name writer `TITl(key,arg3)` at63 and Boolean value writer `tITy(value)` at35. The caller's third Boolean is a separate property-writing option, not an AutoFit default. The selected concrete writers confirm this: `cbZ1.TITl`100690407 does not read that option; `cbZ1.tITy`100690413 boxes the Boolean; `KbfF.tITy`100690785 calls `EbOh.tbU9`100690318, whose IL74/106 decode to literal `false`/`true`. Thus both keys are written for the eligible type, even when false. Non-TextRectObject skips both writes at this tail.

The backing fields are Boolean fields and constructors do not assign them true, but that alone is **not** a claim about UI defaults, missing serialized fields, factory code, later load synchronization, or which values a user-created shape receives.

## Type and container boundaries

The new metadata inventory records actual native ancestry:

| Native type | TextRectObject gate | Consequence |
| --- | --- | --- |
| VectorShape, TableCell, ImageBox, SelectionButton | Pass: direct subclasses | Both generated flags use this bridge. This does not prove identical resize behavior across types. Table/cell runtime resize limitations from prior evidence remain applicable. |
| Table, TreeNodeObject | Fail: DiagramObjectContainer branch | Their separate child labels/cells can pass independently. |
| Repeater | Fail: KJm7 branch | The repeater's own fit-to-content is a different mechanism. A VectorShape inside its template still has the same type gate; this tail contains no parent-repeater exclusion. Instance suffix/registration behavior remains runtime handling. |
| TextBox, TextArea | Fail: SelectablePlainTextObject→PlainTextObject→KJm7 | Do not route ordinary form-text mutations into shape AutoFit on the basis of this bridge. |

There is no getter override on the selected relevant subclass metadata. Both defining getters are nonvirtual public special-name methods; `callvirt` here does not establish subclass-dependent replacement.

## Validation and remaining scope

`node research/runtime-text-autofit-bridge-replay.mjs` passes **41/41** bounded static cases:32 Boolean/scale combinations and9 metadata type gates. It interprets the complete two getter bodies, `jJeK` tail IL3098 onward, and `hbUB`; writer sinks capture writes and transform resolution is injected. Negative/NaN scale cases are synthetic branch probes, not admitted sample values. This is not original code execution or generated-page pixel verification.

No fresh corpus census was necessary: the existing four UX heading records have explicit true/true flags and their supported transform boundary was already retained. This bridge resolves their flag identity; it does **not** establish final browser measurements, justify changing saved owner geometry initially, or prove that all generated rich-text structures can share one width-measurement algorithm.

The next implementation can use already-validated native flags for the proven no-transform/identity ordinary VectorShape subset. Keep unknown transforms and unsupported types outside that inference. DOM measurement, resize/move event ordering, hidden cloning, nested containers, rich hyperlink measurement and registration lifecycle remain the separate next-stage work identified in `runtime-text-autofit-plan.md`.

Hashes for original artifacts, retained prerequisites, new evidence and scripts are in `runtime-text-autofit-bridge-manifest.json`; machine-readable conclusions are in `runtime-text-autofit-bridge-evidence.json`.
