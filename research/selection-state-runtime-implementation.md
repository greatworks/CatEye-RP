# Selection SVG runtime paint ledger

The runtime now exposes `selectionIndicatorPaint(id, context?)` and records paint at eligible setters. The portable factory and module share the implementation. The getter does not reconstruct state transitions from a final widget.

## Contract

- Initial normal asset geometry/colors are separate from selected/checked/disabled metadata. The radio mark starts fill-only, with its own implicit stroke width 1; checkbox tick width stays assetSize/14*3.
- Nonzero solid stroke writes independent outline and mark attributes. Zero preserves the previous attributes; linePattern none overrides computed widths without erasing them.
- Selected paints before selectedChange/select callbacks. Error writes its flag and runs callbacks first, then reevaluates eligibility and paints the explicitly requested error state.
- Hover has no disabled gate; down/focus/selected/error do. Base empty effects are absent; adaptive empty effects count as presence. Existing complete state resolution is reused, with sparse action SVG style applied last.
- Initialization follows error → selected → enabled and the selected binding paint. Adaptive repaint preserves the asset and stroke history; actual product row reconstruction resets assets. Page navigation/dispose clear the ledger. Atomic rollback and engine snapshot restore carry the finite optional state record.
- The offline mount passes a snapshot (or explicit null fallback) and permits disabled selection hover styling without enabling action dispatch.

## Verification

New tests: **35/35**; related selection/interaction/error/display-source tests: **101/101**; combined **136/136**. Typecheck exit 0. Tests run both direct module and bare Function.toString factory, including same-turn 3→0 history, radio default-width separation, normal/adaptive/selected/disabled/error/focus/hover, nested synchronous and Wait callbacks, action-over-state cascade, asset identity, row isolation/reset, page/dispose, atomic failure and consecutive engine snapshots.

The exact red/intermediate/green files and their individual counts are in the adjacent JSON. Four early fixture failures were malformed selected fields on saved checkbox/radio objects; they are not product failures. Earlier bytes and logs were retained. A failed Python alias edit attempt was detected by rereading source and replaced with an explicit Node file edit; its test result is retained. Final host-only null/hover wiring followed focused green and is left to parent production-browser verification.

## Frozen owned sources

- src/runtime/export-runtime.ts — `d4b5478c9d5578646e17ca733e7548e320787de1fb61f2628ac1744a6e1859d7`
- tests/selection-state-runtime.test.ts — `baa3f8b67e4a07f99b2c3c593182c352443f18bb395b5e690314d117a343c433`

Before source: `.build/selection-state-runtime-before/export-runtime.ts` SHA a80d77b69bd3a4e8dec4f968d3b933a35f35444fc574738cbf592521468ed420. Final byte copies: `.build/selection-state-runtime-final/`.

## Boundaries

- Ordinary unrotated checkbox/radio solid-color inline assets only. Explicit finite P94 and nonnegative outline width with assetSize > assetStrokeWidth; initial linePattern must be absent or solid.
- Runtime alpha solid colors and linePattern none are supported. Gradient, partial border, corner, shadow and other unknown paints return undefined and hosts explicitly use null for runtime fallback.
- Action style accumulation is modeled; the saved Action schema has no clearPrevious/className carrier. Do not infer full native ApplyStyleInfo equivalence.
- The product repeater rebuild lifecycle creates fresh assets. Native itemsPregen reuse is not modeled and persist alone is not claimed to imply native DOM replacement.
- Ledger API returns a detached paint. Initial getter creation may register immutable authored asset state, but it never infers missed event paints from final widget style.
- Runtime state snapshots carry optional selectionPaintState; Document serialization is unchanged. No original GUI, full exported-project, raster, theme, complete provider or unsupported paint parity is claimed.
- No browser/full-suite/package checks were run by this owner. Parent owns integration/render/browser/release verification.

Original evidence is reused unchanged: 144 dispatch sequences / 520 steps / 220 real SVG calls; 12 callback cases; 8 action cases; 6 asset sequences / 102 observations; 8 initial-generation cases. These are source research counts, separate from product tests.
