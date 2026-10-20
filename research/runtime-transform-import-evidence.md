# Native Move / Set Size interaction reader

This change extends only `research/scripts/read-rp-interactions.mjs`. It does not change the product importer, document schema, evaluator, renderer, event eligibility, or original samples. Native DLL methods and the original GUI were not executed.

## Contract

Each native action remains one action with an ordered `targets` array. Repeated targets remain repeated. Widget identities are native GUIDs scoped to the containing package; they are **not** product widget IDs.

```js
{
  sourceId: nativeActionId,
  type: 'move',
  move: { targets: [{
    target: { kind: 'widget', sourceId: nativeWidgetId }, // or {kind:'this'}
    mode: 'location',
    x: { text: '[[Track.left]]', bindings: {
      track: { kind: 'widget', targetSourceId: nativeTrackId }
    } },
    y: { text: '[[Target.y]]' },
    trajectory: 'straight', easing: 'none', duration: 500,
    boundary: {
      kind: 'compare', operator: '>=', direction: 'left',
      left: { text: '[[Target.left + DragX]]' },
      right: { text: '[[Track.left]]', bindings: {
        track: { kind: 'widget', targetSourceId: nativeTrackId }
      } }
    }
  }] }
}
```

The example combines independently proven fields to show the protocol; it is **not** claimed to be one recovered source event. Complete actual outputs, with file/package/owner/action identities, are in `runtime-transform-import-reader-audit.json` under `changes`. The `isolatedActions` array contains all 55 unchanged actual action carriers placed in an explicitly synthetic Click/case for diagnosis.

Set Size uses `type:'resize', resize:{targets:[{target,width:MotionExpression,height:MotionExpression,anchor,easing,duration}]}`. Boundary junctions retain `{kind:'and'|'or',left,right}` recursively; each leaf retains both expressions, direction, and `>`, `<`, `>=`, or `<=`. The reader does not turn conditions into unconditional clamps, fabricate generated STO variable names, or evaluate expressions.

`StringLiteral.value` is retained exactly, including whitespace/case. Local aliases are ASCII case-folded as in the native generator. Their values must be `GetWidget(one DiagramObjectPathLiteral)` resolving to a local ordinary widget path. Repeater/RDO paths, dummy paths, unknown calls, repeated aliases after folding, reserved aliases, malformed variable identities/backreferences, and TargetOverride are rejected. Every serialized builtin variable identity must match the corresponding occurrence in the admitted text grammar. `This` is an event-source widget context; Page and Hyperlink `This` are not guessed. `Target` remains the current item in the ordered target array.

The admitted text grammar is finite numeric text, or one complete `[[...]]` expression using numeric literals, parentheses, unary signs, `+ - * /`, the witnessed geometry getters (`x,y,width,height,left,right,top,bottom`), `This`, `Target`, `Window.width/height`, `DragX/DragY`, explicit local bindings, and scalar `.toFixed(0..100)`. This bounded validator does not claim to implement the full native parser. It never executes source code. In particular, primitive native StringLiteral replacement produces text; no whole-expression numeric-return inference is introduced here. Product-global-variable precedence/collisions and final binding/target admission remain importer/evaluator responsibilities.

All nine Move modes, three trajectories and 33 easing literals retain the source enum mapping proven in the prior format evidence. Set Size has no invented By/To mode. Nine canonical anchor strings are bounded by the established shared contract. Duration `0..60000` and collection/depth limits are product safety bounds, not claims about original UI limits. Move's native None-easing generator omits runtime duration/trajectory options: the reader retains the stored declaration, and downstream runtime must retain that synchronous/straight behavior. Set Size's writer emits its options even for None.

## Source basis

The frozen `runtime-transform-format-evidence.md/.json` and `runtime-transform-bindings-evidence.md/.json` bind Axure RP 11.0.0.4150 DLL SHA256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`, raw samples, and exact static CIL/literal evidence. Relevant source tokens:

- MoveWidgetInfo writer/reader `100704662/100704663`; constructor `100704634`; generator `100694547/100694548`; ordered action writer `100694360`.
- SetWidgetSizeInfo writer/reader `100705598/100705599`; constructor `100705580`; generator `100694570`; ordered action writer `100694366`.
- Native boundary traversal `RS57/QS5P 100706255/100706254`, construction `sNQv/DNQQ 100704659/100704660`. Original boolean AST evaluation precedes correction; strict comparisons retain their +/-1 rule only when correction is needed.
- Native ActualPathInfoMap `100704726`, `YNAg 100704767`, `QN8Q 100703076` establish local-path/This resolution. They do not justify flattening grouped/repeater paths or inventing special-target GUIDs.

No new version-wide compatibility claim is made. Recovery requires exact known carrier types, field sets, reference tags and value domains. Unknown fields or siblings remain whole-event failures.

## Real corpus result

Fresh decoding of all 11 immutable samples inspects 1,841 owners. All 137 previously supported events remain JSON-equivalent. Exactly **10 Click events gain complete reader support, containing 22 Move actions**; all are in `Sample form patterns.rplib` (SHA256 `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`). Six accordion events contain 18 Move actions; four slider endpoint events contain one each. Product dependency checks may still reject a decoded event whose target widget was omitted; this report does not claim 10 newly imported events.

Four other event diagnostics now reach the subsequent unsupported sibling instead of stopping at Move. No previous supported event is lost. There are **zero newly complete Set Size events**, **zero newly complete boundary-bearing events**, and **zero recovered mixed Move/Size cases** in this reader audit. The 12 boundary carriers and all 6 mixed cases retain their source context and limitations. OnDrag273, OnMove275 and PageOnResize321 remain unsupported. Fade animation, SetWidgetRichText and SetPanelOrder siblings are not silently removed.

The additional isolation check decodes all **55 actual action carriers / 63 per-target records / 126 motion inputs / 12 boundaries**, with original action/info/expression/path bytes represented unchanged in memory. Only a synthetic Click/case replaces their owner tree. This is diagnostic evidence of carrier decoding, not original-event recovery or imported behavior. Actual Move and Size coexist in six cases; the Move+Size+Rotate case in the new unit suite is explicitly synthetic (no real mixed Rotate case was observed).

## Red / green and limits

The first new suite ran before production changes: **44 tests, 36 pass / 8 fail**, retained in `runtime-transform-import-reader-red.tap` (Node's default text reporter despite the suffix). After implementation and additional coverage, the new suite has **51 tests**. New + existing interaction and Rotate suites pass **104/104**, with real TAP in `runtime-transform-import-reader-green.tap`. No existing test expectation was changed.

Reproduce the focused checks only:

```text
node --test --test-reporter=tap research/scripts/read-rp-transform.test.mjs research/scripts/read-rp-interactions.test.mjs research/scripts/read-rp-rotate.test.mjs
node research/runtime-transform-import-audit.mjs
node research/runtime-transform-import-report.mjs
```

No full suite/build/browser/package run was performed in this scope. No original DLL execution or GUI comparison occurred. Native scopes outside the witnessed local GetWidget form, arbitrary expression grammar, special-target sentinels without complete raw proof, unsupported owner/target graphs, drag events, and unsupported same-case siblings remain explicit boundaries. A green reader test does not establish runtime or whole-Axure parity.
