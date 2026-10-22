# Native Axure RP 11 page-tab navigation evidence

2026-10-22. Read-only shipped-artifact investigation. No vendor assembly execution, GUI retry, configuration changes, or production edits. This is static behavioral evidence and bounded CIL interpretation, not original GUI parity.

## Provenance

- Original extracted `AxureRP11.dll`: `C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll`.
- DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
- Distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.
- Retained extraction evidence: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
- CIL extracted with the existing PEReader-only `research/scripts/inspect-rp-serialization.ps1`; metadata/xrefs likewise read bytes, never load the original assembly. All new sources and existing dependencies are hashed in `page-tabs-native-manifest.json`.
- Owner: `MB0h.lB02`, TypeDef `33554972`. Open-tab list `kBpu` field `67111869`; current tab `OBpy` `67111872`; chronological tab-identity history `zBqN` `67111886`; history cursor `VBqS` `67111887`; append-suppression flag `TBqL` `67111903`.
- Tab `xjZd`: `UjZs` `100670661` is history identity; `XjZo` `100670665` is package identity; `BjYG` `100670667` is the additional open context. These are distinct identity roles.

## Exact Windows bindings

The original registry constructor is retained in `editor-shortcut-registry-cil.json` (`AHXx..ctor`, `100725783`). The owner subscriptions are `lB02.uB0Y`, `100670598`, retained in `page-tabs-native-command-bindings-cil.json`.

| Chord | Registry getter / field | Owner subscription IL | Handler / behavior |
|---|---|---|---|
| Ctrl+Tab | `BHX8` / `IH4I` | `0215–022b` | `EB08` `100670601` → `dB0f(true)` |
| Ctrl+Shift+Tab | `dHXf` / `fH43` | `0285–029b` | `VB0n` `100670600` → `dB0f(false)` |
| Ctrl+Alt+Right | `VHXT` / `UH4g` | `037c–0392` | `iB0u` `100670605` |
| Ctrl+Alt+Left | `MHXw` / `cH4R` | `01bb–01d1` | `vB0w` `100670604` |
| Ctrl+F4, Ctrl+W | `fHXY` / `sH45` | `0327–033d` | `aB04` `100670599` → close current |
| Ctrl+Shift+W | `eHX4` / `HH4H` | `02bf–02d5` | `EB0d` `100670584` → `CloseAllTabs` |

Registry construction ranges: next visual `0b66–0b82` primary key `393241`; previous visual `0a31–0a4d` primary `393239`; forward history `0ee9–0f17` uses Control OR Tab; backward history `0f53–0f82` adds Shift; close `07f3–0817` primary `131165`, alternate `131138`; close all `08a6–08c2` primary `196674`. AxKeys enum and exact-mask behavior were retained in the preceding shortcut evidence.

The platform branch is resolved, not assumed: native `r1.NH.Main` `100663300`, IL `00eb–00f0`, constructs `p1JX.b1Ja` and installs it through `xSnT.KSnu` → `WS8g` → field `QS8v`. Its `zIoT` returns `1`. `xSnT.KS8Y` calls `IS83().zIoT()` then `cSqL.XSdY`, which tests equality with `2`, so the registry's Control branch applies to this Windows provider. Runtime initialization order and physical keyboard delivery are not replayed.

## Confirmed navigation algorithm

`dB0f` `100670602` (`page-tabs-native-core-cil.json`) computes `nextIndex = cursor + (forward ? 1 : -1)` at IL `0188–01a3`. It returns when no open tabs, or nextIndex is `-1`/history count. It does not wrap. The closure `100670712` compares each open tab's UjZs to `history[nextIndex]`; the method commits the cursor and opens the matching tab. Thus Ctrl+Tab is chronological forward and Ctrl+Shift+Tab is chronological backward. This is not a cycling MRU list.

`kB0T` `100670603` returns if target is already active. Otherwise it calls `HBpG` `100670615`, which sets TBqL=true and returns a disposal callback. It opens the target inside try/finally; disposal calls `qBp7` `100670658`, setting TBqL=false. The suppression is synchronous and scoped to that call. The owner-wide field xrefs find only those two writes and the `sBpB` read. No keyboard-release history commit is established or required by this path; no claim is made that every global keyboard callback was analyzed.

The cursor can advance to another occurrence of the same page while current page stays unchanged. For example after closing an intermediate page, a history such as A,B,B,C need not collapse, and stepping between the two B entries must still advance the cursor. `kB0T` returning for the same active tab does not undo `dB0f`'s preceding cursor change.

