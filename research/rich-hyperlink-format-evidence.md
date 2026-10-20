# RP 11 structured inline hyperlinks

This stage recovers both witnessed `AxHyperlink` owners as structured rich text with independent link identities, complete click cases/actions, and proven named MouseOver/MouseDown patches. It adds **2 widgets, 2 link click events and 2 URL actions** to the previous frozen [inline-text milestone](inline-text-verification.json). It adds no ordinary-widget events in this corpus. This is a bounded native-format recovery, not complete Axure compatibility or an original-GUI comparison.

All original bytes were read statically. The target DLL was neither loaded nor executed, and no destination URL was visited. The DLL is RP 11.0.0.4150, SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`. Machine-readable source hashes, exact owners and limits are in [rich-hyperlink-format-evidence.json](rich-hyperlink-format-evidence.json). The original census is preserved at [rich-hyperlink-format-census.json](rich-hyperlink-format-census.json); its reader hashes describe that capture, not the later implementation.

## Observed corpus and source identities

The SHA-pinned 11-file corpus contains two owners and two inline links, each referencing a separate `Axure:DiagramObject:Hyperlink` object through a local tag-3 reference. Neither link is an ordinary standalone diagram member.

| Sample / page | Native package / owner / link | Stored geometry and text |
|---|---|---|
| Sample UI patterns.rplib / Instructions | package `27f59a68aaf249d298b4edbb44f8e2ae`; owner `14ea8a9456d14c888e8e483e64492173`; link `e96f6fd2341e436c86fd6ac86116dfea` | x654/y2028/w413/h330; 11 paragraphs, 45 runs; linked text `Learn more about Repeaters` |
| Prototyping Basics.rp / Getting started | package `8165e87159f34c58a974459d9e910e34`; owner `4f4e187b657a4108aa50438dd7d0fca8`; link `86c64d3122f34f8ea2a371b96a7b469d` | x670/y9611/w463/h208; 4 paragraphs, 9 runs; linked text `www.axure.com/support` |

UI file SHA-256: `cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b`. Basics file SHA-256: `26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7`. All 11 file hashes and the exact local object closure are retained in the census, including source run text, paragraph boundaries, reference tags, properties and named-cache entries. No official samples, CIL, DLL or image resources are introduced into the product bundle by this change.

The inline wrapper has exactly `Type`, `Link`, `Inlines`; its type is `Axure:AttributedString:AxHyperlink`, with ordinary `AxRun` children. Both linked objects have empty label/tooltip/group, no adaptive styles, zero SubmitButton, false IsContained/IsLocked/Disabled/Selected/Error and true VisibleFromSettings. Those behaviors are explicit admission constraints. Unknown active flags or extra fields reject the whole rich payload, not just the link wrapper.

## Initial text, named styles and generator evidence

The existing paragraph/run contract remains version 2, literal, with seven required run-style fields: family, size, weight, fontStyle, color, underline and strikethrough. A native paragraph's terminal LF is removed once, and the normalized paragraphs are joined by one LF. Link wrappers do not add or remove text or paragraphs. Both real owners contain the link in one child run; other runs keep their own format.

The initial linked-run baseline is the explicit child-run style. It is not reconstructed by repeatedly applying the link's normal MyStyle to its parent. The native generator evidence is:

| Static file / method | Token and IL anchor | Evidence |
|---|---|---|
| `rich-text-format-html-cil.json`, cNCQ.ONiF | 100699551, 0x38D | Identifies `gSXL.gSXD` (AxHyperlink) |
| same | 0x597 calls 100699665; child loop 0x409, child run call 0x331 | Uses the hyperlink wrapper writer and ordinary nested-run writer |
| same | ordinary run call 0x3EE | Calls the same KNiN as a non-link run |
| `rich-text-format-html-inline-cil.json`, KNiN / BNiS | 100699555 at0x41 /100699556 at0xC | The actual run is passed to style construction and PNKu.RNxS |
| `rich-hyperlink-html-writer-cil.json`, FNiU.oNPx | 100699665,0x6D→0x72 | Reads gSXD.JSXe and casts the separate InlineLink object |
| same | 0x51,0x114,0x186 | Uses the element identifier and wrapper writer BNCJ.WNCk; lower tag/attribute strings remain obfuscated |

The native wrapper tag, href and tabindex strings have **not** been established. No original keyboard/default-anchor-navigation claim follows from this CIL. Product keyboard semantics and URL dispatch are tested separately by the parent, not asserted as original behavior here.

Each link normal/state style has exact stored keys, `All=false`, a local OD-active PName0 reference equal to MatchInfo.Id, and a unique root-local cache with the same **style ID and library ID**. A local style LibraryId may be zero while its MatchInfo points to Default; Basics proves this legitimate case. A nonzero local LibraryId must match that referenced library. A missing/duplicate/wrong-library cache is rejected. Cached props are resolved data and are not incorrectly filtered as raw local OD props. Local PropList first undergoes duplicate/structure checks, then only `determined && overridden` entries override the cache. This reuses the proved [local-state filtering distinction](selected-style-filter-evidence.md).

The admitted named-cache and local typography subset is PName1,2,5,6,95,1001,1002 (family, size, underline, color, strikethrough, weight, normal/italic). PName0 and normal PName21 serve identities only. Unknown active properties or unknown inherited cache properties reject the whole link. The resolved normal subset must equal every explicit linked-run counterpart; conflicting baseline cases remain unsupported rather than inventing precedence.

| Link | Baseline run | MouseOver | MouseDown |
|---|---|---|---|
| UI | Arial13px,400,normal,`#eb2084`, underline true, strike false | `{"underline":true,"color":"#eb2084cd"}` | `{}` — explicitly present empty state |
| Basics | Montserrat18px,400,normal,`#2a6ff6`, underline true, strike false | `{"underline":true}` | `{"color":"#ff0000"}` |

