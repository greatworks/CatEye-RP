# Adaptive placement authoring implementation

The authoring implementation stores placement independently of visibility. The current child view can unplace or restore an object without removing its identity, interactions, content, or other view declarations. Base deletion and explicit Delete from All Views remove the shared graph.

## Evidence and verification

- [Frozen original authoring evidence](adaptive-placement-authoring-evidence.md) separates official documentation, retained CIL, and unverified GUI behavior.
- The initial focused baseline had **1 passing and 9 failing** tests. The completed authoring suite has **13 passing** tests; the combined adaptive/component regression selection has **135 passing, 0 failing** tests.
- TypeScript type checking passed. Source hashes and exact evidence paths are in [the implementation manifest](adaptive-placement-authoring-implementation.json).
- Parent-owned production-focused browser checks passed **14/14**, including **3 authoring workflows** (placement/undo/save, child/all-view insertion, and Outline recovery/filtering with prior cell selection). The actual JSON report is hashed in the manifest. Final full-suite and packaged-release results remain parent-owned and are not claimed here.

## Implemented authoring contract

- Optional `placed` booleans preserve legacy omission. Both explicit true and false remain meaningful local declarations.
- All-view placement commands write the Base property and remove only placement from active and inactive view maps. Empty state-style barriers and other property declarations remain intact.
- New child-view insertion creates a Base-unplaced/current-placed subtree root. Nested new descendants retain their original data. App insertion, paste, duplication, component insertion, image insertion, and Pen creation share this entry point. The low-level model API's omitted insertion policy retains its earlier shared-content behavior.
- Canvas rendering and selection use a filtered projection; the complete graph is still passed to edit/serialize operations. Unplaced objects remain available in Outline, including All widgets / Placed / Unplaced filtering and restore buttons.
- Ordinary panel and repeater descendants are independently placeable. Shared table/menu/tree roots permit placement; their contained content retains the existing shared adaptive model constraints.
- Clone/component tests verify placement retention and stable/remapped action identity. Shared-set tests verify active and inactive placement maps through save/parse. Static-render tests verify unplaced children disappear while the existing authoring preview for hidden children remains.

## Explicit limits

The scope checkbox is deliberately named **Placement and insertion: all views**. It does not implement general Affect All Views styling. Original Layer-specific restore logic, native master identity migration, and original interactive undo granularity have not been reproduced from GUI evidence. Product commands are independent immutable edits and use the editor's existing document undo mechanism. Runtime behavior, RP import, final packaged output, and parent browser tests are outside this manifest's claims.
