# Independent Affect All Views review — before-fix witness

This review found **one confirmed P1 authoring data-loss defect**: a single padding-edge edit applied to multiple differently padded widgets copies the current widget's other three edges into the other targets, then clears their corresponding adaptive declarations. The parent accepted this finding and assigned a fix. This report and its JSON are the **before-fix record**, not a statement about later source revisions.

Only new `adaptive-all-views-independent-review-*` research files were written. No product, test, previous evidence, or artifact was edited. No native Axure GUI/DLL execution, product browser suite, build, package, or full test suite was run. An attempted Vite SSR module import was aborted before producing a module result; no conclusion relies on that attempt. The completed probes use Node's import hook and TypeScript erasure, with no Vite server.

## Confirmed finding AAV-REVIEW-01

Locations in the pinned before-fix source:

- `src/components/Inspector.tsx:556–563,578`: changing one numeric padding control constructs a complete tuple from the current widget, then passes that tuple as the explicit style command.
- `src/App.tsx:319,330–339`: the same complete `textPadding` command is merged into every selected ordinary widget.
- `src/model/adaptive.ts:392–409`: the model correctly detects changed edges per target and clears those edge declarations in all maps. At this point the author adapter has already changed the three unintended edges, so the model cannot recover the user's one-edge intent.

Minimal case, with Affect All Views checked in a child view and A then B selected:

| Object | Base padding, TRBL | Current child padding | Inactive padding |
|---|---|---|---|
| A, current Inspector object | 1,2,3,4 | 11,12,13,14 | irrelevant |
| B | 51,52,53,54 | 61,62,63,64 | 71,72,73,74 |

Edit only **Padding right** to40. Actual B Base becomes **[11,40,13,14]**, and all four padding declarations disappear from B's child and inactive maps. Expected B Base is **[51,40,53,54]**; child top61/bottom63/left64 and inactive top71/bottom73/left74 must remain local. Unrelated geometry/font declarations survive, so this is specifically the padding command's lost edge intent.

The executed witness extracts the current `App.patchSelected` function verbatim, erases TypeScript annotations, and invokes real `mergeWidgetStyle` and `applyAdaptiveWidgetEdits`. React/DOM/undo are absent; `changeWidgets` is a capture sink followed by the actual model call, and the unrelated line-style capability filter is an identity sink. The JSON records extraction lines/hash, inputs, actual/expected outputs and all reviewed source hashes. This proves the code path, **not a native GUI observation**.

Recommended correction: carry the selected edge as transient author-command intent and apply it to each target's own effective tuple. Keep the current model's independent side diff. A meaningful regression uses differently padded selected targets, active/ancestor/inactive declarations, and verifies both untouched sides and later Base inheritance. The parent owns the real browser regression; this reviewer did not run one.

## Other reviewed behavior

No additional concrete defect was found in the bounded areas below. These are code-review conclusions at the JSON's hashes, not a claim of complete Axure parity.

| Area | Review result and evidence boundary |
|---|---|
| Current-value equality | `layoutDifference(previousEffective,edited)` controls All Views promotion; unchanged determined ordinary fields do not clear other maps. The existing tests include local same-value declarations and first/last pointer-frame history. Native `GetEdit` equality is separately established by the frozen CIL replay. |
| XY / WH atomics | An actual X/Y edit promotes both current effective coordinates; width/height likewise. The new read-only App/model probes confirm heterogeneous selections retain **each target's** untouched coordinate/dimension, rather than copying the current widget's other axis. |
| Scalar font multiselection | The independent App/model probe confirms requested size20 is a no-op for a target already effectively20 and edits a target effectively30; it does not copy unrelated padding/style. This scalar probe does not execute the rich text GUI. |
| Clearing scope | Normal changed keys are removed from active ancestor/leaf/sibling maps and inactive `adaptiveOverrides`; unrelated properties remain. `resolveAdaptivePage`/`commitAdaptivePage` preserve page locality with shared view definitions. |
| Padding model / runtime | The single-target model is edge-granular. Legacy tuples declare four sides, closer sparse sides override individually, closer legacy tuples reset all four, empty side maps do not synthesize a declaration, and runtime strips the metadata before rendering. The bug above occurs before this projection. |
| P21 effects | A previously empty effective whole map takes the local first-add path; an existing non-null state, including `{focused:{}}`, takes complete-map promotion/clearing. Same effective state graphs retain local barriers. Ordinary style and state-map edits remain distinct. |
| Rich commands | Whole-widget explicit resets are selected-target scoped; raw run/paragraph resets occur only for the requested rich keys, preserving text/link identity and unrelated formatting. Matching uniform raw runs and outer style produce no edit. Character-selection GUI entry points are outside the frozen native proof. |
| Save boundary | `textPaddingSides` accepts only four named numeric edges0..1000; legacy documents need no migration. It remains override metadata, is rejected on composite content where existing restrictions apply, and is not spread onto Widget. |
| Shared content | Notes/text/interactions/structure continue through the shared path. Table/menu/tree composite boundaries remain explicit rather than pretending to implement all native containment delegation. |

