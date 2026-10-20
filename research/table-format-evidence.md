# Native Table / TableCell recovery — RP 11.0.0.4150

This stage uses the retained official binaries and eleven original files as **static evidence**. No vendor DLL was loaded or executed, no original GUI was retried, and no original prototype was generated. Self-written object readers, pure conversion and focused tests are separate from that evidence. The accompanying `table-format-evidence.json` and `table-format-manifest.json` pin the files and hashes.

## Observed corpus and ownership

Only `Default.rplib` contains real `Axure:DiagramObject:Table` / `TableCell` objects: three tables and fifteen cells. Annotation table definitions and repeater dataset rows are different types and were not counted. The other ten files contain no native table widgets. Default SHA-256 is `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`.

| Owner | Table ID | Native matrix | Import decision |
|---|---|---|---|
| Classic table, package `556a42319a0a476c8e81f2d6da0ada41` | `36a2bbf16b624eb9869e340c7b663c36` | 3 × 3, columns 100/100/100, rows 30/30/30 | One table and all nine cells |
| Classic menu - horizontal | `e1fc9bd7831f405ca6d240cb772ad5d0` | 1 × 3 | Rejected with its MenuObject; no table downgrade |
| Classic menu - vertical | `fe605d4432904d38a968969069f421fe` | 3 × 1 | Rejected with its MenuObject; no table downgrade |

The standalone table is at `(100,100)` with size `300×90`. Its row-major cell IDs are:

```text
40f6d7fa97a243708d54990b189068dc  fcc06afbc517402d91dd5954a7b50a24  e4681689936f4d439d89982840c4fd72
e4fd523a9769460cb995480f3724168e  df051487d3214e70b717a05994feb925  3b5f4d8e937e43feaf6648b14f28162e
fd837c69157b40b1ba8233c325f14e88  9914c366921a43898d897daf8e61aba1  c0c117e744274ecc88cbfc97491ca6c6
```

The first row contains `Column 1`, `Column 2`, `Column 3`; the remaining six cells have omitted empty rich-text content. All nine are separate source objects. Their native `diagram-objects` order is column-major: matrix indices `[0,3,6,1,4,7,2,5,8]`. It must not be replaced by row-major event enumeration.

`Default.rplib` is a library fixture, not proof of the default produced by every GUI constructor. In fact, `Table..ctor` starts with a 1×1 matrix before configuration; the 3×3 author default used by this product follows the observed library table.

## Serialization and geometry evidence

The DLL SHA-256 is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. All CIL below was read with `System.Reflection.Metadata` and `PEReader`; the parser never calls it.

| Evidence | Token / IL | Conclusion |
|---|---|---|
| `Table.NIwY` | `100702118`, IL0023 / 005F–0068 / 0094 / 00C0 / 00EC / 011E / 0149 | Base container serialization, `Initialized.ToString()`, row/column counts, cell collection, row-height and column-width lists |
| `Table.oIw4` | `100702119`, IL00EB–00F7 and row/column loop | Reconstructs the matrix by row and column. Actual `cells` arrays independently establish row-major order |
| `Table.get_Rows` / `get_Columns` | `100702082` / `100702084` | Explicit stored axis counts |
| `Table.get_RowHeights` / `get_ColumnWidths` | `100702077` / `100702079` | Separate size lists, not positions guessed from cell text |
| `TableCell.get_ContainingTable` | `100702212`, IL000D | Cell parent must be a Table |
| `TableCell.NIwY` | `100702239`, IL0022, 0097/00CE/00FF/0130, 0162/0193/01C4/01FA | Calls TextRectObject serializer, then writes four width and four color fields |
| `TextRectObject.NIwY` | `100702405`, IL0023 | Calls `RichTextObject.YNZq`, the already proven omitted-empty rich-text serializer |

Sources: `table-format-Table-cil.json`, `table-format-TableCell-cil.json`, `table-format-metadata.json`, and existing `rp-next-coverage-textrect-cil.json`. Obfuscated serializer key strings are not claimed to have been decrypted: field identities are matched to the exact observed maps and typed getter/serializer sequence.

Table fields are `initialized` (the string `"True"`), `rows`, `columns`, `cells`, `row-heights`, `column-widths`, and inherited `diagram-objects`. `cells` and `diagram-objects` must contain exactly the same unique local references. MenuObject has its own orientation/submenu behavior and remains excluded.

The first cell lacks local LOCATION. Its complete cached chain contains explicit LOCATION `(0,0)` in default style ID `627587b6038d43cca051c114ac41ad32`, library ID `53f4a189168b474893d409a1b736ad03`. All fifteen cells pass exact default/base dual-identity matching. This is stored cached geometry, **not a guessed zero-position fallback**. Every cell's resolved location equals the appropriate prefix sums, and its resolved size equals its column/row tracks. `table-format-analysis.json` records each source and provenance. A missing, ambiguous or mismatched cache rejects the table.

All fifteen have `AutoFitWidth=false`, `AutoFitHeight=false`, no adaptive style entries, zero SubmitButton reference, no tooltip/group, and initially enabled/unselected/non-error flags. `_IsEmpty=false` is also present on the six text-empty cells. Metadata calls that field `IsEmptyPaste`; it is not used as a text predicate. Empty text admission instead follows the TextRectObject/RichTextObject chain, restricted to known fields and package version `[11,0,0,0]`.

