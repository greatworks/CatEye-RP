# Adaptive placement runtime integration

The original-source investigation is frozen separately in `adaptive-placement-runtime-evidence.md/.json`: 55 exact-source NodeVM cases and 8 isolated Edge DOM cases. This document records the independent implementation and its verification, not additional observations of Axure GUI behavior.

## Changes

* `src/runtime/export-runtime.ts`: consumes optional `placed` separately from `hidden`, including table/menu/tree root declarations. Own limbo filters ordinary action target resolution before value evaluation; ordinary children beneath an unplaced panel remain targets. Loaded traversal, control focus, child fit and repeater refresh use the separate ancestor-aware gate. A view switch remains silent for Show/Hide. Unplaced repeaters retain their current row identity, revision, input and paging until eligible for refresh. Place refresh uses the existing native persist=2 path.
* The same runtime exposes a physical `placementHidden` gate. Known contained tree labels ignore their own placement; table cells, submenu wrappers and menu-contained tables retain the original direct-visibility exclusion. These gates are intentionally not collapsed into a generic ancestor-disabled/hidden test.
* `src/components/Preview.tsx` and `mountOfflinePrototype`: independent ancestor-unplaced propagation keeps DOM subtrees mounted. An own unplaced wrapper has `display:none; visibility:hidden`; child placement is not rewritten. Inputs and iframe elements are reused. The existing ordinary Hidden branch is unchanged when placement is not involved.
* `src/runtime/engine.ts`: snapshot fit excludes unplaced children, retaining saved geometry.

Selection-group peers in own limbo are not deselected by another member. Radio checked exclusivity remains its existing DOM-compatible behavior; the static selected-style evidence is not generalized into a new radio checked rule. Direct synthetic ordinary event API calls retain their existing dispatch semantics; standard path actions and Loaded traversal use their separately proven gates.

## Verification

New `tests/runtime-adaptive-placement.test.ts` covers both module and serialized factories. Its initial 20-case run produced **18 failures / 2 passes** before implementation (`.build/adaptive-placement-runtime-unit-red.json`). The final file has **30 passing cases**. It covers absent/explicit false/explicit true inheritance, independent Hidden, silent restoration, action no-op and continuation, contained ordinary children, focus/load exclusion, panel and snapshot fit, row instance isolation, initial unplaced repeater first placement, nested identities, pageInfo deferral, rollback, selection peers, frame target navigation and root composite declarations.

The focused regression run passed **310 / 310 across 7 files**: placement, adaptive transition, adaptive behavior, adaptive state styles, table runtime, tree widget runtime and form properties. `npm run typecheck` passed. The harmless pre-existing Vite extension warning was retained in command output. An intermediate new fixture used a nonexistent `nextPage` action; typecheck exposed that test error, which was corrected to existing `setRepeaterPage` before the final run.

New `tests/e2e/adaptive-placement-dom.spec.ts` contains Preview and file-offline cases. It records actual DOM element identity, input values, an internal frame document marker and independent counter state through Unplace → inherited Place → Unplace → Base, including a frame initially unplaced. It also saves the design and requires deep equality. The two cases pass Playwright discovery; **their production execution is delegated to the parent release runner and is not claimed complete by this manifest**. No full suite, build or package was run by this implementation subtask.

## Boundaries

Input/node preservation is supported by the isolated original-function DOM probe. Preservation of an already mounted iframe document and loading a frame initially unplaced are explicit independent-player policies, covered by the new browser regression, because this stage did not observe original frame network/document lifecycle. Existing hidden-only unmount behavior remains outside this change. Native RDO/master expansion is documented in the original report but is not equated with the product's component system. Model/importer/editor implementation and their acceptance evidence belong to other agents. The original raw P111 enum is decoded by the format/importer stage; this runtime consumes the agreed Boolean `placed` model.

The accompanying implementation JSON hashes these three product files, two new test files and the immutable original evidence plus focused result. Other agents may continue model/editor/importer work; this is a scoped runtime freeze, not a whole-project release audit.
