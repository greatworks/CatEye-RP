# Adaptive view transition: state sources, containment and persistence

2026-10-15. Additive, read-only evidence for the adaptive restoration milestone. This work changes only new `research/adaptive-transition-*` files. It does not modify product source, tests, prior reports or manifests. It does not operate the authenticated Axure GUI.

## Confirmed contract

An actual view change restores declared geometry, visibility and action-applied styling while retaining ordinary widget state. These are separate operations with different gates; neither a `shapeText` test nor a universal reset of all runtime overrides expresses the retained implementation.

The new probes pass **47 exact-JavaScript NodeVM cases**, **3 isolated Edge DOM cases**, and a **29-object containment join**. The earlier frozen visibility evidence supplies another 18 original-function cases, including silent adaptive Show/Hide and default visibility inheritance; it was not rerun or changed here.

Identity: Axure RP 11.0.0.4150; distribution SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`; retained DLL SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

All original file paths, whole-file hashes and executed slice hashes are in the probe JSONs. Static managed evidence uses PEReader/ECMA-335 metadata and CIL only; the DLL is not loaded or executed.

## Style source after an action override is removed

`style.js:1794–1847` computes adaptive normal overrides in inheritance order, followed by state patches in this order: Normal, MouseOver, MouseDown, Focused, Selected, Error, Hint, Disabled. `:1849–1866` searches the destination view chain from most specific to least specific for each state. An explicit `stateStyles:{}` blocks inherited state patches; it does not clear the state's flag. A contained object obtains state-style declarations from its containing owner.

`_computeFullStyle`, `:1869–1880`, then combines document defaults, a named base style, object base style, current dynamic-panel diagram style and those computed overrides. Thus clearing an action style does not mean clearing Selected/Error/Disabled/Hint or replacing their paint with an unconditional base style.

`_idToAppliedStyles` is a separate registry. `applyWidgetStyle`, `:875–926`, records action classes and a merged style dictionary and overlays that dictionary on the effective style. `clearAppliedStyles`, `:964–989`, removes the registered classes from owner, background, text and input identities and deletes this registry. It does not empty `_selectedWidgets`, `_errorWidgets`, `_disabledWidgets` or `_hintWidgets`.

The replay executes the actual state generator, combiners, full style computation, class updates, adaptive switch and action-style clearing. For each of Selected/Error/Hint/Disabled, entering a named view keeps the flag and produces that destination view's state patch at the final SVG paint sink. The combined-state case confirms per-property accumulation and Disabled's final priority. `reselectElements` alone is not sufficient evidence: `:2328–2346` only explicitly visits selected and disabled dictionaries. Named view application subsequently computes all active states.

### Opacity

The early reset clears inline owner opacity and, subject to the child gate below, immediate child opacity. It does not set opacity to `1`. The eventual value comes from the remaining base/adaptive/state stylesheet rules and any relevant child rules. `_applyOpacityFromStyle` at `style.js:1918–1922` immediately returns; it is not a universal opacity reapplication step. The probes confirm the retained style value supplied to the final style source and removal of inline `.25`, not an entire generated stylesheet's final composite alpha.

### A real Base-return ordering quirk

Do not equate registry clearing with an immediate repaint of every surface. On a named→Base switch, `clearAdaptiveStyles` runs at `adaptive.js:96`, before `clearAppliedStyles` at `:138`. `clearAdaptiveStyles` invokes `_applyImageAndTextJson`; its SVG style at `style.js:1654–1656` can still include the action registry. No later general SVG repaint is issued by that Base branch for the simple fixture with no image alternative.

The original-function replay therefore observes:

- last recorded SVG paint argument: old `action-red`;
- action registry after the switch: empty;
- a fresh full-style query: correct `base-selected`.

Named→named has a later `setAdaptiveStyle` after clearing, so its final paint argument is correct. This is a **call-order/paint-input observation with a terminal SVG sink**, not an original generated-page pixel claim. A product that immediately paints the destination Base consistently can document that difference. It should not falsely claim that this stale argument proves every original SVG or CSS box remains stale.

## Plain SetText and original run formatting

The isolated real Edge cases execute retained jQuery 3.7.1, `expr.js::SetWidgetRichText`, the text cache/reset/apply functions and `_switchView`. Widget data and the action-effect stylesheet are controlled fixtures; SVG, AutoFit, panel and repeater endpoints are sinks. There are no network requests or page errors. Edge version is recorded in `adaptive-transition-text-probe.json`.

Both a sole span and a mixed two-run paragraph follow this verified sequence:

| Stage | Text | Computed first run |
| --- | --- | --- |
| Initial | Original text | 20px, `#123456` |
| action style fixture | Original text | 28px, red |
| plain SetText | Runtime content | 28px, red |
| named adaptive view | Runtime content | 18px, `#112233` |
| return to Base | Runtime content | 20px, `#123456` |

