# Native corner radius and visibility: format/import evidence

Target: Axure RP 11.0.0.4150; DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. This investigation uses static metadata/CIL and self-written file readers, not original DLL execution or GUI comparison. Original sample bytes remain unchanged.

## Proven carrier and bounded implementation

P71 is a boxed Double uniform radius; P81 is an Axure.Platform.Position bitmask. The setters `ituB.TtyS` (100717378, IL35/38/44) and `ituB.StyA` (100717428, IL34/37/43) write separate property keys. Effective getters are `jtoq.f5Bi` (100717786) and `s5VE` (100717836). The generator's OD-filtered `rJeU` (100694323) Position branch at IL1407/1423/1429 calls `cJeZ` (100694324), shared by P80 and P81. CSS writer `cNK1` (100699253) checks the radius and mask independently before `FNKB` and `lNKV`. Exact CIL records and hashes are in the JSON companion.

Corner order is **TL/TR/BR/BL = bits1/2/4/8**. It differs from border-side TRBL bit order. All eleven actual document DefaultStyle records store determined/overridden radius0 and mask15; this is observed default-cache evidence, not a fallback invented when a runtime key is missing. The independently frozen [runtime/static evidence](native-corners-evidence.md) records the four CSS corner names and the original rendering gates.

The reader emits the actual scalar `radius` and explicit `cornerVisibility`, even when all true or all false. It requires a unique complete default/matched cache pair, valid determined values, local OD values, and the existing strict saved Shape0 rectangle or proven ordinary form surface. A saved ControlPoints path identifies the admitted family; its maximum radius does not substitute for P71. The prior four-radius snapshot remains only when native parameters cannot be proven. Unknown P71/P81 are retained in the report rather than consumed.

Selected/other effects and local adaptive declarations retain P71/P81 independently, including zero and false resets. They must begin from a fully proven native base pair; supplying both fields in an override cannot manufacture missing base evidence. Unsupported active state fields remain atomically rejected. TS conversion revalidates type, scalar/tuple bounds, path identity, property identities and adaptive raw-source/projection agreement. Radius0..10000 is a product safety bound, not a claim about the native UI. No extra persisted geometry flag was introduced.

## Corpus coverage and deliberate exclusions

The inventory contains 1,388 Shape0 records. Existing strict path recognition accepts1,347; **1,345** have known P71/P81 and match uniform-radius×mask saved corner radii; **2** have unresolved cache pairs. This does not describe every Shape0. The remaining **41** are **28 six-vertex Form pills**, **9 other eight-vertex saved paths**, and **4 Default records lacking known geometry**. None receives new corner metadata in this stage. Their full source IDs, package hashes and native parameter values are in the JSON companion. The28 pills retain prior saved-path behavior; the domain was not widened to make the count larger.

Raw records contain592 direct-MyStyle P71 entries and55 P81 entries. There are18 active OD state corner properties across6 Form owners (12 radius and6 mask declarations). **No original adaptive corner-property declaration was observed** in these11 files; adaptive tests are explicitly synthetic. Full occurrence counts, raw DOA flags, exact cache identity and per-field provenance remain in [the census](native-corners-format-census.json).

Fresh import/save/readback yields **1,256** owners with native corner parameters, **52** partial masks and **460** positive radii. Added/removed widgets:0/0. Six previously omitted Form Click cases now import, each with exactly one `setSelected(true)` action targeting itself (not toggle). Form totals become86 events/86 cases/92 actions; other files' interaction counts remain unchanged. The two initially-selected owners preserve their prior **non-corner** active paint when new base and Selected style are composed. Their corners intentionally correct the old base snapshot[4,0,0,4] to native Selected radius5/all corners. This is functional recovery, not an assertion of unchanged initial pixels.

| File | Native corner owners | Added events | Compact semantic bytes |
|---|---:|---:|---:|
| Default.rplib | 19 | 0 | 1,384,841 |
| Flow.rplib | 2 | 0 | 929,337 |
| Icons.rplib | — | — | 22,526,467 |
| Sample form patterns.rplib | 742 | 6 | 28,749,079 |
| Sample UI patterns.rplib | 131 | 0 | 7,903,554 |
| Prototype Starter.rp | 61 | 0 | 2,804,681 |
| Prototyping Basics.rp | 151 | 0 | 5,991,831 |
| Quick Win.rp | 26 | 0 | 1,177,683 |
| UX Prototyping.rp | 113 | 0 | 4,881,014 |
| the-basics-tab-menu.rp | 4 | 0 | 103,831 |
| complex-interactions-required-fields.rp | 7 | 0 | 172,501 |

Icons remains rejected at the pre-existing page-count limit. Every prior imported identity and page/document structure is retained; the exhaustive scoped difference audit has0 unexplained changes. Maximum compact semantic output is **28,749,079 bytes**, below the actual desktop worker's32MiB result cap.

## Validation and frozen boundaries

New focused suites:23 Node tests and20 importer tests. With relevant existing suites, **121/121 Node**, **133/133 Vitest**, and typecheck pass. Tests cover all16 masks, independent resets, scalar radius above half-size, malformed/nonfinite/outside-bit values, missing/unknown bases, wrong/open/edited paths, unsupported surfaces, source disagreement, real Tab Menu cache radius5/mask3 and save/readback. Original source hashes are checked before/after reads. Full-suite/build/package/browser validation belongs to the parent task and is not claimed here.

Retained first-failure logs distinguish a mistaken Tab test oracle3→5, an importer typo repaired before final tests, and audit double-counting/initial-selected attribution corrections. The final old-test changes only replace demonstrably obsolete native cornerRadii/unknown-P71-P81 expectations; legacy snapshots and unknown transform/paint rejection assertions remain.

The shipped dynamic JS and native static geometry builder differ for some oversized fill/stroke corner ceilings; see [the runtime evidence](native-corners-evidence.md). No broad image/vector/ellipse/panel/contained corner support, generic provider inheritance, original generated HTML or native GUI pixel equivalence is claimed. New and old source/evidence/sample hashes are pinned in `native-corners-format-manifest.json`.

Refresh only this stage, in order:

`node research/native-corners-format-census.mjs`

`node --disable-warning=ExperimentalWarning research/native-corners-format-import-audit.mjs`

`node research/native-corners-format-freeze.mjs`
