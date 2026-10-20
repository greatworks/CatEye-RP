# Native line patterns and endpoint styles — Axure RP 11.0.0.4150

This investigation reads the pinned managed PE metadata/CIL and eleven unchanged official `.rp`/`.rplib` files. It does not execute the original DLL, original GUI, or stored interactions. The production reader and importer are self-written. Rendering probes and geometry work are separately recorded in `line-style-runtime-evidence.md`; source-level replay is not native GUI parity.

## Exact native carriers

`Axure.Constants.PName.LINE_PATTERN=16` and `LINE_ENDS=17` are confirmed by metadata and property setter CIL, not by matching labels alone. `TtuV.ituB.StyL` (100717394) loads16 at IL34, boxes `Axure.Platform.LineStyle` at37, and writes one property at43. `dtyx` (100717396) similarly writes17 and boxes `vHea.SHeh`. Getter tokens100717393/395 use the same typed properties and the existing determined/overridden access predicate.

`Axure.Platform.LineStyle` is the modern carrier (TypeDef33558158):1Solid,2LongDash,3MediumDash,4ShortDash,5DashDot,6DashDotDot,7LongDashShortDash,8Dot,9None. It is not `AxDashStyle`0..5. The parser maps the nine concrete values to the shared kebab-case model enum and rejects zero, sentinels, nonintegers and unknown values.

`SHeh` is a single atomic pair, not two independently inherited properties. Constructor100725050 stores argument1 to `aHep` at IL37–39 and argument2 to `mHeq` at64–66. Writer `B5Sy.H599`100718355 reads these at41/86; reader `e595`100718357 reads two integer values and calls that constructor at95. The observed serialized map has exactly `Start` and `End`. `r5R7.b5Ra` (AddArrowHead) uses `aHep`, and `m5RX` (AddArrowTail) uses `mHeq`. Key literals remain obfuscated in CIL; literal field identity is jointly supported by the exact two-field source maps and matching typed serializer/reader structure.

`Axure.Platform.ArrowStyle` (TypeDef33558125) has the following concrete values:

| Value | Name | Value | Name |
|---|---|---|---|
|1|None|16|TBar|
|2|ReverseCrow|17|HollowDiamond|
|3|FilledTriangle|18|FilledCircle|
|4|SkinnyTriangle|19|HollowCircle|
|5|Diamond|20|FilledSquare|
|6|CrossBar|21|HollowSquare|
|7|HalfReverseCrow|22|CrowHollowCircle|
|8|CurvedReverseCrow|23|CrossBarHollowCircle|
|9|DoubleReverseCrow|24|CrowCrossBar|
|10|Crow|25|TBarReverseCrow|
|11|DoubleFilledTriangle|26|LargeHollowTriangle|
|12|HollowTriangle|27|LargeFilledTriangle|
|13|DoubleHollowTriangle|28|LargeHollowDiamond|
|14|DoubleCrossBar|29|LargeFilledDiamond|
|15|SlantedBar|||

Indeterminate=-2147483648 is not a concrete endpoint and is rejected. There is no newly established independent author cap/join or arrow-size PName in this stage; the existence of drawing enums does not prove a separately editable field.

## Managed pen patterns

`cSqL` static constructor100708486 builds the `XSUT` dictionary. Solid1 uses `AxDashStyle.Solid`; ShortDash4 uses `Dash`; Dot8 uses `Dot`. Explicit arrays are LongDash `[17,8]`, MediumDash `[9,4]`, DashDot `[9,4,2,4]`, DashDotDot `[9,4,2,4,2,4]`, and LongDashShortDash `[17,4,5,4]`. The three larger arrays were read as little-endian Double data from PE field RVAs; their raw bytes are retained in `line-style-dash-rva.json`.

