# Affect All Views: authoring write and clearing contract

This is a bounded static investigation of retained Axure RP 11.0.0.4150 managed code. No original GUI, target DLL execution, browser suite, product source, historical evidence or imported artifact was changed. The 14 executable cases replay decoded CIL instructions with explicit external sinks; they are **not native application observations**. Seventeen property-carrier assertions supplement those cases. The JSON manifest binds the original assembly, decoder, retained CIL, replay and this report by SHA-256.

## Main result

For the ordinary style-edit path, Affect All Views writes changed native properties to the Base provider and removes their local overrides from **every saved adaptive style**, including inactive/sibling/ancestor declarations. It does not clear the whole widget declaration. Changes are selected by comparison with the **current effective provider**, not with Base. A requested ordinary property equal to its current determined value contributes no edit and does not clear other views merely because the All Views checkbox is enabled.

The [official Adaptive Views documentation](https://docs.axure.com/axure-rp/reference/adaptive-views/) describes All Views editing, child overrides resisting parent edits, and globally shared text/content/interactions. It is consistent with this implementation path, but does not specify native property atomics or every special command. The following details come from the pinned assembly, not interpretation of those UI instructions. Documentation accessed 2026-10-15.

## Write chain and exact gates

All tokens are build-local decimal; offsets below are hexadecimal.

1. `XcY.bDR` **100665346**, retained in `adaptive-placement-authoring-controller-cil.json`, materializes the selected owner sequence and processes each owner separately (IL6E–11B). It invokes `owner.GetEdit(requestedStyle, baseStyleArgument)` at IL84–88, skips owners with no returned edits (IL8F–96), records an edit transaction, and invokes `kIs0` at ILE6–EC. It separately records affected Table state. This is evidence for per-owner equality filtering, not proof that every GUI selection command has identical recursion.
2. `KJm7.GetEdit` **100695569** with `baseStyle=false` calls `WtTU.GetEdit` against `vJOH`, the current effective provider (IL07–19). `baseStyle=true` instead uses the named-style identity path `OJp3/cJpI`; that Boolean is **not** a force-same-value option.
3. `WtTU.GetEdit` **100717186/187** processes requested properties and dispatches each property's virtual `GetEdit`. Ordinary `e5jG.GetEdit` **100718006** requires requested Overridden, rejects requested Indeterminate, compares `ValueAsObject` using `Object.Equals`, and yields no edit for equal values when the current property is determined. If current is Indeterminate, the same value can still produce an edit. Capability rejection yields no edit. Specialized property classes, notably state styles, can override this routine.
4. `KJm7.sJp1`/`SetStyleInternal` **100695567** immediately returns for an empty edit list (IL07–12). Contained objects delegate to their containing owner (IL13–2B). At IL92–116 the All Views path filters the supplied edit list by Overridden, projects `PropInfo.Name`, calls `WJpV`, then supplies the list to the Base provider `bJOJ`. The ordinary adaptive path supplies it to `vJOH` (IL117–12A). Separate AllowAdaptive/Placed checks exist; this report does not generalize the ordinary branch over special nonadaptive owners.
5. `WJpV` **100695539** delegates containment, then—outside a temporary provider override—enumerates `fJZ4.get_Values` and calls `WtTU.HtTs(keys)` on each local adaptive style (IL36–60). There is no view-ID, ancestor-chain or active-set filter in that loop. `HtTs` **100717156** calls `ntTA` **100717162** for each supplied key; the latter either clears the Overridden flag in a fixed property table or removes the dictionary key through `ptTQ` **100717161**. Therefore “clear” is semantic loss of that local override, not necessarily physical deletion in every internal table representation.

The `tbKf` guard is not an empty-map test: `obKD<T>.tbKf` **100688742** reads the temporary override flag; `Override` **100688747** sets it and pushes override context. Geometry and clearing paths deliberately branch around such temporary provider contexts. Ordinary authoring examples below assume that flag is false.

The ordinary provider construction also supports the current-effective distinction: `jJOK` **100695528** gets `GJOW`/CurrentAdaptiveView **100695519**, passes it through `lJ0A` **100695529** and `PIs7` **100695530**, and combines that view's `AxStyles` chain with MyStyle. `<AxStyles>d__482.MoveNext` **100695797** retrieves the local style for the supplied view and advances to its parent, stopping at the default view. These methods do not read EditAllAdaptive. Base-only `bJOJ` is a separate provider constructor. This does not establish every UI toggle notification or temporary-provider override lifecycle.

## Position and size are complete values

`ituB.Vtl3` **100717328** boxes a complete Point and writes **P101**. `ItlR` **100717330** boxes a complete Size and writes **P105**. There are no separate X/Y or width/height keys in this path.

* `KJm7.Move` **100695617** accepts an **offset**, adds it to `get_Location`, and passes the resulting absolute point to `xJ0B` (IL07–19). This does not add the same delta independently to every view's saved coordinate.
* `xJ0B` **100695349** compares the requested complete Point against `GJqn` before modifying anything (IL07–13). On actual change, All Views selects `pJ0V` **100695350** → `pJ0w` **100695505**, with key101 and the complete Point. `pJ0w` calls `IJpB` **100695538** → `WJpV`, then writes that absolute value through Base `bJOJ`. The current-view path writes the current provider instead.
* `uJ0j` **100695365** first applies the existing scale/size-constraint functions; it then compares the complete normalized Size with `uJqf` (IL76–91). Equality returns without writing. Actual change proceeds through `fJ0b` **100695366** with **P105**, using the same all-view clear/Base-write mechanism. `YJ0S` **100695371** applies a complete rectangle by calling size then location setters.

Thus, for an ordinary changed X request, All Views writes `(newX, currentEffectiveY)` to Base and clears both coordinates' native **P101** carrier everywhere. Width-only edits similarly write `(newWidth, currentEffectiveHeight)` and clear **P105**. The proven setters do not retain each view's other axis separately. The exact GUI numeric-field-to-setter dispatch, rotation-origin corrections, sizing constraints, fractional rounding and container-specific reflow are not fully replayed. In particular, `Move` reads the rounded public Location while `xJ0B` compares its internal geometry; do not infer that every fractional zero-offset move is a no-op.

## Native atomic units versus reconstruction fields

The setter bodies, not just enum names, establish these carriers:

| Native properties | Actual unit | All Views clearing consequence |
| --- | --- | --- |
| P101 Location; P105 Size | Point; Size | Whole point or whole size |
| P7 Fill; P8 BorderFill | One Fill object each | Solid/gradient are alternatives within the same object |
| P71 CornerRadius | One Double | Independent of P81 |
| P81 CornerVisibility | One Position bitmask | Whole visibility mask, not four independent radii |
| P15 BorderWidth | One Double | Independent of P80 |
| P80 BorderVisibility | One Position bitmask | Whole side mask |
| P11/P12/P13/P14 | Separate Left/Top/Right/Bottom padding Doubles | Only changed side properties clear |
| P17 LineEnds | One start/end pair | Both endpoints form one property |
| P72/P73/P74 | Separate complete outer/inner/text Shadow objects | Each shadow's internal fields remain one unit |
| P21 IxStyles | One StateStyles object | If a committed edit carries21, clearing removes the whole local state map |

Padding is particularly important: an ordinary request containing four numeric padding properties still passes through per-property `GetEdit`. If three equal their current effective determined values, only the changed side survives into `sJp1`; it is incorrect to clear all four merely because the reconstruction currently stores padding as one tuple.

The reconstruction's arbitrary `cornerRadii[4]` and `borderWidths[4]` are not native four-value properties established by this ordinary `ituB` style path. Native uniform radius plus corner-visibility, explicit VectorShape control points, and TableCell side borders are distinct mechanisms. This research does not justify clearing all corner/width tuple components when one component changes. An implementation must preserve subproperty provenance or clearly separate a product extension from the proved native contract. It also must not merge P71 with P81, P15 with P80, or P7/P8 with width/style/visibility keys without a command-specific reason.

P21 is special: the adjacent effects investigation traces dedicated `c5b1.GetEdit`, sentinel states and first-add versus existing-state commit routes. This report only proves the whole-key clear **when P21 reaches `sJp1`**; it does not infer that all effect commands necessarily take that route. See the new `adaptive-all-views-effects-*` evidence once finalized.

## Verification and remaining boundaries

`adaptive-all-views-static-probe.mjs` replays actual decoded instruction arrays for eight ordinary GetEdit cases and six location/size setter cases. Opaque arithmetic uses the retained assembly initializer's constant fields; no branch is guessed from a method name. Provider writes, invalidation, point/size value comparison, capabilities, and size/scale normalization are explicit harness sinks. Geometry examples use ordinary noncontained owners, scale1 and unconstrained valid sizes. The clear-all-map sink's scope is separately justified by the retained `WJpV` loop; the harness does not pretend to run a full document/editor.

The results prove current-value equality, requested/current Indeterminate distinctions, capability rejection, unchanged geometry no-op, complete point/size writes and selection of Base/current provider. Seventeen independent setter-carrier assertions verify the table above. Multiselection's common transaction loop is inspected statically. Parent-child selections, contained-object delegated styles versus local contained geometry, masters, selection-boundary pruning, dedicated TableCell side-border commands, named-style application, text selection/rich runs, and every numeric editor dispatch remain outside these replay cases. Globally shared content is documented separately and must not be moved into adaptive style declarations.

Suggested acceptance: a child view with different Base/parent/sibling/inactive values, change X or W and verify the complete native pair clears; change only one padding side and retain other-side local provenance; preserve every unrelated normal/state field; equal current effective edits leave declarations untouched; per-owner multiselection only edits owners whose effective value changes; explicitly test the dedicated P21 routes rather than relying on the ordinary scalar diff.
