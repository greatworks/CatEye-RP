# Ordinary RP 11 shape text: generation mode and class CSS closure

This read-only follow-up targets the retained **Axure RP 11.0.0.4150** DLL, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. It executes bounded interpretations of retained CIL records, not the DLL, native font engine, original application, or a generated original page. Product and historical evidence files are unchanged.

## Decisive correction: ordinary shapes do not emit measured text coordinates

The ordinary `VectorShape` writer explicitly passes **true** into `fNPD`, which forwards that value as `rNPL` argument5. After measuring the native TextPanel, `rNPL` replaces its CSS rectangle with the **four-NaN `D5sx` sentinel**. `SNLp` is reached, but its rectangle guard skips **all of `TNKD`**. Therefore this ordinary path writes no text-layer `position`, `left`, `top`, `width`, or `height` through the rectangle writer.

This corrects the scope of the frozen [native report](text-autofit-native-evidence.md) and its replay. That replay hard-coded argument5=false. Its finite rectangle plus height=-1 is a real alternative function scenario, but **not the ordinary VectorShape call**. The old report and hashes remain untouched; this report supersedes that interpretation. A second correction: the horizontal x-minus-padding / width-plus-padding block is gated on `SelectionButton`; it is not run for ordinary VectorShape.

The resulting ordinary rules, with the source's generated ID represented as `u1`, are:

```css
#u1 { /* stored owner rectangle, not the measured text rectangle */
  position: absolute;
  left: /* stored owner x */;
  top: /* stored owner y */;
  width: /* stored owner width */;
  height: /* stored owner height */;
  display: flex;
}
#u1 .text {
  position: absolute;
  align-self: flex-start; /* center / flex-end for other vertical alignments */
  box-sizing: border-box;
  padding: /* native top right bottom left */;
  width: 100%;
}
#u1_text {
  border-width: 0px;
  white-space: nowrap; /* AutoFitWidth=true */
  /* AutoFitWidth=false instead writes word-wrap:break-word. */
}
```

These are scoped declarations, not an assertion that the original exporter returned this exact consolidated string. Normal owner/child writers supply additional appearance declarations. For the examined plain, zero-rotation, no-shadow text path, no `overflow` is added to either layer by these writers. The relevant default/named classes also contain no overflow or sizing declarations. No explicit `overflow:visible` is written here. Ordinary browser CSS inference is that the text layer has automatic height and no clipping imposed by these scoped rules; final original computed style and original pixels have not been obtained.

## Actual ordinary generation mode

All IL offsets below are decimal.

| Method | Token / decisive anchor | Evidence |
|---|---|---|
| `cJFt.Generate` | 100691570, IL66/83/385 | Calls `uJF2` to create the rendering context, `BJFv` for class names, and `bJFQ` for the generated style collection. This is the actual named `Generate` entry, not a hand-selected CSS helper. |
| `cJFt.uJF2` | 100691584, IL41; closure named `CreateHtmlRenderingContext` | Constructs `xNxg` with generator settings. |
| `xNxg` constructors / `yNxx` | 100699343/344/345 | Construct fresh `JNLP` writers. `JNLP` constructors100699209/210 do not assign its two Boolean mode fields; CLR instance initialization leaves them false. |
| `JNLP.xNKd` / `nNKZ` | 100699207 /100699270 | Return fields `WNKf` / `QNKw`; they are writer contexts, not source AutoFit properties. |
| `xNxg.cNeQ` | 100699376, IL14/32 | Stores a nullable item identifier in DOM writer `BNCJ.GNCy`, and sets `xNKd` to its `HasValue`. |
| `xNxg.SNxC` | 100699377, IL55/62 | Temporarily enables `nNKZ` and calls `cNeQ`; its cleanup closure is named `TrapCssClassMode`, with saved `oldMode` and `oldItemId`. |
| `FNiU.SNil` / `zNPX` | 100699631 /100699675 | Actual mode-changing callers operate on Repeater. `SNil` temporarily toggles CSS class mode; `zNPX` calls the trap with an empty nullable identifier at IL789. Ordinary standalone VectorShape generation does not require these contexts. |

The bounded call-byte inventories are navigation aids only. The selected caller CIL bodies and constructor bodies provide the evidence. The ordinary result is **xNKd=false, nNKZ=false**; this is separate from the true text-layout argument discussed next. The no-coordinate result is not explained by incorrectly making xNKd=true.

