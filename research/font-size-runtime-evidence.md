# Native font-size output and initial text sizing

Date: 2026-10-14. Target: retained Axure RP 11.0.0.4150. This investigation reads managed metadata/CIL and statically interprets bounded instruction records. It does not load or execute the target DLL, generate a page with the original application, or retry the unchanged GUI capture/input blocker. No product, source design, or previous evidence file was changed.

## Decision

The `/ 0.75` conversion is supported by the **HTML font-size writer itself**, independently of the previously inspected Axvg drawing conversion. A rich run whose size reaches the writer as `21` produces the numeric CSS font-size operand `28`. A matching named base style of `15` does not, by itself, replace that run's `21`; the provider suppresses an inline size only when the two sizes match.

This is not proof that every complete original page paints exactly as the reconstructed screenshot. The original initial HTML path can recalculate a **separate text-panel rectangle**. In particular, `AutoFitWidth=true` takes an effectively unwrapped native graphics measurement with a measuring width of `10000`; the resulting text-panel dimensions are rounded and supplied to its CSS writer. This differs from freezing the saved widget rectangle and fitting its text inside it. The investigated path does **not** prove that the owner widget's stored width/height expand. Do not change the saved `95×27` / `54×27` geometry or reduce the text to 20 px merely because that makes the current screenshot fit.

## Identity and inputs

Extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.

- Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- `AxureRP11.dll`: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- `UX Prototyping.rp`: `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72`.
- Shipped `style.js`: `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`.

The machine-readable [evidence manifest](font-size-runtime-evidence.json) contains absolute original source paths and hashes of every referenced CIL record and probe. Static extraction used the existing PEReader script; opaque string literals remain symbolic.

[The independent four-owner record](font-size-format-owners.json) preserves both occurrences of each source ID:

| Source ID | Text | Saved size | Rich run size | Matching base P2 | Flags |
| --- | --- | --- | --- | --- | --- |
| `e92911c9f26c49e897acf49340a5690e` | Problems | 95×27 | 21 | 15 | AutoFitWidth and AutoFitHeight true |
| `4d1d194cc1c04131b76a3f6697700dd9` | Ideas | 54×27 | 21 | 15 | AutoFitWidth and AutoFitHeight true |

Their packages are `52bb046bb95c4e789c35be661e8286b8` and `cb6927343c814c6d95ba86343baca891`. Both package versions and attributed-string versions are **11.0.0.0**. Local P2 is absent; the matching `T Heading` style is `022072535e854a3b9c6057e2559f639a` in the zero library. The saved bounds are evidence, not a measurement of final original HTML glyphs.

## HTML size writer and run provider

| Exact method | Relevant decimal IL offsets | Observation |
| --- | --- | --- |
| `cNCQ.KNiN`, 100699555 | provider construction and call to BNiS | Formats a rich run through the CSS helper. |
| `cNCQ.BNiS`, 100699556 | 7–12 | Passes the run/provider and context to RNxS. |
| `PNKu.RNxS`, 100699318 | 18–20, 66–78 | Reads `ValueAsObject(PName2)` and sends the returned size to hNKv. |
| `PNKu.hNKv`, 100699304 | 48–58 | Calls x5ig with the size and constant **72**. The context argument is not read. |
| `a5ib.x5ig`, 100719575 | 7–22 | Calculates `size × 96 / suppliedDpi`; requests 3-digit rounding, mode 1. |
| `rbx2.ybxu`, 100688822 | 7–10 | Calls `Math.Round(value, digits, MidpointRounding)`. Mode 1 is AwayFromZero. |
| `iSXv.get_Size`, 100707823 | 7–13 | Returns the raw size field. |
| `iSXv.ValueAsObject`, 100707849 | P2 switch; 545–556, 117–143, 633, 1043 | If the base size is overridden/determined, compares it to the run size; equal omits the inline property, different returns the run size. |

The formatter suffix is supplied through encrypted `sIho` and has not been decoded here. The proven result is the **numeric operand at the HTML/CSS font-size write site**, not a decrypted string literal. The existing runtime applies generated font sizes through CSS and the independent Axvg `RPFormatExtensions.bJcT` (100692664, IL62–77) also converts a run size by dividing by `.75`. These separate paths should not be conflated.

[font-size-runtime-replay.mjs](font-size-runtime-replay.mjs) replays the retained arithmetic/provider CIL with explicit symbolic string and comparison sinks. **17/17 cases pass**: 12 sizes and 5 run/base combinations. `21` / base `15` returns `21`, then numeric `28`; `21` / base `21` omits the inline property. It does not model complete object loading or native typography, and the rounding tests do not establish exhaustive binary midpoint equivalence.

The format agent's independent reader evidence shows `W59z` (100718409) has a version-7 branch, but **both** size-reading branches call the same numeric reader `H5SA` then `zSmJ`; the size setter only writes the field. There is no `.75` migration in those two branches. This statement is limited to that verified reader path; any later rich-text synchronization must be considered separately rather than assumed away.

