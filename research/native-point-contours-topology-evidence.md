# Ordinary point commit: native contour topology

This is static evidence for Axure RP 11.0.0.4150. No vendor assembly or original GUI was executed. The pinned `AxureRP11.dll` SHA256 is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`; the distribution extraction is `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. Existing point-commit, point-editing, corners and other released records remain unchanged.

The new probe is `native-point-contours-topology-probe.mjs`; its result is `native-point-contours-topology-probes.json`: **65 checks, 42 retained CIL methods**, all passing. It executes retained instruction arrays in a bounded JavaScript interpreter. Collection enumeration, primitive struct storage, matrix arithmetic, rectangle union and cubic extrema are explicitly identified sinks. This is controlled replay, not execution of the original DLL or a GUI equivalence claim. Sixteen independent topology-oracle comparisons also cover all four-node outgoing-segment masks.

## Implementable contract

1. Ordinary point editing reaches `AjIh.Kj3n` → `VectorShape.TN46(points, false)` → `hN4K`. Do not substitute the separate RN4I/all-view normalization route.
2. The input consists of ordered contours of `z5EE`: anchor `g5Eq`, incoming/lower handle `E5Ed`, outgoing/higher handle `a5EO`, outgoing-segment bit `W5EU` exposed by `o5Eh`. It is not an SVG command list.
3. For every contour, `uHry` initially creates **Last→First**, then the remaining consecutive edges. This happens even when an outgoing-segment bit is false. Each curve uses the previous vertex's higher handle and current vertex's lower handle. Missing handles are replaced by the corresponding endpoint for computation; the line flag is true only when both are missing. `Y5XV` is the previous vertex's outgoing-segment bit.
4. Reindexing removes degenerate temporary curves. Degeneracy requires endpoint Manhattan distance `abs(dx)+abs(dy) < .001`, and either the line flag or both controls individually within the same strict Manhattan threshold of their corresponding endpoint. A cubic with equal endpoints and distant handles remains a loop. This is neither Euclidean length nor curve arc length.
5. After that filtering, a contour containing exactly one temporary curve is retained only if its endpoint Manhattan distance is **strictly less than 1**. Distance `1` or greater removes it. The remaining curves receive dense global indices; previous/next links are cyclic **within each contour**. Relinking writes only links, not coordinates or `Y5XV`.
6. For an unrotated owner, only retained curves with `Y5XV=true` contribute bounds. If **every temporary contour was removed** and the raw first contour has a first point, use that first raw anchor and a zero size. This is a single global fallback, not a fallback per contour. If curves still exist but all their participation bits are false, the selected rectangle union is empty and resolves to `(0,0,0,0)` instead; the first-anchor fallback is not taken.
7. For a rotated owner, raw world-space controls are inverse-rotated about the old sizing-rectangle center **before** curve construction and reindexing. All retained curves then contribute bounds, including `Y5XV=false` curves. There is no first-anchor fallback. Empty curve bounds produce `(0,0,0,0)` in that inverse-rotated coordinate plane; the normal forward-center/owner-rectangle process still runs.
8. Normalization uses the original raw contours, not the filtered curve lists. Original contour count, point order, both available handles and outgoing-segment flags survive. Isolated points can therefore normalize outside `[0,1]` when a different contour supplies the bounds. The product should filter only its bounds calculation; deleting commands would be a different operation.

The `.001` metric is evaluated in owner-local **physical coordinate units** after inverse rotation when applicable, never in normalized percentages. Native sizing-frame creation and its strict `abs(angle)<1e-5` branch are independently closed in `native-point-contours-rotation-evidence.md`; this report's nonzero-angle fixtures use 37°, 45° and 90°, avoiding any inference about the frame-creation threshold.

## Method and IL anchors

