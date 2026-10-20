# Runtime SetText AutoFit: next-stage plan

Status: bounded, read-only static review of retained Axure RP 11.0.0.4150 JavaScript. No original JavaScript, DLL, application or browser probe was executed. No product, test, or historical evidence was changed. Source hashes and exact line excerpts are in `runtime-text-autofit-plan.json`.

## Proven runtime contract

`expr.js:316–385` defines **SetWidgetRichText(ids, value, plain)**. There is no width/height/AutoFit argument in this function signature. After changing text, each target calls `autofitWidget(ids[i])` (383). The generic expression dispatcher evaluates arguments and invokes the selected function (`expr.js:127–179`); `action.js` aliases `setFunction` to its expression handler. This does not establish the native action serializer's complete argument schema.

The actual gates are **`$obj(id).autoFitHeight` and `.autoFitWidth`**, read in `expr.js:469–472`. They are object metadata, not values read from the action, the current style, or this function's arguments. The effective state/adaptive style supplies padding and alignment. Initial native stored `AutoFitWidth/AutoFitHeight` and the imported `shapeText` flags have similar names, but this review has **not** closed the generator mapping from those native fields to these generated object properties. Their equivalence must not be assumed.

The rich-text setter first converts to string and updates visibility based on nonempty text. Plain mode uses safe text nodes, preserves the first span's style/id, replaces extra paragraphs, and represents hard CRLF/LF with `br` nodes. Rich mode installs supplied markup and updates the original-text cache. These source details describe Axure; they are not authorization to accept arbitrary HTML in this product. The first-span, single-line early return is inside the alignment callback and does not skip the subsequent AutoFit call.

`SetWidgetFormText` is a different path (`expr.js:289–300`): value assignment, hint handling, and text-change firing; it does not call AutoFit. `SetFocusedWidgetText` routes textbox/textarea to that path and other targets to plain `SetWidgetRichText` (302–307). The public query `.text(value)` implementation in `axQuery.std.js:840–881` is also distinct: it changes existing paragraph/span content without calling this AutoFit function. A blanket “all text mutations resize” policy is unsupported.

## Measurement and geometry

For an eligible owner, `expr.js:474–518` reads the current query size and measures current DOM text before resizing:

| Axis | Exact source rule |
| --- | --- |
| Height | Direct text child `jText.height()` plus numeric effective top/bottom padding. |
| Width | For each descendant paragraph, sum jQuery `.width()` of its **direct span children**; take the maximum paragraph sum, then add left/right padding. |
| Disabled axis | Keep the query's current axis value. |

Height is evaluated before width, but both measurements precede the one resize call. This function does not explicitly remeasure height after changing width. Width is not `scrollWidth`, canvas text width, a sum of every descendant run, or a general visual bounding rectangle. Hard breaks, nested hyperlinks, multiple spans, and fractional used geometry therefore require independent DOM fixtures before implementation claims.

If either exact delta is nonzero, `query.resize(css,{})` runs first (`523–525`). Then alignment preserves the corresponding edge/center (`526–544`): right gives `dx=-deltaWidth`, center `dx=-deltaWidth/2`, bottom gives `dy=-deltaHeight`, middle `dy=-deltaHeight/2`; other alignments leave the coordinate unchanged. Nonzero movement calls `MoveWidget(id,dx,dy,{easing:'none',duration:0},false,null,true)`. There is no rotation correction in this function itself; effects of downstream resize/move helpers, constraints, event ordering and nested fit updates are not re-established by this review.

Hidden measurement (`406–443`) detects inline `display:none` on self/ancestors, clones the owner into an absolute zero-sized `#measure` container attached to body, sets the clone to block, and removes it afterwards. It does not copy the whole ancestor chain. Visible owners are measured live. This is not evidence that every inherited style or ancestor-dependent selector survives cloning.

## Registration and lifecycle

- `_autoFitIds` starts as an empty object (`387`). Each eligible `autofitWidget` call records its ID and computed CSS after measurement, including zero-delta calls (`550`). In the retained Axure script directory the only setter call is this one; the setter is publicly exposed, so this is not proof about all possible generated/external callers.
- `updateAutoFitted` enumerates registered IDs and calls `autofitWidget` again (`400–404`). Stored CSS is not passed as the measurement result to reuse.
- Both adaptive-view branches invoke this update after style/visibility changes and repeater refresh (`adaptive.js:135–151`).
- Repeater `removeItems` removes item DOM, clears geometry/visibility records, clears these registered child IDs, then clears item identity records (`repeater.js:1070–1077`). No retained evidence here establishes a broader per-page registry cleanup protocol.
- State repaint is separate: `style.js:1647–1700` can change the `id_div` background layer and text offsets when overrides exist. Those assignments are not owner `query.resize` and do not themselves register the owner for this AutoFit loop.

## Minimum implementable next-stage contract

1. First prove or explicitly introduce a separate authoring contract for runtime width/height flags. Do not silently equate imported initial `shapeText` flags with generated runtime object flags until the generator bridge is established.
2. Limit the first faithful path to supported rich/plain shape SetText with a concrete DOM owner/text structure. Commit safe structured text, then obtain actual host measurements using the two axis rules above, then resize and alignment-shift in source order. Preserve initial owner geometry until a qualifying mutation occurs.
3. Track registrations by actual runtime instance identity, including repeater row scope. Recalculate registered instances on adaptive switches; remove stale row-instance registrations when items are removed/rebuilt. An unchanged measured size must still register an eligible instance.
4. Do not extend this to input/textarea, public-query text mutation, arbitrary rich markup, rotated/nested layout side effects or first-page-load resizing based solely on this function.
5. Next validation should cover each flag pair, growth/shrink/no-op, padding and alignment, multiline/direct-span versus nested-link measurement, hidden clone behavior, adaptive remeasurement, and repeater cleanup. These are proposed tests, **not tests run in this review**. Original GUI measurements and a generated page from the real project remain unavailable.

Related frozen evidence: `text-autofit-style-evidence.md` proves the ordinary initial VectorShape text writer's no-coordinate branch; `text-autofit-base-css-evidence.md` distinguishes background-layer state repaint from owner resize. Neither is changed by this plan.
