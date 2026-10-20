# Historical Open Sans license and family-name evidence

Verified 2026-10-14. This is a read-only primary-source web/history audit combined with the retained [font metadata audit](open-sans-font-evidence.md). Only official Google/Google Fonts repository records and Apache's license text support the conclusions below. No font binary was downloaded, replaced, installed, or modified. Product files and the frozen `font-size-*` evidence were not changed.

## Outcome

The retained ten unique faces explicitly identify **Version1.10** and **Apache License2.0** in their own name tables. Official historical Google Fonts snapshots independently confirm that Open Sans was distributed under Apache2, with a complete license and the same ten weight/style combinations. They do **not** establish byte identity to the retained fonts: the historical repository font sizes and Git blob hashes differ.

No additional Open Sans-specific `NOTICE` was found in the inspected historical official distribution directories. The early `COPYRIGHT.txt` is another copy of the generic Apache2 license, not an extra attribution notice. This narrows the previous unknown but is not a claim that every upstream/archive distribution ever lacked a NOTICE. Continue preserving the retained Google copyright strings, Ascender/designer metadata and complete Apache2 license; do not substitute the modern OFL license for these old bytes.

## Pinned official historical sources

| Date (UTC) | Record | Evidence |
| --- | --- | --- |
| 2015-03-06 23:44:52 | Google/fonts initial commit `90abd17b4f97671435798b6147b698aa9087612f` | The Open Sans family directory contains ten TTF entries, DESCRIPTION, METADATA.json, LICENSE.txt and COPYRIGHT.txt. No NOTICE or FONTLOG entry. [Directory API](https://api.github.com/repos/google/fonts/contents/apache/opensans?ref=90abd17b4f97671435798b6147b698aa9087612f), [commit](https://github.com/google/fonts/commit/90abd17b4f97671435798b6147b698aa9087612f). |
| 2015-03-07 | Commit `64d3e3a72845371da35ab98b1e59b3f9198e5826` | History records removal of duplicate files. The retained later family snapshot has LICENSE but no COPYRIGHT sidecar. [Commit](https://github.com/google/fonts/commit/64d3e3a72845371da35ab98b1e59b3f9198e5826). |
| Before 2017-05-16 hotfix | Snapshot `c0329fe2714198653d179e5077d6d86d3cb8036a` | `METADATA.pb` declares APACHE2, designer Steve Matteson and the ten unified-family faces. [Metadata](https://github.com/google/fonts/blob/c0329fe2714198653d179e5077d6d86d3cb8036a/apache/opensans/METADATA.pb), [license](https://github.com/google/fonts/blob/c0329fe2714198653d179e5077d6d86d3cb8036a/apache/opensans/LICENSE.txt). |
| 2017-05-16 | `4e24bf1805f1526cd1ce3e39447d5f8e6f1f6b67`, PR785 | Adds v1.101. Maintainer discussion identifies name-table and style-bit repairs; this is evidence of a later packaging/name-table change, not permission to alter the retained1.10 bytes. [Official PR](https://github.com/google/fonts/pull/785). |
| 2021-02-10 | `4ebf835fdc8c2964e6b8d439ed9f47d37e177747` | Adds Open Sans3.000 from pinned upstream `c071e9696751f2d69925d66f3b8c581f2dc041c2`. [Commit](https://github.com/google/fonts/commit/4ebf835fdc8c2964e6b8d439ed9f47d37e177747). |
| 2022-02-24 05:21:34 | `57311b5baf175fa1bdbf055d5ccb50e53d19e745` | Moves the current family from apache to ofl, changes metadata license to OFL and removes the old Apache sidecar. [Commit](https://github.com/google/fonts/commit/57311b5baf175fa1bdbf055d5ccb50e53d19e745). |

Google's current [family description](https://github.com/google/fonts/blob/main/ofl/opensans/DESCRIPTION.en_us.html) describes the March2021 variable-family update and OFL licensing. That statement applies to the updated distribution; it is not evidence that this project's retained Version1.10 files carry OFL. The current upstream [FONTLOG](https://github.com/googlefonts/opensans/blob/main/FONTLOG.txt) begins its listed changes in2018 with v2.01/variable work. No such file was present in the inspected2015 historical family directory, so it is not being copied as an attribution file for the retained ten old faces.

## Complete license and NOTICE check

The pinned historical LICENSE has Git blob `75b52484ea471f882c29e02693b4f02dba175b5e`, 11,560bytes and SHA-256 `3ddf9be5c28fe27dad143a5dc76eea25222ad1dd68934a047064e56ed2fa40c5`. It contains all nine sections and the appendix. The original2015 COPYRIGHT sidecar is 11,358bytes and contains the same generic text.

Whitespace-normalized comparisons are equal for all four:

1. Historical Open Sans LICENSE.txt.
2. Historical Open Sans COPYRIGHT.txt.
3. The [Apache official full license](https://www.apache.org/licenses/LICENSE-2.0.txt), retrieved with SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
4. Existing local complete generic Apache2 text, SHA-256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`.

This comparison ignores only whitespace. It does not claim byte-identical line endings or formatting. Full retrieved license text is retained in the API evidence JSON, not installed over a product asset.

The no-NOTICE observation is bounded: the2015 family directory listing is complete, its parent `apache` tree has no files at all (only family directories), and the repository root has README plus directories, with no global NOTICE. The pre-v1.101 family directory likewise has no NOTICE. These are concrete examined trees, not an exhaustive search of all historical archives.

Apache2 section4 requires the license and applicable notices to be retained; its NOTICE provision is conditional on a NOTICE accompanying the work. Sections4(b) and6 separately concern change notices and trademarks. A project-created attribution/source notice must identify itself accurately and must not be labeled an original upstream NOTICE. These observations follow the [official license](https://www.apache.org/licenses/LICENSE-2.0.txt); they do not extend this font license to Axure application code or other bundled assets.

## Exact-byte and Version1.10 boundary

No remote TTF bytes were fetched. The Git blob identifier was computed locally as SHA1 of Git's blob header plus each retained byte sequence, then compared to public tree metadata. **All ten unique local faces differ** from the historical Google/fonts TTF entries by size and blob identity. For example, retained Bold is104,120bytes; the historical entry is224,592bytes. The report does not infer why they differ, claim a particular subsetting process, or claim an upstream binary match merely from the shared family/version labeling.

The local name tables independently establish Version1.10, Google copyright, Ascender metadata and Apache2 identification. The official history establishes Apache distribution before the v1.101 hotfix. The exact original archive corresponding to the retained byte sets was not identified. This unresolved provenance detail remains visible rather than being replaced by a current OFL release or downloaded font.

## Family names and aliases

Historical [Google Fonts metadata](https://github.com/google/fonts/blob/c0329fe2714198653d179e5077d6d86d3cb8036a/apache/opensans/METADATA.pb) lists every face as family **Open Sans**, with normal/italic styles at weights300,400,600,700,800. The retained font metadata supports this common typographic family. Legacy family names differ:

| Faces | Retained legacy nameID1 | Common typographic grouping |
| --- | --- | --- |
| Light / Light Italic | Open Sans Light | Open Sans, weight300 |
| Regular / Italic | Open Sans | Open Sans, weight400 |
| SemiBold / SemiBold Italic | Open Sans SemiBold | Open Sans, weight600 |
| Bold / Bold Italic | Open Sans | Open Sans, weight700 |
| ExtraBold / ExtraBold Italic | Open Sans ExtraBold | Open Sans, weight800 |

**Implementation recommendation:** for a document explicitly requesting `font-family: Open Sans`, register the ten retained faces under that one CSS family with their weight/style descriptors. The presence of `Open Sans Light` in nameID1 is not, by itself, a requirement to register an additional CSS alias. A document literally requesting a different family string is a separate compatibility case; a project may intentionally add an alias, but should not claim that metadata proves Axure emitted that string.

The retained original runtime `style.js:2471` applies `style.fontName` directly. Initial generated font-family construction is different: the already-frozen [native caption evidence](native-caption-rendering-evidence.md) traces `CNxN → a5MY → PNx5` and an undecoded concatenated suffix. This audit did not obtain an actual original generated stylesheet. Consequently it cannot establish whether every original Open Sans style used the common family, a legacy family, a particular fallback list, or a PostScript name. Font nameID1/4/6/16, Google service metadata and original generated CSS are kept distinct.

## Reproducibility

[open-sans-upstream-evidence.json](open-sans-upstream-evidence.json) records source URLs, commits, dates, hashes, local names and byte-identity comparisons. [open-sans-upstream-api.json](open-sans-upstream-api.json) retains the exact public metadata/text responses. No full test suite, native GUI, font download, font installation, product edit or change to frozen font-size evidence occurred in this task.
