# Selection layout integration review

2026-10-20. Read-only source and retained-evidence review. No original DLL or GUI execution, browser measurement, product/test change, or broad test run was performed for this report. The source-bound author transaction is available, but the missing font/graphics services must remain explicit independent implementations. This report proposes an integration contract; it does not report implemented rendering or native pixel equivalence.

**The smallest useful integration has two distinct outputs: a transient browser-derived text/indicator layout for display, and an explicit author-command candidate for saved geometry. Opening a file, rendering Preview, loading fonts, or changing the displayed adaptive view must not commit the latter.**

## Existing implementation and exact gaps

`src/model/selection-layout.ts` already separates layout, external Size, and shared fit-flag entries. Its inputs require an effective owner rectangle, the previous local text-panel rectangle, raw/effective fit flags, padding, P94, alignments, a translation-only coordinate context and optional KNYS. It calls explicit measurement, minimum-size, graphic-unit-conversion and union services. It returns candidate state plus ordered effects. Failure with `diagnosticPartialState` is not a commit payload.

The ordinary source domain is unrotated SelectionButton without a general transform. Raw/effective fit must agree. The source-specific two minimum reads, two possible measurement passes, Size-before-Location, strict near-equality, guard cleanup and distinct rounding modes must stay in this adapter, not be reproduced approximately in React.

Current display is not that adapter. During this review, parallel parent work added the separate runtime selection measurer and host bindings. The four changed files were reread at the hashes listed below; this review does not claim their browser verification:

- `WidgetView.tsx:230` renders checkbox/radio as a flex `.check-widget` label containing a native browser input and a text span. `style.css` adds gap7/padding3; neither is native P94. The new branch consumes `selectionText` for text construction/whitespace, but still does not position an indicator by P94 or text by a measured panel rectangle.
- `shape-text.ts` supports only box/ellipse/path. Its absolute full-width flex-aligned text rule is specifically the ordinary VectorShape contract. Selection text has a different generated relationship and cannot join that helper merely by expanding its type allowlist.
- `RichTextContent.tsx` uses `pre-wrap`/`anywhere` unless its `nativeLayout` branch is selected. The updated selection branch now selects it when explicit selection metadata and layout style are present. It preserves paragraph/run formatting and separates initial-text from plain runtime-setter construction. Retain this structural machinery; do not flatten hard breaks, empty paragraphs, run styles or literal text.
- `shape-text-measure.ts` has separate ordinary-shape and newly added selection runtime paths. Selection uses paragraph direct-span width sums plus padding, leaves candidate height at owner height, and rejects height AutoFit. Neither path returns the managed KIf5 font measurement. Its hidden-copy infrastructure is reusable, but these runtime formulas are not a SelectionButton author service.
- Preview now binds both `measureShapeText` and the separate `measureSelectionText`; offline mount was updated similarly. Author integration must not install `planSelectionLayout` in the selection runtime callback. The core selection path deliberately skips Resize, can Move for alignment, and rejects height AutoFit's evidenced invalid native branch.

## No verified stored TextPanel rectangle to seed this integration

Current semantic recovery supplies saved owner Location/Size, rich text, fit flags, alignment and independently sourced P94. `selectionLayoutRecovery` and `Widget.selectionText` carry no panel rectangle. The inspected Default objects are:

| Native object | Package | Source ID |
|---|---|---|
| Checkbox | `f5eb6c5d4fd041d48f2d93f23c5a8d32` | `a242d373d93f443cb7674d57893bd3d2` |
| RadioButton | `1661553b21d64561b7205c5d4edbdc0f` | `761eda201c1640dda072eae1f0388827` |

Reading those original decoded maps found RichTextBlock, MyStyle, AdaptiveStyles and explicit shared fields, but no TextPanel/Rect property. RichTextBlock contains attributed text and its property dictionary. The retained TextRectObject storage pair `NIwY` **100702405** / `oIw4` **100702406** establishes fit serialization/readback; it does not supply this review with a panel-rectangle carrier. TextPanel `get_Rect`/panel setter evidence concerns the live computed panel, not proof of serialized panel geometry.

This is a bounded negative result: it does not assert that every native class or package version never serializes such a rectangle. It means the current reader has no verified original panel seed to reuse. The census's owner Size is not that seed, and KNYS is a style-editor owner reference, not a TextPanel rectangle or generic drag baseline.

