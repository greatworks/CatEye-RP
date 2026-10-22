# Apply-style and adaptive entry supplement

**8/8 controlled source-runtime sequences passed**, two control types × four entry sequences. This executes the complete retained style.js with the earlier trace wrappers. No product code or native DLL executes. Base/adaptive objects and a no-op placeholder refresh are supplied; original style merging, SVG call eligibility, clearPrevious handling and the SVG consumer execute.

## Correction: repeated class is not suppressed in the observed source carrier

The static `applyWidgetStyle` entry has an apparent early return:

`!clearPrevious && isLastAppliedStyle(id,className)`.

However, reading the predicate and exercising the complete original module changes the conclusion. In style.js849–850, `isLastAppliedStyle` reads `_idToAppliedStyles[id].length` and indexes that same object. `applyWidgetStyle` stores **an object with classList and style**, not an array (lines886–895). In the ordinary tested carrier, `.length` is undefined, so the named class is not found. The predicate returns false after the first apply and after subsequent applies.

Thus A width3 → same A width0 → B width0 → same B width0 with clearPrevious=true produces **four SVG calls `[3,0,0,0]`**, not three. Both type sequences preserve mark stroke-width attribute3 after the zero widths. The original JavaScript gate must not be rewritten as a presumed last-action-ID suppression rule without new evidence. This corrects an earlier static inference communicated to the implementation agent; the initial failing probe and successful separate second probe remain available.

The source applyStyle action handler (action.js648–673) forwards `applyStyleInfo.className`, `.style`, `.image` and `.clearPrevious` directly into `applyWidgetStyle`. Its check at line659 controls calling setApplyStyleTag; it does not skip the later applyWidgetStyle call. No equivalence between the independent product's Action.id and the native generated className was established here, and none is required by the observed always-applying ordinary carrier.

## Other established entry behavior

- `applyWidgetStyle` does not use `_widgetHasState` and does not block disabled state at entry. It combines the computed current full style with the applied-style accumulator, then calls `_applySvg(id,'interaction',fullStyle)` for non-ImageBox controls. The matrix uses checkbox/radio SVGs.
- Accumulation/clear is separate from the faulty last-class predicate. A width3 apply, then a color-only apply, then clearPrevious=true with only a fill override, gives SVG widths `[3,3,1]`: the second retains accumulated width, the third returns to base width1.
- `setAdaptiveStyle` calls `_applySvg` whenever `id_img` exists and is SVG, with `state ?? NORMAL`; there is no state-style presence gate or value-equality deduplication. With supplied live adaptive data widths3→0→0, all three calls occur and mark width attribute remains3.
- Missing `id_img` prevents the adaptive SVG call. Placeholder refresh still belongs to the caller but is a declared no-op sink here.
- The tests pass no adaptive `style.size`; scale/matrix changes for size are not covered. Repeated application of arbitrary classes, unknown carriers or all action import/generator metadata are not inferred from these eight cases.

## Evidence and failure record

`selection-state-dispatch-style-action-probes.json` records full input sequence, original SVG argument styles, both isLastAppliedStyle checks after each step, and resulting paint. The first script incorrectly expected same-class suppression and failed with observed SVG counts `[1,1,1,1]` versus its expected `[1,0,1,1]`; it wrote no positive result. Its bytes are retained. The second script adds predicate observations and asserts the verified original behavior. The original 144 dispatch and12 callback reports remain unchanged; this is an additional independent source contract.
