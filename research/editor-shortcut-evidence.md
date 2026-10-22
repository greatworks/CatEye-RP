# Exact editor shortcut modifiers

This focused investigation supports separating complete keyboard chords in the
independent editor. It does not establish full Axure keyboard, focus, menu, or
native GUI equivalence. No original DLL was loaded or executed and no GUI input
was performed by this worker.

## Confirmed defect and public bindings

The pre-change `src/App.tsx` global handler lowered `event.key`, entered one
Ctrl/Meta branch, and ignored additional modifiers for most letters. As a result,
different documented commands reached the same ordinary operation.

The official [Axure keyboard reference](https://docs.axure.com/axure-rp/reference/keyboard-shortcuts/)
was read again on 2026-10-22. Its Windows table distinguishes:

| Chord | Documented action | Pre-change product dispatch |
|---|---|---|
| Ctrl+Alt+C | Center alignment | Copy |
| Ctrl+Shift+O | HTML generation | Open file |
| Ctrl+Alt+V | Paste style | Ordinary paste |
| Ctrl+Shift+Alt+D | Convert selection to a dynamic panel | Duplicate |
| Ctrl+Shift+Alt+P | Preview options | Edit points |

The page also gives distinct ordinary Copy, Open, Paste and Duplicate bindings,
and distinct Ctrl+Alt+P point mode and Ctrl+Shift+P pen bindings. The product
should route exact supported chords, and must not treat an unsupported modified
command as its unmodified destructive or clipboard operation. Command names in
this paragraph are documentation evidence, not decrypted binary captions.

## Original artifact corroboration

All new retained CIL is from Axure RP 11.0.0.4150 `AxureRP11.dll`, SHA-256
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
It reuses the identified distribution SHA-256
`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`
and extraction Evidence
`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`.
The PEReader scripts only inspect bytes and metadata.

`XHXg.zHX3` is the shortcut carrier (TypeDef 33559471). The retained generic
iterator method name in its owning command graph identifies it as the original
`CommandShortcut` type despite obfuscated runtime names.

- `vHXR` 100725745 reads `NHXL`; `uHXk` 100725746 reads `RHXK`.
- `QHXc` 100725747, IL0007–0014, returns their bitwise OR.
- Constructor 100725748, IL0090–00a3, calls the current platform's `GIoK` with
  the two supplied values and references to those fields.
- The already identified Windows provider `N1Je.x1Jx.GIoK` 100726557 copies
  parameter 1 to output 3 and parameter 2 to output 4 at IL0022–0024 and
  IL003f–0042. It preserves the supplied modifier/key pair.
- `Equals` 100725752, IL0077–0086, compares both carriers' `QHXc` results with
  `ceq`. `GetHashCode` 100725751 likewise hashes the combined AxKeys value.
- `RHXe.AHXx.CHXq` 100726277 puts primary and secondary commands into separate
  maps using `QHXc` at IL0095–00b8 and IL00f2–0115. A special digit registration
  branch and additional shortcut callbacks exist; this report does not claim
  that the complete keyboard lookup/dispatch graph has been reproduced.

The explicit `EFql.EFqs.Paste` 100682426 and `PasteStyle` 100682435 metadata
also show separate command methods. Their actual shortcut registration captions
remain obfuscated and were not decoded. No native body of these commands was run.

## Bounded instruction checks

`editor-shortcut-probe.mjs` interprets the retained Windows normalization,
combined-value getters and equality instructions. It verifies six pairs of
distinct documented chord values, identical-chord positive controls, all eight
Ctrl/Shift/Alt masks through the Windows copy, and null/non-shortcut rejection.
All checks pass. Explicit fixture fields substitute for shortcut construction;
constructor initialization and validation are not replayed. Opaque control-flow
fields use the already retained arithmetic initializer, without loading the DLL.

These are instruction-level checks, not native keyboard or GUI tests. Command
availability, keyboard layouts, AltGraph, IME, menu focus, Windows interception,
and exact behavior while typing remain separate verification obligations.

## Investigation failures and scope

The initial metadata script used an ambiguous PowerShell `GetToken` overload and
failed before output. Adding an explicit `EntityHandle` cast fixed it. An
intermediate ad-hoc parent-type listing failed PowerShell parsing at an empty
pipeline after `foreach`; the corrected parameterized metadata script replaced
that listing. No vendor execution occurred in either attempt. Final successful
records and their digests are bound by `editor-shortcut-evidence.json`.

Only new `research/editor-shortcut-*` evidence files were authored here. Product
changes and browser/package verification belong to the integration stage.
