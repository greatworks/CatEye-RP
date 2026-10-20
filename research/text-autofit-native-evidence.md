# RP 11 initial shape text AutoFit: owner and text CSS evidence

This is a narrow static follow-up to the frozen `font-size-format-*` and `font-size-runtime-*` investigations. It changes no production code, source sample, or historical release report. The target is the retained Axure RP **11.0.0.4150** assembly, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

The useful new result is a distinction between the shape owner rectangle and its text layer. The normal shape writer requests an absolutely positioned owner with its supplied width/height and `display:flex`. The text writer independently measures TextPanel, then deliberately marks its emitted height as **-1**, which causes the CSS rectangle writer to **omit height**. For AutoFitWidth=true it emits **`white-space:nowrap`**. The owner's separate child rule is **`#owner .text { position:absolute; align-self:…; box-sizing:border-box; padding:…; width:100%; }`**.

This does **not** establish the final original page's pixels or clipping. The traced generic overflow assignment is skipped for these calls, but the full original generated HTML, all associated CSS, and the real native text measurement have not been obtained. The original GUI sample has not been verified open or exported.

## Real owners and unchanged source facts

The retained four records are in [font-size-format-owners.json](font-size-format-owners.json). The underlying `UX Prototyping.rp` SHA-256 is `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72`. Each identity below occurs in packages `52bb046bb95c4e789c35be661e8286b8` and `cb6927343c814c6d95ba86343baca891`:

| Native source ID | Text | Saved owner rectangle | Relevant stored text facts |
|---|---|---|---|
| `e92911c9f26c49e897acf49340a5690e` | Problems | 800,169,95,27 | AutoFitWidth/Height=true; one Open Sans Bold run Size21 |
| `4d1d194cc1c04131b76a3f6697700dd9` | Ideas | 1030,169,54,27 | AutoFitWidth/Height=true; one Open Sans Bold run Size21 |

Their padding is zero, vertical alignment top, and automatic line spacing. This stage does not recensus the eleven samples, change saved dimensions, change the native 96/72 unit conversion, or replace explicit run21 with cached base15. The prior isolated browser experiment remains [font-size-browser-probe.json](font-size-browser-probe.json); its 20px fit observation is not evidence that original loading chooses 20px.

## Exact narrow call contract

Offsets in this table are **decimal CIL offsets**. All methods are read statically from the pinned assembly; no assembly is loaded into the CLR or invoked.

| Layer / method | Token and instruction anchors | Established behavior |
|---|---|---|
| `FNiU.sNP3` / GenerateAsImage | 100699654, owner `SNLp` call IL304 | Supplies its rectangle argument, owner object, scrollbars0 and displayFlex=true. It does not substitute TextPanel.Rect at this call. |
| `FNiU.nNPR` / GenerateAsDiv | 100699656, owner `SNLp` call IL237 | Same distinction: owner rectangle argument, scrollbars0, displayFlex=true. The full upstream rectangle lifecycle is not established by this call alone. |
| `JNLP.SNLp` | 100699217; TNKD IL374; display IL409/442/447 | Writes supplied absolute rectangle and optional flex display. It also records its supplied rectangle; these examined calls do not set the owner size to the measured text size. |
| `JNLP.hNL8` | 100699226; dictionary keys IL59/224 | The shape call's supplemental dictionary contains optional `filter:blur(…)` / `backdrop-filter:blur(…)`, not overflow. This does not cover unrelated style writers. |
| `FNiU.rNPL` | 100699663; AutoFitWidth IL929; strings IL1287/1320 and1435/1462 | True → `white-space:nowrap`; false → `word-wrap:break-word`. The tested ordinary text path does not use AutoFitHeight to choose this rule. |
| `FNiU.rNPL` text geometry | PNZ8 IL1787, TextPanel.Rect IL1357, B5u4 IL44 | Recalculates TextPanel, reads its rectangle, then sets the rectangle height to **-1**. It adjusts x by subtracting left padding and width by adding left+right padding before the SNLp call IL871. Obfuscated control flow means these IL offsets are not execution order. |
| `j5u5.B5u4` / `j3jh` | 100722054 /100722053 | The setter and height getter use the same field `z5s6`; height=-1 is not a guessed field identity. |
| `JNLP.hNKx` | 100699265; input-height getter IL335, -1 IL340, branch IL349→437 | Skips the entire height CSS assignment when the original rectangle height is -1. The analogous width check is IL231/236/245→333. |
| `rNPL` → `SNLp` | call IL871 | The text-layer call passes owner=null, scrollbars0, displayFlex=false. `rNPL` may additionally write visibility:hidden; both branches are replayed. |
| `SNLp` overflow branch | IL452 loads argument9; IL454 branches to510 when false; key IL488 | Both ordinary owner calls and the traced text call pass zero, so **this explicit overflow assignment is absent**. It does not emit `overflow:visible` here. |
| `SNLp` → `nNLd` | IL706–719 | With displayFlex=true, writes a second rule for the owner's text descendant. The text-layer call with displayFlex=false does not emit that second rule itself. |
| `JNLP.nNLd` | 100699219; ENLX IL99; property keys IL155/242/480/595/721 | Emits position:absolute, align-self, box-sizing:border-box, padding and width:100%. No height or overflow property appears in this rule. RNnp supplies VectorShape padding; alignment uses Center/Far/remaining branches. |
| `JNLP.ENLX` → `RNKP` | 100699214 IL32/92/98; RNKP100699272 literal IL145 | Concatenates owner ID + ` .text` (+ optional suffix; empty in nNLd) and writes `#{0} {`. Thus the selector is `#owner .text`, not a guessed `.text` global rule. |

