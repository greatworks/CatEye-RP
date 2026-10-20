# Axure RP 11 Move / Set Size format evidence

This is new, read-only research for the next milestone. No production reader, importer, model, runtime, tests, or prior evidence was changed. The pinned managed assembly is Axure RP **11.0.0.4150**, SHA256 **dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7**. All CIL was read as PE metadata; no target DLL method or original GUI was executed. The probe is a bounded interpreter with declared expression/JSON sinks, not an original exported prototype.

## Real corpus, not admission counts

The 11 pinned files contain 41,662 decoded objects. `runtime-transform-format-census.json` retains action objects, paired target/info arrays, expression closures, package versions and SHA256, owner identities, and ordered case siblings. `runtime-transform-format-summary.json` supplies independently asserted counts and compact source records.

| Sample | Move actions / infos | Set Size actions / infos |
|---|---:|---:|
| Sample form patterns.rplib | 42 / 50 | 8 / 8 |
| Prototype Starter.rp | 2 / 2 | 1 / 1 |
| Quick Win.rp | 2 / 2 | 0 / 0 |
| Other 8 files | 0 / 0 | 0 / 0 |
| Total | **46 / 54** | **9 / 9** |

Move has 38 single-target and 8 two-target actions. All observed target paths have empty `rdo-path` and `repeater-path`, and `is-dummy=false`; 14 Move infos target the zero/This sentinel. This does not establish arbitrary master, repeater, or grouped-path support.

The 54 Move infos have modes Location=26, Delta=18, DragX=10; all trajectories are Straight=0. Easing is None=38 or Swing=16; durations are 200=4, 300=18, 500=32. **12** infos have non-null boundary expressions. Only **30** infos have two numeric-literal inputs; the other 24 contain expressions. All 9 Set Size infos have expression inputs, anchor `top left`, easing None, and duration 500. There are **36 nonempty input StringLiteral scopes**, while the MoveInfo-level `scope` maps are all empty: these are distinct carriers and must not be conflated.

There are **6 real cases combining Move and Set Size**, sometimes with intervening SetFunction actions. There are **0 real cases combining Rotate with either Move or Set Size**. The three-action example in the new evidence JSON is explicitly a synthetic structural composition; it is not a captured original file, full original export, or timing experiment. This stage makes **no new import claim**.

## Native action and info storage

### Move

`IxMoveWidgetAction` (TypeDef **33557799**) serializes type `Axure:InteractionMoveWidgetAction`. Its current carrier has `Disabled`, `panelobjectpaths`, `WidgetPaths`, and `MoveInfos`. Keys are proven by `EIyA` **100704614** / `nIyo` **100704615** and real objects; the paired arrays have matching lengths and path identities in all 46 observed actions. Historical `widgetpathsandmoveinfos` reader branches exist but are not admitted by this research contract.

`MoveWidgetInfo` (TypeDef **33557801**) writer `NIwY` **100704662** stores:

| Field | Native carrier |
|---|---|
| `XValue`, `YValue` | independent StringLiteral references, including binding/scope objects |
| `MoveType` | MoveBehavior integer enum |
| `MoveTrajectory` | MoveTrajectory integer enum |
| `BoundaryCondition` | expression reference; zero means null |
| `scope` | separate local scope map |
| `Easing` | AnimationEasing integer enum |
| `Duration` | numeric duration |

Author constructor **100704634** sets X/Y to literal `0`, easing None=0, retains the supplied mode and duration, and creates an empty scope. Straight=0 and null boundary are CLR field defaults. The reader constructor's temporary easing=6/duration=1000 initialization is **not the author default**.

Factory `vIyQ` **100704595** normally supplies Delta=1 and `tNAH(typeName,500)` duration: **500 is a preference fallback**, not an unconditional user setting. Under native OnResize=321 it instead chooses SizeDeltaY=8 for `mJf2` (the generated `widgetsBelow` path), otherwise SizeDeltaX=7. Do not translate these special modes into ordinary By without their parent event and target semantics.

The writer compatibility test `nt01` **100716130** compares its format version with `Ubz5` / `Nbz4` (**8.0.5.0**, `QbzB..cctor` IL0x051D–0x0526). The exact 8.0.5 branch omits `MoveTrajectory`; the witnessed 11.0.0.0 branch writes it. The bounded probe supplies the writer version lookup explicitly; it does not run the original writer infrastructure. This is not blanket support for historical package versions.

MoveBehavior (TypeDef **33557893**) has the complete nine values:

| Value | Enum | Generated string |
|---:|---|---|
| 0 | Location | `location` |
| 1 | Delta | `delta` |
| 2 | Drag | `drag` |
| 3 | DragX | `dragX` |
| 4 | DragY | `dragY` |
| 5 | LocationBeforeDrag | `locationBeforeDrag` |
| 6 | WithThis | `withThis` |
| 7 | SizeDeltaX | `sizeDeltaX` |
| 8 | SizeDeltaY | `sizeDeltaY` |

