# Native point commit: entry-specific geometry and AutoFit scope

Target: retained Axure RP **11.0.0.4150**, `AxureRP11.dll` SHA-256
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
This is static metadata/CIL analysis and bounded instruction replay. The original
DLL, editor, GUI, fonts, and history dispatcher were not executed. Production and
previous frozen research files were not changed.

## The entry distinction is essential

**Ordinary point-mode commit is `Kj3n` → `TN46(points,false)`. It is not `RN4I`.**
The retained `native-point-editing-evidence-mode-cil.json`, `AjIh.Kj3n`
**100685481**, IL`0x238`, calls `VectorShape.TN46` **100702684**. The independent
geometry investigation checks this entry and its callers. `RN4I` **100702640**
is a different operation, with materially different view and AutoFit behavior.
Its direct-call inventory supplied by that investigation contains
`EFqs.YFZz/nFYG` and `VectorShape.DNnE/ANnk`, not that point-mode call.

The first provisional reading of RN4I in this investigation must therefore not
be generalized to all node/handle drags. The final contract below separates them.
Likewise, an early manual reading of `pJvY` suggested named views followed by
Base; exact nested-iterator replay proves **Base first**, then stored named order.
The tN4P eligibility is **AND**, not the initially considered OR.

## Ordinary point-mode contract

`TN46` has this short, direct sequence:

| Token / IL | Operation |
|---|---|
| 100702684, `0x07–0x0C` | `hN4K(points,false,out normalizedPoints)` returns the new owner rectangle. The geometric calculation is separately studied by the geometry agent. |
| `0x12–0x1D` | `xJ0B(rect.Location, false, true, null)` for point-mode's false argument. |
| `0x22–0x2C` | `uJ0j(rect.Size, false, true)`. |
| `0x31–0x33` | `DN4W(normalizedPoints)` writes shared stored control points. |

`xJ0B` **100695349** compares requested Location against current `GJqn` first
(IL`0x07–0x13`). For an ordinary adaptive-capable shape, its false argument
selects `pJ0V` **100695350** → current `vJOH` → `O5Gq` (P101). The true branch
would instead invoke `pJ0w`, but TN46(false) does not request it.

`uJ0j` **100695365** obtains a validated size through `NIuy` and the `xJdR/UHB4`
conversion, compares it with current `uJqf`, and selects `fJ0b` **100695366** →
current `vJOH` → `P5GO` (P105). The pure geometry/validation result is an explicit
sink in this report's scope replay; it is not a claim that arbitrary negative,
zero, transformed, or huge sizes pass NIuy unchanged.

A final narrow size-method inspection separates minimums from maxima:
base `KJm7.NIuy` **100695364**, IL`0x07–0x08`, directly returns its argument;
`xJdR` **100695441** derives the minimum from `get_MinWidth/get_MinHeight`
and transform scale. `fHBd.UHB4` **100722980** applies `GbeB` **100688832**
to each axis, and GbeB is a direct `System.Math.Max`. This retained path does
not establish a 20000 maximum. Virtual overrides and generic transform
validation remain separate; the independent product keeps its existing
1..100000 dimension budget, rather than importing RN4I's `lN47` behavior.

The ordinary `KJm7.get_AllowAdaptive` **100695362** and
`get_AllowAdaptiveLocation` **100695363** both return true. Narrow metadata
checks find no overriding getter on VectorShape, TextRectObject, or
RichTextObject. Temporary provider stacks, contained-object special cases,
masters, and generic scale/translation transforms are outside this ordinary
provider contract.

Consequences for the independent model:

- Compute the new shared normalized path and owner rectangle from the **current
  effective** view. Update only the current geometry slot: Base geometry in
  Base, or the current named view's local override in a named view.
- Location and Size are native atomic pairs. If Location changed, write both
  `x/y`; if Size changed, write both `width/height`. Do not materialize the
  unchanged pair or remove a previous unchanged explicit declaration.
- The location and size comparisons use a per-component `1e-5` equality
  tolerance. Size `op_Equality` **100722991** → `jHBv` **100722994** checks both
  axes via `qbxO(...,1e-5)`; point equality is independently retained in the
  geometry evidence. Equality at exactly the threshold is false.
- Other named views and inactive/orphan overrides remain unchanged. Descendant
  views can naturally inherit the current view's changed geometry; that is not
  an explicit write into each descendant.
- The shared path is changed for every view. Shape300 conversion is a separate
  pre-existing point-mode operation; TN46 does not write Shape.
- **Preserve AutoFitWidth and AutoFitHeight.** TN46 has no such setter, and no
  such setter appears in the connected ordinary geometry-write branch.
- The TN46(false) call does not consult the Affect All Views toggle. Its explicit
  false argument selects current-view writing. No new all-views argument is
  required to reproduce this ordinary point-mode entry.

The 16 connected TN46 replays cover Base/named × Affect All Views false/true ×
both pairs changed/location only/size only/neither. They verify actual retained
setter control flow, current-slot writes, untouched other maps, retained fit
flags, and shared path writes. Integer geometry inputs deliberately avoid
comparison-threshold ambiguity; eight additional size-comparison replays cover
zero, below, equal to, and above `1e-5` on each axis.

## RN4I is a separate cross-view operation

