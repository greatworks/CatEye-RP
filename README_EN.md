# CatEye-RP

[简体中文](README.md) | **English**

A free, open-source Windows product prototyping tool developed independently by studying Axure RP 11. The current version is **0.1.0 (development)**.

This branch contains source verified as of October 22, 2026. It adds exact shortcut-chord matching and context guards, ordinary page-tab history navigation and visual-order cycling, closing current/all tabs, and draft-commit protection during navigation. Earlier selection-control rendering, resizing, and text auto-fit remain included. The latest source has been checked in a separate Windows test package; the published release has not been replaced.

<img width="2560" height="1519" alt="CatEye RP_17926446259633" src="https://github.com/user-attachments/assets/ea2a9681-f221-484d-8eae-e85eee202659" />

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

- Exact shortcut matching and context guards for dialogs, tables, and vector editing, with access to existing alignment, tools, preview, export, grid, and zoom commands.
- Page-tab history navigation, visual-order cycling, closing current/all tabs, and safe navigation while rich-text drafts or gestures are pending.

- Page and canvas editing, rich text, vectors, tables, menus, trees, and styling.
- Conditional interactions, expressions, dynamic panels, repeaters, components, and adaptive views.
- Nested groups, group interactions, eight-direction group resizing, and fixed-size constraints.
- Checkbox and radio creation defaults, text measurement and auto-fit, left/right indicators, resize handles, grid and modifier-key handling, multi-selection rotation, and one undo step per authoring command.
- Bounded SVG state rendering, adaptive-view scaling history, clipping, and radio-dot paths.
- Saving and opening `.rea.json` projects, previewing prototypes, exporting standalone offline HTML, and experimental read-only import of a supported subset of Axure `.rp` files.

## Validation and limitations

The latest page-tab milestone passed 6,219 unit tests, 86 related production-browser checks, and 3 groups of Windows test-package checks. The earlier 411 full browser checks and 14 desktop suites belong to an older candidate and do not cover all subsequent changes. See the [latest source verification](research/page-tabs-final-verification.json), [shortcut verification](research/editor-shortcuts-verification.json), [upload record](docs/github-milestone.json), and [implementation status](docs/implementation-status.md).

Gallery participation and visibility, component/open-context identity, complete menu and focus behavior, macOS shortcuts, complex state/container combinations, general transforms, native font/DPI behavior, original GUI/pixel comparison, complete native-file compatibility and writeback, cloud collaboration, and full Axure feature coverage remain incomplete. Passing this project's tests does not establish full Axure compatibility.

## Tests and data

Run `npm test`. Some native-import tests require you to supply the corresponding original Axure samples in `research/samples/`. Large research data files use Git LFS. Original vendor applications, private samples, dependencies, and packaged application builds are not distributed with the source. Fonts and other third-party resources retain their licenses and notices.
