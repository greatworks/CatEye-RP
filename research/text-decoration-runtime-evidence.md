# Text-decoration and rich hyperlink runtime evidence

## Scope and identity

Read-only investigation of the retained **Axure RP 11.0.0.4150** resources. Distribution SHA256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. Retained managed evidence is tied to AxureRP11.dll SHA256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`; no proprietary DLL was executed.

Original resource hashes:

| File | SHA256 |
| --- | --- |
| style.js | f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c |
| expr.js | 530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6 |
| events.js | a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3 |
| action.js | c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3 |
| axQuery.std.js | 0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd |
| jquery-3.7.1.min.js | 8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85 |

`scripts/probe-text-decoration-runtime.mjs` executes SHA-pinned original function slices and the shipped jQuery in isolated standards-mode Edge: **28 passing cases**, including 36 direct baseline/matrix combinations and 36 stacked-state/baseline combinations. `scripts/probe-text-decoration-hyperlink.mjs` adds **6 passing event/navigation-boundary cases**. Both retain exact source ranges, results and fixture/stub boundaries in JSON. No HTTP request, original application launch or GUI capture was made.

## 1. Decoration conversion is atomic, including its invalid-value quirk

Original `_getCssStyleProperties`, **style.js:2465–2502**, especially 2477–2489, builds a single `textDecoration` string. It writes it as a run property; it does not independently merge each flag with existing run decoration.

| underline | strikethrough | Original generated CSS | Result |
| --- | --- | --- | --- |
| absent | absent | no property | retain existing run CSS |
| false | absent | none | clear both decorations |
| true | absent | underline (trailing space) | underline only |
| absent | false | none | clear both |
| absent | true | line-through | strike only |
| false | false | none | clear both |
| false | true | **noneline-through** | invalid CSS assignment; browser retains previous CSS |
| true | false | underline (trailing space) | underline only |
| true | true | underline line-through | both |

The invalid `noneline-through` output is directly observed from the original function, not a spelling in the reconstruction. For example, a partial `{strikethrough:true}` patch replaces an existing underline with strike only. A false underline patch clears an existing strike as well. A color-only patch leaves heterogeneous decorations intact.

Initial native HTML generation of run flags is a separate format/generator question. The runtime table above must not be applied blindly when translating stored initial run booleans to valid CSS.

## 2. Where the state patch comes from, and what invalid output retains

The actual state path is **style.js:1647–1679**: reset cached text CSS first, then compute all overrides, then apply them to text. `_resetTextJson` at **2028–2042** restores each descendant's cached `style.cssText`. `CacheOriginalText` at **2592–2612** stores inline CSS by element ID; `_transformTextWithVerticalAlignment` at **2076–2094** captures it before the first transform if absent.

Therefore an invalid combined patch retains **the reset original/cached run CSS**, not the prior interactive state. Probe: original underline → hover strike → hover plus selected underline=false yields underline, because the reset occurs before the invalid write. The direct `_applyTextStyle` call without reset instead retains its immediate pre-call CSS; these two entry points are deliberately distinguished.

`_computeAllOverrides`, **1790–1847**, builds this patch:

1. For a hyperlink only, recursively start with the parent widget's overrides.
2. Add adaptive view styles and their referenced base styles.
3. Merge active state patches in normal, mouseOver, mouseDown, focused, selected, error, hint, disabled order.

Ordinary authored `diagramObject.style` fields and its ordinary base style are not copied into text overrides; `_computeStateStyleForViewChain` at **1850–1869** requests states with `excludeNormal=true`. They remain represented by the original text styling. This is why merging the entire complete WidgetStyle into every rich run would erase mixed formatting.

**Adaptive decoration is part of the same atomic conversion as state decoration.** Verified example: original run underline, adaptive underline=false paints none, then selected strikethrough=true forms invalid FT and returns to original underline, not adaptive none. Adaptive underline=true plus selected strikethrough=true forms both. `setAdaptiveStyle` at **2377–2381** uses the same text application routine and caches before applying the first change.

After native rich SetWidgetRichText, `FONT_PROPS` at **1763–1775** and the `_shapesWithSetRichText` branch at **1804–1817** exclude direct adaptive underline/strike from overrides. Active-state decorations still apply. Referenced adaptive base-style fields are added after this deletion, so they are not necessarily excluded. This is an original merge-order boundary, not a general claim that rich setting disables all adaptive typography.

## 3. Element scope, parent decorations and Set Text

`_applyTextStyle` at **2427–2442** visits descendant elements. `_applyCssProps` at **2444–2456** applies paragraph properties to `p`, skips `a`, and applies run properties to other descendants. Thus a preexisting decoration on a `p` or anchor is not cleared by writing run `none`. The probe records those unchanged ancestor styles and changed child CSS. CSS decorations can propagate through the box tree separately from inheritance; a descendant's computed `none` alone is not proof that an ancestor's visible line vanished. See [CSS Text Decoration, section 2](https://www.w3.org/TR/css-text-decor-3/#line-decoration).

Original `SetWidgetRichText`, **expr.js:316–385**:

- Plain single-span text replacement preserves that span's current decoration and escapes markup.
- Plain replacement of mixed runs/paragraphs retains the first span's complete inline style; multiline content uses child spans and br inside the retained first paragraph. Subsequent runs' decoration is discarded.
- Plain replacement during a state uses the currently painted first span. Subsequent state reset restores cached decoration but retains the new text.
- Rich HTML replacement creates a new cached CSS baseline (line 380), and does not immediately reapply an already active state. A later state repaint does.
- Hyperlink targets bypass ordinary widget text-panel lookup at line 327. This does not establish arbitrary rich HTML as a safe product API.

The probes use script-free fixture HTML and explicit visibility/autofit trace endpoints. They do not claim complete original auto-fit, generated page layout or arbitrary rich-action support.

## 4. Requested native hyperlink owner and local graph

`text-decoration-runtime-hyperlink-graph.mjs/json` freshly decodes the requested owner from **Sample UI patterns.rplib**, SHA256 `cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b`.

- Package `27f59a68aaf249d298b4edbb44f8e2ae`, decoded package SHA256 `cc2b3da179954b69e2823a357d04fae6e4b57f9d3d4a7742aa24e9f91e6999b3`.
- VectorShape owner `14ea8a9456d14c888e8e483e64492173` has an `Axure:AttributedString:AxHyperlink` inline, nested `Inlines`, and `Link` tag-3 local reference to **`e96f6fd2341e436c86fd6ac86116dfea`**, a separate `Axure:DiagramObject:Hyperlink` object.
- Its run says **Learn more about Repeaters**; Arial 9.75pt, weight400, style0, underline=true, strike=false, color -1367932.
- Link InteractionMap `b57bb96fe10b49bb9ac15bddcd87fc6d` has enabled Click event16 `b585e88394bf47dba6d63b48d91ef123`, one enabled unconditional Case `81e3f6c41a1d40408fc8a47360268937`, and one enabled `InteractionLinkWindowAction` `0687b51c7d5847228873548e60882d51`.
- Action `link-type=2` is **New**, confirmed by retained `rp-interaction-LinkType-cil.json`; target `abe876a745954aa3a73273bbd9b7b5d5` has `target-type=0` (**WebUrl**, corresponding retained enum evidence).
- StringLiteral `178b5e8aebba41b2b58149eedf5fb46c` contains `https://docs.axure.com/axure-rp/widgets/repeaters/`, no variable identifiers and zero repeater scopes. This is stored destination evidence; it was not visited.

