# Selection resize input: grid-only native contract

This report closes the ordinary, unrotated resize-controller grid branch from retained Axure RP 11 CIL. It does not execute the DLL, invoke the original GUI, or establish native font/pixel equivalence. Product source and algorithms were not used to construct the numerical oracle. Guides and object snapping are explicitly disabled settings/providers in the replay.

The pinned assembly is `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll`, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. Narrow records were extracted using the existing PEReader script without loading the target assembly. Exact file hashes are in `selection-input-grid-evidence.json` and `selection-input-grid-manifest.json`.

## Entry and coordinate contract

`EFqs.jF4A` **100682868**, active resize path, reads the current absolute diagram pointer, calls `xFY0` **100682729**, calls `iFYq` **100682731** with both axis flags true, adds the returned correction to that pointer, subtracts field `DFQ8`, and dispatches `hInw`. This is **not accumulated movement from the physical pointer-down point** and not rounding the accumulated delta to a grid.

`DFQ8` is captured by `kF4c` **100682795**, IL `0xC8–0xCF`, through the virtual `kI8w` getter. For `obNM`, the actual override is **100686266**, not the base `IjWz` hot-zone-center getter. `zbNw` **100686265** separately prepares a displayed hit zone and logical point `VbSD`. The logical point uses the frame reduced by `(1,1)`; modern BoxModel **0** restores `+1` on right/bottom edges in `kI8w`. For an unrotated frame `(x,y,w,h)`:

| Handle | Logical initial point |
|---|---|
| W / 1 | `(x, y+(h-1)/2)` |
| N / 2 | `(x+(w-1)/2, y)` |
| NW / 3 | `(x,y)` |
| E / 4 | `(x+w, y+(h-1)/2)` |
| NE / 6 | `(x+w,y)` |
| S / 8 | `(x+(w-1)/2,y+h)` |
| SW / 9 | `(x,y+h)` |
| SE / 12 | `(x+w,y+h)` |

The one-unit size constant is proved by `fHBd..cctor` **100723002**. Displayed hit zones instead use a `1/zoom` adjustment and side-coordinate `Ceiling`; their rendered rectangle center is not a substitute for the logical point. The earlier exploratory example using E start Y=120 for a 40-high frame is corrected to **119.5** here. Its horizontal dx44 result was unaffected. General rotated hot-zone mapping and other BoxModels remain outside this contract.

`NFnH` **100682895** converts the incoming pointer with `W5pd` **100720544**, Device/Page coordinate-space value **2** to World **0**, before storing the current point. The replay receives the resulting absolute diagram point. Browser canvas offsets, zoom, device scaling, and scrolling must be converted by the host; they are not silently inferred from a delta.

## Current bounds, not gesture bounds

`xFY0` IL `0x3DB` reads `aFTT → UJnP` **100696205** `→ SJYh` **100695934**. This requests the **current** selection bounding rectangles. `JJ0R` **100695408** invokes `MJ0k(false,false,false,true,true)`, then diagram translation. The existing retained editor-bound evidence closes the same flags: ordinary owner rotation participates; border/effect expansion is off; hidden and unplaced members are included. `MJ0k` has geometry-keyed caching, not a resize-start snapshot argument. This report supplies a current-bound service to the replay; it does not emulate the entire native cache invalidation system.

`X5pe` **100720525** seeds a nonempty union from its first rectangle, then folds the remaining rectangles. An all-negative selection is not expanded to zero. Empty selections, arbitrary transforms, and scope-specific container translation are not admitted as ordinary Selection input merely because a rectangle can be supplied.

Therefore queue raw pointer/key samples, then calculate input inside the same ordered step as layout. Recompute the union from the current owner rectangles after the preceding layout transaction; do not precompute all queued corrections using the initial frame. The resize solver still retains its separate original geometry snapshot.

## Grid and tolerance

`uFw1` **100682537** reads `ClientSettings.get_GridSize` **100664403** (a size, with independent width/height). `CFwb/JFwm/MFwn` read the Grid/Guides/Objects booleans. No grid-origin subtraction is present in the grid-only branch: coordinates are relative to the diagram World origin **0**, not the selection origin.

For an edge `v` and corresponding spacing `s`, the correction is:

`Round(v/s, 0, MidpointRounding.AwayFromZero) * s - v`.

The wrapper `ybxu` **100688822** forwards directly to `Math.Round`; the call supplies digits 0 and mode 1. Negative half-grid values therefore round away from zero. This is independent of the sign of the pointer delta.

`yFO0` **100682355**, IL `0x60–0x6A`, initializes `WFwu` to **5**. `iFYq` converts `Size(WFwu,0)` using `N5pp` **100720541** and takes the result's Width. This **one scalar tolerance** is used for both axes. A correction is accepted at equality (`abs(correction) <= tolerance`). Our ordinary uniform graphics facade gives `5/zoom`; this is an explicit Device→World service, not a claim about arbitrary native graphics transforms, DPI, or GUI settings. The native persisted default grid spacing was not closed by the narrowly inspected getter/static initializer. Product spacing 8 is an explicit product setting, not a claimed native default.

## Equivalent candidate and correction rules

Use the opposite of the dragged handle as `anchor` (L1↔R4, T2↔B8).

