# Axure RP 11 Tree widget runtime evidence

This is the prototype **Tree widget**, not the editor's page tree. Findings combine pinned shipped JavaScript, bounded execution of exact original functions in an isolated Edge page, official documentation, and the independent native-format investigation. No original Axure GUI was captured or successfully driven in these probes; this stage did not launch the vendor application or execute a managed DLL. The application had been launched in a prior stage, which does not establish original Tree GUI behavior. Vendor implementation is not copied into product source.

## Identity and reproducibility

- Axure RP **11.0.0.4150**; distribution SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- REA extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Retained runtime: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`.
- `tree.js` SHA-256 `661f7a9e991d0371123e972e63fd7b771589bddc5cd89bec8be6d9ba0ecef453`; `events.js` `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3`; `axQuery.std.js` `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd`; `style.js` `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`.
- Run `node research/scripts/probe-tree-widget-runtime.mjs`. The script verifies all source hashes before running. Full file/slice hashes, browser version, per-probe assertions, network and error counts are in `tree-widget-runtime-probe.json`. `tree-widget-runtime-evidence.json` binds this report, probe and source references.
- The immutable prior table harness supplies exact query/style/event helpers. Its byte hash is verified, and its original frozen report/probe files are not modified.

## Runtime object contract

The native type is `treeNodeObject` for both the `.treeroot` and `.treenode` wrappers (`axQuery.std.js:25,59`). Each non-root node has an independent `buttonShapeId` label/vector and optional expansion image, plus an `id_children` element. The label is not arbitrary child content: official [Trees documentation](https://docs.axure.com/axure-rp/reference/trees/) restricts nodes to text and icons and says all tree aspects are shared across adaptive views.

Keep root, node and label identities distinct. Root/node bounds are wrappers; label owns text, selected paint and normal vector capabilities. Product schema uses `tree {nodes,indent,showExpandIcons,iconStyle,showIcons}` and `treeNode {label,children,expanded,iconSrc?}` with children positioned relative to their parent row. Native stored child coordinates must survive parsing; authoring relayout is a separate operation. Source root default has no own label.

Independent format evidence: native Default root `c12c45f115fa475ca3030ab782caf1f4`, package `90a0737fc2d74911b0b27573a1b35a40`, root `(100,100,95,80)`; one top row and three child rows, all expanded, each row 20 high. Label offsets `(22,0)` with widths 42/53; children indent 20. Both retained expansion images are 9×9; node has explicit icon offset `(6,6)`. See new `tree-widget-format-*` evidence rather than frozen menu/table reports. Product icons are independently drawn SVG, not the source raster assets.

## Initialization, expansion and layout

**Observed static and exact-function probes:**

1. `tree.js:157–165` reads the child container's **inline** `visibility == "hidden"`. Hidden initializes collapsed; otherwise expansion image is selected. The `selectText` argument is unused. A universal default cannot be inferred from this function. The retained real Default sample is expanded.
2. `ExpandNode` (`71–102`) returns for missing/already visible children; otherwise shows children, selects expansion image, computes delta, and adds it to following `.treenode` siblings' CSS top and annotation top. `CollapseNode` (`104–137`) selects image false, measures **before** hiding, then subtracts the same delta.
3. Delta is the recursive sum of each direct child's jQuery content height and its currently visible descendant containers (`139–155`). Explicit gaps, arbitrary non-tree child elements and authored top positions do not contribute. A child node hidden with generic visibility still contributes its jQuery height in the isolated probe.
4. It walks ancestor sibling lists in DOM order. Expansion inside an already collapsed ancestor moves internal following siblings, but stops before altering outer visible sibling positions (`IsNodeVisible:58–69`, `100/135`). When the ancestor opens, delta includes the preserved expanded descendants. Collapse does not reset nested expansion or selection.
5. Neither node row dimensions nor root saved width/height changes. There is no panel-fit call or explicit Show/Hide/Expand/Collapse event dispatch in this path. Image selection can emit ordinary selected events on the image, which is different from a node expansion event.
6. Generic Hide/Show of a node preserves its own branch state and does not compact sibling rows. Generic Move changes local x/y only. Do not implement a continuously normalized flex/flow tree in the prototype runtime; it would erase these authored/delta semantics.

Native action `action.js:2095–2104` resolves `pathToInfo[].treeNodePath`, then calls `.expanded(expandCollapseInfo.expand)`, followed by the next action. Query setter `axQuery.std.js:1268–1297` accepts values loosely equal to `true`/`false` (1/0 work; literal string `"true"` does not). The **getter is defective in this pinned version**: line 1271 negates `IsTreeNodeObject`, so a real node reports false even when children are visible. The product maintains an explicit expanded state and does not claim this getter defect as its internal state contract. `toggleTreeNode` is a product composition of expand/collapse, not a claimed original action name.

## Click, selection, disabled and event routing

- Expansion-image click (`tree.js:168–176`) toggles, calls `SelectTreeNode(node,true)`, then returns false. **No node Click** follows.
- Node click registration is ordered: `events.js:995–1007` binds auto-selection first; `1075–1087` then fires the node custom click and returns false. Label click reaches this node handler. Every node stops click bubbling, even with no cases, false conditions, disabled cases or an empty matched case. It therefore does not fall back to an ancestor node/root like a table cell does.
- `_attachTreeNodeEvent:597–603` registers custom handlers rather than normal DOM handlers. The read/probed path only bridges node `click`; a registered node doubleClick or mouseover does not execute from corresponding DOM events. Synthetic Load/selection paths remain separate. Root initialization returns early for `.treeroot` (`996`).
- `SelectTreeNode:180–187` resolves the separate label. Query selected setter/getter (`axQuery.std.js:1181–1255`) finds the label vector, not the wrapper's flag. SetSelected does not expand the node. SetSelected(root) has no direct label and is a no-op.
- `style.js:186–253`: disabled **label** blocks selection. Node disabled flags do not block custom node Click; the node custom binder has no ordinary disabled guard (`events.js:597–603/628–648`). Even disabled expansion image still toggles children; only the image selected flag is blocked. Direct Enable/Disable on tree wrappers merely writes a DIV property and does not mutate native internal disabled state.
- Native selection is root-scoped despite empty stored selection group. Format CIL `FNiU.QNPC` token100699668 IL009F–00D1 assigns label's `KJm7.BJqr` group from `JNxP(root)+suffix` while generating it; stored group remains empty. `BJqr` token100695270 writes PJZb and paired getter is serialized. Product isolates these implicit peers by root identity and repeater row context; the opaque suffix is not copied.
- Native selected flag is stored on label, but `style.js:230–246` walks contained-object parent before raising events if label has no interaction map. **If the label has an interaction map, events remain on label**, confirmed with an explicit empty-map probe. Product has no separate map-presence bit: empty `interactions` forwards to node, nonempty array stays at label. This representational boundary is explicit.

## Text, supported actions, traversal and lifetime

- `doc.js:545–564` resolves a node's text panel to its contained label; `expr.js:316–385` SetText changes only that label. Query `getWidgetText` aggregates paragraphs under the queried node (`axQuery.std.js:457–482,514–521`), so **GetWidgetText(node) includes its own label and all descendants, even collapsed/hidden**. Root aggregates all labels. This getter/setter asymmetry is confirmed by exact functions.
- Runtime wrapper Resize, Error and Opacity are absent from their type capability lists (`axQuery.std.js:65–104`). Root has no own text panel; product safely treats root SetText as no-op rather than invoking an invalid native panel path. Address independent label to style/change its geometry.
- `events.js:1876–1896` loads wrapper then its `objects` depth-first, including hidden descendants, independent label and icon IDs in original object order. Product preserves root→node→label→child nodes but models expansion graphic as UI, not an independently addressable widget; its own Load/selection event identity is currently unrepresented. Ordinary labels/nodes and hidden branches load normally.
- Source query and initializer preserve repeater row suffix when deriving expansion icon IDs (`axQuery.std.js:1280–1284`, `events.js:1001–1004`). Exact DOM fixture does not simulate native generator row suffixing; product tests independently verify per-row expansion, selection, layout, data-refresh reset, navigation reset and transaction rollback.

## Acceptance and limits

Acceptance: clicking labels selects then runs node actions; clicking expansion only toggles/selects; same-root nodes unselect peers before the new Select; different roots and repeater rows remain isolated; collapse retains nested state; expanding under hidden ancestors changes only internal layout; repeated calls do not drift; root bounds are fixed; SetText changes only label while aggregate getter includes hidden descendants; failed action restores expansion/selection/positions; navigation and repeater refresh restore authored state.

Not established here: original editor capture or full generated HTML pixel comparison; keyboard/ARIA behavior; arbitrary custom static icon offsets/sizes and custom expansion-image implementation; authoring reorder/delete mutation algorithms; full native row selection-isolation settings. Product keyboard buttons and 16×16 static-node-icon placement are explicit accessible/authoring choices, not claims of native geometry. Product 9×9 expansion icons use independently drawn paths at x6 with centered rounded y (default 20px row gives y6). Native unsupported wrapper-event handlers are not broadened into fabricated original events.

## Portable SVG construction correction

The parent full suite caught an existing export-safety contract violated by the first Tree renderer: even a constant SVG markup string must not be parsed through an HTML-string sink. The final offline renderer constructs its SVG, rectangle and path with `createElementNS` and `setAttribute`, then replaces children only when the glyph state changes. No export test was weakened. After this correction, the 12 existing export tests and 55 Tree runtime tests passed (67 total), and TypeScript checks passed. Earlier focused preview/offline screenshots and their 2/2 browser result are explicitly tied to the pre-correction renderer bytes in the manifest; final production browser/package verification is owned by the parent.