MoveTrajectory (TypeDef **33557894**) is Straight=0 / ArcClockwise=1 / ArcAntiClockwise=2, generating `straight`, `arcClockwise`, `arcAntiClockwise`. Neither MoveInfo storage nor its generator has a Rotate-like anchor, clockwise, or offset pair. Direction of the arc belongs to trajectory.

### Set Size

The exact action is **`Axure:InteractionSetWidgetSizeAction`**, not a guessed ResizeWidget type. `IxSetWidgetSizeAction` is TypeDef **33557860**. Current arrays are `WidgetPaths` and `SetSizeInfos`, alongside `Disabled` and `panelobjectpaths`; key methods are **100705563/100705564**. Older `widget-paths` / `set-size-infos` aliases are present in the reader, but their full version migration policy remains outside this strict current-format contract.

`SetWidgetSizeInfo` (TypeDef **33557862**) writer **100705598**, reader **100705599**, uses exactly five lower-case keys: **`width`, `height`, `anchor`, `easing`, `duration`**. Width/height are independent StringLiteral references, not plain doubles in the saved action. No separate To/By enum is present in this type's fields or writer. Relative dimensions must remain expressions; inventing a native `sizeMode` would change the carrier.

Author constructor **100705580** converts supplied dimensions to invariant-culture literal strings, sets `anchor='top left'` and easing None, and retains the caller duration. Ordinary factory **100705548** reads target `Size`; its fallback uses the container repeater's item width/height. A separate `oJfb` special-path branch supplies 0/0/0; the exact author-facing special selection remains unresolved, so it is not generalized to ordinary targets. Duration again uses the 500 preference fallback for ordinary targets. The numeric storage adapter `B5Sy.w5SQ` **100718348** is exactly `ldarg.0; ret`, not a clamp or rounding operation.

Only `top left` is witnessed in the nine size infos. Its constructor default is proven. The full Set Size UI anchor binding list is not closed here. The existing product's canonical nine-position anchors are a runtime-compatible design, not a claim that all nine native UI strings have been recovered. No native maximum duration or dimension range is asserted.

## Generator structure and target semantics

`hJMr` **100694344** dispatches the concrete action types; `QJMF` **100694345** removes `Ix` and `Action` from the class name then lowercases the first character. The resulting opcodes are `moveWidget`, `rotateWidget`, `setWidgetSize`.

| Action writer | Token | Generated array | Per-target info key |
|---|---:|---|---|
| `CJMc` | 100694360 | `objectsToMoves` | `moveInfo` |
| `nJM6` | 100694362 | `objectsToRotate` | `rotateInfo` |
| `oJMx` | 100694366 | `objectsToResize` | `sizeInfo` |

All call `hJMj` **100694346**, which enumerates ActualPathInfoMap in its source order, checks a resolved object or an eligible special path, writes one `objectPath` plus its paired info, and invokes the corresponding info writer. It can emit `thisItem`, `widgetsBelow`, `widgetsRight`, or the normal path sequence. A two-target action is one generated action containing two entries; it must not be silently flattened into unrelated actions with assumed scheduling.

`get_ActualPathInfoMap` **100704726** uses Select over the stored map; `YNAg` **100704767** retains each value and transforms the key through `IxAction.QN8Q` **100703076**. The latter replaces the This predicate path with the action's current path, otherwise returns it unchanged. This is not evidence that this accessor expands an arbitrary group to all descendants. The wider resolver for compound references and enumeration policy across independently constructed maps is not proved here.

Move additionally emits **`parentEventType`** from its enclosing IxEvent. Nested info writer **100694547** emits `moveType`, `xValue`, `yValue`, and `options`. Options writer **100694548** writes `boundaryExpr` and `boundaryStos` first. If easing=0, it returns before writing **all three** of `easing`, `duration`, and `trajectory`. Nonzero easing writes all three. The 54-case matrix covers all 9 modes × 3 trajectories × two easing branches, with a controlled boundary compilation sink.

Size info writer **100694570** emits `width`, `height`, `anchor`, `easing`, and `duration`; easing/duration are **always present**, including None. Easing comes from the same 33-entry enum already proved for Rotate, via enum-name first-character lowering. The exact numeric order and strings are in the evidence JSON; they are not inferred from a third-party animation library.

`BJC9` receives the original StringLiteral objects; these may contain expression tokens, variable identities, local widget bindings, and repeater scopes. `TJMo` **100694399** dispatches the boundary expression tree. `sNQv` **100704659** / `DNQQ` **100704660** build direction-based boundary expressions/STOs using top/bottom/left/right, `valueVar`, `direcVal`, `xSto`, `ySto`, and Target dimensions. The exact compiler output of arbitrary nested boundary conditions is **not fully replayed here**. The probe's named sinks preserve this gap instead of converting all boundaries into a guessed min/max rectangle.

