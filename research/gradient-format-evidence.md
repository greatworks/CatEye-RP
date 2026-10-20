# Native gradient fill format — Axure RP 11.0.0.4150

This stage uses static PE metadata/CIL and the same11 SHA-pinned official files as the preceding shadow milestone. No original DLL, GUI or generated application was executed by the format investigation. Product recovery is a self-written bounded parser, not a copied native implementation. Runtime function probes and browser rendering are independently documented in `gradient-runtime-evidence.md` when available.

## Observed storage and census

`gradient-format-census.json` contains exact source paths, SHA-256, package/object IDs, DOA flags and original values. There are13,421 solid fill records,24 linear and2 radial records. All26 gradient records are FILL/PName7; no gradient text color/PName6 or stroke/PName8 was observed. Only9 records have direct widget owners:8 in Prototype Starter (6linear,2radial),1 in Basics (linear). The other17 are named-style or cache records and are not counted as additional visible gradient widgets. No explicit IX state gradient reference was observed. All observed linear `fill-angle` values are0; all observed gradient stop alpha values are255.

Linear has exactly these stored fields:

```text
fill-type: "linear-gradient"
fill-center-point: { X, Y }
fill-axis1: { X, Y }
fill-angle: 0
fill-offsets: [number, ...]
fill-colors: [ARGB integer, ...]
```

Radial has `fill-type:"radial-gradient"`, the same center/axis1/parallel arrays, and `fill-axis2:{X,Y}` instead of angle. Coordinates are normalized fractions of the widget bounds. Real radial endpoints extend outside0..1 and are rotated. The format must retain these coordinates; reducing them to a centered circle or an angle-only linear fill would alter actual samples.

Named-style examples contain duplicate offsets `[0,0,1,1]` and `[0,0,.2,.9,1,1]`. Stop records retain original order and color association; they are not deduplicated. Unknown fields, mismatched parallel array lengths and unsupported fill kinds stay explicit unknowns.

## Exact managed anchors

Pinned DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. Original distribution: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.

Metadata identifies the native Fill return type `x5UG.t5Oz` TypeDef33559002. The gradient base `K5U3.A5UI` TypeDef33559005 derives from it; linear `o5YF.g5Yr`33559035 and radial `w5Yg.h5Y3`33559037 derive from that gradient base. These are the RP/platform carriers; the separately named Axvg.Graphics enums/classes must not be substituted for their fields. See `gradient-format-metadata.json` and `gradient-format-candidates.json`.

| Meaning | Exact method | Evidence |
|---|---|---|
| Center point | `A5UI.S5UD`100720860 | Loads j5UC[0], IL8–14 |
| Axis1 point | `A5UI.V5UK`100720862 | Loads j5UC[1], IL8–14 |
| Radial Axis2 | `h5Y3.V5Yc`100721147 | Loads j5UC[2], IL8–14 |
| Set center/axis1/axis2 | 100720861/863/100721148 | Writes corresponding array slot |
| Ordered stop collection | `A5UI.j5Uc`100720848 | Returns S5UM backing collection |
| Add native stop | `A5UI.J5Ug`100720847 | Clones stop then collection Add at IL46 |
| Stop offset | `M5Ui.m5Uh`100720887 | Double getter; constructor100720886 takes double+AxColor |
| Stop color | `M5Ui.K5Um`100720889 | Named Color metadata, AxColor |
| Linear angle | `g5Yr.y5Y9`100721113 / `j5Yt`100721114 | Gets/sets separate double c5Y1 |

`B5Sy.K59a`100718381 (serialization writer) branches by native type, writes center/axis1/radialaxis2 using the getters at IL661/707/802 and point serializer q59D. It enumerates stops and appends each offset/color to parallel arrays at IL917/941, with numeric helper w5SQ and ARGB helper d592. Reader `A59X`100718382 constructs linear/radial objects and paired stops, calling the same setters and `J5Ug`. Exact literal key strings are obfuscated; sample field names are observed directly and tied to the matching type/getter/write structure, rather than claimed deobfuscated literals. Files: `gradient-format-serialization-cil.json`, `gradient-format-points-cil.json`, `gradient-format-radial-cil.json`.

JSON generator `wJe6.dJew`100694331 reads the gradient point array directly (five accesses for the two linear/three radial output fields), and enumerates the same stop collection. It writes each offset and color separately. `gradient-format-generator-cil.json` pins this path. Shipped `style.js`1499–1550 consumes linear `startPoint/endPoint/stops`;1552–1628 consumes radial `center/axis1/axis2/stops`, multiplying point coordinates by widget dimensions. The runtime investigation independently pins and probes those functions. No separate focal point, scale field, repeat mode or color-space control was observed in this native value map.

## Why nonzero angle is still rejected

The JSON generator does not directly read the angle getter. That does **not** mean stored nonzero angle is inert. `KJm7.aJpm`100695648 reads it at IL95/480 and calls `g5Yr.n5YJ`100721123 at IL251/583. `n5YJ` uses angle plus a rectangle through `d5pN.R5pg` at252, updates center/axis1 at85/190 and resets the stored angle at155. Thus generator points may already have undergone preprocessing.