The relevant retained files are [rotation-runtime-shape-writer-cil.json](rotation-runtime-shape-writer-cil.json), [shadow-format-form-cil.json](shadow-format-form-cil.json), [font-size-runtime-layout-writer-cil.json](font-size-runtime-layout-writer-cil.json), and the new `text-autofit-native-{child-css,child-selector,owner-input,rect-helper,style-helper}-cil.json`. `text-autofit-native-owner-cil.json` holds a separately inspected GNLZ caller; it is **not** being substituted as proof of the ordinary owner entry above.

## Static literal resolution and replay

CSS property names were previously hidden behind `zIhQ.sIho`. The new resource capture reads only the exact embedded literal resource with PEReader. The research-only [text-autofit-native-literals.mjs](text-autofit-native-literals.mjs) interprets the retained allowlisted CIL for sIho100732102, its constructor100732103, resource transform100732104 and arithmetic helper100732105. Pure predicates100732110/111 are explicitly modeled from their retained bodies. Unknown opcodes/calls and bounded execution limits fail closed. No target DLL, original application, or vendor JavaScript application is executed; the resource is not a product asset.

The resource has584666 bytes and SHA-256 `9f43dae4b33ade6e7f48d90bbe882de7ab529db13782d1df2184fa122b61b542`. [text-autofit-native-css-literals.json](text-autofit-native-css-literals.json) records each selected call's file, token, IL offset, folded resource offset and decoded value. A bounded term search also sees `overflow:visible` at resource offset543830, but its owning method is unresolved: **it is not evidence that this owner or text layer receives that value**.

[text-autofit-native-replay.json](text-autofit-native-replay.json) contains **4/4** cases replaying the actual rNPL control flow: AutoFitWidth true/false × text visible/hidden. Native text measurement is an explicit injected sink:132×39 or95×39. These numbers are deliberately synthetic, not measured Problems metrics. Every case observes the -1 height and proper nowrap/break-word branch. Its unchanged owner95×27 means this function's tested path did not mutate the supplied owner stub; it does not prove every global layout method leaves the owner unchanged.

[text-autofit-native-child-replay.json](text-autofit-native-child-replay.json) adds **10/10** cases: six VectorShape child-rule cases (three alignments × zero/asymmetric supplied padding), and four rectangle cases distinguishing width/height -1 omission from finite values. It executes the retained nNLd/ENLX/hNKx instructions. Padding/alignment getters, integer decimal formatting, and CSS output are explicit sinks; no original font measurement or browser layout is run.

`node research/text-autofit-native-check.mjs` also passes **7/7** focused evidence assertions over source hashes, exact literal strings, the height field identity, branch offsets, four real source flags, and freshness of all14 replay cases. Passing these checks establishes the stated static/replay facts, not original GUI parity.

## Practical contract and remaining boundary

For a future independently implemented renderer, the supported narrow direction is to preserve the stored owner rectangle and distinguish a separate text layer. The source supports AutoFitWidth→nowrap, an omitted text height, a shape descendant width of100%, padding and flex alignment. It does **not** justify shrinking native run fonts to fit stored bounds or growing the owner box to the injected measurement.

CSS interpretation, explicitly **inference** until the complete page is obtained: a `#owner .text` selector normally has greater specificity than a `#owner_text` selector, so the100% width may override the measured text-rule width when both match the same element. With nowrap the glyphs can still extend outside that content box. Omitted height permits automatic sizing only absent another applicable declaration. Visible spill requires that no relevant ancestor or competing style clips it. These replays do not resolve the final stylesheet cascade, DOM attachment, computed overflow or pixels.

The remaining smallest concrete owner-output hook is `BNCJ.DNCg` token100699506, called by nNPR atIL395/988 and sNP3 atIL2538/3639. Together with its caller's class/child arguments and the generated base stylesheet, it would settle the actual attachment and clipping declarations. No unbounded generator scan is required to identify that next step. The current selected method graph establishes the absence of the **specific SNLp overflow assignment**, not a global absence of clipping.

No new verified whole-document load callback was identified that synchronizes explicit run21 to base15. The prior narrow WNZO→RNO1(false) and SyncStyleToAttrString call-site result remains unchanged. Other indirect/global synchronization paths remain unknown; this report does not turn failure to find one into a proof that none exists.

No production/parser/model/UI edits, full test suite, build, package, original GUI retry, or original font-engine execution were performed for this follow-up. The parent font-availability fix is a separate product scope.

## Reproduction and freeze

Run in `D:\WSCodex\REA`, in order:

```powershell
node research/text-autofit-native-css-literals.mjs
node research/text-autofit-native-replay.mjs
node research/text-autofit-native-child-replay.mjs
node research/text-autofit-native-check.mjs
node research/text-autofit-native-report.mjs
```

The final command writes the new summary and manifest only, then verifies every manifest hash. Existing font-size and rotation reports remain frozen. Summary: [text-autofit-native-evidence.json](text-autofit-native-evidence.json); hashes: [text-autofit-native-manifest.json](text-autofit-native-manifest.json).
