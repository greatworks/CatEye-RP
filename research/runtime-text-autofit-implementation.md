# Native ordinary-shape SetText AutoFit

This stage adds runtime measurement, resizing and alignment movement after a qualifying plain SetText action. It builds on the independent initial text layer from [the previous stage](text-autofit-implementation.md); it does not resize an owner merely because its saved AutoFit flags are present. Initial owner rectangles, font sizes, paths and rotations remain unchanged until a runtime action changes them. The previous report's runtime-unimplemented limitation is superseded only for the ordinary-shape subset described here.

The implementation uses the existing optional `Widget.shapeText` source flags on box, ellipse and path widgets, with explicit recovered padding and vertical alignment. There is no new authoring control for these flags, no broader native importer acceptance, and no claim of original GUI pixel equivalence.

## Evidence and implementation boundary

The [runtime plan](runtime-text-autofit-plan.md) identifies the retained `SetWidgetRichText` plain-text branch and its AutoFit call. The [integration plan](runtime-text-autofit-integration-plan.md) separates measurement hosts, core geometry, row identity and renderer responsibilities. These plans describe the investigation at their publication time; the later evidence below resolves their flag-bridge and measurement questions without rewriting the historical files.

- The [native flag bridge](runtime-text-autofit-bridge-evidence.md) has 41 bounded static replay cases. Generated width and height flags use their respective stored Boolean and effective-transform scale gates. The already accepted ordinary VectorShape subset has no effective transform or a supported identity transform, so it can use the retained flags directly. Scalar `Widget.rotation` is not a substitute for a general native transform. Other TextRectObject classes can emit flags but have different resize gates; this stage does not extend AutoFit to cells, images or selection controls on that basis.
- The [geometry evidence](runtime-text-autofit-geometry-evidence.md) has 18 exact-function VM probes with declared DOM, measurement and event sinks. It establishes resize before alignment movement, parent fit before Resize handlers, and the distinct logical-size/cache behavior at zero. It does not establish browser paint for every native SVG scaling edge case.
- The [measurement evidence](runtime-text-autofit-measure-evidence.md) runs retained setter/AutoFit functions with shipped jQuery in a controlled Edge DOM: 64 cases and 21 assertions. Width is the maximum sum of each paragraph's direct child spans, plus effective horizontal padding. Height is the text layer's content height plus vertical padding. Both are read in the old owner layout, height first; borders are not added. The tested inline-width fallback uses untransformed offsets, while nonzero computed dimensions can preserve fractions. A transformed screen bounding box is not the oracle.
- The [adaptive evidence](runtime-text-autofit-adaptive-evidence.md) has four exact-source VM cases. Direct remeasurement retains existing geometry caches. A real native view transition separately clears geometry before applying the view, refreshing repeaters and remeasuring. The product exposes that distinction explicitly, within a narrower supported reset scope.

No original source code or retained jQuery dependency is copied into the product. The independent implementation follows these bounded observations.

## Shared measurement and safe text painting

[`createShapeTextMeasurer`](../src/runtime/shape-text-measure.ts) is a serializable factory with an explicitly supplied shape-text renderer. Its `measure(widget, owner, document, { plainSetter })` method returns candidate content-plus-padding dimensions, or no measurement when the type, flags or DOM realm are unavailable. It never substitutes a guessed font size or transformed rectangle for actual text layout. The core host separately supplies the current effective owner rectangle and alignment.

Visible, correctly structured live text is measured in its own realm. A missing or hidden owner uses an isolated, safely painted copy at the effective old dimensions; it does not temporarily reveal or restyle the live owner or its ancestors. Copies are removed in `finally`, including on reader errors. Only explicit text, paragraph, run and link structures are created. Hyperlink descendants remain nested, so their text does not accidentally become a direct-span width contribution.

This is intentionally not an exact reproduction of the original hidden-owner clone's inheritance quirks. The original clone can lose ancestor-dependent styles; the product copy uses the supplied effective widget. The bounded default dimension reader covers the measured modern Edge div/span cases. It is not a complete replacement for all jQuery table-row, non-pixel, classic-scrollbar or reliability branches.

The factory also supplies `paintPlainSetter`. Initial imported text keeps the previous stage's escaping, break and space rules. Runtime plain SetText has a separate projection and DOM path:

- Preserve the first paragraph and first run formatting, replacing later paragraphs/runs with the new plain value.
- Interpret CRLF and LF as explicit BR nodes. Preserve bare CR, U+2028, U+2029 and ordinary spaces as literal text; do not apply the initial renderer's NBSP conversion.
- Use one outer run with nonempty line spans and BR separators. Do not invent a terminal line strut for a trailing break, or an initial empty-paragraph BR for an empty setter.
- Preserve the sole linked run for the supported single-line reuse case; structural replacement removes that link. Its retained wrapper still excludes it from the direct-span width sum.
- Hide the text layer for an empty value. Content measurement can then be zero while effective padding still produces a nonzero candidate.

The private native-setter marker is separate from the AutoFit registry: a qualifying FF shape still uses the setter text structure even though neither axis is measured. Neither marker is a saved document field.

## Core geometry, events and lifecycle

[`export-runtime.ts`](../src/runtime/export-runtime.ts) owns the shared core used by preview and portable players. After text is committed to runtime state, `ControlHost.flush` allows the renderer to paint it before `measureShapeText` reads the current instance. Unsupported or headless execution still changes text but does not fabricate dimensions.

The enabled axes take measured candidates and inactive axes retain the old effective dimensions. The core preserves fractional and zero values. On a nonzero delta it writes the requested drawing size, updates the logical pair cache when at least one requested axis is nonzero, fits the parent, and dispatches Resize before applying the alignment movement and Move event. Synchronous Resize handlers therefore see new dimensions at the old position; a handler's own movement is retained before the alignment delta is added. Owner rotation remains unchanged. Cached parent/row fit follows resize-time bounds rather than silently refitting again after the direct alignment move.

The original double-zero distinction is retained: painting 0×0 does not replace a prior logical width/height pair. Zero-delta setters can still register for later remeasurement. Negative or nonfinite host candidates are rejected under the product's admitted measurement contract; synthetic native negative requests are not claimed supported.

Registrations, setter markers and temporary geometry use complete nested repeater row contexts, not template IDs alone. Refresh, deletion, navigation and disposal clean them up. Synchronous failures restore the private measurement state with the existing runtime transaction. Resize-to-SetText reentry is bounded and reports an error rather than hanging.

`updateAutoFitted(false)` remeasures registered instances without clearing their two-axis cache. The explicit view-transition entry `updateAutoFitted(true)` clears supported ordinary-shape movement/size/rotation overrides and temporary geometry, clears cached panel fit, refreshes repeaters, then remeasures surviving/new registrations. Text, rich content and other runtime state remain. This is not a claim that the original complete adaptive applied-style, opacity, visibility and every container-specific reset routine has been reproduced.

## Preview, standalone export and frames

- [`RichTextContent`](../src/components/RichTextContent.tsx) and [`WidgetView`](../src/components/WidgetView.tsx) use the private setter marker to choose the safe runtime text structure. Initial rendering and the existing inline rich-text editor remain separate.
- [`Preview`](../src/components/Preview.tsx) binds the actual effective widget, row context and DOM owner to the shared measurer. A genuine adaptive-view change invokes the explicit transition after the new view is painted; ordinary viewport changes within the same view do not implicitly resize a style-only change.
- The portable DOM renderer uses the same painting and measurement factory. [`export.ts`](../src/runtime/export.ts) serializes it with explicit dependencies into standalone HTML and the recursive internal-frame bootstrap.
- The separately built [`frame-player`](../src/runtime/frame-player.ts) supplies the same factory inside its own document realm. Nested frames measure their own owners rather than reading a parent document's DOM.

Runtime results remain session state. Import, preview, frame navigation and exporting do not write the measured dimensions or setter markers into the saved design.

## Focused verification and final release record

The stage has separate tests for the independent reader, core behavior and real browser integration:

| Test file | Scope |
| --- | --- |
| [`shape-text-measure.test.ts`](../tests/shape-text-measure.test.ts) | Module and serialized factory; axis/read order, direct spans and links, realm guards, safe copies, plain-setter characters/structure, zero/fractional box reads and cleanup. The focused run passed 36/36. |
| [`runtime-text-autofit.test.ts`](../tests/runtime-text-autofit.test.ts) | Module and portable core with an injected measurement host; four flag combinations, nine alignments, unchanged initial geometry, zero/cache behavior, raw first-run text, resize/move ordering, panel and repeater fit, rollback and no-DOM behavior. |
| [`runtime-text-autofit-lifecycle.test.ts`](../tests/runtime-text-autofit-lifecycle.test.ts) | Module and portable core with a fake host; row and nested-row isolation, refresh/deletion/navigation/disposal, adaptive remeasurement versus reset, content preservation, rollback and bounded recursive setters. The focused run passed 28/28. |
| [`runtime-render-base-lifecycle.test.ts`](../tests/runtime-render-base-lifecycle.test.ts) | Module and serialized regression for display-only row bases: a rebuilt row must use template geometry before its next action. Both cases failed before private scope cleanup was added and passed afterward. |
| [`expressions.spec.ts`](../tests/e2e/expressions.spec.ts) | Existing real-browser expression and error coverage caught premature evaluation of hidden Preview text. The hidden early return is preserved; qualifying AutoFit measurement still uses its isolated fallback. The fixed production build passed an 11-test recheck including this suite, gradients, input types and the five new AutoFit workflows. |
| [`input-initial-clear.spec.ts`](../tests/e2e/input-initial-clear.spec.ts) | Full production regression exposed a separate first-clear defect: assigning defaultValue initialized the DOM without synchronizing React's value tracker. A trusted Ctrl+A/Backspace must immediately produce one change and an empty logical readback, followed by six further changes when typing 123456. This test failed before the one-time initialization sync. The shared input scenario also now checks the clear before typing. Later equal-value writes remain suppressed to preserve incomplete numeric edits. |
| [`runtime-text-autofit-preview.spec.ts`](../tests/e2e/runtime-text-autofit-preview.spec.ts) | Three real-UI import/preview workflows: first-run formatting and independent DOM measurement, rotation and event order, hidden copies, row-local mutation, adaptive transitions, and saved design preservation. |
| [`runtime-text-autofit-export.spec.ts`](../tests/e2e/runtime-text-autofit-export.spec.ts) | Actual UI-exported file HTML and the fixed frame player, including recursively nested internal frames; plain breaks, literal markup, empty and linked text, hidden owners, row isolation, adaptive behavior, errors and unchanged design saves. The file player is exercised in an offline browser context. |

The five focused browser tests passed together in 32.5 seconds; the run is retained in `.build/runtime-text-autofit-browser-final-focused.log` and its JSON report. This is a focused result, not the final production-suite or package result. Core fake-host tests intentionally use supplied dimensions rather than the product measurement helper as their oracle. The retained-function DOM probes independently establish the chosen reader behavior.

Existing initial-layout model/renderer tests and `native-text-layout`, `native-text-modes`, `native-text-editing` and `native-text-default-line-height` browser suites remain regression coverage for behavior that this stage must not replace. [`smoke-runtime-text-autofit.mjs`](../scripts/smoke-runtime-text-autofit.mjs) is the exact-package verification route; its final outcome is recorded by the parent release audit, not inferred here from browser results.

Final package results, comprehensive counts, source/package hashes and reruns are recorded in [runtime-text-autofit-verification.json](runtime-text-autofit-verification.json). **最终包与综合计数见 runtime-text-autofit-verification.json。** The release verifier writes that record only after the complete production browser suite, unit/parser checks, exact-package scripts, visual review, frozen-source audit and ZIP-content checks pass. The report also identifies the hidden-expression and initial-input-clear regressions resolved during integration; focused tests alone are not the release gate.

## Remaining limits

Original Axure GUI/sample export and pixel comparison remain unverified. The retained-function probes use controlled fixtures and declared dependencies; they do not execute an entire original generated project. Current support is the source-flag ordinary-shape subset, not every native TextRectObject or all transforms. There is no flags authoring UI.

The original zero-old-dimension SVG scaling/invalid-CSS paint is unverified; clean normalized-path resizing does not prove it. General transforms, fixed/layer geometry, all parent-event recursion and asynchronous/menu interactions are not exhaustively established by the synchronous geometry probes. The complete original adaptive style-clearing and other-container reset behavior remains outside this milestone. Hidden ancestor cascade fidelity, classic scrollbar and non-pixel measurement branches, cross-engine/DPR metrics and a general font-load waiting policy also remain bounded by the stated evidence.

Headless core execution without a DOM host performs no AutoFit measurement. No font-size reduction, initial-owner rewrite, broad native-format acceptance or estimated text metrics is used to conceal these limits. Historical evidence, manifests and earlier release records remain unchanged.
