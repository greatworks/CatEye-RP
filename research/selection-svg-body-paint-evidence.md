# Ordinary selection SVG body/path writer evidence

Date: 2026-10-21. Axure RP 11.0.0.4150. Source DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.

This evidence closes the ordinary unrotated Checkbox/Radio body writer for b=14/18 and border width=0/1/3, with solid colors, BoxModel0, no shadow/effect and an empty clip state. It interprets retained CIL as data with explicit host facades; it never loads or executes the vendor DLL. No product, tests, configuration, original GUI or prior frozen evidence was changed.

## Frozen result and reproduction

`selection-svg-body-paint-probes-final.json` contains **20 cases / 60 path elements**. SHA-256: `16ec2e316b91990629ee97aa043cbd3f88f9e195a1038ecfb780a382e017438c`.

The first 12 cases cover Checkbox/Radio × b14/18 × w0/1/3; the next four cover both controls at b14/w1 with alpha0 and alpha0.375. The last four check negative and zero origins. Each record has input, actual path attributes, the root-wrapper tree, path/outer/net matrices, reached IL offsets, call sites, bounds sinks and explicit adapter records. `elements` is the stable three-path list for an independent geometry oracle. `root` is a semantic XML model for this attachment stage, not a complete exported document with generated CSS, XML declaration and all viewport attributes.

The final probe is `selection-svg-body-paint-probe-final.mjs`, SHA-256 `e749ec08e40a415f12b6d7d13ad919e2db1e52dc3c462ea2f052b37890b962ad`. It reads a fixed source-file list. Reproduce to a fresh output with:

```powershell
node research/selection-svg-body-paint-replay.mjs unique-suffix
```

The wrapper pins the probe source hash, refuses existing output, and compares the entire new JSON byte-for-byte with the frozen result. This is a replay of the retained-source projection, not an original executable comparison.

## Entry and output contract

TIdc **100702041** is retained in `selection-layout-render-writer-cil.json`. Its static ordinary-SVG branch constructs an origin-zero b-square geometry after obtaining the global indicator location; it uses y5p9 to install the positive graphics translation, sets SVG mode and origin, then calls e5QW **100722532** with fill enabled, SVG mode true and the original style argument. Its final SIll dispatch draws the mark. This full caller is **statically bound**, not wholly replayed here.

The actual e5QW function is replayed, with its original outline/fill branches, delegate mapping and temporary pen fields. Geometry command carriers come from the earlier independent CIL projection `selection-layout-border-geometry-probes.json`. Their source construction is not replaced by product paths, and C5vD is not rerun in this harness. No-shadow/no-effect accessors are explicit controlled values; the effects callback is a logged empty sink. The original glyph functions B9HX **100710703** and V9Hm **100710704** are replayed fully for the local b-square, including their original arithmetic order and pen/brush selection for the supplied solid fill.

The reached writer chain includes:

| Stage | Retained method IDs |
|---|---|
| Base fill / outline dispatch | e5QW 100722532; h5Q4 100722559; h5Q8 100722561; H57Q 100719887; P57v 100719886 |
| Fill / filled mark | E3jN 100723562; G3jJ 100723564 |
| Outline / checkbox mark | n3jV 100723529; y3jB 100723527; PHbi 100723530 |
| Command-to-path conversion | E5dq.M5do 100720708; F5OF 100720714; Q5OB 100720711; I5dz 100720709 |
| Stroke constructor | E5dq.ctor 100720687, passing fill-rule sentinel 2 |
| Checkbox point alignment | F57M 100719857; i57C 100719858; iterator MoveNext 100720006; i57e 100719856 |
| Radio dot commands | r57L 100719853; J57X 100719866; D5pZ 100720547 |
| Bounds / clip / insertion | MHbW 100723499; MHbP 100723531; YHb0 100723552 |
| Root transform / attachment | OHbT 100723480; eHbt 100723481; CHb2 100723538; IHb1 100723485; pHbF 100723472 |

These methods output, in order, `path.fill`, `path.stroke`, and `path.stroke.btn_check`. The probe does not infer selected visibility from the presence of a mark path: later CSS/runtime visibility is separate evidence.

## Path geometry

For both controls the base fill covers the local b-square. The outline path is inset by w/2 and its centerline bounds are `(w/2,w/2,b-w,b-w)`. It is emitted even at w=0, with `stroke-width="0"`; the independent mark is still emitted. The fill and outline paths explicitly close with Z. Radio outer paths use the retained cubic template with tangent coefficient 0.56; they are not exact SVG circle primitives.

Checkbox mark arithmetic is executed by B9HX: let u=b/14 and p=3u; its local points are `(p,b/2)`, `(b/2-u,b-p-u)`, `(b-p,p)`, and its pen width is p. The writer runs the actual PixelAlignMultiple iterator and i57e with the default R57t pen width 0. Those points remain unchanged. The output is one open M/L/L path with no Z. No `stroke-linecap` or `stroke-linejoin` attribute is written in this scoped output.

Radio V9Hm supplies `(b/4,b/4,b/2,b/2)` to r57L. The latter calls I57m **100719867** with pixel=true, default pen width 0 and BoxModel0. This call is joined to the independent complete CIL replay `selection-svg-body-matrix-radio-dot-pixel-probes.json`, SHA-256 `c1fa3ff26257303579380de4806922a11527fb9b1bbc79d76d015991a9a0c053`. Both b14 and b18 return the original rectangle and an unchanged outRect. The early +1 size adjustment is cancelled by the later BoxModel0 branch: `Ceiling((0-1)/2)=0`, then size subtracts 1. The initial +1 observation was incomplete and is not a final rule.

