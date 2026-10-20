# Native Move / Set Size expression bindings and boundaries

This is read-only evidence for Axure RP **11.0.0.4150**, pinned `AxureRP11.dll` SHA256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. No original DLL method or GUI was executed. No production, parser, existing test, or historical evidence file was changed. The CIL replay uses explicit collection, expression-value and STO-constructor sinks; the proposed arithmetic evaluator is independent research code, not the original expression parser.

The actionable contract is a StringLiteral retaining **both text and structured per-expression widget bindings**, plus a complete boolean boundary AST. Ordered targets and all same-case siblings remain atomic. A correctly decoded Move or Size does not make an event recoverable when its source panel, a referenced thumb, a sibling action, or its event semantics are unsupported.

## Real source coverage

The previous frozen transform census covers 11 files / 41,662 objects. This stage verifies all 11 source hashes and freshly decodes the three files containing Move/Size candidates. No additional synthetic action is counted as a real action.

| Observed source | Count |
|---|---:|
| Move actions / per-target infos | 46 / 54 |
| Set Size actions / per-target infos | 9 / 9 |
| Move/Size X, Y, width, height inputs | 126, all `Axure:Expr:StringLiteral` |
| Cases containing either transform | 33 |
| Cases containing both Move and Size | 6 |
| Cases containing Rotate with either | 0 |
| Nonempty scopes among the 126 transform inputs | 36 |
| Expression objects including boundaries and siblings | 186 / 38 distinct texts |
| Nonempty scopes including boundaries and siblings | 62, one `GetWidget` binding each |
| Boundaries | 10 DragX AND pairs, plus 2 Location `top > 0` |
| Newly imported cases | 0 — research only |

The 62 names are `Track` (12), `track` (14), `maxThumb` (6), `minThumb` (4), `minRange` (2), `contentPanel` (8), `header2` (8), `header1` (8). All are explicit `FCall("GetWidget", [DiagramObjectPathLiteral])`; no guessed global alias. All observed paths have empty RDO/repeater paths and `is-dummy=false`. All observed expression repeater scopes are zero; `TextVariableIdentifier.Expr` points back to its containing expression and `TargetOverride=false`.

Source files with positive candidates:

- `Sample form patterns.rplib`: SHA256 `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179` — 42 Move / 8 Size actions.
- `Prototype Starter.rp`: SHA256 `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714` — 2 Move / 1 Size actions.
- `Quick Win.rp`: SHA256 `04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051` — 2 Move actions.

Every package/source ID, source-part SHA, raw property map, native expression/identifier/path reference, ordered sibling, and current reader diagnostic is in `runtime-transform-bindings-case-census.json`. `case-checklist.json` separates source facts, synthetic diagnostic isolation, frozen full-document reachability, and implementation gaps for all 33 cases.

## StringLiteral → local variables → typed STO

The generator bridge is exact, rather than inferred from matching names:

| Method token | Proven operation |
|---|---|
| `wJe6.BJC9` 100694411 | Reads `LiteralTextValue` and `Scope`, calls `r1qy.D1dV`, emits `exprType:stringLiteral`, `value`, optional `localVariables`, `stos`. |
| `wJe6.eJCS` 100694410 | Enumerates the scope; `uJsL.oIYX` name passes through `String.ToLower` at IL125; each `KJsx` expression recursively uses `TJMo` at IL200. |
| `r1qy.D1dV` 100729222 | Pushes scope into parser context, maps regex matches through retained parsing methods, materializes STOs and pops scope. Full parser internals are not reimplemented here. |
| `wJe6.LJCb` 100694407 / writer100694465 | Emits exact `functionName` and ordered `arguments`. |
| `wJe6.UJCG` 100694401 / writer100694607 | Emits `binaryOp` with `leftExpr`, `op`, `rightExpr`. `KJCt` is not this writer. |
| `wJe6.hJC1` 100694415 | Writes typed STO nodes, including lowercase variable names, property calls, function calls, unary/binary nodes and desired/computed types. |

The decoded literal records are in `runtime-transform-bindings-literals.json`; CIL files preserve tokens and IL offsets. The source scope is not the separate `MoveWidgetInfo.scope`: that latter scope is scratch data rebuilt for boundary projection. All 54 stored MoveInfo scopes are empty; this does not erase any StringLiteral scope.

The shipped scripts close the consumption path:

- `expr.js:204–232` creates a fresh local scope for **each expression evaluation**, evaluates each local binding, then substitutes STOs. `GetWidget` at 712–714 returns the first resolved element's widget-info object. A local geometry snapshot is reused inside that one expression; the next expression obtains another snapshot. Prior frozen `widget-geometry-evidence.md/json` already probes that cache lifetime.
- `sto.js:97–112` checks scope ownership before the global variable provider. A scope value that is an expression object is evaluated lazily; this is used by boundary `valueVarN`/`direcValN` entries.
- `variables.js:33–65` checks project global variables before built-ins, then resolves lowercase `this`, `target`, `window`, `dragx`, etc. `This` uses the event-source widget, while `Target` uses the current per-target action context. Aliases must never silently fall back to either.
- `doc.js:255–305` captures `eventInfo.window`; `axQuery.js:40–70` updates window dimensions on resize/scroll using jQuery's window dimensions. It is a viewport snapshot, not the page canvas width or height. Later action expressions retain the event's object unless the original event-copy path changes it.
- `sto.js:132–160` calls the named function/property on the evaluated receiver. The observed `.toFixed(0)` is a numeric receiver operation returning a string, not a synonym for the product's `round()`.

**Primitive return correction:** internal typed arithmetic does not mean native StringLiteral returns a number. In `expr.js:223–232`, only an `Object` result of an exact single-expression string can survive as an object; primitive number/bool results pass through `String.replace` and become strings. All 126 actual Move/Size inputs use StringLiteral. The research probe therefore records `controlledInternalValue` separately from `nativeStringLiteralResult`. Direct `NumericLiteral` transform inputs, whole-object results and general native coercion are not claimed by these witnesses.

## Boundary AST and correction projection

`MoveWidgetInfo.sNQv` **100704659** clears its scratch scope, calls `ExprFunctions.RS57` **100706255**, which uses `QS5P` **100706254** to recursively flatten **both AND1 and OR2** left-to-right. Each comparison contributes `valueVarN`; the first comparison on each axis also captures its original directional expression as `direcValN`. Non-binary leaves are skipped by this helper; that is not permission to drop them from an accepted imported condition.

`MoveWidgetInfo.DNQQ` **100704660** builds these typed corrections:

| Native operator | Correction |
|---|---|
| `>` (5) | `max(current, limit + 1)` |
| `<` (6) | `min(current, limit - 1)` |
| `>=` (7) | `max(current, limit)` |
| `<=` (8) | `min(current, limit)` |

Left/right contribute to `xSto`, top/bottom to `ySto`. Right subtracts `Target.width` from both its initial direction seed and its limit; bottom similarly subtracts height. Absent axes stay null. An unrecognized comparison returns null in this helper and must not be invented as a supported clamp.

The generator emits the original `boundaryExpr` **separately** from `boundaryStos` and `boundaryScope` (writer100694549). `action.js:976–1034` evaluates the original boolean expression first and uses the STO correction **only when false**. Its final relative/absolute conversion also depends on the native move queue, layer/fixed-position coordinates and move mode; the typed projection alone is not the final owner position.

The gate matters numerically: real `top > 0` at candidate `0.5` passes and stays `0.5`; blindly running `max(0.5, 1)` would be wrong. At candidate `0`, the condition fails and projection gives `1`. The two real strict top boundaries are infos `8e887b58ddc243eebb242d0221ceeed8` and `987245fe6cbb4ebba4e13cf7e83ec813`; their exact left text is `[[This.y - (This.y - Target.y)]]`.

The other ten boundaries are paired left/right AND conditions, using `[[Target.left + DragX]]` / `[[Target.right + DragX]]`. Limits refer to Track, maxThumb, minThumb or minRange. Two use Track's endpoints minus/plus10. No real OR boundary occurs, but the native helper's OR flattening is proven; a future implementation must retain the boolean tree rather than quietly change it into AND.

## Minimal safe product contract

Proposed independent saved data, not native object serialization:

```ts
type MotionExpression = {
  text: string;
  bindings?: Record<string, { kind: 'widget'; targetId: string }>;
};
type MotionBoundary =
  | { kind: 'and' | 'or'; left: MotionBoundary; right: MotionBoundary }
  | {
      kind: 'compare'; operator: '>' | '<' | '>=' | '<=';
      direction: 'left' | 'right' | 'top' | 'bottom';
      left: MotionExpression; right: MotionExpression;
    };
```

Keep each action's ordered `targets[]` and each target's own expressions/options. The boundary can compile deterministically to a small internal numeric AST at runtime; storing native executable JS/STOs is unnecessary. Retain its full left expression and direction metadata, original logical tree and order. Bounds can refer to arbitrary proven local widgets, not only one track.

The required observed arithmetic is unary sign, `+ - * /`, parentheses, geometry property reads and finite numeric `.toFixed(0)` for the SetText siblings. Geometry properties supported by the established native widget-info path are x/y/width/height/left/right/top/bottom; these cases use all except top. Window currently needs height, but the provider also proves width. Do not expose arbitrary property traversal or function invocation.

Admission must validate reference tags, exact package-local target identity, scope structure, duplicate/case-fold conflicts, identifier back-references, zero repeater scopes, and complete imported dependencies. `TargetOverride=true`, nonlocal paths, missing widgets, arbitrary local FCalls, reserved/global collisions and unknown expressions remain attributable failures until separately supported. Case folding is only evidenced safely here for ASCII names; no claim about all culture-sensitive Unicode identifiers. Global names can shadow built-ins in native code, so a conversion must preserve that precedence or reject a collision, not normalize it away.

