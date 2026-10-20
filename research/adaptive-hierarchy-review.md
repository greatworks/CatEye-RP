# Adaptive hierarchy independent integration review

This review reads the current independent editor implementation, not the Axure GUI. The retained-original selector/inheritance evidence remains frozen separately in `adaptive-hierarchy-evidence.md` (83 NodeVM cases). No original application was launched or controlled by this review.

## Confirmed issue and correction

`applyAdaptiveWidgetEdits` rebuilt the selected view's local declarations solely by comparing its effective values with its current parent. An existing explicit child value disappeared if the parent happened to match it, even when the only user edit was a shared note. A later ancestor change then incorrectly changed the child.

The read-only product-model probe preserves the four original failures in `adaptive-hierarchy-review-probe.json`: width 300 became 400, red became blue, hidden became visible, and an explicit solid reset began inheriting a gradient. The script uses Node's built-in TypeScript loading and executes the actual model functions without stubs or a browser. Its corrected output is separately stored in `adaptive-hierarchy-review-probe-after.json`.

The correction in `src/model/adaptive.ts` keeps only previously present local declarations whose effective leaf values did not change in this edit. Fields genuinely changed by the edit are still compared with the effective parent. Fill/gradient, stroke/gradient, radius/corner radii and stroke width/per-side widths are compared as atomic pairs: a changed partner cannot revive the obsolete other partner. Shared content is never inserted into the adaptive override. Table/menu/tree preserve only their supported local visibility declaration. The generalized preservation also retains the existing explicit rich-run reset commands.

## Validation

- First run: 23 existing tests passed, four new regression cases failed. Preserved report: `.build/adaptive-hierarchy-local-declarations-red.json`.
- Corrected model run: 35 hierarchy, 12 legacy adaptive and 22 fill/border gradient tests passed (69 total). Report: `.build/adaptive-hierarchy-local-declarations-related.json`.
- Consumer run: nine font-style and 93 runtime hierarchy tests passed (102 total). Report: `.build/adaptive-hierarchy-local-declarations-consumers.json`.
- Four independent model probe failures became four passes without replacing the original failure JSON.
- `npm run typecheck` passed. `node --check scripts/smoke-adaptive-hierarchy.mjs` passed.

Additional model regressions cover deliberately returning a local dimension to its parent (which removes that local declaration), changing each atomic paint/geometry pair, and coincident local visibility on table/menu/tree. Existing tests continue to cover sparse inherited values, rich-run commands, legacy omission, invalid parent/cycle references, and direct-child reparenting on deletion.

## Other inspected paths and scope

Read-only inspection covered `adaptive-selection.ts`, document adaptive validation, `AdaptiveControls.tsx`, and App's effective-view edits/canvas painting. No additional concrete defect was found. This is a bounded review, not proof of every editor or runtime behavior.

The independent browser fixture and packaged smoke use a 1200-wide main canvas with an explicit 1200×0 Base selection size, so the existing page-width clamp can select Phone 390 and Tablet 768. The independent equal-width height page remains a 390×720 canvas with Base selection size 0×0. The main fixture is intentionally a desktop integration example, not evidence that native Base defaults to the page canvas size. Browser and packaged execution are coordinated by the parent; this review did not start a browser or a full build/suite.
