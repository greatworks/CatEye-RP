# Special transform integration — independent initial findings

One actionable discrepancy was found after the ordinary bounded comparisons passed.

## RTS-INTEGRATION-01 — This Item on a page event throws instead of continuing

Current `export-runtime.ts`, SHA `8d8f318ebab90d39c67428037879516362e45072e2b33fd5e4c138f7c3d348ca`, requires a widget object in the `thisItem` resize branch. A supported Page Loaded interaction containing `Resize(thisItem, "120", "35")` followed by `SetVariable(Log, "continued")` throws `Resize thisItem requires a widget event source`. The following action does not run. Both module and serialized factories reproduce it.

The retained source action handler (`action.js:1258–1284`) asks for the parent repeater and item size, evaluates dimensions with Target omitted, then invokes `setItemSize`. With no parent repeater, `getItemSize` and `setItemSize` return false. Property reads on the false size carrier yield undefined; literal dimensions still evaluate and the handler dispatches the next action. Original `doc.js:660–672` parent lookup executes against an empty controlled index in the stronger probe, rather than being only a geometry facade. This is an exact consumer probe, not proof of native authoring UI availability or a generated Page Loaded event.

The safe implementation requirement is to evaluate literal/local/window expressions and no-op outside an item without manufacturing a widget for This or Target. Expression safety failures must remain errors. Preserve downstream actions.

Red evidence:

- `runtime-transform-special-integration-review-page-scope.json`: first module/serialized failures.
- `runtime-transform-special-integration-review-page-scope-source-parent.json`: same failures with actual retained parent lookup.
- Corresponding probe scripts and first-script snapshot bind exact hashes.

## Other bounded checks

- Existing special+consumer tests: **52/52**, including eight original arc trajectories in module and serialized modes at identical sample fractions.
- Independent comparison with frozen original special-consumer outputs: **48/48** after normal runtime startup. Covers signed inferred/explicit compression, equal sizes, strict interval edges, and unwrapped/wrapped thisItem geometry and ItemResize counts.
- The first independent run was **34/48** because its row fixtures omitted `runtime.start()`. The host performs that startup before user actions; it was added without changing product code. The failed script/output remain preserved and are not attributed to a product defect.

No browser, product change, or old evidence rewrite occurred. No new claims are made about native Layer, fixed positioning, independently sized panel states, parent fitting, live simultaneous tween interference or generated-page timing.
