# Layer author resizing: FixedWidth / FixedHeight capability provenance

This is static evidence for Axure RP 11.0.0.4150, not an original application or GUI run. The pinned `AxureRP11.dll` SHA-256 is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

`layer-resize-capability-metadata.ps1` uses framework PEReader and MetadataReader. `layer-resize-capability-extract.ps1` reads CIL and serializes `ldc.i8` operands as decimal strings; JavaScript never rounds the masks through Number. `layer-resize-capability-probe.mjs` uses BigInt, statically folded opaque-flow constants, and bounded CIL-record interpretation. It does not load or execute the target assembly.

The metadata inventory covers all 31 types inheriting `kJm2.KJm7` in this pinned assembly, with their base chains, virtual method flags, property accessors and explicit method implementations. The replay has **64/64 cases**, plus six VectorShape mask-preservation checks. These are source-analysis checks, not product tests.

## The deciding provider and normal branch

`obNM.kbNq` **100686252** calls the virtual `KJm7.get_Capabilities` **100695291**, then the two capability predicates. Thus the concrete virtual override, or its inherited implementation, determines availability. This is not a type-name convention and not a value read from P108/P109.

`Capabilities` TypeDef **33559409** declares:

| Capability | Exact bit | Predicate | Predicate CIL |
|---|---:|---:|---|
| FixedWidth | `0x08000000` | `tHej.uHe6` 100725028 | IL000D constant, IL0018 `Enum.HasFlag` |
| FixedHeight | `0x10000000` | `tHej.fHeD` 100725029 | IL000D constant, IL0018 `Enum.HasFlag` |

The existing frozen `pin-propagation-cil.json` and 192-case `pin-input-probe.json` establish normal `kbNq` behavior:

- An available FixedWidth capability permits the effective provider's P109 boolean; absent capability forces `fixedWidth=true`.
- An available FixedHeight capability permits effective P108; absent capability forces `fixedHeight=true`.
- These capability bits do **not** mean that the object is necessarily fixed. They permit the stored flag to control the normal pin calculation.
- The Control+Alt alternate branch bypasses this normal calculation. It remains separately documented in `.build/next-layer-authoring/README.md`.

P106–P109 defaults and the full style-provider precedence are separate parent-owned research. This report does not substitute capability masks for those values.

## Proven type table

All constant getters below return the quoted Int64 at **IL0007**. A dash means the capability is absent and normal `kbNq` forces the corresponding fixed boolean to true.

| Native type | Getter token | Width | Height | Exact mask / source |
|---|---:|:---:|:---:|---|
| Layer | 100701005 | yes | yes | `0x000020001c000000` |
| DynamicPanel | 100700477 | yes | yes | `0x000020001c000000` |
| VectorShape | 100702674 | yes | yes | All reachable mask transformations preserve both bits; see below |
| TextBox | 100702275 | yes | yes | `0x3546fc3fbfde1b9f` |
| TextArea | 100702246 | yes | yes | `0x3546fc3fbfde1b9f` |
| Button | 100699769 | yes | yes | `0x0002ec003fde1b9f` |
| SelectionButton | 100702019 | yes | — | `0x37d9e47fefde7fbf` |
| Checkbox | 100699783 | yes | — | `0x37d9ec7fefde7fbf` |
| RadioButton | inherited 100702019 | yes | — | No own override; SelectionButton in metadata base chain |
| ImageBox | 100700750 | yes | yes | `0x75e56dffff1e7ebf` |
| ImageMapRegion | 100700843 | yes | yes | `0x000021001c000000` |
| InlineFrame | 100700875 | yes | yes | `0x000020001c000000` |
| Repeater | 100701628 | — | — | `0x0000200004000000` |
| Connector | 100699902 | — | — | `0x00002000023e1a9f` |
| Table | 100702103 | yes | yes | `0x05c120bbfece7fbf` |
| TableCell | 100702217 | — | — | `0x05c100bbe2ce7fbf` |
| MenuObject | 100701228 | yes | yes | `0x000020001fc60100` |
| TreeNodeObject root | 100702552 | — | — | IL0044 `0x000120bb87de019f` |
| TreeNodeObject non-root | 100702552 | — | — | IL003A `0x000100bb83de019f` |
| ListObject | 100701171 | yes | yes | `0x3146ec3fbfde199f` |
| ComboBox / ListBox | inherited 100701171 | yes | yes | Neither has an own override |
| PlainTextObject | 100701327 | yes | yes | `0x3146ec3fbfde1b9f` |
| SelectablePlainTextObject | 100701383 | yes | yes | `0x3146ec3fbfde1b9f` |
| InlineLink | 100700926 | — | — | `0x04c00001800800bf` |
| ReferenceDiagramObject | 100701407 | — | — | `0x0800200004000000` |
| Screenshot | 100701918 | yes | yes | IsMaster branches IL0065 / IL0078, both bits set |
| KJm7 | 100695291 | — | — | IL0007 zero, IL0008 conv.i8, IL0009 ret |
| DiagramObjectContainer / RichTextObject / TextRectObject / LegacyRichTextPanel | inherited 100695291 | — | — | No own override in the complete metadata inventory |

