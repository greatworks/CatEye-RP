# Adaptive state-style lookup and repaint in retained RP 11

2026-10-15. **237 exact-source NodeVM cases and 8 isolated Edge DOM cases pass.** This stage executes retained JavaScript functions, not the Axure GUI or a complete generated prototype. It changes no historical evidence, product, tests, or artifacts while establishing this report. A later independent model implementation is a separate deliverable.

The fixed distribution is Axure RP **11.0.0.4150**, SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`; extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. Exact file paths, whole-file hashes, executed line ranges and slice hashes are recorded in [adaptive-behavior-state-probe.json](adaptive-behavior-state-probe.json) and [adaptive-behavior-state-dom-probe.json](adaptive-behavior-state-dom-probe.json). The evidence manifest is [adaptive-behavior-state-evidence.json](adaptive-behavior-state-evidence.json).

| Retained source | SHA-256 |
| --- | --- |
| `style.js` | `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c` |
| `adaptive.js` | `e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928` |
| `events.js` | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| `jquery-3.7.1.min.js` | `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85` |

## Effective state lookup uses a whole-map boundary

`style.js:1849–1866`, `_computeStateStyleForViewChain`, first climbs `isContained` parents to the outer style owner. It searches that owner's adaptive styles **leaf to ancestor**. The first truthy requested state entry is returned, after its named `baseStyle` is merged. Otherwise the first truthy `stateStyles` map terminates the search with an empty patch. Only when no such map intervenes does lookup reach the owner's Base `style.stateStyles`.

The 64-case matrix uses each of `normal`, `mouseOver`, `mouseDown`, `focused`, `selected`, `error`, `hint`, `disabled` against these leaf records. All have a nonempty parent state and Base state available:

| Leaf input | Effective requested state |
| --- | --- |
| No leaf style | Parent state |
| Leaf style `{}` | Parent state |
| `stateStyles:null` | Parent state |
| `stateStyles:{}` | Empty patch; every older state is blocked |
| `stateStyles:{selected:null}` | Empty selected patch; other missing states are also blocked |
| `stateStyles:{selected:{}}` | Empty selected patch; other missing states are also blocked |
| `stateStyles:{selected:{fontSize:…}}` | Only this state entry; no older selected properties fill its gaps |
| A map containing only a different state | Empty requested-state patch |

Null records here are synthetic inputs used to establish JavaScript boundaries. Native editor authorability/serialization of null is not established. A validated independent schema can disallow null, normalize a null whole-map carrier to absent at an explicitly evidenced import boundary, and use a present empty object as the supported reset operation.

Normal adaptive declarations are a separate path (`:1794–1819`): they still merge ancestor to leaf, even when a leaf empty state map blocks every effect. Thus parent normal font18 plus parent selected font26 plus leaf `stateStyles:{}` produces normal font18, not either selected26 or necessarily the authored inline-run font.

`_getFullStateStyle` (`:1906–1915`) merges a **state entry's own** named `baseStyle` before its explicit properties. By contrast, a normal adaptive style referencing a named style whose record happens to contain `stateStyles` does not make that named map participate in `_computeStateStyleForViewChain`; the lookup reads the actual adaptive carrier. The function accepts a synthetic `stateStyles.normal`, but this report does **not** establish an editor/generator path that writes it. Seven exposed effect keys, with normal declarations kept separately, are the evidenced implementation boundary.

## State existence is a different query

`_widgetHasState`, `style.js:75–95`, checks an image override first, then scans the **current** view chain ancestor to leaf, then Base. It does not scan sibling views or all page views. A master-owned object obtains its chain via the parent RDO's effective `viewOverride` (`:1777–1791`); the probe executes that dispatch with master-chain retrieval as a controlled sink.

Existence does not honor the effective-map barrier. An ancestor focused entry can make `hasState(focused)` true even when a leaf empty map makes the effective focused patch empty. Empty adaptive state entries `{}` count as present because the check is truthiness; empty Base entries do not, because Base uses `!$.isEmptyObject`. An image override can independently make existence true with no effective style patch.

Containment is also different: effective state lookup climbs the containing owner; `_widgetHasState` does not climb it. Normal adaptive overrides continue to come from the contained child's own record. The two-level contained probes demonstrate this distinction; they do not invent a new mapping from every product container type to native `isContained`.

For an independent model, a presence helper must therefore accept the current page/view chain and original Base effects. Deriving it from `Object.keys(effectiveFocusedStyle).length`, or from the final map alone, loses observable information.

## Composition and physical state priority

The original `_computeAllOverrides` applies each property in this order (`:1822–1843`):

`normal → mouseOver → mouseDown → focused → selected → error → hint → disabled`.

Each requested effect first resolves independently through the same nearest-map rule. This is a shallow property overlay, not a deep merge. A later fill object, shadow object, or size object replaces its predecessor as a whole. Zero, false and explicit reset objects survive the raw merge. The terminal renderer may then impose its own truthiness or validity rules.

The physical-state string generator (`:137–166`) retains selected/error/hint, then:

- Disabled returns immediately and suppresses focus/hover/down.
- A focused class returns immediately and suppresses hover/down.
- Otherwise mouseDown and mouseOver can coexist.
- MouseOver from the current mouse-over list requires `_widgetHasState(mouseOver)`; mouseDown identity itself does not use that existence gate in the generator.

All 128 combinations of the seven physical flags were executed through the **original generator and original predicate tables**, then original composition. This exposed a retained-source quirk: `MOUSE_OVER_MOUSE_DOWN_HINT` is declared as `MouseOverMouseDownHint` (capital M), while the generator produces `mouseOverMouseDownHint`. For that sole hover+down+hint combination without additional flags, all state predicates reject the generated string and effect composition falls back to normal. Using the declared capitalized constant directly instead applies the expected hint winner. This is recorded, not silently corrected or generalized to other combinations.

Another bounded lifecycle quirk: after a focused object switches to an unrelated view chain with no focus capability, the focused class can remain and continue to suppress hover/down. `_generateFullState` reads the class without rechecking existence. Calling `SetWidgetFocused(false)` then returns at its existence guard (`:176–184`) without clearing the class. The original registered blur callback, `events.js:778–784`, was executed in the VM and calls that setter without an additional class cleanup. This proves the retained function chain; a complete generated-page focus/blur GUI sequence remains unobserved. The reconstruction may document these two quirks as unsupported rather than claim exact handling.

## Rich text, explicit resets and actual DOM checks

Eight isolated Edge **155.0.4283.45** cases loaded retained jQuery and exact original style/cache/application slices into a synthetic DOM containing two differently formatted runs plus an anchor with a nested run. Network interception rejected all outbound requests; the observed network and page-error lists were empty.

Observed computed CSS:

- With no leaf state map, ancestor selected font26/red applies to both ordinary runs and the nested link run. The anchor element's own blue style remains unchanged.
- Replacing the leaf map with `{}` restores the original run sizes20/30/24 and their original colors while the selected class remains.
- A leaf selected patch containing only color does not inherit the ancestor selected font26: original run sizes20/30/24 survive.
- An ordinary ancestor normal font18 still applies to all runs behind an empty state map.
- The original false-underline + true-strikethrough conversion produces invalid `noneline-through`; real Edge rejects that assignment, leaving each restored original run decoration. An explicit underline=false alone emits valid `none` and clears each run's own decoration; the anchor's own underline is not cleared by the per-run updater.

The application path first restores `_originalTextCache` (`style.js:2028–2042`), then applies override CSS to descendants. `_applyCssProps` (`:2444–2457`) assigns paragraph properties to `p`, skips `a` itself, and applies run properties to other descendants, including spans inside links. This is not proof of link event/navigation behavior or final glyph rendering.

For shapes marked `_shapesWithSetRichText`, direct normal adaptive declarations remove the exact `FONT_PROPS` set before merging (`:1763–1775`, `:1800–1818`). The set includes font/name/weight/style/stretch/size, underline/strike, foreground fill, horizontal alignment and letter case. It does **not** remove lineSpacing, characterSpacing or textShadow. Active-state font patches are still applied. A named normal `baseStyle` merges after direct font-property deletion and can reintroduce a font; both VM and real DOM probes verify this order. The DOM harness sets the marker explicitly to isolate lookup; original rich setter/cache construction remains covered by the frozen [adaptive-transition-text-probe.json](adaptive-transition-text-probe.json), not re-executed here.

Terminal text conversion has its own boundaries (`:2465–2501`): fontWeight/fontStyle inspect `!==undefined`, whereas fontSize, lineSpacing and characterSpacing are truthy-gated. Consequently a raw zero can survive style composition but not generate a CSS assignment. Text-shadow `{on:false}` generates `none`. These are exact conversion results, not justification to change the model's unrelated numeric constraints.

## View changes and last-paint boundaries

The probes execute `_switchView`, `_applyView`, `_applyAdaptiveViewOnObject`, state resolution, and the original style/cache dispatch. DOM geometry/visibility/repeater endpoints and SVG drawing are explicitly recording sinks.

`adaptive.js:48–159` sets the new current view before clearing/repainting prior adaptive styles. A named destination clears action-style registry and applies the new ancestor chain. Each of the seven active-state cases reaches the destination state's final style without clearing its physical flag. A destination empty map suppresses effects without clearing selected/error/hint. Same-view switching performs no reset or repaint and retains action style.

The contained path in `_applyAdaptiveViewOnObject` (`:297–306`) skips `setAdaptiveStyle` for a contained object even though pure contained state lookup resolves its owner. Actual rendering of that object may be driven through its native containing object; this report does not assert that the child's paint is independently scheduled.

Named→Base retains the previously documented timing distinction: `clearAdaptiveStyles` can send an old applied action-style overlay to the SVG sink before `clearAppliedStyles` runs. The separately computed text override already reflects Base. The new probe records fresh Base font20, text input font20 and the earlier SVG input action font44, followed by an empty applied-style registry. This is a **style-input/last-paint** quirk, not a universal claim that every Base widget or all SVG pixels retain action style. See the frozen [adaptive-transition-evidence.md](adaptive-transition-evidence.md) for the broader geometry/persist2 bounds.

## Implementable contract and deliberate limits

The original lookup supports a per-view optional whole state-map carrier, with seven supported effect keys and partial style objects. Absence inherits; presence replaces the whole inherited map; `{}` explicitly suppresses all Base/ancestor effects. Preserve empty state entries for the adaptive existence distinction. Resolve normal declarations separately and overlay active effects per property in the order above. Carry state existence independently from effective style.

Editing an effect by creating a complete snapshot of the currently effective map is a reasonable **independent editor design** that avoids accidentally dropping sibling effects. This report proves the runtime's whole-map consumption, **not** that the native editor uses this snapshot algorithm. Likewise rejecting null input, exposing only seven keys, and keeping existing legacy flat Base effect fields are independent schema decisions. Do not describe these authoring choices as CIL/GUI observations.

Useful acceptance cases are: ancestor selected/color + leaf empty map; partial child effect does not fill from ancestor effect; focused presence remains true behind a map barrier; non-ancestor effects do not enable the gate; inherited normal fonts still apply; rich-set direct fonts remain suppressed while state fonts apply; explicit resets remain atomic; same-view switching preserves temporary action styles; a true transition uses destination states without clearing selected/error/disabled/hint flags.

Unresolved/native scope boundaries: generator authorability of `stateStyles.normal` and null entries; native editor map materialization on each author operation; complete master/RDO containment mapping; original adaptive data with positive named-view state maps in the retained samples; actual generated-page pixels/cascade; native GUI interaction; and integration of the two source quirks into the reconstruction. Neither this report nor its probes executes a proprietary DLL.
