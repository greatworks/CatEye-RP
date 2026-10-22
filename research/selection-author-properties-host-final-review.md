# Selection property author host: final read-only review

This review covers the current author host, its delayed-font FIFO, and rich-text pending lifecycle. Product and test files were read only. The source identities and retained red/green evidence are bound in `selection-author-properties-host-final-review.json`; later source changes require a new review. No original Axure DLL or GUI was executed.

## Confirmed defect and correction

The initial focused-draft change introduced a real `NumberField` bug. When a font transaction changed canonical X while the unchanged X field remained focused, blur compared the stale draft with the new value and wrote the old coordinate back. The independent exact-function-body probe failed this case while its edited, same-value-reset, and invalid-input controls passed. The parent then reproduced it in the first production build: font layout wrote X=37, blur restored X=100. The retained browser red output is `.build/selection-properties-blur-red.json`.

The corrected commit now handles `!modified` before parsing or emitting a command: reset the displayed draft to the canonical value and return. A fresh independent output, `.build/selection-author-properties-field-independent-green.json`, passes all four cases. The red JSON and its exact Inspector source snapshot remain unchanged. This is a narrow source-body replay with React callback sinks, not a substitute for the parent browser regression.

The parent also found that clicking the rich content inside the selection control's associated label activated/focused its input, causing an unchanged apply and closing the editor. The supported display branch now removes `htmlFor` while editing. The legacy wrapping label prevents contenteditable default activation in click capture. These are explicit editing-mode guards; ordinary checkbox/radio activation is retained.

## Reviewed transaction contract

- Each queued property command captures its intent but builds its candidate from the last accepted document. The queue checks a monotonic serial, page/view/scope/selection/editing context, document identity, and active drag state before and after asynchronous preparation.
- Candidate styles and shared text are written first. Measurement sessions independently snapshot the previous effective declaration and the updated declaration. The former supplies the previous panel; the latter supplies the font/text measurement and transaction input. Explicit adaptive text styles are projected only into detached measurement rich text, never saved over the original shared runs.
- Font readiness does not validate candidate geometry. This permits P94 to exceed the old width until its source-derived preflight expands the owner. Actual panel capture and measurement retain geometry checks.
- Every selected selection control is prepared and planned before any effects are applied. An error rejects the entire candidate, including ordinary widgets in a mixed selection. Successful effects are replayed in order. External Affect-all-views style edits remain separate from internally current-only Location/Size writes.
- W/H/Fit/AlignRight submitted while the property FIFO is active join that queue. A successful command commits once, synchronously advances `docRef`, and advances the queue's expected document. The dedicated `textChanged` entry preserves its source-specific tail; it is not treated as a generic style change.
- `queueSelectionProperties` resolves to an acceptance Boolean. `applyRichText` forwards that Promise and closes the editor only from the successful acceptance callback. Measurement rejection leaves the document and undo stack unchanged.

## Rich pending lifecycle

`RichTextEditor.apply` has a synchronous in-flight ref plus rendered pending state. A second apply cannot enqueue another pending transaction. Pending disables contenteditable, exposes `aria-readonly=true`, disables Done and both formatting fieldsets, and retains Cancel/Escape. Outside pointer/focus handling calls the apply sink in a capture listener; a pending or failed acceptance prevents that event from reaching the canvas/tool handler and focuses the editor toolbar. The blocked pointer is not replayed after acceptance.

Failure resolves the Promise as false, leaves the draft mounted, displays a retry/cancel message, and clears pending in `finally`. Cancel changes the App editing context; its serial check invalidates the outstanding command before it can commit after font release. These conclusions are based on the actual source paths, with the new production-browser cases delegated to the parent's unified runner.

The rich pending persistence assertion uses `saved(page)` (local cached document readback) rather than clicking Save. Save is an outside-editor action and deliberately exercises leave/apply; using it merely to inspect pending state would mix two independent contracts. The separate new outside-click case tests that lifecycle directly. Once the editor has accepted or cancelled, Save reads the live author document for exact comparison.

## Test handoff and limits

The complete ten-case draft is `.build/selection-properties-draft/selection-author-properties-v2.spec.ts`. It preserves the previous eight cases and adds: pending outside selection blocking; and failed measurement retaining an editable draft, successful retry, one Undo, then pending Cancel followed by font release without a late commit. The earlier eight-case draft additionally contains the untouched-X regression and font-then-W FIFO with stepwise Undo. Node's TypeScript stripping parser accepted both drafts. No browser was launched by this reviewer.

The parent owns final build, all unit/browser runs, and desktop acceptance. The retained first browser result was 34/35 with the label defect; the new ten-case source is a test handoff, not a claimed passing browser result. This review found no further source-level blocker in the examined paths after the NumberField correction.

Remaining bounds are intentional: browser font/Range metrics substitute for the unavailable native text measurement; panel/repeater/table/menu/tree ancestry, rotation, selected-state font overrides, and width-fit content over 10000px remain outside the host's admitted domain. No native GUI, pixel, font-metric or complete Axure parity is claimed.
