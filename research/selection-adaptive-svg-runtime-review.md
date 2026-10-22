# Adaptive SVG runtime：有限范围只读复核

结论：在本次阅读的实现与已冻结原逻辑证据之间，未发现确定的合同错误。本结论仅覆盖普通 Checkbox/Radio 的自适应缩放事件记录及数值读回；不是完整 Axure 等价性声明。

## 阅读快照

- 产品文件：`src/runtime/export-runtime.ts`，SHA256 `07752b1d3d70b7097bb824c8643caa99fbe46b184e0b843736ddb572470d1d9a`。此哈希不同于实现方最初通知的版本，报告以实际读取的文件为准。
- 原逻辑报告：`research/selection-adaptive-svg-evidence.md` 与 `selection-adaptive-svg-evidence.json`。
- 完整来源清单：`research/selection-adaptive-svg-manifest-complete.json`，SHA256 `6e9f029e630e60a6d43673d98509eb96114dc0022df5a74c22e921e4844895a8`；本轮重新核对其中 44 个文件，44/44 无漂移。
- 只读查看 `tests/selection-adaptive-runtime.test.ts` 的来源固定、序列和数值 controls 接入方式。没有执行产品测试、浏览器、构建或安装命令。

## 对照结果

1. `selectionScaleReadback`（约 678–698 行）先限制有限 scalar 到 float32 范围，再取 float32 精确二进制分数，以整数商和余数完成六有效位 nearest ties-even。它没有把 JavaScript `toPrecision(6)` 当作 exact-midpoint 规则，符合独立 21 个常规数值和 6 个 midpoint controls。有限极大值与真正 NaN/Infinity CSS 文本的区别由调用侧和此 helper 分别处理。
2. `applySelectionAdaptiveScale`（约 700–722 行）在受支持的命名视图尺寸事件上先记录 `top left` origin，以 Base owner width/height 为分母，以单独保存的 computed readback 为旧矩阵。当前 raw CSS 提交值保留在 `svgTransform`，下一次读取基值保留在 `svgReadback`，符合原浏览器即时绘制与序列化读回的区别。
3. 当候选 raw pair 与旧 computed pair 相等时不重写 raw transform；因此 ratio=1 不会把旧 raw 精度缩减成 computed 精度。候选 pair 有一个非有限值时，整个 pair 保留，origin 仍已更新。这与原 helper 的写入顺序及 CSS 拒绝行为一致。
4. `initializeSelectionPaints` 在初次命名视图初始化时推进一次；`applyAdaptiveView` 在实际视图转换时推进。普通 paint、状态动作和 `selectionIndicatorPaint` getter 没有累乘。返回 Base 保留 nested SVG transform；同一个已管理 ID 提前返回；不同 ID 即使尺寸相同也重新推进。
5. `paintSelection` 把既有 transform 复制到 paint 快照，scale helper 同步当前 paint；getter 返回复制值。因此样式重绘不会主动抹掉已经形成的 scale/origin。实现将 row 重建当作新 asset/ledger，未把原 row 的 raw pair 自动复制给新 asset。
6. 测试读入并固定独立原模块结果和数值 controls 的哈希，而非从产品 renderer 产生期望值。这里只核对测试来源和断言接入，没有代替实现方重新运行测试。

## 保留边界

- 产品把独立 width/height 声明补成完整 size carrier，是已明确选择的 schema bridge；原生成器是否输出半轴 size JSON 尚未闭合。不能把原 runtime 对 malformed partial size 的 NaN 拒绝行为宣称为该 bridge 的行为。
- 普通原 state override 也可以携带 size；当前产品状态 schema 的可表达范围与原任意 JSON 不同。本次检查不扩展 schema 或将不可表达输入计入已实现域。
- 完整 hidden/unplaced/inactive-panel/master/repeater 组合初始化和 row refresh 生命周期未由本轮原模块探针覆盖；上述入口检查不把这些范围升级为原生等价。
- 只比较普通无额外 SVG CSS transform、无 compound 的受支持载体。当前浏览器的 float32/六有效位行为有独立 controls 支持，不代表所有浏览器或无限数值域的保证。
- 未修改产品、冻结证据或配置，未执行原 DLL、原 GUI、浏览器或产品测试。后续源码变化需要以新的文件哈希界定复核范围。