The four stored widths are all `1`; all four colors are ARGB `-8816263` (`#797979`). The recovery retains four widths in top/right/bottom/left order, but currently requires all four colors to agree because the product does not have four independent border colors. Cell rotation must resolve to 0, and the full transform must be the exact identity. Unknown transforms, auto-fit, paste placeholders, extra fields and incompatible rich text reject the whole matrix.

## Native export enumeration

`wJe6.jJeK` (`100694305`) gets `IDiagramObjectContainer.DiagramObjects` at IL07B4. At IL07C1 it tests `Table` and skips the inline-link concatenation branch; IL07F5 calls `FJem` with its ordering flag false. `FJem` (`100694317`) follows its original input at IL0031–0038, enumerates at IL0065 and recursively writes objects with `jJeK` at IL0078.

The intervening `Bbib.Sb73` (`100689134`, token `060064EE`) constructs a `System.Collections.Generic.List<T>` from that sequence. Its TypeSpec `1B00066E` signature `151280D1011E00` is decoded in `table-format-sequence-type.json`; there is no sort operation on this false branch. Thus the objects array—and the runtime's object enumeration—retains the native container order. `cellOrder` stores that order after scoped ID mapping, while `cells` stays row-major for geometry and editing.

Sources: `table-format-json-dispatch-cil.json`, `table-format-sequence-cil.json`, `table-format-sequence-type.json`, `table-format-container-cil.json`. The runtime event loop and its separate table/cell behavior are documented by the parallel `table-runtime-*` investigation.

## Protocol and admission

The reader emits:

```text
tableRecovery: {
  status: 'supported-table', rows, columns, columnWidths, rowHeights,
  cells: [normal semantic widget records in row-major order],
  source: {cellIds, diagramObjectIds, sourceType, matrixOrder:'row-major', eventOrder:'diagram-objects'}
}
typeCandidate: {type:'table', mapping:'native-table-matrix'}
```

Each cell candidate has `type:'tableCell'`, `mapping:'native-table-cell'`, and `tableOwnerId`. `borderRecovery` includes its independently validated widths, color, original ARGB values, and identity-transform/zero-rotation layout. The existing style, rich-text, selection, state and interaction protocols are retained. The table itself is a geometry-only transparent container, not a new interpretation of a Table appearance property as a command to all cells.

Both reader and importer enforce nonempty axes, at most 1000 tracks per axis, at most 9999 cells, track sizes at least 1, and total size at most 100000. Positive native track values below 1 are deliberately rejected to match the model. Normal global file/package/widget/worker limits remain in force. Cells may not be orphaned, repeated, owned by another container or collide with another same-package source ID. Table source fields and container styles are allowlisted; arbitrary root style properties are not translated into cell edits.

The importer rechecks the protocol, all source sets, ownership, border carrier, complete cell cache status and exact matrix geometry. It converts every cell before committing the table. Any failure rolls back child target registration and report counts. The rich-link dependency fixed point removes an entire table if one cell loses a link dependency; another table depending on that removed cell is then removed too. No incomplete matrix survives. Ordinary unsupported events retain the existing whole-event rejection policy.

## Verification and measured coverage

Commands:

```powershell
node --test research/scripts/read-rp-table.test.mjs
npx vitest run tests/import-rp-table.test.ts tests/import-rp-rich-hyperlink.test.ts
npm run typecheck
node research/table-format-import-audit.mjs
```

Results: **25/25 new reader tests**, **24/24 new importer tests**, plus **24/24 existing hyperlink importer tests**; typecheck passed. Tests include actual source hashes and exact geometry/order, cache omission, bad references, cross-owner/duplicate identities, limits, invalid tracks, old omitted-empty text, unknown fields, transforms, unsupported rich content, scoped cell event targets, save/reopen and dependency rollback. Mutations are explicitly synthetic tests of the boundary, not new original GUI observations.

The eleven-file audit `table-format-import-audit.json` verifies source hashes and model save/reopen. Only Default changes: **29→30 top-level widgets, 0→9 nested widgets**, one fewer skipped top-level object. Every other file's admitted widget, event and action counts is unchanged. The two previous native hyperlink owners retain their entire recovered rich graphs byte-for-byte under JSON comparison. Total added native events/actions: **0/0**; none are present on the actual table/cells. Icons remains rejected by the existing page-count limit.

## Unproven boundaries

- There is no original-GUI or generated-prototype visual comparison in this stage. This is a complete recovery of the witnessed matrix subset, not full native Table compatibility.
- The HTML writer `FNiU.zNPe` (`100699666`) enumerates cells, while generic text-rectangle writer `vNPI` (`100699653`) obtains each cell image/text. Exact emitted tag/CSS/image seams are not fully followed here.
- `RPFormatConverter.iJcb` (`100692593`, Axvg conversion) clears interior right/bottom border edges and retains top/left plus the last row/column's outer edges. This suggests single internal strokes in that conversion path. It does **not yet prove the final prototype image seam is one rather than two pixels**, and is not used to invent a border-collapse rule.
- Whole-Table author style changes propagating to cells are not established. No such bulk mutation is inferred from the stored root style.
- Menus, merged cells, independent border colors, unknown cell fields, adaptive layouts, auto-fit cells, transformed cells and incomplete rich graphs remain outside admission. Runtime resize no-op, movement, enable and independent state/event behavior are separate runtime evidence, not inferred from track serialization.
