# Gradient angle and border-fill recovery — Axure RP 11.0.0.4150

## Finding and correction to the frozen gradient milestone

The native reader does **not** rotate RP11 stored gradient endpoints using `fill-angle`. `B5Sy.A59X` branches on the serialized package version. For versions below 9.0.0.0 it reads the stored angle; for the modern branch it explicitly assigns **NaN** and keeps the stored points. The writer `K59a` writes a constant **0** into that angle field. The modern field is therefore a compatibility placeholder.

This corrects the frozen `gradient-format-evidence.md` description that `n5YJ` “resets the stored angle” to zero and the resulting assumption that any nonzero serialized angle requires geometric preprocessing. The actual internal reset is **NaN**, not zero. The earlier nine recovered gradients were unaffected because their points were already used directly. Historical reports/manifests remain unchanged; this report supersedes that particular interpretation.

Production scope remains RP11: the expanded finite-angle acceptance requires an explicit package version `[11,0,0,0]`. The underlying CIL branch is truthfully reported as `>=9`, but this work does not claim complete format compatibility with all such versions. Unknown-version public helper callers and other versions keep the previous zero-only subset; nonzero legacy values remain unknown. Nonfinite/wrong-tag angles, unknown fields and malformed point/stop data remain rejected even though a modern vendor reader may ignore the placeholder.

## Static anchors and provenance

