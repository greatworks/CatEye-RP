# Selection inline SVG clipping controls

Date: 2026-10-21. This is a controlled browser observation of the retained inline-root envelope and the original `axure_rp_page.css`. It does not execute AxureRP11.dll, operate the original editor, recover native body paths, or establish pixel parity.

`selection-svg-body-css-probes.json` records **24/24** passing cases: logical size 14/18, source stroke 0/1/3, left/right indicator placement, and no transform versus CSS `scale(2,3)` with top-left origin. Edge 155.0.4283.62 ran at device scale factor 1. The envelope comes from the separately retained bounds projection; the child is an explicitly synthetic blue rectangle extending 5 units beyond every side of the viewport.

The inline SVG has no viewBox or width/height attributes. Its CSS width and height are the bounds oracle's 15/18/19/22 values. Computed SVG overflow is `hidden`; its label and owner retain `visible`. Loading the original common page stylesheet does not change any recorded root attribute, overflow value, viewport, body bounding box, or hit result. The inside point hits the rectangle while points one CSS pixel outside the viewport do not. Setting `overflow:visible` makes those outside points hit the same rectangle. This holds after the 2×3 transform as well. No page errors occurred.

The current product explicitly sets `overflow:visible` on the inline SVG. That differs from this observed root behavior. The browser controls support clipping to the CSS viewport, but cannot determine where the native fill, outline or mark should lie inside it. That placement is a separate matrix/path evidence question.

## Screenshot correction

The first probe's 24 independent assertions passed, but its final illustrative screenshot cloned an owner while retaining selectors restricted to `#u` and `#u label`. The clone lost owner/label positioning. The initial screenshot and result are preserved as failure evidence and are **not** the visual acceptance image.

`selection-svg-body-css-visual-control.mjs` creates two independently positioned controls using the same final 22×22, scale 2×3 fixture. It verifies both viewport rectangles (44×66), equal y=150, overflow modes and inside/outside hit results before capture. `selection-svg-body-css-visual-control.json` records the correction and source hashes. The corrected screenshot `.build/selection-svg-body-css-control-corrected.png` was visually inspected: the left rectangle clips to the viewport; the right rectangle extends 10 horizontal and 15 vertical pixels beyond it. These are synthetic controls, not original Axure screenshots.

## Limits

This checks one Chromium/Edge version and DPR 1. Browser hit testing is corroborated by the corrected screenshot, but does not establish cross-browser antialiasing, original application DPI/font behavior, shadows, rotation, complex paint, adaptive class generation or full emitted native SVG markup. `fullAxureParity=false`, `originalGuiCompared=false`, `published=false` remain unchanged.
