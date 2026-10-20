# Transform independent review: correction follow-up

The parent fixed **RTRANS-REVIEW-01** without changing this agent's reviewed product files. The new `runtime-transform-review-correction-probes.json` contains **13/13** checks: four original-consumer comparisons now reject undefined boolean conversion as `MotionEvaluationError` in both isolated and serialized interpreters; four ordinary controls remain unchanged; four explicit numeric-cast controls demonstrate the compiler boundary; unsafe/budget failures retain `ExpressionError`.

The targeted three-file Vitest run passes **196/196** (`runtime-transform-review-focused-correction.json`). The newly included file is `tests/runtime-transform-expressions.test.ts`, protecting the dedicated motion semantics. No browser or whole suite was run.

This verifies the expression-level correction, not the unfinished action consumer's marker-fallback handling. The original native compiler still was not executed. If a property STO explicitly casts to float, the original converts undefined to NaN before boolean handling; controlled corresponding typed-provider cases agree. No claim is made that all real authored missing-property expressions are uncast.

An attempted broad SSR rerun stopped when `types.ts` changed concurrently. Its exact source-stability failure is retained in `runtime-transform-review-correction-interrupted.json`; it wrote no output claiming a stable model review. The final correction probe therefore binds `expressions.ts` alone and uses Node's type stripping to avoid loading the concurrently changing model. The first model/clone review remains bound to its original hashes. New drag/control schema additions are outside that first review.

## Additive correction to the prior browser oracle

The runtime owner asked whether six shadow/orbit endpoints were truly stable to 1e-7. Comparing the two frozen original-DOM runs proves that this tolerance was too strong:

| `finite-shadow-corner-0--10` | Moved-cache left | Moved-cache top |
|---|---:|---:|
| First original DOM run | 174.82298531205782 | -160.77995498733947 |
| Confirmation original DOM run | 175.0417331602884 | -160.99380462539602 |

The other five cases happen to agree closely in those two runs; that does not establish a universal exact endpoint. Size caches and final angles remain identical in this comparison. The original raw outputs, fixture and report are not overwritten. The new `runtime-transform-review-orbit-cache-correction.json` contains all six comparisons and binds the old bytes by SHA256.

A narrow source interpretation is also corrected: `move.js:283` calls `getPointAfterRotate(rotation.degree, resizeShift, ...)` without using its return value. Complete retained `math.js` executed in a new Node VM confirms that this helper returns a new point and leaves the input unchanged. Thus the prose saying this particular call rotates and accumulates `resizeShift` describes intent, not actual behavior, and is withdrawn. The exact source of the recorded endpoint variation is not isolated by this review. It requires equal-frame-sequence source-step comparison, not an invented wide tolerance or an unverified timing explanation.

All new files use the `runtime-transform-review-*` prefix. No production file, historical report, existing test, package or browser artifact was modified by this agent.
