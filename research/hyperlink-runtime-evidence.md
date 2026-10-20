# Structured rich hyperlinks: original runtime evidence

## Identity and scope

Read-only investigation of Axure RP **11.0.0.4150**, from the retained distribution SHA256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`, REA extraction `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. No original application/GUI capture was retried, and no proprietary DLL was executed.

Original resource directory: `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`. Line numbers below refer to those unchanged files.

| Original file | SHA256 |
| --- | --- |
| style.js | f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c |
| expr.js | 530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6 |
| events.js | a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3 |
| action.js | c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3 |
| doc.js | 986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1 |
| axQuery.std.js | 0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd |
| ../jquery-3.7.1.min.js | 8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85 |

Reuses [text-decoration runtime evidence](text-decoration-runtime-evidence.md), its original 28 style/text probes, six hyperlink probes, and requested native link graph. This stage adds **16 style/text**, **13 event/menu/Wait**, and **5 navigation** passing probes, all written under `scripts/probe-hyperlink-runtime-*.mjs`. All HTTP is aborted; browser probes report zero requests and zero page errors. Navigation runs against inert `window.open`/location sinks in a Node VM. Neither synthetic nor stored URLs were visited or opened. Function slices, original paths/hashes, fixture values, and complete traces are retained in the corresponding JSON files.

## Proposed bounded product contract

- Store initial resolved leaf/run styles as the baseline. Keep a separate stable link identity, name, supported interactions and explicit hover/down patches. Runtime evidence does not justify treating ordinary link MyStyle as an extra live inherited style below runs.
- Model **paint operations and their order**, not merely a pure merge of current parent and link state. A parent repaint can erase hovered-link paint. A later link hover uses the literal mouseOver state to compute both parent and link overrides, ignoring parent selected/error flags at that operation.
- A supported external literal URL action can expose current/new host navigation, while preserving native action continuation and logical event handling. Current navigation replaces the prototype browsing context; how an editor overlay delegates it is a product host choice. Never treat an arbitrary unvalidated HTML string as the link definition.
- Click consumption follows enabled matching cases or a displayed case menu, not the presence of a URL or completion of a Wait. Empty matching cases also consume. A nonmatching link allows parent actions.
- Plain Set Text has a span-count/single-line fast path that can preserve an existing link. Do not assert that every plain replacement necessarily removes links.

## 1. Initial baseline versus parent/link overrides

`style.js:1790–1847` `_computeAllOverrides(id,parentId,state,view)` recursively computes the parent **with the same requested state string**, then layers the link's adaptive view properties/custom base-style references and its requested state patches. Each side's state order is normal, mouseOver, mouseDown, focused, selected, error, hint, disabled.

`style.js:1850–1869` uses `excludeNormal=true`; ordinary `diagramObject.style` and its ordinary base style are not copied into text overrides. Consequently, explicit normal link color/font properties in the diagram object do not newly override existing run CSS during hover/leave. Probe 1 assigns distinct parent and link normal colors/weights and gets an empty override object. Initial generator styling is a separate matter; native inline CSS already establishes the baseline.

The parallel format investigation traced native child-run generation (`ONiF` → `KNiN` provider) and reports the child run's own seven supported font/decoration fields. See [rich-hyperlink format census](rich-hyperlink-format-census.json) and `rich-hyperlink-html-writer-cil.json`. We do not use the runtime exclusion as proof that native initial link MyStyle can never affect generation.

During link hover, a link adaptive property overrides the corresponding parent hover property; its explicit link hover property overrides that adaptive value. A tested parent hover weight700/colorA, link adaptive weight300/colorB, link hover weight900 yields weight900/colorB. The entire resulting decoration flag pair undergoes the previously established atomic CSS conversion, including invalid false/true fallback to reset baseline.

## 2. Minimal observable paint state machine

Relevant original entry points:

- `_setLinkStyle`: **style.js:18–37**.
- `_resetLinkStyle`: **39–53**.
- Link hover/leave/down/up wrappers: **55–73**.
- Parent `_widgetHasState`, `SetWidgetHover`, `SetWidgetMouseDown`, `_generateFullState`: **75–166**.
- Parent `_applyImageAndTextJson`: **1647–1714**.
- Cache/reset/text application: **2028–2042, 2427–2456, 2592–2612**.

### Link hover or down

1. Compute parent and link overrides using the literal `mouseOver` or `mouseDown` string.
2. Ensure the parent text cache exists.
3. **If the combined overrides object is empty, return before resetting or applying CSS.** Previous paint stays untouched.
4. Otherwise restore cached CSS on the link and all its descendants, then apply the combined patch to that subtree. Other runs remain untouched.

