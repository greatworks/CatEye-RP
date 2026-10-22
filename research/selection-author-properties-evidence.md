# Selection author style and text entry

This investigation interprets retained Axure RP 11.0.0.4150 CIL records. It does not load or execute the original assembly, operate its GUI, or establish font/pixel equivalence. The original DLL SHA-256 is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. The prior selection author services and transaction evidence remain unchanged. New evidence is under `selection-author-properties-*` only.

At this task's start, all 14 source entries in `selection-author-verification.json` matched their saved hashes. The task-stage result is preserved in `selection-author-properties-baseline.json`; it is not a claim that parallel implementation work after that check left those files unchanged.

## SAPROP-01: ordinary style notifications include a forced refresh

`TextRectObject.MIue` token **100702383**, retained in `selection-author-properties-entry-cil.json`, gates the text refresh on all of:

* the layout recursion field `vNY9` is false (IL7–18);
* the notification argument is true;
* `XJdz` is false (contained-owner gate, IL23–29);
* the changed-key sequence is not exactly the one-element sequence **[101]** (IL34–64).

There is no font/alignment/padding-only allowlist here. Empty keys, [2], [94], [105], and [101,2] can all enter. P101 is the complete Location point, independently established by `ituB.Vtl3` **100717328**. P105 is the complete Size, `ItlR` **100717330**. A product adapter may represent “only Location changed” and “indicator size changed” explicitly instead of inventing a placeholder native key. An empty sequence is not the same as [101]. This says nothing about whether the upstream editing command actually sends an empty notification.

When the gate passes, MIue calls `BNZT` **100702385** at IL70, then virtual `OI8Z(false)` at IL77, and finally base `KJm7.MIue` at IL85. BNZT calls the existing panel's `vNOg` **100701893**; a missing panel returns without that call. The outer MIue still proceeds to OI8Z(false), so null-panel end-to-end layout is not claimed safe.

The newly closed inner chain is:

```
vNOg: not IsBeingEdited AND not pNOC
  CNOH: clear XNOM, TNOK; set UNOh to IHVk (NaN, NaN)
  virtual iIyW(false) -> RichTextPanel.iIyW -> owner.OI8Z(true)
  INOc(true)
outer TextRect.MIue -> owner.OI8Z(false)
base KJm7.MIue
```

The virtual override is **100701895**, not the empty/base TextPanel body **100702312**. Its IL140–147 calls OI8Z(true) independently of its argument. Its later VJm0 branch requires **arg1=true AND owner.ForceUpdate=true** (IL72–109 then IL33–41). Thus vNOg's false argument does not send that VJm0 notification. `INOc` is inline-link reconciliation/update, not merely a general repaint flag; this replay records it as an explicit service sink.

`pNOC` is a separate refresh suppression field, not the editing-text flag. Its setter delegate `fNOL` **100701907** writes the field. It is used as a temporary guard in RNO1 below. A pure layout adapter can expose it as `panelChangeGuard`, default false, while retaining separate `editingText` and layout-recursion guards.

The real OI8Z instruction stream is composed into these probes. Size writes may reenter OI8Z(true), but `alreadyGuarded=true` causes immediate return. Effective outer force sequences are `[true,false]` normally and `[false]` when editing or pNOC suppresses vNOg. The raw trace intentionally retains guarded reentry; it must not be counted as a second completed layout.

## SAPROP-02: P94 preflight runs before the ordinary notification gate

`SelectionButton.MIue` **100702033**, IL7–80, checks changed keys for P94, requires nonempty text, then compares the current effective ButtonSize with current width. If `b > width`, it requests:

```
uJ0j(Size(b + currentPanel.Width, currentOwner.Height), false, true)
```

Only afterward does it call TextRect.MIue at IL88. The b value is therefore already the newly visible property value at notification time. This preflight is not gated by the outer notify argument, containment, or the TextRect layout guard. The size setter itself may normalize dimensions and invoke a guarded or effective layout callback. In particular, “notify=false means no layout” is false when this P94 preflight expands the owner. `false,true` are the size setter's current-view/all-views and notification arguments in this proved call, not a license to overwrite size declarations in every adaptive view.

The source entry is a notification consumer, not the property write itself. The retained ordinary style path is `GetEdit -> sJp1` **100695567**. Equal effective values can yield no edit upstream. For supplied changed native properties, sJp1 clears their keys through WJpV and writes the Base provider under Affect All Views, or writes the current provider in the ordinary adaptive branch. The newly retained `QtAY.Ctor` **100717643** applies properties through `KtoF` **100717644**; its changed-property branch writes via `WtTU.dtwN`, marks the key, then issues ltAQ. `sJp1`'s Base branch also invokes aJmX after provider Ctor. The existing `aJmX/eJmm` records route the notification to virtual MIue after invalidation. These provider facts are **static chain inspection**, not a full replay of named-style/provider synchronization.

Detailed all-view clearing and same-value semantics remain those in the frozen `adaptive-all-views-authoring-evidence.md`; this report does not generalize every selection formatting GUI command to that path. The second Boolean argument to sJp1 participates in named-style handling; it is not itself the EditAllAdaptive switch.

## SAPROP-03: shared text writes precede a forced layout tail

Source entry bindings:

| Entry | Actual call chain |
| --- | --- |
| RichTextObject.set_Text **100702333** | panel.set_Text **100701890** -> current attributed string / first-style builder -> RNO1(newAttr,true) |
| set_AttrString **100702335** | panel.set_AttributedString **100701884** -> clone IS0V -> RNO1(clone,true) |
| set_AttributedString **100702337** | same panel setter / clone path |

`RNO1` **100701880** first stores the new attributed string through set_AttrString **100701879** (IL451–453), then invokes `iS0B` (IL33–39). Its false notification argument or Overridden=true branch returns after this write. The ordinary branch follows this order:

1. CNOH clears panel format/measurement caches.
2. hbxB/fNOL temporarily sets pNOC=true, or leaves an already true value in place.
3. INOc(false), then SyncStyleToAttrString(false), then HNOk.
4. The finally block restores the previous pNOC value.
5. iIyW(false) invokes owner.OI8Z(true).
6. RNO1 separately invokes owner.VJm0(false,null), IL135–143.

This tail is not vNOg. An already true pNOC does not suppress RNO1's eventual iIyW(false) call. The new probes execute the actual finally instruction region IL323–402 before the tail, and also verify guard restoration when the injected synchronization service throws.

The attributed-string clone, current-effective formatting projection, first-style builder, normalize operation, synchronization service, and inline-link service have declared facade/sink implementations. Their presence and order come from original call instructions; their internal rich-text/provider effects are not substituted with a claim of original behavior. `SyncStyleToAttrString(false)` itself has retained static evidence: it uses get_BaseAttrString, opens WJma aggregation, constructs a style carrier and calls owner.sJp1(...,false), visits inline links, then disposes aggregation. WJma can defer/coalesce notification. This report does not claim the complete final notification count or formatting result of that service.

A bounded product implementation can therefore write its candidate shared text, perform its explicitly documented synchronization policy, then expose a pure `textChanged` tail of OI8Z(true) followed by notification. It must not claim that this tail reproduces all of RNO1, WJma, native attributed-string normalization, inline-link reconciliation, or native provider mutation.

## SAPROP-04: source-bound changed-key carriers

Thirty actual setter instruction records are replayed into a property-write capture sink. Their IDs are independently matched to metadata names in `adaptive-all-views-metadata.json` and preserved in `selection-author-properties-key-setters-cil.json`.

| Field or native carrier | PName |
| --- | --- |
| FontName, FontSize | 1, 2 |
| FontWeight, FontStyle | 1001, 1002 |
| Underline, Strikethrough | 5, 95 |
| ForeGroundFill / text color | 6 |
| Fill, BorderFill | 7, 8 |
| HorizontalAlignment, VerticalAlignment | 9, 10 |
| PaddingLeft, Top, Right, Bottom | 11, 12, 13, 14 |
| BorderWidth, LinePattern, LineEnds | 15, 16, 17 |
| LineSpacing, IxStyles | 20, 21 |
| Opacity, CornerRadius | 70, 71 |
| OuterShadow, InnerShadow, TextShadow | 72, 73, 74 |
| BorderVisibility, CornerVisibility | 80, 81 |
| ButtonSize | 94 |
| Location, Size | 101, 105 |

Solid/gradient alternatives share their native Fill carrier. Padding remains four independent keys; CSS TRBL maps to [12,13,14,11]. This table establishes notification/carrier identity, not numeric CSS conversion. Native FontSize units and native LineSpacing are not automatically equal to product CSS fontSize/lineHeight values. Product-only cornerRadii/borderWidths arrays are not invented native property keys.

## Execution, failure preservation, and boundaries

`selection-author-properties-replay.mjs` produces **84/84 passing checks**: 16 style/edit/suppression/fit combinations, ten key/notify gates, four virtual-refresh gates, one cache-clear check, twelve text entry/guard combinations, eight P94/gate checks, one notification-false text write, two injected synchronization failure/restoration checks, and thirty native setter carrier checks.

The first run had 7/31 passing assertions: 24 assertions incorrectly counted recursion-guarded OI8Z entry calls as completed layouts. The original output is retained as `selection-author-properties-first-probes.json`. The correction filters only the asserted effective sequence by `alreadyGuarded`; it does not remove calls from traces or alter original instruction data. This was a harness expectation failure, not an Axure failure. The initial script bytes were not separately snapshotted, so no exact first-script byte reconstruction is claimed.

The interpreter composes the old transaction replay without editing it. Geometry here is finite, ordinary, unrotated page-origin selection geometry with controlled nonempty text; graphics measurement answers and the 2px conversion remain explicit injected services. The old union facade is only used for these positive, nonempty rectangle cases. Minimum is injected as 1x1 with the separately proved ordinary source binding. Empty/negative panels, nested diagram origins, general transforms, special graphics units, native font shaping, UI undo/edit scheduling, and full attributed-string services are not newly established. CIL NaN sentinels are checked as NaN in memory; JSON serialization displays them as null, not as a claim that the native cache contains null numbers.

The base KJm7.MIue notification body remains a declared sink in the composed geometry replay. Static records show its own notify/rotation/placed side effects; this report does not replace that sink with a purported complete editor event loop. No product source, prior evidence, original sample, browser result, or released package was modified by this investigation.
