# Native library caption cache identity

Date: 2026-10-13. Scope: static inspection of the retained Axure RP 11 samples with the project's own container/object readers, comparison of the old and corrected semantic reader, and pure model conversion. No original DLL was loaded, original GUI capture retried, native engine installed, or vendor implementation copied into the product.

## Confirmed cause and narrow correction

The `Personal information form` captions were **not missing their native defaults**. Their page contained both the default and Label cache records. The old reader required the default cache's `Info.LibraryId` to be zero, while this library's default explicitly belongs to library `61e3924b25c44f18a45c876a031974fd`. That mismatch prevented the entire default → named base → local chain from being merged. Local Roboto/font/color and stored coordinates survived, but known zero padding, zero border, top alignment, transparent fill, and automatic spacing were lost. The model/CSS then supplied its ordinary white fill, border width 1, text padding 5, and line-height 1.35. These insets and line metrics are incompatible with the labels' saved 16 px heights. This is an observed data/protocol error; the exact original Axure rasterization remains unverified.

The corrected reader obtains **both** GUIDs from the referenced native `DefaultStyle` object. It still requires one exact matching default cache, one exact matching base cache, and agreement between local base property 0 and `MatchInfo.Id`. It does not infer identity from the names “Default” or “Label”, substitute zero for a missing library, or assume a named cache is already flattened when the default is absent. Merge precedence remains default → matched base → local → explicitly active state.

Public appearance-helper callers that already pass a string retain their legacy string → zero-library convention. The actual native document entry point never uses that fallback. Native `StyleSheet` and `DefaultStyle` links must have exactly the local reference carrier/tag 3, resolve to the expected object types, and both identity fields must be explicit GUID carriers. Duplicate document packages/objects or identity properties, missing links/identity fields, and wrong reference tags leave the inherited chain unresolved. Local appearance remains independently recoverable.

The output's `styleRecovery.defaultStyleId` remains a string or null; `defaultStyleLibraryId` is added beside it. Individual cached-property provenance records contain `kind`, `styleId`, and `libraryId`. The full source package/object identity is recorded once in top-level `defaultStyleIdentityRecovery`, avoiding repeated large source records on every inherited property. Unmapped style properties remain in the report.

## Original source and exact identity path

Source file: `DefaultSettings/Libraries/Sample form patterns.rplib`, SHA-256 `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`.

| Link / identity | Exact native value |
| --- | --- |
| DesignDocument package | `298bfb31781b4473954b4f2b8e57b4ad` |
| DesignDocument package decoded SHA | `cfd558d3496a34bf81c1991c08c947f2ae0f8c09e10005b9fed5ab396944aadd` |
| Document object | `3375cb3d3c9442b1bdad75bddfc33bc2` |
| `StyleSheet` tag-3 reference / stylesheet object | `61e3924b25c44f18a45c876a031974fd` |
| `StyleSheet.DefaultStyle` tag-3 reference / style object | `7d0df03c234e4a68a12a120fd22e2326` |
| Default style `Id` | `627587b6038d43cca051c114ac41ad32` |
| Default style `LibraryId` | `61e3924b25c44f18a45c876a031974fd` |
| Caption `MyStyle.MatchInfo.Id` and property 0 | `e2f777775bb643768ea0a48d27549fb0` |
| Caption matched-base library | `61e3924b25c44f18a45c876a031974fd` |
| Personal information form package | `784fffad1a36482594f6f965760990d6` |
| Page root / diagram | `d20f3a83e762467eb6b7ffdd464ee1a1` / `27b2986a81484c1b95187016936fd7f8` |

The page has six cached style identities: Default, Label, Text Field, Paragraph, Primary Button, and Form Hint. All use the same nonzero library GUID. The document's Label style object is `95efee6b35944bc8886d16511c44451c`; its style GUID matches the page cache and local MatchInfo exactly. The reader matches the stored GUID pair, not the descriptive names. In the five retained `.rplib` files, the default library GUID happens to equal the referenced stylesheet object's ID; the six retained `.rp` files explicitly store zero. The implementation does **not** generalize this observation into a fallback rule.

The JSON's `personalForm` preserves the full six cache records, full native default style, original caption objects and local styles, exact package SHA/version, before/after-derived geometry, and final styles. No coordinates are inferred from the screenshot.

## The five requested captions

| Native text | Native object ID | Stored X,Y | Stored width × height |
| --- | --- | --- | --- |
| First name* | `521d7ce3a85d4cf0a40f3934f8677b75` | 20,20 | 78 × 16 |
| Last name* | `dd95d9e7839f43bb811c83f46238249a` | 330,20 | 76 × 16 |
| Email address* | `0f045efac5b24769857e5ac8f794f50a` | 20,125 | 101 × 16 |
| Phone number | `c1b87b64b81c4dcab59309167dc6b268` | 20,230 | 97 × 16 |
| Date of birth | `c2a9b16835bd4d008aaf88e0b6b5ee2f` | 20,335 | 83 × 16 |

