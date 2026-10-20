# Native rotation and transform — Axure RP 11.0.0.4150

This stage reads pinned original packages and managed metadata/CIL. It does not execute the target assembly or original GUI. The pre-implementation census is `rotation-format-census.json`; it is distinct from the eventual import audit and must not be mistaken for successful nonzero-rotation recovery.

## Stored carriers and direct evidence

- PName50 is `ROTATION`, a Double. `TtuV.ituB.btyU`100717413 is the typed getter; `otyZ`100717414 writes property50 at IL35, boxes Double at38, and calls the property writer at44. The getter retains the existing override/determined predicate.
- PName1401 is `TRANSFORM`, a `JHSS.bHSN` object (TypeDef33559282). `ituB.get_Transform`100717435 and `Mtvj`100717436 access it; the setter loads1401 at IL35.
- `bHSN` has five Double members. Getter tokens are ScaleX100723734, ScaleY100723736, TranslateX100723738, TranslateY100723740 and Rotate100723742. Constructor100723750 explicitly sets both scale fields to1 (IL18/27 and38/47); the other Double fields retain zero initialization. This is identity, not a general affine six-coefficient matrix.
- Serializer `B5Sy.b59Y`100718391 writes those getters in the same sequence at IL41/90/140/189/238. Reader `I59n`100718393 calls the corresponding setters at51/95/139/183/227. Observed exact keys are `ScaleX`, `ScaleY`, `TranslateX`, `TranslateY`, `Rotate`. The CIL key literals remain obfuscated; concrete key identity is corroborated by typed serializer order and all observed five-field maps.
- PName1402 is `TRANSFORM_ORIGIN`, a point. Metadata proves `ituB.Ttvb`100717437 / `ltvJ`100717438 and `KJm7.JJUg`100695611 as TransformOrigin accessors. The independent runtime investigation supplies the default50,50 construction chain in `rotation-runtime-widget-cil.json`.
- JSON writer `wJe6.NJel`100694334 writes all five transform typed getters. This alone does **not** determine CSS transform ordering, length units or whether rotation substitutes for/combines with PName50. Those require the separate generator/runtime chain.

Sources are saved in `rotation-format-metadata.json`, `rotation-format-properties-cil.json`, `rotation-format-object-cil.json`, `rotation-format-transform-cil.json`, `rotation-format-serialization-cil.json`, and `rotation-format-json-transform-cil.json`. Their producer scripts only use PEReader/ECMA metadata; the target DLL is never loaded. DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

## Eleven-file pre-implementation census

Raw property occurrences include local, named and default-cache records; they are not unique widgets. There are1598 P50 zero records,6 at180°,6 at89.13596303062127°. All715 P1401 records are identity; all715 P1402 records are50,50. There is no observed nonidentity-transform or noncenter-origin positive fixture.

Exactly12 objects are actually rejected by the current importer for rotation. All are VectorShape with explicit stored location/size, finite normalized control paths and local determined+overridden P50. None has an explicit local P1401 or1402. The complete native IDs, package IDs, hashes, paths, source flags and current rejection reasons are in the census.

| Sample | Nonzero angle | Rejected owners | Saved shape |
|---|---:|---:|---|
| Sample form patterns.rplib |180|4|207 Arrow/Menu carat|
| Sample UI patterns.rplib |180|2|207 Menu Carat|
| Prototype Starter.rp |89.13596303062127|1|29 Line|
| Quick Win.rp |89.13596303062127|2|29 Line|
| UX Prototyping.rp |89.13596303062127|3|29 Line|

The six Shape29 owners are the six rotated FilledTriangle-ended lines omitted at the previous milestone. The two UI carats also have independently unsupported compound/dummy interaction paths; rendering admission must not make these event trees partially execute.

## Coordinate and effective-carrier closure

The independent [runtime investigation](rotation-runtime-evidence.md) supplies the center, clockwise direction and rotated AABB proof. The native shape writer `FNiU.vNPI`100699653 reads Rotation at IL104 and HtmlRect at IL442. `KJm7.get_HtmlRect`100695393 IL8 returns `get_Rect`100695369, which constructs the rectangle from Location and Size. Consequently these saved coordinates and control points are not replaced with an already-rotated bounding rectangle.

P1401 precedence requires provenance. `KJm7.uIuQ`100695380 checks an angle cache/resolved Transform before falling back to P50. `jtoq.get_Transform`100717844 follows explicit OD linked/local carriers, unlike this reader's flattened default cache. `WtTU.get_Item`100717163 reads its local dictionary, with a null fallback; `ctw6`100717140 compares a special style identity before some chain elements are skipped. All12 positive owners have only a document-default cached identity transform and center origin, with neither local nor matched-base transform/origin. The parser must not turn that default cache's Rotate0 into an active competing angle. The special GUID literal is still opaque and is not decoded or invented here.