The graph retains 14 local objects and three matching named-style cache records with their library identities. Link style `eaf3c13554084d00aa335ef956bcf83b` has explicit underline, normal400 typography and foreground color; its IX styles refer to MouseOver `5bca99fdad14485f869d98aefed9b351` and MouseDown `c3ac2fb718bb47cfb917e6baf0f71e6d`. MouseOver includes a foreground value and Text Link Mouse Over named style, whose cache includes underline=true. MouseDown references the empty Text Link Mouse Down cache. The Text Link base cache supplies blue, overridden by this link's explicit foreground. The report retains raw values rather than claiming a fully generated link paint from names alone.

This was the only hyperlink in the prior 50-owner mixed-font census, **not the only hyperlink in the full corpus**. The parallel format census also found Basics owner `4f4e187b657a4108aa50438dd7d0fca8`, package `8165e87159f34c58a974459d9e910e34`, Link `86c64d3122f34f8ea2a371b96a7b469d`. That second object's destination graph is outside this focused probe.

## 5. Link state, click propagation and navigation boundary

Original link styling **style.js:18–73** combines parent and link overrides, restores cached CSS for the link and its descendants, then applies text properties. Outside sibling runs are unaffected. Verified link hover strike replaces link underline; leaving restores underline. Parent hover underline plus link hover strike produces both. Invalid combined flags restore link's cached baseline. Mouse-up resets and reapplies hover when relevant; parent hover/down repaint endpoints are called.