Target DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. Original distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`. All new CIL files were produced by the existing PEReader metadata tool, without assembly loading or target execution.

| Claim | Token / CIL offsets | Retained evidence |
|---|---|---|
| Angle sentinel test is `Double.IsNaN` | `rbx2.nbxl`100688824, IL7–13 | `gradient-angle-number-cil.json` |
| Internal preprocessing resets angle to NaN | `g5Yr.n5YJ`100721123, IL146/155 | frozen `gradient-format-linear-paint-cil.json` |
| Writer emits constant angle zero | `B5Sy.K59a`100718381, IL852→861→866→871 | frozen `gradient-format-serialization-cil.json` |
| Reader checks version threshold, then legacy angle lookup/setter | `B5Sy.A59X`100718382, IL963–974,819–866 | same serialization file |
| Reader modern branch assigns NaN | `A59X`, IL979→989→33→1095–1106 | same serialization file |
| Threshold identity is 9.0.0.0 | `QbzB..cctor`100691304, IL225–235, field67121468 `cbzf` | `gradient-angle-version-cil.json` |
| Four version arguments mean Major/Minor/Build/Revision | `abWU` constructors100688460/461, `CompareTo`100688475, getters100688456–459 | `gradient-angle-version-order-cil.json`, `version-fields-cil.json`, `version-compare-cil.json` |
| Legacy rectangle angle endpoint calculation | `d5pN.R5pg`100720512 | `gradient-angle-geometry-cil.json` |
| Line intercept and intersection helpers | `T5pR`100720513, `q5pE`100720514 | `gradient-angle-lines-cil.json` |
| Rectangle edges/center and normalized-to-physical matrix | `j5u5`100722055–065,100722075,100722096 | `gradient-angle-rect-cil.json`, `rect-fields-cil.json` |
| Matrix inverse / matrix×point | `Wbe7.Kbep`100688898 / `f5wV.op_Multiply`100721995 | `gradient-angle-matrix-cil.json`, `point-cil.json` |

Opaque arithmetic branches are resolved by a self-written bounded static constant folder. It folds the unique arithmetic assignments of 120 control-flow fields in method100732124. The source CIL and the field tokens, assignment IL ranges and folded values are retained in `gradient-angle-flow-init-cil.json` and `gradient-angle-static-fields.json`. It does not invoke the target initializer or any target function.

## Legacy geometry, independently checked but not promoted to broad import support

For an unrotated native `j5u5` rectangle, `R5pg` reduces the angle modulo360 and adjusts negative values into0..360. Cardinal directions have exact edge-center branches. General angles use tangent/intersection calculations: a line through the rectangle center intersects lines perpendicular to it through opposite rectangle corners. This is equivalent to projecting all four corners onto the center line, retaining the minimum and maximum projected position.

With center `c`, unit direction `d=(cos(a),sin(a))`, rectangle corners `q`, the independently derived oracle is:

```text
start = c + d * min(dot(q-c,d))
end   = c + d * max(dot(q-c,d))
```

Positive angles follow increasing screen Y. For a200×100 rectangle at(0,0):0° gives(0,50)→(200,50);90° gives(100,0)→(100,100);45° gives approximately(25,-25)→(175,125). Endpoints may lie outside the rectangle. `n5YJ` then multiplies these physical points by the inverse rectangle matrix, giving normalized points, and changes the internal angle to NaN. For45° this is approximately(.125,-.25)→(.875,1.25). Existing point values are irrelevant to that legacy conversion; a NaN angle returns immediately and leaves them untouched.

`gradient-angle-probe.mjs` runs the retained instruction records through a small self-written interpreter with explicit, source-pinned rectangle/point primitive bindings. It compares to the independently written vector-projection oracle, which does not use the CIL tangent/intersection procedure. Results:

- 222 geometry cases: six rectangles with differing aspect ratios, translated origins, fractional/very thin widths and zero width/height; 37 angles including negative/repeated revolutions, cardinal and near-cardinal values.
- 24 `n5YJ` cases on four nondegenerate rectangles: NaN no-op and finite0/45/90/−45/360; original point replacement, inverse normalization and NaN reset checked.
- Four version-branch replays:8.9.9.9 reads stored73;9.0.0.0,10.0.0.0 and11.0.0.0 skip the lookup and setNaN. Exact executed IL offsets are recorded.

This is **controlled CIL replay**, not original DLL execution or GUI verification. Oriented `K5u9` implementations, arbitrary transforms, degenerate inverse matrices and broad legacy object admission are not claimed. The zero-dimension cases validate only `R5pg`, not normalization through a singular inverse. There is no need to approximate that migration in the RP11 product path.

## BORDER_FILL8 shares the same complete gradient value

`ituB.PtsH`100717295 reads PName7/FILL; `ItsI`100717296 reads PName8/BORDER_FILL. Both cast to the same `Prop<Fill>` TypeSpec`1B00023D`. `wJe6.rJeU`100694323 IL891–921 recognizes that property carrier and sends its Fill value to the same `dJew`100694331 serializer. `KJm7.aJpm`100695648 separately processes both properties when performing legacy angle migration. Evidence: `gradient-angle-paint-properties-cil.json`, `gradient-angle-paint-generator-cil.json`, and the preceding `gradient-format-effective-angle-cil.json`.

The reader now maps PName8 to `stroke` for solid or `strokeGradient` for a complete linear/radial value. Base, Selected, MouseOver/MouseDown/Focused/Disabled and Error/Hint use the same validated local OD state filtering. Unresolved-base and named-color-cache exceptions remain **solid only**; no gradient is admitted through those shortcuts. Text-color PName6 has not been expanded.

The importer revalidates complete point/stop objects, native ARGB-derived hex colors, safe bounds and exact property identity:7 can produce fill/fillGradient;8 can produce stroke/strokeGradient. A single native property cannot output both solid and gradient. Explicit solid state patches survive, allowing the independently implemented model/runtime clearing rules to remove an inherited gradient. Fill and stroke remain separate atomic paints.

No new shared field is required beyond the already agreed `WidgetStyle.strokeGradient`. The normalized gradient value never contains an angle. Linear recovery provenance records `nativeAngle:{stored,policy:'ignored-rp11-reserved-field',packageVersion,readerMethodToken}`; this preserves the source value without pretending it affects RP11 paint.

## Real corpus and controlled mutation

The same11 SHA-pinned files were audited in `gradient-angle-import-audit.json`, against the preceding frozen gradient report and earlier shadow/structure reports. Outcomes are9 unchanged fill-gradient widgets (7linear,2radial), **0 real border-gradient widgets**, and zero changes to admitted page/widget/nested/event/action counts. Prior shadows, menus, tables, trees, hyperlinks and frames remain equal. Icons retains its earlier page-budget failure. The largest compact semantics output is27,369,996bytes, below the64MiB worker cap.

The Starter source SHA is `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714`. A controlled test changes eight independently decoded linear style records to `fill-angle:73` **in memory only**. The native file's SHA is checked before and after. All imported document fields remain strictly equal, including the six real linear widgets' points and all other graph data. This is a mutation test based on a real RP11 source package, not a claim that the vendor sample itself contains nonzero angles. A separate decoded version<9/nonzero variant remains explicitly unknown. The native corpus has no positive nonzero-angle or border-gradient source, so border/angle expansion coverage is synthetic and CIL-backed.

## Focused validation and scope freeze

New tests:26 Node and21 Vitest. Related focused totals:96 Node and79 Vitest; typecheck passed. They cover modern finite/nonfinite placeholders, exact package version, unchanged real-source bytes/document, legacy rejection, local/cache/state flags, radial/linear border paints, duplicate stops/alpha, unknown properties, prototype-bearing data, wrong source key, atomic selected rejection and save/reopen.

Production changes are confined to `research/scripts/read-rp-semantics.mjs` and `src/model/import-rp.ts`; new tests are `research/scripts/read-rp-gradient-angle.test.mjs` and `tests/import-rp-gradient-angle.test.ts`. No runtime/UI/package code or historical evidence was changed by this agent. Full suites/build/package are the parent task's responsibility.

```powershell
node research/gradient-angle-probe.mjs
node --test research/scripts/read-rp-gradient-angle.test.mjs research/scripts/read-rp-gradient.test.mjs
npx vitest run tests/import-rp-gradient-angle.test.ts tests/import-rp-gradient.test.ts
node research/gradient-angle-import-audit.mjs
node research/gradient-angle-evidence.mjs
```

The final two commands refresh only this stage's audit and hash manifest after shared model freeze. `gradient-border-runtime-evidence.md` documents the independent shipped-JavaScript/browser scope; no native GUI visual equivalence is claimed here.