`expr.js:340–350` reuses the sole span or copies the first span's **inline style and ID**. Plain mode does not call `CacheOriginalText(id,true)` (`:381` only does so for nonplain mode). `style.js:2592–2611` stores inline `element.style.cssText`, not a snapshot of all computed action CSS. `_resetTextJson`, `:2028–2042`, restores those styles by ID and leaves text content intact. This supports retaining new plain text while restoring original first-run formatting; it is distinct from the SVG paint-input quirk.

The third case confirms the different nonplain contract: rich replacement refreshes the text cache, marks `_shapesWithSetRichText`, and then normal adaptive font overrides are excluded (`style.js:1801–1811`). A replacement 32px run stays 32px through the view and back. State font overrides are a separate later composition step.

The action-effect CSS in this small DOM fixture is explicit, including its specificity. It demonstrates computed-versus-inline cache provenance, not the complete unknown original generated stylesheet for every SetStyle action.

## Geometry and visibility have different exclusions

`adaptive.js:70–92` has no shape-text or widget-type whitelist. It skips `diagramObject.isContained`, repeater descendants, or a missing owner DOM element. Otherwise it clears owner `top/left/width/height/opacity` and transform properties. It clears **immediate DOM children** too unless the owner is a fixed-size dynamic panel. Fit-to-content panels run `setFitToContentCss` and clear their children. Fixed-panel owners still reset; their separately enumerated ordinary descendants still reset on their own pass.

| Current-model counterpart | Owner geometry reset | Adaptive declared visibility reset |
| --- | --- | --- |
| Ordinary shape, line, image, input, textarea, select, checkbox, radio, iframe | yes when non-contained, outside a row, and DOM exists | yes |
| Panel root | yes; direct state DOM children only when fit-to-content | yes |
| Ordinary widget inside panel | yes on its own enumeration | yes |
| Repeater root | yes | yes, followed by refresh |
| Repeater row descendant | excluded from early geometry pass; rebuilt later | `_applyView` does not pass the optional repeater exclusion; declarations can apply before refresh |
| Table cell | yes when native `isContained=false` | explicitly excluded |
| Table inside menu | yes when native `isContained=false` | explicitly excluded by parent `ax_menu` class |
| Submenu wrapper | no universal geometry exclusion established | explicitly excluded by `sub_menu` class |
| Tree root/node | yes when non-contained | yes |
| Contained tree label | skipped on its own pass | skipped on its own pass |

The visibility exclusions are `visibility.js:1291–1296`. The earlier visibility probe executes those conditions and the setter path; adaptive restoration omits `fire`, so direct Show/Hide events do not fire. An omitted destination `visible` inherits declarations, not an action-written visibility override.

**Contained does not mean geometrically immune.** An excluded contained object can still be an immediate DOM child of a non-contained owner; the owner's `children().css(resetCss)` clears it indirectly. Four new exact-loop cases confirm this conditional behavior for a regular/tree-like parent and a fixed/fit panel parent. The current model's tree label is a direct renderer child; exact original generated DOM nesting for every contained subtype was not recreated here. Do not infer all descendants are contained merely because they have a model parent.

### Stored containment witnesses

The read-only retained-census join preserves source/package/object hashes and IDs. In Default.rplib:

- 3 Tables, 15 TableCells, 2 Menus and all 5 TreeNodeObjects store `IsContained=false`.
- All 4 separate tree VectorShape labels store `IsContained=true`.

`KJm7.IsContained` metadata binds getter `XJdz`, token 100695494; its CIL reads field `PJZO`. The JSON dispatcher `wJe6.jJeK`, token 100694305, tests this getter at IL00BF and writes a true boolean at IL00E5–00E7 only on the contained branch. The emitted key literal is obfuscated; stored field plus runtime `isContained` behavior and prior contained-label evidence jointly support the mapping, without pretending the literal was decrypted. This corpus is a bounded containment witness, not a census of every possible original widget.

## Adaptive repeater refresh is persist, not reset

`repeater.js:472–479` skips repeaters in limbo, calls `_initPageInfo`, then invokes `_refreshRepeater(..., persist=2)`. `:74–84` clears the four state dictionaries only for `reset=1`. `style.js:2348–2356` identifies those dictionaries exactly.

