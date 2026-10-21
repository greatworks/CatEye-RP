# Selection SVG named-view CSS viewport

Status: ordinary named-view path closed by retained CIL and 12 bounded numeric CSS projections. `fullAxureParity=false`, `originalGuiCompared=false`, `published=false`. No original DLL was loaded or executed; no GUI or browser was launched. No product, test or prior evidence file was changed.

The normal selection SVG CSS rectangle is recomputed from the **current view's effective normal declaration**, rather than permanently copied from the base asset rectangle. The inline asset body and this CSS rectangle are separate outputs. The normal adaptive writer computes an asset result but discards its returned string; it writes CSS for the existing `_img` id. This does not mean the underlying generator never produces or caches another asset file during the calculation.

## Source chain

All tokens refer to AxureRP11.dll SHA256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

| Step | Retained instruction evidence |
| --- | --- |
| Enumerate adaptive views | `FNiU.hNin` **100699624**, IL144–166 captures `<WriteAdaptive>b__0` and calls `jJvm.vJvO` with flags false/true. |
| Update the page before writing each view | `vJvO` **100696997**, IL72–106 compares the view, writes `NtYl(view)`, builds `ktiR.Normal(view,...)`, and calls page `Update`; only then IL111–114 invokes the closure. After enumeration it restores the original view and updates again. |
| Update member providers | Page `IJvQ.Update` **100697092**, IL636–642 obtains its objects and calls `OJa9.Update` **100695114**. That method IL125–131 calls each member `KJm7.Update` **100695522**. The latter reads `info.VtiP` at IL848–898 and rebuilds the current style provider via `lJ0A(view)`, `Vto5` and `stwJ` at IL203–234. This chain is statically inspected, not part of the numeric probe. |
| Set CSS context view | Closure **100699719**, IL258–270 enters `xNxg.kNxe(view)`; the `lSPW` constructor **100699457** IL201–203 sets context `ANef(view)`, whose **100699368** IL36 writes `QNM8`. `RNMb` **100699388** reads this view via `tNe8` and `KNxh` to obtain its CSS class. |
| Reach SelectionButton | Closure IL136–153 calls `GNi8` **100699625**; IL106 dispatches `NNif` **100699626**. Its SelectionButton type test is IL330, and selected branch IL184 calls **100699632**, `FNiU.JNiy`. |
| Normal declaration, not authored selected/disabled | `JNiy` IL1298–1312 calls `SelectionButton.zNUD(false,false)`. This is the same retained Selected/Disabled trap already established by the initial-asset evidence. The normal branch uses state zero. |
| Recompute crop but do not insert asset body | `JNiy` IL452–465 invokes `aNP5(button,context,id,0,out local7)`; IL470 pops the returned asset string. IL383–427 passes `local7` to `VNL2(writer,id_img,rect,0,1,adaptiveClass,0,null,...)`. It does not call the inline body writer on this path. |
| Geometry | `aNP5` **100699650** → `jNPH` **100699651** takes the current `mNU6` indicator rectangle, subtracts the owner location, and adds **100695435**, `UJ0a`, padding. P94 comes through `jtoq.ttoo` **100717685** → `a5Vc` **100717838** → `get_ButtonSize` **100702026** (including effective ScaleX when present). Border width is read through the current provider; `N5BZ` **100717800** is the retained typed read. The bounded projection excludes transforms. |
| Class selector and output | `VNL2` **100699211**, IL630–673 adds the adaptive class; IL718–722 begins its selector. A changed rectangle reaches `LNKe` **100699266** at IL793–809, then `TNKD` **100699262**. The original consumer emits the rectangle's left/top/width/height. `VNL2` has a prior-rule cache and can omit unchanged declarations; the numeric probe starts with an empty cache. |

`JNiy` also contains separate interaction-state paths. Their full cache/provider semantics, master references and other compound contexts are outside this task; their presence is not used to claim these contexts were tested.

## Numeric result

`selection-svg-body-view-css-probe.mjs` interprets the retained `aNP5/jNPH/UJ0a` crop and `VNL2/LNKe/TNKD/hNKx` CSS instructions. It uses explicit effective-provider indicator rectangles, no original font measurement, and an explicit asset writer sink. All **12/12** cases passed.

For the finite, ordinary unrotated BoxModel0/no-shadow domain, let `b` be current-view indicator size and `w` current-view stroke width. Let `(ix,iy)` be its logical local indicator origin:

- If `w <= 1`: CSS `(left,top,width,height) = (ix,iy,b+1,b+1)`.
- If `w > 1`: CSS `(ix-w/2,iy-w/2,b+w+1,b+w+1)`.

| Current declaration | CSS size | CSS origin relative to logical indicator |
| --- | --- | --- |
| b14 / w0 or w1 | 15 × 15 | unchanged |
| b14 / w3 | 18 × 18 | −1.5, −1.5 |
| b18 / w0 or w1 | 19 × 19 | unchanged |
| b18 / w3 | 22 × 22 | −1.5, −1.5 |

Both left and right layouts are covered. The actual normal selector was `#u_img.a_phone`. The fixture logical origin has y=2, so w3 produces CSS top=.5. The initial reference asset's geometry is not an input to these current-view CSS dimensions.

## Product integration review

The parent's candidate separation is compatible with this ordinary normal-view evidence:

1. Use the current effective **author declaration** for CSS crop `b/w` and current display placement. A P94-only view can change the crop without an owner-size declaration and without an adaptive scale write.
2. Keep `assetSize` and `assetStrokeWidth` for captured SVG paths. Do not use current-view P94 to regenerate runtime asset geometry merely because CSS changed.
3. Keep adaptive inline scale history independent. Changing CSS class/viewport does not itself reset that history; the earlier adaptive JavaScript evidence governs its event updates.
4. Do not feed runtime SetStyle/Resize/selected paint width back into this declaration-only viewport. Those runtime attributes and CSS-generation declarations are separate channels in the verified paths.
5. Base/named class selection can expose a different generated crop while retaining the same inline body and existing scale. No compensating path translation is established by this report.

Read-only review of current `src/model/selection-indicator.ts` found its new source-style crop formula consistent with the above bounded domain. Its `rect` originates from browser-derived display layout; that measurement is a product adaptation and is **not** claimed equivalent to native text measurement. This report does not freeze the parent's still-active production source.

## Limits and reproducibility

The numeric probe does not execute the entire page update/provider graph, native asset rendering, fonts, theme resolution, IX state generator, master/transform contexts or browser CSS. The first two are separated into explicit static chain and numeric consumer evidence; the report does not silently substitute a complete original export. The frozen root/crop and body-writer evidence independently own viewBox/root attributes, final net body transformation and clipping.

Run only the new probe: `node research/selection-svg-body-view-css-probe.mjs`. It refuses to overwrite its result JSON. The first run exited 0, recorded in `.build/selection-svg-body-view-css-first.log`; there were no probe assertion or harness failures. `selection-svg-body-view-css-manifest.json` binds all new metadata reads and reused source files.