UI normal cache blue is overridden by its explicit local pink; the child run is pink too. The UI empty MouseDown cache is distinct from an absent MouseDown state. Every exact cache ID, source style ID, library identity and active/source property list is retained in the import audit. No absent property is silently filled from the link normal style into its state patch.

For application and restoration of these patches, use the separate [34-probe original runtime evidence](hyperlink-runtime-evidence.md). It establishes parent/link state interactions and excludes ordinary normal style from override projection; it also records original repaint quirks. The native reader does not rewrite these as generic CSS inheritance.

## Click events and destinations

UI: event `b585e88394bf47dba6d63b48d91ef123`, case `81e3f6c41a1d40408fc8a47360268937`, action `0687b51c7d5847228873548e60882d51`, target `abe876a745954aa3a73273bbd9b7b5d5`, literal `178b5e8aebba41b2b58149eedf5fb46c`, destination `https://docs.axure.com/axure-rp/widgets/repeaters/`.

Basics: event `88ed5554054a4f7491cff74b1cfb5110`, case `c3f13ea585114bbbaf9726b978851a63`, action `57d7a1ea8bbc4b7887e1938335643fb4`, target `d7718e699008438b817c1165a148222d`, literal `ed36ffc35d794c749e7059eca85798cd`, destination `https://www.axure.com/support`.

Both use native OnClick16, one enabled case with no condition and `IsNewIfGroup=false`, enabled InteractionLinkWindowAction, `link-type=2`, `target-type=0`, zero inactive Page reference (tag19, name Axure:Page), StringLiteral with empty variable-identifiers and zero repeater scopes. The zero first-case IF flag is preserved. The decoded full tree and case/action order are retained, not inferred from object-file order.

Existing static enums `rp-interaction-LinkType-cil.json` (type33557790) and `rp-interaction-IxTargetType-cil.json` prove Current1 / New2 and WebUrl0 / Page1. **LinkType0 is Invalid, not Current.** Popup3, Parent4, Frame5, ParentFrame6 are excluded. Existing same-window Page1 navigation stays supported; New-window native page navigation is still rejected because the product page action does not encode that behavior.

The external URL subset requires literal HTTP(S), a valid hostname, no credentials, no control/ASCII whitespace/backslash, no expression marker `[[`, no leading/trailing whitespace, maximum4096 characters and current/new only. Source spelling is retained, including case and percent-encoded components. No URL is fetched during recovery. Other protocols, bound expressions and window modes are rejected. Ordinary widgets use the same strict decoder branch, but there are no additional imported ordinary events in this corpus.

