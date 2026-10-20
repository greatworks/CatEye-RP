# Affect All Views editing

The previous goal turn made concrete progress: ordinary placement authoring, native direct placement recovery and runtime rendering were delivered in the byte-verified Windows package. The full Axure RP 11 reconstruction remains incomplete.

This stage investigates and implements the ordinary Affect All Views authoring command for the visual properties already supported by the editor. Completion requires source-backed edit semantics, coherent UI behavior, save/reopen and preview/export verification. It does not establish native canvas or pixel equivalence, master/Layer special behavior, native RP write-back or full product parity.

## Work and evidence

1. Verify the current published archive, source inputs and historical evidence; preserve the prior archive, ASAR and verification before changes.
2. Trace the original GetEdit/SetStyleInternal and property-clearing path. Establish native property group boundaries, base-versus-current writes, no-op behavior and effects/contained-owner exceptions before deciding model semantics.
3. Inspect `src/model/adaptive.ts`, `src/App.tsx`, `src/components/Inspector.tsx` and the style/rich-text update paths. Add meaningful failing tests before feature changes; preserve their initial output.
4. Implement the verified authoring semantics with explicit edit intent where before/after values cannot express it. Keep complete object graphs, placement/insertion behavior, inactive declarations, unrelated style values, state effects and shared content coherent.
5. Verify model boundaries, actual browser controls, undo/redo, saved source and both players. Run the complete applicable regressions and build, then test and inspect the exact Windows candidate.
6. Publish only a fully checked candidate, preserve the previous release and update the implementation report and status with actual evidence and remaining limitations.

Parallel work is limited to independent original-code evidence and current-code review under REA skill rule 6. Production file ownership is assigned only after baseline capture and the evidence contract are available. Browser and desktop suites that write shared artifact paths run in separate phases, preserving historical bytes.
