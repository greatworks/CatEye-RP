# P111 reader/import implementation and verification

The frozen static contract is `adaptive-placement-format-evidence.md/.json` and its original manifest. Those files were not rewritten. The implementation below is limited to native RP11 `[11,0,0,0]` direct/local P111 declarations. Earlier container versions remain readable; this new declaration mapping does not grant them new placement semantics.

## Implemented protocol

`read-rp-adaptive.mjs` exports `nativePlaced(value)`: it accepts only integer BoolOverride 0, 1, 2 and returns `value === 1`. `recoverPlacement` in `read-rp-semantics.mjs` handles Base separately from visual styles. A direct OD MyStyle record returns schema1 `supported-direct-placement`, source object ID, placed, and a source containing kind `native-object-MyStyle`, exact style ID, raw DOAName, original enum and package version. The original record also remains in `storedGeometry.placement`.

An inactive direct record cannot replace the inherited cache. It is admitted only with a complete known-true cache fallback, recorded as `inactive-direct-placement` with that fallback source. An exact known-true cache without a direct record emits no new placement field. Nontrue or indeterminate cached placement returns `unsupported-placement`; this stage does not infer default/named provider semantics from flattened cache data. Boolean/fractional/out-of-range carriers and missing/old versions are rejected. A malformed Boolean P111 is rejected even if its local record is inactive; valid inactive integers remain inert.

Local AdaptiveStyles reuses the existing schema1 raw property records and adds `patch.placed`. It does not place P111 in WidgetStyle or an IX state patch. `import-rp-adaptive.ts` independently reconstructs both the raw Base and local mapping, checks identities/DOA/source versions and projection equality, and rejects forged fields. Base true remains omitted from the model; local true remains explicit to reset inherited false. Hidden remains independent.

Only supported ordinary owners and root table/menu/tree can own placement. Contained labels, table cells, menu-owned tables, tree nodes and shared compound descendants remain rejected; Page placement and arbitrary master/RDO inheritance are not added. The root table/menu/tree geometry-only native guards now permit this separate property without promoting it to a visual style.

## Fit correction and graph review

The initial importer fit-bounds calculation had only skipped hidden children. A SYNTHETIC raw fixture with a fit panel and a sole unplaced 300×170 child reproduced a wrong initial 300×170 panel instead of the model's minimum saved 1×1 rectangle. The retained native `childrenBoundingRect` path skips limbo, and the runtime already did so. The importer now also skips `child.placed === false` before its existing recursive/rotated bounds calculation. Runtime empty dimensions remain 0×0; the document's positive rectangle constraint is unchanged. `adaptive-placement-format-fit-red.log` preserves the actual mismatch; the final focused run includes both the placed and unplaced cases.

Read-only review checked that Base/local placement validation occurs before child registration, table/menu/tree failures restore target indexes and reject complete compounds, fit panels reject incomplete children, and pending adaptive maps are emitted only by traversing the final admitted graph. Removed link targets cause atomic event/dependency rejection through the existing final pass. No additional blocking issue was found. No original GUI measurement was performed.

## Focused results and exact legacy corrections

* New Node reader tests: 31 passed. The initial API red run had 26 failures before implementation.
* New importer tests: 53 passed, including actual raw container → object → semantics → editable document, second-boundary tampering, old-version rejection and the two fit cases.
* Related Node reader set: 175 passed (placement, adaptive styles/sets, table, menu and tree).
* Related importer set: 184 passed across seven files, including the parent integration test and the previously frozen 48-case visual property matrix.
* TypeScript: `npx tsc --noEmit`, exit0.
* Final original-corpus comparison: 11 sources, 10 admitted plus one identically rejected; complete documents and complete reports exactly match the immutable pre-change baseline. There are no original unplaced positive samples. The parent-owned corpus report is `adaptive-placement-corpus-audit.json`, refreshed against the final importer.

The first related reader run had one obsolete assertion that classified numeric P111=0 as an unknown visual field. It now separately asserts placed:false while all other unknown cases remain. The first related import run had one obsolete inactive Boolean P111 fixture. It now uses native numeric2 to retain the same inactive-record assertion; eligible and inactive Boolean rejection tests remain. Both original failure logs are preserved. No expectation was loosened to accept an invalid carrier.

All positive false/IGNORE placement cases are explicitly SYNTHETIC. The raw carrier uses the retained Tab Menu file as source material and a self-written encoder, not Axure save/export or native write-back. This agent did not run full suites, a build, a package, or a GUI; parent-wide validation is recorded separately.

## Reproduction

```powershell
node --test research/scripts/read-rp-placement.test.mjs research/scripts/read-rp-adaptive-styles.test.mjs research/scripts/read-rp-adaptive.test.mjs research/scripts/read-rp-table.test.mjs research/scripts/read-rp-menu.test.mjs research/scripts/read-rp-tree-widget.test.mjs
npx vitest run tests/import-rp-placement.test.ts tests/adaptive-placement-integration.test.ts tests/import-rp-adaptive-property-matrix.test.ts tests/import-rp-adaptive-styles.test.ts tests/import-rp-table.test.ts tests/import-rp-menu.test.ts tests/import-rp-tree-widget.test.ts
npx tsc --noEmit
node research/adaptive-placement-corpus-audit.mjs
node research/adaptive-placement-format-implementation-freeze.mjs
```

The implementation JSON and its separate manifest bind final sources, focused tests/logs, the frozen static manifest and final corpus audit. The prior static manifest remains unchanged.
