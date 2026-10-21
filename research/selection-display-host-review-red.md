# Selection display host lifecycle review: red baseline

Scope: independent module and bare-serialized tests of `createSelectionDisplay`; no browser, font engine, actual SVG renderer, native DLL or GUI execution. Only a new `tests/selection-display-host.test.ts` and new review artifacts were written by this reviewer. Production ownership remains with the parent.

The reviewed host source is preserved verbatim at `.build/selection-display-host-review-first-source.ts.txt`, SHA256 `69702562a5d911f605f216d6ce089648184818452653bba7c48682f7e1c50657`.

The corrected baseline has24 tests:18 pass,6 fail. Each of the following three product findings reproduces independently in the module and `Function#toString` path:

1. **Unsupported next source leaves a stale font request alive.** Display an unrotated source, keep its font promise pending, then update the same label with rotation37. The latter returns false, but the former promise still remeasures and repaints the old source because the WeakMap entry was not invalidated.
2. **A new supported source without a measured result also leaves the former entry alive.** After a successful pending source, supply a different source whose measurement returns undefined. Completing the former font request repaints its old panel. Returning no current layout must not authorize an earlier asynchronous result.
3. **Cache-hit painting bypasses error fallback.** After a successful update, make the indicator painter throw during the same-key update. The error escapes `update`; the initial-measure/paint path would have caught it and restored the native-input fallback. The two paths need consistent failure handling.

These tests establish host control flow, not the correctness of arbitrary indicator drawing. The deterministic painter failure is a generic injected-service failure. It must not be described as a demonstrated SVG rendering defect.

Passing coverage verifies authored-source versus current-paint separation; replacement child nodes during font loading; stale promises after a valid new declaration; isolation between labels sharing a widget ID; detached-label resolve behavior; initial and post-font measurement failures; font rejection; successful fallback recovery; immutable widgets; and unchanged owner left/top/width/height/transform. The host changes owner paint/overflow styles intentionally; that is not confused with saved geometry mutation.

The first run had14 passes and10 failures. Four failures were stale test expectations after the parent's concurrent, intentional all-four-padding and `selectionFonts=pending` changes. The first JSON and exact first test bytes remain preserved. Only the six failures in the corrected red report are product findings.

Artifacts:

- `.build/selection-display-host-review-first.json/.log`
- `.build/selection-display-host-review-first-source.ts.txt`
- `.build/selection-display-host-review-first-test.ts.txt`
- `.build/selection-display-host-review-red.json/.log`

The parent was notified with minimal repair suggestions. This red review is immutable; a later correction must use a new report rather than replacing its findings.
