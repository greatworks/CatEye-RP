# Native point contours: independent rotation integration review

**Result: no confirmed blocking defect in the reviewed final sources.** This is a read-only source/model review. No product or existing test file was changed; no browser, package build, original DLL method, or original GUI was executed by this review.

Final source hashes:

- `src/model/vector-commit.ts`: `056eb17a8fdf60dc819a12b6b59c116b167a883acea75607dd8a8affce3a8fcc`
- `src/model/vector-contours.ts`: `0fe9ab8aceb1bfcfefcf79de872e0726e86633873e4d72a120176c4ad600fafa`

The companion JSON pins these sources, other reviewed integration files, original-evidence manifests, scripts and result files. Earlier review outputs remain intact. The final append was run after the separately identified first-anchor fallback correction; it does not overwrite or relabel the initial source hashes.

## Verified findings

1. `sizingRotation` in `vector-commit.ts:11` applies the strict `abs(degrees) < 1e-5` factory gate before world-point mapping. Exactly positive/negative threshold remains rotated. The raw input rotation is not mutated.
2. The signed-remainder cardinal tests preserve the native 0/360, 90, 180, 270 ordering. Negative angles are not normalized into positive modulo first; whole-turn angles retain rotated dispatch even when trig is identity.
3. `vectorMeasurementContours` receives inverse-old-frame coordinates, so the `.001` Manhattan pruning operates in the measurement frame. Active flags are used only by the unrotated bounds selector. Temporary contours do not replace the saved commands, anchors or handles.
4. The current fallback distinguishes all-pruned unrotated input from rotated/retained-but-inactive zero union. The final source skips Y5uk in the unrotated first-anchor fallback, as required by the separate topology evidence; minimum-size expansion still follows.
5. Bounds expansion precedes output normalization, and the output preserves fillRule and command sequence. The targeted probes also assert input immutability.
6. The shared author command remains `applyAdaptivePointEdit`: the reviewed source still delegates geometric changes to the helper rather than replacing its view-write/AutoFit policy. This review did not broaden the previous transaction/history claims.

## Independent execution

- Final source-derived differential: **69/69 passed**. This comprises the 64 frozen rotation fixtures and five final topology authored fixtures. Every owner coordinate and normalized point/control coordinate was compared, including tiny angles, threshold sides, signed whole turns, quarter-turn neighborhoods, a remote sub-threshold contour, single-anchor fallback, explicit duplicate closure, and a cubic loop. Output: `native-point-contours-rotation-review-final-probe.json`.
- Narrow arithmetic-order check: **231/231 owner comparisons within 1e-9**, no concrete amplified counterexample found. Seven frames include `1×1`, `1×100`, `100×1`, ordinary `200×100`, negative and fractional origins; eleven angles and three closed polygon shapes are fixed in the script. Output: `native-point-contours-order-review-final-probe.json`.
- Each final run verifies that its reviewed source hashes remain stable during execution. The installed Node type stripper is used only in memory, with a narrow import/export adapter. The earlier 69-case check used Vite SSR and is preserved in `native-point-contours-integration-review-first.json`.

These are product comparisons against retained-CIL-derived data, not new original-application observations. The original rotation oracle is independently frozen at `native-point-contours-rotation-evidence.json`; the topology oracle is `native-point-contours-topology-probes.json` (65 bounded source cases). Their constructor, collection, matrix, and numerical sinks remain the limitations stated in those reports.

## Remaining boundaries

The product maps normalized coordinates by center rotation; the retained mapper interpolates the four sizing-frame corners. The two calculations are algebraically equivalent in the supported frame. The 231-case check found no owner discrepancy above its stated tolerance, but it does **not** establish identical CLR floating-operation ordering for arbitrary coordinates. No new rounding tolerance or correction was added to the product on this basis.

The document adapter cannot represent native inactive incoming/outgoing handles at open ends. It supplies absent handles and measures the native cyclic temporary contour under that explicit policy. Arbitrary affine transforms, empty command arrays, original history callbacks and original GUI pixels remain outside this review. Browser pointer/keyboard workflows and full regression/package validation are parent-owned; their results are not claimed here.

Two local harness attempts did not reach product execution: the installed `typescript` package exposes version metadata rather than `transpileModule`, and the initial safety guard matched the word `writeFileSync` inside another guard. Both were corrected only in the new research script, then the final bounded comparison ran. These were review-harness errors, not product defects.
