# Native shadow format — Axure RP 11.0.0.4150

This is static format evidence and a pure import audit, not original-app or original-generated-HTML visual verification. The pinned DLL was read with `PEReader`; it was not loaded or executed. The three native readers remain self-written. No vendor shadow implementation is copied into product code.

## Exact native identity

DLL SHA-256: `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. Original distribution SHA-256: `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`.

`metadata-PName.json` names `OUTER_SHADOW=72`, `INNER_SHADOW=73`, `TEXT_SHADOW=74`. This is also verified through accessors, not strings alone: `ituB.Jtsv` 100717317, `NtsA` 100717318, `Ftsz` 100717319 each load the respective number at IL8 and call `WtTU.get_Item` at IL10. All cast the same `Prop<a5yY>` type. `ituB.VtyY/ttyn/Dtyf` 100717415/417/419 read these properties through the existing determined/overridden predicate. Sources: `shadow-format-pname-keys-cil.json`, `shadow-format-pname-cil.json`.

`Y5y4.a5yY` (TypeDef33559171) has the following named property metadata and matching backing-field getters/setters. See `shadow-format-metadata.json` and `shadow-format-value-cil.json`.

| Native field | Type | Getter token/name |
|---|---|---|
| On | Boolean | 100722419 `c5yl` |
| OffsetX | Double | 100722421 `s5yv` |
| OffsetY | Double | 100722423 `p5yA` |
| BlurRadius | Double | 100722426 `W5vB` |
| Spread | Double | 100722428 `J5vr` |
| Color | AxColor | 100722430 `z5vj` |

The observed setters directly assign fields; no domain clamp was found there. No Angle/Distance properties exist in this value class. Stored values are XY offsets, not polar coordinates. The importer does not invent a conversion from angle/distance.

Serialization method `B5Sy.u590` 100718384 independently calls these getters: On IL47, X IL91, Y IL141, Blur IL196, Color IL246, Spread IL301, then writes each value. Its literal keys are obfuscated; exact key spelling is independently observed in all corpus maps and tied to the named property accessors. `shadow-format-serialization-cil.json` retains the writer, reader `N59p`, numeric helper `w5SQ`, and color helper `d592`. JSON generator `wJe6.KJeu` 100694332 likewise writes six independent values (On104, Y219, Color251, Spread323, Blur389, X449), with no angle/distance calculation. These offsets are decimal.

## Active values versus snapshots

DOAName high-bit flags remain governed by prior evidence in `selected-style-filter-evidence.md`. Local state properties are first structurally validated, then only `determined && overridden` entries become a patch. Local base shadow records also require both flags; a determined-only local snapshot is retained as unresolved source, not activated or treated as a known inherited fallback. Uniquely matched complete default/base cache values preserve the existing resolved-cache policy and may be determined-only. The new implementation does not generalize the local-state filter to flattened cache data.

The 11 immutable samples contain 8,396 shadow property records: outer3,317 / inner3,084 / text1,995. They include style caches, named styles, inactive local snapshots and active states, and are **not visible widget counts**. 2,059 records have `On=true` (outer790, inner634, text635). Only188 of those carry both flags; all188 are outer. Of these,137 are local PropList entries,62 have direct widget MyStyle owners, and24 are referenced explicit state styles. These categories overlap. All8,396 stored Spread values are zero. There are no positive active inner/text local examples in this corpus.

Full raw IDs, source paths, package IDs, SHA-256, flags and values are in `shadow-format-census.json`. Absence of real active inner/text examples is not proof those effects do not exist: their class/serialization/generator identities are established independently; their positive import tests are clearly synthetic.

## Supported import contract

`style.outerShadow` and `style.textShadow` are full objects `{on,offsetX,offsetY,blurRadius,color}`. Inner additionally requires `spread`. The reader requires exactly the six native fields, no duplicates or unknown keys, Boolean On, finite numeric offsets/blur/spread, and integer ARGB color. The pure importer revalidates complete exact output objects and source-state property identity; a malformed state patch is omitted atomically. Explicit `on:false` remains a complete object and can clear a prior shadow; absence remains inheritance.

Offsets ±1000, blur0..1000, spread0..1000 are deliberate product subset bounds, **not established native authoring limits**. Outer/text nonzero spread remains unsupported because the supported painters do not represent that field. Inner positive spread is supported by native encoding plus shipped runtime evidence, but not by a positive real corpus fixture. ARGB is losslessly converted to `#RRGGBB[AA]`.

Base/default, Selected, MouseOver, MouseDown, Focused, Disabled, Error and Hint use the same complete shadow value decoder where their existing inheritance policy allows it. The independent-solid-color exception for unresolved inherited bases is not widened to shadows. Unknown source values remain in the report. Rich runs and hyperlink typography are not expanded with shadows. No new fit-to-content, tree-bounds, clipping, hit-test or shadow-expanded geometry assumption is introduced.

## Initial generator and runtime painting boundary

Native initial CSS formatter `JNLP.zNLn` 100699225 passes outer to `a5yY.V5yu(false, alpha, flag)` and inner to `a5yY.V5ys(true, alpha)`. The latter includes Spread; the former omits Spread. `V5yu` 100722447 checks On and divides BlurRadius by2 only when its third argument is true (IL57–95). `V5ys` 100722448 also checks On and formats offset/blur/spread/color independently. Its string literals remain obfuscated.

