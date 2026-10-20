# Inspector numeric draft synchronization: independent review

**No blocking finding.** The change is appropriately limited to node and cubic
control-handle fields. Ordinary NumberField behavior remains unchanged when
`normalizeOnCommit` is omitted.

Reviewed `src/components/Inspector.tsx` SHA-256:
`c55baefbda6d61e6a6b880f5e306ed83298fccf1dfb5ecd43ea182340fe504d6`.
The file remained unchanged during review. Production and earlier frozen review
records were not modified.

## Commit and synchronization behavior

At lines113–129, `commit()` parses and clamps the request before dispatching it.
For the opt-in fields, the draft resets to the current canonical `value`; the
callback still receives `next`, not that reset draft. Thus the reset does not
discard the requested edit.

When rebounding leaves the canonical percentage unchanged, for example an
entered -25 becomes stored M.x=0 again, React's `[value]` effect has no new value
to observe. The explicit reset now clears the obsolete -25 draft. When the
canonical percentage changes, the existing effect synchronizes the new value
and clears `modified`. A rejected edit that keeps the old prop also leaves the
field displaying that old canonical value, rather than an uncommitted request.

An identical numeric request, including alternate formatting such as `025.0`,
does not call `onChange` unless `commitUnchanged && modified` requests it.
Untouched and repeated blurs do not manufacture that opt-in callback. Empty or
nonfinite input restores the canonical value and returns without dispatching.
Finite requests continue to clamp before dispatch. Enter still only requests
blur; it does not call `commit()` separately.

The only enabled call sites are the two loops at lines525–526: Node X/Y and
cubic Control1/2 X/Y. Other fields retain the default false value. Removing
only the added option and its conditional from the current function produces
the same transformed JavaScript as the preserved previous NumberField.

## Verification and limits

**33/33 bounded checks passed**, including:

- The previous function reproduces the stale -25 draft while the current
  opt-in function returns to canonical0, with the same single callback.
- Changed canonical values, same-value edits, rejected edits, clamping,
  external value changes and seven invalid-input strings.
- Sixteen paired comparisons against the previous default implementation,
  with `commitUnchanged` both false and true.
- Structural default-behavior equivalence and the exact two opt-in call sites.

The checks execute the exact extracted NumberField TSX after an in-memory
transform. `useState`, `useEffect` scheduling and JSX nodes are bounded test
sinks, not the actual React renderer. Browser number-input sanitization and
focus ordering are not reproduced. The preserved browser red test independently
shows expected0 versus received-25; production browser/build/package validation
remains parent-owned and is not claimed by this review.

The JSON includes source hashes, the extracted old/current functions, harness,
individual results and hashes proving the earlier review records were preserved.
No changing desktop report or root screenshot is referenced.
