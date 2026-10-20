# Adaptive behavior: runtime integration plan

Status: read-only design and bounded retained-source probes, 2026-10-15. No product/test/build changes in this task. The current release record identifies ASAR `4651baefd414de3f1dccd8d39bf98240e2473de243d7521bf83f733ff1f91dff`; preflight and copies are owned by the parent task under `.build/before-adaptive-behavior`. This plan does not redate or replace that verification.

## Evidence and scope

- [Adaptive hierarchy evidence](adaptive-hierarchy-evidence.md), especially control/event sections; its 83 controlled original-source cases remain unchanged.
- [Control probe](adaptive-behavior-control-probe.mjs) / [results](adaptive-behavior-control-probe.json): 16 cases. SHA-256 of results: `ff84238efedf50c7313ef2aa647d75ffc1b715aa7105f0adcb66e08beea6a8e4`.
- [Full case-group probe](adaptive-behavior-case-groups-probe.mjs) / [results](adaptive-behavior-case-groups-probe.json): 23 cases, including the preceding 16 plus seven broader event/configuration checks. Result SHA-256: `7e3eda1053531bdf911885b91c14fe6b600e9bd93c39f26cd777441b4ab92f69`. These are overlapping sets, not 39 unique cases.
- Both scripts pin original whole-file bytes and record exact slice hashes. Source: retained Axure RP 11.0.0.4150 `DefaultSettings/Prototype_Files/resources/scripts/axure`, extraction evidence `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- Pinned `adaptive.js`: `e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928`; `action.js`: `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3`; `events.js`: `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3`.
- Static-only sources additionally read: `init.temp.js` (`0f6c77f52d3e1fcb5e3c8590b2d4be324af66832255a6d2385f7c01a5841a6bb`), `plugins/sitemap/sitemap.js` (`f8c1f18f283ea0fe54fe8d82fe6bc7efb82c7a1df1c6f143d7546fb2b5682457`), player `axplayer.js`, and the repeater initialization gate.

The probes execute retained JavaScript in Node VM. They do not execute a DLL, native GUI, complete generated-page CSS, or network request. DOM/style/repeater geometry are explicit sinks. The first probe adapts terminal event handling to one case; the second executes the actual full `_handleEvent` direct-execution branch, case grouping, case-group handler, action dispatcher, adaptive controller and page traversal. Recording/visibility guards are inert and case-description selection is false. Thus the second result establishes automatic same-event groups, not case-menu UI or bubbling. Timers are explicitly queued/drained, not wall-clock measurements. The first expanded-probe attempt lacked a `postResize` sink and threw a harness TypeError; adding that explicit sink produced 23 passing cases without product changes or weakened assertions.

## Established control behavior

| Operation | Retained behavior and source |
| --- | --- |
| `setAdaptiveView('auto')` | Normalizes to undefined, sets auto true, immediately evaluates current window size unless sidebar sizing owns auto. `adaptive.js:707–714,738–745,24–35`. |
| `setAdaptiveView('default')` / named ID | Sets auto false and switches to Base / named ID. Future ordinary resize preserves it. `:738–745`. |
| `setAuto(true)` | Changes the boolean only; does not recompute until a subsequent eligible resize. `:38–42`. |
| Same selected ID | Returns before tree/geometry/style reset, repeater refresh, bindable viewChanged, and adaptive interaction. A truthy player force token can still post a notification. `:48–57`. |
| `useViews=false` at initialization | Named metadata still enters `_idToView`, but `_enabledViews` stays empty. Auto uses Base; explicit named selection can still apply that view. `:716–729`; both probe sets. |
| Changing raw `configuration.useViews` after initialization | Does not rebuild the cached candidates. A subsequent resize still uses the old list (new full-group probe). A live runtime setter is not established by this source. |
| Sidebar size message | Selects with supplied size even when auto is false; it does not turn auto true. Sidebar ownership suppresses ordinary window automatic resizing. `:445–451,747–752`. This is separate from physical viewport measurement. |
| Unknown forced ID | Original public control accepts it and may use an empty chain. Strict authored IDs are a product validation boundary, not a native observation. |

Most important action distinction: `action.js:351–357` delegates successor dispatch to each handler. `:393–398` Set Adaptive View never dispatches the next action. The exact handler stops the current action array for named, same-view, Base, Auto, unknown, empty and missing values. Direct public `setAdaptiveView(...)` itself returns normally; ordinary caller code can continue.

The new full-group probe confirms that stopping an action array does **not** stop the whole event. Later independent IF groups still run (`events.js:334–371`); ELSE in the matched group stays blocked. Nested Adaptive View Changed case groups finish their synchronous prefixes before the outer event's next independent group. A Wait before the view action resumes into it and then stops; a Wait after it is never scheduled. A Wait inside Adaptive View Changed resumes only that event's own action array.

## Initialization and event order

Static `init.temp.js:241–251` establishes event/style/visibility/repeater initialization → adaptive initialization → page/widgets/containers Loaded → `adaptive.loadFinished()` → `repeater.initRefresh()`.

`adaptive.loadFinished` (`adaptive.js:16–22`) sets its flag before dispatch, runs once per page realm, and emits the page/master adaptive interaction only if the final current view is named. Base only posts the player notification. Changes during synchronous Loaded do not individually emit this interaction; the final named view is dispatched at the barrier. The control probe verifies a Loaded switch and a Loaded switch back to Base.

This barrier is not “await all Loaded promises.” Native Wait schedules a continuation and returns; a delayed Loaded continuation executes after loadFinished and therefore can cause an ordinary post-load adaptive event.

There is a second independent initialization gate: `repeater.js:47–57` initially has `repeatersReady=false`; `:73–79` records a pending full refresh and returns while false. Only `initRefresh` sets it true. Therefore a view action inside Loaded, or inside the initial adaptive event itself, must not emit first ItemLoaded immediately. The initial adaptive event runs with `loadFinished=true` but `repeatersReady=false`.

For a post-load real change, reset/apply/refresh/AutoFit finish before bindable `viewChanged`, then page/master adaptive interactions (`adaptive.js:157–158`). The window resize callback subsequently dispatches ordinary page/master Resize (`:732–735`). A same-view physical resize dispatches Resize but no adaptive interaction. `events.js:1840–1861,1901–2018` dispatches Page first and then RDO/master instances, traversing all panel diagrams; it does not send this event to ordinary panels or repeater descendants. Adaptive interaction dispatch has normal case-selection policy, unlike Page Loaded's menu suppression.

## Navigation: page-local force versus player-owned choice

The native adaptive variables are closures in each new page HTML realm, so page navigation initializes auto/loadFinished again. Player persistence is separate:

- `sitemap.js:431–448` stores the user-selected named/Base option in the outer URL hash and sends a filename-scoped switch message. Auto deletes that hash and sends a size message.
- On a new page, `sitemap.js:124–135` replays a valid hash option; a missing target option selects Auto. `:162` supplies actual player size when not overridden.
- An action calling `adaptive.setAdaptiveView` supplies no force token and does not update that hash. `events.js:1848–1859` posts current-view data; `sitemap.js:366–378` changes the radio check only with a truthy force token.

Recommendation: keep page-local action mode distinct from an optional host/player override. Reset action forcing on a successful page navigation. If a player selector persists, revalidate against the destination's effective shared view set and reapply that host choice before Loaded; missing destination choices fall back to Auto. Do not match by display name. Parent's newly evidenced shared view-set model can support the same native view ID across pages; the previous page-local/global-ID approximation cannot faithfully substitute for it.

This cross-page conclusion is a static connection of original player/page sources, not a newly executed full navigation session. A dedicated player integration probe remains appropriate before claiming all persistence combinations.

## Minimal core architecture, pending final schema

Keep viewport dimensions, effective selected view, automatic/forced mode, and initialization phase separate. Suggested private data:

- Existing `viewportPolicy` (undefined still means legacy externally supplied/manual rendering).
- Existing `activeView`, now resolved from document shared-set metadata plus current-page overrides.
- `selectionMode: 'auto' | 'forced'` and `forcedViewId?: string` (undefined in forced mode is Base).
- Separate `loadFinished` and `repeatersReady`, reset on page change. Avoid deriving them from selected ID or the presence of an adaptive registry.
- Configuration `useViews` read once for a session/page's automatic candidate list. Its persisted field/default is owned by the model contract. Absent new project configuration should preserve existing products, not silently make every old document Base-only.
- Optional host/player override retained separately if the product exposes cross-page player choice; not conflated with action forcing.

Suggested public value API (names provisional): `setAdaptiveView({mode:'auto'} | {mode:'forced',viewId?:string}): Promise<void>` and `adaptiveSelectionMode()` readback. This avoids confusing reserved string aliases with valid IDs. If exact low-level `setAuto` is exposed, it must only change the flag. Keep `setViewport(policy)` for size changes: always copy/validate latest dimensions, but switch only in automatic mode. Preserve the omitted fifth constructor argument's manual-host contract in engine snapshots and portable tests.

Do not invent a live `setUseViews` mutation under a native-parity claim: the observed source consumes the flag at initialize. Editing Project configuration and starting/restarting a session is sufficient unless the parent explicitly defines a product extension.

Refactor the existing switch into a shared **synchronous internal** operation called within the current TaskGroup. Both public enqueue and action dispatch use it; an action must not call its asynchronous public queue wrapper, which would reorder events or deadlock. `runActions` needs a terminal outcome for this action, while `run` must continue later independent IF groups. Separate selection policy changes from actual selected-ID changes so forcing the currently selected view still records forced mode without resetting or firing events.

Use one page adaptive-dispatch helper with normal menu/IF/Wait semantics. At the initial barrier dispatch only the final named view, once; later actual changes include transitions to Base. Guard its recursion and total changes consistently with existing event budgets. A handler switching views can recursively fire another adaptive event synchronously. This safety bound is a product resource boundary, not a native limit claim.

For physical Resize ordering, do not chain `setViewport(...).then(triggerPage('resize'))`: the returned promise waits that TaskGroup's Wait continuations and would delay Resize incorrectly. If Resize is in this milestone, add an explicit internal/public reason option such as `{dispatchResize:true}` so it dispatches in the same synchronous queue segment after the adaptive event prefix. Player-size selection and forced-view dropdown operations do not inherently imply a physical window Resize. The existing renderer currently only submits the viewport and does not dispatch page Resize; record this distinction rather than silently treating every policy write as Resize.

Shared metadata integration should remain one bounded resolver used by the core for selection, chains, current-page validation and declarations. Keep the naked `createOfflineRuntime.toString()` contract; do not introduce an implicit module closure or a sixth required argument. The model-side pure helpers and portable core must share source-matrix tests. Exact shared-set fields are intentionally not specified here while parent/schema work is pending.

## Concrete product integration points (current reviewed source)

| File / lines | Required purpose |
| --- | --- |
| `src/runtime/export-runtime.ts:112–157` | Viewport validation, selection, ancestry and initial active view. Add configuration/forced-mode policy without making unmanaged snapshots automatic. |
| `:249–289` | TaskGroup, queue, page change/commit. Reset page-local force/phase on navigation; preserve viewport policy and optional host selection separately. |
| `:356–395,620–667` | Effective declarations, original paint cache and rich/state projection. Read shared metadata and page-local overrides consistently, including inactive/unrendered children. State-map lookup versus state-existence gate is a sibling evidence task; do not combine them casually. |
| `:1212` and `:1517–1544` | OpenPage/action executor and case loop. New view action runs internally/synchronously, ends only its action array, retains IF-group behavior. |
| `:1437–1515` | Wait and atomic rollback. Snapshot new mode/phase/host-choice/config caches; preserve deferred cancellation semantics. |
| `:1775–1793,1813–1877` | Loaded traversal, repeater flush, page load loop and settle. Insert loadFinished barrier before first repeater refresh; defer refresh while not ready. Stop source-page initialization on navigation. |
| `:2001–2062` | Existing viewport reset transaction. Reuse its all-type declaration, geometry, rich provenance, persist=2, AutoFit mechanics; dispatch adaptive event only after successful real reset/application and required refresh phase. |
| `:2136,2213–2214` | Page event API, start and navigate. Initial event once, proper normal case menus, navigation phase reset. |
| `src/components/Preview.tsx:35–41,80–86,120–125` | Initial clientHeight before start and ResizeObserver already exist. Keep physical dimensions current while forced; dropdown/device modes must not be silently overwritten by observer updates. Restart creates a fresh lifecycle. |
| `src/runtime/export.ts:40,57`; `frame-player.ts:29`; `export-runtime.ts:2715` | Root and nested player bootstrap/physical resize. Each frame has independent local mode, viewport and initial barrier; no parent-global adaptive mode leakage. |
| `src/runtime/engine.ts:11–22` | Snapshot/manual callers intentionally omit viewport. Preserve that compatibility; explicit new actions may opt into declared selection, but no automatic viewport policy should appear by accident. |

Core source hash at review: `c79830fc2f1ebb64ec42919120883452aa389e24cdbb3955982ac575326e5588`. Preview: `84c7e6401edd57617d175aefd4945914cca0c940997e953105432b617ac35966`. These locate the reviewed baseline and are not a release assertion for later edits.

## Atomic, Wait, menu and lifecycle safeguards

Keep current navigation rollback fix: a nested successful navigation inside a failing outer view transaction must not permanently cancel old Waits or menus. New Waits created in the rejected transaction are canceled; old ones survive; committedNavigation/pageEpoch restore. New selection mode/phase values must restore in the same catch path. A later unrelated event must not rerun Loaded after a rejected switch.

A view switch is not a page navigation: do not increment pageEpoch or blanket-cancel all existing continuations. Repeater refresh still follows the previously evidenced persist=2 contract, including stable data/query/mark identity, template text/geometry reconstruction, four-state persistence and separated hint paint. Any new changes to row-wait invalidation or menus destroyed by row DOM reconstruction need their own evidence; they should not be incidental consequences of the new event.

Once a view's synchronous transaction commits, a later error in its AdaptiveChanged Wait continuation rolls back only that continuation segment, not the already committed view. Navigation from an adaptive handler must stop remaining source-page lifecycle work. During first load, set `loadFinished` before firing its event, but `repeatersReady` only before the initial repeater refresh; snapshot both flags so failure/retry is deterministic.

The model currently represents components as panel instances rather than native RDO/master event containers with independent adaptive sets. Page Adaptive View Changed is directly representable; dispatching it to arbitrary panels/components would be an invented equivalence. Scope the initial event carrier to Page unless the new model explicitly adds the missing native identity semantics.

## Required focused regressions before broad validation

1. Module and bare-serialized factory: Auto/named/Base; forced same-ID records mode with no reset/event; resize while forced updates latest dimensions; Auto reselects those latest dimensions; low-level setAuto, if exposed, does not recompute.
2. `useViews=false` initial Auto/Base, forced named still works, no deleted declarations. Project restart applies a new setting. No invented live-rebuild behavior.
3. Initial event log: page Loaded prefix → hidden/inactive widget Loaded prefixes → final named AdaptiveChanged prefix → first ItemLoaded/template Loaded. Base initial event absent. Wait continuations do not hold either initialization barrier.
4. Loaded switches twice / returns to Base / navigates away; no early ItemLoaded or duplicate final event. Initial AdaptiveChanged switching again sees loadFinished true but repeatersReady false.
5. Real post-load view change order: repeaters/AutoFit first, adaptive event next, physical Resize last. Same-ID physical resize has only Resize. Ordinary mode toggle alone has no fake event.
6. New action stops its own remaining actions including Wait, while subsequent independent IF groups execute. Same-group ELSE does not run. Nested adaptive case groups complete their prefix before outer later groups.
7. Adaptive event automatic/always case-menu selection; menu cancellation does not secretly execute a case. Wait and cyclic switch guards remain responsive.
8. Rollback of mode/selected ID/phase/current page and all existing private maps, with old/new Waits and menus explicitly distinguished; committed Wait failure leaves earlier view commit intact.
9. Navigation: action-local forcing resets; any player-owned persistent choice is valid-ID checked against the destination shared set and not matched by name; independent nested frames retain their own modes.
10. Physical host dimensions, initial actual height before Loaded, shared set metadata plus per-page overrides, inactive descendants, literal source IDs, and unchanged old unmanaged/max-width callers. Reuse existing hierarchy matrix and transition rollback suites rather than replacing them.

No product implementation or browser result is claimed by this plan. Original complete GUI behavior, player navigation replay under all configurations, case-description menu visuals, native master component model and final state-map contract remain outside these probes.