The JSON contains exact full masks for Screenshot and every other row, method attributes, type tokens, all inherited chains, executed instruction offsets and source hashes.

The two TreeNode paths are selected by `get_IsTreeRoot` **100702502**, called at getter IL004F. This report covers both values rather than inferring a generic Tree capability. A tree's separate VectorShape text label remains a VectorShape; it must not inherit the node's capability classification.

Likewise a line represented by native VectorShape is not automatically a native Connector. Product model aliases must follow known import/native identity.

## VectorShape and side effects

The VectorShape getter starts with mask `0xf5ddedffffde7fbf` at **IL024F**, which contains both bits. Shape/context branches can change the full capability value, but none changes these two bits:

| CIL operation | Operand | Why the two bits survive |
|---|---|---|
| IL009B / IL00FC `tHej.Remove` | `0x0004080000000000` | Operand contains neither fixed bit |
| IL00DA AND | `0x7fffffffffffffff` | Contains both fixed bits |
| IL015F OR | `0x0000000000200000` | Adds an unrelated bit |
| IL02B7 OR | `0x0002000000000000` | Adds an unrelated bit |

`Remove` **100725036**, IL0007–000B is `arg0 & ~arg1`. The branch replay exercises Shape partitions `-1,0,1,10,29,30,300,301`, both outcomes of `DSO4`, and both outcomes of `oNnF`. Those context predicates are supplied boolean sinks; their complete semantic definitions are not claimed by this report. The bit-preservation proof does not depend on their values.

`KJm7.vJml` **100695292** receives the mask by value and returns void (`20010111C0004DC4`). It can propagate capabilities to the object's style and entries in its adaptive-style dictionary, but does not replace the caller's mask. Its downstream `WtTU.LtwL` **100717143**, IL0021–0023 stores the passed argument into `WtTU.MtwY` **67132852**. This direction is widget capability → style capability; it is not a style override returning a different widget capability. Full reentrant callbacks/exceptions from unrelated object context are outside this bounded analysis.

## Integration implications and limits

The default normal solver input must resolve stored pins/fixed flags first, then apply the actual object's capability gate. In particular, a repeater or tree node cannot be treated like a Layer merely because both have descendants, and SelectionButton height cannot be treated like TextBox height.

Capability proof alone does not authorize a final resize result. The author controller has separate locks, child-tree traversal, selection-button/vector/image/panel special handling and AutoFit/FitToContent paths. Those are still governed by the controller/solver evidence and cannot be inferred from this table.

No original GUI interaction, native DLL execution, product source mutation or full test suite occurred for this report. Current `.rea` model types do not retain every native class distinction; future author capability mapping needs an explicit, evidence-backed policy for those aliases. Pin storage defaults/inheritance, native importer handling and the numeric resize solver remain separate work.