| Method | Token | Evidence and relevant IL |
| --- | ---: | --- |
| `AjIh.Kj3n` | 100685481 | `native-point-editing-evidence-mode-cil.json`: group point records by contour, `nbPd` gate `0x42–0x49`, `TN46(...,false)` at `0x225–0x238` |
| `VectorShape.TN46` | 100702684 | `native-point-editing-evidence-shape-cil.json`: `hN4K(false)` then Location, Size, normalized controls |
| `VectorShape.hN4K` | 100702689 | `native-point-commit-evidence-bounds-cil.json`: inverse old-center matrix `0x4C–0x65`, transform raw controls and `wHrl` `0x6A–0x81`, all-curve selector `0x86–0xAF`, normalize original input `0x1C6–0x21A` |
| `VectorShape.iN4x` | 100702690 | `native-point-commit-evidence-normalize-cil.json`: `wHrl` `0x29–0x2F`; all-pruned first-point fallback `0x30–0x77`; selected bounds `0x7C–0xB5`; minimum and raw-output projection `0xB6–0xEB` |
| `WHV4.wHrl` | 100723170 | `native-point-commit-evidence-curves-cil.json`: `Select(uHry)` → `MHr4` → `XHrT` |
| `WHV4.uHry` | 100723171 | Same file: first `Last(raw)` at `0x07–0x0D`; previous/current construction at `0x20–0x3E`; cyclic initial links at `0x5E–0xA6` |
| `I5hl..ctor` pair | 100720124 / 100720125 | `native-point-commit-evidence-bezier-cil.json`: previous anchor/higher/current lower/anchor `0x11–0x2B`; outgoing bit `0x4A–0x52`; line flag and missing-handle replacement in second constructor |
| `WHV4.MHr4` | 100723166 | `native-point-commit-evidence-contours-cil.json`: degenerate-filter/remove `0x22–0x73`; singleton endpoint test `0x8B–0xD9`; nonempty retention and reindex `0xDA–0x115` |
| `ReIndex` predicate | 100723281 | `native-point-commit-evidence-reindex-filter-cil.json`: `K3ju(.001)` |
| `I5hl.K3ju` | 100720164 | `native-point-commit-evidence-degenerate-curve-cil.json`: endpoint test, line shortcut and both endpoint/control tests; replayed through opaque branches |
| `d5pN.b5p7` / `f5wV.z5wa` | 100720531 / 100721991 | `native-point-commit-evidence-degenerate-line-cil.json`, `...-length-cil.json`: subtract → `abs(X)+abs(Y)` → strict `clt` |
| `WHV4.KHr8` / `cHru` | 100723167 / 100723169 | New `...-reindex-link-cil.json`: dense indices and per-contour links |
| `N5lk.Link` / link setters | 100722289 / 100722265 / 100722267 | New `...-link-cil.json`, `...-link-setters-cil.json`: only `z5lU` and `M5lZ` fields written |
| Rotated selector | 100702830 / 100702831 | Retained `...-curve-bounds-select-cil.json` and new `...-selectors-cil.json`: select all `h3jv`; no `Y5XV` gate |
| Unrotated selector | 100702832 / 100702833 / 100702834 | Same files: `Where(Y5XV)` then `h3jv` |
| `z5EE.v5ED` | 100719036 | `native-point-commit-evidence-control-transform-cil.json`: transform anchor and present handles; constructor receives original `o5Eh` |
| Empty rectangle / size constants | 100722161 / 100723002 | New `...-rect-static-cil.json`, `...-size-static-cil.json`: `O5sD=(0,0,0,0)`, `QHVg=(0,0)`; distinct from NaN constants |

The collection helper names were not used alone as evidence: `lbiN` creates TypeSpec `1B000990` with signature `15129FF0011E00`, resolving to `<Where>d__0\`1`, TypeDef 33556476. Its new retained `MoveNext` record gates yielding on a true predicate at `0x242–0x263`. `xbio` creates TypeSpec `1B0009A8`, signature `15129FB8021E001E01`, resolving to `<SelectMany>d__25\`2`, TypeDef 33556462; its new record contains source/selector/nested enumerator flow. These are explicit collection sinks in the probe, with the retained bodies as static provenance.

## Empty versus degenerate inputs

| Input condition | Native geometry-function behavior |
| --- | --- |
| `[]` outer list | `wHrl` returns empty; zero rectangle union; minimum-owner expansion; normalized output remains `[]` |
| `[[]]` empty inner contour | `uHry` calls `Last(empty)` and throws `InvalidOperationException` before fallback |
| One raw point, both handles absent | Self temporary line is pruned; unrotated first-point fallback; raw point remains in normalized output |
| Multiple isolated contours, all pruned | Unrotated fallback uses only the first raw point; every raw contour is still output |
| Isolated contour plus valid contour | Isolated contour does not affect bounds; its points still normalize with the valid bounds |
| One point with nondegenerate loop handles | Its temporary loop may survive; outgoing false suppresses it only in unrotated bounds |
| All raw outgoing flags false, nondegenerate curves exist | Unrotated zero union, not first-point fallback; rotated branch includes the curves |

