# Adaptive import integration: independent read-only review

This review concerns the new adaptive set/action/local-declaration import paths, not the entire historical importer. The reviewer did not edit production files, alter existing assertions, run the full suite, or execute the native Axure GUI.

Two concrete defects were reported and corrected by the implementation owner:

1. The set importer initially rejected the actual reader's `standalone-value-parts` diagnostic because its optional `count` field was absent from the allowlist. The independent two-case protocol reproduction keeps the original failure in `adaptive-import-styles-importer-red.json`, its first correction in `adaptive-import-styles-importer-green.json`, and a replay against the final reviewed source in `adaptive-import-styles-importer-final.json`.
2. A container's own adaptive declaration was initially validated after its descendants had been registered. Rejecting a real Default library table on a synthetic unsupported local declaration left its nine cells addressable, and a separate button's Show action targeting a deleted cell was retained. The corrected path validates the owner before child conversion. The independent baseline/rejection reproduction now keeps one baseline event and rejects the whole dependent event after parent removal; nested imported count becomes zero. Original failure and corrected output are retained in `adaptive-import-styles-integration-review-red.json` and `adaptive-import-styles-integration-review-green.json`.

The second probe decodes the retained native Default table and adds a synthetic invalid local declaration and a synthetic button action. It is product integration evidence, not an original Axure export or GUI experiment. The source sample hash is verified before and after the probe.

The bounded review also checked:

- Local raw DOAName validation before eligibility filtering; fresh projection rather than trusting the supplied product patch.
- Whole P21 maps, empty ordinary declarations versus empty state barriers, canonical state names, zero references, exact state source identity/order, and rejection of unreferenced state evidence.
- Same-page adaptive action scope through PanelState packages and propagation of ambiguous ownership to descendant packages.
- Atomic event conversion after every case/action target succeeds, including named-view membership in the source Page's declared complete set.
- Final admitted-object traversal before attaching local override maps, so rich-link pruning does not create dangling override IDs.
- Container/contained-label gates, complete geometry pairs, complete local padding tuples, and explicit rejection of unsupported eligible properties.

After the two corrections, this bounded review has no remaining definite defect to report. It does not establish native parity for rejected named-style/provider synthesis, general transforms/limbo, nonempty Page appearance, or fit-panel generated CSS dimensions. Orphan view maps remain inactive preserved data, not evidence of a recovered native view hierarchy.

The paired JSON pins the reviewed files and independent results. The implementation owner's reported 70 focused importer tests and typecheck are labelled as owner-reported rather than a second independent test run. The earlier reader review separately records the parent's 72 focused cases and the 58 exact-source NodeVM cases.
