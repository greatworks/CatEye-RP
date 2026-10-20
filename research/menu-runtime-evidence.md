# Axure RP 11 classic-menu runtime evidence

Recorded 2026-10-14. Retained Axure RP 11.0.0.4150; no original GUI launch, proprietary DLL execution or generated-pixel parity claim. This is source reading plus isolated exact-function probes with handcrafted DOM. Runtime implementation and reconstruction tests are separate evidence.

## Identity and method

Distribution SHA256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. `tree.js` SHA256 `661f7a9e991d0371123e972e63fd7b771589bddc5cd89bec8be6d9ba0ecef453`. Other pinned source files and source-slice hashes are in menu-runtime-probe.json. Probe script reuses the SHA-pinned, frozen table harness without modifying it.

38 exact-function probes passed in isolated Edge 155.0.4283.45; all network blocked (0 requests), 0 page errors. Actual original `InitializeSubmenu` and `_fireEventForSubmenu` (tree.js 6–56), original visibility primitives, public setters, logical event dispatcher and synthetic traversal execute. BringToFront and hover painting are ordering sinks; geometry is handcrafted. Script-path/row resolver is bounded to explicit unique IDs, so true repeater initialization is also supported by static events.js evidence rather than claimed full-app execution.

## Core model and lifecycle

- `axQuery.std.js:7,39,63`: menuObject is a distinct container. `axQuery.js:323–345` enumerates its direct `.ax_table` and `.ax_menu` children. Menu items use tableCell, not a separate menuItem runtime type.
- `events.js:1009–1015`: only a menuObject DOM node with `.sub_menu` gets InitializeSubmenu. `parentCellId` resolves relative to the current menu element; this preserves actual repeater-instance addressing. Root menus are not automatically hidden by this hook.
- `tree.js:36` always sets submenu display:none on initialization, without firing hide. There is no orientation branch or runtime relayout: horizontal/vertical positioning comes from stored/generated geometry.
- `tree.js:10–19`: parent-cell mouseenter immediately shows the submenu, raises it, then runs submenu Show. No delay, click toggle, already-visible guard, selected mutation, disabled-cell guard, or sibling-closing loop. Repeated enter repeats Show.
- `tree.js:21–34`: parent-cell mouseleave compares pointer page coordinates with submenu offset plus jQuery content width/height. It closes only if x+3 < left, x > left+width, y+3 < top, or y > top+height. Boundaries are inclusive; only top/left receive the 3px allowance.
- Closing through the parent-cell branch iterates submenu plus all `.sub_menu` descendants in DOM order. It hides each but dispatches Hide to the **same original submenu ID every iteration** (line30). Thus one descendant causes two parent-submenu Hide events, even if that descendant was already hidden. Finally it clears parent-cell hover.
- `tree.js:39–45`: submenu mouseleave has no point containment guard. It hides itself and all descendant submenus, then dispatches each one's own Hide ID, including already-hidden descendants, and clears its trigger-cell hover. Returning from submenu to parent therefore closes it; reentering parent can immediately show it again.
- No handler in this menu module closes on leaf click, outside click, Escape, or selecting an item. No viewport-edge flipping or timers occur here. Avoid introducing those as native behavior. Normal pointer leave can of course be produced by a real move to an outside click location.
- `tree.js:49–56`: automatic Show/Hide calls handleEvent with skipShowDescriptions=false and synthetic=true. This bypasses ordinary visibility/handled guards; there is no disabled guard on this path.
- Explicit public `.visible` uses SetIdVisible and does not itself raise menu events. Ordinary generated Show/Hide actions use `axQuery.std.js:398–419` with fire:true; `visibility.js:55–61` skips unchanged own visibility, and `308–312` runs completion/fit then Show/Hide. Automatic menu hover is intentionally a different repeat-event path. Animated/push/pull timing beyond this branch is not probed.

## Events, actions and text

- `events.js:605–618`: ordinary internal disabled cell skips its own handler but permits bubbling. A disabled ancestor menu does not suppress an active child's handler. This is not panel-style disabled propagation.
- `events.js:281–415`: matched cases, including empty actions, mark the DOM event handled; no case, false condition or disabled case allows the chain **cell → table → menu → ancestor menu**. A submenu's parentCellId is a sibling reference, not a DOM ancestor or logical fallback node. Click and DoubleClick share this behavior; MouseOver/MouseOut are in the separate allowBubble list (line202).
- `events.js:1876–1896`: menu/table traversal runs the container then recursively its objects in stored/exported enumeration order. Menu → contained table → its ordered cells → submenu descendants, including hidden branches. No row-major recomputation is justified when native object order exists.
- `axQuery.std.js:75–81`: menu/table/cell Resize is unsupported/no-op. Move uses ordinary addressed-node geometry, not track layout. Root menu movement naturally moves descendant DOM; moving a cell does not move its sibling submenu.
- `axQuery.std.js:1087–1255`: menu selected/error/enabled setter does not recurse or change the internal selected/disabled maps. Enable/Disable writes an inert DIV disabled property. Cell selected remains supported, independent of hover; menu hover/click does not automatically select.
- `axQuery.std.js:883–924`: menu GetWidgetText aggregates all descendant paragraph/list text, including hidden submenu text, in DOM order with LF separators. Same empty/rich paragraph rules as table-runtime evidence. Menu has no rich text panel; direct native SetWidgetRichText is not a valid menu target. A product safe no-op must be labeled a compatibility boundary.
- Show/Hide of the whole menu leaves each submenu's own display state intact; a later root Show restores open descendants unless separately closed. Repeater refresh rebuilds DOM and reinitializes submenus hidden. The exact explicit-ID probe verifies handler state isolation; full RP repeater-generated markup was not obtained.

