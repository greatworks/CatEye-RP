# Runtime transform special targets — exact-source consumer evidence

The final run passes **57/57** bounded cases. These execute retained original JavaScript consumers in NodeVM with declared DOM/query and scheduling facades. This is neither an original generated-page browser comparison nor original Axure GUI validation. No product files, prior evidence or vendor DLLs were changed/executed.

The manager is implemented in **repeater.js**, not a separately assumed dynamicPanelManager file. The action-argument layer is now connected through compression, child eligibility, public Move and actual row reflow consumers.

## RTS01: Special Move dispatch and old rectangle

Source: action.js:702–742; repeater.js:2340–2360.

widgetsBelow/widgetsRight execute directly and do not enter the ordinary per-event resize/move queue. Delta mode evaluates both axes; other modes pass NaN. Only onResize/onPanelStateChange select old resizing rect when present. In resize context magnitude=current primary size−old primary size; otherwise magnitude=1. NaN primary delta becomes magnitude; explicit delta is multiplied by sign(magnitude). Threshold uses old bottom/right; the cross-clamp starts at current source position and uses max(old,current) cross size.

## RTS02: Plain sibling selection

Source: repeater.js:2362–2483,2507–2604.

Within the nearest item/state scope (after visible-layer ascent), inspect actual child order. Candidate leading coordinate must be >= threshold; its cross interval must overlap strictly. Endpoint touch is excluded. Source, invalid widget IDs and fixedVertical are excluded; there is no hidden/disabled/limbo test inside these consumers. Dynamic-panel cross dimension comes from its shown state. Ordinary panels are not recursively searched. Margin contributes to clamp; malformed margin makes the original numeric reader return NaN and prevents compression.

## RTS03: Layer and scope branches

Source: repeater.js:2396–2465,2485–2577.

Visible layer/RDO ancestors are ascended with container offsets; item/state scope stops ascent. Eligible sibling layers may move as a whole; otherwise recurse. The recursive call omits complementary delta, so partially moved layer children lose the non-primary delta. A source in a state nested inside an item does not invoke the explicit whole-item push. Generated/native layer representation is not equivalent to the independent product flat group model.

## RTS04: Actual public Move consumer and animation options

Source: axQuery.std.js:457–483,523–540; move.js:125–223.

Compression invokes original public moveBy then original MoveWidget. No easing means instant. A truthy easing plus falsy duration becomes500 in the public helper. Instant order is fitParentPanel→releaseMove→onMove; animated onMove occurs before completion fit/release. Moved cache is assigned before CSS paint. With two nonzero axes and no trajectory, the original consumer takes the arc branch (the non-clockwise choice). Zero primary may still move complementary axis. Even zero/zero public move takes the no-op event/release route.

## RTS05: This Item SetSize target and scheduling

Source: action.js:1258–1284,1528–1552; repeater.js:1110–1133.

The action obtains current item dimensions then calls _getSizeFromInfo without its fifth targetElement argument: Target is undefined during evaluation, This remains source. Normal evaluation restores the prior target. It invokes setItemSize immediately, ignoring anchor/easing/duration and bypassing ordinary transform queues. Empty/NaN dimensions preserve current dimensions; negatives clamp to zero. Outside a repeater it evaluates then does nothing. Equal size changes cause no event.

## RTS06: This Item actual reflow

Source: repeater.js:1080–1290.

setItemSize writes width then height via pushItems with event suppression and finally raises exactly one onItemResize on the item. Each nonzero push writes item CSS and resized cache. Unwrapped primary changes shift later items; secondary changes change only the item and the repeater cross maximum. Wrapped primary changes shift later items in that column/row and adjust the repeater maximum primary sum; wrapped secondary changes shift all later groups by the difference in group maxima. Following-item movement updates moved caches without onMove. Repeater size change calls fitParentPanel. Explicit source compression pushes its row only when the final direct scope equals that item and fitToContent is false.

## RTS07: Ordinary arc numerical fixtures

Source: move.js:181–207; math.js:242–366.

Eight direction/mode fixtures execute full original arc and inversePathLengthFunction at controlled eased fractions0,.25,.5,.75,1. The inverse sampler bisects the longest chord interval until longest*100<=estimated total length, labels cumulative chord length, and linearly interpolates the containing interval parameter. This is actual source arithmetic with a controlled animation scheduler, not real browser timing.

## Concrete fixtures

- Source rectangle(100,100,100,50), currentheight80 and oldheight50: inferred Below pushes an overlapping sibling from y200 to230. Explicit12 pushes to212; with shrink it pushes to188. Same size makes an explicit primarydelta0.
- Strict horizontal interval[100,200]: candidate[90,100] and[200,210] do not move; [90,101] does. Leading edge exactly threshold is eligible.
- Three vertical rows100×20: changing middle row to120×35 yields repeater120×75 and third-row y55; one onItemResize is recorded after both axis updates.
- Animated two-axis compression from(110,160) by(10,10), no trajectory: controlledfraction.5 is(112.92893218813452,167.07106781186548), not the straight midpoint.
- Eight asymmetric40×20 arc fixtures give exact source samples for every sign pair and clockwise/anti-clockwise; see compact fixture JSON.

## Scope and limits

- Execution is NodeVM exact-source slices/full math+move with an explicit in-memory DOM/query facade. No browser or original Axure GUI was run during this task; no vendor DLL methods executed.
- The facade supplies local numeric CSS, rectangles, type/parent identity and visibility. It is not an independent validation of generated DOM structure, native layer container creation, transformed/shadow bounding boxes, fixed/percentage layout or jQuery box sizing.
- Animation scheduling uses controlled step fractions and completion; no real jQuery easing, simultaneous active tween, callback reentrancy, interruption or timer equivalence is claimed. The source event/fit/release call order is recorded, but listeners, fitParentPanel and queue release are sinks.
- Expressions supply explicit string-like values; the native compiler and full expression interpreter are not executed. This Item normal evaluation Target undefined is proven by exact handler/helper calls, not by parsing a real RP action.
- Repeater layout records are initialized with original resetItemSizes, then setItemSize/pushItems execute. Dataset filtering/sorting/refresh, deletion during animation and full nested repeater lifecycle are not exercised.
- Borders are zero in positive row fixtures. _updateRepeaterSize statically adds borders based on repeater orientation (rather than changed axis); real browser box-model effects remain unclosed.
- Hidden ordinary siblings are accepted by these direct consumers in controlled fixtures; this does not prove upstream whole-runtime target selection always accepts unplaced/hidden objects.
- The first32-case run failed solely because the result-snapshot facade enumerated the window sentinel without a style object. The old script/output are retained, not rewritten as native failures. The corrected32/32, expanded48/48 and final57/57 runs are separate artifacts.

## Reproduction and files

Run `node research/runtime-transform-special-probe.mjs <new-output-path>`; the runner refuses to overwrite an existing report. The script may also be imported safely for `harness()`/`runCases()`. Exact source SHA checks run before slices execute.

- `runtime-transform-special-final-probes.json`: all57 observations and event/cache ordering.
- `runtime-transform-special-fixtures.json`: compact arc samples and full consumer outputs.
- `runtime-transform-special-evidence.json`: contracts, source hashes/ranges and historical failure bindings.
- `runtime-transform-special-manifest.json`: final research file hashes.

## Source hashes

- repeater.js: `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b`
- action.js: `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3`
- axQuery.std.js: `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd`
- move.js: `c823954b5ed5862d56176b8984837e8f26588540ee4768d4483d68a399b95644`
- math.js: `f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883`
- doc.js: `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1`
