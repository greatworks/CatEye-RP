# Native adaptive project import

The full goal remains an evidence-based reconstruction of Axure RP 11. The previous goal turn was progress: a tested Windows package added shared view sets, state effects and runtime selection. Current release and all source/evidence hashes were revalidated before this stage; `.build/adaptive-import-preflight.json` preserves its baseline. This stage connects native RP records to those existing capabilities, rather than treating the independent JSON model as native compatibility.

## Questions and completion evidence

1. Recover document-owned sets and page assignments from exact native serialized carriers. Prove object versus stored GUID identity, Base sentinel, dimensions, parent links, duplicates and scope with retained CIL and strict reader tests. Preserve unresolved references as diagnostics rather than inventing definitions.
2. Recover local adaptive declarations, including the distinction between an empty normal style and an explicitly empty state map. Read the real 25 nonempty mapping owners and all 75 referenced records. Validate generator eligibility and all mapped values; never discard an effective unsupported property silently.
3. Recover Set Adaptive View and Page Adaptive View Change from native storage through the existing atomic interaction reader. Bind named actions to the imported owning set, preserve Auto/Base semantics and case termination, and reject inconsistent source context explicitly.
4. Validate the semantic report independently at the product boundary. Import shared definitions once, map page-local/inactive declarations to actual imported widget IDs, keep source issues attributable and retain old JSON-report compatibility.
5. Exercise raw object/binary input through reader, importer, saved design, preview and offline runtime. Original complete named-set samples are currently absent; label any generated test carrier as synthetic. Recount unchanged real corpus files and show actual recovered objects, not just test counts.
6. Rebuild and run the exact Windows package, including its isolated parser worker and new bundled reader modules. Verify saved documents, offline behavior, full regression, archive bytes and retained prior evidence before replacing the release.

## Work ownership

- `axure_format_research`: new set/assignment reader and native set evidence.
- `editor_core`: native action/event reader, product-boundary conversion and targeted tests.
- `axure_feature_evidence`: independent declaration/style evidence and probes.
- Main agent: local semantic integration, real-file census, raw fixture integration, end-to-end tests, desktop packaging and release validation.

## Recorded outcomes

- Set/assignment and action readers, local declarations and independent product validation are implemented within the strict supported subset. The set reader has 41 cases; the action reader adds 24 cases; local declarations and hyperlink destinations are covered together by 72 focused reader cases. The final complete parser run passes 602 cases.
- The eleven original inputs retain every previously imported complete document field and its ordering. Exactly nine Flow shapes and 27 empty inactive declarations are added. The corpus still provides no complete original named-view or adaptive-action positive example.
- The separate raw property matrix passes 48 cases: 39 supported declarations, eight atomic rejections and one carrier check. Every declaration is independently encoded through the actual raw readers; expectations are handwritten. The initial diagnostic-code assertion error is retained in the first-run report.
- Independent review confirmed and rechecked two corrections: standalone diagnostic counts and rejecting a container before registering its descendants. The retained red/green records identify these concrete failures.
- The complete unit run passes 3,145 cases in 131 files. Its first run's three stale fixture/behavior expectations and the unchanged-production correction are recorded in `.build/adaptive-import-old-expectations-review.json`. TypeScript passes. The initial unsupported Vitest `--minWorkers` invocation is retained separately and was corrected to the supported `--maxWorkers=4` option.
- The exact candidate imports raw RP through its parser worker, saves/reopens four times, exports without network access, and executes native Auto/Base/named actions with inherited geometry and the empty state-map barrier. Four package screenshots have been visually inspected. These are synthetic storage-integration checks, not an original editor comparison.
- Full browser, exact-package regression and archive outcomes are verified together in [adaptive-import-verification.json](adaptive-import-verification.json). The release report is written only after source/build hashes, prior evidence, packaged parser bytes and every archive file match. A `candidateOnly` report is not a published archive verification.

Native UI screenshot and coordinate geometry failures remain recorded in the preceding stage. This work does not claim original editor round-trip or pixel equivalence. Existing user-approved source analysis continues without retrying unchanged GUI failures. No original proprietary implementation is shipped in the independent product.