`iB0u` / `vB0w` use the current tab's index in kBpu. Next wraps last→first; previous wraps first→last. Empty is a no-op; a singleton selects its sole tab. They call `sB0z` and then main `TImN` without the history suppression scope. `sB0z` is a separate visible-layout helper: navigation target choice is verified before its side effects. Hidden/overflow-tab promotion and layout are not replayed.

## Append and close conditions

`jB0o` `100670613`, compiler-identified as HandleOuterObjectChanged, compares current tab.XjZo with incoming main.KE5 at IL `0350–0367`. Equal package identity skips the append path. Different package identity finds/creates the tab, assigns active via `xBpH`, and calls `sBpB` at `03cc–03cf`. The existing-tab ordinary-page cases are replayed.

`sBpB` `100670616` returns immediately while TBqL is true. Otherwise, when cursor is before the end, it removes the complete forward suffix starting at cursor+1, appends UjZs, sets cursor to Count-1, and updates command availability. It does not remove older occurrences. A→B→A therefore produces `[A,B,A]`. The same-package gate belongs to the activation hook, not this append helper.

`CBpI` `100670630` closes a tab and removes every matching UjZs from history, iterating backward. For each removal, cursor decreases only when cursor>0 and cursor>=removedIndex. If removal leaves history empty but other tabs remain, it seeds history with the first remaining visual tab's UjZs and cursor=0. If all remaining history entries equal the first ID, it collapses them to one and resets cursor=0; it does not generally collapse adjacent duplicates.

When the closed tab was active, `<CloseTab>b__1` `100670700` selects the open tab matching `history[cursor]` after adjustment. `firstTabGuid` is used only by the all-identical collapse predicate, not by active fallback. Examples: close active C in `[A,B,C]` at cursor2→B; close active B at cursor1→A; close active A at cursor0→B. Closing a nonactive tab does not invoke an active fallback. With no tabs remaining, the method requests main `TImN(Guid.Empty,Guid.Empty,false)`.

An artificial fixture with open tabs but an initially empty history reaches an index0 read in close and is outside the supported replay invariant. The valid case where closing removes the last recorded ID is separately covered and seeds the first remaining visual tab.

## Gallery and batch close boundaries

`HBp8` reads `ClientSettings.ShowGalleryViewTab`. In `EB0l` `100670607`, IL `0298–029d` branches on that setting and IL `023c–0249` inserts Gallery `UBpY` at kBpu index0. Visual navigation does not filter it, so shown Gallery participates. `CBpI` rejects closing Gallery when that setting is true. This is a known gap if an implementation keeps Gallery as a separate permanent button and cycles only pages.

The getter `100664401` reads static bool `r1V`; `wtU(bool)` `100664252` calls its setter and broadcasts an event. Effective default/user preference is not established. CLR zero initialization alone does not establish the configured default. No preference files were read or changed.

`CloseAllTabs` `100670585` filters out the current tab with `jBpe` `100670653`, closes the other tabs via CBpI(false), then closes current using the same method. Each close therefore has the identity-pruning behavior above; protected shown Gallery remains. Batch iteration is static source evidence, not included in the 22-case replay.

`eB0O` `100670586` structurally preserves field LBqJ as the context target: `UBpM` `100670654` filters out both current and LBqJ, closes the remaining tabs, then closes current when it differs from LBqJ. Its visible menu-caption binding was not decoded, so its association with a named Close Others menu item remains separately unconfirmed.

## Verification and recommendation

`page-tabs-native-probe.mjs` replays the exact retained branch instructions, using recovered Int32 obfuscation fields and explicit List/Guid/delegate operations. `page-tabs-native-probes.json` records 22 passing cases, full visited offsets, source hashes, and open/visibility sinks. Coverage: both chronological directions and endpoints; both visual wraps/middle/empty; repeated visits; forward truncation; suppression; same/different package activation; seven close/prune/fallback cases.

Open-main-window, UI layout, logging, paint, document state, selection, and GUI calls are explicit sinks. Existing-tab activation assignments use a sink matching separately retained xBpH CIL. Activation finally disposal is a redraw sink. The result proves these bounded algorithms, not integrated runtime keyboard behavior, native persistence, GUI focus handling, or full Axure parity.

Implement an explicit chronological list plus cursor separately from visual order. On ordinary page activation append only for actual page change, truncate forward history, and retain older repeats. History stepping commits cursor immediately even if the destination is the same page. Close removes all matching IDs, adjusts cursor, and uses adjusted-history fallback. Do not add an inferred MRU rotation or modifier-release transaction. Ordinary-page reconstruction may use page IDs as a bounded surrogate for both native identity roles, provided the package/context limitation and Gallery gap remain explicit.
