# Selection SVG root/body: read-only product integration review

Date: 2026-10-21. Scope: current REA source, tests and retained evidence only. No production or test file was modified; no test suite, browser, package, original DLL or original GUI was run. `fullAxureParity=false`, `originalGuiCompared=false`, `published=false`.

Baseline: `research/selection-adaptive-verification.json`, SHA256 `ff2b41d7ff4eef54e8acf46126ebb2347a84392082915d3d9e5c321d8e863a68`. That prior stage records 6077 unit tests, 21 browser cases and 3 desktop groups; these are prior verification results, not this review's executions. Current runtime remains `07752b1d3d70b7097bb824c8643caa99fbe46b184e0b843736ddb572470d1d9a`.

## Recommendation

Keep the fixed asset, CSS viewport, local body transform and event-driven outer scale as four distinct values. The smallest safe implementation starts in `createSelectionIndicatorRenderer` and the existing display-to-painter argument, not in the author sizing model or runtime resize engine. Do not change the local fill/outline/tick/dot geometry to compensate for an unproven body translation. Do not derive an asset crop from the latest painted stroke width, P94 or owner action dimensions.

The available bounds evidence closes the initial CSS rectangle and absence of root attributes. It does not yet close the complete body transform or clipping. The parallel source workers are resolving those remaining facts. Consequently this report proposes interfaces and red-test locations, not a finished body algorithm.

## Present data flow and attachment points

| Responsibility | Current source | Consequence for this stage |
| --- | --- | --- |
| Normal immutable asset | `export-runtime.ts:641–651`, `ensureSelectionPaint` | Reads normal `widgets.get(id).style`, retains `asset.size` and `asset.width` per instance. These survive selected/style/adaptive repaint and are suitable inputs for fixed path and initial crop geometry. |
| Runtime color/width cascade | `export-runtime.ts:654–672`, `paintSelection` | `outlineWidth` and `markWidth` are mutable retained SVG attributes. They must not become initial crop inputs. The normal asset width is independently available as `assetStrokeWidth`. |
| Adaptive scale history | `export-runtime.ts:678–722` | Raw CSS pair, computed readback and origin are separate. Their event dispatch and exact numeric behavior remain unchanged when root CSS dimensions change. |
| Declaration-only display source | `export-runtime.ts:3520–3527`, `selectionDisplaySource` | Copies normal widget plus effective adaptive declarations and temporary rich text projection. It excludes runtime text/size/action changes. This is a candidate for view CSS generation, subject to the generator's exact rules; it is not a replacement asset. |
| Logical indicator rectangle | `selection-text-layout.ts:53–78` | `result.indicator` means the logical b-square placement from text/padding/alignment. It is not the exported SVG crop. Preserve this meaning so the author geometry and text layout remain unchanged. |
| Root and body painter | `selection-indicator.ts:54–124` | Local paths already come from the pinned b/stroke primitives. Lines 72–75 currently force b×b viewBox, width/height attributes, b×b CSS and overflow visible. This is the direct root/crop replacement site. |
| Stable DOM host | `selection-display.ts:21–43,60–87` | SVG is a direct child of the absolute label. Entry caching and font readiness call the same painter, preserving the SVG node. A font paint must project root/body state, not create or advance adaptive history. |
| React / portable hosts | `WidgetView.tsx:139–145,255`, `Preview.tsx:198`, `export-runtime.ts:4159+` | All already pass the same display source and detached paint snapshot. Preserve native input identity and null-as-runtime-fallback. |
| Export serialization | `export.ts:47,61`, `frame-player.ts:36` | The same factory is stringified for offline and iframe players. An internal pure root projection is automatically portable. Any new external helper dependency would have to be explicitly serialized; avoid a hidden import closure. |
| Runtime snapshot | `ExportState.selectionPaintState`, `RuntimeAdaptiveState`, `engine.ts:11–18` | Asset plus raw/readback scale and adaptive identity survive fresh restore. Pure CSS derivation needs no new persisted field. If evidence later proves another event-dependent viewport mutation, place it in this runtime-only per-instance ledger and cover restore/rollback, never Document. |

## Evidence boundary and proposed root contract

The existing `selection-svg-bounds-evidence.md` closes ordinary unrotated SelectionButton, BoxModel 0, solid paint, no shadow. Let L be the logical indicator rectangle relative to the owner, b its size, and w the relevant source-generation stroke width:

