# Font style and SetWidgetRichText runtime evidence

Date: 2026-10-14. Target: Axure RP **11.0.0.4150**. This investigation uses retained original JavaScript, narrow managed metadata evidence, and isolated original-function execution in Edge. It does not run the original application or generated sample pages, retry the blocked GUI bridge, or modify product code.

## Immediate implementation contract

`fontStyle` is independent of `fontWeight`. The original runtime passes it directly to CSS and applies it to text runs. Absence preserves the underlying run style; explicit `normal` clears italic/oblique. A style-state patch must preserve that distinction. In a flat-text product, one validated `fontStyle` field propagated through base/adaptive/interaction styles is a bounded first step; it is not heterogeneous rich-text support.

The current milestone deliberately allows `normal|italic` and rejects native Oblique as a product scope boundary. Original runtime CSS accepts `oblique`, with no conversion to italic; the later generator CIL below also confirms the lowercased enum value. Do not silently map native value 2 to italic or confuse the separate Axvg enum ordering.

Full native SetWidgetRichText is a separate feature: its plain and HTML branches have different run-style caching and adaptive-style behavior. Restoring an imported rich action as a plain text assignment would lose these effects.

## Identity and reproduction

- Extraction Evidence ID: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Original source root: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`.
- Reproduction: `node research/scripts/probe-font-style-runtime.mjs`.
- [Machine evidence](font-style-runtime-evidence.json): **22 grouped probes passed**, Edge `155.0.4283.45`, zero network requests and zero page errors. Original hashes are checked before any execution.

| Source | SHA-256 |
|---|---|
| style.js | `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c` |
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| ../jquery-3.7.1.min.js | `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85` |

The probe executes exact retained function slices with shipped jQuery in a blank Edge page. Markup, widget metadata, visibility and autofit endpoints are fixtures. CSS application, state merging, rich/plain transformation, text reading, and style-cache routines are original functions. Source slices and all outcomes are retained in JSON. This is not a complete generated-prototype rendering oracle.

## Official functionality and managed storage

[Styling widgets](https://docs.axure.com/axure-rp/reference/styling-widgets/) documents font family/typeface/size/color and separate bold, italic, underline and strikethrough formatting. [Actions](https://docs.axure.com/axure-rp/reference/actions-list/) describes Set Text and its Rich Text formatting option. [Style effects](https://docs.axure.com/axure-rp/reference/style-effects/) describes alternative appearance while a widget is in a browser interaction state. These pages establish user-facing capabilities, not numeric serialization or CSS-cache internals.

Independent format evidence is retained in [font-style-format-metadata.json](font-style-format-metadata.json), [property CIL](font-style-format-property-cil.json), and [conversion CIL](font-style-format-conversion-cil.json). The property reader `xtod.jtoq.ktz1`, token `100717693`, reads key **1002** at IL 8 and returns a typed property with `AxFontStyle` signature `11BA04`. Metadata `Axure.Platform.AxFontStyle` is **None=-1, Normal=0, Italic=1, Oblique=2**. The separate `Axure.Axvg.Graphics.FontStyle` has Normal=0, Oblique=1, Italic=2. These enums must not be interchanged.

The JavaScript does not carry serialized `determined`/`overridden` flags: it receives generated style objects. It therefore cannot determine which members of a stored Selected PropList the generator emits. In particular, a stored determined-but-not-overridden Normal value must not automatically be treated as an explicit interaction override. That storage filtering question belongs to the independently inspected generator CIL; unknown properties may not be ignored solely because this runtime accepts a known font field.

Generator follow-up: [font-style-format-css-cil.json](font-style-format-css-cil.json) `PNKu.CNxN` IL `0xF2–0x102` calls `AxFontStyle.ToString` then `PNKu.LNx3`. [font-style-format-css-lower-cil.json](font-style-format-css-lower-cil.json), method token `100699325`, IL 8 calls `String.ToLower`; IL 13/15/17 replaces space with underscore. Thus Normal/Italic/Oblique values become `normal/italic/oblique`, not an italic alias. The destination dictionary key remains an encrypted literal; its value conversion is directly established. This follow-up does not settle stored interaction override flags.

## CSS properties and state overlays

Observed and executed source:

- `style.js:2465–2502`: `_getCssStyleProperties` creates separate run/paragraph/all property maps. `fontWeight` and `fontStyle` are included when **not undefined** (2474–2475), so normal/400 are meaningful reset values. Font family is used verbatim (2471); this path invents no family fallback.
- `style.js:2444–2456`: paragraph nodes receive paragraph properties; non-paragraph, non-anchor nodes receive run properties. Italic and weight are run properties, so direct `p` and `a` nodes are skipped, while `span` inside an anchor is updated. A mixed italic/normal pair remains mixed if only weight changes; an explicit normal fontStyle flattens both runs to normal.
- `style.js:2427–2442`: applies these properties to every descendant through the vertical-alignment wrapper. The probe verifies actual inline and computed CSS, not a copied merge algorithm.
- `style.js:1794–1847`: adaptive overrides followed by normal state, hover, pressed, focused, selected, error, hint, disabled overwrite per property. State-generation gating remains as documented in [interaction-styles-evidence.md](interaction-styles-evidence.md); invalid invented compound-state strings are not valid evidence inputs. Probe `mouseOverSelected` retains hover italic while selected changes weight; `selectedDisabled` permits disabled normal to reset fontStyle while selected weight remains.
- `style.js:2028–2042` resets cached **inline CSS**, not HTML text. A later state change therefore restores original mixed styles while preserving text changed by an action.

This is an override path, not proof that every native initial rich-text paragraph gets the same CSS declarations or font-face synthesis. Exact original wrapping/metrics remain bounded by [native-caption-rendering-evidence.md](native-caption-rendering-evidence.md).

## SetWidgetRichText: common behavior

`expr.js:316–385` first stringifies (`753–758`; widget-info values use `.text`), converts CRLF/LF to `<br>` for its HTML branch, and resolves ordinary widget IDs to their inner text panel. Hyperlink targets bypass that lookup. It sets text-panel visibility according to the **input string being empty**, then transforms text and calls `autofitWidget` for each target. It has no equality return or TextChanged dispatch in this body. Identical rich writes still call visibility and autofit. Nonempty HTML whose text content is empty remains visible.

The probe traces visibility and autofit calls but does not execute full visibility propagation, actual autofit dimensions, linked-widget dispatch, or compiler-generated target expansion. Both direct rich and direct multiline-plain arrays visit all targets; the `var i` in the plain-transform callback belongs to a separate function scope. Native `fcall` pre-evaluation/reverse fanout is described in [dropdown-evidence.md](dropdown-evidence.md), and must be considered separately from this low-level loop.

## Plain branch: replace content, retain first run style

With `plain=true` (`expr.js:334–377`):

1. A single span and single line reuse that span through `.text(value)`; markup characters remain literal.
2. Otherwise a new outer span copies the first existing span's inline style and ID. Subsequent runs' formatting is discarded. Multiline values produce child spans and `<br>` elements, preserving blank lines.
3. The first paragraph is retained and receives the replacement span; later paragraphs are removed. With no paragraph, a new `p > span` replaces the text panel content.
4. There is **no post-change recache** and no new `_shapesWithSetRichText` flag. If a hover currently changes the first span's style, plain replacement initially keeps that painted style; the next original-style reset restores its cached baseline CSS while preserving the new text.
5. If an earlier rich assignment already set the rich flag, a later plain assignment does not clear it.

Ordinary product `setText` on a flat string can remain a bounded operation. Importing native plain actions for heterogeneous runs requires first-run and paragraph semantics; importing rich actions as plain would be more lossy still.

## Rich branch: replace markup and establish a new baseline

With `plain=false`, line-normalized input goes directly to `element.innerHTML` (`expr.js:378`), then `CacheOriginalText(id,true)` (`381`). `style.js:2592–2609` assigns missing descendant IDs, caches each node's `style.cssText`, and marks the owning shape as rich-text-updated. It does not cache old text for restoration.

Observed consequences:

- New heterogeneous run styles survive a temporary style effect and subsequent reset.
- The setter does **not** immediately reapply an already-active state override: newly supplied normal text can remain normal until a later paint applies hover italic.
- On later override calculation, `style.js:1801–1818` removes direct adaptive normal font properties listed in `FONT_PROPS` (1763–1775). Interactive state font overrides still apply afterward. It retains geometry/padding.
- A native quirk remains: adaptive `baseStyle` is merged **after** the direct font properties are removed, so font properties from that referenced style can re-enter. The probe demonstrates this; an idealized “ignore every normal font source” rule is not equivalent.

The native HTML branch is evidence of its own implementation, not a proposed safe product format. A future product rich-text model should use validated paragraph/run data and explicit links rather than expose arbitrary native HTML as executable user input. This probe intentionally contains no script-bearing HTML.

## Text getter edge

`axQuery.std.js:883–924` reads direct `p/ul/ol` children, inserts paragraph newlines, substitutes `<br>` and nonbreaking spaces, then extracts text. The normal structured-run fixture reads `A B\nC\nD`.

The exact original `isSoloBr` helper has a narrow quirk: a paragraph containing a sole span whose only **element child** is `<br>` is skipped even if that span also has text nodes. Synthetic `<p><span>A&nbsp;B\nC</span></p>` therefore reads empty for that paragraph after conversion. The probe records this result but does not assert that the editor generates this topology; native generated-run topology requires separate evidence. Do not generalize this quirk to a flat text getter without a known source representation.

## Acceptance and limitations

For this milestone: preserve missing vs normal; change italic independently of weight; reset italic through selected/disabled/adaptive styles; retain state isolation in children/repeater rows; serialize the field into self-contained HTML; reject unsupported stored enum values explicitly. Font-face assets and rights are covered by the separate retained font manifest, not inferred from a CSS family name.

For a later rich-text milestone: heterogeneous initial runs; plain first-run preservation; new rich baseline; state reset without reverting text; adaptive exclusion and referenced-style quirk; literal `<`, `&`, newlines; paragraph boundaries; deferred autofit/links/target order. Unknowns: encrypted generator dictionary key, serialized override filtering until the format investigation resolves it, full generated page/layout, scripts/links, rich XML-to-HTML conversion, and complete initial run/paragraph import. No full test suite or original GUI was run here.
