# Canvas Pen and vector-point editing

This stage adds an authoring workflow to the existing normalized M/L/C/Z model. It does not change native RP parsing, offline rendering, or the document format. The official interaction contract and narrowly reused native evidence are recorded in [the evidence report](rp-vector-editing-evidence.md). Native Axure GUI capture remains unavailable; this is not a GUI parity claim.

## Interaction and persistence

`P` / `Ctrl+Shift+P` starts Pen. Click places an anchor; drag adds control handles. Shift chooses horizontal or vertical in displayed local pixels. Alt leaves the opposing handle independent. Clicking the first point finishes a closed path; double-click or Escape finishes an open path. Zero/one-point drafts are discarded because they contain no drawable segment. A completed path is one history operation. Pen-created paths use the product's Path widget even for two straight anchors; the native Line/Shape label distinction is not implemented.

`Edit points` / `Ctrl+Alt+P` enters direct editing for an existing `vectorPath`; double-click near its border is another entry. Interior double-click and Enter retain text editing. The overlay shows anchors and the selected anchor's controls. Dragging an anchor carries its incoming/outgoing handles. Alt moves one handle; ordinary handle dragging mirrors the opposite handle when an adjacent segment exists. `1`/`2` and point double-click curve/sharpen; Delete removes the selected anchor. The numeric Inspector remains available.

Pointer motion uses transient component state. A point gesture commits only on release; pointer cancellation restores the original path. No-op gestures do not consume history. Pen and point gestures are discarded on relevant context changes. Existing ordinary widget move/resize also records history after the gesture, removing the previous no-op history entry created merely by selecting a widget.

New Pen paths normalize anchors and controls into a bounding rectangle with dimensions at least one pixel. Point editing preserves the existing widget rectangle and changes normalized path coordinates, including coordinates outside the rectangle. Rotation is inverted before converting a pointer into normalized coordinates, and zoom is removed first. Panel/repeater editing uses that container's local canvas. Existing adaptive layout/style overrides remain local; path geometry is shared content, matching the current document model.

## Geometry choices and boundaries

- The editor exposes a logical anchor model over the stored segment model. A final endpoint exactly equal to the initial M immediately before Z is treated as the same editing anchor. This is an explicit adapter policy; arbitrary coincident points elsewhere remain separate.
- An anchor owns the arriving cubic's second control and departing cubic's first control. Removing one anchor's handles preserves controls owned by its neighbors.
- Curving a sharp node chooses a tangent from adjacent anchors and one-third distances. Ordinary drag mirrors the opposing handle with equal normalized offset. Native handle construction and default coupling lengths have not been established.
- Border insertion estimates the nearest parameter with a bounded search, then splits the actual cubic with De Casteljau. It does not store a polyline approximation. A closing Z edge can receive a line anchor; compound contours keep their own ordering.
- Deleting a node reconnects its neighbors with their surviving handles. Empty contours are removed, but deleting the final point of an entire path is refused. These minimum-node and reconnection policies are product choices.
- Only widgets carrying `vectorPath` have this direct editor. Plain CSS rectangles/ellipses are not silently converted. Hit testing outside point mode remains rectangular. Boolean operations, arcs, whole-path SVG import and native RP write-back remain unavailable.

## Verification

Geometry tests include an independently written Bernstein-polynomial oracle for cubic splits, first/last closure aliasing, one-sided controls, deletion, degenerate contours, and inverse rotation in non-square bounds. Browser tests operate the actual Pen, drag controls, save/reopen files, inspect production SVG, exercise nested adaptive geometry, and open real exported HTML offline. A packaged Electron smoke uses real preload/IPC/filesystem behavior; only OS picker responses are replaced. Current counts, hashes, logs and limitations are in [the stage verification record](rp-vector-editing-verification.json).

The packaged smoke also saves [an editable Pen demo](../artifacts/pen-demo.rea.json) and [its offline export](../artifacts/pen-demo.html). Neither artifact includes Axure vendor resources.

## Bugs caught during review

The first browser version let Pen Delete/Backspace and arrow keys reach ordinary selection handlers. A pre-fix browser regression demonstrated that Delete removed the previously selected widget. Pen now owns these keys, leaving both existing objects and its draft intact. The same-file reopen case explicitly resets vector tools, even when page/widget IDs have not changed.

A second pre-fix browser regression held a point drag, pressed Delete, then continued moving and released. The deleted node reappeared because the gesture retained its old path snapshot. Point-style and deletion keys now cancel the held gesture and operate on committed geometry. Pre-fix traces and saved document evidence are retained in `test-results/vector-editing-before-key-fix/`; corresponding source snapshots are `.build/pre-vector-keyfix-App.tsx` and `.build/pre-vector-keyfix-CanvasVectorTools.tsx`.

A helper regression also failed before its fix: curving a point cleaned up degenerate controls in unrelated contours and changed an explicit C into L. Cleanup is now limited to the two edges incident to the edited anchor. This preserves unrelated stored command structure as well as its appearance.

Browser testing caught SVG pointer capture retargeting double-click from an anchor to the overlay. The overlay now resolves an actual anchor hit in the rotated/scaled coordinate system before toggling its style. A further regression demonstrated that Undo during an ordinary widget drag could be overwritten by the subsequent pointer movement. Undo/Redo first cancel an active ordinary gesture; its stale snapshot cannot reapply later, and the preceding completed action stays on the history stack. The pre-fix browser evidence is retained in `test-results/vector-editing-before-ordinary-guard/`.

The complete unit run exposed an older Inspector SVG tooltip warning: mixed JSX text and numeric children were supplied to a title element. A strengthened server-rendering regression first failed on the warning; each tooltip now receives a single string and is checked as actual rendered text. The final complete unit run has no application warnings.
