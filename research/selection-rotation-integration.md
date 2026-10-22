# Selection 多选 Ctrl 旋转接入

本阶段为未发布的独立实现，范围是有明确 selectionText 声明、初始角度为 0、同一页面或未旋转 Layer 坐标中的 Checkbox/Radio 多选。没有执行原 DLL，也没有完成原版 GUI、字体或像素对照；原生 `.rp` 写回未增加。

## 行为与宿主

此前多选按住 Ctrl 拖手柄会被明确拒绝。本阶段在按下时仅对 exact-Control 多选捕获旋转模式，之后松开 Ctrl 仍保持该模式。控件中心绕初始共同中心移动，但 Selection 控件自身没有 Rotation 能力，所以方向、宽高、自动适应标志和文字面板保持不变；锁定项参与中心计算但保持原位。单控件 Ctrl、Ctrl+Shift/Ctrl+Alt 起手及途中按 Ctrl 的缩放规则保持原有分支。

输入保留两个不同起点：真实 diagram 按下点，以及现代 BoxModel 的逻辑手柄锚点。每帧先用当前已接受的选框计算网格修正，再用“真实按下点 + 修正后的位移”计算角度。初始中心和成员几何不随帧更新。Alt 逐帧旁路网格；Shift 同时影响输入候选框与角度量化。默认仅在距最近 15° 不超过 5° 时吸附，Shift 始终按 15° AwayFromZero 舍入。角度转换和三角运算顺序保留原代码的常量及操作次序，以免改变阈值分支。

上游自由度来自控制器构造函数 `VI8y(MSON(handle))`：水平侧边为 1，垂直侧边为 2，角手柄为 3。早期 256 项输入回放明确注入 freedom=3，不能把这些记录冒充所有侧边的真实初始化；独立宿主审查另补构造链及真实自由度矩阵。浏览器数值样例的矩形均没有进入退化轴分支，所注入 freedom=3 与这些 E 手柄的 freedom=1 得到相同结果。

旋转分支直接规划当前视图的完整 Location 对，不等待字体，不制造文字布局状态，也不调用文字尺寸计算。位置双轴差值均严格小于 `1e-5` 时不写入；原版同值时仍发生的编辑器刷新不被当作持久文档变化。所有目标通过后才发布一个完整文档；中途失败、Escape、撤销键或捕获丢失回到手势基线。松手只结束事务，不补算一帧；一次有效手势一次撤销，完全往返不产生空历史。勾选 Affect all views 也不改变这个控制器的当前视图写入规则。

## 实现与证据

- `src/model/selection-pointer-rotate.ts`：几何快照、输入投影、源角度规则、锁定跳过和 Location effects。
- `src/model/selection-pointer-input.ts`：抽出 resize/rotate 共用的输入投影；旧 resize-only 入口保留旋转拒绝门，不伪造模式。
- `src/model/selection-author-edits.ts`：复用既有持久写入逻辑，增加直接接受成功 effects 的入口。
- `src/App.tsx`：真实按下点同步捕获、两种模式的判别联合类型、无需字体的旋转路径和原有事务协调。
- 单元测试和 `tests/e2e/selection-pointer-rotate.spec.ts`：源码数值差分、连续输入、锁定/fit、完整保存、当前视图、撤销重做及取消。

固定原 Axure RP 11.0.0.4150 DLL SHA-256 为 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。原始依据分别见 [输入与初始化](selection-rotation-input-evidence.md)、[旋转控制器](selection-rotation-controller-evidence.md) 和 [独立宿主审查](selection-rotation-host-review.md)。保留指令解释器使用明确的 BCL、provider、graphics、通知和历史服务替代，不是加载或执行原 DLL。

## 验证记录

首轮构建通过 5,741/5,741 单元、类型检查与 50/50 生产浏览器检查。原代码证据包含 304 项输入场景，以及 236 项控制器数值/会话与 40 项输入到控制器/MIue 组合检查。九个浏览器预期由原指令解释器组合生成，不导入产品算法。

独立审查随后发现角度换算运算次序可改变吸附阈值，已保留具体红测并修正。最终源码通过类型检查、生产构建、5,807/5,807 单元测试、50/50 手柄生产浏览器检查和 72/72 相关生产浏览器回归，失败、flaky、跳过均为 0，构建和检查前后源码哈希稳定。新模型 154 项测试与既有输入/缩放测试合计 261 项通过；独立宿主复核 73 项与角度边界 1 项均通过。最终构建的三个产品截图已查看；原版截图未取得。完整日志、来源、快照与哈希见 [本阶段验证记录](selection-rotation-verification.json)。

执行命令：`node .build/build-selection-layout-core.mjs rotation-final`、`node .build/run-selection-layout-stable-checks.mjs rotation-final typecheck unit`、`npx playwright test --config .build/selection-rotation-final.config.ts`、`npx playwright test --config .build/selection-rotation-final-regression.config.ts`。已有 Vite 无扩展名导入提示未由本阶段修改；最终检查退出码均为 0。

失败证据保留：上一冻结构建 Ctrl quarter-turn 不移动的红测；Location-only adapter 缺失导出的红测；新测试的 TypeScript tuple 类型错误；浏览器初跑缺 JSON import attribute（未执行用例）；early source fixture freedom=3 与按 handle 测试值不一致的测试建模错误；临界角度产品计算差异。首轮相关回归在发现角度问题后主动中断，不能把中断计为产品断言失败。

## 剩余范围

Space/Meta 的原版映射与静止切键派发、引导线/对象吸附、原版网格默认值、任意旋转和一般坐标变换、混合普通控件/递归组旋转、完整创建默认值和状态绘制仍未覆盖。本产品的 8 单位网格和统一 zoom 容差转换保持明确约定。完整浏览器回归、本阶段 Windows 包验收、原版 GUI/像素对照、原生 `.rp` 写回和完整 Axure 复刻仍未完成。

旧输入阶段的冻结证据与源码快照保留，已发布 ZIP/ASAR 保持不变。`fullAxureParity=false`、`originalGuiCompared=false`、`published=false`。