## Official documentation and scope

[Classic menu widgets](https://docs.axure.com/axure-rp/reference/classic-menus/) documents hover-based submenu behavior, horizontal menus opening downward and vertical menus opening rightward, initial three root items, three items in a newly added submenu, nesting, padding around item areas, and no adaptive styling. These current docs support feature intent; they do not establish byte-specific 11.0.0.4150 details or override the probed edge quirks.

## Product contract proposal and unresolved boundaries

Retain a menu wrapper with orientation, padding, its independent table and cell identities, ordered submenus, and each submenu's parentCellId. Preserve positions relative to the parent menu. Keep menu opening per runtime row instance; do not persist it into design data. Reuse table-cell text/selection and container event fallback while excluding menu from panel disabled/selected/resize propagation. Expose Show/Hide events and distinguish automatic repeat dispatch from explicit action no-op.

Still unknown: original editor insertion/reordering/keyboard behavior; nonempty-submenu native RP serialization (the eleven-sample census has only two empty-submenu roots); exact generated overflow/borders/hit-testing of rotation/padding; touch behavior; generated tabindex/ARIA; menu action-picker eligibility; original full application visuals. BringToFront is invoked in the probe. Additional static legacy.js:25–38 (SHA256 aa4f16d4597fb1c9ea9efc1d3c8372a4651d6fb76402bf1fed396bd8537b8e88) increments global MaxZIndex, writes that target only, then raises fixedKeepInFront objects. This body was read, not executed in the menu probe. No assertion of native overlay escaping a clipping panel/repeater is made.

## Reconstruction implementation and bounded verification

The shared portable runtime now owns submenu instance opening, z ordering, automatic Show/Hide dispatch (including repeated parent-target Hide), generic changed-value Show/Hide actions with cycle guard, visibility snapshots, menu/table/cell logical click fallback, deep loading and aggregate text. Preview and offline mount only provide actual mouse positions/content-box dimensions. Whole-menu disabled/selected/error/resize gates do not use panel propagation. Initial submenu hiding also applies in the engine snapshot helper.

Focused tests: tests/menu-runtime.test.ts has 51 module/serialized/snapshot cases; the existing 75 table cases still pass, total126. Typecheck passed. The separate tests/e2e/menu-runtime.spec.ts uses real UI file import/export and actual offline HTML, verifies nested hover/click/selected item/sibling and external departure, vertical opening, root fallback, action no-ops, aggregate hidden text, per-row targets, Restart/reload and unchanged saved design. Two renderer screenshots were independently viewed; the open nested menu and selected leaf are visible and consistent in both. They are reconstruction screenshots, not native GUI comparison.

Explicit boundaries: product unsupported Menu SetText is a safe no-op (native direct rich setter is not supported); invisible widgets are unmounted and recreated instead of retained as native display:none nodes, while the runtime preserves their widget/row state; fixedKeepInFront and original generated clipping/rotation/touch/keyboard semantics remain outside this milestone. Runtime z layers are ephemeral and deliberately excluded from authored project persistence. The border/padding content-box browser check is a controlled test DOM mutation, not a claim that CSS padding equals the menu model's authoring padding.

Native storage and contained-table placement are documented independently in [menu-format-evidence.md](menu-format-evidence.md). Only the two real root menus with no stored submenus are currently eligible for native import; authored nested-menu runtime support does not imply native nonempty-submenu decoding.

### Confirmed overlap defect and fix

A later ordinary sibling box was placed over the expanded submenu area. Before the renderer fix, an actual browser elementFromPoint at the first submenu item returned menu-overlap instead of menu-file-item-0; the failing preview trace is retained under test-results/menu-overlap-baseline. All-widget rotate(0deg) created an unnecessary stacking context at the menu wrapper, trapping the submenu z-index. Both live renderers now use transform:none only for zero-rotation menu containers. They raise the submenu itself, consistent with legacy.js:25–38; they do not raise the whole root menu. The retained two-mode E2E now checks actual hit target and performs an ordinary click (no force), and passed 2/2 after the fix. This removes a measured basic overlap failure rather than treating it as unspecified stacking behavior.
