# Runtime SetText AutoFit — integration review

2026-10-14. Read-only review of the frozen reconstruction source. No original JavaScript, DLL or application was executed; no browser, test, build or package was run. This new plan is the only file written. Line numbers identify the source read during this review, not an implementation already completed.

## Scope and established boundary

`research/runtime-text-autofit-plan.md` supplies the retained original JavaScript evidence: `SetWidgetRichText` invokes AutoFit after changing text; `SetWidgetFormText` and the public query text setter are separate paths. AutoFit is not an initial page render operation. It measures both enabled axes before one resize, then shifts position for alignment. Height uses the direct text child's content height plus vertical padding. Width uses the maximum paragraph sum of **direct span** widths plus horizontal padding. Do not substitute `scrollWidth`, a glyph union, all descendant runs, or a canvas text estimate.

The frozen `research/runtime-text-autofit-bridge-evidence.md` identifies `wJe6.jJeK` token 100694305 (IL3098 TextRectObject cast, IL3142/3149 width property/getter, IL3189/3196 height property/getter). Its controlled CIL replay, `research/runtime-text-autofit-bridge-replay.json`, records 41/41 cases and explicitly states that transform resolution is injected. Generated flags are stored flags gated by absent effective Transform or the corresponding ScaleX/ScaleY being exactly 1; false flags are emitted too. This is static evidence, not a generated original page execution.

**For the currently admitted ordinary-shape subset, reuse `shapeText`.** `src/model/import-rp.ts:94–111` rejects explicit transforms/origins and, for recovered center P50 rotation, requires the cached P1401 values ScaleX/Y=1, TranslateX/Y=0 and Rotate=0. Current `Widget` has scalar rotation, not a separate scale/matrix. Thus a new scale/provenance field is unnecessary for this milestone. If future import accepts non-identity transforms, it must retain enough evidence to derive the runtime flag gate separately; `Widget.rotation` must not be used to invent that gate. The resize/move consequences of P50 rotation still need their own validation.

Keep the two operations distinct:

- **Initial shape text layout:** `shapeText` selects the independent text-layer CSS/explicit breaks. Owner rectangle, font size and saved content remain unchanged.
- **Qualifying runtime SetText:** safe text replacement, synchronous DOM measurement, runtime owner size update, then alignment movement. No document mutation. An eligible zero-delta call still enters the remeasurement registry.

The bridge cast also covers additional native classes. It does not establish that this product should expand AutoFit to table cells, images, selection controls, forms or tree labels. Existing `shapeText` is restricted to box/ellipse/path; keep that first implementation boundary.

## Existing integration map

