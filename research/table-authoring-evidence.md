# Table authoring: source audit and proposed integration

Recorded 2026-10-14. Read-only product review; no native application launched, no GUI capture retried, no product code changed, and no browser/test suite run. The original GUI `FrameArrived` failure remains unresolved. This document separates official public behavior, observed repository structure, and proposed implementation choices. Native storage/defaults/runtime details belong to the sibling evidence work and are not inferred here.

## Primary documentation

Source: [Axure RP Table widgets](https://docs.axure.com/axure-rp/reference/tables/), inspected on 2026-10-14.

The documentation supports double-click/Enter cell text editing; spreadsheet paste into existing cells without growing the grid; row/column insertion, deletion, reordering and border resizing; cell W/H changing the corresponding column/row; multi-cell selection; individually named cell events and interaction/condition targets. It excludes images inside cells, merged cells, dynamic browser row operations, and adaptive-view differences. It describes separate rectangle overlays or repeaters for those workarounds. Grey row controls support whole-row selection and modifier-based multi-row selection.

These are public capability statements, not evidence of exact hit-testing, default dimensions, keyboard routing, serialization, border arithmetic, clipboard quoting, event order, or native GUI pixel layout.

## Current source: exact integration points

There are no separate `Library.tsx`, `Outline.tsx`, or general `Canvas.tsx` files. All three surfaces are currently embedded in `src/App.tsx`.

| Area | Current entry point | Consequence for tables |
|---|---|---|
| Creation | `src/App.tsx:26` LIBRARY, `:120` addWidget, `:198` library, `:200` canvas drop, `:206` quick insert | One Table library entry can reuse drag, double-click, selected-tool creation and quick insert. Actual default grid/geometry must come from the agreed model factory. |
| Container scope | `src/App.tsx:62` pageWidgets/panel lookup, `:65` widgets/current, `:79` changeWidgets, `:165` double-click | Current editable scope is a page list, panel active-state list, or repeater template list. A table should remain inline on this canvas; its cells are constrained grid members, not another freely laid-out panel scope. |
| Selection/current | `src/App.tsx:40` selected array; `:65` current is `widgets.find(selected[0])` | A nested cell cannot currently become Inspector current. Replacing current alone is insufficient because mutations still map only the visible root list. |
| Patch/history | `src/App.tsx:78` commit; `:98` patchSelected | Ordinary patches broadcast across selected widgets. Table structure must be owner-only; cell patches must route by selected cell IDs. Existing form/select/path type restrictions are a useful precedent. Explicit rich typography patches must still reach `patchWidgetTextStyle`. |
| Pointer geometry | `src/App.tsx:156` startDrag; `:159` pointerMove; `:160` pointerUp; `:161` pointerCancel | Move/resize assumes every selected object has independent x/y/w/h, rounds to integers, clamps to 8, and commits one history entry only after a changed gesture. Grid-axis drags need a separate gesture branch/helper. Cancel must restore the original whole document. |
| Keyboard | `src/App.tsx:168` global keydown | It currently moves selected widgets with arrows, deletes them, clones them, and takes over Ctrl+V. Active cell mode must intercept those paths before they reach free-widget commands; active text editing already owns keyboard events. |
| Clipboard | `src/App.tsx:121–124` remove/copy/paste/duplicate | Clipboard is an in-memory `Widget[]`, not native clipboard text. App has no grid-aware paste event. Whole-table copying can reuse cloneWidgets after recursion support; cells cannot be pasted as free root widgets. |
| Align/order/group | `src/App.tsx:125–131` | These operate directly on the current free-widget array. They must address the table owner or be unavailable during cell selection; applying them to cells breaks grid invariants. |
| Formatted editing | `src/App.tsx:91–96`, `:201`; `src/components/RichTextEditor.tsx:213–249` | Rich editor already supports safe model selection, IME, text/plain paste, local undo, outside-commit, Cancel and hyperlinks. It is mounted only for a root rendered widget. A table renderer needs a per-cell text-editor slot and apply must update the selected nested cell. |
| Selection frames | `src/App.tsx:202` | Generic per-widget frames include eight independent resizing handles. Render one table frame plus cell selection overlays/axis handles instead; do not place ordinary handles around each cell. |
| Outline | `src/App.tsx:197` | Flat reverse-z-order visible roots only, single click selection, root hide/lock toggles. It does not currently expose nested cells. A table branch can expose its rows/cells without pretending every row is a persistent widget. |
| Inspector fields | `src/components/Inspector.tsx:525–561`, `:603–615` | Generic X/Y/W/H/Rotate and ordinary Text/Style/Notes/Interactions exist. Cell X/Y should be read-only derived values; W/H must invoke row/column helpers. Cell text/typography/effects/notes/interactions can reuse current editors once patched through the table owner. |
| Interaction selectors | `src/components/Inspector.tsx:58–66`, `:70–81`, `:306–308`, `:368` | collectWidgets and resizeItem source-scope lookup recurse only panel states/repeater templates. Both need the cell child path, with labels such as `Table / Row 2 / Cell name`. No table-specific runtime row actions should be added. |
| Static rendering | `src/components/WidgetView.tsx:76`, `:138–145` | WidgetContent supports a single textEditor and recursively displays panels/templates. A TableContent branch must calculate/consume cell geometry, delegate each cell text leaf, and opt into editor callbacks only in author mode. Gallery/static/player remain passive unless callbacks are supplied. |
| Tree identity | `src/model/document.ts:199–260`, `:283–344`; `src/model/components.ts:33–37` | map/find/update/delete, identity collection, remapping, component materialization and publish all need cell traversal. Otherwise links, cases/actions, conditions and external target pickers become incomplete even if pixels render. Parent owns these changes. |
| Adaptive routing | `src/model/adaptive.ts:34–42`, `:104–142`; `src/App.tsx:79–85`, `:201` | Existing generic logic diffs every widget's geometry/style into local overrides. Table/shared-cell edits must follow the agreed non-adaptive table contract. App-only disabling is insufficient: parser/API/import/runtime must agree. Parent owns the model rule. |

Line numbers identify the audited snapshot and may shift as other work lands. Hashes:

```
src/App.tsx E584B374E80846EC639D594D046ECEF59479C0695108A15AF0E7C1DC89A36079
src/components/Inspector.tsx 6CF5F5A258B1981C8BAF3BD052F1BF3306CAA87D40A6524E9D5F99742954C105
src/components/WidgetView.tsx 182145F7F3E5741E3105CBF92A2B791C22A7013C8C7790B427A3E2915AC72729
src/model/adaptive.ts 94406F79012AFF54808C8E6B9AD10DC42AA1F0CB4393C7316BFCD208A965DB96
```

## Recommended minimum coherent architecture

This is an implementation proposal pending the parent model contract, not a claim about original editor internals.

1. Use a real table owner and rectangular cell matrix with stable cell IDs. Store row/column dimensions once; expose resolved cell geometry through a helper. Whether cells are constrained Widget records or a smaller record with a Widget projection is a model decision. Either way, individual cells require ordinary text/richText/style/interaction identity and must participate in the global reference graph. Do not duplicate independent editable geometry as a second authority.
2. Keep root-widget selection and grid-cell selection separate. Suggested ephemeral state: `{tableId, cellIds, anchorCellId?}`. Only one table grid is active at a time; ordinary selected root IDs can remain the owner. Resolve `inspectorWidget` from a selected cell when cell mode is active, otherwise the existing `current`. Use current-cell-only name/interactions edits unless explicit multi-cell behavior is chosen; allow deliberate multi-cell formatting.
3. Route edits through `patchTableCells(owner, cellIds, patch, explicitTextStyle?)` and structural helpers. Width/height patches deduplicate affected column/row indices. An entire operation creates one document transaction; invalid/no-op edits preserve object identity. Structural changes retain surviving cell IDs and prune selection IDs that no longer exist.
4. Keep table-level move/rotation/outer resize separate from cell gestures. Whole-table resize distribution, minimum sizes and fractional dimensions need confirmed model semantics. Row/column boundary handles use pointer capture, inverse table rotation plus canvas zoom, an original snapshot, final commit and pointercancel rollback. Reuse the no-op/history safeguards from ordinary drag, not its arbitrary per-widget size mutation.
5. Suggested new local components: `TableContent` (shared cell presentation slots), `TableCanvasControls` (cell selection/headers/boundaries), and `TableInspector` (structure and axis controls). App owns selection and transactions. Inspector receives an optional table context to customize layout and add structural operations; its existing text/interaction editors remain reusable.
6. Extend WidgetContent with optional editor-only cell callbacks/render slots, e.g. `onCellPointerDown(cellId,event)`, `onCellDoubleClick(cellId,event)`, `renderCellTextEditor(cellId)`. Stop cell pointer propagation before parent startDrag. Do not run player cell interactions on the editing canvas. A runtime cell renderer can later consume the same geometry/model without depending on author selection state.
7. Add cells to the general widget traversal APIs once, then reuse those APIs in Inspector target lists, App rich editor lookup, runtime lookup and component identity remapping. Outline should show owner→row→cell presentation entries, preserve owner z-order, and synchronize current cell selection. Row header identities can be ephemeral indices unless the model needs stable row identities for reordering.

## Proposed user workflow and transaction ownership

- Insert Table from Library; select the owner from its frame/Outline. A dedicated cell selection affordance enters grid mode without navigating to a blank container canvas. The exact first-click/second-click rule is an explicit product decision until native GUI evidence is available.
- Cell mode displays a clear current-cell marker and selected-cell set. Row/column headers and cell drag-selection operate within one owner. Inspector shows cell identity and structural context; Enter/double-click mounts the existing inline RichTextEditor inside that cell. Its Done/outside commit updates one cell and one document undo step; Cancel restores the cell draft.
- Explicit structure buttons/context items insert/delete/reorder axes. They must not fall through to generic `removeSelected`/`arrange`. Last-row/last-column deletion behavior needs the final model contract; reject an invalid empty grid atomically rather than leaving missing cells. Delete-key text clearing versus structural deletion also requires an explicit contract.
- For selected cells, ordinary font/fill/border commands apply intentional patches to those cells; rich run formatting uses the existing helper. Multi-cell mixed values should not overwrite unrelated fields by copying one complete source style. Table-only fields must never broadcast to an unrelated selected input/shape.
- Clipboard dispatch has three owners: active rich editor keeps its current text-only paste; active grid consumes tabular clipboard text into cell text replacements; otherwise whole widgets use the existing app clipboard. Native clipboard event data is preferable to async clipboard-read permissions. Offer an explicit canvas Paste as table entry only with a bounded parser/model factory. Clipboard quoting/embedded newlines and copying a partial grid with styles require separate scope decisions; do not pretend internal Widget[] paste handles them.
- Leaving a cell editor for another cell/row operation must commit via the existing capture-phase outside handler before the next transaction reads docRef. Page/tool/undo changes clear only ephemeral grid selection and active gesture state; no stale cell IDs should survive document reload, owner deletion or component republish.

## Required model interfaces to settle before UI implementation

- Creation/default row count, column count, dimensions, styles and names.
- Exact table/cell carrier types and global ID traversal policy.
- Read helpers returning `{cell,row,column,x,y,width,height}` and a table owner lookup for a cell ID.
- Pure patch, insert/delete/reorder-axis, and axis/outer resize helpers; numeric limits and no-op behavior.
- Non-adaptive semantics including existing/manual override rejection, table placement visibility, and nested-table behavior inside panels/repeaters/components.
- Supported cell actions/effects versus owner actions, plus runtime geometry effects when targeting a cell or owner.
- Delete/cut/copy/paste policies for cells and rows; clipboard bounds and rich/plain text replacement policy.

## Focused acceptance plan after implementation

1. Real Library creation → cell inline editing with mixed style/link → another cell → save/reopen. Assert no uncommitted editor draft, stable grid shape and IDs.
2. Insert above/below/left/right, delete and reorder with asymmetric dimensions; assert surviving IDs/content/targets remain attached to the same cells. One Undo restores each complete structural step.
3. Row/column handle drag at zoom and rotation; no-op click and drag-return consume no history; pointercancel/held-drag Undo restore geometry exactly. Check cell W/H updates the appropriate axes and leaves unrelated axes unchanged.
4. Multi-cell style changes and same-command normal/false resets on rich runs; mixed root-widget/table selection does not stamp structural fields onto non-tables. No generic arrow/arrange/delete path can corrupt the matrix.
5. Native text/plain clipboard event routing: rich editor remains text editing; grid changes bounded cells; whole-table copy/paste remaps cell/link/case/action IDs and internal conditions without touching external page/variable references.
6. Per-cell event targets another cell and an outside widget; an outside event changes one cell; preview and offline agree after save/reopen. Clicks used for author selection do not execute interactions.
7. Table within panel state/repeater template/component. Selecting/editing/referencing a cell works at depth; component publish propagates text/structure while instances retain independent placement and stable IDs.
8. Adaptive view editing follows the decided shared table policy and never leaves a stale dimensions/style override. Import/model roundtrip preserves original data rather than synthesizing unsupported native behavior.

Existing focused test conventions are in `tests/e2e/editor.spec.ts`, `tests/e2e/rich-text-inline.spec.ts`, `tests/e2e/rich-text-link-authoring.spec.ts`, and `tests/components.test.ts`. These were inspected, not executed during this review.

## Explicit unknowns

Original mouse selection routing, default grid sizing, axis redistribution, outer resize behavior, cell Delete/Cut semantics, row/column drag reorder insertion rule, clipboard quoting, last-axis deletion, exact grid border overlap/pixel rounding, row/cell hover event order, cell focus accessibility, and native table adaptive visibility exceptions remain unproven here. Do not derive them from arbitrary CSS table defaults or reuse repeater runtime behavior. Native parser/runtime agents should settle relevant points before parity claims.

## Implemented authoring contract (2026-10-14 follow-up)

The source review above describes the pre-table snapshot. The implemented author surface now keeps a table on its existing canvas. `TableSelection` separately stores selected cell IDs, range anchor, and focused endpoint; cell drag forms a rectangular range, modifier clicks toggle individual cells, and repeated Shift+arrow expands/contracts from a stable anchor. Ordinary arrows/Tab navigate cells without moving their stored geometry. Delete/Cut clears text; structural deletion is an explicit row/column command. These keyboard and clipboard policies are product contracts, not observed native GUI algorithms.

A corner owner handle selects or drags the whole table. Whole-table dimensions use the model proportional resize helper, while cell W/H modifies their unique columns/rows. Header dragging and explicit controls reorder tracks with their existing cells/IDs. Boundary gestures account for zoom and rotation, use one undo transaction, and restore the original snapshot on cancellation or a return to the starting point. The owner does not offer an editable root caption. Individual cells mount the existing in-place rich text editor and reuse interactions/effects editors.

**Apply style to all cells** explicitly selects every cell for deliberate formatting. The transparent, borderless owner is preserved; mixed root selections do not stamp paint onto it or bypass track geometry. This explicit command is the current authoring design and is not claimed to reproduce an unobserved original whole-table selection algorithm. Named cell interactions and notes are edited on the focused cell; selected-cell geometry/style operations apply to all selected cells. Table/cell structure, text, and formatting stay shared across adaptive views.

Pasting TSV in cell mode fills existing bounds; the Paste as table dialog creates a separate rectangular table. Quoted tabs/newlines are supported by the parent model parser. Text clipboard events do not intercept an active rich text editor or form input. Native table runtime movement/selection/error/enable and pixel border semantics remain in the sibling runtime evidence; this author implementation does not infer those from static CSS. No images, merged cells, or dynamic player row insertion were added.

Targeted author validation: TypeScript checking and four server-render/helper tests passed. Three browser author scenarios were added for real Library creation, rich editing, structure/reorder/resize/history/cancellation, bounded paste, adaptive sharing, interaction targets, duplication and save/reopen. The first parent run passed two scenarios and found a case-sensitive test locator error in the third; corrected selectors and additional endpoint/drag checks await the parent's coordinated rerun. No original native GUI capture was retried.
