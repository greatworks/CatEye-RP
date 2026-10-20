# RP 11 ordinary shape/text DOM writer follow-up

This read-only follow-up closes the narrow ordinary DIV attachment path behind the frozen [text-autofit-native-evidence.md](text-autofit-native-evidence.md). It changes no product files, native samples, prior report or prior manifest. All CIL belongs to Axure RP11.0.0.4150, assembly SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. No original DLL, GUI, generated-page export or font engine is executed.

**Result:** the ordinary GenerateAsDiv path opens the owner DIV, writes and closes its `_div` background child, writes a separate `_text` DIV with class `text`, writes rich content, closes the text DIV, then closes the owner. `DNCg` does not set overflow. Its automatic inline styles concern display/visibility; the inspected caller dictionary adds only geometric values and compound metadata. This establishes the separate text element and its containing owner, but not the complete original page's computed overflow or pixels.

## Exact DOM writer and parameters

`BNCJ.DNCg`, token **100699506**, is retained in [text-autofit-dom-writer-cil.json](text-autofit-dom-writer-cil.json). Its decoded strings and call offsets are in [text-autofit-dom-literals.json](text-autofit-dom-literals.json). The following parameter labels describe observed usage; they are not invented original symbol names:

| Slot after instance | Observed behavior | Decimal IL |
|---|---|---|
| 1 | ID passed through `MNCS`, then written as `id` | 70–82 |
| 2 | Class string written as `class` | 116–122 |
| 3 | Optional encoded `data-label` | 127–173 |
| 4 | Optional encoded `title` | 178–232 |
| 5 | False appends/writes `display:none; visibility: hidden`; true may write `visibility: inherit` when writer context GNCy.HasValue | 290–757 |
| 6 | Optional encoded `selectiongroup` | 237–285 |
| 7 | True closes the element immediately; false leaves it open for child output | 841–897 |
| 8 | Attribute dictionary, enumerated into attributes after the display/visibility branch | 762–841 |

The tag is explicitly `div` (IL36→nNCY IL41). `nNCY` token100699535 starts `<tag`, `sNCT`100699540 writes ` key="value"`, `NNC4`100699536 ends the opening tag, and `HNC8`100699538 writes `</tag>`. `FNCR`100699507 decodes `div` and calls HNC8 atIL69. Selected output helper bodies are retained in `text-autofit-dom-output-cil.json` / `text-autofit-dom-close-cil.json`.

There is **no overflow key or value synthesized by DNCg**. This is bounded to its own writes: its supplied attribute dictionary is deliberately generic and could carry a caller-provided style. Consequently the actual caller dictionaries below were inspected separately instead of assuming the generic helper cannot forward overflow.

## Four original call sites are different layers

[text-autofit-dom-arguments.json](text-autofit-dom-arguments.json) records exact instruction slices beside the interpreted arguments.

| Caller / token / IL | Actual layer and output | Attribute provenance |
|---|---|---|
| nNPR100699656 /395 | Owner ID argument3; class=`wNxE(…) + " transition notrs"`; leaves owner open | `zNPc(rectangle,xNKd(),true,null)` |
| nNPR100699656 /988 | Background child ID=`owner + "_div"`; state classes and optional ID class; immediately closes child | `zNPc(rectangle,xNKd(),false,null)` |
| sNP3100699654 /2538 | Image-path owner; optional `compound ` prefix, GetClass result and ` transition notrs`; leaves owner open | `zNPc(rectangle,xNKd(),true,local10)`; local10 is optional compound `data-height`, `data-width`, `CompoundMode` metadata |
| sNP3100699654 /3639 | **Compound vector-piece child**, not the ordinary owner; class=`ax_vector_shape` plus optional generated ID class | local42 contains WidgetTopLeft/TopRight/BottomLeft/BottomRight X/Y metadata; child closed by FNCR atIL3871 |

This corrects the preliminary shorthand that all four were owner calls with a zNPc dictionary. It does not alter the frozen prior report; the precise attribution is recorded here.

`FNiU.zNPc`, token100699659, is in [text-autofit-dom-attributes-cil.json](text-autofit-dom-attributes-cil.json). When its boolean argument1 is false it returns the supplied/new dictionary without adding geometric style. When true it sets `style` to `width: Wpx; height: Hpx;`; if argument2 is also true, it appends ` left: Xpx; top: Ypx;`. It writes **no overflow**. These geometry strings are proven literal text, not inferred CSS names.

The switch passed by these callers is `JNLP.xNKd()`. Its formal mode meaning has not been resolved in this bounded task. The frozen SNLp body also checks xNKd atIL42 and returns atIL52 when true. Therefore the regular generated-rule path and the optional geometry-inline path must **not** be asserted simultaneously without establishing that context. This does not change the proof of which properties each branch writes.

`wNxE`100699330 is a style-dependent class builder, retained separately. It joins named/base class results and state labels such as disabled/selected/error, with an optional ID class. This investigation does not guess the complete class string for the four UX objects. The owner's exact fixed suffix, background ID, and text class are independently established.

## Ordinary text attachment is explicit

