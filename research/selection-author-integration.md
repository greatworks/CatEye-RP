# Selection control author commands

2026-10-20. Unreleased source stage. Full Axure parity remains false. This stage connects ordinary selection controls' Inspector Size, Fit width, Fit height and Indicator on right commands to the existing author transaction. It does not complete selection authoring, package the application or establish original GUI/pixel equivalence.

## Implemented behavior

Checkboxes/radio buttons with explicit selection metadata, padding, vertical alignment and P94 now expose the three selection text controls. Inspector W/H uses the author Size entry for these controls. Legacy declarations without selection metadata keep their previous behavior; this stage does not invent native creation defaults.

Each command detaches its effective authored declaration before awaiting fonts. It captures a browser-derived pre-edit panel, supplies raw per-pass text metrics, and lets the source-derived planner perform fit, rounding, placement and ordered Size/Location writes. Measurements include rich runs, links and breaks. Only the current adaptive declaration's explicit text-style patch is projected into temporary rich runs. Stored rich text is never replaced by that projection. Browser line boxes and CSS units remain independent substitutes for the original font/graphics engine.

The native minimum getters are 1×1 in the ordinary no-transform inheritance path. The finite rectangle-union service preserves the strict `abs(size) < 1e-5` empty-axis rule and operand order. The inset service uses two unscaled CSS pixels. Retained Direct2D evidence establishes identity-matrix behavior, but does not establish that the original application's DPI/render matrices match a particular browser or UI zoom.

Fit setters reenter full layout only when their shared flag changes. AlignRight instead updates the existing panel placement directly; only a resulting Size change can reenter measurement. The existing `planSelectionLayout` now represents this separate entry. P94's different preflight/MIue path is documented but not yet connected to an author command.

`applySelectionAuthorEffects` replays only successful persistent effects. External Size can affect all views; internal Size/Location corrections remain current-view writes, including complete property pairs. All-view writes clear the matching geometry from active and inactive override maps; later current-only effects recreate only their own slot. Fit and AlignRight flags are shared content. Panel, guard, measurement, cache and notification effects are not stored.

Every selected target is planned before a candidate page is assembled. One failure rejects the whole command. One successful multi-target command creates one undo entry. Font completion cannot commit after another edit, undo/redo, gesture, document replacement or selection/view/scope change. A monotonic serial also cancels a view round trip that ends on the original selection. Rendering, switching views and saving do not initiate an author command.

The current host admits page and unrotated Layer scopes. Rotated selections, panel/repeater/container-local scopes and active selected-state font overrides are rejected without modifying the document. Their native coordinate/font contexts are not yet closed.

## Defects and retained evidence

- Independent review identified a context round-trip race; a monotonically increasing command serial replaced a final-key-only check before acceptance.
- A production browser test reproduced adaptive font mismatch: two controls displayed the same declared 32px font, but one fit to its raw 14px run and saved width 118. Temporary declaration projection fixes measurement while preserving the raw runs. The first build, source snapshot, failing saved document, screenshot and trace remain retained.
- The first browser run's three failures were test locator errors before any author command. The fixture was corrected from an absent `.canvas`/id selector to the actual editor wrapper; these are not product failures.
- The first command unit run had one incorrect assertion that a no-op Size emitted no effects. The source still reads its minimum twice; the corrected assertion preserves those reads and requires zero measurements/writes. Product code was unchanged for that correction.

Final validation passed 5,469/5,469 unit checks, TypeScript, a separate production build, and 29/29 production Edge tests with no failed, flaky or skipped cases. The 29 tests include nine new author workflows and twenty selection/display/runtime regressions, including offline and frame behavior. The final fitted right-indicator editor screenshot was opened and inspected. The 73 retained-CIL service probes and their 56 manifest files were independently verified; 1,535 historical acceptance evidence hashes and the published archive/ASAR remain unchanged. The unchanged reader's earlier 856 checks are reused after input verification. This is not a full browser regression or Windows package acceptance for this stage.

Exact input hashes, screenshots, earlier reports and preservation checks are in [selection-author-verification.json](selection-author-verification.json). The retained service evidence is [selection-author-services-evidence.md](selection-author-services-evidence.md); independent measurement, effect-replay and host reviews are [selection-author-measure-implementation.md](selection-author-measure-implementation.md), [selection-author-host-review.md](selection-author-host-review.md), and [selection-author-host-review-correction.md](selection-author-host-review-correction.md).

## Remaining work

Selection P94/style/text-change command gates, pointer-resize routing and complete creation defaults remain to be integrated. Native TextPanel history, native font/DPI equivalence, container-local coordinates, selected-state typography, complex paint/transforms and complete state/adaptive SVG assets remain unresolved. Right-indicator native import admission, the full-stage browser regression and Windows packaging remain pending. The original GUI screenshot/coordinate bridge is still blocked as recorded in `selection-layout-gui-observation-20261020.md`; no new original GUI comparison is claimed. Native `.rp` writeback and the broader full Axure feature set remain on the project gap inventory.
