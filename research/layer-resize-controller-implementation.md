# Layer author resize planner

The planner implements the evidenced ordinary Layer resize controller using
immutable old snapshots, the two ordered member passes, and the separately
verified numerical solver. It returns validated member patches without changing
its input. This is a bounded reconstruction, not an observation of the Axure GUI.

Pinned source: Axure RP **11.0.0.4150**, DLL SHA256
`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`.
The exact source path, new CIL files, test logs and implementation hashes are in
`layer-resize-controller-implementation.json` and its separate manifest.
The previously frozen controller/numeric reports remain unchanged.

## Public contract

`planAuthorLayerResize` in `src/model/author-layer-resize.ts` accepts an effective
current-view Layer tree, drag `delta`, native handle, optional common
`selectionRect`, native freedom/orientation, aspect flag, keyboard modifiers,
lock override, entered Layer ID, and background IDs.

Coordinates remain in the nearest page/state scope. Layer membership does not
add a stored location transform. `selectionRect` is the old common selection
frame in that same scope; omission uses the selected root's derived frame.
The caller must provide the same frame to every selected Layer during a
multi-root gesture and apply all successful plans atomically. A separate
Inspector operation that requests each root's own target size is a product
authoring policy, not a claim about native multi-selection UI.

Success returns the derived Layer tree, ordered leaf patches, and a numerical
trace. Changed Location and Size are complete independent pairs. A pair within
the native per-axis strict `1e-5` equality threshold is not materialized.
`shapeText` fit changes are shared content, so the host writes those to the base
widget. Geometry is written to the current adaptive slot regardless of the
Affect All Views toggle. The planner does not write an adaptive document itself.
Failure returns a code, reason and involved IDs, with no partial patch list.

## Source mapping and entry corrections

- `TbN1..ctor` **100686207**, `jbNm` **100686249**, and `ubNp` **100686251**
  supply membership, immutable snapshots, contact classification and two passes.
  A member enters the first pass when any old bound edge is within strict
  `0.0001` of its Layer edge. The remaining pass keeps original member order.
- `kSct.UScH/zSc1/dScI/KSc3` preserve old absolute and Layer-relative frames.
  Relative solver frames are temporary; saved children retain shared scope
  coordinates. Layer's separately stored degree is preserved but is not an
  author wrapper transform. Ordinary rotated bounds use the source numeric
  helper, including its evidenced near-one-degree shortcut.
- `kbNq` **100686252** reads pin/fixed properties and capabilities. Exact
  Control+Alt without Shift bypasses stored pin/fixed flags. `JbNd`
  **100686253** performs the evidenced fit updates before solving.
- `YJ0S` **100695371** and the ordinary Size/Location setters are nonvirtual
  common methods. The new metadata inventory supports the admitted ordinary
  form classes; it does not establish compound child-layout setters.
- Positive, finite, nonempty candidate union is source-bound:
  `k5pM` **100720526** → fold **100720611** → `H5px` **100720524**.
  Empty and zero product trees remain explicitly unsupported.

Three entry issues were corrected after the first composed solver tests:

1. **Handle axes.** `obNM..ctor` **100686217**, IL `0x6D–0x74`, calls
   `MSON` **100708345** and sets the movement freedom. Left/right handles use
   freedom 1, top/bottom use 2, corner handles use 3. The planner now derives
   that default. It does not erase the orthogonal raw pointer delta;
   the numerical solver consumes the freedom. Explicit native freedom remains
   available for controlled lower-level contexts.
2. **Crossing the opposite edge.** `CbNX` **100686248**, IL `0x312–0x389`,
   clamps x against the old selection width and y against its height.
   Left/top use `min(delta, extent)`; other handles use `max(delta, -extent)`.
   This occurs before dispatch. Without it, a drag past the opposite edge could
   normalize into a reflected positive frame. The planner now clamps first;
   the existing product minimum dimension of 1 then rejects zero results
   atomically. Native zero-size persistence is not claimed.
3. **Multiple roots.** `CbNX`, IL `0x2F4–0x310` and `0x3AB–0x3C3`, passes one
   scope-adjusted selection frame and the same clamped deltas to each root.
   The new `selectionRect` input preserves this relation. Two roots at
   `(0,0,100,100)` and `(300,0,100,100)`, with common `(0,0,400,100)` and east
   delta `(100,35)`, become `(0,0,125,100)` and `(375,0,125,100)`.

The old 78 composed cases deliberately start at `jbNm` with an explicit
freedom, beneath the constructor entry. Tests now state that context explicitly.
The 22 new composed cases replay the real `MSON` default and the contiguous
`CbNX` clamp instructions before running the retained controller and numerical
CIL interpreters. These interpreters execute recorded instructions in JavaScript;
they do not execute the original assembly.

## Supported scope and rejection boundaries

Nested Layers and the represented ordinary types are supported:
box, ellipse, path, text, button, image, placeholder, line, input, textarea,
select, hotspot and inline frame. Their ordinary geometry is updated; content,
styles, rich text, actions, placement, visibility, pins and unrelated data are
preserved. Existing represented shape fit flags are changed only through the
evidenced branch.

Panel, repeater, table/cell, menu, tree/node, checkbox/radio, component-instance
payloads and other compound payloads are atomically refused. Their native
special setters, pinned-content propagation or unrepresented fit flags are not
replaced by a generic scale. Connector behavior is not introduced by this API.
The model does not expose native ImageBox FitToImage, so no such flag is invented.

Locked/background skips and entered-Layer lock context are supported. Hidden
and unplaced members remain in the editor Layer bounds; this is distinct from
runtime visibility-filtered group bounds. Native selection discovery itself is
outside the planner: `KJYm` **100695937** filters `VisibleInEditor/EJqe`, while
`SJYh` **100695934** unions `JJ0R` without that filter. The supported entry is an
ordinary visible selection of Layer roots. Differences between native editor
visibility overrides, unplaced roots and the two cached selection frames are
not silently inferred from a runtime `hidden` field. A selected root's lock
does not by itself remove it from the supplied common selection snapshot.

Product guards reject duplicate IDs, invalid selections, depth/node budget
overflow, empty/zero Layers, nonfinite results, ordinary dimensions below 1,
and values outside the existing document range. Unsupported input or any
invalid descendant result leaves the whole plan unapplied. Native undo,
notifications, snapping, selection discovery, compound setters, and GUI
pixel/interaction equivalence remain outside this implementation proof.

## Verification and preserved failures

- Frozen controller contract: **142/142** bounded CIL cases.
- Frozen numeric contract: **5,004/5,004** numerical cases; these are separate
  from the new planner test count.
- New composed planner fixtures: **78** lower-level cases.
- New entry fixtures: **54/54** checks, comprising **32** handle/clamp policy
  replays and **22** full controller/numeric cases.
- Final focused product suite: **145/145**, plus TypeScript check exit 0.
- Initial entry regression: **13 failures / 123 tests**. The earlier four
  crossing failures, old 107-pass report, and exact pre-correction planner
  bytes are retained under `.build/layer-resize-controller-before-crossing/`.

The final product suite checks source numeric results and ordered writes,
nested origins, all pin modes, modifiers, lock context, shared selections,
side handles, crossing guards, fit effects, shared payload preservation,
model limits and lack of input mutation. No full repository suite, build,
browser or desktop package test was run by this scope. Those are parent-stage
integration checks and must not be substituted for original Axure GUI evidence.
