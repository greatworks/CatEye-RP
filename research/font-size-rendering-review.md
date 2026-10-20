# Font-size rendering review: UX Problems / Ideas

Read-only review of the frozen rotation release, 2026-10-14. This review changes no product code, tests, native parser, or earlier evidence. It reads the retained screenshot and original RP bytes through the existing bounded object reader. It does **not** run a browser, execute a vendor assembly, or compare an original Axure GUI frame. Machine-readable target values, raw runs, CIL excerpts, source hashes, and proposed measurements are in `font-size-rendering-review.json`.

## Finding

There is **no second font-size conversion in the model → React/Preview → offline rendering path** for these four headings. The original run stores `Size:21`; the current reader divides by `0.75`, producing **28** in both the widget style and its sole rich-text run. Both renderers assign **28 CSS px directly**. The two declarations are ordinary CSS overrides, not multiplication.

The initial Axvg excerpt alone did not establish the final unit. The subsequently completed `font-size-runtime-replay.json` establishes a bounded HTML numeric branch: with the supplied run21/base15 state, the run provider returns21 and the formatter computes21×96/72=28. The inspected reader/callback branches show no run-size scaling, but a complete original project load and initial export were not executed; indirect global style synchronization remains unexcluded. **No duplicate conversion exists in the inspected reconstruction path.** These facts do not establish that original initial output for the four owners must be28. The replay also leaves the obfuscated CSS suffix symbolic. Neither substituting21/20 nor declaring28 the final native answer is justified without the missing lifecycle evidence.

Open Sans is **not embedded by this application**: `src/assets/fonts` contains only Roboto, and `embedded-fonts.ts` registers twelve Roboto faces. The parent-owned packaged experiment in `font-size-browser-probe.json` now establishes the actual baseline fallback as **Noto-Sans-SC-Bold**, despite `document.fonts.check()` returning true. Injecting the retained original OpenSans-Bold.ttf in diagnostic DOM changes the actual face to OpenSans-Bold, but **does not cure wrapping at28px**. Font availability and missing native auto-fit/layout recovery are separate boundaries; embedding the font alone is insufficient.

## Exact targets and saved facts

Source `UX Prototyping.rp` SHA-256: `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72`.

| Page / package | Object suffix | Text | Position | Saved size |
|---|---|---|---|---|
| Problems and ideas / `52bb046bb95c4e789c35be661e8286b8` | `e92911c9f26c49e897acf49340a5690e` | Problems | 800,169 | 95×27 |
| Same page | `4d1d194cc1c04131b76a3f6697700dd9` | Ideas | 1030,169 | 54×27 |
| Sample problems and ideas / `cb6927343c814c6d95ba86343baca891` | `e92911c9f26c49e897acf49340a5690e` | Problems | 800,169 | 95×27 |
| Same page | `4d1d194cc1c04131b76a3f6697700dd9` | Ideas | 1030,169 | 54×27 |

All four are unrotated, top-level vector-backed boxes, with one paragraph / one run, Open Sans, weight700, normal style, literal text, no interaction cases, no adaptive views, and inactive selected/error states. Their original runs have `Size:21`, `Stretch:5`, zero character spacing and baseline, and paragraph `LineSpacing:0`. Native `AutoFitWidth` and `AutoFitHeight` are true. The importer preserves saved bounds and does not recompute native text autofit.

Their reconstructed padding is already `[0,0,0,0]`, border width0, vertical alignment top, widget `lineHeight:'normal'`, and paragraph `lineHeightPx:'normal'`. All shadows are off. This is **not** the earlier missing-padding/default-style-chain failure, and CSS padding removal is not a corrective proposal here.

The retained `artifacts/rotation-native-4.png` visibly shows partial headings on the Sample page. That image proves a reconstruction display defect, but its scaled screenshot alone cannot separate character wrapping from glyph descent clipping, identify the actual font, or measure CSS-pixel overflow. The other two owners have identical typography/size but are not independently visible in that image.

## Source path

