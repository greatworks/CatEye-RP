# Font style implementation and boundaries

This stage adds independent **normal / italic** typography to REA Prototype Studio. It does not complete Axure parity or implement heterogeneous rich text.

## Authoring and rendering

Style → Text → Font style offers Default (normal), Normal and Italic. Every style effect can explicitly override the field or remove its override. `setStyle`, adaptive views, linked components, cloning, undo and save/reopen use the same validated field. Weight remains independent: switching a bold widget to normal font style leaves it bold.

`WidgetStyle.fontStyle` is optional for old documents. Parsing and saving old data does not insert it; both renderers nevertheless apply normal to each widget when the field is absent. This prevents an italic panel or repeater from changing the appearance of its older children through CSS inheritance. An adaptive view clearing a base italic value persists an explicit normal reset, since JSON cannot preserve an undefined override.

The shared style overlay retains explicit normal even when another state supplies italic. Preview and serialized offline runtime use the same action/state composition and preserve row isolation. The authored [demo project](../artifacts/font-style-demo.rea.json) and [offline demo](../artifacts/font-style-demo.html) show both font styles at six weights, action changes, hover restoration and a legacy child inside an italic container.

## Portable font assets

Roboto now includes six normal and six true italic faces, not just a requested CSS slant. The unchanged font bytes come from the retained distribution and carry separate Apache 2.0 licensing. [Static font evidence](roboto-italic-evidence.json) records each source SHA-256, version, names, native weight, embedding flags and italic metrics. RegularItalic's actual PostScript name is `Roboto-Italic`; tests check that identity rather than infer it from its filename.

Authoring and offline HTML embed the same twelve font files. No OS font installation, `local()` precedence or network font request is required. Full license text and notices accompany both packaged software and Roboto-using HTML. Thin's native weight is 250; CSS100 remains an explicit product family registration. Other font families still depend on the host.

## Native font recovery

The native field is `PName.FONT_STYLE=1002`, typed as **Axure.Platform.AxFontStyle**: None=-1, Normal=0, Italic=1, Oblique=2. The separate Axvg graphics enum numbers Italic/Oblique differently. Native conversion CIL and original runtime CSS establish the mapping; this implementation admits 0/1 only. Oblique and invalid values remain unmapped and reported, rather than silently converted to italic.

The reader recognizes supported native font values and uniform AxRun.Style values. Mixed runs remain reported as a rich-text limitation. Explicit normal in a supported selected/state patch remains a real override, including when it equals the base appearance. Unproven state records are not discarded to force successful import.

The eleven retained files contain 2,069 FONT_STYLE property records, all Normal=0. Separately, their 2,862 AxRun records include 120 Style=1 italic runs in 50 objects; each of those objects also contains normal runs. There is no uniformly italic owner in that census. Of these mixed owners, 49 are imported as flat text without a declared fontStyle and one is skipped; their partial italic formatting is not preserved, and mixed formatting is reported as unknown. Uniform italic recovery has separate enum/conversion evidence, synthetic native-reader tests, original-function probes and authored browser/package checks. A synthetic case is not represented as an editor-generated original sample.

This stage adds **zero native widgets and zero complete native events**. The eight dropdown focus/blur events still target Selected styles containing full default-style records. The meaning of the stored override flags is partly established, but the exact IX_STYLES generator filtering path is unresolved. These targets continue to fail the conservative selection-style contract. Other properties in those records and native rich-text actions remain unsupported. See the [format investigation](font-style-format-evidence.md) and [current corpus audit](font-style-import-audit.json); the earlier dropdown reports remain historical evidence.

## Rich text findings retained for later work

[Twenty-two original-function probes](font-style-runtime-evidence.md) distinguish native plain and rich text replacement. Plain replacement preserves the first run's style and the previous reset baseline; rich replacement creates a new run-style baseline, with different adaptive behavior. Later style effects can modify the new runs. Implementing either as an unqualified flat string assignment would lose behavior. This stage does not import SetWidgetRichText actions, introduce arbitrary HTML execution or claim formatted-paragraph editing.

## Verification

The final [verification manifest](font-style-verification.json) records the complete unit, native-reader, production-browser and exact Windows-package results, source hashes, archive hash and reviewed screenshots. Tests cover strict invalid-value rejection, missing versus explicit normal, all style carriers, component propagation, adaptive reset, row isolation, effect/action precedence, real font identity through CDP, save/reopen, unchanged project data and offline operation.

The exact-package smoke uses the new executable, with OS file-dialog responses supplied by the test. It exercises actual application loading, save/reopen, preview and HTML export. The two package screenshots are [desktop](../artifacts/font-style-desktop.png) and [offline](../artifacts/font-style-offline.png). Original Axure GUI and original generated-page pixel comparison remain unverified; the prior GUI bridge failure was not retried unchanged.
