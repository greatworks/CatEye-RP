# Static table implementation

This stage adds a real table model, independent cell authoring and interactions, strict native recovery, and the same runtime in React preview and portable HTML. It does not establish complete Axure parity.

## Authoring and document model

`Widget.type` includes `table` and `tableCell`. A table owns a complete row-major cell matrix and explicit column widths and row heights. Cell IDs, text, rich text and links, notes, style and interaction graphs remain independent. Cell geometry derives from tracks, while runtime movement is a separate instance override. A cell cannot exist alone, contain other widgets, or carry images/vector geometry. Validation checks IDs, track sums, matrix dimensions, cell geometry and document resource limits.

`cellOrder`, when present, records the original object enumeration independently of the row-major matrix. Clone/component materialization remap these IDs and cross-cell targets. Native generated object order has been traced from `IDiagramObjectContainer.DiagramObjects` through the table JSON writer. New authored tables currently use matrix order. Reordering authored tracks preserves existing explicit object order; insertion appends new IDs and deletion removes only deleted IDs. Those authoring order policies are product conventions pending original editor comparison.

Libraries → Table creates a 3×3 grid. Canvas cell selection is separate from general widget transforms. Shift/drag selects cells; headers select whole axes and support drag reordering; boundary drags adjust tracks, including rotated/zoomed canvases. Inspector controls insert, delete and move rows/columns. Cell W/H changes complete selected columns/rows. A separate command selects all cells for formatting. Rich text editing, save/reopen, undo/redo, table duplication and linked components use the shared document paths.

TSV paste supports quoted tabs/newlines, escaped quotes and Unicode. Existing-table paste clips at the current matrix edges. Paste as table creates a new grid. Cell deletion clears contents; removing rows/columns is a separate command and must retain at least one of each. Browser clipboard formats beyond plain text are not implemented.

Table geometry and cell content/styles are shared across adaptive views. Only whole-table hidden placement may differ per view. Serialized local cell/layout overrides are rejected instead of distorting the grid.

## Runtime contract

Table cells participate independently in text references, conditions, selected groups, hyperlink events, case menus and repeater row instances. Matching cases, including empty cases and pending case menus, consume click/double-click; no match falls back from cell to table. An internally disabled cell skips its own handler while allowing table fallback. Hiding a cell does not reflow tracks; hiding a table hides its descendants. Table Load runs before cells in object order.

The original functions exclude both table types from Resize and from meaningful Enable/Disable and Set Error setters. Those actions leave state unchanged and subsequent actions continue. Table Set Selected is ignored; cell Set Selected is supported. Move changes addressed CSS coordinates, including local cell coordinates, without rebuilding tracks. Table text reads concatenate cell paragraphs in object order with LF, retaining empty/hidden cell contributions. Table Set Text is explicitly unsupported and safely ignored; the original direct low-level setter throws for its absent own text panel, so this is a documented protective boundary rather than a claimed native no-op.

Native evidence and probe results are recorded in `table-runtime-evidence.md`, `table-runtime-evidence.json`, `table-runtime-probe.json` and the format reports. Tests exercise the module and its serialized offline form, plus real browser authoring and preview/file playback. Exact-package verification and current totals are recorded in `table-verification.json` after the release checks finish.

## Limits

- The application is an independent implementation. No proprietary Axure code/assets are distributed.
- Merged cells, images within cells, and dynamic runtime row insertion/deletion/sorting/filtering are outside static-table scope; use a repeater for dynamic data.
- Track insertion copies adjacent base cell styles and uses blank text/new IDs. Overall authoring resize proportionally scales tracks with a one-pixel minimum. Exact native style inheritance, fractional rounding and reorder-history behavior remain unproved.
- Table/cell borders currently use independent CSS rectangles. Exact generated Axure images/SVG, interior border seams, native overflow and focus/tab structure, animation and full original GUI/pixel parity remain unverified.
- Native import remains a strict read-only subset; unsupported table cells/dependencies reject the complete table rather than leaving a broken matrix. Menu-internal tables are not converted to ordinary tables.
- The original editor was observed as an Untitled window with editing menus through accessibility. Clicking its observed Edit menu returned `coordinate input geometry is unavailable`; no further native inputs were issued. Prior native screenshot capture failed with `FrameArrived` timeout. The read-only observation and failed action are recorded in `table-original-editor-accessibility.json`. This stage makes no original editor widget-interaction or pixel-comparison claim.

Official authoring reference: https://docs.axure.com/axure-rp/reference/tables/ (read 2026-10-14). These current documents are secondary to the pinned 11.0.0.4150 artifact for version-specific behavior.
