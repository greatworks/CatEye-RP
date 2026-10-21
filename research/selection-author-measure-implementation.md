# Browser selection author measurement service

This stage adds `src/runtime/selection-author-measure.ts` and `tests/selection-author-measure.test.ts` only. Existing display layout, runtime AutoFit measurement, pure author transaction and host files are unchanged by this work.

The service is an independent browser substitute for the raw text-measurement callback used by `planSelectionLayout`. It does not execute native font/graphics code, alter owner geometry, supply minimum-size or coordinate-conversion policy, perform rectangle unions, dispatch notifications, or commit a document.

## Interface and snapshot lifetime

```ts
createSelectionAuthorMeasurer(shapeText, displayLayout, readTextBox?)
  .prepare(source, document) // session | undefined

session.origin               // 'browser-derived'
session.sourceSnapshot()     // detached Widget copy
await session.fontsReady()
session.capturePanel()       // detached browser-derived initial layout
session.measureText(request, context) // raw {width, height}, synchronous
```

`prepare` immediately deep-copies the explicitly supplied effective authored source. Each command has an independent snapshot even if widget IDs match. The internal object is not exposed: source access, font preparation and panel capture each receive/return detached copies. No row interpolation, expression evaluation, selected-effect application or runtime source lookup occurs here.

Capture the **pre-edit** panel using a pre-edit session after successful `fontsReady`; `capturePanel` throws until that requirement is met. A text/style edit uses a different prepared source for subsequent measurements. The parent host remains responsible for document/view/selection revision checks and for discarding a stale asynchronous command. A successful old-panel capture is explicitly `browser-derived`, not recovered native TextPanel storage.

The injected display service supplies support gating, font preparation and panel capture without modifying the existing display factory. Source supports its bounded unrotated selection domain. The separate measurement tree uses only safe `shapeText.paint` plus local structural DOM creation; no hidden imported closure is required. Bare factory serialization is tested with the platform `structuredClone` provided in its execution realm.

## Raw content measurement contract

Every service call uses `request.width` exactly and constructs a fresh connected, hidden isolated tree. It never derives a new request width from the owner's saved frame, never includes an input/indicator, and sets content padding/margin/border to zero. Paragraph alignment/absolute line height, run fonts/decorations, grouped links, empty paragraphs and explicit hard breaks are preserved. Literal markup remains text.

The tree's whitespace follows **`context.state.effectiveFit.width`**, not the old snapshot's fit flag. This matters when a fit-entry changes the shared flag before calling the service. Width fit uses nowrap and the planner's10000 request; constrained text uses normal wrapping and break-word. Extremely long width-fit content above10000px is explicitly unsupported, matching the existing bounded browser-display policy; no native KIf5 long-line wrapping behavior is inferred.

Default width reads full paragraph content Ranges, including links. Height reads the isolated block's line box. Returned dimensions retain fractional values; the pure planner remains responsible for AwayFromZero/ToEven rounding, reservation, alignment and the two independent measurement passes. In particular, the raw service neither implements nor duplicates the planner's non-width-fit empty-height16 rule.

Negative/nonfinite request widths or measurements fail explicitly. Every paint/read/projection failure removes temporary DOM in `finally`. The supplied Document is used throughout; there is no global Document lookup. A missing live document realm is rejected.

`measureText` remains synchronous and does not itself await fonts. The host must prepare fonts before geometry-changing author work. Font readiness is cached per immutable session; failed preparation propagates and permits a later retry. Readiness does not prove the absence of fallback glyphs. Browser metrics are not claimed equivalent to native graphics.

## Focused validation

The initial new-interface scaffold failed20/20 checks. After implementation,20/20 pass across module and bare-serialized execution, and `npm run typecheck` exits0. The raw-font DOM in these tests is a facade or explicit callback, not an actual browser font measurement.

The tests exercise snapshot mutation resistance, asynchronous panel readiness, source isolation, exact requested width, effective-fit changes, unrounded measurements, rich/link/break structure, default Range aggregation, cleanup/error handling, unsupported geometry, and direct integration with the real `planSelectionLayout`. The integration case supplies two distinct fractional measurements and verifies that only the planner rounds them to43×19 and63×21 while keeping the input unchanged.

The parent owns actual author-host wiring, undo/stale-command policy, browser coverage and release validation. No browser, native DLL, original GUI, build, package or full test suite was run by this helper task.
