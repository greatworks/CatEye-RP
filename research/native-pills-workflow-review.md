# Native capsule workflow review

Read-only review of the authored fixture, four browser cases, shared player scenario, exact-package smoke and release verifier. Source hashes and the narrow Node fixture check are recorded in [native-pills-workflow-review.json](native-pills-workflow-review.json). No browser, package, original application or full suite was run for this review.

## Result

No remaining blocking finding in the reviewed workflow. Two earlier fixture defects are resolved in the reviewed bytes: emptying a Chip now updates its rich-text projection through `replaceWidgetText`, and the renamed gallery entries explicitly have no interactions rather than retaining stale original self-targets. The source import records are unchanged. A Node construction and strict document parse succeeded for all 26 demonstration widgets, including the 18 gallery entries and six empty rich-text projections.

## Import scope and provenance

The three populations are distinct: 28 real raw six-point capsules, 26 available semantic owners, and 18 widgets present in complete-document imports. The corpus audit records eight exclusions under rejected fit-to-content parents and two repeater-template traversal exclusions. The native importer unit asserts these counts, exact source paths, dimensions, radius, mask, identities, serialization and unchanged original-file hash. This review independently checked the recorded populations and the actual source-file hash; it did not regenerate the corpus.

The desktop smoke opens the actual original `Sample form patterns.rplib`, checks the report source hash, saves the whole imported project, and deeply compares each of the 18 saved widgets with its complete-document import record using the original full widget ID. It checks the original library hash again afterwards. This is stronger than isolated-owner conversion or checking selected geometry fields. The saved format is `.rea.json`; this workflow does not claim original RP writeback. File-picker results are mocked while application import/save commands run normally.

The demonstration changes layout, text, paint and controls explicitly. Its comment and visible subtitle label these changes as authored. A narrow assertion checked that all 18 gallery paths, dimensions, radius values and corner masks still match the imported records. The screenshots are product demonstrations, not original Axure canvas or pixel comparisons.

## Behavior and assertions

`native-pills-scenario.mjs` selects the semantic fill channel using `[data-shadow-fill]`, avoiding ambiguity between fill and stroke paths. It checks four curves on each gallery capsule. On one original thin slider it then checks resize, independent radius and mask actions, selected/hover composition, and two corner/interior pixels in both preview and actual exported HTML. Full path provenance is provided by importer/renderer tests rather than inferred from curve counts.

The authoring test compares the entire document after width, height, radius and mask changes, four undo operations, four redo operations, and reopening. The node-edit case changes an actual cubic control coordinate through the numeric Inspector, checks strict-family controls disappear, compares the exact saved path, and checks undo restores the original. This is numeric node editing, not a pointer-drag test. The existing mismatch between parameterized painting and stored editing anchors remains a declared product limitation.

The latest parent corrections retain these assertions: the exterior pixel moved from `(5,5)` on the painted corner boundary to `(2,2)` outside it, and the node Undo test reselects the widget after the application clears selection. Earlier failing reports are retained by the parent.

The `.last()` editor selector currently identifies the target deterministically because it is the last `box` in this explicit fixture; subsequent Radius=5 and whole-document comparisons also guard the intended object. It is order-dependent but does not currently select an unrelated object.

One nonblocking validation limit remains: the reopen check opens the same expected document already visible after redo/edit. It exercises the picker/open command, but equality alone is not a negative control proving replacement of a different old state. Initial demonstration opening and the original-library import are separate distinct-state checks.

## Artifact and acceptance boundaries

The verifier requires successful unit/parser/type/browser results, no skipped/flaky/unexpected browser cases, exact source/build/ASAR/archive and packaged-file hashes, all desktop save/export/screenshot hashes, five package scripts, and restoration of historical artifact bytes. Its fixed 3511/698/275/27 counters are acceptance requirements, not proof of completion before the parent runs finish. This review did not execute the verifier or declare release success.

At this read, the verifier still names the earlier `focused` report and restoration record. The parent has explicitly scheduled switching those references to the successful `validated` run; the earlier failed report is not certified by this review. The browser wrapper now preserves historical artifact prefixes while permitting this stage's `native-pills-*` outputs to update, so the package smoke will not accidentally consume a restored obsolete gallery.

The desktop smoke checks preview/offline operations leave the authored document unchanged, original source and ASAR hashes remain unchanged, and captured network/error arrays stay empty. Screenshots are captured after the authored workflow. Original GUI comparison, original pixel comparison, original DLL execution and full Axure parity remain explicitly false in the verifier.
