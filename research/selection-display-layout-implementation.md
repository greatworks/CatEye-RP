# Browser-derived selection display layout

This stage adds only `src/runtime/selection-text-layout.ts` and its dedicated `tests/selection-text-layout.test.ts`. It does not wire a host, change the existing runtime AutoFit measurer, mutate a saved owner, or execute the original DLL/GUI. Parent-owned host integration and browser acceptance remain separate.

`createSelectionTextLayout(shapeText, readTextBox?)` is self-contained through `Function#toString`; its only runtime dependency is the explicitly injected `shapeText.paint`. It exposes:

- `supports(widget)`: a read-only structural gate for unrotated checkbox/radio with explicit selection flags, padding, vertical alignment and P94.
- `project(widget, measuredContent)`: pure local panel, text-CSS and indicator rectangles, with `origin: 'browser-derived'`.
- `measure(widget, document)`: a connected hidden isolated rich-text copy; no live-owner display or geometry change.
- `fontsReady(widget, document)`: load each effective run font with its glyph text, then await that document's FontFaceSet readiness.

Missing metadata/unsupported types or rotation return no layout. Malformed/nonfinite/negative measurements or geometry, negative constrained width, missing document view/body/font realm and failed font loads throw explicitly. P94 zero remains a valid product-domain input. Negative *positions* such as `ownerWidth-P94` are retained; negative sizes are rejected.

## Source-derived projection

The frozen selection transaction evidence establishes INOR width-fit measurement request10000; constrained width `ownerWidth-left-right-buttonSize`; non-width-fit empty height16; measured panel sizes rounded AwayFromZero; and WIyL/LNOE positions rounded ToEven. The local display projection keeps owner geometry unchanged:

- Panel x is left padding plus P94, or left padding for AlignRight.
- If rounded text height is below P94, panel y uses top padding, `(P94-height+top-bottom)/2`, or `P94-height-bottom`; otherwise y0.
- Initial selection rNPL emits text `(panel.x-left, panel.y, panel.width+left+right)` and omits CSS height.
- CNUW local indicator x is0 or `ownerWidth-P94`. Empty/short/top text gives y0; otherwise middle `(panelHeight-P94)/2` or bottom `panelHeight-P94`. No graphics-unit inset is invented.

These formulas reuse `selection-layout-transaction-evidence.md`, `selection-layout-render-evidence.md` and the existing pure author adapter. They do not invoke the author transaction, its second measurement/owner union/Size writes, or the runtime direct-SPAN AutoFit formula.

## Browser substitute and limits

The isolated tree preserves paragraph alignment and line height, run typography/decorations, grouped links, literal text, explicit BRs and empty-paragraph BRs. Initial text uses the existing safe native text painter. Width reads each paragraph's entire content Range, including links; height reads the isolated block's line box. Indicator, padding, owner border and browser-input dimensions are absent from that measurement.

Width-fit uses a10000px isolated container with nowrap, matching the displayed text construction. Extremely long unbroken content may exceed10000; KIf5's behavior for that edge is not established here. Constrained text uses normal whitespace plus break-word and retains the supplied width regardless of measured glyph width. This is not a native font engine, and no proprietary font/graphics code is included.

The pure adapter accepts an explicit `empty` flag. This display bootstrap instead uses the product's paragraph text joined with LF: a single empty paragraph is empty; multiple empty paragraphs retain their structural breaks. The original RichTextObject.get_IsEmpty token100702331 is identified but its body is not retained in this stage; the product empty definition is not claimed to reproduce that getter.

Immediate `measure` is synchronous and may observe fallback fonts before loading finishes. Hosts may first await `fontsReady` and invalidate their display cache afterward. FontFaceSet readiness does not prove which fallback glyphs were used, and no `fonts.check` result is presented as font provenance. Effective already-resolved author text/styles must be supplied by the host; this factory does not interpolate rows, evaluate runtime text, or cache solely by widget ID.

No general transform, rotated selection, live text editor, native graphics conversion, native empty-union behavior, runtime plain-setter layout replacement or original full-CSS/pixel parity is claimed. The helper deliberately has no plain-setter option. It measures the initial author declaration supplied to it.

## Verification and retained failures

The new API scaffold yielded54/54 failed behavior tests before implementation; its exact source and JSON/log are retained. This is a new-contract red baseline, not a claim that54 pre-existing product behaviors regressed.

After implementation,54/54 pass across module and bare serialized factory execution; `npm run typecheck` exits0. The tests cover both control types, alignments, independent rounding, constrained width, empty policy, P94 zero, metadata/rotation gates, finite boundaries, whole rich-content structure including links, isolated cleanup, font request inheritance/readiness/failure and immutable inputs. DOM measurements use an explicit facade; they are not browser font measurements.

Commands:

```powershell
npx vitest run tests/selection-text-layout.test.ts --reporter=json --outputFile=.build/selection-display-layout-first.json
npm run typecheck
```

The adjacent JSON binds exact source/test/evidence/log hashes and scaffold/final snapshots. Parent browser/host results must be recorded separately rather than inferred from these54 unit checks.