`JNLP.GNLZ` 100699222 reads effective outer/inner at IL185/191 and calls this formatter at199 with flag=true. `JNLP.cNK1` 100699253 gates the changed outer/inner properties through `a5FY` at812/833, selects changed versus effective fallback at870/881 and910/921, then calls the formatter at937 with flag=true. This proves the combined formatter and fallback path, but does not by itself establish every concrete image/form HTML element gate.

`FNiU.RNPh` 100699673 has `GetPanelBackgroundCss` closure anchors and calls the formatter at209 with inner=null and flag=false. `TextPanel.get_TextShadow` 100702292 reads KJm7.qJU9; the initial text path `FNiU.rNPL` 100699663 reads this and calls V5yu with false scaling flag. These are narrower generator observations, not a claim that image inner shadows are painted or that all initial CSS matches the state repaint path.

See `shadow-format-css-cil.json`, `shadow-format-css-sites-cil.json`, `shadow-format-box-sites-cil.json`, `shadow-format-text-cil.json`, `shadow-format-form-cil.json` and the independently owned `shadow-runtime-evidence.md`. Runtime evidence distinguishes image outer-only CSS, SVG filters, and paragraph text shadows. Initial generator blur scaling and runtime SVG raw blur must not be conflated. Original GUI export/pixel equivalence remains unverified.

## Real import outcomes and usable fixtures

`shadow-format-import-audit.json` reads all11 unchanged sources, validates strict save/reopen, and compares earlier menu/table/tree/link/frame graphs after removing **only** the newly introduced three shadow style keys. All previous graphs remain unchanged. Widget/page/nested admission counts remain unchanged. Icons.rplib retains its prior page-count rejection. Of imported widgets,1,731 carry at least one explicit shadow object, mostly off. Enabled outer objects:105 base +6Selected +2MouseOver +6MouseDown +4Focused =123. No enabled inner or text shadow is manufactured from inactive records.

| Sample | Top / nested / skipped top | Imported events |
|---|---|---|
| Default | 34 /25 /6 | 0 |
| Flow | 21 /0 /16 | 0 |
| Form | 558 /440 /173 | 80 (was74) |
| UI | 183 /22 /76 | 7 |
| Starter | 57 /28 /31 | 7 |
| Basics | 173 /52 /26 | 2 |
| Quick Win | 33 /2 /9 | 0 |
| UX | 126 /0 /27 | 6 |
| Tab Menu | 3 /2 /0 | 2 |
| Required Fields | 7 /0 /0 | 3 |

Stable actual-package fixtures:

- Default SHA `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`, package `36c2002954b54b97b14662a24587dbf9`, source widget `fd98c89bf60143758b00e772e08f4b42`: outer `{on:true,offsetX:5,offsetY:5,blurRadius:5,color:'#00000033'}`.
- Form SHA `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`, package `e431d4e34cde405fb5cf40a9c1f69e2e`, source widget `430721ebd9e042c7a3bdc69f0a5a7cd3`, direct style `9b93d2e28f5047f2b0033bb5a5b5898b`: outer0/2/3, ARGB1493172224→`#00000059`.
- Form packages `b3e7e9d52abc4ff08e65a0f16e143f53` and `2489016f8aaa4629be08e839e24f65df`, three Choice labels each: selected outer0/0/7, ARGB874420439→`#1e98d734`. Their6SelectedChange cases and12Toggle actions were already decoded but rejected by the earlier unsupported Selected style. The audit stores complete event/owner/target IDs and proves every target resolves; disabling only these newly supported selected-shadow patches restores exactly74events. This causal ablation is explicitly not an execution of an old decoder.

The largest compact semantics is Form27,369,996bytes, below the64MiB desktop result budget. Prior1tree/4nodes,2menus,3tables/15cells,2hyperlinks and1inlineFrame persist. This audit does not claim original-app behavior or renderer screenshot verification.

## Focused verification and reproduction

New tests:17 Node +18 Vitest. Including related regression files:69 Node +144 Vitest, all passed; TypeScript typecheck passed. No full suite/build/package or original GUI was run by this agent. The focused tests include malformed/duplicate/missing fields, nonfinite/out-of-range values, alpha, explicit off, local versus cache flags, atomic state refusal, source identity, exact state-property budgets, readback and no source mutation.

```powershell
node --test research/scripts/read-rp-shadow.test.mjs research/scripts/read-rp-appearance.test.mjs research/scripts/read-rp-interaction-styles.test.mjs research/scripts/read-rp-selected-filter.test.mjs research/scripts/read-rp-text-decoration.test.mjs research/scripts/read-rp-font-style.test.mjs
npx vitest run tests/import-rp-shadow.test.ts tests/import-rp-interaction-styles.test.ts tests/import-rp-error-hint.test.ts tests/import-rp-text-decoration.test.ts tests/import-rp-font-style.test.ts tests/import-rp-dropdown.test.ts tests/import-rp-input-types.test.ts
npm run typecheck
node research/shadow-format-import-audit.mjs
node research/shadow-format-evidence.mjs
```

The last command refreshes only this stage's evidence JSON/manifest. It does not execute prior-stage generators or overwrite historical reports. The manifest pins all new evidence, focused tests, readers/importer and current model dependencies.
