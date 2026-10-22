# Selection adaptive SVG integration

Date: 2026-10-21. Status: implemented and verified within the scope below; not published.

`fullAxureParity=false`; `originalGuiCompared=false`; `published=false`.

## Change and evidence

The ordinary checkbox/radio runtime retains an initial logical SVG asset and a separate history of adaptive CSS scale. The original runtime reads the current computed matrix before applying each named adaptive size. The generated owner → label → SVG nesting means the direct-child style reset does not clear that SVG. Returning to Base repaints normal styles without removing the matrix. Reapplying the same view through the public selector does not apply it again.

The independent renderer now assigns the runtime snapshot absolutely; React rendering, cached text measurement, delayed font completion and state paint must never multiply a DOM matrix. Authoring or a fresh asset clears a previously assigned transform. Both axes, including zero, are retained together; the original CSS rejects a non-finite transform request as a whole while still accepting its transform origin.

The initial numerical hypothesis, rounding an arbitrary JavaScript double to six significant digits, was rejected by browser controls. The tested Chromium computed matrix first reflects float32 conversion, then six-significant-digit serialization with ties to even; very large finite values clamp at the float32 maximum. The runtime reconstructs the exact float32 rational for decimal rounding and keeps the submitted scale separately from the computed value used by the next multiplication. Browser-side serialization is evidence for the tested Chromium environment, not a cross-browser specification claim.

The runtime snapshot helper also needed a real fix. Previously it copied serializable paint state into a fresh factory while losing adaptive view identity, forced/auto mode, viewport and initialization phase. A second helper call could treat the same view as a new transition, resetting an action result and eventually multiplying the SVG twice. A fresh-only constructor snapshot input restores this state without dispatching another adaptive event. Snapshots with no adaptive carrier retain their previous unmanaged behavior. This state is not saved into an authored `.rea.json` document.

## Independent-model mapping and limits

- A declared width or height in this product maps to a complete adaptive size pair using the effective declarations/base for an absent companion axis. Runtime Move/Resize/SetText results are not inputs to this mapping. This is an explicit adaptation of the product schema; native single-axis size serialization has not been proven.
- P94-only and no-size declarations do not synthesize a size. P94 can affect independent text placement while the initial SVG geometry remains fixed.
- The original `style.size` field can also appear in state carriers; this product's `WidgetStyle` cannot express that native carrier. The full original state/adaptive space is not covered.
- Recreated product repeater rows get new logical assets. Native pre-generated row reuse is a separate unresolved lifecycle.
- Unsupported complex paint remains on the existing sticky native-input fallback until logical asset regeneration. Adaptive scaling does not expand the verified geometry or paint subset.
- The product still uses a b×b, overflow-visible SVG viewport. New retained CIL evidence proves a different native CSS rectangle, no generated inline viewBox, and padding dependent on stroke width, but does not close the complete body transform/crop. Applying that partial evidence to path coordinates would be a guess. See `selection-svg-bounds-evidence.md`.
- No original GUI capture or interaction bridge was retried. These are retained-code/browser-runtime observations and independent-product tests, not an original editor pixel comparison. Native `.rp` writeback and full Axure parity remain open.

## Files and failure history

Production scope: `src/model/selection-indicator.ts`, `src/runtime/export-runtime.ts`, `src/runtime/engine.ts`, and runtime-only types in `src/model/types.ts`. Existing host/export/frame factories carry the paint snapshot without a separate imperative scale channel.

Tests: renderer snapshot validation/projection, late-font snapshot forwarding, module and bare-serialized runtime transitions, snapshot helper behavior, and production browser Preview/embedded-frame/offline HTML routes. The browser fixture checks stable paths and input identity, actual transformed bounds, unaffected owner/label transforms, repeated-view suppression, state paint, Base return, and four fractional transitions.

Retained failures:

1. Renderer red: 389 passed / 4 failed, with missing CSS projection and missing invalid-pair rejection. The renderer/host green run followed the implementation.
2. Snapshot red: 0/9 passed. The failures independently showed wrong adaptive width, lost action position on same-view selection, lost viewport on navigation, and lost Loaded phase; they were not manufactured by the new scale field.
3. First browser red: 0/3 passed against the prior frozen production build. Its fixture initially inherited the new-document automatic view policy. That fixture source is preserved in `.build/selection-adaptive-browser-initial.spec.ts`; a corrected fixture explicitly starts at Base under the supported legacy threshold policy. The corrected second red also failed 0/3 on the missing matrix.
4. Source probe interpreter/JavaScript fixture failures remain with the evidence worker's artifacts; reports distinguish them from original behavior. They are not hidden by regenerated result files.
5. The runtime's midpoint red had two real precision failures and two incorrect legacy Resize expectations. Legacy numeric Resize changes the owner while leaving SVG scale alone; typed Resize retains its existing selection exclusion. The test expectation was corrected without changing that compatibility behavior. Full details and retained 383/383 focused results are in `selection-adaptive-runtime-implementation.md`.
6. After the first full 6,075-test pass, two new held-state-reference tests exposed stale adaptive metadata. Synchronizing on actual identity/policy/phase changes fixed the issue. Final source then passed all 6,077 tests and a new production build/browser run; the first build and reports remain intact.
7. The first hidden desktop capture showed the embedded frame at a previous visual step although its final DOM matrix assertion had passed. The first audit/screenshots remain intact. A new smoke synchronizes fonts and two animation frames in every child frame and records each matrix/bounding box before capture. The corrected embedded screenshot visibly matches the final 6×9 scale; the other two screenshots are byte-identical to the originals. No product change was needed for this capture synchronization.

## Verification

Final source passed:

- `npx tsc --noEmit` and `npx vite build --outDir .build/selection-adaptive-final-dist`.
- `npx vitest run --maxWorkers=4`: **6,077/6,077**, with the existing timeout unchanged.
- `npx playwright test --config .build/selection-adaptive-final.playwright.config.ts`: **21/21** production browser checks across adaptive SVG, selection display, library creation and state paint. This is not a repeat of the complete application browser suite.
- A new packaged Windows executable: **3/3** behavior groups covering native open/save, Preview history/restart/unchanged document, actual offline export and embedded frame. File-picker responses are test-controlled; all windows stay hidden, and no page errors or network requests occurred. This is not the complete historical desktop suite.
- Three final desktop screenshots were visually reviewed. The intentional 6×9 test magnifies the indicators into nearby unscaled text; this is not presented as a normal design layout or original-editor pixel comparison.
- The ASAR audit matched all 15 application files, 20 ASAR entries, and 22 separately licensed fonts. No proprietary Axure code or assets were packaged. App ASAR SHA-256: `cda91e18032e74186859af8cdf90713794659f4f3f8896097a702785ef3aac90`.

The baseline verified all 650 prior source snapshots, 506 prior evidence entries and 5 protected artifacts, with zero live-source differences before this stage. Final verification also protects the preceding stage's own package. New reports/build/package outputs use `selection-adaptive-*` names and do not overwrite the prior `selection-state-verification.json`, frozen builds, candidate ZIP or published artifacts.

Final machine-readable record: `selection-adaptive-verification.json`. Research provenance: `selection-adaptive-svg-manifest-complete.json` (44 entries), `selection-svg-bounds-manifest.json` (73 entries), and `selection-adaptive-runtime-manifest.json` (58 entries). Source coverage is 58 original adaptive sequences/292 steps plus 8 numerical sequences/36 steps, 27 rounding controls, and 13 retained native-bounds projections; these numbers are separate from product test counts.

Next evidence gate: compose the native SVG graphics-command/body transform with the known CSS padding before changing crop or viewBox. Original GUI/pixel comparison and full feature parity remain unresolved.
