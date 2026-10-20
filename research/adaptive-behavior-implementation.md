# Shared adaptive views, state effects and selection control

This stage extends the independent editor. It does not claim complete Axure RP 11 compatibility or a successful original-canvas comparison. The previous published package is retained under `.build/before-adaptive-behavior`; new validation uses separate reports and build/package directories.

## Implemented behavior

- A project can own several named adaptive view sets. Pages reference one set while keeping their widget declarations separately. Width, height, Base size and parent changes propagate to every assigned page. Existing page-owned views and legacy maximum-width selection remain readable; conversion to shared views is explicit.
- Set reassignment matches named views by exact ID first, then the first exact, case-sensitive name. Matched local declarations move to the target ID; existing target local properties take precedence. Unmatched maps remain available for a later reassignment. Base widget content does not migrate. Deleting a shared view removes its map from bound pages and reparents its direct children. Deleting widgets, including children removed by a component update, prunes both active and inactive maps.
- Seven state styles can be local to an adaptive view: hover, down, focused, selected, error, hint and disabled. The nearest present map replaces the entire inherited map. `{}` intentionally blocks all inherited effects; an absent map inherits. Normal geometry/style still composes along the ancestor chain. State existence is computed separately: an ancestor focused entry can still establish focus behavior when a child map blocks its paint.
- The authoring panel shows whether effects are local or inherited. Editing inherited effects creates a local snapshot of the effective map. **Use inherited effects** removes only that map. It preserves normal style/layout overrides and Base effects. This snapshot editing policy is an independent authoring design; the native runtime lookup alone does not establish its original editor authoring sequence.
- **Set adaptive view** supports Auto, Base and a literal named ID. Forced selection survives viewport changes on the current page; Auto immediately re-evaluates the latest size. Named IDs can remain dangling after a view is removed; they use Base declarations while retaining their selection identity. A same-ID selection preserves action results and does not fire another adaptive event.
- Native Set Adaptive View terminates the rest of its current case action list. Later independent IF groups still run. The implementation follows that behavior, including Wait continuations before and after the action.
- Page **Adaptive view changed** fires after a real switch. During initial loading, synchronous Loaded handlers finish first, the final named adaptive event follows, then the first repeater ItemLoaded cycle. Separate load-finished and repeater-ready gates prevent early refresh. View transactions roll back selection, lifecycle and existing private runtime state on error; existing Wait continuations remain distinct from newly created rejected work.
- Preview and offline root pages expose Auto/Base/named selection. Each frame owns its own runtime selection. This selector is explicitly page-local and resets to Auto on navigation; native player URL-hash persistence is not claimed.
- Offline font collection includes state styles in page-owned, shared and retained inactive maps, preserving locally embedded font bytes.

## Evidence

- [State evidence](adaptive-behavior-state-evidence.md): 237 exact retained-function VM cases and 8 isolated Edge DOM cases. These are controlled function/DOM probes, not a full original generated project.
- [Control and lifecycle analysis](adaptive-behavior-runtime-plan.md): 23 expanded event-group probes, including the first 16. Do not sum overlapping runs as 39 independent cases.
- Managed assembly and file evidence is retained in `adaptive-behavior-format-*`: document-owned sets, page set references, exact name matching and property migration; the 13 controlled CIL replays are separate from executing the original DLL.
- [Current original-window attempt](adaptive-behavior-gui-recheck.json): Untitled editor and menus were observed. Screenshot capture failed with `FrameArrived timed out`; the fresh Project menu input failed with `coordinate input geometry is unavailable`. No original test project or pixel comparison is claimed.
- Release validation: 3027 unit cases in 127 files, 247 complete production-browser cases, 11 focused production-browser cases, and 9 exact-package scripts passed. The primary desktop check covers preview/file export and four unchanged save/reopen cycles. All four package screenshots and one authoring screenshot were visually inspected. Final archive hashes are in [the release verification](adaptive-behavior-verification.json).
- The first complete unit run is retained: three old assertions expected globally shared effect paint, and two import tests timed out under competing workers. The three assertions now separately check shared flags/content and view-local effect maps; no cases were deleted and no timeout thresholds were increased. Focused regression and the complete suite passed with four workers. Earlier red/intermediate reports remain under `.build/adaptive-behavior-*`.
- Narrow offline screenshots show open navigation and fixed-size canvas clipping/scrolling. They do not demonstrate responsive content fitting or original pixel parity. The [demonstration document](../artifacts/adaptive-behavior-demo.rea.json) is byte-identical to the file used by the exact-package save/reopen check.

## Explicit boundaries

The strict independent JSON schema rejects null state maps/entries and unsupported `normal` state-map keys. It does not model native contained-owner paint inheritance, master/RDO-specific view sets, unplaced/limbo objects, or complete original RP adaptive import. Table/menu/tree contents keep the previously documented shared-property restrictions.

Two original function quirks remain documented without being reproduced: the hover+down+hint state-name casing mismatch, and an old focused CSS class surviving a view that has no focus capability. Generated CSS, image overrides and all native rich-text/SVG variants are not comprehensively reproduced.

The pinned ordinary generator writes `useViews=true` as a constant. This stage therefore adds no invented project toggle. Native generation-range settings and alternative generator paths remain separate questions. Ordinary physical-window Page Resize dispatch and legacy snapshot-runtime adaptive carriers are outside this change.

Removing a set that pages still use is rejected until those pages are reassigned or detached. This reversible editor rule preserves data; it is not presented as an exact reconstruction of the unresolved original set-deletion cleanup path. Resource limits and event recursion bounds are likewise implementation safeguards rather than native-limit claims.

Only separately licensed fonts are packaged from retained resources. No proprietary Axure implementation or assets are copied into the independent product.