The latter two strings contain **no asterisk** in the file. All five store `AutoFitWidth=true` and `AutoFitHeight=true`, but this importer keeps the saved bounds and reports that dynamic native text measurement has not been reconstructed. It does not manufacture a new height or expand width to fit the browser's fallback font. Selected, Disabled, and Error are false.

| Appearance | Observed native source | Correct restricted output |
| --- | --- | --- |
| Font family | Local PName 1, Roboto | `fontFamily: Roboto` |
| Font size | Label PName 2 / uniform run size 10.5 | `fontSize:14` from stored units / 0.75 |
| Text color | Local PName 6, solid signed ARGB -1996488704 | `#00000089` |
| Font weight / paragraph alignment | Uniform rich-text run / paragraph | 400 / left |
| Four padding sides | Label PNames 11,12,13,14, all determined zero | `[0,0,0,0]` in top,right,bottom,left order |
| Vertical alignment | Label PName 10 = 0 | top |
| Border width | Label PName 15 = 0 | 0 |
| Fill | Label PName 7, solid ARGB 16777215 | transparent `#ffffff00` |
| Automatic spacing | Default PName 20 = 0 and each rich Paragraph.LineSpacing = 0 | browser `normal`, `nativeFontMetricsVerified:false` |

Unknown native formatting and layout properties remain explicitly unmapped. The parser does not install Roboto, prove that it is available, emulate native auto-fit, recover adaptive styles, or establish identical baseline/line breaks. A browser can still render a fallback font differently. Correctly decoding automatic spacing does not prove that the original Axure HTML generator emitted the literal CSS `normal`.

## Reused metadata/CIL, not a new default guess

See [rp-text-layout-evidence.md](rp-text-layout-evidence.md) and its retained [minimal CIL](rp-text-layout-cil.json), SHA `51988b277827c38ad561cc96358b35a110d8c239655cf8eb96a8d487a3e04594`. The old [sample/source record](rp-text-layout-sample-evidence.json) remains unchanged, SHA `e55c45d9e9f6b572df0fa8d297fe518ec49cbace42bfb4a13f32a202f9cf1396`.

- PName metadata establishes padding left/top/right/bottom = 11/12/13/14 and vertical alignment = 10.
- `TextPanel.get_VerticalAlignment` token 100702289 IL13 → `KJm7.OJOl` 100695586 IL13 → `jtoq.M5Bh` 100717790 → `Htzm` 100717705 IL8 loads 10. Its typed signature is `AxStringAlignment`; Near=0, Center=1, Far=2.
- `RPFormatExtensions.XJc4`, token 100692660: IL88 reads spacing, IL93 loads zero, IL102 branches; zero uses caller default at IL107, nonzero divides by .75 at IL114–128. Thus zero means automatic spacing, not zero pixels.
- Retained `style.js:2496` writes lineHeight only for truthy spacing. This is supporting runtime evidence, not proof of a sample's generated CSS. The `.pluginHint` normal rule is unrelated and is not used as evidence.

This stage changes cache identity resolution; it reuses these already evidenced property conversions. It does not add a new native layout formula.

## Census, new admissions, and unchanged local precedence

The before-reader source was restored byte-for-byte and checked against its actually recorded pre-fix SHA before freezing: [native-caption-baseline-reader-source.txt](native-caption-baseline-reader-source.txt), SHA `b6ec22b62580cf6ec63d14e83674289e32a1decb1ef7a8c5d8bfe148eeb3144d`. Re-executing this own-parser snapshot reproduces all six count fields in [native-caption-baseline.json](native-caption-baseline.json) for all ten importable samples. The snapshot is research-only text and is not shipped. The original vendor inputs are immutable and hash-checked on each audit.

| Sample | Complete chains before → after | Top-level imported/skipped before → after | Nested imported/skipped before → after | Added events / actions |
| --- | ---: | --- | --- | ---: |
| Default.rplib | 0 → 32 | 26/14 → 27/13 | 0/0 → 0/0 | 0 / 0 |
| Flow.rplib | 0 → 37 | 21/16 unchanged | 0/0 unchanged | 0 / 0 |
| Icons.rplib | 0 → 920 | page-count limit rejection unchanged | — | — |
| Sample form patterns.rplib | 0 → 1146 | 530/201 → 540/191 | 406/64 → 430/46 | 38 / 38 |
| Sample UI patterns.rplib | 0 → 315 | 171/88 → 182/77 | 10/0 → 22/0 | 6 / 12 |
| Prototype Starter.rp | 108 unchanged | 57/31 unchanged | 28/0 unchanged | 0 / 0 |
| Prototyping Basics.rp | 246 unchanged | 172/27 unchanged | 52/0 unchanged | 0 / 0 |
| Quick Win.rp | 46 unchanged | 33/9 unchanged | 2/0 unchanged | 0 / 0 |
| UX Prototyping.rp | 193 unchanged | 126/27 unchanged | 0/0 unchanged | 0 / 0 |
| the-basics-tab-menu.rp | 4 unchanged | 3/0 unchanged | 2/0 unchanged | 0 / 0 |
| complex-interactions-required-fields.rp | 7 unchanged | 7/0 unchanged | 0/0 unchanged | 0 / 0 |