The literal requested state is significant: link down does not implicitly include parent hover, selected or error. In the original probe, parent hover weight and selected fontSize disappear from computed overrides for link down; only parent down plus link down remains. Parent adaptive fields still participate.

### Parent repaint while a link is hovered

Parent `_applyImageAndTextJson` first restores cached CSS for the whole text subtree, then applies the parent's current compound override. There is **no link-hover replay** in this function. A probe applies link hover clear-decoration, then parent `mouseOverSelected` or `mouseOverError` repaint: the link becomes parent strike. Calling link hover again changes it back to the link's requested hover result, excluding parent's selected/error patch.

A direct original parent `setAdaptiveStyle` text application also overwrites existing link hover. Native view-change orchestration may invoke additional functions; this probe establishes the direct paint path, not every generated adaptive transition.

### Link leave

1. Restore cached CSS for the link subtree.
2. If `mouseDownObjectId` exists, call that object's `SetWidgetMouseDown(true)`.
3. Otherwise, if `mouseOverObjectId` exists, call that object's `SetWidgetHover(true)`.
4. Those parent setters rebuild full current parent state **only if their corresponding hover/down style exists**. `SetWidgetHover` returns immediately with no mouseOver state; `SetWidgetMouseDown` also checks disabled and mouseDown state.

This creates a verified distinction:

- Parent has selected strike but no hover style; link hover clears decoration; leaving yields original link underline, because parent hover setter does nothing.
- Same parent also has a nonempty hover style; leaving invokes full parent hover+selected paint, yielding strike.
- A preexisting global pressed parent plus enabled down style chooses down repaint on link leave. The tested parent hover underline + down strike yields both after that repaint.

### Link mouse-up and down bookkeeping

`SetLinkNotMouseDown` resets the link, invokes the same guarded parent restoration, then recomputes hover and calls link hover if nonempty. This can reapply link hover after parent restoration.

The DOM link binding (**events.js:1284–1314**) first calls parent SetWidgetMouseDown(true), then link down styling; its mousedown handler returns false to jQuery. On link mouseup it calls parent SetWidgetMouseDown(false), then link mouse-up styling. The binding itself does **not** assign global `mouseDownObjectId` or install document mouseup capture. Ordinary parent `.ixStyle` mousedown owns that assignment/capture (around **1390–1430**), but link mousedown prevents bubbling. Therefore the held-leave probe with an existing global pressed ID proves that branch, not that every direct link press establishes a global pressed owner. Full pointer capture outside the link remains a bounded integration question.

Parent action named `SetStyle` is a reconstruction API; no equivalently named original primitive was established by these probes. Its paint invalidation must be identified as a product policy unless routed through a specifically evidenced native paint entry point.

## 3. Click handling, menus, Wait and disabled guards

Hyperlink binding **events.js:1260–1314** invokes `_fireObjectEvent` (**638–648**). That helper does not return its child handler's value; the hyperlink click therefore does not itself stop native DOM bubbling. Matching logical actions are blocked higher up by `originalEvent.handled`, not by relying on DOM stopPropagation.

`_handleEvent` (**281–415**) and `_handleCaseGroup` (**544–595**) establish:

- A matching enabled case marks the click handled, even when its actions array is empty. The parent DOM click still fires, but parent Axure actions are skipped.
- All-disabled cases, no cases or a false condition leave the click available to the parent.
- A Wait schedules and returns; matching has already been established. Even Wait0 prevents parent Axure actions immediately. A separate IF group runs synchronously before the earlier group's delayed continuation.
- Showing a case menu sets handled immediately, before the user picks anything.
- The menu callback dispatches its selected action prefix, closes that menu, then the queued Wait continuation runs later. Closing the menu does not cancel the timer.
- Under Always with conditions, selecting the combined event option evaluates conditions at selection time. Probe changes the condition after opening the menu; no previously assumed case runs.

The menu and Wait probes use original action dispatch, wait handler, menu closures/removal and event handling; condition evaluation and event-copy data are bounded fixture stubs, with a deterministic timer queue. Positioning and full repeater context were not re-probed. Existing [case-selection evidence](case-selection-evidence.md) and [Wait evidence](wait-scheduling-evidence.md) cover their separate contracts.