## Complete text-bound arguments and guard

| Link | Token / IL | Established behavior |
|---|---|---|
| `FNiU.vNPI` | 100699653, IL1333–1342 | Loads shape, context, **ldc.i4.1**, then calls `fNPD`. |
| `FNiU.fNPD` | 100699662, IL418–446 | Forwards its argument2 into `rNPL` argument5. It does not replace true with a default false. Its previously proved DOM writer creates `div#id_text.text` inside the owner. |
| `FNiU.rNPL` | 100699663, IL1787/1357/44 | Calls native layout, reads TextPanel.Rect, and initially marks height=-1. Those operations are not the end of the argument flow. |
| `rNPL` true branch | IL640–642→393 | Argument5=true selects the `D5sx` sentinel, replacing the entire rectangle before `SNLp`. |
| `j5u5` static constructor | 100722161, IL99/108/117/126/135/140 | Four explicit NaN constants construct and initialize `D5sx`. It is not an empty zero rectangle. |
| `rNPL` final call | IL847–871 | Passes the 13 values listed below, including the invalid rectangle, to `SNLp`. |
| `JNLP.SNLp` | 100699217, IL327/332→379 | `Y5s3` is true for the sentinel and bypasses TNKD at IL374. Flex=false also suppresses another nested `.text` rule from this call. |
| `j5u5.Y5s3` | 100722088 | Checks NaN in x/y/width/height. Negative finite dimensions alone are not this guard. |

For the four titles (no shadow, casing override or text rotation), the full argument vector is:

| Index (including `this`) | Value |
|---|---|
| 0 | Ordinary JNLP writer |
| 1 | Generated owner ID + `_text` |
| 2 | `{x:NaN,y:NaN,width:NaN,height:NaN}` |
| 3 | 0, relative text rotation |
| 4 | 1, opacity |
| 5 | null, owner object |
| 6 | `{white-space:nowrap}`; false-width mode instead `{word-wrap:break-word}` |
| 7 | null, extra property list |
| 8 | 0, selector option |
| 9 | 0, scrollbars |
| 10 | 0, default-border option |
| 11 | 0, display-flex option |
| 12 | 0, transform option |

The ordinary rule is exactly `{border-width:'0px', white-space:'nowrap'}` in the controlled true-width cases, and `{border-width:'0px', word-wrap:'break-word'}` for false-width cases. The CIL trace proves TNKD was not called. This remains true with supplied near/center/far alignment and asymmetric padding, because those values belong to the separate descendant rule.

The diagnostic false-argument case still calls TNKD→hNKx and emits finite left/top/width while omitting height=-1. It is retained specifically as a regression against accidentally substituting that alternative contract for ordinary shape generation.

## Default and named classes do not restore a text height or clip

`xNxg.wNxE`100699330 adds the document default class and, when present, the source's matched base-style class; optional hidden/unplaced/disabled/selected/error and item classes are conditional. `qJOb`100695502 returns `SJOj().O5JX`, the document default style. `cJO3().ItvB()` resolves the matched base style through its real style identifier and the existing OD gate. This stage does not relax the parser's cache/flag rules.

`yNxW`100699333 assigns the default name from literal `default` through `ebDE.gbDQ`100688619, which prefixes `ax_`. `rNxD`100699335 retrieves a class by style identity; `zNx6`100699334 derives a name through `LNx3`100699325 (lowercase and replace spaces by `_`), `bNCo`100699545 normalization, reserved-name checks and collision suffixes. The four source owners reference named style **T Heading**, normalized candidate `t_heading`. The exact full-sheet collision suffix is not enumerated here; whichever name is assigned, the same identity is used in both DOM and CSS and has the declaration restrictions below. The normal controlled class replay yields `ax_default t_heading`, with the existing writer suffix ` transition notrs`. The text child is `text ` in ordinary non-class mode. The source's hidden/unplaced/error state branches are not silently equated to the plain default class.

`eNxL`100699336 constructs a fresh JNLP and calls `ENKH`100699252 on the document default and named styles. `ENKH` opens `.{resolvedName} {`, calls `RNxS`100699318, removes `text-decoration`, writes the dictionary and closes the rule. `RNxS` and its `CNxN`100699317 helper contain only these CSS keys:

`font-family`, `font-weight`, `font-style`, `font-size`, `text-decoration`, `letter-spacing`, `color`, `vertical-align`, `text-align`, `text-justify`, `line-height`, `text-transform`.

