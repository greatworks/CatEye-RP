# Rotation authoring audit and direct-manipulation corrections

Scope: current reconstruction source, two new browser regressions, and focused existing tests. This is not an original Axure GUI capture or a claim about native P50/P1401 matrix decoding. No original application was launched, no native parser/importer was changed, and no full suite or package was run by this subtask.

## Existing implementation and boundaries

- `src/model/types.ts` stores one finite scalar `Widget.rotation`; `document.ts` accepts it, and adaptive overrides and component wrappers preserve it. The native matrix/pivot contract is owned by the parent investigation. There is no runtime Rotate action in the current `ActionType` union.
- `src/components/WidgetView.tsx::widgetStyle` uses CSS `rotate(angle)` on the widget wrapper. Ordinary shapes, line SVGs, vector fill/stroke layers, text, images and form controls rotate together about the wrapper's default center. No descendant font or image-specific angle is stored. Nested wrappers compose through CSS transforms.
- `src/components/Preview.tsx` uses that same style function. `src/runtime/export-runtime.ts::mountOfflinePrototype` independently writes the same wrapper rotation. `src/runtime/frame-player.ts` invokes this portable renderer for internal-page frames rather than introducing a separate transform algorithm. These paths were read; this audit did not establish complete original-browser pixel equivalence for every widget/parent combination.
- Panel/repeater edit scope is an isolated local canvas (`App.tsx` resolves `panelPath` to the active state's widgets/template). Ancestor rotation is therefore not applied again when dragging a child in that scope. Runtime preview returns children to their nested DOM hierarchy.
- Direct vector anchor editing already inverse-rotates pointer coordinates through `canvasToVectorPoint`; table track resizing already projects pointer displacement onto its rotated axes. The existing nested/adaptive vector and rotated table browser checks were retained and rerun.
- Runtime fit-to-content uses the rotated child's bounding-box right/bottom extents. Expression geometry remains local unrotated layout values, as documented in the existing widget-geometry tests. Native P50/P1401 semantics must not be inferred solely from these current product conventions.

## Confirmed defects before the correction

1. **Rotated resize handles used screen axes as local axes.** At 150% zoom, dragging a 90-degree box's visible east handle downward by 60 screen pixels left its width at 200 instead of 240. The saved bounds remained `x160/y160/w200/h60`; correct center-origin manipulation with the opposite edge fixed gives `x140/y180/w240/h60`. `App.tsx::pointerMove` added screen dx directly to width despite the handle being rotated.
2. **Marquee selection used the unrotated layout rectangle.** A box with layout `x160/y160/w200/h60/rotation90` visibly occupies `x230..290/y90..290`. Dragging a marquee across `x150..200/y170..200` selected it even though the region was empty. The converse rotated-only region was missed by the old layout-box predicate.

Both new tests were run against unchanged production source first and failed for those expected reasons. Preserve `.build/rotation-authoring-before.log` and `test-results/rotation-authoring-before/` (saved JSON, screenshots, traces); do not interpret earlier unrelated green suites as covering these cases.

## Correction and shared API

`src/model/rotation-geometry.ts` exports:

- `RotatableBounds` and `RectangleBounds`.
- `resizeRotatedBounds(bounds, handle, delta, minimum?)`: delta is already divided by zoom; inverse-rotate it into local axes, preserve integer dimension rounding and the current minimum-size policy, then retain the opposite world corner/edge midpoint.
- `anchorRotatedResize(bounds, handle, width, height)`: reposition using the final size after table/menu helpers normalize tracks or padding.
- `rotatedBoundsIntersect(bounds, marquee)`: separating-axis intersection between the rotated layout rectangle and the axis-aligned marquee. An outer AABB alone would still select empty corners at oblique angles.

`App.tsx` now uses those helpers only in the existing resize and marquee branches. Snap-to-grid still processes unzoomed screen displacement before the resize projection; Shift movement and ordinary movement branches are unchanged. The dimension actually controlled by a handle retains integer rounding and the existing minimum; the untouched dimension is retained exactly, including values below that minimum and fractional native sizes. No schema or serialized-document field was added. Selection is still against the widget's transformed layout rectangle, not an alpha-mask/individual vector-contour hit test.

These direct-manipulation rules repair the reconstruction's internally inconsistent handles; they are not represented as a measured native editor gesture algorithm. Native matrix/pivot data and full runtime Rotate actions remain separate scope.

## Validation

- `npm test -- tests/rotation-authoring.test.ts`: **55 passed**. Includes eight handles at six angles, independent world-coordinate opposite-anchor invariants, explicit 90-degree expected geometry, minimum-size anchoring, normalized container dimensions, nonrotated compatibility, rotated-only intersections and oblique AABB false positives.
- `npm run typecheck`: exit 0.
- Before: `npx playwright test tests/e2e/rotation-authoring.spec.ts --output test-results/rotation-authoring-before --reporter=list`: **2 expected defect reproductions failed**.
- After: `npx playwright test tests/e2e/rotation-authoring.spec.ts tests/e2e/table-authoring.spec.ts:47 tests/e2e/vector-editing.spec.ts:246 --output test-results/rotation-authoring-after --reporter=list`: **4 passed, 22.1 seconds**, process exit 0. The two new assertions were not weakened. Existing table cancellation/history and nested/adaptive vector save/reopen/preview/offline checks remained intact.

The new handle workflow verifies a 150% zoom gesture, saved bounds, unchanged opposite screen edge, and one-step Undo/Redo. The marquee workflow verifies both the empty old-layout region and actual rotated region. Frame/source matrix tests and package smoke are parent-owned; not claimed as run here. File hashes and logs are in `rotation-authoring-audit.json`.

## Follow-up: preserve the untouched native dimension

Parent review identified a relevant inherited defect in the first correction: real native candidates include heights 6 and 7, and width `73.99934480684509`. The old/general resize code and the first helper both clamped/rounded both dimensions, even for a one-axis handle. App also rounded both results a second time.

Added 12 explicit regression cases before the follow-up fix: E/W preserve each of heights 6 and 7; N/S preserve width `73.99934480684509`; each is checked at 0 and 37 degrees. **All 12 failed before the fix** (height became 8; width became 74), with the preceding 55 cases skipped in this focused reproduction. Evidence: `.build/rotation-authoring-untouched-before.log`.

The helper now clamps/rounds only axes actually controlled by the handle. App uses those determined dimensions without another blanket rounding operation. Table/menu still use their own track/padding normalization helpers and final-size anchoring. All **67 geometry tests pass**, and typecheck exits 0. The original two authoring browser regressions are rerun separately; their terminal result and log hash are recorded in `rotation-authoring-audit.json`. Previous before/after logs remain untouched.
