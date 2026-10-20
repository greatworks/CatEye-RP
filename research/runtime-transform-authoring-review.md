# Runtime transform authoring — independent final review

The three concrete authoring defects found during review are resolved. The final independent run passed **33/33** checks with **0 page errors** and stable hashes for all eight reviewed source/test files. This reviewer changed no production files, importer, reader, or existing tests.

## Resolved findings

1. **Alias rename and scientific notation (P2).** The original function changed `[[1e3 + e3.x]]` into `[[1rail + rail.x]]`, and similarly corrupted `1e-3`. Complete numeric tokens now take precedence over identifiers. Both original failures and quoted/plain-text controls pass.
2. **Target-reorder draft ownership (P2).** With both targets using `local1`, an invalid alias draft on A remained at row 1 after reordering B/A. Correcting it renamed B. The component now resets drafts and errors when the expression scope changes. The same actual React/Edge interaction now leaves both displayed names canonical.
3. **Legacy conversion boundaries (P2).** A missing-target legacy Move was inert but conversion chose This; a legacy line Resize worked but conversion became an unsupported structured operation. The actual Inspector now disables both conversions and explains why. Opening these actions leaves the saved document exact. A valid box conversion remains enabled and retains its identity and numeric inputs through strict serialization. Size rounding is disclosed as an explicit conversion boundary.

## Evidence and scope

- `runtime-transform-authoring-review-red-probe.json`: original 20 pass / 3 fail, with source hashes. The failures are two numeric cases and the reorder case.
- `runtime-transform-authoring-review-red-legacy.json`: actual module runtime comparison; ordinary box conversion equivalent, missing-target and line cases differ. This remains historical red proof; the green test checks the new UI guard rather than replaying the removed conversion behavior.
- `runtime-transform-authoring-review-green-probe.json`: complete final 33/33 run; actual Inspector controls, unchanged author documents, clone bindings, ordered duplicate targets, recursive boundaries and strict schema checks.
- `runtime-transform-authoring-review.json`: exact reviewed source and evidence hashes, resolved findings and empty blocking findings.

The first extended harness attempt hit its cold 15-second navigation budget. Its partial model-only result is preserved as `runtime-transform-authoring-review-green-navigation-timeout.json` and excluded from browser success. The final run waits for the concrete controls and completed every assertion. The screenshots are component evidence, not full application visual-parity evidence.

After the completed probe, the parent updated `tests/e2e/runtime-transform-authoring.spec.ts`. The JSON records its probe-time and subsequent hashes separately. All reviewed production files remained unchanged; this review does not claim to have executed the parent's updated E2E file.

The reader remains SHA-256 `9cad13789fe618def273457f1f61584489ef2d0818224cdd0bd1f3cd7285290b`; the importer remains `2180439727ee53c122eba51c0bccc443f2496890dbacde69bc8a286cae860a39`. Full application history, complete regression and exact package acceptance belong to the parent validation. No original Axure GUI or DLL methods were executed.
