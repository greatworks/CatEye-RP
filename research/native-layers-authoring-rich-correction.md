# Layer descendant rich-text display correction

This corrects an authoring display defect found after the first native-layers candidate. It does not change the document model, native import, runtime engine or the already frozen runtime implementation report.

## Preserved failure

`native-layers-authoring-review-red-detail.json` records the independent React server-rendering failure: a child's explicit 14px black run remained unchanged while its closed Layer wrapper inherited a named-view 32px red declaration. Entering that Layer used App's direct-widget projection and correctly rendered 32px red. Both states read the same saved document.

Before editing, the actual source bytes were copied to `.build/native-layers-before-authoring-rich-fix/src/App.tsx` and `src/components/WidgetView.tsx` under that backup directory. The original review and the first candidate reports remain unchanged.

## Correction

App's existing direct-widget display projection is now `resolveCanvasDisplay`. It combines only the child's explicit adaptive style declaration and its applicable interaction/effect patch, then applies those text properties to that child's rich runs. It never replaces rich-run formatting with the complete default `widget.style`.

The authoring canvas supplies `WidgetContent.resolveChildDisplay`. Closed Layer, panel and repeater rendering carries this display-only resolver into descendants. Table/menu cells and tree labels also receive it, while their existing specialized authoring resolvers take precedence. A projected child is marked resolved so its effect patch is not applied a second time.

The resolver does not expand expressions. Existing row substitution still occurs at the text leaf, once. Source widgets remain the editing data, and pointer/double-click handlers receive the source widget rather than a display copy. No rendered rich-text projection is written to the document or drag snapshot.

## Verification

- The preserved independent SSR failure is the red evidence; this is not an original Axure GUI comparison.
- TypeScript passes after the correction.
- Four relevant unit files pass 49/49: rich-text React rendering, rich-text model operations, selection model and native Layer model.
- The independent final SSR review passes 9/9. It extracts App's actual `resolveCanvasDisplay` function body and verifies the fixed explicit declaration, a color-only patch, source immutability and single row interpolation. Its final record is `native-layers-authoring-review-green-final.json`.
- `tests/e2e/native-layers-rich-display.spec.ts` adds one actual authoring flow. It covers nested closed/entered/exited Layers, a color-only declaration preserving a 17px run against a 40px default, untouched run italic/weight, panel descendants, nested repeater row substitution, save equality, drag/Undo without formatting contamination and Preview.
- Browser discovery finds the new test. The first development-browser attempt rejected the synthetic fixture because its rows included `Next` but the column declaration omitted it. The original test bytes remain in `.build/native-layers-rich-display-first.spec.ts`; adding the declared column corrects the fixture without changing assertions.
- The next development-browser attempt timed out in `page.goto` before any behavioral assertion. Its trace records unfinished local module requests; this does not establish a product rendering failure. Browser attempts and their results are bound separately by the correction JSON. Discovery and SSR results do not claim a production-browser pass.

The separate correction JSON binds the before/after source bytes and focused evidence. The four frozen runtime sources are unchanged. Final production-browser and release results remain owned by the parent stage verification.