`RN4I` **100702640** snapshots before mutation (`0x08`), saves two transient
dimension flags, reads old SizingRect, calls `hN4K(points,true,...)`, then restores
those transient flags (`0x2F/0x36`). It opens a connection-trapping scope at
`0x40`, disables AutoFitHeight (`0x49`) then AutoFitWidth (`0x50`), writes shared
points (`0x58`), derives two relative geometry vectors through `w5s8` (`0x73`),
calls `tN4P` (`0x7D`), and initializes dimension flags (`0x84`). The retained
finally block disposes the connection scope at `0x8E–0x9C`; exception unwinding
is not executed by the normal-path replay.

`USWJ.ASWS` **100707213** is **TrapConns**, established by its closure fields and
`<TrapConns>b__0`, plus `BSWH` **100707218** collecting connection edits. It is
not an adaptive scope switch.

`tN4P` **100702696**:

1. Requires an attached owning diagram, and returns when both relative vectors
   compare equal to zero. `W5wn` **100721938** compares against `n5wy=(0,0)`;
   this is an epsilon-zero gate, not a NaN gate.
2. Calls `pJvY` **100697003**. Its iterator **100697038** uses the assigned set's
   `At7B` if present. `At7B` **100715536** returns iterator **100715581**, which
   yields `ltPQ` Default first, then `mt7r` named definitions in stored order.
   Without a set, `pJvY` yields only `jJvm.jJvv`; cctor **100697015** creates
   this view and marks it Default via `Wt7o(true)`.
3. A view is processed only when its **effective P111 is not Ignore(0)** AND
   its **local provider slot** has OD Location101, Size105, or Rotation50.
   Both placement TRUE1 and FALSE2 pass this placement test. The 24-case
   predicate matrix independently confirms every combination of the three OD
   bits and all three enum values.
4. Reads every eligible view's old effective Location, Size and Rotation,
   applies the same relative vectors to that frame through G3bq, then calls
   `lN47` **100702697**. The latter's greater-than-20000 branches are not a
   universal clamp guarantee; the geometry report preserves its edge cases.
5. Collects all outputs **before writing any view**. It then writes all
   Locations101, followed by all Sizes105. Each `oJ0u` **100695506** explicitly
   constructs `lJ0A(view)`, invokes `ltAo(key,value)`, and invalidates caches.
   Rotation is read, never written by this method.

The current view and EditAllAdaptive flag do not select RN4I's write scope.
The assigned set determines its enumeration, so orphan IDs from unrelated or
inactive sets are not enumerated. In the independent boolean placement model,
`false` can correspond to native FALSE2, but it cannot also preserve a distinct
native Ignore0 history. This boundary is another reason not to substitute this
RN4I algorithm for the directly observed point-mode TN46 branch.

## AutoFit storage and history

AutoFit is **not PName storage**. `set_AutoFitWidth` **100702343**, IL`0x5F`,
writes shared `GNZZ`; `set_AutoFitHeight` **100702367**, IL`0x65`, writes shared
`mNYN`. Changed values invalidate text layout via OI8Z; identical values skip
the write/invalidation. No adaptive map is selected by either setter.

Frozen bridge evidence identifies serialized keys `AutoFitWidth` and
`AutoFitHeight` in `TextRectObject.oIw4` **100702406**. Their effective getters
can additionally be gated by transform ScaleX/ScaleY. Thus the raw storage,
effective getters, and serialization of those getters must remain distinct.

The geometry snapshot `GScr` constructor **100707152** captures effective
AutoFitWidth/Height and a style snapshot `ASWG` **100707201**. ASWG clones
MyStyle and every entry of `fJZ4`, including entries outside the currently
assigned set. Apply **100707202** clears the destination map and restores cloned
entries and baseline style. GScr.Apply **100707153** restores the saved fit
values. Four ordinary-shape snapshot/restore replays confirm restoration of
Base, current, sibling and orphan styles, removal of newly inserted maps, and
both fit flags.

These are bounded snapshot-method results. They do not independently prove
GUI transaction grouping, cancellation on exceptions, connection restoration,
or the outer history dispatcher's undo/redo lifecycle. For scaled transforms,
the snapshot captures **effective getters**, not necessarily raw true backing
flags. The rotation-only replay uses effective/raw fit equality explicitly.

## Evidence and remaining boundaries

`native-point-commit-format-probes.json` contains **79 passing cases**: 6 nested
view-iterator cases, 24 RN4I view eligibility cases, 6 UI-mode independence
cases, 3 entry guards, 4 explicit-view writers, 4 fit setters, 4 RN4I ordering
cases, 4 geometry/style history snapshots, 16 TN46 connected setter cases and
8 size equality cases. Original geometry, UI events, and provider callbacks are
named sinks where appropriate. This is not an original DLL or GUI comparison.

The geometry agent owns actual hN4K(false/true), rotation, degenerate bounds,
w5s8/G3bq and size-cap arithmetic. No new raw-corpus census is needed to prove
the setter scope; frozen raw Shape/ControlPoints witnesses establish shared
storage but cannot reveal an earlier user's editing history. No synthetic
sequence here is presented as an original saved sample.

The machine-readable summary and manifest bind every cited source, probe,
extraction and report hash. Previous native-point-editing, native-pills and
all-views evidence bytes remain untouched.
