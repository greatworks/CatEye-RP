# Native MenuObject recovery — RP 11.0.0.4150

This stage extends the previously verified Table importer with the two actual classic menus in the official Default library. It preserves **MenuObject → Table → TableCell** identities. It does not downgrade menus into ordinary tables. Evidence is static DLL metadata/CIL plus eleven SHA-pinned files; no original DLL was loaded or executed, original GUI retried, or original prototype generated. Runtime behavior is independently investigated in `menu-runtime-*`.

## Actual source objects

Only `Default.rplib` contains MenuObject: two menus, two internal tables and six cells. The other ten files contain none; there is **no nonempty native submenu collection in this corpus**. The library SHA-256 is `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`. Full raw properties, cache provenance and sample hashes are retained in `menu-format-census.json`.

| Page / package | Menu ID | Internal Table ID | Native geometry and matrix |
|---|---|---|---|
| Classic menu - horizontal / `09eed44f62374bfa9f92b9d48fa1a032` | `f3092096b5ec4160a9fcfb2b863a97fd` | `e1fc9bd7831f405ca6d240cb772ad5d0` | Menu `(100,100)`, `300×30`; one row, three 100-wide columns |
| Classic menu - vertical / `77d375ae4dab4effb11972d149f69a46` | `863e844c5f704e8cbfe67ebbde4674f9` | `fe605d4432904d38a968969069f421fe` | Menu `(100,100)`, `100×90`; three 30-high rows, one column |

Horizontal cells, in matrix and container order:

```text
626afeeef0fb434f8e299976d51b0123  File
450ee5b04b694088a79e2d6588720720  Edit
2d8d78756ee745278eef3009e3f0115b  View
```

Vertical cells:

```text
6ca0a0aa436241cba26e935fccacaaa4  Item 1
179b50bc885c4c7d99d1970084c692bb  Item 2
ebd5f09e14784bb793b09580965c4c51  Item 3
```

Both menu maps explicitly store `orientation`, `left-padding`, `right-padding`, `top-padding`, `bottom-padding`, `diagram-objects`, and `submenus`. All four paddings are 0; `submenus` is an empty array; `diagram-objects` has exactly one local Table reference. Initial Selected/Disabled/Error are false, visibility true, group/tooltip empty, adaptive entries empty, SubmitButton zero. No events are stored on these menus, tables or cells.

All six cells retain literal structured rich text. They resolve the exact default and base cache identities, with menu-item base style `2036b2baccbc41f0b9263a6981a11a42`. Their resolved appearance is transparent white fill, `#797979` borders, `#333333` Arial 13px normal 400 text, no underline/strike, left/middle alignment and text padding `[2,2,2,2]`. Four border widths are all 1. Selected patches are empty; mouseover, mousedown, focused, disabled, error and hint have no state style. `normal` line-height is the existing browser mapping for automatic native spacing, not proof of identical native font metrics.

## Missing stored table position has a proven layout source

Each internal Table has a local SIZE property but **no local LOCATION and no PName0 base reference**. Its inherited chain is not complete under the exact-identity resolver. Neither reader nor importer substitutes a guessed default position or pretends a cache location was found.

The original DLL SHA-256 is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. The retained static CIL in `menu-format-object-cil.json` proves:

| Method | Token / IL | Result |
|---|---|---|
| `get_Orientation` | `100701223`, signature `200011BA5C` | The field type resolves to **Axure.Platform.Orientation**, TypeDef `33558167`: Horizontal 0, Vertical 1, Both 2, None 3. It is not FlowTreeOrientation. |
| `get_ContainedTable` | `100701229`, IL0008–0013 | Reads the first DiagramObjects member and casts it to Table. |
| `bN04` | `100701236`, IL003C–0055 | Gets the Table, constructs a point from padding fields `DN0o` and `DNpG`, and calls its location updater. |
| `bN04` | IL0070–00BA | Reads Table rectangle dimensions, adds all four padding fields and updates Menu size. |
| `GN0Y` | `100701235`, IL005C–0092 | Inverse layout: Menu size minus paired padding fields becomes Table size. |
| `oIwv` | `100701250`, IL017A | The OnLoadComplete delegate calls `bN04`; the same retained method contains table layout initialization. |

With all four padding values explicitly 0, this is sufficient to derive Table `(0,0)` and preserve exact outer dimensions. The semantic record keeps `storedGeometry.location:null` and adds separate `menuPositionRecovery` provenance. This distinction remains visible in the import report.

Nonzero native padding is deliberately **not admitted**. The serializer and geometry read four private fields, but the precise obfuscated key-to-private-field mapping has not been fully established for nonzero samples. Zero values do not require guessing which side one particular private field names. The author's general padding support is a separate product capability.

## Submenu and export evidence, without an unwitnessed import claim

