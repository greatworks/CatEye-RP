# Page management and native RP sitemap evidence

2026-10-13. Read-only official documentation and six existing source samples. No original GUI execution. The native distribution is Axure RP 11.0.0.4150; extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`, installer SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`, DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7` (rechecked). Sample and decoded-part hashes, object offsets, IDs and the complete small sitemap census are in [page-management-evidence.json](page-management-evidence.json).

## Official behavior

[Managing Pages](https://docs.axure.com/axure-rp/reference/managing-pages/) (retrieved text lines 42–94):

- Double-click a page to open it. Add Page and context Add support before, after, or child placement.
- Reorder and indent/outdent by dragging or Ctrl (Windows)/Cmd (macOS) plus arrows. The top page is the prototype landing page.
- Add folders from the pane or context menu. Deleting a folder also deletes its pages; a nonempty folder prompts for confirmation.
- Rename by slow double-click or the context menu. Existing links update with page renames.
- Open pages have tabs. Tabs can be reordered independently, closed individually, all closed, or all others closed. An arrow menu lists open pages.

[Keyboard Shortcuts](https://docs.axure.com/axure-rp/reference/keyboard-shortcuts/) (lines 77–83, 184–195) explicitly lists Windows Ctrl+Enter new page, Ctrl+Shift+Enter new folder, Tab/Shift+Tab indent/outdent, Ctrl+Up/Down move selection, Ctrl+D duplicate, Ctrl+W close, Ctrl+Shift+W close all. Ctrl+Tab / Ctrl+Shift+Tab follow accessed-page order; Ctrl+Alt+Right/Left follow visual tab order. The two navigation orders should not be conflated with sitemap order.

Unknown from these documents: deleting a **page** that has child pages (the explicit recursive confirmation statement concerns folders); precise boundary behavior for Ctrl+Left/Right; add-child insertion position; native rename implementation preserving each internal identifier; last-page deletion; persistence of tab order/open state. Applying a recursive confirmation to any parent page is a product choice, not a demonstrated native fact. Current samples establish independent IDs and names, not a before/after rename experiment.

## Stored structure already decoded

No new binary tag decoder is needed. `read-rp-objects.mjs` preserves tag 1 ordered map pairs, tag 2 arrays, tag 3 local object references, tag 17 GUID values, and tag 19 named package references. The following is an observed graph, not a guess from class names:

1. `Axure:DesignDocument.sitemap` is a local tag 3 reference to `Axure:SiteTreeMap`.
2. `SiteTreeMap.tree` references `Axure:Tree`; `node-table` maps local `Axure:Node` references to page/folder contents.
3. `Tree.children` gives root sibling order. Every `Node.children` gives its child order. `Node.parent-node` references the parent Node or root Tree; `Node.tree` references the same Tree. Root `Tree.tree` references itself.
4. Page contents are tag 19 with name `Axure:PackageInfo`; their GUID is a **page package ID**, not the local PackageInfo object's ID. A local `Axure:PackageInfo` has `package-id` (tag 19, name `Axure:Page`) and `package-name`. The page package is `<packageId>/package`.
5. Folder contents are local tag 3 references to `Axure:MasterTreeFolder`, even in the **sitemap**. This object carries `folder-id` (tag 17 GUID) and `name`. Its object ID, folder GUID and node ID are separate identities. A class name containing “Master” is not grounds to reject these witnessed page folders.

Use `children`, never `node-table`, PackageInfos, object order or container enumeration, to recover order. Traverse once in preorder and retain identity separately from names. Different folders can have identical names.

## Cross-sample observations

| Sample | Pages | Folders | Container page order equals sitemap preorder |
|---|---:|---:|---|
| Required Fields | 2 | 0 | yes |
| Tab Menu | 1 | 0 | yes |
| Prototyping Basics | 1 | 0 | yes |
| Quick Win | 2 | 0 | yes |
| UX Prototyping | 10 | 6 | **no** |
| Default.rplib | 40 | 5 | **no** |

All 67 nodes have reciprocal parent links and the expected owning Tree. The observed child nesting includes folders in folders (UX depth 3), but these six samples do not independently establish a page with children. The same Node grammar can represent that edge; accepting it is structurally supported and documented by Add child, but a synthetic case should be labeled synthetic.

UX source SHA-256 `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72`; DesignDocument SHA-256 `abeeed66b963067b2fc3d0c630b45e566bad6e4aea8541edd6b5bc4c6ef45330`. Its sitemap `d9971899ec754ea1890352f59d99f4c8` starts at decoded offset 101254, Tree `4ac2279f93cd40b9b65d0d1867209f64` at 101830. Root order is Overview, Exploration, Solution, Sample. Overview package `c181daaef18a4bd3903aeb914832f1af` is fifth in container enumeration. Nested “Sample / Solution / Sample UX prototype” contains Request email and Manage time off. Two distinct Exploration folders and two Solution folders must stay distinct.

Default source SHA-256 `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`; DesignDocument SHA-256 `719c329a6304a4a0362fd1cbc039a609bf9924d63d6ddb65e097a4c19d7aa62d`. Tree `c31b99fd34e3404ea4f5f5a17ff08c35` at 226968 orders Common, Dynamic, Forms, Menus and table, Markup. First actual page is Box 1; container enumeration begins with Primary button. This `.rplib` is evidence for storage grammar, not a claim that native libraries launch as ordinary prototypes.

## Recovery boundary and implementation contract

At audit start, `recoverRpSemantics` explicitly retained diagram package enumeration and `importRpSemantics` produced flat pages with no parent or folder; it reported this loss. Existing `openPage` recovery uses package GUIDs, so reordering and names must not change target IDs.

Recover a separate optional `pageTreeRecovery` only after checking unique DesignDocument/object/node/content identities, exact reference kinds and types, unique PackageInfo mappings, reciprocal parents, one owning Tree, reachable nodes, cycles/duplicate attachment, bounded depth/size, page package existence/type and complete page coverage. Unknown or inconsistent trees must return an explicit unsupported status and keep flat page/widget recovery. Do not silently repair broken edges or convert a folder into a blank page. Import validates this protocol again and commits all organization fields atomically. Deterministic folder IDs must occupy a separate prefix from pages, widgets and states.

Acceptance: verify UX 10 pages/6 folders, Default 40 pages/5 folders, exact sibling order and duplicate folder names; preserve Required Fields openPage target through serialization; rename does not alter IDs; corrupt one tree edge and retain the same flat pages/widgets with a hierarchy warning; legacy protocol without page-tree metadata stays usable. Model/renderer policies for first non-folder entry, default sizes and unsupported page styles remain separate from this native tree evidence.

## Implemented recovery and validation

The task was subsequently expanded from evidence to implementation. `read-rp-semantics.mjs` now exports `recoverPageTree` and includes optional `pageTreeRecovery`: `supported-page-tree` carries `rootId`, `treeId`, source-part SHA-256 and preorder `nodes`; every node carries `nodeId`, explicit nullable `parentNodeId`, kind/name and either page `packageId` or folder `folderId`. Failure produces `unsupported-page-tree`, reason and no partial nodes. `import-rp.ts` independently checks the protocol and applies `Page.parentId`, `Document.pageFolders` and complete `pageOrder` atomically. Folder IDs use `rp-f-<GUID>`; page IDs remain `rp-p-<packageGUID>`.

The existing bounded document model accepts at most 200 pages, 200 folders and 12 tree levels. These are product limits, not native Axure limits. Failures preserve flat imported content and emit `page-tree-omitted`; success emits `page-tree-recovered`. No source RP is modified.

Validation on 2026-10-13: **40/40** new reader tests cover six hash-bound real samples plus malformed graph cases; **23/23** new importer tests cover real hierarchy/order, GUID links through reorder/rename/round-trip, namespace separation, legacy input and atomic fallback. Combined settings/appearance/page-tree reader checks passed **64/64**, and the five focused RP importer test files passed **109/109**; typecheck passed. Browser, native GUI, packaged application and the full test suite were deliberately left to the parent task's integration verification.