- For w <= 1: CSS rectangle `(L.x, L.y, b+1, b+1)`.
- For w > 1: CSS rectangle `(L.x-w/2, L.y-w/2, b+w+1, b+w+1)`.
- Thus b14/w0 or1 gives 15×15; b14/w3 gives 18×18 with -1.5/-1.5 offset. b18 gives 19×19 or22×22.
- Mode-1 source SVG has no viewBox. The inline rewrite does not copy source width/height attributes. Inline dimensions are CSS declarations, not width/height attributes.
- The nested structure is owner > label > SVG, with input outside the label. The existing product host already uses that structure.

For the proved initial-source cases, a future root projection should explicitly remove obsolete `viewBox`, `width` and `height` attributes, rather than merely stop setting them. React/font refresh or a retained SVG node can otherwise keep the previous product attributes. CSS x/y/width/height should use the evidenced envelope. Keep `pointer-events:none` and accessibility/activation behavior unchanged as existing product policy.

Body coordinates are a different contract. Existing `geometry()` returns local logical fill `(0,0,b,b)`, inset outline and tick/dot primitives. The old evidence also establishes a negative-origin wrapper, but not its composition with positive graphics commands. Do not conclude that the body needs `translate(w/2,w/2)`, `translate(-w/2,-w/2)` or no translation. Once the full emitted-body result is known, represent it explicitly, preferably as a stable body `<g>` transform while retaining local path coordinates. A group is an implementation representation, not itself a claim about the exact vendor markup.

Overflow/clipping must be established separately. The current `overflow:visible` is documented product behavior. Removing viewBox and enlarging CSS alone does not prove correct clipping, and SVG `getBoundingClientRect()` reports viewport geometry rather than the painted stroke extent. Retain the old policy until the source/browser evidence supports a change, then assert both root dimensions and an actual clipping/paint observation.

### Adaptive CSS, P94 and root geometry

The paint worker confirmed the previously retained `setAdaptiveStyle` helper does not directly write ordinary selection SVG CSS left/top/width/height. It adds/applies the view class upstream and then updates scale. The active class can therefore provide a separate SVG CSS viewport. The native generator's exact adaptive class envelope, including P94 and stroke changes, is still being traced in parallel. Do not infer it solely from the helper's absence of a width assignment.

The minimal contract should leave room for three independent inputs:

1. **Asset geometry:** normal captured b/w, used for paths and any immutable body/crop-origin transform.
2. **Resolved SVG CSS rectangle:** initial Base envelope, or an explicitly proved view-class declaration. It may use the active declaration's indicator position/P94/envelope without regenerating the asset. This is separate from the logical text rectangle.
3. **Runtime paint and adaptive transform:** existing final colors, retained stroke attributes, raw scale and origin. The outer scale is applied to the root after its CSS placement; its existing ledger must not be replaced by `currentOwnerSize/baseSize`.

A suitable factory-local shape, after source confirmation, is `rootProjection(asset, logicalIndicator, cssViewport?) -> { cssRect, bodyTransform, rootAttributes }`. `bodyTransform` is not populated by guesswork. Existing `paint(svg, source, current, rect, snapshot)` can remain compatible by computing the default projection internally, with a narrow explicit optional viewport input only if declaration CSS cannot be derived safely from `source`. No new saved Widget field is presently necessary.

If adaptive generation proves the envelope is declaration-derived, `source.style` can feed that pure CSS projection while `snapshot.assetSize/assetStrokeWidth` continue feeding paths. Never use `current.style.strokeWidth` or `snapshot.outlineWidth` as a substitute for declaration CSS: SetStyle and zero-width history change them independently. Returning Base may restore Base class CSS while retaining outer scale. P94-only may change the class viewport without changing the matrix; it never authorizes recreating paths. These conditional cases require source fixtures before implementation, not a blanket hardcoded base-envelope policy.

## Existing assumptions to update or preserve

