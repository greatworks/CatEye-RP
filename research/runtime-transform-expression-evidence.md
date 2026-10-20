# Runtime transform expression pipeline and widget properties

Target: Axure RP 11.0.0.4150. Captured 2026-10-20. **51 final original-source probes pass**: 36 expression/STO/provider-to-Move cases and 15 widget-info/formatting cases. These run complete retained `expr.js`, `sto.js`, `variables.js`, exact Move helper slices and the original `doc.js` widget-info consumer in one VM realm. They do not run the native text-to-STO compiler, original DLL methods, or original editor GUI.

## Corrected input/output contract

Original StringLiteral substitution retains a whole-expression object only when the result is an Object in the original realm. Primitive numbers and booleans pass through string replacement. Consequently text `0`, `[[0]]`, and `[["0"]]` all return string `"0"`; each moves the original Move To consumer to the zero coordinate. An empty StringLiteral preserves the axis. A controlled numeric optionLiteral zero instead preserves the axis, but the format census found **all 126 real Move/Size inputs are StringLiteral**. The numeric option carrier is therefore downstream branch evidence, not observed ordinary author input.

This closes and corrects the early proposal to return primitives for a whole motion expression. The old product text evaluator returning `"0"` was not itself an Axure discrepancy. Primitive values remain meaningful *inside* expression evaluation and for provider/property identities.

The source STO arithmetic differs from ordinary JavaScript and from the released generic product expression mode:

- Addition first adds `Number(left)` and `Number(right)` and falls back to concatenation only if the result is NaN. Thus string literals `"1" + "2"` produce numeric 3 before final formatting.
- Relational STO comparison converts both operands numerically. STO AND/OR evaluates both operands before native getBool normalization, which recognizes true/false strings without case sensitivity. The separate boolean boundary-expression consumer has its own short-circuit behavior.
- `computedType`/`desiredType` can cast the intermediate result. The probe supplies those fields explicitly; it does not infer what the native compiler would emit for every source expression.
- Undefined and nonfinite numeric primitive results stringify. STO evaluation errors inside a StringLiteral keep the original marker. The unsafe/unsupported-expression and bounded-work policy in the independent parser is an implementation boundary, not proof of full native parser equivalence.

## Per-expression binding lifetime

Every StringLiteral reconstructs its own localVariables before substitution, including unused bindings. Bindings do not leak to the next StringLiteral. A single complete object expression can return its object; mixed or multiple object substitutions use text/label substitution instead.

The first 36-case harness uses explicit eager-copy GetWidget providers and says so. The additional 15 cases execute **original `doc.js:349–543`**, closing the actual geometry-cache rule:

- Constructing widget-info does not read geometry.
- The first x/y/width/height access reads `offsetBoundingRect(true,true)` and caches all four coordinates in that widget-info. Later accesses on that object use those values.
- Text and rotation each have separate first-read caches.
- Width/height change are not cached, although the current width/height they consult can already be cached. Changing the old-size provider changes the resulting delta.
- An alias shares that lazily cached widget-info across substitutions within one StringLiteral. A later StringLiteral rebuilds the alias. This/Target global providers create a fresh widget-info when the corresponding STO variable is read.

These cases substitute mutable numeric DOM bounds/text/angle providers; they verify the original cache consumer and call order, not original browser measurement fidelity for every widget kind.

## Numeric formatting

Original STO fCall `toFixed` is verified for ordinary numeric values, fractional precision, zero/default precision, NaN and Infinity. A string receiver without compiler coercion throws; a global receiver with explicitly supplied desired float succeeds. An out-of-range precision inside StringLiteral retains the original expression marker.

The independent motion evaluator supports bounded numeric `toFixed` without arbitrary property/method execution. Native compiler inference for string receivers and unsupported object methods remains separate work; the current tests must not turn a controlled missing cast into a claim about all native author expressions.

## Failure history, provenance and implementation use

The first expression run was 33/35. Two expected TypeErrors incorrectly assumed an unknown global resolved to null; the original provider returns empty string, whose absent property yields undefined. The corrected fixtures use an explicit null receiver to exercise actual failure. The original script/output are preserved, and the final run adds the empty-global property control (36/36). This was a harness expectation error, not a product failure.

`runtime-transform-expression-manifest.json` pins both script revisions, both expression outputs, the 15-case property script/output, this report, original files and exact slices. The runtime change uses a separate `motion` interpreter mode with string output and typed internal provider inputs; released default/errorState semantics remain separate. Model/consumer tests and a future package verification must establish actual product behavior; these source probes alone do not change release status or `fullAxureParity=false`.