`F52D.k52A`100720067 selects the actual arrays for basic dash styles: Dash→`T52Z`100720052=`[3,1]`; Dot→`S52T`100720055=`[1,1]`. `cSqL.OSdm`100708291 returns immediately for None9; for non-Solid patterns it assigns `AxDashCap.Round=2` at IL227–229, and then assigns a basic or custom pattern. These are managed pen inputs. The separately owned `line-style-svg-evidence.md` and its CIL replay record the final SVG writer behavior; do not substitute an arbitrary CSS `dashed` or infer SVG default caps from the managed input table alone.

## Actual corpus and recovery

The source hashes, exact package/object IDs, raw DOA flag values and values are retained in `line-style-census.json`. Across raw property/cache occurrences there are1,998 Solid records and2 None records. The two None records are RepeaterStyle values, not direct ordinary widget style owners. No observed record uses dash/dot values2..8. There are1,598 None/None pairs and9 None/FilledTriangle pairs. All9 positive pairs are explicitly local determined+overridden properties.

Eight positive carriers are VectorShapes, one is a native Connector. Two real Default library lines are admitted by the existing importer:

- Vertical: package `7f0995dc656048148a4a1d6b88bd6c06`, object `0648bd14641346f39ff0c92cb3f77b5e`, Shape30, stored5×200.
- Horizontal: package `24edbbd5a4354c77b0e7bf30769c7252`, object `1ad46afa33eb4c1582350f2b08ff2fbe`, Shape29, stored200×5.

Both use stored two-vertex open contours and `Start:1, End:3`. Default.rplib SHA-256 is `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`. The parser also decodes the six other positive VectorShape paths, but they remain omitted by the pre-existing nonzero-rotation gate (Starter1, QuickWin2, UX3). The Connector in Basics lacks a simple stored SIZE and includes endpoint binding, routing directions and control points; it is not relabeled as an ordinary line. `line-style-import-audit.json` distinguishes the nine native carriers from the two actually imported arrows and lists every omission reason.

The audit reimports all eleven files and validates strict model serialization/readback. Final16/17/80 recovery adds no widget/event/action identities, supplies1731 imported base pattern values,2 positive arrow owners and67 partial-border masks, and preserves earlier menus/tables/trees/frames/hyperlinks and gradient evidence. Icons remains over the existing page budget. The maximum compact semantic result is28,689,168bytes (below32MiB and the64MiB worker bound).

## Border visibility investigation and boundary

`ituB.Utyv`100717426 writes PName80 and boxes `Axure.Platform.Position`. Bits are Left1,Top2,Right4,Bottom8, so CSS clockwise output must use bit order `[2,4,8,1]`. None0 and All15 are distinct complete masks; other enum members/sentinels are not four-side masks.

The direct local corpus has81 partial-mask owners:45 VectorShape Shape0,28 TextBox and8 ComboBox. All45 vector masks are Shape0, with distribution8×14,4×2,2×16,6×2,3×2,1×8,5×1. There are no zero-sized stored vector rectangles in this census. `line-style-geometry-census.json` retains exact source records.

The native JSON writer `wJe6.jJeK`100694305 calls `get_FriendlyTypeName` at178 and writes it at185. VectorShape's override100702785 reads its Shape field, then `cSqL.LSOc`100708359 looks up the shape-name dictionary. The dictionary's Shape0 literal remains obfuscated; metadata independently names Shape0 Rectangle. This ties friendly naming to native shape identity but is not a decoded English literal proof. Original JS only performs the specialized four-side stroke path rebuild for `friendlyType === 'Rectangle'`. A saved arbitrary Shape0 path cannot safely acquire rectangular geometry just from that number: the existing `recoverRectanglePath` checks the complete perimeter/handles before recognizing a rectangle.

Final PName80 admission is limited to known rectangle VectorShapes and ordinary input/textarea/select surfaces. Vector admission requires Shape0 **and** a complete validated rectangular control path. The importer independently verifies the resulting normalized path with `createLineStyleRenderer().rectangleRadii`: one clockwise closed contour, a complete perimeter, and only the observed straight/0.44-handle rounded-corner geometry. The identifier alone is insufficient. A later arbitrary point edit no longer qualifies for the renderer's rectangle-specific side rebuild. No persistent native-friendly-type flag was invented.

