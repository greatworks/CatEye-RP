# Native pills: independent final implementation review

No blocking defect was found in the two reviewed changes. This review ran **416 checks, all passing**, against the current reader and renderer factory, including a serialized factory evaluated in an isolated Node VM. It did not run a browser, the original application, a target DLL, a full test suite, a package build, or a fresh corpus import.

## Scope and source binding

The reviewed diff is against `.build/before-native-pills/`:

| File | Current SHA-256 | Pre-stage SHA-256 |
| --- | --- | --- |
| `src/model/line-style.ts` | `87ae321c7ad2ae5125ca3ce3fd9f7c721e81e8a61aea93221f9e930f8d74e93b` | `3915cc61def68759309f58d7c586ccfc15f800eeb3ed813545578794cc3f36d9` |
| `research/scripts/read-rp-semantics.mjs` | `6d75f5fb0b7813ab074b0e10245042dac2c85cfdcd275a4d6cf1b634aab08d49` | `181cd54e084f9b3611d5a11110c7043b1d3375be3a0683ea327025170928f9e8` |

The two changes are the reader's six-anchor expected-path coalescing at lines 119–128 and the normalized family validator's expected degenerate-straight-edge reconciliation at `line-style.ts` lines 35–41. No production or existing test/evidence file was modified for this review.

Executable review: `native-pills-final-review-probe.mjs`, SHA-256 `c51edb179614f7d2fa5ce33a21aa5c3dc8c3c891112051b6a79e8c1f6d0f2161`.

Results and full source bindings: `native-pills-final-review.json`, SHA-256 `eb0907ae6d39b262eae0ff1a333bea8fefad9e6d4480f2f8f9c57a7f9879ed0d`.

## Native evidence versus implementation

The original contract is separately frozen in `native-pills-evidence.md/json` and `native-pills-evidence-probes.json`: 58/58 retained-CIL/exact-JavaScript checks. The evidence JSON SHA-256 is `0019d064c60439c259fe08bbae9684416649bd9c68ff6ec58d34969e7c46368e`. The retained DLL hash is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`; no target assembly was executed.

The original `i5vf` (`100722498`) builds eight points and invokes `m5vw` (`100722500`). That method attempts the last/first seam before adjacent equal anchors. `P5vT` (`100722499`) retains the second anchor, first lower handle, second higher handle, and second outgoing-segment flag. `N5Ex` (`100719039`) also verifies the disappearing edge has empty or anchor-coincident handles. Native point equality is per-axis absolute difference strictly below `1e-5` in normalized coordinates. Full-corner horizontal/vertical pills become six anchors; a fully rounded square can become four.

The reader implements a deliberately narrower recognition rule. It merges only its independently constructed expected perimeter when the source has six vertices and the expected perimeter has eight. The constructed disappearing straight edges have absent handles; it merges their expected seam first and then adjacent pairs with the native handle ownership. Every actual source anchor, incoming/outgoing handle and `HigherSegmentExists === true` is still matched afterward. It retains its pre-existing physical `1e-6` matching tolerance and does not claim to reproduce the native coalescing tolerance or every alternative encoding.

The six-line renderer correction is only qualification logic. When `allowLarge` is true and expected versus saved segment counts differ, it removes expected straight segments whose endpoints already compare equal under the existing `1e-7` tolerance. Cubic segments are never removed, even if their endpoints coincide. The saved path, generic path painter and dynamic rectangle painter are not changed. The ordinary public `rectangleRadii` call still defaults to `allowLarge = false`.

## Observed results

The inventory binding is `native-pills-format-inventory.json`, SHA-256 `9e49e559aaca3f084425af27d354dbf9c708f686c4d634359fbf9f2558405ba7`.

- All **28 real six-point full-mask Shape0 candidates** change from reader rejection to exact recovered radii. All six cyclic starting vertices pass for each candidate.
- **22 of the 28** previously failed normalized-family qualification because of floating-point residual straight segments. All 28 now qualify, including after an independent aspect-ratio resize. The other six already qualified before this patch.
- **1,232 raw mutation checks** reject displaced anchors/handles, partial missing handles, false segment flags, reversed traversal and a second contour.
- **924 product path mutations** reject edited coordinates/controls, removal of closure, an extra contour and an inserted degenerate cubic. Both module and serialized factories are exercised.
- Default public strict-validator results are unchanged for the real candidates and the nine other current-SIZE eight-point paths. The four dedicated tree-label records retain their reader results and are not reclassified by this review.
- Existing accepted eight-point rectangles, eight-point coincident-endpoint pills, six-point partial-corner rectangles and plain square encoding retain the baseline reader results.
- A recognized path without an explicit corner mask does not gain corner-editing permission or unconditional reconstruction. Non-box and arbitrary triangle paths remain excluded. Input path objects are unchanged after the calls.
- Direct comparisons confirm the generic path painter and dynamic rectangle output are unchanged, including width 0, width 1/10, and `solid`/`none` style inputs. These comparisons demonstrate patch scope, not native lifecycle parity.

The 28 raw recognitions are **not** a claim that 28 widgets become reachable in a whole imported document. Parent-container eligibility and orphan/package reachability are separately audited by the format agent. This review does not re-run or overwrite that audit.

## Remaining boundaries

The original initial managed contour and later JavaScript rectangle rewrite are distinct stages. Dynamic JavaScript retains zero-length straight commands and gates the rectangle rewrite on a nonzero border width and a non-`none` line pattern. The independent product can rebuild parameterized rectangles in cases where the original dynamic function would preserve an already generated initial path. This stage does not correct that phase/lifecycle difference.

The author node-overlay geometry can still show the saved path while the parameterized renderer paints a derived path. That pre-existing difference is not corrected or presented as verified UI parity. No screenshot or original GUI observation was performed by this review.

Four-point fully rounded-square coalescing and alternative anchor-coincident handle encodings are not newly admitted by the six-point-only reader change. The two existing tolerances remain independent implementation bounds; they are not native equality substitutes.

Within the agreed six-point recovery and normalized qualification scope, the review found no additional actionable defect.
