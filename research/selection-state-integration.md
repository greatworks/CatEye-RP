# Selection runtime SVG state integration

This stage carries the existing Axure RP 11 reconstruction forward. It is not a full-product or native-GUI equivalence claim. The preceding library stage remains frozen at `selection-library-verification.json` SHA-256 `9154b2d8cfb804bfe73287ac9851b9c5e414e66b131113553b465ac9721bb335`; its candidate, source snapshots and verification records are not replaced.

## Observed problem and implementation

The previous display renderer painted directly from the latest Widget style. It therefore lost the original runtime's SVG presentation-attribute history, and left an initially selected radio dot fill-only after prototype initialization. The original runtime can apply width3 followed by width0 synchronously; the second application does not erase width3. This must be recorded before React combines notifications into a render.

The runtime now produces a compact per-instance paint snapshot; the renderer consumes it without generating additional state events. The snapshot separates initial asset size/inset from later fill, stroke and width. The display host forwards the latest snapshot through cache hits and font completion. Preview, embedded player and exported HTML use the same portable runtime and display functions. Authoring without a runtime snapshot retains the initial asset renderer.

The original initial radio mark has no stroke-width attribute, independently of the outline width. Its implicit width1 must not be replaced with the outline's initial width0. Nonzero runtime widths update persistent attributes; `linePattern=none` suppresses effective width without clearing those attributes. Checkbox initial CIL uses `(size/14)*3`, while runtime CSS uses `(3*size)/14`; their floating-point order is preserved separately. Selected/checked stay distinct, and source model documents are not mutated by prototype execution.

## Evidence

- `selection-state-dispatch-evidence.md`: complete original style module and retained public/event entry points, 144 sequences, 520 steps, 220 SVG applications. Covers eligibility, initialization, selected/checked separation and pointer state.
- `selection-state-dispatch-callback-evidence.md`: 12 original callback/Wait sequences. Selected paint precedes selected callbacks; error paint and its gate follow error callbacks.
- `selection-state-dispatch-style-action-evidence.md`: 8 additional original style/adaptive sequences. Repeated style calls really do paint in this version: the apparent last-class predicate reads an array interface from an object carrier.
- `selection-state-assets-probes.json`: 6 original runtime sequences / 102 observations, preserving SVG/path identity while state, action, adaptive and P94 values change.
- `selection-state-assets-initial-probes.json`: 8 retained CIL entry projections, separating authored HTML selected/disabled values from the normal asset generation context. This is instruction projection, not execution of the original DLL.
- `selection-paint-runtime-probes-second.json`: preceding independent 24 sequences / 216 SVG observations used by the renderer projection tests.

## Failure records

The new browser test first ran against the prior frozen production build. All three modes (preview, embedded frame and offline HTML) reproduced the missing initial selected-radio stroke. Those failures, screenshots and traces remain under `test-results/selection-state-red`.

Renderer tests first failed 48 cases: 24 exercised the missing snapshot support, and 24 exposed a test adapter naming error (`radioButton` in original data versus `radio` in the independent model). The naming adapter was corrected without changing the oracle. The first implementation passed checkbox sequences; after the adapter correction both controls passed. Subsequent snapshot validation and font-host tests were added separately. Reports remain under `.build/selection-state-renderer-*`.

A typecheck during parallel integration reported the deliberately not-yet-added runtime getter; it is not a final verification result. Runtime-specific red/green records and the final stage verification are retained separately.

The first new production browser batch passed15/18. Three existing complex-fill tests showed that a null runtime snapshot bypassed the display host and replaced its input/label with legacy DOM. The outer host admission now uses the authored support predicate while update receives null and performs explicit fallback, preserving the original input. The second build passed18/18.

Independent review found and fixed the disabled checkbox/radio mouseenter host gate. It also found the runtime tick multiplication order and an unsafe return from unsupported paint to solid paint with stale attribute history. Four new module/serialized regressions failed before correction. The latter is deliberately handled by keeping that asset on native-input fallback until recreation, rather than guessing the missed SVG mutations. An invalid test pattern spelling `dash` was corrected to the model's actual `short-dash` enum after typecheck; the earlier failure/log is preserved.

Final validation: `npx vitest run --maxWorkers=4` passed **5,985/5,985**, unchanged timeout; TypeScript and a fresh production build passed. The final production browser batch passed **18/18** (display/alpha, library insertion, state sequences across preview, frames and offline export). An isolated packaged Windows application passed **3/3 behavioral groups**, including real file open/save, preview reset with unchanged design, and offline exported HTML plus nested frame. Native picker responses were mocked; actual disk I/O, packaged application code and browser behavior ran. All three final hidden-window screenshots were visually reviewed. No page errors or network requests occurred in the desktop smoke.

The final package app.asar SHA-256 is `0979c3ad4fabc7e626611528640474be31b9dba8134b2c8dca659a2403f73d35`. All15 packaged application files match their inputs, with22 separately licensed Apache-2.0 fonts verified; proprietary Axure code/assets are not packaged. Earlier first/second builds and the intermediate package remain distinct artifacts. No distribution ZIP or publication was made.

## Boundaries

This is the ordinary, unrotated, solid-color, zero-radius selection-indicator subset. Complex gradients, active shadows, transformed or partial borders and unsupported initial assets keep the explicit fallback. Adaptive SVG CSS scaling, native crop boxes, full rasterization, general master/container/repeater source parity, native `.rp` writeback and complete Axure parity remain separate work. Our row lifecycle tests establish product isolation/reset behavior, not original repeater parity.

Entering an unsupported runtime paint branch keeps that asset in fallback until page/repeater/preview recreation. This is an explicit product boundary, not an assertion that the original runtime behaves that way. Full application browser and historical desktop suites were not rerun for this stage.

Original Axure is past authentication, but the previously failed native screenshot/input bridge has not been retried or bypassed. Controlled original-script execution and independent product browser/package tests do not establish original GUI or pixel identity. `originalGuiCompared=false`, `fullAxureParity=false`, and `published=false` remain explicit.

Final hashes, input snapshots and retained failure records are in `selection-state-verification.json`. The earlier agent runtime manifest pins its own final copies; root's subsequent host fallback and boundary fixes supersede its two live source/test hashes without modifying those historical copies or records.
