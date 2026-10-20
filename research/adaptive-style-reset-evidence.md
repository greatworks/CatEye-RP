# Adaptive transition: action visibility, opacity and applied-style reset

2026-10-15. Bounded read-only follow-up to the completed runtime text AutoFit milestone. Product sources, tests and earlier evidence were not changed. The original authenticated GUI was not started or operated in this work.

## Highest-priority confirmed gap

**An action-written Show/Hide override currently survives a real adaptive view transition, preventing the target view's declared visibility from taking effect.** This is directly different from the retained runtime for an ordinary, non-contained, non-repeater shape. It is a visible behavior gap even for a shape already within the current `shapeText` reset subset; no unimplemented container behavior is needed to reproduce it.

Minimal reproduction:

1. Create an ordinary box, declared visible in both Base and Mobile. Add a button that hides it.
2. In Base, click the button, then select Mobile.
3. Original runtime decision: show the box again because Mobile does not declare it hidden or in limbo. Current product: it remains hidden.

The inverse is equally observable: declare the box hidden in both views, show it through an action in Mobile, then return to Base. The original restores hidden; the product retains the runtime-visible override. No text measurement or resize is required for either result.

## Identity and evidence kind

Pinned distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.

Retained extraction Evidence ID: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.

The source directory is the existing Axure RP 11 `DefaultSettings/Prototype_Files/resources/scripts/axure` extraction. Absolute paths, whole-file hashes, exact slice ranges/hashes and reviewed product hashes are in `adaptive-style-reset-probe.json`.

| Source | SHA-256 |
| --- | --- |
| `adaptive.js` | `e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928` |
| `visibility.js` | `bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53` |
| `style.js` | `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c` |

`node research/adaptive-style-reset-probe.mjs` executes exact retained JavaScript bodies in Node VM. DOM/CSS writes, state-style recomputation, the final visibility setter, repeater refresh and measurement are declared recording sinks. It also executes the current independent runtime core through the existing TypeScript loader. This is **not** an original generated-page, browser-pixel or GUI comparison.

## Exact reset order

`adaptive.js::_switchView`, lines 48–159:

- **Same view:** lines 51–56 return before any reset. A normal window resize that remains in the same view must preserve action state.
- **Early inline reset:** lines 69–87 remove owner `top/left/width/height/opacity` and transforms. It skips contained objects and repeater descendants. Immediate children are also reset except fixed-size panel-state children. This is removal of inline values; the final stylesheet opacity is not determined by this statement alone.
- Set `currentViewId` (94), then clear previous adaptive styles or reselect current elements (95–100), then update relevant image styles (102–106).
- **Named view:** clear limbo (144), clear four geometry caches (145), clear applied-style classes/state (146), apply the new view (147), refresh repeaters (148), update panel/layer caches (149–150), remeasure registered AutoFit text (151).
- **Return to Base:** restore default visibility first (136), clear geometry caches (137), clear applied styles (138), refresh repeaters (139), update panel caches (140–141), then remeasure text (142).
- Finally emit the adaptive view event (157–158).

These two visibility branches have different placement relative to geometry/style reset. A future implementation should not collapse them into an unproven order, particularly once visibility event dispatch is included.

## Visibility proof

`adaptive.js::_applyView`, lines 245–269, applies the view class and derives each object's effective view data, then calls `visibility.addLimboAndHiddenIds` at 266. `_applyAdaptiveViewOnObject`, lines 299–316, composes object style with adaptive/state overrides; `visible === false` adds the object to the hidden set. Undefined is intentionally not equivalent to false.

`visibility.js::_addLimboAndHiddenIds`, lines 1288–1303, calculates:

`shouldBeVisible = !newLimboIds[scriptId] && !newHiddenIds[scriptId]`.

It compares that declaration-derived result with the currently visible state and calls `_setWidgetVisibility(elementId, {value: shouldBeVisible, noContainer:true})` when they differ. Thus a previous Hide action cannot remain authoritative over a newly visible adaptive declaration. Return to Base uses `_defaultLimbo/_defaultHidden` through `resetLimboAndHiddenToDefaults`, lines 1321–1324.