Consequently, a new host must label its seed `browser-derived`, with the content/style/constraint/font revision that produced it. It must not add a fabricated `nativeTextPanelRect` to imported source evidence. If a command cannot obtain a finite, applicable previous measurement, return a pending/unsupported result instead of passing owner bounds or zero as an alleged native panel.

## Minimal host interface

Keep the existing pure adapter unchanged. Add a separate browser service/session, approximately:

```ts
type SelectionLayoutKey = {
  documentRevision: string;
  pageId: string;
  viewId?: string;
  widgetId: string;
  instance?: readonly { repeaterId: string; rowId: string }[];
  contentStyleRevision: string;
  fontRevision: string;
};
type SelectionPanelSnapshot = {
  key: SelectionLayoutKey;
  origin: 'browser-derived';  // never represented as original RP state
  panelRect: SelectionLayoutRect;
};
type SelectionDisplayLayout = {
  panel: SelectionPanelSnapshot;
  textCssRect: { x: number; y: number; width: number; height: 'auto' };
  indicatorLocalRect: SelectionLayoutRect;
};
// Prepare fonts and immutable effective text/style before synchronous planning.
// The prepared session implements SelectionLayoutServices, using isolated DOM.
// A separate explicit command supplies SelectionLayoutInput + Entry and
// commits only a validated ok:true result with the same revision/key.
```

The host receives the **already resolved** current view/style/rich text and coordinate context. App's descendant display projection and Preview's `session.widget`/`session.richText` provide appropriate integration points. Do not apply the base widget font a second time over explicit run fonts, or interpolate repeater rows twice. Different rows/instances must never share a text measurement cache solely by widget ID.

The browser `measureText` callback receives the adapter's actual requested width:10000 for width-fit, or its supplied constrained width otherwise. Return **unrounded text-content size**, excluding owner border, indicator and text padding. The adapter owns reservation and rounding. Use a connected, hidden isolated text tree with the same paragraph/run styles and hard-break representation as the intended renderer; do not use transformed screen bounds, the current generic checkbox label's gap/input dimensions, or sum glyph estimates. For constrained text, the source retains the supplied width and takes the measured height. Browser line-box/shaping results remain a declared substitute for KIf5, even when using the same font bytes.

A browser-derived bootstrap can measure the *pre-edit* effective text and construct its local panel placement from the documented placement rules. That is a product initialization policy, not recovered native history. Cache it before applying a Size/fit command, because KNZn can read the old panel before a new measurement. For font/text edits, retain a pre-edit snapshot while measurement callbacks use the edited content. A previously cached panel with another width, font, run map, view or row is not valid input.

Native conversion and union are still separate services. A 2×2 identity conversion is only a stated unit/zoom policy; N5pp source-space2→World0 is not proven to be universally two CSS pixels. `unionRectangles(ignoreEmpty:true)` has no default in the pure adapter. Supply a documented finite ordinary-rectangle service or reject unsupported empty/sentinel cases; do not quietly infer the missing native empty-union behavior. Likewise, choose and label the model minimum-size policy instead of presenting a constant as a recovered native minimum.

The initial domain should exclude live rich-text editor height, inline-link synchronization, arbitrary transforms/rotation and containing contexts whose Location→LocationInDiagram translation is unavailable. Hidden/unplaced controls can be measured with isolated copies, but must stay hidden/unplaced. Isolation must not fire their input/focus/change events.

## Font readiness and browser reproducibility

`main.tsx` installs the embedded font CSS before mounting. `embedded-fonts.ts` registers twelve Roboto and ten Open Sans faces from fixed local data URLs, without `local()` precedence. It does not wait for those faces to load before React mounts. Arial and arbitrary authored families are not covered by that embedded-byte guarantee.

Prepare all effective paragraph/run family-weight-style combinations before measuring, then run the synchronous pure transaction. Waiting belongs outside `planSelectionLayout`; an asynchronous measurement cannot be substituted for its synchronous callback. Track completion/failure and a font revision. A font becoming available invalidates only browser layout caches; it is not an author edit.

On failure, show or retain an explicitly fallback-rendered layout and block a geometry-changing author commit until a policy is selected. Font availability checks do not prove which fallback glyphs were used. A later controlled browser test can record platform font use where available; no such measurement was run here.

