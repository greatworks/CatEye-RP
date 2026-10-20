# Affect All Views: authoring code review and proposed integration

Read-only review of the current placement-stage source on 2026-10-15. No product/test changes, native execution, browser runs, build or package operations were performed. The release counts/hash supplied by the parent are context, not a new release verification by this review. The prior placement report and manifests remain unchanged.

## Main conclusion

Do not implement All Views by calling the existing edit function with a null view, or by copying the effective active-view widget/tree to Base. The effective tree contains unrelated inherited and local declarations. Such a shortcut would silently promote those declarations to Base and can still leave overriding child values in place.

Concrete example: Base has x=100, width=200, white fill; a child has x=10, width=100, red fill. An All Views fill-green command should not accidentally set Base x=10/width=100 or clear child geometry. The exact native property groups to clear are still being confirmed (notably point P101, size P105 and state-map P21). The product needs an explicit per-widget command/intent carrier; snapshot diff alone is insufficient for this operation.

## Current entry points

| Path and current line | Present behavior | All Views integration needed |
| --- | --- | --- |
| App.tsx:126–135 changeWidgets | Replaces the current panel/repeater editing scope into the complete effective page, calls applyAdaptiveWidgetEdits, then commitAdaptivePage. The only scope option is placementAllViews. | Central transaction boundary; carry scope plus exactly which properties each edited widget intentionally changes. Continue passing the full graph. |
| App.tsx:305–341 patchSelected | Ordinary multi-selection, type-specific form fields/current-only vectors, table/menu/tree special paths. A second explicitTextStyle argument preserves explicit style commands. | Generalize this existing command intent rather than recomputing a full style diff from the current widget. Resolve values per target; keep current-only form/vector guards. |
| App.tsx:428 style toolbar | Presets, font, color, fill, border, alignment and line styles already pass an explicit style patch. | Route that patch to the new scoped command. A full preset intentionally supplies all its keys; ordinary color does not. |
| Inspector.tsx:553–566 WidgetStyleEditor.updateStyle | Uses mergeWidgetStyle and sends both merged style and exact patch. It marks removed richer fields undefined. | This is a good existing style boundary; retain property presence/removal. Do not serialize undefined. |
| Inspector.tsx:570 Layout | X/Y/W/H/rotation submit small Widget patches. | Preserve property intent, then map to the evidenced native point/size group rather than assuming every scalar is independent. |
| App.tsx:359–363 align; 388–393 drag/resize; 402 arrow-key handling | Changes effective geometry snapshots; pointer gesture history starts at committed document and ends once on pointer-up. | Produce per-widget geometry intents. For continuous gestures, derive every intermediate global result from the gesture's original document, not the prior event's already-cleared declarations. Returning to origin and pointercancel must restore the exact original document. |
| App.tsx:431 Outline eye | Directly changes hidden via changeWidgets; lock also goes through it. | Hidden is already adaptive; locked is shared. Do not accidentally scope both identically. Placement remains its own command. |
| Inspector.tsx:590–591 Selected controls and 611–637 InteractionStyleEditor | Sends complete flat effect replacements; active child materializes a complete effective state map. Use inherited effects calls clearAdaptiveStateStyles separately (App.tsx:438). | Must respect P21/map semantics. Add/remove effect/property, inherit map and temporary effect preview are different commands; an All Views implementation cannot flatten them into ordinary style keys. |
| Inspector.tsx:375 Action Set style; 640–655 interaction editing | Changes the shared interactions graph, not the target widget's authored style. | Do not interpret action.style as a current author style command or clear target adaptive declarations merely while editing an action. |
| App.tsx:140–144 applyRichText; inline text commit at 435 | Rich content and run edits write shared text/richText. | Preserve current-only session and link identities. This must not silently become per-view content. |
| App.tsx:150,201,247–273 tree/menu/table editors | Explicit shared structure/track/cell edits, with separate current-node/cell selection. | Keep existing shared-content model; do not manufacture forbidden adaptive cell/node declarations. Root layout/style handling remains the current composite contract pending new native evidence. |

