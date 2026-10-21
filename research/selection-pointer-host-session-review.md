# Selection pointer session 独立审查

本报告补充已冻结的 `selection-pointer-host-review.md`，不改写其字节。审查对象为产品异步会话协调器，不是原版 Axure 执行；字体、几何和原版 GUI 均不由这组探针验证。

新源证据要求保留每一个已接收 pointer frame：首次非零宽度变化可永久关闭 AutoFitWidth，后续回到零位移不能还原它。因此旧预研里“字体等待时仅保留最新 delta”的候选建议已被否定。当前 helper 使用有序队列，每帧消费前一帧布局状态，几何 original 仍固定在手势开始时。

`.build/selection-pointer-host-session-review.mjs` 直接加载当前 TypeScript helper 的去类型化字节，注入确定性 planner 与可控准备 Promise。7/7 独立检查通过，记录在 `selection-pointer-host-session-probes.json`：

- Preparing 接收 20 → 0 → 40，复制请求及 modifiers；finish 后拒收新帧，准备完成后一次发布、一次完成。
- 即时准备与延迟准备保留相同最终持久状态，发布次数可以不同。
- 执行到中途失去文档所有权立即取消，不能覆写外来文档或创建其撤销项。
- 同一等待批次的后帧失败不发布前帧部分结果。
- 无帧完成只调用完成回调，不自行制造撤销历史。
- Finishing 后取消再收到字体拒绝，不能复活手势或再报告失败。
- `finish(lastRequest)` 确实会追加一帧；宿主已经调用 `update(lastRequest)` 时必须用无参 `finish()`。这属于 API 边界，不是假设重复帧无副作用。

helper 没有发现可复现阻断。它依赖宿主提供完整 `isCurrent` 条件、只回滚自身最后发布的文档、成功完成时按真实文档差异创建一次 Undo。`publish`、`complete`、`rollback` 是外部副作用；探针不证明任意抛错回调的可逆性。App 接入、真实 PointerCapture、浏览器字体及保存行为另由本阶段生产浏览器用例验证，不能由这 7 项替代。

精确源、脚本、探针及本文件哈希见同名 JSON。此报告不宣称原版 GUI、像素或字体测量一致。
