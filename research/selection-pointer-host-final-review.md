# Selection pointer host 最终独立审查

本次只修改独立新 E2E 和新审查记录；App、数值控制器及原版证据由其他任务维护。第四生产构建 `.build/selection-layout-pointer-fourth-dist` 的完整新用例16/16通过，0 skipped / flaky / unexpected。第五构建仅修多选标签重叠，主线程专项1/1及最终类型检查通过；不能把第四版16项记为第五版完整执行。7/7独立会话协调探针另计，不当作原版数值验证。完整源、构建输入、日志、失败证据、截图及当前源副本的 SHA-256 见同名 JSON。

## 实际宿主合同

- 字体准备只执行一次，初始 owner 几何固定；所有已接收帧依序消费前一成功帧的 TextPanel/fit 状态及候选文档。20→0→40 和已发布后的20→0都保留首次关闭的 AutoFitWidth。
- Pointer-up 进入 finishing，等待准备和最后帧。宿主不重复追加已提交的最终请求；一次完成只建立一个真实文档差异的 Undo。无位移 press/release 不建 Undo。
- 请求复制坐标/modifiers，以手势开始时的 zoom/snap 换算。文档身份、最后发布引用、context key 和单调 command serial 共同校验所有权。回滚不能覆盖外来文档。
- Escape、Ctrl+Z、异常 PointerCapture 丢失、视图变化会取消；正常 pointer-up 后的 capture 丢失不会取消 finishing。准备期间真实点击 Save 被阻止，不触发下载。恢复副本保持手势前文档，成功后才存最终结果。
- 等待中的字体属性/独立布局编辑阻止新手势，保留已接受的输入；手柄按下前先 blur 草稿，若该 blur 同步改变文档则本次按下停止，避免旧 closure 捕获旧几何。准备/拖动/finishing 期间其他编辑入口被拦截。
- 单个显式 SelectionButton 仅左右手柄。多个显式控制共享唯一八手柄框。锁定成员参与原始 union，跳过字体准备、panel 读取和布局写入；全锁定无手柄。其未使用的零 panel 是宿主占位，不能称原生缓存值。
- 原子拒绝混合 SelectionButton/普通元件；第二目标测量失败回滚整个手势且无 Undo，服务恢复后可以重新拖动。普通两目标的独立数值预期为：旧 `(100,100,240,20)` 与 `(450,100,180,20)`，共享530宽，东移106后分别 `(100,100,288,20)` 与 `(520,100,216,20)`。
- 指针 Size/Location 只写当前 view 的完整配对属性，Affect all views 不改此路由；fit 是共享内容。测试完整比较 Base、父视图、兄弟视图、inactive map、样式及最终保存数据。
- 没有 `selectionText` 的旧 checkbox/radio 仍走既有八手柄、最小8像素的 generic route。该项是产品兼容策略，不是本次原生 SelectionButton 合同。

## 已定位并修复的真实缺陷

第三构建中，待字体属性时第一次拖动被正确拒绝，但 handle pointerdown 未阻止浏览器默认选择。独立事件记录显示 DOM Selection 从空变成 `Pointer first`；下一次按下确实命中 `resize-handle e`，随后依次出现 `dragstart → pointercancel → lostpointercapture`，宽度留在240。去掉中途 Save 仍稳定复现，且没有 window blur，排除了最初的下载/失焦假设。

父线程在 `startDrag` 的 pending gates 之前，对手柄调用 `preventDefault()`，普通文本操作不受该条件影响。第四构建中，拒绝后的 DOM Selection 为空，重试没有 dragstart/pointercancel，宽度达到280，字体24/高度30保持，并可分步撤销指针与字体命令。原红记录和最终绿记录都保留。

静态审阅还指出了 context 往返时的单调失效及 snap 快照风险；父线程已在第二构建前加入 serial 比较和手势 snap。它们是源码审查结论，不冒充独立执行过原缺陷的红测。

## 保留的测试与观测器纠正

所有原报告保留。第二构建首次10/13：50% zoom 后固定局部点击点落在控件外、adaptive fixture 错用共享 `notes` 字段，两者是夹具错误，修正后通过；字体重试失效是上述真实产品缺陷。第三构建14/16中另一个失败是锁定 fixture 误用 `selected`，checkbox/radio 必须为 `checked`；更正后独立复跑通过。

第四构建首次15/16的剩余失败属于观测器：document capture listener 的 microtask 在 React bubble handler 之前运行，不能据其 `defaultPrevented` 判定最终默认行为。独立真实 Edge 小页面确认顺序为 capture(false)→microtask(false)→target preventDefault(true)→timer(true)。首个小页面输出未等待 timer 的不完整记录也保留。最终移除冗余内部标志断言，继续严格检查空 DOM Selection、无 dragstart/cancel、完整几何/保存和逐步 Undo，得到16/16。

## 视觉与范围

实际检查了第四版单体 east、多选 union、Phone+Affect all views、50% zoom+snap 四图：手柄域、尺寸和 Inspector 数值与读回一致。第四版多选 group 标签与第一成员标签重叠已报告；父线程在第五版仅将成员 selection-label 包在 `!selectionGroup` 条件内。独立逐字节核对保存的第四版 App 与当前 App，准确匹配这一处替换，无其他文本变化。第五版对应多选用例1/1通过，新截图再次实际检查，重叠已消失，唯一组标签保留。

第四版 App SHA-256 为 `93ee3357bb2915b06603db9bcd29d1a6c3247dd2e6751f52617da94cee62e65c`，第五版为 `41e1eda64886a959f3fd876cf2ff945b39547297be8c53a97548789d17dc4669`。主线程第四版历史回归72/72在本审查中只绑定结果，不计入独立新16项；第五版最终 typecheck 为 exit0、输入未漂移。报告准确保留行为验证和视觉专项所属构建。

这里使用实际浏览器 `monospace` 字体、16px/1.25 行高测得20px的明确夹具。不是原版字体/DPI测量，也不是原 Axure GUI/像素比较。初始 panel 是现有浏览器测量代理；普通无旋转 page/Layer 范围、显式布局声明及不支持的 modifier/复杂字体门保持不变。绑定与数值原证据是保留 CIL 的有界解释，并未执行原版 DLL。本轮审查没有运行完整单元/全浏览器/打包，发布验收由主线程另行完成。

最终测试文件和源快照冻结。没有未解决的阻断发现；不据此宣称完整 Axure 重建完成。
