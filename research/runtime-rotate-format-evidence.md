# Native Rotate action: RP 11 format and strict recovery

The pinned corpus contains seven native Rotate actions. Three complete interactions are now recoverable: two UI-pattern Load actions targeting their own widget, and one Basics Click action targeting a separate widget. Four Form-pattern events remain rejected atomically because other actions are unsupported. No widgets were added or removed.

This report accompanies the unchanged `runtime-rotate-format-evidence.json` (SHA-256 `db9fe15315ad2a48aa1d1bd84ec2a03a3f9f5c89c4d4236161fe3bdab1109c11`) and `runtime-rotate-format-import-audit.json` (`f290630bea46a048fa300a3892100a05c27d69e9b0c7afbaba0831ed82b35c26`). The evidence is static ECMA-335 metadata/CIL, retained literal decoding, bounded control-flow replay with declared sinks, and independent reader/import comparison. **No original DLL methods or original Axure GUI were executed.**

## Source and carrier

The original assembly is `C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll`, version **11.0.0.4150**, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

`IxRotateWidgetAction` (TypeDef `33557823`) serializes as `Axure:InteractionRotateWidgetAction`. Its complete observed action has `Disabled`, `panelobjectpaths`, legacy `Paths`, and parallel `Infos`. `RotateWidgetInfo` (TypeDef `33557825`) has these eight fields:

| Stored field | Proven type and meaning |
| --- | --- |
| `RotateType` | `MoveBehavior`: `Location=0` means To; `Delta=1` means By |
| `Degree` | Local `StringLiteral` reference |
| `Clockwise` | Boolean |
| `OffsetX`, `OffsetY` | Separate local `StringLiteral` references |
| `Anchor` | String, emitted verbatim |
| `Easing` | `AnimationEasing` enum, values 0–32 |
| `Duration` | Double, milliseconds |

Writer `NIwY` **100705013**, reader `oIw4` **100705014**, and constructor **100704990** are retained in `runtime-rotate-format-info-cil.json`. Constructor defaults are By, degree `"0"`, clockwise true, center, offsets `"0"`, and None easing. Factory `vIyQ` **100704959** requests duration 500 through `tNAH` **100704744**; a prior `IxAction.Durations[typeName]` entry wins. Thus 500 ms is a fallback, not an unconditional persisted default.

## Generator and authoring boundary

Generator `HJMD` **100694363**, field writer **100694557**, and options writer **100694558** emit `rotateType`, `degree`, independent `offsetX`/`offsetY`, anchor, and options. `FJMQ` **100694397** uses enum names and `AJCR` **100694419** lowercases only their first character. Clockwise is always emitted; easing and duration are omitted when easing is None.

The exact easing enum order (0 through 32) is:

```text
none, swing, linear, easeInCubic, easeOutCubic, easeInOutCubic,
easeOutBounce, easeOutElastic, easeInSine, easeInQuad, easeInQuart,
easeInQuint, easeInExpo, easeInCirc, easeInBack, easeInElastic,
easeInBounce, easeOutSine, easeOutQuad, easeOutQuart, easeOutQuint,
easeOutExpo, easeOutCirc, easeOutBack, easeInOutSine, easeInOutQuad,
easeInOutQuart, easeInOutQuint, easeInOutExpo, easeInOutCirc,
easeInOutBack, easeInOutElastic, easeInOutBounce
```

Center is proven by the constructor. Real files witness center and `top right`; the literal pool also contains the other three combined corner strings. The complete original UI binding list is **not** closed. The product's canonical nine anchors (`top left`, `top`, `top right`, `left`, `center`, `right`, `bottom left`, `bottom`, `bottom right`) are independently compatible with the shipped runtime's substring rules; this is not a claim that all nine exact UI labels were recovered.

The action filter **100704954** permits VectorShape, ImageBox, ImageMapRegion, DynamicPanel, and Layer. Native event enum field **67121735** identifies `OnRotate=279`; it is not a Page event. Separate runtime motion/easing evidence is in `runtime-rotate-motion-evidence.md/.json`; those probes do not change the static-execution boundary of this report.

## Recovery boundary

The reader and importer both validate the complete structure. Ordered target/info/legacy-path arrays must agree; paths must resolve in the same package; duplicate targets, unsupported target types, malformed fields, missing fields, unknown modes/easing, and unsupported siblings reject the complete event. Native zero/This is resolved to the owner only where the ordinary-widget path is supported.

