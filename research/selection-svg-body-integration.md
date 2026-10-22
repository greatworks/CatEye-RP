# Selection SVG viewport and body integration

Date: 2026-10-21. Scope: ordinary unrotated Checkbox / RadioButton with solid paint, BoxModel0, no corner effects or shadows. This is an independent implementation based on retained source instructions and controlled browser observations. `fullAxureParity=false`, `originalGuiCompared=false`, `published=false`.

## Change and reason

The previous renderer forced a b×b viewBox and root dimensions and explicitly allowed SVG overflow. Retained native bounds and the inline rewrite instead establish CSS-only dimensions, no viewBox, and an expanded viewport. Controlled Edge observations show that the inline viewport clips its contents. The renderer now removes obsolete viewBox/width/height attributes from retained SVG nodes and projects the declaration's crop with hidden overflow.

For logical indicator origin (x,y), declaration size b and declaration stroke w, w≤1 gives (x,y,b+1,b+1); w>1 gives (x−w/2,y−w/2,b+w+1,b+w+1). The named-view writer recomputes this rectangle from the effective normal declaration and writes the view class CSS. It discards the returned asset string on that path and does not replace the inline body. This does not establish that no additional asset files are generated or cached internally.

Captured initial path geometry, current declaration crop, runtime paint attributes and event-driven CSS scale remain independent. SetStyle stroke changes do not feed back into the declaration crop. A P94-only view changes the crop without recreating paths or advancing scale. Returning Base restores its crop while preserving scale history. The matrix evidence gives positive drawing translation and negative origin wrapper, with net identity for the scoped case; no padding compensation group was added.

The new viewport calculation validates declaration b/w independently of the captured asset. Missing/nonfinite/negative values and an overflowed computed size are rejected before SVG writes. A finite declaration stroke larger than the captured asset remains allowed: the CSS crop and initial path are separate contracts.

The final radio-dot writer also established a representation difference: four cubics begin at bottom-mid and return to that point without ClosePath. The previous product used the same filled outline starting at top-mid with Z. The renderer now preserves the native start/order and absence of Z so later runtime strokes do not gain an extra closing join. This removes a known command difference; it is not a claim of original stroke-seam pixel equivalence. The final body oracle compares all segments and initial paint, with separate native positive/negative/zero origin controls.

## Source evidence

- `selection-svg-bounds-evidence.md`: 13 retained root/CSS projections, including a separate explicit-viewBox rewrite control.
- `selection-svg-body-matrix-evidence.md`: 18 command/fold/save/restore cases, 52 retained methods, ordered column-vector composition and explicit facades.
- `selection-svg-body-view-css-evidence.md`: current-view provider/update chain, normal adaptive writer, and 12 retained crop/CSS consumer cases. Browser-derived text placement is still an independent-model adaptation.
- `selection-svg-body-css-evidence.md`: 24 browser clipping controls, corrected visual control, and the explicit synthetic-body limitation.
- `selection-svg-body-paint-evidence.md`: 20 final cases / 60 paths, actual retained path/group writers, positive/negative/zero origins and transparent paint. Full TIdc entry and native ink bounds remain explicitly outside the interpreted slice. No original DLL or GUI is executed by these probes.
- `selection-svg-body-matrix-supplement.md`: full radio ellipse adjustment, zero-angle upstream matrix scope and an independent comparison of the corrected product's four dot curves.

## Reproduced failures and corrections

1. The new independent root matrix initially had 1 passing oracle-integrity check and 52 failing behavior checks. The first root fix made all 53 pass; the existing renderer/host checks gave 474/474 combined.
2. Review identified missing validation of declaration b/w when a valid captured asset was supplied. Sixteen new invalid-input checks failed before the guard. After the guard and four declaration-versus-asset checks, the focused renderer/host result is 496/496.
3. The initial CSS illustration cloned an owner but lost `#u`-specific positioning. Its 24 case assertions were unaffected; the original image is retained, and the separately generated corrected image was visually reviewed.
4. The first browser red configuration omitted the repository working directory. The server rejected its dist path before running a test. A new configuration with explicit cwd then reproduced all three new route failures against the frozen prior build.
5. The first candidate browser run passed 18 existing cases and failed the three added clipping probes: the label's text sibling occluded the right-hand visible-overflow control. A temporary z-index in the disposable probe removed that occlusion, and its original style is restored in `finally`. Production code was not changed for this fixture correction. The corrected three-route run passed.
6. The first final-body oracle fixture incorrectly assigned opaque white fill to its four alpha cases, producing eight failures across module/serialized modes. The fixture now uses the oracle's input alpha for both fill and stroke; the initial fixture and report are retained.
7. Requiring the original radio dot's start and absence of Z reproduced 20 failures before the product fix (516 passed). The dot change and the older ellipse-primitive oracle's cyclic-start adjustment then passed all 536 focused cases. The latter still checks every cubic; the newer writer oracle independently pins the command start and no-Z state.

All initial logs, JSON results, screenshots and fixtures are retained under `selection-svg-body-*`; historical adaptive snapshots, evidence and packages are not overwritten. The pre-dot candidate also passed its 21 browser cases and 3 desktop groups; it is retained separately and is not the final deliverable.

## Final verification

- `npx tsc --noEmit`: passed, `.build/selection-svg-body-typecheck-final.log`.
- `npx vitest run --maxWorkers=4 --reporter=json --outputFile=.build/selection-svg-body-unit-final.json`: **6,192/6,192** passed, with the existing timeout unchanged.
- Production build: `.build/selection-svg-body-corrected-dist`, generated with `npx vite build --outDir .build/selection-svg-body-corrected-dist`.
- `npx playwright test --config .build/selection-svg-body-corrected.playwright.config.ts`: **21/21** passed. Includes Preview/offline/iframe crop, declaration changes, actual clipping controls, stable paths/input identity, retained scale, same-view/repaint behavior and unchanged save data.
- Actual hidden Windows package: **3/3 groups** passed (open/save; Preview history/restart/save; offline export and embedded page). Native picker responses are deliberately mocked, not an operating-system picker comparison. No page errors or HTTP(S) requests occurred.
- All three final desktop screenshots were visually inspected after fonts and two animation frames in every frame. Final 6×9 matrices and 90×135 CSS viewport bounds are recorded before capture. The deliberately large indicator/text overlap is part of the scale-history fixture, not a normal-layout claim. These images are byte-identical to the pre-dot candidate for this particular capture; this does not prove all stroke/raster cases equivalent.
- Packaged app files match final build/source bytes. The ASAR has 20 entries and embeds the 22 separately Apache-2.0-licensed fonts; no proprietary Axure code or assets are packaged. Final ASAR SHA256: `3ea99937ccf7571c07539a17c140a052143fc5219364b517a963524c9dcf9960`.

The final executable is `.build/selection-svg-body-corrected-package/REA Prototype Studio-win32-x64/REA Prototype Studio.exe`. Source/build/evidence identities and preservation checks are recorded by `selection-svg-body-verification.json`.

## Remaining boundaries

The implementation does not prove original editor GUI/pixel equivalence, native font/DPI measurement, all interaction-state generator caches, master/rotated/container combinations, cross-browser rasterization or native `.rp` writeback. The existing unsupported-paint fallback remains. Full application browser and historical desktop suites are distinct from the focused acceptance suite used for this change. This stage does not publish or replace the prior candidate/release.