These line references identify the reviewed source hashes below. They are not claims about future line numbers.

## Current domain behavior and pitfalls

1. adaptive.ts:303–366 accepts a complete effective tree. Base writes that tree directly. Active-view edits compare with the effective parent, preserve unchanged local declarations, restore Base geometry/style, and keep content shared. This is correct for the current-mode path but is not an All Views command implementation.
2. adaptive.ts:132–201 layoutDifference encodes style reset semantics and optional defaults. adaptive.ts:210–232 preserves equal-valued local declarations; those declarations must only be cleared when an actual global property edit requests it. Mere re-render, note/text change, or unrelated drag must not erase them.
3. Current state maps are nearest-whole-map barriers. adaptive.ts:348–357 deliberately materializes the complete effective map after a current-view effect edit. An empty map blocks inherited effects. Removing an ordinary key must never incidentally prune this barrier. All Views effect behavior requires the original P21 command/edit proof, not an invented per-state deep merge.
4. document.ts:43–49 defines four product reset pairs: fill/fillGradient, stroke/strokeGradient, radius/cornerRadii, strokeWidth/borderWidths. Those pairs need explicit global deletion rules consistent with their native property groups. Shadows, lineEnds, borderVisibility and gradients are complete objects/tuples, not recursively merged partial objects. A line-width command must not clear unrelated paint or line pattern.
5. adaptive-view-sets.ts:98 projects only the active shared set into page.adaptiveViews; inactive declarations survive in page.adaptiveOverrides. Any all-view clearing needs both stores. commitAdaptivePage at 184 rewrites active maps back to shared storage. Clearing only the projected views allows inactive declarations to return when switching sets. Shared set metadata does not mean widget edits propagate to another page bound to the same set.
6. Composite rules in adaptive.ts:337–343 and document.ts retain shared table/menu/tree content/layout; only their root hidden/placed fields are adaptive. Table cells/menu descendants/tree labels are not generic adaptive widgets. Ordinary panel states/repeater templates do have independent adaptive layout/style. Do not broaden or collapse these distinctions while adding an authoring switch.
7. Named component publishing in components.ts:136 is an explicit separate operation. Generic changes within an instance should not automatically publish to all instances merely because All Views is enabled. Existing source-ID remapping and inactive-map pruning must continue working.

## Explicit command and UI suppression problem

Same-value behavior is not yet decided by this review: native GetEdit may produce an empty edit before the EditAllAdaptive branch. The implementation must follow that evidence rather than always clearing local declarations on focus/blur.

Current submission boundaries that need auditing once that rule is known:

- Inspector NumberField at 109–124 suppresses equal values unless commitUnchanged and a modified draft. Geometry fields do not currently enable commitUnchanged.
- FillEditor SolidColor at 69–74 suppresses equal values; PaintEditor at 104–112 suppresses unchanged gradient Apply. The explicit Solid command still clears an existing gradient and must retain that meaning.
- ShadowEditor ShadowNumber at 28–38 suppresses equal values.
- LineStyleEditor select changes carry an atomic end pair/side tuple; Reset buttons carry explicit undefined. Some native select controls do not emit change when reselecting the same option.
- Toolbar and Inspector normal style patches are already explicit, but patchSelected's fallback compares against current.style, not each target's Base. Preserve the explicit path for mixed selection and removal.

If native evidence requires a deliberate equal-value command to clear other views, add a narrow submission policy for that command. Do not turn every passive blur into an edit or history entry.

## Typography, content and effects boundaries

Whole-widget font commands and inline range edits are not interchangeable. rich-text.ts:156–175 applies explicit font/decoration keys to all runs, textAlign to paragraphs, and a lineHeight command removes paragraph pixel-height overrides. App currently performs that baseline change only in Base (line 339); active-view typography is stored as an explicit projection (lines 130–132), including a normal reset equal to the outer Base value.

