# Runtime Rotate independent integration review

The final bounded comparison passes **43/43 product cases**, with **9 exact-source shadow/getter cases** and **2 exact-source parent-fit cases**. These are separate from the frozen original 131-case investigation. No final blocker remains among the reproduced findings below. This is not a claim of complete Axure parity.

## Findings and corrections

- **RRM-REVIEW-01: Queued-start error rejected the wrong task and stopped the preceding tween.** Normal first task rejected; invalid second task pending; angle 67.5 and zero scheduled timers. Corrected: Isolate a released job start in its own transaction, attribute failure to its owner, terminate failed jobs, and preserve preceding completion. Failure retained in `research/runtime-rotate-motion-integration-review-first-valid.json`; correction independently retested in the final output.
- **RRM-REVIEW-02: Negative-shadow public coordinates read painted CSS instead of moved cache.** CSS was 120,60; original fresh getter reads cached 104,34 after the measured orbit. Corrected: Keep execution location separate from drawn location and use it in expression geometry; preserve dimensions without rotation/shadow. Failure retained in `research/runtime-rotate-motion-integration-review-expanded.json`; correction independently retested in the final output.
- **RRM-REVIEW-03: Rotate parent fit ignored the target-angle zero-cache fallback.** Authored 30 degrees to target 0 reduced parent to 200x100 instead of retaining 211.602540378x143.301270189. Corrected: Rotate-related parent bounds consume the same motion cache as original bounds; other fit behavior is not generalized. Failure retained in `research/runtime-rotate-motion-integration-review-fit.json`; correction independently retested in the final output.
- **RRM-REVIEW-04: Changed parent fit did not dispatch Resize.** Parent resized to 150x150 but its Resize case was not invoked. Corrected: Preserve the prior fit dimensions and dispatch the parent Resize event only on an actual completion-time size change. Failure retained in `research/runtime-rotate-motion-integration-review-fit.json`; correction independently retested in the final output.

## What was checked

The product comparison covers independent task error attribution, rollback of group angles, state-effective shadow, multi-frame negative-shadow orbit, public cached coordinates, all 32 retained easing quarter samples and completion values, integer/full-turn versus fractional getter behavior, adaptive group-angle persistence, snapshot transfer, and parent-fit cache/event behavior. Read-only inspection also covered row generations, navigation/disposal invalidation, serialization dependencies, and queue release ordering. The parent/core focused tests cover additional row and completion sequencing; those are not counted as independently executed here.

Source locations: `action.js:1061–1256` for ordinary/layer dispatch; `move.js:255–335` for circular motion; `visibility.js:1347–1380` for first moved-location cache; `axQuery.std.js:1438–1575,1644–1647` for bounds/location; `doc.js:449–512` for public geometry caching; `repeater.js:2022–2078` for parent fit and Resize. Adaptive reset clears four geometry maps (`visibility.js:1416–1420`), not the layer DOM data field.

The negative-shadow controlled case starts at (100,100), size 200x100, shadow (-10,-20), blur 6, local offset (30,-10), By90. It ends with drawn CSS (120,60), moved cache (104,34), and fresh public geometry [104,34,200,100]. Both one-step and multi-step original function compositions preserve that distinction. Parent fit directly executes the retained bounds and fit functions with numeric DOM sinks: authored30/cache0 leaves 211.602540378x143.301270189 unchanged; authored0/cache90 writes150x150 and raises one onResize.

## Preserved failures

- `research/runtime-rotate-motion-integration-review-first.json`: **harness-error**. Missing required adaptiveViews fixture field; not a product failure.
- `research/runtime-rotate-motion-integration-review-first-valid.json`: **product-failure**. Queued error rejected the earlier successful task and stranded the failing task.
- `research/runtime-rotate-motion-integration-review-second.json`: **correction**. Queue correction and negative-shadow orbit pass.
- `research/runtime-rotate-motion-integration-review-expanded.json`: **product-failure**. Public x/y still read painted CSS instead of moved cache.
- `research/runtime-rotate-motion-integration-review-cache.json`: **correction**. Public cache and snapshot transfer pass.
- `research/runtime-rotate-motion-integration-review-fit.json`: **product-failure**. Parent fit destination-zero fallback and Resize event missing.
- `research/runtime-rotate-motion-integration-review-fit-correction.json`: **correction**. Both parent-fit cases pass.
- `research/runtime-rotate-motion-integration-review-shadow-probe.json`: **harness-error**. Truncated function slice caused SyntaxError.
- `research/runtime-rotate-motion-integration-review-shadow-valid.json`: **harness-error**. Function slice was still truncated; filename valid was premature.
- `research/runtime-rotate-motion-integration-review-shadow-composed.json`: **harness-error**. Missing getBoundingRectForRotate dependency.
- `research/runtime-rotate-motion-integration-review-shadow-source.json`: **exact-source-success**. Nine composed source cases, prior to adding public getter.
- `research/runtime-rotate-motion-integration-review-fit-source.json`: **harness-error**. Slice included the start of the next function.

Do not count SyntaxError/missing-dependency harness attempts as native failures or product regressions. `shadow-public.json` and `fit-source-valid.json` are the valid supplemental source runs. The final product result is `runtime-rotate-motion-integration-review-final.json`.

## Boundaries

- No original application GUI, managed DLL method, browser suite, full unit suite, build, or package was executed in this review.
- Original-source supplemental probes run retained function slices in NodeVM. CSS geometry, timers, model lookup and event/host sinks are explicitly declared; these are not original-page pixel checks.
- The portable product factory is type-stripped and run in a separate NodeVM with a deterministic clock. Its model/transaction assertions are independent software policy when no vendor transaction contract exists.
- Flat groupId siblings are a compatibility mapping, not native nested Layer identity or its split-duration quirks.
- Complete native timed Move/Resize/Rotate coalescing is not implemented; current product Move/Resize actions remain instantaneous.
- Fractional-angle getter uses an ideal normalized numeric angle; original computed CSS matrix decimal serialization may differ slightly.
- General fixed/percent panel layout, full containment/RDO geometry, event-level cached widget-expression lifetime, and vendor page/row races remain outside these bounded probes.
- Historical failed harness output files are preserved and excluded from successful source/product totals. Earlier evolving harness source revisions were not separately copied; their then-hashes remain in the outputs. Final runnable scripts are fully bound.

Exact product, original source, probe and output hashes are recorded in the adjacent JSON. Historical evidence and production files were not edited by this reviewer.
