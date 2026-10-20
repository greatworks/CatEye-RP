# Runtime Set Text AutoFit: retained-function DOM measurement

This report executes the retained Axure RP 11.0.0.4150 JavaScript setter and AutoFit functions, together with its shipped jQuery, in a controlled Edge DOM. It does **not** execute the complete vendor application, a generated project, managed DLLs, or the authenticated native GUI in this stage. The fixture layout is independent test construction, not claimed original compiler output. No product source, product tests, or earlier evidence was changed.

## Provenance and method

- Distribution SHA256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Retained extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Root: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files`.

| Retained source | SHA256 | Executed scope |
|---|---|---|
| `resources/scripts/axure/expr.js` | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` | Exact lines 316–385, 387–443, 469–552 |
| `resources/scripts/axure/visibility.js` | `bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53` | Exact lines 40–53 |
| `resources/scripts/jquery-3.7.1.min.js` | `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85` | Complete retained jQuery dependency |
| `resources/css/axure_rp_page.css` | `595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a` | Complete retained base stylesheet |

Run `node research/runtime-text-autofit-measure-probe.mjs`. It verifies every source hash before evaluating the slices, blocks network requests, and records DOM before/after, every jQuery width/height getter result, computed CSS, offset/client dimensions, diagnostic screen and text-range rectangles, resize/move sink calls, and the AutoFit registry. The source slices remain in the retained source files; the probe extracts them at execution time.

Final run: **64 cases, 21 assertions passed**, Edge **155.0.4283.45**, Windows, headless, DPR 1, body `13px Arial, sans-serif`, jQuery 3.7.1. No page errors or requested network resources. Exact output and source-slice hashes are in `runtime-text-autofit-measure-probe.json`.

Named harness substitutions: `$obj` returns fixture metadata; `query.size()` returns the given old size; `computeFullStyle` returns the supplied effective padding/alignment; `query.resize`, `MoveWidget`, and `CacheOriginalText` are recording sinks. `transformTextWithVerticalAlignment` directly invokes its callback; its native cache/style wrapping is outside this probe. `ToString` uses `String`, and every tested setter value is already a string. Consequently, the setter DOM and measurement are original execution, but downstream resizing, repositioning, event dispatch, and geometry caches are not verified here.

## Measurement contract

Static and executed `expr.js:469–552` agree:

1. If neither flag is set, do not measure or register.
2. Read old owner size once. For height, measure the direct text child with jQuery `.height()`, then add effective top/bottom padding (`488–497`).
3. For width, find all descendant `p` elements. Sum **only each paragraph's direct child spans** using jQuery `.width()`, take the maximum paragraph sum, then add effective left/right padding (`499–518`). This is neither the union of all glyph rectangles nor the owner scroll width.
4. Both axes are read in the old layout, height first. The function does not first set width then remeasure height. It requests a single resize if either exact delta differs from zero (`520–524`).
5. Alignment-dependent move follows that resize request (`526–545`); the original branches remain in the extracted function, while actual move execution is a sink. The candidate size is registered even when both deltas are zero (`550`). No rounding is performed by this Axure function.

Observed numbers below are fixture/environment results, not universal font metrics:

| Fixture | jQuery/AutoFit result | What it distinguishes |
|---|---|---|
| Inline span, font 13.3px and tracking .15px | width **52**, screen width **52.109375** | Integer `offsetWidth` fallback, not fractional screen bbox |
| Inline span with horizontal padding 7.5px, borders 2px | offset 59 → content **49.5** | Subtract padding/border after offset fallback |
| Inline `width:123.375px` | width **123.375** despite offset 50 | Nonzero computed CSS width wins even on an inline element |
| Inline `width:0px` | width **50** | Inline zero width falls back to offset |
| Two inline-block content widths 31.375 and 17.125 | sum **48.5** | Fractions are preserved when computed CSS supplies them |
| Inline-block border-box width 31.375, horizontal padding 7.5, borders 2 | **21.875** | Content-box readback |
| Text content-box height 21.375, effective vertical padding 4.5 | **25.875** | Height read then separate effective-padding addition |
| Text border-box height 50.5, padding 4.5, borders 2 | read **44**, result **48.5** | Borders are not added back by AutoFit |
| Two direct spans, one crossing a BR | widths **49 + 25 = 74**, height 30 | Paragraph sum can exceed longest rendered line |
| Three normal-height paragraphs, fonts 13/24/13 | **81 × 58** | Height comes from real combined line layout |
| Two paragraphs with 20.375/31.125 line heights | height **51.5** | No integer rounding in height |
| `p > a > span` only | **0 × 15** | Nested hyperlink span does not participate in direct-span width |
| `p > span > a > span` | positive width | Direct outer span includes its descendants' layout |
| Paragraph direct text, or span outside any paragraph | width **0** | Visible text alone is insufficient for width measurement |
| Empty text layer / empty paragraph and span | **0 × 0** | No invented empty-line strut |
| Span containing a BR / one NBSP | **0 × 15** / **4 × 15** | BR and NBSP differ from empty text |
| Owner rotated 37 degrees | **50 × 15**, same as unrotated | Transform-expanded screen bbox is not the measured box |
| Rotated inline-block CSS width 31.375 | **31.375**, screen width ~32.655 | Same distinction at the span itself |

The old-width wrapping fixture measures at owner width 60.5 and records a candidate **51 × 45**. It does not recompute the height after the candidate width. The unchanged-size fixture registers `48.5 × 20.375` without resize/move calls.

### Bounded independent reader guidance

For the tested modern Edge HTML `div`/`span` range: use computed CSS content dimensions; subtract padding and borders for border-box; fall back to offset dimensions for `auto`, or zero computed size on inline elements with client rects, and convert that border-box result back to content size. Do not use transformed `getBoundingClientRect().width/height` as the measurement.

This is a supported subset, **not a claim to reimplement every jQuery branch**. The minified retained dependency has `ot` at character offset 52560 (dimension reader), `it` at 52066 (box adjustment; locate by `function it(`), and the `cssHooks` width/height getter after them. Character offsets are zero-based in the decoded UTF-8 text. `ot` also contains non-pixel values, `boxSizingReliable`, and table-row reliability branches; its hidden-element hook temporarily swaps CSS. The dependency's gutter adjustment includes an `offset - computed - adjustments - .5` ceiling calculation in certain box conversions. These cannot all be replaced by an unconditional subtraction formula.

Actual support results: `boxSizingReliable=true`, `scrollboxSize=true`, `pixelBoxStyles=true`, `reliableTrDimensions=false`. The last concerns table rows, which these text fixtures do not use. Two explicit `overflow:scroll` fixtures give content-box height **30.125**, and border-box height **30.125 − 4.5 − 2 = 23.625**. Their offset/client measurements show no non-overlay gutter in this environment. Classic scrollbar gutters, table-row measurements, non-pixel computed dimensions, other browser engines, and other DPR settings remain outside this bounded proof.

## Exact plain-setter structure and characters

`expr.js:338` splits **CRLF or LF only**. With one total descendant span and one line, it reuses that span via `.text(value)` (`340–342`). Otherwise it creates one outer span, copies the first span's style and ID (`346–349`), inserts a BR between lines and nested spans for nonempty lines (`353–361`), then replaces the first paragraph's children and removes later paragraphs (`365–371`). It preserves the first paragraph's own style. Rich-mode replacement uses a different HTML branch (`378`); the fixture does not claim a complete native rich-action compiler contract.

Under the fixture's `white-space:nowrap` and Arial 13px:

| Plain input | Result inside first paragraph | AutoFit W × H |
|---|---|---|
| Empty string | Empty existing span; text layer becomes `display:none`/hidden | **0 × 0** |
| Empty string with effective padding [2.25,3.75,2.25,3.75] and a 1px border | Original hidden-layer jQuery content height is 0; add effective padding only | **7.5 × 4.5** |
| `A\n` | Outer span containing `span(A), br` | **9 × 15** |
| `A\n\n` | `span(A), br, br` | **9 × 30** |
| `\n` or `\r\n` | One BR inside outer span | **0 × 15** |
| `A\r\nB` | `span(A), br, span(B)` | **9 × 30** |
| `\nlong first\n\nshort\n` | Four BRs; two nonempty nested spans | **49 × 60** |
| `A\rB` | Literal CR text, no BR | **20 × 15** |
| Bare CR only | Literal CR text, no BR; text layer visible | **0 × 0** |
| `A\u2028B` / `A\u2029B` | Original Unicode separator retained, no BR | **20 × 15** each |
| `  A  B  ` | All original spaces remain in the text node | **20 × 15**, same as `A B` after CSS collapsing |
| Two NBSPs, A, two NBSPs, B, two NBSPs | Actual NBSP characters preserved | **38 × 15** |
| `<b>&</b>\n<em>` | Escaped literal text plus one BR, no `b`/`em` element | Measured normally; full result in JSON |

A trailing BR is not equivalent to appending an empty paragraph or a NBSP-backed empty line. Neither bare CR nor U+2028/U+2029 should be normalized into explicit BRs for this setter path. Ordinary repeated/leading spaces must not inherit the initial-generation NBSP substitution used elsewhere in the independent product. These observations are specific to the original setter and its supplied CSS context.

The styled-first-paragraph fixture retains `line-height:21px`, right alignment, the first span ID, and its 17px font. Its two lines have actual height **44**, not the initially hypothesized `2 × 21 = 42`: mixed parent/span inline formatting determines line boxes. The probe expectation was corrected to the observed 44; no vendor code was changed. Implementations should measure the DOM instead of multiplying the paragraph line-height by a line count.

The sole-link fast path preserves `p > a > span`, then width measures **0** despite visible replacement text. With two nested linked spans, the normal replacement branch removes the anchor and creates a direct outer span; `Replacement` measures **77 × 15**. This follows the actual descendant-span count, not simply whether the model declares one link.

## Hidden owner behavior

`_needsDisplay` (`expr.js:406–413`) walks owner ancestors and inspects **inline** `element.style.display === 'none'`. If found, `_displayWidgetIfNeeded` clones **only the owner subtree** into `#measure` directly under body, sets the clone display to block, and removes it after measurement (`415–443`, `548`). It does not clone ancestor context.

- Owner inline font 20px and `display:none`: clone reads **76 × 23**, original stays hidden, clone is removed.
- A visible ancestor supplies 30px Georgia: **116 × 35**.
- The same font comes only from an ancestor with inline `display:none`: owner-only clone loses that inheritance and measures body Arial13, **50 × 15**.
- Explicit 30px Georgia on the owner survives the clone: **116 × 35**.
- A selector depending on the original ancestor no longer matches the detached clone.
- Parent hidden only through a stylesheet rule is not detected by `_needsDisplay`; this fixture gives **0 × 0** without an owner clone.
- `visibility:hidden` with normal display remains measurable: **50 × 15**.

These are original-function observations. An independent implementation may intentionally resolve effective styles into a detached sandbox; if so it should describe that resolved-style behavior rather than claim the original owner-clone inheritance quirks are reproduced.

## Remaining boundaries

- This establishes the measurement stage and setter structure, not the entire generated HTML/CSS cascade or native GUI pixels.
- The fixture awaits browser font readiness before running. No native font-loading wait policy is proven.
- `normal` line-height depends on the selected fonts, browser, and the complete inline formatting context. The numeric examples are not replacement font-metric constants.
- Query size/cache source, actual owner resizing, alignment movement, AutoFit registration lifecycle, repeater fit propagation, events, and transactions need independent runtime tests; they are named sinks here.
- Hidden-class detection, ancestor inheritance, unsupported table-row dimensions, old browser reliability branches, and arbitrary CSS are not silently idealized into proven parity.
- Earlier bridge evidence (`runtime-text-autofit-bridge-evidence.md`) establishes how flags reach generated objects. This probe does not broaden those generator/type gates or use flags as proof of initial owner resizing.
