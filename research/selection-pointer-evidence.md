# SelectionButton pointer resize: retained instruction evidence

This is static ECMA-335 instruction-record interpretation of the pinned Axure RP 11.0.0.4150 assembly. No vendor DLL method, vendor GUI, or reconstructed product code was executed. The numerical oracle executes retained instructions through a bounded JavaScript interpreter. Font measurements, notification/history services, object selection and graphics-unit conversion are explicitly supplied facades. It is not original-application pixel or pointer validation.

Assembly: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll`, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7` (rehashed this stage). Extraction provenance remains `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. The new JSON and manifest bind every reused/new input to its full path and SHA-256; previous reports are unchanged.

## SP-01: one shared set of handles

`djDF.zjDr.ujDt` / SetupHotZones, token **100686198**, is in `selection-pointer-handles-cil.json`. IL972–1019 obtains `All(selected, Locked(true,true))`; IL578–1051 selects freedom 3 or 0 for a multiple selection. IL939–1074 replaces that with the individual object's sizing freedoms for one unlocked object. IL224–316 applies `CSdd` and `ySdO` to each shared hot-zone controller. This is not a separate set of eight handles per selected object.

SelectionButton `get_SizingFreedoms` **100702025** returns 1, or 65537 when effective AutoFitWidth is true. `CSdd` **100708303** tests `(value & required) == required`. Thus one ordinary SelectionButton has Left/Right handles only (Position 1/4). With AutoFitWidth true these two controls have `DbNv=true`. Two or more unlocked/mixed-locked selections have all eight handles (1,2,3,4,6,8,9,12); all locked has none. Mixed locked objects still contribute to the supplied common frame; the per-root commit lock gate skips their writes. Visibility/placement discovery before the supplied selection is outside the replay.

`DbNv` **100686221** reads hot-zone field `YbS3` 67119112; `abNQ` **100686222** writes it. This is controller state, not a persisted widget fit flag. The original `ySdO` **100708304** relates that marker to the handle's freedom and the selection's fit bits.

## SP-02: single and multiple dispatch are different

`obNM.CbNX` **100686248**, `.build/next-layer-authoring/resize-propagation-cil.json`, is replayed as a complete method in the session probe. Ordinary resize is separate from the rotation-mode branch at IL106–414.

For count 1, IL491–730 checks locking/background, then if `DbNv || handleFreedom.All()` calls `abNQ(false)`, `JbNd`, and `SetupHotZones`. It then calls **obN4 100686258**, followed by **VbN8 100686260**. The single branch does not call `kbNq`/PinInfo or the multiple-root proportional solver. In particular the absence of a SelectionButton fixed-height capability must not be indiscriminately applied as a root PinInfo in this branch.

For count >1, IL735–905 takes the saved common `PbSc` frame (subtracting editor-origin only in the other scope branch) and clamps delta against original `ybSW` dimensions. Left limits dx from above by old width; other handles limit it from below by negative old width. Top does the same for dy/height. IL907–963 calls `jbNm` for each root with this same parent rectangle/delta, `respectFixedFields=false`, handle freedom, `PinInfo=null`, and no optional layer location. Ordinary selection roots therefore use the shared selection projection, not each root's independent `+delta` width. Recursive Layer/pinned-member rules are separate prior evidence, not expanded here.

The common frames are stored by **CbNh 100686243**, IL1416–1508: `SJYh → PbSc` and `KJYm → ybSW`, retained in `layer-resize-controller-planner-host-cil.json`. Host discovery/snap corrections before CbNX are not reproduced.

## SP-03: exact single-root numerical contract

**obN4 100686258** reads original unrounded geometry through `gbSH → UScH` (IL162–174). For ordinary non-VectorShape SelectionButton, it reads effective rotation at IL479, computes opposite handle with **DSOB 100708333**, rotates delta by negative angle with **d5pN.Rotate 100720577 → k5q1 100720578**, and either applies aspect adjustment or `y5wg` freedom filtering. `X5wR` signs the dimension delta for the opposite anchor. It rounds that dimension delta to zero decimal places with AwayFromZero, then calls **g5s7.x5sY 100722234** with the original sizing rectangle, opposite anchor and supplied source-proven 1×1 minimum.

`x5sY` adds dimension delta, applies **j5u5.q5uR 100722117 → fHBd.UHB4 100722980** per-axis minimum, builds a new sizing rectangle, and translates it so its opposite anchor matches the old one. It returns raw rect through `p5lB` **100722211**; the ordinary branch writes NaN to the optional output-angle slot, so no rotation setter follows.

For `(x20,y30,w100,h20)`, zero angle and horizontal freedom:

| Handle | dx | Result requested frame |
|---|---:|---|
| Left | 20 | `(40,30,80,20)` |
| Left | 120 | `(119,30,1,20)` |
| Right | 20 | `(20,30,120,20)` |
| Right | -120 | `(20,30,1,20)` |
| Right | 0.5 | `(20,30,101,20)` |

The 36 numerical cases cover both horizontal handles, negative/zero/fractional/positive/crossing deltas and angles 0/30/90. An independently written anchor-preservation formula checks every result. The interpreter was corrected to retain reference identity for the `g5s7` class and to parse string-encoded NaN constants as IEEE NaN. The earlier incomplete-facade outputs are preserved and are explicitly not accepted native results. Other transform providers, VectorShape-special branches, zero/negative original frames and general matrices are not admitted by this single-root oracle.

## SP-04: continuous frames preserve fit and the live text panel

The persistent session probe executes full CbNX, ordinary VbN8, YJ0S, Size validation, SelectionButton OI8Z and WIyL instructions. Its source snapshot constructor facade captures only the CIL-proven old rect/rotation family; it never resets flags or the panel between calls. Full CbNX IL68–101 creates that snapshot only when absent. The retained kSct constructor **100707157** captures unrounded rect, rotated bounds, angle, and connector endpoints; there is no TextPanelRect or AutoFit field in that constructor. The snapshot and panel are distinct.

Selection `JbNd` **100686253** checks the current effective AutoFitWidth and horizontal freedom, then sets the flag to `abs(dx) < 1e-5`. The real setter **100702343** is executed, including OI8Z(true). The first nonzero horizontal drag turns AFW off. After SetupHotZones refreshes the controller, single-root DbNv is false. A later cumulative delta of zero therefore does not restore AFW. Multi-root JbNd likewise reads the current false flag and does not restore it. Values 0 and 1e-6 preserve true initially; 1e-5 clears it. AFHeight is not changed by this Selection JbNd branch.

For an initial `(100,100,240,40)`/P94=14, Left deltas `20 → 0 → 40` produce requested frames `(120,100,220,40) → (100,100,240,40) → (140,100,200,40)`: geometry continues to use the original frame. With original AFW true, the first frame measures twice (fit setter, then Size); following frames measure once for the changing requests used here. Controlled font heights `[20,40,20,60]` yield final owner heights `[40,20,60]`. The second frame's input panel is exactly the first frame's output panel, not the initial panel. These heights demonstrate service sequencing; they do not assert real-font metrics.

## SP-05: Size precedes final Location; current-view writes

**VbN8 100686260** IL258–261 calls `YJ0S(request,false)`. **YJ0S 100695371** writes Size first and Location second. The Size call goes through the live current owner/TextPanel, **NIuy 100702369**, **KNZn 100702371**, and **OI8Z 100702374/WIyL 100702035**. Its internal panel/owner corrections run before the final requested Location. The caller does not re-anchor the final owner using its measured height. All observed Size/Location write arguments are `allViews=false`; the pointer path does not read Affect All Views.

For two initial roots `(100,100,100,40)` and `(300,100,100,40)`, common frame `(100,100,300,40)`, Right delta `(60,20)` requests widths 120 and x positions 100/340; Left requests widths 80 and x 160/320. Top/Bottom freedom preserves AFW, so subsequent OI8Z may derive a different width from measured text. This is why a generic fixed-height + generic anchor postprocessing step is not equivalent.

## SP-06: modifier and availability boundary

Original **hInw 100686246**, IL33–55, forwards to CbNX with `overrideLocked=false`, Orientation 3, and a boolean obtained from **BJG9 100691309** (mask 65536 via QJGS). The original CbNX IL419–469 enables its aspect flag only if the handle rotated 90 degrees has `WbSB=true`. **WbSB 100686225** requires that orthogonal handle to be visible and not have DbNv. Thus single SelectionButton horizontal handles cannot gain aspect mode through its hidden orthogonal vertical handle; the replay confirms identical single-root results with the boolean on/off. Multiple-selection hot zones can enable that branch. The injected modifier boolean in session fixtures represents this CbNX input, not live keyboard capture.

The complete upstream mouse-coordinate/snapping pipeline and exact editor modifier event delivery remain outside this study. Deltas supplied to CbNX are measured against its retained initial-frame contract, not independently accumulated into each frame's mutated geometry. No claim is made that every external mouse-event handler has been replayed.

## Accepted evidence and limits

Accepted outputs: `selection-pointer-control-probes.json` (11 assertions), `selection-pointer-numeric-probes.json` (36 independent numerical checks), and `selection-pointer-session-probes.json` (30 persistent scenarios / 71 CbNX calls). Total 77 cases. Session assertions check live-state continuity, snapshot creation once, current-view write flags, AFW persistence/epsilon, single orthogonal-handle aspect exclusion, final requested Location and locked-root preservation.

Controlled services: selected objects and ordinary page diagram, graphics font answers, identity graphics-unit conversion for 2→0, notification/history/connector side effects, overlay-only bounds, and effective rotation. The actual OI8Z/INOR/WIyL numerical/control code is interpreted. The history facade does not implement undo/redo or original event subscriptions; retained `ug4`/TrapOperation records are saved separately. Panel/repeater diagram-origin conversion, Layer recursion, general transforms, text editing during a drag, native font metrics, snapping and original GUI handle pixels remain unverified here. Author host atomicity/history/cancellation is an independent implementation obligation, not proven by these source replays.

All earlier evidence and product files remain untouched by this research agent. Failure artifacts record missing dependencies and explicit interpreter/facade mistakes; they are not product failures or native GUI observations. The first failed byte versions were not all snapshotted; recorded hashes are not claimed to reconstruct missing bytes.
