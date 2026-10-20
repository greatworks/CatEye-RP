# Mixed rich text and native state filtering

The reconstruction now stores safe paragraphs and runs rather than flattening all styled text. `Widget.text` is a strictly validated plain-text projection; existing documents without rich text retain their behavior. This milestone is not full Axure equivalence.

## Authoring and rendering

The formatted-text editor uses a real textarea selection with a live formatted preview. Selected ranges support family, size, weight, normal/italic and color; paragraphs support alignment and absolute CSS line height. Apply commits one document undo step; Cancel leaves the document alone. Local undo/redo, plain-text paste and IME composition preserve surrounding run formats. This is not Axure's inline WYSIWYG editing surface.

Structural React and offline DOM rendering use text nodes, never authored HTML. Empty paragraphs create line boxes. CSS line-height is preserved; actual line-box height can exceed the value when font metrics/struts require it. Fonts other than the twelve licensed embedded Roboto faces depend on the host.

Explicit whole-widget font commands apply to every run. Adaptive commands leave the shared run baseline intact, including an explicit normal reset equal to the outer base. Transient styles compose over runs by the properties actually provided and restore the mixture when removed. Plain Set Text retains the first run and first paragraph formatting, including blank lines. Arbitrary HTML replacement and the native rich setter's cache/adaptive semantics remain unsupported.

Author expressions can cross run boundaries; replacements use the token's starting format, obey an aggregate text budget and are not recursively evaluated. Native ordinary AxRun text is marked literal, so instructional text such as `[[...]]` remains text. Cloning/components remap real expression references across runs and retain literal text. Row runtime changes are isolated and action failures restore both text and style metadata.

## Native evidence and recovery

Original version: Axure RP 11.0.0.4150, managed assembly SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. The retained extraction evidence is `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.

- [Format evidence](rich-text-format-evidence.md) and [current import audit](rich-text-format-import-audit.json) retain source locations, hashes and limitations. All 49 previously admitted mixed owners recover 241 paragraphs and 1,093 runs. Their 192 nonfinal paragraph terminators are normalized once, removing the prior doubled line breaks. One hyperlink owner remains unsupported. The corpus restores 632 rich-text widgets overall, including uniform runs.
- [Selected-style generator evidence](selected-style-filter-evidence.md) proves local state properties are emitted only when overridden and determined. Malformed/duplicate records and unsupported active fields still reject atomically; named-style cache materialization keeps its separate guards.
- The audit retains every earlier widget, adds two nested radio widgets and 36 Set Selected event mappings in Form patterns, including the eight previously blocked dropdown focus/blur events. These are imports of source evidence; original GUI execution of all events is not claimed.

## Verification and limits

The stage verification JSON records the full unit/parser/browser results and the exact Windows bundle/ZIP hashes. New tests cover schema rejection, cross-paragraph edits, component publishing, adaptive resets, literal text, cross-run expressions, state composition, row isolation, transaction rollback, selection/IME/paste, and preview/offline parity. Packaged smoke checks load/save/reopen the demonstration and verify actual embedded Roboto-Italic glyph use with no network requests.

The user opened an original Untitled editor. Computer Use read its window/menu tree, but screenshot capture still returned `FrameArrived timed out`; no visual GUI or pixel comparison is claimed. Original-function probes and static managed/format evidence remain distinct from reconstruction tests.

The first packaged regression run caught a lost click after input blur: rebuilding identical rich-text DOM disconnected the mousedown target before mouseup. An isolated [pointer-continuity A/B probe](rich-pointer-continuity-evidence.md) reproduced the failure in the exact failed export. The offline renderer now reuses paragraph/run elements and updates their text/styles locally; the focused browser scenarios cover a rich button clicked after an input blur action. Final checks use the rebuilt package.

Native import remains read-only and partial. Hyperlinks, lists, text decoration/baseline/spacing/stretch variants, arbitrary rich HTML actions, complete font resolution and layout, native write-back, full original UI, advanced widgets, cloud collaboration and macOS remain unfinished.