Degree and offsets currently require finite numeric decimal/exponent text with no variable identifiers or nonzero repeater scopes. Their original string text is preserved. Complex native expression compilation and grouped-target animation timing are not claimed. Duration 0–60000 is the existing product bound, not a recovered original UI maximum. Historical reader fallback branches for absent offset/anchor fields are not admitted by this complete-field subset.

The protocol is `{sourceId,type:'rotate',targetSourceId,rotate:{mode,degrees,clockwise,anchor,offsetX,offsetY,easing,duration}}`. Both decoding and TS import revalidate it. The separate unsupported UI `OnRotate` → RaiseEvent interactions remain omitted; recovering Load does **not** reconstruct the original repeating spinner loop.

## Actual source files and three recovered interactions

All source files below are under the pinned installation's `DefaultSettings` directory. Exact source part hashes and action/info identities are retained in the JSON, census, and action graphs.

| Source | SHA-256 | Complete recovered document |
| --- | --- | --- |
| `Libraries\Sample UI patterns.rplib` | `cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b` | `research/runtime-rotate-format-ui-imported.rea.json` |
| `Training\Prototyping Basics.rp` | `26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7` | `research/runtime-rotate-format-basics-imported.rea.json` |
| `Libraries\Sample form patterns.rplib` | `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179` | No new complete event; four candidates remain blocked |

1. UI **Instructions**, page `rp-p-27f59a68aaf249d298b4edbb44f8e2ae`, widget `rp-w-27f59a68aaf249d298b4edbb44f8e2ae-9b72d47e5d95453aa10143545881679d`: Load → same widget, By 360°, clockwise, center, zero offsets, linear, 1500 ms.
2. UI **Loading spinner**, page `rp-p-4d4b15a019754649b2e63d5d7577f323`, widget `rp-w-4d4b15a019754649b2e63d5d7577f323-b5179b0a92bd40daafc6d834cb9e62ae`: Load → same widget, identical Rotate values.
3. Basics **Getting started**, page `rp-p-8165e87159f34c58a974459d9e910e34`, **Launch** widget `rp-w-8165e87159f34c58a974459d9e910e34-5c18ef71a1e44eb7ada22074090a3376`: Click → `rp-w-8165e87159f34c58a974459d9e910e34-c1cbc6b0f52c4a14b43558fa1e406afb`, By 360°, clockwise, center, zero offsets, linear, 2000 ms.

The UI document SHA-256 is `d21e22663f760f3f848b20e57b211db43e9a53bae6f07d14f5b4e90d6db15981`; the Basics document is `49bb3df9eb9ad280ea0a6fc0491accf27434bc056b6165695226ad4ce7988364`. These are complete strict-reader/importer results, with the default importer title `Imported RP`; the desktop importer supplies the source filename instead.

## Verification and remaining work

The 11-file census covers 41,662 decoded objects and seven action/info pairs. All seven real actions are By, clockwise, linear, with zero offsets: Form uses 720°/2000 ms; UI 360°/1500 ms; Basics 360°/2000 ms. Whole-event rejection preserves Wait/EnableDisable and other unsupported siblings.

The before/after import audit adds exactly **3 events, 3 cases, 3 actions**, with zero widget additions/removals. Removing exactly those interactions yields deep equality of every admitted document; Icons retains its previous page-count rejection. UI events/actions change 7/13 → 9/15; Basics 2/2 → 3/3; Form remains 86/92. Maximum compact semantics is **28,782,455 bytes**, within the existing **32 MiB** desktop worker limit.

Bounded static CIL replay: **34/34**. New reader tests: genuine frozen-reader red **24 pass / 5 fail**, then **29/29**. New importer tests: **13 pass / 3 fail**, then **16/16**. Related focused suites pass **53 Node / 44 Vitest**, plus typecheck. The first harness failure was a Windows `%20` file URL path error; it is retained separately and was corrected before recording the genuine red run. No existing count assertions required updates in these related suites. Full-suite validation belongs to the parent stage.

`scripts/smoke-runtime-rotate-native-import.mjs <candidate.exe>` is a separate candidate-only desktop check: real native Import → Save → Reopen, complete document comparison except the explicit filename title, three exact Rotate records, two correct This targets, source hashes unchanged, hidden windows, and zero recorded HTTP(S), page, console, or failed-request errors. It writes `.build/runtime-rotate-native-import-desktop-audit.json` and new `artifacts/runtime-rotate-native-import-*.png` screenshots. At this report's freeze, only syntax validation is performed; there is no candidate-package result yet.
