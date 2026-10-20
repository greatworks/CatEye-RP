# Affect All Views: interaction-state maps and shared content

Target: Axure RP 11.0.0.4150, retained `AxureRP11.dll`, SHA-256
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
Only static ECMA-335 metadata/CIL and bounded interpretation of saved instruction
records were used. The original assembly, application and GUI were not executed.
No product/parser/old evidence file was changed. IL offsets below are decimal.

## Result and the important first-add exception

**When the generic author edit contains property P21 (`IX_STYLES`), Affect All
Views removes the entire local P21 from every adaptive style.** It does not remove
only a state's color or only one state. However, it is incorrect to infer that
every effect-authoring operation reaches that generic path.

`xrgg.YrgK` (100677647) has two materially different branches:

1. If the effective state map has a non-null state, it prepares a requested map,
   obtains the P21-specific edit and calls the widget's `kIs0` commit. Unedited
   states are retained; the changed state is a whole style object. This is the
   branch to which generic Affect All Views clearing applies.
2. If all effective state values are null, it directly assigns a one-state map
   through the **current provider**. That branch does not invoke `kIs0`, `sJp1`,
   `WJpV`, or read EditAllAdaptive. The inspected ordinary provider factory uses
   the active view chain, not the Base-only provider. On this branch a sibling
   view's local P21 is untouched even if the EditAllAdaptive flag is true.

The second statement is a bounded static result for the normal current-provider
context, not an original-GUI reproduction of every dialog. Temporary effect
preview/override chains and unrelated editing entry points are not generalized.
An independent editor that deliberately applies uniform all-view behavior to
first-add as well should identify that as its own policy, not this native branch.

## Property and state granularity

| Link | Retained proof |
|---|---|
| P21 carrier | `ituB.Jtsu` 100717315 obtains property21 and casts to `Prop<FtXa>`; previous selected-style evidence. `FtXa` maps state names to style records. |
| Generic all-view clear | `KJm7.sJp1` 100695567 takes the actual overridden edit keys, invokes `WJpV`100695539 and writes Base. `WJpV` IL54–96 enumerates local adaptive styles and removes the supplied property keys. This proof is shared with the independent ordinary-style investigation. |
| Single-state preparation | `YrgK`100677647 IL224–277 builds `ituB` plus `FtXa`, sets the requested state, and calls `bVk8.UVcB`100673791. `UVcB` fills missing standard entries with `ttf7.Htfh`'s sentinel. IL282–293 obtains `GetEdit` against `widget.vJOH`; IL164–168 commits a nonempty result via `kIs0(edit,false)`. |
| Seven-state edit | `c5b1.GetEdit`100718048 IL133–225 calls `M5bg`100718050 for codes **1,2,8,64,32,4,16**. It constructs one resulting `FtXa`, not seven top-level properties. |
| Retain unedited state | `M5bg` IL675–682 recognizes the requested sentinel; IL392–401 assigns the corresponding current state to the result and returns false (no change caused by that state). |
| Replace changed state | `M5bg` IL163–178 compares overridden property lists for ordinary nonempty records. Unequal lists assign the whole requested state at IL426–435. There is no per-property merge inside that replacement branch. Equal lists retain the current state object at IL496–505 and return false. |
| Delete state | A null requested state against a present current state writes null and reports change. A sentinel is therefore **not** synonymous with null, absent JSON, or an empty state object. |
| Capability gate | `M5bg` first checks `tHej.SHeJ(capabilities,state)` at IL530–538; unsupported states do not enter its state-copy branches. |

The sentinel is not guessed from a string name: `Htfh`100717041 returns its
static style object; `ttfX`100717042 compares its style Guid to `FtTC`.
`ttf7`'s initializer100717082 creates `VtTi` using that same Guid at IL1483–1544.
`stfl`100717047 is the null predicate, while `Ctfs`100717046 is null-or-empty.

The previously retained `bVk8.CVko`100673788 DeleteInfoNodes path similarly builds
a map with selected states null and unselected states sentinel, obtains GetEdit
and commits. AddStyleState `KVku`100673777 calls `YrgK` at IL598. The retained
paste path `eVcG`100673790 also calls it at IL1338. These establish concrete
author paths; they do not prove how every individual color/font editor prepares
the replacement state's internal property list.

## First effect: current-provider write and notification

`KJm7.lJOC`100695549 reads `vJOH.m5Vr`; `FtXa.ftXp`100715990 returns whether
all state values are null. `YrgK` IL128–139 takes the direct branch in that case:
IL33–46 calls `vJOH`, `FtXa.StXm(state,value)`100715983, then `jtoq.N5VF`100717821.
`N5VF` writes key21 through `QtAY<T>.ltAo`100717638 (IL33–37).

The exact downstream distinctions are:

- `ltAo` writes `WtTU.YtTy(21,value,false)` into `htoW`, then updates cached
  property state through `Otoj` and reports key21 through `ltAQ`.
- `htoW`100717626 is `this[ztoE()]`; `ztoE`100717624 returns `htoa`.
  Ordinary constructors100717617/618 leave `htoa` at its CLR default0.
  `Ttok`100717625 can explicitly change the index; that is why temporary chains
  are not silently treated as the ordinary path.
