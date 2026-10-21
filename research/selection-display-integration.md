# Selection control display integration

2026-10-20. Unreleased source stage; full Axure parity remains false. Ordinary checkbox/radio indicators and a transient browser-derived author text panel now render in the editor, Preview, offline HTML, fixed frame player and serialized child-frame bootstrap. No original Axure GUI or pixel comparison was possible in this stage.

## Behavior and scope

`createSelectionTextLayout` measures a connected isolated rich-text copy, including links, hard breaks and per-run fonts. It uses the requested 10000px width for width-fit or the owner width less indicator and horizontal padding for constrained text. Source-derived rounding and WIyL/CNUW placement produce the panel, text CSS rectangle and local indicator rectangle. DOM shaping/line boxes are independent browser substitutes for the native font engine. Width-fit content exceeding 10000px is explicitly outside the supported measurement domain. Single empty text versus multiple empty paragraphs follows the documented product text model, not a newly proved native IsEmpty getter.

`selectionDisplaySource` reads an immutable ordinary authored declaration plus the current adaptive declaration, including its explicit rich-font patch. It deliberately measures authored literal text, not a later Loaded/ItemLoaded/SetText result, variable expansion, row value or transient state font. This is a documented bootstrap policy for the unavailable original TextPanel cache. Every label has its own cache. Fonts becoming ready refresh only that display cache. Stale requests, changed sources, disconnected labels, unsupported paint and failed measurements cannot commit an old layout.

The text writer relationship is owner → absolute full-size label → SVG and text; its transparent 0×0 input is a separate owner child associated by a unique `for`/id. Text left is panel.x−leftPadding, width is panel.width+leftPadding+rightPadding, and height is omitted. The new retained nNLd evidence confirms **all four padding sides** and border-box, including top/bottom after panel placement.

The bounded indicator renderer requires explicit selection flags/P94/padding/alignment, rotation0, opaque supported solid colors, uniform full borders, radius0, and buttonSize>strokeWidth≥0. Checkbox fill occupies the full P94 square; outline is inset by half the authored stroke. Radio fill/outline use the recovered four cubic segments, not an SVG mathematical circle. Checkbox mark uses the recovered three points and 3×P94/14 pen. Radio dot uses the recovered cubic path and initial fill-only drawing. Mark visibility uses `selected ?? checked`; the real input separately uses `checked`.

The b×b overflow-visible SVG viewport is an independent implementation choice. It is not a claim about the native asset's final crop/viewBox. Unsupported source styling retains the legacy renderer; an unsupported live paint change cancels the managed cache and falls back. Complex gradient fallback was exercised in the browser. Full native state/adaptive asset replacement, P94 state changes and the later `_applySvg` radio stroke mutation remain incomplete.

No import/save/render/font completion/Preview operation changes the stored owner rectangle. The existing managed author transaction adapter remains separate and is not called by rendering. Runtime SetText still uses its own direct-paragraph-span measurement, skips Resize, can move for alignment and rejects the evidenced invalid height-AutoFit branch. Long nowrap text can extend past the saved owner, and a right-side indicator can consequently overlap a longer runtime replacement; the fixture makes this visible without silently resizing the owner.

## Integration defects found and fixed

- Independent lifecycle review reproduced old font requests painting after an unsupported/empty measurement update, and cache-hit painter failures escaping fallback. All six module/serialized failures now pass; old test/source evidence is retained.
- First production browser run exposed a class collision with the editor's selection-frame caption. The control now uses `selection-control-label`; native input activation remains available.
- An offline checkbox Click action could flush DOM before native Change, restoring the old checked property. A retained real-browser event trace shows Click captured true and subsequent Input/Change observed false. Both hosts now retain the browser activation value through Change without reordering the shared runtime events. Label bubbling is stopped while default input activation continues, so owner Click runs once.
- Focus remains on the input; visible-owner bounds supply case-menu/event anchors for the zero-sized input.
- The live-style guard now checks the current paint as well as the original source, preventing unsupported gradient/shadow paint from entering the bounded SVG branch.

## Validation

| Check | Result and exact scope |
|---|---|
| Full unit suite | 5,418/5,418; zero failed/pending; includes 56 layout, 18 declaration, 24 host-lifecycle and 261 indicator tests |
| TypeScript and production build | Passed; build `.build/selection-layout-display-second-dist`, unchanged production inputs |
| Final production Edge tests | 20/20, zero flaky/skipped/failed; `.build/selection-display-final.json` |
| New indicator source evidence | 60/60 bounded CIL-record probes; 87 manifest files independently rehashed |
| Saved data | Whole-document equality after Preview/HTML export and frame checks |
| Offline operation | Main and serialized child frame exercised with network disabled and zero HTTP(S) requests |
| Visual inspection | Final long-label Preview, offline and fixed-frame screenshots opened and reviewed |
| Reader | Earlier 856 checks reused only after verifying unchanged reader inputs; no new importer changes |
| Historical package/evidence | Existing release archive/ASAR and 1,535 historical evidence identities verified; this stage is not packaged or released |

The first production run is retained as `.build/selection-display-first.json` (3 passed, 2 failed), followed by `.build/selection-display-second.json` (19 passed). The final run expands frame/fallback coverage to 20. The full unit run precedes only the final E2E fixture expansion; production and unit-test inputs are unchanged. The older broad 337-browser run belongs to the earlier runtime-measurement build and is **not** a full regression of this build.

Source boundaries and independent review: [border/text padding](selection-layout-border-evidence.md), [indicator review](selection-indicator-review.md), [declaration review](selection-display-host-review.md), [host red](selection-display-host-review-red.md), [host green](selection-display-host-review-green.md), [layout factory](selection-display-layout-implementation.md). Final source hashes, tests, screenshots and preservation checks are recorded in [verification](selection-display-verification.json).

## Work remaining

Native font/graphics equivalence; author Size/fit/style gestures with pre-edit panel snapshots and one undoable command; initial selected-state font measurement; complete gradients/corners/shadows/transforms and SVG state assets; right-indicator native admission; final full-stage regression and Windows packaging. The original GUI screenshot/input bridge remains blocked as recorded in `selection-layout-gui-observation-20261020.md`; no unchanged retry or new original screenshot claim was made. Native `.rp` writeback and the broader full Axure feature set remain on the project gap inventory.
