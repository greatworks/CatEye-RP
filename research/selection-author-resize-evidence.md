# SelectionButton inside author-resized Layers

This is a read-only preparation for a later stage. It does not extend the
current Layer resize release. The source is Axure RP **11.0.0.4150**,
`AxureRP11.dll` SHA256
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
The manifest records its absolute path and every reused/new evidence file.
Only new `selection-author-resize-*` files were written. No target DLL,
application, GUI, production test suite, or package was executed.

## Result

Preserving the shared AutoFit flag and forcing the normal capability-derived
fixed-height input are necessary, but **not sufficient**, to admit checkbox/radio
members into the existing pure author resize planner. SelectionButton inherits
a text-aware Size validator and overrides text/indicator positioning. Those
paths can replace the solver's requested size. They require the measured text
panel and notification/cache transaction; a browser checkbox's dimensions are
not evidence for that measurement.

The next independently implementable slice is explicit storage of selection
layout inputs, followed by a measured SelectionButton setter adapter. It should
not be described as a type-whitelist change. The already frozen Layer controller
and numerical evidence remain valid within their stated sinks.

## Real stored carriers

`selection-author-resize-census.json` retains all **39** objects, exact native
type strings, source/package IDs and hashes, original flags, relevant local
properties, Layer ancestors, and uniquely matched style-cache evidence.
All 39 owner packages have version `[11,0,0,0]`.

| Original file | Checkbox | RadioButton | Total |
|---|---:|---:|---:|
| Default.rplib | 1 | 1 | 2 |
| Sample form patterns.rplib | 20 | 10 | 30 |
| Prototyping Basics.rp | 1 | 0 | 1 |
| Quick Win.rp | 0 | 6 | 6 |
| Other seven corpus files | 0 | 0 | 0 |

AutoFitWidth is explicitly **true in 21**, **false in 18**. AutoFitHeight is
explicitly **false in all 39**. All have string
`align-selection-button-right="False"`. Sixteen are within Layers, all in Form:
twelve width-fit true and four false. None has an AdaptiveStyles entry.
These are raw-file observations, not 39 successfully imported product widgets.
Readback of the retained `layer-resize-native-import-oracle.json` documents
finds **17 imported radios and 0 imported checkboxes**: Default 1, Form 10,
Quick Win 6. All 17 radios lack a product fit carrier. This is an ID join
against that hash-bound oracle, not a fresh import or package test.

In particular, all 22 real checkbox type strings are
`Axure:DiagramObject:Checkbox`. The current reader and TS mapper require
`Axure:DiagramObject:CheckBox` with a capital B. The current native checkbox
admission gap must be handled explicitly in a future change; this census does
not normalize type spellings or expand the importer.

P94 (`SELECTION_BUTTON_SIZE`) is an independent numeric property. All 39 have
complete, uniquely matched default/base cache identities. Effective observed
values are 12 (4), 13 (8), 14 (10), 16 (5), and 18 (12). Thirty-five have a local
P94. The four without it are:

| Owner ID | Immediate Layer ID | Effective P94 |
|---|---|---:|
| `2febce3ee9a5451d9fff59309530d3a3` | `2b77b2a66f0348be9c4fb9d63ef2c2ee` | 12 |
| `16a6963038794f45ae6120f769198d0e` | `85642cc437284d839a86af96e45bde11` | 12 |
| `ec63d573d410461bad7a1c13adab2794` | `c43dfca2cbc34429848952dd35f44558` | 12 |
| `e1cfe37e39af44479c6db7bf551d6cc7` | `c757b735a69540aa95e9482aec0cebad` | 12 |

For each, default ID `627587b6038d43cca051c114ac41ad32` and library ID
`61e3924b25c44f18a45c876a031974fd` identify exactly one cache entry. The local
P0 and matched style ID are both `da3cd290b880433094c51171beb6a273`; the matched
cache exists exactly once and has no P94 override. Default P94 has raw
DOAName `-1073741730`, determined and overridden, value 12. This is a proved
cache fallback, not a fabricated universal default. The census records the
DesignDocument default style source object and part SHA.

## Flags, defaults, and adaptive scope

The preserved bridge evidence and fresh getter/setter/reader records establish:

- Width is shared field `RichTextObject.GNZZ`; getter **100702342**, setter
  **100702343**. Height is shared `TextRectObject.mNYN`; getter **100702366**,
  setter **100702367**. These are not adaptive PName slots.
- Effective width is raw width flag AND (effective transform absent OR ScaleX
  exactly 1); height uses ScaleY. `Widget.rotation` is not a general Transform.
- `TextRectObject.oIw4` **100702406** reads explicit width to GNZZ at IL103,
  after a key-presence branch IL354–364. A missing width key leaves the
  existing field value; it does not prove an unconditional authored default.
  Height is read for package version >=7 at IL195–210.
- `NIwY` **100702405** serializes the effective getters, not an independently
  invented default. Source setters change shared fields and invalidate text
  layout; they are not writes to the current adaptive style map.
- The inspected constructor chain does not itself assign the flags true.
  Native factory/default creation and older-version missing-key initialization
  are not closed by that absence. The current corpus has no missing flags.

Geometry uses the inherited common Location/Size methods and the current-view
controller write (`allViews=false`). Checkbox/RadioButton/SelectionButton do
not override the geometry methods inventoried in the frozen planner metadata.
However, their TextRectObject ancestor **does** override virtual `NIuy` and
`EIuw`. Nonvirtual `uJ0j` is therefore not proof of a text-independent setter.
The new five-type metadata inventory records this distinction.

## Capability and controller behavior

SelectionButton capability getter **100702019** has mask
`0x37d9e47fefde7fbf`; Checkbox **100699783** has
`0x37d9ec7fefde7fbf`; RadioButton inherits SelectionButton's getter.
FixedWidth capability exists; FixedHeight capability does not.