- Normal provider construction is `jJOK`100695528 → `GJOW`100695519
  (current view) → `lJ0A`100695529 → `PIs7`100695530. The non-contained branch
  concatenates `IJ0o(view)` and the default/MyStyle chain. Its
  `<AxStyles>d__482.MoveNext`100695797 emits the current view's AdaptiveStyle,
  then its parent views, stopping at Base. These methods contain no
  EditAllAdaptive selection of a different chain.
  `AdaptiveStyle(Guid)`100695533 creates a missing current-view style in
  `fJZ4[currentGuid]` at IL46–104 before returning it. A missing local Style is
  therefore not a reason to skip the current slot and write an ancestor. An
  explicit state entry `{}` is non-null and does not take the first-add branch.
- `SJO1`100695511 subscribes `dJpF`100695541 to provider changes at IL89–112.
  `ltAQ`100717636 → `XtAy`100717634 invokes that notification.
  `dJpF` invalidates the transient cache and calls `aJmX`100695249;
  `aJmX/eJmm` aggregate/notify changes. There is no P21 sibling-map removal or
  Base-provider replacement in this inspected notification path.
- `dtZ8.etYY`100716683, the EditAllAdaptive setter, stores its flag and raises
  `ztZQ`100716681. The targeted direct-call search finds one subscription in
  `UcF.RcM`100665125 → `Uc1`100665126 → `bc9`100665118, updating the related
  UI controls. The inspected subscriber contains no widget-provider assignment.
  This bounded static subscriber search is not a claim that arbitrary reflection
  or external application extensions were exhaustively ruled out.

Thus a supplied normal current provider, no effective effects, and an unrelated
sibling view effect are enough to distinguish first-add from generic edit
clearing. The two controlled first-add replays differ only in EditAllAdaptive
false/true and both write the current slot, leaving Base and sibling unchanged.

## Shared content versus provider-driven format

| Data / operation | Established boundary |
|---|---|
| Shape kind | `VectorShape.set_Shape`100702790 writes the object field `SN8X` at IL388. It is not an adaptive PName assignment. It also changes type-dependent default style/geometry caches and raises ShapeChanged; do not characterize it as a harmless style-only edit. |
| Stored path | Existing vector evidence places `Shape` and `ControlPoints` on the common object, outside the AdaptiveStyles map. Generated outline/size can still depend on current style and sizing. A shared path is not proof that final coordinates/rendering never differ by view. |
| AutoFitWidth / Height | Setters100702343/100702367 write shared `GNZZ`/`mNYN`, then request text/layout invalidation. They do not write local PName slots. Their effective getters can nevertheless be gated by current transform ScaleX/ScaleY (frozen runtime-text-autofit-bridge evidence). |
| Raw text / attributed runs | RichTextObject setters100702333/335/337 delegate to the owned RichTextPanel. Panel setter100701879 writes shared `oNOx`; BaseAttrString100701877 reads that same data. No per-view run collection is selected by those setters. |
| Displayed rich formatting | **Not always shared.** `get_AttributedString`100701883 can derive a projection; `LNOI`100701886 calls `rSma.BSmO(get_Chain())` at IL35–40, and TextPanel.get_Chain100702305 uses the owner's `vJOH`. Current-view style can therefore affect displayed formatting over shared runs. |
| Rich-format synchronization | `SyncStyleToAttrString`100701892 explicitly creates a style carrier, extracts properties via `ituB.ntut` / `WtTU.Mtwe`, and calls owner `sJp1(...,false)` at IL148–210. This is concrete evidence that rich editing also has a provider write route. It does **not** establish that every character-level edit is a generic whole-widget style edit. |

Consequently keep shared text/run content, shape/path identity and stored fit
flags separate from adaptive visual-style declarations. Do not add per-view copies
of these shared fields merely because the view changes. Conversely, do not infer
that font/color/decoration is forever shared from the existence of a shared
RichTextBlock. This investigation does not specify every rich-selection toolbar
operation's run mutation and style-summary synchronization.

## Corpus, replay and remaining limits

The frozen `adaptive-behavior-format-census.json` covers11 original files:
25 nonempty AdaptiveStyles owner maps reference75 style records; all75 have an
empty PropList and none contains P21. It also records1223 P21 properties elsewhere
in the corpus. Therefore there is **no real named adaptive P21 author-edit
before/after witness** in this corpus. No new sample compatibility is claimed.

`adaptive-all-views-effects-replay.mjs/json`: **15/15** bounded cases for the
actual M5bg control flow and one seven-state composition assertion. They cover
retention, replacement, equal/no-op, addition, deletion, empty state and capability
exclusion. `adaptive-all-views-effects-first-state-replay.mjs/json`: **2/2**
first-add cases execute the retained YrgK → N5VF → ltAo path. Dependency stubs,
executed IL offsets and inputs/outputs are recorded. Property-list equality is
an exact sequence stub for the simple fixtures; this does not simulate arbitrary
native property equality, native UI transactions, font measurement or rendering.

Remaining unknowns: all single-property effect editor controls' construction of
the requested state, specialized/contained owner entry points, temporary
effect-preview provider selection, and GUI-visible transaction/undo behavior.
The general P21 clear rule, existing-state materialization, and first-add branch
must remain separate in implementation claims.

All source and evidence hashes are in `adaptive-all-views-effects-evidence.json`
and `adaptive-all-views-effects-manifest.json`. Frozen prior reports are only
referenced, not regenerated.
