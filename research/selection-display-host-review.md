# Selection display host contract review

This review separates the declaration used to estimate an initial text panel from the live text, state, and geometry used by the player. It reads the retained RP 11 evidence and the current independent implementation. It does not execute the vendor application or DLL, measure native fonts, or certify complete generated HTML equivalence. No product file or historical evidence was changed by this review. The only added test is `tests/selection-display-source.test.ts`.

The new `selectionDisplaySource(id)` passes **18/18 focused tests**, equally divided between the module and the bare `createOfflineRuntime.toString()` factory. The final typecheck exited 0. These are declaration, lifecycle, and reference-isolation tests; they do not test browser label activation or actual text measurement. The initial test run was also 18/18. A subsequent typecheck caught this new fixture's string `lineHeight`, corrected to the model's numeric value; that was a test-data correction, not a product regression. The concurrently authored browser fixture's `loaded` spelling was reported to its owner, who corrected it separately.

## The two inputs must remain separate

The retained ordinary selection writer consumes an already computed `TextPanel.Rect`. Its `rNPL` projection subtracts left padding from the text x coordinate, adds left/right padding to text width, and omits text CSS height. The generated indicator and text live inside an absolute label; the opacity-zero native input is a sibling of that label. These are the bounded contracts recorded in [selection-layout-render-evidence.md](D:/WSCodex/REA/research/selection-layout-render-evidence.md) and [selection-layout-indicator-evidence.md](D:/WSCodex/REA/research/selection-layout-indicator-evidence.md). They do not provide a serialized initial text-panel rectangle or native font metrics to this host.

The chosen initial-panel substitute is therefore explicit: **browser-derived measurement of the immutable authored text/rich text plus the current view's normal declarations**. Authored expression strings remain literal during this measurement. Runtime globals, row data, Loaded/ItemLoaded actions, SetText, SetStyle, selected/hover/focus state and action geometry do not become author measurement inputs.

This policy avoids needing a race-prone capture of “the first rendered text.” Loaded can replace text before the first host render, and hidden/inactive widgets may not render at all. It also means identical row templates can share a measured declaration result. That sharing is an implementation consequence of this bounded proxy, not a claim that the vendor font engine was observed to produce identical geometry for every possible repeater row.

| Use | Exact current input | Exclusions |
|---|---|---|
| Initial panel estimate | `runtime.selectionDisplaySource(id)` | No row/global resolution, action text/style/geometry, interaction paint |
| Live text and rich runs | `runtime.widget(original, context)` followed by `runtime.richText` or `runtime.text` in the existing host | Never reused as initial author measurement |
| Plain SetText structure | `runtime.nativeTextSet(id, context)` and existing plain-setter painter | Does not request author panel regeneration |
| Live selected mark | `Boolean(live.selected ?? live.checked)` | Do not substitute `checked` or logical OR |
| Native input value | `Boolean(live.checked)` | Does not force selected paint to agree |
| View baseline | Active view declarations through the runtime getter | Do not choose a speculative device/view before queued runtime selection commits |

`selectionDisplaySource` reads the indexed original widget, applies `adaptiveOverride`, merges normal styles through the existing atomic-style helper, projects only explicit adaptive text fields into rich runs/paragraphs, then returns detached data. It works before `start()` and after Loaded without a rendered-widget cache. It returns `undefined` for absent IDs, non-selection types, and legacy checkbox/radio widgets without `selectionText`.

The method is a **display-source API, not a saved-widget conversion**. Its result retains authored state-style definitions; it deliberately does not apply them. Consumers must not call `resolveSelectedStyle` on this source, feed it through `runtime.widget`, resolve its expression strings, or save the projected object back into the document. In particular, spreading an adaptive declaration may carry its `stateStyles` metadata rather than materializing a normal saved Widget. Only the documented normal fields are measurement inputs.

The tests independently check that an initial selected font size 54 and P94 31 do not replace the normal declaration's font size 20/P94 14 or a run's explicit 17px font. Whether the original author's initial text measurement includes every selected/disabled asset variant remains unproved here. The normal-declaration policy is intentional and must stay labeled as such.

## Minimal common host interface

The portable factory now supplied by the parallel implementation is `createSelectionTextLayout(shapeText, readTextBox?)`, with `supports`, `fontsReady`, `measure`, and `project`. It consumes the declaration source directly and never calls a runtime state resolver. Its result carries `origin: 'browser-derived'`, a panel rectangle, text x/y/width without height, and a local indicator rectangle. This review does not repeat its independent numeric test suite; its frozen implementation report is referenced in the JSON evidence.

A host should supply the following independently:

