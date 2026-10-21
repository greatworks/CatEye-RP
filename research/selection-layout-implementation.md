# Selection control layout: work in progress

This stage is not a release acceptance record. The published
`release/verification.json` and Windows ZIP still identify the preceding
Layer-resize release. `fullAxureParity` remains false.

## Implemented data and import changes

- Preserve shared width-fit, height-fit, and indicator-right fields on
  checkbox/radio widgets. Old project files keep these fields absent.
- Preserve explicit P94 indicator size in normal, named, adaptive, interaction,
  and independent-project SetStyle data. This does not newly enable native
  ApplyStyleInfo action import. The finite 0–100000 bound is the product's
  storage policy, not proof of Axure's native UI limits.
- Recognize the witnessed native class spelling
  `Axure:DiagramObject:Checkbox`; retain the older `CheckBox` protocol spelling.
- Require identified style-cache provenance, active/determined P94, matching
  source identity, and explicit shared flags. Inactive local size entries
  inherit only from a resolved cache. Dedicated selection layout and ordinary
  style projections must agree on both the P94 value and its exact origin.
- Keep source geometry and rich text when importing. This step does not
  recompute native font layout.

The complete eleven-file comparison is retained in
`selection-layout-import-origin-checked.json`: ten admitted documents preserve the
entire previous document after explicitly removing new layout fields, new
checkboxes, and new Layer wrappers; one file retains its page-limit rejection.
There are twenty newly admitted checkboxes, ten newly closed Layers, and zero
changed previous widgets after that projection. The reader recognizes all
twenty-two raw Checkbox carriers; two remain inside already omitted panel
state graphs. Recognition is not the same as admission.

## Verification so far

- Final type checking and the isolated production build passed with unchanged
  source hashes.
- All 856 reader checks passed, including new malformed P94/state/adaptive
  cases.
- The first full unit run passed 4783 of 4787 tests. Four historical total-count
  expectations failed after the documented Checkbox/Layer additions.
  The complete failures remain in `.build/selection-layout-data-first-unit.json`.
  The corresponding tests retain their object, geometry, option, state, and
  persistence assertions; only the verified corpus totals were updated.
  The focused follow-up passed all 112 tests, retained in
  `.build/selection-layout-import-counts-green.json`.
- Author-layout and render contracts are separately researched in
  `selection-layout-transaction-evidence.md` and the `selection-layout-render-*`
  files. Bounded source probes do not establish original GUI behavior.
- Independent review reproduced acceptance of a missing ordinary P94 and an
  unrelated but well-formed cached-source identity. Four regression cases
  failed before the consistency check. After fixing it, all 116 focused tests
  passed, and the full corpus retained the same admissions and prior documents.
  An intermediate helper-name collision and its failing run are retained;
  `.build/selection-layout-import-origin-second.json` is the successful run.
- The final full unit run passes **5017/5017**, including 194 author-layout
  adapter cases and 32 runtime-core cases. The final production build passes
  **12/12 focused Edge tests**, with no skips, flakes, or failures. These cover
  new selection-field persistence and structural SetText breaks in preview and
  offline HTML, plus the existing shape AutoFit, selection dispatch, keyboard,
  and fixed-frame regressions. This is not a complete production-browser suite.
- Three existing shape-layout screenshots from that exact build were inspected.
  They are product regression evidence, not native selection pixel evidence.
- Final build/verification files use the `selection-layout-core-final-*`
  prefix. The first attempt at the final browser configuration incorrectly
  merged duplicate web servers and stopped before running tests; its report is
  retained. Object-spread configuration fixed the harness, and the successful
  browser report is
  `.build/.build/selection-layout-core-final-second-browser.json`.
- The build retains the existing Vite future-config-loader and large-chunk
  warnings. No dependency or unrelated build configuration was changed.

## Implemented computational core

`src/model/selection-layout.ts` supplies three distinct author entrypoints:
layout, external size assignment, and raw fit-flag change. It retains separate
measurements, the two rounding modes, size-before-location writes, reentry
guards, and partial-state diagnostics. The caller still supplies font
measurement, graphics-unit conversion, minimum size, and union behavior.
Only a successful candidate may be committed; that atomic policy is explicit.

`src/runtime/export-runtime.ts` supports selection SetText's native plain-run
structure and an optional `ControlHost.measureSelectionText` callback. When
that callback is installed, width candidates cause alignment Move while
selection owner sizes remain unchanged and no Resize event is emitted.
Indicator size is not added to the runtime candidate. Repeated measurement,
registration cleanup, legacy controls, and rollback have focused tests.

Selection height AutoFit is explicitly rejected when attempting the measured
runtime path, because the evidenced native nesting yields NaN. Nonfinite
candidate values or overflowing alignment are also rejected. This is a finite
geometry safety policy, not a claim to reproduce the native invalid result.
Measurement callbacks retain their host receiver. The failure cases and
follow-up fixes are preserved under `selection-layout-runtime-*`.

## Remaining work

Actual author font measurement, gesture/fit/style UI integration, selection
rendering, the DOM implementation of `measureSelectionText`, full production
browser checks, Windows packaging, and final acceptance remain in progress.
The author adapter is not wired to the Layer resize controller. Existing
preview/offline hosts do not yet install the new measurement callback; they
preserve geometry while the new SetText structure and saved data are exercised.
Imported indicator-size data alone does not make the existing HTML checkbox/radio
rendering equivalent.
The reader records either indicator alignment value, but native admission is
still restricted to left-indicator controls until rendering is integrated.

The 2026-10-20 original-editor attempt is recorded in
`selection-layout-gui-observation-20261020.md`. The window and menu tree were
readable; screenshots and input geometry still failed. No original canvas or
pixel comparison was completed.
