# Axure RP 11 table / tableCell runtime evidence

Frozen runtime research, 2026-10-14 (Asia/Shanghai). Scope: shipped JavaScript from the retained Axure RP **11.0.0.4150** extraction, current official table documentation, and isolated exact-original-function probes. No original application / GUI launch, proprietary DLL execution, product source change, browser server, or full production suite.

## Identity and method

- Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Retained extraction Evidence ID: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Managed DLL SHA-256 (format agent's independent static work): `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Source root: `C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\DefaultSettings\Prototype_Files\resources\scripts\axure`.
- `scripts/probe-table-runtime.mjs` verifies nine source-file digests before extracting narrow original function ranges. `table-runtime-probe.json` records files, range hashes, results and limitations. **42 / 42 passed**, Edge **155.0.4283.45**, shipped jQuery, **0 network requests / 0 page errors**.
- The probe creates an explicit four-cell absolutely positioned DIV fixture. It executes original dispatch, type gates, DOM setters, selection flags and text functions; it stubs image/text painting, autofit, geometry-cache bookkeeping, path lookup and the synthetic-event sink. This is a controlled runtime observation, **not** generated-table DOM or pixel evidence.

## Proposed model and implementation contract

Use a table with row/column tracks plus independent `tableCell` widget children. Every cell needs its own identity, name, rich/plain text, notes, style, interaction definitions and action/condition addressing. Track order and native object/event order are distinct: do not silently derive all event order from row-major storage if preserving imported native ordering is required.

| Operation | Shipped-runtime observation | Product implication |
| --- | --- | --- |
| Resize table / cell | Both are absent from `RESIZABLE_TYPES`; function exits before CSS mutation, but advances completion/queue. | Runtime Resize should be a no-op for both. Author-side track resizing is a different operation. |
| Move table | Generic move changes table CSS; descendant local coordinates are unchanged. Only table `onMove` is emitted by this function. | Move the container; do not rewrite every cell's local position or emit child move events. |
| Move cell | Generic move changes that cell only; no row/column reflow. MoveTo uses local CSS left/top. | Keep transient cell position overrides separate from authored tracks. |
| Cell SetText | Rich-text target lookup resolves that cell's `.text`; sibling text stays unchanged. | Reuse independent rich/plain cell text paths. |
| Table SetText | Table does not support rich text, so `GetTextPanelId(table)` returns empty. | Do not invent whole-table SetText fan-out. |
| Cell selected | Public selected getter/setter support cell; ordinary selection-group logic applies. | Independent selected flag/style/event and group membership. |
| Table/cell Set Error | Public error setter supports neither type and performs no recursion; getter is undefined. | No error flag/event propagation through this action. |
| Table selected | Public setter has no table branch, therefore no selection change or child recursion. | Do not inherit panel selected propagation. |
| Enable / disable table or cell | Setter writes `DIV.disabled`, but calls neither `SetWidgetEnabled` nor recursion. Runtime disabled map stays false; public enabled getter stays true; click continues. | Semantically no effective disabling through this action, not a cascading disabled container. |
| Hide cell | Hides its DOM box; neighboring positions and table bounds stay fixed. | No grid collapse / track shrinking. |
| Hide table | Parent display hides cells without rewriting their inline hidden state. | Parent visibility blocks interaction; show restores the prior cell states. |
| Click / doubleClick cell | DOM bubbles, but a matching case (even empty) marks event handled, suppressing ancestor logical cases. No case / false condition / disabled case permits parent handling. | Distinguish DOM propagation from action dispatch. |
| Synthetic table traversal | Root is dispatched, then entries in `object.objects` order; cell script paths share the surrounding container prefix. | Table Loaded followed by its native child order; avoid accidental duplicate generic child dispatch. |

The enabled observation is deliberately narrow: direct internal `SetWidgetEnabled(cell,false)` can set its disabled map, but the ordinary public enabled action path does not call it. Our explicit test injecting a disabled map value suppresses only that cell's handler and allows the parent handler. This does not prove the native editor can author a disabled cell by that internal route.

## Exact original references

### Types, text and identity

- `axQuery.std.js:6,26,38,60`: distinct `table` / `tableCell` runtime type constants and predicates.
- `axQuery.std.js:63`: table is recognized as a container by this predicate; tableCell is not. This predicate does **not** imply panel-equivalent behavior in other APIs.
- `axQuery.std.js:95–104`: rich-text capability includes tableCell, excludes table.
- `doc.js:12–33`: nested `objects` have the table as their object parent; lookup identity remains `packageId~id`.
- `doc.js:545–564`: `GetTextPanelId` first rejects types without rich-text support; otherwise selects the first `.text` below the button shape, creating one only if requested.
- `expr.js:316–385`: SetWidgetRichText uses the resolved text panel. Plain single-span/single-line updates reuse the span; complex plain updates replace rich content and retain first-span formatting; rich HTML replaces content and recaches it. These are the same shared text functions already evidenced for ordinary shapes.
- `axQuery.std.js:883–924`: GetWidgetText on a DIV scans descendant `.text` containers, then their paragraph/list children. The isolated table getter concatenates all descendant cell texts with newlines in **DOM order**, not a tab-delimited table matrix. Moving DOM order `a,b,c,d` to `a,c,b,d` changes this aggregate order. Native editor eligibility for selecting a whole table in text conditions is not proved by this getter.

### Geometry

- `axQuery.std.js:75–81`: table and cell are excluded from runtime resizable types.
- `axQuery.std.js:570–593`: resize captures the old bounding rectangle, records the resizing rectangle, tests the type, calls completion/queue advancement, then continues. It never reaches width/height mutation for either table type. Both full-function no-op probes passed.
- `axQuery.std.js:457–482,514–539`: move has a special Layer route; all other types use the common MoveWidget route. Non-Layer MoveTo calculates delta from CSS left/top, not a newly derived grid position.
- `move.js:7–64,84–108,120–208`: PrepareForMove derives deltas; MoveWidget invokes movement and then emits only the addressed object's `onMove` (only Layer takes the explicit descendant path). Nonanimated movement mutates CSS immediately. Four exact-original probes cover table/cell MoveBy and MoveTo.
- Rotation, animated resize/move, table editor redistribution rounding, and generator border geometry were not experimentally covered.

### Selected, disabled and visibility

- `axQuery.std.js:1181–1255`: tableCell is in selected getter/setter branches, table is absent.
- `style.js:186–253`: selected setter checks that object's disabled state, clears selection-group peers first, performs panel/Layer recursion only for those types, sets `_selectedWidgets[id]`, and emits selected events only for a changed value. Cell probes show isolated flags, same-value event suppression and peer-false before target-true ordering. Paint functions are stubs here; previous selected-style evidence supplies the shared paint contract.
- `axQuery.std.js:1087–1137`: table/cell do not get `SetWidgetEnabled`; only panel/Layer recurse. Generic DOM property writes still occur at 1131–1132. Our DIV fixture shows that property is inert for click dispatch and is not detected by the `children(':disabled')` getter.
- `axQuery.std.js:1145–1178`: error getter gates on SupportsErrorStyle; setter calls only supported shape/form types or panel/Layer recursion. Table/cell do not reach either branch; both exact-original no-op probes passed.
- `style.js:322–324`: disabled lookup reads only `_disabledWidgets[id]`, not ancestor DOM disabled properties.
- `visibility.js:15–53`: low-level hiding sets `display:none; visibility:hidden`; showing restores display and `visibility:inherit`. Table hiding naturally removes descendant boxes from layout/rendering. Hiding one cell does not alter sibling geometry.
- `visibility.js:1288–1304`: adaptive visibility reconciliation explicitly skips tableCell (and contained widgets). This reinforces that adaptive behavior must not be inferred from generic widget support.

### Event propagation, initialization and focus

- `events.js:154–185`: ordinary interaction maps attach independently to each widget; table is not a special bubbling exception in this binding.
- `events.js:605–618`: default object handler checks the **addressed object's** runtime disabled flag; a skipped ordinary object returns true, allowing DOM propagation.
- `events.js:281–415`, especially 323–324, 370, 401–408: already-handled original browser events are ignored by ancestor handlers; invisible boxes are rejected; a matched case marks the original event handled except the explicitly allowed bubbling event types.
- `events.js:201–202`: Focus, Resize, MouseOut and MouseOver are allowed-bubble types. Five additional double-click case probes establish the same handled/fallback semantics as click. The probes do not establish exact mouseenter ordering across nested table/cell surfaces.
- `events.js:1876–1896`: table/menu/tree traversal dispatches table first, then `objects` in array order. The cell replaces the final object component in the script path; it does not add a table path level. Probe trace for prefix `master` is `master/table`, `master/a`, `master/c`, `master/b`, `master/d` when that is the native object order.
- `events.js:1930–1975`: Page/container event traversal chooses this specialized traversal for table/menu/tree. The synthetic sink is a stub in our probe; ordering/path construction are directly observed, full Page Loaded execution is not.
- `events.js:113–123,759–784` plus `axQuery.js:95`: tableCell is treated as image-focusable. Focus/blur use its `_img` or `_div` child, with optional tabbable setup and focused-state calls. Exact generated tag/tabIndex and native keyboard table navigation remain unknown.

## Official authoring scope (documentary, not GUI observation)

The official [Table widgets documentation](https://docs.axure.com/axure-rp/reference/tables/) describes independent cell events, names and text targets. Authors edit cell text, insert/delete/reorder rows and columns, resize tracks through borders or cell W/H, and paste tabular data. Pasting into an existing table does not expand its dimensions. It explicitly excludes merged cells, images inside cells, dynamic browser row add/delete/sort/filter, and adaptive table variations; it suggests separate table copies or repeaters for those needs. The page also suggests a rectangle overlay for whole-row rollover styling.

Those statements concern authoring and supported features. They do not override the shipped runtime's narrower Resize / Enable / Select target gates. Current documentation was read on 2026-10-14 and may describe a newer release than the pinned 11.0.0.4150 artifact.

## Format collaboration and unresolved rendering boundaries

Independent format findings are recorded in `table-format-census.json` and `table-format-analysis.json`: the retained corpus has three tables and fifteen cells in Default.rplib. Matrix references are row-major while a 3×3 **RP stored** `diagram-objects` array is column-major; tracks have 100-wide columns / 30-high rows in those examples. The independent generator CIL closes the mapping from that object enumeration to exported JavaScript `objects`, as detailed below. The runtime traversal must use native object order where exact imported lifecycle order matters. These sample numbers are not asserted universal defaults.

The following remain **unknown**, not guessed:

1. Exact generated table/cell tag/class structure, table paint images/SVG and shared-edge clipping. The probe's DIV tree is a tested analogue, not captured generated HTML. A 1-pixel source stroke does not by itself prove a 1-pixel rather than 2-pixel visible interior seam.
2. Whether editing whole-Table.style in the native editor copies properties into cells, and the exact scope of multi-cell style application.
3. Initial disabled/selected cell authoring/generator options, unsupported targets in native action pickers, exact native table adaptive/style authoring warnings.
4. Fractional track resizing, table selection handles, keyboard navigation, clipboard formats beyond official descriptions, runtime animation/rotation and original full-GUI visual parity.

Do not add dynamic grid mutation, merged cells, blanket disabled propagation, table-level text fan-out, or CSS border-collapse claims as native behavior based on this evidence.

## Addendum: generator order and whole-table text (2026-10-14)

### Exported object order is the original container enumeration

Independently read the format agent's static `table-format-json-dispatch-cil.json`, bound to DLL SHA-256 above. No managed code execution:

- `sJeD.wJe6.jJeK`, token **100694305**: IL `07A3` casts to `IDiagramObjectContainer`; `07B4` reads `get_DiagramObjects`; `07C1` recognizes Table and branches past inline-link concatenation; `07F4` supplies false and `07F5` calls FJem.
- `sJeD.wJe6.FJem`, token **100694317**: IL `0031–0038` takes its original sequence when the boolean is false, bypassing the alternative transformation; `0065` calls GetEnumerator; `0078` recursively writes each object with jJeK; `007E` advances with MoveNext.
- Combined with `events.js:1876–1896`, this preserves the container object enumeration for table/cell event traversal. It is not reconstructed from the row-major matrix. The sampled 3×3 table's stored column-major object order therefore matters.
- Product `TableData.cellOrder?:string[]` preserves the explicit sequence while `cells` stays a row-major matrix. Missing cellOrder falls back to that authored storage order; this default is a product compatibility choice, not proof of original new-table defaults.
- Exact original editor insertion/deletion/reordering effects on DiagramObjects, and defaults for every new-table creation route, remain unknown. Do not infer those mutation rules from the three stored examples.

### Exact whole-table GetWidgetText projection

The nine added probes use original `expr.js:586–590` GetWidgetText through `axQuery.std.js:840–881` public text getter and `883–924` underlying text extraction. Placeholder activity is explicitly stubbed false for these non-form table fixtures.

1. All descendant `.text` containers contribute their direct p/ul/ol blocks in DOM order; one LF separates each block globally. Empty blocks still count for separation. Empty cells represented by one ordinary empty paragraph therefore keep their slot: `['', 'b', '', '']` becomes `'\nb\n\n'` and four empty cells become three LFs.
2. Hidden cells and even a hidden table still contribute their text. This is DOM text extraction, not visible-label extraction.
3. A cell with two paragraphs contributes two blocks. A line break inside its span also becomes LF; it does not introduce an extra cell separator. A solo BR paragraph contributes only its position's separator. `&nbsp;` is converted to an ordinary space before text extraction.
4. A `.text` container with **no paragraph/list block at all** contributes zero blocks, unlike an empty paragraph. The product structured-text schema's ordinary empty cell maps to an empty paragraph; arbitrary missing-container DOM is not a document feature.
5. Clearing one cell through plain SetWidgetRichText hides its text panel and leaves an empty paragraph; the aggregate still contains the corresponding empty slot.
6. A whole table is **not** a rich-text setter target. Original GetTextPanelId returns empty, then direct SetWidgetRichText reaches SetVisible(null) and throws TypeError before any cell mutation. The reconstruction's early safe no-op for unsupported Table SetText is explicitly a product boundary, not an observed native no-op or fan-out operation.

### Reconstruction verification (separate from native evidence)

`tests/table-runtime.test.ts`: **75 / 75** focused Vitest cases passed on the current implementation (module + serialized runtime plus snapshot helper). Includes explicit cellOrder roundtrip/load/row instances; all default runtime gates; logical click/doubleClick fallback including an injected internal disabled-cell flag; exact aggregate empty/hidden/rich/row values; and the explicitly chosen unsupported-Table-SetText no-op. Only this focused test file was run; no product source was changed by this research agent. Renderer DOM ordering is outside these unit assertions and remains assigned to parent-owned browser checks.