Link clicks reuse the existing evidence-backed action/condition mapping and atomic IF/ELSE conversion. They are not narrowed to one unconditional URL simply because the two fixtures are simple. Explicit complete local targets and admitted pages/variables may be reused; unsupported conditions/actions or targets reject the whole linked rich owner. Native This target resolution on InlineLink remains unproved and is rejected rather than translated to the containing widget.

## Worker protocol, identity and atomicity

`richTextRecovery.source.runStyleSchemaVersion=2` remains required. Linked content additionally requires `linkSchemaVersion=1`, exact linkCount and linkSources. The normalized rich model has run.linkId plus links `{id,name,interactions,mouseOverStyle?,mouseDownStyle?}`. `linkSources` retains the decoded native interaction tree and full style-identity provenance. Empty state objects and explicit false values survive. Previous saved documents without links remain valid; stale or malformed native worker link payloads do not bypass current protocol validation.

The importer independently checks normalized cases against the raw decoded source, all style identities/source properties, the normal-run match and the shared strict rich-text model. It then resolves targets only after page/widget admission. Link, case and action IDs are scoped by package + owner + native link identity. Repeated wrapper references share one definition inside an owner; identical native IDs in different packages or different owners remain separate global identities.

If any linked case/action depends on a missing/ambiguous target, the **entire rich owner is omitted**, not replaced by unlinked text. Incoming ordinary events cannot bind it. Revalidation repeats until stable when one removed linked owner was another link's target. A fit-to-content panel losing such a child is also removed, together with its remaining states, because partial children would fabricate geometry. Report counts and target registries are updated before ordinary interactions are admitted. This behavior is covered by the mutation tests, including a real Tab Menu fit panel fixture.

Limits: at most100 definitions per rich owner,1000 paragraphs,10000 total runs,100000 projected characters; aggregate run expansion is bounded before allocating repeated wrapper contents. Existing interaction graph depth/node, case/action and string limits continue to apply. Nested link wrappers, unknown inline types, run/style fields, unsupported native behaviors and non-RP11 rich versions are rejected. Existing conservative font/glyph/geometry boundaries remain unchanged.

## Verification and remaining limits

[rich-hyperlink-import-audit.json](rich-hyperlink-import-audit.json) validates all11 pinned inputs and strict model serialization/reopen. Rich owners632→634, runs2095→2149; all previous imported owner IDs survive. UI top182→183 / nested22 / events6→7; Basics top172→173 / nested52 / events1→2. Form remains558 top +440 nested /74events. Every other corpus import count remains unchanged. Icons is still rejected by the existing page-count limit. Maximum compact semantic JSON is25,873,524 bytes (Form), below the existing64MiB worker output boundary.

Focused checks after implementation: **40 new parser tests +12 existing rich/decorations tests =52 Node**, **24 new import tests +37 existing rich/decorations tests =61 Vitest**, and typecheck passed. These are real source-format tests plus explicitly synthetic mutation/protocol tests, not original GUI comparisons. Full suites, browser/desktop/runtime validation and packaging belong to the parent milestone and are not claimed by this report.

The parent's full parser run identified one older diagnostic assertion requiring the category phrase `link window mode`. The new page-window rejection now retains that category and its precise reason (`new-window native page navigation is not mapped`); behavior is unchanged. A focused follow-up of original interaction24 + new hyperlink40 passed **64/64**, and the11-file audit was regenerated with the updated decoder hash. This overlaps the earlier40 tests; it is not64 additional unique tests.

Reproduce:

```powershell
node --test research/scripts/read-rp-rich-hyperlink.test.mjs research/scripts/read-rp-rich-text.test.mjs research/scripts/read-rp-text-decoration.test.mjs
npx vitest run tests/import-rp-rich-hyperlink.test.ts tests/import-rp-rich-text.test.ts tests/import-rp-text-decoration.test.ts
npm run typecheck
node research/rich-hyperlink-import-audit.mjs
```

The two fixtures do not prove all AxHyperlink layouts, dynamic URLs, Tooltip, disabled/selected/error/adaptive link states, compound target paths, hyperlink This, unfamiliar named-style inheritance, conflicting normal-run styles, native keyboard behavior, tag/href/tabindex generation, original browser/glyph metrics, or full RP-version compatibility. They are preserved as explicit rejection/unknown boundaries instead of being flattened or guessed.
