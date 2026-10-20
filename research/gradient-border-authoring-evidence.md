# Gradient border authoring: implementation and test boundaries

This stage adds border paint authoring to the existing gradient fill editor. It does not provide captured proof of the original Axure editor gestures. The original GUI capture remains unavailable; native runtime/format evidence belongs to the separate renderer and format reports.

## Editing contract

`FillEditor` and `FillOverrideEditor` retain their exports and existing labels. An internal `PaintEditor` supplies the shared coordinate, color-stop, validation and draft transaction UI. `StrokeEditor` and `StrokeOverrideEditor` are small adapters for `stroke` and `strokeGradient`; they do not copy a separate gradient editor.

Base controls use **Border type**, **Edit Border gradient**, **Border Start X/Y**, **Border End X/Y**, or the radial **Border Center**, **Border Axis 1**, **Border Axis 2** coordinates. Color-stop controls retain explicit ordered offsets and colors, including equal-offset hard transitions, transparency and points outside the widget bounds. Arrow buttons exchange colors between the ordered positions, as the existing Fill editor does. This author gesture is a product convention.

Gradient edits remain local until **Apply Border gradient**, which produces one document change. Cancel, Escape, or changing the page/panel/state/adaptive-view editing context discards the uncommitted draft. Invalid/incomplete coordinates, colors and stop order do not enter the document. Valid solid colors continue to preview immediately while the input retains focus; incomplete or invalid solid drafts remain local, show an error on blur and restore the last valid value on Escape.

The two paint channels are independent. Explicit `stroke` switches only the border to solid, even when the color equals its existing fallback. `strokeGradient` replaces the complete border gradient. Removing a border override deletes both fields and restores inheritance. Fill, shadow, text, opacity and geometry properties remain independent; changing stroke widths or corner radius keeps the border gradient.

The base Inspector, the existing Selected style shortcut, other interaction-style effects and Set style actions use the same controls. Old **Border** and **Selected border** solid text-input labels remain available. The toolbar emits an explicit `stroke` command rather than relying on a value difference, so it cannot accidentally retain an old gradient. Existing table/menu/tree cell/label plumbing receives the same explicit command. Adaptive border resets remain view-local; table cell styles remain shared, following the established model contract.

Image borders carry a visible explanation: linear borders use only the first stop and radial image borders are transparent. This follows the native runtime evidence supplied to this stage. Inline frames and hotspots retain saved gradient data but do not offer unsupported gradients as working controls. Line strokes use their independent support matrix; the Fill exclusion for lines is not reused.

## Focused checks

- `tests/gradient-border-authoring.test.ts`: eight tests for channel independence, equal-color clearing, inheritance, complete geometry preservation, non-paint edits, legacy labels/omission, state/action controls and the independent support matrix.
- `tests/e2e/gradient-border-authoring.spec.ts`: four real browser authoring flows for immediate solid preview, invalid drafts, complete linear/radial editing, stop ordering, undo/redo, save/reopen, Selected/MouseOver/Set style, toolbar/multiple selection, adaptive reset, shared table cells and context changes.
- The existing `tests/gradient-authoring.test.ts`, `tests/selection-model.test.ts`, four Fill authoring browser tests and two interaction-style authoring browser tests are included in the narrow regression batch. Their previous evidence files are not overwritten.

Exact commands, terminal counts, logs and source hashes are recorded in the accompanying `gradient-border-authoring-evidence.json`. These checks cover authoring behavior; they do not substitute for the renderer agent's preview/offline pixel tests or the parent's final production/package checks. No full suite, production build or package was run by this authoring task.
