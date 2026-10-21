# Selection pointer rotation model

This stage implements the ordinary, zero-angle, multiple-checkbox/radio branch of the retained author controller. It does not replace runtime Rotate, arbitrary widget rotation, or the selection resize controller. `fullAxureParity=false`, `originalGuiCompared=false`, and `published=false` remain explicit. The companion JSON binds the final owned source bytes and evidence artifacts; browser/host/release results belong to the parent integration report.

## Interface and ownership

`prepareSelectionPointerRotate({targets,input,downPoint})` captures ordered `{id,type,ownerRect,rotation:0,locked?}` targets, the already selected mode-2 input, the original common bounds/pivot, and the real pointer-down point. It returns `{original,state}`. It requires no font service, text panel, selection fit flags, or document.

`planSelectionPointerRotate(original,state,{point,modifiers})` is a synchronous pure frame planner. Its successful result contains the next current owner rectangles, per-target `effects`, and diagnostic trace. Effects consist solely of complete `style.Location` pairs with `allViews:false, notify:true`. Unchanged locations and locked roots produce no persistent writes. The parent-owned `applySelectionAuthorWriteEffects` persists those effects in the current view and owns the document transaction.

The coordinated change to `selection-pointer-input.ts` extracts `projectSelectionPointerInput`, accepting a valid captured resize or rotation mode. The old `planSelectionPointerInput` remains resize-only and still rejects rotation. Grid/candidate/Alt/Shift calculations are shared unchanged; there is no fake resize mode and no copied second grid implementation. The exact prior input source is retained at `.build/selection-rotation-model-before/src/model/selection-pointer-input.ts` with SHA-256 `b15ed45f68c83bc3c5f866a9d259eca6b68f534ae8bbb2d6b96811af5aceaba5`.

## Source contract mapped

The source evidence is `selection-rotation-input-probes.json` (304 upstream cases), `selection-rotation-controller-probes.json` (236 checks, including 47 sessions/125 frames), and `selection-rotation-controller-composed-probes.json` (40 checks, including 32 input/controller sessions/128 frames and eight exact Location-notification gates). These execute retained instruction records with declared numeric/provider services. They are not executions of the original DLL or original GUI observations.

Mode 2 uses the original selection-center pivot and two distinct origins: `DFQ8` is the logical hot-zone anchor, while `YbSE` is the actual down point. Each frame first projects the raw absolute point through the original grid producer using current accepted owner bounds. The angle point is `YbSE + projectedDelta`, where `projectedDelta = (absolutePoint + correction) - DFQ8`.

`K5wb` uses `atan2(dy,dx) * 57.29577951308232 + 90`, preserving the retained multiplication order. The angle difference is not changed to the shortest arc. `abNY` rounds to a multiple of 15 degrees using AwayFromZero: Shift always uses that value; without Shift it is used only within the inclusive five-degree band. Trigonometry consumes the resulting fractional orbit angle. Selection's Rotation capability is false, so the attempted own-angle setter does not save P50 or alter the orbit angle. Each original center is rotated around the original pivot and its displacement is added to the original Location.

`IbNU` skips locked members. Otherwise the Location setter compares both axes to the current accepted location with strict `abs(delta) < 1e-5`. A changed member writes both coordinates to the current provider and notifies. An unchanged member still has an original editor notification, but that is not a persistent effect in this product adapter. The exact `[101]` Selection/TextRect notification gate does not invoke OI8Z/BNZT or text measurement. Width/height, fit flags, text/rich runs, panel geometry, style, and own rotation are absent from these writes.

## Validation and preserved failures

The new test file checks all 48 captured-origin records, all 256 upstream projection records, 45 admitted controller sessions/120 frames, all 32 composed sessions/128 frames, and the additional 64 constructor-derived sessions/256 frames. The two excluded controller fixtures are deliberately outside this module: a nonzero editor-origin service and a Rotation-capable non-Selection positive control. Twelve source epsilon cases are checked against current accepted state. Additional tests cover snapshot isolation, identity/size mismatch, single/mixed/nonzero-angle admission, nonfinite input, an invalid later target after an earlier attempted write, and the numerical conversion boundary described below.

