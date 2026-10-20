# Runtime transform: drag context and special Move evidence

Target: Axure RP 11.0.0.4150. Captured 2026-10-20. This is an independent implementation input, not a claim of native GUI parity.

## Execution and provenance

`runtime-transform-drag-probe.mjs` executes the complete retained `drag.js` in Node VM and three exact `action.js` slices (701–741, 866–1042, 1045–1059). The final result is **52/52**. Source files and slices are SHA-256 pinned in `runtime-transform-drag-final-probes.json`; the companion manifest verifies the report, every probe revision and output, and the four original files.

The harness substitutes document listeners, numeric page/viewport coordinates, time, event recording, jQuery Event/extend, and scrolling providers. It exercises the modern non-IE desktop branch. It does not drive a real pointer, render the original editor, execute a DLL method, or establish touch-device fidelity. The Move helper's expression and STO evaluators are explicit recording/value facades. The special-target action handler's compression, path and queue endpoints are recording sinks: argument dispatch is verified, downstream layout is not.

Static corroboration: `doc.js:295` captures `GetWidgetDragInfo()` into an event; `events.js:1093–1108` enables drag startup for configured drag/swipe events and passes the original browser event. These sources are retained outside the distributable.

## Confirmed drag behavior

- The first mousemove, including zero displacement, emits `onDragStart` followed by `onDrag`. Further moves update incremental deltas while totals remain relative to startup.
- Mouseup uses the last mousemove coordinates, not its own coordinates. Drop fires before cleanup. Afterwards public DragX/Y and totals are zero; DragTime is 600000. A session with no move emits no drag/drop/swipe or click suppression.
- A `donotdrag` start and a second start during an active session are ignored. Event snapshots are shallow: scalar positions remain at capture time, but `movedWidgets` is shared until drop replaces that map.
- `LogMovedWidgetForDrag` stores the first viewport location, strips the `_container` suffix, and ignores a missing widget. An old event snapshot retains its pre-drop map.
- Body and widget cursors restore; the nice-scroll cursor remains `move`. Removing the dragged widget during drop does not throw during cursor restoration.
- Only a mouseup on the same DOM target suppresses the following click; touch and a different target do not. Document click/mousemove releases suppression.
- Swipes require displacement strictly greater than 30 and elapsed time strictly below 1000 ms. Diagonal movement can emit two swipe events.
- Touch default prevention follows configured onDrag/vertical swipe handlers, horizontal step magnitude greater than 5, or preventScroll with a scrollable body. Exactly 5 and horizontal-swipe-only registration do not independently prevent default.

## Confirmed Move helper behavior

- `drag`, `dragX`, `dragY` consume incremental snapshot deltas without evaluating x/y expressions. Before any drag the snapshot has no deltas and the helper produces NaN. After drop it can still consume retained deltas even though the public drag getters return zero. These are distinct contracts.
- `locationBeforeDrag` subtracts current viewport position from the first recorded location. A missing record returns zero and releases the **source** Move channel.
- `withThis` copies the source motion's delta, easing and duration; an absent source movement throws while reading its options. It does not synthesize zero movement.
- A fixed-position Move To subtracts window scrolling before deriving displacement.
- Empty-axis checks use loose equality: numeric `0` preserves the current axis, but string `"0"` requests zero. This probe verifies controlled typed inputs to the helper; it does not establish which types every original expression path supplies.
- A boundary AST is evaluated first. Only false with available STO projections replaces the axes. False without STO leaves the requested displacement. `withThis` updates withx/withy in the AST before evaluation and in the STO scope only when projecting. Nested AND/OR leaf updates are exercised; complete native AST evaluation is outside this harness.

## Confirmed special-target dispatch

- `widgetsBelow` and `widgetsRight` bypass the ordinary per-target queue and call compression directly.
- Resize/panel-state events use the saved old resizing rectangle when available; otherwise current bounds are used. Ordinary click uses current bounds.
- Below passes y then x displacement; right passes x then y. `sizeDeltaX`/`sizeDeltaY` send NaN to request inferred size changes, not an ordinary By displacement.
- Ordinary multi-target entries preserve array order and dispatch the next action once.

## Failure history and limits

1. `runtime-transform-drag-first-probes.json`: 37/37; exact script retained as `runtime-transform-drag-first-probe.mjs`. Its boundary evaluator returned a truthy object, so it did not exercise the false/STO branch despite the overly broad test name; the output explicitly records that limitation.
2. `runtime-transform-drag-expanded-probes.json`: 49/50; exact script retained as `runtime-transform-drag-expanded-probe.mjs`. The failed no-old-rectangle fixture supplied `undefined`, which triggered the harness default rectangle. This was a harness fixture error, not an original-product failure. Nonfinite arguments in this old output are accompanied by explicit index/meaning metadata.
3. `runtime-transform-drag-final-probes.json`: 52/52. The fixture uses null, the boundary facade is explicitly boolean with both branches checked, and nonfinite numbers serialize as `{ "$number": "NaN" }` instead of ambiguous JSON null. Added before-drag/after-drop and string-zero controls preserve original edge behavior.

Remaining work includes real pointer/touch lifecycle, platform-specific branches, downstream special-target layout, fixed/adaptive/repeater coordinates, complete bound expression execution, and integration with the independent runtime. No production capability or release status is changed by these research probes.
