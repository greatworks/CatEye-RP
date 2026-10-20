# Layer author resize: final independent integration review

No remaining actionable discrepancy was found in the reviewed, supported
branch. **179/179 checks pass against planner SHA-256
`2d578f9151299197e9efb0e0f690449705991331f97a091860932e483e620bc6`.**
This is an append review; the earlier 83-case review, its `642b075a…` product
bytes, and the later 16-case difference report remain unchanged.

The final planner bytes are retained in
`layer-resize-numeric-final-review-2d578f915129.ts.txt`. The JSON accompanying this
report binds the current dependencies, actual probe outputs, reviewed App bytes,
original-source records and preserved failure records.

## Executed comparisons

| Checks | Result | Scope |
|---:|---:|---|
| 83 | 83 passed | Same inputs as the first independent integration review: pair equality, AutoFit/fixed flags, Control+Alt, nested origins, rotation, locks and background exclusion |
| 32 | 32 passed | Eight handles × positive/negative displacements × free/locked second selected root, using a common selection |
| 8 | 8 passed | Translated, negative-coordinate, non-square shared selections |
| 8 | 8 passed | Explicit low-level freedom remains available rather than being overwritten by the handle default |
| 48 | 48 passed | Opposite-signed and crossing raw deltas, exact collapse boundaries, all eight handles; 18 finite outcomes and 30 atomic positive-size policy rejections |

The source oracle does not call the product solver. It interprets the retained
`CbNX` clamp instructions, the complete retained `MSON` method, `jbNm`, and the
separate numeric `INw2`/`mNwa` instruction records with declared facades.
No Axure DLL method or original GUI was executed. Vite middleware loads the
product module for comparison; no browser or desktop suite was started.

The two review processes briefly overlapped in Vite middleware initialization,
and the second logged `WebSocket server error: Port 24678 is already in use`.
It continued to completion with exit code 0 and all 96 comparisons passed.
The first completed with exit code 0 and all 83 passed. This warning concerns
the review loader's unused HMR listener; no browser evidence depends on it.

## Closed entry contract

`obNM.CbNX`, token **100686248**, IL **786–905** clamps the raw displacement
against the common old selection's dimensions:

```text
dx = Left ? min(rawDx, selection.width)  : max(rawDx, -selection.width)
dy = Top  ? min(rawDy, selection.height) : max(rawDy, -selection.height)
```

Both coordinates are clamped before axis freedom is applied. The loop's call
at IL **963 / 0x3C3** supplies the same parent rectangle and displacement to
each selected root's `jbNm` (**100686249**). The new review supplies the
positive, same-scope selected roots explicitly and then executes that downstream
flow; it does not pretend to execute the enclosing editor selection subsystem.

Constructor **100686217**, IL **0x109–0x116**, derives the handle freedom through
`MSON` **100708345**. The original method replay confirms W/E = 1, N/S = 2,
corners = 3. The final planner applies that default while preserving an explicit
low-level freedom argument.

The representative formerly incorrect case is now exact:

```text
old roots: a=(0,0,100,100), b=(300,0,100,100)
common old selection=(0,0,400,100)
bottom-right displacement=(100,40)
result: a=(0,0,125,140), b=(375,0,125,140)
```

The old per-root call produced widths 200 and retained b.x=300. The original
failure remains in `layer-resize-numeric-entry-review-probes.json`; its positive
bottom-right case establishes the shared-selection bug independently of the
separate side-handle freedom correction.

When the second selected root is locked, the shared selection remains 400×100,
the first result remains 125×140, and the locked root is unchanged. The original
`jbNm` skip executes in the new oracle. Upstream visible-selected-root membership
is a supplied boundary; the controller's separate CIL evidence establishes that
editor visibility filtering does not itself test `Locked`.

## Host read-through

Reviewed App SHA-256:
`2dff4dc6177d5c33f12b6dec799d4b1fe1650b57d237bdb4a7308edfbef6104e`.
Its exact bytes are retained under the new final-review prefix.

`App.tsx:348–360` computes the common selection from all selected Layer bounds
when `sharedSelection` is requested. It does not discard an already-selected
locked root from that union. The pointer branch at line 509 supplies the common
raw displacement and enables shared selection. The inspector branch at line 389
continues to calculate each target's requested width/height separately.

This is a source read-through, not a new browser validation. Inspector
multi-target numeric resizing remains an independent editor convention; this
review does not claim that its source-native numeric UI entry has been proved.

## Preserved boundaries

- The original 83-case result concerned `jbNm` integration and did not exercise
  the later-discovered `CbNX` entry clamp or default freedom. It is not
  relabeled as having done so.
- The 30 collapse cases intentionally reject geometry that cannot satisfy the
  product's positive-size model. Their passing assertions prove atomic
  rejection and unchanged inputs, not equality with native zero-size handling.
- Selection construction for editor-hidden or unplaced roots is not generalized:
  the source `ybSW` sizing and `PbSc` parent-frame paths can filter differently.
  The shared-selection comparison covers visible selected Layers in one scope.
- Collections, style/capability facts, positive nonempty unions, final property
  effects and notifications remain declared interpreter facades. The retained
  numeric/controller evidence explains their boundaries.
- Panel/compound-control virtual setters, image FitToImage state, original
  history/notification dispatch and upstream snapping are not completed by
  this review. Existing explicit unsupported gates remain in place.

No production code, existing tests, frozen reports, browser artifacts or
release files were modified by this final review.
