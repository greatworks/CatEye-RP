# Editor shortcut dispatch integration

Status: implemented and verified locally, not published, 2026-10-22.
`fullAxureParity=false`, `originalGuiCompared=false`, `published=false`.

## Problem and change

The former global handler treated most Ctrl/Meta letter combinations alike,
even when Alt or Shift selected a different command. Real browser checks showed
Ctrl+Alt+X removing selected widgets, Ctrl+Alt+C copying instead of aligning,
Ctrl+Shift+O opening a file instead of generating HTML, and a modified Delete
clearing a selected table cell.

`src/model/editor-shortcuts.ts` now resolves complete chords. `src/App.tsx`
routes supported commands through existing editing functions and does not fall
back to ordinary commands for unsupported modified keys. The existing primary
modifier compatibility and F5 preview alias remain product behavior. The change
does not alter document serialization, geometry algorithms, player code, or RP
import.

New bindings connect existing alignment, drawing tools, Quick Actions, preview,
HTML export, grid and reset-zoom actions. HTML generation opens this application's
existing single-file export; it does not implement Axure's complete generator
options. The supported mapping is in the resolver and the Windows quick start.
IME/AltGraph, editable controls, local table/tree/menu/vector keys, and active
selection-resize cancellation are handled separately. Unsupported modified
shortcuts are suppressed in the canvas context so a native browser clipboard
event cannot silently fall back to a different editing operation.

A review found two remaining paths: Shift+Delete reached vector anchor deletion,
and focused Quick Actions/Global Variables buttons let keys affect the canvas.
Both were reproduced and fixed. Those modals now shield canvas keys; Escape
closes them without clearing selection. Table ClipboardEvent ownership excludes
modal states and dialog targets while retaining ordinary table cut/copy/paste.

## Evidence and limits

[The official keyboard reference](https://docs.axure.com/axure-rp/reference/keyboard-shortcuts/)
was verified on 2026-10-22. Individual named command bindings are documentation
evidence. [Native shortcut evidence](editor-shortcut-evidence.md) separately
confirms complete key-plus-modifier equality and Windows value preservation in
Axure RP 11.0.0.4150, without loading its DLL. Six distinct-pair comparisons,
identical controls, eight modifier masks and invalid inputs passed bounded
instruction checks. The full native command registry/focus graph was not replayed.

[Original GUI observation](editor-shortcuts-gui-observation-20261022.md) records
one fresh attempt and one recovery attempt with the updated Computer Use plugin.
Axure reached an `Untitled` window, but both captures timed out. No editing input
or alternative desktop-capture bypass was used. Local product screenshots do
not establish original GUI or pixel parity.

Full shortcut coverage, accessed/visual-order tab navigation, native focus and
menu precedence, macOS behavior, non-US keyboard layouts, all generator modes,
full original GUI/pixels, and native `.rp` writeback remain open. Existing panel
and page navigation context rules were retained. The complete reconstruction
goal remains unfinished.

## Verification and retained failures

- The immutable preceding production build failed all five initial regression
  scenarios. `test-results/editor-shortcuts-red.json` retains those failures.
- The first new candidate passed four of five. Its alignment/copy test incorrectly
  assumed Undo preserved selection. The fixture now reselects before Copy; the
  original test and result remain under `.build/editor-shortcuts-first-test-fixture.ts`
  and `test-results/editor-shortcuts-green.json`. No product change was needed for
  that fixture correction. The first related suite then passed 77/77.
- Both review regressions failed against that candidate, retained in
  `test-results/editor-shortcuts-review-red.json`; the final build passes them.
- Final `npx tsc --noEmit` and Vite production build passed. Existing Vite loader
  and large-chunk notices remain; no dependency or build configuration changed.
- Final `npx vitest run --maxWorkers=4` passed 6,202/6,202 with unchanged timeouts.
- Final production Playwright checks passed 79/79: shortcut regressions, editor,
  page tree/tabs, table/menu/tree authoring, vector/point editing and selection
  resize. This is a related suite, not the entire application browser suite.
- The actual hidden Windows package passed three check groups: exact shortcut
  routing/alignment/undo/native save; preview/native HTML export; and modal table
  clipboard isolation with ordinary cut/undo controls. Picker answers were mocked.
  ClipboardEvent injection is an explicit supplement, not an OS clipboard claim.
  Fresh user data was used; no renderer errors or external requests were observed.
- The initial desktop harness waited only for the title `Untitled`, which was
  already present before asynchronous open completed. Its failure is preserved.
  The corrected harness waits for `Document opened` plus the expected widget
  count; the same package then passed. Production code did not change.
- Two final native-window captures were visually reviewed: aligned shapes have
  their shared center line; the Quick Actions modal retains the selected table
  behind it. Both are this product, not Axure screenshots.

## Local output and preservation

Test executable:
`.build/editor-shortcuts-package/REA Prototype Studio-win32-x64/REA Prototype Studio.exe`.
Project version 0.1.0; Electron 44.7.0. ASAR SHA-256:
`71d6e95c5b0a0486e8decfb2a1299382fa585e16530ad4b9dbba08dde844f499`.

The bundle audit matches every packaged application file to the tested build,
desktop code and parser sources. Only previously licensed fonts are embedded;
no proprietary Axure code/assets were added. Prior snapshot/evidence files and
nine protected candidate/release artifacts are hash-checked. Current test inputs,
source snapshots and stage evidence are bound by `editor-shortcuts-verification.json`.
Existing browser suites regenerate their own demo artifacts; no release package
was replaced and this test package was not published.