The existing font-size conversion is already represented in imported px values. Do not divide by .75 again in the host, and do not reduce font size or replace rich run size with base size merely to fit the saved owner. Matching native font bytes also does not prove native graphics and browser line boxes agree.

## Rendering must keep author geometry and HTML geometry separate

The frozen render evidence gives a concrete initial text projection: for local measured panel `(px,py,pw,ph)` and horizontal paddings `L,R`, the SelectionButton text writer uses **left=px−L, top=py, width=pw+L+R, height omitted**. The example `(18,3,80,20), L5,R7` yields `(13,3,92,auto)`. It consumes an existing panel, unlike the ordinary VectorShape branch. Width-fit selects nowrap; otherwise word-wrap break-word. Structural hard breaks must remain; simply changing CSS without changing the current non-native text construction is insufficient.

The generated relationship is owner → label → indicator and text, then a separate owner input. The label is absolute with full owner dimensions. The present flex input/label layout must not be used as the measurement oracle for that relationship. A native browser checkbox's intrinsic dimensions are not P94. Keep the interactive input semantics/accessibility while drawing and positioning a deliberately bounded indicator.

There are **two source indicator rectangles**:

- Managed author `XNUc` **100702036** uses the graphics conversion and, for long text, panel.Rect+LocationInDiagram. Its result participates in WIyL's union with a text rectangle at **owner.Location−panel.Location**.
- `CNUW` **100702037** gives a local rectangle: x0 or ownerWidth−P94; y0 for empty/short, otherwise top0, middle `(panelHeight−P94)/2`, bottom `panelHeight−P94`. It has no converted inset.

Do not treat the adapter's last `indicator.rect` effect as an interchangeable final HTML/local drawing rectangle. It was calculated in the transaction's coordinate context before a possible final Size write; the retained report does not establish that it is the final generator paint value. A display-only helper may use an explicitly named/local formula and tested projection; that choice must not modify WIyL's numerical union or claim the two stages are identical.

Current owner overflow and rich-content CSS are product rules, not a complete original generated cascade. Avoid globally removing clipping to make labels look correct. Apply a selection-specific bounded rule, and verify its children without silently changing other widgets.

## Persisted data, transient state and commit rules

| Persist in the project | Keep transient |
|---|---|
| Literal text/rich paragraphs, original style and per-view/state declarations | Browser measurement tree, content boxes and font-ready state |
| Shared `selectionText` fit flags and AlignRight | Computed panel/display/indicator rectangles with cache key and provenance |
| Independently sourced P94 in ordinary/state/adaptive style | Reentry guard, ordered service trace and failed partial state |
| Owner geometry only after a deliberate, successful author command | KNYS for a real bounded style-editor transaction; never a drag snapshot |
| Existing origin diagnostics | Pending async request, revision/row/view token and cancellation state |

Render, import, save, reopen, Preview start, font completion and view changes do not serialize computed panels or invoke saved geometry commits. First display may differ from an unavailable native measurement, but saving without editing must preserve the imported rectangle and all declarations exactly.

An explicit command first snapshots the document/view/target, prepares measurement, then runs the correct entry. On success, validate model bounds and the complete command before one undoable commit. Reject stale results after undo, selection/view change, document replacement or a newer edit. Failed partial-state traces remain diagnostics only.

Do not convert every style edit into `layout(true)`: retained MIue uses the changed-property gates and commonly `OI8Z(false)`, while Size and changed fit flags enter the true branch. P94 preflight has its own Size request. Internal YJ0S and WIyL corrections use `allViews=false`; a caller's external Size entry can separately request allViews=true. A minimal current-view integration should explicitly choose false. Supporting Affect All Views requires routing the ordered writes/cleanup through its existing command semantics, not applying the final rectangle globally. Shared fit flags remain shared even when corrective geometry is current-view-local.

Hover/selected/adaptive display style changes, including P94, must not write Base or materialize view geometry from a React render effect. The layout cache may change; the author's stored declarations may not.

## Focused acceptance cases for the next implementation