Ordinary `Kj3n` with `jj3z=false` and no input nodes does **not** call `TN46`. Its ordinary nonempty grouping cannot manufacture an empty inner list. Therefore the direct empty-outer geometry result is not evidence that an empty widget can be committed through the UI. Special in-progress gesture branches (`jj3z`/`tj3j`) and deletion UI policy are not generalized here.

## Independent product representation mapping

The new `authoredCarriers` helper is explicitly an **adapter convention**, not a recovered native SVG import function:

- Each `M` begins a native contour and a first anchor.
- Each `L`/`C` marks the prior anchor's outgoing bit true and adds a current anchor. `C` supplies the prior higher/current lower handles; `L` leaves both absent.
- An open contour ends with false outgoing bit; `Z` makes that last bit true.
- An explicit duplicate endpoint is retained. Its synthetic closing zero-length line may be pruned for bounds; the stored command and raw point are not removed.
- Unavailable incoming handle of the first anchor and outgoing handle of an open last anchor are NaN. A native open contour can retain non-NaN inactive closing handles; current M/L/C/Z alone cannot preserve that extra information. The rotated selector makes that limitation observable. Do not invent those handles or claim full native-carrier equivalence.
- Interior false outgoing bits have native bounds semantics, but splitting them into independent SVG subpaths could alter fill grouping. This research does not widen the existing native importer, which still rejects interior breaks and raw contours shorter than two vertices.

`recoverVectorPath` currently preserves a bounded painted snapshot, not every raw topology field. Its suppression of coincident straight segments and lack of inactive endpoint handles must not be mistaken for an invertible carrier encoding. No importer production changes were made in this investigation.

## Numeric fixtures

Full carriers, explicit authored commands and expected results are retained in the new probes JSON under `authoredFixtures` and `results`. These examples use ordinary TN46 `false` normalization and minimum dimension `max(borderWidth,1)`:

| Case | Expected owner / output |
| --- | --- |
| World raw `M(12.25,30.75)`, rotation 0, stroke 4 | owner `(10,28,4,4)`; normalized anchor `(.5625,.6875)` |
| World raw isolated `M(-50,-60)` plus line `(10,20)→(30,40)`, rotation 0 | owner `(10,20,20,20)`; isolated normalized anchor `(-3,-4)` retained |
| Old owner `(100,80,200,100)`; main normalized rectangle first anchor changed to `(-.25,0)`; distant line `(2,2)→(2.0000025,2)` | owner `(50,80,250,100)`; the world `.0005` distant line contributes no bounds, but both its points remain |
| Same old owner, only that tiny line, stroke 4 | owner `(498,278,4,4)`; both raw endpoints remain |
| Same old owner, cubic `M(0,0) C(0,1) (1,1) (0,0)` | owner `(100,80,89,75)`; equal endpoints do not make the curve degenerate |
| Old owner `(100,80,100,60)`, angle 90°, stroke 4; world raw point `(125,96)` | rotated zero union becomes exact rectangle `(260,-40,0,0)`; owner `(258,-42,4,4)`; normalized anchor `(34.5,34.25)` |
| World raw `(200,200)→(200.00062,200.00062)`, old `(0,0,100,100)`, angle 37° | world Manhattan `.00124` would retain; inverse-rotated local Manhattan is below `.001`, so both temporary curves are pruned and the rotated empty-union route applies |

The probe also covers exact `.001` and `1` thresholds, both endpoint/control thresholds, every four-point outgoing-bit mask, closed/open/explicit-duplicate endpoints, nondegenerate inactive closing controls, multiple contours and retained raw handles. Numeric cubic extrema are an independent sink; the frozen previous 98-case native solver replay remains the evidence for its tiny-polynomial edge behavior.

## Remaining limits

No new general affine-transform, group/master conversion, native history, GUI gesture legality or generated SVG paint equivalence is claimed. Bounds filtering and the output point list are distinct. The normalizer can output points far outside `[0,1]`; product coordinate/bounds limits can still reject a commit and must remain explicit. Empty list policy, importer topology expansion and a lossless inactive-handle representation require separate decisions. The scope here is sufficient for a bounds-only adapter that preserves existing M/L/C/Z command lists under the documented representation convention.

Companion rotation evidence: `native-point-contours-rotation-evidence.md`. Current implementation review will be a separate `native-point-contours-topology-review-*` record, so this source contract does not silently acquire future production hashes.