| Concern | Concrete source | Current behavior and smallest useful change |
| --- | --- | --- |
| Saved carrier | `src/model/types.ts:159–161`; `src/model/document.ts:804–807`; `src/model/import-rp.ts:436,470,821` | Stores/validates raw flags and still warns that runtime resizing is unimplemented. No new action parameter is needed. Change the warning only after runtime proof. |
| Initial text renderer | `src/model/shape-text.ts:7–41`; `src/components/WidgetView.tsx:76–79,147–158` | Independent text layer, wrapping flag, explicit BRs and padding/alignment. Do not add measurement as a side effect of this initial rendering helper. |
| Safe rich DOM | `src/components/RichTextContent.tsx:17–44`; `src/runtime/export-runtime.ts:2147–2205` | Both preserve paragraph/run/link identities. Native mode inserts explicit breaks. These are the reusable paint foundations, but the measurement adapter must honor native direct-child semantics. |
| SetText action | `src/runtime/export-runtime.ts:1083–1123` | Per-target row scope is already resolved. Form branch manages value/hint/change separately. Shape branch replaces safe text/rich data and currently stops there. Insert AutoFit after this shape mutation, before the next action, not in the form branch. |
| Geometry writes | `src/runtime/export-runtime.ts:807–815,1131–1132` | `patch` writes instance-scoped overrides; Move/Resize actions have their own bounds/eligibility. Reuse the override path, not synthetic UI actions or edits to `doc.pages`. Resolve measured fractional/zero-size rules before copying the action's minimum-1 clamp. |
| Geometry reads | `src/runtime/export-runtime.ts:496–536,559–577` | `widget`, `renderSize`, and expression geometry read overrides. Once a successful AutoFit patch exists, following actions can observe it without a new expression API. |
| Render/measure bridge | `src/runtime/export-runtime.ts:17–22,81`; `src/components/Preview.tsx:33–42`; `src/runtime/export-runtime.ts:2334–2342` | `ControlHost.flush` already synchronously commits React or offline paint for SetFocus. It can support an optional text measurement operation, or a separate text host can reuse that flush. No such measurement operation currently exists. |
| Ordinary render scheduling | `src/components/Preview.tsx:45–46`; `src/runtime/export-runtime.ts:1307–1308,2341–2342` | React notifications and offline microtask paints do not guarantee updated DOM inside the current action chain. A notification alone is insufficient for SetText → read size / move / focus. |
| Adaptive selection | `src/components/Preview.tsx:80–86`; `src/runtime/export-runtime.ts:2041–2044` | Each renderer chooses a max-width view and merges it before `runtime.widget`. There is no explicit runtime adaptive-view transition/remeasure API. |
| Repeater identity | `src/runtime/export-runtime.ts:212–249,837–848`; `src/components/Preview.tsx:88,138` | Runtime uses widget ID plus full repeater/row context; React additionally remounts row content on row revision. Register AutoFit by runtime instance identity, never by widget ID alone or numeric row index. |
| Cleanup | `src/runtime/export-runtime.ts:209–210,851–872,1256,1579–1580,1879` | Page changes/disposal and row deletion/refresh already clear temporary state. Add the new registry to these paths, including zero-delta entries that have no geometry override. |
| Ancestor/item fitting | `src/runtime/export-runtime.ts:1088–1090,1270,1368–1414` | SetText currently does not set `fitNeeded`. A size/position change must be integrated deliberately with panel/repeater fit and Item Resized guards. Do not bypass requested/CSS/readback row geometry layers. |
| Transaction rollback | `src/runtime/export-runtime.ts:1291–1328` | Actions snapshot runtime and several private maps per synchronous segment. Snapshot/restore the AutoFit registry too; otherwise a failed segment leaves a later adaptive resize registered. |
| Headless snapshots | `src/runtime/engine.ts:11–22,71–104` | Snapshot execution creates a session without a live DOM host. Preserve explicit unmeasured behavior or inject a measurement adapter in tests; do not claim browser AutoFit from pure arithmetic. |
| Portable + frames | `src/runtime/export.ts:39–41,54–58`; `src/runtime/frame-player.ts:25–30`; `src/runtime/inline-frame-runtime.ts:125–139` | Main export, srcdoc bootstrap and built frame player share the portable runtime/renderer. A DOM helper must be self-contained/injected into all three; each frame measures in its own document/realm. |

## Concrete gaps that affect implementation

1. **Hidden shape DOM is absent.** Preview returns null for hidden ordinary widgets (`Preview.tsx:86`); the offline renderer also returns before obtaining a node (`export-runtime.ts:2045–2046`), and later removes unused nodes. Native hidden measurement clones an existing owner under a temporary body container. Here the host must be able to construct a safe measurement-only owner for the exact instance. Temporarily showing the live widget would alter visible behavior and events. Do not silently clone an entire ancestor chain: the native routine clones only the owner and has its own inherited-style limitations.

2. **Plain shape text lacks the measured paragraph/run structure.** `WidgetView.tsx:148–149` and offline `paintRichContent` at 2151 place ordinary text directly under `.widget-text`. Native width measurement expects paragraphs with direct spans. A naive `[data-rich-paragraph] > [data-rich-run]` query therefore measures zero for plain widgets. Qualifying SetText needs a safe paragraph/run projection or an explicitly equivalent temporary measurement structure; it must not mutate the saved document or enable HTML strings.