1. Start with the current rectangle. For corner Shift, compute signed width/height distances from the opposite corner to the pointer. Expand the smaller dimension to the current `height/width` ratio; do not take absolute values. This changes the candidate pointer only.
2. Apply the dragged edges. Crossing or exactly reaching the opposite X edge permits a zero-width candidate only when the freedom has the vertical bit 2. Crossing Y permits zero height only when horizontal bit 1 is present and X has not already crossed. Otherwise return the sentinel below. Unchanged axes retain current bounds.
3. Grid Y chooses the bottom correction when `(anchor.top || abs(bottomCorrection) <= abs(topCorrection)) && !anchor.bottom`, otherwise top. X similarly chooses right when `(anchor.left || abs(rightCorrection) <= abs(leftCorrection)) && !anchor.right`, otherwise left. This preserves the source tie order. Each selected correction is independently tolerance-gated.
4. Corner Shift performs a second adjustment on the **correction vector**, using the candidate ratio. Let `xHit/yHit` be accepted-axis flags and `sign=+1` for anchors 3/12, otherwise `-1`. If `!yHit || (xHit && abs(cx*ratio) < abs(cy))`, set `cy=sign*cx*ratio`; otherwise set `cx=sign*cy/ratio`. The actual setter is skipped when the difference is strictly below `1e-5`. This derived correction is not tolerance-tested again. The flags subsequently cleared by the source concern guide drawing.
5. Add correction to the original absolute pointer, not the aspect-adjusted candidate pointer. Subtract the captured logical start point. Pass both delta components to the downstream controller; its sizing-freedom logic is a separate stage.

**No-candidate is not null or NaN.** `qJyF.KJyA`, initialized in **100696865**, is `(-100000,-100000,200000,200000)`. `jF4A` still calls `iFYq` on it. At non-divisor grid spacings it can generate nonzero correction. The provisional replay initially represented this unclosed static field as NaN; that facade was corrected from its cctor before the final matrix and no product was based on the provisional sentinel.

Alt bypasses snapping in `jF4A` before either candidate or correction is read. The sibling platform research closes Windows `NIoi` as Alt262144; this replay supplies that platform service and tests the original bypass branch. Grid off with both other providers disabled also bypasses candidate reads. Shift remains a separately sampled key for the downstream layout controller. Release/completion is a separate host/controller path and is not simulated as an extra `jF4A` layout frame here.

## Evidence and independent examples

`selection-input-grid-replay.mjs` interprets the complete retained `xFY0`, `iFYq`, active `jF4A`, `zbNw`, and `kI8w` paths, with explicit primitive/graphics/selection/keyboard services. It rejects enabled guide/object providers. `selection-input-grid-probe.mjs` compares those instructions against separately written formulas: **1752/1752** cases, comprising 896 candidate cases, 768 correction cases, 6 tolerance cases, 64 logical hot zones, 16 entry/bypass cases, and 2 current-bound cases. These are controlled static replays, not original DLL execution.

For `(100,100,240,40)`, E start `(340,119.5)`, grid8 and client dx21:

| Uniform zoom | Diagram pointer X | Corrected X delta |
|---|---:|---:|
| 0.5 | 382 | 44 |
| 1 | 361 | 20 |
| 2 | 350.5 | 12 |
| 4 | 345.25 | 4 |

At zoom0.5, candidate right382 snaps to384, giving44 rather than delta-grid40. The source also returns an orthogonal Y correction where applicable; later sizing freedom, not this stage, decides its geometric effect.

`selection-input-grid-live-session-probe.mjs/.json` additionally composes the original input CIL with the retained original multi-Selection controller and layout CIL. It injects constant measured text height20, so this is not native text measurement. Original owners are `(100,100,240,20)` and `(450,100,180,20)`, shared530×20, SE start `(630,120)`, Shift/grid8/zoom1:

* Pointer `(736,124)` gives delta `(106,4)`. Owners become `(100,100,288,20)` and `(520,100,216,20)`; the live union is636×20.
* Next pointer `(752,125)` with that live union gives candidate795×25 and delta `(123,5.031446540880509)`. Owners become widths300.3773584905661 /225.28301886792462, second X538.0503144654089, both height20.
* Incorrectly reusing the initial530×20 union gives delta `(119.5,4.905660377358487)`, widths298.86792452830184 /224.15094339622635 and second X535.8490566037735.

This is a concrete queued-input regression oracle. The full ordered layout effects and all dependency hashes are preserved in its JSON.

## Minimal implementation surface and remaining boundaries

Capture initial logical point, handle, sizing freedom, explicit grid spacing/enabled policy, and the host graphics conversion context. For each queued frame provide the current absolute diagram point, current selection union, and sampled keys. Return candidate/sentinel, correction, and final delta without mutating model geometry. Apply the existing Selection transaction afterward, with its separate original snapshot and current panel state. A single scalar converted tolerance is sufficient for the proved uniform context.

Not established: original GUI pixels or fonts; guide/object snapping; arbitrary rotated/general-transform candidate branches; non-ordinary scope translation; native grid settings UI/default/persistence migration; cache invalidation as a complete native subsystem; or key-only dispatch timing. The existing complete reconstruction goal remains larger than this bounded grid input contract.