There is no height, width, overflow, white-space, position or display key in this style-class writer. Its appended stylesheet literal at `eNxL` IL359 is only `textarea, select, input, button, div, svg { outline: none; }`. `cJFt.bJFQ`100691608 writes this returned stylesheet through a TextWriter; no original output file was generated in this research.

The frozen [base CSS audit](text-autofit-base-css-evidence.md) separately covers the shipped `.transition *`, `.notrs`, suffixed hidden classes and ordinary element rules. It does not find another generic `.text` sizing rule. Player-shell overflow remains a different document. This closure does not turn unrelated shell declarations into shape declarations.

## Geometry and implementation boundary

For **ordinary** shapes, the native text measurement is not the emitted positioning contract. Width=false constrains native measurement by `jNZf()-get_WidthPadding`; for zero-rotation Shape0, `jNZf` returns saved width, so the constraint is `W-padLeft-padRight`. Width=true takes the previously proved wide measurement path. Both still select the invalid CSS rectangle in this ordinary writer.

The retained alternative positioning path is now kept separate: Shape0's relative text rectangle is `(0,0,W,H)`; WIyL computes `x=padLeft`, and near/middle/far y from measured text height and padding; LNOE rounds positions with `w5wJ(0,0)` (Math.Round ToEven). For VectorShape, rNPL does **not** subtract left padding or add horizontal padding to width. Those adjustments require SelectionButton. None of these diagnostic positions override ordinary shape flex positioning, because its direct text rectangle is discarded.

Therefore an independently implemented ordinary shape layer can preserve the stored owner rectangle, use a separate absolute `.text` flex item, width100%, native padding/vertical `align-self`, and automatic height. Do not add top/left/height from a measured rectangle to this default path. A browser using natural text metrics can implement this contract without pretending to reproduce the original native font measurement. A first product subset restricted to zero-padding/top-aligned ordinary VectorShape is consistent with these facts; extension to other alignment/padding needs its own browser check of the same structure rather than guessed translate formulas.

For the four UX records, padding0/top/AutoFitWidth=true yields the required no-fixed-height, no-soft-wrap text layer. The saved owner geometry remains95×27 or54×27, and this evidence does not license shrinking explicit run21→20px or expanding the owner. The established source conversion remains21×96/72=28px; complete original load/style synchronization and final native pixels remain unobserved.

Hard line breaks are an explicit remaining boundary. `ONiF`100699551 calls the run writer `KNiN`100699555 (e.g. IL817/1006), but this stage has not proved raw LF encoding as `<br>`. A renderer must not simply apply `white-space:nowrap` to raw source LF and claim preservation. The parent owns that narrow follow-up. No new `<br>` claim or rich-text flattening is made here.

## Real source, validation and freeze

The four raw records remain [font-size-format-owners.json](font-size-format-owners.json). Their source `UX Prototyping.rp` SHA-256 is `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72`. In each of packages `52bb046bb95c4e789c35be661e8286b8` and `cb6927343c814c6d95ba86343baca891`:

- Problems: `e92911c9f26c49e897acf49340a5690e`, stored800,169,95,27.
- Ideas: `4d1d194cc1c04131b76a3f6697700dd9`, stored1030,169,54,27.

All have Shape0, both AutoFit flags true, padding0, top alignment, one Open Sans700 run of size21, and an OD matched base `022072535e854a3b9c6057e2559f639a` / T Heading. The class replay uses this identity rather than substituting its base font size for the explicit run.

The new [replay report](text-autofit-style-replay.json) has **19 composed CIL cases** and **6 source assertions**. The12 ordinary cases cover width true/false × three vertical alignments × two paddings;2 false-argument cases prove the alternative path differs;4 retained real source records exercise the ordinary class/result branch;1 item-mode case distinguishes the unrelated early-return gate. Native measurements132×39 are explicitly injected and are not asserted pixels. The argument vectors, executed IL traces and emitted scoped CSS are recorded, with NaN encoded as an explicit tagged value.

```powershell
node research/text-autofit-style-literals.mjs
node research/text-autofit-style-check.mjs
node research/text-autofit-style-report.mjs
```

These commands write only this new evidence namespace. The final manifest verifies all new file/source hashes and the frozen native/dom predecessors. No product edit, historical evidence edit, original GUI retry, full suite, build or package was performed. No conclusion claims original GUI or generated-page pixel equivalence.
