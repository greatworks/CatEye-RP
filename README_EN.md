# CatEye-RP

[简体中文](README.md) | **English**

An independent Windows prototype editor developed by studying Axure RP 11. The current version is **0.1.0 (development)**.

This branch contains source verified as of October 21, 2026. It now includes creation defaults, text measurement and auto-fit, resize handles, grid and modifier-key handling, multi-selection rotation, and bounded SVG state rendering, adaptive scaling, and clipping for checkboxes and radio buttons. The latest changes have been checked in a separate Windows test package. The published release remains the earlier group-resize milestone; full application regression and release promotion of the latest build are still pending.

## Getting started

Install Node.js, npm, and Git LFS, then run:

```powershell
git lfs install
git lfs pull
npm ci
npm run dev
```

Open the local URL printed in the terminal. To run the desktop application:

```powershell
npm run build
npm run desktop
```

Use `npm run package:win` to create a portable Windows package.

## Current capabilities

- Page and canvas editing, rich text, vectors, tables, menus, trees, and styling.
- Conditional interactions, expressions, dynamic panels, repeaters, components, and adaptive views.
- Nested groups, group interactions, eight-direction group resizing, and fixed-size constraints.
- Checkbox and radio creation defaults, text measurement and auto-fit, left/right indicators, resize handles, grid and modifier-key handling, multi-selection rotation, and one undo step per authoring command.
- Bounded SVG state rendering, adaptive-view scaling history, clipping, and radio-dot paths.
- Saving and opening `.rea.json` projects, previewing prototypes, exporting standalone offline HTML, and experimental read-only import of a supported subset of Axure `.rp` files.

## Validation and limitations

The latest SVG bounds/clipping milestone passed 6,192 unit tests, 21 focused production-browser checks, and 3 groups of Windows test-package checks. The earlier selection-control candidate passed 411 full browser checks and 14 desktop suites on an older build; those results do not cover all subsequent changes. See the [latest source verification](research/selection-svg-body-verification.json), [upload milestone record](docs/github-milestone.json), and [implementation status](docs/implementation-status.md). The earlier group-resize release is documented in its [release verification](research/layer-resize-verification.json).

Complex state/container combinations, general transforms, native font/DPI behavior, comparison with the original application's GUI and pixels, complete native-file compatibility and writeback, cloud collaboration, and full Axure feature coverage remain incomplete. Passing this project's tests does not establish full Axure compatibility.

## Tests and data

Run `npm test`. Some native-import tests require you to supply the corresponding original Axure samples in `research/samples/`. Large research data files use Git LFS. Original vendor applications, private samples, dependencies, and packaged application builds are not distributed with the source. Fonts and other third-party resources retain their licenses and notices.
