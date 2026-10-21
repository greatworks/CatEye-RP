# Selection control pointer resize

2026-10-21. Source implementation, not published. Full Axure parity and original GUI comparison remain false.

Controls with explicit `selectionText`, padding, alignment and indicator size now use the independently reconstructed author controller for pointer resize. A single checkbox/radio exposes west/east handles. Multiple admitted controls share one bounding frame with eight handles; locked controls contribute to that frame but receive no layout writes. Existing controls without these declarations retain the earlier generic editor behavior. Original creation defaults remain separate work.

## Geometry and live layout state

`selection-pointer-resize.ts` separates immutable gesture geometry from the current text panel, fit flags and controller hot-zone state. Single-object obN4 rounds the signed size delta AwayFromZero and holds the original opposite anchor. Multi-object INw2 uses the original shared selection frame and its controller clamp. Size runs before the final requested Location; text-driven height correction does not trigger a second generic anchor calculation.

JbNd can turn off an already enabled auto-fit width. The synchronous fit layout runs before the Size transaction. Subsequent frames retain the resulting panel and fit state, including an out-and-back gesture that returns to its original width with auto-fit still disabled. All selected targets are planned before applying any frame to a document. Each frame returns ordered incremental effects, preserving complete Size/Location pairs in the current adaptive view and shared fit flags. Affect all views does not change this pointer geometry policy.

The source investigation retains 77 checks: 11 hot-zone, 36 numeric and 30 persistent-session cases, including 71 complete CbNX calls. Its CIL interpreter composes the original controller, Size, OI8Z/WIyL and final Location paths; text metrics, graphics-unit conversion, history and overlay services remain declared facades. See [source evidence](selection-pointer-evidence.md) and its [82-file manifest](selection-pointer-manifest.json). This is evidence about the admitted paths, not execution of the original assembly or a native pixel comparison.

## Browser gesture transaction

The host prepares fonts and a browser-derived initial panel once. While fonts are pending it records independent copies of each pointer frame; it replays them in order because panel and fit changes can persist. Pointer-up waits for the last frame. One completed document difference creates one undo entry; press/release without movement remains a no-op.

Escape, undo/redo during a gesture, abnormal capture loss and context changes cancel the gesture. A monotonic command serial prevents late completion after a view round trip. Rollback restores the original document only while the gesture still owns its published preview. A later measurement failure rolls back the entire gesture, including earlier previews and earlier selected targets.

The recovery copy stores the pre-gesture document until completion. Other editing actions are held while preparing, dragging or finishing. Pending selection property/layout commands block a new gesture without discarding their intent. Focused numeric drafts are committed before reading the pointer baseline. These asynchronous waiting, rollback and recovery rules are independent editor conventions.

Locked targets use only their immutable geometry. Their unused transient panel is an explicit host placeholder, so fonts or selected-state typography on a locked target cannot block resizing another target. No native panel value is inferred for that placeholder.

## Verification and remaining scope

TypeScript and 5,587/5,587 unit tests passed. The fourth production build passed all 16 new pointer cases and 72 related browser regressions, with no failed, flaky or skipped cases. Independent model review also compared 12 additional scenarios / 36 continuous frames to the retained source oracle. These checks are distinct from native evidence.

The original failed pointer retry was reproduced without downloads or window blur: a rejected press selected the frame label, then native `dragstart` cancelled the next pointer capture. Preventing the handle press's default behavior before the pending-command gates fixed the actual failure. The accepted browser scenario verifies empty DOM selection, absence of native drag/cancel and the saved width/undo results. Separate invalid fixtures, an event-observer timing mistake and an old two-frame selector are retained and classified as test issues.

Four fourth-build screenshots were inspected. Visual review found overlapping group/leaf labels; the fifth build changes only the leaf-label visibility condition. Its TypeScript and existing multi-target failure/retry/undo case passed, and its new screenshot was inspected with the overlap removed. The 88 behavior checks are explicitly bound to the fourth build; the fifth has this targeted visual follow-up, not a claimed full rerun. Exact hashes and retained outputs are recorded in [selection-pointer-verification.json](selection-pointer-verification.json).

The admitted domain is unrotated page/Layer coordinates with normal typography and explicit selection layout declarations. Mixed selection controls and ordinary widgets, modifier-assisted gestures, container-local transforms, unsupported selected-state fonts and negative available text widths are rejected atomically. Recursive Layer resize containing SelectionButton members, original creation defaults, native rich-text synchronization/history, complete font/DPI equivalence and complex state assets remain open. Native `.rp` writeback, original GUI/pixel comparison and full Axure feature parity remain unimplemented or unverified. This source stage does not replace the existing Windows release.
