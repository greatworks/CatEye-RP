# Shadow runtime evidence — Axure RP 11.0.0.4150

Scope: retained official JavaScript, exact-function NodeVM experiments with **mocked DOM/style sinks**, and independent product tests. The 24 original-function probes do not launch a browser or the vendor application, and do not establish native GUI or pixel parity. Earlier stages launched Axure but the unchanged GUI capture bridge remained unavailable; it was not retried here.

Source identity: distribution SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; extraction evidence `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. Source root is `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`. The manifest records absolute paths and full hashes.

## Confirmed runtime contract

| Concern | Observed original behavior | Source |
|---|---|---|
| Representation | `outerShadow`, `innerShadow`, `textShadow` contain `on`, Cartesian `offsetX/offsetY`, `blurRadius`, RGBA color; inner additionally reads `spread`. No angle conversion was found in these bounded functions. | `style.js:776–799`, `1390–1494`, `2460–2462` |
| Object replacement | Default, named, authored, adaptive and active state layers use shallow `$.extend`. A higher layer replaces one entire shadow object. Missing property inherits; explicit `{on:false}` disables; it is not a recursive field merge. | `style.js:1794–1915`; probes 7–13 |
| State priority | Adaptive → normal state → hover → down → focus → selected → error → hint → disabled. Existing pointer/focus gating is separately documented in `interaction-styles-evidence.md`. | `style.js:1794–1847` |
| Text | CSS is `xpx ypx blurpx rgba(...)`, or `none` when off. It is assigned to paragraph and apply-all properties, **not run properties or anchor elements**. | `style.js:2444–2498`; probes 1–6 |
| Rich text reset | A state repaint resets cached descendant inline styles first and applies text overrides. `textShadow` is absent from the rich-set font exclusion set, so adaptive textShadow survives Set Rich Text's font exclusion. | `style.js:1647–1679`, `1763–1775`, `1803–1809`, `2028–2042`, `2592–2611`; probe 14 |
| SVG outer | `filter:drop-shadow(xpx ypx blurRadiuspx color)` is on the SVG root. Blur is passed **without halving**, unlike the inner filter below. Off/absence emits the new SVG rule without a filter. The surrounding style text is repainted, so the old filter declaration does not persist. | `style.js:1390–1404`; probes 15–16 |
| SVG inner | Filter targets `.fill` and `.background-image`, not stroke/text. Offset uses SourceGraphic; morphology erodes by `borderWidth+spread`; Gaussian standard deviation is `blurRadius/2`; inverse/composite/flood steps paint the inner shadow over the source. Filter region is `-50%,-50%,200%,200%`, objectBoundingBox. | `style.js:1406–1494`; probes 17–20 |
| SVG inner clearing | Existing primitives are reused/updated. Off leaves the unused defs but emits no active CSS reference. No `color-interpolation-filters` override appears in this function; SVG's default applies. | `style.js:1408–1423`, `1429–1494`; probes 18–19 |
| Images | Painter first clears img inline style, then writes outer `box-shadow:x y blur 0px rgba(...)`. Supplied outer `spread` is not read. This function ignores innerShadow and textShadow. Off or absence removes previous outer shadow through the inline-style reset. | `style.js:706–812`; probes 21–24 |

Text-shadow is an inherited CSS property. The product therefore places it on the actual text/control layer, and explicitly sets widget roots to `none`, preventing a panel's text shadow from leaking into independent nested widgets. This is an implementation of the observed text-layer distinction; the original generator's complete wrapper markup has not been reproduced.

## Geometry boundary

`axQuery.std.js:1438–1575` has distinct ignore-rotation/ignore-outer-shadow modes. In the authored location branch, a negative offset extends the left/top by `offset - blur`; in the authored size branch an enabled outer shadow adds `abs(offset)+blur` to each dimension. Moved-location and resized-size shortcuts bypass the respective authored shadow adjustments. This is a static observation, not a new geometry implementation in this milestone.

`doc.js:455–464` explicitly calls `offsetBoundingRect(true,true)` for expression geometry, ignoring outer shadow. This milestone leaves widget layout, fit-to-content and expression geometry unchanged. It does not claim generic CSS ink bounds equal those native query bounds, nor broaden the prior fit contract.

## Proposed and implemented data boundary

`ShadowStyle = {on,offsetX,offsetY,blurRadius,color}`; `InnerShadowStyle` additionally requires `spread`. Color is the product's validated CSS color string. Three optional complete objects live on WidgetStyle; explicit off retains all fields for author editing. No angle or distance is fabricated. Native import color/flags/type parsing belongs to the independent format investigation (`shadow-format-*`).

Independent review found that arbitrary alphabetic color strings accepted by the legacy general color parser could produce invalid CSS shadow declarations and leave an old paint in place. The parent implemented a dedicated strict shadow-color parser; unsupported names, CSS-wide tokens and malformed color functions are rejected before rendering. This hardening is scoped to the new shadow fields.

The retained corpus has no nonzero spread observed by the format investigation. Outer/text spread is not represented by this model; native nonzero outer/text spread must remain explicitly unsupported. Inner spread is retained because the original SVG painter reads it.

## Product renderer choices and limits

- SVG paths: independent SVG outer filter; separate fill path with original inner primitive graph; separate stroke path; text remains outside the filtered SVG. Filter IDs encode a unique render-instance key, including repeated template instances. Closing an effect removes the active reference/defs. This harmless defs cleanup differs from the native unused-defs retention.
- Rectangular surfaces and form wrappers: CSS outer/inset box shadow. **Complete original generator CSS for every surface/form type is not established by these JS probes.** This is an explicit browser rendering choice, not proof of all-type native paint parity.
- Image outer shadow is placed on its coextensive widget box to avoid clipping by the product's existing image container. The source image painter targets the image itself; unusual borders/object-fit/alpha and original generator variants have not been compared pixel-for-pixel. Image inner/text effects are not drawn by this implementation.
- Text shadows apply to text layers and native inputs/selects. Rich runs inherit the paragraph/text-layer shadow; the run schema has no per-run shadow. The existing widget text clip and ancestor clips remain intact.
- Line outer shadow affects only the line graphic. Inline frames and hotspots ignore all shadow fields. Container widgets have surface shadows but no newly invented own text layer.
- Late managed evidence: `shadow-format-css-sites-cil.json`, `FNiU.RNPh` / GetPanelBackgroundCss calls the combined formatter with `inner=null`. Dynamic panels therefore draw only outer shadow; stored inner/text values remain preserved but inactive. This does not infer the same gate for repeaters. Generic formatter paths also pass a blur-halving flag whose full element/CSS-property mapping remains unresolved; they do not establish universal SVG/box pixel equivalence.
- SVG filter default color interpolation and clipping region follow the observed primitive definition. Large-blur filter-region clipping, arbitrary complex paths, text font rasterization, background images and transparent fill edge cases are not a native GUI parity claim.
- No vendor runtime or source fragment is copied into product code. The research harness reads narrowly pinned original slices only at experiment time. The renderer helper is an independent, self-contained factory serialized into both root and nested offline players.

## Verification artifacts

`research/scripts/probe-shadow-runtime.mjs` writes `research/shadow-runtime-probes.json`: 24/24 exact-source NodeVM observations. Each source slice is hashed. The JSON distinguishes those mocked sinks from real browser product verification.

Product focused verification: `tests/shadow-runtime.test.ts` covers module and serialized helper/runtime paths, state reset, rich-text preservation, transaction rollback and row isolation/refresh. `tests/e2e/shadow-runtime.spec.ts` uses real imports, Preview and downloaded offline HTML. It checks actual screenshot pixels for a triangular outer silhouette, inner-only fill and parent clipping; repeated filter IDs; focus/hover/off/on; design immutability; embedded player helper availability. Final counts and hashes are in `shadow-runtime-evidence.json`.

Final focused results: TypeScript check passed; 11 new module/serialized tests plus 12 existing export tests passed. Three real Edge tests passed: Preview, downloaded offline file, and a local non-loopback HTTP server delivering the downloaded HTML. The HTTP page verifies `isSecureContext=false`, `crypto.randomUUID` absent, and `getRandomValues` available; both root and nested player render. Render-only filter identity uses the latter API and does not require HTTPS. These are product browser checks, distinct from the original-function NodeVM evidence.

Independent native import check: `probe-shadow-import-review.mjs` rereads Sample form patterns.rplib and follows each of six Choice widgets through MyStyle→IX.Selected→OD PName72. All six have (0,0), blur7, ARGB874420439, spread0; the imported color is `#1e98d734`. The original 52/SelectedChange event, one-case/two-toggle cardinality, action order and package-local target IDs match the imported audit (6/6). This check reuses the existing interaction decoder for enum semantics and is not a second independent implementation of the binary format.
