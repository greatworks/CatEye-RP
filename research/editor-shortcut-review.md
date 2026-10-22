# Editor shortcut review

Read-only product review on 2026-10-22. No production files were edited by this
reviewer. The original `editor-shortcut-evidence.json` manifest is unchanged.

Reviewed source SHA-256:

- `src/App.tsx`: `72c40c105e3aa5bc8c177562872b4e2e89f47b6d138df6854a4e0a8e0e38666a`
- `src/model/editor-shortcuts.ts`: `cd78cbb47743f88bde20d7109028f77dceebe01a8c40d5fc31b6e46bd211d6aa`
- `tests/e2e/editor-shortcuts.spec.ts`: `644b11382945d7fa0d0f39aa9075a2b3f6042916a8f092bf39e9a4aa3b46108b`

## Findings and resolution

1. **Shift-modified keys reached vector commands.** The first handler used
   `plain` before delegating to `CanvasVectorTools`, so Shift+Delete could delete
   a vector anchor and Shift+Escape could exit point editing before the later
   rejection guard. The final code delegates using `localKey`; those chords
   cannot reach vector editing, while plain Delete and ordinary supported
   commands retain their existing path. Fixed in reviewed source.
2. **Modal buttons did not shield the canvas.** Quick Actions and Global Variables
   have no dialog role, so the initial role-based focus guard allowed alignment
   and deletion behind those modals. The final early `quick || variables` guard
   blocks local and global canvas dispatch; plain Escape closes the modal without
   clearing the canvas selection. `.modal-backdrop` is also covered by the focus
   guard. Fixed in reviewed source.

The parent reproduced both issues in
`test-results/editor-shortcuts-review-red.json` (two failing tests). I inspected
that result: the vector document changed after Shift+Delete, and the modal case
lost both widgets. The separate `editor-shortcuts-final.json` has 77 passing
tests but predates these final fixes, so this review does not treat it as their
post-fix verification. The integration stage owns subsequent browser results.

## Clipboard and scope review

The table ClipboardEvent handler now declines ownership whenever Quick Actions,
Global Variables, table paste, preview, or Gallery is active, and when the event
target belongs to an input, editable element, dialog, or modal backdrop. This
protects table cells even if a modal leaves focus on another surface. Outside
those contexts, ordinary table Ctrl+C/X/V still reaches the browser clipboard
event path; unsupported modified chords are prevented before they can trigger
that path. No additional blocking issue was found in this delta. A table-selected
modal clipboard regression is the direct behavioral check for this new guard;
the two review tests alone do not cover ClipboardEvent ownership.

Exact chord resolution, Ctrl/Meta conflict rejection, AltGraph/IME handling,
input focus protection, and existing tree/menu/table operation guards were also
reviewed. This is a source-level review with retained test-result inspection, not
an independent browser test run or native Axure GUI observation. Full keyboard
layout, accessibility, platform shortcuts, and original native context parity
remain outside this bounded review.
