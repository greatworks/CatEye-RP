# Final dropdown event admission audit

The final native dropdown release audit reports **28 additional imported controls, 2,108 imported options, and zero additional events**. This follow-up corrects the earlier expectation that importing the four select owners would make their eight decoded focus/blur events executable.

`rp-dropdown-event-reasons.mjs` performs a read-only one-file pure-parser/importer check. It writes `rp-dropdown-event-reasons.json`, including current source hashes, exact owner/event IDs, target recovery, per-event import issues, and source file hash. It does not modify the frozen parser, importer, model or other product files and does not run a test suite or original target program.

Source: original `Sample form patterns.rplib`, SHA-256 `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`. Parent final corpus results remain in `dropdown-import-audit.json`.

| Page/package | Imported event owner | Decoded events | Imported SetSelected target |
| --- | --- | --- | --- |
| Credit card form / d769a1bb062d46ae9140ccafe936455e | f83f419137c644118b4d1121be16464e (Exp Month Droplist) | focus + blur | 81407e7110764806ab119ed3a69a5ace |
| Same | 7d81a03dae3e4ae496b8300485168c2b (Exp Year Droplist) | focus + blur | 81407e7110764806ab119ed3a69a5ace |
| Instructions / c356742c685a47b0b1a9b4abc4dd2ad8 | d187f5271815472f84b02adf8bb6737a (Exp Month Droplist) | focus + blur | f5ba5ff93b4d4b5c8467778d88421fc4 |
| Same | fd39452cbaa74e94a312e3f2b5b597eb (Exp Year Droplist) | focus + blur | f5ba5ff93b4d4b5c8467778d88421fc4 |

Both targets are native VectorShape objects named **Exp. Date Label**, imported as boxes. Each focus action requests setSelected=true, and each blur action requests setSelected=false. The owner, target identity and action fields are decoded and present. The failure is specifically the target's state-style contract:

```text
selectionRecovery.status = unsupported-selection
selectionRecovery.reason = Unsupported selected style property 1002
```

`research/samples/metadata-PName.json` identifies native constant `FONT_STYLE` as little-endian `EA030000`, decimal 1002. `recoverSelection` does not include that property in its proven supported selected-style subset. Accordingly the importer emits a `selection-omitted` issue for each label and does not add it to its verified `selectionTargets` set.

When converting each setSelected action, `requireSelection(target)` rejects that target with:

```text
选择事件或动作的状态、样式未恢复。
```

All eight events consequently receive `interaction-event-skipped`. They are not missing-target failures, and the action is not partially committed. This is the existing conservative selection-style admission policy; no relaxation or recovery expansion was made in this follow-up.

Verified counts:

- Native reader decoded select-owner focus/blur events: **8**.
- Imported events on all native select owners: **0**.
- Form library imported events: **38**, unchanged.
- All-corpus additional imported events in the final parent audit: **0**.

Reproduce the narrow read-only check with `node research/rp-dropdown-event-reasons.mjs`. No heavy full-suite run was performed.