The function excludes contained objects, table cells, submenu wrappers and menu-contained tables (1291–1292). It has an optional repeater skip (1293–1296). The present probe uses one ordinary shape plus a contained exclusion control; it does not infer all of those other branches.

## Applied styles and opacity: secondary findings

`style.js::applyWidgetStyle`, lines 875–910, maintains `_idToAppliedStyles[id]` with a class list and merged action style, applies classes to the owner/background/text/input elements, and uses that action style in the final style computation.

`_clearWidgetAppliedStyles`, lines 964–979, removes those classes from all four element identities and deletes the registry entry. `clearAppliedStyles`, lines 982–989, visits all entries and empties the registry. Both view-transition branches invoke it. The probe executes these removal bodies and proves that seeded action classes and the registry are gone before the named-view application sink.

The product currently retains `widgetOverrides[id].style`, including a SetStyle opacity of `.25` and fill of red, across `updateAutoFitted(true)`. The core comparison returns `.25` and red even when the target view supplies blue. This is a second clear state-retention difference. The probe does not assert the final original SVG or text paint after all style-cache/state interactions, so **visibility is the preferred first implementation target**. Applied-style reset should be implemented with action provenance and existing selected/error/disabled/base formatting preserved, not by deleting all widget state.

## Current product locations

At the hashes recorded by the probe:

- `src/runtime/export-runtime.ts:291`, `baseWidget`: runtime overrides are spread after the authored/adaptive base, so `patch.hidden` wins.
- `src/runtime/export-runtime.ts:1126`, Show/Hide/Toggle action handling, records the runtime visibility mutation.
- `src/runtime/export-runtime.ts:1854–1882`, `updateAutoFitted(true)`: clears only supported shape x/y/width/height/rotation and related geometry caches, then refreshes repeaters and remeasures. It does not clear `hidden`, action-applied style or opacity.
- `src/components/Preview.tsx:85–86`: actual view-ID changes invoke that transition entry point.
- `src/components/Preview.tsx:122–123`: composes the target view, then runtime overrides; final visibility therefore retains the previous action.
- The offline mount uses the same core and calls the same entry point only after a real view-ID change. This is shared runtime behavior, not a React-only rendering omission.

## Focused replay results

**6 retained-function cases and 3 independent-core comparisons passed their explicit assertions.** Assertions intentionally confirm the current discrepancy, not product correctness.

| Case | Original visibility decision | Current core result |
| --- | --- | --- |
| Hide in Base, enter visible Mobile | visible | hidden |
| Show in hidden Mobile, return to hidden Base | hidden | visible |
| Show in hidden Base, enter hidden Mobile | hidden | visible |

Additional original-function controls prove same-view no-op, inline opacity/applied-style removal, and the contained-object visibility/inline-reset exclusion. The first probe attempt exposed a harness setup issue: a Show action issued while already visible was correctly a no-op in the product, so no persistent override existed. The final comparison seeds a genuinely hidden declaration before Show and renders the prior view before dispatch; it does not fabricate an override by direct state mutation.

## Suggested acceptance for the next bounded change

Use one ordinary shape without a repeater or container to establish the shared transition contract:

1. Both visible declarations: Hide → different view restores visible; a same-view resize leaves it hidden.
2. Both hidden declarations: Show → different view restores hidden, including return to Base.
3. Different declarations: each transition obeys its destination declaration after runtime Show/Hide.
4. Text and global variables remain unchanged; selected/error/disabled states are not reset without separate source evidence.
5. If opacity/applied-style reset is included, verify an action override is removed while declared target-view style and existing state effects remain, in preview and actual offline output.
6. Preserve the observed reset → repeater refresh → registered text remeasurement order. Verify any Show/Hide event behavior separately before asserting parity; the present visibility setter is a sink.

No product fixes, tests, builds, packages, downloads or original GUI operations were performed. Only new `research/adaptive-style-reset-*` files were created.