An All Views whole-widget font command from a child will need to update the original Base rich baseline intentionally and clear the relevant adaptive text-style declarations, without copying the active view's projected rich formatting. It must also avoid reintroducing the cleared declaration via App's existing explicitViewTextStyle block. Mixed run formatting, hyperlinks, literal expression mode, text and paragraph identity must survive non-text commands.

Inline WYSIWYG range format, Enter/paste/IME, paragraph edit and hyperlink definitions remain shared rich content under the existing model. Plain Widget text replacement keeps the first run's baseline formatting. Editing interactions, options/selected indices, hints, disabled/error initial flags, panel states, repeater datasets, vector commands, image/frame targets, notes/name/lock/group metadata remains shared where the existing schema already says so. No new per-view content carrier is implied by this stage.

The temporary canvas effect preview is display-only and must not be read back as Base style. Runtime SetStyle actions, live selected/error/hint state, AutoFit measurements and runtime adaptive transitions are not authoring scope commands.

## Minimal implementation proposal (pending source contract)

Keep the existing current-mode path and add an explicit author-command layer at changeWidgets/patchSelected. A suitable internal shape is a per-widget list containing a sparse layout command, a sparse normal-style command, and (only after the P21 contract is settled) a state-map command. Presence of a property expresses intent, including an explicit removal; values are per target. The scope is a session-only current/all setting, not saved into the document.

The model operation should validate the target eligibility, build native-aligned atomic property groups, apply only those commands to the raw Base owners, clear only corresponding local declarations from all active and inactive maps, preserve unrelated graph content/IDs and empty barriers, and return the original page for a true no-op. Use mergeWidgetStyle/reset semantics for values and an explicit removal list for absent optional fields. Do not require a new file schema just to store the editor's scope switch.

Keep structural/content mutation through the existing shared path. If a gesture combines structure or content with global layout, compose those changes against the original document before one commit. Continuous drag uses the pre-gesture snapshot for both Base updates and clearing, so cancel/out-and-back can restore removed declarations. Apply from dialogs is one command; canceled/invalid drafts create none. Model return-reference no-op checks should happen before commitAdaptivePage, which currently constructs a fresh Document even if called with unchanged effective data.

Do not rename the placement-only checkbox to generic Affect All Views until every approved normal geometry/style entry point is connected. Decide whether the new setting replaces or synchronizes the placement scope only after the native UI/control evidence arrives. Page dimensions/background and shared set definitions remain separate editors.

## Meaningful regression plan

1. Base/parent/child/sibling plus an inactive view map: global edit touches only the intended native property group, Base is updated, all maps lose only that group, other declarations survive. Include a page bound to the same set that must remain byte-identical.
2. Scalar UI versus atomic geometry: X-only and W-only commands with differing sibling Y/H, rotated edge resize, tiny untouched dimensions and fractional values. Expected grouping must come from source, not current implementation.
3. Equal-value, explicit-default and absent optional values: include native empty GetEdit behavior, normal/400 font resets, same-color Solid over gradient, shadow off/removal, lineEnds/visibility reset, and inactive maps. Passive blur must not create history.
4. Multiple selected ordinary widgets with different Base/current geometry and colors; one explicit command must not copy the first widget's unrelated properties. Keep mixed-selection type gates (forms, vector path, image/line stroke capabilities).
5. Toolbar, Inspector, drag, arrow nudge, align, preset, Outline hidden, active effect editor and Selected shortcut. Save/open and undo/redo must preserve exact declarations. Preview-only effects must not change saved bytes.
6. Drag multiple events, return-to-origin, pointercancel, Undo while held; canceled actions restore all removed local declarations, not just visible geometry. Check one undo per committed gesture.
7. Mixed rich runs and linked text: global whole-widget normal/fontSize/color changes Base runs intentionally; local mode retains Base runs; inline range edits remain shared; non-text edits leave richText byte-identical.
8. Effects: nearest map {}, populated maps and empty individual entries; global edit/clear behavior follows the P21 proof. Preserve unrelated normal properties. Verify no metadata leak and no accidental deep merge.
9. Normal panel state/repeater template nested scope, composite roots/cells/labels, component instance without publish, inactive-map switchback. Preserve placement and full stored graph.
10. Editing a SetStyle action changes only the shared interaction graph, leaving the target's Base and adaptive styles untouched. A later runtime action remains separately tested.
11. Legacy omission and no All Views setting noise through serialize/parse. No broad schema changes expected; strict unsupported composite overrides continue rejecting.