Persist still rebuilds row DOM: `repeater.js:229` removes old items; `:241–271` reconstructs the same currently ordered item IDs; Item Loaded runs again at `:341–355`; `:371` reapplies state classes. `events.js:807–835` avoids reapplying declared selected/error/disabled values for an existing row in persist mode and removes the template's selected class so backing dictionary state remains authoritative.

`removeItems`, `repeater.js:1070–1078`, removes DOM, limbo/hidden IDs, geometry caches, AutoFit registrations and item registration. It does **not** clear dataset, query/sort/filter or marked-row storage. `_initPageInfo`, `:485–496`, does reset pagination from the target adaptive declaration. Nested repeater addressing/data scopes in the independent product are not established by this bounded single-item-suffix source replay; recursive persistence is a model extension that should have its own acceptance tests.

Do not retain all row temporary state under the label “persist”: ordinary row text/DOM geometry/action classes are rebuilt and Item Loaded may change the preserved state flags again. The exact final native checkbox checked property and disabled input DOM property after this rebuild were not browser-probed; backing style dictionaries and native form properties are distinct.

### Hint is a separate two-state quirk

The dictionary is not cleared for persist, but `events.js:923–932` registers the new input's placeholder and asks for `!input.value`. `flyout.js:217–218` starts the placeholder manager at `active:false`; `:232` returns if its requested active value is unchanged.

Four executed cases distinguish the manager and `_hintWidgets`:

| New template text | Prior hint style flag | New manager active | New hint style flag |
| --- | --- | --- | --- |
| empty | false or true | true | true |
| nonempty | false | false | false |
| nonempty | true | false | **true remains stale** |

Thus neither “keep the previous displayed hint” nor “clear all old hint flags and recompute” describes every retained branch. The common empty-template path reactivates the hint. The nonempty-template stale style flag is an explicit known quirk, not a recommendation to conflate logical text and displayed hint.

## Tree expansion and other state

Before geometry reset, `adaptive.js:59–66` calls `query.expanded(obj.isExpanded)` for a TreeNodeObject with its own `isExpanded` property. Four original-loop cases confirm true, false, missing property and non-tree exclusion. This step is absent for a same-view request. The ordinary panel active-state map is not reset by this tree rule; do not reset panel state merely because tree expansion resets.

## Limbo's source and remaining generation boundary

Runtime initialization (`visibility.js:1433–1444`) derives default hidden IDs from `ax_default_hidden`, and default limbo IDs from a **different** class, `ax_default_unplaced`. Target view application (`adaptive.js:299–316`) adds limbo only from effective `compoundStyle.limbo` on a non-contained object. Limbo then blocks an ordinary Show request. These class/default/runtime steps are exact replayed behavior, not inferred from names.

The new metadata proves two distinct source properties: `PName.VISIBLE=110` and `PName.PLACED=111`. `ituB.Ytu4` (100717281) accesses property111. The JSON style writer `rJeU` (100694323) branches on111 at IL005E–0060, reads the boolean at IL01B3–01B9 and negates it (`ceq 0`) before boolean output at IL01C2. This is strong static evidence for the placement-to-limbo relationship, but the emitted key literal remains obfuscated. `KJm7.Placed` and `UnplacedOverride` are independently identified; the latter is not ordinary `Visible`.

The full generator path from every source adaptive placement map to the default HTML unplaced class has not been closed here. Current product data has no separate placement/limbo field. It must not invent limbo from `hidden:true`, or silently import a source PLACED override as ordinary visibility. That is a model/storage boundary, separate from implementing currently expressible view transitions.

## Suggested focused acceptance

1. All supported ordinary non-contained types: action Move/Resize/Rotate/Opacity/SetStyle → real different view restores declaration; same-view resize preserves action effects.
2. Keep text/global variables and ordinary selected/error/disabled states; restore target state styling and verify explicit empty state overrides separately.
3. Use the verified plain text sequence above, including a mixed first run and named→Base. Do not apply nonplain rich-cache rules to plain SetText.
4. TableCell/menu-table/submenu declared visibility exclusions remain separate from geometry clearing. Test a contained direct child and its parent together.
5. Adaptive repeater persistence keeps state dictionaries/data identity/query/marks, resets pageInfo, rebuilds temporary row text/geometry and reruns Item Loaded; ordinary data refresh remains reset mode.
6. Restore declared tree expansion only on a real view change. Preserve panel state unless another proven path changes it.

These are original function and static-source findings. Complete generated stylesheet precedence, all native form DOM properties after persist, arbitrary contained DOM nesting, nested repeater source addressing and default limbo HTML generation remain explicitly bounded. No final original application pixel comparison is claimed.
