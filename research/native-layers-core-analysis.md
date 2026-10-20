# Native Layers: current core and authoring integration analysis

This is a read-only design review of the current reconstruction. It makes no product, test, browser, package, or prior-evidence changes. Source hashes and exact reference locations are in the adjacent JSON. Proposed APIs below are design recommendations, not native format declarations. Native format/runtime findings are being gathered by the other workers; their final source-bound contracts must govern implementation.

## Main conclusion

A native Layer needs its own stable widget identity and an ordered child collection. Existing `groupId` is a flat membership tag and must remain a separate compatibility path. A Layer cannot be represented faithfully by a single-state panel: panel state identity, clipping, disabled inheritance, coordinate origin, sizing, selection, and event dispatch currently have observable special behavior.

The most consequential distinction is **structural parent versus coordinate parent**. The runtime worker's early source trace says Layer children retain state/page coordinates, Layer ancestors do not add their location to `offsetBoundingRect`, and Move temporarily pushes a relative container with compensated child positions. This has not yet been promoted here to a completed native probe result. If confirmed, a Layer must be a structural parent while its descendants retain the enclosing non-Layer coordinate frame. A permanent translated/rotated wrapper would double-apply geometry.

Implement membership/traversal and coordinate policy before enabling Layer actions. All three motion channels must then consume the same Layer identity and evidence-derived expansion rules; adding only a new renderer or reusing the flat-group Rotate branch would leave Move/Resize/Rotate combinations inconsistent.

## What the current product actually does

### Flat grouping

- `src/model/types.ts:188` defines widgets with geometry, styles, events and optional `groupId`; there is no Layer type or child collection.
- `src/model/document.ts:396` / `:401` group and ungroup sibling widgets by assigning/removing a tag. `collectWidgetIdentifiers` (`:269`) treats the shared tag as an identifier that may repeat, distinct from a widget identity. Clone/remap (`:319`) preserves membership and remaps group-target actions.
- `src/App.tsx:390` / `:391` directly patches `groupId`. Pointer selection (`:422`) expands a clicked member to other tagged members in the current authoring list. Selection overlays and resizing remain per widget (`:425`, `:473`); there is no parent group node, separate container geometry, group event editor or recursive group scope.
- `src/components/Inspector.tsx:343` offers group IDs only to Rotate and only when collected members belong to the same sibling array.
- The runtime indexes tagged widgets globally in `flatGroups` (`src/runtime/export-runtime.ts:285`). Rotate rejects cross-page/cross-container membership (`:2039`), derives an AABB union from member bounds (`:1815`), stores a separate group angle and reserves member Move/Rotate channels (`:1884`). The angle is isolated by complete row context and survives an ordinary adaptive reset. This is an explicit flat-group compatibility behavior, not an implementation of native Layer expansion.
- Structured Move/Resize deliberately reject flat group targets (`:2009`). A group ID has no `Widget` in `widgets`; general target resolution, visibility, events and geometry expressions therefore do not gain a Layer by virtue of the existing Rotate special case.

**Compatibility rule recommended:** old documents keep their tags, saved bytes and behavior. New true Layers use distinct widget IDs. Do not silently convert old groups into containers on parse/open, and do not retroactively reinterpret a copied legacy group target as a native Layer.

### Structural traversal and identity

The model has several explicit containment edges:

| Carrier | Ordered children | Current role |
| --- | --- | --- |
| Panel | each `states[].widgets` | state identity; one active render state; local coordinates |
| Repeater | `repeater.template` | repeated runtime instances; adds a row-context level |
| Table | `table.cells` plus `cellOrder` | row-major geometry and separate paint order |
| Menu | internal table, then submenus | independent menu/table/cell identities; local submenu positions |
| Tree | root nodes, then node label and child nodes | structural nodes and independent labels |
| Component instance | one materialized panel state | stable source-to-local identity map |

`mapWidgets`, `findWidget`, identifier collection and clone/remap explicitly enumerate these edges in `src/model/document.ts:219-291` and `:319-377`. Other independently maintained walkers occur in:

