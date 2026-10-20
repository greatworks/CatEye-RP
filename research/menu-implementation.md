# Classic menu implementation

This stage reconstructs horizontal and vertical classic menus as independently identified menu containers, internal tables, table cells and nested submenu containers. It advances the Axure RP 11 reconstruction; it does not establish complete product parity.

## Authoring and persistence

Libraries provides Horizontal Menu and Vertical Menu. Each new menu has three items. Selecting an item exposes its text, rich text, links, styles, notes and interactions. Menu structure controls insert, delete or reorder items, add or delete three-item submenus, change direction, and edit four-sided padding. Edit submenu and Outline selection reveal nested menus on the canvas without changing their saved visibility. Root menus can move and resize as one object. Each submenu retains its direct parent-cell identity across item reordering, copying and component materialization.

The saved model is `menu { orientation, table, submenus, parentCellId?, padding }`. Internal tables retain their own IDs and object order. Validation rejects invalid orientation, non-linear tables, missing or duplicate parent links, padding/bounds mismatches, duplicate IDs, standalone submenu parent links, and document resource-limit violations. Interior menu objects share content, layout, styles and visibility across adaptive views; root menu placement can be view-specific.

Default insertion naming, inherited item styles, orientation conversion, proportional resizing, exact submenu seam offsets and editor selection/commit rules remain authoring conventions pending original GUI comparison. A menu must retain an item as a document integrity constraint; this is not a claim about the native editor's last-item dialog.

## Runtime

The shared preview/offline runtime controls submenu visibility per menu instance. Submenus begin hidden. Entering a parent item opens its submenu immediately and brings it forward. Parent-item exit uses the observed submenu rectangle and the native three-pixel left/top tolerance. Exiting a submenu closes it and its descendants. Hover behavior does not depend on the saved disabled flag. Leaf clicks and outside clicks do not themselves select items or close menus.

Click/double-click fallback follows the containment chain from cell through table and menu containers, never through the submenu's referenced parent cell. A matching case, including an empty case or pending case menu, consumes the event. Menu-level disabled state does not disable descendants. Menu Resize, Enable/Disable, Selected and Error setters are inert. Menu text reads include hidden descendant menu text in object order; Set Text targets cells, since menu/table containers have no own text panel.

Shown/Hidden events are supported. Generic visibility actions fire on a real visibility change; automatic submenu transitions retain the observed native repeat behavior. In particular, parent-item exit hides every descendant but directs each Hidden notification to the immediate submenu, whereas submenu exit notifies each affected submenu itself. Tests retain that distinction. Navigation, repeater refresh, disposal and failed action rollback clear or restore transient state as appropriate.

Unlike the original `display:none` nodes, hidden reconstructed widgets are unmounted. Original generated DOM, keyboard/focus details, exact border seams, stacking against every widget type, animation, and full desktop interaction/pixel parity remain unverified. These limits apply even when the menu behavior checks pass.

## Native import and evidence

The pinned Default library provides two top-level MenuObjects, two contained Tables and six cells: one horizontal File/Edit/View menu and one vertical Item 1/2/3 menu. Their padding is zero and their submenu arrays are empty. CIL establishes enum orientation and the menu layout operation that supplies the otherwise unstored internal table position. This stage recovers those observed structures and rejects unsupported nonzero padding or nonempty native submenu structures atomically. It does not infer their file encoding from authored fixtures.

- `menu-runtime-evidence.md` and `menu-runtime-probe.json`: pinned original-function behavior and probe coverage.
- `menu-format-evidence.md`, `menu-format-manifest.json`, `menu-format-import-audit.json`: native structure, source identities and the 11-sample import comparison.
- `menu-authoring-evidence.md`: implemented authoring workflows and their verification.
- `menu-verification.json`: final package/test results when release verification has completed.

The earlier table stage remains in `table-verification.json`. No original Axure code or proprietary assets are included in the reconstructed application. The original editor's accessibility observation succeeded, but native clicking failed with `coordinate input geometry is unavailable`; no original GUI menu operation or side-by-side pixel comparison is claimed.

Official authoring reference: https://docs.axure.com/axure-rp/reference/classic-menus/ (read 2026-10-14). Pinned shipped artifacts remain the version-specific runtime authority.