| Stage | Location | Observed behavior |
|---|---|---|
| Native recovery | `research/scripts/read-rp-semantics.mjs:492,526,898,909` | Base/uniform run font size and rich run size divide by .75. Positive paragraph line spacing also divides by .75; zero becomes `normal`. |
| Existing conversion evidence | `research/font-style-format-conversion-cil.json`, method `bJcT` token100692664 | IL0x3e `get_Size`, 0x43 constant .75, 0x4c `div`, 0x4d graphics `Run.set_Size`. This excerpt has no CSS-unit writer or final graphics scaling. |
| Import / schema | `src/model/import-rp.ts:136,224–235`; `src/model/document.ts:528,550–576` | Accepts the recovered numeric value without scaling; rich provenance requires divisor .75. Validation establishes protocol consistency, not native font metrics. |
| React root / text | `src/components/WidgetView.tsx:67–77,145–154`; `RichTextContent.tsx:18–19,33–35` | Numeric font size is direct CSS px; leaf run style overrides inherited base. Paragraph `normal` overrides inherited line height. |
| Preview | `src/components/Preview.tsx:86,94–96,124` | Runtime projects active style / rich expression values, then uses the same WidgetView rendering. No additional size conversion. The four targets have no active style changes. |
| Offline | `src/runtime/export-runtime.ts:2052,2160,2183,2198` | Root and run values are written with a `px` suffix; paragraph normal and zero padding are retained. Text layer clips, while the vector paint may overflow. |
| Fonts / frame export | `src/runtime/embedded-fonts.ts`; `src/runtime/export.ts:30–31,46` | Only Roboto is embedded. The shared exported prototype styles also serve the nested player; they do not supply Open Sans. |

React `.widget` defaults to line-height1.35 (`src/style.css`), whereas the offline default is normal. **That known legacy default difference does not apply to these targets**, because both widget text and paragraph explicitly specify normal. The vector-backed text layer is bounded by the saved rectangle and has overflow hidden in both implementations. `white-space:pre-wrap` plus `overflow-wrap:anywhere` can wrap an over-wide single word; any second line would then be outside a short 27px box. The parent-owned probe now measures exactly two lines for all four baseline owners, confirming this mechanism.

## Subsequent native AutoFit evidence

The finalized sibling `font-size-runtime-evidence.md/json` narrows the missing layout behavior to a **separate text-panel rectangle**: initial VectorShape output calls PNZ8/INOR; AutoFitWidth=true selects a graphics measurement with width10000 and rounds its resulting panel dimensions to zero digits, AwayFromZero. This does not prove that the saved owner shape grows, nor establish final text-wrapper overflow or actual native font metrics. AutoFitHeight is not read in that particular INOR method, so its global behavior remains separate. The sibling two-case replay injects synthetic132.25×38.75 measurements; these are data-flow probes, not Problems/Ideas glyph measurements. A future implementation must preserve owner geometry and avoid substituting a guessed owner-resize policy.

## Existing verification gaps

- `research/scripts/read-rp-appearance.test.mjs:16–21` verifies precisely the intermediate CIL division. It has no final unit conversion / CSS generator assertion. `read-rp-rich-text.test.mjs` checks synthetic16.5→22 and imported run preservation, not an independent rendered-font oracle.
- `tests/import-rp-rich-text.test.ts` requires the current divisor metadata and supplied style values. A wrong but internally consistent upstream unit assumption could pass this protocol test.
- `tests/text-layout.test.ts` verifies carrier validation, markup, component/adaptive behavior, and normal line-height wiring; server rendering cannot test actual line or glyph boxes.
- `tests/e2e/native-caption.spec.ts` measures real Roboto14 form captions and Arial Required Fields controls. Its measurement helper distinguishes Range bounds from estimated ink, but uses the outer text style for its canvas metric. For mixed or overriding runs, a new probe must measure **each leaf's computed style**, not reuse that assumption blindly.
- `tests/e2e/embedded-fonts.spec.ts` verifies all twelve actual Roboto platform faces with CDP and the narrow Phone caption. It does not validate Open Sans or the two 95×27/54×27 heading geometries.
- There is no current test matching these four IDs or Open Sans in the inspected Vitest/Playwright tests. Rotation functional success and preserved widget counts therefore do not certify these heading metrics.

