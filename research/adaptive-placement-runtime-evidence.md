# Adaptive placement: retained RP 11 runtime evidence

This report concerns Axure RP **11.0.0.4150**, retained distribution SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`, extraction evidence `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. The accompanying JSON binds the complete original paths and hashes, exact source ranges, scripts and results.

**55 exact-source NodeVM cases and 8 isolated real Edge DOM cases passed.** The former execute retained functions with declared object/DOM/paint/event/geometry sinks. The latter use retained jQuery 3.7.1 and retained visibility/adaptive functions against a synthetic DOM in Edge 155.0.4283.45. They are not an authenticated Axure GUI comparison, native DLL execution, or a complete generated prototype. No original application was launched or controlled by these probes. The DOM probe made no network requests and recorded no page errors.

## Implementable contract

Placement is independent of Hidden. A placed field may default to true; an explicit adaptive Boolean overrides inherited placement and an absent field inherits. The runtime equivalent is the inverse generated `limbo` Boolean. **Raw native P111 is not a Boolean:** the parallel format census found 1,598 numeric enum values, all 1. This corrects the raw-type wording in earlier frozen adaptive-import research. Raw enum conversion belongs to the separate format investigation; these probes do not infer it.

Normal adaptive styles are merged ancestor to leaf, including explicit false. `style.js:1763–1915` and `adaptive.js:271–317` establish this; the 27-case Base/ancestor/leaf absent/false/true matrix executes this composition. Collection uses `compoundStyle.limbo` only for non-contained objects. Hidden is separately collected from `visible === false`.

An ordinary unplaced node remains in the DOM with `display:none; visibility:hidden`. Its input value and node identity survive placement restoration. A normal child of an unplaced panel can retain own visibility and remain addressable: effective invisibility follows the ancestor DOM. Do not delete descendants or globally remove all ancestor-unplaced children from action target lookup.

Standard path-based actions cannot target a widget whose own script ID is in limbo. Hidden but placed targets remain addressable. Show/Hide cannot place an unplaced target, and the following action still executes. Fit and repeater refresh use ancestor-aware exclusion; these are different gates from path targeting.

A genuine adaptive switch clears the old placement map, computes the new declarations, updates physical visibility silently, then refreshes eligible repeaters. Returning to Base restores the initial captured unplaced/hidden classes. View switching does not dispatch Show/Hide events. The explicit Hidden declaration and runtime visibility state remain distinct from placement.

## Exact entry points and observed boundaries

| Source | Finding |
|---|---|
| `visibility.js:15–53` | Own visibility reads inline `visibility`, not ancestor visibility. Setting false changes display/visibility; setting true removes default hidden/unplaced classes. Nodes are retained. |
| `visibility.js:55–61` | Direct visibility exits for unchanged visibility or `_limboIds[elementId]`; the latter skips completion callback but advances the animation queue. |
| `visibility.js:1267–1307` | RDO/master propagation precedes physical visibility. Contained objects, table cells, `.sub_menu`, and menu-contained tables are excluded from direct visibility updates. Optional repeater exclusion is separate. The limbo map is merged after updates. |
| `visibility.js:1310–1345` | Clear/reset functions, script-ID lookup, first-row fallback, and ancestor DOM traversal are distinct APIs. Calling additive add with an empty map does not clear old limbo. |
| `visibility.js:1433–1456` | Initial defaults are captured from `.ax_default_hidden` / `.ax_default_unplaced`; repeater template defaults are scanned separately. Template scanning is statically inspected here. |
| `adaptive.js:126–158,245–317` | Base reset versus named clear/apply ordering; placement collection independent of hidden; contained own placement excluded. |
| `doc.js:175–244` | Default path lookup excludes own limbo before row expansion; explicit includeLimbo bypass exists. Ordinary ancestor limbo is not checked here. |
| `action.js:616–646` | Exact Show/Hide action uses that lookup and continues its action sequence when no target remains. Other action call sites use the same resolver but were not each executed in this probe. |
| `events.js:1701–1712` | Direct synthetic event raising has no universal limbo guard. A direct call can reach an unplaced object's interaction map. |
| `events.js:1922–2018` | Event traversal filters an unplaced container and skips its subtree. The synthetic handler/complex table-menu-tree routing endpoint is a declared sink. |
| `repeater.js:472–479` | refreshAll skips own/ancestor limbo before resetting pageInfo or refreshing. |
| `repeater.js:74–105,315–317,1871–1894` | Static evidence: direct refresh has its own limbo removal path; row placement is applied after row initialization; parent fit/cache updates skip ancestor limbo. This does not imply every adaptive Unplace destroys rows, because refreshAll skips first. |
| `axQuery.std.js:1325–1353` | Child bounds exclude limbo, own-hidden and fixed-horizontal panel children. Rectangles are geometry sinks in the VM test. |
| `axQuery.js:304–393` | Static evidence: getChildren only excludes unplaced nodes when the explicit ignoreUnplaced argument is supplied. |
| `style.js:186–199` | Static evidence: selection-group deselection skips limbo peers. |
| `model.js:12–51` | Exact master/RDO descendant propagation matches the instance path and recurses into nested RDO children, excluding a different instance. This is not ordinary panel inheritance. |

## Confirmed quirks

* A non-contained tableCell/submenu/menu-table can enter the limbo dictionary while the physical visibility update skips it. A contained object's own limbo is not collected at all. These are not one universal container rule.
* A template script key `w` blocks normal row path lookup and hides both generated rows. Direct low-level `SetWidgetVisibility('w-1', true)` checks the element key and can show a row despite script-key limbo. Normal authored path actions remain blocked. The product need not expose this low-level mismatch as a new public action.
* `isScriptIdLimbo` may fall back to the first repeater item only; this is not an all-row scan.
* Direct synthetic events and traversal events have different gates. Absence of pointer hit boxes is real DOM evidence; complete original user-event dispatch was not reproduced.
* Initial Base restoration is backed by captured classes, not a fresh recomputation of arbitrary malformed synthetic object records.

## Probe outputs

`adaptive-placement-runtime-probe.mjs/.json`: 55 assertions, normal inheritance, contained exclusions, default restoration, action target resolution, row keys, RDO propagation, fit exclusion, repeater refresh and event traversal. Each result records its observed value. `adaptive-placement-runtime-dom-probe.mjs/.json`: 8 assertions with real layout/visibility, descendant rect suppression and input-value preservation. Runtime strings were extracted from original files, not independently rewritten algorithms.

## Remaining gaps and implementation limits

No actual unplaced native sample has been found in the current 11-sample corpus. Full generated HTML/CSS and authenticated GUI interaction remain unverified. Native IsContained is not interchangeable with arbitrary product nesting; tree labels/menu tables/table cells require explicit known mapping. Master/RDO propagation does not establish component equivalence. Nested repeater data identity and persist=2 state preservation are covered separately by prior adaptive-transition evidence, not re-proved here. Frame document/network lifecycle under Unplace has not been measured; preserving a mounted frame is a deliberate implementation policy until stronger evidence exists. There is no demonstrated native authorable interaction-state placement map in this investigation.