Move author eligibility uses the common 18-type set plus Repeater; the collection helper is an append/union iterator, **not an exclusion of Repeater**. Size's filter has 13 entries (InlineFrame repeated), 12 distinct types: DynamicPanel, VectorShape, ImageBox, ImageMapRegion, InlineFrame, TextBox, TextArea, ListBox, ComboBox, Button, Screenshot, Layer. These author filters do not prove every type has effective runtime geometry behavior.

## Concrete source anchors for a future import milestone

- Form SHA **1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179**, package `434a6863288944e1aac85ef2ca119122`: TextBox owner `ae0d2e1f994641f7b19f317422b33927`, action `7c82a34fcf4c46cc85a4f9f1e3fa4624`, two targets, Delta (0,-6), Swing, 300ms; ordered after Fade in its Focus case. This is a meaningful simple Move candidate, not proof the entire event can already import.
- Form package `e60b879dcd664f83b848b6f88263b0a3`: DynamicPanel `d3944486d37d4fd691df13a2f2efc6fb`, action `5bb6eee435cf45d38e5048b215680302`, target `5daa721c93574f1d839b01bb4b55a1ee`; width `[[(this.x - track.x)+2]]`, height `[[Target.height]]`. Local `track` resolves through GetWidget to `d515a37dfd114af6877e6c6d4d244032`. Nearby DragX action `11d6f5026e0f42a0ae792349648002c3` has an AND boundary tree.
- Starter SHA **6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714**, package `8b68f2d30ba344a7a6d048828b1d51ec`: Page `e15ecd0bc1c74f03ba0c9c5e494f4163`, action `12f91ea6ba0345f490ac0d0e8cb59057`, target `f330d496d0d8446f9ad77561aa262fc7`; `[[Target.width]]` × `[[Window.height-Target.y]]`.
- Quick Win SHA **04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051**, package `990b0f0c6fe44617900b184763aaff5b`: actions `26550ad703aa40e7b725dffed5637c3c` / `107db3bec63940729d4939f1ff2df346` move the same target `203a6dc08ddc4483aa97eb0d35d5fc20` by (0,-65)/(0,65).

The exact source part hashes, all owner/case/action IDs, raw scopes, full expressions, and sibling actions are retained in the machine-readable census/summary; source GUIDs are not product-generated IDs.

## Proposed next-stage contract and strict boundary

Preserve an ordered action-level target/info batch, rather than assuming one target per action. Move needs all nine native modes, both expression carriers, trajectory, complete boundary AST/scope, easing/duration, and enclosing-event identity. Set Size needs two expression carriers, anchor, easing/duration; do not introduce a native To/By discriminator. An expression carrier must preserve or safely resolve the native bindings, not retain only its visible `[[...]]` text.

Current RP11 storage can be validated without guessing: exact action/info types and allowed keys; matching nonempty paired arrays; local unique references; known enums; finite numbers; preserved field presence and original strings; complete target paths and complete event/case/sibling recovery. Unsupported or unresolved pieces must reject the whole event under the existing policy. Product limits (such as 60000ms) remain separate documented bounds.

Safe initial implementation candidates are fully resolved ordinary targets/This with complete expressions and known timing semantics. This does **not** authorize dropping boundary conditions, reducing DragX to Delta, erasing local scopes, treating Size as numeric-only, broadening special group paths, or partially admitting the 6 mixed Move/Size cases. Full real coverage requires the expression/binding and drag-boundary paths; current generic expression, nested target, event-type, and sibling-action limits must be reported individually. The 46/9 counts are candidates, not predicted recovered events.

Unresolved: full boundary AST→STO compilation; original UI anchor-list binding; preference persistence/range validation; compound target resolver and grouped scheduling; actual rendered Move/Resize timing, geometry, event ordering, hidden/fit/repeater behavior; historical carrier migrations. No original GUI/pixel equivalence is claimed.

## Verification and frozen files

`runtime-transform-format-static-probes.json`: **64/64**, bounded original-CIL control-flow tests with named sinks. `runtime-transform-format-summary.json`: **8/8** exact source/corpus assertions. The preserved first probe (`runtime-transform-format-static-first-probes.json`) has 31/60: 27 failures were the incorrect initial expectation that None still emitted trajectory, one was a wrong controlled writer-version input, and one was an unimplemented identity numeric sink. These were research harness/expectation corrections, not product regressions or a native execution result.

The evidence JSON and `runtime-transform-format-manifest.json` bind the pinned DLL, selected historical helpers, current read-only reader, all new evidence, and the 11 sample SHA256 values. No full unit/browser/desktop suite or build was run for this research.
