# Runtime transform drag host — independent review

The corrected scoped review passes **20/20**. No remaining blocking defect was confirmed in the current drag bridge and host subscription paths. This review does not cover the changing full motion planner.

## Drop click suppression

The parent fix adds an active-session check before hosts cancel an idle core drag. That distinction is required: after Drop the bridge has no active session but still owns a pending same-target mouse click suppressor. Independent module and serialized bridge cases, using both actual host subscription expressions, confirm subsequent idle notification / releasePointerStyles retains suppression. The next click is prevented and removes its suppressor. This matches the frozen original drag.js modern-browser contract.

## Lifecycle checks

Actual current core navigation and row deletion were executed. With the normal host render registration, both hosts stop movement listeners, restore the body cursor, and permit a new source. Touchcancel and detached-source Drop cleanup also pass. DOM/event dispatch uses an explicit facade; no real browser was run.

## Conditional pagehide gap

A controlled persisted pagehide/pageshow cycle reveals different host behavior: Preview has no pagehide cleanup and remains active absent blur/unmount; offline disposes the bridge permanently and never recreates it on pageshow. Whether the actual Electron/file/iframe surface enters BFCache is unverified. Treat this as an explicit lifecycle boundary; if persisted restoration is supported, use cancel for persisted hiding or recreate the bridge on pageshow and validate a real history round trip. It is not presented as an already observed user blocker.

## Failure history and source stability

The first20-case run yielded16passes/4row failures because the harness omitted runtime.widget(box,rowContext), the render registration both hosts perform. That exact script/output are retained. Its core file also changed concurrently. The corrected harness supplies the actual render precondition, uses direct TypeScript module imports and independent minimal fixture records, and passes20/20 with identical before/after source hashes. No product source was changed by this reviewer.

- No browser was opened or real pointer/touch/BFCache transition performed. The current product bridge and exact current host subscription expressions executed with a controlled document/event surface and the actual core runtime.
- Portable coverage serializes bindRuntimeDrag only. Whole offline HTML/frame bootstrap serialization is outside this narrow review; parent browser/export regression owns that coverage.
- The core export-runtime.ts was changing during initial review. Initial and corrected before/after hashes are retained; corrected20-case execution had no source drift. This is not a fresh review of the entire motion planner.
- Original drag.js corroboration is the frozen52-case retained-source report; it proves modern non-IE target equality and next-click suppression, but not pagehide/BFCache lifecycle.
- Multi-touch identity follows changedTouches[0] as the retained source does. No claim of robust multi-pointer ownership or real touch-device scrolling is made.
- Row-removal cleanup requires the actual host precondition of rendering/registering the row instance. The first harness omitted runtime.widget and observed four failures; this is preserved as a harness-scope error, not a user-visible product defect.

## Reviewed hashes

- src/runtime/drag-input.ts: `41f8088036694bc99a2f4b0b27a078e63cf90af576341025ec09b4fe09e64767`
- src/components/Preview.tsx: `86772c6fae80365c7178141ccdd0e990176ab9843b63ffd1a43c73eeed8ce4c5`
- src/runtime/export-runtime.ts: `8d8f318ebab90d39c67428037879516362e45072e2b33fd5e4c138f7c3d348ca`

See runtime-transform-drag-host-review.json and its manifest for original evidence bindings, per-case output and exact host callback hashes.