## Parent-owned packaged experiment, reviewed after the source audit

The independent packaged run has20 owner observations (five stages × four owners), zero network requests/page errors, and unchanged saved design. Its source/package/font hashes are retained in the probe. The original font is diagnostic only, not installed or embedded by this review.

| Stage | Actual face | Problems advance | Ideas advance | Lines each | Maximum bottom Range overflow |
|---|---|---:|---:|---:|---:|
| Baseline28 | Noto-Sans-SC-Bold |131.929px|73.378px|2|54.333px|
| Original font28 | OpenSans-Bold |131.852px|74.361px|2|49px|
| Original font21 | OpenSans-Bold |98.889px|55.771px|2|30.333px|
| Original font20 | OpenSans-Bold |94.180px|53.115px|1|0.333px|
| Restored28 | Noto-Sans-SC-Bold |131.929px|73.378px|2|54.333px|

These are canvas advance widths and DOM Range clipping, **not measured clipped-ink areas**. The native-font20 result happens to fit saved widths and approximates the cached base15 converted to20; the bounded original-provider replay chooses21→28 for its supplied state; a complete original load could still change that state. This shows a stored bounds/run/layout inconsistency requiring native auto-fit/layout investigation. It does not authorize substituting the cached base or silently shrinking text. Native desktop appearance and original generated-browser output remain unobserved.

## Remaining experiments and regression design

1. **Extend the completed packaged baseline to actual exported HTML / browser Preview:** await fonts ready and two animation frames; record DPR, zoom, screenshot dimensions, source/bundle hashes. Collect widget, `.widget-text`, rich paragraph, and `[data-rich-run]` computed font size/family/weight/style, line-height, padding, borders, width/height, overflow, white-space, and transforms. Use `CSS.getPlatformFontsForNode` on each leaf to record PostScript name, custom/system status, and glyph count.
2. **Separate wrapping, typographic boxes, and ink:** enumerate per-character Range rectangles and line tops, record complete unwrapped text advance and actual bounding-box metrics with the leaf computed font, and compare against the 95×27/54×27 clip. Range height is not visible-ink height. A diagnostic unclipped clone and pixel comparison can confirm lost ink without changing the saved document or normal renderer.
3. **Controlled unit/family matrix (packaged21/28/20 stages completed):** on detached diagnostic copies only, hold bounds/padding/weight constant while comparing21px and28px, first with the actual observed host face, then with a verified licensed Open Sans face if available. Record face identity in every cell. A fitting21px result establishes a candidate, not original Axure equivalence. Also isolate explicit normal versus a measured line-height without treating clipping suppression as a fix.
4. **Investigate native auto-fit/layout and saved-bound reconciliation:** the HTML formatter numeric branch is now independently traced, but full load-to-first-render state remains unobserved. Follow complete project load/style synchronization as well as native AutoFitWidth/Height and text layout consumers to learn when/how the original recomputes saved bounds or paints outside them, and compare any accessible original generated output. Do not replace that behavior with a guessed font size or unconditional overflow visibility.
5. **Regression after evidence selects behavior:** pin the four real owner geometries/text/source SHA, actual font identity, one-line/ink results, save/reopen invariance, and Preview/offline/packaged agreement. Preserve the existing Roboto and Required Fields controls to detect global font-unit regressions. Do not resize native owners or globally change all font sizes from this four-owner observation alone.

No browser experiments or tests were launched by this reviewer. The parent-owned packaged probe and sibling static replay were read and incorporated explicitly; they are not claimed as our own execution. Product and rotation evidence remain untouched. The review is frozen with two established boundaries: host-dependent Open Sans substitution, and preservation of native saved bounds without its auto-fit/layout behavior. The correct native layout correction remains unimplemented and unverified.
