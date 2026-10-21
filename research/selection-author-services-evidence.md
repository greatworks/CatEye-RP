# SelectionButton author layout services

This closes three bounded services and the property entry order used by the
ordinary selection layout transaction. It supplements the frozen
`selection-layout-transaction-evidence` and `selection-layout-border-evidence`
records. It does not revise them or claim an original Axure GUI observation.

The pinned Axure RP 11.0.0.4150 DLL is
`AxureRP11.dll`, SHA-256
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
The extraction source remains distribution SHA-256
`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0`,
evidence `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
New extraction uses PEReader only. No target assembly was loaded or executed;
no original GUI, browser, build, or product test was run for this report.

## SAS-01 — ordinary minimum is 1×1

`KJm7.get_MinWidth` **100695442** and `get_MinHeight` **100695443**
both execute `ldc.r8 1; ret` at IL7–16.
The complete metadata inheritance chain is:

`Checkbox / RadioButton → SelectionButton → TextRectObject → RichTextObject
→ DiagramObjectContainer → KJm7`.

None of the intervening types overrides either getter. The old
`PlainTextObject` class is not the RichTextObject superclass; the new metadata
records preserve the actual TypeDef links.

`KJm7.xJdR` **100695441** constructs its Size from those virtual getters at
IL343–357. With no active general Transform, it returns that Size. With an
active transform, each nonzero ScaleX/ScaleY multiplies the corresponding
minimum; an exactly zero scale uses 1 on that axis (IL423/103 and IL277/64).
The bounded replay includes null, identity, positive, zero and negative scale
carriers. Negative transformed minima are observed source arithmetic, not an
admitted product geometry policy.

Thus an ordinary non-transform SelectionButton minimum service can return
`{width:1,height:1}`. P94 is **not** this getter minimum. The later
`KNZn/WIyL` transaction may still enlarge the owner for text/indicator layout,
as recorded in the separate transaction evidence.

## SAS-02 — H5px union and ignoreEmpty

`d5pN.H5px` **100720524** executes the retained instructions, including:

1. If A equals the static O5sD all-zero rectangle under the rectangle equality
   predicate, or A has any NaN component, return B.
2. If `ignoreEmpty` and `A.IsEmpty(false)`, return B.
3. Apply the same tests to B and return A when B is excluded.
4. Otherwise return the rectangle formed by min(left/top), max(right/bottom).

O5sD is built from four zero doubles by `j5u5..cctor` **100722161**
IL33–74. Equality **100722129 → 100722133** compares each component using
`qbxO` **100688812**, i.e. `abs(a-b) < 1e-5`. This near-zero sentinel test
occurs even when `ignoreEmpty=false`.

`j5u5.IsEmpty` **100722085** uses `TbxU` **100688813**:
`abs(value) < 1e-5`, strictly less than. Its false argument means **either**
near-zero width or near-zero height; its true argument means **both**.
H5px explicitly passes false at IL302–305 and IL434–437.
`Y5s3` **100722088** checks any component for NaN.

For ordinary finite nonnegative rectangles:

- `(40,60,0,16)` is ignored with `ignoreEmpty=true`.
- Width `0.000009999` is ignored; width `0.00001` is retained.
- If A and B are both empty, A's early return wins and returns B unchanged;
  the function is not a normalization service for empty inputs.
- `ignoreEmpty=false` preserves a non-origin zero-width/height rectangle,
  except the unconditional near-all-zero sentinel rule.
- The union arithmetic preserves source operation order, e.g.
  `(40 + 0.00001) - 10`, not algebraically regrouped `30 + 0.00001`.

The product may reject nonfinite inputs before invoking this finite service.
Such a rejection is a safety policy, not the original NaN branch behavior.

## SAS-03 — graphics inset is a matrix conversion, not a zoom label

`N5pp` **100720541**, IL7–11, calls `Transform(size,2,0,graphics)`.
`Transform` **100720540** builds `[origin, size-as-point]`, invokes virtual
`s5ZY.f3j3` **100721064** with **destination 0, source 2**, and subtracts the
two transformed points.

The Direct2D implementation `U13T.f3j3` **100727484** uses the retained
branch/control instructions:

- obtains the RenderTarget transform at IL239–255;
- for source2→destination0, obtains its inverse at IL554–561;
- each point is first transformed by `e1g2()` and then by that inverse
  at IL436–465.

`e1g2` **100727399** reads field p1gn. Its constructor **100727401**
initializes that field to Matrix3x2.Identity at IL23–29. This alone does not
prove that the field or RenderTarget transform remain identity for every
editor zoom/DPI state. The exact point adapter **100727600** explicitly
casts coordinates to float before the SharpDX matrix helper; those conversion
records are retained, and the probe declares its matrix/float facade.

The SVG graphics implementation `dHbV.f3j3` **100723592**, IL223–248,
divides `(point + matrix translation)` by its diagonal scale for destination0.
The size difference cancels translation.

Meaningful retained-control replay results for a requested `(2,2)`:

| Explicit context | Converted size |
| --- | --- |
| Direct2D identity page and render linear matrices | `(2,2)` |
| Same, render translation `(100,200)` | `(2,2)` |
| Render scale2, page identity | `(1,1)` |
| Render scale0.5, page identity | `(4,4)` |
| Render identity, page scale2 | `(4,4)` |
| Render scale `(2,4)`, page identity | `(1,0.5)` |
| SVG diagonal scale1 / 2 / 0.5 | `(2,2)` / `(1,1)` / `(4,4)` |

A browser/CSS identity-unit inset `(2,2)` is therefore an implementable
**explicit unit-context policy**. This report does not establish that a
native GUI control labelled “100%” guarantees that context, nor recover
general DPI/zoom/rotation/shear initialization.

## SAS-04 — fit, AlignRight and P94 take different entrances

The new replay preserves the actual setter/notification instructions and
uses visible event sinks for downstream layout work. The complete OI8Z
transaction remains the separately frozen 199-check evidence.

| Change | Original entry and order |
| --- | --- |
| AFWidth unchanged | **100702343** returns without layout |
| AFWidth changed | write GNZZ at IL93–95, then virtual OI8Z(true) IL33–35 |
| AFHeight unchanged | **100702367** returns without layout |
| AFHeight changed | write mNYN at IL99–101, then virtual OI8Z(true) IL66–68 |
| AlignRight unchanged | **100702032** returns |
| AlignRight changed | write qNUe IL92–94 → virtual WIyL IL66–67 → VJm0(false,null) IL125–128 |

AlignRight does **not** directly invoke PNZ8/INOR or OI8Z(true). WIyL may
change final panel placement/owner height using the existing measured panel,
but a new font measurement must not be inserted merely because alignment
changed.

P94 style-change entry is `SelectionButton.MIue` **100702033**:

1. If the changed-key set contains 94, the text is nonempty, and effective
   ButtonSize `b > current owner width`, request size
   `(b + old panel width, old owner height)` through
   `uJ0j(false,true)` (IL7–80).
2. Call `TextRectObject.MIue` **100702383** (IL85–88).
3. That base override calls BNZT then OI8Z(false) only when notify is true,
   the layout guard is false, XJdz is false, and the changed key list is not
   exactly `[101]` (IL7–77).
4. It always forwards to the KJm7 base notification at IL82–85.

The first P94 expansion check precedes the base notify/contained/guard gate.
The bounded replay includes these combinations and the unordered-compare
NaN skip. It does not replace this chain with generic `layout(true)`.
The parent implementation is currently adding Size/Fit/AlignRight; P94 author
notification integration is a separately retained pending item.

## SAS-05 — coordinate context and new-object defaults remain bounded

`get_LocationInDiagram` **100695389** reads `GJdZ` **100695467**. When that
direct parent is a KJm7 widget, it returns own Location plus the parent's
LocationInDiagram; otherwise it returns own Location (IL33–130).
The GJdZ field is aJZ0. `DiagramObjectContainer.YNhv/XNhQ`
**100700290/291** assign/clear this parent for their contained objects.
The separate diagram registration path `OJa9.iJaR` **100695101** assigns
the diagram object itself as parent when none already exists.

These are different ownership relationships; a product must not blindly
sum every panel/repeater/Layer ancestor into the transaction input. The new
replay confirms the getter's widget-parent/non-widget-parent branches. It
does **not** establish all panel-state/repeater-template construction paths,
so full nested edit-scope parity remains unclaimed. A page/Layer-scope
implementation with explicit same-diagram coordinates is the bounded domain.

SelectionButton/TextRect/RichText construction records contain no explicit
AFWidth/AFHeight true initialization in these examined constructors. Their
raw bool fields start at CLR zero, but upstream creation tools/default-style
providers are not all covered; this is not proof of final toolbox defaults.
No native universal P94=14 default is established. The earlier 39 real
objects contain P94 12/13/14/16/18, including cache12 fallback cases. A new
product's 14px / false / false creation policy must be labelled independent,
or creation can remain unchanged.

## Execution, retained failures and remaining services

`selection-author-services-probe.mjs` passes **73/73** bounded checks:
1 base minimum, 6 effective-minimum contexts, 9 threshold unions,
4 keep-empty unions, 4 NaN carriers, 6 sentinel/order cases,
10 IsEmpty predicates, 12 setter changes, 10 P94 entries, 9 graphics
contexts, and 2 location-parent branches.

All calls below the interpreted instructions are declared facades: simple
value constructors/getters, Math, matrix inversion/point conversion, style
provider values and downstream layout/invalidation event sinks. There is no
native font or Windows graphics pixel execution. Nonfinite fixture values
are serialized as explicit strings.

Three actual harness failures remain:

- `selection-author-services-failure-1.json`: independent expected union
  regrouped floating-point arithmetic; corrected to original operation order.
- `...failure-2.json`: CLR boolean field was represented by JS false while
  an IL `ceq 0` required numeric0 in this interpreter; facade corrected.
- `...failure-3.json`: SVG local value-type point constructor was missing its
  receiver convention; interpreter dispatch corrected.

They are probe construction failures, not observed Axure product failures.
The final 73-check result and all current source hashes are separate.

Still open: KIf5 font shaping/measurement, full native graphics context
initialization, arbitrary nested diagram ownership, complete default-style
and toolbox construction, and external invalidation/ancestor side effects
beyond the frozen transaction's sinks. No general native pixel or complete
author-command parity is claimed.
