# Layer author/model integration: independent read-only review

This review covers the current independent product implementation. It did not execute Axure's DLL, original application, a browser suite, or the desktop package. Frozen native-format evidence and admission audits were not changed.

## Result

**Final independent review: 9/9 passed; zero unresolved confirmed product defects.** The confirmed display defect below was fixed by the authoring agent in App/WidgetView and independently rechecked. This reviewer changed only new review artifacts, not product source or existing tests.

## Confirmed and resolved finding

**LAYER-AUTHOR-001 — adaptive rich formatting is lost while a group is closed.**

A text member has an explicit rich run `{fontSize:14,color:"#000000"}`. Its named view declares `{style:{fontSize:32,color:"#ff0000"}}`. `resolveAdaptiveWidgets` correctly resolves the member's widget style. The closed Layer branch in `WidgetView` nevertheless passes the original rich runs to its descendant `WidgetContent`, which only projects interaction effects. The DOM's outer text widget has `font-size:32px;color:#ff0000`, but its leaf run still has `font-size:14px;color:#000000`. Entering the group invokes App's current-canvas adaptive run projection and changes the same run to 32px/red.

The first run is preserved in `native-layers-authoring-review-red.json`. A second, source-stable run includes the complete compared HTML in `native-layers-authoring-review-red-detail.json`: **8 passed / 1 failed**. Thirteen reviewed source files were retained byte-for-byte under `.build/native-layers-authoring-review-red-source/`, with their original hashes.

The fix provides `WidgetContent.resolveChildDisplay` from App's actual `resolveCanvasDisplay` closure. Recursive children receive only their explicit adaptive/interaction run projection and are marked already resolved. Group, panel, repeater, table, menu and tree branches propagate the resolver; specialized cell/label authoring resolvers retain priority. Canvas drag and double-click consume source widgets instead of projected display copies.

The green probe extracts the actual pure App function, strips its TypeScript annotations and supplies its normal lexical dependencies. It does not implement a replacement resolver or run the full App. `native-layers-authoring-review-green-final.json` records **9 passed / 0 failed**, source-stable throughout. It preserves the exact 32px/red expectation, additionally checks a color-only override leaves an explicit 14px run intact despite a 40px Base font default, and verifies the display call does not mutate the document.

The earlier `native-layers-authoring-review-green.json` also passed all nine checks. The parent then changed the new browser test while final source hashes were being checked; neither reviewed product file changed. The earlier green remains intact, and the final run binds the new test source hash instead of silently updating the earlier record.

While strengthening the independent clone case with a document round-trip, the review's synthetic motion record needed the current valid `delta`/`straight`/`kind:widget` fields and a lowercase alias. The intermediate fixture-validation failure is retained separately; it was not a product defect. The corrected strict fixture still reproduced only LAYER-AUTHOR-001 before the product fix.

## Independently checked behavior

The probe calls the real TypeScript model and React component through a Vite SSR module loader with no listening server, no filesystem watcher and no product build. Each test uses literal expected results rather than a second copy of the implementation.

1. Editor bounds union negative coordinates from actual members, including hidden/unplaced members, and exclude shadows and nested Layer degrees.
2. Cloning nested Layers offsets each shared-coordinate member once; Panel state and Repeater template local coordinates are unchanged.
3. Group/ungroup in a child adaptive view preserves Base member values, parent/child explicit declarations and other views.
4. Affect All Views grouping remains structural and retains unchanged member declarations.
5. Deleting a nested group prunes active and inactive shared-set maps while retaining unrelated entries.
6. Clone remapping preserves relationships among legacy group IDs, inline links, actions, submit targets and local motion-expression bindings.
7. Component definition child deletion reaches linked instances inside groups and prunes deleted children's inactive declarations.
8. Rich Repeater row text passes through two nested Layers and is interpolated exactly once.
9. Closed/open group adaptive rich formatting now matches; explicit partial declarations preserve unrelated run formatting and do not mutate source content.

## Static integration review

- `widget-structure.ts` recurses across Layer edges in a shared diagram coordinate space. Its translation stops at ordinary widgets, so Panel/Repeater inner coordinate scopes are not rebased.
- `layer-geometry.ts` derives editor bounds separately from the original runtime's filtered/effect-aware bounds.
- `document.ts` validates independent ownership and recursively remaps IDs. Layer grouping's contiguous stacking policy is explicitly an independent editor convention.
- `adaptive.ts` skips Layer frame declarations, derives the effective frame from members and preserves the shared structure. `commitAdaptivePage` handles inactive-map pruning after deletion.
- `components.ts` normalizes Layer members together when creating a definition and recursively refits parent groups after linked-instance synchronization.
- App enters/exits Layer scopes using the ownership path and uses the closest Panel/Repeater as the canvas coordinate boundary. Layer move uses member translation; author resize/rotation controls are intentionally unavailable.
- Inspector presents derived read-only width/height, propagation, hidden/disabled/locked/selected state. Layer outline recursion exposes member selection.

## Boundaries

This is a focused source review and nine independent model/SSR checks, not a substitute for the parent's complete tests or pixel/desktop verification. No claim is made that group stacking, editor resize/rotation, pins or all native grouping operations are fully reconstructed. Runtime Layer behavior has a separate frozen review. The probe does not directly exercise mouse selection, drag history, locked ancestor outline navigation or actual browser font metrics.

Source hashes and source stability are recorded in the JSON evidence. The red source/outputs remain immutable. This review's final App and WidgetView hashes are respectively `1d84911a294c11838eb418bd96796caaed4f2a28a0d87b61beedcfe11b3e9baf` and `464de9281fc032a849397c648649b13d490909df849ace72a075a75a2c5a6b67`. The new real-browser regression is source-reviewed here; its execution belongs to the parent's candidate validation.