Original hyperlink event binding **events.js:1260–1314** has its own hover/down/up/click path. Mouse-down returns false to jQuery, suppressing native default/bubbling for that event. Click calls `_fireObjectEvent` (**638–648**), which invokes custom handlers and returns undefined. It does not itself stop DOM click bubbling.

Original `_handleEvent` (**281–415**) and `_handleCaseGroup` (**544–595**) implement logical action suppression via `originalEvent.handled`. In six isolated real-DOM probes:

- An enabled matching link case runs the link action. Parent DOM and body still receive click, but the parent's Axure actions are skipped because `handled=true`.
- An enabled case with empty actions still matches and suppresses parent Axure actions.
- All-disabled cases, false conditions, or no cases leave the click unhandled; parent actions run.
- A disabled parent blocks both the link handler (current mouse-over parent guard) and ordinary parent handler in the fixture.

`action.js:399–449` evaluates the URL literal and calls `$ax.navigate` with target `new`, URL, includeVariables and player flags, then continues the action chain. The probe observes that exact call at a stubbed navigation sink; **it opens no window or URL**. The sample maps to target=new, includeVariables=false, useGlobalVarNameInUrl=false in this external-URL fixture. Original generated hyperlink tag/href, keyboard focus, popup blocker behavior and full window policy remain unverified.

## Bounded implementation recommendation

Implement underline/strike as independent optional authored fields, but project adaptive plus active-state patches through the observed atomic matrix before applying them to cached/baseline runs. Preserve explicit false resets and the invalid FT fallback. Avoid outer-container decoration for mixed text if the intent is per-run cancellation; doing so can introduce ancestor lines a run cannot clear.

The requested native hyperlink cannot be safely flattened into ordinary text or inferred as just a decoration. A subsequent bounded implementation should retain a structured link inline and independent identity, its complete supported event, a validated external URL plus explicit new-window target, and link/parent state and propagation rules. Current decoder rejection of `link window mode 2` remains correct until those capabilities exist. Unsupported link graphs must stay explicit; they must not silently become clickable partial events.

## Cross-check with format evidence and bounded review

The parallel format investigation is [text-decoration-format-evidence.md](text-decoration-format-evidence.md). Its initial run CSS builder has independent boolean append branches; it is a different entry point from the runtime patch converter above. The retained 11-sample census has 2 true underline runs, both carried by AxHyperlink, and no true strikethrough run or active overridden decoration state. The runtime matrix is therefore established by isolated original function probes, not by claiming these synthetic state combinations came from a native saved sample.

The product review checked the nine-pair projection helpers, runtime combined adaptive/state patch, leaf rendering in React and offline HTML, plain Set Text restoration, and the 24 module/serialized regression cases. The existing 24 cases pass. Two concrete integration differences were reported separately to their owners: editor plain-text adaptive projection and SetStyle plain/rich baseline treatment. Those are product review findings, not evidence that the original native application has those defects. No product files or existing tests were changed by this investigation.
