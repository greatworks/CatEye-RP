# RP 11 adaptive view hierarchy: stored structure and authoring evidence

This investigation uses the retained Axure RP 11.0.0.4150 assembly (SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`), static ECMA metadata/CIL, decoded literal resources, and eleven original RP/RPLIB files. No target assembly, application, or generated project was executed. All supporting files have this report's `adaptive-hierarchy-format-` prefix; the manifest pins their bytes and the original sample hashes.

## Stored structure

`Ot71.bt7H` is `Axure:AdaptiveView`: the type-name writer is token 100715627; serialization/read methods are 100715630 / 100715631. The same keys occur in original objects. The stored fields are `Id` (Guid), `Name` (string), `Size` (Width/Height numbers), `Cursor`, `BaseViewId` (Guid), `BaseViewName` (string), and `ParentAdaptiveViewSet` (reference). `Size` is the source of the Width/Height accessors (100715606 / 100715610). `BaseViewId` getter/setter are 100715616 / 100715617. `BaseView` resolves the ID within its set (100715618), and its setter writes the resolved view's ID (100715619).

`PtPZ.itPU` is the view set: serialization 100715542 writes `Id`, empty `Name`, `DefaultAdaptiveView`, and ordered `AdaptiveViews`. Its 100715536 method exposes the default together with named views; this is distinct from the stored named-view array. The metadata field with enum signature 33558123 is **PanelScrollbars**, not a viewport condition or enabled flag.

The default Base sentinel is `19e82109-f102-476f-9335-82835c373474`; the Auto sentinel is `982030d6-73df-4586-8f11-149ca2b8b02f` (100715640). These are native object identities, not an instruction to create a named self-parent in the independent document model. `Default` compares the native ID to the Base sentinel. A missing model parent can represent Base without retaining that self-link.

The older compatibility writer 100715639 emits `Condition=7` and Size under a writer-mode gate. Metadata proves 7 is `LogicalComparison.GreaterThanEqualTo`. This does **not** establish a current user-selectable condition property: no such property occurs on the current view class, no Condition occurs in the three complete view records, and the current generated view writer below does not emit it. The precise compatibility-mode scope is not resolved here. No persisted per-view enabled flag was identified. Current runtime activation is the global `configuration.useViews`, independently checked by the runtime investigation.

## Generated object is different from the stored object

`sJeD.wJe6.OJeL` token 100694304 is pinned in `adaptive-hierarchy-format-generator-cil.json`; decoded field literals are in `adaptive-hierarchy-format-literals.json`. It writes `id`, `name`, `cursor`, `baseViewId`, `size`. Its default-ID branch at IL112–128 jumps directly to IL276, skipping the `id` write at IL262–271. Thus the raw Base self-Guid is **not** emitted as a named default ID. `baseViewId` is omitted when its raw ID is Base, or a parent cannot be resolved. Non-default identity mapping differs by the explicit generator mode (Guid N string versus context mapping); do not equate all generated IDs to raw native IDs.

The size writer also has an explicit positive width-override argument; it must not be mistaken for an extra persisted viewport dimension. The retained narrow callers (`cJFt.LJFU` 100691594 and `AJFf` 100691600) identify the project/page integration, but this report does not generalize every alternate generator mode. Neither `enabled` nor a comparison operator is emitted by this view writer. In the shipped runtime, parent IDs govern style ancestry, while size alone governs automatic selection; see the independent adaptive hierarchy runtime report.

## Author operations

`JVl4.TVlY.iVyF` 100676306 constructs a new view, supplies a unique name, and sets its parent to the selected view. `SVyj` 100676307 copies a view while retaining the copied view's parent (a sibling relationship). The parent-selection handler `CVyG` 100676300 uses the explicit BaseView setter.

Delete handler `QVyb` 100676308 asks “Deleting a view cannot be undone.” and, after confirmation, selects only direct children, rewrites each child's BaseViewId to the removed view's BaseViewId, removes the selected view, and clears selection. The captured predicate `<RemoveButton_Clicked>b__0` 100676330 is exact: IL8 reads candidate BaseViewId, IL14 reads removed Id, IL19 compares Guid equality. This establishes **direct-child reparenting**, not descendant flattening and not copying the removed view's styles into its children. No widget-content rewrite appears in that handler. The final project-wide style cleanup/commit and native undo stack were not executed; the independent editor may provide undo as its own authoring capability.

The view definition itself does not store widget text/interactions. Per-widget adaptive style payloads and content-sharing capabilities are separate from this structure; this report does not infer a complete RP import contract from names or caches.

## Eleven-sample coverage and import boundary

`adaptive-hierarchy-format-census.json` preserves file/package SHA-256, package version, native object IDs, offsets and raw tagged fields. It found exactly three complete view sets and three default views: Default.rplib, Flow.rplib, Prototype Starter.rp. All have empty `AdaptiveViews`, Base Size 0×0, empty Name/BaseViewName, and BaseViewId equal to the Base sentinel. There are **zero complete non-default view definitions and zero nonempty sets**; all packages parsed successfully.

Separately, 914 page records contain three `AdaptiveViewMatchInfos` cache entries: iPhone 320×0, iPhone4 320×460, and Grid 960×0. Their actual AdaptiveViewSet reference is zero. These records lack a complete parent hierarchy and must not be promoted into live views merely because sizes and names exist. The census records every reference-bearing object so this absence can be audited.

Accordingly, the product can implement a new authored hierarchy with explicit parent IDs, width/height, global native-size selection mode, and a separate Base size. Existing documents retain their prior selection mode when the field is absent. **Native RP hierarchy import remains unrecovered** in this stage. No corpus claim of a nontrivial imported hierarchy, condition-based view, or per-view enable setting is made.

## Reproduction and limits

Run the new census with `node research/adaptive-hierarchy-format-census.mjs`. Metadata/CIL scripts use PEReader on the pinned DLL and never load it. The new literal decoder folds integer constants and reads retained resource bytes through the previously pinned static interpreter. CIL is evidence about code paths, not a GUI experiment or a complete generated-project comparison. Width/height validation limits and the independent editor's 50-view cap are product contracts, not inferred original UI limits.
