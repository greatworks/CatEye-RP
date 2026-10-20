# Axure RP 11 gradient fill runtime evidence

Scope: the retained 11.0.0.4150 distribution, static shipped JavaScript plus 22 exact-function Node VM probes with mocked DOM/CSS sinks. These probes do not run the original application or measure its GUI. Earlier native GUI capture remains blocked; it was not retried. Product browser checks are separately identified below.

## Provenance

- Package SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Original root: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`.
- `style.js`: `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`.
- `math.js`: `f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883`.
- Executable harness: [probe-gradient-runtime.mjs](scripts/probe-gradient-runtime.mjs). Its output [gradient-runtime-probes.json](gradient-runtime-probes.json) binds complete source hashes and exact slice hashes, records 22/22 assertions, and labels mocked sinks explicitly. It reads the original functions at run time; no vendor implementation is copied into the product.

## Runtime coordinates and colors

`style.js:1499–1550` accepts linear fill `startPoint`, `endPoint` and `stops`. Coordinates are `viewBox origin + normalized coordinate × widget dimension`, independently for x/width and y/height. Points outside 0..1 remain meaningful. An angle alone cannot express this data without loss. The runtime does not read an angle field in this path.

`style.js:1552–1628` accepts radial `center`, `axis1`, `axis2`, all absolute normalized points. It first scales the points by width and height. Let a be the physical center-to-axis1 length and b the center-to-axis2 length. Radius is max(a,b); the ellipse scale is `(a/b,1)` when a<b, otherwise `(1,b/a)`. Rotation comes only from the physical center-to-axis1 direction. The final matrix rotates the scale around the viewBox-adjusted center. Axis2's direction is discarded; only its length participates. Thus arbitrary axis pairs are not a general affine basis. The probes cover non-square bounds, a 90-degree axis, an offset viewBox, and two axis2 endpoints with identical lengths.

`style.js:2518–2528` extracts per-stop color from unsigned ARGB; alpha is the high byte divided by 255. The gradient helpers do not multiply a separate `fill.opacity`. Solid fill instead uses RGB plus the explicit opacity (`2503–2516`). Exported-color and raw native signed-color representations must not be confused.

New definitions keep source stop order, raw offsets, duplicates and alpha. No runtime sorting/clamping appears in these helpers. The model's ordered 0..1 offsets, minimum two/maximum 100 stops and finite ±1000 coordinates are explicit product limits, not inferred native editor limits. Equal offsets are kept in order for hard transitions. SVG uses its default color interpolation and spread behavior; the helpers do not set `color-interpolation` or `spreadMethod` and do not define a separate radial focal point.

## State transitions and the default-definition quirk

`style.js:1794–1847` and `1869–1879` use shallow style combination. The fill object is atomic: an absent state fill inherits, and a solid or another gradient replaces the whole object. The probes cover selected over hover, selected over adaptive, transparent solid clearing, and state absence. The independent model keeps legacy `fill:string` plus `fillGradient`; a patch containing `fill` without `fillGradient` clears the inherited gradient.

SVG fill painting is `1157–1180`; its declaration replaces the entire generated style text at `1026–1034`. A solid writes direct RGBA fill, while an absent fill writes an empty selector and lets the underlying definition apply. Gradient border code also exists at `1182–1218`; border-gradient authoring/rendering is outside this fill milestone.

There is a proven provenance-dependent quirk. Both gradient insertion helpers remove `.temp_fill` definitions before resolving the currently painted gradient. If that current definition is an original/default definition of the same type and stop count, the helpers update coordinate attributes and emit new stop colors with `stop-opacity:1` but **never update stop offsets** (`1514–1526`, `1592–1606`). A changed type or stop count instead creates a temporary definition. On later paints, a temporary definition is deleted before lookup and recreated using the newly requested offsets. This is not a universal rule that all same-count changes ignore offsets.

The author canvas paints the requested design. Runtime vector instances retain the original-offset behavior until their first temporary-gradient or solid paint; separate row instances keep separate paint sessions. Pure runtime document state still contains the requested gradient, and rendering never writes this quirk back into saved design data.

## Type gates and boundaries

- The inspected SVG path supports linear and radial fill, and the same helpers also support stroke. Shape path rendering is the strongest runtime evidence here.
- The image painter `style.js:706–812` has no gradient fill surface. Its border branch (`754–756`) simplifies linear border fill to the first color; this does not establish full image-gradient support.
- Independent product fill rendering excludes image, line, hotspot and inline-frame surfaces. Ordinary boxes, ellipses, text backgrounds, cells, containers and native-form wrapper backgrounds use an SVG image background with the same point computation. This is a bounded independent renderer; it is not a claim that every original generator emits identical DOM/CSS for every type.
- Generated SVG backgrounds are transparent behind semi-transparent stops. They must not composite over the legacy solid fallback stored beside `fillGradient`. Text and child fills remain separate. Vector gradients fill only the path and coexist with separate shadow filters/strokes.
- A zero radial axis is accepted as saved data. Original axis1=0 writes NaN matrix terms; axis2=0 writes a singular matrix. Browser outcomes for these malformed/degenerate original definitions were not established by the mocked probes. The product deliberately paints no fill for either zero axis using an explicit empty-paint result; this is not implemented merely as SVG r=0 (which has different SVG semantics).
- Runtime SVG definition IDs are unique per mounted instance and repeat row. SVG attributes/stop colors are written through DOM APIs; the portable runtime does not use `innerHTML` or executable document markup. Rectangular background SVG is escaped and percent-encoded data, not a user CSS blob.
- `currentColor` stop colors, including surrounding whitespace, are resolved to the widget's text color before creating an external SVG background. When that text color is itself `currentColor`/`inherit`/`unset`, the mounted element supplies its actual computed color. Author rendering uses a hidden marker and a layout effect only for this context-dependent case; the effect reruns after ancestor edits. Preview/offline resolve the same actual context. Vector definitions inherit the actual SVG context color directly.
- Background gradients use actual logical paint dimensions, including computed repeater layout size, rather than stretching an image computed for stale stored dimensions. This distinction matters for rotated radial axes on non-square repeaters. Parent transforms/rotation are not incorrectly substituted for the widget's logical width and height.

## Independent implementation verification

`tests/gradient-runtime.test.ts`: 16 tests, module and serialized-factory modes plus static layout projection. They cover physical coordinate/matrix results, duplicate-stop order, degenerate signaling, encoded/computed currentColor, SVG offset provenance, independent row sessions, SetStyle/solid clearing, failed-action rollback, row refresh, design immutability and root/child portable factory inclusion. Final focused run: these 16 + the parent's 11 model + 12 export + 12 selection tests = **51/51**; typecheck also passed.

`tests/e2e/gradient-runtime.spec.ts`: **2/2 passed**, preview and actual exported offline HTML, final run 21.0 seconds. It includes pixel samples for hard stops, transparent fallback, a clipped triangle and a rotated radial ellipse; explicit no-fill degenerate axes; shadow/gradient coexistence; repeated-instance IDs and hover isolation; the native default-offset quirk; solid/gradient clearing; nested fixed players; and saved design equality. Additional real canvas/preview/offline pixels cover inherited parent color, live parent color changes (Inspector + Undo and runtime SetStyle), and an asymmetric radial repeater whose actual layout dimensions differ from stored dimensions. Both final screenshots were opened and visually inspected: the triangle/shadow, independent child, repeated rows and matching asymmetric radial comparison tiles agree with the measured results. Source-bound hashes are recorded in the accompanying manifest.

Native storage and generator mapping are investigated independently in [gradient-format-evidence.md](gradient-format-evidence.md). The nine recovered direct owners are all VectorShape paths (eight Starter, one Basics). The generator preprocessing applies nonzero native linear angle before producing endpoints; this milestone's native importer accepts only explicit angle0, covering the real corpus. Runtime function probes alone do not prove serialized angle transforms or native initial generator paint.
