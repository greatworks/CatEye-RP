# RP11 rotation and transform: bounded runtime evidence

This stage reads the retained 11.0.0.4150 distribution and executes selected, hash-checked JavaScript functions in Node VM. DOM, computed CSS and animation are explicit mock sinks. It does **not** launch the vendor app, execute its managed assembly, or establish original-GUI/pixel equivalence. Earlier stages did launch the original app; that is separate from these probes.

## Identity and reproducibility

- Extraction: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Distribution SHA256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- `AxureRP11.dll`: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- `math.js`: `f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883`.
- `move.js`: `c823954b5ed5862d56176b8984837e8f26588540ee4768d4483d68a399b95644`.
- `axQuery.std.js`: `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd`.

Run `node research/scripts/probe-rotation-runtime.mjs`: **27/27** original-function probes pass. `rotation-runtime-probes.json` records each result and each exact slice's hash. `rotation-runtime-evidence.json` binds the local research files and full original source paths/hashes. All new `*-cil.json` files come from PEReader metadata/IL inspection, not DLL execution.

## Implementable center-rotation contract

1. **Degrees, clockwise in screen coordinates.** `math.js:217–223` uses `(cos*x - sin*y, sin*x + cos*y)`. Because screen Y grows downwards, positive 90 maps a rightward displacement to a downward one. `103–109` subtracts the supplied center, rotates, then adds the center. It does not round degrees or coordinates.
2. **Ordinary rotate has center 50%/50%.** `move.js:337–381` explicitly states this center and writes a CSS `rotate(newDegree deg)` transform to the widget element. It does not set an origin itself or change CSS left/top/width/height. Preserve the unrotated layout rectangle; do not replace it with a rotated AABB and then rotate that AABB again.
3. **AABB is a separate query.** `math.js:130–149` rotates all four rectangle corners around `centerPoint` and takes minima/maxima. At `(10,20,100,60)`, 90° gives `(30,0,60,100)` while the center remains `(60,50)`. Arbitrary fractional sample angle `89.13596303062127` is preserved by the computation.
4. **Fit includes rotated children.** `axQuery.std.js:1325–1352,1368–1371` queries each eligible child's `offsetBoundingRect()` without `ignoreRotation`. `1554–1569` applies the above AABB. Hidden, limbo and horizontally fixed panel children are skipped; empty layers are skipped; accumulated right/bottom start at zero. `visibility.js:735–750` sets fit-panel width/height from the resulting **right/bottom**, not AABB width/height. Negative extents therefore do not turn into a positive-origin translation. Nested fit still follows the existing container traversal and visibility rules.
5. **Geometry expression versus painted bounds differs.** The previous `widget-geometry-evidence.md` established `doc.js` providers' `offsetBoundingRect(true,true)` path for layout geometry. It intentionally excludes rotation and outer shadow. Do not replace all This.x/width reads with a visual AABB.

Recommended existing-model use: finite `rotation` in degrees plus unchanged `x/y/width/height`; center-origin CSS/SVG container rotation; a separate reusable center-rotated AABB for fit. No general matrix or new persisted transform fields are justified by the 12 observed rotated imports alone.

## Original action semantics and limits

- `move.js:338–381`: absolute mode subtracts current degree first; relative mode adds. A zero delta fires the animation queue if requested but does **not** call completion or annotation adjustment. A nonzero immediate action records the angle, writes CSS, fires queue, calls completion, then adjusts annotation.
- This path **replaces** a pre-existing transform with a pure rotate string. It does not preserve scale or translation. Do not describe arbitrary scale+rotate composition as original ordinary-rotate behavior.
- `move.js:383–440` is a separate compound path. It reads the existing CSS matrix, left-multiplies its linear part by the new rotation, and rotates the component's translated center about the supplied center. This preserves a prior nonuniform scale in the matrix. The probe's `(scaleX=2,scaleY=3,tx=7,ty=8)` with a 90° rotation about the original center produces CSS matrix approximately `(0,2,-3,0,-8,7)`.
- `math.js:30–44` matrix multiplication applies the right operand first. `85–87` serializes CSS order `(m11,m21,m12,m22,tx,ty)`. This proves the math API's order; it does **not** by itself prove the P1401 CSS declaration order.
- `action.js:1061–1065` lists image, hotspot, dynamic panel, vector shape and horizontal/vertical line as rotation-capable children for group/offset rotation. `1110–1158` recursively enumerates layer children including hidden ones: eligible children rotate and orbit; other children orbit without their own orientation changing. `axQuery.std.js:541–567` implements that distinction and calls fit-parent after completion. Centered ordinary action dispatch is separate and does not consult this child filter.
- Dynamic panel DOM rotation naturally transforms the panel subtree. A native layer action instead distributes movement/rotation to descendants. Do not equate a product panel/group implementation with every native container.

### Getter quirks, preserved as evidence rather than universal normalization

`move.js:442–491` first matches an inline **integer** `rotate(...)` string, retaining signed and multi-turn values (e.g. -450). A fractional string falls through to computed matrix and returns `atan2(b,a)` normalized to [0,360), e.g. -0.5→359.5. Reflection `matrix(-2,0,0,3,...)` reports 180. Layers read `layerDegree` data instead. Missing element returns NaN.