1. Import/save/reopen before any edit: unchanged owner rectangle, text, runs, flags, P94 and view maps; no serialized panel cache.
2. Same real control before/after local font readiness, hidden and nested instances: display cache refreshes, saved bytes unchanged.
3. Constrained versus width-fit text, hard breaks, multiple/empty paragraphs, mixed family/size/weight/style: measured content and displayed structure agree; padding/indicator are added exactly once.
4. Explicit Size/fit/font command: pre-edit panel versus new measurement remains distinct; two source measurement passes can return different values; one successful undo entry, zero on error or stale completion.
5. Current named view, inherited styles, inactive maps and repeater row instances: correct effective runs and translation, no cross-instance cache reuse or unwanted Base geometry.
6. P94/state changes, left/right alignment and short/tall text: test author XNUc and chosen local display projection separately. Right-aligned native import remains gated until its rendering is actually integrated.
7. Preview/offline measured SetText: use the separate runtime callback/contract; no owner Resize, no added indicator width, explicit height-AutoFit safety behavior. It must not call the author planner.

These are proposed checks, not newly executed checks. The immediate implementation gap is a browser measurement/session plus a selection-specific display projection, not another raw RP field conversion.

## Reviewed source identities

Paths below are relative to `D:/WSCodex/REA`; hashes bind the read-only review. The original managed DLL identity remains `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7` via the frozen evidence. The four concurrent runtime/host edits were explicitly reread; this is not an assertion that no source changed during the whole review. No source/hash claim is made for a later edit.

| File | SHA256 |
|---|---|
| src/model/selection-layout.ts | debf1e4e9f857b66c0f4780ba3347ba515261afb6ccebc824202e4a07d53d11b |
| src/model/shape-text.ts | 97e80768ff72e48f3e2cfc03199672149c5c2462b082c58d2891e0397d275e90 |
| src/model/types.ts | 7adedc6ac00c7d2cdc9e2eebdfb77147a8adc02aeac5d09bc83c4088e8e59718 |
| src/model/document.ts | b599acec94bb5cf552073f6a84649b31c4dd4b2e9e2c53a749ce7c98091d5441 |
| src/components/WidgetView.tsx | 8910267dbc062202a0ee29acb9f3179b48205b56653943012e0097ccb5748e48 |
| src/components/RichTextContent.tsx | 302b63dbccd1c4d01f4d19cadc6aeae47032d2ab3d71e6b1437ecfc8c134e88e |
| src/components/Preview.tsx | 48f78e23f0e85d9a8a87b4a907fdf506b59d3b22b138dc973ac26cb9bab324a6 |
| src/runtime/shape-text-measure.ts | 8496413c0330b9a2429c3ad8fc5c65fec25808db989d4e06a675c95f771cac56 |
| src/runtime/export-runtime.ts | 9fe8926dc2029dffb3ac2c56b0bb09d2cf2deff1cb663e3a4da99c39713fb334 |
| src/runtime/embedded-fonts.ts | e6de6ea7d4ca7a5c6a81be5e81c3afbb5928122a2df647280098db09af2ae888 |
| src/main.tsx | 1e37c28d28f35b71a62255f4fd240cfd12f36dd943894313dced8e8ae3153bfb |
| src/style.css | 3d449dcc1d6e80fdd69dd88cf069e7ef69b4bcf304a71fa54affb8f34f7a7ad3 |
| research/scripts/read-rp-semantics.mjs | c4630a23c35c3f2d9be3f9fc53b269c483581f637c75fc8df7d5ab8a711fe8e6 |
| src/model/import-rp-selection-layout.ts | 6d9dd3a125590932b518eb91b2bcc19340e4ca83cd724e4302f0ee82214e483e |
| research/selection-layout-transaction-evidence.md | 9f16651b6248fa84206de91dff4690aca0d20aeafd6ed70254a89f9808656b5f |
| research/selection-layout-transaction-panel-setters-cil.json | abeaf3bd08dd2f6f6f76352099772bf33a94b748479b050b85e0410730bfea34 |
| research/selection-layout-render-evidence.md | 159db793b19ac0f4b214f2558cd5858f148924dc01ec1f9b15d604c23c47ff0c |
| research/selection-author-resize-storage-cil.json | 675df3bd508b632ea807f39783b8fdde3509363825af5f7b72fd6b852610ea77 |
| research/selection-author-resize-census.json | 0464db2c07a8c45eed17cf772f94e92b3c666368dfb83fd9e035eb3a882543b0 |
| research/samples/Default.rplib | 9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50 |
