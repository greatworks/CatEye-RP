# 运行时 Rotate：实现范围与验证

本阶段为独立原型编辑器增加 Rotate 动作、Rotated 事件和受限的原生旋转交互导入。它与作者画布上的初始 Rotate 属性分别保存：播放中的旋转不改工程初值。

## 操作

选中元件，在 Interactions 添加 Rotate，指定元件或同层组合后设置 By / To、角度、顺时针或逆时针、锚点、X/Y 偏移和动画。None 立即完成；其他动画使用所填毫秒数。角度与偏移支持现有受限表达式。Rotated 可继续设置文字、变量或执行其他动作。同层组合按共同外框旋转，现有扁平组合模型不等同于原生嵌套 Layer。

角度增量不会自动选择最短路径。To 0° 从 720° 返回时保留完整差值。锚点偏移使用控件局部轴；部分表单控件在偏移旋转时仅沿圆弧移动，不改变自身朝向。动画不会阻塞其他元件的事件。

## 证据与实现

- 原版身份固定为 Axure RP 11.0.0.4150；DLL SHA-256 为 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。
- [原版运行时合同](runtime-rotate-motion-evidence.md)记录 39 项原函数 VM 与 92 项实际 Edge 探针，保留原脚本哈希、明确的替代接口和数值夹具。它们验证所选函数的行为，不能替代原版完整工程或画面对照。
- `src/model/types.ts` 与 `document.ts` 定义和验证 Rotate 参数；复制与组件实例化会重映射表达式里的控件引用。
- `src/components/RotationActionEditor.tsx` 与 `Inspector.tsx` 提供编辑入口，继承现有保存、撤销和重做流程。
- `src/runtime/export-runtime.ts` 承担预览、离线 HTML 和内部框架共同使用的运行行为。动画按目标实例排队，重复器各行拥有独立状态。
- [原生格式研究](runtime-rotate-format-evidence.md)说明 reader 和 importer 只恢复字段、目标及整事件都可解释的结构。11 份真实样本新增恢复 3 条交互：UI 示例库 2 条 Loaded → Rotate，Basics 教程 1 条 Click → Rotate。删去这 3 条明确新增交互后，前后完整导入文档一致。另 4 条 Rotate 所在事件含不支持的兄弟动作，保持整事件跳过。

## 验证记录

2026-10-20 的 `node .build/run-runtime-rotate-checks.mjs` 已通过 TypeScript 检查、154 个文件中的 3860 项单元测试及 727 项原生 reader 测试。生产构建成功；候选包核对了 118 个构建输入和 6 个构建输出，包内代码、解析器和第三方字体声明均有哈希约束。

候选桌面包完成 Rotate 配置编辑、单次撤销、重做、切换到另一工程后重新打开、预览和断网离线 HTML 检查；动画有真实中间帧，重复器行及内部框架独立，播放后的保存内容保持初值。原生导入另以两份真实文件验证 3 条恢复的 Rotate、完整文档差异以及保存重开一致性。编辑器、预览和离线截图已逐张查看；它们是本产品的验证截图，不是原版像素对照。

[独立集成复核](runtime-rotate-motion-integration-review.md)通过 43 项产品用例、9 项原函数阴影/坐标用例及 2 项原函数父容器适配用例。复核中复现并修复了队列错误归属、阴影下绘制位置与公开坐标缓存不一致、目标零角度的父容器边界回退和父容器 Resize 事件遗漏；失败输出与修复后的结果分别保留。

完整生产浏览器回归 **306/306** 通过，无失败、重试通过或跳过项。针对同一候选 ASAR 的 **10/10** 组桌面检查通过，包括本阶段编辑/播放、真实原生导入，以及作者旋转、路径节点、重复器布局/分页、文字自动适配、内部框架、自适应全视图和交互样式回归。历史测试产物的本轮输出另存，原有 705 份证据保持原哈希。

本轮主要命令为 `node .build/run-runtime-rotate-checks.mjs`、`node node_modules/vite/bin/vite.js build --outDir .build/runtime-rotate-dist`、`node .build/run-runtime-rotate-browser.mjs release` 和 `node .build/run-runtime-rotate-smokes.mjs`。源文件、原函数切片、候选包及 ZIP 的最终校验见 [机器可读记录](runtime-rotate-verification.json)。构建成功，仍记录了 native-config-loader 扩展提示和嵌入字体块超过 500 kB 的体积警告。

可直接打开 [演示工程](../artifacts/runtime-rotate-demo.rea.json)，也可在浏览器中打开 [离线演示](../artifacts/runtime-rotate.html)。

## 未完成范围

完整的定时 Move / Resize / Rotate 合并行为尚未实现；现有 Move 与 Resize 保持即时动作语义。嵌套原生 Layer、独立 Layer 事件、原生表达式局部绑定和完整原生交互树仍有边界。作者端 9 个锚点按已证运行时字符串规则提供，不代表已逐项核对原版九宫格菜单。

2026-10-20 重新恢复原版 Untitled 窗口后，菜单可读取，截图及一次重新绑定后的恢复尝试仍超时；[观察记录](runtime-rotate-original-gui-observation.json)保留确切错误。原版画布交互和逐像素对照未完成。本阶段没有执行原 DLL 方法，也没有向发行包加入 Axure 专有代码。完整 `.rp` 写回、云协作与完整 Axure 功能等价仍未完成。
