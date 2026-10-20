# Native placement: format and generator evidence

This is static research against the retained Axure RP 11.0.0.4150 distribution. No target DLL or original application was executed. `adaptive-placement-format-census.json` records raw package/object identities and source hashes; `adaptive-placement-format-replay.json` is a bounded CIL interpretation with explicit dependency stubs, not an original application or pixel comparison.

## Confirmed carrier and conversion

`PName.PLACED` is 111, distinct from Boolean `VISIBLE` 110. Its value is `Axure.Constants.BoolOverride` (TypeDef 33556628): IGNORE=0, TRUE=1, FALSE=2. A Boolean, fractional number, or unrecognized integer is not this carrier. DOAName retains the ordinary Determined/Overridden bits.

The exact chain is `ituB.Ytu4` 100717281 → key111 → `y5bJ`; `y5bJ.U5bH` 100718041 → value → `mJG4.True` 100691415. True is strictly `value == 1` (IL7–9). `mJG4.False` 100691416 separately checks 2. `jtoq.ctz9` 100717691 and `w5GQ` 100717752 read the effective key111 enum. `KJm7.OIuf` 100695335 returns its True result, additionally requiring that transient `UnplacedOverride` is false.

The generated style writer `wJe6.rJeU` 100694323 branches on key111 at IL94–96, decodes `Limbo` at IL397–425, applies the lowercase-first-character writer 100694419, then writes `!U5bH` at IL435–450. Thus an eligible local declaration writes **1 → limbo:false, 2 → limbo:true, 0 → limbo:true**. IGNORE=0 must not be equated with absent data. This is observed control flow, not an authored zero-valued sample. `EJep` 100694319 / `RtTr` 100717059 / its predicate 100717092 / `a5FY` 100717956 establish local property eligibility as Overridden and not Indeterminate. They do not establish that flattened cache records should be filtered or promoted identically.

## Base class and scope

`xNxg.wNxE` 100699330 skips the unplaced-class path for IsContained at IL468–474. Its ordinary noncontained path calls `cNxk` 100699331 using `<GetClass>b__6_0` 100699474 (`!OIuf`). `aNeN` 100699329 adds the decoded literal `ax_default_unplaced`. `cNxk` also has a reference/master ancestry path; the replay supplies that result as a Boolean dependency and does not claim to recover arbitrary master propagation. The initial wrong replay expectation that contained items also gain this class failed; that log is preserved as `adaptive-placement-format-replay-first.log`, and the corrected assertion follows the actual branch.

Page placement is not established by this ordinary diagram-object path. Root table/menu/tree placement can be represented separately; contained labels, table cells, menu-owned tables, tree nodes and other compound descendants remain outside independent placement recovery. Runtime type exclusions are documented separately in `adaptive-placement-runtime-*`; no source cache owned by a Page is treated as that Page's own placement.

## Real corpus

All 11 retained sample files were decoded read-only and hashed before/after. There are 1,598 P111 records, all numeric 1: 1,213 cache entries, 363 IX-state entries, 11 document DefaultStyle records and 11 FormatPainter records. Of those, 1,228 are OD and 370 are determined-only. All 363 state entries are inactive/non-OD. There are **zero direct Base widget MyStyle P111 declarations, zero local AdaptiveStyles P111 declarations, zero values 0 or 2, and zero direct placed/limbo object fields**. The 25 nonempty AdaptiveStyles maps point to 75 styles whose property lists are empty. Counts are source records, not distinct widgets.

## Recovery contract and boundaries

The independent importer can restore direct Base MyStyle OD enum 1/2/0 as placed true/false/false, preserving raw enum and source proof. Base true is omitted from the editable project because placed defaults to true. A local adaptive true remains explicit to reset inherited false. Placement is not a visual WidgetStyle field or an interaction-state field, and does not change `hidden`.

Known true from an exact complete default/matched cache chain requires no project field. Nontrue default/named cache values are rejected with source attribution in this stage: there is no real positive witness and the full cached effective-provider path has not been replayed. An inactive direct declaration cannot override the cache. Unknown enum values and raw Booleans are rejected. Unsupported local maps continue to reject the whole owner rather than selectively dropping placement.

Ten bounded CIL replay cases pass: six enum/transient-override combinations and four contained/class combinations. These do not execute native font/layout/rendering or prove GUI equivalence. Raw binary fixtures and parser/import tests added after this research freeze are explicitly SYNTHETIC.

## Files

The evidence JSON and manifest bind the pinned DLL, relevant retained CIL, raw sample hashes, new extraction files, census and replay. Previously released reports are unchanged. Source DLL SHA256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
