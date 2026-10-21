# Selection runtime measurement integration

2026-10-20. Unreleased work toward the complete Axure RP 11 reconstruction.
This follows the frozen `selection-layout-core-verification.json`; it does not
replace that historical result or assert full Axure parity.

## Implemented behavior

Preview, exported HTML and both fixed and recursively serialized frame players
now install the selection-specific DOM measurement host. SetText paints the
native plain-run structure before measuring, preserves explicit rich styles,
and measures each paragraph's direct spans. The candidate is the greatest
paragraph width plus horizontal padding. P94 is deliberately absent from this
runtime candidate; managed author layout has a separate contract.

The selection owner keeps its width and height. Alignment can move it and fire
Move without Resize. Repeating the same text can move it again because the
owner still has its authored width. A sole linked run is excluded by the
original direct-span query. Hidden controls use an isolated, removed measurement
copy; repeater rows and frame realms have separate effective data and DOM.
Normal source geometry, saved text and adaptive declarations are not rewritten
by Preview, export or save after running the prototype.

Height AutoFit remains explicitly rejected with transaction rollback because
the original generated label nesting makes its direct-child height query
produce NaN. This is the project's finite-geometry policy, not equivalent
painting of the native invalid result. The 39 previously examined source
controls all had height AutoFit disabled.

## Rendering fixes found through actual screenshots

The first host build passed the numeric movement tests, but its screenshot
showed the browser input disappearing under a long nowrap label in Preview.
A new test measured **zero visible input width** and failed before the fix.
The explicit selection branch now prevents input flex shrinking. Real clicks
on both checkbox and radio are verified, along with unchanged owner dimensions.
This remains an interim native-browser input renderer; the original uses SVG.

The next test hit-tested the final glyph beyond the unchanged owner width and
failed in both Preview and offline HTML because the owner clipped it.
The ordinary source selection writer has scrollbars zero and no emitted owner
clipping; the matching base CSS and controlled DOM probe retain visible
overflow. The selection-specific owner now permits that overflow. Ancestor
clipping is unchanged. This is bounded to controls with explicit selection
metadata and text-layout style, not a global overflow change.

## Evidence and verification

- `selection-layout-render-evidence.md` and its frozen browser probes establish
  the original runtime width contract. With the controlled monospace 16px/20px
  fixture, both control types produce candidate width135, retain owner100×20,
  and request right-alignment movement−35.
- `selection-layout-indicator-*` adds retained managed glyph/asset/CSS and
  shipped JavaScript consumer probes. These are not original GUI screenshots.
- `.build/selection-text-measure-implementation.json` binds the adapter's
  42 new cases and 36 prior shape cases, including bare serialized factories.
- `.build/selection-layout-measure-red.json` retains three old-build failures:
  Preview/offline/frame x400 instead of expected365.
- `.build/selection-layout-input-red.json` retains the zero-width Preview
  input failure. `.build/selection-layout-overflow-red.json` retains both
  final-glyph visibility failures.
- `.build/selection-layout-measure-visible-dist` is the isolated final build.
  Typecheck/build, **5,059/5,059 unit tests** and **17/17 focused production
  browser tests** pass. Three final-build screenshots were inspected.
  The records are bound in `selection-layout-runtime-verification.json`.
- The complete **337/337** browser run uses the earlier `measure-first` build,
  before the input-flex and owner-overflow fixes. Its outcome is recorded
  separately; it must not be described as a full run against the final build.
  The final focused run covers those changed branches and prior selection,
  keyboard, ordinary shape AutoFit, frame, offline and persistence behavior.

The original core's 856-reader result and ten-document corpus equality are
reused only after checking their inputs have not changed. Runtime measurement
does not alter the reader or native admission boundary.

## Remaining work

The actual SVG indicator, state/adaptive assets, P94 rendering, and computed
TextPanel layout still require implementation. The current renderer retains
browser input visuals and its existing label placement, so matching runtime
width does not establish initial rendering or pixel equivalence.

The author service must measure independently, keep browser-derived panel
snapshots transient, and commit owner geometry only for an explicit successful
author command. See `selection-layout-integration-review.md`. Native font
metrics, full graphics-unit conversion, author gestures/fit/style integration,
right-indicator native admission, Windows package acceptance and original GUI
comparison remain open. No new Windows release is promoted here.

The original editor's known screenshot/input-geometry bridge failure was not
retried without an external change. Its last observation remains recorded in
`selection-layout-gui-observation-20261020.md`.
