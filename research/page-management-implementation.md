# Page organization implementation and verification boundary

2026-10-13. This stage addresses the editor's sitemap, open page tabs, native sitemap recovery, and both prototype navigators. It does not establish full Axure RP 11 parity. Source observations and unverified native behavior are separated in [page-management-evidence.md](page-management-evidence.md).

## Model and data preservation

Pages remain renderable `Document.pages` records with stable IDs. Optional `pageFolders` stores organizational nodes; both page and folder records may have `parentId`. Optional `pageOrder` is an exact permutation of all node IDs. The parser verifies unique global identities, valid parents, acyclic relationships, 200 pages, 200 folders and 12 levels, then canonicalizes preorder. Old documents without new fields remain readable; their array order supplies sibling order. Structural authoring writes explicit preorder and aligns the real-page array, so the first real page remains the export entry point.

Pure tree functions preserve entire subtrees and page contents. Invalid/cyclic/no-op moves return the original document. Rename leaves navigation IDs unchanged. Delete removes the selected subtree and rejects removal of the last page. Links to deleted pages retain their target rather than silently selecting another page; this is the existing bounded runtime behavior. Each tree operation is one document history transaction. Collapse, search, selection and open tabs are session state rather than document edits.

## User workflow

Single-click selects a tree row; double-click opens a page. Folders organize real pages and never receive a canvas/runtime. Toolbar additions insert after a selected page or inside a selected folder; context actions explicitly insert before, after or inside. Inside appends to the last child. Drag hit zones are the top quarter, middle half and bottom quarter. Ctrl+arrows and Tab/Shift+Tab adjust order/depth. F2/context rename uses application input dialogs. Nonempty page or folder subtree deletion prompts before the atomic edit. Search shows matches and their ancestors while preserving the prior collapsed set.

Open tabs have independent order and close operations, an open-pages list, and a Gallery fallback when all close. Closing a tab never deletes a page or adds document undo history. Undo that removes the active page chooses the first remaining real page and opens its tab. Tab and tree keyboard events cannot delete or move canvas controls. Gallery suppresses canvas shortcuts; insertion explicitly reopens the editable canvas.

Four pre-fix browser regressions are preserved in `test-results/page-tree-before-ownership-fix`: hidden canvas deletion after closing all tabs, missing fallback tab after undoing a newly created page, deletion of a hidden descendant after folding its ancestor, and canvas key leakage from focused tabs/close buttons. The corrected behavior is tested against saved document bytes and focus/selection state, not only UI existence.

## Native importer and players

`read-rp-semantics.mjs` now returns independent `pageTreeRecovery` metadata only after validating reciprocal Node/Tree links, reference tags, package identities, exact coverage, unique attachments and bounded structure. The UI-side importer validates the protocol again before applying organization atomically. Unsupported trees preserve the same flat page/widget recovery and emit a hierarchy issue. `rp-p-` IDs stay stable; folders use `rp-f-` IDs. Real source files are never modified.

Preview and offline HTML render scrollable, collapsible page navigation with distinct folder behavior. Interactive navigation reveals the destination's ancestors, while ordinary runtime updates preserve user collapse state. Offline output remains one self-contained file with no network dependency. Folder names and page names are rendered as text, including literal markup characters.

The first complete production run passed 101 of 102 cases. The remaining fractional-row check compared a reference at viewport x=0 with the product at x=682. A separate pure-CSS browser probe reproduced the exact 0.00006103515625-pixel relative-coordinate difference at host scale 1.5 (`.build/page-tree-viewport-precision.json`). The test now places its independent expected CSS boxes at the measured parent origin on each check, including after scrolling; its numerical tolerance and exact inline CSS, computed CSS and native geometry-log assertions are unchanged. All three focused row modes subsequently passed. Product repeater layout code was unchanged.

## Evidence limits

- Native GUI capture remains blocked; official docs and decoded files are the evidence, not a live original-GUI comparison.
- Recursive deletion confirmation for parent **pages**, 12-level/200-folder limits, F2, drag hit zones, inside append, search ancestor retention, no-op history, Gallery focus policies and last-page preservation are explicit product choices.
- Native page duplication, multi-selection, clipboard between projects, page diagram-type icons, all tab keyboard shortcuts, native tab-session persistence, Gallery component filtering/thumbnail sizing and exact native menus remain incomplete.
- Native `.rp` write-back, full document semantics, cloud collaboration and other previously recorded gaps remain open.

Final current-build results and package hashes belong in `page-management-verification.json`; an earlier stage's manifest is not evidence for this source revision.
