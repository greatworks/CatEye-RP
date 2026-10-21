# SelectionButton layout transaction, RP 11.0.0.4150

The ordinary SelectionButton transaction is now closed at the source-control-flow
level, with explicit graphics and document-service callbacks. The new probe
passes **199/199 checks**: 183 transaction/entry cases and 16 sentinel cases.
It interprets 37 retained CIL methods. It does not load or execute the original
DLL, measure an original font, or compare an original GUI.

Original DLL SHA256:
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
Its absolute path, every input, and new output are recorded in
`selection-layout-transaction-manifest.json`. The preceding
`selection-author-resize-*` files and their 76 checks remain unchanged and are
not counted again.

## Adapter contract

This is a callback contract for an independent implementation, not a new native
serialization schema. Use three distinct entry points:

| Entry | Native method | Required behavior |
|---|---|---|
| Layout | TextRectObject.OI8Z **100702374**, boolean argument | `false` goes directly to PNZ8. `true` first recalculates the fit size and alignment position, then goes to PNZ8. |
| Size assignment | KJm7.uJ0j **100695365**, proposed Size, all-views flag, notify flag | Apply minimum-size/NIuy validation before equality and writing. The TextRectObject size-changed override EIuw **100702372** calls OI8Z(true), then its base notification. |
| Fit flag change | RichTextObject.set_AutoFitWidth **100702343**, TextRectObject.set_AutoFitHeight **100702367** | Change the shared backing field and call OI8Z(true) only when the raw Boolean changes. No unchanged-flag layout. |

Inputs must include:

- Current effective owner rectangle; previous text-panel rectangle in its local
  coordinates; text emptiness; width-fit and height-fit **effective getters**.
  Raw shared flags are separately required for a flag-change entry.
- Effective text alignment (0 left, 1 center, 2 right), vertical alignment
  (0 top, 1 middle, 2 bottom), four paddings, P94 indicator size, and AlignRight.
- Guard state and optional **style-editor temporary KNYS rectangle**. Missing
  KNYS means the native four-NaN sentinel, not an arbitrary falsy/empty rectangle.
  Do not populate KNYS with a drag-start snapshot.
- A graphics measurement callback, a graphics size-conversion callback, and
  ordinary geometry/provider/notification callbacks described below.

Return the final owner rectangle, final local text-panel rectangle, final raw
fit flags, and an ordered log of geometry writes/invalidations/notifications.
A pure adapter may accumulate proposed changes and commit them atomically, but
that is a product policy: the source only guarantees guard cleanup, **not**
rollback after a later measurement or callback throws.

The bounded implementation domain is ordinary SelectionButton with no general
Transform and no owner/text rotation. The numerical fixtures use a page origin
where Location and LocationInDiagram coincide. A caller must preserve both
coordinate spaces or reject an unsupported containing context; it must not
silently equate them inside arbitrary nested containers.

## Exact transaction order

1. OI8Z returns immediately when `vNY9` is already true (IL33–70).
   Otherwise `hbxB` **100688766** calls CNYB(true), returning a disposable whose
   callback restores false. OI8Z has a real finally region: try IL117–1548,
   handler IL1549–1609. The interpreter checks this metadata and runs the exact
   callback using its explicit cleanup mechanism.
2. For the `true` entry, choose reference rectangle `R`: KNYS when initialized,
   otherwise current UnroundedRect. `a5s1` **100722087** considers the sentinel
   missing only when **all four** components are NaN. Partially NaN rectangles
   are not treated as missing. The adapter should reject malformed nonfinite
   inputs rather than fabricate a reference.
3. If width fit is effective, INOR measures using the previous panel size.
   Otherwise, if height fit is effective, INOR receives
   `(jNZf - WidthPadding, 1)`. If neither is effective, skip this first measure.
4. KNZn **100702371** produces candidate size `S` from `R.size` and the measured
   panel. For nonempty text, width fit substitutes panel width + left/right
   padding + indicator width; height fit substitutes panel height + top/bottom
   padding. Empty text returns the requested size unchanged.
5. Starting from `R.x/y`, adjust an axis only when old and candidate sizes
   differ by the native strict `abs(delta) < 1e-5` equality rule. Left/top adds
   zero, right/bottom adds `old-new`, center/middle adds
   `floor(old/2)-floor(new/2)`. This is not `floor((old-new)/2)`.
6. Call YJ0S **100695371** with that rectangle and `allViews=false`.
   Its Size write occurs before Location. The Size validator is still active.
   Recursive EIuw → OI8Z(true) is blocked by the guard; base size notification
   still runs. Ordinary lower provider writes and external subscribers are
   explicit callback boundaries.
7. Both entry modes then call PNZ8 **100702375**. It calls INOR with
   `(jNZf - WidthPadding, 1)`, then virtual WIyL, resolving to SelectionButton
   **100702035**. This second measurement can differ from the first.
8. WIyL positions the panel, obtains the indicator rectangle, unions it with
   the text rectangle, preserves current owner width, and substitutes indicator
   height when text is shorter than the indicator. It calls
   `uJ0j(resultSize,false,true)` again. KNZn still validates that request.
   The guarded transaction does **not** repeat alignment after this final
   correction.