- `src/model/components.ts:62`: component-instance synchronization;
- `src/model/adaptive.ts:132`, `:366`, `:514`: indexing, ancestor placement and detecting newly inserted roots;
- `src/model/adaptive-view-sets.ts:80`: pruning page overrides via retained widget IDs;
- `src/components/Inspector.tsx:83`: target labels and sibling identity;
- `src/runtime/embedded-fonts.ts:106`: descendant font use;
- `src/runtime/export-runtime.ts:283`: runtime indices;
- `src/components/Preview.tsx:88`, `:131`: iframe discovery and rendering;
- `src/runtime/export-runtime.ts:3236`, `:3687`: iframe discovery and native text measurement indexing;
- `src/components/WidgetView.tsx:236-291`: editor/thumbnail/snapshot recursion.

Adding only one walker is not sufficient: a child can otherwise render but be missing from actions, copy references, adaptive maps, font embedding, text measurement, or row cleanup. Keep structural iteration order explicit. A table's logical row-major list and paint `cellOrder`, for example, are different operations and should not be collapsed into an undifferentiated “children” helper.

Validation is already strict and budgeted: `DOCUMENT_LIMITS` (`document.ts:17`) allows 10,000 widgets and depth 12; `validateWidget` (`:840`) increments both through existing children. A new Layer collection must use those limits and the same global identity context. It must reject an invalid child atomically and must not permit hidden arbitrary object graphs through a free-form property.

### Runtime indexing and coordinate reads

`createOfflineRuntime` maintains separate maps:

- `widgets`: source widget identity;
- `pageOwners`: owning page;
- `owners`: **repeater ancestors**, not general container ancestors;
- `containers`: direct structural owner plus optional panel state ID.

See `export-runtime.ts:190-198`, `:283`. `widgetContext` / `instanceKey` (`:337-350`) and `targetContexts` (`:1083`) use the repeater chain. A Layer must not add a fake row level. A Layer in a template and every child still need the same full stable row path; a repeater inside a Layer adds a level in the usual way.

The following geometric quantities are intentionally not interchangeable:

1. authored/effective local frame;
2. live painted frame from runtime overrides;
3. public expression geometry, which prefers movement/size caches (`:807`);
4. rotated/shadow bounds using the final-angle cache and its zero fallback (`:1538-1569`);
5. frame/row placement supplied by DOM parents and repeater layout.

Layer bounds must select the appropriate native quantity for the requested operation. The general public getter cannot simply become the union of live DOM boxes. Nor should a wrapper transform be fed back into child logical coordinates.

`contentBounds` (`:708`) already distinguishes cached motion from live rotation. `ancestorBounds` / `fitFrom` (`:2447`, `:2475`) know panels/repeaters but have no Layer bounds invalidation or Layer Resize/Move event sequence. The snapshot `getRuntimeWidget` projection in `src/runtime/engine.ts:48` contains a separate fitted-panel bounds calculation. Any new committed Layer cache must survive `executeInteraction` snapshots and agree with both projections.

### Visibility, state and event propagation

Visibility/placement/type gates are explicit:

- `isUnplaced` (`export-runtime.ts:480`) can inspect own placement or the structural ancestor chain; `placementHidden` separately excludes special generated table/menu carriers.
- `visibleControl` (`:2778`) follows hidden ancestors, active panel states, collapsed tree nodes and visible rows.
- `disabledControl` (`:2790`) currently propagates disabled from most ancestors, with table/menu/tree exclusions.
- `dispatchWidget` (`:2924`) handles tree selection and a narrow table-cell → table → menu click/double-click fallback. It does **not** provide generic bubbling to every ancestor.
- Adaptive switching (`:2952`) clears widget geometry/style caches and selected visibility patches but does not clear `groupAngles`.

Consequently, merely inserting Layer into `containers` would already change disabled/placement/focus behavior even without an explicit Layer policy. Native capability and propagation gates must be supplied first. Layer identity must be available to its own events, but dispatch order and the meaning of This/Target cannot be inferred from React DOM bubbling.

The runtime worker's early source trace additionally distinguishes Move cache recursion (direct children including hidden/limbo) from Move event enumeration (visible deep Layer members), and Resize/Rotate expansion (including hidden). That calls for **operation-specific traversal**, not one global “eligible children” filter. Exact recursion stops and limbo rules remain evidence-worker contracts until their probes freeze.

## Recommended model and API shape

The least invasive saved representation is an additional `WidgetType` with a discriminated data field, provisionally:

```ts
interface LayerData { widgets: Widget[]; propagate?: boolean }
// Widget.type === 'layer'; Widget.layer is required only for that type.
```

The parent has selected `layer.widgets` for the shared schema. The subsequent format census reports 276 Layers, 1,048 direct memberships and 125 nested Layer memberships; source `DiagramObjects` is separately enumerated in the enclosing diagram, so import must deduplicate the nested membership instead of emitting the same widget twice. All surveyed Layer members have `IsContained=false`; this field is not a Layer identity test. Location/Size getters derive from BoundingRect. The final native member eligibility and union details still belong to the evidence workers. The agreed product fields `x/y/width/height` represent derived Layer bounds, and `rotation` represents its separate Layer degree; neither authorizes a CSS wrapper transform. `propagate` preserves explicit import values; its omitted default and exact propagation behavior still require the runtime contract. Do not normalize members into Layer-local coordinates.

Recommended reusable structural interfaces:

```ts
type ChildCollectionKind =
  | 'layer' | 'panel-state' | 'repeater-template'
  | 'table-cells' | 'menu-table' | 'menu-submenus'
  | 'tree-nodes' | 'tree-label' | 'tree-children';

interface ChildCollection {
  kind: ChildCollectionKind;
  ownerId: string;
  stateId?: string;
  widgets: readonly Widget[];
}
widgetChildCollections(widget): readonly ChildCollection[];
replaceWidgetChildCollection(widget, edge, children): Widget;
```

These are proposed model APIs, not a request to refactor every unrelated feature at once. Preserve current visitation and mutation semantics. Build `parent`, `coordinateParent`, `page`, and `repeaterOwners` indices from structural edges. `coordinateParent` should skip Layer only if confirmed by the native contract. Composite editing/placement restrictions still apply; a child edge does not grant permission to freely move or delete a table cell or tree label.

Author operations should be explicit transactions, for example `createLayer`, `ungroupLayer`, `moveIntoLayer`, `moveOutOfLayer` and `replaceLayerChildren`. They should:

- preserve unrelated widget and action identities;
- reject cycles and forbidden composite extraction;
- remap copied subtrees, action targets and motion bindings through existing identity helpers;
- retain active and inactive adaptive maps for surviving identities;
- apply a documented coordinate conversion only when crossing a real coordinate parent;
- produce one undo entry for the whole structural operation.

Do not use `applyAdaptiveWidgetEdits` to silently convert an existing box/panel into a Layer: its type-change guard (`adaptive.ts:505`) is intentional. A dedicated structural command can preserve all declarations and perform explicit conversion when source-backed authoring semantics call for it.

## Authoring integration

`App` currently has a single `panelPath` selected owner (`:78-95`). Its effective child list is a repeater template or active panel state, and `changeWidgets` (`:136`) knows exactly those two replacement shapes. Layer editing needs a generalized author scope that identifies the owner and the child collection, not just an overloaded panel boolean. A full breadcrumb path can be computed from the structural index; entering/exiting a scope must cancel point drafts, rich-text drafts, drags and stale internal composite selections consistently.

Required author entry points:

- Group/Ungroup commands, selection expansion, marquee/Ctrl+A and outline root/member selection;
- stable Outline container nodes, nesting/reorder and Place/Unplace recovery;
- scope entry/double-click and return to the containing Layer/state/page;
- drag, resize, alignment and pointer hit conversion at zoom and under rotation;
- clipboard, duplicate, delete/unplace, component create/update/detach;
- Inspector root capabilities, member editing, action/condition/alias target lists;
- current/all-views edits, insertion placement, inactive overrides and one-step undo/redo.

Whether the existing Group command should create native Layers for new work is a parent/native evidence decision. Legacy groups should retain an explicit, non-destructive compatibility route. If grouping is structural, mixed selections containing an ancestor and its descendant must be canonicalized or rejected rather than duplicating the descendant.

Table/menu/tree controls must continue operating on their own children. A Layer may contain the whole supported composite; that does not authorize moving its generated internal nodes out with ordinary Group/Ungroup.

## Motion integration

Keep the current event planner and per-instance channel reservation separation (`export-runtime.ts:1319-1535`, `:1861-1933`). Add a target adapter that can represent either an ordinary widget or an actual Layer:

```ts
resolveMotionTarget(id, context): WidgetTarget | LayerTarget;
collectLayerMembers(layer, context, purpose): readonly InstanceRef[];
layerBounds(layer, context, purpose): Bounds;
```

`purpose` must be operation-specific: bounds, Move paint, Move cache, Move event, Resize, Rotate, hit testing and author selection need not share eligibility. A Layer's queued action must not eagerly bake every member expression while ordinary actions resolve at queue start.

Implementation decisions that need original evidence before coding:

1. Which Layer/member channels reserve and release, including nested Layer + explicit descendant commands in the same event?
2. When is membership captured: action intake, emitted slice, queue start, or each step?
3. How does Resize select its reference bounds, scale each eligible member, and combine with Move/Rotate shortest slices?
4. Which Layer and member events run before geometry, after cache updates, or after frame completion?
5. Which parent fits occur before a released successor starts, and which cached angles are consumed?
6. What does nested Layer angle storage do across adaptive changes, row reconstruction and snapshot execution?
7. How are empty Layers, hidden-only/limbo-only members, nested panels, and mixed orientable controls treated?

The early Layer source trace suggests member propagation and temporary containers rather than a permanent group tween. Reuse independent ordinary consumers where source behavior permits, but do not replace the native Layer branch with an idealized affine interpolation. Prior Move/Resize/Rotate evidence already shows that CSS and caches may differ, and double releases can be observable.

Extend atomic snapshots to all new Layer bounds, per-instance angle/cache and temporary-paint state. Row deletion/rebuild, navigation, failed navigation, failed queued expression, reentrant geometry events, Wait and disposal must clean or roll back both Layer and descendant reservations. Snapshot state may retain execution caches, but no transient wrapper or timer enters a saved project.

`compressTransform` (`:1952`) currently supports page/panel-state/repeater siblings and rejects other generated containers. Layer support must implement the native search/recursion contract; treating the new Layer merely as another panel scope would incorrectly stop or widen compression. `LocationBeforeDrag` also needs an explicit coordinate adapter rather than accidentally recording temporary wrapper-relative positions.

## Rendering and serialization

All rendering paths need an explicit Layer branch:

1. `WidgetView` / `widgetStyle` (`WidgetView.tsx:71`, `:236-291`): author canvas, gallery, components and snapshot-style recursive rendering.
2. React `Preview.renderWidget` (`Preview.tsx:131-194`): live state, pointer/focus/drag events, row identity and iframe lifetime.
3. `mountOfflinePrototype.makeWidget` (`export-runtime.ts:3375`, `:3590-3656`): persistent DOM identity, hidden/limbo policy, style reset, own event host and descendant recursion.

The ordinary style function assigns absolute left/top, size, center rotation, background, border and mostly `overflow:hidden`. A Layer must not receive those defaults accidentally. The final Layer branch must state whether a wrapper paints, clips, intercepts pointers, inherits opacity/disabled, or only groups DOM; this is a source contract, not a panel-style shortcut.

`containsFrame`, native shape-text indexing and descendant font scanning must include Layer edges. An invisible/inactive ancestor must not destroy an inline frame contrary to existing frame lifecycle rules. Nested frame player sessions remain independent; each session uses its own row, Layer and channel state.

`export.ts:41-44`, `:57-58` serializes `createOfflineRuntime` and `mountOfflinePrototype` with bare `toString()`. `frame-player.ts:30-33` imports the same runtime for bundled frames. A new imported graph/geometry helper cannot become an undeclared closure dependency. Prefer an internal self-contained runtime counterpart verified against the model helper, or an explicit injected serializable factory passed consistently at every bootstrap. Do not silently alter the established factory call contract.

## Regression plan

No tests were run by this analysis. Useful existing tests and proposed additions:

| Existing anchor | New meaningful regression |
| --- | --- |
| `document.test.ts:148`, `components.test.ts:48` | Old group bytes/clone unchanged; true Layer identity and all child/action/binding IDs round-trip/remap; duplicate IDs/depth/bad carriers reject atomically. |
| `components.test.ts:97`, `adaptive-component-sync.test.ts` | Layer inside instance and instance inside Layer; stable local IDs; removed children prune active/inactive maps without unrelated edits. |
| `adaptive-placement-authoring.test.ts`, `adaptive-all-views-authoring.test.ts` | Layer and child placement independently declared, inherited view edits, all-views actual-property changes, shared-set inactive declarations survive structural commands. |
| `rotation-authoring.test.ts`, `e2e/rotation-authoring.spec.ts` | Group/ungroup preserves visible geometry; rotated real coordinate parent vs zero-origin Layer; zoomed drag/resize and one-step undo. |
| `runtime-rotate.test.ts:116`, `:136`, `:192`, `:199` | Legacy group behavior stays unchanged; new nested Layer scope/angles/member eligibility differ only as source proves; no cross-row or cross-container accidental grouping. |
| `runtime-transform-core*.test.ts` | All six Move/Resize/Rotate orders on Layer, equal/unequal duration, Layer+member conflicts, midpoints/cache-vs-paint, reentrant events, queued expression failures, row rebuild and navigation rollback. |
| `runtime-transform-core-special.test.ts` | Below/Right through visible/hidden nested Layers, ordinary panel/repeater stop boundaries, member event/cache filter differences, no duplicate movement of ancestor+descendant. |
| `repeater-lifecycle.test.ts`, `repeater-row-geometry.test.ts` | Two rows with same Layer/member IDs; nested repeater in Layer; Layer in template; refresh invalidates old paint but not unrelated row data. |
| `runtime-text-autofit-lifecycle.test.ts`, `runtime-rotate-snapshot-projection.test.ts` | SetText/member motion updates Layer bounds and parent fit in source order; snapshot geometry agrees with live runtime. |
| `export.test.ts`, `open-sans-fonts.test.ts` | Bare-factory serialization has no closure; font used only inside a Layer is embedded; unused fonts remain omitted. |
| `inline-frame-player-build.test.ts`, `e2e/runtime-transform-runtime.spec.ts` | Preview, offline HTML and nested iframe agree; DOM Layer/member identity survives expected hides/view changes; drag event ownership and suppression are correct. |

New author/browser scenarios should test actual separate root/member selection, Outline recovery, nested entry/exit, resize, then save/reopen. Tests that merely assert a new `layer.children` field exists are insufficient. Numeric expected paths must come from source-bound Layer probes, not existing flat-group results.

## Suggested work split and sequencing

1. **Format/domain contract:** native Layer carrier, IDs, ordering, coordinate semantics, allowed fields, empty/default behavior, adaptive declaration and importer scope.
2. **Model/authoring:** strict schema, structural edge helpers, dedicated Layer transactions, legacy compatibility, generalized scope/Outline and targeted model/editor tests.
3. **Core motion/runtime:** source-backed Layer bounds/member traversal, target adapter, channel expansion, events, fit, snapshots and module/bare-factory tests.
4. **Renderer/export hosts:** explicit non-panel wrapper policy in all three paths, pointer/focus/drag/frame behavior, child-only assets and nested player checks.
5. **Integration:** source-derived fixtures and fail-before user workflows, production/browser/desktop verification and final manifests.

The parent subsequently assigned production ownership as follows: this author owns runtime core/DOM mount, `engine.ts`, React Preview, `export.ts`, `frame-player.ts`, `inline-frame-runtime.ts` and new runtime tests; the parent owns model/traversal/adaptive/components, App/Inspector and WidgetView authoring; the format worker owns reader/import. No production edit is part of this analysis artifact. Source-derived probes and targeted red tests precede implementation. Runtime execution caches require no new saved Document fields; any additional `RuntimeMotionState` field will be coordinated with the parent.

## Open evidence questions

- Native stored versus derived Layer frame, arbitrary nesting and allowed child carriers.
- Group/Ungroup author commands, reparent coordinates and adaptive/all-view behavior.
- Layer visibility, placement, disabled/selected/error, events and hit interception.
- Per-operation hidden/limbo selection, recursive stops, caches and event order.
- Resize/Rotate layered composition, angle cache lifetime and temporal reservations.
- Temporary container ownership under cancellation/rollback and parent/child simultaneous motion.
- Layer bounds after child visibility, SetText AutoFit, item layout and adaptive transitions.
- Original GUI behavior remains unobserved in this task. Static traces and future bounded probes must not be described as original GUI parity.
