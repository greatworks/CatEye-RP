# Offline rich text pointer continuity regression

The packaged RP import smoke failure is confirmed to be a DOM identity bug, not failed source interaction recovery or condition evaluation.

## Reproduction

The retained failed artifact is `.build/rp-import-user-2MAPaf/required-fields.html`; the source smoke is `scripts/smoke-rp-import.mjs:14–33` and retained failure log `.build/rich-text-smoke-rp-import-before-repair.log` identifies the second submit at line 29. Original Required Fields import and React preview completed earlier in that same smoke run; this failure occurred in the actual exported HTML. The unsuffixed smoke log is reused for final package validation.

Independent probe: `node research/scripts/probe-rich-pointer-continuity.mjs .build/rp-import-user-2MAPaf/required-fields.html`. It opens the existing export directly in isolated headless Edge, with no development server, original Axure process or product-file mutation. Results and artifact SHA256 are retained in `rich-pointer-continuity-evidence.json`.

## Exact observation

Both branches first click Sign Up, observe Error Message, focus Email to hide it, and fill `person@example.test`. On the next submit:

1. `mousedown` hits the Sign Up `span.rich-text-run`.
2. Email receives `blur`.
3. Offline render replaces Sign Up's rich subtree. The old and new markup are byte-identical; the removed subtree contains the mousedown target.
4. `mouseup` hits a new run element; the original mousedown target has `isConnected=false`.
5. No DOM `click` occurs; Error Message remains absent. No page exception is reported.

In an isolated A/B branch, the probe suppresses only byte-identical rich subtree replacements in memory. The same sequence retains the original down target, a native `click` occurs, and Error Message is present. No user event is synthesized, forced, or retried. This directly isolates replacement as the cause.

## Code path and repair scope

At diagnosis, `src/runtime/export-runtime.ts` implements `paintRichContent` by constructing a new block/paragraph/run tree on every render and calling `span.replaceChildren(block)`. Input blur enters the control focus bridge and publishes a scheduled render. The outer widget node remains stable, but preserving only that ancestor does not preserve the pointer target.

The parent is implementing reconciliation by paragraph/run index, reusing elements and updating text/style only where required. That is preferable to the probe's narrow equal-markup shortcut: a hover or mouse-down style change legitimately changes markup while the pointer target still needs to survive. The probe shortcut is diagnostic only and is not a product patch.

The evidence confirms this failed artifact and interaction sequence. It does not claim the subsequent product repair, rebuilt package or full regression suite has already passed. This task changed research files only.