This is the complete contract needed by the witnessed cases, not a claim that every case can already run. Product bounds/finite-number policy are independent limits; no original UI limit is inferred.

## Six real Move + Size cases

All are Form `OnDrag`273 on DynamicPanel owners, unconditional, and all owners remain omitted by the frozen full import with the same existing fit-child diagnostic: “适应内容的子元件含未知阴影或自动文字尺寸，边界尚不可靠。” Four also reference an omitted opposite-thumb panel through their bindings.

| Package / case ID | Ordered actions | Remaining dependencies beyond the carrier |
|---|---|---|
| `ea34298060ce43b1beefe6300b0348f4` / `6f98c72bc9b3498d991b2e7eda8a706d` | DragX This → Size range → SetWidgetRichText min label → DragX range | Native drag/event timing, complete boundaries, maxThumb/track bindings, `.toFixed(0)`, omitted owner/opposite thumb. |
| same package / `603f5e30d37f45a1aa753771c322a2c8` | DragX This → Size range → SetWidgetRichText max label | Same; minThumb binding instead of maxThumb. |
| `e75bf1b9234d40d9bb3c2f8a4ece4689` / `ce3dd3ca033b4bd98c0f5716d09a52b9` | DragX This → Size filled track → Move label | Track binding, This/Target geometry, strict `top > 0` correction, drag event and omitted owner. |
| `9f2226d0f29c47a8b104b1293e29b97d` / `05b85141a83a4ddab1432f61419dba16` | DragX This → Size range → SetWidgetRichText min label → DragX range | Same dependencies as first case; distinct raw IDs retained. |
| same package / `2be51c3eaa9847e9a4e35fb2f5aa87f6` | DragX This → Size range → SetWidgetRichText max label | Same dependencies as second case. |
| `c356742c685a47b0b1a9b4abc4dd2ad8` / `87224fb2ff074e2d877fbde171dfa0a9` | DragX This → Size filled track → Move label | Same dependencies as third case. |

The complete ordered native IDs and scoped expressions are in the checklist; nothing is replaced by a fabricated action. The four range-label expressions are `[[ ((this.left - track.left) / (track.width - this.width) * 1000).toFixed(0) ]]`, and the setter's third literal is native Boolean `True` (plain setter). Two separate OnMove275 cases use the analogous factor100 expression followed by Size; these are **not** part of the six mixed Move+Size cases.

A deliberately labelled **synthetic diagnostic isolation** removes only transform nodes from an in-memory tree clone and changes the inspected event code to Click, retaining original conditions and sibling payloads. This is not native event recovery. It exposes additional blockers otherwise hidden behind the first Move/Size error:

- 10 cases still reject active Fade easing: 8 Form focus/blur and 2 Quick Win Select.
- 6 still reject SetWidgetRichText: the 4 mixed range cases plus 2 OnMove+Size cases.
- 2 Starter Load cases still reject SetPanelOrder.
- Starter's page OnResize321 Size uses `[[Window.height-Target.y]]`, but its target panel is independently omitted for fixed/percentage layout. The page itself is present. Replacing Window.height with page.height would neither solve that target nor preserve behavior.

No new event/owner/target gate is relaxed by this evidence.

## Validation, reproduction and limits

**299/299 checks**: 8 source/structure checks; 96 CIL-boundary checks (36 controlled cases plus 12 real ASTs ×5 controlled contexts); 195 independent typed-grammar checks (186 real expressions plus9 validation/lifetime checks). The frozen previous-release product grammar accepts123 and rejects63 of those186 under the same controlled inputs; this is a grammar feasibility count, not imported events or native runtime success.

Run only these new scripts, in order:

```text
node research/runtime-transform-bindings-case-census.mjs
node research/runtime-transform-bindings-expression-probe.mjs
node research/runtime-transform-bindings-boundary-probe.mjs
node research/runtime-transform-bindings-report.mjs
```

The final evidence JSON and manifest bind DLL, shipped JS, retained CIL, immutable source samples, current-reader baseline, immutable pre-transform expression source and all new files by SHA256. The native StringLiteral parser's full internal grammar, general coercion/object branches, drag/queue ordering, fit measurement, fixed-position panels and real GUI output are not validated by the research evaluator. They remain explicit implementation or verification work; preserving their raw carriers does not claim parity.

Source-stability note: the first final-report pass detected the concurrent parent change to `src/runtime/expressions.ts` (old `976ecdd306aedb50e29dde60dc274d84e75433cd7379ffd7a8f55b0d0edf10cc`, observed new `8ced8724a1e48ca0e93c6cc84ce94739063dd05ca0e8b3fc0ee1538d4f4eaa88`) and stopped. The grammar comparison was then explicitly rebound to the identical old source in `.build/before-runtime-transform/src/runtime/expressions.ts`; it does not assess the in-progress new runtime.
