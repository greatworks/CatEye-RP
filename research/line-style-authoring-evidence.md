# Line-style authoring: evidence, integration and verification

This report belongs to the line-pattern / line-end / visible-border milestone. Previous gradient-border evidence remains unchanged. No original GUI capture, launch, authentication action, or proprietary resource copying was performed for this authoring work.

## Source evidence and limits

The official [Lines reference](https://docs.axure.com/axure-rp/reference/lines/) documents line color, width, pattern and independently chosen ends. It also describes open shapes made with the Pen tool. The [Styling widgets reference](https://docs.axure.com/axure-rp/reference/styling-widgets/) places border controls in the Style pane and toolbar, and describes individual rectangle-side visibility. These text references support the entry points; they do not establish the exact current native chooser layout or bitmap appearance.

The separate native investigation is recorded in `line-style-metadata.json`, `line-style-ends-cil.json`, `line-style-census.json` and `line-style-runtime-evidence.md`. The retained RP11 distribution has SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; its `AxureRP11.dll` is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. The original `style.js` hash is `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c`.

The modern line-pattern enum has nine concrete values. It is distinct from the six-value graphics `AxDashStyle` enum. Modern `Axure.Platform.ArrowStyle` has 29 concrete values, including None=1, plus an Indeterminate sentinel that is not a saved endpoint. The older six-value `RPLineEnding` is not used as the complete chooser. Resource accessors such as `arrow_toolbar_icon`, `arrow_style_12` and `linePattern_0` through `_7` are inventory evidence only; they do not prove the visual order or gestures of the native chooser.

Independent cap/join author fields have not been established. This stage therefore does not invent editable `lineCap` or `lineJoin` properties. Any cap geometry required by a proved pattern/marker belongs to the renderer. Arbitrary dash arrays are not exposed.

## Author contract

- `linePattern` is optional, with omitted meaning solid. The nine values are solid, long-dash, medium-dash, short-dash, dash-dot, dash-dot-dot, long-dash-short-dash, dot and none.
- `lineEnds` is one optional atomic `{start,end}` value. Editing one end retains the effective other end. Omitted means none/none; an explicit none/none pair overrides a lower style layer.
- `borderVisibility` is one optional atomic boolean tuple in top/right/bottom/left order. It is independent of `borderWidths`. Omitted means all visible.
- Changing paint or width does not discard these fields. Removing one effect/action override deletes only that field; explicit solid, none/none and all-visible remain meaningful resets.
- Old documents are not populated with defaults merely by rendering the Inspector.

`LineStyleEditor.tsx` supplies the shared base editor, state/action override editor and compact toolbar. The Inspector routes explicit style commands through its existing callback, preserving equal-value reset intent. App applies geometry capability filtering to each member of a mixed selection, with existing table-cell/menu-item/tree-label paths retaining their shared/base behavior. Discrete selectors and checkboxes commit one change per command; this is the product's authoring convention, not a claim about a captured native dialog.

Stable accessibility labels are `Line pattern`, `Start arrow`, `End arrow`, `Border top visible`, `Border right visible`, `Border bottom visible`, and `Border left visible`. State and action editors prefix these labels with `Selected`, `MouseOver`, or `Action 1`, and expose atomic `Override … line pattern`, `Override … line ends`, and `Override … border visibility` checkboxes. The toolbar entry is `Line style` and its group is `Toolbar line style`.

## Verification status

Focused unit command: `npm test -- tests/line-style-authoring.test.ts tests/gradient-border-authoring.test.ts tests/gradient-authoring.test.ts`.

The initial focused run passes **23/23**: 8 new line-style author tests, 8 existing gradient-border author tests, and 7 existing gradient-fill author tests. The new tests cover the complete enum options, atomic edits, independent removal/reset, mixed geometry filtering, old-data retention, shared Inspector/state/action controls and adaptive reset persistence. An initial fixture incorrectly mutated a shared effective widget; cloning that test fixture corrected the test without a product change.

New real-browser author scenarios are in `tests/e2e/line-style-authoring.spec.ts`: base pattern/ends and undo/save; Selected/MouseOver/Set style inheritance; toolbar multi-selection with adaptive reset and shared cells; side visibility independent of widths/paint.

The combined command `npx playwright test tests/e2e/line-style-authoring.spec.ts tests/e2e/gradient-border-authoring.spec.ts --output test-results/line-style-authoring-focused --reporter=list` initially returned **7 passed / 1 failed**. The failure proved a real App integration error: a line-plus-input mixed selection correctly filtered unsupported arrow fields during the first style merge, but the subsequent existing `patchWidgetTextStyle` call reapplied the unfiltered full patch. The saved input therefore contained the line's endpoint pair. The App correction filters that second application too. No assertion was removed, weakened or replaced.

The exact failed workflow then passed with `npx playwright test tests/e2e/line-style-authoring.spec.ts --grep 'toolbar multi-selection' --output test-results/line-style-authoring-mixed-fix --reporter=list` (**1/1**, test 11.4 seconds). All **8 distinct author workflows** have therefore passed: 4 new and 4 existing gradient-border regressions. Logs are `.build/line-style-authoring-focused.log` and `.build/line-style-authoring-mixed-fix.log`; the first failure retains its actual saved JSON, screenshot and trace.

These browser results establish author editing, inheritance, undo and persistence. They do not establish line-end geometry or native dash pixel parity. No complete suite, production build or package is part of this subtask.

The final author capability gates now call the shared renderer's `supportsPattern`, `supportsSides` and `supportsEnds` methods from `src/model/line-style.ts`. Full widget dimensions are passed through for strict rectangular-vector recognition. A new unit covers a closed rectangular vector, a mixed closed/open compound path, a deformed non-rectangle and a move-only contour. Thus the UI does not use a competing four-point heuristic or incorrectly reject every compound path containing a close command. Unsupported saved fields remain in the document and receive an explanatory notice.

After that helper integration, the final focused unit count is **24/24** (9 new + 15 existing); `.build/line-style-authoring-unit-final.log` and `.build/line-style-authoring-typecheck-final.log` record successful unit/type checks. The prior browser workflows use line and non-vector rectangle geometry, whose capability decisions are unchanged by the helper replacement. Arrowhead previews were not fabricated from symbols while geometry verification was still in progress.
