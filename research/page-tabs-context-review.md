# Page navigation integration review

2026-10-22. Independent read-only review by `page_navigation_review`; no original GUI or vendor assembly execution.

The initial review identified local key ownership in PageTree/PageTabs, numeric blur commits, rich focusin submission, property-queue validation, layout-pending rejection, gesture rollback, modal/popup gating, and separation from Document undo. The implementation handles only exact Windows navigation chords in capture, preserving ordinary local navigation.

Two concrete history defects found during review were fixed before the first production browser run:

- Closing an intervening tab can leave adjacent visits to the same page. A history command must advance its cursor even when the visible page stays unchanged. Browser coverage: A,B,C,B,A, close C, then traverse A,B,B,A in both directions.
- Closing the last recorded visit while other tabs remain must seed the first remaining visual tab into history. Native static/CIL evidence independently confirmed this fallback; the new browser test covers A,B,C, back to A, open D, close A and D, then B→C→Back to B.

The rich-success browser regression later exposed an actual React commit race. The diagnostic build recorded `result=true`, matching document/epoch, and `blocked=false`, while the old rich editor was still present before and after an empty `flushSync`. The reviewer inspected React's local implementation and confirmed that an empty callback does not promote previously queued normal-priority updates. The fix encloses the successful rich document commit, queue expected document, notice, and editor teardown in the same `flushSync` before its Promise resolves. Only rich submission currently supplies `onAccepted`; ordinary property FIFO remains unchanged. The isolated `setRichEditing(null)` alternative was rejected because it could render before the document update and overwrite `docRef` with stale data.

This review establishes implementation risks and fixes, not original application focus parity. Native Gallery participation, identity distinctions for components/contexts, overflow promotion, and full GUI behavior remain separate gaps.
