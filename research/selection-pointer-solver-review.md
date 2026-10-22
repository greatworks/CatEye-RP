# Selection pointer resize: independent bounded model review

No blocking mismatch was found in the implemented, unrotated ordinary-selection domain. This is a read-only review of `src/model/selection-pointer-resize.ts`, SHA-256 `d502dfd682dcc1baa4197e7d8ed80722a28682a441df665bb3ecd23743de6869`. No product, test, or previously frozen evidence file was changed.

The source contract remains the frozen `selection-pointer-evidence.md/.json` and `selection-pointer-manifest.json`: 77 retained-instruction checks, including 30 persistent scenarios / 71 CbNX calls. Those checks are static CIL-record interpretation with declared services, not execution of the vendor DLL or GUI. The product admits a narrower domain than every source probe; the 30/90-degree and modifier probes are not claimed as product support.

## Checks against the implementation

| Concern | Read-only result |
|---|---|
| Initial geometry versus live panel/flags | `prepareSelectionPointerResize` retains initial target rectangles and common bounds. Each subsequent plan reads the preceding state's panel, fit flags and measurement counter; it does not replace them with gesture-start values. The independent differential cases compare these values after every frame. |
| Single dispatch and AFW hot zone | Only Left/Right are admitted. The live `fitHotZone` controls JbNd-like entry, and the current effective width-fit flag is retained after the first nonzero horizontal frame. Return to accumulated delta zero does not restore a previously disabled flag. Original CbNX's separate single branch is respected. |
| Single rounding and minimum | Signed width delta is rounded AwayFromZero before clamping. The opposite original anchor is preserved. Minimum size comes from `services.readMinimumSize`, matching `obN4` IL454–460: `ldarg.1`, virtual `xJdR` token100695441, then `x5sY`. **The 1×1 used by the ordinary source facade/host is not a literal minimum embedded in obN4.** No fixed-1 substitution is warranted. |
| Size and final Location | Layout/Size executes against live state before the requested Location is written. Final Location is not recomputed from the measured height. Effects use current-view `allViews:false`, consistent with VbN8→YJ0S. |
| Multiple roots | Original common selection bounds are used for all roots. Left/Top upper clamps and other-handle lower clamps operate on that common size, not each member size. Root solver calls omit PinInfo and preserve original geometry; measured layout follows afterward. |
| Locked roots | Preparation includes locked target rectangles in common bounds. Planning skips their setters and retains their state. This agrees with the mixed-locked retained cases; all-locked handle visibility remains a host/controller responsibility. |
| Failure atomicity | The planner works on copied state and returns no successful state/results on a later target failure. This is the product's atomic-commit contract, not a claim that the original history facade reproduced native rollback. |

The existing product test source was inspected, including its comparisons against source-session records, clamp/locked cases and failure/state-preservation cases. Its owner-reported test count was not counted as an additional execution by this review.

## Independent executions

`selection-pointer-solver-review.mjs` executes the three pure product modules using Node's built-in TypeScript stripping and data-URL imports. It calls the safely importable retained-CIL session interpreter with **new inputs**, rather than merely reading the product's own expected values.

Result: **12/12 scenarios, 36/36 consecutive frames, zero mismatches**. Eight single-root cases vary AlignRight, width-fit and Left/Right handles using nonzero `[2,4,3,5]` padding and changing injected font answers. Four multiple-root cases vary width-fit and Left/BottomRight handles using unequal member sizes and a shared 400×50 frame. Every sequence returns to zero accumulated delta between other frames. The checks compare owner rectangle, live panel rectangle and raw width-fit after each frame, assert input-state immutability, and rehash the adapter before/after execution. This suite supplements the frozen source matrix; it does not replace its rotation, modifier, lock, threshold or crossing cases.

All current dependency hashes are recorded in `selection-pointer-solver-review.json`; the companion review manifest binds the report, script, output, original-source manifest and preserved harness-attempt record. Current source hashes still match those in the executed output.

## Preserved failed harness attempts

`selection-pointer-solver-review-initial-run.json` records two attempts that produced no product comparison result: a Vite middleware-SSR process stopped after approximately one minute without output, and a TypeScript package API mismatch before any product import. The successful replacement uses no server, browser, build or filesystem module output. These are harness failures, not product defects or original-application observations.

## Remaining boundaries

- Product support here is unrotated ordinary checkbox/radio in the admitted page coordinate context. Panel/repeater origins, general transforms and mixed widget kinds are not established by this review.
- Shift/Ctrl/Alt are explicitly rejected; original multiple-selection aspect behavior is known from source but is not implemented by this bounded adapter.
- Unsafe or negative measured text-panel dimensions are rejected atomically by the product rather than being presented as native-equivalent success.
- Font measurement, graphics units, the ordinary minimum-size provider and notification/history services remain explicit facades in the source oracle. No original GUI, vendor DLL method, native pixel result or font metric was measured here.
- This review covers the pure model and its source contract. Pointer capture, asynchronous host work, history, cancellation and UI handle rendering have separate owners and are not validated by these 36 frames.
