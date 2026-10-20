# Form properties and synchronous Focus

2026-10-13. This stage adds authoring, version-1 document persistence, preview, portable HTML and bounded native-container recovery. It is not full Axure parity or an original-GUI comparison.

The evidence is split between [shipped runtime function probes](form-properties-evidence.md) and [native storage/CIL and sample recovery](rp-form-properties-evidence.md). Final release identities and test results belong in [verification](form-properties-verification.json).

## Implemented behavior

- Text fields and text areas support `readOnly`; text fields also support integer `maxLength` from 0 to 2147483647. Omission means unlimited. These use native browser attributes, so users may select readonly text, length limits constrain user entry, and Set Text still writes any valid product string without truncation.
- Form controls can bind a `submitButtonId`. Enter keydown prevents the default newline; Enter keyup dispatches the target click. Shift+Enter also submits. The source retains focus unless an action changes it. Same-repeater bindings address the source row; bindings into unrelated repeaters do not broadcast. Missing or cross-page references do nothing.
- Set focus addresses the first resolved target row and optionally selects text. The shipped query's first synthetic Focus round runs before actual browser focus, old Blur and the second target Focus round. Already-focused fields receive both rounds. Focus cases finish their synchronous actions before subsequent actions; Wait tails remain nonblocking.
- Preceding text, visibility, disabled and panel-state changes are synchronously rendered before DOM focus. Typing-mode Hint prevents Select text while active; focus-mode Hint clears before selection. Caret and full selection ranges survive offline renderer updates.
- Hidden/disabled form Focus cases do not run. Visible controls disabled by their enclosing panel also cannot run effective Focus cases. Reentrant Focus is bounded by 64 nested callbacks and 10000 transitions per task; a failed action segment restores runtime data. Existing focus case menus, navigation and cancellation use the normal task lifecycle.
- New fields are optional. Strict validation rejects unsupported field/type combinations, malformed limits and options. Internal Submit references follow clone/component ID remapping; dangling references remain serializable, matching ordinary action references. Mixed authoring selections only modify eligible controls.

## Explicit compatibility decisions and remaining boundaries

The submit target chooser offers supported ordinary widget types on the same page. The original editor's complete eligibility filter remains unknown. For checkbox/radio submit targets this product executes one native-style checked update, Click, selection callback and Change sequence. Click sees the already changed checked value; checkbox selection then inverts the current selection getter. This is a bounded compatibility decision: isolated vendor-jQuery probes exhibited an extra click pass and a missing `originalEvent` exception, which has not been established for a full original prototype.

Our hidden widgets and inactive panel states are absent from the DOM. Consequently Set focus on a hidden field cannot preserve an invisible native selection range for a later show, although it suppresses effective Focus and does not steal actual focus. Visible disabled fields still support the browser's selection-range behavior. Layer/RDO focus proxies, original container/shape tabindex, hidden compound-vector exceptions, original mobile submit, OS IME and full native adaptive focusability remain unverified. Focus on ordinary non-form widgets uses this editor's existing accessibility/tabindex behavior.

The runtime action transaction restores data on errors, but cannot reverse browser scrolling, selection, or an already completed native focus side effect. The guard reports errors and keeps the session usable; it does not claim to reproduce vendor loop behavior. Pure snapshot helpers simulate event ordering without a DOM and cannot establish actual browser focus.

## Native recovery

Four real readonly inputs now survive the shipped Sample form patterns container. All 120 surveyed TextBox maximums equal Int32.MaxValue and are imported as omitted/unlimited; finite values are verified with strict synthetic native-object mutations. All 125 surveyed SubmitButton references are zero; nonzero native bindings remain unsupported. The new single-target Focus decoder accepts only proved local/This paths to retained input/textarea targets. All four real Focus actions still belong to otherwise unsupported events, so newly recovered complete real Focus events remain zero.

The packaged desktop flow reads the actual shipped library bytes through the existing container importer, verifies the Time picker readonly input with keyboard actions, saves unchanged recovered data and checks the source hash. Its OS picker response is mocked; the ordinary file filter advertises `.rp`. This does not establish library browsing or bidirectional `.rplib` compatibility. The portable deliverable contains independent code, not Axure binaries/resources.

Development verification caught a synthetic importer test that changed a candidate to textarea but left its native class as TextBox; the fixture was corrected without loosening type checks. A parallel initial build briefly read an incomplete newly written test file; the completed file passed type checking. Final verification runs only after source freeze.