r57L/J57X are then actually replayed here. They produce four cubic segments starting at the bottom midpoint, proceeding through left/top/right, and returning to the start. The path is geometrically closed without Z. The control-point interpolation is the original `a+(corner-a)*0.56`. Cyclic segment rotation or explicit closure is a valid geometric comparison strategy; exact command order and whitespace should not be turned into a product requirement.

## Matrix and final group attachment

The independent matrix API executes retained y5p9/pHbZ/aHb9/qHbu and source multiplication. Its output is converted into the path writer's value representation; it is not recomputed from a guessed matrix formula. M5do keeps the path coordinates local and stores the supplied matrix separately. I5dz/q5q8 write it as the path transform.

For origin O, each path gets **T(+O)**. The root finalization call site uHbH **100723484**, IL211–220, binds OHbT's result to IHb1. The complete OHbT/eHbt/CHb2/IHb1/pHbF methods are replayed here: they construct a `g` with **T(-O)**, append the body paths to it, and append that group to the semantic SVG root. The final matrix is `outer * path = identity`. For O=(0,0), OHbT returns null, the paths attach directly to the root, and identity path transforms are omitted. Negative-origin controls confirm the signs rather than relying only on positive coordinates.

**No crop-padding translation occurs in either layer.** The viewport rectangle and body position are distinct. The matrix API's controlled initial graphics state and detailed scope are recorded in `selection-svg-body-matrix-evidence.md`. The real ordinary caller also has an EJpL(angle0) prefix: three recorded transforms T(center), R(0), T(-center). The independent `selection-svg-body-matrix-zero-scope-probes-second.json` executes that prefix, the nested selection scope and both restores in 4/4 cases; SHA-256 `fe23800a890b05ca004a4999d21cd3346d665669f9bb6138c7d0e4c9019d1b13`. The prefix folds to identity, so it agrees with this body harness's identity initial matrix without requiring a literally empty real command list. Nonidentity upstream graphics, rotation and nonordinary opacity are not generalized by these cases. The entire uHbH root finalizer is not replayed, and SHbE root sizing is independently covered by the bounds evidence.

## Paint attributes and transparency

| Node | Emitted solid attributes |
|---|---|
| Fill | `fill=rgba(...)`, `stroke=none`, `fill-rule=nonzero` |
| Outline | `fill=none`, `stroke=rgba(...)`, `stroke-width=w`, `stroke-dasharray=0`; no fill-rule attribute |
| Checkbox mark | `fill=none`, `stroke=rgba(...)`, `stroke-width=3b/14`, `stroke-dasharray=0`; no fill-rule attribute |
| Radio mark | `fill=rgba(...)`, `stroke=none`, `fill-rule=nonzero`; no stroke-width attribute |

For ordinary odd widths 1 and 3, e5QW temporarily sets the pen's dash-offset field to 0.5 and PHbi writes `stroke-dashoffset=0.5` on the outline. It restores the original field afterward. Width0 has no dash-offset attribute in the scoped output. The mark uses its own pen/brush, independent of this temporary outline field.

The alpha0 and alpha0.375 controls preserve the paths and numeric alpha in rgba strings. The controlled input supplies a non-null solid fill/pen/mark color to the writer. This proves writer handling of transparent solid colors; it does not by itself prove every upstream declaration/geometry eligibility gate. Runtime state-update overwrite/retain behavior remains the separately frozen state-dispatch evidence.

## Facades, failures and limits

The host supplies CLR containers, delegates, XML objects, immutable point/rectangle/size operations, pen/brush value getters, and invariant-like number formatting. Source obfuscation constants come from previously retained static-initializer analysis. No module initializer or vendor code executes. Native numeric arithmetic and command order are retained where relevant; semantic values and geometry are the contract, not XML byte identity or a universal CLR number-format equivalence claim.

An independent read-only review by the matrix evidence agent checked all 20 cases' actual attachment trees: nonzero origin gives svg > g(T−O) > path(T+O), zero origin gives three direct paths without stale transforms. The review also verified pHSq's actual constructor replaces the base identity field with the passed path matrix. `rootBinding.rootAttributesAreScoped` remains true.

I57m is an explicit result join to the independently replayed exact input cases, with both the input and the result checked. The path-matrix carrier is an explicit join to the independent full matrix replay. No hidden product getter supplies expected values. MHbW's rectangle union runs, but the D5Ob path-bounds calculation is a recorded bounds-only sink; the accumulated JHJS value is **not native ink-bounds evidence**. MHbP runs with empty clipping state. General clipping/effect/gradient/shadow serialization, exceptional CLR finally unwinding and complete-file export are outside this proof.

The browser viewport/cropping result belongs to `selection-svg-body-css-probes.json`: original page CSS leaves inline SVG overflow hidden, while the owner/label remain visible; the oversized shape there is an explicit synthetic control. Combined with the proven body coordinates and separately proven viewport rectangle, this supports ordinary viewport clipping. It is not original-GUI pixel equivalence. Adaptive class-specific viewport generation is independently documented in `selection-svg-body-view-css-evidence.md`.

REA's managed-member request hit its 64 MiB metadata representation budget; `selection-svg-body-paint-rea-unavailable.json` preserves the full unavailable result. Missing methods were obtained using the existing PEReader-only static extractor. Intermediate probes and failures are retained: first/second fail on host ref/list facades; third succeeds with only fill/outline and is superseded; fourth/fifth fail on the host matrix-field/list arity; sixth, seventh and eighth are successful progressive closure stages. The final supersedes them. No earlier evidence was overwritten. The manifest hashes the retained failures, final artifacts and exact dependency files.

Full Axure parity, original GUI comparison and publication remain false. This report establishes a bounded original-source geometry/paint oracle for the ordinary selection body, not the full reconstruction goal.
