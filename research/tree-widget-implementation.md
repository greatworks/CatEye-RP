# Tree widget implementation scope

This stage adds the Tree widget, distinct from the application page tree. The reference is the retained Axure RP 11.0.0.4150 distribution. The original editor was observed after login, but native input remained blocked by unavailable coordinate geometry, with earlier capture timing out. No original GUI or pixel parity is claimed.

## Model and authoring

The root, each row node and each text label have separate identifiers. Children retain local coordinates; saved/imported geometry is not silently normalized. Authoring structural operations lay out rows with the configured indent, preserving each label's stored geometry. Default creation mirrors the witnessed four labels and 95×80 root. Independent model tests cover complete subtree movement/deletion, last-node protection, initial expansion, rich text, identity remapping, component materialization, adaptive sharing and malformed inputs.

Libraries → Tree adds the widget. Tree structure controls add children/siblings, move, indent/outdent, delete, set expansion and choose an independently drawn triangle or plus/minus indicator. Label text uses the existing rich-text editor. Canvas changes are undoable; Outline reveals ancestors in session state. All tree properties are shared across adaptive views, with root visibility allowing placement differences.

New labels use a conservative stored width; insertion inheritance, outdent placement, font-metric autofit, arbitrary indent edits and exact original editor gestures remain product conventions pending direct comparison. Custom icon rendering uses a 16×16 product convention; native custom icons are outside the admitted subset. The original triangle PNG bytes remain research evidence and are not packaged.

## Runtime

The shared preview/export runtime keeps the saved root bounds during expansion. It shifts only later siblings along the visible ancestor chain by the visible descendant row heights. Expansion state in a hidden branch remains independent. Clicking an expand indicator toggles and selects without invoking node click actions; label click selects then invokes node behavior. Node click does not fall back to ancestor-node click. Selection is exclusive within the same tree and repeater instance.

Expand/Collapse/Toggle tree node are the application's action names. The native operation is expandCollapseTree with an expand boolean; Toggle is a convenience extension. Set Text on a node writes its label, while text retrieval includes all descendant labels, including collapsed descendants. Root Set Text safely does nothing. No new expansion event has been invented. Native generated icon identities and full annotation/focus/keyboard behavior are not reproduced.

## Native file recovery and verification

The admitted default graph is one root, four nodes and four labels from Default.rplib. Geometry, containment style forwarding, default expansion and active triangle assets have pinned source evidence. Unsupported structures reject atomically; source properties are never fabricated as if they were stored. Original function probes, native import audit, focused tests, complete regression checks and exact-package smoke results are recorded in the sibling evidence/verification files.

Full Axure parity, native RP/RPLIB writing, complete tree variants and actions, original desktop interaction comparison, cloud/team workflows and macOS remain unfinished. This stage is an independently implemented subset.