Focused validation runs the new test plus the unchanged prior input/resize tests: **261/261 passed**, comprising 154 new rotation tests, 19 input tests, and 88 resize tests. TypeScript completed with exit 0. The first focused pass was 195/195 before the additional constructor and conversion-boundary tests. The companion manifest binds the command outputs rather than deriving success from filenames.

Preserved development evidence:

- `selection-rotation-model-input-red`: two executed failures because the shared projection API was absent.
- `selection-rotation-model-controller-red`: collection failure because the new controller module was absent; zero executed assertions, not a behavioral failure claim.
- The initially named `input-green` artifact actually contains 20 passes and one failure. `controller-first` contains 47 passes and the same one failure. Both are preserved honestly. The test had incorrectly supplied per-handle axis freedom to a source input facade explicitly configured with selection freedoms 3. The corrected test uses the fixture's supplied/default freedom; no algorithm was loosened to mask that difference. The old test bytes are preserved at `.build/selection-rotation-model-input-test-first.ts`.
- The parent's first typecheck exposed a new-test `it.each` tuple typing error. The test was changed to object cases; the later owned typecheck passes.
- Self-review found an actual arithmetic-order defect: replacing the retained multiplication by `* 180 / Math.PI` produced raw 10 degrees where the original reports `9.999999999999972`. The former snapped to 15 degrees; the latter correctly remained unsnapped. `selection-rotation-model-angle-unit-probe.mjs` executes the independent retained input/controller composition for a finite point inside the left handle's hit area, without loading product code. Its frozen JSON includes source hashes. The product regression produced **153 passed / 1 failed** before the single-line fix. The exact failed production bytes are `.build/selection-rotation-model-before-angle-constant/src/model/selection-pointer-rotate.ts`, SHA-256 `448ede7faa008cd87460a62acab009a7deedbf4d1beb85f72bd246c10ee0da59`. The subsequent 261/261 result includes this corrected boundary. The first parent build/test evidence stays bound to its original bytes, not this final source.

The input evidence owner subsequently closed the actual constructor in `selection-rotation-host-review-freedom-cil.json`: `obNM::.ctor` 100686217 at IL 0x6D–0x74 calls `VI8y(MSON(handle))`; setter 100686100 writes the field read by getter 100686099. Therefore actual ordinary side-handle input uses W/E=1, N/S=2, corners=3, as the App already supplies. The older 256 fixture intentionally injects 3 and covers that general function domain; it is not a literal side-handle constructor replay. No product correction is needed. The new constructor-derived review/matrix is recorded separately from that older fixture.

## Product boundaries

The host admits ordinary Selection controls in one unrotated page/Layer diagram scope. General transforms, nonzero editor-origin conversion, arbitrary widget capabilities, panels/repeaters as coordinate spaces, and guides/object snapping are not added. The explicit grid settings and host-converted scalar tolerance retain the previous stage's bounded policy.

Saved model rectangles require finite coordinates within ±100000 and sizes 1..100000. All targets must validate before a successful result is returned. A later invalid target returns diagnostic attempted trace but no committable results or changed caller state. This atomic publication policy is a product safety boundary, not a claim that every native exceptional path rolls back.

The original geometry/pivot remain fixed through a gesture; current rectangles serve grid candidates and equality. The host owns ordered frame delivery, captured mode, cancellation/context staleness, one undo, and pointer-up completion without an extra geometry frame. This model neither reads Affect All Views nor prepares fonts. The implementation does not claim a full native editor transaction or native font/rendering equivalence.

The retained per-owner `kSct` geometry snapshot is lazy at the first CbNX call. The host's immutable down-time document is equivalent within the admitted session policy because an intervening external document/context change cancels the gesture; this module does not reproduce arbitrary native edits between mouse-down and first move. No claim of general transformed/nested editor-origin equivalence follows from this captured product policy.
