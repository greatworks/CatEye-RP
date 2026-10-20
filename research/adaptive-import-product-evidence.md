# Adaptive native import: editable-project boundary

This report covers the product importer and its focused tests. It does not claim a final release, a complete Axure GUI round trip, or a newly observed original file containing named adaptive views. Original format, local-style and action evidence are recorded separately in the adjacent adaptive-import reports.

## Implementation

- `src/model/import-rp-adaptive.ts` revalidates shared-set definitions, the Base sentinel, parent chains, page assignments, source package hashes/version carriers, duplicate identities and the literal native action target protocol. Cursor/device-shell values remain in source-report details; they are not silently mapped to the player shell.
- Model identifiers are deterministic: `rp-avs-<native-set-id>` and `rp-av-<native-view-id>`. Source Base dimensions remain threshold metadata. Imported page canvases retain the explicit 1200×900 fallback, with a separate diagnostic; source 0×0 is not changed into a fabricated native size.
- Every eligible local property is independently projected again from its raw `DOAName` and value. Only Overridden+Determined properties participate. Duplicate masked property identities, unknown effective properties, malformed atomic values and a worker patch that differs from this projection reject the owner. Inactive records do not become declarations.
- P101/P105 geometry is atomic, P110 maps visibility to `hidden`, and all four padding records must be present together. P21 creates a whole state map only when the property is eligible: ordinary empty style, empty whole map and empty state entry remain different. `mouseOver`/`mouseDown` use the product schema's camel case.
- P20 automatic spacing requires previously validated rich paragraphs whose spacing is entirely `normal`. P80 keeps the existing verified rectangle/form surface gate. Adaptive P50/P111/P1401/P1402 and unsupported geometry remain rejected. Shared table/menu/tree roots accept only `hidden`; table cells and shared descendants reject nonempty patches. Empty inactive maps may be retained.
- `src/model/import-rp.ts` binds actions to the unambiguous owning Page, including PanelState packages. Unknown/zero/reserved named targets reject the whole event. Event 338 is Page-only. Hyperlink actions first pass their raw/projected graph check and then use the same final Page binding; a failed link removes its entire owner.
- Local declarations are checked before a container can register descendants. Final override maps are attached by traversing the admitted widget graph after link/dependency pruning. Missing owners therefore cannot leave adaptive override IDs or action targets behind.

## Focused validation

New product tests: **70/70 passed** in `tests/import-rp-adaptive-{sets,styles,raw}.test.ts`. Existing focused importer regression: **146/146 passed** across ordinary import, interactions, rich hyperlinks, tables, menus and tree widgets. TypeScript passed. No full suite, browser, build or package was run by this worker.

The new raw test generates an independently encoded synthetic `.rp`, reads the actual container through `inspectRpSemantics`, and passes that result to the product importer. It verifies the shared set/chain, sparse local patches and empty barrier, inactive orphan map, three control actions, Page event338, round trip and atomic rejection. The original HTML configuration dependency is retained by the fixture generator; no importer setting guard was relaxed to compensate for a missing fixture package.

Additional tests exercise literal rich-link Auto/Base/named targets and removal of maps when their owner is pruned. Retained native table and fit-panel graphs provide the regression for descendant registration and counts; the invalid adaptive declarations/actions in those tests are synthetic.

## Red/green record and corrections

- Initial set/action run: 3 passed / 22 failed. One failure was a test variable shadowing the GUID helper and was corrected separately; 21 were missing-feature failures. The resulting first set/action scope passed 25/25.
- Local declaration baseline: 5 positive cases failed, 15 rejection cases passed; 25 unrelated tests were skipped. All these cases are included in the final 70.
- Independent review found the real standalone-value-parts diagnostic carries `count`. Strict nonnegative safe-integer validation now accepts that field without discarding page assignments. The independent red and green evidence are linked by `adaptive-import-styles-integration-review.json`.
- Independent review also found late parent-declaration rejection left descendant targets/counts. Two added tests failed before the fix: table descendants remained 9 and fit-panel descendants remained 2. Moving owner validation before recursion makes both zero and prevents the external table-cell action from being admitted. The independent reviewer reran its table probe successfully.
- Existing regression initially yielded 142/146. Four failures came from older synthetic clone helpers changing an object's ID while retaining the newly emitted `adaptiveStyleRecovery.sourceId`. An independent probe demonstrated the precise identity mismatch. Four clone sites were updated to keep their source IDs coherent; all original behavior assertions were preserved, including the dependency fixed point. Product validation was not weakened.
- Intermediate test-authoring syntax errors were corrected before executable runs; they are not claimed as product red tests.

See `adaptive-import-product-evidence.json` for final source/test hashes and machine-readable log paths. Earlier red results are preserved; the final focused evidence is not a substitute for the parent task's comprehensive parser/browser/release verification.

## Boundaries

The retained corpus currently has Base-only sets and no original named/assigned positive fixture. Named hierarchy, action and active local-style positives are therefore synthetic protocol/container evidence, supported by separately retained read/write/runtime source evidence. Cursor/device shells, general adaptive transforms/placement, arbitrary native style properties and currently shared composite layout are not newly claimed as equivalent. No source file is rewritten, and this work does not add RP write-back.
