# Native point editing — independent final review

No blocking finding remains in the reviewed scope. This is a read-only source review plus independent model/geometry execution; it is not original Axure GUI verification, a browser test, or package validation. Parent-owned browser and release results remain separate.

The independent Vite `ssrLoadModule` probe passed **407 checks**: 384 contours compared against retained managed-CIL replay points, 18 data-preservation arrangements, 2 actual imported native Shape300 rectangles, and 3 unsupported/custom-identity boundaries. All 14 geometry-evidence source hashes matched. The 12 reviewed production files stayed unchanged during the final probe. Exact hashes and individual cases are in `native-point-editing-final-review-probe.json`; `native-point-editing-final-review.json` binds this review to that result.

## Identity and complete document preservation

`applyAdaptivePointEdit` (`src/model/adaptive.ts:17–28`) resolves the active inherited view for preparation but edits only the matching widget in the complete Base graph. It writes `type: path` only for a box and replaces its shared vectorPath. It does not replace Base with the effective view widget. The ordinary adaptive editor's prohibition on arbitrary type changes remains intact.

The 18 independent arrangements use one **actually imported** Form capsule (`d515a37dfd114af6877e6c6d4d244032`) in synthetic page/panel/repeater placements, Base/Tablet/Phone views, and local/shared view sets. Each compares the entire resulting document against an independently constructed expectation with only the target type/path changed. This verifies Base geometry/style, six legal shape interaction effects, shapeText, text/notes/actions, siblings, other pages, active maps, inactive maps, empty state barriers, and shared view definitions are retained. A Hint effect is form-only under the current schema, so it is not fabricated on this shape. Every result survives strict JSON save/readback. A no-op against the prepared contour returns the same Page object.

The two original UI-library Shape300 rectangles are compared with their previously extracted complete-import widgets, including exact IDs and serialized properties. They remain `path`; their rectangular geometry never promotes them to a parameter box. Converted paths also return their stored contour despite retaining radius/mask fields. This matches the identity distinction supported by native `LN4g`, rather than using rectangular appearance as identity.

## Host and gesture integration checked statically

| Path | Reviewed behavior |
| --- | --- |
| App toolbar and shortcut | `pointEditingUnavailable` and `enterPointEditing` share the reason gate. Entry clears temporary effect preview and opens an editing session without committing a document. |
| Border double-click | `widgetDoubleClick` retrieves the normal adaptive source and performs hit-testing with its prepared edit path, then uses the same entry gate. |
| Numeric Inspector | `WidgetStyleEditor` prepares the same normal path. Unsupported cases show an explanation instead of VectorPathEditor. Focus/pointer entry opens the same session; number fields do not commit unchanged displayed values. |
| Canvas anchors/handles/segments | The memoized `sourcePath` uses the same preparation and reason gate. Drafts are separate; commits compare against this prepared path instead of a potentially stale stored snapshot. Changes to effective source geometry cancel an active gesture. |
| Transient drawing | App point mode suppresses interaction-effect geometry and supplies a temporary `type: path` to WidgetContent. This avoids a second parameter regeneration over the draft. It does not save the temporary type on entry. |
| Commit | Canvas and numeric edits route through `changePointPath`; the early vectorPath branch is current-widget-only, even with multiple selection. It calls the dedicated model command and then `commitAdaptivePage`. |
| Cancel/history | Pointer cancellation/lost capture discard the draft. Escape cancels the point gesture before leaving. A completed changed gesture commits once; conversion and path mutation are one document commit. Existing undo/redo and context-change tool resets remain in place. Browser interaction results are not claimed by this static check. |

Relevant current source anchors: `App.tsx:119–130,145–147,318,425–432,455,468–470`; `CanvasVectorTools.tsx:25–27,40–43,91–108,123–128,139`; `Inspector.tsx:487–533,558–562,584`. The JSON source hashes, rather than these convenience line references, define the reviewed revision.

## Unsupported geometry is blocked, not silently edited

The helper does not derive point-edit geometry for parameter displays with partial borders or legacy independent corner radii. The reason API checks the actual `vectorRectangle` reconstruction path, including legacy hidden-side reconstruction. App, Inspector and Canvas gate these cases, and the dedicated model command rejects them as a final boundary. Thus a reconstructed visible contour cannot be edited through a different saved snapshot. Existing custom paths remain editable because these retained style fields are inert for their identity.

The independent probe verifies both reason codes, model-command rejection without mutation, and a custom path with the same fields remaining unblocked. The 384 expected geometries are constructed directly from pinned replay point/handle records, not by using product path preparation or renderer output as the expected result.

## Explicit limits

- Original point-edit GUI timing, hit-testing, no-op history and cancellation have not been observed. The native evidence uses static CIL and bounded replay; parent browser tests concern the reconstruction.
- The product retains its existing owner bounds and rotation during a point edit. Native `TN46` and the commit path normalize controls and update geometry. Native `RN4I` also sets AutoFitWidth/Height false. The product deliberately preserves shapeText here; this review does not claim these native rebounding or AutoFit side effects are implemented.
- Native `set_Shape` can change the default-style/provider chain. Retaining the reconstruction's already resolved style values is the approved product contract, not proof of every original provider side effect.
- Partial-border and legacy independent-corner parameter preparation remain unavailable. No arbitrary shape family, Shape300-to-box promotion, or unrelated import relaxation was added by this review.
- Product/tests, original files, old frozen research and release artifacts were not changed by this reviewer. The earlier model-only probe's first synthetic fixture incorrectly added form-only hintStyle to a box; the schema correctly rejected it. The fixture was corrected to the six legal shape effects, without changing product behavior.

Native evidence references: `native-point-editing-evidence.md/.json`, `native-point-editing-format-evidence.md/.json`, and the exact source/replay/fixture records bound by the final review JSON.