A token-only direct-call search for sNP3, nNPR and fNPD found the common shape writer `FNiU.vNPI`, token**100699653**. The candidate search is not proof by itself; its selected full body is retained in [text-autofit-dom-shape-dispatch-cil.json](text-autofit-dom-shape-dispatch-cil.json). No unrestricted semantic search or unrelated generator was investigated.

For the controlled ordinary shape path, vNPI gets HtmlRect (IL442 / later1139), calls sNP3 atIL526 or nNPR atIL1074, later calls fNPD atIL1342, and then FNCR atIL475. These offsets are deliberately non-monotonic because the original control flow is obfuscated. The bounded replay follows the real branches and records their executed order. Asset generation and nonactive style variants are explicit sinks; this is not execution of all generator branches.

`fNPD`100699662, from the frozen `text-autofit-native-text-callers-cil.json`, obtains the same owner's generated ID via JNxP and appends `_text` (IL181–221). AtIL564 it calls DNCg with:

- ID=`ownerID_text`;
- class=`"text "` plus the text ID only when `nNKZ()` enables ID classes;
- label/title/selectiongroup=null;
- display gate from the attributed-text provider;
- closeImmediately=false;
- extra attributes=null.

It writes generated rich content via ONiF→UNCe atIL355–360, then FNCR atIL255. Thus the `_text` DIV closes independently before vNPI closes the owner. The text element has no geometric or overflow inline style injected by fNPD; DNCg can still add its conditional display/visibility style.

The following is a **derived structural illustration**, not captured original HTML. Angle-bracket placeholders intentionally preserve unresolved style-dependent values:

```html
<div id="OWNER" class="CLASS_RESULT transition notrs" ...>
  <div id="OWNER_div" class="BACKGROUND_CLASSES" ...></div>
  <div id="OWNER_text" class="text OPTIONAL_ID_CLASS" ...>
    RICH_CONTENT
  </div>
</div>
```

The image-path writer instead emits image/SVG content. Narrow retained leaf methods confirm cNCK100699515 emits an `img` and uNCx100699516 emits/closes an `svg`; its original SVG payload is an external generated asset and remains an opaque sink here. In compound mode the piece DIV closes at sNP3 IL3871. This investigation does not claim its replay executed the complete SVG payload generator. The common dispatch proof concerns the owner→text→owner-close order.

The fixed `_text` class and ordinary owner attachment now connect the previously proven `#owner .text` CSS selector to the text layer on this path. The old measured-text and owner boxes must still be distinguished. This is no basis for globally disabling clipping or altering all widget bounds.

## Overflow and stylesheet boundary

Confirmed direct writes for this path are limited to:

- owner/background DNCg display/visibility attributes and optional geometric inline style;
- text DNCg display/visibility attributes, without a supplied attribute dictionary;
- the separately proved generated-rule text CSS (nowrap or break-word, height omission, padding/alignment/width rules) in its applicable writer mode.

No explicit owner/text overflow assignment was found in these scoped DOM calls or their inspected attribute construction. This strengthens the narrow absence-of-assignment result; it does **not** set the final browser value to visible. Full per-project styles, writer context, original generated HTML and real native measurement remain unavailable.

The independently frozen [text-autofit-base-css-evidence.md](text-autofit-base-css-evidence.md) examines the retained nine CSS files (721 rules). It finds no generic `.text`/plain `.ax_default` rule and separates the start.html shell's hidden overflow from its page iframe. It also distinguishes later runtime text-action AutoFit owner resizing from initial generation. Those results are complementary and do not fill the missing generated stylesheet or native GUI evidence.

The next smallest unresolved source hook for exact class-to-style coverage is `xNxg.rNxD`, called by wNxE for style-derived class names, together with the writer context functions xNKd/nNKZ. Their bodies and per-project stylesheet output were intentionally not followed in this task. No new global run21→base15 synchronization claim is made.

## Validation and freeze

[text-autofit-dom-replay.json](text-autofit-dom-replay.json) retains **16/16** focused CIL cases: eight DNCg display/context/existing-style combinations, two immediate-close cases, four zNPc mode/position cases, and two ordinary dispatch branches. Retained CIL instructions execute in an allowlisted bounded interpreter. Text measurement, rich serialization, asset production, style-derived class names, identifier mapping and safe-ASCII encoding are explicit sinks. The shape-writer sink is separately checked against the exact four call-site slices; it is not presented as original full generator execution.

The new manifest pins all new artifacts plus frozen dependencies. It also checks that every record in the prior `text-autofit-native-manifest.json` remains unchanged. No production tests, full suite, build, package, original GUI retry or native font engine was run.

Reproduction in `D:\WSCodex\REA`:

```powershell
node research/text-autofit-dom-literals.mjs
node research/text-autofit-dom-arguments.mjs
node research/text-autofit-dom-replay.mjs
node research/text-autofit-dom-report.mjs
```

The last command only writes the new [summary](text-autofit-dom-evidence.json) and [manifest](text-autofit-dom-manifest.json), then verifies their dependency hashes. The frozen `text-autofit-native-*` files are never regenerated by it.
