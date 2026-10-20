# Empty rich-text lines: bounded rendering review

This investigation diagnoses the current product's mixed-font empty paragraph. It does not claim execution of the native Axure page generator or original GUI.

## Reproduction and result

`node research/scripts/probe-rich-empty-linebox.mjs <exported-rich-text.html>` runs an independent headless Edge instance without a development server. It measures nine standards-mode HTML variants with the project's licensed Roboto-Regular font, then six variants in the actual failed exported artifact. JSON files retain browser version, font/artifact hashes, complete relevant DOM and computed styles:

- `rich-empty-linebox-evidence.json`
- `rich-empty-linebox-export-evidence.json`

With paragraph **Arial 14px**, run **Roboto 26px**, both using computed **line-height:36px**, the actual line box is **40px**. Empty span plus sibling br, br inside the run, and a nonempty run all reproduce 40px. Thus the discrepancy is not an extra empty paragraph or duplicated br. A three-line topology matching the native plain-setter structure measures 120px for this chosen CSS combination.

The cause is baseline alignment of different font metrics. The paragraph contributes its own minimum line box (strut), while the run contributes another inline box; their aligned top/bottom union can exceed either individual line-height. [CSS 2.2 section 10.8](https://www.w3.org/TR/CSS22/visudet.html#line-height) defines this calculation. A specified line-height is not a promise that a mixed-font paragraph's measured height equals that number.

An initial exploratory fixture omitted the doctype and measured 36px in quirks mode. The retained probe explicitly uses `<!doctype html>` and reproduces the exported standards-mode result; the earlier exploratory measurement is not used as evidence.

## Alternative representations are semantic changes

In both the isolated standards-mode fixture and actual exported DOM:

| Variant | Actual height |
| --- | ---: |
| Current empty run plus sibling br | 40px |
| br moved inside first run | 40px |
| Only br, removing the empty styled run | 36px |
| Paragraph font also changed to first run's Roboto 26px | 36px |
| Paragraph font-size:0 while retaining line-height:36px | 45px |

Dropping the run loses its empty-line formatting. Applying the first run's font to the paragraph changes its inherited strut. Zeroing only font-size does not remove the 36px strut and worsens this example. These alternatives are not justified solely to make an overstrict test pass.

## Native evidence and boundary

Pinned original Axure 11.0.0.4150 `resources/scripts/axure/expr.js:316–385`, especially 335–380, implements plain SetWidgetRichText by copying the first span style, placing nonempty lines in child spans separated by br elements, and retaining only the first p. It does not create one paragraph per newline. The current product intentionally represents replacement lines as structured paragraphs; that modeling choice is already separate from native HTML topology.

This research uses the retained extraction `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`, package SHA256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`. Exact generated native paragraph CSS and native final-paint metrics were not established by this fixture. The font and exported artifact hashes are in the JSON evidence.

## Review recommendation

Keep the current CSS semantics. Assert the requested computed line-height, that an empty paragraph occupies at least that line-height, and parity between React and exported HTML under the same fonts. Do not change fonts, remove preserved run style, or impose a fixed height merely to require 36px. Same-font initial blank lines still measured the specified 28px. No product, build, full test suite or original GUI changes were made by this task.