`MenuObject.NIwY` (`100701247`) calls the base container serializer at IL02D7, writes the orientation integer at IL0141–014B and serializes the `pN0y` submenu dictionary. The alternating serialized key/value references are visible at IL00B5–00BF and IL0068–0072, with final collection write at IL0319. `oIw4` (`100701248`, IL020B–0225) reconstructs dictionary entries from consecutive values. These are static structural evidence; the actual two menu collections are empty.

`get_ParentMenu` (`100701252`) casts the object parent to MenuObject. `get_ParentCell` (`100701253`) obtains its key from that parent's dictionary. `get_IsSubMenu` (`100701254`) tests ParentMenu against null. The approved model can express this with a submenu's `parentCellId` pointing into its direct parent table, but **native nonempty submenu recovery remains rejected** until an actual complete stored graph and geometry can be validated.

The HTML writer `FNiU.JNPM` (`100699667`, `menu-format-html-cil.json`) obtains/writes the contained Table at IL00C9–00CF, then obtains submenus from parent-cell dictionary entries and writes them at IL01FB–0201. Exact emitted tag and class literals remain unresolved here. JSON writer `wJe6.jJeK` (`100694305`, `menu-format-json-cil.json`) uses container DiagramObjects and the existing unsorted export path; its submenu branch reads ParentCell at IL0BC5. Runtime `parentCellId` interpretation is independently evidenced by the runtime agent. The two witnessed menu matrices have one axis, so row-major and column-major coincide; general table event order remains preserved by the existing `cellOrder` protocol.

## Implemented protocol and atomic boundary

```text
typeCandidate: {type:'menu', mapping:'native-menu-container'}
menuRecovery: {
  status:'supported-menu', orientation:'horizontal'|'vertical',
  padding:[0,0,0,0], submenus:[],
  table: <normal semantic Table, including the complete supported matrix>,
  source: {
    sourceType:'Axure:DiagramObject:MenuObject', nativeOrientation:0|1,
    tableId, submenuIds:[], layout:'menu-padding-table'
  }
}
table.menuPositionRecovery: {
  status:'derived-menu-table-position', menuOwnerId,
  x:0, y:0, padding:[0,0,0,0], source:'MenuObject.bN04'
}
```

The importer revalidates source identity, type, ownership, exact protocol keys and geometry. Horizontal requires one matrix row; vertical requires one column. Root size must match the complete Table. Root/Table appearance is limited to the already understood geometry-only container subset. Each cell must satisfy the existing strict Table/cache/border/rich-text guards. Track limits remain 1000 per axis, 9999 total cells, minimum size 1 and maximum summed size 100000. Normal global parser/import limits remain in force.

Unknown fields, ambiguous ownership, detached derived coordinates, malformed reference tags, incomplete matrices, nonzero padding and nonempty submenu collections reject the complete menu. The importer rolls back child registrations and counts. Its dependency fixed point removes the entire Menu and Table if a cell's required rich-link dependency cannot be recovered. This includes package scoping; another package cannot satisfy a missing target. No partial table or menu survives. Supported interactions still use the existing full event decoder rather than a new menu-specific approximation; the actual corpus contributes zero such events.

## Verification

```powershell
node --test research/scripts/read-rp-menu.test.mjs research/scripts/read-rp-table.test.mjs
npx vitest run tests/import-rp-menu.test.ts tests/import-rp-table.test.ts tests/import-rp-rich-hyperlink.test.ts
npm run typecheck
node research/menu-format-import-audit.mjs
```

Results: **46/46 Node tests** (21 new Menu, 25 Table), **70/70 Vitest tests** (22 new Menu, 24 Table, 24 hyperlink), and typecheck passed. Tests include SHA-pinned real objects, exact literal labels and dimensions, source immutability, strict save/reopen, negative protocol mutations, scoped event targets and dependency rollback. Mutated interaction/link fixtures are synthetic boundary tests, not original GUI observations. The former Table test that expected both menus to remain unsupported now verifies that each is admitted as a Menu wrapper, never flattened.

`menu-format-import-audit.json` checks all eleven original hashes, import counts, save/reopen, previous standalone table data and both earlier native hyperlink rich graphs. Only Default changes: **30→32 top-level widgets and 9→17 nested widgets**. These are two menus, their two contained tables and six rich cells. Events/actions increase by **0/0**. The other ten files retain prior counts; Icons remains rejected by the existing page-count limit. No earlier evidence/audit JSON was overwritten.

These results establish the witnessed root-menu subset. They do not establish original submenu visual positioning, authoring insertion/deletion/resize rules, exact generated border-image seams, font metrics, or full MenuObject compatibility. Production sources and all new evidence are SHA-pinned in `menu-format-manifest.json`.