The tuple is atomic `[top,right,bottom,left]`; all16 masks are accepted within these type/geometry gates, including explicit none/all. The stored stroke width is retained. A Selected/IX mask does not rewrite width and can explicitly restore all sides. Image, text/tree labels, ellipse, arbitrary path and panel recovery retain their earlier none/all snapshot boundary; partial masks on those surfaces remain unknown. This preserves the independently constrained image gate rather than giving images unproved rectangle behavior. The zero-width legacy snapshot is marked `recovery: legacy-none-snapshot` in provenance.

Actual partial-mask recovery is67 owners:31 rectangle boxes,28 inputs,8 selects. By file: Sample form patterns38, Sample UI patterns10, Prototype Starter1, Prototyping Basics18. There are no newly imported identities or changed widget/event/action counts, and no real saved width changed by the zero-mask correction in this corpus. Synthetic coverage specifically verifies a hidden-border rectangle retains a nonzero stored width.

The other14 raw source-mask owners are **container recovery omissions**, not rejected rectangle paths:13 belong to the three currently unsupported native repeater templates (Default3, UI10), and1 is in UX's `Requested Panel` state, whose owner remains rejected by the prior fit-content automatic-text/unknown-bounds guard. `line-style-mask-owner-probe.json` retains each child's original ID, direct containing `diagram-objects` reference, repeater `BaseDiagram` or panel `panel-diagrams` owner reference, and the actual importer omission. No new template or panel bounds were fabricated to recover those masks.

## Parser/import protocol and tests

The native worker protocol remains recoveryVersion1 with additive recognized style fields. `linePattern` is one supported enum string; `lineEnds` contains exactly two concrete enum strings; `borderVisibility` contains exactly four booleans. A partial/unknown pair rejects that property; active IX/Selected invalid values reject the complete state. Local inactive snapshots are not promoted, state OD filtering is unchanged, cached identity matching remains unchanged, and unresolved inherited bases still only permit the previously proven independent solid-color subset. Explicit `none/none`, `solid`, and visibility-none/all state resets survive even when equal to base values. Importer validation independently rechecks the enum/pair/tuple and geometric type gates, including selected/error/hint patches.

Focused validation commands:

```powershell
node --test research/scripts/read-rp-line-style.test.mjs research/scripts/read-rp-appearance.test.mjs research/scripts/read-rp-interaction-styles.test.mjs research/scripts/read-rp-selected-filter.test.mjs
npx vitest run tests/import-rp-line-style.test.ts
npm run typecheck
node --disable-warning=ExperimentalWarning research/line-style-import-audit.mjs
node research/line-style-mask-owner-probe.mjs
node research/line-style-evidence.mjs
```

The first command passes66 tests (28 new), the import suite passes32 new tests, and typecheck passes. Synthetic coverage exercises all29 concrete arrows/all9 patterns, all16 border masks, exact pair/tuple keys, sentinel/type/bounds rejection, cache/local priority, explicit state clearing, inactive metadata, forged protocol, invalid/open/reversed/edited/compound rectangle geometry, independent state omission versus atomic Selected rejection, and unchanged source records. No pre-existing test expectation was changed. Only the two Default native positive endpoints and67 real partial-border owners count as positive corpus recovery; synthetic arrows/dashes are not claimed to occur in the corpus.

The final two commands refresh current-stage evidence and hashes after the native audit; they do not change original samples or previous milestone reports. `line-style-evidence.json` summarizes the exact observations and limitations; `line-style-manifest.json` pins this stage's native evidence, production dependencies and original sample bytes. Original application execution, original GUI rendering and full visual parity are not claimed by these static/reader tests.
