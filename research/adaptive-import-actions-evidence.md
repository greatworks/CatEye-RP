# Native adaptive action and Page event reading

This stage adds a narrow interaction-read protocol. It does not implement view
set lookup, import binding, runtime dispatch, or original-file write-back. The
retained target is Axure RP 11.0.0.4150. No target DLL, original GUI, browser,
network request, or build/package was run for this change.

## Evidence and protocol

The retained [format evidence](adaptive-behavior-format-evidence.md), section 6,
and its CIL records identify `Axure:InteractionSetAdaptiveView`:

- Reader **100705052** reads `set_adaptive_view_id` as Guid and
  `set_adaptive_view_to_auto` as bool; writer **100705051** writes both.
- Getter **100705050** tests the auto bool first. Without Auto, native Base is
  `19e82109f102476f933582835c373474`, not Guid.Empty. The generated named string
  is a generator result, not the stored Guid.
- `OnAdaptiveViewChange`, field **67121749**, is event value **338**. The
  supported reader scope for this event is exactly an `Axure:Page` owner.

`recoverInteractionMap` now emits:

```js
{
  sourceId: nativeActionId,
  type: 'setAdaptiveView',
  adaptiveView: { kind: 'auto' }
    // or { kind: 'base' }
    // or { kind: 'nativeGuid', guid: '<32 lowercase hexadecimal digits>' }
}
```

The complete action property map must contain exactly the supported keys
`Disabled`, `set_adaptive_view_id`, and `set_adaptive_view_to_auto`. Both bools
must be present and boolean. The Guid carrier must have exactly its own `$guid`
key and a valid string, even when Auto makes that value inactive. Unknown or
duplicate fields, coercible values, and extra Guid carrier keys are rejected.

Auto true produces `auto`. Otherwise only the native Base sentinel produces
`base`; every other Guid is retained as `nativeGuid`. In particular, Guid.Empty
and the native Auto sentinel with an Auto-false flag are **not** rebound to a
valid view. The importer must resolve named identities against the owning
Page's successfully recovered set (including actions in nested panel packages).
An unresolved target requires atomic event rejection there. This layer does not
invent an ordinal, match a name, drop the action, or equate an unknown native
target with a product unknown-view action.

Event 338 becomes `adaptiveViewChange` only for Page. Master, PanelState,
Diagram, widget, hyperlink and lookalike owner types fail that event. Existing
event metadata guards remain. Event/case Disabled flags still produce disabled
cases; a Disabled action still rejects its complete event because the current
action model cannot retain that editable state. Independent events remain
recoverable after one event fails.

The existing [case-groups probe](adaptive-behavior-case-groups-probe.json)
establishes that Set Adaptive View terminates its current runtime action list,
not all subsequent event cases. The reader therefore retains all ordered
actions and case groups; it performs no dead-code removal. Runtime behavior is
not re-executed by these reader tests.

## Validation

The new suite is
[`scripts/read-rp-adaptive-actions.test.mjs`](scripts/read-rp-adaptive-actions.test.mjs).
It constructs independent object graphs. Three positive cases additionally
encode an object package with pooled strings, .NET Guid byte order, bool/Guid
value tags and a complete interaction tree, then traverse the actual
`readObjectPackage` and interaction readers. These bytes are synthetic, not an
Axure-produced or Axure-accepted project.

Coverage includes Auto precedence, Base identity, named/zero/Auto-sentinel
preservation, Page-only event applicability, supported widget/hyperlink click
actions, case/action order, source immutability, exact bool/Guid/property guards,
Disabled handling, and failure atomicity with an independently valid Page Load
event.

| Run | Result | Log |
|---|---|---|
| New tests before implementation | 24 total: 23 failed, 1 passed | `../.build/adaptive-import-actions-red.log` |
| New tests after implementation | 24/24 passed | `../.build/adaptive-import-actions-green.log` |
| New plus existing interaction tests | 48/48 passed | `../.build/adaptive-import-actions-focused.log` |
| `node --check` on both changed JavaScript files | passed | command recorded below |

```powershell
node --test research/scripts/read-rp-adaptive-actions.test.mjs
node --test research/scripts/read-rp-interactions.test.mjs research/scripts/read-rp-adaptive-actions.test.mjs
node --check research/scripts/read-rp-interactions.mjs
node --check research/scripts/read-rp-adaptive-actions.test.mjs
```

The existing suite rechecks the real Required Fields, Tab Menu, Quick Win and
UX interaction results. The retained full
[census](adaptive-behavior-format-census.json) covers 11 files / 41,662 objects
and reports **zero** SetAdaptiveView actions and **zero** event338 witnesses.
That full census was reused, not rerun for this patch. Consequently the new
positive path is supported by static reader/writer evidence and labeled
synthetic tests, not a positive original corpus sample or GUI reconstruction.

Only `research/scripts/read-rp-interactions.mjs` and the new test file change the
reader/test implementation. Set parsing, semantics traversal, importer, model,
runtime and hosts are outside this subtask. Current hashes, dependencies and
command outcomes are in [the companion JSON](adaptive-import-actions-evidence.json).
