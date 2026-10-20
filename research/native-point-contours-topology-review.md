# Independent topology integration review

Read-only review of the native-point-contours implementation. No production files, previous evidence, original DLL, GUI, browser build or package were modified or executed by this review.

**Final result: 71/71 independent checks passed; no remaining blocking finding.** Product sources stayed unchanged during the final probe. The frozen topology source contract remains at `native-point-contours-topology-manifest.json`, SHA256 `2ab95dad4766403d9eeaa0e36a2b1d711b1b132e7d58acfc70084d6386d36615`.

## One defect found and corrected

The first implementation applied outward rounding to every computed rectangle. In native `iN4x` (100702690), the all-pruned, unrotated first-anchor fallback at IL `0x56–0x77` skips `Y5uk` (`0xB0`) and jumps directly to minimum-size expansion at `0xB6`.

For a first world anchor `(12.25,30.75)` and stroke width 1:

- Native: exact zero rectangle `(12.25,30.75,0,0)` → minimum expansion → owner `(11,30,1,1)`; normalized anchor `(1.25,.75)`.
- First product implementation: premature outward rounding → owner `(12,30,1,1)`; normalized anchor `(.25,.75)`.

The earlier stroke-width-4 example happens to produce equal owner bounds under both orders. It was insufficient to expose this defect. Fractional anchors with 0/1/1.25/2/3/4 stroke widths and both M-only/M-Z representations now distinguish the branch.

The original implementation was independently run first through Vite SSR, then reproduced from the parent's preserved full source backup `.build/native-point-contours-before-fallback-fix` with the same helper SHA `0ce4ebd2a375d2ab46bfdd61630fa89c34b8b53c8fe766dc4ae7f490f9098565`. The saved red matrix has **61/71 passed, 10 failed inputs representing this one root cause**. The fixed implementation skips outward rounding only for the first-anchor fallback. Rotated empty unions and surviving-but-inactive curves still use the usual rounding path.

Final `src/model/vector-commit.ts` SHA256: `056eb17a8fdf60dc819a12b6b59c116b167a883acea75607dd8a8affce3a8fcc`.

## Covered boundaries

`native-point-contours-topology-review-probe.mjs` loads TypeScript product modules in memory without a build and compares them against the separately frozen CIL topology oracle. It covers:

- Multiple contours; isolated first anchors; a distant `.0005` line omitted only from bounds; retained M/L/C/Z sequence and input immutability.
- Open and closed paths, explicit duplicate closing endpoints, equal-endpoint cubic loops with distant handles, strict endpoint and handle `.001` boundaries, inactive closing-only survivors, and the singleton `>=1` removal branch.
- World versus inverse-old-center filtering at 37° and 45°, with thresholds selected so the coordinate space changes whether curves survive.
- Rotated all-pruned fallback at 37°/45°/90°; zero and below-threshold native sizing frames; the distinct ±360° rotated dispatch with identity trigonometry.
- Fractional first-anchor fallback without outward rounding, including fractional stroke width.
- Per-contour temporary closure activity and preservation of unrelated contours.

For ±360° and below-threshold rotation, explicit numerical expectations use the peer's frozen native sizing-frame evidence rather than this topology oracle's generic `Math.sin` sink. The implementation's separate `vectorMeasurementContours` adapter constructs temporary curves and never deletes saved commands. Static inspection also confirms its segment-activity bits are not rewritten by the native-style measurement filter.

The adaptive command, Inspector and canvas flow were hash-bound for this review. Their established current-view geometry/shared-path contracts were not changed by the topology helper. This is not a claim to have rerun the parent's authoring/browser/package suites.

## Retained evidence

- `native-point-contours-topology-review-red.json`: preserved old-source matrix, 10 failing variants of the one rounding defect.
- `native-point-contours-topology-review-probe.json`: final 71/71 matrix, expected and actual bounds/commands, source hashes, `sourceStableDuringProbe: true`.
- `.build/native-point-contours-fallback-red.json`: core's independently failing regression.
- `.build/native-point-contours-fallback-green.json`: core's targeted 254/254 verification; consumed as external corroboration, not rerun here.
- `native-point-contours-topology-review.json`: final machine-readable review manifest and limits.

The source contract and all prior frozen files remain untouched. The CIL interpreter still has explicit collection, primitive, matrix and extrema sinks. General affine transforms, native GUI commit legality, lossless inactive endpoint handles and arbitrary native interior-segment fill grouping remain outside the current M/L/C/Z adapter scope.
