# Native adaptive project import

REA Prototype Studio remains an independent development build, not a complete Axure clone. This stage connects native RP serialization to the shared view-set and runtime behavior already implemented. The retained original target is Axure RP 11.0.0.4150; original GUI canvas/pixel equivalence and native write-back remain unverified.

## What changes

- Read document-owned sets using original object IDs, stored GUIDs, typed references, package versions and complete same-set parent chains. Page assignments use the stored set ID. Base dimensions of zero are retained; the existing 1200×900 editing canvas fallback does not replace native thresholds.
- Preserve independent local declarations for position, size, visibility and supported appearance. Native Point and Size values are atomic; partial records are rejected. All local property records are validated, then only Overridden + Determined records become effective declarations.
- Keep an ordinary empty style distinct from `stateStyles:{}`. The latter is the original runtime's whole-map inheritance barrier; nonzero references to empty individual state styles also remain explicit. Unknown view GUIDs stay inactive without invented names, sizes or parents.
- Map Set Adaptive View's Auto, Base and named GUID targets, and Page Adaptive View Change. Named targets must belong to the owning page's complete set. Unresolved actions reject the whole event, preserving terminal-action behavior. Nested panel scope and rich-text link targets are validated separately.
- Re-project raw local properties at the product import boundary and compare the result with the semantic report. Source metadata is not treated as trusted executable input. Only widgets surviving the final import/pruning pass receive page override entries.

## Evidence and real input coverage

The eleven pinned original files have 3 complete Base-only sets, zero complete named views, zero Set Adaptive View actions and zero Page Adaptive View Change positive examples. There are 1,084 Page records: 165 unassigned, 919 with unresolved library set references. These missing definitions are not reconstructed from caches. The three Base records are Default 0×0, Flow 0×0, Prototype Starter 1366×1000; all store Touch cursor 1. This cursor affects the original player's device shell and is retained in the import report, not claimed as implemented player appearance.

Twenty-five original owners reference 75 adaptive styles, all with explicitly empty property lists. Thirteen owners are Flow vector shapes and twelve are repeaters. Current import adds **9 real Flow shapes and 27 empty inactive declarations**. Other unsupported geometry/types remain reported. All previously imported complete document data and ordering are compared against the frozen pre-adaptive documents, including rotation and shape-text additions.

The raw test fixture is independently encoded from a pinned tutorial's decoded structure, with declared test sets, local declarations and action trees added. Its SYNTHETIC label is retained in the document and controls. Its raw bytes traverse the actual container/object/semantic readers and the desktop parser worker. This exercises a known storage contract; it does not establish that Axure emitted or accepted the fixture.

## Verification record

Final counts, exact tested package/archive hashes, parser/unit/browser results, save/reopen checks and screenshots are recorded in [adaptive-import-verification.json](adaptive-import-verification.json). The original-source [set reader evidence](adaptive-import-sets-evidence.md), [local declaration evidence](adaptive-import-styles-evidence.md), [action evidence](adaptive-import-actions-evidence.md), [real corpus comparison](adaptive-import-corpus-audit.json) and [stage checklist](adaptive-import-plan.md) retain scope and limitations.

## Remaining gaps

Page-specific adaptive appearance has a different carrier and is diagnosed separately. Placed/limbo state is not hidden state. Local named style inheritance, partial padding, adaptive corner/path regeneration, rotation/compound transforms, arbitrary line spacing and unresolved view definitions remain unsupported. Base widget behavior outside these declarations retains its existing import restrictions. Empty native local records do not prove the native HTML generator emits literally empty JSON because that generator also performs type-specific font processing.

The original editor's capture/input bridge previously failed after the authorized blank editor was visible. The package tests and retained-function probes are separate evidence; they do not replace an original editor interaction or pixel comparison. The full reconstruction goal remains incomplete.
