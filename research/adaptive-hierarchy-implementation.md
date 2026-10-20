# Adaptive size selection and inheritance

This stage follows the retained Axure RP 11.0.0.4150 runtime and managed format evidence. [Runtime evidence](adaptive-hierarchy-evidence.md) contains 83 exact-source NodeVM cases; [format evidence](adaptive-hierarchy-format-evidence.md) records static CIL and eleven original file samples. These are independent of the reconstruction tests. They do not establish original native GUI or pixel equivalence.

## Document and authoring contract

New pages use `adaptiveSelection: 'native-size'` and independent `adaptiveBaseSize: {width:0,height:0}`. This discriminator is an explicit compatibility decision in the independent format, not a native Axure property. Old pages without it keep their maximum-width selection when opened and saved. The author can choose **Use view sizes** to change a legacy page; normal document undo restores the previous rule.

Native selection compares saved view widths with the viewport, preferring the largest fitting width. Height resolves equal widths; a height greater than the viewport does not exclude a view of a larger width. Default Base participates first, so exact size ties retain Base; tied named views retain declaration order. Base dimensions are independent of the editing canvas. Supported finite dimensions are 0–100000; missing height is normalized to0 for selection. The original fallback's zero handling is retained. These validation limits intentionally exclude malformed JavaScript/coercion behavior.

Named `baseViewId` links define ancestry independently of dimensions or array order. Base is represented by an omitted parent. Import validates each page's graph and rejects dangling, self, cyclic or cross-page parents. Normal layout/style declarations merge from ancestors to descendants. The existing atomic style resets (solid color clearing its inherited gradient, unified radius clearing corners, unified border width clearing per-side widths) remain meaningful across ancestors.

The author edits a child's local difference against its effective parent. Shared content, structure and new widgets remain in Base. Reset removes local overrides and reveals the parent. Deleting a view reparents only its direct children to its own parent, retaining each child's local overrides. This reparenting has native CIL evidence; the reconstruction's undo capability is a product choice.

Independent review found and reproduced a local-declaration loss: after the parent became equal to an existing child declaration, editing unrelated notes removed that child declaration. A later parent change then incorrectly affected the child. Four failing model cases and an actual author-browser reproduction were retained before fixing it. Unchanged existing local fields now remain owned by the child, including explicit solid-paint and rich-text resets; genuinely changed fields are still compared with the effective parent. Atomic paint/radius/border pairs are recomputed together. The implementation does not copy inherited fields into local overrides.

The controls expose Width, Height and Inherit from, exclude descendants as potential parents, and show the local override count. A view dimension of0 uses the page's canvas dimension for editing, so the independent authoring surface remains usable; this canvas fallback is not claimed as an original GUI measurement. Runtime selection still treats0 as its actual numeric threshold.

## Runtime contract

Module and serialized runtime select each destination page independently. Legacy and native pages may coexist. Viewport policies copy and validate width/height before queuing. A host supplies its actual viewport height; a core call without a supplied dimension falls back to that page's canvas dimension. Existing width clamping in offline/frame hosts remains separate from height selection.

Inherited declarations must be available before Loaded, including hidden/inactive contents and row templates. The runtime exposes a copy of the effective adaptive declaration for host paint baselines without mixing in Set Style or state results. A same-view viewport change preserves runtime actions; a real view change keeps the prior transition/reset and rollback contracts.

## Boundaries

This stage does not add original adaptive state-style maps, master-specific view sets, automatic/forced view actions, Adaptive View Changed events, global useViews controls, limbo/unplaced state, or complete RP adaptive import. The eleven real samples contain no complete named adaptive views; cached MatchInfos are not promoted into live definitions. The existing original GUI capture/activation failure remains unresolved and no pixel equivalence is claimed.

Validation passed: 2,871 unit tests across 120 files; 241 complete production-browser cases plus 17 focused cases; typecheck and production build; 14 smoke scripts against the same packaged app.asar. The primary desktop smoke includes four unchanged save/reopen checks, offline export, nested frames, and five visually inspected screenshots. The parser was not reexecuted: its previously passing 496-case report is inherited only after source and packaged-parser hashes were checked unchanged. Final archive and source hashes are recorded in [release verification](adaptive-hierarchy-verification.json).

The first packaged boundary check exposed Windows/Electron sizing behavior at 150% display scaling: requested 499 pixels became an actual 500-pixel viewport (389 became 390 on the width axis). Twenty isolated window measurements confirmed this independently of the product. The final desktop smoke records actual achievable 498/500 heights and 388/390 widths; the browser suite retains exact 499/500 and 389/390 cases. The failed desktop report and screenshots remain preserved. See [sizing evidence](adaptive-hierarchy-electron-sizing-evidence.md).

The first full browser run passed 240 of 241 cases. Its remaining vector-editing fixture was authored for the legacy maximum-width rule but called the now-native new-page factory. Only that fixture was explicitly marked legacy; its original path/rotation/save/offline assertions were retained. The isolated case and the subsequent complete 241-case run passed. Eight pre-existing adaptive fixtures now state their legacy mode explicitly; new-mode authoring, runtime and boundary cases remain separate. The first-run report, trace and screenshots are preserved at their original result paths.
