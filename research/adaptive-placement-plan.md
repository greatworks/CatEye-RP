# Adaptive placement: evidence and implementation plan

The objective remains a complete reconstruction of Axure RP 11, including authoring, runtime, interchange and the wider feature matrix. The preceding turn made concrete progress by publishing native adaptive import with verified source, package and archive bytes. The current release was revalidated before this stage; `.build/adaptive-placement-preflight.json` preserves four backups and the exact baseline. This stage addresses the still-missing Place/Unplace workflow, not a new definition of overall completion.

## Questions to establish before implementation

1. What does native PLACED P111 store in Base and local styles, and how do Overridden/Determined and inheritance affect the generated limbo value? Count actual examples in the eleven pinned original inputs and preserve source hashes.
2. How does native limbo differ from hidden for drawing, action targeting, descendants, events, focus, fit-content bounds, repeater rows, frames and adaptive transitions? Probe retained original runtime functions and distinguish their bounded observations from complete browser-project equivalence.
3. Which native editing commands change placement, which scopes they affect, and how can an unplaced object be selected/restored? Preserve the distinction from deletion and examine the Affect All Views setting rather than assuming its meaning.
4. Add a separate placement representation that preserves old project bytes and default behavior. Validate explicit Boolean resets, inherited/local declarations, shared view sets, save/reopen, component remapping and undo. Do not map placement to hidden or remove unplaced objects from the saved graph.
5. Connect the editing workflow, raw RP storage recovery, action runtime, preview, nested frames and portable HTML. Reject unsupported carriers with attributable diagnostics; do not silently invent source placement or collapse missing values.
6. Verify real-file changes against the complete previous corpus, exercise authoring plus raw input and reload, rebuild the Windows candidate, inspect screenshots and check all archive bytes before replacing the release. Retain prior reports and avoid cross-worker log filename collisions.

## Ownership and validation

- Format investigation: `adaptive-placement-format-*`, native carriers and original sample census.
- Runtime investigation: `adaptive-placement-runtime-*`, exact retained functions and observed semantics.
- Authoring investigation: `adaptive-placement-authoring-*`, native commands and existing model/editor integration.
- Main agent: cross-layer contract, real corpus comparison, integration and package verification. Product ownership will be assigned after the contracts are established.

New runtime and conversion behavior requires focused failing tests before implementation, followed by meaningful unit, production-browser and exact-package regression. The model must distinguish omitted default placement, explicit true/false and visibility. A hidden panel's descendants, inactive views and an unplaced source object are not interchangeable scopes.

The previous native editor attempt observed an authorized blank window, but its screenshot and coordinate geometry failed. No original canvas or pixel equivalence is claimed. That limitation does not block independent evidence-backed implementation work, and the complete reconstruction goal remains active.
