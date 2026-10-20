# Core design addendum: expression pipeline closed before production work

This addendum supersedes the **expression-result uncertainty only** in `runtime-transform-core-plan.md/.json`. The earlier plan and red artifacts remain unchanged. Production is still untouched. The parent subsequently froze `runtime-transform-expression-final-probes.json`: **36/36** complete original expr/STO/variables-to-Move cases, separate from this owner's product baseline.

## Agreed implementable expression interface

```ts
interface MotionExpression {
  text: string;
  bindings?: Record<string, { kind: 'widget'; targetId: string }>;
}
type MotionProviderValue = string | number | boolean | undefined;
// Proposed overload supplied by the parent; existing overloads are unchanged:
evaluateExpression(
  expression: string,
  read: (name: string) => MotionProviderValue,
  mode: 'motion',
): string;
```

There is **no new primitive public result mode**. Native StringLiteral inputs `0`, `[[0]]`, and `[["0"]]` all ultimately return string0 and Move-To can move the axis to zero. Only a numeric optionLiteral0 reaches the consumer as number0 and preserves that axis through its loose empty-string comparison. All 126 real Move/Size inputs inspected are StringLiteral. Do not manufacture the numeric optionLiteral path from a normal author text field.

The new mode has source-specific internal arithmetic/coercion: `+` prefers numeric addition, relational comparison is numeric, STO logical operands are evaluated eagerly, and native `getBool` treats its true/false strings with the proven case handling. Boundary AST evaluation has its own source-defined short-circuit rules; it must not be implemented by applying the STO eager rule indiscriminately. Default text and errorState behavior remain exactly as released.

Each `MotionExpression` first resolves its bound widget aliases to the correct target snapshots for that expression; This, Target and Window have distinct source identities. Do not regex-substitute aliases or use dynamic JavaScript. The core's `resolveMotion` wrapper should interpolate using this mode and return text, preserving raw empty inputs until the original Move/Size coercion point. The parent owns the evaluator and model types; core consumes the final signatures rather than editing competing overloads.

## Interface alignment for runtime work after authorization

| Shared contract | Core consumer |
| --- | --- |
| `Action.move.targets` ordered entries, each with target, mode, X/Y MotionExpression, trajectory, easing/duration and optional structured boundary | Normalize one request per concrete target/row while retaining parent action order and event planner identity |
| `Action.resize.targets` ordered entries, each with target, width/height MotionExpression, anchor, easing/duration | Absolute-size source consumer; no By enum; preserve empty/nonnumeric handling and actual cache invalidation |
| Existing `Action.rotate` | Normalize single request without changing stored fields or existing standalone behavior |
| Optional new fields absent | Existing absolute numeric x/y route, including inert old duration, remains compatible |
| Boundary schema and local bindings | Validate/remap in model; core evaluates complete AST and ordered source solutions, never ignores an accepted boundary |
| Event/drag context from parent host bridge | Explicit event batch, enclosing event type, realm viewport snapshot, drag/source-move data; no invented zero deltas |
| New evaluator `mode:'motion'` | Keep factory's third dependency argument and bare `.toString()` contract; update its type to accept the new overload without a hidden imported closure |

Exact final saved field names remain the parent's types/schema decision. The above ordered carrier is the proposal already supplied, not code that has landed. Before editing core, read those final types and the final motion/drag/binding source reports. The first implementation batch can now include the approved evaluator interface, strict input carrier and event planner; it should not invent a primitive result API.

## Corrected interpretation of the retained red evidence

- Eight compatibility controls passed across current source and bare-serialized factories.
- Eight missing Move/Resize/planner capability checks are still valid pre-implementation gaps. Their early raw payload bypasses the released parser and predates wrapped MotionExpression; it is not a released-document regression.
- The two numeric/string evaluator expectations were **wrong as a requirement for real native StringLiteral inputs**. Their observation that the product returned string0 is factual, but the asserted need for primitive output is superseded by the full source pipeline. They must not become product tests expecting numeric output.
- No harness error occurred. The earlier JSON's label `confirmedGaps:10` is retained historically, with the corrected accepted count **8** stated here and in the final manifest.

No new product tests, browser, build, package or original GUI action was run for this addendum. All production inputs remain the same as the retained core baseline.
