# RP 11 retained base CSS and text-layer sizing

Verified 2026-10-14 against the already extracted Axure RP 11.0.0.4150 distribution. This is a bounded, read-only source audit, not an original generated-page or GUI comparison. It supplements [text-autofit-native-evidence.md](text-autofit-native-evidence.md) without modifying that report, the frozen font evidence, or product code.

## Finding

The nine retained prototype CSS files contain **721 parsed rules**. None has a `.text` class selector or a plain `.ax_default` class selector. In particular, `resources/css/axure_rp_page.css` does not impose a generic shape/text `overflow:hidden`, fixed height, `position`, or `white-space` rule. This is a statement about these files, not the complete CSS of a generated document.

The conspicuous `overflow:hidden` declarations in `resources/css/default.css` belong to the prototype **player shell**. The retained `start.html` loads this stylesheet and holds the prototype page in `iframe#mainFrame`. Those shell declarations cannot simply be applied to every shape or its text child inside that separate document.

Consequently this audit finds no retained base rule that contradicts the prior native writer's separate text layer: `#owner .text` width100%, absolute positioning, border-box padding/alignment, text-rule height omission, and AutoFitWidth→nowrap. It also does **not** prove that the real page's final text overflow is visible. Per-project/per-page generated styles, actual DOM attachment, other applicable ancestors, and initial runtime calls remain missing.

## Exact CSS selectors and source locations

Paths below are relative to the retained `DefaultSettings/Prototype_Files` directory; line numbers are one-based in the original files.

| Source | Actual selector / declaration | Scope and limitation |
|---|---|---|
| `resources/css/axure_rp_page.css:2–4` | `html, body { height:100%; }` | Document root only; not a shape owner height. |
| `axure_rp_page.css:40–52` | `a { color:inherit; }`; `p` margin0 plus legibility/kerning settings | Paragraph rule sets no height, width, overflow, line-height, or white-space. |
| `axure_rp_page.css:54–79` | `ul` margin0; `iframe` white background; `input` padding1px 0 and border-box; `textarea` margin0 and border-box | Element-specific rules. The input rule is not a generic shape text rule. |
| `axure_rp_page.css:89–104` | `div.intcases` absolute, `white-space:pre-wrap`, `overflow-wrap:break-word`, max-width250px | Case-selection menu; not ordinary authored text. |
| `axure_rp_page.css:160–179,194–205` | `div.annnotelabel` and `.annotationName` use nowrap | Annotation UI; not all paragraphs or `.text` children. |
| `axure_rp_page.css:290–293` | `.ax_default_hidden, .ax_default_unplaced` set display none and visibility hidden | These exact suffixed classes exist; they are not a plain `.ax_default` layout rule. |
| `axure_rp_page.css:305–325` | `.singleImg` hidden; `.nopointer` pointer handling; `.bgImg` no-repeat/100% background; `.transition *` inherits transition | No text sizing or clipping declaration in these helpers. |
| `axure_rp_page.css:360–380` | `#ios-safari`/`#ios-safari-html` overflow auto; latter absolute with four offsets; fixed helper absolute | Specific scrolling wrappers. Not a generic shape owner rule. |
| `resources/css/reset.css:1–13` | Enumerated HTML elements including div/span/p: margin0, padding0, border0 | No width/height/position/overflow/white-space reset. Actual inclusion in a particular generated page is not established here. |
| `resources/css/default.css:1–13` | Player `body` font defaults and overflow hidden | Confirmed loaded by `start.html:9–10`, not evidence of ordinary page inclusion. |
| `default.css:36–85` | `#outerContainer` absolute1000×1500/overflow hidden/flex; `#mainPanel` overflow hidden; `#clippingBounds` width100%/overflow hidden/absolute | Player-shell IDs visibly present in `start.html:119–129`. |
| `default.css:380–392` | `#inspectControlFrameHeaderContainer`, `#projectControlFrameHeaderContainer`: overflow visible | Shell toolbar containers, not an owner-text overflow rule. |
| `default.css:666–720` | `.pageNameHeader`, `.adaptiveViewHeader`, `.scaleHeader`: nowrap/hidden/ellipsis | Shell titles, not authored shapes. |

`previewfonts.css` contains only two Source Sans Pro `@font-face` declarations. `jquery-ui-themes.css` contains `.ui-*` component rules. Four plugin stylesheets cover sitemap, notes, debug and record/play UI. All nine files were parsed with the already installed PostCSS parser; the complete selector/declaration census and source hashes are in the JSON. Comments were excluded by parsing, so commented-out rules are not counted as active declarations.

## Player shell is a separate context