1. `source = runtime.selectionDisplaySource(id)` for Preview/offline; the equivalent explicitly projected authored declaration for the editor.
2. `liveWidget`, `resolvedText`, `resolvedRichText`, `plainSetter`, checked/selected state, and full row context for current drawing and interaction.
3. A display-only measurement cache bound to the source's normal layout inputs and font realm/readiness. A font-ready refresh may replace this display estimate, but cannot write owner geometry, `selectionText`, P94, adaptive overrides, or a stored TextPanel.
4. Stable control identity derived from page/session and the complete repeater context. Never use source widget ID alone for label `for`, input ID, radio name, focus tracking, or runtime events.

With this declaration policy, measurement can be shared across rows when its complete inputs agree. DOM/control identity and live state must still be per instance. A SetText, check/select, hover, global-variable update, or row sorting operation is not a source-cache invalidation. A genuine authored declaration/view change or changed font realm/readiness is. Use the core's committed active view; do not independently advance a cache on a device selector change that may fail and roll back.

Move the existing live text painter into the fixed text-panel placement. Empty native SetText still hides the text layer; it must not replace the initial panel with an empty-content author measurement. The existing runtime `measureSelectionText` remains a separate direct-span AutoFit service. It can issue the established runtime Move registration but must not invoke the author layout transaction or add indicator width into the direct-span measurement.

The standalone helper presently admits ordinary unrotated selection widgets, and its measurement substitutes browser font/line metrics. The native `RichTextObject.get_IsEmpty` getter is located at token **100702331**, but only its callers and metadata were retained in this review's inputs. The helper's LF-joined empty-text rule is an explicit independent policy; this review does not claim the getter proves it.

## Selected and checked are observably different

The current core's `selectedState` uses nullish fallback. `writeChecked` preserves the previous selected state. A disabled programmatic checkbox can consequently be `checked=true, selected=false`; named-radio actions can clear a peer's checked value while its selected paint remains true. The new tests exercise the disabled discrepancy.

The visible SVG must use the selected expression, while the native input must retain checked for keyboard/accessibility behavior. Both values must remain independent in document/runtime data. Do not fix a visual discrepancy by rewriting either value during render.

Named radio re-click also matters: its existing `onClick` calls the core check path, whose peer reset can produce unselect/select even when the checked value stays true. Replacing that with change-only loses established behavior. Checkbox continues to use its existing change path. Disabled input behavior must remain a gate.

## Sibling input and event contract

Before the new SVG integration, both hosts put the input inside the label. The retained generator instead emits label `for=<input id>` and a sibling input with absolute origin, zero width/height, zero border and opacity 0. This preserves focusable native-control semantics; `display:none` is not equivalent.

The reviewed Preview/offline wrapper click handlers did not distinguish a label-origin click from the browser's forwarded input activation. When introducing explicit label association, test and deliberately handle that pair. An owner Click must be dispatched once for a visible text/indicator activation, not once for the label and again for the input. Do not manually toggle on the label and then allow the browser default activation to toggle again. Preserve rich-link handling: link clicks must retain their own event/navigation scope and must not acquire a second widget toggle through a broad label handler.

Input focus and event anchoring are separate responsibilities. Existing `sourceElement(...).querySelector('input')` still finds a sibling input, but `input.getBoundingClientRect()` becomes a zero-size point. Keep the input as the true focus target and restore focus by its stable full-instance control key; choose the visible indicator/owner rectangle explicitly for menu/error/event anchors if the host needs a visual anchor.

The offline `content(tag)` helper currently assumes one root child and may call `replaceChildren`. A label-plus-input implementation needs a dedicated stable pair; repeatedly recreating the input would lose native focus and complicate queued events. React likewise needs stable ID/key association rather than an input identity regenerated on every paint.

The label event observations above are a **code-path review and required browser validation**, not an executed browser bug reproduction in this report.

## Required integration checks and remaining limits

The 18 executed source tests cover hidden Loaded before first lookup; empty/live SetText and SetStyle/Move isolation; checkbox/radio initial selected typography; disabled checked/selected divergence; two-row ItemLoaded and row-local SetText; inherited view typography/sparse padding/atomic solid reset; shared-set page navigation; hidden inactive-panel descendants; and deep-clone/no-document-mutation behavior. Each runs module and naked serialized paths.

The host integration still needs real browser tests for visible text and SVG activation, exactly one owner Click and one intended check path, repeated checked-radio click, Tab/Space/arrow focus, disabled control, rich-link click, row-isolated IDs/radio groups, hidden-first reveal, view changes and rollback, and save/readback immutability. The existing selection E2E files mainly exercise direct input activation, so they cannot alone prove the new zero-size-input interaction contract.

No native font engine, original generated full page, general transform, complete state/adaptive P94 asset geometry, or original GUI comparison was exercised. No missing TextPanel measurement was invented from owner bounds. Current source snapshots and hashes, focused result files, and the exact getter body are recorded in `selection-display-host-review.json`; host implementation may continue after this review snapshot.
