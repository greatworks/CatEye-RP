# Selection SVG body renderer: final read-only review

No blocking defect found in the four reviewed files. This is a static review of the current candidate against `.build/selection-adaptive-final-snapshot`, not another execution of the unit/browser suites. No product, test or prior evidence file was changed. `fullAxureParity=false`, `originalGuiCompared=false`, `published=false`.

## Reviewed changes

| File | Current SHA256 | Frozen baseline SHA256 |
| --- | --- | --- |
| `src/model/selection-indicator.ts` | `8c19c834df2ff2123e4c36eb527b8b9b0f1847ccdf63e9ff66e06baf850c84a1` | `8a31c5b7493aaaba14bf3958581f2af9dfe8b90f1568f1bdd3065a5956215ed6` |
| `tests/selection-svg-body.test.ts` | `41b24c2f985d2cc5c2a799359dbf9abcd712dc09099d4493ec3923f7c1dba722` | New file |
| `tests/selection-indicator.test.ts` | `06de977b6dd039e14b924a27794994400318f37ff1a25120cd9f537cabdcdc86` | `a20200ce0dccc90e862fcaad65a9cec940c2801790f7229589f69d2cf60f5d86` |
| `tests/e2e/selection-adaptive-svg.spec.ts` | `f7287e81a95511d5914b4fd319ac10d8b8ca0ba1775b9e872ccf31aedeba37fb` | `f32210d8357bbd972f1b4c647c2f81e5caf5de78b2464e6643b62a430be36671` |

The only production diff is the new viewport validation/calculation and its root projection: declaration-derived size and offset; removal of `viewBox`/width/height attributes; hidden overflow. Geometry, current paint selection, primitive identity and adaptive scale projection retain their previous implementations.

## Crop, asset and paint separation

`selection-indicator.ts:38` reads CSS crop only from the `source` declaration. It verifies finite nonnegative P94/stroke width and rejects overflow of the resulting size. `supports` invokes this validation even when a retained paint snapshot supplies a valid asset. Therefore a valid old asset cannot conceal an invalid new CSS viewport declaration, and `paint` rejects before writing the SVG.

`geometry` at line61 still obtains `assetSize` and `assetStrokeWidth` from the snapshot when present. The new viewport formula does not alter the path inputs. In contrast, `paint` at line75 obtains the root CSS size/offset from `viewport(source)` and obtains visual stroke/fill/mark attributes from the snapshot or current widget. This matches the bounded normal-view CSS evidence: current declarations can change crop while the initial inline asset geometry remains fixed. A finite current declaration stroke wider than the captured asset is intentionally accepted; only the captured asset must satisfy the existing valid-path gate.

The new crop offset is applied to the SVG CSS left/top, not added to child path coordinates. It removes the previous root attributes on an already-existing node as well as on fresh nodes. There is no new viewBox or compensating path translation. The dedicated path-writer research remains responsible for final body-coordinate confirmation; this review does not replace that pending evidence with a claim of full native pixel equivalence.

## Scale and repaint behavior

Line88 remains a direct assignment of `snapshot.svgScaleX/Y` to CSS. There is no DOM matrix readback or multiplication in the renderer, and the new viewport helper is pure. Repeated rendering, including a font-triggered host redraw, cannot advance the scale through this function. A missing snapshot clears the old transform/origin using the existing fresh-asset behavior.

The reviewed browser test calls Apply A twice and requires the same matrix. Paint actions must also preserve it. P94-only and b18/w3 declaration changes require the existing matrix together with new 29px and 22px crops. Returning to Base retains the matrix while returning the crop to 15px. The existing fractional/midpoint sequences continue to assert runtime scale-readback behavior rather than relaxing those checks for the new crop.

The four-file review includes repeated-paint unit coverage and same-view browser coverage. It does not contain a newly delayed real `document.fonts` promise scenario; actual asynchronous font lifecycle coverage belongs to the existing host tests. The static renderer argument above supports the no-compounding conclusion without claiming this review executed a font-load event.

## Test strength and limitations

- The new unit test pins the independent bounds oracle hash, verifies its 13 total cases and explicitly requires 12 geometry cases. Its loops therefore cannot silently pass on an empty fixture. Both imported and bare `Function#toString` factories are used.
- Invalid source viewport declarations are checked with an otherwise valid retained asset; the test requires a thrown rejection and no attributes, styles or children written. This specifically exercises the new supports gate rather than only testing invalid asset geometry.
- The crop matrix compares source-derived expected rectangles for both checkbox/radio, b14/b18, widths0/1/3 and left/right placement. It seeds old root attributes and requires their removal. Source data must remain unchanged.
- The independent runtime paint test still compares fill/stroke/mark values against frozen original-consumer output. Only root attribute/crop expectations changed. Asset child identity and path data remain checked across the complete paint sequence and repeated repaint.
- New source-declaration tests deliberately vary runtime P94/paint width independently from `source`, and vary declaration b/w independently from the captured asset. They require stable primitive identity/path data and the same scale through both directions of the declaration switch.
- The browser clipping check uses an oversized temporary body on the real product SVG root. It requires an inside hit, outside misses under hidden overflow, and outside hits after the visible-overflow control. The positive visible control prevents an unrelated occluder from making a false clipping success. The fixture temporarily sets z-index to avoid the text sibling, then restores the entire saved style and removes the marker in `finally`; production stacking is not changed.
- That clipping check validates the browser's crop mechanism, not a native body raster comparison. The source paths are separately checked for retention and the body writer has a separate evidence task.
- Preview, embedded frame and fully offline exported HTML all invoke the same `exercise` assertions. The offline path also exercises its own embedded frame. Final save compares the entire document and errors/network requests are checked. These tests are not satisfied by merely exporting HTML or locating an SVG.

No suite or browser process was started during this review. The parent's reported 496 focused passes and browser results are not counted as executions by this reviewer. Current/baseline hashes were read directly and the four current hashes were checked again after review.
