# Native point editing: format and identity

Target Axure RP11.0.0.4150; DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. This is read-only static CIL and stored-file evidence. No original DLL/application execution, original GUI comparison, or product modification occurred.

## A rectangle-shaped path is not Rectangle identity

`Shape` and `ControlPoints` are distinct common-object fields. The meaningful native test is `cSqL.DSO4` (100708406, IL7–15), which checks Shape300. `VectorShape.LN4g` (100702676, IL7–43) returns the stored/cache contour list for300; other shapes call `jN4k`, replacing that list through `DN4W` before returning. This is direct executable control-flow evidence, not a guess from the enum name Vector.

`jN4k` (100702679) reads the current sizing rectangle and effective radius/border/corner parameters before calling `L5vW.w5Qk`. `NIwY` (100702762, IL401–465) calls LN4g(0) before writing ControlPoints. Thus a Shape0 saved outline is a snapshot of parameter generation at save time; Shape300 treats the stored normalized points as its geometry. Both still use the current sizing/world transform when painted. Shared point data does not mean fixed pixel dimensions across adaptive views.

Two real UI-library records demonstrate the distinction even when all points are rectangular:

| Source ID | Package ID | Shape | Size | Normalized anchors |
|---|---|---:|---|---|
| 04417a8fd0fe4f8e8734460a02a0b2b2 | 6881ba8b98974feb8ba4bf4d89c9b422 | 300 |350×80| (1,0),(1,1),(0,1),(0,0) |
| 25a13179ceeb4c69a7ac383ce58dd7f0 | 5c6f3b90e33443189fa470be22096bbc | 300 |350×80| same |

Both have double-NaN handles and all four outgoing segments enabled. Their default cache supplies P71=0 and P81=15. The standalone geometric helper accepts both as rectangles, while the native importer correctly keeps **type path**, without cornerVisibility. Their UI file SHA-256 is `cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b`; exact part hashes and raw records are in [the inventory](native-point-editing-format-inventory.json). No editing history was recovered, so these records do not identify the original author gesture.

## Geometry writes and identity writes are separate

`DN4W` (100702683) clears dependent caches and stores contour data in cN89. `TN46` (100702684) normalizes supplied geometry through hN4K, writes its computed location/size through xJ0B/uJ0j, then calls DN4W. **TN46 does not set Shape.**

`qNnT` / ChangeShapeTo (100702809) is a separate operation: its supplied-shape branch can store contours, invokes set_Shape and invalidates geometry. `set_Shape` (100702790) stores SN8X at IL388 and also has type-default/cache/notification work; it is not an ordinary adaptive style-property write. The exact point-mode entry/gesture/undo path is the companion investigator's scope. This report does not equate entry into edit mode, a no-op drag and a committed point change.

Two Form-library Shape300 records, `b607dd0c4ccc42e2b83eeb7cda35167f` and `b365f0e6db904531bfec85ad07a1d17e`, retain local OD **P71=2** despite their11-anchor custom tooltip outlines. This is positive stored evidence that a radius field can survive on custom geometry. It is not authority to regenerate the path from that field or to claim every native conversion deletes it. The original Form hash is `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`.

## Adaptive and persistence boundary

The frozen11-file census contains2,805 VectorShape records:1,388 Shape0 and1,127 Shape300. The current narrow reread verifies four records in the two original files; it does not rerun or relabel all historical semantic admission. Thirteen Flow Shape300 owners contain three adaptive style references each. The old semantic count6 describes the alternating GUID/reference array length, not six views. The observed referenced style lists are empty, so they do not prove nonempty per-view point editing.

The shared Shape/ControlPoints fields remain outside AdaptiveStyles. Normalized custom points still scale through WNn5→eJmT→A5ph/D5pZ, while location/size/style use their provider contracts. A product should keep custom identity shared, preserve per-view geometry and visual declarations, and avoid flattening inactive local maps when editing the visible view. Retained radius/mask/state data must not be mistaken for an instruction to turn a custom path back into a rectangle.

The current complete UI-file reader→importer→save/readback succeeds and preserves both witnesses as path. [Import verification and complete widgets](native-point-editing-format-import.json) bind current reader/model hashes. [The two-page fixture](native-point-editing-format-custom-rectangles.rea.json) passes parseDocument and is explicitly a **research extraction**; widget IDs, text, style, geometry and commands are unchanged. The first research assertion forgot the converter's explicit closing L; only that oracle was corrected.

## Proposed implementation guard

Preserve a distinction between parameter identity and geometric qualification. Conversion on a genuine committed edit should be one-way unless a separate explicit shape-conversion command is invoked; a later rectangular outline is insufficient. Undo must restore identity and the prior path, alongside the normal document transaction. Keep stored corner/effect declarations but stop parameter reconstruction once custom. Use the companion point-editing command evidence to choose the exact entry/no-op/commit boundary, rather than deriving it from file layout.

Original GUI gestures, native font/render pixels, automatic custom-to-Rectangle restoration, and every provider-side consequence of all point commands remain outside this report. New source/sample/evidence hashes are in `native-point-editing-format-evidence.json`; old frozen artifacts were not changed.