There are **58 newly admitted widgets**, and no new images:

- Default: one top-level radio, previously rejected because its absent Selected patch could not be proven without the complete cache.
- Form: ten top-level (six radio, two panel, one ellipse, one box); 24 nested (12 box, eight ellipse, two path, two radio).
- UI: eleven top-level (four panel, four box, three path); twelve nested (six box, six path).

The new panels pass the existing child-geometry/no-shadow checks once their child cache chains resolve. Some nested children were previously unreachable because their parent panel was rejected; this is explicitly distinguishable from a child having its own prior skip issue. Explicit inherited location is generally cached X=0,Y=0, with local saved size, rather than a guessed coordinate. Panel selection recovery can still remain unsupported and is not silently marked complete just because its children become admissible.

Form's 38 new event cases are focus14, blur12, click12, containing exactly 38 already-supported `setSelected` actions. UI's six new click cases contain six `setSelected` plus six `setState` actions. The action decoder and importer logic were unchanged: existing atomic target/selection/state checks now have the required evidence. Unsupported SetWidgetRichText, native scroll/rotation events, invalid navigation destinations, and other prior action boundaries remain rejected. These observations do not establish full interactive compatibility of the imported patterns.

The JSON's per-sample `newAdmissions` contains every exact native ID, package identity, type, page/state scope, initial flags, old/current selection result, old skip messages, stored/resolved geometry, and panel state member lists. `newEvents` contains owner/case IDs, conditions, and complete imported actions. Across the ten importable samples, **5,911 output properties previously attributed to local-object-style or stored-active-state-style were compared: zero changed values**. The new regression also overrides the native label's local border and confirms it wins over its matched base.

## Output budget and validation boundary

Complete cache recovery increases honest unknown/provenance reporting. Compact/pretty output sizes are recorded for all eleven inputs in the JSON; the largest is form, **24,485,671 / 49,801,205 bytes**. Icons is 20,644,579 / 42,805,817 bytes before its separate page-count rejection. A 20 MiB worker transport budget is insufficient for form. This was reported to the parent rather than dropping source evidence. Parent owns worker limits and test-process buffer changes.

Parser changes and the new identity test file are frozen. Validation executed here: 15 new identity/caption tests plus 70 related existing tests, **85/85**; the two affected legacy files were updated and tested, **9/9**. The existing TextArea test now asserts its evidenced nonzero default library identity. The synthetic empty RP intentionally has no StyleSheet: it continues through the real readers but now explicitly asserts the unresolved-default report rather than fabricating a default or weakening the reader. Parent owns full-suite, browser, and packaged executable validation.

```powershell
node research/native-caption-audit.mjs
node --test research/scripts/read-rp-default-style-identity.test.mjs research/scripts/read-rp-appearance.test.mjs research/scripts/read-rp-interaction-styles.test.mjs research/scripts/read-rp-error-hint.test.mjs research/scripts/read-rp-images.test.mjs research/scripts/read-rp-input-types.test.mjs research/scripts/read-rp-form-properties.test.mjs
node --test research/scripts/read-rp-shapes-forms.test.mjs research/scripts/synthetic-rp-fixture.test.mjs
```

Frozen visual baseline references: [native-caption-before.rea.json](native-caption-before.rea.json), SHA `00754810b7efd97310324e9b60a9e7716adeedd5ce3e1424993391a46c46a32e`; [browser baseline screenshot](native-caption-browser-baseline-personal-information.png), SHA `a26fe9e13f29c645123612ea3f40eaf96d0632c6979c2f5608ab7ba71b84a62b`. These show the independent product, not the original Axure GUI. Reusable `artifacts/rp-input-types-desktop.png` is intentionally not a frozen evidence source because later smoke runs overwrite it. Detailed browser layout measurement belongs to the separate caption-rendering investigation.

The primary audit record at this freeze is [native-caption-evidence.json](native-caption-evidence.json), SHA `8853c8a38f25019e830967d83e39c2e1594c83addbd657cb0c0dbb1893c4f466`. Its sources array pins the parser, importer, audit script, frozen baseline, and reused layout evidence. No claim of original GUI pixel equality is made.