3. **Links change which spans participate.** Rich link runs sit inside a wrapper anchor (`RichTextContent.tsx:26–34`; offline lines 2167–2189). Native direct-span width sums exclude nested link spans at that level. Replacing the rule with all descendants would look plausible but change the observed algorithm. Retain link structures and test link-only/mixed paragraphs independently. Existing block-span paragraphs can be targeted by structural markers instead of an assumed `p` tag; verify used CSS dimensions against the native rule before treating that as equivalent.

4. **Adaptive geometry is renderer-owned.** `baseWidget` at `export-runtime.ts:274` sees authored input and runtime patches; actions call it with the indexed source widget. The current `adaptiveTextStyles` map caches only the supplied style patch, not effective view x/y/width/height or a view epoch. Measurement must use the actually rendered current size, position, padding and alignment, not the indexed base rectangle. A view transition must explicitly trigger registered remeasurements after its new DOM/style and any chosen row refresh ordering are committed.

5. **Headless and real DOM have different capabilities.** `browser-box.ts` measures a CSS box, not text. It cannot substitute for paragraph widths, font loading, hyperlinks or hidden clone layout. Keep DOM measurements in the player host and use injected deterministic measurements to test core scheduling; browser tests must independently prove the adapter.

6. **Synchronous source ordering matters.** The source measures height then width before any resize; it does not measure height again after resizing width. Resize then alignment movement can affect fitted ancestors and row events. Existing `fitFrom` runs once after an action; determine whether native downstream helpers expose an intermediate resize/move result before consolidating them into one final patch/fit. No new ordinary Resize event should be invented from this function.

## Proposed minimal implementation shape (not yet code)

1. Add an optional host operation, conceptually `measureShapeText(id, context, flags)`, plus synchronous `flush()`. Return a bounded, finite measurement result containing the **current effective owner rectangle**, both candidate measured axes, and effective padding/alignment (or a derived axis result with equivalent audit data). The exact DTO is a design choice; the important boundary is that native box/font measurement occurs in the host and action/registry/rollback semantics remain in the portable runtime. Reuse the existing flush path; do not call hooks or React rendering from model helpers.

2. After safe shape SetText mutation, flush the changed text, measure both candidates at the old width, and register the eligible runtime instance even if both deltas are zero. Do not auto-register during `start`, ordinary render, editor Apply, SetStyle, variable interpolation or a form input mutation. A SetText inside Loaded is still a qualifying setter; the initial render alone is not.

3. Update only enabled axes. Preserve fractional disabled axes exactly; do not round unrelated width/height. Apply resize and alignment movement in established source order: right/center shift by `-deltaWidth`/`-deltaWidth/2`, bottom/middle similarly for height. Preserve rotation and all style/content metadata. Follow existing finite/budget guards, but do not assume native zero-size behavior matches the generic Resize action clamp until checked.

4. Keep a private map/set keyed by `instanceKey`, with widget ID and a cloned full `RowContext`. Register its scope in `runtime.scopes` even for zero-delta measurements so `forgetRow` can find it. Clear/restore alongside page changes, disposal, `forgetInstance`, refresh and rollback. Do not persist DOM handles or registrations in the project. If a pending measure ever becomes asynchronous, it additionally requires page epoch, row revision and context validation before application; the preferred synchronous adapter avoids that new race.

5. Add an explicit, guarded adaptive remeasurement entry point. Invoke after the new view's paint in React and offline, not during `renderWidget` recursion and not on every paint. Recalculate only registered instances, remove stale contexts, and bound reentrant fit/refresh work. The original source orders adaptive style/visibility and repeater refresh before `updateAutoFitted`; the current product has no equivalent adaptive refresh lifecycle, so simply adding a React effect is not complete parity. Specify and test this ordering rather than inventing a full inheritance engine.

