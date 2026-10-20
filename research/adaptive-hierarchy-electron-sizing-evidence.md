# Adaptive hierarchy packaged viewport-size investigation

## First failure preserved

The first exact-package smoke reached its final offline height matrix after passing preview/file inheritance, same-view state retention, cross-view state reset, and two-level frame height changes. It requested a 390×499 content area but observed `innerWidth=390`, `innerHeight=500`, so the harness's exact-size assertion failed before claiming the lower height boundary.

The untouched failure audit, log, previous smoke script, and four screenshots are copied into `.build/adaptive-hierarchy-primary-first-failure/`. Its `manifest.json` records each original path, preserved path and SHA-256. The failure audit SHA-256 is `54c633d078b8517d378578ba423beaa3f69c76534fbc8f463f378bd72e181a1a`; the log SHA-256 is `a9381078dd66085163ba98a52e4c57952446243402f9791e168b4762696c890b`.

## Isolated actual Electron observations

`adaptive-hierarchy-electron-sizing-probe.mjs` launches the same packaged executable and creates a separate hidden `about:blank` BrowserWindow with the smoke's sandbox/context-isolation/background-throttling settings. It makes 20 content-size requests, waits for two animation frames, and records both Electron host dimensions and actual DOM viewport dimensions. This is execution of the packaged Electron/Chromium window, not an original Axure GUI probe and not a simulated dimension formula.

Observed host: Electron 44.7.0, Chromium 152.0.7977.130, Windows display scale 1.5, DOM DPR 1.5, page zoom 1. Window minimum size is `[0,0]` and every probe window remains hidden.

| Requested content size | Host content size / DOM viewport |
| --- | --- |
| 390×300 | 390×300 |
| 390×495 / 497 / 499 / 501 / 503 / 505 | 390×496 / 498 / 500 / 502 / 504 / 506 |
| 390×496 / 498 / 500 / 502 / 504 / 900 | unchanged |
| 387 / 389 / 391 wide, height 900 | 388 / 390 / 392 wide, height 900 |
| 386 / 388 / 390 / 392 wide, height 900 | unchanged |

This rules out a 500-pixel minimum height. On this tested Windows/scale/window configuration, odd requested dimensions were rounded upward while the tested even dimensions were exactly reachable. The investigation does not claim this rounding rule for every display scale, OS, frame decoration or Electron version.

## Narrow harness correction and exact-package result

Only `scripts/smoke-adaptive-hierarchy.mjs` changed. Its desktop boundary requests now use height 498/500 and width 388/390, retaining strict actual-equals-requested assertions. Every resize records requested and actual sizes, host content size, DPR, scale and zoom. The audit explicitly says it did **not** test an actual desktop height of 499. The existing real-browser regression continues to test exact 499/500 and 389/390; it was not weakened or changed.

The complete primary smoke then passed against the same app.asar SHA-256 `4651baefd414de3f1dccd8d39bf98240e2473de243d7521bf83f733ff1f91dff`. The five final file-window cases were:

- Actual 390×498 → marker width 180.
- Actual 390×500 → marker width 260.
- Actual 390×300 → marker width 180.
- Actual 388×900 → Base marker width 160.
- Actual 390×900 → marker width 260.

The final audit also confirms four unchanged saves, save/reopen, preview and file playback, two nested frames, unchanged source/package hashes, hidden windows, and empty page-error/console-error/request-failure/network arrays. Final output: `.build/adaptive-hierarchy-desktop-audit.json`; log: `.build/adaptive-hierarchy-desktop-second.log`. No product source, browser test, package or original research evidence was modified for this correction.
