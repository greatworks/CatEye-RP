# CatEye-RP

[简体中文](README.md) | **English**

An independent Windows prototype editor developed by studying Axure RP 11. The current version is **0.1.0 (development)**.

This branch contains the source milestone verified as of October 21, 2026. It adds text measurement, SVG rendering, Inspector size controls, text auto-fit, and indicator placement for checkboxes and radio buttons. This source milestone has not yet completed Windows package acceptance or a full browser regression run. The previously verified Windows release covers the earlier group-resize milestone.

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
- Checkbox and radio text measurement, SVG indicators with limited style support, size and text auto-fit, left/right indicator placement, and a single undo step per authoring command.
- Saving and opening `.rea.json` projects, previewing prototypes, exporting standalone offline HTML, and experimental read-only import of a supported subset of Axure `.rp` files.

## Validation and limitations

The latest source milestone passed 5,469 unit tests and 29 focused production-browser checks. The earlier 856 reader checks are reused after verifying that their inputs are unchanged. See the [latest source verification](research/selection-author-verification.json), [upload milestone record](docs/github-milestone.json), and [implementation status](docs/implementation-status.md). The earlier Windows group-resize release is documented in its [release verification](research/layer-resize-verification.json).

P94 authoring entry points, resize handles for selection controls, container-local coordinates, complex rendering, full Axure feature coverage, native file writeback, cloud collaboration, and comparison with the original application's GUI and pixels remain incomplete. Passing this project's tests does not establish full Axure compatibility.

## Tests and data

Run `npm test`. Some native-import tests require you to supply the corresponding original Axure samples in `research/samples/`. Large research data files use Git LFS. Original vendor applications, private samples, dependencies, and packaged application builds are not distributed with the source. Fonts and other third-party resources retain their licenses and notices.
