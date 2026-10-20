# Independent renderer review: native corners

This review records an actual initial failure and its subsequent correction. The initial ad-hoc module command returned `supports:false` before the fix; a source hash was **not captured at that moment**. Its exact input/output and this limitation are preserved in `native-corners-render-review-observed-failure.json`. While the formal probe was being written, the parent applied the correction. Its first recorded execution was therefore **8/8 passing**, at the post-correction source SHA-256 values in `native-corners-render-review.json`. No failure hash or red test run is fabricated. The probe executes current product module and serialized helper factories only. It does not run a browser, original GUI, package, or full test suite. Original-source evidence remains separately bound in `native-corners-evidence.json`.

## NC-REVIEW-01 — valid large single-corner path loses parameter editing

Before correction, `src/model/line-style.ts` `rectangleFamily` called the older `rectangleRadii` validator, which rejected any radius greater than half the smaller dimension. This was correct for its historical restricted recognizer but too narrow for the newly supported native rectangle family: both the original JavaScript matrix and managed clamp prefix permit a single corner up to the full smaller dimension.

The minimal saved normalized path is a 200×100 rectangle with TL90 and all other corners square:

`M 0 .9 C 0 .396 .198 0 .45 0 L 1 0 L 1 1 L 0 1 L 0 .9 Z`.

With explicit native `cornerVisibility=[true,false,false,false]`, the initial direct module probe showed `supportsCorners=false` and no `vectorRectangle` result for this valid radius90 path. Static tracing showed the same rejection would persist when changing the style radius to20, because recognition used the saved path. The React and offline vector render branches would consequently fall back to that saved90 path.

The parent corrected family validation by adding an explicit larger-radius mode with adjacent-pair size constraints while preserving the legacy validator's default limit. The formal module/serialized reproductions for radius90 and radius20 now pass. Complete corner/edge order and 0.44 handle validation remain in place. This verifies the narrow correction at `line-style.ts` SHA `4232c7b60abc1e5de3067b7f95e9a9c033230ef3ddd9904e8a7b7fe2a2022d6a`; it does not claim a separately executed pre-fix four-case suite or browser UI validation.

## Other inspected paths

The new `cssRadii` implementation matches all256 corner/border equality combinations in both factory modes. An all-false mask preserves a square gradient border rather than dropping the gradient. These checks pass independently of NC-REVIEW-01. Static inspection found the same geometry and CSS helpers wired into React and offline rendering, with separate fill/stroke definitions and existing shadow paths retained. Runtime style merging does not couple radius edits to the new visibility tuple; mask replacement remains atomic. This is a bounded review, not proof of every component, state, repeater or browser lifecycle.

Two intentional source distinctions must remain visible in release claims. First, native `setBorder` skips path reconstruction at border width0 or line-pattern none, whereas the product's declarative renderer rebuilds newly authored parameter geometry. That is a product rendering choice, not an exact replay of stale SVG-path update behavior. Second, initial managed fill can recompute its own large-radius ceiling, whereas later JavaScript SVG update reuses the stroke-clamped radius. The retained report and tests cover the latter and do not establish original initial-render pixel parity.

No product, existing tests, or historical evidence were changed by this review. The original observed-failure record and the post-correction execution have separate artifacts and are not conflated with the parent's unrelated earlier renderer test failures.