`axQuery.std.js:1554–1570` chooses truthy visibility override, then truthy `data-rotation` attribute, then full style rotation. Numeric override zero falls through; attribute string `'0'` does not. These quirks are verified function behavior, not a proposal to introduce stale-zero state into the reconstruction.

## P50 versus P1401/P1402: static managed evidence

Format-side census and exact property metadata are retained in `rotation-format-census.json`, `rotation-format-properties-cil.json`, and `rotation-format-transform-cil.json`. P50 is Rotation; P1401 is the five-field transform object; P1402 is a point origin. All 715 observed P1401 values are identity and all 715 P1402 values are `(50,50)`. The 12 nonzero P50 candidates are VectorShapes: six 180° and six 89.13596303062127°, with no local P1401/P1402. This is a corpus observation, not proof that arbitrary transform values are invalid in Axure.

- `KJm7.get_HtmlRect` **100695393**, IL8 returns `get_Rect` **100695369**; that method reads `get_Location` at IL8 and `get_Size` at IL14 and constructs a rectangle. No rotation/bounds preprocessing occurs in these two methods. Evidence: `rotation-runtime-widget-cil.json`, `rotation-runtime-rect-cil.json`.
- `KJm7.uIuQ` **100695380** is the Rotation getter. It has a cached angle (`RJZ6`) path, a resolved Transform.Rotate path, then a Rotation-capability/P50 path. The cache-valid method `aJqQ` **100695378** compares against sentinel `-37022760`. **Do not add P50 and Transform.Rotate or use cache identity Rotate=0 to overwrite P50.**
- `jtoq.get_Transform` **100717844** has a disable-transform flag gate, a Transform-capability gate (IL780–791), and style-chain/base-style lookups of P1401 with `O5FO.a5FY` overridden+determined tests. The independent format investigation identifies the flag as a `TrapDisableTranform` mechanism. A resolved cache entry printed by the research reader is not automatically an active transform in every original generator context.
- The format agent's follow-up `rotation-format-style-chain-cil.json` narrows that distinction: `WtTU.get_Item` **100717163** reads its local dictionary with a null fallback, not a materialized document-default lookup; `ctw6` **100717140** compares the style ID against an original special GUID before some chain entries are skipped. `get_Transform` separately checks BaseStyle/local carriers and OD. The GUID literal remains opaque. All 12 candidates have no local/matched-base transform; their identity values came from the reader's document-default cache. Consequently the proposed import subset must inspect carrier provenance, not merely the flattened effective object.
- `KJm7.gJpc` **100695614** emits default origin `(50,50)` at IL19/28 and IL143/152; it can inspect active interaction style overrides for transform/origin. `JJUg` **100695611**→`jtoq.s5VM` **100717846**→origin provider.
- Capability checks: Rotation bit `1099511627776` (2^40), Transform bit `2305843009213693952` (2^61), from `tHej.Rotation` **100725016** and `tHej.Transform` **100725033**. VectorShape's base capability constant contains both. Therefore “VectorShape cannot have Transform” is **not** a valid simplification.
- **CSS writer path:** `JNLP.SNLp` **100699217**, IL649 calls `KJm7.AJU3`→`jtoq.get_Transform`, then IL655 `INLw` **100699229**→`yNLs` **100699231**. `yNLs` appends values **ScaleX, ScaleY, TranslateX, TranslateY, Rotate** at IL101,148,195,248,301, with 59 literal characters around five formatted values. The literal strings pass through obfuscated `sIho`, which this stage did not decode. This proves field order in the emitted formatted string, **not** the exact function names/units or operational composition order.
- Origin writer `QNLl` **100699232** reads X then Y at IL80/142; literal property name and separators remain opaque. The `(50,50)` default agrees with the shipped ordinary-rotation center comment, but arbitrary-origin percent/pixel semantics remain unverified.
- Shape HTML method `FNiU.vNPI` **100699653** obtains Rotation at IL104 and HtmlRect at IL442 and passes them to its downstream shape writers. This is static dataflow evidence; emitted literal CSS for the full original page was not captured.
- Text has an independent `TextRotation`: `wJe6.jJeK` **100694305**, IL990–1001 subtracts widget Rotation from TextRotation before deciding whether to output a text-specific property. Whole-widget rotation must not be advertised as supporting independently rotated text.

## Safe scope and unresolved items

The runtime center/direction/AABB behavior is directly proved. The sample-driven importer can target the **local P50, no local or matched-base transform/origin, complete identity/default cache** subset using the carrier distinction above. Explicit P1401 (even identity competing with nonzero P50), explicit nondefault origin, local competing rotation/transform, and independent text rotation remain separate unsupported paths. Keep the original unsupported interaction graph rejection; geometry recovery must not accidentally admit lossy actions.

Remaining unknowns: exact general P1401 scale/translate/rotate CSS token sequence and application order; whether translation fields use px under every output mode; nondefault origin units; arbitrary transform interaction-state precedence in final DOM; custom transform plus rotate action browser results; original generated CSS/GUI for the 12 candidates. The previous native vector work also retains shape-regeneration, snapping, border and final-paint caveats. No generic matrix implementation, vendor GUI equality, or extra downloads are claimed here.