`start.html:9–10` includes `reset.css` and `default.css`; line29 additionally puts inline `overflow:hidden` on the shell body. Lines119–129 contain the shell containers and then:

- `#mainPanelContainer` and `#clipFrameScroll`: relative, width/height100%.
- `iframe#mainFrame`: width/height100%, initial about:blank, display block, absolute.

This is direct structural evidence that the shell stylesheet is not automatically a descendant selector cascade into the prototype iframe. This audit does not identify which CSS links a particular generated UX page receives. No ordinary generated UX HTML or its generated project/page CSS was present in this retained template directory; `axure_rp_page.css` is shipped here, but its filename alone does not prove a specific page's final inclusion order.

## Limited runtime paths

The following are static observations of actual retained functions. No original JavaScript application, browser, native app or DLL was executed for this audit.

1. **State/adaptive text repaint differs from owner resizing.** `style.js:1647–1700`, `_applyImageAndTextJson`, resets cached descendant styles, computes full style and overrides, then obtains `borderElement = id + '_div'` and a separate text element. Only when overrides are nonempty and that border element exists does AutoFitHeight/Width assign measured height/width to the **border element** (1680–1689), with text top/left0. The empty-override branch restores that border element's dimensions from the owner's inline style (1692–1699). These writes do not themselves assign width/height to the owner `id`.
2. **Text measurement helper does not establish clipping.** `style.js:2427–2441`, `_applyTextStyle`, starts from text container offsetWidth/Height, applies property maps to descendants and takes width maxima including padding. Height maxima are conditional on `!hasLineHeight`, where the code uses the truthiness of `container.css('line-height')`. This audit does not substitute a guessed browser result for that query. `_getCssStyleProperties` (2465–2502) lists typography/decorations/shadow/alignment properties, not white-space/overflow/position/width/height.
3. **Old alignment calculations are not live defaults.** `style.js:2076–2094`, `transformTextWithVerticalAlignment`, ensures the text cache and element exist, then directly returns `transformFn()`. The following old alignment update block is commented out. `adaptive.js:131–133` calls this helper with an empty callback for direct `.text` children; that is not evidence of a new top/height calculation.
4. **Explicit text changes can genuinely resize the owner.** This is a separate function path: `expr.js:383` invokes `autofitWidget` after the rich-text setter. In `expr.js:469–552`, AutoFitHeight reads the text child height plus vertical padding; AutoFitWidth sums the widths of each paragraph's direct span children, takes the maximum and adds horizontal padding. A nonzero delta causes `query.resize(css,{})` (523–525), followed by alignment-dependent movement (526–544). It records the ID in `_autoFitIds` (550).
5. **That registry is not automatic initial enumeration.** `expr.js:387–403`, `updateAutoFitted`, visits only registered `_autoFitIds`. `adaptive.js:142` invokes it when returning to the default view. This finite inspected path does not show that every source object with AutoFit=true enters the registry on the first page load. It must not be used to claim that Problems/Ideas' initial owner dimensions will automatically grow.
6. **Other visible-overflow text hits are type-specific.** `style.js:1373` emits overflow visible for SVGs whose friendly type is horizontal/vertical/ordinary Line; it is not a generic shape-text rule. `events.js:520` sets nowrap on the case-menu link container. `adaptive.js:591–601` clears overflow during a NiceScroll cleanup; that is a passed scrolling container, not a universal shape/text assignment.

These distinctions prevent two opposite mistakes: treating shell clipping as ordinary text clipping, or treating a later Set Text AutoFit action as proof of the initial generated owner's size.

## What this supports, and what remains unknown

Supported: preserve the prior writer evidence as a separate text-layer contract; do not shrink the established font size or grow the stored owner merely because this CSS scan lacks a clipping rule. A future implementation can separately choose to model initial text overflow and dynamic AutoFit, but should label the parts not verified against an actual original generated page.

Still unknown: the complete generated UX DOM and stylesheet cascade; any generated global `.ax_default`/type classes; actual initial computed overflow and line box; the first-load registry enrollment for these four owners; font-engine measurement; clipping by their full ancestor tree; complete original rendered pixels. Another independent investigation owns `DNCg` DOM output, so this task did not repeat its CIL analysis.

## Reproduction and identities

Run `node research/text-autofit-base-css-scan.mjs`. It reads retained sources, parses CSS, verifies targeted source assertions, and writes only [text-autofit-base-css-evidence.json](text-autofit-base-css-evidence.json). It does not load those styles in a browser or execute vendor functions. The JSON records nine CSS sources, limited runtime/HTML sources, selector lines, excerpts and hashes.

- Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Original extraction Evidence ID: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Pinned `style.js` SHA-256: `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`.

No product edits, old-evidence edits, downloads, font changes, full tests, build or package occurred.
