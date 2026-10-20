# Classic menu authoring — implementation and verification evidence

Recorded 2026-10-14 in `D:\WSCodex\REA`. This report covers the reconstructed authoring UI, four focused unit/server-render tests, and three real-browser authoring workflows. It does not claim access to the original application's editor GUI. The original `FrameArrived` capture failure was not retried. No original native process or proprietary DLL was launched for this authoring work.

## Evidence layers

1. [Official classic-menu documentation](https://docs.axure.com/axure-rp/reference/classic-menus/) confirms the capability scope: horizontal and vertical menus, three initial items, before/after/delete item commands, initially absent submenus, three-item submenu creation at further levels, menu padding, and shared properties across adaptive views. It describes downward/rightward submenu presentation and browser hover behavior. It does not establish this implementation's exact editor mouse/keyboard rules, geometry arithmetic or transaction boundaries.
2. [Native format evidence](menu-format-evidence.md) documents two actual menu objects in `Default.rplib`, their independent internal tables and six cells. That corpus contains no nonempty native submenu collections. Native import support and evidence are owned by the format work, not established by these author tests.
3. [Native runtime evidence](menu-runtime-evidence.md) separately documents exact-function probes and static runtime reading. Automatic hover, event fallback and setter behavior are not inferred from authoring-canvas clicks. The author tests below do not execute the preview/offline menu runtime.
4. The tests in this report exercise the reconstruction itself. Test fixtures use the public safe model factories; expected item order, dimensions, references and saved contents are asserted explicitly rather than by invoking the same mutation helper as an oracle.

## Implemented structure and source ownership

The menu remains a `Widget` of type `menu`. Its `menu` data retains `orientation`, an independent `table: Widget`, `submenus: Widget[]`, four-side `padding`, and a child menu's `parentCellId`. A menu item is a table cell with its own identity, rich text, style and interactions. Menus are not flattened into ordinary tables.

| Source | Authoring responsibility |
|---|---|
| `src/App.tsx` | Library variants, menu/current-item selection, root transactions, item and submenu operations, rich-text editor routing, shared adaptive edits, root move/resize routing, keyboard ownership, Outline and Inspector wiring |
| `src/components/MenuEditor.tsx` / `.css` | Menu structure controls, padding fields, ancestor lookup, recursive Outline entries, item/container selection overlays and owner affordance |
| `src/components/WidgetView.tsx` | Static menu/table/item rendering, explicit author submenu expansion, safe item content, per-item pointer/text-editor callbacks; visible overflow retains expanded children |
| `src/components/Inspector.tsx` | Menu/item property routing, menu traversal in target lists, permitted action targets, menu Shown/Hidden event choices, reusable item rich-text/style/interaction editors |

The parent owned model/schema/traversal/adaptive/component changes and `src/model/menu.ts`. Runtime, player rendering, native import, desktop packaging and release verification were outside this author implementation's ownership.

## Authoring contracts and explicit choices

- `MenuSelection` stores `{rootMenuId, menuId, cellId?}` separately from `TableSelection`. `expandedMenuIds` is session state. Selecting or expanding submenu content does not write `hidden`, `selected`, interactions, or any other prototype data. Reopening a project does not persist the editor expansion state.
- Library entries have distinct descriptor identities and orientation-aware creation/drop data. Both create type `menu`; no invented widget types such as `horizontalMenu` are serialized.
- Selecting a menu item exposes that item's Inspector and its existing in-place rich-text editor. A menu container retains its own fill/border and padding; it does not expose a nonexistent root caption or table row/column editor. The internal table is a distinct model/render object, not a separately navigated author canvas.
- Add-before/add-after/delete/reorder operations act on the selected item's containing menu. Adding a submenu selects its first item and makes the new editing branch visible. Deleting an item removes its owned submenu subtree through the model helper. Deleting a submenu is an explicit parent-item command.
- At least one item is retained. This is a safe authoring/model constraint, not a verified original last-item deletion rule.
- Root movement uses the ordinary document gesture/history path. Item width/height, menu dimensions, orientation changes and padding delegate to the menu/table model helpers. Those helpers explicitly label their track redistribution and child anchoring as authoring geometry policy. The author tests do not prove the original editor's exact resize algorithm or nonzero-padding pixel offsets.
- A menu-item selection owns arrow/Tab navigation and Delete/Backspace. It blocks generic widget grouping/duplication/clipboard commands that would otherwise affect the whole owner; text clipboard commands belong to the in-place editor, and whole-menu copying requires whole-menu selection. These are current product interaction choices, not reconstructed native key-policy proof.
- Submenu container selection cannot accidentally delete or move the entire root via generic item commands. Whole-menu cloning delegates to existing graph-aware clone helpers.
- Menu content, structure, dimensions and styles are shared across adaptive views. Root place/unplace is the separate model-supported exception; the author E2E below verifies shared edits without creating style/geometry overrides, not every place/unplace scenario.
- Menu root action pickers exclude Set Text, Selected, Resize, Error and Enable/Disable, following the runtime contract. Items retain table-cell restrictions. Shown/Hidden are available on menu event lists in this milestone. Author pointer selection does not fire prototype actions or emulate hover opening.

## Focused unit/server-render evidence

Command executed:

```powershell
npx vitest run tests/menu-authoring.test.ts tests/table-authoring.test.ts
```

Result: **8/8 passed** in 501 ms at 03:03:08 local time: **4 new menu tests**, plus **4 existing table-author tests** as a focused regression check. The unit result was returned in the command output; no separate unit log file was created. This count is not a full-project unit-suite count.

| New menu test | Actual assertions |
|---|---|
| Exact nested ancestor identities | Root/child/grandchild chain, root self-path, missing ID, and no mutation of the serialized input |
| Passive versus explicit editing expansion | Passive output omits child menus; explicit two-level expansion renders all nine items; stored script-like text is escaped; no table editing controls; menu overflow permits child rendering |
| Independent menu Inspector/overlay | Padding and item commands, retained outer fill/border controls, no fake root text or Selected UI, no table row command, and selected-item overlay coordinates including asymmetric padding |
| Last-item and event restrictions | Delete-item disabled at one remaining item; Shown/Hidden options present on menu and absent from menu-item event list |

These tests inspect helpers and React server output. They are not a replacement for pointer interaction, native application behavior, accessibility-tree interaction or pixel comparison.

## Real-browser author workflows

Command executed in the development configuration:

```powershell
npx playwright test tests/e2e/menu-authoring.spec.ts --output=test-results/menu-authoring --reporter=list
```

Result: **3/3 passed**, total **18.9 s**. Playwright session `66167` reached terminal exit code `0`; its browser/server run ended before handoff. Configured environment: headless Microsoft Edge, `Desktop Edge`, one worker, viewport 1600×1000. No force-clicks or direct document-state injection were used for author edits. Project opening used the app's file chooser; saving used its real download flow followed by strict `parseDocument` readback. The tests construct starting fixtures through model factories, and subsequently drive visible controls and keyboard input.

Log: `.build/menu-authoring-focused.log`.
Output directory: `test-results/menu-authoring` (saved `.rea.json` checkpoints under each test output directory; successful tests are not claimed to retain failure-only traces/screenshots).

| Scenario | Time | Verified behavior |
|---|---:|---|
| Horizontal Library / nested rich text / padding | 10.3 s | Horizontal default three item labels and no submenus; item text and italic editing in place; create child and grandchild menus with independent parent-cell links; edit a grandchild; asymmetric `[5,9,7,11]` padding, internal table position and size, outer fill; save/New/open roundtrip; selecting the deep Outline item opens its author branch while the next saved document remains equal |
| Vertical structure / subtree history | 3.3 s | Add submenu, insert before, move item later, delete inserted item; original item IDs and child ownership survive; delete submenu, Undo restores the exact saved document, Redo restores deletion; change menu width/padding; change orientation while preserving surviving item IDs and asserting expected tracks/bounds |
| Adaptive edits / actions / whole-menu copy | 2.3 s | Item width/fill changes in a named adaptive view modify shared data without overrides; author Set Text targeting another menu item while excluding the root menu target; duplicate the whole menu; assert distinct root/internal-table/cell/case identities and remapped internal action target; Undo duplication; create the vertical Library variant and verify its matrix |

The third scenario proves referenced-item remapping for the authored root-menu graph. It does not independently prove every nested-submenu/component clone case; those belong to parent model tests. The first scenario proves two authored submenu levels, not unbounded depth or every budget limit.

`npm run typecheck` also completed with exit code `0` after the author run. An earlier temporary typecheck failure in another agent's new runtime fixture (`RepeaterData.rowHeight`) was corrected by that file's owner; no author code was changed to hide it.

## Default-style amendment after this focused run

After these author receipts, the parent aligned `createMenu` with the witnessed native Default style: transparent white fill, item Arial 13px normal text, left/middle alignment, two-pixel text padding, and no invented MouseOver effect. Current factory source was read when preparing this report. The author tests do not depend on the removed hover default and were not changed for this amendment.

Per the parent's instruction, **no tests were rerun for this report**. The receipts above retain their original chronology and must not be presented as a post-amendment production/package verification. The parent owns the final full production run and its exact totals.

## Remaining evidence boundaries

- No original editor screenshot, menu-authoring click sequence or native keyboard policy was captured. The functioning reconstructed editor is not original-GUI proof.
- Rich text, styles, padding and geometry were checked as saved data and generated markup. These tests do not establish native font metrics, border rasterization, viewport-edge handling or pixel-equivalent submenu positioning.
- Runtime hover/leave timing, pointer tolerance, automatic Show/Hide event repetition, disabled behavior, logical fallback, repeater row isolation, navigation/reset and actual offline HTML execution are covered by separate runtime evidence/tests, not this author suite.
- Native `.rp/.rplib` recovery, unsupported native submenu storage and fallback behavior remain the format/importer's scope. Hand-authored nested submenu success does not broaden the witnessed native-import subset.
- Menu rotation/zoom drag cancellation, deep component synchronization, mixed widget selections, all keyboard paths and maximum-depth/budget rejection were not independently browser-tested in these three scenarios. Existing shared implementations and parent model checks are not counted as new author E2E coverage.
- No full suite, production build, package, OS installation, network upload or original GUI retry was performed for this report-only follow-up.

## Frozen receipt identities

SHA-256 read while writing this report:

| File | SHA-256 |
|---|---|
| `tests/menu-authoring.test.ts` | `e944e7ac5cbe0f723226c6d2e5e26225ec27e57da2e68e7c64e76918733088c0` |
| `tests/e2e/menu-authoring.spec.ts` | `54fa600cd131a6fd0664c025f4d7fa24e57440d092d13c640d2155be72ca84a5` |
| `.build/menu-authoring-focused.log` | `06e6757a111683974a2a9042e488932a1bc86867b112e42bd506f69b35404449` |

Only this report was written in the follow-up. Production author files and test files remain frozen for parent integration verification.
