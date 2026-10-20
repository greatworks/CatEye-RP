# Layer author resize controller: RP 11 static contract

This report closes the controller branch used for resizing a Layer and its
members. It does **not** execute Axure, its DLL, or its GUI. The numerical
`INw2`/`mNwa` solver is a separate investigation; this report's replay injects
its returned rectangles and checks the controller's actual recorded CIL.

Pinned assembly: `AxureRP11.dll`, version **11.0.0.4150**, SHA256
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
`layer-resize-controller-evidence.json` indexes the methods and limits.
`layer-resize-controller-manifest.json` binds source and evidence bytes.

## Tree, membership and snapshots

`TbN1..ctor` **100686207** stores the object, its old rectangle, all child nodes
(`ubNL`), a contact mask (`fbNx`), and a subset (`ebNe`). Layer children are its
ordered `DiagramObjects`. DynamicPanel children instead come from
`get_AllPinnedObjects` **100700551**. This is not an unrestricted recursive walk
of every container type.

**Correction to the frozen preparation report:** `ebNe` is the subset touching
at least one edge of its containing Layer. It is not the selected-member subset.
`EbNW` returns `fbNx`; `Y5um` **100722156** compares the child's
`SizingRect.BoundingRect` with the parent Layer's rectangle. It tests
`abs(edge difference) < 0.0001` separately: Left=1, Top=2, Right=4, Bottom=8.
Any nonzero mask enters `ebNe`. Exact equality to the tolerance is excluded.
Selection is consulted later for the root lock gate, not this classification.

`EJdP` **100695456** is a Layer reference, not a generic coordinate parent:
`dJdf` **100695472** first follows contained widget parents; the outer widget's
Layer field is returned. Metadata distinguishes that Layer field from the
`IDiagramObjectContainer` field. `Layer.Add` **100701046**, IL `0x9F–0xA1`,
assigns it; `Remove` **100701048** clears it.

The controller's selected roots and flattened member list differ.
`cbN7` **100686239** recursively flattens each `TbN1` child list in preorder
before snapshot capture. `kSct..ctor` **100707157** captures:

| Snapshot getter | Value |
| --- | --- |
| `UScH` 100707160 | saved `UnroundedRect`: Location and Size |
| `zSc1` 100707161 | saved rotated bounding rectangle of that unrounded frame |
| `dScI` 100707162 | `UScH(child)` minus `UScH(EJdP(child))` location; size unchanged |
| `KSc3` 100707163 | the corresponding subtraction using the two saved AABBs |
| `NScg` 100707164 | saved rotation |

All recursion reads these old snapshots. It does not recompute the next
member's input from a sibling already written. Layer children retain their
page/state coordinates in storage; the relative snapshots are temporary solver
inputs. `X5s9` **100722081** supplies an origin-zero rectangle with the same size.
`R5u1` **100722083** changes a rectangle's location, preserving its size.

## The two passes

`obNM.jbNm` **100686249** receives:

```
(node, overrideLocked, parentRect, dx, dy, orientation,
 respectFixedFields, movementFreedom, pinInfo?, optionalLocation?)
```

After lock checks, it chooses absolute snapshots when `optionalLocation` is
absent, otherwise the two relative snapshots above. It calls `JbNd` to update
fit flags, temporarily changes the controller's scaling flag, then calls:

```
INw2(widget, oldRect, oldAabb, Point(dx,dy), parentRect,
     handle, movementFreedom, scaling, orientation, pinInfo)
```

An optional location is added to the solver's output **once**, after solving.
The normal `hInw` entry **100686246** passes orientation 3 (None).
The Layer branch does not write the Layer rectangle through `VbN8`.

For a Layer, derive child deltas from `oldSize - requestedSize`:

```
dx = Left(handle) ? min(oldWidth-newWidth, oldWidth)
                  : max(newWidth-oldWidth, -oldWidth)
dy = Top(handle)  ? min(oldHeight-newHeight, oldHeight)
                  : max(newHeight-oldHeight, -oldHeight)
```

`ubNp` **100686251** predicts the contacting subset using relative snapshots,
`INw2`, each saved angle and a rotated bounding-rectangle union. Its resulting
candidate frame can differ from the requested frame. With applicable pins, the
controller may use `mNwa` to correct the origin when candidate and requested
sizes differ. It then traverses:

1. **Contacting members:** PinInfo old parent = old origin-zero frame; new
   parent = requested origin-zero frame.
2. **Remaining members:** same old parent and deltas, but PinInfo new parent =
   candidate origin-zero frame.

Both passes supply the selected new origin to recursion and respect member
fixed fields. Remaining members preserve original order. This is a difference
filter, not a second scaling of the first subset: `kb79` → `GbXY.pbXw`
**100689840** → `<Difference>b__0` **100689849** negates `Sbhg` **100689190**,
whose collection branch calls `Contains`.

Nested Layers repeat this protocol. Only ordinary leaves reach the ordinary
geometry setter. The replay distinguishes requested/candidate parent sizes,
checks nested origins, and confirms restoration of the temporary scaling flag
before the next sibling.

## DynamicPanel boundary

