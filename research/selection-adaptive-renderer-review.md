# Adaptive selection renderer / host / browser review

2026-10-21. Independent read-only review against .build/selection-state-final-snapshot. Reviewed the four requested current files, including the final Midpoint 1 / Midpoint 2 additions. Also read the unchanged selection-display host to verify cache and asynchronous font behavior. The browser spec has no snapshot predecessor. No product/test/configuration files were edited, no test/build command was run, and no existing output was rewritten. Full executable verification is owned by the parent run.

## Finding

**No blocking correctness finding in the reviewed delta.** The renderer remains a pure projection of the supplied runtime paint snapshot. No runtime accumulation logic moved into the renderer or font lifecycle. The tests exercise the intended split at unit and real-browser boundaries. This review does not certify the whole runtime ledger, original Axure GUI behavior, complete native SVG body/crop, or full parity.

## Checked behavior

- **Snapshot assignment and repeated rendering:** src/model/selection-indicator.ts:68–78 computes geometry before DOM mutation, then assigns scale(x,y) directly from the snapshot. It does not read prior style/computed transform or multiply a matrix. Repeated paints with an unchanged snapshot therefore retain the same scale. Geometry continues to use assetSize/assetStrokeWidth, keeping source paths independent from the runtime transform. New unit cases at tests/selection-indicator.test.ts:132–153 cover repeated paint, retained paths, finite zero scale, removal of the scale pair, and subsequent authoring paint; both normal-module and serialized-factory modes execute these cases.
- **Paired finite validation:** src/model/selection-indicator.ts:43–45 rejects one-axis-only, Infinity/NaN and unexpected transform-origin values before geometry/paint can write any SVG state. Both axes may be absent. Finite zero and negative scale values are intentionally not rejected; the primitive CSS matrix can represent them. The new unit table tests missing x/y and nonfinite values on each side. No coercion of strings or nullable values passes Number.isFinite.
- **Author reset:** an undefined snapshot assigns empty transform and empty transformOrigin, so a previously painted SVG cannot retain runtime scale when reused for authoring. A snapshot with the scale pair removed but an explicit top-left origin retains only that origin, which is semantically separate and explicitly asserted. The host test also calls update without a snapshot after a runtime paint and confirms undefined reaches the painter.
- **Font/cache propagation:** src/runtime/selection-display.ts is byte-identical to the snapshot. On a cache hit it updates entry.current, entry.text, entry.input and entry.paint before apply. The pending font callback retains the entry object, checks its identity in the WeakMap, then applies its current paint; it does not close over the first snapshot. The frozen-paint case at tests/selection-display-host.test.ts:96–111 updates 2×3 to 6×9, completes the earlier font promise, and verifies that 6×9 reaches the painter without mutating either frozen object. Existing stale-entry and replacement-node cases remain intact.
- **Browser interactions:** tests/e2e/selection-adaptive-svg.spec.ts imports an actual document through the UI and drives named buttons through Playwright clicks. It does not invoke the runtime scaling helper or derive expected values from the product function. It covers preview, frame, exported offline page and exported offline frame. Assertions use actual browser CSS transforms/origins, SVG viewport bounding boxes, retained SVG/input identity markers, unchanged path declarations, checked native inputs, updated outline width, absence of host/label scale, no runtime error alerts, no offline HTTP requests and an unchanged saved document.
- **Repeated application and paint isolation:** same-view Apply A twice remains 2×3; SetSelected/SetStyle paint actions keep that transform; B then accumulates to 3×3; P94-only and Base preserve the existing matrix; re-entering A yields 6×9. This is an observable action sequence, not a setter unit test. The fractional four-step sequence distinguishes browser-like readback from retaining unlimited JS precision.
- **New midpoint regression:** the two distinct named views each declare width 101.5625 over base width 100. Actual UI clicks assert browser matrix 1.01562, then 1.03149. The second step exposes an incorrect rounded prior multiplier, while the first by itself would mainly check browser serialization. These values are literal expectations rather than calls into the implementation.

## Residual coverage and evidence boundaries

These are nonblocking limits, not discovered product regressions:

1. The font-ready/update ordering and author reset are proved by host and renderer unit layers; this new E2E does not force a delayed real font load, update the view while that font is pending, close preview, then observe authoring SVG styles. A future combined browser regression would strengthen that asynchronous integration boundary if the host lifecycle changes. The current unchanged host path and latest-entry logic support the present implementation.
2. The invalid-snapshot unit starts with an empty SVG. Code inspection confirms the guard precedes all writes, but a prepainted SVG unchanged after invalid input would provide a stronger regression assertion if validation moves later. No current partial-write defect was found.
3. Browser bounding-box assertions measure the product's b×b SVG viewport under transform; they do not prove path painted extents, native padding/crop, clipping, text pixel positions, or interaction hit testing at the scaled visible mark. b×b / overflow-visible remains an explicit product choice under selection-svg-bounds-evidence.md. The new evidence must not be described as original Axure pixel equivalence.
4. This E2E initializes Base and drives explicit view actions. Initial named-view, repeater asset replacement, state-specific event eligibility, complete/sparse adaptive carriers, resize scheduling and ledger serialization belong to the runtime review/tests; no claim of comprehensive coverage of those paths follows from this four-file review.
5. Exact Chromium computed-matrix string assertions are appropriate to the retained runtime evidence and the configured browser; another browser/engine may serialize precision differently. They intentionally catch the compatibility behavior this implementation targets.

## Reviewed file identities

Hashes were collected after the final midpoint update. The unchanged host was additionally compared byte-for-byte via SHA-256. Re-review is needed if any listed current hash changes.

```json
{
  "files": [
    {
      "path": "src/model/selection-indicator.ts",
      "currentSha256": "8a31c5b7493aaaba14bf3958581f2af9dfe8b90f1568f1bdd3065a5956215ed6",
      "snapshotSha256": "a41bdeb77722cfae4f1010ff8085ab0c8c9db7060aedcd4173c9eb1f219e4a3c"
    },
    {
      "path": "tests/selection-indicator.test.ts",
      "currentSha256": "a20200ce0dccc90e862fcaad65a9cec940c2801790f7229589f69d2cf60f5d86",
      "snapshotSha256": "a0e2144f6de94df00d2b1ba839ac2da83ce94b65ba68d722cb82d1138198779b"
    },
    {
      "path": "tests/selection-display-host.test.ts",
      "currentSha256": "568f850c5c808cb4d7e85de126b87d6877b793af9e2a242fefeb83233d76e9f9",
      "snapshotSha256": "6f164ebd22515500f16151eb4dcf2a565dbf46372ab90bf2778b02ad2804e824"
    },
    {
      "path": "tests/e2e/selection-adaptive-svg.spec.ts",
      "currentSha256": "f32210d8357bbd972f1b4c647c2f81e5caf5de78b2464e6643b62a430be36671",
      "snapshotSha256": null
    }
  ],
  "host": {
    "path": "src/runtime/selection-display.ts",
    "currentSha256": "f4755d8c282079bf572afee76dd8cb8bf2d9285f9499c89795df8ad2b96791a6",
    "snapshotSha256": "f4755d8c282079bf572afee76dd8cb8bf2d9285f9499c89795df8ad2b96791a6"
  }
}
```
