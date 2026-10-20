# Form properties and Focus action evidence

2026-10-13 · Axure RP **11.0.0.4150**. Read-only original-runtime investigation using the already extracted distribution. No original GUI, application, compiler, product source, product build, or generated prototype was launched. The new [probe](scripts/probe-form-properties.mjs) executes exact SHA-pinned function slices with the shipped jQuery in an isolated Edge **155.0.4283.45** document. [JSON](form-properties-evidence.json) retains the source ranges, hashes, adapter boundaries and all **28 passing assertions**. Network requests: **0**. Three original checkable-submit exceptions are deliberately captured and retained; “passing” means matching the recorded result, not an error-free vendor application.

REA extraction: `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. Installer SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`. DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. Original files are under `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`; JSON includes absolute paths and full hashes.

## Official scope

[Text fields and text areas](https://docs.axure.com/axure-rp/reference/text-fields-text-areas/) documents read-only text as selectable but not user-editable, maximum length for text fields only, and an assigned submit widget whose Click/Tap is fired by Enter from a field or text area. Input types are HTML controls, with browser-dependent UI and mobile keyboards. [Actions](https://docs.axure.com/axure-rp/reference/actions-list/) describes Focus as giving browser focus to a widget. These descriptions do not establish the detailed event sequence below.

## Focus targets and action sequence

**Static and isolated execution:** `action.js:2071–2093` takes only `objectPaths[0]`, resolves it, takes only `elementIds[0]`, calls the query's `focus()`, optionally selects text, and then calls the next action. It neither loops over every path nor focuses every row. Empty path/resolution continues normally.

`doc.js:221–244` binds a target inside the source's repeater to the source row (or the event's target row if source lacks one). Outside that repeater it returns the repeater's item IDs in the supplied item-ID order; Focus then chooses the first. Probes exercise `[3,1]` with first row 3 and a same-repeater source in row 1. They do not claim to derive every sorted/filter lifecycle's item-ID order independently.

`events.js:693–710` resolves a mapped layer child first, then looks for `_input`, `_img`, `_div`, falling back to the supplied element. This is existence-based, not a search for the next visible/enabled control. `events.js:759–760,652–668` builds layer/RDO mapping only for a tabbable object: the first layer `objs[0]`, or the first RDO hide/limbo list object, then recursion only through another layer/RDO. It does not scan all descendants, search for Focus handlers, or walk dynamic-panel states. Dynamic panels and repeaters have no equivalent child-choice mapping in this function. The layer mapping construction is static evidence; probes provide the mapping explicitly.

**Observed double dispatch:** `axQuery.std.js:1257–1266` calls `triggerHandler('focus')` on the resolved input, then jQuery `focus()` on that same input. User Focus handlers also attach to the input (`events.js:125–128,154–177`), so the first call is not a harmless focus on an unrelated wrapper. In the isolated actual jQuery host, the order for another currently focused field is:

1. New target Focus handler, while actual `activeElement` is still the old input.
2. Old input Blur handler.
3. New target Focus handler, now actually focused.
4. Optional text selection, then next action.

An already focused target still receives two Focus handler calls. Native style handlers are registered before user interactions (`events.js:778–790`); the separate [Error/Hint report](error-hint-evidence.md) establishes later Hint focus handling. This probe instruments the style endpoint instead of reproducing native CSS paint.

**Hidden/disabled distinction:** query Focus has no pre-check. The original default event wrapper at `events.js:605–618` blocks disabled user callbacks. The full original `_handleEvent` at `281–415`, using an instrumented case endpoint and explicit visibility fixture, confirms `324` rejects hidden ordinary form cases: non-synthetic + invisible + `_notAllowedInvisible(id)`. The helper at `217–226` exempts layer/RDO and compound-vector cases, not ordinary text fields. Thus a hidden input can receive both raw jQuery callbacks while neither user case executes. Disabled/hidden inputs in the actual DOM keep the old active element.

**Selection:** `selectText` is tested *after* focus callbacks and only if the target's Hint manager is inactive. The action scans only direct children whose ID contains `_input` and tag is input/textarea, then invokes native `.select()`. No recursive select scan, no disabled/hidden check, no generic selection call on a select element. Observed disabled and hidden inputs still acquire selection `[0,text.length]` while the old field remains active. A mapped nested layer input focuses but is not selected by the layer root's direct-child scan. `selectText=false` preserves an existing caret. An active typing-mode hint suppresses selection; a focus handler that clears the active flag permits it. Actual Hint manager behavior remains in the separate Hint report.

## Submit binding and row scope

`events.js:935–959` installs the binding on the source wrapper. It prevents default on **Enter keydown**, then fires on **Enter keyup**. It checks `keyCode == '13'`, with no Shift/Ctrl/Alt, repeat or composition guard. Probes confirm non-Enter does nothing, repeated keyups each dispatch, and the source stays focused. Consequently an assigned textarea does not insert a normal Enter newline on keydown; the source code does not add a Shift+Enter exception.

The target path is copied and its `id` appended. For source and target in the same parent repeater, the current row suffix is applied. An unrelated repeater target is **not broadcast to every row**. An existing `_input` is preferred. `fireClick`, `events.js:1629–1635`, calls jQuery `.click()` on desktop, but calls a synthetic `onClick` endpoint in the mobile branch. The mobile probe only verifies branch selection on desktop Edge, not physical mobile behavior.

