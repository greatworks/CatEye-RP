# Selection indicator: independent product geometry review

The new `tests/selection-indicator.test.ts` passes **261/261**, and `npx tsc --noEmit` exits 0. The test uses both the module factory and its bare serialized `toString()` form. This review changed only that new test and these new reports. It did not modify product code, retained source evidence, or previous tests.

The independent oracles are the unchanged `selection-layout-border-geometry-probes.json` (SHA-256 `73c51956fdf08edc054c39139aba8da17eb7130d8afa945ed62dfb58a94444c6`) and `selection-layout-indicator-glyph-probes.json` (`3abef9322455e3d0e32c6e40cddac26fe908cd92d788974325fb083c91b541a8`). The test checks exact file bytes before consuming the matrices.

The retained probes are bounded interpretations of source CIL with declared graphics sinks. They are not original DLL execution or native rasterization. Their input/output records were not regenerated with the product helper.

For each factory, the new test executes:

- **45 border records:** 15 checkbox rectangle paths, 15 radio inset-rectangle records, and 15 radio four-cubic fill/stroke paths. The paths emitted to the SVG sink are parsed and compared point by point, including controls, to the retained outputs. The radio uses the retained `.78 / (1-.78)` template rather than an SVG `circle`.
- **56 glyph records:** all retained checkbox/radio, size and disabled/fill-input combinations. Forty-eight positive-size cases compare the mark geometry after removing the source fixture's translation and centering offset. Eight lower-level zero-size records verify the product's explicit rejection; their existence does not establish native author acceptance.
- **21 unsupported-domain cases:** missing, zero, negative or nonfinite P94; invalid or excessive stroke; rotation/type; corners; partial/nonuniform borders; non-solid patterns; gradients; active shadows; transparent/alpha paint. Rejected source input produces no partial SVG writes.
- **6 accepted opaque color spellings** with explicit inactive effects and uniform border/corner data.
- **2 state/identity cases:** checkbox and radio keep their SVG child identities and geometry while colors/selected state change. `selected=false, checked=true` hides the mark; the inverse shows it. Only absent selected falls back to checked.

That is 130 tests per factory plus one oracle-hash/matrix-integrity test. The reported 261 are product tests, not 261 new native-source probes.

The dot checks use the retained glyph ellipse bounds and the separately retained circle template to compare all four cubics. Initial radio drawing must remain fill-only (`stroke:none`, no stroke-width attribute). The supplementary source chain is `Radio.SIll → N95X.V9Hm` from the existing indicator report, plus `R57t.r57L` token **100719853** in `selection-layout-border-ellipse-container-cil.json` and `dHbV.G3jJ` token **100723564** in `line-style-svg-writer-cil.json`. The latter constructs the brush-only drawing carrier; the runtime `_applySvg` generic stroke mutation is a separate path. This initial-path test does not claim that all dynamic SVG mutations have been integrated.

The bounded product viewport is a `b × b`, overflow-visible SVG at the supplied local indicator origin. That viewport/crop policy is explicitly independent; the source probes do not prove the native asset's complete crop, shadow expansion, clipping, cap/join pixels or theme colors. The test's minimal SVG sink checks attributes, geometry, identity and mutation, not browser painting.

One additional host-domain defect was found by reading the initial implementation: `selection-display.update` checked only the immutable source, then painted the current style. A plain source whose selected/action style acquired a gradient or active shadow could therefore enter the bounded SVG path and clear the owner's complex paint. The parent fixed this by also checking `indicator.supports(current)` and deleting the cached entry before fallback. The fixed condition is independently confirmed in the source snapshot recorded by this report. This was a static review finding; no pre-fix browser failure or red test is claimed. The 261 indicator tests do not count as end-to-end verification of that host fallback.

The final reviewed indicator SHA is `3f4e2cd66dedb79a0d94f21b987b6b73aa597ea1cde8f63c8669eec4a5ca2fc4`; test SHA is `0917c300345884ebe3f35ff5ae8e4130b182bf2a847f956512609790e5017d8c`. Exact source snapshots, all oracle/CIL/result references and the fixed host condition are in `selection-indicator-review.json`.

No unresolved blocker was found within the declared opaque-solid, zero-radius, ordinary-unrotated source domain. Complex paint and unsupported geometry intentionally retain fallback. Actual browser label activation, fonts, full state/adaptive asset behavior and original-GUI pixels remain separate verification obligations.
