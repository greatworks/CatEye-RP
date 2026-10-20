# Native Layer runtime independent integration review

Final independent checks pass **50/50** against core `5d8cb997dd29745add36a3270c40c7c743342a0621da1a001403544e8d651128`. No unresolved confirmed defect remains in the inspected scope. No product or existing test files were edited, and no browser/full suite was run here.

NLR-REVIEW-01 is fixed: edge-anchor Layer Resize uses unrotated offsetLocation for the leading/trailing position and rotated bounds for the center. The original fixture expects (160,132,60,32); the first product yielded (165,126,60,32). Both final module/serialized cases match.

NLR-REVIEW-02 is fixed: initialization begins with empty Layer-subtree runtime state, applies error/selected before disabled, then visits child declarations in order. The original failing selected+disabled parent now selects then disables its child. The independent 16-case selected/disabled matrix passes in both factories, including SelectedChange event order/count. The Error control case was already passing and is not misreported as a fixed defect.

Initial Base data bounds, named-view runtime cache refresh, and return-to-Base fallback pass in both factories. Four Layer compression scopes also pass: visible, nested visible, hidden ancestor barrier, and qualifying sibling Layer moved once. Combined Resize+Rotate now reads offsets separately per leaf after starting Resize; X reads the Layer-bound event while Y reads the original event target. Both factories pass the 64ms dispatch/read-trace case, including the source's positive direction and Resize anchor branch.

The earlier Move-To suspicion is explicitly **withdrawn**. The low-level direct MoveWidget(to=true) probe does not represent the actual action, which converts destination to one delta before moveBy. No fix is justified from that incorrect generalization. The exact action correction is separately retained.

The raw-object event review passes **13/13**: ten Layer click→direct-member selected toggles and three click→panel-state actions. It follows native references independently of semantic event recovery and the product importer. All targets are on the same imported page, panel states belong to the target panel, and Propagate values match raw storage. Propagate is not treated as generic click broadcasting.

## Byte retention and verification

Current reviewed export-runtime, engine, expressions, Preview and types files have actual copied fallback bytes at `research/native-layers-runtime-final-*.txt`; JSON lists their exact paths and identical hashes. Original script sources are pinned by full path/hash. The frozen 78-case and 33-case manifests were not changed.

Three intermediate export-runtime hashes (`d0225887…`, `60f520c0…`, `766a76bb…`) were recorded at execution, with sourceStable checks, but neither investigator nor core author retained their complete old bytes. The bounded .build/research snapshot search found no matches. These are honestly marked **historical-hash-only**, with no fallback and no claimed rerun from old source. The final green source has genuine bytes; old red outputs remain preserved. Separate failed harness scripts do have matching snapshots and are mapped explicitly in JSON.

## Boundaries

These results do not establish complete Axure parity. The source probes run original JavaScript with declared facades, not an original GUI. Native combined orbit is still a sink; source nonzero-duration supplement observes start only. The product combined check uses Node timers and verifies dispatch/read order, not native browser animation pixels. General reentrant initialization, all contained/tree/repeater branches, editor pins/resize and fixed/percent behaviors are not covered. Whole-corpus import totals remain attributed to the format audit. Finite guards are a product boundary, distinct from native all-excluded negative cache geometry.

The JSON companion separates current verifiable inputs, historical hashes, red/green artifacts, original source contracts, product execution, and limitations.