| Location | Current assertion | Required treatment |
| --- | --- | --- |
| `tests/selection-indicator.test.ts:145` | width attribute is `14` | Change to attribute absence for the proved inline contract; also assert CSS dimensions from envelope. |
| `tests/selection-indicator.test.ts:201,243` | viewBox is `0 0 b b` | Replace with absent viewBox. Keep retained local path oracle checks and paint history checks. |
| `tests/selection-indicator.test.ts:244` | left/top equal logical rectangle and overflow visible | Add source crop offsets for w>1. Overflow change remains evidence-gated. |
| `tests/selection-indicator.test.ts:139–153` | scale is projected once and clears for fresh asset | Preserve; CSS root size change must not add another scale or clear history. |
| `tests/e2e/selection-adaptive-svg.spec.ts:91` | root screen bbox equals `14*scale` on every view | Replace with the corresponding proved CSS viewport times scale, not simply `15*scale` for every view. This fixture changes P94 and SetStyle stroke too. |
| `tests/e2e/selection-adaptive-svg.spec.ts:77,87` | snapshots direct SVG children for path identity | Keep identity assertion, but select explicit data-selection primitives if a stable body group is introduced; otherwise an array of null group attributes can falsely pass. |
| `tests/e2e/selection-state-paint.spec.ts:78,100` | viewBox/paths stable across state paint | Preserve geometry stability; initial viewBox becomes null and descendant selection must remain meaningful if body grouping changes. |
| `.build/smoke-selection-adaptive-synced.mjs:53,65` | final bbox84×126 and fixed viewBox14 | Historical script is frozen: leave it unchanged. New stage smoke must use proved viewport dimensions, attribute absence and source-bound path placement. |
| `.build/smoke-selection-adaptive.mjs:48` | fixed viewBox14 | Preserve the historical artifact; use a newly named stage script. |
| `.build/package-selection-adaptive.mjs:21–22` | packages the prior final-dist | No crop math is embedded. New stage needs a new dist/package path; never overwrite prior evidence/package. |
| `selection-text-layout.test.ts`, host text/owner assertions | logical P94, text constraints, padding, invisible input, unchanged owner | Preserve. Native asset viewport expansion does not increase owner width, text reserve or P94. |
| Runtime tests (`selection-state-runtime`, `selection-adaptive-runtime`) | normal asset b/w, action stroke history, same-view gate, raw/readback matrix | Preserve. New root/crop does not change event counts or numeric multiplication. Add snapshot-root projection coverage only where necessary. |

The state smoke currently tests paint widths (for example checkbox mark6 at b28), not a b×b root viewport. Those assertions remain valid. `selection-display.spec.ts` left122 on the right-aligned b28/w1 case also remains valid under the proved zero-offset w<=1 envelope; do not shift all controls by half a pixel. The tests' text-left14 and owner150×40 values describe separate logical/owner contracts and must not be changed to15 or crop dimensions.

## Minimal red tests and reusable fixtures

1. **Root matrix in both module and bare serialized factory:** extend the existing unit SVG sink with b14/b18 × w0/1/3 × left/right logical rectangle. Use `selection-svg-bounds-probes.json` as the independent CSS/root oracle. Assert no viewBox/width/height attributes and exact CSS envelope. Seed old attributes first so migration on a retained DOM node is tested. These can be red immediately without inventing body expectations.
2. **Body composition:** after new source oracle freezes, preserve the existing local primitive tests and independently compare the composed path positions/body transform for fill, outline, tick and dot. Use a nonzero logical origin and fractional stroke3 offset so accidental global/local cancellation is visible. Do not generate expected paths with the product renderer.
3. **Asset vs cascade:** base b14/w1, runtime stroke3 then0 and P94 change. Keep original paths and source crop/body origin stable. Assert retained runtime width3 separately. The active CSS viewport expectation must come from the new adaptive-class oracle, not from either runtime width3 or asset b alone.
4. **Adaptive sequence:** reuse `selection-adaptive-svg.spec.ts`'s three-route fixture and named/Base/same-ID/P94/fractional sequences. Preserve existing matrix expectations exactly. Independently assert per-view CSS viewport, root bbox, absent attributes and stable path/input/SVG nodes. Repaint/fontsReady must leave all ledger history unchanged.
5. **Snapshot continuity:** reuse the fresh snapshot constructor test in `selection-adaptive-runtime.test.ts:302+`; paint the restored snapshot into a fresh SVG sink and verify the same asset root/body and raw transform. Do not use constructor restoration to synthesize another adaptive event. No Document serialization change should occur.
6. **Host and package:** retain Preview/offline/iframe common factory coverage, unchanged save, hidden controls and isolated repeater instances. For a new package smoke, preserve the existing font+two-animation-frame capture synchronization and inspect each child frame separately. Check root CSS and rendered evidence; root bbox alone cannot certify stroke clipping. No port/server or package is needed for the unit red matrix.

## Compatibility risks and narrow ownership proposal