The hyperlink mouse guard looks at `mouseOverObjectId`'s disabled status. A disabled parent blocks link and parent handlers. A synthetic link object's own `disabled=true` flag is **not** independently checked by this specialized binding. Hidden link rejection occurs in `_handleEvent` visibility guard and leaves the click available to the parent in the isolated probe. This does not authorize a product to invent a user-editable disabled-link field without a defined policy.

## 4. External literal current/new navigation

`action.js:400–449` evaluates a supplied URL (or literal), and for a nonempty URL calls `$ax.navigate` with its link target. It then clears `eventInfo.link` and continues the action array. A current-window call does not synchronously terminate this JavaScript chain before the navigation takes effect.

The actual `$ax.navigate` and `_needsReload`, **doc.js:768–823**, were executed unchanged in a Node VM with inert sinks:

| Request | Observed call |
| --- | --- |
| current, external literal | assigns the same window's location.href to that URL |
| new, external literal | window.open(URL, empty window name), without a third features argument |
| string shorthand | recursively becomes current navigation |
| direct navigate current with empty string | assigns about:blank |
| direct navigate new with empty string | passes the empty string through to window.open |

The last two rows describe direct navigate, **not** linkActionHelper: the latter's `if(url)` skips an empty URL. `_needsReload` special-cases a same local basename; external literals in this scope do not enter that reload-helper path.

Original code does not specify noopener in this call. A product may require validated schemes or add a security policy, but that must not be described as an observed original flag. Browser popup blocking, opener policy, OS/browser launch, shell integration, full player/framed prototype behavior and completed remote navigation are unverified. No URL in this investigation was opened.

## 5. Plain Set Text and link lifetime

Original `SetWidgetRichText`, **expr.js:316–385**, first chooses the parent text panel except when its target is itself a hyperlink. Its behavior depends on DOM structure:

- **Exactly one descendant span and one replacement line**: it calls `.text(value)` on that span and returns from the transform callback. A link wrapper around that sole span remains, with its existing click handler. The probe confirms it still dispatches after replacement.
- Otherwise it replaces the first paragraph with a new span based on the first old span's style/ID, removes extra paragraphs, or creates a paragraph if absent. Existing link wrappers in the replaced content disappear. Multiple runs or multiline replacement take this path.
- A link-targeted Set Text preserves the outer link element and its handler while changing its inner text. The fixture tests the single-span case.
- Rich HTML replacement replaces descendants and caches new text CSS; arbitrary inserted HTML and new handler wiring were not promoted into a safe structured-link contract.

These are exported-runtime text actions, not original editor typing behavior. Native selection expansion, typing at an inline boundary, link splitting/merging, clipboard serialization and authoring keyboard shortcuts remain unverified. The editor can specify consistent structured editing behavior without claiming these probes establish it.

## 6. Generated anchor and keyboard boundary

The focused native generator evidence from the format investigator is `ONiF` (100699551) AxHyperlink branch → `FNiU.oNPx` (100699665) → `BNCJ.WNCk`; nested child runs use `KNiN` (100699555). The retained CIL has obfuscated tag/attribute literal lookups and a configuration/dynamic-link branch that can pass a URL. It does **not** yet prove the exact generated element tag, href, tabindex or keyboard default action. Both native owners are preserved in `rich-hyperlink-format-census.json`; the older mixed-font census contained only one of them.

Runtime **events.js:759–769** can set tabIndex=0 when generated `dObj.tabbable` is true. That conditional alone does not prove a hyperlink's generated tabbable value. The separate specialized hyperlink block has pointer/click handlers; it has no local Enter/Space binding. Consequently, an accessible product anchor or keyboard activation is an explicit product decision until generated markup/flags are fully established.

## Acceptance suggestions

1. Test normal run formatting and mixed runs inside one link without adding a guessed blue/underline default.
2. Exercise parent hover → link hover → parent selected repaint while stationary → link leave/reenter, with and without a nonempty parent hover style; assert leaf styles and outside sibling stability.
3. Exercise down/up and the invalid underline=false/strike=true matrix on the combined parent/link patch.
4. Verify matching, empty, false, disabled cases; Wait0; two independent IF groups; pending menus; each must follow logical handled behavior without accidental parent clicks.
5. Capture current/new host requests in tests and assert literal URL, no duplicate navigation and correct action continuation. Keep test network disabled.
6. Verify the single-span single-line preservation and multi-span/multiline removal branches of plain Set Text, or document a deliberately narrower product policy.

This stage adds research only. It does not validate a full original generated page, production hyperlink implementation, external navigation completion or native editor parity.
