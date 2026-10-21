# Selection property and text author transactions

2026-10-21. Unreleased source stage. Full Axure parity and original GUI comparison remain false.

This stage connects indicator size (P94), ordinary text/style properties and completed rich-text edits to the selection author planner. It extends the previous Inspector Size/Fit/AlignRight integration. Only controls with explicit selection layout declarations in page or unrotated Layer coordinates are admitted. Creation defaults, pointer resize and unsupported native coordinate/font contexts remain separate work.

## Behavior and ordering

The host first builds the complete candidate using the existing current/all-view author rules. It captures the old text panel from the previous document, then measures text from the candidate. Native P94 preflight therefore sees the old panel and the new indicator size. For a nonempty 100px owner with P94=14 and zero padding, changing P94 to 150 first requests 150+86px, rather than rejecting the temporary negative text constraint or capturing a replacement panel from the new declaration.

Font preparation validates the font realm and font descriptors, without evaluating pending geometry. Display projection and text measurement retain their geometry validation. Effective adaptive text styles are applied only to temporary rich-text measurement snapshots; stored shared runs are preserved.

Ordinary native style notifications perform a forced refresh followed by the outer nonforced layout. P94 preflight precedes the ordinary notification gates. The host uses [94] for a changed indicator and an empty key list for other ordinary properties: the native gate accepts empty/non-Location key lists, but this is a host representation, not a claim that native UI commands send empty lists. Pure-model tests separately cover the exact Location exclusion, notify/contained/owner guards, panel refresh suppression and editing measurement flags.

Text commits write and normalize the candidate first, then invoke the independently modeled post-synchronization RNO1 layout/notification tail. The native rich-string synchronization, inline-link reconciliation and provider notifications are not fully implemented by this adapter. Browser typography remains a substitute for native metrics.

All targets are planned before any document is committed. A failed selection measurement rejects ordinary widgets in the same mixed selection as well. Candidate declarations are written before ordered current-only geometry effects, so all-view style cleanup cannot erase an internal current-view correction. Each accepted transaction creates one undo entry.

Within one editing context, property intents execute in FIFO order and rebase onto the preceding accepted document. A font change, padding side, typed text and later font family all survive delayed font loading. Size/Fit/AlignRight commands arriving behind pending properties join that queue. The existing standalone Size latest-command cancellation policy is retained. Undo/redo, gestures, document replacement and view/selection/scope changes still invalidate pending work using a monotonic serial.

Rich text remains open while its completed draft is measured. During this wait the draft is read-only, formatting and Done are disabled, and leaving the editor is held until acceptance; Cancel remains available. The user can retry a rejected draft. A blocked outside action must be repeated after the editor finishes. This asynchronous interaction policy is an independent editor convention, not a claim about original Axure UI timing.

## Reproduced defects

- Font readiness previously rejected a P94 candidate before its required width preflight. Both module and serialized-factory tests failed before font preparation was separated from geometry validation.
- Clicking formatted text inside a selection label activated the associated checkbox, moved focus and closed the editor before editing. The first production run retained this failure. The label association is now suspended while editing; the legacy nested-label branch suppresses activation from the editable text.
- A number field focused without typing retained an old draft while asynchronous layout changed its canonical value. Blur wrote X=100 over the new X=37. The retained first-build browser failure and extracted-handler controls prove the issue. Only explicitly modified drafts now create numeric commands.

Earlier successful builds, failures, screenshots, saved documents and source snapshots are retained. The final source passed TypeScript, 5,536/5,536 unit tests and 58/58 production Edge tests, with no failed, flaky or skipped browser cases. The browser run includes ten new property/text cases, the prior 29 selection/runtime checks and 19 adaptive/font/rich-text regressions. Four final screenshots were opened and inspected. Exact input/evidence hashes are recorded in [selection-properties-verification.json](selection-properties-verification.json). This is focused acceptance, not the entire browser suite or a Windows package run.

## Evidence and limits

The new source investigation contains 84 retained-CIL checks and a 69-file manifest: [property/text evidence](selection-author-properties-evidence.md). The pure model adds 62 property/text cases, including comparisons against the expanded source traces: [model implementation](selection-properties-model-implementation.md). The original assembly was not executed by these replays.

The original editor's menu tree was readable, but its screenshot and coordinate-input bridge remained unavailable in the retained GUI observation. No new original GUI or pixel match is claimed. Native `.rp` writeback, complete Axure features, native text history, selected-state typography, container-local transforms, full font/DPI equivalence and complete state/adaptive drawing assets remain unresolved. The Windows package is unchanged; this source stage is not published.