Useful existing tests: adaptive.test.ts (current local/shared semantics), adaptive-hierarchy.test.ts:57–150 (atomic resets, explicit equal declarations, rich resets), adaptive-view-sets.test.ts:79–177 (inactive maps, same-set no-op, atomic migration, independent pages), adaptive-state-styles.test.ts:95–149 (effect materialization and barriers), adaptive-placement-authoring.test.ts (placement, shared identities, insertion), adaptive-component-sync.test.ts, font-style.test.ts and rich-text model tests. Browser fixtures are already available in adaptive-and-nesting.spec.ts, rich-text-authoring.spec.ts, gradient/gradient-border/line-style/shadow-authoring.spec.ts, rotation-authoring.spec.ts and table/menu/tree authoring suites. These tests were read, not rerun in this audit.

## Native evidence status and limits

The frozen placement-authoring evidence binds KJm7.sJp1 (100695567) to EditAllAdaptive, actual overridden keys, WJpV (100695539) clearing those keys from local adaptive styles, then writing Base. The sibling's current narrow investigation confirms no active/ancestor-only filter and an empty-edit early return. This supports property-scoped clearing, not arbitrary current-tree promotion.

Still pending before implementation: exact GetEdit same-value behavior, point/size property grouping, P21 producing command and copying semantics, compound style-group correspondence, and any special contained/master/Layer command forwarding. Original GUI/frame capture is unavailable; no claim of measured native toolbar gestures is made. The code changes proposed here are not an authorization to broaden those boundaries.

## Reviewed input hashes

| File | SHA-256 |
| --- | --- |
| `src/model/adaptive.ts` | `1e734b69b8f2eecbfba83d895bbeab1426182cd1c39de78159c20450c0060630` |
| `src/model/adaptive-view-sets.ts` | `4f5f427f13f088a84215646fc21ea978de2e109792a77b25d5832420b475e056` |
| `src/model/document.ts` | `16243b8b2eb75b15e1ce432b338e1d7f3c476fd217bc3a6f01202c1eb160fb06` |
| `src/model/rich-text.ts` | `01fa723e9e158cb16125753c5993fd2e86a370133b0a246cccced8d578d6863f` |
| `src/model/components.ts` | `b3f1119dbd80d735eac9c4ca4648fd035753895855458141878ac5287035101e` |
| `src/App.tsx` | `c7b3e4fd6b4ecac1af6ae0bc0d2956347c3974fc2605b41a9241ddf798faf502` |
| `src/components/Inspector.tsx` | `0c61ec33304adf181149893c4b242cc4bd8139124f61c245b855cfc2d8c8e87f` |
| `src/components/FillEditor.tsx` | `00b2b2560ff7489cf8a2063b50f4c5ef0e108a3a727342c07489d720f49352e7` |
| `src/components/ShadowEditor.tsx` | `02f4033c350138c027705c59f029dbb7af5a6e1da23bb6baf47166b494795702` |
| `src/components/LineStyleEditor.tsx` | `cc98849a2baaf1d0639ffaa4bb9e333876cabce76d2969a7accb6af55ebd5562` |
| `src/components/RichTextEditor.tsx` | `b098435bff327b5e4ac6e426bded9de3fbc542efaf820040caef373bbf1cac42` |
| `research/adaptive-placement-authoring-evidence.md` | `58496de976bde59a9a6b32d6c2c02e381990c40ec17d6669e25ee13368759648` |
