# Axure RP 11 gradient border runtime evidence

This stage inspects retained Axure RP 11.0.0.4150 JavaScript and runs exact extracted function slices in Node VM with mocked DOM/CSS sinks. It does **not** run the original GUI or establish original generated-page pixel parity. The earlier GUI capture blocker was not retried. The independent application browser checks below are a separate evidence class.

## Source identity

- Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Extraction Evidence ID: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Root: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`.
- `style.js`: `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`.
- `math.js`: `f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883`.
- [probe-gradient-border-runtime.mjs](scripts/probe-gradient-border-runtime.mjs) reads the original files at execution time, verifies their hashes and records every function-slice hash in [gradient-border-runtime-probes.json](gradient-border-runtime-probes.json). **19/19** assertions passed. No vendor function is copied into product source.

## Proven original behavior

`style.js:1182–1218` consumes one atomic `borderFill`. Solid writes a direct RGBA stroke; linear and radial call the same coordinate helpers as fill, with `propName='stroke'`. A newly created gradient paints both the path stroke and arrowhead fill/stroke. Reusing an existing definition instead updates arrowhead attributes from the current path's computed stroke. Linear and radial helper coordinates, physical-axis radial matrix, duplicate-stop order and unsigned-ARGB alpha are the same as the preceding [fill investigation](gradient-runtime-evidence.md), at `1499–1628` / `2503–2532`.

The helper removes `.temp_stroke`, independently of `.temp_fill`. An original/default definition with unchanged gradient kind and stop count retains **its original offsets**, while coordinates and stop colors update. A temporary definition is removed before the next lookup and rebuilt with new offsets. Therefore each channel and mounted row instance needs separate provenance; clearing stroke must not discard the fill's original-definition status. The probes cover both channels surviving simultaneously, default reuse, temporary replacement and arrowhead attributes.

`style.js:1763–1915` combines style objects shallowly. A selected `borderFill` replaces hover/adaptive `borderFill` as a complete object; an absent border inherits. The independent model retains legacy `stroke` and adds `strokeGradient`. An explicit `stroke` patch with no `strokeGradient` clears an inherited gradient, without changing fill. This rule is applied in author/adaptive resolution and both serialized runtime style-merging closures.

### Geometry and source type branches

- `1219–1221`: line pattern `none` suppresses stroke and arrowhead fill, even if a gradient exists.
- `1223–1340`: the Rectangle branch rebuilds the border path using visible sides, a uniform border width, rounded dimensions, enabled corners and inset stroke centerlines. It separately rebuilds the fill outline. This is not a CSS `border-image` nine-slice mapping.
- `1341–1353`: a non-rectangle closed path carrying a mask receives twice the requested width for clipped inward painting. An unmasked/open path receives the requested width. `1357–1359` scales dash-array entries by border width.
- `1373`: line SVG overflow is visible. `1375–1386`: checkbox check-mark width is independent; a radio check's fill is assigned only for a solid border in this branch. These generated-control details do not imply our HTML checkbox/radio glyphs are identical.
- Native arrowheads, hidden-edge path reconstruction, masked inward vector stroke and line-pattern authoring are not introduced by this milestone. Existing independent vector stroke alignment remains unchanged, and no final-paint parity claim is made for those features.

### Image border is a different branch

`style.js:753–768` does not create a gradient definition for images. With a border-width gate, linear reads `borderFill.colors[0].color`, then splits that unsigned ARGB value into RGBA. The first color's alpha is retained; a separate fill opacity is not consulted. Radial falls through to numeric **0**, which becomes **transparent black**, not opaque black. Empty `colors` on a linear gradient throws `TypeError`; when the border-width gate is false that lookup is not evaluated. The exact source block plus `_rgbaToFunc` (`810–812`) is probed. The model requires at least two stops, so it cannot create the empty-color case.

Product image borders preserve this observed first-stop / radial-transparent result while storing the entire structured gradient. `strokeMode('image') === 'imageFallback'` lets author UI explain the distinction. Inline frames and hotspots do not paint gradient borders. Other ordinary rectangular, elliptical, form-wrapper, cell and container surfaces use the independent continuous-border renderer described below; their complete native initial HTML/CSS generation gates have not been proven by these function probes.

## Independent rendering contract

- `createGradientRenderer` remains one self-contained factory shared by author canvas, React preview, offline HTML and embedded fixed players. Existing fill methods remain available. It adds `supportsStroke`, `strokeMode`, `strokeColor`, `border`, and `backgrounds`.
- Vector fill and stroke use independent SVG definition IDs and paint sessions. Repeated rows receive unique IDs. Inner-shadow filters remain separate definitions; the outer shadow still sees the graphic contour, not a rectangle around text or children. Plain line widgets now use a true SVG line in both renderers, preserving visible overflow and the existing shadow filter.
- Ordinary surfaces retain real CSS border widths for layout, native controls and hit testing. A transparent CSS border is painted by one full-widget SVG border silhouette, above any fill layer. This avoids independent stretching of the nine sections of `border-image`. Rounded rectangles and ellipses subtract the inset inner contour from the outer contour. The inner contour is clipped to the padding rectangle, which is essential when an extreme width consumes most of a large corner radius.
- The first implementation exposed 109 incorrect fully opaque/empty interior pixels in both preview and offline for a 100×80 box, corner radii `[0,70,0,0]`, widths `[8,1,8,70]`. Clipping the inner hole to the actual padding bounds fixed the discrepancy. The regression compares against a same-color real CSS border; it does not weaken the assertion or infer original Axure pixels.
- Background layers use **border-box** origin and full logical paint dimensions. Fill and stroke endpoints do not get rescaled to the padding box. A gradient fill keeps background color transparent, so transparent stops reveal the ancestor rather than a saved solid fallback. A transparent stroke reveals the actual underlying fill/ancestor; it is not composited over the old solid stroke color.
- `currentColor` in external SVG images is resolved from the actual mounted widget color when inherited; parent color updates repaint it. SVG path definitions inherit their own DOM color. Image fallback uses the CSS border color path. User data is escaped in the data-SVG image, and SVG DOM definitions use namespace-aware DOM APIs. Portable functions contain no `innerHTML`, `eval`, or function-constructor execution.
- Degenerate radial axes retain their saved values and explicitly paint no gradient; the original NaN/singular matrix browser outcome remains unverified. Product coordinate/stop bounds are validation limits, not native editor limits.

## Verification and delivery

The shared [gradientBorderFixture](../tests/fixtures/gradient-borders.ts) exposes stable IDs `border-linear`, `border-radial`, `border-corners`, `border-vector`, `border-line`, `border-input`, `border-hard`, `border-parent`, `border-child`, `border-row`, `border-image`, `border-image-radial`. Controls `border-solid` and `border-restore` change only borders. The second page, **Embedded borders**, contains `border-frame` and executes the same serialized renderer.

Focused unit and real-browser results, final screenshots and exact source hashes are recorded in the adjacent JSON manifest. The browser cases compare three same-color gradient/CSS border masks (including the extreme case and 100×60 ellipse), sample alpha/image fallbacks and full-bounds fill/stroke pixels, resize a gradient surface, edit a real form control, exercise independent default-definition provenance, repeated-row hover state and nested players. The previous fill cases are rerun with the new border-box composition. This is application verification, not original Axure GUI comparison.

Managed storage and angle-version semantics are separately evidenced in [gradient-angle-evidence.md](gradient-angle-evidence.md). Its corpus has no actual gradient-stroke owner; native stroke import tests are explicitly CIL-supported synthetic graph cases. The older fill milestone's angle0-only boundary is superseded by that version-aware format investigation, not silently rewritten here.
