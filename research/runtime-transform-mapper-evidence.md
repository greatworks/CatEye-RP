# Native Move / Set Size mapping

The mapper now consumes the frozen native-reader protocol without flattening ordered target arrays, dropping bindings, or replacing boundary trees with rectangular clamps. The only product file changed in this scope is `src/model/import-rp.ts`; `tests/import-rp-transform.test.ts` is new. The native reader remains frozen at SHA256 `9cad13789fe618def273457f1f61584489ef2d0818224cdd0bd1f3cd7285290b`.

## Mapping and atomicity

Each `{kind:'widget',sourceId}` resolves only through the current package's admitted, unambiguous widget map and becomes `{kind:'widget',id}`. Each local `{kind:'widget',targetSourceId}` becomes a product `targetId` under its original canonical alias. `{kind:'this'}` remains a context target, but its actual source owner must be an admitted ordinary widget. Duplicate targets and all per-target options remain in source order. Full AND/OR/compare boundary structure and both expression operands are retained.

Every action, entry, target, expression, binding and boundary record is revalidated for its exact field set. The shared `parseMoveActionSpec`, `parseResizeActionSpec`, and `parseMotionExpression` perform final model validation. A separate syntax-only validator limits native expressions to the proven numeric/StringLiteral path: exact finite numeric text, or a whole arithmetic expression using the established geometry getters and scalar `.toFixed`. It does not evaluate geometry during import. The fact that the general product evaluator supports more syntax does not admit that syntax from native files.

Native local/global lookup precedence cannot be discarded. An unknown global-variable collection or a case-insensitive global collision with any used builtin/local alias rejects the event. Unused declared bindings remain in the saved expression and must also resolve completely. Pure numeric inputs need no variable lookup and can remain recoverable without a known global collection.

Move permits the evidenced ordinary shape/image/panel model types: box, ellipse, path, text, line, image, panel. Set Size uses the separate whitelist without legacy line. Table/menu/tree/repeater roots and their contained descendants/rows are not admitted merely because a label looks like an ordinary text/box widget. Normal PanelState packages retain their own unambiguous local scope. This in a Page or rich hyperlink is not guessed. Cross-package same-ID objects never substitute for a missing target.

This stage admits Move `location` and `delta` under the existing native event gates. Other reader-decoded modes, DragX/DragY providers, special target selectors (`thisItem`, widgets below/right), row/repeater paths, parent-relative scopes and unsupported native events remain rejected until their complete event/context path is established. Window width/height text is retained as viewport input, not rewritten to page dimensions. Set Size has no invented relative mode.

All cases/actions/conditions/dependencies are converted before an event is appended. One failure in a late target, unused binding, boundary operand, sibling or case drops the entire event. Existing fit-to-content, owner, state/group and dependency-pruning gates were not loosened. No original DLL or GUI was executed.

## Real result

The new audit reads all 11 immutable native files, imports them, and runs strict serialize/parse roundtrips. Ten files remain admitted and the same Icons file remains rejected. After removing only the six newly added interactions, **every prior admitted document compares exactly to the frozen preceding-release document**. No widget, geometry, style, existing interaction or variable is changed.

`Sample form patterns.rplib` gains **6 complete Accordion Click events**, containing **18 Move actions plus 12 already-understood sibling actions** (Set Selected / Set Panel State). The two native page packages are `2b1ee0efd7d948d686f25e855681301c` and `b3e7e9d52abc4ff08e65a0f16e143f53`. Full page names, owner IDs, action order, local bindings and final product targets are in `runtime-transform-mapper-audit.json.added`.

The reader's other four newly decoded slider-endpoint Click events still fail final target dependencies, because their target thumb panels were not imported. **No Set Size or boundary-bearing source event is newly admitted, and none of the six mixed Move/Size cases is claimed recovered.** Synthetic tests verify those data structures without pretending that missing real event/sibling/owner semantics disappeared.

The maximum compact semantic result is **28,794,231 bytes**, below the existing **32 MiB desktop worker cap**. All 11 original file SHA256 values are checked before and after the audit. The mapper audit binds every loaded model module; if the parent later changes a shared dependency, refresh this audit and its manifest rather than silently retaining stale hashes.

## Verification and first failures

The first red run contained 41 tests: 36 passed and 5 failed. Four failures were the expected absent Move/Resize mappings; the fifth was a test fixture mistake: Basics contains one Page and several PanelState packages, not a second Page. The test now puts the same native ID in an actual other package to prove package isolation. The first implementation run was 40/41 with only that fixture failure. Both logs/JSON remain preserved.

Final focused verification is **87/87**: 43 new mapper tests, plus 44 existing Rotate and native interaction tests. Typecheck passes. No existing test was changed. Tests cover complete scope mapping, ordered duplicates, mixed boundaries, save/open, scalar formatting, global conflicts, unknown globals/getters/JS, unresolved and cross-package targets, unknown siblings, unsupported context modes and whole-event rejection. The full corpus audit has five passing invariants and exact prior-document comparison.

Reproduce only the scoped checks:

```text
npx vitest run tests/import-rp-transform.test.ts tests/import-rp-rotate.test.ts tests/import-rp-interactions.test.ts
npx tsc --noEmit --pretty false
node research/runtime-transform-mapper-audit.mjs
node research/runtime-transform-mapper-report.mjs
```

No full repository suite, build, browser or package verification was performed here. Source-bound contracts are in the frozen `runtime-transform-format-*`, `runtime-transform-bindings-*`, and `runtime-transform-import-*` evidence. This implementation does not claim the full native compiler, special scopes, full transform import, or GUI parity.