A normal shape's Click can therefore run without moving focus from the source. For checkboxes/radios, desktop jQuery click can also invoke native checked-state behavior. The stored SubmitButton editor eligibility list is not established by this JS function; all audited 125 real inputs have an unassigned SubmitButton in the independent census. Do not infer that every synthetically supplied target is available in the editor.

### Checkable ordering and retained partial-host anomaly

`_attachEvents` runs at `events.js:790`; the checkbox/radio click binding is installed later at `1214–1251`. On a given input the user Click runs before the selection handler. Native DOM checked state is already changed when Click executes. Checkbox selection then uses **`!IsWidgetSelected(elementId)`**, not `input.checked` (`1239–1241`). Radio sets all named peers false, then itself true (`1224–1233`). `style.js:251–252` commits selection and `events.js:1688–1693` requests SelectedChange followed by Select/Unselect. Reentrant Click actions can therefore change the selection getter before the checkbox handler inverts it.

With the actual selected setter and click binding added, the isolated shipped-jQuery host produces a second synthetic click pass, then `TypeError: Cannot set properties of undefined (setting 'handled')` at the original `e.originalEvent.handled` write. Checkbox ends checked=true but selected=false; radio ends checked/selected on the requested radio after an extra unselect/select pair. Hidden checkbox suppresses Click cases but still reaches the selection callbacks; disabled checkbox changes neither checked nor selected. Three exceptions and exact traces are retained in JSON. This is **not a claim that a complete generated vendor page always fails**: full initialization, other event hooks and generated markup are outside the adapter. Do not conceal the anomaly by inventing `originalEvent`. A product decision to execute one click/selection sequence and safely handle a missing original event is a compatibility choice, distinct from full native parity.

## ReadOnly and maximum length

No `readOnly`/`readonly` or `maxLength`/`maxlength` handling occurs in the searched non-minified shipped Axure runtime JS tree. This bounded absence is not proof of missing support: these are HTML control properties. The independent CIL/census work owns [form property storage evidence](rp-form-properties-evidence.md), [HTML generator CIL](rp-form-properties-html-cil.json), and [HTML writer CIL](rp-form-properties-html-writer-cil.json).

The static chain `FNiU.SNPF` token100699642 reads ReadOnly/MaxLength at IL74/80 and passes them to `BNCJ.JNCt` token100699500. The writer omits the length output when the value is `2147483647` (IL1067–1074), otherwise formats the Int32 invariantly and writes it (IL1133–1145). The textarea generator passes the maximum-Int32 sentinel. String names remain obfuscated: this is parameter/control-flow evidence, not decoded literal `maxlength` output. Existing class getters and real wire keys are separately recorded by the census agent.

In isolated Edge with harness-supplied HTML attributes, readonly prevents actual keyboard editing but permits focus/selection; maxlength=3 stops typing after three characters. These are browser-property observations, not captured original generated HTML. The exact original `SetWidgetFormText` (`expr.js:289–300`) writes `.val(value)` without either check and then performs Hint/TextChanged processing. Its execution successfully sets six characters on both readonly and maxlength=3 inputs. Therefore SetText should not be clamped to a user input length limit or prohibited by readonly. Hint clearing/focus behavior retains the rules from the earlier Hint research; readonly is not disabled.

## Input-type boundary

The official field documentation lists Text, Password, Email, Number, Phone, URL, Search, File, Date, Month and Time. The DLL's stored enum is wider: [InputType CIL](rp-interaction-InputType-cil.json) contains values0–22, including checkbox/radio/button/submit/reset/hidden/image and old datetime variants. Enum membership alone does not prove those values are available in the text-field editor or can be imported as that widget class. Runtime validation, number/date value normalization, maxlength applicability to non-text HTML input types, file selection restrictions and mobile keyboards need their own bounded browser/compiler checks before making fidelity claims.

## Acceptance suggestions

- Focus: first path/first resolved row; same-row target; repeated focus; synchronous `target focus → old blur → target focus → next action`; selectText false/true; readonly; hidden/disabled case suppression with unchanged actual focus; active Hint blocks selection.
- Lifecycle: Focus callback can set text, change page, schedule Wait, or call another Focus; keep native DOM operations and event continuation synchronized, and bound loops without silently deferring all Focus cases until after the next action.
- Submit: Enter keydown/keyup split; textarea newline suppression; same-row target; unrelated row target does not broadcast; no forced focus transfer; disabled target; Click sees already toggled checked value; selected callbacks follow Click under the stated compatibility contract.
- ReadOnly/length: actual typing blocked/limited, selection allowed, programmatic SetText unrestricted, source document unchanged, preview/offline share the same behavior.

Remaining unknowns: full generated-page checkable-submit anomaly; editor SubmitButton eligibility; full layer/RDO focus-proxy bubbling; dynamic-panel/repeater focusability and generated tabindex; native mobile controls; IME/browser selection corner cases; exact hidden compound-vector exceptions; obfuscated HTML attribute key strings. None is replaced by guessed editor defaults or an assertion of GUI parity.
