# Ordinary multi-Selection rotation: upstream input and initialization

This closes the ordinary, same-diagram, initially unrotated multiple-SelectionButton input path in pinned Axure RP 11. It is retained metadata/CIL analysis and bounded interpretation, **not execution of the original DLL, original GUI comparison, or pixel/font parity**. Product algorithms were not read to construct the oracle. Prior frozen evidence is unchanged.

Assembly: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll`; SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. File-level hashes and exact visited method offsets accompany this report.

## Capture two different initial points

`DF4L` **100682804**, IL `0xC4–0xCB`, stores the mouse event's location in `VFQZ`. IL `0x562–0x570` converts that location through `W5pd` **100720544** (Device/Page 2 to World 0) and calls `XFsN` **100682802**, which writes `HFQs`. `RFsJ` **100682801** returns that field. This establishes the diagram-space down point; it does not substitute the logical handle anchor. The graphics conversion is an explicit host service in the bounded replay.

`kF4c` **100682795** first sets `DFQ8 = controller.kI8w()` at `0xC8–0xCF`. It then passes `RFsJ()` to virtual `YInu` at `0xE4–0xEC`. The resize controller override `YInu` **100686238** calls `CbNh(downPoint, true, false)` at `0x21–0x25`. Thus the logical start is captured **before** mode initialization, and the down point is independently passed to that initialization.

`obNM.kI8w` **100686266** contains no mode test. For ordinary multiple owners and modern BoxModel 0, its logical point is the same source-bound point proved in the preceding grid report: corners use their outer edges; a side midpoint uses `(dimension−1)/2`. `zbNw` **100686265** prepares the logical value independently from its zoom-adjusted visual hot-zone. A DOM handle center or physical pointer-down location is not an interchangeable replacement.

## Mode and initial members

`CbNh` **100686243** sets the captured mode through `xbSJ` **100686234** at `0x458–0x471`; the left-down path supplied true, so `UbNP` **100686235** decides mode 2 versus 1. `UbNP` checks the masked keyboard state via `CJGH` **100691312** and its ordinary multiple-owner branch returns true when the selected root count exceeds one. The key predicate is exact Control in the modifier mask; it does not mean any combination containing Control.

After clearing previous controller state, `CbNh` writes the actual passed point into `YbSE` at `0x43D–0x43F`. For mode 2, it enumerates `AbNC(false)` into `dbSS` in original order. In this bounded SelectionButton case, no mode-1 `TbN1` list is used. Its following writes are:

- `PbSc = SJYh(dbSS)` at `0x595–0x5AC`: initial selection diagram bounds.
- `ybSW = KJYm(dbSS)` at `0x60A`'s preceding size/sizing branch (`0x5CE–0x5E4`): separate sizing snapshot, retained here as an explicit service result.
- `hbS6 = list(KJ4R(dbSS))` at `0x60A–0x62B`: retained source-related member list.

The observed mode-2 initialization does not call resize-only `dbNa` and does not store a separate start-angle scalar. Downstream angle evaluation reads the captured initial point and initial bound center; its angle primitive and member-write semantics are a separate sibling investigation. The recorded `KJYm`, snapshot, transaction, and collection services are not claims of complete controller/cache implementation.

## Mode 2 does execute the grid input branch

In active `jF4A` **100682868**, there is no mode check between the Alt/settings gates and the resize-controller branch. Its `bInf` call dispatches to `obNM.bInf` **100686227**, which returns true unconditionally. Therefore mode 2 follows the same grid-only candidate path when the grid is enabled and Alt is absent:

1. Read the current absolute diagram pointer `qFlR`.
2. Compute `xFY0` **100682729** from **current** selection bounds, not the initial `PbSc` snapshot.
3. Run `iFYq` **100682731** with the opposite handle and both correction-axis flags true.
4. Store `KFQf = originalAbsolutePoint + correction`.
5. Compute `delta = KFQf − DFQ8`.
6. Call `hInw(delta.x, delta.y, qFlR, graphics)` at `0x229–0x244`.

The `qFlR` argument in the last call remains the unsnapped absolute pointer. This is distinct from the corrected delta. `obNM.hInw` **100686246** forwards the delta and raw point to `CbNX` **100686248**, with `(false, currentShift, 3, false)` as the remaining four arguments. It samples Shift again through `BJG9` **100691309**. The current mode is not reselected in this path when Control is released or other modifiers change.

The mode-2 downstream instructions `CbNX` `0x180–0x193` use `YbSE + delta` as the current angle point, then compare its pivot-relative angle with that of `YbSE`. Consequently the two captured points must remain separate. Replacing this expression with the raw absolute pointer loses the physical-down versus logical-hot-zone offset. This report verifies the input handoff; it does not independently validate the downstream trigonometry, rounding, capabilities, or geometry writes.

Alt bypasses candidate/correction calls, including current-bound reads, and passes raw `absolutePoint−DFQ8`. Grid disabled with guide/object providers explicitly disabled does the same. Shift is independently relevant to the grid candidate/correction and to the downstream controller argument. Ctrl does not itself bypass snapping. The source finite sentinel and scalar device-to-world tolerance from the frozen grid contract remain applicable; no general-transform, guide, or object-snapping equivalence is claimed.

## Reproducible numeric handoff

Initial owners: A `(100,100,240,20)`, B `(450,100,180,20)`, union `(100,100,530,20)`. SE logical start is `(630,120)`. Use a distinct physical down point `(631.5,121.5)`, then move to `(736,124)`, grid 8, uniform zoom 1, tolerance service 5.

| Current keys | Correction | Delta passed to controller | Down + delta |
|---|---|---|---|
| Control | `(0,4)` | `(106,8)` | `(737.5,129.5)` |
| Control + Shift | `(0,0)` | `(106,4)` | `(737.5,125.5)` |
| Control + Alt | bypass | `(106,4)` | `(737.5,125.5)` |
| Control + Shift + Alt | bypass | `(106,4)` | `(737.5,125.5)` |

All retain raw point `(736,124)` as the separate argument. Eight is an explicit fixture/product setting, **not a proved native default**. The initial pivot from the initial union is `(365,110)`; live grid bounds may subsequently differ while this initial pivot remains captured by the downstream contract.

## Probe boundary and minimal host contract

`selection-rotation-input-probes.json`: **304/304** cases. Forty-eight capture cases cover eight handles, distinct down offsets, and zoom variation. The other 256 cases cover eight handles, all eight live modifier masks, grid on/off, and two distinct current-bound services. They execute retained `kF4c`, `YInu`, `CbNh`, mode predicates, logical hot-zone methods, active `jF4A`, candidate/correction, and `hInw`; downstream `CbNX` is a recording sink. Original CIL runs through a bounded interpreter over retained instruction records, never through CLR loading/invocation. Source-derived formulas from the frozen grid probe serve as the independent numeric comparison, without reading product algorithms.

Capture at down: mode, moving handle, freedom, logical hot-zone point, actual diagram down point, original members and initial selection union/pivot, plus explicit grid policy/graphics context. Queue each raw absolute diagram point with keys. At its ordered execution, obtain current accepted owners' bounds, compute source input, then hand corrected delta and sampled Shift to the separate rotation planner. Keep the actual down point immutable; do not replace it on later frames. Release is a separate transaction completion, not an extra move frame.

Not established here: original GUI or fonts; guide/object provider behavior; initially rotated/general-transform hot-zone/candidate geometry; masters, active panel-coordinate remapping, nested special container selection; complete transaction/cache invalidation; native grid default/persistence; platform key-only event dispatch; or downstream member-writing parity. These remain explicit reconstruction boundaries rather than implied successes.