`jtoq.K5VL`100717842 is the disable-transform flag accessor (field B5Vi67132944); setter x5VK100717843 callers identify the `TrapDisableTranform` scope. VectorShape does possess both Rotation and Transform capabilities, so a type-wide claim that it cannot transform would be false. Additional retained files are `rotation-format-effective-cil.json`, `rotation-format-style-chain-cil.json`, `rotation-format-flag-setters.json`, and `rotation-format-style-identity-cil.json`.

## Implemented strict admission

No shared persistent schema was added: native `Widget.rotation` holds the literal finite signed angle. Local x/y/width/height and normalized control path remain byte-for-value the saved geometry after decoding. In particular180° carats are not repositioned, and89.13596303062127° arrow paths are not approximated as90°.

The additive worker protocol is `rotationRecovery:{status:'supported-center-rotation',rotation,origin:{x:0.5,y:0.5},mapping:'native-vector-center-rotation',cacheChainComplete:true,source:{rotation,transform,transformOrigin}}`. Each source entry retains raw DOAName, determined/overridden flags, value and exact cache/local identity. `storedGeometry.transformOrigin` is now explicit (null if absent). Legacy semantic fixtures with absent recovery and null/zero P50 still follow the previous zero-angle contract.

Admission requires a supported stored VectorShape path and confirmed empty text (all12 positives are empty; independent TextRotation is not generalized); exact complete default/base identity chain; finite local OD P50 within the existing product coordinate range ±100000; no explicit local P1401/P1402; and determined identity transform plus50,50 origin whose carrier is specifically the cached document default. Matched-base transforms/origins, even identity, remain distinct and unsupported. Zero P50 cannot conceal a known matched transform, nonidentity transform or noncenter origin. An unsupported recovery record rejects the owner with its reason; it does not silently produce rotation0.

The importer independently checks the complete record, field identities, raw flag consistency, local style identity/angle agreement, shared default-cache identity, exact five-field identity transform and two-field center. It also requires the already-validated path. Unsupported original events remain whole-event rejections. General matrix/scale/translate composition, noncenter origins, container rotation, interaction-state rotation and independently rotated text are outside this new recovery boundary.

## Fit-content consequence

Original `axQuery.std.js:1325–1352` uses `offsetBoundingRect()` for each visible child;1554–1569 obtains its rotation and calls the center-rotation AABB helper. `visibility.js:741` and repeater1619 call the shared children bounds. Hidden/limbo/fixed objects are excluded by the original routine. The native importer already rejects fixed layout and unknown shadow/automatic-text geometry; those guards remain.

Import-time dynamic-panel bounds now use each visible child's center-rotated right/bottom, starting at zero, and recurse through the active state of nested fit panels. Zero-angle arithmetic is unchanged. Synthetic end-to-end importer tests prove a100×20 child at10,20 rotated90° yields right70/bottom80; a hidden distant child does not enlarge it; wholly negative extents retain the model's minimum authored1×1; a nested fit panel at5,6 produces75×86. These are controlled conversion tests backed by original-function geometry evidence, not original GUI captures. No real positive rotated fit-panel child occurs in the11-file corpus.

## Actual recovery and validation

`rotation-import-baseline.json` is a one-time pre-change snapshot of all11 imports and source hashes; its producer refuses to overwrite it. `rotation-import-audit.json` compares the final importer against those complete documents, checks strict model roundtrip and pins all original file bytes. The new recovery is exactly12 top-level widgets (Form4, UI2, Starter1, Quick2, UX3),0 nested widgets,0 events and0 actions. All existing widget graphs remain identical. The two UI carats retain their unsupported compound/dummy-target events; visual admission does not turn those into partially functioning interactions. The UX repeated source ID appears in two different packages and yields distinct stable imported IDs.

The semantic maximum is28,724,053 compact UTF-8 bytes at the initial final audit, below the existing32MiB desktop worker report cap (64MiB is only a test subprocess output buffer). The authoritative current value and source hashes are in the refreshed audit rather than inferred from pretty JSON length.

Focused checks:19 new Node parser tests (47 with28 adjacent line-style checks);36 new importer Vitest tests (68 with32 adjacent line-style checks); TypeScript check. No full suite, build, package or original GUI run was performed by this format subtask. Parent-level validation is recorded separately.

Refresh only this milestone: `node research/rotation-import-audit.mjs`, then `node research/rotation-format-evidence.mjs`. Do not regenerate the pre-change census/baseline or rewrite the frozen line-style reports. Original GUI/font/pixel equality, shape regeneration and arbitrary affine transforms remain unproved.