9. OI8Z requests DJ0E(false,true), then releases the guard in finally.

An external Size entry has an important extra ordering step: KNZn validates the
requested size **before** the first size notification invokes OI8Z. For example,
with old panel 50×15, P94=13, width-fit true, current owner 100×20 at (20,30),
requesting width150 first writes63, not150. With injected measurement70×28 and
center alignment, the complete source sequence writes widths63 →83, ending at
x10 and height28. It does not center the result around the original100-wide box.

## Measurement and positioning callbacks

INOR **100701896**, GtCX **100715355**, dtCa **100715353**, RHBf **100722983**
and the ordinary TextPanel setters are interpreted in the new probe.
Only the returned KIf5 **100715354** graphics measurement is injected.

- Width-fit uses the source GtCX measurement width10000. Non-width-fit uses
  the supplied constraint width and retains that width while taking the
  measured height.
- Non-width-fit empty text uses height16 without graphics measurement.
  The active RTF-editor branch instead reads its editor-height callback.
- Panel measured sizes round to zero digits with MidpointRounding.AwayFromZero.
  INOR preserves the existing panel location; it updates Size only.
- SelectionButton WIyL computes panel x = left padding + indicator width,
  or just left padding for AlignRight. If text height < indicator size, panel y
  is top padding, `(indicator-text+top-bottom)/2`, or
  `indicator-text-bottom`; otherwise y=0.
- LNOE **100701897** then rounds panel x/y to zero digits with **ToEven**,
  compares against its old local location, and only on change writes Rect and
  calls INOc(true). `get_RectInDiagram` **100702296** adds owner
  LocationInDiagram; this is separate from the local panel Rect.
- Source XNUc **100702036** is interpreted for indicator placement. Its
  N5pp callback converts a size from source space2 to World0. The default2×2
  answer in these fixtures is a declared synthetic identity conversion, not
  proof of a fixed CSS 2px inset. Short/empty text uses owner Location.y;
  taller text uses panel Rect + LocationInDiagram. The separate render
  evidence covers that graphic-unit distinction.

The callback services still owned by the host are:

1. Actual KIf5 font/shaping measurement, including fonts, runs, editing state,
   and available graphics configuration.
2. General graphics coordinate conversion and the containing coordinate
   context. General Transform/rotation are outside this adapter domain.
3. Effective style/provider reads, minimum-size policy and current/base
   geometry writes. False all-views arguments are retained; no caller should
   turn them into Affect All Views.
4. Cache invalidation, document notifications and ancestor effects. Source
   DJ0E **100695409** invalidates itself, walks LIsW ancestors, and can notify
   EJdP/container owners. The new transaction logs these calls; it does not
   simulate an entire editor or parent-refit graph.
5. INOc's inline-link synchronization and external notification subscribers.
   Ordinary no-inline-link selection layout is the bounded numerical domain.

## Cache and trigger provenance

KNYS is field **67126835**. Constructors initialize D5sx, whose cctor
**100722161** writes four NaNs at IL99–140. Verified sr6c style-editor ctor
**100677936** snapshots selected TextRectObject.get_Rect at IL166–179;
Dispose **100677937** restores D5sx at IL183–195. The candidate-reference
inventory is retained, and these actual writes were checked against complete
CIL. No generic drag-baseline writer was inferred from the field name.

TextRectObject.MIue **100702383** runs BNZT then OI8Z(false) when notification
is requested, no layout is already in progress, XJdz/PJZO suppression is false,
and the changed-key list is not exactly `[101]`. Metadata identifies
P101 as LOCATION. It always continues to the base MIue notification.
SelectionButton.MIue **100702033** runs first: if P94 is present, text is
nonempty, and indicator size exceeds owner width, it requests width =
indicator size + existing panel width before the base TextRect path.

Other retained call sites are explicit rather than generalized: NIuM
**100702384** invokes OI8Z(false). Update **100702380** uses the BJ0y
cached-view predicate and ntiC update predicate; its applicable branch clears
RichTextPanel caches through CNOH and invokes OI8Z(true). The fields/branches
are retained, but this report does not claim every external update reason has
been enumerated. TextRect oIwv **100702407** also has a PNZ8 load path.

## Numeric checks and limits

The 144 fit/cache/alignment matrix entries use independent expected rectangle
and panel formulas. Additional checks cover reentry, exceptions on each
measurement pass, two different measurement returns, ToEven versus
AwayFromZero, fit setters, P101 suppression, P94 preflight, and Size epsilon.
Each trace preserves actual method tokens and ordered effects.

Illustrative synthetic case: owner `(20,30,100,20)`, both fits true,
center/middle, P94=13, zero padding. First measurement70×28 yields rectangle
`(29,26,83,28)`. A second90×40 yields final `(29,26,103,40)`, with no second
Location correction. If that second measurement throws instead, the earlier
geometry remains while guard becomes false.

Reproduce only these new outputs:

```text
node research/selection-layout-transaction-replay.mjs
node research/selection-layout-transaction-report.mjs
```

The previous raw census remains the source for39 native carriers versus17
actually imported radios and0 imported checkboxes. No new native admission,
product source change, browser suite, desktop package, or GUI parity result
is claimed by this research.
