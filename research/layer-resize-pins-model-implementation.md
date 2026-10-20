# Layer author resize pins: storage and adaptive model

This change adds the four independent author constraints to the existing model. It does not implement an author resize controller, native geometry solver, capability-to-product-type mapping, runtime action behavior or GUI parity.

The separate capability investigation is frozen in `layer-resize-capability-evidence.md/.json` and its manifest. It proves the normal `kbNq` capability gate, not final widget resizing. Parent-owned `layer-resize-pins-style-default-cil.json` and `layer-resize-pins-chain-replay.json` establish the stored defaults and provider chain.

## API and persistence

- `WidgetStyle.pinHorizontal?: 'none' | 'left' | 'right' | 'both' | 'center'`
- `WidgetStyle.pinVertical?: 'none' | 'top' | 'bottom' | 'both' | 'center'`
- `WidgetStyle.fixedWidth?: boolean`
- `WidgetStyle.fixedHeight?: boolean`

The exported pin value lists/types and `ResizePins` interface describe this domain. The pure `resolveResizePins(style)` helper resolves omitted values to `none`, `none`, `false`, `false`. It returns a new object and does not mutate or materialize saved fields. Actual widget capabilities are a separate controller input; the helper does not force either axis fixed.

`parseAuthorStylePatch(value)` explicitly accepts these four keys along with ordinary visual properties. Full normal widget styles, document named styles and adaptive normal style declarations use this author boundary. Existing `parseWidgetStylePatch` remains visual-only. Flat effects, hint styles, adaptive state styles, rich runs, link visual styles and SetStyle actions do not accept author constraints. Invalid enums, numeric/string booleans, null values and unknown keys are rejected.

Old projects omit the new fields exactly as before. Explicit `false` and `none` remain saved values; they can reset an inherited true/nondefault value. Clone and save/reopen preserve the declarations.

## Adaptive behavior

The four fields are independent property keys in `layoutDifference`. Normal current-view changes update only the intended key; parent, sibling and inactive maps remain intact. Affect All Views writes the actual changed key to Base and clears only that key in all assigned and inactive declarations. It does not copy the other three current values.

Existing explicit declarations remain local when an ancestor later happens to match them. This includes a caller omitting an already-effective default: effective-value equality preserves the existing false/none declaration and an all-views no-op returns the original page. Removing a declaration deliberately remains the existing explicit clear-override operation, not an accidental consequence of normal edit normalization.

Nested Layer member edits retain their original graph and bounds. Shared view-set projection/commit keeps definitions and unrelated pages intact. The existing rejection of a Layer's own adaptive x/y/width/height was retained. Existing shared table/menu/tree descendant author restrictions were not widened.

## Red/green record

The first new test run had **37 tests: 17 pass / 20 fail**. Four failures were a test-helper error passing a widget array where `findWidget` requires a Page; the first log is retained. After correcting that harness, unchanged product code produced **21 pass / 16 fail**, demonstrating missing schema/API and dropped independent adaptive edits.

The first implementation run reached **36/37**. The remaining failure was a shared-set fixture retaining incompatible `createPage` Base metadata; the fixture was corrected without relaxing product validation.

With default resolution and omission-reset coverage added, **193/193** focused tests passed. A subsequent meaningful no-op check exposed four failures: omitting an already-effective local false/none erased that declaration because the old generic preservation compared raw values. The pre-fix adaptive source and red log are retained. A narrow comparison through `resolveResizePins` corrected this for the four author fields.

Final verification: **197/197** in seven files, including **46 new pin-model tests**. `npx tsc --noEmit` exited 0. Commands, logs, all intermediate counts, before/after source hashes and final source hashes are recorded in the companion JSON.

No full suite, browser, desktop, packaging or release verification was run by this task. The native import/UI/controller work belongs to separate owners. Static CIL replay counts are not included in product-test totals.