- A viewBox removal changes the mapping when CSS dimensions differ from b. That is the intended native distinction, but it must land with body placement and crop tests, not as an isolated cosmetic deletion.
- A stable `<g>` affects tests that assume all primitives are direct children. Existing renderer `querySelector` is descendant-capable in a browser, but the unit sink currently searches only direct children; update the sink meaningfully instead of weakening geometry assertions.
- `SelectionDisplay` caches by declaration source. A pure crop projection can re-evaluate on every `apply`; no second font measurement is needed just for stroke padding. The latest paint snapshot stored on the entry already survives the async font refresh.
- Existing `null` runtime fallback must remain distinct from undefined author rendering. Unsupported initial paint/corners/shadows/rotation should not become supported merely because CSS bounds are known.
- Avoid growing the runtime ledger if the new information is a pure function of captured asset and current declared CSS. If an event-dependent CSS attribute is proved, add a compact optional runtime-only field with old-snapshot compatibility, detached getter projection, atomic rollback and row/page cleanup; do not retain a full Widget snapshot.
- Runtime core/engine should need no change for a pure root/body projection. Renderer and focused renderer tests are the primary implementation slice. Display argument/types and host tests are a second slice only if native CSS generation requires a separate projection. Parent-owned browser/package fixtures form the acceptance slice.
- Leave all historical `.build` source snapshots, evidence probes, verification files and package scripts immutable. This report is the only output of this read-only task.

## Read-only source identity

The following hashes were captured during this review and rechecked before delivery. They bind the analysis; future changes require a new review boundary.

| File | SHA256 |
| --- | --- |
| `src/model/selection-indicator.ts` | `8a31c5b7493aaaba14bf3958581f2af9dfe8b90f1568f1bdd3065a5956215ed6` |
| `src/runtime/selection-display.ts` | `f4755d8c282079bf572afee76dd8cb8bf2d9285f9499c89795df8ad2b96791a6` |
| `src/runtime/selection-text-layout.ts` | `a78e70066506567db12d64687d1a561e4d5eec0c9ec20e2d3650ab09cf3ff9bf` |
| `src/runtime/export-runtime.ts` | `07752b1d3d70b7097bb824c8643caa99fbe46b184e0b843736ddb572470d1d9a` |
| `src/runtime/engine.ts` | `c3c9786f2e402f2106754b750a9a68c54553da4e94bc26bff881a3ec73542e1a` |
| `src/runtime/export.ts` | `45c62e446bfb16cc93efd12e048e7563af42702e6c6952d00352d3963419f43c` |
| `src/runtime/frame-player.ts` | `4ec76c5bf301d254bbd76a5d68f92978b3cad8c0c7fc22b4efc119c28a47be1f` |
| `src/runtime/inline-frame-runtime.ts` | `474a0b36fb9170b8aa0b5c8ffaf97c3dac3e9a1557be4bda2cb0b0f48885fa7c` |
| `src/components/WidgetView.tsx` | `3724e42ba44aad9c1afc7d00a79b8ed25ee4d5b4f528a5d969328c34639c7370` |
| `src/components/Preview.tsx` | `696a5606d4b8468cef16e3d0ea20aaf2430dffe06a76e8a8c2cb2f63cb62f29b` |
| `tests/selection-indicator.test.ts` | `a20200ce0dccc90e862fcaad65a9cec940c2801790f7229589f69d2cf60f5d86` |
| `tests/selection-display-host.test.ts` | `568f850c5c808cb4d7e85de126b87d6877b793af9e2a242fefeb83233d76e9f9` |
| `tests/e2e/selection-adaptive-svg.spec.ts` | `f32210d8357bbd972f1b4c647c2f81e5caf5de78b2464e6643b62a430be36671` |
| `.build/smoke-selection-adaptive-synced.mjs` | `8adbe6e4d19d3fbc6fcc7f476ecd715105e7c8c72480d5697c0aedf18801d7a6` |
| `.build/package-selection-adaptive.mjs` | `4f615f3059c7e4eec074ea0caae64f065218228d2d502ad0cd5fcba7a9660a89` |
| `research/selection-svg-bounds-evidence.md` | `5aec0afcc49eb0a3cfd72ec00b7d2f333ed2b45c7d082b7cbe15a2492f59de60` |
| `research/selection-adaptive-verification.json` | `ff2b41d7ff4eef54e8acf46126ebb2347a84392082915d3d9e5c321d8e863a68` |

Recheck: 17/17 hashes unchanged. No product/test mutation or test execution was performed.
