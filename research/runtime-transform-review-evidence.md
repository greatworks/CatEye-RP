# Runtime transform model and expression independent review

Reviewed on 2026-10-20. This review changes no production, existing test, historical evidence, browser artifact or released package. It covers the new motion data model/parser/clone wiring and the bounded `motion` expression mode. The concurrently changing action planner and consumers in `export-runtime.ts` are deliberately excluded.

**One source-consumer discrepancy was confirmed**, with four controlled expressions. No additional definite model-validation or identity-remapping defect was found in the inspected paths. The requested two test files pass **134/134**. The independent probe completes **18/18 observation checks**, of which four explicitly record `parity:false`; that successful harness execution must not be described as 18 parity passes.

## RTRANS-REVIEW-01: undefined boolean coercion silently becomes a value

At the reviewed source hash, `src/runtime/expressions.ts:174–177` returns undefined from `nativeBoolean(undefined)`. In retained `sto.js:210–213`, `_getBool` first accesses `val.toLowerCase`, so an undefined input throws `TypeError`. Complete retained `expr.js` then catches a failed STO substitution and keeps its original expression marker. The following results execute the original complete expr/STO/global-variable sources in one Node VM realm; the comparison uses both the current module and its serialized standalone function.

| Controlled expression | Original StringLiteral result | Product motion result |
|---|---|---|
| `[[missing.width || 10]]` | Original marker unchanged | `10` |
| `[[(!missing.width) + 10]]` | Original marker unchanged | `11` |
| `[[(missing.width == 0) + 10]]` | Original marker unchanged | `10` |
| `[[missing.width && 10]]` | Original marker unchanged | `undefined` |

This matters when an unresolved property would otherwise produce an invented finite movement coordinate. Recommended bounded implementation: reject undefined when the motion boolean conversion is actually reached, and retain the consumer's declared error policy. Do not accidentally short-circuit evaluation of the right STO: the native binary handler evaluates both operands first, but the boolean conversion of the right value still follows JavaScript AND/OR. The independent controls verify that `false && missing.width` returns `false`, `true || missing.width` returns `true`, `missing.width + 10` returns `undefined10`, and subtraction returns `NaN`.

**Compiler boundary:** these are explicitly supplied STOs without `computedType` or `desiredType` on the missing property. The native text-to-STO compiler was not executed. A compiler-inserted numeric cast could turn undefined into NaN before `_getBool`, producing a different branch. This is an exact uncast-consumer discrepancy, not proof that every real authored missing-widget expression follows that branch. A product rejection is a safe declared boundary; this review does not require persisting native NaN geometry or reproducing every original error side effect.

The first discrepancy report was sent to the parent and runtime owner before any proposed correction. `runtime-transform-review-probes-first.json` preserves the tested hashes and actual results. Do not update it in place after a fix.

## Checks completed

- Strict motion carrier parsing retains ordered and duplicate targets, independent per-expression bindings and the complete boolean boundary tree. It requires mode/trajectory/anchor/easing/duration, bounds targets/scopes/trees, and rejects mixed structured and legacy action fields.
- Schema keys and local binding identities do not accept arbitrary executable objects. The interpreter's property/method allowlist rejects the tested prototype/global/method escape attempts before calling a provider. This is a bounded code review and test result, not a security audit of the whole application.
- New Move/Size references are remapped in normal interactions and rich-link interactions, including recursive boundary operands. An independent nested-panel case confirms target and local binding remapping, external-reference preservation, quoted-text preservation, link identity remapping and no mutation of the source graph.
- Existing component-instance tests demonstrate separate internal target scopes. No contrary clone result was observed. Dynamically constructed identifiers inside generic `value(...)` strings are not statically rewritten; the implementation deliberately distinguishes quoted data from reference tokens. Native structured imports should use the retained local binding identities.
- The new mode preserves typed internal number/boolean values and final string results. Source arithmetic, eager operand evaluation and numeric `toFixed` are supported by the parent’s 36 expression cases and later 15 widget-info/formatting cases. This review reused their pinned harness and did not rerun or overwrite their evidence.

## Sources and limits

`runtime-transform-review-probes-first.json` binds all reviewed sources and the four exact shipped scripts. Its original harness is reused only up to the `harness()` definition; the parent script’s main is never executed. The source GetWidget geometry/text snapshots, path lookup and event/window context remain explicit facades. The expressions and STO objects are controlled input carriers, not output from a newly executed native compiler.

Important reviewed hashes:

- `src/model/types.ts`: `116e312dabdda7f7279b29be23c4fbd29733b9fde441c4079efc5cdf49d394c8`
- `src/model/document.ts`: `fffd2ad491663cdbf9680641ecaff2587a7520f751d8b952c20738328c7caa49`
- `src/runtime/expressions.ts`: `8ced8724a1e48ca0e93c6cc84ce94739063dd05ca0e8b3fc0ee1538d4f4eaa88`

The fixture-rich action/queue contract, native lazy widget caches, runtime alias resolution, drag event context and boundary correction projection still require integration review against the finished consumer. Side-anchor nonfinite geometry, whole-object expression results, native compiler type inference, all function grammar and unrestricted alias/global collisions are not made equivalent by these tests. No original DLL method, original editor GUI or browser was executed during this review.

Reproduction:

```text
npx vitest run tests/runtime-transform-model.test.ts tests/expressions.test.ts --reporter=json --outputFile=<new output path>
node research/runtime-transform-review-probe.mjs <new output path>
```

The probe refuses to overwrite an existing output. Its four discrepancy observations accept either the preserved original mismatch or a corrected rejection; inspect `confirmedMismatches` and the individual results rather than treating process exit zero as parity proof.
