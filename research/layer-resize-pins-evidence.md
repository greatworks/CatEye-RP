# Author resize pins: native format and independent import

The four native authoring properties are P106 (horizontal pin), P107 (vertical pin), P108 (fixed height), and P109 (fixed width). This report concerns stored authoring constraints and their import. Whether a fixed flag affects an object is a separate capability decision in the resize controller.

The retained Axure RP 11.0.0.4150 assembly was read through metadata and CIL only. No original assembly was loaded or executed. No original GUI comparison is claimed.

## Source contract

- `jtoq` property/value getters identify the four keys. Horizontal values are 0, 1, 4, 5, 256; vertical values are 0, 2, 8, 10, 512.
- `WtTU..cctor` (100717199), IL 106–157, initializes P106/P107 to Position.None and P108/P109 to Boolean false. These are native global defaults, not inferred from an empty object.
- `HtoV` (100717642) resolves an eligible overridden property from ordered providers and linked base styles. Inactive local entries do not hide inherited values. Import rejects indeterminate values rather than inventing a result.
- `ituB.ItvB` (100717432), its P0 getter, and `a5FY` (100717956) establish the explicit unlinked-style case: absent P0 supplies no named base. `ituB`'s default getter (100717243) supplies the global default.
- The bounded instruction replay has 16 passing resolution/default cases and 7 passing unlinked/default cases. Provider order, iterator objects, capabilities, and property flags are explicit plain-data sinks. These probes do not establish arbitrary serialized cache identity mapping.

## Import behavior and checks

The reader accepts pins only when an existing complete cache chain identifies their source, or when an explicit unlinked RP 11 style has `All=false`, no MatchInfo, and no P0. The importer verifies the four ordered fields, source identity, package version, known enum values, flags, and default provenance. It preserves explicit local None/false; global default None/false does not expand every widget style. Normal adaptive overrides can contain the four constraints. Visual state, hint, rich-text, and action styles do not gain authoring fields.

The census covers 11 hash-verified original `.rp`/`.rplib` files. The final importer regression retains all 10 previously admitted samples, the same one previous page-limit rejection, and no new skipped objects. It preserves 2,308 pin fields. Removing only those four new fields produces exact document equality with the frozen previous importer; all 10 admitted documents round-trip exactly through `.rea.json`.

The final focused reader run passes 40 tests. The focused importer run passes 75 tests, including 38 new pin tests and existing Layer/adaptive cases. These are independent product checks, not original GUI parity.

## Preserved failures and corrections

- The first reader harness dereferenced an absent fixture property; the callback guard was corrected. Raw first and second logs remain.
- One importer test tried to import a non-exported test helper. The test now counts its known fixture directly; this was not a product failure.
- The first corpus comparison rejected eight existing DynamicPanel objects with explicit unlinked styles. The missing admission case was closed using the retained `ItvB`, P0, predicate, and native default evidence before adding support. The failed corpus report remains.
- The first unlinked instruction harness compared a JavaScript Boolean with a CIL integer. Its plain getter sink now produces the explicit integer representation; the retained CIL instructions and branch behavior were not changed. The initial harness file remains.

The manifest binds the retained source slices, harnesses, raw logs, final results, and the importer files. It does not certify resize UI, runtime playback, original pixels, arbitrary unsupported style carriers, or full Axure parity.
