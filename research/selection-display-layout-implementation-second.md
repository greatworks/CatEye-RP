# Selection display layout: bounded width correction

This record supplements the immutable first implementation report and54/54 result at `selection-display-layout-implementation.md/.json`. It does not replace the first source snapshots or failure evidence.

The parent selected an explicit product boundary for width-fit measurement: although the browser measures nowrap text in a10000px container, content wider than10000px is **unsupported**. `project` rejects the measured width before returning any layout; `measure` removes its isolated DOM in `finally`. Exactly10000px remains supported. This is a bounded browser substitute, not a newly proved KIf5 long-line wrapping rule.

The two module/serialized regression cases first failed against the preserved first source:54 passed,2 failed. After the guard,56/56 pass. They also prove cleanup and unchanged widget data on rejection. The public API and all other projection/empty/font boundaries remain as described in the first report.

Only `src/runtime/selection-text-layout.ts` and `tests/selection-text-layout.test.ts` are owned product/test edits. Their final bytes are preserved under `.build/selection-display-layout-second/`. No old product file, browser host, runtime measurer, source evidence, existing test, saved project or release artifact was changed by this helper task.

The first complete typecheck passed. A second complete typecheck encountered two parent-owned concurrent test errors (`loaded` vs `load`, and a string lineHeight). That log is retained and is not reported as a helper pass; the parent was notified. Any subsequent whole-repository typecheck or browser verification must be cited separately. No browser, native DLL or original GUI was executed in this task.
