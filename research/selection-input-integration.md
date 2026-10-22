# Selection pointer input：网格与修饰键接入

本阶段为未发布的独立实现，覆盖有明确 selectionText 声明、未旋转、同一页面或未旋转组坐标中的复选框与单选框。没有执行原 DLL，没有完成原版 GUI/像素对照，也没有增加原生 `.rp` 写回。原版证据和产品浏览器检查分别记录。

## 修正的问题

此前宿主使用 `(pointer - pointerDown) / zoom`，再把位移按 8 取整，并拒绝所有 Ctrl/Alt。松手时如果坐标或按键变化，还会补做一次布局。这些规则与本次新闭合的原控制链不同。

- 新输入层使用绝对 diagram point；初始点来自现代 BoxModel 的逻辑手柄锚点，不是物理按下位置或 CSS 热区中心。侧边中心有 `(size - 1) / 2` 偏移。
- 网格按候选框的绝对边缘进行 AwayFromZero 舍入，使用两轴 spacing 和一个已转换的容差。保留本产品明确的 8 单位网格；原版默认 spacing 尚未证明。浏览器用统一 zoom 将原 5-device-unit 容差转换成 `5 / zoom`，不声称恢复了原版 DPI/graphics 服务。
- 原始坐标与键状态逐帧复制入队。字体准备完成后，每帧先从前一帧已接受的 owner 矩形求当前边界，再做吸附与布局。下游缩放仍使用另存的原始几何，不将两个生命周期混为一谈。
- Alt 在每次移动时旁路吸附。Ctrl 模式只在按下时判定：单 SelectionButton 无旋转能力；多选恰为 Ctrl 才进入尚未支持的旋转模式并明确拒绝。Ctrl+Shift、Ctrl+Alt 或途中按 Ctrl 的 resize 路径可以继续。输入层消费 Ctrl/Alt 后，只把 Shift 传给原有布局模型。
- 原 `PF4p → Moved` 只终结手势，不再调用尺寸控制器。宿主松手仅 `finish()`，不补算末帧；排队移动帧结束后，一次手势仍只有一次撤销。

平台另有 SpaceModifier 位，但其物理按键映射尚未闭合。宿主对浏览器 Space/Meta 组合明确阻止，活动手势遇到它们时回滚；这是产品保护边界，不是原版键盘行为结论。原有 Escape、取消、捕获丢失、上下文失效、字体/测量失败和独立属性事务保护继续保留。

## 代码与证据

- `src/model/selection-pointer-input.ts`：纯输入模式、逻辑锚点、当前边界、候选框、网格修正与差量。原 `selection-pointer-resize.ts` 未改，保留其直接接受 Ctrl/Alt 时的拒绝门。
- `src/runtime/selection-pointer-session.ts`：队列载荷改为绝对 point 与键快照；`finish` 不接受新尺寸请求。
- `src/App.tsx`：坐标转换、按下模式快照、逐帧输入→布局、事务完成和未覆盖按键保护。
- `tests/selection-pointer-input.test.ts`、`tests/selection-pointer-session.test.ts`、`tests/e2e/selection-pointer-resize.spec.ts`：源差分、队列值所有权和实际浏览器动作/保存/撤销检查。

来源见 [平台与分派](selection-input-keys-evidence.md) 和 [网格输入](selection-input-grid-evidence.md)。固定 Axure RP 11.0.0.4150 DLL SHA-256 为 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。原指令解释使用明确注入的键盘、graphics、文字测量和通知服务，不执行原 DLL。

平台研究保留 139 个分派场景，以及 80 个已进入 resize 模式的完整下游差分（240 实际帧与 240 Shift-only 对照帧）。网格研究保留 1,752 个原指令/独立公式场景，另有一个两帧输入与原布局控制器组合案例。新模型 19 个测试消费全部 1,752 个网格记录和 128 个模式观察；与旧布局模型合计 107 项专项测试。

两帧组合是当前边界生命周期的实际区分证据：初始公共框 `530×20`，第一帧文字高度修正后公共框为 `636×20`。第二帧正确得到首控件宽 `300.3773584905661`；误用初始边界则为 `298.86792452830184`。浏览器分别在字体已准备和延迟准备两种情况下核对同一源预期；使用真实浏览器文字度量，固定字体保持单行高 20。

## 验证与失败保留

同一最终源码通过类型检查、生产构建、5,652/5,652 单元测试、35/35 手柄生产浏览器检查与 72/72 相关生产浏览器回归。失败、flaky、跳过均为 0，构建和检查前后源码哈希未变；三张实际产品截图已查看。独立审查另执行 3/3 产品模块组合检查与 16/16 平台附加位回放。完整来源、原始日志与 SHA-256 见 [冻结验证记录](selection-input-verification.json)。

执行命令：`node .build/run-selection-layout-stable-checks.mjs input-final typecheck unit`、`node .build/build-selection-layout-core.mjs input-final`、`npx playwright test --config .build/selection-input-final.config.ts`、`npx playwright test --config .build/selection-input-regression.config.ts`。现有 Vite 无扩展名导入提示未由本阶段修改；检查退出码均为 0。

修复前以冻结的上一 Shift 构建复现：2 个 Alt 场景失败，1 个释放键状态场景失败，后续合同检查中 10 个有效场景失败。另一个 zoom=4 浏览器测试因当前 UI 仅到 zoom=2 而超时，属于测试输入错误，已移出浏览器范围；zoom=4 仍由原指令与纯模型验证。原日志、JSON、截图、trace 和当时测试文件均保留，没有把该超时计作产品缺陷。之前的 Shift 末帧测试预期依据新 `Moved` 证据改正，其旧源码与验证记录保留。

模型开发的缺少 helper、grid 未实现、union callback 把数组索引误当 allowZero，以及一次退化网格测试预期错误分别保留。最后一项修正测试容差后证明原生非有限结果；产品会在提交前原子拒绝非有限值，不声称复制原版异常后的效果。

## 剩余范围

未完成：选框旋转模式、Space/Meta 原版映射、静止切键的完整事件派发、引导线/对象吸附、任意旋转或容器变换、混合普通控件与递归组缩放、完整创建默认值与状态绘制、原版字体/DPI、全量浏览器与本阶段 Windows 包验收、原版 GUI/像素对照及原生 `.rp` 写回。一般控件/组的旧拖动路径未因本阶段改变。此前发布 ZIP/ASAR 保持不变，`fullAxureParity=false`、`originalGuiCompared=false`、`published=false`。