This stage confirms that path exists but has not independently reconstructed its complete rectangle/transform semantics. The reader accepts explicit angle0, which covers all observed native linear samples, and retains any missing/nonzero angle source as unknown. It does not silently discard nonzero angle or claim an original nonzero fixture was tested. Evidence: `gradient-format-angle-callers.json` (candidate index only), verified `gradient-format-effective-angle-cil.json` and `gradient-format-linear-paint-cil.json`.

## Normalized protocol and boundaries

```ts
type GradientFill =
  | { type:'linear'; start:{x:number,y:number}; end:{x:number,y:number}; stops:{offset:number,color:string}[] }
  | { type:'radial'; center:{x:number,y:number}; axis1:{x:number,y:number}; axis2:{x:number,y:number}; stops:{offset:number,color:string}[] };
```

The optional complete object is `WidgetStyle.fillGradient`. FILL7 emits **either** `fill` for a solid color **or** `fillGradient`; the native worker never emits both from one source property. The importer rejects conflicting paints, revalidates exact ordinary-object keys/points/stops, and accepts only ARGB-derived hex colors on this native boundary. The general authored-document model may support a broader safe color vocabulary independently.

Coordinates ±1000, ordered offsets0..1, and2–100stops are explicit product subset limits, not proven native UI limits. Duplicate offsets retain order. Stop alpha is preserved by the existing ARGB conversion; partial-alpha positive cases are synthetic because all actual gradient stops in this corpus are opaque. Degenerate endpoints/axes are retained as data; the renderer's handling is separately documented, not guessed by the format parser.

Gradient values are atomic. Local base gradients require determined and overridden; local state values use the prior validated OD filter. Unique resolved base/default caches use the existing determined cache policy. Solid state replacement produces only `fill`, allowing the model/runtime's fill-only reset rule to remove an inherited gradient; gradient replacement produces only the complete gradient. Named-color-cache and incomplete-base independent-solid-color exceptions are deliberately not broadened to gradient inheritance.

Only FILL7 is expanded. Native gradient border/text paints, nonzero-angle preprocessing, unknown focal/repeat/scale fields and unproved legacy maps remain unsupported. No source text, rich formatting, shadow values, geometry or event graph is flattened to gain gradient admission.

## Real recovered objects

Prototype Starter SHA `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714`, page **Device physical nav**, package `dbf50f111c33407cab8d0fdc6bcae297`:

| Source widget | Kind | Stored geometry x,y,w,h |
|---|---|---|
| 113c6694f69947dd8fe81ab0a9ea9b68 | linear | 120,695,200,50 |
| 8545464c6ff94ae0bb508fd5e8610249 | linear | 580,695,200,50 |
| 599e56c55f2d4484a738b4671b6d803e | radial | 0,100,900,600 |
| dbb5b80eda374b6d9dc67685c15e44b3 | radial | 45,130,700,540 |
| a20c6e08f6a14d48a082a77db645e210 | linear | 770,410,100,70 |
| b2da27f43c2940cca3f8d99719efea6a | linear | 770,170,100,70 |
| 3b8e4964c21a49c8b94d4bf35530b219 | linear | 770,290,100,70 |
| d0e11637621a43c38e3ccdbf1e875e92 | linear ellipse | 770,530,100,100 |

All8 preserve independent vectorPath data: the7boxes have10commands each and ellipse6. For example radial599e… keeps center(.4426229508196721,.5901639344262296), axis1(.46248508298081975,1.5435462781613485), axis2(-.08196721311475415,.6147540983606551), stops #aaaaaa→#ffffff.

Basics SHA `26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7`, **Getting started**, package `8165e87159f34c58a974459d9e910e34`, Box A source `81f80ccc86cb4f6ba484928ec286cc2f`, geometry670,2256,463,298: start(1,.5123871074653987), end(0,.3591018311376164), #0abebe→#2a6ff6.

Complete values, source style IDs, all11 sample hashes and strict readback results: `gradient-format-import-audit.json`. Nine widgets gain faithful stored gradient data; admitted widget/page/nested/event/action counts remain unchanged. Every preceding shadow object and event list compares exactly; earlier trees, menus, tables, hyperlinks and frame graphs retain their contents. Icons keeps the earlier page-budget rejection. Largest compact native semantics27,369,996bytes stays below64MiB. No historical audit is regenerated or overwritten.

## Verification

20 new Node tests and21 new importer Vitest tests pass. Related focused regressions:87Node and97Vitest pass; typecheck passes. These include real Starter/Basics records, alpha/order/duplicates, atomic selected/state replacement, unknown angle, missing/extra/prototype fields, coordinate/array limits, mismatched source property identity, solid-cache boundaries, no mutation and strict save/reopen. No full suite/build/package was executed by this agent.

```powershell
node --test research/scripts/read-rp-gradient.test.mjs research/scripts/read-rp-shadow.test.mjs research/scripts/read-rp-appearance.test.mjs research/scripts/read-rp-interaction-styles.test.mjs research/scripts/read-rp-selected-filter.test.mjs research/scripts/read-rp-error-hint.test.mjs
npx vitest run tests/import-rp-gradient.test.ts tests/import-rp-shadow.test.ts tests/import-rp-interaction-styles.test.ts tests/import-rp-error-hint.test.ts tests/import-rp-text-decoration.test.ts
npm run typecheck
node research/gradient-format-import-audit.mjs
node research/gradient-format-evidence.mjs
```

The final two commands update only this stage's current audit/evidence manifest after shared model source freeze. Native pixel or original GUI equivalence remains unverified.
