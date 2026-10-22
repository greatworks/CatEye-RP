# Selection library templates and initial solid alpha paint

This source stage follows the frozen selection Windows candidate. It changes new library insertion and the bounded initial SVG painter. It does not claim original GUI or pixel equivalence, final native drop geometry, complete runtime state paint, or native `.rp` writeback.

## Implemented behavior

`createLibraryWidget` constructs Checkbox and Radio Button from independently expressed functional declarations in the shipped Default library: stored geometry 75×15 / 93×15, Arial 13px, P94 13, left/top text alignment, padding [0,2,0,2], explicit rich text and width-fit declaration. It includes the separately resolved disabled fill #f0f0f0. IDs are freshly generated; displayed names remain the product's existing naming policy. The native empty radio group maps to this model's absent optional group. No vendor ID, import annotation, runtime code, image or library file is shipped as part of the implementation.

The existing library double-click, drag/drop, canvas placement and quick-insert routes share this factory and the existing single undo/adaptive insertion transaction. `createWidget` remains the legacy internal builder; parsers do not backfill missing selection declarations. Stored template dimensions are initialization data, not a claim about all native creation paths. Later fit/side/style edits retain their existing browser measurement and transaction rules. In particular, switching Radio Button's indicator side can change stored width93 to measured width92 on this machine; undo restores the original template exactly.

The portable SVG factory accepts bounded self-contained solid colors including #RGBA/#RRGGBBAA, `transparent`, and comma RGB/RGBA. Explicit transparent color remains transparent, including disabled controls. Zero outline width does not suppress the checkbox's independent tick; its width now uses the retained CIL operation order `(b/14)*3`. Initial radio remains fill-only. Gradients, contextual colors, shadows, non-solid patterns, unsupported transforms and other existing exclusions continue through fallback.

## Evidence and limits

- [Creation evidence](selection-creation-evidence.md): raw template declarations, disabled style cache chain and six retained-CIL checks. Point creation requests measurement. The specific final library-insert Update branch does not request measurement; complete clone/style-import notification effects and final native geometry remain unknown.
- [Paint evidence](selection-paint-evidence.md): 40 retained-CIL color/glyph cases, 24 original-JavaScript sequences with216 SVG observations, and12 color-carrier checks. Only initial non-null solid paint is integrated here. Runtime `_applySvg` eligibility, history-dependent zero width, later radio stroke and regenerated assets remain separate open work.
- Computer Use currently reads a single `Untitled` Axure editor (window16189472), with menus and empty panes and no authentication dialog. No new screenshot or canvas input was attempted against the previously failed bridge; no original GUI comparison is claimed.

## Validation and retained failures

Final results and exact source/evidence hashes are in `selection-library-verification.json`. Browser checks cover all four insertion routes for both types, author controls/handles, one-step undo/redo, exact save/reopen, adaptive placement, disabled fill, and initial alpha in editor/preview/isolated frame/offline HTML.

Retained first failures are evidence, not successful checks:

1. Alpha unit regression:78 failures before expanding the painter, followed by363 passing focused tests.
2. Initial browser alpha script used runtime `data-widget-id` on the editor, which identifies widgets by ordered `.editor-widget` nodes instead. The corrected six-test run passed without product changes.
3. First full unit run under unrestricted default worker concurrency passed5883 and timed out on two native sample reads at the existing5s limit. The final suite reruns with four workers and the unchanged timeout, after browser work ends.
4. Library stub produced four failing behavior cases. The first implementation then exposed one real save incompatibility: explicitly empty `radioGroup` is invalid in this model. The factory now uses the established absent-group representation; the parser was not relaxed. Focused370 tests passed.
5. First library browser batch passed17/22. Four assertions incorrectly fixed radio width after a side command, and the adaptive selector used an ID where the preview uses serialized target values. The corrected test checks the saved post-command geometry, complete undo restoration and selects the observed Mobile option by label; all nine library tests passed on the same unchanged production build.
6. A test-only typecheck error used an unsupported Playwright assertion option. Corrected before the successful production build; no product behavior was changed for it.
7. The first Windows smoke passed four behavior groups, but visual review found stale hidden-window frames. A second harness waits for loaded placement, the closed file menu, fonts and two animation frames before capture. The first images remain retained and are not accepted as final visual evidence.

The previous candidate archive, ASAR, frozen reports and historical document snapshots remain separate. This stage is not a replacement claim for their full411-browser/14-desktop acceptance.