## Initial AutoFit text rectangle

The initial generator contains more than a saved-bound copy:

1. `FNiU.rNPL` **100699663**, retained in `shadow-format-form-cil.json`, has a VectorShape branch that calls `TextRectObject.PNZ8` at IL1787, then reads `TextPanel.Rect` at IL1357. It passes its resulting rectangle to `JNLP.SNLp` at IL871. This is an initial CSS writer path, separate from browser state repaint.
2. `TextRectObject.PNZ8` **100702375**, IL66–99, calls `RichTextPanel.INOR` with the available text width minus width padding and a provisional height of 1, then invokes the object's text-panel positioning routine `WIyL` (IL34).
3. `RichTextPanel.INOR` **100701896**, IL475–486, reads the owning object's `AutoFitWidth`. True goes to `CachedGraphics.GtCX(!IsBeingEdited)` (IL383–398). For the nonempty non-editing false branch it uses `dtCa(availableWidth,true)` (IL342–356).
4. `mtC7.GtCX` **100715355**, IL8–23, supplies **10000** as the measuring width to `KIf5`, then obtains its resulting size. `dtCa` **100715353**, IL7–30, retains the supplied width and obtains the measured height. This establishes an unwrapped-versus-width-constrained measuring policy, not the resulting font metrics.
5. `INOR` IL71–80 calls `fHBd.RHBf(0,1)`. `RHBf` **100722983** rounds each dimension via `ybxu`: **zero digits, AwayFromZero**, not ceiling. `INOR` IL561–578 writes the new text-panel rectangle via `iNZP`; `iNZP` **100702293**, IL34–36, forwards to `TextPanel.set_Rect`.
6. In `rNPL`, IL1021–1036 subtracts its left-padding value from the text rectangle's x; IL667–689 adds left and right padding to width. These operations use `SJOQ` and `QJOo`. No border-width addition is present in this inspected rectangle adjustment. The separate positioning routine also handles alignment/padding; this report does not treat that larger routine as a fully interpreted layout specification.
7. `SNLp` **100699217**, IL337–374, sends the rectangle to `TNKD`. `TNKD` **100699262**, IL231–242, obtains the CSS property dictionary through `hNKx` and writes its entries. `hNKx` **100699265** reads the rectangle's x/y/width/height into formatting calls (IL137/214/318/422). CSS key and formatting strings remain obfuscated.

[font-size-runtime-autofit-replay.mjs](font-size-runtime-autofit-replay.mjs) replays **2/2** bounded nonempty/non-editing `INOR` branches. Native graphics measurement is an explicitly injected sink, `132.25×38.75`, solely to show data flow: AutoFitWidth uses measuring width10000 and writes rounded132×39; constrained text uses supplied width95 and writes95×39. These are **synthetic probe values**, not original Axure measurements of Problems or Ideas. The original DLL is not executed.

`AutoFitHeight` is not read by this `INOR` text-panel measuring method. That does **not** mean the flag is globally ignored: the owner layout and browser state paths are separate. This evidence establishes recalculation of the **text panel**, not arbitrary enlargement of the owner shape, layout box, click target, or exported page.

## Browser state path is different

Shipped `style.js:1647–1702` resets text styling, computes overrides, and only enters the measured state-style branch when the overrides object is nonempty. At1680–1689 the corresponding AutoFit flags can update the **border element** from the calculated text size. With no overrides,1691–1698 restores border width/height from its parent. `style.initialize` at1924–1927 contains only a commented-out alignment call; it is not a general startup fit operation. These facts do not establish initial stylesheet overflow or authorize stretching every imported label.

## Actual reconstructed browser observation and limits

The parent-owned [font-size-browser-probe.json](font-size-browser-probe.json) separately records the packaged reconstruction: its28px baseline resolves to Noto Sans SC Bold. Temporarily injecting retained Open Sans Bold still gives about131.852/74.361px for Problems/Ideas at28px, exceeding95/54;21px also exceeds the saved widths, while20px fits. The experiment does not alter the saved design and is **not** an original Axure generated page. It rules out “install the intended font and the existing fixed text box will necessarily fit” for these particular strings, but cannot justify changing a proven size conversion.

Unresolved boundaries remain explicit:

- Actual original generated CSS literals, text-container overflow/display rules, and the complete owner/text-wrapper containment relationship.
- Full original native graphics font substitution, text measurement, line boxes, and exact initial generated pixels for these four objects.
- Whether any separate load/synchronization path changes rich-run style before it reaches the inspected writer; the run-provider and reader conclusions do not replace an end-to-end generation.
- General migration of older documents beyond the two verified size reader branches, and full independent text-rotation/layout handling.

Accordingly, this stage supplies evidence for retaining the current numerical unit conversion and for a distinct native text-panel AutoFit model. It does not implement a new AutoFit policy or claim the current reconstruction is visually equivalent to original Axure.