`get_AllPinnedObjects` iterates all panel diagrams, converts contained objects
to root Layers or ordinary root objects, and filters effective horizontal or
vertical pins. Fixed width/height alone do not make an object pinned.
Relevant hooks are **100700551**, **100700639**, **100695931**,
**100695997**, **100695459**, and **100695970**.

After the panel's own ordinary write, its supplied pinned list uses
`kbNq(..., true)`, origin-zero old/new panel frames, movement freedom **All=3**,
and **no optional location**. The corresponding Layer branch uses
`kbNq(..., false)` and supplies a location. Consequently the panel branch must
not be replaced by the same local-coordinate adapter as a Layer.

The list construction is statically traced. The bounded controller replay
supplies the resulting list; it does not run every panel diagram or the
FitToContent setter's downstream notifications. General panel integration is
therefore a separate implementation gate, not a claim of complete support.

## Locks, pins and fit side effects

`Locked` **100695483** receives `(includeParent=true, rootNodes.Contains(node))`.
For a selected root it uses its own lock. For an ordinary member of a
non-current Layer it delegates to the parent's lock; a child's own lock alone
does not block resizing with an unlocked enclosing Layer. Entering that Layer
changes this behavior to the child's own lock. Background objects are excluded
even when the override-lock parameter is true. `VbN8` **100686260** repeats the
lock/background gate before writing. This cannot be replaced with
`if (widget.locked) skip` for every descendant.

The effective pin fields are P106 (horizontal Position), P107 (vertical
Position), P108 (fixed height), P109 (fixed width). Missing FixedWidth/Height
capability forces that dimension fixed. `PinInfo..ctor` **100703709** preserves
old/new parent rectangles. `kbNq` **100686252** has an exact Control+Alt modifier
branch, `(AxKeys & -65536) == 393216`; Ctrl+Shift+Alt does not satisfy it.
Its boolean argument selects either `(Left, Top, true, true)` or
`(None, None, false, false)`. The frozen preparation probe covers 192 inputs.

`JbNd` **100686253** only changes a fit flag that was already true. Its near-zero
test is **strict `abs(delta) < 0.00001`**, from `TbxU` **100688813**:

| Type branch | Updated value / gate |
| --- | --- |
| VectorShape AutoFitWidth | horizontal freedom and not fixed width: near-zero dx |
| VectorShape AutoFitHeight | vertical freedom and not fixed height: near-zero dy |
| SelectionButton AutoFitWidth | horizontal freedom: near-zero dx; no fixed-width check here |
| ImageBox FitToImage | `(near-zero dx or fixedWidth) and (near-zero dy or fixedHeight)` |
| DynamicPanel FitToContent | same boolean formula |
| Layer | no fit write |

AutoFitWidth/Height setters **100702343/100702367** and ImageBox FitToImage
**100700760** write their shared fields and invalidate. These are not writes of
an adaptive PName. DynamicPanel FitToContent **100700521** uses its typed storage,
current panel diagram and notifications; the controller's requested boolean is
closed, but the complete downstream cascade has not been replayed.

## Geometry write and transaction limit

Ordinary `VbN8` calls **`YJ0S(newRect, false)`**. `YJ0S` **100695371** opens
`WJma` **100695248**, writes **Size then Location**, and closes the notification
bracket. Its arguments to `uJ0j` **100695365** and `xJ0B` **100695349** retain
false for the all-views parameter and true for notification. The retained
point-commit setter evidence proves current-view ordinary P105/P101 writes.
This report does not replace those equality/capability guards with unconditional
new adaptive declarations.

`TrapScaling` **100686250** and its closure **100686280** restore the previous
controller flag. `CbNX` **100686248** creates/reuses a `kSct` snapshot, uses
additional edit brackets and has a separate single-object path. Finalization
`EbNf` **100686262** / `mbNT` **100686263** calls editor state/history hooks.
Their full cancellation, undo, connector-notification and exceptional paths are
**not** proved by a notification bracket or this controller replay.

## Implementation handoff and verification

The closed first product slice is a Layer tree with ordinary vector/image
leaves, preserving source order, stable old snapshots, both passes, effective
pins, lock context, current-view paired geometry and shared fit changes.
Replace the explicit numerical sinks only with the independently source-bound
solver, not generic proportional multiplication. Plan changes first and apply
one product history transaction; that transaction is an independent editor
choice until the complete native history path is closed.

Do not resize Table/Menu/Tree/Repeater or Connector by merely changing their
outer width/height. Their virtual geometry setters, content rules or dedicated
commit path are not covered here. Unsupported descendants must be reported
before a product mutation. Degenerate/nonfinite solver inputs and general
transform coverage belong to the numerical handoff and existing model bounds.

`node research/layer-resize-controller-probe.mjs` passes **142/142** cases:
edge masks/tolerance, containing-Layer lookup, snapshot subtraction, fit matrix
and threshold, locks/current Layer/background, actual ordinary commit control
flow, two-pass ordering, parent-frame differences, panel call arguments and
nested origin restoration. This is bounded CIL-record interpretation with
explicit geometry/style/capability/notification sinks, **not original native
execution, GUI comparison, or a product test**.