Reviewed tests: `tests/adaptive-all-views-authoring.test.ts`, `tests/adaptive-all-views-padding.test.ts`, `tests/runtime-adaptive-padding.test.ts`, and the new authoring browser file/shared scenario. Their existing assertions cover single-target padding and rich reset/no-op distinctions; the pre-fix browser fixture did not exercise differently padded multi-selection. This reviewer read these files but did not rerun those suites.

## Native facts, independent design and remaining gaps

The native reference is the retained **Axure RP11.0.0.4150** managed assembly, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`, and the frozen reports bound in the JSON. Their probes replay decoded CIL with explicit dependency sinks; they do not execute the original DLL or authenticated editor.

- Proven native units: P101 Point; P105 Size; P7/P8 whole Fill; P11/12/13/14 independent padding edges; P17 endpoint pair; individual whole shadow objects; P21 complete state map on the ordinary commit path. `XcY.bDR`100665346 filters each selected owner separately. `KJm7.GetEdit`100695569 compares against the current provider; `sJp1`100695567 and `WJpV`100695539 select Base and clear affected keys across all local adaptive-style values. The dedicated first-state route is separately documented in `adaptive-all-views-effects-evidence.md`.
- Product extension: arbitrary `cornerRadii[4]` and `borderWidths[4]` retain existing reset-pair conventions. They are **not** the native independent uniform radius/width plus visibility-mask properties. This review does not label those tuple atomics as native proof.
- Product policy: explicit whole-widget rich formatting resets can normalize shared raw runs/paragraphs. The native evidence proves shared attributed content and provider-driven displayed formatting, but not every character-selection toolbar command or equal-value rich reset.
- Unproved in this review: native GUI transactions, all contained/master selection routes, fractional/constraint-driven geometry special cases, and full original numeric-field dispatch. No original adaptive-edit before/after sample was manufactured.

## Frozen execution record

`adaptive-all-views-independent-review-probe.mjs` completed **4 bounded current-product cases: 3 passed, 1 confirmed failure**. The passing controls are mixed-selection X, width and scalar fontSize. The failure is the one-edge padding witness above. A failed expected condition is recorded in JSON rather than hidden by an exception or converted into an accepted snapshot.

- JSON: `research/adaptive-all-views-independent-review.json` — SHA-256 `9727ba029b7ed9b2bcfe4cddc2cac807ce2cf1ca53911a8b31fa0f8809916616`.
- Probe: `research/adaptive-all-views-independent-review-probe.mjs` — SHA-256 `3be08ab111042edf6ef60808f381cb27bbab1808c2bcf1c67ba5a68810488194`.
- Before-fix App SHA: `95dc9856f96c9acf9820ab00748a7e4d7acf40ca18dbd0bf629abe30c1310636`.
- Before-fix adaptive model SHA: `2cd738e8db66e70d534c76df7ee7b8889b2ed4747bbf1f8a6fa916ff82cbdbb7`.

The probe uses exclusive file creation. A follow-up must write a **new output path** and record its changed source hashes, never replace this failed witness.
