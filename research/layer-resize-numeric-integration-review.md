# Layer resize planner: independent numeric integration review

**No actionable discrepancy found in the reviewed supported branch.** The independent composition check passes **83/83 cases**. All reviewed source hashes remained stable during execution. No product, existing test, frozen report, browser output, or release artifact was changed.

Reviewed planner: `src/model/author-layer-resize.ts`, SHA-256
`642b075a7a3f86a030588a14f1775b20356c9a5ea24115d59dae29999a9b6f04`.
Its exact reviewed bytes are preserved in
`layer-resize-numeric-integration-review-642b075a7a3f.ts.txt`.
The accompanying JSON binds the solver, shared bounds helper, pin resolver,
source adapters and new probe.

## Executed check

The probe loads only the reusable prefix of the controller agent's new composed
oracle. It does not run that script's case loop or regenerate its report.
The controller's actual retained CIL control flow calls the separately retained
numeric CIL interpreter for `INw2` and `mNwa`. Product code is loaded separately
through Vite middleware mode without opening a listening browser server.

The added cases are independent of the controller agent's 74 original fixtures:

| Cases | Coverage |
|---:|---|
| 63 | Zero and positive/negative displacements immediately below, at and above `1e-5`; horizontal/vertical/both freedom; normal, Control+Alt and Control+Shift+Alt; fixed and free members with initially true AutoFit flags |
| 16 | Nested Layers with negative/shared coordinates, center pins, fixed members, both leading/trailing handles and rotations `0,0.999999,1,1.000001,30,90,-90,360` |
| 4 | Entered versus unentered Layer lock context, lock override, background exclusion |

All 16 nested cases execute the source `mNwa` origin-correction path. Fifty-five
cases include a source fit-flag transition to false. The check compares final
member geometry and fit flags, verifies the original input remains unchanged,
and applies the separately retained per-pair setter equality threshold before
comparing results.

## Source-to-product findings

* **Bounds and rotation:** ordinary snapshots use the shared source-bound
  `getAuthorResizeBounds`, including the near-one-degree branch. Layer frames
  are the union of members, with nested Layer wrapper rotation excluded.
  The updated `layer-geometry.ts` consumes the same bounds helper, eliminating
  the earlier display/snapshot formula difference. Hidden/unplaced members
  are not excluded by this author planner.
* **Optional location:** `frames` subtracts the old direct Layer frame from
  the old ordinary rectangle, and its old bounds from the old rotated bounds.
  `project` adds the optional location after solving. The nested pin-origin
  correction follows the retained `jbNm` order, including its later location
  addition; the review did not replace that sequence with an idealized
  single-origin expression.
* **Two passes and PinInfo:** candidates use contact-member pins against the
  requested new parent. Contact commits use that requested parent; remaining
  commits use the candidate parent's size. Both retain old snapshots and the
  same child delta. `ubNp`'s scaling-and-pin condition is also preserved.
* **Control+Alt and fit:** the exact Control+Alt-without-Shift alternate pin
  branch clears pins/fixed inputs for the Layer child solver. The separate
  `JbNd` gate still reads the effective stored fixed flag when
  `respectFixedFields` is true. The product correctly keeps those two concerns
  separate; the 63-case matrix exercises this interaction.
* **Capability scope:** every currently admitted ordinary class has the two
  fixed-size capability bits in the retained capability evidence. Classes
  with different or unclosed downstream behavior are rejected before publishing
  mutations. This review does not authorize treating SelectionButton,
  Repeater, Connector or Tree as a generic ordinary leaf.
* **Near equality:** Location and Size remain separate pairs. The planner's
  strict per-component `abs(a-b)<1e-5` no-op matches the retained setter
  predicates at the tested boundaries. A geometry pair can remain unchanged
  while the earlier fit flag changes, and the product retains that fit-only
  patch. No effective write was lost in these cases.
* **Locks:** inherited Layer lock context and background exclusion match the
  source cases; an unentered unlocked Layer can resize a locked member, while
  entering that Layer makes its member lock effective.

Primary source methods are `jbNm` **100686249**, `ubNp` **100686251**,
`kbNq` **100686252**, `JbNd` **100686253**, `INw2` **100703557**,
`mNwa` **100703559**, and the ordinary Size/Location setters
**100695365 / 100695349**. Full source provenance remains in the unchanged
controller and numeric manifests linked by the review JSON.

## Limits

This is **CIL-record interpretation with declared facades**, not execution of
Axure DLL methods or a GUI comparison. Style/capability facts, collection
operations, positive nonempty union, and notification/final-setter side effects
are explicit boundaries. The old-to-new geometry equality predicate is
source-derived but expressed independently in this review adapter.

The planner's atomic rejection of nonfinite, zero, oversized or unsupported
geometry is a product policy. It is not a claim that the source controller
rejects every such case. Panel pinned recursion, compound control virtual
setters, image FitToImage storage absent from the current model, native history
transactions and full downstream notifications are not established by these
83 cases. No additional support is inferred for them.