6. Implement one self-contained browser measurement factory for React/offline/frame reuse. Resolve an owner by instance context; use its own `ownerDocument/defaultView`. Reuse safe rich/plain painters when constructing hidden measurement DOM. Remove temporary nodes in `finally`. Never interpret text as HTML, execute source scripts, reuse a parent-frame DOM reference, or measure remote frame content. The portable factory must not acquire an undeclared imported helper through `.toString()`.

7. Preserve the current authored editor workflow. `RichTextEditor.tsx:250` deliberately uses pre/pre-wrap for editable DOM; this is separate from the player text layer's normal/nowrap + structural breaks. Editing a label is not evidence for running the native runtime setter. Leave owner geometry unchanged until the intended authoring command or qualifying runtime mutation requests otherwise.

## Validation plan and reusable fixtures

These are proposed checks, **not checks run by this review**.

- Extend the existing module/serialized testing pattern from `tests/rich-text-runtime.test.ts`: no initial registration, all four flag pairs, equal text/zero delta registration, growth/shrink, width-only and height-only preserving fractional other axes, padding/three alignment values, SetText → read dimensions in the same chain, form SetText excluded, document bytes unchanged.
- Core transaction/lifecycle tests can reuse `tests/wait-scheduling.test.ts` and `tests/repeater-row-geometry.test.ts`: synchronous failure removes new registration and restores geometry; failing Wait tail does not undo prior commits; deleted/filtered/refreshed row identities cannot resize survivors; two identical rows remain independent; external target acts on visible rows per `targetContexts`.
- Add independent DOM fixtures in preview and actual file HTML: plain shape, multi-run rich paragraphs, internal BR, empty line, all-link paragraph, mixed link/direct runs, fractional text metrics, padding/border, hidden self, hidden panel ancestor, and nested fitted panel/repeater. Compare the source rule's direct-child content measurements, not an expected value obtained from the product helper itself.
- Retain current initial-layout oracles `tests/native-text-layout.test.ts`, `tests/native-text-renderer.test.ts`, and `tests/e2e/native-text-{layout,modes,editing,default-line-height}.spec.ts`: before any setter the imported owner rectangle and font size must remain byte-for-byte/model-equivalent and visually unchanged.
- `tests/e2e/rich-text-runtime.spec.ts` supplies safe SetText/first-run formatting and row fixtures; add geometry assertions without weakening those text/style checks. Include two sequential setters before one normal paint so the adapter cannot read the previous value.
- Adaptive tests should first prove unregistered widgets do not resize, then qualify one setter, change view and prove only its live instances remeasure under effective view geometry/styles. Include a refresh invalidating that registration and a new Item Loaded setter creating a fresh one.
- Reuse internal-page frame coverage from `tests/e2e/native-text-modes.spec.ts` and inline-frame suites. Confirm a child realm uses its own viewport/fonts and resizing a child target does not patch the parent document. Check top-level portable factory, srcdoc bootstrap and built player; zero network/errors and safe literal markup remain required.
- Await `document.fonts.ready`/the relevant faces before deterministic metric assertions. Whether a setter occurring before font readiness should later be repeated is **not** proved by the retained runtime function; do not silently introduce a font-load remeasurement policy or delay all actions in the name of fidelity.

## Remaining decisions before implementation claims

- Exact content-box readback compatibility with jQuery width/height, including inline spans, BRs, fractional borders/padding and zero/empty text. Rotation must not be measured using transformed screen bounding boxes merely because those are convenient.
- Downstream query.resize/MoveWidget effects for rotated owners and nested fit, plus any action-chain observable ordering. The current gate bridge does not prove these operations.
- Missing/hidden DOM measurement construction and the limited inherited-style behavior of the original owner-only clone.
- Adaptive registered-only remeasurement versus the product's existing renderer-only adaptive switching and repeater refresh lifecycle.
- Explicit unsupported/headless measurement behavior. Tests with a fake host prove scheduling only; real browser measurements and a genuine native/reference oracle are still needed before claiming runtime AutoFit parity.

No product behavior or source evidence was changed by this plan.