Normal `kbNq` **100686252** reads the effective P109 fixed-width value, but
forces its computed fixed-height input true because the height capability is
absent. This is **not an absolute geometry lock**: the separately frozen
`mNwa` solver gives a two-edge top+bottom pin precedence over fixed height.
Exact Control+Alt is also a distinct controller branch. Stored pin properties
and capabilities must remain separate inputs.

`get_SizingFreedoms` **100702025** returns Horizontal (1), or
Horizontal|Fit (65537) when effective width fit is true. That direct object
handle policy must not replace the Layer controller's gesture freedom.

`JbNd` **100686253** only changes a fit flag already true. Its SelectionButton
branch, unlike VectorShape's branch, does **not** test fixedWidth:

```
if effectiveAutoFitWidth && gestureFreedom has Horizontal:
    set_AutoFitWidth(abs(dx) < 0.00001)
```

The comparison is strict. Vertical-only gestures do not write this width flag.
No SelectionButton height-fit write appears in this branch. A fixed-width pin
can leave geometry unchanged while a horizontal gesture turns shared width
fit off; the adapter must preserve that side effect.

## Size validation and label/indicator separation

`get_ButtonSize` **100702026** reads effective style P94 through
`jtoq.a5Vc` **100717838** → `ttoo` **100717685**. With an active transform, it
multiplies by ScaleX; null transform leaves it unchanged (zero ScaleX returns
zero). `get_SELECTION_BUTTON_SIZE` **100702027** makes a square. SelectionButton
`get_AdditionalWidthPadding` **100702034** returns this indicator width.
The label and the indicator are not scaled as one browser-control box.

The important setter chain is:

```
controller YJ0S100695371
  -> uJ0j100695365
  -> virtual NIuy => TextRectObject100702369
  -> KNZn100702371
```

For nonempty text, KNZn returns width = measured TextPanel.width +
left padding + right padding + indicator width when width fit is true;
otherwise requested width survives. Height analogously uses measured text
height + top/bottom padding when height fit is true. Empty text returns the
requested size. Current real controls have height fit false, but later
positioning is a separate height writer.

`PNZ8` **100702375** measures first, using
`jNZf100702376 - get_WidthPadding100702364`, provisional height 1. WidthPadding
is left + right + the virtual additional indicator width. Then it calls virtual
`WIyL`, resolving to SelectionButton **100702035**.

WIyL positions the text panel independently. With short text
(`textHeight < buttonSize`), text y is top padding, or
`(buttonSize-textHeight+topPadding-bottomPadding)/2`, or
`buttonSize-textHeight-bottomPadding`, for top/middle/bottom. With taller text,
this local y is zero. Text x is left padding + indicator width for the observed
left-indicator arrangement; right-indicator uses left padding alone.

It unions the indicator rectangle and text rectangle, preserves the current
owner width, uses indicator height when text is shorter, applies its transform
division branch if present, and writes Size via `uJ0j(...,false,true)`.
The 18 positioning probes inject an origin indicator rectangle and measured
text sizes; they do **not** establish native font metrics or all graphic offsets.
`XNUc` **100702036**, `CNUW` **100702037**, and `mNU6` **100702038** retain the
separate indicator alignment/graphics paths for the next adapter.

Style changes are relevant too: SelectionButton `MIue` **100702033** checks P94;
for nonempty text with button size exceeding owner width it requests
buttonSize + textPanelWidth before calling TextRectObject.MIue **100702383**.

## Minimal next slice and remaining hook

1. Preserve explicit shared selection text-fit flags and explicit indicator
   alignment; do not infer missing flags from current dimensions. Either extend
   the existing shared fit carrier to selections or add a dedicated selection
   layout carrier. The name is an independent model decision.
2. Preserve P94 as an effective style property with provenance and correct
   native type spelling. Do not put P94 in a shared-only field: it comes from the
   style provider, while AlignRight and fit flags are object fields.
3. Implement a selection setter adapter between numerical projection and final
   member commit. It needs text-panel measurement, the KNZn size validation,
   and the positioning callback. Keep updates atomic and current-view geometry
   separate from shared fit changes.
4. Before enabling the complete type family, compose the reentrant
   `TextRectObject.OI8Z` **100702374** transaction. Fresh CIL retains its guard
   `vNY9` (IL33–70), cached prior rectangle `KNYS`, measurement, alignment-based
   Location correction, `YJ0S(...,false)` (IL899–912), and `PNZ8` (IL656–657).
   Its complete cache/reentry/notification behavior has **not** been replayed
   here. `TextRectObject.EIuw100702372` calls this invalidation after Size
   change; the fit setter also invokes it.

Thus preserving data and testing a measured adapter are safe independent next
steps. Merely adding checkbox/radio to the current pure planner whitelist is
not supported. Native font measurement, the full invalidation transaction,
right-aligned real sample coverage, general transforms, native factory defaults,
and original GUI/history parity remain explicit gaps.

## Checks and reproduction

`node research/selection-author-resize-census.mjs` reads only the eleven
original containers and writes only the new census. Source SHA checks precede
the read. `node research/selection-author-resize-probe.mjs` passes **76/76**
bounded cases: 2 sizing-freedom, 15 indicator-size, 32 controller fit/capability,
18 measured positioning, 8 KNZn size, and 1 measure-before-position case.

The probe interprets retained CIL instructions with folded static constants.
Graphics measurement, effective style/transform lookup, indicator graphics,
and final notification writes are explicit sinks. It does not execute Axure
or prove a complete resize transaction. Machine-readable conclusions, the full
39-object list, source hashes, and remaining hooks accompany this report.
