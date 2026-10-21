# Selection style/text author routing: design review

2026-10-21. Read-only design review. This is not a completed integration or browser
validation. No product or existing test was changed. App was being edited in
parallel; the latest observed hash was
`d134417c4204b0ff7d6a5afdd5258c8ba18b424c8b3aec30e5fd0d341b1443b3`.
That observation does not freeze the App or attest its later routing.

The minimum correct transaction has two distinct measurement sources and one
persistent candidate:

1. Capture the immutable document, view/scope, target IDs and explicit user intent.
   Resolve the old effective declaration, projecting only its explicit adaptive
   text style into a detached rich clone. Prepare its browser-derived old panel.
2. Build a candidate Page using the existing actual style/shared-content rules.
   Preserve explicit equal-value rich resets, per-target padding-side intent,
   sparse adaptive declarations and Affect All Views cleanup. Do not commit yet.
3. Resolve each candidate effective selection widget. Project only its explicit
   adaptive text patch into a separate measurement clone and prepare the new
   fonts/content. Pass the **old panel** and updated declaration to the source
   transaction entry; supply raw text measurement from the updated session.
4. Replay successful ordered effects onto the candidate using
   `applySelectionAuthorEffects`. The external style edit's all-view scope is
   separate from each internal Size/Location effect's current-view scope. Never
   send the resulting final geometry through generic all-view diff a second time.
5. Commit all selected targets together, once. Failure leaves the original
   document and undo history unchanged. Do not serialize measurement clones,
   TextPanel rectangles, guards or style-editor KNYS.

`applyAdaptiveWidgetEdits` treats text/rich content and `selectionText` flags as
shared; normal style and geometry remain view declarations. A current-view font
command must not replace raw shared rich runs with the measured projection.
An intentional Base/all-view whole-widget formatting command may update shared
runs through the existing explicit rich-text reset rules. These are different
operations, even when the resulting pixels look alike.

Concrete host risks to cover:

- The existing size/fit host uses a serial/latest-request guard. Reusing it for
  independent property edits can lose Font size when Padding arrives while the
  first font wait is pending. Use a FIFO that rebases each accepted command on
  the prior accepted candidate, or retain all pending intents with explicitly
  defined same-field coalescing. Context navigation/undo may cancel the batch;
  another accepted property edit must not silently erase a different field.
- `commit` updates React state; `docRef` is refreshed by render. A FIFO cannot
  assume the next Promise continuation already sees that new reference. Track
  its accepted candidate/revision explicitly and distinguish its own commits
  from external document changes.
- `applyRichText` bypasses `patchSelected`; its close-editor action changes the
  command context. Async rich-text acceptance must survive its own intentional
  close, without surviving unrelated view/selection/navigation changes. Plain
  text replacement is another route and must keep its existing first-run
  formatting/link policy.
- Mixed selection must first form one candidate for ordinary and selection
  targets. Only supported selection targets need these layout services; one
  measurement failure must not leave ordinary targets already committed.
- Padding-side intent is resolved separately for each target. Copying the
  primary selection's entire padding tuple corrupts other targets' untouched
  sides. Effect-style editing is not automatically a normal-style layout event.
- Existing width-fit display projection is not a substitute for the raw
  transaction measurement service: it already incorporates layout/rounding and
  cannot represent a request with a newly changed width/font/content.

Planned independent browser cases, awaiting the final UI contract: P94 old-panel
ordering; named-view rich font persistence; all-view style with current-only
geometry; mixed success/failure atomicity and one undo; delayed fonts with
consecutive different fields and rich-text Done. No new browser case has been
executed for this review.

Stable model/helper sources inspected:

| File | SHA-256 |
| --- | --- |
| `src/model/adaptive.ts` | `ce058f7fb26e2ab8658ae3d637981770143b9fd68d1717ad1210460439f53079` |
| `src/model/rich-text.ts` | `01fa723e9e158cb16125753c5993fd2e86a370133b0a246cccced8d578d6863f` |
| `src/model/selection-author-edits.ts` | `ec025356b9a4d40b61d15a186f6dd44bbd8b4c58c0419ad43855ef163e21dc78` |
| `src/runtime/selection-author-measure.ts` | `7df2ddf8f060b6f60c9b9185cc0e80f488f3230420e75b93d57ea208ff5e5bba` |
| `src/components/widget-style-command.ts` | `7c258dae1c7b0b504705a9ca46be2a9558f775949ee9fbd201983627552a7e2e` |

The original font engine and original application GUI were not executed. Entry
conditions for normal style/P94/text notifications remain the source-evidence
agent's scope; this report does not infer them merely from changed field names.
