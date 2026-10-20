# RP11 SVG dash-array dataflow

This bounded investigation closes the pattern-array / stroke-width question. It does not execute or load the original DLL, reconstruct the whole SVG generator, resolve encrypted strings, or establish native GUI appearance. Existing line-style and gradient reports were not rewritten.

## Inputs and replay

The retained `AxureRP11.dll` SHA-256 is `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. Inputs are the static ECMA metadata/CIL records in:

- `line-style-platform-functions-cil.json` (`cSqL`), `line-style-pen-cil.json` (`F52D`) and `line-style-dash-rva.json`;
- `line-style-json-pattern-cil.json` (`wJe6.mJef`);
- `line-style-svg-pen-cil.json` (`E5dq`), `line-style-svg-pen-base-cil.json` (`q5qO`) and `line-style-svg-writer-cil.json` (`dHbV`);
- `gradient-angle-zero-cil.json` and the previously audited constant arithmetic in `gradient-angle-static-flow.mjs` / `gradient-angle-flow-init-cil.json`.

Run `node research/line-style-svg-replay.mjs`. The script reads only these JSON instruction records, admits a bounded opcode/call list, fails on unknown instructions, caps execution at 10,000 instructions per method, and writes `line-style-svg-replay.json`. Every source hash is included in that output. Three retained RVA byte blocks are independently decoded as little-endian doubles and checked against their recorded values.

Only the eight `XSUT` dictionary insertion expressions are replayed from the large `cSqL` static constructor. Its unrelated initialization does not run. The known local dictionary is substituted as an input at each insertion block. For subsequent methods, control-flow fields are folded using the pinned pure arithmetic initializer. JSON writers and number-formatting methods are symbolic sinks; the string decoder is represented by its integer key. This preserves the numeric flow without claiming the unresolved text.

The replay passed **9 JSON pattern cases, 45 SVG width cases and 28 nonzero patterned width-multiplication cases**, using widths 0, 0.5, 1, 2.5 and 7. It made 205 bounded method invocations including getters/setters and scalar mapper calls. These counts are not product unit tests or browser-pixel comparisons.

## Arrays and JSON emission

`cSqL..cctor` token **100708486** stores `XSUT` (field **67129903**). The concrete LineStyle1–8 entries are either a literal double array or an `AxDashStyle` value. The latter resolves through `F52D.k52A` token **100720067**:

- ShortDash uses `AxDashStyle.Dash=1` → `T52Z` **100720052**, which constructs `[3,1]`.
- Dot uses `AxDashStyle.Dot=2` → `S52T` **100720055**, which constructs `[1,1]`.
- Solid's pen helper can produce `[1]`, but the JSON writer handles Solid separately as numeric zero.

`wJe6.mJef` token **100694329** emits the following values. Its array path is `XSUT` → `F52D.E52s` / `S52o` → `k52A` → per-element double writer. There is no width multiplication in this JSON array loop.

| Model name | Native LineStyle | JSON pattern-array value | SVG numeric lengths at width 2.5 | Unresolved CSS-label key |
| --- | ---: | --- | --- | ---: |
| solid | 1 | `0` | no patterned sequence | 222156 |
| long-dash | 2 | `[17,8]` | `[42.5,20]` | 316174 |
| medium-dash | 3 | `[9,4]` | `[22.5,10]` | 316174 |
| short-dash | 4 | `[3,1]` | `[7.5,2.5]` | 316174 |
| dash-dot | 5 | `[9,4,2,4]` | `[22.5,10,5,10]` | 316190 |
| dash-dot-dot | 6 | `[9,4,2,4,2,4]` | `[22.5,10,5,10,5,10]` | 316190 |
| long-dash-short-dash | 7 | `[17,4,5,4]` | `[42.5,10,12.5,10]` | 316174 |
| dot | 8 | `[1,1]` | `[2.5,2.5]` | 316190 |
| none | 9 | `0` | separate paint suppression, not a dash family | 299250 |

The decoded integer keys establish that **dash-dot, dash-dot-dot and dot share one CSS label**, while long-dash, medium-dash, short-dash and long-dash-short-dash share another. The actual strings have not been decoded in this investigation. In particular, this report does not assert that key316174 is `dashed` or key316190 is `dotted`, even though those are plausible interpretations. A product mapping that distinguishes dash-dot from dot in this CSS-label branch would contradict the proved grouping unless separate evidence explains it.

## SVG pen and direct multiplication

`dHbV.y3jB` **100723527** at IL95 and `dHbV.n3jV` **100723529** at IL15 construct `E5dq` using the original pen. `E5dq..ctor` **100720687**, IL17–43, retrieves:

1. width from `F52D.F52q` **100720049**;
2. brush from `F52D.D52a` **100720045**, through `SH9D`;
3. the pattern array from `F52D.k52A` **100720067**;
4. passes them into `E5dq..ctor` **100720685**, then `q5qO..ctor` **100720645**.

The base constructor stores width in field **67134008** (`f5dG`) and the supplied array in **67134015** (`o5dJ`). The constructor's additional scalar argument is not evidence of a DashCap transfer.

`E5dq.I5dz` **100720709** calls `q5qO.F5qT` **100720652** at IL329. `F5qT` writes width through the numeric writer; for a patterned array and non-negligible width, IL344–367 applies `Select(M5qw)` and `String.Join`, then writes the result. The separator and attribute names remain symbolic in this replay. The absence of a full generated HTML document is stated explicitly.

`q5qO.M5qw` **100720653** has this complete reachable arithmetic sequence:

```text
IL7   ldarg.1                 // one dash-array entry
IL8   ldarg.0
IL9   ldfld 67134008          // supplied stroke width
IL14  mul
IL15  call 100688625          // numeric formatting
IL20  ret
```

There is **no `+1`, `-1`, alternate-entry adjustment, floor or ceiling** in that mapper. Thus the SVG sequence is each stored dash entry multiplied directly by the supplied width. Native pen cap adjustment elsewhere must not be copied into this SVG array path.

The width guard calls `TbxU` **100688813**, whose retained CIL is `abs(value) < epsilon`; `F5qT` supplies epsilon0.00001. At width0 this replay sees the numeric width write but no multiplied/joined dash sequence. It does not equate that omission with every aspect of runtime state repaint or None's separate fill/stroke handling.

## Cap inference and unresolved boundaries

The native drawing-pen investigation establishes a Round DashCap in that different path. No DashCap getter/field is forwarded through the bounded `F52D` → `E5dq` → `q5qO.F5qT` chain inspected here. The retained CSS/JS resource search reported in `line-style-runtime-evidence.md` found no `stroke-linecap` override in that searched runtime surface. These are bounded negative observations, not proof that every possible generated document lacks a cap declaration.

SVG defines `stroke-linecap` as inherited with initial value `butt`. Therefore **butt is a bounded browser-default inference when no generated or inherited override exists**, not an observed Axure GUI setting or newly proved authoring control. [W3C SVG2 painting specification](https://www.w3.org/TR/SVG2/painting.html#LineCaps)

Unresolved here: encrypted CSS label literals, complete generated attribute strings, inherited external style overrides, arrowhead geometry, native drawing-pen rasterization, compound-path marker eligibility and GUI chooser appearance. None of those were fabricated to complete the arithmetic proof. The runtime/format agents own those separate investigations.
